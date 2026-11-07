import config from '../config';
import { api, hasSession, mediaUrl } from '../api/miniprogram';

export async function getMerchantIdentity() {
  if (!hasSession()) return { is_merchant: false, merchants: [] };
  const response = await api('/merchant/identity');
  const identity = response.data || {};
  if (typeof identity.is_merchant !== 'boolean') throw new Error('身份信息暂未获取完整，请重试');
  return {
    is_merchant: identity.is_merchant === true,
    merchants: Array.isArray(identity.merchants) ? identity.merchants : [],
  };
}

export function uploadMerchantImage(filePath) {
  const token = wx.getStorageSync('miniprogram_token');
  if (!token) return Promise.reject(new Error('请先登录后发布商品'));
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${config.apiBaseUrl.replace(/\/$/, '')}/api/miniprogram/merchant/images/upload`,
      filePath,
      name: 'file',
      header: { Authorization: `Bearer ${token}` },
      success(res) {
        if (res.statusCode === 401 && wx.getStorageSync('miniprogram_token') === token) {
          wx.removeStorageSync('miniprogram_token');
        }
        try {
          const body = JSON.parse(res.data);
          if (res.statusCode >= 200 && res.statusCode < 300 && body.ok && body.data?.image_id && body.data?.url) {
            resolve({ id: body.data.image_id, url: mediaUrl(body.data.url) });
          } else {
            const error = new Error(body.message || '图片上传失败，请重试');
            error.statusCode = res.statusCode;
            reject(error);
          }
        } catch (_) {
          reject(new Error('图片上传失败，请重试'));
        }
      },
      fail: () => reject(new Error('图片上传失败，请检查网络后重试')),
    });
  });
}

export function validateGoodsForm({ name, content, price, images, merchantId }) {
  if (!name.trim() || Array.from(name.trim()).length > 200) return '请填写商品名称，最多200字';
  if (!content.trim() || Array.from(content.trim()).length > 20000) return '请填写商品介绍，最多20000字';
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(price.trim())) return '请填写有效价格，最多两位小数';
  if (!images.length || images.length > 9) return '请添加1至9张商品图片';
  if (!Number.isInteger(merchantId) || merchantId <= 0) return '请选择发布商家';
  return '';
}

export async function publishMerchantGoods(payload, key) {
  const response = await api('/merchant/products/publish', 'POST', payload, {
    headers: { 'Idempotency-Key': key },
  });
  if (!response.data?.product_id) throw new Error('发布结果暂未确认，请重试');
  return response.data;
}

export async function getMyGoods(page = 1, pageSize = 20) {
  const response = await api(`/merchant/products/mine?page=${page}&page_size=${pageSize}`);
  const result = response.data;
  if (!result || !Array.isArray(result.items) || !Number.isInteger(result.total) || result.total < 0
    || !Number.isInteger(result.page) || result.page < 1
    || !Number.isInteger(result.page_size) || result.page_size < 1) {
    throw new Error('商品列表暂未获取完整，请重试');
  }
  return result;
}

export async function bindGoodsToPost(productId, postId) {
  const response = await api(`/merchant/products/${encodeURIComponent(productId)}/bind`, 'POST', { post_id: postId });
  if (response.data?.product_id !== productId || response.data?.post_id !== postId) {
    throw new Error('绑定结果暂未确认，请重试');
  }
  return response.data;
}
