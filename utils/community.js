import { loadStore, saveStore, formatEdited } from './pet-store';
import { api, mediaUrl } from '../api/miniprogram';
export const categories = [
  { id: 'all', label: '全部' },
  { id: 'CHIN', label: '黑下巴' },
  { id: 'VOMIT', label: '呕吐' },
  { id: 'STOOL', label: '便便' },
  { id: 'SLEEP', label: '睡姿' },
  { id: 'FUNNY', label: '日常' },
];
export function mapPost(p) {
  return {
    id: p.id,
    userId: p.user_id,
    category: p.category_code,
    tag: p.category_name,
    image: mediaUrl(p.images && p.images[0] && (p.images[0].url || p.images[0])),
    images: (p.images || []).map((i) => mediaUrl(i.url || i)),
    title: p.title,
    author: (p.author && p.author.name) || '宠物家长',
    body: p.content,
    editedAt:
      String(p.updated_at || p.created_at).replace(' ', 'T') +
      (/Z|\+\d\d:\d\d$/.test(p.updated_at || p.created_at) ? '' : 'Z'),
    status: p.status === 'active' ? 'published' : 'pending',
  };
}
export async function fetchPosts(mine = false) {
  const res = await api(`/moments?limit=100${mine ? '&include_private=true' : ''}`);
  const posts = res.items.map(mapPost);
  const s = loadStore();
  if (mine) {
    const byId = new Map((s.postCache || []).map((p) => [p.id, p]));
    posts.forEach((p) => byId.set(p.id, p));
    saveStore({
      posts: [...s.posts.filter((p) => p.status === 'draft'), ...posts],
      postCache: Array.from(byId.values()),
    });
    return posts;
  }
  const incoming = new Set(posts.map((p) => p.id));
  const favoritesOnly = (s.postCache || []).filter((p) => s.favorites.includes(p.id) && !incoming.has(p.id));
  saveStore({
    // Keep feed order aligned with the API response; append favorite-only snapshots after.
    postCache: [...posts, ...favoritesOnly],
    feedIds: posts.map((p) => p.id),
  });
  return posts;
}
export function getPosts() {
  const s = loadStore();
  return (s.postCache || []).map((p) => ({
    ...p,
    saved: s.favorites.includes(p.id),
    editedText: formatEdited(p.editedAt),
  }));
}
export function getFeedPosts() {
  const s = loadStore();
  const byId = new Map(getPosts().map((p) => [p.id, p]));
  return (s.feedIds || []).map((id) => byId.get(id)).filter(Boolean);
}
