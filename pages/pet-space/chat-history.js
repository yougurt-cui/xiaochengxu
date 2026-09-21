import { api, hasSession } from '../../api/miniprogram';
import { accountKey, formatEdited } from '../../utils/pet-store';
import { mapChatMessage } from '../../utils/assistant-chat';

function historyRow(entry, cloud) {
  const date = entry.last_message_at || entry.updated_at || entry.created_at || entry.updatedAt;
  return {
    ...entry,
    cloud,
    key: `${cloud ? 'cloud' : 'local'}:${entry.id}`,
    title: String(entry.title || '未命名对话')
      .replace(/\s+/g, ' ')
      .trim(),
    timeText: date ? formatEdited(date) : '',
  };
}
Page({
  data: { conversations: [], loading: false, opening: '', error: '', openError: '' },
  onLoad() {
    this._account = accountKey('assistant');
    this.loadHistory();
  },
  onUnload() {
    this._disposed = true;
  },
  async loadHistory() {
    if (this.data.loading) return;
    const local = (wx.getStorageSync(accountKey('assistant_conversations_v1')) || []).map((c) => historyRow(c, false));
    this.setData({ conversations: local, loading: true, error: '' });
    try {
      if (!hasSession()) return;
      const response = await api('/chat/conversations', 'GET', { limit: 50 });
      if (this._disposed || this._account !== accountKey('assistant')) return;
      const cloud = (response.items || response.conversations || []).map((c) => historyRow(c, true));
      this.setData({ conversations: [...cloud, ...local] });
    } catch (error) {
      if (!this._disposed) this.setData({ error: error.message || '对话记录暂时加载失败' });
    } finally {
      if (!this._disposed) this.setData({ loading: false });
    }
  },
  async selectConversation(event) {
    if (this.data.opening) return;
    const entry = this.data.conversations.find((c) => c.key === event.currentTarget.dataset.key);
    if (!entry) return;
    this.setData({ opening: entry.key, openError: '' });
    try {
      let messages = entry.messages || [];
      if (entry.cloud) {
        const response = await api(`/chat/conversations/${encodeURIComponent(entry.id)}/messages`, 'GET', {
          limit: 200,
        });
        messages = (response.items || response.messages || []).map(mapChatMessage);
        messages.forEach((m, i) => {
          m.canInteract = m.canInteract && i === messages.length - 1;
        });
      }
      if (this._disposed || this._account !== accountKey('assistant')) return;
      this.getOpenerEventChannel().emit('selectConversation', { entry, messages });
      wx.navigateBack();
    } catch (error) {
      if (!this._disposed) this.setData({ openError: error.message || '暂时无法打开，请重试' });
    } finally {
      if (!this._disposed) this.setData({ opening: '' });
    }
  },
  newConversation() {
    if (this.data.opening || this._account !== accountKey('assistant')) return;
    this.getOpenerEventChannel().emit('newConversation');
    wx.navigateBack();
  },
});
