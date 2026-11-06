import { api, mediaUrl } from '../api/miniprogram';
import { accountKey, loadStore, saveStore } from './pet-store';

// Merchant products are distinct from the nutrition catalogue's /products.
export function mapGoods(item) {
  const images = (item.images || []).map((image) => mediaUrl(typeof image === 'string' ? image : image.url)).filter(Boolean);
  const price = String(item.product_price == null ? '' : item.product_price);
  return {
    id: item.product_id,
    postId: item.post_id || '',
    name: item.product_name || '商品',
    content: item.product_content || '',
    price: /^\d+(\.\d{1,2})?$/.test(price) ? price.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1') : '',
    images,
    image: images[0] || '',
    merchantType: item.merchant_type || '',
    shopLink: item.shop_link || '',
    jumpType: item.jump_type || '',
    createdAt: item.created_at || '',
    saved: (loadStore().goodsFavorites || []).includes(item.product_id),
  };
}
export async function getGoods(id) {
  const response = await api(`/merchant/products/${encodeURIComponent(id)}`);
  if (!response.data || !response.data.product_id) throw new Error('商品信息不完整，请重试');
  return mapGoods(response.data);
}
export function toggleGoodsFavorite(id) {
  const favorites = loadStore().goodsFavorites || [];
  const saved = !favorites.includes(id);
  saveStore({ goodsFavorites: saved ? [...favorites, id] : favorites.filter((value) => value !== id) });
  return saved;
}
export function askAboutGoods(goods) {
  const key = accountKey('pending-goods-question');
  const question = `我想了解「${goods.name}」${goods.price !== '' ? `，参考价格 ¥${goods.price}` : ''}。${goods.content ? `商品介绍：${goods.content.slice(0, 1200)}。` : ''}选购时需要注意什么，适合我的宠物吗？`;
  wx.setStorageSync(key, question);
  wx.switchTab({ url: '/pages/assistant/index', fail: () => {
    wx.removeStorageSync(key);
    wx.showToast({ title: '管家打开失败，请重试', icon: 'none' });
  } });
}

// The current backend exposes public goods through moment attachments, not /mine.
// This is a bounded feed, not a complete catalogue or paginated goods search.
export async function listCommunityGoods(sort = 'latest') {
  const response = await api(`/moments?limit=100&sort=${sort === 'popular' ? 'popular' : 'latest'}`);
  const seen = new Set();
  const items = [];
  (response.items || []).forEach((post) => {
    (post.products || []).forEach((product) => {
      if (!product.product_id || seen.has(product.product_id)) return;
      seen.add(product.product_id);
      items.push(mapGoods(product));
    });
  });
  return items;
}
