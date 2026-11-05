import { syncCloudBirthday } from '../../utils/reminder-api';
import { birthdayAge, profileForm, profilePayload } from '../../utils/pet-profile-form';
import { requireSession, api, login, hasSession, mapPet, errorText, recognizePetImage } from '../../api/miniprogram';
import { loadStore, saveStore, cachePetList, accountKey } from '../../utils/pet-store';

Page({
  data: {
    form: profileForm({}),
    step: 0,
    steps: ['生日', '体重', '是否过敏', '既往疾病', '当前症状', '健康状态', '当前口粮', '备注'],
    sexes: ['未知', '公', '母'],
    neuterOptions: ['未填写', '未绝育', '已绝育'],
    today: '',
    loading: false,
    saving: false,
    deleting: false,
    recognizing: false,
    recognitionNote: '',
    breedCatalog: {},
    breedOptions: [],
    breedCandidates: [],
    appearanceRecognitionText: '',
    animalTypes: ['猫咪', '狗狗', '未知'],
    photo: '',
    error: '',
  },
  onLoad(q = {}) {
    this._profileId = q.id || '';
    this._creating = q.mode === 'create';
    const now = new Date();
    this.setData({
      today: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(
        2,
        '0',
      )}`,
    });
    const { pet } = loadStore();
    if (pet && !this._creating && (!this._profileId || pet.id === this._profileId))
      this.setData({ form: profileForm(pet) });
    if (hasSession() && !this._creating) this.loadPet();
    this.loadBreedCatalog();
  },
  async loadBreedCatalog() {
    try {
      const result = await api('/pet-breeds');
      if (this._disposed) return;
      const breedCatalog = result.breeds || {};
      this.setData({ breedCatalog, breedOptions: breedCatalog[this.data.form.animal_type] || [] });
    } catch (_) {
      // The manual breed field remains usable while older servers lack the catalog.
    }
  },
  chooseBreed(e) {
    const selected = this.data.breedOptions.find((_, index) => index === Number(e.detail.value));
    if (selected) this.setData({ 'form.breed': selected.name, breedCandidates: [] });
  },
  confirmBreedCandidate(e) {
    const { value } = e.currentTarget.dataset;
    if (this.data.recognizing || !this.data.breedCandidates.some((item) => item.value === value)) return;
    this.setData({ 'form.breed': value, breedCandidates: [] });
  },
  async loadPet() {
    this.setData({ loading: true, error: '' });
    try {
      const r = await api('/cat-profiles');
      const summary = this._profileId ? { id: this._profileId } : r.items.find((v) => v.is_default) || r.items[0];
      const p = summary ? (await api(`/cat-profiles/${encodeURIComponent(summary.id)}`)).item : null;
      if (p) {
        saveStore({ pet: mapPet(p) });
        this.setData({
          form: profileForm(mapPet(p)),
          breedOptions: this.data.breedCatalog[p.animal_type || 'cat'] || [],
        });
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
  inputAge(e) {
    this.setData({ 'form.ageYears': e.detail.value, 'form.ageEdited': true });
  },
  changeType(e) {
    const index = Number(e.detail.value);
    const kind = ['cat', 'dog', 'unknown'][index];
    this.setData({
      'form.animal_type': kind,
      'form.type': this.data.animalTypes[index],
      'form.breed': '',
      breedOptions: this.data.breedCatalog[kind] || [],
      breedCandidates: [],
      appearanceRecognitionText: '',
    });
  },
  changeSex(e) {
    this.setData({ 'form.sex': ['unknown', 'male', 'female'][Number(e.detail.value)] });
  },
  changeNeutered(e) {
    this.setData({ 'form.neutered': [null, false, true][Number(e.detail.value)] });
  },
  changeBirthday(e) {
    try {
      this.setData({
        form: {
          ...this.data.form,
          birthday: e.detail.value,
          birthdayCleared: false,
          ageEdited: false,
          ageYears: String(Math.round((birthdayAge(e.detail.value).age_months / 12) * 100) / 100),
          ...birthdayAge(e.detail.value),
        },
      });
    } catch (e) {
      wx.showToast({ title: errorText(e), icon: 'none' });
    }
  },
  clearBirthday() {
    this.setData({
      'form.birthday': '',
      'form.age': '',
      'form.age_text': '',
      'form.age_months': null,
      'form.birthdayCleared': true,
      'form.ageYears': '',
      'form.ageEdited': false,
    });
  },
  chooseAllergy(e) {
    this.setData({ 'form.allergyChoice': e.currentTarget.dataset.value });
  },
  chooseStep(e) {
    this.setData({ step: Number(e.currentTarget.dataset.index) });
  },
  previousStep() {
    this.setData({ step: Math.max(0, this.data.step - 1) });
  },
  nextStep() {
    this.setData({ step: Math.min(8, this.data.step + 1) });
  },
  recognize() {
    if (!requireSession()) return;
    if (this.data.recognizing || this.data.saving || this.data.deleting || this.data.loading || this._choosing) return;
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
        this.setData({ recognizing: true, recognitionNote: '', breedCandidates: [], appearanceRecognitionText: '' });
        try {
          const result = await recognizePetImage(file.tempFilePath);
          if (this._disposed) return;
          const form = { ...this.data.form, avatar_image_id: result.image.id };
          const suggestions = result.suggestions || {};
          let breedCandidates = [];
          let appearanceRecognitionText = '';
          if (result.recognition_status === 'success') {
            const kind = suggestions.animal_type && suggestions.animal_type.value;
            if (['cat', 'dog', 'unknown'].includes(kind)) {
              form.animal_type = kind;
              form.type = { cat: '猫咪', dog: '狗狗', unknown: '未知' }[kind];
            }
            if (suggestions.breed && suggestions.breed.value) form.breed = suggestions.breed.value;
            breedCandidates = ((suggestions.breed && suggestions.breed.candidates) || []).filter(
              (item) => item && typeof item.value === 'string' && item.value,
            );
            const appearance = suggestions.appearance || {};
            appearanceRecognitionText = [
              ...new Set(
                ['color', 'pattern', 'length']
                  .map((key) => (appearance[key] && appearance[key].value) || '')
                  .filter(Boolean),
              ),
            ].join(' · ');
            const weight = suggestions.weight && suggestions.weight.estimated_kg;
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
            breedOptions: this.data.breedCatalog[form.animal_type] || [],
            breedCandidates,
            appearanceRecognitionText,
            recognitionNote:
              result.recognition_status === 'success'
                ? '已填入识别建议，品种请核对或从候选中选择。花色、毛长单独展示，不代表品种或血统；体重仅为照片估算，请按实际填写。'
                : '照片已上传，可作为头像。暂未识别出档案信息，请手动填写，或点击上方更换照片重试。',
          });
        } catch (e) {
          if (!this._disposed) this.setData({ recognitionNote: `${errorText(e)}，可点击上方重试，或继续手动填写。` });
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
  async deletePet() {
    if (!requireSession()) return;
    if (!this.data.form.id || this.data.saving || this.data.deleting || this.data.loading || this.data.recognizing)
      return;
    const { id } = this.data.form;
    const account = accountKey('pet-edit');
    this.setData({ deleting: true });
    try {
      const choice = await new Promise((resolve) => {
        wx.showModal({
          title: '删除宠物档案',
          content: `确定删除“${this.data.form.name}”的档案吗？删除后将无法在宠物列表中选择它。`,
          confirmText: '删除',
          cancelText: '保留',
          success: resolve,
          fail: () => resolve({ confirm: false }),
        });
      });
      if (!choice.confirm || this._disposed || account !== accountKey('pet-edit')) return;
      await api(`/cat-profiles/${encodeURIComponent(id)}`, 'DELETE');
      if (account !== accountKey('pet-edit')) return;
      const store = loadStore();
      cachePetList((store.pets || (store.pet ? [store.pet] : [])).filter((pet) => pet.id !== id));
      wx.showToast({ title: '档案已删除' });
      if (!this._disposed) wx.navigateBack();
    } catch (e) {
      if (!this._disposed) wx.showToast({ title: errorText(e), icon: 'none' });
    } finally {
      if (!this._disposed) this.setData({ deleting: false });
    }
  },
  async save() {
    if (!requireSession()) return;
    if (this.data.saving || this.data.deleting || this.data.recognizing || this.data.loading) return;
    const f = this.data.form;
    let payload;
    try {
      payload = profilePayload(f);
    } catch (e) {
      wx.showToast({ title: errorText(e), icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      await login();
      const { id } = f;
      if (!id && !this._creating) {
        const r = await api('/cat-profiles');
        const p = r.items.find((v) => v.is_default) || r.items[0];
        if (p) {
          saveStore({ pet: mapPet(p) });
          this.setData({ form: profileForm(mapPet(p)), photo: '', recognitionNote: '' });
          wx.showModal({
            title: '已找到你的宠物档案',
            content: '已载入现有档案，请核对后再保存，避免覆盖已有信息。',
            showCancel: false,
          });
          return;
        }
      }
      payload.is_default = id ? !!f.is_default : !loadStore().pet;
      const result = await api(id ? `/cat-profiles/${id}` : '/cat-profiles', id ? 'PATCH' : 'POST', payload);
      const saved = mapPet(result.item);
      const store = loadStore();
      cachePetList([...(store.pets || (store.pet ? [store.pet] : [])).filter((p) => p.id !== saved.id), saved]);
      saveStore({ pet: saved, selectedPetId: saved.id });
      try {
        await syncCloudBirthday(saved.id);
      } catch (e) {
        wx.showModal({ title: '档案已保存', content: '生日提醒未能保存，请在我的提醒中手动添加。', showCancel: false });
      }
      wx.showToast({ title: '档案已保存' });
      wx.navigateBack();
    } catch (e) {
      wx.showToast({ title: errorText(e), icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },
});
