Page({
  data: { statusBarHeight: 20 },

  onLoad() {
    const { statusBarHeight = 20 } = wx.getWindowInfo();
    this.setData({ statusBarHeight });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ value: 'surrounding' });
    }
  },
});
