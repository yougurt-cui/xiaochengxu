import { accountKey } from './pet-store';

export const HALLOWEEN_ID = 'halloween-2026';
export const REDEEM_URL = 'https://aibubu.cn/en';

// Replace these methods with the campaign API when it is available. Never
// infer real eligibility or inventory from local data in a released build.
export function isActivityPreview() {
  try {
    return ['develop', 'trial'].includes(wx.getAccountInfoSync().miniProgram.envVersion);
  } catch (_) {
    return false;
  }
}

function storageKey() {
  return accountKey(`activity-preview:${HALLOWEEN_ID}`);
}

function read() {
  return wx.getStorageSync(storageKey()) || {};
}

export async function getActivityStatus() {
  if (!isActivityPreview()) return { status: 'unavailable', record: null, preview: false };
  const saved = read();
  if (saved.fail) throw new Error('暂时无法查询活动状态，请重试');
  const status = saved.record ? 'claimed' : saved.soldOut ? 'soldOut' : saved.eligible ? 'eligible' : 'incomplete';
  return { status, record: saved.record || null, preview: true };
}

export async function claimActivityCode() {
  if (!isActivityPreview()) throw new Error('活动领取即将开放');
  const saved = read();
  if (saved.fail) throw new Error('领取失败，请稍后重试');
  // Idempotent within the preview account; claimed records win over stock.
  if (saved.record) return saved.record;
  if (saved.soldOut) throw new Error('本次名额已领完');
  if (!saved.eligible) throw new Error('请先完成活动任务');
  const record = { code: 'DEMO-XXXX-XXXX', claimedAt: new Date().toISOString(), preview: true };
  wx.setStorageSync(storageKey(), { ...saved, record });
  return record;
}

export function markActivityPostPublished(post) {
  if (!isActivityPreview() || !post || !post.id || post.status !== 'published') return;
  wx.setStorageSync(storageKey(), { ...read(), eligible: true, postId: post.id });
}

export function setActivityPreviewState(state) {
  if (!isActivityPreview()) return;
  const states = {
    incomplete: {}, eligible: { eligible: true }, soldOut: { soldOut: true },
    error: { fail: true },
    claimed: { eligible: true, record: { code: 'DEMO-XXXX-XXXX', claimedAt: new Date().toISOString(), preview: true } },
  };
  if (Object.prototype.hasOwnProperty.call(states, state)) wx.setStorageSync(storageKey(), states[state]);
}
