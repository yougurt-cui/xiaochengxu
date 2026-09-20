import { loadStore, saveStore, persistImage } from '../../../utils/pet-store';
import { login, uploadImage, errorText } from '../../../api/miniprogram';
Page({
  data: { name: '', image: '', saving: false },
  onLoad() {
    const p = wx.getStorageSync('miniprogram_user') || loadStore().parent || {};
    this.setData({ name: p.name || p.nickName || '', image: p.image || p.avatarUrl || '' });
  },
  onNameChange(e) {
    this.setData({ name: e.detail.value });
  },
  async chooseAvatar(e) {
    try {
      const image = await persistImage(e.detail.avatarUrl);
      this.setData({ image });
    } catch (error) {
      wx.showToast({ title: '头像保存失败，请重试', icon: 'none' });
    }
  },
  async onSaveInfo() {
    if (this.data.saving) return;
    if (!this.data.name.trim()) {
      wx.showToast({ title: '请填写昵称', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      let avatarUrl = this.data.image;
      if (avatarUrl && !/^https?:\/\//.test(avatarUrl)) avatarUrl = await uploadImage(avatarUrl);
      const user = await login({ nickName: this.data.name.trim(), avatarUrl });
      saveStore({ parent: user });
      wx.showToast({ title: '资料已保存' });
      wx.navigateBack();
    } catch (error) {
      wx.showToast({ title: errorText(error), icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },
});
