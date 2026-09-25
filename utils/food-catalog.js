import { api, mediaUrl } from '../api/miniprogram';
import { loadStore } from './pet-store';

export function mapCatalogFood(p) {
  return {
    id: p.catalog_key || p.id,
    name: p.product_name || p.name || '',
    brand: p.brand || '',
    displayText: p.display_text || p.displayText || '',
    image: mediaUrl(p.main_image_url || p.image_url || p.cover_url || p.image || ''),
  };
}

// The existing API requires a brand. Keep the legacy initial selection, and
// search a supplied brand plus series within known pet-diet brands.
export async function fetchFoodCatalog(query = '', limit = 100) {
  const term = query.trim();
  const request = (brand, q = '') =>
    api(`/products?brand=${encodeURIComponent(brand)}&q=${encodeURIComponent(q)}&limit=${limit}`);
  if (!term) return request('皇家');
  const store = loadStore();
  const brands = [
    ...new Set(['皇家', ...(store.pets || []).map((p) => p.food_brand || p.diet?.brand || '')].filter(Boolean)),
  ];
  const results = await Promise.allSettled([request(term), ...brands.map((brand) => request(brand, term))]);
  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  if (!fulfilled.length) throw results[0].reason;
  const items = [],
    seen = new Set();
  for (const result of fulfilled)
    for (const item of result.value.items || []) {
      const key = item.catalog_key || item.id || `${item.brand}:${item.product_name}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push(item);
      }
    }
  return { items: items.slice(0, limit), partial: fulfilled.length !== results.length };
}
