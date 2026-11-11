const fs = require('fs'),
  vm = require('vm'),
  assert = require('node:assert/strict');
let definition,
  calls = [],
  store = { selectedPetId: 'a', supplies: { toys: [{ id: 'toy' }] } },
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
  rememberDiet: () => {},
  requireSession: () => true,
  login: async () => {},
  accountKey: () => 'u1',
  hasSession: () => true,
  mapPet: (p) => p,
  mediaUrl: (p) => p,
  errorText: (e) => e.message,
  loadStore: () => store,
  currentPet: () => (store.pets || []).find(p => p.id === store.selectedPetId),
  cachePetList: (p) => {
    store.pets = p;
  },
  saveStore: patch => Object.assign(store, patch),
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
  assert.equal(context.mapFoodItem({ product_id: 143, formula_id: 289 }).formula_id, 289);
  page.data.kind = 'food';
  await page.refreshMine();
  assert.equal(calls[0][0], '/cat-profiles?limit=100');
  assert.equal(page.data.mine.length, 1);
  assert.equal(page.data.mine[0].name, '皇家 · 肠胃舒适');
  await page.selectListPet({ currentTarget: { dataset: { id: 'b' } } });
  assert.equal(page.data.mine.length, 0);
  assert.equal(store.selectedPetId, 'b');
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
  calls = [];
  page.data.editing = true;
  page.data.selected = { id: 'formula:289', brand: '皇家', name: 'EP42', product_id: 143, formula_id: 289 };
  page.addToMine();
  assert.equal(page.data.dietForm.formula_id, 289);
  await page.saveDiet();
  assert.equal(calls.find(c => c[1] === 'PATCH')[2].diet.formula_id, 289);
  page.inputDiet({ currentTarget: { dataset: { key: 'product' } }, detail: { value: 'F32' } });
  assert.equal(page.data.dietForm.formula_id, null);
  response = { suggestions: [{ brand: '皇家', product_name: 'F32', product_id: 188, formula_id: 342 }] };
  page.data.editing = true;
  await page.searchDiet();
  assert.equal(page.data.dietChoices.length, 1);
  page.selectDietFood({ currentTarget: { dataset: { id: '342' } } });
  assert.equal(page.data.dietForm.formula_id, 342);
  calls = [];
  await page.saveDiet();
  assert.equal(calls.find(c => c[1] === 'PATCH')[2].diet.formula_id, 342);
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
