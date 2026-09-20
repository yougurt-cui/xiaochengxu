// Offline contract checks: no remote mutation and no actual WeChat sign-in.
const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const path = require('path');
const storage = new Map();
let reply = { statusCode: 200, data: { ok: true } };
let last;
const wx = {
  getStorageSync: (k) => storage.get(k),
  setStorageSync: (k, v) => storage.set(k, v),
  removeStorageSync: (k) => storage.delete(k),
  request: (options) => {
    last = options;
    queueMicrotask(() => options.success(reply));
    return { abort() {} };
  },
  login: ({ success }) => success({ code: 'test-code' }),
};
const cache = new Map();
function load(file) {
  const full = path.resolve(__dirname, '..', file);
  if (cache.has(full)) return cache.get(full);
  let code = fs.readFileSync(full, 'utf8');
  const names = [];
  code = code
    .replace(/import\s+(.+?)\s+from\s+['"](.+?)['"];?/g, (_, what, target) => {
      const rel = path.relative(
        path.resolve(__dirname, '..'),
        path.resolve(path.dirname(full), target + (path.extname(target) ? '' : '.js')),
      );
      return `const ${what.startsWith('{') ? what : `{default: ${what}}`} = load(${JSON.stringify(rel)});`;
    })
    .replace(/export default /g, 'exports.default = ')
    .replace(/export (async )?(function|const) (\w+)/g, (_, async, type, name) => {
      names.push(name);
      return `${async || ''}${type} ${name}`;
    });
  const exports = {};
  vm.runInNewContext(
    `${code}\nObject.assign(exports, {${names.join(',')}});`,
    { wx, load, exports, console, setTimeout, Date },
    { filename: file },
  );
  cache.set(full, exports);
  return exports;
}
(async () => {
  const api = load('api/miniprogram.js');
  const store = load('utils/pet-store.js');
  const community = load('utils/community.js');
  storage.set('access_token', 'legacy-mock');
  await api.api('/moments');
  assert.equal(last.header.Authorization, 'Bearer ');
  assert.match(last.url, /^https:\/\/chongxi.cloud/);
  reply = { statusCode: 200, data: { ok: true, token: 'real-token', user: { id: 'user-a', name: '家长' } } };
  await api.login();
  assert.equal(storage.get('miniprogram_token'), 'real-token');
  assert.equal(last.data.code, 'test-code');
  store.saveStore({ favorites: ['p1'], records: [{ day: '2026-09-19', water: 10 }] });
  storage.set('miniprogram_user', { id: 'user-b' });
  assert.equal(store.loadStore().favorites.length, 0);
  storage.set('miniprogram_user', { id: 'user-a' });
  assert.equal(store.loadStore().favorites[0], 'p1');
  const post = {
    id: 'p1',
    category_code: 'CHIN',
    category_name: '黑下巴',
    images: [{ url: '/api/miniprogram/moment-images/image' }],
    author: { name: '家长' },
    title: '记录',
    content: '变化',
    status: 'active',
    updated_at: '2026-09-19 01:00:00',
  };
  reply = { statusCode: 200, data: { ok: true, items: [post] } };
  await community.fetchPosts();
  assert.equal(community.getPosts()[0].saved, true);
  assert.equal(community.getPosts()[0].status, 'published');
  assert.match(community.getPosts()[0].image, /^https:\/\/chongxi.cloud/);
  assert.equal(community.mapPost(post).editedAt, '2026-09-19T01:00:00Z');
  assert.equal(store.formatEdited('2026-09-18T01:00:00Z', Date.parse('2026-09-19T02:00:00Z')), '1天前');
  await community.fetchPosts(true);
  assert.match(last.url, /include_private=true/);
  assert.equal(store.loadStore().posts.length, 1);
  reply = { statusCode: 401, data: { ok: false, error: '请重新登录' } };
  await assert.rejects(api.api('/cat-profiles'), /请重新登录/);
  assert.equal(api.hasSession(), false);
  reply = { statusCode: 503, data: { ok: false, error: '服务不可用' } };
  await assert.rejects(api.api('/moments'), /服务不可用/);
  const pet = api.mapPet({ id: 'cat', name: '小满', age_months: 24, weight_kg: 4.6 });
  assert.equal(pet.age, 2);
  assert.equal(pet.weight, 4.6);
  console.log(
    'PASS: real auth headers, login, 401 expiry, server errors, account isolation, post mapping, UTC edit time, favorites, own-post query, cat schema',
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
