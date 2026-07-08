Page({
  data: {
    statusBarHeight: 20,
    refreshedAt: '08:30',
    water: { value: 120, target: 250, percent: 48, status: '喝水偏少' },
    litter: { value: 2, status: '正常' },
    feeding: { value: 3, status: '规律' },
  },

  onLoad() {
    const { statusBarHeight = 20 } = wx.getWindowInfo();
    this.setData({ statusBarHeight });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ value: 'home' });
    }
  },

  refresh() {
    const now = new Date();
    const refreshedAt = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    this.setData({ refreshedAt });
    wx.showToast({ title: '今日数据已更新', icon: 'success' });
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/history/index' });
  },

  comingSoon() {
    wx.showToast({ title: '下一阶段开放', icon: 'none' });
  },
});
