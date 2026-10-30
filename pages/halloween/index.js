import { requireSession } from '../../api/miniprogram';
import { getActivityStatus, claimActivityCode, HALLOWEEN_ID, REDEEM_URL } from '../../utils/halloween-activity';
import { accountKey } from '../../utils/pet-store';
import { shareCard, timelineCard } from '../../utils/share';

Page({
  data: {
    view: 'home', status: 'loading', record: null, loading: true, claiming: false,
    error: '', claimedTime: '',
    steps: [
      { title: '复制你的兑换码', body: '领取成功后，点击「复制兑换码」。' },
      { title: '在浏览器打开网站', body: '复制下方网址，粘贴至手机浏览器打开。' },
      { title: '登录个人空间并兑换', body: '找到「Redeem event code」，输入兑换码，点击「Redeem」。' },
      { title: '开始你的萌宠创作', body: '兑换成功后查看钱包额度，上传宠物照片，创作万圣节造型。' },
    ],
    rules: [
      { title: '参与方式', body: '在宠析发布符合活动要求的帖子，返回本页面。发帖成功后可申请领取，资格以领取时校验结果为准。' },
      { title: '领取数量', body: '活动限量 50 个名额，领完即止。同一用户限领一次。' },
      { title: '兑换与使用', body: '兑换码需前往 aibubu 网站使用。请在个人空间兑换，同一活动限兑一次。' },
      { title: '查看兑换码', body: '领取后直接在活动页面展示兑换码，再次进入即可查看并复制。' },
    ],
  },
  onLoad(query = {}) {
    const view = ['rules', 'guide'].includes(query.view) ? query.view : 'home';
    this.setData({ view });
    wx.setNavigationBarColor({ frontColor: view === 'home' ? '#ffffff' : '#000000', backgroundColor: view === 'home' ? '#281439' : '#fff5e8' });
  },
  onShow() {
    this._alive = true;
    this.refreshStatus();
  },
  onUnload() {
    this._alive = false;
    this._version = (this._version || 0) + 1;
  },
  async refreshStatus() {
    if (this.data.claiming) return;
    const version = (this._version || 0) + 1;
    this._version = version;
    const account = accountKey(HALLOWEEN_ID);
    this.setData({ loading: true, error: '', record: null, status: 'loading' });
    try {
      const result = await getActivityStatus();
      if (!this._alive || version !== this._version || account !== accountKey(HALLOWEEN_ID)) return;
      this.setData({ ...result, claimedTime: this.formatTime(result.record && result.record.claimedAt) });
    } catch (error) {
      if (this._alive && version === this._version && account === accountKey(HALLOWEEN_ID)) this.setData({ error: error.message, status: error.statusCode === 401 ? 'loginRequired' : 'error' });
    } finally {
      if (this._alive && version === this._version) this.setData({ loading: false });
    }
  },
  formatTime(value) {
    if (!value) return '';
    const date = new Date(value);
    const two = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`;
  },
  async claim() {
    if (this.data.claiming || this.data.loading || this.data.status !== 'eligible') return;
    const account = accountKey(HALLOWEEN_ID);
    this.setData({ claiming: true, error: '' });
    try {
      const record = await claimActivityCode();
      if (this._alive && account === accountKey(HALLOWEEN_ID)) {
        this.setData({ record, status: 'claimed', claimedTime: this.formatTime(record.claimedAt) });
        wx.pageScrollTo({ scrollTop: 0, duration: 200 });
      }
    } catch (error) {
      if (this._alive && account === accountKey(HALLOWEEN_ID)) this.setData({ error: error.message, ...(error.activityStatus ? { status: error.activityStatus } : {}) });
    } finally {
      if (this._alive) this.setData({ claiming: false });
    }
  },
  goPost() {
    if (this._openingPost) return;
    this._openingPost = true;
    wx.navigateTo({
      url: `/pages/release/index?activity=${HALLOWEEN_ID}`,
      fail: () => wx.showToast({ title: '发帖页面打开失败，请重试', icon: 'none' }),
      complete: () => { this._openingPost = false; },
    });
  },
  openView(e) {
    const view = e.currentTarget.dataset.view;
    if (!['home', 'rules', 'guide'].includes(view)) return;
    wx.navigateTo({ url: `/pages/halloween/index?view=${view}`, fail: () => wx.showToast({ title: '页面打开失败，请重试', icon: 'none' }) });
  },
  copyCode() {
    if (this.data.record && this.data.record.code) this.copy(this.data.record.code);
  },
  copyUrl() { this.copy(REDEEM_URL); },
  copy(value) {
    wx.setClipboardData({
      data: value,
      showToast: false,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
      fail: () => wx.showToast({ title: '复制失败，请长按文字复制', icon: 'none' }),
    });
  },
  loginForActivity() { requireSession(); },
  onShareAppMessage() { return shareCard('万圣节，给毛孩子换个魔法造型', '/pages/halloween/index'); },
  onShareTimeline() { return timelineCard(this.onShareAppMessage()); },
});
