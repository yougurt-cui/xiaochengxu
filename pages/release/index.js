import { categories, mapPost } from '../../utils/community';
import { loadStore, saveStore, persistImage } from '../../utils/pet-store';
import { api, login, uploadImage, errorText } from '../../api/miniprogram';
Page({
  data: {
    categories: categories.slice(1),
    category: 'CHIN',
    title: '',
    body: '',
    images: [],
    saving: false,
    draftId: '',
  },
  onLoad(query) {
    const draft = loadStore().posts.find((p) => p.id === query.id && p.status === 'draft');
    if (draft)
      this.setData({
        draftId: draft.id,
        category: draft.category,
        title: draft.title,
        body: draft.body,
        images: draft.images || [],
      });
  },
  input(e) {
    this.setData({ [e.currentTarget.dataset.key]: e.detail.value });
  },
  selectCategory(e) {
    this.setData({ category: e.currentTarget.dataset.id });
  },
  chooseImages() {
    if (this.data.saving || this.data.images.length >= 9) return;
    wx.chooseMedia({
      count: 9 - this.data.images.length,
      mediaType: ['image'],
      success: async (res) => {
        try {
          const files = await Promise.all(res.tempFiles.map((f) => persistImage(f.tempFilePath)));
          this.setData({ images: [...this.data.images, ...files].slice(0, 9) });
        } catch (e) {
          wx.showToast({ title: '图片保存失败', icon: 'none' });
        }
      },
    });
  },
  previewImage(e) {
    const current = this.data.images[Number(e.currentTarget.dataset.index)];
    if (current) wx.previewImage({ current, urls: this.data.images });
  },
  removeImage(e) {
    if (!this.data.saving)
      this.setData({ images: this.data.images.filter((_, i) => i !== e.currentTarget.dataset.index) });
  },
  saveDraft() {
    if (this.data.saving) return;
    const d = this.data;
    if (!d.body.trim() && !d.title.trim() && !d.images.length) {
      wx.showToast({ title: '先记录一点内容吧', icon: 'none' });
      return;
    }
    try {
      const id = d.draftId || `draft-${Date.now()}`;
      saveStore({
        posts: [
          {
            id,
            status: 'draft',
            title: d.title,
            body: d.body,
            images: d.images,
            category: d.category,
            editedAt: new Date().toISOString(),
          },
          ...loadStore().posts.filter((p) => p.id !== id),
        ],
      });
      this.setData({ draftId: id });
      wx.showToast({ title: '草稿已保存' });
    } catch (e) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },
  async release() {
    if (this.data.saving) return;
    if (!this.data.body.trim() || !this.data.images.length) {
      wx.showToast({ title: '请填写内容并添加图片', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      const user = await login();
      const images = [];
      // Keep successful uploads for a retry; never submit temporary WeChat URLs.
      for (let i = 0; i < this.data.images.length; i += 1) {
        const file = this.data.images[i];
        const url = /^https?:\/\//.test(file) && !/^https?:\/\/tmp\//.test(file) ? file : await uploadImage(file);
        images.push(url);
        this.setData({ [`images[${i}]`]: url });
      }
      const pet = loadStore().pet;
      const result = await api('/moments', 'POST', {
        title: this.data.title.trim(),
        content: this.data.body.trim(),
        category_code: this.data.category,
        images,
        visibility: 'public',
        cat_profile_id: (pet && pet.id) || '',
        author_name: user.name,
        author_avatar: user.avatarUrl,
      });
      const post = mapPost(result.item);
      const s = loadStore();
      saveStore({ posts: [post, ...s.posts.filter((p) => p.id !== this.data.draftId && p.id !== post.id)] });
      wx.showToast({ title: post.status === 'published' ? '发布成功' : '已提交审核' });
      wx.navigateBack();
    } catch (e) {
      wx.showModal({ title: '暂未发布', content: errorText(e), showCancel: false });
    } finally {
      this.setData({ saving: false });
    }
  },
});
