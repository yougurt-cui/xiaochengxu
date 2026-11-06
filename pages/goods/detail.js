import { errorText } from '../../api/miniprogram';
import { getGoods, toggleGoodsFavorite, askAboutGoods } from '../../utils/goods';
import { loadStore } from '../../utils/pet-store';
import { shareCard, timelineCard } from '../../utils/share';

Page({
  data: { goods: null, loading: true, error: '', unavailable: false, imageIndex: 0, showContact: false },
  onLoad(options) { this._id = options.id || ''; this.loadGoods(); },
  onShow() {
    if (this.data.goods) this.setData({ 'goods.saved': (loadStore().goodsFavorites || []).includes(this._id) });
  },
  onUnload() { this._loadVersion = (this._loadVersion || 0) + 1; },
  async loadGoods() {
    const version = this._loadVersion = (this._loadVersion || 0) + 1;
    this.setData({ loading: true, error: '', unavailable: false, showContact: false });
    if (!this._id) { this.setData({ loading: false, error: '商品链接不完整', unavailable: true }); return; }
    try {
      const goods = await getGoods(this._id);
      if (version === this._loadVersion) this.setData({ goods, imageIndex: 0 });
    } catch (e) {
      if (version === this._loadVersion) this.setData({ goods: null, error: errorText(e), unavailable: e.statusCode === 404 });
    } finally {
      if (version === this._loadVersion) this.setData({ loading: false });
    }
  },
  changeImage(e) { this.setData({ imageIndex: e.detail.current }); },
  previewImage() {
    const { goods, imageIndex } = this.data;
    if (goods && goods.images.length) wx.previewImage({ current: goods.images[imageIndex], urls: goods.images });
  },
  toggleSave() {
    if (!this.data.goods) return;
    try {
      const saved = toggleGoodsFavorite(this._id);
      this.setData({ 'goods.saved': saved });
      wx.showToast({ title: saved ? '已收藏到本机' : '已取消收藏', icon: 'none' });
    } catch (_) { wx.showToast({ title: '收藏失败，请重试', icon: 'none' }); }
  },
  ask() { if (this.data.goods) askAboutGoods(this.data.goods); },
  openContact() { if (this.data.goods) this.setData({ showContact: true }); },
  closeContact() { this.setData({ showContact: false }); },
  stopTouch() {},
  copyShopLink() {
    const link = this.data.goods && this.data.goods.shopLink;
    if (!link) return;
    wx.setClipboardData({ data: link, success: () => wx.showToast({ title: '店铺地址已复制', icon: 'success' }),
      fail: () => wx.showToast({ title: '复制失败，请重试', icon: 'none' }) });
  },
  onShareAppMessage() {
    return shareCard(this.data.goods ? this.data.goods.name : '逛逛好物', `/pages/goods/detail?id=${encodeURIComponent(this._id || '')}`);
  },
  onShareTimeline() { return timelineCard(this.onShareAppMessage()); },
});
