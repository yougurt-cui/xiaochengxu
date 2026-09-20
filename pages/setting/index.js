Page({
  data: { signedIn: false },
  onShow() {
    this.setData({ signedIn: Boolean(wx.getStorageSync('miniprogram_token')) });
  },
  about() {
    wx.showModal({
      title: '关于宠析',
      content: '一起记录宠物日常，交流养宠经验。管家支持换粮识别和营养分析。',
      showCancel: false,
    });
  },
  storage() {
    wx.showModal({
      title: '数据与隐私',
      content:
        '猫咪档案和已发布帖子保存在服务器。收藏、草稿、玩具、食物、状态记录与聊天历史保存在当前设备。清除小程序数据会移除本地记录。',
      showCancel: false,
    });
  },
  logout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后可通过微信重新登录。当前账号的本地记录会保留。',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('miniprogram_token');
          wx.removeStorageSync('miniprogram_user');
          wx.removeStorageSync('access_token');
          wx.removeStorageSync('userInfo');
          wx.switchTab({ url: '/pages/my/index' });
        }
      },
    });
  },
});
