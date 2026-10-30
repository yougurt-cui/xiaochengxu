const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let user = 'alice', authenticated = true, response, failure, requests = [];
const storage = new Map();
const wx = { getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: key => storage.delete(key) };
const ctx = { wx, accountKey: key => `${key}:${user}`, hasSession: () => authenticated,
  api: async (path, method = 'GET', data) => { requests.push({ path, method, data }); if (failure) throw failure; return response; } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('utils/halloween-activity.js', 'utf8').replace(/^import .*;$/gm, '').replace(/export /g, ''), ctx);
const postId = 'a'.repeat(32);
async function run() {
  authenticated = false;
  assert.equal((await ctx.getActivityStatus()).status, 'loginRequired');
  assert.equal(requests.length, 0);
  authenticated = true;
  response = { ok: true, status: 'NOT_CLAIMED', code: null };
  assert.equal((await ctx.getActivityStatus()).status, 'incomplete');
  assert.equal(requests[0].path, '/activity/1001/my-code');
  ctx.saveActivityPost({ id: 'draft-1', status: 'published' });
  assert.equal(ctx.getActivityPost(), null);
  ctx.saveActivityPost({ id: postId, status: 'pending' });
  assert.equal(ctx.getActivityPost().post_id, postId, 'persist server post ID even when moderation is pending');
  assert.equal((await ctx.getActivityStatus()).status, 'incomplete');
  ctx.saveActivityPost({ id: postId, status: 'published' });
  assert.equal((await ctx.getActivityStatus()).status, 'eligible');
  response = { ok: true, status: 'SUCCESS', code: 'REAL-CODE' };
  assert.equal((await ctx.claimActivityCode()).code, 'REAL-CODE');
  assert.deepEqual(JSON.parse(JSON.stringify(requests.at(-1))), { path: '/activity/claim', method: 'POST', data: { activity_id: 1001, post_id: postId } });
  response.status = 'ALREADY_CLAIMED';
  assert.equal((await ctx.claimActivityCode()).code, 'REAL-CODE');
  user = 'bob';
  assert.equal(ctx.getActivityPost(), null, 'post IDs are isolated by account');
  assert.equal((await ctx.getActivityStatus()).record.code, 'REAL-CODE', 'server restores code without local post on another device');
  await assert.rejects(ctx.claimActivityCode(), /发帖凭据/);
  user = 'alice';
  response = { ok: true, status: 'BUSY' };
  await assert.rejects(ctx.claimActivityCode(), /领取人数较多/);
  assert.ok(ctx.getActivityPost());
  response = { ok: true, status: 'OUT_OF_STOCK' };
  await assert.rejects(ctx.claimActivityCode(), error => error.activityStatus === 'soldOut');
  failure = Object.assign(new Error('帖子不可用'), { statusCode: 403 });
  await assert.rejects(ctx.claimActivityCode(), error => error.activityStatus === 'incomplete');
  assert.equal(ctx.getActivityPost(), null);
  failure = null;
  ctx.saveActivityPost({ id: postId, status: 'published' });
  response = { ok: true, status: 'SUCCESS', code: null };
  await assert.rejects(ctx.claimActivityCode(), /返回异常/);
  response = { ok: true, status: 'UNKNOWN' };
  await assert.rejects(ctx.getActivityStatus(), /返回异常/);

  let pageDef, resolveClaim, resolveStatus, claims = 0, copied;
  let statusImpl = async () => ({ status: 'eligible', record: null });
  vm.runInNewContext(fs.readFileSync('pages/halloween/index.js', 'utf8').replace(/^import .*;$/gm, ''), {
    Page: p => { pageDef = p; }, requireSession() {}, accountKey: () => user,
    HALLOWEEN_ID: 'halloween-2026', REDEEM_URL: 'https://aibubu.cn/en',
    getActivityStatus: () => statusImpl(), claimActivityCode: () => { claims++; return new Promise(resolve => { resolveClaim = resolve; }); },
    wx: { pageScrollTo() {}, setClipboardData: args => { copied = args.data; }, setNavigationBarColor() {} },
  });
  const page = { ...pageDef, _alive: true, data: { ...pageDef.data }, setData(patch) { Object.assign(this.data, patch); } };
  await page.refreshStatus();
  const one = page.claim(), two = page.claim();
  assert.equal(claims, 1);
  resolveClaim({ code: 'REAL-CODE' }); await Promise.all([one, two]);
  assert.equal(page.data.status, 'claimed');
  page.copyCode(); assert.equal(copied, 'REAL-CODE');
  statusImpl = () => new Promise(resolve => { resolveStatus = resolve; });
  const pending = page.refreshStatus(); user = 'bob';
  resolveStatus({ status: 'claimed', record: { code: 'private' } }); await pending;
  assert.equal(page.data.record, null);
  let releaseDef, savedPost, notified = 0;
  const publishContext = {
    Page: value => { releaseDef = value; }, categories: [], accountKey: () => user,
    requireSession: () => true, login: async () => ({ name: 'Test' }),
    api: async () => ({ item: { id: postId, status: 'active' } }),
    mapPost: p => ({ id: p.id, status: p.status === 'active' ? 'published' : 'pending' }),
    saveActivityPost: p => { savedPost = p; }, queueHalloweenTaskPrompt: () => notified++,
    loadStore: () => ({ posts: [] }), saveStore() {}, errorText: e => e.message,
    wx: { showToast() {}, navigateBack() {}, showModal() {} },
  };
  vm.runInNewContext(fs.readFileSync('pages/release/index.js', 'utf8').replace(/^import .*;$/gm, ''), publishContext);
  const composer = { ...releaseDef, data: { ...releaseDef.data, body: 'hello', images: ['https://example.test/pet.png'] },
    async loadPets() {}, setData(patch) { Object.assign(this.data, patch); } };
  await composer.release();
  assert.equal(savedPost.id, postId, 'posting persists the actual response item.id');
  assert.equal(savedPost.status, 'published');
  assert.equal(notified, 1);
  savedPost = null;
  publishContext.api = async () => { throw new Error('offline'); };
  await composer.release();
  assert.equal(savedPost, null, 'failed publication never replaces the local post credential');
  const markup = fs.readFileSync('pages/halloween/index.wxml', 'utf8');
  assert.ok(!markup.includes('previewStates') && !markup.includes('DEMO-'));
  for (const [, condition] of markup.matchAll(/wx:(?:if|elif)="([^"]*)"/g)) assert.ok(condition.startsWith('{{') && condition.endsWith('}}'));
  console.log('PASS activity API: server post persistence, account isolation, login, recovery, claim payload, idempotent result, stock/busy/403, duplicate taps, clipboard and stale responses');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
