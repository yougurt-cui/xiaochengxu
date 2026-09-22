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
    lazyLoad: { type: Boolean, value: true },
    alt: { type: String, value: '图片' },
  },
  data: { loaded: false, failed: false, displaySrc: '' },
  lifetimes: {
    attached() {
      this._detached = false;
      this.resolveSource();
    },
    detached() {
      this._detached = true;
      this._imageRequest = (this._imageRequest || 0) + 1;
    },
  },
  methods: {
    async resolveSource() {
      const src = this.properties.src;
      const request = (this._imageRequest = (this._imageRequest || 0) + 1);
      this.setData({ loaded: false, failed: false, displaySrc: '' });
      if (!isPrivatePetImage(src)) {
        this.setData({ displaySrc: src });
        return;
      }
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
