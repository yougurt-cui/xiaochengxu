const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const source = (file) => fs.readFileSync(file, 'utf8').replace(/^import .*;$/gm, '').replace(/export /g, '');
const tick = () => new Promise(setImmediate);

(async () => {
  let token = 'account-a', exists = true;
  const requests = [];
  const apiContext = { config: { apiBaseUrl: 'https://example.test' }, wx: {
    getStorageSync: () => token,
    getFileSystemManager: () => ({ accessSync() { if (!exists) throw Error('reclaimed'); } }),
    downloadFile: (options) => requests.push(options),
  } };
  vm.createContext(apiContext);
  vm.runInContext(source('api/miniprogram.js'), apiContext);
  const download = apiContext.downloadPetImage;
  const url = '/api/miniprogram/pet-images/photo';
  const first = download(url), duplicate = download(url);
  assert.equal(first, duplicate);
  assert.equal(requests.length, 1);
  requests[0].success({ statusCode: 200, tempFilePath: '/tmp/a' });
  assert.equal(await first, '/tmp/a');
  assert.equal(await download(url), '/tmp/a');
  assert.equal(requests.length, 1);
  exists = false;
  const reclaimed = download(url);
  assert.equal(requests.length, 2);
  requests[1].success({ statusCode: 200, tempFilePath: '/tmp/b' });
  await reclaimed;
  exists = true;
  token = 'account-b';
  const switched = download(url);
  assert.equal(requests.length, 3);
  token = 'account-c';
  requests[2].success({ statusCode: 200, tempFilePath: '/tmp/private-b' });
  await assert.rejects(switched);
  const retry = download(url);
  requests[3].fail();
  await assert.rejects(retry);
  const retryAgain = download(url);
  requests[4].success({ statusCode: 200, tempFilePath: '/tmp/c' });
  await retryAgain;
  token = '';
  await assert.rejects(download(url));

  let definition, callback, disconnected = 0;
  const pending = [];
  vm.runInNewContext(source('components/p-image/index.js'), {
    Component: (value) => { definition = value; },
    isPrivatePetImage: (value) => value.startsWith('private'),
    downloadPetImage: (value) => new Promise((resolve) => pending.push({ value, resolve })),
  });
  const image = { ...definition.methods, properties: { src: 'private-a', lazyLoad: true }, data: {},
    setData(value) { Object.assign(this.data, value); }, triggerEvent() {},
    createIntersectionObserver() { return {
      relativeToViewport() { return this; }, observe(selector, fn) { callback = fn; },
      disconnect() { disconnected++; },
    }; },
  };
  definition.properties.src.observer.call(image);
  definition.lifetimes.attached.call(image);
  definition.lifetimes.ready.call(image);
  assert.equal(pending.length, 0, 'offscreen images must not download');
  callback({ intersectionRatio: 0 });
  assert.equal(pending.length, 0);
  callback({ intersectionRatio: 1 });
  assert.equal(pending.length, 1);
  image.properties.src = 'private-b'; image.resolveSource();
  pending[0].resolve('/tmp/old'); await tick();
  assert.equal(image.data.displaySrc, '', 'stale completion must not replace the current image');
  callback({ intersectionRatio: 1 });
  pending[1].resolve('/tmp/new'); await tick();
  assert.equal(image.data.displaySrc, '/tmp/new');
  image.properties.src = 'private-c'; image.properties.lazyLoad = false; image.resolveSource();
  assert.equal(pending.length, 3, 'eager images bypass visibility gating');
  definition.lifetimes.detached.call(image);
  pending[2].resolve('/tmp/detached'); await tick();
  assert.notEqual(image.data.displaySrc, '/tmp/detached');
  assert.ok(disconnected > 0);

  vm.runInNewContext(source('components/post-feed/index.js'), {
    Component: (value) => { definition = value; }, wx: { getWindowInfo: () => ({ windowWidth: 400 }) },
  });
  let updates = 0;
  const feed = { ...definition.methods, properties: { posts: Array.from({ length: 20 }, (_, i) => ({ id: i, image: `img-${i}`, title: 'post' })) }, data: {},
    setData(value) { updates++; Object.assign(this.data, value); },
  };
  feed.arrange();
  const before = feed.data.columns.map((column) => column.map((post) => post.id).join(','));
  for (let i = 0; i < 20; i++) feed.imageLoaded({ detail: { width: 100, height: 100 + i * 50 }, currentTarget: { dataset: { src: `img-${i}` } } });
  assert.equal(updates, 1, 'image load events must not resubmit the full list');
  feed.arrange();
  assert.deepEqual(feed.data.columns.map((column) => column.map((post) => post.id).join(',')), before);

  const timers = new Map(); let next = 0, filtered = 0;
  vm.runInNewContext(source('pages/home/index.js'), {
    Page: (value) => { definition = value; }, categories: [],
    setTimeout(fn) { timers.set(++next, fn); return next; }, clearTimeout(id) { timers.delete(id); },
  });
  const page = { ...definition, data: { homeTab: 'community', query: '' },
    setData(value) { Object.assign(this.data, value); }, filterPosts() { filtered++; },
  };
  for (const value of ['猫', '猫粮', '猫粮推荐']) page.onSearch({ detail: { value } });
  assert.equal(filtered, 0); assert.equal(timers.size, 1);
  for (const fn of timers.values()) fn(); timers.clear();
  assert.equal(filtered, 1);
  page.onSearch({ detail: { value: '' } }); assert.equal(filtered, 2);
  page.onSearch({ detail: { value: '猫' } }); page.onUnload(); assert.equal(timers.size, 0);
  console.log('PASS: private image dedup/cache/account isolation/retry, visibility gating/stale callbacks, stable feed columns and search debounce');
})().catch((error) => { console.error(error); process.exitCode = 1; });
