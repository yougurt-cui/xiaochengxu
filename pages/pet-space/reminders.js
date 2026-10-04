import {
  listReminders,
  listReminderHistory,
  completeReminder,
  reminderView,
  reminderTypes,
} from '../../utils/reminders';
Page({
  data: { history: false, overdue: [], upcoming: [], records: [], filters: [], filter: 'all', selected: null },
  onLoad(q) {
    this.setData({ history: q.mode === 'history' });
  },
  onShow() {
    clearInterval(this._timer);
    this.refresh();
    this._timer = setInterval(() => this.refresh(), 60000);
  },
  onHide() {
    clearInterval(this._timer);
  },
  onUnload() {
    clearInterval(this._timer);
  },
  refresh() {
    const items = listReminders()
      .map((r) => reminderView(r))
      .sort((a, b) => a.dueAt - b.dueAt);
    const history = listReminderHistory()
      .map((r) => reminderView(r))
      .sort((a, b) => b.completedAt - a.completedAt);
    const filters = [{ id: 'all', name: '全部' }, ...reminderTypes.filter((t) => history.some((r) => r.type === t.id))];
    const filter = filters.some((t) => t.id === this.data.filter) ? this.data.filter : 'all';
    this.setData({
      overdue: items.filter((r) => r.overdue),
      upcoming: items.filter((r) => !r.overdue),
      filters,
      filter,
      records: history.filter((r) => filter === 'all' || r.type === filter),
    });
  },
  chooseFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.id });
    this.refresh();
  },
  create() {
    wx.navigateTo({ url: '/pages/pet-space/reminder-types' });
  },
  history() {
    wx.navigateTo({ url: '/pages/pet-space/reminders?mode=history' });
  },
  edit(e) {
    wx.navigateTo({ url: '/pages/pet-space/reminder-edit?id=' + encodeURIComponent(e.currentTarget.dataset.id) });
  },
  complete(e) {
    try {
      if (completeReminder(e.currentTarget.dataset.id, Number(e.currentTarget.dataset.due)))
        wx.showToast({ title: '已完成' });
      this.refresh();
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败，请重试', icon: 'none' });
    }
  },
  detail(e) {
    this.setData({ selected: this.data.records.find((r) => r.id === e.currentTarget.dataset.id) });
  },
  close() {
    this.setData({ selected: null });
  },
});
