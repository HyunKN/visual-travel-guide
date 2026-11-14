const {test}=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {createStore,migrate}=require('../../../../.codex-build/app-message-tests/local-notes/store.js');
const {createPublisher,createPrivateSaver,PublicationRejected}=require('../../../../.codex-build/app-message-tests/public-messages/publication.js');
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
test('cancel public edit restores the confirmed body/position without resending and ignores stale writes',async t=>{
  const c=connect();t.after(()=>c.db.close());await c.tx(migrate);const {d}=await prepare(c);
  await createPublisher(c.store,remote()).deliver(d.id);
  const changed={...d,body:'버릴 수정',u:.9,visibility:'private',revision:2};await c.store.saveDraft(changed);
  await c.store.cancelEdit(d.id);await assert.rejects(c.store.saveDraft(changed));
  const original=await c.store.getDraft(d.id,d.sceneId);
  assert.equal(original.body,d.body);assert.equal(original.u,d.u);assert.equal(original.visibility,'public');
  assert.ok(original.revision>changed.revision);assert.equal((await c.store.list())[0].kind,'published');
});
test('private save withdraws once and only then commits the local private note',async t=>{
  const c=connect();t.after(()=>c.db.close());await c.tx(migrate);const {d}=await prepare(c);
  await createPublisher(c.store,remote()).deliver(d.id);let writes=0;
  const changed={...d,visibility:'private',body:'개인 수정',revision:2};
  assert.equal(await createPrivateSaver(c.store,remote({write:async(_,p)=>{writes++;assert.equal(p.p_withdraw,true);assert.equal(p.p_body,null);return 2;}}))(changed),null);
  assert.equal(writes,1);assert.equal((await c.store.list())[0].kind,'note');
  assert.equal((await c.store.privateRead(d.sceneId,d.id)).message.body,changed.body);
});
test('lost withdrawal reply keeps the draft, and private-save retry reconciles the same request',async t=>{
  const c=connect();t.after(()=>c.db.close());await c.tx(migrate);const {d}=await prepare(c);
  await createPublisher(c.store,remote()).deliver(d.id);const receipts=new Map();let writes=0;
  const r=remote({status:async id=>receipts.get(id)??null,write:async(id)=>{writes++;receipts.set(id,2);throw new Error('lost');}});
  const changed={...d,visibility:'private',body:'보호할 수정',revision:2},save=createPrivateSaver(c.store,r);
  assert.equal((await save(changed)).state,'uncertain');assert.equal((await c.store.list())[0].kind,'draft');
  await assert.rejects(c.store.cancelEdit(d.id));
  assert.equal(await save(changed),null);assert.equal(writes,1);
  assert.equal((await c.store.privateRead(d.sceneId,d.id)).message.body,changed.body);
});
test('private-save disk failure after withdrawal leaves a retryable draft without a second withdrawal',async t=>{
  const c=connect();t.after(()=>c.db.close());await c.tx(migrate);const {d}=await prepare(c);
  await createPublisher(c.store,remote()).deliver(d.id);let writes=0;
  const changed={...d,visibility:'private',revision:2};
  const save=createPrivateSaver(c.store,remote({write:async()=>{writes++;return 2;}}));
  c.db.exec("CREATE TRIGGER fail BEFORE DELETE ON drafts BEGIN SELECT RAISE(ABORT,'disk'); END");
  await assert.rejects(save(changed));assert.equal((await c.store.getPublication(d.id)).state,'withdrawn');
  assert.equal((await c.store.getDraft(d.id,d.sceneId)).body,d.body);c.db.exec('DROP TRIGGER fail');
  assert.equal(await save(changed),null);assert.equal(writes,1);
});

test('confirmed unchanged publication is listed as published after reopening without deleting its durable draft',async t=>{
  const dir=mkdtempSync(path.join(tmpdir(),'vtg-published-list-')),file=path.join(dir,'notes.db');
  let c=connect(file);t.after(()=>{c.db.close();rmSync(dir,{recursive:true});});await c.tx(migrate);
  const {d}=await prepare(c);await createPublisher(c.store,remote()).deliver(d.id);
  c.db.close();c=connect(file);await c.tx(migrate);
  const [row]=await c.store.list();
  assert.equal(row.kind,'published');assert.equal(row.publicationState,'published');assert.equal(row.body,d.body);
  assert.equal((await c.store.getDraft(d.id,d.sceneId)).body,d.body);
  assert.equal((await c.store.edit(d.id)).id,d.id);
});

test('My Notes renders a confirmed row with edit/photo actions and no unfinished-draft controls',async t=>{
  const c=connect();t.after(()=>c.db.close());await c.tx(migrate);const {d}=await prepare(c);
  await createPublisher(c.store,remote()).deliver(d.id);const [row]=await c.store.list();
  const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),exports={};
  const jsx=(type,props)=>({type,props});
  const modules={
    'react/jsx-runtime':{jsx,jsxs:jsx},
    react:{useCallback:fn=>fn,useRef:value=>({current:value}),useState:initial=>[typeof initial==='function'?initial():initial,()=>{}]},
    'expo-router':{router:{},useFocusEffect:()=>{}},
    'react-native':{Alert:{},FlatList:'FlatList',View:'View',StyleSheet:{create:x=>x}},
    'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:0})},
    '../../ui/Text':{Text:'Text'},'../../ui/Action':{Action:'Action'},'../../ui/Skeleton':{Skeleton:'Skeleton'},
    '../../ui/theme':{color:{},layout:{},textStyles:{}},
    '../../features/local-notes/device':{accountNotes:()=>({})},
    '../../features/place-messages/scenes':{getScene:()=>({name:'근정전'})},
    '../../features/auth/MemoGate':{MemoGate:'MemoGate',AccountActions:'AccountActions'},
    '../../features/public-messages/OwnPublicationStatus':{OwnPublicationStatus:'OwnPublicationStatus'},
  };
  const code=ts.transpileModule(fs.readFileSync(path.join(process.cwd(),'src/app/(browse)/my-notes.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports,require:name=>{assert.ok(name in modules,`unexpected import ${name}`);return modules[name];}});
  const content=exports.default().props.children;
  const flatList=content.type().props.children;
  const tree=flatList.props.renderItem({item:row});
  const nodes=x=>Array.isArray(x)?x.flatMap(nodes):!x||typeof x!=='object'?[]:[x,...nodes(x.props?.children)];
  const labels=nodes(tree).filter(x=>x.type==='Action').map(x=>x.props.label);
  assert.deepEqual(labels,['편집','사진에서 보기']);
  assert.ok(nodes(tree).some(x=>x.type==='OwnPublicationStatus'&&x.props.item===row));
});

test('only the exact confirmed snapshot is completed; later local edits and uncertain delivery stay drafts',async t=>{
  const c=connect();t.after(()=>c.db.close());await c.tx(migrate);const {d}=await prepare(c);
  await createPublisher(c.store,remote()).deliver(d.id);
  let revision=d.revision;
  for(const patch of [{body:'공개 후 수정'},{u:.4},{v:.2},{visibility:'private'}]){
    await c.store.saveDraft({...d,...patch,revision:++revision});
    const [row]=await c.store.list();assert.equal(row.kind,'draft');assert.equal(row.publicationState,'published');
  }
  const changed={...d,body:'공개 확인 전 추가 입력',revision:++revision};
  await c.store.preparePublication(changed,'author-a','project-a');
  await createPublisher(c.store,remote({write:async()=>{throw new Error('offline');}})).deliver(d.id);
  const [row]=await c.store.list();assert.equal(row.kind,'draft');assert.equal(row.publicationState,'uncertain');
});
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
