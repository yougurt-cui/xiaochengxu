// Features without backend endpoints remain local, isolated by signed-in account.
const KEY = 'pet_companion_v1';
export function loadStore() {
  const saved = wx.getStorageSync(`${KEY}:${(wx.getStorageSync('miniprogram_user') || {}).id || 'guest'}`) || {};
  return { pet: null, parent: null, favorites: [], posts: [], supplies: { toys: [], food: [] }, catalogFood: [], records: [], ...saved };
}
export function saveStore(patch) {
  const next = { ...loadStore(), ...patch };
  wx.setStorageSync(`${KEY}:${(wx.getStorageSync('miniprogram_user') || {}).id || 'guest'}`, next);
  return next;
}
export function dayKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(
    2,
    '0',
  )}`;
}
export function formatEdited(value, now = Date.now()) {
  const date = new Date(value);
  const age = Math.max(0, now - date.getTime());
  if (!Number.isFinite(date.getTime())) return '';
  if (age < 60000) return '刚刚';
  if (age < 3600000) return `${Math.floor(age / 60000)}分钟前`;
  if (age < 86400000) return `${Math.floor(age / 3600000)}小时前`;
  if (age < 172800000) return '1天前';
  return `${date.getFullYear() === new Date(now).getFullYear() ? '' : `${date.getFullYear()}年`}${
    date.getMonth() + 1
  }月${date.getDate()}日`;
}
export function persistImage(path) {
  return new Promise((resolve, reject) =>
    wx.saveFile({ tempFilePath: path, success: ({ savedFilePath }) => resolve(savedFilePath), fail: reject }),
  );
}

export function accountKey(key) {
  return `${key}:${(wx.getStorageSync('miniprogram_user') || {}).id || 'guest'}`;
}
