// Offline UI action checks; never sign in or publish against the real backend.
const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
let definition, gates = 0;
vm.runInNewContext(fs.readFileSync('pages/release/index.js', 'utf8').replace(/^import .*;$/gm, ''), {
  Page: p => { definition = p; },
  categories: [],
  requireSession: () => { gates++; return false; },
});
(async () => {
  const page = { ...definition, data: { title: '标题', body: '暂存内容', images: ['local.jpg'], saving: false } };
  const before = JSON.stringify(page.data);
  await page.release();
  assert.equal(gates, 1);
  assert.equal(JSON.stringify(page.data), before);
  let parent;
  const events = [], calls = [];
  vm.runInNewContext(fs.readFileSync('pages/my/info-edit/index.js', 'utf8').replace(/^import .*;$/gm, ''), {
    Page: p => { parent = p; },
    login: async profile => { calls.push(profile); return { id: 'u', name: profile.nickName }; },
    saveStore: () => {},
    wx: { showToast: () => {}, navigateBack: () => events.push('back') },
    errorText: e => e.message,
  });
  const form = { ...parent, data: { name: '家长', image: '', saving: false, signedIn: false },
    setData: function(p) { Object.assign(this.data, p); },
    getOpenerEventChannel: () => ({ emit: e => events.push(e) }),
  };
  await form.onSaveInfo();
  assert.equal(calls[0].nickName, '家长');
  assert.ok(events.indexOf('authenticated') < events.indexOf('back'));
  assert.equal(form.data.saving, false);
  console.log('PASS: unauthenticated post preserves content; explicit profile sign-in signals origin before returning');
})();
