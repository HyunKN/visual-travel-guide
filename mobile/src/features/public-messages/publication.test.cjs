const {test}=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {createStore,migrate}=require('../../../../.codex-build/app-message-tests/local-notes/store.js');
const {createPublisher,PublicationRejected}=require('../../../../.codex-build/app-message-tests/public-messages/publication.js');
const {createPublicationRemote,serverRejection}=require('../../../../.codex-build/app-message-tests/public-messages/remote.js');
function connect(file=':memory:') {
  const db=new DatabaseSync(file);
  const c={execAsync:async s=>db.exec(s),runAsync:async(s,...a)=>db.prepare(s).run(...a),
    getFirstAsync:async(s,...a)=>db.prepare(s).get(...a)??null,getAllAsync:async(s,...a)=>db.prepare(s).all(...a)};
  const tx=async work=>{db.exec('BEGIN');try{await work(c);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}};
  return {db,tx,store:createStore(tx,randomUUID)};
}
async function prepare(c){
  const d={...await c.store.createDraft('scene-a',{u:.2,v:.7}),body:'  공개할 글\n둘째 줄',visibility:'public',revision:1};
  return {d,job:await c.store.preparePublication(d,'author-a','project-a')};
}
function remote(overrides={}){
  return {ownerId:'author-a',serviceId:'project-a',status:async()=>null,write:async()=>1,...overrides};
}
test('rate rejection returns attempt feedback while durable consent/draft stay intact and no resend occurs',async t=>{
  const c=connect();t.after(()=>c.db.close());await c.tx(migrate);const {d,job}=await prepare(c);
  let writes=0;const retryAt='2027-01-15T12:00:01.000Z';
  const publisher=createPublisher(c.store,remote({write:async()=>{writes++;throw serverRejection('P0001','rate_limited',JSON.stringify({retryAt}));}}));
  const result=await publisher.deliver(d.id);
  assert.equal(result.state,'rejected');assert.equal(result.rateLimit.retryAt,retryAt);assert.equal(writes,1);
  assert.equal((await c.store.getDraft(d.id,d.sceneId)).body,d.body);
  const saved=await c.store.getPublication(d.id);assert.equal(saved.requestId,job.requestId);assert.deepEqual(saved.payload,job.payload);
  assert.equal(saved.rateLimit,undefined);assert.equal((await publisher.deliver(d.id)).state,'rejected');assert.equal(writes,1);
});
test('public consent and local transaction required; v1 migration preserves notes and rolls back on failure',async t=>{
  const c=connect();t.after(()=>c.db.close());await c.tx(migrate);
  let d=await c.store.createDraft('scene-a',{u:0,v:1});
  await c.store.savePrivate({...d,body:'개인 기록',visibility:'private',revision:1});
  c.db.exec('DROP TABLE publication_jobs; PRAGMA user_version=1');
  await c.tx(migrate);assert.equal((await c.store.list())[0].body,'개인 기록');
  d=await c.store.createDraft('scene-a',{u:0,v:1});
  await assert.rejects(c.store.preparePublication({...d,body:'글',revision:1},'a','p'));
  c.db.exec("CREATE TRIGGER fail BEFORE INSERT ON publication_jobs BEGIN SELECT RAISE(ABORT,'disk'); END");
  await assert.rejects(c.store.preparePublication({...d,body:'글',revision:1,visibility:'public'},'a','p'));
  assert.equal((await c.store.getDraft(d.id,d.sceneId)).revision,0);
  assert.equal(await c.store.getPublication(d.id),null);
});
test('committed request survives lost reply and process restart; newer draft is not published',async t=>{
  const dir=mkdtempSync(path.join(tmpdir(),'vtg-public-')),file=path.join(dir,'notes.db');
  let c=connect(file);t.after(()=>{c.db.close();rmSync(dir,{recursive:true});});await c.tx(migrate);
  const {d,job}=await prepare(c);const receipts=new Map();let writes=0;
  const r=remote({status:async id=>receipts.get(id)??null,write:async(id,payload)=>{
    writes++;assert.equal(id,job.requestId);assert.equal(payload.p_body,d.body);receipts.set(id,1);throw new Error('lost reply');
  }});
  assert.equal((await createPublisher(c.store,r).deliver(d.id)).state,'uncertain');
  await c.store.saveDraft({...d,revision:2,body:'공개 동의하지 않은 새 내용'});
  await assert.rejects(c.store.preparePublication({...d,revision:2},'author-a','project-a'));
  await assert.rejects(c.store.savePrivate({...d,revision:2,visibility:'private'}));
  await assert.rejects(c.store.deleteNote(d.id));await assert.rejects(c.store.discardDraft(d.id));
  c.db.close();c=connect(file);await c.tx(migrate);
  assert.equal((await createPublisher(c.store,r).deliver(d.id)).state,'published');
  assert.equal(writes,1);assert.equal((await c.store.getPublication(d.id)).requestId,job.requestId);
  assert.equal((await c.store.getDraft(d.id,d.sceneId)).body,'공개 동의하지 않은 새 내용');
});
test('unknown status retries identical request and double taps coalesce; wrong session sends nothing',async t=>{
  const c=connect();t.after(()=>c.db.close());await c.tx(migrate);const {d,job}=await prepare(c);
  let writes=0;
  await assert.rejects(createPublisher(c.store,remote({ownerId:'other'})).deliver(d.id));
  await assert.rejects(createPublisher(c.store,remote({serviceId:'other'})).deliver(d.id));
  const p=createPublisher(c.store,remote({write:async(id,payload)=>{writes++;assert.equal(id,job.requestId);assert.deepEqual(payload,job.payload);return 1;}}));
  const [a,b]=await Promise.all([p.deliver(d.id),p.deliver(d.id)]);
  assert.equal(writes,1);assert.equal(a.state,'published');assert.deepEqual(a,b);
});
test('failed local acknowledgement reconciles; confirmed withdrawal permits private save and deletion',async t=>{
  const c=connect();t.after(()=>c.db.close());await c.tx(migrate);const {d}=await prepare(c);
  c.db.exec("CREATE TRIGGER fail BEFORE UPDATE ON publication_jobs BEGIN SELECT RAISE(ABORT,'disk'); END");
  await assert.rejects(createPublisher(c.store,remote()).deliver(d.id));
  c.db.exec('DROP TRIGGER fail');
  assert.equal((await createPublisher(c.store,remote({status:async()=>1,write:async()=>assert.fail()})).deliver(d.id)).state,'published');
  const withdrawal=await c.store.preparePublication(d,'author-a','project-a',true);
  assert.equal(withdrawal.payload.p_body,null);assert.equal(withdrawal.payload.p_expected,1);
  assert.equal((await createPublisher(c.store,remote({write:async()=>2})).deliver(d.id)).state,'withdrawn');
  await c.store.savePrivate({...d,revision:2,visibility:'private'});await c.store.deleteNote(d.id);
});
test('only explicit known server rejection settles; malformed confirmation remains uncertain',async t=>{
  const c=connect();t.after(()=>c.db.close());await c.tx(migrate);const {d}=await prepare(c);
  assert.equal(serverRejection('500','invalid_body'),null);assert.equal(serverRejection('P0001','unknown'),null);
  const rpc=createPublicationRemote('author-a','project-a',async name=>name==='vtg_request_status'?null:'1');
  assert.equal((await createPublisher(c.store,rpc).deliver(d.id)).state,'uncertain');
  const p=createPublisher(c.store,remote({write:async()=>{throw new PublicationRejected('conflict');}}));
  assert.equal((await p.deliver(d.id)).state,'conflict');
  await assert.rejects(c.store.preparePublication(d,'author-a','project-a'));
});
test('rejected update does not turn an existing public copy private; withdrawal remains possible',async t=>{
  const c=connect();t.after(()=>c.db.close());await c.tx(migrate);const {d}=await prepare(c);
  await createPublisher(c.store,remote()).deliver(d.id);
  const updated={...d,revision:2,body:'새 내용'};
  const job=await c.store.preparePublication(updated,'author-a','project-a');
  assert.equal(job.submittedRevision,2);assert.equal(job.payload.p_expected,1);
  await createPublisher(c.store,remote({write:async()=>{throw new PublicationRejected('rejected');}})).deliver(d.id);
  await assert.rejects(c.store.savePrivate({...updated,revision:3,visibility:'private'}));
  await assert.rejects(c.store.deleteNote(d.id));
  const withdraw=await c.store.preparePublication(updated,'author-a','project-a',true);
  assert.equal(withdraw.payload.p_expected,1);
  await createPublisher(c.store,remote({write:async()=>2})).deliver(d.id);
  await c.store.savePrivate({...updated,revision:3,visibility:'private'});
});
