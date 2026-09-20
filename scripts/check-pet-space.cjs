const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const path = require('path');
let timer, definition;
const calls = [];
let saved,
  requests = 0;
const context = {
  Page: (p) => {
    definition = p;
  },
  loadStore: () => ({ pet: null }),
  saveStore: (p) => {
    saved = p;
  },
  hasSession: () => false,
  login: async () => ({ id: 'test' }),
  mapPet: (p) => p,
  errorText: (e) => e.message,
  persistImage: async () => '/local/photo.jpg',
  setTimeout: (fn) => {
    timer = fn;
    return 1;
  },
  clearTimeout: () => {},
  api: async (url, method, data) => {
    requests++;
    calls.push({ url, method, data });
    return method === 'POST' ? { item: { id: 'cat-1', ...data } } : { items: [] };
  },
  wx: {
    chooseMedia: (o) => o.success({ tempFiles: [{ tempFilePath: '/tmp/photo.jpg' }] }),
    showToast: () => {},
    navigateBack: () => {},
    showModal: () => {},
  },
};
const source = fs
  .readFileSync(path.join(__dirname, '../pages/pet-space/pet-edit.js'), 'utf8')
  .replace(/^import .*;\n/gm, '');
vm.runInNewContext(source, context);
const page = {
  ...definition,
  data: JSON.parse(JSON.stringify(definition.data)),
  setData(patch) {
    for (const [k, v] of Object.entries(patch)) {
      const parts = k.split('.');
      if (parts.length === 2) this.data[parts[0]][parts[1]] = v;
      else this.data[k] = v;
    }
  },
};
(async () => {
  page.onLoad();
  page.recognize();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(page.data.recognizing, true);
  assert.equal(requests, 0);
  timer();
  assert.equal(page.data.form.breed, '英国短毛猫');
  assert.equal(page.data.mockResult, true);
  assert.equal(requests, 0);
  page.input({ currentTarget: { dataset: { key: 'breed' } }, detail: { value: '中华田园猫' } });
  page.input({ currentTarget: { dataset: { key: 'weight' } }, detail: { value: '99' } });
  await page.save();
  assert.equal(requests, 0);
  page.input({ currentTarget: { dataset: { key: 'weight' } }, detail: { value: '3.8' } });
  await page.save();
  const post = calls.find((c) => c.method === 'POST');
  assert.equal(post.data.breed, '中华田园猫');
  assert.equal(post.data.weight_kg, 3.8);
  assert.equal(post.data.age_months, 24);
  assert.equal(saved.pet.id, 'cat-1');
  console.log(
    'PASS: photo mock stays local, fills editable fields, validates bounds, saves breed and normalized age/weight',
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
