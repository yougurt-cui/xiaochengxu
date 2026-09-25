const fs = require('fs'),
  vm = require('vm'),
  assert = require('node:assert/strict');
let definition,
  calls = [],
  store = { supplies: { toys: [{ id: 'toy' }] } },
  nav;
let response = {
  items: [
    { id: 'a', name: '阿哥', diet: { brand: '皇家', product: '肠胃舒适' } },
    { id: 'b', name: '布丁' },
  ],
};
const context = {
  Page: (p) => (definition = p),
  api: async (...args) => {
    calls.push(args);
    return response;
  },
  requireSession: () => true,
  login: async () => {},
  accountKey: () => 'u1',
  hasSession: () => true,
  mapPet: (p) => p,
  mediaUrl: (p) => p,
  errorText: (e) => e.message,
  loadStore: () => store,
  currentPet: () => ({ id: 'b' }),
  cachePetList: (p) => {
    store.pets = p;
  },
  saveStore: () => {},
  clearTimeout: () => {},
  wx: { navigateTo: (o) => (nav = o), showToast: () => {} },
};
vm.runInNewContext(fs.readFileSync('pages/pet-space/supplies.js', 'utf8').replace(/^import .*;\n/gm, ''), context);
const page = {
  ...definition,
  _visible: true,
  data: JSON.parse(JSON.stringify(definition.data)),
  setData(p) {
    for (const [k, v] of Object.entries(p)) {
      const parts = k.split('.');
      if (parts.length === 2) this.data[parts[0]][parts[1]] = v;
      else this.data[k] = v;
    }
  },
};
(async () => {
  page.data.kind = 'food';
  await page.refreshMine();
  assert.equal(calls[0][0], '/cat-profiles?limit=100');
  assert.equal(page.data.mine.length, 1);
  assert.equal(page.data.mine[0].name, '皇家 · 肠胃舒适');
  page.editMine({ currentTarget: { dataset: {} } });
  assert.equal(page.data.dietPetId, 'b');
  page.inputDiet({ currentTarget: { dataset: { key: 'brand' } }, detail: { value: '新品牌' } });
  page.inputDiet({ currentTarget: { dataset: { key: 'product' } }, detail: { value: '新系列' } });
  await page.saveDiet();
  const write = calls.find((c) => c[1]);
  assert.equal(write[0], '/cat-profiles/b');
  assert.equal(write[1], 'PATCH');
  assert.deepEqual(JSON.parse(JSON.stringify(write[2])), { diet: { brand: '新品牌', product: '新系列' } });
  assert(!calls.some((c) => c[0].includes('food-submissions')));
  page.openHunting();
  assert.equal(nav.url, '/pages/pet-space/hunting');
  response = { items: [] };
  await page.refreshMine();
  assert.equal(page.data.mine.length, 0);
  assert.equal(page.data.hasPet, false);
  page.editMine({ currentTarget: { dataset: {} } });
  assert.match(nav.url, /mode=create/);
  page.data.kind = 'toys';
  await page.refreshMine();
  assert.equal(page.data.mine[0].id, 'toy');
  console.log('PASS: profile diet source, selected-pet PATCH only, empty state, hunting routing and toy isolation');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
