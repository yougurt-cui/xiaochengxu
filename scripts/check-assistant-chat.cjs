// Offline contract tests: no real account mutation or messages sent.
const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
let methods, mapper, pet, modalChoice, navigated, requests, calls, replies, hasSessionValue;
let petList = null;
const wx = {
  showModal: (options) => {
    assert.equal(options.confirmText, '去绑定宠物');
    options.success(modalChoice);
  },
  navigateTo: (options) => {
    navigated = options.url;
  },
  getStorageSync: () => [],
  removeStorageSync() {},
  setStorageSync() {},
  showToast() {},
};
let code = fs
  .readFileSync('utils/assistant-chat.js', 'utf8')
  .replace(/^import .*;$/gm, '')
  .replace(/export /g, '');
vm.runInNewContext(code + '\nexpose(chatMethods, mapChatMessage);', {
  wx,
  setModalData: (page, patch) => page.setData(patch),
  config: { apiBaseUrl: 'https://example.test' },
  api: async (path, method, data) => {
    calls.push({ path, method, data });
    if (path === '/cat-profiles') return { items: petList || (pet ? [pet] : []) };
    if (method === 'POST') return { conversation: { id: 'c1', pet_id: pet.id } };
    return replies;
  },
  login: async () => ({}),
  hasSession: () => hasSessionValue,
  mapPet: (p) => p,
  errorText: e => e.message,
  loadStore: () => ({ pet }),
  saveStore: (patch) => {
    pet = patch.pet;
  },
  accountKey: () => 'account1',
  request: async (url, method, data) => {
    requests.push({ url, method, data });
    return {
      data: {
        ok: true,
        message: {
          id: 'm1',
          role: 'assistant',
          content: '回答',
          response_type: 'single_select',
          interaction: { slot: 'changed', options: [{ label: '没有', value: false }] },
        },
      },
    };
  },
  expose: (m, fn) => {
    methods = m;
    mapper = fn;
  },
});
function page() {
  calls = [];
  requests = [];
  navigated = '';
  hasSessionValue = true;
  return {
    ...methods,
    data: { inputMessage: '家里玩具毛孩子不爱玩，求帮助。', composerImages: [], chatMessages: [], sending: false },
    setData(patch) {
      Object.assign(this.data, patch);
      if (patch.showPetGate)
        queueMicrotask(() =>
          this.resolvePetGate({ currentTarget: { dataset: { action: modalChoice.confirm ? 'bind' : 'cancel' } } }),
        );
    },
    scrollChat() {},
    saveConversation() {},
    closeHistory() {},
  };
}
(async () => {
  pet = null;
  modalChoice = { cancel: true };
  let p = page();
  await p.sendMessage();
  assert.equal(requests.length, 0);
  assert.ok(p.data.inputMessage);
  assert.equal(p.data.chatMessages.length, 0);
  modalChoice = { confirm: true };
  await p.sendMessage();
  assert.equal(navigated, '/pages/pet-space/pet-edit');
  assert.ok(p.data.inputMessage);
  pet = { id: 'pet1', name: '豆豆' };
  await p.refreshChatPet();
  assert.ok(p.data.inputMessage);
  await p.sendMessage();
  assert.equal(requests.length, 1);
  assert.equal(calls.find((c) => c.method === 'POST').data.pet_id, 'pet1');
  assert.equal(p.data.inputMessage, '');
  assert.equal(p.data.chatMessages[1].text, '回答');
  await p.chooseChatOption({ currentTarget: { dataset: { id: 'm1', index: 0 } } });
  // Event handler starts an async request; wait until it settles.
  await new Promise((r) => setImmediate(r));
  assert.equal(requests[1].data.interaction.value, false);
  assert.equal(Object.keys(requests[1].data).join(','), 'interaction');
  p = page();
  p.data.boundPet = pet;
  p._cloudConversationId = 'c1';
  p._cloudPetId = 'pet1';
  p.data.chatMessages = [
    mapper({
      id: 'multi',
      role: 'assistant',
      interaction: {
        slot: 'warning_signs',
        options: [
          { label: '没有', value: 'none' },
          { label: '呕吐', value: 'vomiting' },
        ],
      },
      response_type: 'multi_select',
    }),
  ];
  p.chooseChatOption({ currentTarget: { dataset: { id: 'multi', index: 0 } } });
  p.chooseChatOption({ currentTarget: { dataset: { id: 'multi', index: 1 } } });
  assert.deepEqual(Array.from(p.data.chatMessages[0].selectedValues), ['vomiting']);
  await p.submitChatOptions({ currentTarget: { dataset: { id: 'multi' } } });
  await new Promise((r) => setImmediate(r));
  assert.equal(requests[0].data.interaction.value[0], 'vomiting');
  const risk = mapper({
    response_type: 'risk_alert',
    content: '就医',
    result: { risk: { reasons: ['便血'] }, limited_info: true },
  });
  assert.equal(risk.riskReasons, '便血');
  assert.equal(risk.limitedInfo, true);
  p = page();
  p.data.composerImages = ['local.jpg'];
  await p.sendMessage();
  assert.equal(requests.length, 0);
  assert.ok(p.data.inputMessage);
  assert.equal(p.data.composerImages.length, 1);
  p = page();
  petList = [{ id: 'pet1', name: '豆豆' }, { id: 'pet2', name: '团团', image: '/photo.jpg' }];
  await p.openChatPetPicker();
  assert.equal(p.data.showChatPetPicker, true);
  assert.equal(p.data.chatPets.length, 2);
  p._cloudPetId = 'pet1'; p._cloudConversationId = 'old-conversation';
  p.data.chatMessages = [{ role: 'user', text: '旧宠物问题' }];
  const draft = p.data.inputMessage;
  p.selectChatPet({ currentTarget: { dataset: { id: 'pet2' } } });
  assert.equal(p.data.composerPet.name, '团团');
  assert.equal(p.data.inputMessage, draft);
  assert.equal(p._cloudConversationId, '');
  assert.equal(p.data.chatMessages.length, 0);
  assert.equal(p.data.showChatPetPicker, false);
  await p.refreshChatPet();
  assert.equal(p.data.boundPet.id, 'pet2');
  petList = []; pet = null; p = page();
  await p.openChatPetPicker();
  assert.equal(navigated, '/pages/pet-space/pet-edit');
  assert.ok(p.data.inputMessage);
  console.log(
    'PASS: mandatory pet gate, cancel/bind preserve draft, bound chat API, typed options, multi-select, risk mapping, unsupported image retention',
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
