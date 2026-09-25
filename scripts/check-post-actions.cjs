const fs=require('fs'), vm=require('vm'), assert=require('node:assert/strict');
let definition, signedIn=true, confirm=false, fail=false, calls=[], back=0;
let store={posts:[{id:'post'}],postCache:[{id:'post'}],feedIds:['post'],favorites:['post']};
vm.runInNewContext(fs.readFileSync('pages/pet-space/post-detail.js','utf8').replace(/^import .*;$/gm,''),{
 Page:p=>definition=p,hasSession:()=>signedIn,requireSession:()=>signedIn,accountKey:()=> 'u',
 loadStore:()=>store,saveStore:p=>Object.assign(store,p),errorText:e=>e.message,
 api:async(...args)=>{calls.push(args);if(fail)throw Error('offline');return {items:[{code:'spam',label:'垃圾广告'}]};},
 wx:{getStorageSync:()=>({id:'u'}),showModal:o=>o.success({confirm}),showToast:()=>{},navigateBack:()=>back++}
});
const p={...definition,postId:'post',data:{...definition.data,post:{userId:'u'}},setData(v){Object.assign(this.data,v)}};
(async()=>{
 p.updateOwnership();assert.equal(p.data.isOwner,true);
 await p.openReport();assert.equal(calls.length,0);
 await p.deletePost();assert.equal(calls.length,0);assert.equal(store.posts.length,1);
 confirm=true;fail=true;await p.deletePost();assert.equal(store.posts.length,1);assert.equal(back,0);
 fail=false;await p.deletePost();assert.equal(calls[1][0],'/moments/post');assert.equal(calls[1][1],'DELETE');assert.equal(store.posts.length,0);assert.equal(store.favorites.length,0);assert.equal(store.feedIds.length,0);assert.equal(back,1);
 p.data.post={userId:'other'};p.updateOwnership();assert.equal(p.data.isOwner,false);
 const before=calls.length;await p.deletePost();assert.equal(calls.length,before);
 signedIn=false;await p.openReport();assert.equal(calls.length,before);
 signedIn=true;await p.openReport();assert.equal(calls.at(-1)[0],'/moment-report-reasons');
 await p.submitReport();assert.equal(calls.at(-1)[0],'/moment-report-reasons');
 p.chooseReason({currentTarget:{dataset:{code:'spam'}}});p.inputReport({detail:{value:' 补充说明 '}});
 fail=true;await p.submitReport();assert.equal(p.data.detail,' 补充说明 ');assert.equal(p.data.reportVisible,true);assert.equal(p.data.reporting,false);
 fail=false;await p.submitReport();assert.equal(calls.at(-1)[0],'/moments/post/reports');assert.equal(calls.at(-1)[1],'POST');assert.equal(calls.at(-1)[2].reason_code,'spam');assert.equal(calls.at(-1)[2].detail,'补充说明');assert.equal(p.data.reportVisible,false);
 console.log('PASS: ownership, login gate, delete cancellation/failure/cache cleanup, report reasons/payload/retry');
})().catch(e=>{console.error(e);process.exitCode=1});
