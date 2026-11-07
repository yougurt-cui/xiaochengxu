import { requireSession, hasSession, errorText } from '../../api/miniprogram';
import { accountKey } from '../../utils/pet-store';
import { getMerchantIdentity, uploadMerchantImage, validateGoodsForm, publishMerchantGoods } from '../../utils/merchant';

Page({
  data: {
    name: '', content: '', price: '', images: [], canPublish: false,
    merchants: [], merchantId: 0, merchantIndex: -1,
    isMerchant: false, checking: true, identityError: '',
    saving: false, choosing: false, progress: '', publishedId: '', loggedIn: false,
  },
  updateForm(patch) {
    const form = { ...this.data, ...patch };
    this.setData({ ...patch, canPublish: !validateGoodsForm(form) });
  },
  onShow() {
    const account = accountKey('merchant-publish');
    if (this._account !== account) {
      this._account = account;
      this._pending = null;
      const pending = wx.getStorageSync(account);
      const form = pending?.form;
      this.updateForm({
        name: form?.name || '', content: form?.content || '', price: form?.price || '',
        images: form?.images || [], merchantId: form?.merchantId || 0,
        merchants: [], merchantIndex: -1, isMerchant: false, publishedId: '',
      });
      if (pending?.key && pending?.signature) this._pending = pending;
    }
    this.checkIdentity();
  },
  onUnload() {
    this._unloaded = true;
    this._identityVersion = (this._identityVersion || 0) + 1;
  },
  async checkIdentity() {
    const version = this._identityVersion = (this._identityVersion || 0) + 1;
    const account = this._account;
    this.setData({ checking: true, identityError: '', isMerchant: false, loggedIn: hasSession() });
    try {
      const identity = await getMerchantIdentity();
      if (this._unloaded || version !== this._identityVersion || account !== accountKey('merchant-publish')) return;
      const merchants = identity.merchants.map((item) => ({
        ...item,
        label: `${item.merchant_type} · ${item.shop_link || `商家 ${item.id}`}`,
      }));
      let merchantIndex = merchants.findIndex((item) => item.id === this.data.merchantId);
      if (merchantIndex < 0 && merchants.length === 1) merchantIndex = 0;
      this.updateForm({
        merchants, merchantIndex,
        merchantId: merchantIndex >= 0 ? merchants[merchantIndex].id : 0,
        isMerchant: identity.is_merchant === true,
      });
    } catch (error) {
      if (!this._unloaded && version === this._identityVersion && account === accountKey('merchant-publish')) {
        this.setData({ identityError: errorText(error), loggedIn: hasSession() });
      }
    } finally {
      if (!this._unloaded && version === this._identityVersion) this.setData({ checking: false });
    }
  },
  login() { requireSession(); },
  input(e) {
    if (this.data.saving || this.data.publishedId) return;
    const key = e.currentTarget.dataset.key;
    if (['name', 'content', 'price'].includes(key)) this.updateForm({ [key]: e.detail.value });
  },
  selectMerchant(e) {
    if (this.data.saving) return;
    const merchantIndex = Number(e.detail.value);
    const merchant = this.data.merchants[merchantIndex];
    if (merchant) this.updateForm({ merchantIndex, merchantId: merchant.id });
  },
  chooseImages() {
    if (this.data.saving || this.data.choosing || this.data.images.length >= 9) return;
    const account = this._account;
    this.setData({ choosing: true });
    wx.chooseMedia({
      count: 9 - this.data.images.length,
      mediaType: ['image'],
      success: (result) => {
        if (this._unloaded || account !== accountKey('merchant-publish')) return;
        if (result.tempFiles.some((file) => file.size > 10 * 1024 * 1024)) {
          wx.showToast({ title: '每张图片需小于10MB', icon: 'none' });
          return;
        }
        const images = result.tempFiles.map((file) => ({ path: file.tempFilePath, id: '', url: '' }));
        this.updateForm({ images: [...this.data.images, ...images].slice(0, 9) });
      },
      complete: () => { if (!this._unloaded) this.setData({ choosing: false }); },
    });
  },
  removeImage(e) {
    if (this.data.saving) return;
    const index = Number(e.currentTarget.dataset.index);
    this.updateForm({ images: this.data.images.filter((_, i) => i !== index) });
  },
  previewImage(e) {
    const urls = this.data.images.map((image) => image.url || image.path);
    const current = urls[Number(e.currentTarget.dataset.index)];
    if (current) wx.previewImage({ urls, current });
  },
  async publish() {
    if (this.data.saving || this.data.choosing || this.data.checking || this.data.publishedId) return;
    if (!requireSession()) return;
    if (!this.data.isMerchant) return;
    const validation = validateGoodsForm(this.data);
    if (validation) { wx.showToast({ title: validation, icon: 'none' }); return; }
    const account = this._account;
    const token = wx.getStorageSync('miniprogram_token');
    const isCurrent = () => !this._unloaded && account === accountKey('merchant-publish') && token === wx.getStorageSync('miniprogram_token');
    const form = {
      name: this.data.name.trim(), content: this.data.content.trim(), price: this.data.price.trim(),
      merchantId: this.data.merchantId, images: this.data.images.map((image) => ({ ...image })),
    };
    this.setData({ saving: true, progress: '正在确认商家身份' });
    try {
      const identity = await getMerchantIdentity();
      if (!isCurrent()) return;
      if (!identity.is_merchant || !identity.merchants.some((merchant) => merchant.id === form.merchantId)) {
        this.setData({ isMerchant: false });
        throw new Error('商家认证已变更，请重新确认身份');
      }
      for (let i = 0; i < form.images.length; i += 1) {
        if (!isCurrent()) return;
        const image = form.images[i];
        if (image.id) continue;
        this.setData({ progress: `正在上传图片 ${i + 1}/${form.images.length}` });
        const uploaded = await uploadMerchantImage(image.path);
        if (!isCurrent()) return;
        form.images[i] = { path: uploaded.url, ...uploaded };
        this.updateForm({ images: form.images.map((item) => ({ ...item })) });
      }
      const payload = {
        merchant_id: form.merchantId,
        product_name: form.name,
        product_content: form.content,
        product_price: form.price,
        image_ids: form.images.map((image) => image.id),
      };
      const signature = JSON.stringify(payload);
      if (!this._pending || this._pending.signature !== signature) {
        this._pending = { key: `goods-${Date.now()}-${Math.random().toString(36).slice(2)}`, signature, form };
      }
      // Persist before sending so reopening after a lost response retries the same publication.
      wx.setStorageSync(account, this._pending);
      this.setData({ progress: '正在发布商品' });
      const result = await publishMerchantGoods(payload, this._pending.key);
      if (!isCurrent()) return;
      this.setData({ publishedId: result.product_id });
      try {
        wx.removeStorageSync(account);
        wx.setStorageSync(accountKey('goods-published'), true);
      } catch (_) { /* A confirmed publication remains successful if local cache cleanup fails. */ }
      wx.showToast({ title: '商品已发布', icon: 'success' });
    } catch (error) {
      if (!this._unloaded && account === accountKey('merchant-publish')) {
        if (error.statusCode === 403) this.setData({ isMerchant: false });
        if (error.statusCode === 401) this.setData({ loggedIn: false, isMerchant: false });
        wx.showModal({ title: '商品暂未发布', content: errorText(error), showCancel: false });
      }
    } finally {
      if (!this._unloaded) this.setData({ saving: false, progress: '' });
    }
  },
  viewProduct() {
    if (this.data.publishedId) wx.redirectTo({ url: `/pages/goods/detail?id=${encodeURIComponent(this.data.publishedId)}` });
  },
});
