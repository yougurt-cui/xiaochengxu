import { api, login, hasSession, mapPet, errorText } from '../../api/miniprogram';
import { loadStore, saveStore, persistImage } from '../../utils/pet-store';
Page({
  data: {
    form: { name: '', type: '猫咪', breed: '', age: '', weight: '' },
    loading: false,
    saving: false,
    recognizing: false,
    mockResult: false,
    photo: '',
    error: '',
  },
  onLoad() {
    const pet = loadStore().pet;
    if (pet) this.setData({ form: { ...pet } });
    if (hasSession()) this.loadPet();
  },
  async loadPet() {
    this.setData({ loading: true, error: '' });
    try {
      const r = await api('/cat-profiles');
      const p = r.items.find((v) => v.is_default) || r.items[0];
      if (p) {
        saveStore({ pet: mapPet(p) });
        this.setData({ form: mapPet(p) });
      }
    } catch (e) {
      this.setData({ error: errorText(e) });
    } finally {
      this.setData({ loading: false });
    }
  },
  input(e) {
    this.setData({ [`form.${e.currentTarget.dataset.key}`]: e.detail.value });
  },
  recognize() {
    if (this.data.recognizing || this.data.saving || this.data.loading) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: async (r) => {
        this.setData({ recognizing: true, mockResult: false });
        try {
          const photo = await persistImage(r.tempFiles[0].tempFilePath);
          if (this._disposed) return;
          this.setData({ photo });
          this._timer = setTimeout(() => {
            this.setData({
              recognizing: false,
              mockResult: true,
              form: {
                ...this.data.form,
                name: this.data.form.name || '小满',
                type: '猫咪',
                breed: '英国短毛猫',
                age: this.data.form.age || '2',
                weight: this.data.form.weight || '4.5',
              },
            });
          }, 900);
        } catch (e) {
          this.setData({ recognizing: false });
          wx.showToast({ title: '照片读取失败，请重试', icon: 'none' });
        }
      },
      fail: (e) => {
        if (!/cancel/.test(e.errMsg || '')) wx.showToast({ title: '暂时无法打开相机或相册', icon: 'none' });
      },
    });
  },
  onUnload() {
    this._disposed = true;
    clearTimeout(this._timer);
  },
  async save() {
    if (this.data.saving || this.data.recognizing) return;
    const f = this.data.form;
    const age = Number(f.age),
      weight = Number(f.weight);
    if (
      !f.name.trim() ||
      !String(f.breed || '').trim() ||
      f.age === '' ||
      f.weight === '' ||
      !Number.isFinite(age) ||
      !Number.isFinite(weight) ||
      age < 0 ||
      age > 30 ||
      weight < 0.1 ||
      weight > 30
    ) {
      wx.showToast({ title: '请完善昵称、品种及有效年龄体重', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      await login();
      let id = f.id;
      if (!id) {
        const r = await api('/cat-profiles');
        const p = r.items.find((v) => v.is_default) || r.items[0];
        if (p) {
          saveStore({ pet: mapPet(p) });
          this.setData({ form: mapPet(p), mockResult: false });
          wx.showModal({
            title: '已找到你的宠物档案',
            content: '已载入现有档案，请核对后再保存，避免覆盖已有信息。',
            showCancel: false,
          });
          return;
        }
      }
      const result = await api(id ? `/cat-profiles/${id}` : '/cat-profiles', id ? 'PATCH' : 'POST', {
        name: f.name.trim(),
        breed: f.breed.trim(),
        age_months: Math.round(age * 12),
        weight_kg: weight,
        is_default: true,
      });
      saveStore({ pet: mapPet(result.item) });
      wx.showToast({ title: '档案已保存' });
      wx.navigateBack();
    } catch (e) {
      wx.showToast({ title: errorText(e), icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },
});
