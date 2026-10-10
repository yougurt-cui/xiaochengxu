import { localDate, nextReminderTime, reminderView } from './reminders';
export function dateValue(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function shiftDate(key, days) {
  const d = dateValue(key);
  d.setDate(d.getDate() + days);
  return localDate(d);
}
export function weekStart(key = localDate()) {
  const d = dateValue(key);
  return shiftDate(key, -((d.getDay() + 6) % 7));
}
export function remindersOnDate(items, key) {
  const start = dateValue(key).getTime();
  const end = dateValue(shiftDate(key, 1)).getTime();
  return items
    .map((r) => {
      const dueAt = r.dueAt >= start ? r.dueAt : nextReminderTime(r, start - 1);
      return dueAt != null && dueAt >= start && dueAt < end
        ? { ...reminderView({ ...r, dueAt }), occurrence: dueAt !== r.dueAt }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.dueAt - b.dueAt);
}
export function calendarDays(start, count, selected, items) {
  const today = localDate();
  return Array.from({ length: count }, (_, i) => {
    const key = shiftDate(start, i),
      d = dateValue(key);
    return {
      key,
      day: key === today ? '今天' : d.getDate(),
      week: ['日', '一', '二', '三', '四', '五', '六'][d.getDay()],
      today: key === today,
      selected: key === selected,
      count: remindersOnDate(items, key).length,
    };
  });
}
export function monthLabel(key) {
  const d = dateValue(key);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

// Count calendar days to this year's birthday only, matching annual reminder dates.
export function birthdayCountdown(birthday, now = new Date()) {
  const key = String(birthday || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return '';
  const [birthYear, month, day] = key.split('-').map(Number);
  const birthDate = new Date(birthYear, month - 1, day);
  if (localDate(birthDate) !== key || key > localDate(now)) return '';
  const year = now.getFullYear();
  const birthdayDay = Math.min(day, new Date(year, month, 0).getDate());
  const days = (Date.UTC(year, month - 1, birthdayDay) - Date.UTC(year, now.getMonth(), now.getDate())) / 86400000;
  return days > 0 ? `距离生日还有${days}天` : '';
}
