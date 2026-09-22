import { submissionView } from '../../utils/food-submission';
import { api, mediaUrl, errorText, hasSession, mapPet, login } from '../../api/miniprogram';
import { loadStore, saveStore, persistImage, accountKey } from '../../utils/pet-store';

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

function mapFoodItem(p) {
  return {
    id: p.catalog_key || p.id,
    name: p.product_name || p.name || '',
    brand: p.brand || '',
    tag: p.brand || '',
    displayText: p.display_text || p.displayText || '',
    originType: p.origin_type || p.originType || '',
    image: mediaUrl(p.main_image_url || p.image_url || p.cover_url || p.image || ''),
    images: p.images || [],
    source: p.source || 'catalog',
  };
}

function mapLocalFood(p) {
  return {
    id: p.id,
    name: p.name || p.series || '',
    brand: p.brand || '',
    tag: p.brand || '',
    displayText: p.displayText || '',
    originType: p.originType || '用户补充',
    image: p.image || (p.images && p.images[0]) || '',
    images: p.images || [],
    source: 'local',
  };
}

Page({
  data: {
    hasPet: false,
    kind: 'toys',
    title: '我的玩具',
    slides: [],
    slide: 0,
    items: [],
    mine: [],
    mineLoading: false,
    mineError: '',
    mineLimit: 2,
    loading: false,
    error: '',
    brand: '皇家',
    query: '',
    selected: null,
    editing: false,
    form: { name: '', note: '', images: [] },
    editingId: '',
    editorMode: 'form',
    catalogAdding: false,
    catalogForm: { brand: '', series: '', images: [] },
    catalogEditorMode: 'form',
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
    this._visible = true;
    this.refreshMine();
    this.syncPet();
  },

  async syncPet() {
    this.setData({ hasPet: !!(loadStore().pet && loadStore().pet.id) });
    if (!hasSession()) return;
    const account = accountKey('supplies');
    const version = (this._petRequestId || 0) + 1;
    this._petRequestId = version;
    try {
      const response = await api('/cat-profiles');
      if (version !== this._petRequestId || account !== accountKey('supplies')) return;
      const pets = response.items || [];
      const pet = pets.find((p) => p.is_default) || pets[0];
      saveStore({ pet: pet ? mapPet(pet) : null });
      this.setData({ hasPet: !!pet });
    } catch (_) {
      // Preserve the last known binding when the network is unavailable.
    }
  },

  addPet() {
    wx.navigateTo({ url: '/pages/pet-space/pet-edit' });
  },

  onHide() {
    this._visible = false;
    clearTimeout(this._minePoll);
    this._mineRequest = (this._mineRequest || 0) + 1;
    this._petRequestId = (this._petRequestId || 0) + 1;
  },

  async measureFoodRow() {
    const width = wx.getWindowInfo().windowWidth;
    let available = width - 32;
    if (this.createSelectorQuery) {
      const rect = await new Promise((resolve) =>
        this.createSelectorQuery().select('.food-mine-row').boundingClientRect(resolve).exec(),
      );
      if (rect && rect.width) available = rect.width;
    }
    // Reserve 56px for More; each food card needs at least 96px plus an 8px gap.
    return Math.max(1, Math.min(100, Math.floor((available - 56) / 104)));
  },
  onResize() {
    if (this._visible && this.data.kind === 'food') this.refreshMine();
  },
  moreFood() {
    this.openFoodSubmissions();
  },
  async refreshMine() {
    if (this.data.kind !== 'food') {
      this.setData({ mine: loadStore().supplies.toys });
      return;
    }
    clearTimeout(this._minePoll);
    const version = (this._mineRequest = (this._mineRequest || 0) + 1);
    if (this._mineAccount !== accountKey('supplies')) this.setData({ mine: [] });
    this.setData({ mineLoading: true, mineError: '' });
    let account;
    try {
      await login();
      if (version !== this._mineRequest || !this._visible) return;
      account = accountKey('supplies');
      if (this._mineAccount !== account) this.setData({ mine: [] });
      this._mineAccount = account;
      const limit = await this.measureFoodRow();
      if (version !== this._mineRequest || !this._visible) return;
      this.setData({ mineLimit: limit });
      const response = await api(`/food-submissions?limit=${limit}`);
      if (version !== this._mineRequest || !this._visible || account !== accountKey('supplies')) return;
      const mine = (response.items || [])
        .filter((item) => item.status !== 'cancelled')
        .slice(0, limit)
        .map((item) => {
          const view = submissionView(item);
          return {
            ...view,
            name: view.title,
            note: view.statusText,
            image: item.images && item.images[0] ? mediaUrl(item.images[0].url) : '',
          };
        });
      this.setData({ mine });
      if (mine.some((item) => ['pending', 'processing'].includes(item.recognition_status))) {
        this._minePoll = setTimeout(() => this.refreshMine(), 5000);
      }
    } catch (e) {
      if (version === this._mineRequest && this._visible) this.setData({ mineError: errorText(e) });
    } finally {
      if (version === this._mineRequest && this._visible) this.setData({ mineLoading: false });
    }
  },

  changeSlide(e) {
    this.setData({ slide: e.detail.current });
  },

  inputSearch(e) {
    this.setData({ [e.currentTarget.dataset.key]: e.detail.value });
  },

  localCatalogItems() {
    return (loadStore().catalogFood || []).map(mapLocalFood);
  },

  mergeFoodItems(remote = []) {
    const brand = (this.data.brand || '').trim();
    const query = (this.data.query || '').trim();
    const local = this.localCatalogItems().filter((item) => {
      if (brand && !(item.brand || '').includes(brand)) return false;
      if (
        query &&
        !(item.name || '').includes(query) &&
        !(item.displayText || '').includes(query) &&
        !(item.brand || '').includes(query)
      ) {
        return false;
      }
      return true;
    });
    const seen = new Set(local.map((item) => item.id));
    return [...local, ...remote.filter((item) => !seen.has(item.id))];
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
        ? this.mergeFoodItems((r.items || []).map(mapFoodItem))
        : (r.items || [])
            .filter((p) => ['PET_TOY', 'OWNER_TOY', 'SMART_DEVICE', 'DAILY_USE'].includes(p.category))
            .map((p) => ({
              id: p.id,
              name: p.title,
              brand: '',
              tag: p.category_name,
              displayText: p.description || '',
              originType: '',
              note: p.description,
              image: mediaUrl(p.cover_url),
              source: 'idea',
            }));
      this.setData({ items });
      if (!food) {
        const featured = items
          .filter((p) => p.image)
          .slice(0, 5)
          .map((p) => ({
            id: p.id,
            title: p.name,
            subtitle: `${p.tag} · ${p.displayText || p.note || ''}`,
            image: p.image,
          }));
        if (featured.length) this.setData({ slides: [...featured, ...covers].slice(0, 5) });
      }
    } catch (e) {
      if (requestId === this._requestId) {
        if (this.data.kind === 'food') {
          this.setData({ items: this.mergeFoodItems([]), error: '' });
        } else {
          this.setData({ error: errorText(e) });
        }
      }
    } finally {
      if (requestId === this._requestId) this.setData({ loading: false });
    }
  },

  openItem(e) {
    this.setData({ selected: this.data.items.find((p) => p.id === e.currentTarget.dataset.id) || null });
  },

  closeDetail() {
    this.setData({ selected: null });
  },

  addToMine() {
    const p = this.data.selected;
    if (!p) return;
    if (this.data.kind === 'food') {
      this.openFoodSubmissions(true, { brand: p.brand || '', product: p.name || '' });
      this.closeDetail();
      return;
    }
    const supplies = loadStore().supplies;
    if (supplies[this.data.kind].some((i) => i.sourceId === p.id)) {
      wx.showToast({ title: '已经在你的清单里了', icon: 'none' });
      return;
    }
    try {
      supplies[this.data.kind].push({
        id: `item-${Date.now()}`,
        sourceId: p.id,
        name: p.name,
        note: p.displayText || p.note || '',
        images: p.images || (p.image ? [p.image] : []),
        brand: p.brand || '',
      });
      saveStore({ supplies });
      this.refreshMine();
      this.closeDetail();
      wx.showToast({ title: '已加入清单' });
    } catch (e) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },

  openFoodSubmissions(create = false, form = {}) {
    wx.navigateTo({
      url: `/pages/pet-space/food-submissions${create ? '?create=1' : ''}`,
      success: (r) => r.eventChannel.emit('prefill', form),
    });
  },
  openCatalogAdd() {
    if (this.data.kind !== 'food') return;
    this.openFoodSubmissions(true, { brand: this.data.brand.trim(), product: this.data.query.trim() });
  },
  closeCatalogAdd() {
    this.setData({ catalogAdding: false, catalogEditorMode: 'form' });
  },

  inputCatalog(e) {
    this.setData({ [`catalogForm.${e.currentTarget.dataset.key}`]: e.detail.value });
  },

  openCatalogIngredient() {
    this.setData({ catalogEditorMode: 'ingredient' });
  },

  closeCatalogIngredient() {
    this.setData({ catalogEditorMode: 'form' });
  },

  onCatalogIngredientFound() {
    wx.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success: (res) => {
        const sourceType = res.tapIndex === 0 ? ['camera'] : ['album'];
        this.pickCatalogImages(sourceType);
      },
    });
  },

  pickCatalogImages(sourceType) {
    const remain = 3 - (this.data.catalogForm.images || []).length;
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
        const next = [...(this.data.catalogForm.images || []), ...files.map((file) => file.tempFilePath)].slice(0, 3);
        this.setData({
          catalogEditorMode: 'form',
          'catalogForm.images': next,
        });
      },
    });
  },

  previewCatalogImage(e) {
    const current = e.currentTarget.dataset.current;
    const urls = this.data.catalogForm.images || [];
    if (!current || !urls.length) return;
    wx.previewImage({ current, urls });
  },

  removeCatalogImage(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({
      'catalogForm.images': (this.data.catalogForm.images || []).filter((_, i) => i !== index),
    });
  },

  saveCatalogFood() {
    this.openFoodSubmissions(true, {
      brand: this.data.catalogForm.brand,
      product: this.data.catalogForm.series,
      images: this.data.catalogForm.images,
    });
    this.closeCatalogAdd();
  },

  editMine(e) {
    if (this.data.kind === 'food') {
      const id = e.currentTarget.dataset.id;
      if (id) wx.navigateTo({ url: `/pages/pet-space/food-submissions?id=${encodeURIComponent(id)}` });
      else this.openFoodSubmissions(true);
      return;
    }
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
    this.openFoodSubmissions(true, { product: this.data.form.name, images: [] });
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
    if (this.data.kind === 'food') {
      this.openFoodSubmissions(true);
      return;
    }
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
    this.onHide();
    this._petRequestId = (this._petRequestId || 0) + 1;
    this._requestId = (this._requestId || 0) + 1;
  },
});
