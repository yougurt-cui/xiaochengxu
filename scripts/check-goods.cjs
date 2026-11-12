// Offline behavioural checks. Fixtures never create public products or posts.
const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
let account = 'guest';
const stores = new Map();
const drafts = new Map();
let response, lastPath, navigation, page;
const wx = {
  setStorageSync: (key, value) => drafts.set(key, value),
  removeStorageSync: (key) => drafts.delete(key),
  switchTab: (options) => { navigation = options; },
  showToast() {},
};
const context = {
  wx, console, setTimeout, clearTimeout, categories: [],
  loadStore: () => stores.get(account) || {},
  saveStore: (patch) => stores.set(account, { ...(stores.get(account) || {}), ...patch }),
  accountKey: (key) => `${account}:${key}`,
  mediaUrl: (url) => url.startsWith('/') ? `https://chongxi.cloud${url}` : url,
  api: async (path) => { lastPath = path; if (response instanceof Error) throw response; return response; },
  errorText: (error) => error.message,
  Page: (value) => { page = value; },
};
vm.createContext(context);
function run(file) {
  vm.runInContext(fs.readFileSync(file, 'utf8').replace(/^import .*;$/gm, '').replace(/export /g, ''), context, { filename: file });
}
function bindPage() {
  page.setData = function (patch, callback) {
    Object.entries(patch).forEach(([key, value]) => {
      const parts = key.split('.'); let target = this.data;
      while (parts.length > 1) target = target[parts.shift()];
      target[parts[0]] = value;
    });
    if (callback) callback();
  };
}
const product = { product_id: 'SKU_TEST', product_name: '测试猫粮', product_price: '0.00', images: [{ url: '/api/miniprogram/moment-images/example' }], product_content: '商品说明' };
(async () => {
  run('utils/goods.js');
  let mapped = context.mapGoods(product);
  assert.equal(mapped.price, '0');
  assert.equal(mapped.image, 'https://chongxi.cloud/api/miniprogram/moment-images/example');
  assert.equal(context.mapGoods({ ...product, product_price: '39.90' }).price, '39.9');
  assert.equal(context.mapGoods({ ...product, product_price: null }).price, '');
  assert.equal(context.mapGoods({ ...product, product_price: '<invalid>' }).price, '');
  response = { data: product };
  await context.getGoods('SKU/A');
  assert.equal(lastPath, '/merchant/products/SKU%2FA');
  response = { items: [{ products: [product] }, { products: [product, { ...product, product_id: 'SKU_SECOND' }] }, {}] };
  const items = await context.listCommunityGoods('latest');
  assert.equal(items.length, 2); assert.match(lastPath, /limit=100&sort=latest/);
  assert.equal(context.toggleGoodsFavorite('SKU_TEST'), true);
  assert.equal(context.mapGoods(product).saved, true);
  account = 'second'; assert.equal(context.mapGoods(product).saved, false);
  account = 'guest'; assert.equal(context.toggleGoodsFavorite('SKU_TEST'), false);
  context.askAboutGoods(mapped);
  assert.equal(navigation.url, '/pages/assistant/index');
  assert.match(drafts.get('guest:pending-goods-question'), /测试猫粮/);
  navigation.fail(); assert.equal(drafts.has('guest:pending-goods-question'), false);
  run('pages/home/index.js'); bindPage();
  assert.equal(page.data.showNavSearch, false);
  page._headerTransitionUntil = 0;
  page._headerExpandThreshold = 400;
  page.onFeedScroll({ detail: { scrollTop: 600 } });
  assert.equal(page.data.headerCollapsed, true);
  page.onFeedScroll({ detail: { scrollTop: 300 } });
  assert.equal(page.data.headerCollapsed, true, 'layout clamping must not immediately expand the header');
  page._headerTransitionUntil = 0;
  page.onFeedScroll({ detail: { scrollTop: 700 } });
  page.onFeedScroll({ detail: { scrollTop: 500 } });
  assert.equal(page.data.headerCollapsed, true, 'remain collapsed beyond the first half screen');
  page.onFeedScroll({ detail: { scrollTop: 350 } });
  assert.equal(page.data.headerCollapsed, false);
  page._headerTransitionUntil = 0;
  page.onFeedScroll({ detail: { scrollTop: 500 } });
  page.expandHomeHeader();
  assert.equal(page.data.headerCollapsed, false, 'pulling down at the top restores the header');
  page.resetFeedScroll();
  page.onFeedScroll({ detail: { scrollTop: 100 } });
  assert.equal(page.data.showNavSearch, true);
  page.onFeedScroll({ detail: { scrollTop: 0 } });
  assert.equal(page.data.showNavSearch, false);
  page.onFeedScroll({ detail: { scrollTop: -10 } });
  assert.equal(page.data.showNavSearch, false);
  page.focusHomeSearch();
  assert.equal(page.data.searchFocused, true);
  page.blurHomeSearch();
  assert.equal(page.data.searchFocused, false);
  page.onFeedScroll({ detail: { scrollTop: 120 } });
  page.resetFeedScroll();
  assert.equal(page.data.feedScrollTop, 0);
  assert.equal(page.data.showNavSearch, false);
  page.onFeedScroll({ detail: { scrollTop: 200 } });
  page._goodsLoaded = true;
  page.selectHomeTab({ currentTarget: { dataset: { tab: 'goods' } } });
  assert.equal(page.data.homeTab, 'goods');
  assert.equal(page.data.feedScrollTop, 0);
  assert.equal(page.data.showNavSearch, false);
  const homeConfig = JSON.parse(fs.readFileSync('pages/home/index.json', 'utf8'));
  assert.equal(homeConfig.disableScroll, true);
  assert.equal(homeConfig.enablePullDownRefresh, false);
  const homeTemplate = fs.readFileSync('pages/home/index.wxml', 'utf8');
  assert.match(homeTemplate, /<scroll-view[^>]*bindscroll="onFeedScroll"/);
  assert.match(homeTemplate, /refresher-triggered="{{feedRefreshing}}"/);
  assert.match(homeTemplate, /bindrefresherrefresh="onPullDownRefresh"/);
  page.data.goods = items;
  page.data.goodsQuery = '测试'; page.filterGoods(); assert.equal(page.data.goodsCount, 2);
  page.data.goodsQuery = '不存在'; page.filterGoods(); assert.equal(page.data.goodsCount, 0);
  page.clearHomeSearch = page.clearHomeSearch.bind(page);
  page.data.homeTab = 'goods'; page.clearHomeSearch(); assert.equal(page.data.goodsCount, 2);
  let firstResolve, secondResolve;
  context.listCommunityGoods = () => new Promise((resolve) => { if (!firstResolve) firstResolve = resolve; else secondResolve = resolve; });
  const first = page.loadGoods(); const second = page.loadGoods();
  secondResolve([{ id: 'new', name: '新商品', merchantType: '' }]); await second;
  firstResolve([{ id: 'old', name: '旧商品', merchantType: '' }]); await first;
  assert.equal(page.data.goods[0].id, 'new');
  context.listCommunityGoods = async () => { throw new Error('offline'); };
  await page.loadGoods(); assert.equal(page.data.goodsError, 'offline'); assert.equal(page.data.goodsLoading, false);
  page.data.homeTab = 'goods';
  page.data.goods = [{ id: 'kept', name: '保留商品', merchantType: '' }];
  await page.onPullDownRefresh();
  assert.equal(page.data.feedRefreshing, false); assert.equal(page.data.goods[0].id, 'kept');
  assert.equal(page.data.goodsError, ''); assert.equal(page._pullRefreshing, false);
  context.listCommunityGoods = async () => [];
  await page.onPullDownRefresh();
  assert.equal(page.data.feedRefreshing, false); assert.equal(page.data.goodsCount, 0);
  page.data.homeTab = 'community';
  page.loadFeed = async () => { throw new Error('unexpected'); };
  await assert.rejects(page.onPullDownRefresh(), /unexpected/);
  assert.equal(page.data.feedRefreshing, false); assert.equal(page._pullRefreshing, false);
  let finishRefresh;
  let refreshRequests = 0;
  page.loadFeed = () => {
    refreshRequests += 1;
    return new Promise((resolve) => { finishRefresh = resolve; });
  };
  const refreshing = page.onPullDownRefresh();
  assert.equal(page.data.feedRefreshing, true);
  await page.onPullDownRefresh();
  assert.equal(refreshRequests, 1);
  finishRefresh();
  await refreshing;
  assert.equal(page.data.feedRefreshing, false);
  console.log('PASS home internal scrolling, search visibility, tab reset and refresher completion/deduplication');
  run('pages/goods/detail.js'); bindPage(); page._id = 'SKU_TEST';
  response = { data: product }; await page.loadGoods(); assert.equal(page.data.goods.id, 'SKU_TEST');
  page.openContact(); assert.equal(page.data.showContact, true);
  response = Object.assign(new Error('已下架'), { statusCode: 404 }); await page.loadGoods();
  assert.equal(page.data.unavailable, true); assert.equal(page.data.goods, null); assert.equal(page.data.showContact, false);
  response = new Error('offline'); await page.loadGoods(); assert.equal(page.data.unavailable, false); assert.equal(page.data.loading, false);
  page._id = ''; await page.loadGoods(); assert.equal(page.data.unavailable, true);
  console.log('PASS goods: public contract, SKU encoding, price and images, deduplication, account-scoped favorites, assistant draft, search, stale-response protection, retry and 404 gating');
})().catch((error) => { console.error(error); process.exitCode = 1; });
