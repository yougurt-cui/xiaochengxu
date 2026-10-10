import { calendarDays, remindersOnDate, weekStart, shiftDate, monthLabel } from '../../utils/reminder-calendar';
import { localDate } from '../../utils/reminders';
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
    const date = /^\d{4}-\d{2}-\d{2}$/.test(q.date || '') ? q.date : localDate();
    this.setData({
      history: q.mode === 'history',
      calendarDate: date,
      calendarStart: weekStart(date),
      showAll: !q.date,
      types: reminderTypes,
      weekdays: ['一', '二', '三', '四', '五', '六', '日'],
    });
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
    const shown = this.data.showAll ? items : remindersOnDate(items, this.data.calendarDate);
    this.setData({
      calendarDays: calendarDays(this.data.calendarStart, 14, this.data.calendarDate, items),
      calendarMonth: monthLabel(this.data.calendarStart),
      overdue: shown.filter((r) => r.overdue),
      upcoming: shown.filter((r) => !r.overdue),
      filters,
      filter,
      records: history.filter((r) => filter === 'all' || r.type === filter),
    });
  },
  chooseDate(e) {
    this.setData({ calendarDate: e.currentTarget.dataset.date, showAll: false });
    this.refresh();
  },
  allDates() {
    this.setData({ showAll: true });
    this.refresh();
  },
  moveCalendar(e) {
    this.setData({ calendarStart: shiftDate(this.data.calendarStart, Number(e.currentTarget.dataset.days)) });
    this.refresh();
  },
  calendarTouchStart(e) {
    this._touchX = e.touches[0].clientX;
  },
  calendarTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - this._touchX;
    if (Math.abs(dx) > 45) {
      this.setData({ calendarStart: shiftDate(this.data.calendarStart, dx < 0 ? 14 : -14) });
      this.refresh();
    }
  },
  createType(e) {
    wx.navigateTo({
      url:
        '/pages/pet-space/reminder-edit?type=' +
        e.currentTarget.dataset.id +
        '&date=' +
        (this.data.calendarDate < localDate() ? localDate() : this.data.calendarDate),
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
