const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const storage = new Map();
let account = 'alice', modal, navigation, count = 0, failWrite = false;
const wx = {
  getStorageSync: key => storage.get(key),
  setStorageSync: (key, value) => { if (failWrite) throw new Error('disk full'); storage.set(key, value); },
  showModal: options => { modal = options; count++; },
  navigateTo: options => { navigation = options; },
  showToast() {},
};
function load() {
  const ctx = { wx, accountKey: key => `${key}:${account}`, HALLOWEEN_ID: 'halloween-2026' };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('utils/halloween-task-prompt.js', 'utf8').replace(/^import .*;$/gm, '').replace(/export /g, ''), ctx);
  return ctx;
}
let prompt = load();
prompt.showHalloweenTaskPrompt();
assert.equal(count, 0, 'ordinary home visits do not show a reward prompt');
for (const status of ['draft', 'pending', 'rejected']) prompt.queueHalloweenTaskPrompt({ id: 'p', status });
prompt.showHalloweenTaskPrompt();
assert.equal(count, 0, 'only published posts qualify');
prompt.queueHalloweenTaskPrompt({ id: 'p', status: 'published' });
assert.equal(count, 0, 'posting queues the prompt but does not show it on the composer');
prompt = load(); // Simulate restarting before returning home.
prompt.showHalloweenTaskPrompt();
assert.equal(count, 1);
assert.equal(modal.content, '已完成发帖任务');
assert.equal(modal.cancelText, '取消');
assert.equal(modal.confirmText, '领取奖励');
prompt.showHalloweenTaskPrompt();
assert.equal(count, 1, 'repeated lifecycle calls cannot stack dialogs');
modal.success({ cancel: true, confirm: false });
assert.equal(navigation, undefined);
prompt.queueHalloweenTaskPrompt({ id: 'second-post', status: 'published' });
prompt = load();
prompt.showHalloweenTaskPrompt();
assert.equal(count, 1, 'cancel and app restart do not reset the once-only flag');

account = 'bob';
prompt.queueHalloweenTaskPrompt({ id: 'b', status: 'published' });
prompt.showHalloweenTaskPrompt();
assert.equal(count, 2, 'the once-only flag is isolated by account');
modal.success({ confirm: true });
assert.equal(navigation.url, '/pages/halloween/index');
prompt.showHalloweenTaskPrompt();
assert.equal(count, 2, 'confirm also consumes the prompt');

account = 'carol';
prompt.queueHalloweenTaskPrompt({ id: 'c', status: 'published' });
failWrite = true;
prompt.showHalloweenTaskPrompt();
assert.equal(count, 2, 'cannot display without persisting the flag');
failWrite = false;
prompt.showHalloweenTaskPrompt();
assert.equal(count, 3);
modal.fail();
prompt.showHalloweenTaskPrompt();
assert.equal(count, 4, 'a native dialog that failed to open can be retried');
navigation = undefined;
account = 'dave';
modal.success({ confirm: true });
assert.equal(navigation, undefined, 'ignore callbacks after account switch');
console.log('PASS Halloween task prompt: published-only, home-only queue, once per account, restart, cancel/confirm, dialog/storage failure and account switch');
