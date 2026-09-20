import config from '../config';
const origin = config.apiBaseUrl.replace(/\/$/, '');
export const mediaUrl = (url) => (url && url.startsWith('/') ? origin + url : url || '');
export const hasSession = () => Boolean(wx.getStorageSync('miniprogram_token'));
export const errorText = (error) => error.message || '连接失败，请检查网络后重试';
export function api(path, method = 'GET', data = {}) {
  return new Promise((resolve, reject) =>
    wx.request({
      url: `${origin}/api/miniprogram${path}`,
      method,
      data,
      timeout: 30000,
      header: {
        'content-type': 'application/json',
        Authorization: `Bearer ${wx.getStorageSync('miniprogram_token') || ''}`,
      },
      success(res) {
        if (res.statusCode === 401) wx.removeStorageSync('miniprogram_token');
        const body = res.data && typeof res.data === 'object' ? res.data : {};
        if (res.statusCode >= 200 && res.statusCode < 300 && body.ok === true) resolve(body);
        else reject(new Error(body.error || body.message || '服务暂时不可用，请重试'));
      },
      fail: () => reject(new Error('连接失败，请检查网络后重试')),
    }),
  );
}
let signingIn;
export async function login(profile = null) {
  if (!profile && hasSession()) return wx.getStorageSync('miniprogram_user');
  if (!profile && signingIn) return signingIn;
  const work = (async () => {
    const code = await new Promise((resolve, reject) =>
      wx.login({
        success: (res) => (res.code ? resolve(res.code) : reject(new Error('微信登录失败'))),
        fail: () => reject(new Error('微信登录失败，请重试')),
      }),
    );
    const result = await api('/auth/wechat-login', 'POST', { code, ...(profile || {}) });
    wx.setStorageSync('miniprogram_token', result.token);
    wx.setStorageSync('miniprogram_user', result.user);
    return result.user;
  })();
  if (!profile) signingIn = work;
  try {
    return await work;
  } finally {
    if (!profile) signingIn = null;
  }
}
export async function uploadImage(path) {
  await login();
  return new Promise((resolve, reject) =>
    wx.uploadFile({
      url: `${origin}/api/miniprogram/moment-images`,
      filePath: path,
      name: 'image',
      header: { Authorization: `Bearer ${wx.getStorageSync('miniprogram_token')}` },
      success(res) {
        try {
          const data = JSON.parse(res.data);
          if (res.statusCode === 401) wx.removeStorageSync('miniprogram_token');
          if (res.statusCode >= 200 && res.statusCode < 300 && data.ok) resolve(mediaUrl(data.item.url));
          else reject(new Error(data.error || '图片上传失败'));
        } catch (e) {
          reject(new Error('图片上传失败'));
        }
      },
      fail: () => reject(new Error('图片上传失败，请重试')),
    }),
  );
}
export function mapPet(p) {
  return {
    ...p,
    type: '猫咪',
    age: p.age_months == null ? p.age_text : Math.round((p.age_months / 12) * 10) / 10,
    weight: p.weight_kg || '',
    image: mediaUrl(p.avatar_url),
  };
}
