Component({
  properties: {
    title: String,
    back: Boolean,
    customBack: Boolean,
  },
  data: { top: 20, height: 44, right: 100 },
  lifetimes: {
    attached() {
      const info = wx.getWindowInfo();
      const capsule = wx.getMenuButtonBoundingClientRect();
      const top = info.statusBarHeight || 20;
      this.setData({
        top,
        height: (capsule.top - top) * 2 + capsule.height || 44,
        right: info.windowWidth - capsule.left + 12,
      });
    },
  },
  methods: {
    goBack() {
      if (this.properties.customBack) {
        this.triggerEvent('back');
        return;
      }
      if (getCurrentPages().length > 1) wx.navigateBack();
      else wx.switchTab({ url: '/pages/home/index' });
    },
  },
});
