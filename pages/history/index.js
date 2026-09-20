import { loadStore } from '../../utils/pet-store';

Page({
  data: { records: [] },
  onShow() {
    this.setData({
      records: loadStore()
        .records.slice()
        .sort((a, b) => b.day.localeCompare(a.day)),
    });
  },
});
