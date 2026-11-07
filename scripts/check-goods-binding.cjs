const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
let page, account = 'a', response, request, calls = 0;
const context = {
  console,
  wx: { getStorageSync: () => 'token', showToast() {}, showModal() {} },
  hasSession: () => true,
  requireSession: () => true,
  accountKey: () => account,
  errorText: (error) => error.message,
  Page: (value) => { page = value; },
  api: async (path, method, payload) => {
    request = { path, method, payload };
    calls += 1;
    const result = await response;
    if (result instanceof Error) throw result;
    return result;
  },
};
vm.createContext(context);
function load(file) {
  vm.runInContext(fs.readFileSync(file, 'utf8').replace(/^import .*;$/gm, '').replace(/export /g, ''), context);
}
(async () => {
  load('utils/merchant.js');
  load('pages/goods/bind.js');
  page.setData = function (patch) { Object.assign(this.data, patch); };
  page.onLoad({ id: 'SKU_TEST', name: '商品' });
  response = { items: [
    { id: 'already', title: '原帖', status: 'active', products: [{ product_id: 'SKU_TEST' }] },
    { id: 'choose', title: '可选帖', status: 'active', products: [] },
    { id: 'pending', title: '审核中', status: 'pending' },
  ] };
  await page.loadPosts();
  assert.equal(request.path, '/moments?include_private=true&limit=100');
  assert.equal(page.data.posts.length, 2);
  page.selectPost({ currentTarget: { dataset: { id: 'already' } } });
  assert.equal(page.data.selectedId, '');
  page.selectPost({ currentTarget: { dataset: { id: 'choose' } } });
  let resolve;
  response = new Promise((done) => { resolve = done; });
  const binding = page.bind(); const before = calls;
  await page.bind(); assert.equal(calls, before);
  assert.equal(request.path, '/merchant/products/SKU_TEST/bind');
  assert.equal(request.method, 'POST');
  assert.deepEqual(JSON.parse(JSON.stringify(request.payload)), { post_id: 'choose' });
  resolve(new Error('offline')); await binding;
  assert.equal(page.data.selectedId, 'choose'); assert.equal(page.data.saving, false);
  response = { data: { product_id: 'SKU_TEST', post_id: 'choose' } };
  await page.bind();
  assert.equal(page.data.boundPostId, 'choose'); assert.equal(page.data.selectedId, '');
  assert.equal(page.data.posts.find((item) => item.id === 'choose').bound, true);
  const completed = calls; await page.bind(); assert.equal(calls, completed);
  response = { data: { product_id: 'other', post_id: 'choose' } };
  await assert.rejects(context.bindGoodsToPost('SKU_TEST', 'choose'), /重试/);
  response = new Promise((done) => { resolve = done; });
  const loading = page.loadPosts(); account = 'b';
  resolve({ items: [{ id: 'wrong', status: 'active' }] }); await loading;
  assert.equal(page.data.posts.some((item) => item.id === 'wrong'), false);
  response = Object.assign(new Error('expired'), { statusCode: 401 });
  await page.loadPosts(); assert.equal(page.data.needsLogin, true); assert.equal(page.data.posts.length, 0);
  console.log('PASS own-post query, bound/pending exclusions, payload, duplicate guard, failed retry, confirmed success, response validation and account isolation');
})().catch((error) => { console.error(error); process.exitCode = 1; });
