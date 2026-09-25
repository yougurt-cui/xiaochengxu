import { fetchFoodCatalog, mapCatalogFood } from '../../utils/food-catalog';
import { errorText } from '../../api/miniprogram';

Page({
  data: { query: '', items: [], loading: false, error: '', selected: null, partial: false },
  onLoad() {
    this.search();
  },
  input(e) {
    this.setData({ query: e.detail.value });
  },
  async search() {
    const request = (this._request = (this._request || 0) + 1);
    this.setData({ loading: true, error: '', items: [], selected: null, partial: false });
    try {
      const result = await fetchFoodCatalog(this.data.query, 100);
      if (request !== this._request) return;
      this.setData({ items: (result.items || []).map(mapCatalogFood), partial: !!result.partial });
    } catch (e) {
      if (request === this._request) this.setData({ error: errorText(e) });
    } finally {
      if (request === this._request) this.setData({ loading: false });
    }
  },
  openItem(e) {
    this.setData({ selected: this.data.items.find((p) => p.id === e.currentTarget.dataset.id) || null });
  },
  closeDetail() {
    this.setData({ selected: null });
  },
  contribute() {
    wx.navigateTo({ url: '/pages/pet-space/food-submissions?create=1' });
  },
  onUnload() {
    this._request = (this._request || 0) + 1;
  },
});
