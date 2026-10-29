const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let user = 'alice', env = 'develop', brokenStorage = false;
const memory = new Map();
const wx = {
  getAccountInfoSync: () => ({ miniProgram: { envVersion: env } }),
  getStorageSync: key => memory.get(key),
  setStorageSync: (key, value) => { if (brokenStorage) throw new Error('disk full'); memory.set(key, value); },
};
const ctx = { wx, accountKey: key => `${key}:${user}` };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('utils/halloween-activity.js', 'utf8').replace(/^import .*;$/gm, '').replace(/export /g, ''), ctx);
async function run() {
  assert.equal((await ctx.getActivityStatus()).status, 'incomplete');
  await assert.rejects(ctx.claimActivityCode(), /完成活动任务/);
  ctx.markActivityPostPublished({ id: 'p1', status: 'pending' });
  assert.equal((await ctx.getActivityStatus()).status, 'incomplete', 'pending moderation is not eligible');
  ctx.markActivityPostPublished({ id: 'p1', status: 'published' });
  assert.equal((await ctx.getActivityStatus()).status, 'eligible');
  brokenStorage = true;
  await assert.rejects(ctx.claimActivityCode(), /disk full/);
  brokenStorage = false;
  assert.equal((await ctx.getActivityStatus()).status, 'eligible', 'failed persistence cannot report claimed');
  const [first, second] = await Promise.all([ctx.claimActivityCode(), ctx.claimActivityCode()]);
  assert.equal(first.claimedAt, second.claimedAt);
  assert.equal(first.code, 'DEMO-XXXX-XXXX');
  assert.equal((await ctx.getActivityStatus()).record.code, first.code);
  user = 'bob';
  assert.equal((await ctx.getActivityStatus()).status, 'incomplete', 'accounts cannot share codes or eligibility');
  ctx.setActivityPreviewState('soldOut');
  await assert.rejects(ctx.claimActivityCode(), /领完/);
  user = 'alice';
  const key = ctx.accountKey('activity-preview:halloween-2026');
  memory.set(key, { ...memory.get(key), soldOut: true });
  assert.equal((await ctx.getActivityStatus()).status, 'claimed', 'existing claim wins over stock');
  ctx.setActivityPreviewState('error');
  await assert.rejects(ctx.getActivityStatus(), /查询/);
  ctx.setActivityPreviewState('incomplete');
  assert.equal((await ctx.getActivityStatus()).status, 'incomplete');
  env = 'release';
  ctx.setActivityPreviewState('claimed');
  assert.equal((await ctx.getActivityStatus()).status, 'unavailable');
  await assert.rejects(ctx.claimActivityCode(), /即将开放/);

  let definition, resolveQuery, claimCount = 0, navigation, copied;
  let statusImpl = async () => ({ status: 'incomplete', record: null });
  const pageCtx = {
    Page: value => { definition = value; },
    getActivityStatus: () => statusImpl(),
    claimActivityCode: async () => { claimCount++; return { code: 'DEMO-XXXX-XXXX', claimedAt: new Date().toISOString() }; },
    isActivityPreview: () => true, markActivityPostPublished: ctx.markActivityPostPublished,
    setActivityPreviewState: ctx.setActivityPreviewState,
    accountKey: () => user, HALLOWEEN_ID: 'halloween-2026', REDEEM_URL: 'https://aibubu.cn/en',
    shareCard() {}, timelineCard() {},
    wx: { pageScrollTo() {}, showToast() {}, setNavigationBarColor() {},
      navigateTo: args => { navigation = args; }, setClipboardData: args => { copied = args; } },
  };
  vm.runInNewContext(fs.readFileSync('pages/halloween/index.js', 'utf8').replace(/^import .*;$/gm, ''), pageCtx);
  const page = { ...definition, data: { ...definition.data }, _alive: true, setData(patch) { Object.assign(this.data, patch); } };
  await page.refreshStatus();
  await page.claim();
  assert.equal(claimCount, 0);
  page.goPost(); navigation.complete();
  await page.refreshStatus();
  assert.equal(page.data.status, 'incomplete', 'visiting composer or refreshing alone does not complete a task');
  page.setData({ status: 'eligible' });
  await Promise.all([page.claim(), page.claim()]);
  assert.equal(claimCount, 1, 'rapid taps only issue one claim');
  page.copyCode(); assert.equal(copied.data, 'DEMO-XXXX-XXXX');
  page.copyUrl(); assert.equal(copied.data, 'https://aibubu.cn/en');
  statusImpl = () => new Promise(resolve => { resolveQuery = resolve; });
  const slow = page.refreshStatus();
  user = 'other';
  resolveQuery({ status: 'claimed', record: { code: 'private-code' } });
  await slow;
  assert.equal(page.data.record, null, 'stale response after account switch is ignored');
  statusImpl = async () => { throw new Error('offline'); };
  await page.refreshStatus();
  assert.equal(page.data.status, 'error');
  assert.equal(page.data.loading, false);
  statusImpl = async () => ({ status: 'eligible', record: null });
  await page.refreshStatus();
  assert.equal(page.data.status, 'eligible', 'error can be retried');
  for (const file of ['pages/halloween/assets/hero.png', 'pages/halloween/assets/success.png', 'static/activity/halloween-cat.png']) assert.ok(fs.statSync(file).size > 1000);
  const markup = fs.readFileSync('pages/halloween/index.wxml', 'utf8');
  for (const [, condition] of markup.matchAll(/wx:(?:if|elif)="([^"]*)"/g)) {
    assert.ok(condition.startsWith('{{') && condition.endsWith('}}'), 'conditional attributes must bind expressions, not truthy literal strings');
  }
  console.log('PASS Halloween: task gating, moderation, persistence failure, idempotency, account isolation, stock priority, release guard, refresh, clipboard and retry');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
