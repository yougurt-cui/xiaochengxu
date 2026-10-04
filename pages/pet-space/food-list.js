import { api, hasSession, requireSession, errorText } from '../../api/miniprogram';
import { accountKey } from '../../utils/pet-store';
import { petDiet, rememberDiet, dietHistory } from '../../utils/diet-history';
Page({
  data: {
    history: false,
    pet: null,
    items: [],
    loading: false,
    error: '',
    editing: false,
    saving: false,
    form: { brand: '', product: '' },
  },
  onLoad(q) {
    this.petId = q.petId || '';
    this.setData({ history: q.mode === 'history' });
  },
  onShow() {
    this._active = true;
    this.load();
  },
  onHide() {
    this._active = false;
    this._version = (this._version || 0) + 1;
  },
  onUnload() {
    this.onHide();
  },
  async load() {
    if (!hasSession()) {
      this.setData({ error: '请登录后查看清单', pet: null, items: [] });
      return;
    }
    const version = (this._version = (this._version || 0) + 1),
      account = accountKey('food-list');
    this.setData({ loading: true, error: '' });
    try {
      const response = await api('/cat-profiles?limit=100');
      if (!this._active || version !== this._version || account !== accountKey('food-list')) return;
      const pet = (response.items || []).find((p) => p.id === this.petId);
      if (!pet) throw new Error('该宠物档案已不存在');
      rememberDiet(pet);
      const diet = petDiet(pet);
      const items = this.data.history
        ? dietHistory(pet.id).map((item) => ({ ...item, date: item.archivedAt.slice(0, 10) }))
        : diet.brand || diet.product
        ? [{ ...diet, id: pet.id }]
        : [];
      this.setData({ pet, items });
    } catch (e) {
      if (version === this._version) this.setData({ error: errorText(e) });
    } finally {
      if (version === this._version) this.setData({ loading: false });
    }
  },
  edit() {
    if (!requireSession() || !this.data.pet || this.data.loading) return;
    this.setData({ editing: true, form: petDiet(this.data.pet) });
  },
  close() {
    if (!this.data.saving) this.setData({ editing: false });
  },
  input(e) {
    this.setData({ ['form.' + e.currentTarget.dataset.key]: e.detail.value });
  },
  async save() {
    if (!requireSession() || this.data.saving) return;
    const diet = { brand: this.data.form.brand.trim(), product: this.data.form.product.trim() };
    if (!diet.brand || !diet.product) {
      wx.showToast({ title: '请填写品牌和系列', icon: 'none' });
      return;
    }
    const account = accountKey('food-list'),
      pet = this.data.pet;
    this.setData({ saving: true });
    try {
      await api('/cat-profiles/' + encodeURIComponent(pet.id), 'PATCH', { diet });
      if (account !== accountKey('food-list')) return;
      rememberDiet(pet);
      rememberDiet({ id: pet.id, diet });
      this.setData({ editing: false });
      if (this._active) await this.load();
    } catch (e) {
      wx.showToast({ title: errorText(e), icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },
});
