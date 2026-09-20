import { api, mediaUrl, errorText } from '../../api/miniprogram';
import { loadStore, saveStore, persistImage } from '../../utils/pet-store';
const covers = [
  {
    id: 'play',
    title: '把快乐，留给每一天',
    subtitle: '发现创意玩具，记录它的心头好',
    image: '/pages/pet-space/static/cat-3.webp',
  },
  {
    id: 'company',
    title: '一起玩，就是好时光',
    subtitle: '从一件小玩具开始，认识它的偏好',
    image: '/pages/pet-space/static/cat-1.webp',
  },
];
Page({
  data: {
    kind: 'toys',
    title: '我的玩具',
    slides: [],
    slide: 0,
    items: [],
    mine: [],
    loading: false,
    error: '',
    brand: '皇家',
    query: '',
    selected: null,
    editing: false,
    form: { name: '', note: '', images: [] },
    editingId: '',
    editorMode: 'form',
  },
  onLoad(q) {
    const kind = q.kind === 'food' ? 'food' : 'toys';
    this.setData({
      kind,
      title: kind === 'food' ? '我的食物' : '我的玩具',
      slides:
        kind === 'food'
          ? [
              {
                id: 'meal',
                title: '每一餐，都值得认真对待',
                subtitle: '查看食品目录，记录正在吃的粮',
                image: '/pages/pet-space/static/cat-4.webp',
              },
              {
                id: 'taste',
                title: '记住它喜欢的味道',
                subtitle: '品牌、口味与食用感受，一起收好',
                image: '/pages/pet-space/static/cat-2.webp',
              },
            ]
          : covers,
    });
    this.loadCatalog();
  },
  onShow() {
    this.refreshMine();
  },
  refreshMine() {
    this.setData({ mine: loadStore().supplies[this.data.kind] });
  },
  changeSlide(e) {
    this.setData({ slide: e.detail.current });
  },
  inputSearch(e) {
    this.setData({ [e.currentTarget.dataset.key]: e.detail.value });
  },
  async loadCatalog() {
    const requestId = (this._requestId || 0) + 1;
    this._requestId = requestId;
    if (this.data.kind === 'food' && !this.data.brand.trim()) {
      wx.showToast({ title: '先填写要查询的品牌', icon: 'none' });
      return;
    }
    this.setData({ loading: true, error: '', items: [] });
    try {
      const food = this.data.kind === 'food';
      const r = await api(
        food
          ? `/products?brand=${encodeURIComponent(this.data.brand.trim())}&q=${encodeURIComponent(
              this.data.query.trim(),
            )}&limit=50`
          : '/ideas?limit=100',
      );
      if (requestId !== this._requestId) return;
      const items = food
        ? r.items.map((p) => ({
            id: p.catalog_key,
            name: p.product_name,
            tag: p.brand,
            note: '食品目录 · 查看并加入我的食物',
            image: mediaUrl(p.image_url || p.cover_url),
            source: 'catalog',
          }))
        : r.items
            .filter((p) => ['PET_TOY', 'OWNER_TOY', 'SMART_DEVICE', 'DAILY_USE'].includes(p.category))
            .map((p) => ({
              id: p.id,
              name: p.title,
              tag: p.category_name,
              note: p.description,
              image: mediaUrl(p.cover_url),
              source: 'idea',
            }));
      this.setData({ items });
      if (!food) {
        const featured = items
          .filter((p) => p.image)
          .slice(0, 5)
          .map((p) => ({ id: p.id, title: p.name, subtitle: p.tag + ' · ' + p.note, image: p.image }));
        if (featured.length) this.setData({ slides: [...featured, ...covers].slice(0, 5) });
      }
    } catch (e) {
      if (requestId === this._requestId) this.setData({ error: errorText(e) });
    } finally {
      if (requestId === this._requestId) this.setData({ loading: false });
    }
  },
  openItem(e) {
    this.setData({ selected: this.data.items.find((p) => p.id === e.currentTarget.dataset.id) });
  },
  closeDetail() {
    this.setData({ selected: null });
  },
  addToMine() {
    const p = this.data.selected;
    if (!p) return;
    const supplies = loadStore().supplies;
    if (supplies[this.data.kind].some((i) => i.sourceId === p.id)) {
      wx.showToast({ title: '已经在你的清单里了', icon: 'none' });
      return;
    }
    try {
      supplies[this.data.kind].push({ ...p, id: `item-${Date.now()}`, sourceId: p.id });
      saveStore({ supplies });
      this.refreshMine();
      this.closeDetail();
      wx.showToast({ title: '已加入清单' });
    } catch (e) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },
  editMine(e) {
    const item = this.data.mine.find((i) => i.id === e.currentTarget.dataset.id);
    this.setData({
      editing: true,
      editingId: item ? item.id : '',
      form: item
        ? { name: item.name || '', note: item.note || '', images: item.images || [] }
        : { name: '', note: '', images: [] },
      editorMode: 'form',
    });
  },
  closeEditor() {
    this.setData({ editing: false, editorMode: 'form' });
  },
  input(e) {
    this.setData({ [`form.${e.currentTarget.dataset.key}`]: e.detail.value });
  },
  openIngredientSheet() {
    if (this.data.kind !== 'food') return;
    this.setData({ editorMode: 'ingredient' });
  },
  closeIngredientSheet() {
    this.setData({ editorMode: 'form' });
  },
  previewIngredientExample() {
    wx.previewImage({
      current: '/pages/pet-space/static/ingredient-example.jpg',
      urls: ['/pages/pet-space/static/ingredient-example.jpg'],
    });
  },
  onIngredientFound() {
    wx.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success: (res) => {
        const sourceType = res.tapIndex === 0 ? ['camera'] : ['album'];
        this.pickIngredientImages(sourceType);
      },
    });
  },
  pickIngredientImages(sourceType) {
    const remain = 3 - (this.data.form.images || []).length;
    if (remain <= 0) {
      wx.showToast({ title: '最多上传 3 张图片', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType,
      sizeType: ['compressed'],
      success: (res) => {
        const files = (res.tempFiles || []).filter((file) => {
          if (file.size > 10 * 1024 * 1024) {
            wx.showToast({ title: '单张图片不能超过 10MB', icon: 'none' });
            return false;
          }
          return true;
        });
        if (!files.length) return;
        const next = [...(this.data.form.images || []), ...files.map((file) => file.tempFilePath)].slice(0, 3);
        this.setData({
          editorMode: 'form',
          'form.images': next,
          'form.note': this.data.form.note || '已上传配料表，待补充食用感受',
        });
      },
    });
  },
  previewFormImage(e) {
    const current = e.currentTarget.dataset.current;
    const urls = this.data.form.images || [];
    if (!current || !urls.length) return;
    wx.previewImage({ current, urls });
  },
  removeFormImage(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({
      'form.images': (this.data.form.images || []).filter((_, i) => i !== index),
    });
  },
  async saveMine() {
    if (!this.data.form.name.trim()) {
      wx.showToast({ title: '请填写名称', icon: 'none' });
      return;
    }
    try {
      const images = [];
      for (const path of this.data.form.images || []) {
        if (!path) continue;
        const needPersist = /tmp/i.test(path) || (!/^wxfile:\/\//.test(path) && !/^https?:\/\//.test(path));
        images.push(needPersist ? await persistImage(path) : path);
      }
      const supplies = loadStore().supplies;
      const item = {
        ...this.data.form,
        name: this.data.form.name.trim(),
        note: (this.data.form.note || '').trim(),
        images,
        id: this.data.editingId || `item-${Date.now()}`,
      };
      supplies[this.data.kind] = this.data.editingId
        ? supplies[this.data.kind].map((p) => (p.id === item.id ? { ...p, ...item } : p))
        : [item, ...supplies[this.data.kind]];
      saveStore({ supplies });
      this.refreshMine();
      this.closeEditor();
    } catch (e) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },
  onUnload() {
    this._requestId = (this._requestId || 0) + 1;
  },
});
