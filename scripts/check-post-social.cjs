const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
let definition, signedIn = true, confirm = false, fail = false, calls = [], response = {}, account = 'u';
const store = { postCache: [{ id: 'post' }] };
vm.runInNewContext(fs.readFileSync('pages/pet-space/post-detail.js', 'utf8').replace(/^import .*;$/gm, ''), {
  Page: p => definition = p, hasSession: () => signedIn, requireSession: () => signedIn, accountKey: () => account,
  loadStore: () => store, saveStore: p => Object.assign(store, p), errorText: e => e.message, mediaUrl: s => s || '',
  api: async (...args) => { calls.push(args); if (fail) throw Error('offline'); return response; },
  wx: { getStorageSync: () => ({ id: 'u', name: '昵称', avatarUrl: 'avatar' }), showModal: o => o.success({ confirm }), showToast: () => {} }
});
const p = { ...definition, postId: 'post', data: { ...definition.data, post: { id: 'post', liked: false, likes: 0, commentCount: 0 } }, setData(v) { Object.assign(this.data, v); } };
(async () => {
  signedIn = false; await p.toggleLike(); assert.equal(calls.length, 0);
  signedIn = true; response = { liked: true, likes: 1 }; await p.toggleLike();
  assert.equal(calls.at(-1)[1], 'POST'); assert.equal(p.data.post.liked, true); assert.equal(store.postCache[0].likes, 1);
  fail = true; await p.toggleLike(); assert.equal(p.data.post.likes, 1); assert.equal(p.data.liking, false);
  fail = false; response = { liked: false, likes: 0 }; await p.toggleLike(); assert.equal(calls.at(-1)[1], 'DELETE'); assert.equal(p.data.post.likes, 0);
  p.data.liking = true; const n = calls.length; await p.toggleLike(); assert.equal(calls.length, n); p.data.liking = false;
  response = { items: [{ id: 'other', user_id: 'other', content: 'hello' }] }; await p.loadComments(); assert.equal(p.data.comments.length, 1);
  p.data.commentDraft = ' 留言 '; signedIn = false; const before = calls.length; await p.sendComment(); assert.equal(calls.length, before); signedIn = true;
  fail = true; await p.sendComment(); assert.equal(p.data.commentDraft, ' 留言 '); assert.equal(p.data.commentSending, false);
  fail = false; response = { item: { id: 'mine', user_id: 'u', content: '留言' } }; await p.sendComment();
  assert.equal(calls.at(-1)[2].content, '留言'); assert.equal(calls.at(-1)[2].author_name, '昵称'); assert.equal(p.data.commentDraft, ''); assert.equal(p.data.post.commentCount, 1);
  const event = id => ({ currentTarget: { dataset: { id } } });
  const count = calls.length; await p.deleteComment(event('other')); await p.deleteComment(event('mine')); assert.equal(calls.length, count);
  confirm = true; fail = true; await p.deleteComment(event('mine')); assert.equal(p.data.comments.length, 2);
  fail = false; await p.deleteComment(event('mine')); assert.equal(calls.at(-1)[0], '/moment-comments/mine'); assert.equal(calls.at(-1)[1], 'DELETE'); assert.equal(p.data.comments.length, 1); assert.equal(p.data.post.commentCount, 0);
  console.log('PASS: like/unlike, auth, busy guard, failure recovery, comment payload, draft preservation, ownership and delete');
})().catch(e => { console.error(e); process.exitCode = 1; });
