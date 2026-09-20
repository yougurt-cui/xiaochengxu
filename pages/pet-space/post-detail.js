import { displayPostBody } from '../../utils/post-content';
import { api, mediaUrl, errorText } from '../../api/miniprogram';
import { mapPost } from '../../utils/community';
import { loadStore, saveStore, formatEdited } from '../../utils/pet-store';
Page({
  data: { post: null, loading: true, error: '', saved: false },
  onLoad(query) {
    this.postId = query.id || '';
    this.loadPost();
  },
  onShow() {
    this.setData({ saved: loadStore().favorites.includes(this.postId) });
  },
  async loadPost() {
    if (!this.postId) {
      this.setData({ loading: false, error: '未找到帖子，请返回后重新打开。' });
      return;
    }
    this.setData({ loading: true, error: '' });
    try {
      const result = await api(`/moments/${encodeURIComponent(this.postId)}`);
      if (this._disposed) return;
      const post = { ...mapPost(result.item), avatar: mediaUrl(result.item.author && result.item.author.avatar) };
      this.setData({
        post: { ...post, displayBody: displayPostBody(post.title, post.body), editedText: formatEdited(post.editedAt) },
        saved: loadStore().favorites.includes(post.id),
      });
      // Keep the latest snapshot for locally saved favorites without changing feed order.
      try {
        const s = loadStore();
        const list = [...(s.postCache || [])];
        const index = list.findIndex((p) => p.id === post.id);
        if (index >= 0) list[index] = { ...list[index], ...post };
        else list.push(post);
        saveStore({ postCache: list });
      } catch (e) {
        /* Reading a post remains available if local storage is full. */
      }
    } catch (e) {
      if (!this._disposed) this.setData({ post: null, error: errorText(e) });
    } finally {
      if (!this._disposed) this.setData({ loading: false });
    }
  },
  previewImage(e) {
    const urls = this.data.post ? this.data.post.images : [];
    if (urls.length) wx.previewImage({ current: urls[Number(e.currentTarget.dataset.index)] || urls[0], urls });
  },
  toggleSave() {
    if (!this.data.post) return;
    try {
      const s = loadStore();
      const saved = !s.favorites.includes(this.postId);
      saveStore({
        favorites: saved ? [...s.favorites, this.postId] : s.favorites.filter((id) => id !== this.postId),
        postCache: (() => {
          const list = [...(s.postCache || [])];
          const index = list.findIndex((p) => p.id === this.postId);
          if (index >= 0) list[index] = { ...list[index], ...this.data.post };
          else list.push(this.data.post);
          return list;
        })(),
      });
      this.setData({ saved });
      wx.showToast({ title: saved ? '已收藏' : '已取消收藏', icon: 'none' });
    } catch (e) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },
  onUnload() {
    this._disposed = true;
  },
});
