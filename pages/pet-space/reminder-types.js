import { reminderTypes } from '../../utils/reminders';
Page({
  data: { types: reminderTypes },
  choose(e) {
    wx.redirectTo({ url: '/pages/pet-space/reminder-edit?type=' + encodeURIComponent(e.currentTarget.dataset.id) });
  },
});
