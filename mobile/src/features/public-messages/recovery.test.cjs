const {test}=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {randomUUID}=require('node:crypto');
const {createStore,migrate}=require('../../../../.codex-build/app-message-tests/local-notes/store.js');
const {createConflictRecovery,createOwnStateRemote,RecoveryChanged}=require('../../../../.codex-build/app-message-tests/public-messages/recovery.js');
const {createPublisher,PublicationRejected}=require('../../../../.codex-build/app-message-tests/public-messages/publication.js');
async function harness(t){
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());
  const c={execAsync:async s=>db.exec(s),runAsync:async(s,...a)=>db.prepare(s).run(...a),
    getFirstAsync:async(s,...a)=>db.prepare(s).get(...a)??null,getAllAsync:async(s,...a)=>db.prepare(s).all(...a)};
  const tx=async work=>{db.exec('BEGIN');try{await work(c);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}};
  await tx(migrate);const store=createStore(tx,randomUUID);
  const d={...await store.createDraft('scene',{u:.2,v:.7}),body:'내 초안',visibility:'public',revision:1};
  const job=await store.preparePublication(d,'owner','service');await store.settlePublication(d.id,job.requestId,'conflict');
  let state={kind:'found',id:d.id,sceneId:d.sceneId,version:3,u:.4,v:.6,body:'다른 기기에서 수정한 서버 글',visible:true,hidden:false};
  const writes=[],remote={ownerId:'owner',serviceId:'service',status:async()=>null,write:async(id,p)=>{writes.push({id,p});return p.p_expected+1;}};
  const recovery=createConflictRecovery(store,remote,async()=>({...state}));
  return {db,tx,c,store,d,job,remote,writes,recovery,get state(){return state;},set state(s){state=s;}};
}
test('inspection only reads; explicit rebase uses a new request and protects newer draft',async t=>{
  const h=await harness(t),inspection=await h.recovery.inspect(h.d.id);
  assert.equal(h.writes.length,0);assert.equal((await h.store.getPublication(h.d.id)).requestId,h.job.requestId);
  const latest={...h.d,body:'이번에 공개할 글',revision:2};
  assert.equal((await h.recovery.act(latest,inspection,'publish')).state,'published');
  const next=await h.store.getPublication(h.d.id);
  assert.notEqual(next.requestId,h.job.requestId);assert.equal(next.stateSource,'request');assert.equal(next.serverVersion,4);
  assert.equal(h.writes[0].p.p_expected,3);assert.equal(h.writes[0].p.p_body,latest.body);
  assert.equal((await h.store.getDraft(latest.id,latest.sceneId)).body,latest.body);
  await assert.rejects(h.recovery.act(latest,inspection,'publish'),RecoveryChanged);assert.equal(h.writes.length,1);
});
test('changed version, body, anchor, visibility, moderation and absence stop before mutation',async t=>{
  const h=await harness(t),inspection=await h.recovery.inspect(h.d.id),original=h.state;
  for(const state of [{...original,version:4},{...original,body:'다시 바뀜'},{...original,u:.9},{...original,visible:false},{...original,hidden:true},{kind:'missing',id:h.d.id,sceneId:h.d.sceneId}]){
    h.state=state;await assert.rejects(h.recovery.act(h.d,inspection,'publish'),RecoveryChanged);
    assert.equal((await h.store.getPublication(h.d.id)).requestId,h.job.requestId);
  }
  assert.equal(h.writes.length,0);assert.equal((await h.store.getDraft(h.d.id,h.d.sceneId)).body,h.d.body);
});
test('hidden own post can be withdrawn with empty private draft; its body is never sent',async t=>{
  const h=await harness(t);h.state={...h.state,hidden:true};const i=await h.recovery.inspect(h.d.id);
  await assert.rejects(h.recovery.act(h.d,i,'publish'));
  await assert.rejects(h.recovery.act({...h.d,visibility:'private'},i,'private'));
  const d={...h.d,body:'',visibility:'private',revision:2};
  assert.equal((await h.recovery.act(d,i,'withdraw')).state,'withdrawn');
  const p=h.writes[0].p;assert.equal(p.p_body,null);assert.equal(p.p_expected,3);assert.equal(p.p_u,.4);assert.equal(p.p_v,.6);
  assert.equal((await h.store.getDraft(d.id,d.sceneId)).body,'');
});
test('withdrawn or missing observation saves private atomically without inventing a request receipt',async t=>{
  for(const missing of [false,true]){
    const h=await harness(t);h.state=missing?{kind:'missing',id:h.d.id,sceneId:h.d.sceneId}:{...h.state,visible:false,body:''};
    const i=await h.recovery.inspect(h.d.id),d={...h.d,visibility:'private',revision:2};
    h.db.exec("CREATE TRIGGER fail BEFORE DELETE ON drafts BEGIN SELECT RAISE(ABORT,'disk'); END");
    await assert.rejects(h.recovery.act(d,i,'private'));
    assert.equal((await h.store.getPublication(d.id)).state,'conflict');assert.equal((await h.store.getPublication(d.id)).stateSource,'request');
    assert.equal((await h.store.list())[0].kind,'draft');h.db.exec('DROP TRIGGER fail');
    assert.equal(await h.recovery.act(d,i,'private'),null);assert.equal(h.writes.length,0);
    const observed=await h.store.getPublication(d.id);
    assert.equal(observed.state,'withdrawn');assert.equal(observed.stateSource,'observation');assert.equal(observed.requestId,h.job.requestId);
    assert.deepEqual(observed.payload,h.job.payload);assert.equal(observed.serverVersion,missing?null:3);
    assert.equal((await h.store.list())[0].kind,'note');assert.equal((await h.store.privateRead(d.sceneId,d.id)).message.body,d.body);
    const edit=await h.store.edit(d.id),next=await h.store.preparePublication({...edit,visibility:'public',revision:3},'owner','service');
    assert.equal(next.stateSource,'request');assert.equal(next.payload.p_expected,missing?0:3);assert.notEqual(next.requestId,h.job.requestId);
  }
});
test('race after recheck is still guarded by server version and creates another recoverable conflict',async t=>{
  const h=await harness(t),remote={...h.remote,write:async()=>{throw new PublicationRejected('conflict');}};
  const recovery=createConflictRecovery(h.store,remote,async()=>h.state),i=await recovery.inspect(h.d.id);
  assert.equal((await recovery.act(h.d,i,'publish')).state,'conflict');
  assert.equal((await h.store.getDraft(h.d.id,h.d.sceneId)).body,h.d.body);
});
test('lost recovery reply reconciles the same consent after further private editing, without another write',async t=>{
  const h=await harness(t),receipts=new Map();let writes=0;
  const remote={...h.remote,status:async id=>receipts.get(id)??null,write:async(id,p)=>{
    writes++;receipts.set(id,p.p_expected+1);throw new Error('lost response');
  }};
  const recovery=createConflictRecovery(h.store,remote,async()=>h.state),i=await recovery.inspect(h.d.id);
  const uncertain=await recovery.act(h.d,i,'publish');assert.equal(uncertain.state,'uncertain');
  const later={...h.d,revision:2,visibility:'private',body:'전송하지 않을 수정'};await h.store.saveDraft(later);
  await assert.rejects(h.store.savePrivate(later));await assert.rejects(recovery.inspect(h.d.id),RecoveryChanged);
  const settled=await createPublisher(h.store,remote).deliver(h.d.id);
  assert.equal(settled.state,'published');assert.equal(settled.requestId,uncertain.requestId);assert.equal(writes,1);
  assert.equal(settled.payload.p_body,h.d.body);assert.equal((await h.store.getDraft(later.id,later.sceneId)).body,later.body);
});
test('wrong owner/service/scene and stale draft cannot replace conflict job',async t=>{
  const h=await harness(t),i=await h.recovery.inspect(h.d.id);
  for(const change of [{ownerId:'other'},{serviceId:'other'}])await assert.rejects(createConflictRecovery(h.store,{...h.remote,...change},async()=>h.state).inspect(h.d.id));
  await assert.rejects(h.recovery.act({...h.d,sceneId:'other'},i,'publish'),RecoveryChanged);
  await h.store.saveDraft({...h.d,revision:2,body:'新'});
  await assert.rejects(h.recovery.act(h.d,i,'publish'));
  assert.equal((await h.store.getPublication(h.d.id)).requestId,h.job.requestId);assert.equal(h.writes.length,0);
});
test('v2 upgrade preserves immutable consent and rolls back if schema migration fails',async t=>{
  const h=await harness(t);h.db.exec('ALTER TABLE publication_jobs DROP COLUMN stateSource; PRAGMA user_version=2');
  let failed=false;
  await assert.rejects(h.tx(async tx=>migrate({...tx,execAsync:async sql=>{await tx.execAsync(sql);failed=true;throw new Error('disk');}})));
  assert.equal(failed,true);assert.equal(h.db.prepare('PRAGMA user_version').get().user_version,2);
  await h.tx(migrate);const job=await h.store.getPublication(h.d.id);
  assert.equal(job.stateSource,'request');assert.equal(job.requestId,h.job.requestId);assert.deepEqual(job.payload,h.job.payload);
  assert.equal(h.db.prepare('PRAGMA user_version').get().user_version,3);await h.tx(migrate);
});
test('management RPC rejects malformed/cross-scene responses instead of exposing arbitrary data',async()=>{
  const row={id:'id',scene_id:'scene',u:0,v:1,body:'서버',version:1,visible:true,hidden:false};
  let response=[];const read=createOwnStateRemote(async(name,args)=>{assert.equal(name,'vtg_owner_state');assert.deepEqual(args,{p_scene:'scene',p_id:'id'});return response;});
  assert.equal((await read('scene','id')).kind,'missing');response=[row];assert.equal((await read('scene','id')).body,row.body);
  for(const malformed of [null,{},[row,row],[{...row,id:'foreign'}],[{...row,scene_id:'other'}],[{...row,u:NaN}],[{...row,version:0}],[{...row,visible:'true'}],[{...row,body:''}],[{...row,body:'한'.repeat(6000)}]]){
    response=malformed;await assert.rejects(read('scene','id'));
  }
});
