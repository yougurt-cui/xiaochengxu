import { categories, getFeedPosts, fetchPosts } from '../../utils/community';
import { errorText } from '../../api/miniprogram';
import { loadStore, saveStore, dayKey } from '../../utils/pet-store';

Page({
  data: {
    categories,
    category: 'all',
    query: '',
    posts: [],
    loading: false,
    feedError: '',
    metrics: [],
    updated: '尚未记录',
    showRecord: false,
    showDevices: false,
    form: { water: '', food: '', litter: '' },
  },
  onLoad() {
    this.loadFeed();
  },
  onShow() {
    if (this.getTabBar()) this.getTabBar().setData({ value: 'home' });
    this.refreshData();
    // 从发帖返回时刷新；热更新/空列表时补拉，避免样式区空白
    if (this._reloadFeedOnShow || (!this.data.posts.length && !this.data.loading)) {
      this._reloadFeedOnShow = false;
      this.loadFeed();
    }
  },
  async loadFeed() {
    const silent = this.data.posts.length > 0;
    if (!silent) this.setData({ loading: true, feedError: '' });
    try {
      await fetchPosts();
      this.filterPosts();
      this.setData({ feedError: '' });
    } catch (e) {
      if (!silent) this.setData({ feedError: errorText(e) });
      else wx.showToast({ title: errorText(e), icon: 'none' });
    } finally {
      if (!silent) this.setData({ loading: false });
    }
  },
  refreshData() {
    const record = loadStore().records.find((r) => r.day === dayKey());
    this.setData({
      updated: record ? `${record.time} 更新` : '尚未记录',
      metrics: [
        ['water', '饮水', 'ml'],
        ['food', '进食', 'g'],
        ['litter', '排便', '次'],
      ].map(([key, label, unit]) => ({ key, label, unit, value: record ? record[key] : '—' })),
    });
    this.filterPosts();
  },
  filterPosts() {
    const { category, query } = this.data;
    const q = query.trim();
    this.setData({
      posts: getFeedPosts().filter(
        (p) => (category === 'all' || p.category === category) && (!q || `${p.title}${p.body}`.includes(q)),
      ),
    });
  },
  selectCategory(e) {
    this.setData({ category: e.currentTarget.dataset.id });
    this.filterPosts();
  },
  onSearch(e) {
    this.setData({ query: e.detail.value });
    this.filterPosts();
  },
  openPost(e) {
    wx.navigateTo({ url: `/pages/pet-space/post-detail?id=${encodeURIComponent(e.detail.id)}` });
  },
  toggleSave(e) {
    const id = e.detail.id || e.currentTarget.dataset.id;
    const favorites = loadStore().favorites;
    saveStore({ favorites: favorites.includes(id) ? favorites.filter((v) => v !== id) : [...favorites, id] });
    this.filterPosts();
  },
  goRelease() {
    this._reloadFeedOnShow = true;
    wx.navigateTo({ url: '/pages/release/index' });
  },
  goHistory() {
    wx.navigateTo({ url: '/pages/history/index' });
  },
  openDevices() {
    this.setData({ showDevices: true });
  },
  openRecord() {
    const record = loadStore().records.find((r) => r.day === dayKey());
    this.setData({
      showRecord: true,
      form: record
        ? { water: record.water, food: record.food, litter: record.litter }
        : { water: '', food: '', litter: '' },
    });
  },
  onRecordInput(e) {
    this.setData({ [`form.${e.currentTarget.dataset.key}`]: e.detail.value });
  },
  saveRecord() {
    const values = ['water', 'food', 'litter'].map((key) => Number(this.data.form[key]));
    if (
      Object.values(this.data.form).some((v) => String(v).trim() === '') ||
      values.some((v) => !Number.isFinite(v) || v < 0 || v > 9999) ||
      !Number.isInteger(values[2]) ||
      values[2] > 99
    ) {
      wx.showToast({ title: '请填写有效的今日累计值', icon: 'none' });
      return;
    }
    const now = new Date();
    const record = {
      day: dayKey(now),
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      water: values[0],
      food: values[1],
      litter: values[2],
    };
    try {
      saveStore({ records: [record, ...loadStore().records.filter((r) => r.day !== record.day)] });
      this.closeSheet();
      this.refreshData();
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },
  closeSheet() {
    this.setData({ showRecord: false, showDevices: false });
  },
  onHide() {
    this.closeSheet();
  },
});
