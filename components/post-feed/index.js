Component({
  properties: {
    appearance: { type: String, value: '' },
    allowSave: { type: Boolean, value: true },
    posts: {
      type: Array,
      value: [],
      observer() {
        this.arrange();
      },
    },
  },
  data: { columns: [[], []] },
  methods: {
    arrange() {
      const posts = this.properties.posts || [];
      const heights = [0, 0];
      const columns = [[], []];
      const previous = this._placements || new Map();
      const placements = new Map();
      const width = (wx.getWindowInfo().windowWidth - 46) / 2;
      posts.forEach((p) => {
        const ratio = (this._ratios || {})[p.image] || p.imageRatio || 1.05;
        const col = previous.has(p.id) ? previous.get(p.id) : (heights[0] <= heights[1] ? 0 : 1);
        placements.set(p.id, col);
        columns[col].push(p);
        heights[col] += (p.image ? width * ratio : 0) + Math.ceil((p.title || '').length / 12) * 21 + 78;
      });
      this._placements = placements;
      this.setData({ columns });
    },
    imageLoaded(e) {
      const { width, height } = e.detail;
      const {src} = e.currentTarget.dataset;
      if (!width || !height) return;
      this._ratios = this._ratios || {};
      const ratio = height / width;
      if (Math.abs((this._ratios[src] || 0) - ratio) < 0.01) return;
      this._ratios[src] = ratio;
      // Keep mounted cards in their columns; use actual ratios on the next data update.
    },
    open(e) {
      this.triggerEvent('open', { id: e.currentTarget.dataset.id });
    },
    save(e) {
      this.triggerEvent('save', { id: e.currentTarget.dataset.id });
    },
  },
});
