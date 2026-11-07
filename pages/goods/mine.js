import { hasSession, requireSession, errorText } from '../../api/miniprogram';
import { accountKey } from '../../utils/pet-store';
import { getMyGoods } from '../../utils/merchant';
import { mapGoods } from '../../utils/goods';

Page({
  data: {
    items: [], page: 0, total: 0, hasMore: false,
    loading: false, error: '', needsLogin: false,
  },
  onShow() {
    const account = accountKey('my-goods');
    const token = wx.getStorageSync('miniprogram_token') || '';
    if (account !== this._account || token !== this._token) {
      this._account = account;
      this._token = token;
      this._version = (this._version || 0) + 1;
      this.setData({ items: [], page: 0, total: 0, hasMore: false, loading: false, error: '', needsLogin: !hasSession() });
      if (hasSession()) this.loadPage(true);
    }
  },
  onUnload() {
    this._version = (this._version || 0) + 1;
  },
  login() { requireSession(); },
  async loadPage(reset = false) {
    if (this.data.loading && !reset) return;
    if (!hasSession()) {
      this._version = (this._version || 0) + 1;
      this.setData({ items: [], page: 0, total: 0, hasMore: false, loading: false, error: '', needsLogin: true });
      return;
    }
    if (!reset && this.data.page > 0 && !this.data.hasMore) return;
    const version = this._version = (this._version || 0) + 1;
    const account = accountKey('my-goods');
    const token = wx.getStorageSync('miniprogram_token');
    const isCurrent = () => version === this._version && account === accountKey('my-goods')
      && token === wx.getStorageSync('miniprogram_token');
    const nextPage = reset ? 1 : this.data.page + 1;
    this._retryReset = reset;
    this.setData({ loading: true, error: '', needsLogin: false });
    try {
      const result = await getMyGoods(nextPage, 20);
      if (!isCurrent()) return;
      if (result.page !== nextPage) throw new Error('分页信息异常，请重试');
      const items = new Map((reset ? [] : this.data.items).map((item) => [item.id, item]));
      result.items.forEach((item) => {
        if (item.product_id) items.set(item.product_id, mapGoods(item));
      });
      this.setData({
        items: Array.from(items.values()),
        page: result.page,
        total: result.total,
        hasMore: result.items.length > 0 && result.page * result.page_size < result.total,
      });
    } catch (error) {
      // The shared API removes expired tokens before rejecting a 401.
      if (version !== this._version || account !== accountKey('my-goods')) return;
      if (error.statusCode === 401 && (!hasSession() || token === wx.getStorageSync('miniprogram_token'))) {
        this.setData({ items: [], page: 0, total: 0, hasMore: false, needsLogin: true, error: '' });
      } else if (isCurrent()) {
        this.setData({ error: errorText(error) });
      }
    } finally {
      if (version === this._version) this.setData({ loading: false });
    }
  },
  onReachBottom() {
    if (this.data.hasMore && !this.data.error) this.loadPage();
  },
  async onPullDownRefresh() {
    try { await this.loadPage(true); }
    finally { wx.stopPullDownRefresh(); }
  },
  retry() {
    return this.loadPage(this._retryReset || this.data.page === 0);
  },
  bindPost(e) {
    const item = this.data.items.find((goods) => goods.id === e.currentTarget.dataset.id);
    if (item) wx.navigateTo({ url: `/pages/goods/bind?id=${encodeURIComponent(item.id)}&name=${encodeURIComponent(item.name)}` });
  },
  openGoods(e) {
    wx.navigateTo({ url: `/pages/goods/detail?id=${encodeURIComponent(e.currentTarget.dataset.id)}` });
  },
});
