import { REDEEM_URL } from '../../utils/halloween-activity';

Page({
  data: { url: REDEEM_URL, failed: false },
  onWebError() { this.setData({ failed: true }); },
  copyUrl() {
    wx.setClipboardData({
      data: REDEEM_URL,
      showToast: false,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
      fail: () => wx.showToast({ title: '复制失败，请重试', icon: 'none' }),
    });
  },
});
