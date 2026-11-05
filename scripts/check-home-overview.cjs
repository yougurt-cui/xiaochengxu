const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
let page, navigation;
const pet = { id: 'current' };
const now = new Date();
const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
let store = { records: [], reminders: [] };
const context = {
  Page: (value) => { page = value; }, categories: [],
  currentPet: () => pet, loadStore: () => store, saveStore: () => {},
  dayKey: () => key, getReminderPrompt: () => '', getFeedPosts: () => [],
  wx: { navigateTo: (value) => { navigation = value.url; } },
};
vm.createContext(context);
for (const file of ['utils/reminders.js', 'utils/reminder-calendar.js', 'pages/home/index.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8').replace(/^import .*;$/gm, '').replace(/export /g, ''), context);
}
page.setData = function (value) { Object.assign(this.data, value); };
page.refreshData();
assert.equal(page.data.calendarDays.length, 7);
assert.equal(page.data.calendarDays[0].week, '一');
assert.equal(page.data.calendarDays.filter((d) => d.today).length, 1);
assert.equal(page.data.calendarDays.find((d) => d.today).day, now.getDate());
assert.equal(page.data.hasDailyRecords, false);
assert.equal(page.data.calendarDays.some((d) => d.count), false);
page.openReminderAction();assert.equal(navigation, '/pages/pet-space/reminder-types');
store.records = [{ petId: 'another', day: key, water: 100 }];
page.refreshData();assert.equal(page.data.hasDailyRecords, false);
store.records.push({ petId: pet.id, day: key, water: 0, food: 45 });
page.refreshData();assert.equal(page.data.hasDailyRecords, true);
assert.equal(page.data.metrics[0].hasValue, true);assert.equal(page.data.metrics[0].value, 0);
assert.equal(page.data.metrics[2].hasValue, false);
const dueAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59).getTime();
store.reminders = [
  { id: 'own', petId: pet.id, title: '体外驱虫', dueAt, repeat: 'none' },
  { id: 'other', petId: 'another', title: '其他宠物', dueAt, repeat: 'none' },
];
page.refreshData();assert.equal(page.data.calendarCount, 1);
assert.equal(page.data.calendarDays.find((d) => d.today).count, 1);
page.openReminderAction();assert.equal(navigation, `/pages/pet-space/reminders?date=${key}`);
console.log('PASS home overview: current week, pet isolation, zero/partial records, reminder dots and action routing');
