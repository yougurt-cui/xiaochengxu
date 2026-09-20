// Compatibility route for previously shared moment-wall links.
Page({
  onLoad() {
    wx.switchTab({ url: '/pages/home/index' });
  },
});
