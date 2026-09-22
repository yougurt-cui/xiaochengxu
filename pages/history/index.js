import { loadStore, currentPet } from '../../utils/pet-store';

Page({
  data: { records: [] },
  onShow() {
    this.setData({
      records: loadStore()
        .records.filter((r) => (r.petId || '') === (currentPet()?.id || ''))
        .slice()
        .sort((a, b) => b.day.localeCompare(a.day)),
    });
  },
});
