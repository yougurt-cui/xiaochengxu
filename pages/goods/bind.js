import { api, hasSession, requireSession, errorText } from '../../api/miniprogram';
import { accountKey } from '../../utils/pet-store';
import { bindGoodsToPost } from '../../utils/merchant';

Page({
  data: {
    productId: '', productName: '', posts: [], postCount: 0, selectedId: '', boundPostId: '',
    loading: false, saving: false, error: '', needsLogin: false, limited: false,
  },
  onLoad(options) {
    let productName = options.name || '';
    try { productName = decodeURIComponent(productName); } catch (_) { /* Accept literal percent characters. */ }
    this.setData({ productId: options.id || '', productName });
  },
  onShow() {
    const account = accountKey('goods-bind');
    const token = wx.getStorageSync('miniprogram_token') || '';
    if (this._account !== account || this._token !== token) {
      this._account = account;
      this._token = token;
      this._version = (this._version || 0) + 1;
      this.setData({ posts: [], postCount: 0, selectedId: '', boundPostId: '', saving: false, error: '' });
      this.loadPosts();
    }
  },
  onUnload() { this._version = (this._version || 0) + 1; },
  login() { requireSession(); },
  async loadPosts() {
    if (this.data.saving) return;
    const version = this._version = (this._version || 0) + 1;
    if (!hasSession()) {
      this.setData({ needsLogin: true, loading: false, posts: [], postCount: 0, selectedId: '' });
      return;
    }
    if (!this.data.productId) {
      this.setData({ loading: false, error: '商品链接不完整，请返回我的商品重新选择' });
      return;
    }
    const account = accountKey('goods-bind');
    this.setData({ loading: true, error: '', needsLogin: false, selectedId: '' });
    try {
      const result = await api('/moments?include_private=true&limit=100');
      if (version !== this._version || account !== accountKey('goods-bind')) return;
      const posts = (result.items || []).filter((post) => post.status === 'active').map((post) => ({
        id: post.id,
        title: post.title || (post.content || '').slice(0, 60) || '未命名帖子',
        bound: (post.products || []).some((product) => product.product_id === this.data.productId),
      }));
      this.setData({ posts, postCount: posts.length, limited: (result.items || []).length >= 100 });
    } catch (error) {
      if (version !== this._version || account !== accountKey('goods-bind')) return;
      if (error.statusCode === 401) this.setData({ needsLogin: true, posts: [], postCount: 0, selectedId: '' });
      else this.setData({ error: errorText(error) });
    } finally {
      if (version === this._version) this.setData({ loading: false });
    }
  },
  selectPost(e) {
    if (this.data.saving) return;
    const post = this.data.posts.find((item) => item.id === e.currentTarget.dataset.id);
    if (post && !post.bound) this.setData({ selectedId: post.id, boundPostId: '' });
  },
  async bind() {
    if (this.data.saving || this.data.loading || !this.data.selectedId || !requireSession()) return;
    const post = this.data.posts.find((item) => item.id === this.data.selectedId && !item.bound);
    if (!post) return;
    const version = this._version;
    const account = accountKey('goods-bind');
    this.setData({ saving: true, error: '' });
    try {
      await bindGoodsToPost(this.data.productId, post.id);
      if (version !== this._version || account !== accountKey('goods-bind')) return;
      this.setData({
        posts: this.data.posts.map((item) => item.id === post.id ? { ...item, bound: true } : item),
        selectedId: '', boundPostId: post.id,
      });
      wx.showToast({ title: '已绑定商品', icon: 'success' });
    } catch (error) {
      if (version !== this._version || account !== accountKey('goods-bind')) return;
      if (error.statusCode === 401) this.setData({ needsLogin: true, posts: [], postCount: 0, selectedId: '' });
      else wx.showModal({ title: '绑定失败', content: errorText(error), showCancel: false });
    } finally {
      if (version === this._version) this.setData({ saving: false });
    }
  },
  viewPost() {
    if (this.data.boundPostId) wx.navigateTo({ url: `/pages/pet-space/post-detail?id=${encodeURIComponent(this.data.boundPostId)}` });
  },
});
