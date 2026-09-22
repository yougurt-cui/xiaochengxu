import { api, hasSession, mapPet, errorText } from '../../api/miniprogram';
import { loadStore, saveStore } from '../../utils/pet-store';

Page({
  data: {
    pet: null,
    parent: {},
    favoriteCount: 0,
    postCount: 0,
    toysCount: 0,
    foodCount: 0,
  },
  onShow() {
    if (this.getTabBar()) this.getTabBar().setData({ value: 'my', modalHidden: false });
    this.refreshData();
    if (hasSession()) this.syncProfile();
  },
  async syncProfile(strict = false) {
    try {
      const res = await api('/cat-profiles');
      const p = res.items.find((v) => v.is_default) || res.items[0];
      saveStore({ pet: p ? mapPet(p) : null, parent: wx.getStorageSync('miniprogram_user') });
      this.refreshData();
    } catch (e) {
      if (strict) throw e;
      wx.showToast({ title: errorText(e), icon: 'none' });
    }
  },
  refreshData() {
    const s = loadStore();
    const parent = s.parent || wx.getStorageSync('miniprogram_user') || {};
    this.setData({
      pet: s.pet,
      parent: {
        ...parent,
        name: parent.name || parent.nickName || '添加家长资料',
        image: parent.image || parent.avatarUrl || '',
      },
      favoriteCount: s.favorites.length,
      postCount: s.posts.length,
      toysCount: s.supplies.toys.length,
      foodCount: s.supplies.food.length,
    });
  },
  editPet() {
    wx.navigateTo({ url: '/pages/pet-space/pet-edit' });
  },
  editParent() {
    wx.navigateTo({ url: '/pages/my/info-edit/index' });
  },
  openSupplies(e) {
    wx.navigateTo({ url: `/pages/pet-space/supplies?kind=${e.currentTarget.dataset.kind}` });
  },
  openFavorites() {
    wx.navigateTo({ url: '/pages/pet-space/library?mode=favorites' });
  },
  openPosts() {
    wx.navigateTo({ url: '/pages/pet-space/library?mode=posts' });
  },
  goSettings() {
    wx.navigateTo({ url: '/pages/setting/index' });
  },
});
