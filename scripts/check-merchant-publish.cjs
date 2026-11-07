const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const storage = new Map([['miniprogram_token', 'token-a']]);
let page, account = 'a', calls = [], uploadCount = 0, publishCount = 0, failPublish = true;
let identity = { is_merchant: true, merchants: [{ id: 7, merchant_type: '品牌商', shop_link: 'https://example.com/shop' }] };
const wx = {
  getStorageSync: (key) => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, JSON.parse(JSON.stringify(value))),
  removeStorageSync: (key) => storage.delete(key),
  showToast() {}, showModal() {},
  uploadFile(options) {
    uploadCount += 1;
    assert.equal(options.name, 'file');
    assert.match(options.url, /\/api\/miniprogram\/merchant\/images\/upload$/);
    assert.equal(options.header.Authorization, 'Bearer token-a');
    options.success({ statusCode: 201, data: JSON.stringify({ ok: true, data: { image_id: 'image-1', url: '/media/1.jpg' } }) });
  },
};
const context = {
  wx, console, config: { apiBaseUrl: 'https://chongxi.cloud' },
  Page: (value) => { page = value; },
  hasSession: () => !!storage.get('miniprogram_token'),
  requireSession: () => !!storage.get('miniprogram_token'),
  accountKey: (key) => `${account}:${key}`,
  mediaUrl: (url) => `https://chongxi.cloud${url}`,
  errorText: (error) => error.message,
  api: async (path, method, payload, options) => {
    if (path === '/merchant/identity') return { ok: true, data: identity };
    assert.equal(path, '/merchant/products/publish');
    publishCount += 1;
    calls.push({ method, payload, options });
    if (failPublish) throw new Error('response lost');
    return { ok: true, data: { product_id: 'SKU_OK', post_id: 'post-1' } };
  },
};
vm.createContext(context);
function load(file) {
  vm.runInContext(fs.readFileSync(file, 'utf8').replace(/^import .*;$/gm, '').replace(/export /g, ''), context, { filename: file });
}
function newPage() {
  load('pages/goods/publish.js');
  page.setData = function (patch) { Object.assign(this.data, patch); };
  page._account = `${account}:merchant-publish`;
  return page;
}
(async () => {
  load('utils/merchant.js');
  const form = { name: '猫粮', content: '商品介绍', price: '0.00', images: [{ path: '/tmp/one.jpg' }], merchantId: 7 };
  assert.equal(context.validateGoodsForm(form), '');
  for (const price of ['-1', '1.234', '100000000', 'NaN', '']) assert.ok(context.validateGoodsForm({ ...form, price }));
  assert.equal(context.validateGoodsForm({ ...form, price: '99999999.99' }), '');
  assert.ok(context.validateGoodsForm({ ...form, images: [] }));
  assert.ok(context.validateGoodsForm({ ...form, merchantId: 0 }));
  let p = newPage();
  await p.checkIdentity();
  assert.equal(p.data.isMerchant, true); assert.equal(p.data.merchantId, 7);
  p.updateForm(form);
  assert.equal(p.data.canPublish, true);
  p.input({ currentTarget: { dataset: { key: 'price' } }, detail: { value: '1.234' } });
  assert.equal(p.data.canPublish, false);
  p.input({ currentTarget: { dataset: { key: 'price' } }, detail: { value: '0.00' } });
  assert.equal(p.data.canPublish, true);
  p.removeImage({ currentTarget: { dataset: { index: 0 } } });
  assert.equal(p.data.canPublish, false);
  p.updateForm(form);
  await p.publish();
  assert.equal(uploadCount, 1); assert.equal(publishCount, 1); assert.equal(p.data.saving, false);
  const firstKey = calls[0].options.headers['Idempotency-Key'];
  assert.ok(firstKey); assert.equal(calls[0].payload.product_price, '0.00');
  assert.deepEqual(Object.keys(calls[0].payload).sort(), ['image_ids', 'merchant_id', 'product_content', 'product_name', 'product_price']);
  assert.equal(storage.get('a:merchant-publish').key, firstKey);
  // Reopening after an uncertain response must reuse uploaded images and the request key.
  p = newPage(); p._account = null; p.onShow(); await p.checkIdentity();
  failPublish = false;
  await p.publish();
  assert.equal(uploadCount, 1); assert.equal(publishCount, 2);
  assert.equal(calls[1].options.headers['Idempotency-Key'], firstKey);
  assert.equal(p.data.publishedId, 'SKU_OK'); assert.equal(storage.has('a:merchant-publish'), false);
  await p.publish(); assert.equal(publishCount, 2);
  p = newPage(); identity = { is_merchant: true, merchants: [{ id: 7 }, { id: 8 }] };
  await p.checkIdentity(); assert.equal(p.data.merchantId, 0);
  p.selectMerchant({ detail: { value: '1' } }); assert.equal(p.data.merchantId, 8);
  p.setData({ ...form, merchantId: 8 });
  identity = { is_merchant: false, merchants: [] };
  await p.publish(); assert.equal(p.data.isMerchant, false); assert.equal(publishCount, 2);
  account = 'b'; p.onShow(); await p.checkIdentity();
  assert.equal(p.data.name, ''); assert.equal(p.data.images.length, 0);
  storage.delete('miniprogram_token');
  assert.equal((await context.getMerchantIdentity()).is_merchant, false);
  await assert.rejects(context.uploadMerchantImage('/tmp/test'), /登录/);
  context.categories = [];
  load('pages/release/index.js');
  let petsLoaded = false;
  page.loadPets = () => { petsLoaded = true; };
  page.onShow();
  assert.equal(petsLoaded, true);
  assert.equal(page.loadMerchantIdentity, undefined);
  assert.equal(page.openGoodsPublish, undefined);
  console.log('PASS moment publication remains independent of merchant identity and goods publication');
  console.log('PASS merchant identity, multi-merchant selection, price bounds, authenticated upload, publish payload, retry after reopen, duplicate guard, revocation and account isolation');
})().catch((error) => { console.error(error); process.exitCode = 1; });
