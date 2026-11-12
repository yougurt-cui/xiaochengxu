import { isPrivatePetImage, downloadPetImage } from '../../api/miniprogram';
Component({
  options: { virtualHost: true },
  externalClasses: ['image-class'],
  properties: {
    src: {
      type: String,
      value: '',
      observer() {
        this.resolveSource();
      },
    },
    mode: { type: String, value: 'aspectFill' },
    lazyLoad: { type: Boolean, value: true, observer() { this.resolveSource(); } },
    alt: { type: String, value: '图片' },
  },
  data: { loaded: false, failed: false, displaySrc: '' },
  lifetimes: {
    attached() {
      this._attached = true;
      this._detached = false;
      this.resolveSource();
    },
    ready() {
      this._ready = true;
      if (isPrivatePetImage(this.properties.src) && this.properties.lazyLoad) this.resolveSource();
    },
    detached() {
      this.disconnectVisibility();
      this._detached = true;
      this._imageRequest = (this._imageRequest || 0) + 1;
    },
  },
  methods: {
    disconnectVisibility() {
      if (this._visibility) this._visibility.disconnect();
      this._visibility = null;
    },
    resolveSource() {
      if (!this._attached || this._detached) return;
      this.disconnectVisibility();
      const src = this.properties.src;
      const request = (this._imageRequest = (this._imageRequest || 0) + 1);
      this.setData({ loaded: false, failed: false, displaySrc: '' });
      if (!isPrivatePetImage(src)) {
        this.setData({ displaySrc: src });
        return;
      }
      if (this.properties.lazyLoad) {
        if (!this._ready) return;
        try {
          this._visibility = this.createIntersectionObserver();
          this._visibility.relativeToViewport({ top: 300, bottom: 300 }).observe('.frame', (entry) => {
            if (request !== this._imageRequest || this._detached || entry.intersectionRatio <= 0) return;
            this.disconnectVisibility();
            this.downloadSource(src, request);
          });
          return;
        } catch (_) {
          this.disconnectVisibility();
          // Fall back to loading if visibility observation is unavailable.
        }
      }
      this.downloadSource(src, request);
    },
    async downloadSource(src, request) {
      try {
        const local = await downloadPetImage(src);
        if (!this._detached && request === this._imageRequest) this.setData({ displaySrc: local });
      } catch (e) {
        if (!this._detached && request === this._imageRequest) {
          this.setData({ failed: true });
          this.triggerEvent('error', { errMsg: e.message });
        }
      }
    },
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
