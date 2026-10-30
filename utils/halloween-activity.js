import { accountKey } from './pet-store';
import { api, hasSession } from '../api/miniprogram';

export const HALLOWEEN_ID = 'halloween-2026';
export const ACTIVITY_ID = 1001;
export const REDEEM_URL = 'https://aibubu.cn/zh';

function storageKey() {
  return accountKey(`activity-post:${ACTIVITY_ID}`);
}

// Persist the server's ID, including pending posts. Never use a local draft ID.
export function saveActivityPost(post) {
  if (!post || !/^[a-f0-9]{32}$/i.test(post.id || '')) return;
  wx.setStorageSync(storageKey(), { post_id: post.id, status: post.status, saved_at: new Date().toISOString() });
}

export function getActivityPost() {
  const saved = wx.getStorageSync(storageKey());
  return saved && /^[a-f0-9]{32}$/i.test(saved.post_id || '') ? saved : null;
}

function recordFrom(result) {
  if (!['SUCCESS', 'ALREADY_CLAIMED'].includes(result.status) || typeof result.code !== 'string' || !result.code.trim()) {
    throw new Error('活动码返回异常，请刷新后重试');
  }
  return { code: result.code, claimedAt: result.claimed_at || '', preview: false };
}

export async function getActivityStatus() {
  if (!hasSession()) return { status: 'loginRequired', record: null };
  const account = storageKey();
  const result = await api(`/activity/${ACTIVITY_ID}/my-code`);
  if (account !== storageKey()) throw new Error('账号已切换，请刷新');
  if (['SUCCESS', 'ALREADY_CLAIMED'].includes(result.status)) return { status: 'claimed', record: recordFrom(result) };
  if (result.status !== 'NOT_CLAIMED') throw new Error(result.message || '活动状态返回异常，请重试');
  const post = getActivityPost();
  // No eligibility-query API exists: final ownership, category and campaign
  // validation happens atomically in /activity/claim.
  return { status: post && ['published', 'active'].includes(post.status) ? 'eligible' : 'incomplete', record: null };
}

export async function claimActivityCode() {
  const key = storageKey();
  const post = getActivityPost();
  if (!post) throw new Error('未找到发帖凭据，请先发布活动帖子');
  let result;
  try {
    result = await api('/activity/claim', 'POST', { activity_id: ACTIVITY_ID, post_id: post.post_id });
  } catch (error) {
    if (error.statusCode === 403) {
      if (key === storageKey() && getActivityPost()?.post_id === post.post_id) wx.removeStorageSync(key);
      error.activityStatus = 'incomplete';
    }
    if (error.statusCode === 401) error.activityStatus = 'loginRequired';
    throw error;
  }
  if (result.status === 'OUT_OF_STOCK') {
    const error = new Error('本次名额已领完');
    error.activityStatus = 'soldOut';
    throw error;
  }
  if (result.status === 'BUSY') throw new Error('领取人数较多，请稍后重试');
  return recordFrom(result);
}
