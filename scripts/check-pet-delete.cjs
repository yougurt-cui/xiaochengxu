const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
let definition, confirm = false, fail = false, calls = [], back = 0;
let store = { pets: [{id:'a'}, {id:'b'}], pet: {id:'a'}, selectedPetId:'a' };
vm.runInNewContext(fs.readFileSync('pages/pet-space/pet-edit.js','utf8').replace(/^import .*;$/gm,''), {
  Page: p => definition=p, profileForm: p=>p, requireSession:()=>true,
  accountKey:()=> 'u', loadStore:()=>store,
  cachePetList: pets => { store.pets=pets; store.pet=pets.find(p=>p.id===store.selectedPetId)||pets[0]||null; store.selectedPetId=store.pet?.id||''; },
  api: async (...args)=> { calls.push(args); if(fail) throw Error('offline'); return {ok:true}; },
  errorText:e=>e.message,
  wx:{ showModal:o=>o.success({confirm}),showToast:()=>{},navigateBack:()=>back++ },
});
const page={...definition,data:{...definition.data,form:{id:'a',name:'阿哥'}},setData(p){Object.assign(this.data,p)}};
(async()=>{
 await page.deletePet(); assert.equal(calls.length,0); assert.equal(store.pets.length,2);
 confirm=true; fail=true; await page.deletePet(); assert.equal(store.pets.length,2); assert.equal(back,0); assert.equal(page.data.deleting,false);
 fail=false; await page.deletePet(); assert.equal(calls[1][0],'/cat-profiles/a'); assert.equal(calls[1][1],'DELETE'); assert.equal(store.selectedPetId,'b'); assert.equal(back,1);
 page.data.form.id='b'; await page.deletePet(); assert.equal(store.pets.length,0); assert.equal(store.pet,null);
 console.log('PASS: delete cancellation, failure preservation, endpoint, selected-pet fallback and last-pet removal');
})().catch(e=>{console.error(e);process.exitCode=1;});
