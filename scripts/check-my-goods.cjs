const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
let page, response, token = 'a', account = 'a', stops = 0;
const paths = [];
const context = {
  console,
  wx: { getStorageSync: () => token, stopPullDownRefresh: () => { stops += 1; } },
  Page: (value) => { page = value; },
  hasSession: () => !!token,
  accountKey: () => account,
  mapGoods: (item) => ({ id: item.product_id, name: item.product_name }),
  errorText: (error) => error.message,
  api: async (path) => {
    paths.push(path);
    const value = await response;
    if (value instanceof Error) throw value;
    return { data: value };
  },
};
vm.createContext(context);
function load(file) {
  vm.runInContext(fs.readFileSync(file, 'utf8').replace(/^import .*;$/gm, '').replace(/export /g, ''), context);
}
function result(number, ids, total) {
  return { page: number, page_size: 20, total, items: ids.map((id) => ({ product_id: String(id), product_name: `商品${id}` })) };
}
(async () => {
  load('utils/merchant.js');
  load('pages/goods/mine.js');
  page.setData = function (patch) { Object.assign(this.data, patch); };
  response = result(1, Array.from({ length: 20 }, (_, i) => i), 41);
  await page.loadPage(true);
  assert.equal(page.data.items.length, 20); assert.equal(page.data.hasMore, true);
  assert.match(paths[0], /mine\?page=1&page_size=20$/);
  let resolveNext;
  response = new Promise((resolve) => { resolveNext = resolve; });
  const next = page.loadPage();
  page.onReachBottom(); page.onReachBottom();
  assert.equal(paths.length, 2, 'Repeated reach-bottom must not duplicate a request');
  resolveNext(result(2, Array.from({ length: 20 }, (_, i) => i + 19), 41));
  await next;
  assert.equal(page.data.items.length, 39, 'Overlapping pages are deduplicated');
  response = new Error('offline'); await page.loadPage();
  assert.equal(page.data.page, 2); assert.equal(page.data.items.length, 39);
  response = result(3, [39, 40], 41); await page.retry();
  assert.match(paths[paths.length - 1], /page=3&/);
  assert.equal(page.data.items.length, 41); assert.equal(page.data.hasMore, false);
  const count = paths.length; page.onReachBottom(); assert.equal(paths.length, count);
  // Failed refresh retries page one, even after reaching the last page.
  response = new Error('refresh failed'); await page.onPullDownRefresh();
  assert.equal(stops, 1); assert.equal(page.data.items.length, 41);
  response = result(1, [100], 1); await page.retry();
  assert.match(paths[paths.length - 1], /page=1&/); assert.equal(page.data.items.length, 1);
  let resolveOld;
  response = new Promise((resolve) => { resolveOld = resolve; });
  const old = page.loadPage(true);
  response = result(1, [200], 1); await page.loadPage(true);
  resolveOld(result(1, [300], 1)); await old;
  assert.equal(page.data.items[0].id, '200');
  response = new Promise((resolve) => { resolveOld = resolve; });
  const switched = page.loadPage(true); account = 'b'; token = 'b';
  resolveOld(result(1, [400], 1)); await switched;
  assert.equal(page.data.items[0].id, '200', 'Old account response cannot overwrite data');
  token = '';
  await page.loadPage(true); assert.equal(page.data.items.length, 0); assert.equal(page.data.needsLogin, true);
  token = 'b'; response = Object.assign(new Error('expired'), { statusCode: 401 });
  await page.loadPage(true); assert.equal(page.data.needsLogin, true); assert.equal(page.data.page, 0);
  response = result(1, [], 0); await page.loadPage(true);
  assert.equal(page.data.hasMore, false); assert.equal(page.data.items.length, 0);
  response = { items: [] }; await page.loadPage(true);
  assert.match(page.data.error, /重试/);
  console.log('PASS my goods pagination, repeated scroll, deduplication, retry, last page, pull refresh, racing responses, account isolation and login states');
})().catch((error) => { console.error(error); process.exitCode = 1; });
