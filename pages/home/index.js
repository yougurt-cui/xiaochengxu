import { categories, getPosts, fetchPosts } from '../../utils/community';
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
  onShow() {
    if (this.getTabBar()) this.getTabBar().setData({ value: 'home', hidden: false });
    this.refreshData();
    this.loadFeed();
  },
  async loadFeed() {
    this.setData({ loading: true, feedError: '' });
    try {
      await fetchPosts();
      this.filterPosts();
    } catch (e) {
      this.setData({ feedError: errorText(e) });
    } finally {
      this.setData({ loading: false });
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
    this.setData({
      posts: getPosts().filter(
        (p) =>
          (loadStore().feedIds || []).includes(p.id) &&
          (category === 'all' || p.category === category) &&
          (!query.trim() || `${p.title}${p.body}`.includes(query.trim())),
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
    wx.navigateTo({ url: '/pages/release/index' });
  },
  goHistory() {
    wx.navigateTo({ url: '/pages/history/index' });
  },
  openDevices() {
    this.setData({ showDevices: true });
    this.hideNavigation(true);
  },
  openRecord() {
    const record = loadStore().records.find((r) => r.day === dayKey());
    this.setData({
      showRecord: true,
      form: record
        ? { water: record.water, food: record.food, litter: record.litter }
        : { water: '', food: '', litter: '' },
    });
    this.hideNavigation(true);
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
    this.hideNavigation(false);
  },
  hideNavigation(hidden) {
    if (this.getTabBar()) this.getTabBar().setData({ hidden });
  },
  onHide() {
    this.closeSheet();
  },
});
