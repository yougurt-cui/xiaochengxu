const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
let definition,
  nav,
  calls = [],
  timer;
let response = {
  items: [
    { id: 'a', claimed_brand: '品牌', claimed_product_name: '粮', status: 'active', recognition_status: 'processing' },
    { id: 'b', status: 'cancelled' },
  ],
};
const context = {
  Page: (p) => (definition = p),
  api: async (path) => {
    calls.push(path);
    return response;
  },
  login: async () => {},
  accountKey: () => 'account-a',
  hasSession: () => true,
  mapPet: (p) => p,
  mediaUrl: (p) => p,
  errorText: (e) => e.message,
  loadStore: () => ({ supplies: { toys: [{ id: 'toy', name: '球' }], food: [{ id: 'old-local' }] } }),
  saveStore: () => {
    throw new Error('Food list must not save locally');
  },
  submissionView: (p) => ({ ...p, title: `${p.claimed_brand} ${p.claimed_product_name}`, statusText: '识别中' }),
  setTimeout: (fn) => {
    timer = fn;
    return 1;
  },
  clearTimeout: () => {},
  wx: {
    getWindowInfo: () => ({ windowWidth: 375 }),
    navigateTo: (o) => {
      nav = o;
    },
  },
};
vm.runInNewContext(fs.readFileSync('pages/pet-space/supplies.js', 'utf8').replace(/^import .*;\n/gm, ''), context);
function make(kind) {
  return {
    ...definition,
    _visible: true,
    data: { ...definition.data, kind },
    setData(p) {
      Object.assign(this.data, p);
    },
  };
}
(async () => {
  const page = make('food');
  await page.refreshMine();
  assert.equal(calls[0], '/food-submissions?limit=2');
  assert.equal(page.data.mine.length, 1);
  assert.equal(page.data.mine[0].name, '品牌 粮');
  assert.equal(page.data.mine[0].note, '识别中');
  assert.equal(typeof timer, 'function');
  assert.equal(await page.measureFoodRow(), 2);
  context.wx.getWindowInfo = () => ({windowWidth: 768});
  assert.equal(await page.measureFoodRow(), 6);
  context.wx.getWindowInfo = () => ({windowWidth: 375});
  page.editMine({ currentTarget: { dataset: {} } });
  assert.match(nav.url, /create=1/);
  page.editMine({ currentTarget: { dataset: { id: 'a' } } });
  assert.match(nav.url, /id=a/);
  page.data.selected = { id: 'catalog', brand: 'B', name: 'P' };
  page.addToMine();
  assert.match(nav.url, /create=1/);
  const toys = make('toys');
  await toys.refreshMine();
  assert.equal(toys.data.mine[0].id, 'toy');
  response = { items: [] };
  await page.refreshMine();
  assert.equal(page.data.mine.length, 0);
  page.onHide();
  assert.equal(page._visible, false);
  console.log(
    'PASS: remote food list, cancelled filtering, create/detail routing, catalog submission, empty state and unchanged toy source',
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
