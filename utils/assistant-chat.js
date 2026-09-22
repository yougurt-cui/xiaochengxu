import { setModalData } from './modal-layout';
import { api, login, hasSession, mapPet, errorText } from '../api/miniprogram';
import { loadStore, saveStore, accountKey } from './pet-store';
import config from '../config';
import request from '../api/request';

export function mapChatMessage(message) {
  const interaction = message.interaction || {};
  return {
    ...message,
    text: message.content || message.reply || '',
    interaction: {
      ...interaction,
      options: (interaction.options || []).map((option) => ({ ...option, selected: false })),
    },
    canInteract: !!interaction.slot,
    selectedValues: [],
    riskReasons: (((message.result || {}).risk || {}).reasons || []).join('、'),
    limitedInfo: !!(message.result && message.result.limited_info),
    candidates: (message.result && message.result.food_candidates) || [],
  };
}

export const chatMethods = {
  async refreshChatPet(strict = false) {
    if (!this.data.boundPet) this.setData({ boundPet: loadStore().pet });
    if (!hasSession()) {
      this.setData({ chatPets: [] });
      if (strict) {
        await login();
      } else return;
    }
    const account = accountKey('assistant');
    try {
      const response = await api('/cat-profiles');
      if (account !== accountKey('assistant')) return;
      const pets = (response.items || []).map(mapPet);
      const item =
        pets.find((p) => p.id === this._selectedChatPetId) ||
        pets.find((p) => p.id === this._cloudPetId) ||
        pets.find((p) => p.is_default) ||
        pets[0];
      const pet = item || null;
      saveStore({ pet });
      const attach = !!this.data.composerPet || this._attachPetOnReturn;
      this.setData({ boundPet: pet, chatPets: pets, ...(attach ? { composerPet: pet } : {}) });
      if (this._attachPetOnReturn && pet) {
        this._selectedChatPetId = pet.id;
        this._attachPetOnReturn = false;
      }
      if (!pet) this._selectedChatPetId = '';
    } catch (e) {
      if (strict) throw e;
      // Preserve the last selected pet on transient network failures.
    }
  },
  async openChatPetPicker() {
    if (this.data.sending || this.data.petsLoading) return;
    this.setData({ petsLoading: true, composerFocused: false, keyboardHeight: 0 });
    try {
      await this.refreshChatPet(true);
      if (!this.data.chatPets.length) {
        this.addChatPet();
        return;
      }
      setModalData(this, { showChatPetPicker: true });
    } catch (e) {
      wx.showToast({ title: errorText(e), icon: 'none' });
    } finally {
      this.setData({ petsLoading: false });
    }
  },
  closeChatPetPicker() {
    setModalData(this, { showChatPetPicker: false });
  },
  selectChatPet(e) {
    if (this.data.sending) return;
    const pet = this.data.chatPets.find((p) => p.id === e.currentTarget.dataset.id);
    if (!pet) return;
    if (this._cloudPetId && this._cloudPetId !== pet.id) {
      this.saveConversation();
      this._cloudConversationId = '';
      this._cloudPetId = '';
      this._lastCloudPayload = null;
      this.setData({ chatMessages: [], userMessage: '', assistantMessage: '', recognized: false, savedMode: false });
    }
    this._selectedChatPetId = pet.id;
    setModalData(this, { boundPet: pet, composerPet: pet, showChatPetPicker: false });
  },
  addChatPet() {
    this._bindingPet = true;
    this._attachPetOnReturn = true;
    setModalData(this, { showChatPetPicker: false });
    this.setData({ composerFocused: false, keyboardHeight: 0 });
    wx.navigateTo({
      url: '/pages/pet-space/pet-edit',
      fail: () => {
        this._bindingPet = false;
      },
    });
  },
  resolvePetGate(event) {
    const resolve = this._resolvePetGate;
    this._resolvePetGate = null;
    setModalData(this, { showPetGate: false });
    if (resolve) resolve({ confirm: !!(event && event.currentTarget.dataset.action === 'bind') });
  },
  focusChatInput() {
    this.setData({ composerFocused: true });
  },
  async sendMessage() {
    if (this.data.sending || this._checkingPet || (!this.data.inputMessage.trim() && !this.data.composerImages.length))
      return;
    this._checkingPet = true;
    try {
      await this.refreshChatPet();
      if (!this.data.boundPet) {
        const choice = await new Promise((resolve) => {
          this._resolvePetGate = resolve;
          setModalData(this, { showPetGate: true, composerFocused: false, keyboardHeight: 0 });
        });
        if (choice.confirm) {
          this.addChatPet();
          return;
        }
        // Chat requires a server-side pet profile; cancelling keeps the draft intact.
        return;
      }
      if (this.data.composerImages.length) {
        this.openFoodSubmission();
        return;
      }
      return this.sendCloudMessage({ message: this.data.inputMessage.trim() }, this.data.inputMessage.trim());
    } finally {
      this._checkingPet = false;
    }
  },
  async openFoodSubmission() {
    if (this._openingFoodSubmission) return;
    this._openingFoodSubmission = true;
    await this.refreshChatPet();
    if (!this.data.boundPet) {
      this._openingFoodSubmission = false;
      this.addChatPet();
      return;
    }
    const account = accountKey('assistant');
    wx.navigateTo({
      url: '/pages/pet-space/food-submissions?create=1&chat=1',
      success: (r) => r.eventChannel.emit('prefill', { images: [...this.data.composerImages] }),
      events: {
        foodSelected: async (item) => {
          if (account !== accountKey('assistant')) return;
          await this.refreshChatPet();
          if (!this.data.boundPet) {
            this.addChatPet();
            return;
          }
          this.setData({ composerImages: [] });
          this.sendCloudMessage(
            { attachments: [{ type: 'food_submission', submission_id: item.id }] },
            `看看这款粮/零食怎么样：${item.title || item.claimed_product_name}`,
          );
        },
      },
      complete: () => {
        this._openingFoodSubmission = false;
      },
    });
  },
  async sendCloudMessage(payload, displayText) {
    if (this.data.sending) return;
    const version = (this._sendVersion || 0) + 1;
    this._sendVersion = version;
    this._lastCloudPayload = payload;
    this._lastCloudText = displayText;
    const pet = this.data.boundPet;
    if (!pet || !pet.id) {
      this.addChatPet();
      return;
    }
    this.setData({ sending: true, recognized: false, savedMode: false });
    try {
      await login();
      if (version !== this._sendVersion) return;
      if (!this._cloudConversationId || (this._cloudPetId && this._cloudPetId !== pet.id)) {
        const created = await api('/chat/conversations', 'POST', { pet_id: pet.id, scene: 'pet_manager' });
        if (version !== this._sendVersion) return;
        this._cloudConversationId = created.conversation.id;
        this._cloudPetId = created.conversation.pet_id || pet.id;
      }
      const messages = this.data.chatMessages.map((m) => ({ ...m, canInteract: false }));
      this.setData({
        chatMessages: [...messages, { id: `user-${Date.now()}`, role: 'user', text: displayText }],
        inputMessage: payload.message ? '' : this.data.inputMessage,
        userMessage: displayText,
      });
      this.scrollChat();
      this._sendRequest = request(
        `${config.apiBaseUrl}/api/miniprogram/chat/conversations/${encodeURIComponent(
          this._cloudConversationId,
        )}/messages`,
        'POST',
        payload,
      );
      const response = await this._sendRequest;
      if (version !== this._sendVersion) return;
      const body = response.data || {};
      if (!body.ok || !body.message) throw new Error(body.error || '暂时无法获得回复');
      const reply = mapChatMessage(body.message);
      this.setData({ chatMessages: [...this.data.chatMessages, reply], sending: false });
      this.scrollChat();
    } catch (error) {
      if (version !== this._sendVersion) return;
      const message = (error.data && error.data.error) || error.message || '网络连接失败，请稍后重试';
      if (error.statusCode === 401) wx.removeStorageSync('miniprogram_token');
      if (error.statusCode === 404) this._cloudConversationId = '';
      this.setData({
        sending: false,
        inputMessage: this.data.inputMessage || payload.message || '',
        chatMessages: [
          ...this.data.chatMessages,
          { id: `error-${Date.now()}`, role: 'assistant', text: message, error: true, cloudError: true },
        ],
      });
    }
  },
  chooseChatOption(event) {
    if (this.data.sending) return;
    const { id, index } = event.currentTarget.dataset;
    const message = this.data.chatMessages.find((m) => m.id === id && m.canInteract);
    if (!message) return;
    const option = message.interaction.options[Number(index)];
    if (!option) return;
    if (message.response_type !== 'multi_select') {
      this.sendCloudMessage({ interaction: { slot: message.interaction.slot, value: option.value } }, option.label);
      return;
    }
    let values = [...message.selectedValues];
    if (values.includes(option.value)) values = values.filter((value) => value !== option.value);
    else if (option.value === 'none') values = ['none'];
    else values = [...values.filter((value) => value !== 'none'), option.value];
    this.setData({
      chatMessages: this.data.chatMessages.map((m) =>
        m.id === id
          ? {
              ...m,
              selectedValues: values,
              interaction: {
                ...m.interaction,
                options: m.interaction.options.map((o) => ({ ...o, selected: values.includes(o.value) })),
              },
            }
          : m,
      ),
    });
  },
  submitChatOptions(event) {
    const message = this.data.chatMessages.find((m) => m.id === event.currentTarget.dataset.id && m.canInteract);
    if (!message || !message.selectedValues.length) return;
    const text = message.interaction.options
      .filter((o) => o.selected)
      .map((o) => o.label)
      .join('、');
    this.sendCloudMessage({ interaction: { slot: message.interaction.slot, value: message.selectedValues } }, text);
  },
  retryCloudMessage() {
    if (this._lastCloudPayload) this.sendCloudMessage(this._lastCloudPayload, this._lastCloudText);
  },
  openConversationHistory() {
    if (this._openingHistory) return;
    this.saveConversation();
    this._openingHistory = true;
    const account = accountKey('assistant');
    wx.navigateTo({
      url: '/pages/pet-space/chat-history',
      events: {
        selectConversation: ({ entry, messages }) => {
          if (account !== accountKey('assistant')) return;
          this._lastCloudPayload = null;
          this._cloudConversationId = entry.cloud ? entry.id : '';
          this._cloudPetId = entry.cloud ? entry.pet_id : '';
          this._selectedChatPetId = this._cloudPetId;
          this.setData({ composerPet: null });
          this._attachPetOnReturn = !!this._cloudPetId;
          this.refreshChatPet();
          if (!entry.cloud) wx.setStorageSync(accountKey('food_change_session_id'), entry.id);
          this.setData({
            ...(entry.cloud ? { recognized: false } : entry.state || {}),
            chatMessages: messages,
            sending: false,
            savedMode: false,
          });
        },
        newConversation: () => {
          if (account === accountKey('assistant')) this.newConversation();
        },
      },
      complete: () => {
        this._openingHistory = false;
      },
    });
  },
};
