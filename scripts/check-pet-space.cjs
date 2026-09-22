const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const path = require('path');
let definition;
let recognition = { image: { id: 'photo-1' }, recognition_status: 'success', suggestions: {
  animal_type: { value: 'dog' }, breed: { value: '柴犬' }, age: { estimated_years: 2 }, weight: { estimated_kg: 4.5 }
} };
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
  recognizePetImage: async () => { if (recognition instanceof Error) throw recognition; return recognition; },
  setTimeout: (fn) => {

    return 1;
  },
  clearTimeout: () => {},
  api: async (url, method, data) => {
    requests++;
    calls.push({ url, method, data });
    return method === 'POST' ? { item: { id: 'cat-1', ...data } } : { items: [] };
  },
  wx: {
    chooseMedia: (o) => { o.success({ tempFiles: [{ tempFilePath: '/tmp/photo.jpg', size: 100 }] }); o.complete(); },
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
  assert.equal(page.data.recognizing, false);
  assert.equal(requests, 0);

  assert.equal(page.data.form.breed, '柴犬');
  assert.equal(page.data.form.animal_type, 'dog');
  assert.equal(page.data.form.name, '');
  assert.equal(page.data.form.avatar_image_id, 'photo-1');
  assert.match(page.data.recognitionNote, /估算/);
  page.input({ currentTarget: { dataset: { key: 'name' } }, detail: { value: '豆豆' } });
  assert.equal(requests, 0);
  page.input({ currentTarget: { dataset: { key: 'breed' } }, detail: { value: '中华田园猫' } });
  page.input({ currentTarget: { dataset: { key: 'weight' } }, detail: { value: '99' } });
  await page.save();
  assert.equal(requests, 0);
  page.input({ currentTarget: { dataset: { key: 'weight' } }, detail: { value: '3.8' } });
  await page.save();
  const post = calls.find((c) => c.method === 'POST');
  assert.equal(post.data.breed, '中华田园猫');
  assert.equal(post.data.avatar_image_id, 'photo-1');
  assert.equal(post.data.animal_type, 'dog');
  assert.equal(post.data.weight_kg, 3.8);
  assert.equal(post.data.age_months, 24);
  assert.equal(saved.pet.id, 'cat-1');
  page.data.form.age = '';
  page.data.form.weight = '';
  recognition = { image: { id: 'photo-2' }, recognition_status: 'success', suggestions: { age: { estimated_years: null }, weight: { estimated_kg: null } } };
  page.recognize();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(page.data.form.age, '');
  assert.equal(page.data.form.weight, '');
  page.data.form.age = '5'; page.data.form.weight = '6';
  recognition.suggestions = { age: { estimated_years: 2 }, weight: { estimated_kg: 3 } };
  page.recognize();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(page.data.form.age, '5'); assert.equal(page.data.form.weight, '6');
  recognition = { image: { id: 'photo-3' }, recognition_status: 'failed', suggestions: {} };
  page.recognize();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(page.data.form.avatar_image_id, 'photo-3');
  assert.match(page.data.recognitionNote, /手动填写/);
  recognition = new Error('network failed');
  page.recognize();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(page.data.recognizing, false);
  assert.equal(page.data.form.avatar_image_id, 'photo-3');
  assert.match(page.data.recognitionNote, /network failed/);
  console.log('PASS: recognition suggestions, nullable estimates, entered measurements, upload failure, editable save and avatar binding');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
