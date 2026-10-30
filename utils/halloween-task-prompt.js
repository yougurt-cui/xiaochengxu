import { accountKey } from './pet-store';
import { HALLOWEEN_ID } from './halloween-activity';

function promptKey() {
  return accountKey(`activity-task-prompt:${HALLOWEEN_ID}`);
}

// Only a confirmed published post queues the prompt. Drafts, failed submissions
// and posts awaiting moderation must not report that the task is complete.
export function queueHalloweenTaskPrompt(post) {
  if (!post || !post.id || post.status !== 'published') return;
  const key = promptKey();
  const saved = wx.getStorageSync(key) || {};
  if (saved.shown || saved.pending) return;
  wx.setStorageSync(key, { pending: true, shown: false });
}

export function showHalloweenTaskPrompt() {
  const key = promptKey();
  let saved;
  try {
    saved = wx.getStorageSync(key) || {};
    if (!saved.pending || saved.shown) return;
    // Persist before showing: cancel, confirm, app restart and repeated onShow
    // must all leave this campaign's prompt consumed for the current account.
    wx.setStorageSync(key, { pending: false, shown: true });
  } catch (_) {
    return;
  }
  const restore = () => {
    try { wx.setStorageSync(key, saved); } catch (_) { /* Keep posting usable. */ }
  };
  try {
    wx.showModal({
      title: '万圣节活动',
      content: '已完成发帖任务',
      showCancel: true,
      cancelText: '取消',
      confirmText: '领取奖励',
      success: ({ confirm }) => {
        if (!confirm || key !== promptKey()) return;
        wx.navigateTo({
          url: '/pages/halloween/index',
          fail: () => wx.showToast({ title: '打开失败，请点击首页活动入口重试', icon: 'none' }),
        });
      },
      fail: restore,
    });
  } catch (_) {
    restore();
  }
}
