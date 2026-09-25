const fs = require('fs'),
  vm = require('vm'),
  assert = require('node:assert/strict');
let calls = [];
const ctx = {
  loadStore: () => ({ pets: [{ food_brand: '鲜朗' }] }),
  mediaUrl: (x) => x,
  api: async (path) => {
    calls.push(path);
    return { items: [{ catalog_key: 'one', brand: '皇家', product_name: 'BK34' }] };
  },
};
vm.createContext(ctx);
vm.runInContext(
  fs
    .readFileSync('utils/food-catalog.js', 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace(/export /g, '') + '\nthis.fetch=fetchFoodCatalog;',
  ctx,
);
(async () => {
  await ctx.fetch('', 4);
  assert.match(calls[0], /brand=.*limit=4$/);
  calls = [];
  const result = await ctx.fetch('BK34');
  assert.equal(calls.length, 3);
  assert(calls.some((p) => p.includes('brand=BK34')));
  assert(calls.some((p) => p.includes('q=BK34')));
  assert.equal(result.items.length, 1);
  ctx.api = async () => {
    throw Error('offline');
  };
  await assert.rejects(ctx.fetch('品牌'), /offline/);
  let definition;
  vm.runInNewContext(fs.readFileSync('pages/pet-space/hunting.js', 'utf8').replace(/^import .*;\n/gm, ''), {
    Page: (p) => (definition = p),
    fetchFoodCatalog: (q) => new Promise((resolve) => pending.push({ q, resolve })),
    mapCatalogFood: (x) => x,
    errorText: (e) => e.message,
  });
  const pending = [];
  const page = {
    ...definition,
    data: { ...definition.data },
    setData(p) {
      Object.assign(this.data, p);
    },
  };
  page.data.query = 'old';
  const old = page.search();
  page.data.query = 'new';
  const latest = page.search();
  pending[1].resolve({ items: [{ id: 'new' }] });
  await latest;
  pending[0].resolve({ items: [{ id: 'old' }] });
  await old;
  assert.equal(page.data.items[0].id, 'new');
  console.log('PASS: preview limit, brand/series compatibility, deduplication, failure and stale search responses');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
