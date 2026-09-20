Component({
  options: { virtualHost: true },
  externalClasses: ['image-class'],
  properties: {
    src: {
      type: String,
      value: '',
      observer() {
        this.setData({ loaded: false, failed: false });
      },
    },
    mode: { type: String, value: 'aspectFill' },
    lazyLoad: { type: Boolean, value: true },
    alt: { type: String, value: '图片' },
  },
  data: { loaded: false, failed: false },
  methods: {
    onLoad(e) {
      if (e.currentTarget.dataset.src !== this.properties.src) return;
      this.setData({ loaded: true, failed: false });
      this.triggerEvent('load', e.detail);
    },
    onError(e) {
      if (e.currentTarget.dataset.src !== this.properties.src) return;
      this.setData({ loaded: false, failed: true });
      this.triggerEvent('error', e.detail);
    },
  },
});
