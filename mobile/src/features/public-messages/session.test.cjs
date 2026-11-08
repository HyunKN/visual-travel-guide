const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createAuthorSession}=require('../../../../.codex-build/app-message-tests/public-messages/session.js');
const {createSessionVault}=require('../../../../.codex-build/app-message-tests/public-messages/sessionVault.js');
const {editorAction}=require('../../../../.codex-build/app-message-tests/public-messages/editorAction.js');
// Synthetic data only. No real credentials are read or logged.
const sample={ownerId:'owner-a',accessToken:'synthetic-access',refreshToken:'synthetic-refresh',permanent:true};
function memory(){
  const data=new Map();
  return {data,get:async k=>data.get(k)??null,set:async(k,v)=>{data.set(k,v);},remove:async k=>{data.delete(k);}};
}
test('secure chunks commit atomically; interruption and missing data cannot become empty session',async()=>{
  const s=memory(),vault=createSessionVault(s,'test',randomUUID);
  await vault.write(sample);assert.deepEqual(await vault.read(),sample);
  const replacement={...sample,accessToken:'synthetic-'.repeat(300)};
  let writes=0;
  const failing=createSessionVault({...s,set:async(k,v)=>{if(++writes===2)throw new Error('disk');await s.set(k,v);}},'test',randomUUID);
  await assert.rejects(failing.write(replacement));assert.deepEqual(await vault.read(),sample);
  await vault.write(replacement);assert.deepEqual(await vault.read(),replacement);
  const manifest=JSON.parse(s.data.get('test'));s.data.delete('test.'+manifest.generation+'.0');
  await assert.rejects(vault.read());
});
test('failed secure save blocks publish and retries the explicit social identity without anonymous creation',async()=>{
  let saved=null,restore=0,fail=true,work=0;
  const author=createAuthorSession({read:async()=>saved,write:async s=>{if(fail)throw new Error('store');saved=s;}},{
    restore:async s=>{restore++;return s;},
  });
  await assert.rejects(author.accept(sample));assert.equal(work,0);
  fail=false;
  await Promise.all([author.run(null,true,async()=>work++),author.run(null,true,async()=>work++)]);
  assert.equal(restore,1);assert.equal(work,2);
});
test('missing, unreadable, mismatched and expired identity never trigger automatic new author',async()=>{
  let creates=0,works=0;
  const auth={anonymous:async()=>{creates++;return sample;},restore:async()=>{throw new Error('expired');}};
  const work=async()=>works++;
  const empty=createAuthorSession({read:async()=>null,write:async()=>{}},auth);
  await assert.rejects(empty.run('owner-a',true,work));
  await assert.rejects(empty.run(null,false,work));
  const wrong=createAuthorSession({read:async()=>sample,write:async()=>{}},auth);
  await assert.rejects(wrong.run('owner-b',true,work));
  await assert.rejects(wrong.run('owner-a',true,work));
  const broken=createAuthorSession({read:async()=>{throw new Error('locked');},write:async()=>{}},auth);
  await assert.rejects(broken.run(null,true,work));
  assert.equal(creates,0);assert.equal(works,0);
});
test('refresh token rotation is retained when local save fails and retried without second refresh',async()=>{
  let restores=0,fail=true,saved=sample;
  const author=createAuthorSession({read:async()=>saved,write:async s=>{if(fail)throw new Error('disk');saved=s;}},{
    anonymous:async()=>assert.fail(),restore:async s=>{restores++;return {...s,refreshToken:'synthetic-rotated'};},
  });
  await assert.rejects(author.run('owner-a',false,async()=>assert.fail()));
  fail=false;await author.run('owner-a',false,async owner=>assert.equal(owner,'owner-a'));
  assert.equal(restores,1);assert.equal(saved.refreshToken,'synthetic-rotated');
});
test('unresolved withdrawal remains actionable after selecting private or emptying the current draft',()=>{
  const draft={visibility:'private',body:''};
  const job={state:'uncertain',payload:{p_withdraw:true},serverVersion:1};
  const a=editorAction(draft,job,true,true);
  assert.equal(a.label,'철회 결과 확인');assert.equal(a.operation,'reconcile');assert.equal(a.disabled,false);
  assert.equal(a.canDiscard,false);
  assert.equal(editorAction(draft,job,false,true).disabled,true);
  assert.equal(editorAction(draft,job,true,false).disabled,true);
});
test('rejected update retains withdrawal control; missing status or conflict cannot appear private',()=>{
  const draft={visibility:'private',body:'글'};
  const job={state:'rejected',payload:{p_withdraw:false},serverVersion:1};
  assert.equal(editorAction(draft,job,true,true).canWithdraw,true);
  assert.equal(editorAction(draft,job,true,true).disabled,true);
  const conflict=editorAction({...draft,body:''},{...job,state:'conflict'},true,true);
  assert.equal(conflict.disabled,false);assert.equal(conflict.operation,'inspect');
  assert.equal(conflict.canDiscard,false);assert.equal(conflict.canWithdraw,false);
  assert.equal(editorAction(draft,null,true,false).disabled,true);
  assert.equal(editorAction(draft,{...job,state:'withdrawn'},true,true).disabled,false);
});
