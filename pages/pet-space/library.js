import { login, errorText, hasSession } from '../../api/miniprogram';
import { loadStore, saveStore, formatEdited } from '../../utils/pet-store';
import { getPosts, fetchPosts } from '../../utils/community';
Page({
  data: {
    mode: 'favorites',
    title: '我的收藏',
    filter: 'published',
    posts: [],
    loading: false,
    error: '',
  },
  onLoad(q) {
    const mode = q.mode === 'posts' ? 'posts' : 'favorites';
    this.setData({ mode, title: mode === 'posts' ? '我的帖子' : '我的收藏' });
  },
  onShow() {
    this.refresh();
    if (this.data.mode === 'posts') this.reload();
  },
  async reload() {
    if (!hasSession()) return;
    if (this.data.loading) return;
    this.setData({ loading: true, error: '' });
    try {
      await login();
      await fetchPosts(true);
      this.refresh();
    } catch (e) {
      this.setData({ error: errorText(e) });
    } finally {
      this.setData({ loading: false });
    }
  },
  refresh() {
    const s = loadStore();
    const posts =
      this.data.mode === 'favorites'
        ? getPosts().filter((p) => p.saved)
        : s.posts
            .filter((p) => p.status === this.data.filter)
            .map((p) => ({
              ...p,
              image: p.image || (p.images || [])[0],
              tag: p.tag || '草稿',
              author: p.author || '我',
              editedText: formatEdited(p.editedAt),
              saved: s.favorites.includes(p.id),
            }));
    this.setData({ posts });
  },
  selectFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.id });
    this.refresh();
  },
  openPost(e) {
    const p = this.data.posts.find((v) => v.id === e.detail.id);
    if (!p) return;
    if (p.status === 'draft') {
      wx.navigateTo({ url: `/pages/release/index?id=${encodeURIComponent(p.id)}` });
      return;
    }
    wx.navigateTo({ url: `/pages/pet-space/post-detail?id=${encodeURIComponent(p.id)}` });
  },
  toggleSave(e) {
    const id = e.detail.id || e.currentTarget.dataset.id;
    const s = loadStore();
    saveStore({ favorites: s.favorites.includes(id) ? s.favorites.filter((v) => v !== id) : [...s.favorites, id] });
    this.refresh();
  },
  writePost() {
    wx.navigateTo({ url: '/pages/release/index' });
  },
});
