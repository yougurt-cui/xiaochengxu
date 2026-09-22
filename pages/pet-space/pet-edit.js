import { api, login, hasSession, mapPet, errorText, recognizePetImage } from '../../api/miniprogram';
import { loadStore, saveStore } from '../../utils/pet-store';
Page({
  data: {
    form: { name: '', type: '猫咪', animal_type: 'cat', breed: '', age: '', weight: '' },
    loading: false,
    saving: false,
    recognizing: false,
    recognitionNote: '',
    animalTypes: ['猫咪', '狗狗', '未知'],
    photo: '',
    error: '',
  },
  onLoad(q = {}) {
    this._profileId = q.id || '';
    const pet = loadStore().pet;
    if (pet) this.setData({ form: { ...pet } });
    if (hasSession()) this.loadPet();
  },
  async loadPet() {
    this.setData({ loading: true, error: '' });
    try {
      const r = await api('/cat-profiles');
      const summary = r.items.find((v) => v.id === this._profileId) || r.items.find((v) => v.is_default) || r.items[0];
      const p = summary ? (await api(`/cat-profiles/${encodeURIComponent(summary.id)}`)).item : null;
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
  changeType(e) {
    const index = Number(e.detail.value);
    this.setData({ 'form.animal_type': ['cat', 'dog', 'unknown'][index], 'form.type': this.data.animalTypes[index] });
  },
  recognize() {
    if (this.data.recognizing || this.data.saving || this.data.loading || this._choosing) return;
    this._choosing = true;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: async (r) => {
        if (this._disposed) return;
        const file = r.tempFiles[0];
        if (file.size > 10 * 1024 * 1024) {
          wx.showToast({ title: '请选择不超过 10MB 的照片', icon: 'none' });
          return;
        }
        this.setData({ recognizing: true, recognitionNote: '' });
        try {
          const result = await recognizePetImage(file.tempFilePath);
          if (this._disposed) return;
          const form = { ...this.data.form, avatar_image_id: result.image.id };
          const suggestions = result.suggestions || {};
          if (result.recognition_status === 'success') {
            const kind = suggestions.animal_type && suggestions.animal_type.value;
            if (['cat', 'dog', 'unknown'].includes(kind)) {
              form.animal_type = kind;
              form.type = { cat: '猫咪', dog: '狗狗', unknown: '未知' }[kind];
            }
            if (suggestions.breed && suggestions.breed.value) form.breed = suggestions.breed.value;
            const age = suggestions.age && suggestions.age.estimated_years;
            const weight = suggestions.weight && suggestions.weight.estimated_kg;
            // Preserve entered measurements; null suggestions must never become zero.
            if (
              (form.age === '' || form.age == null) &&
              typeof age === 'number' &&
              Number.isFinite(age) &&
              age >= 0 &&
              age <= 30
            )
              form.age = Math.round(age * 10) / 10;
            if (
              (form.weight === '' || form.weight == null) &&
              typeof weight === 'number' &&
              Number.isFinite(weight) &&
              weight >= 0.1 &&
              weight <= 30
            )
              form.weight = Math.round(weight * 100) / 100;
          }
          this.setData({
            photo: file.tempFilePath,
            form,
            recognitionNote:
              result.recognition_status === 'success'
                ? '已填入识别建议，请核对品种。年龄和体重仅为照片估算，请按实际情况修改后保存。'
                : '照片已上传，可作为头像。暂未识别出档案信息，请手动填写，或点击上方更换照片重试。',
          });
        } catch (e) {
          if (!this._disposed) this.setData({ recognitionNote: errorText(e) + '，可点击上方重试，或继续手动填写。' });
        } finally {
          if (!this._disposed) this.setData({ recognizing: false });
        }
      },
      fail: (e) => {
        if (!/cancel/.test(e.errMsg || '')) wx.showToast({ title: '暂时无法打开相机或相册', icon: 'none' });
      },
      complete: () => {
        this._choosing = false;
      },
    });
  },
  onUnload() {
    this._disposed = true;
  },
  async save() {
    if (this.data.saving || this.data.recognizing || this.data.loading) return;
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
          this.setData({ form: mapPet(p), photo: '', recognitionNote: '' });
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
        animal_type: f.animal_type || 'cat',
        ...(f.avatar_image_id ? { avatar_image_id: f.avatar_image_id } : {}),
        breed: f.breed.trim(),
        age_months: Math.round(age * 12),
        weight_kg: weight,
        food_brand: (f.food_brand || '').trim(),
        food_product: (f.food_product || '').trim(),
        notes: (f.notes || '').trim(),
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
