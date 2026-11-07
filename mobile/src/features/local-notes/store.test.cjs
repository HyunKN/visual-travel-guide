const {test}=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {createStore,migrate}=require('../../../../.codex-build/app-message-tests/local-notes/store.js');
function connect(file) {
  const db=new DatabaseSync(file);
  const c={execAsync:async s=>db.exec(s),runAsync:async(s,...a)=>db.prepare(s).run(...a),
    getFirstAsync:async(s,...a)=>db.prepare(s).get(...a)??null,getAllAsync:async(s,...a)=>db.prepare(s).all(...a)};
  const tx=async work=>{db.exec('BEGIN');try{await work(c);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}};
  return {db,tx,store:createStore(tx,randomUUID)};
}
const point={u:0,v:1};
test('editorial bag survives reopen, consumes once and does not touch drafts, notes or schema version',async t=>{
  const dir=mkdtempSync(path.join(tmpdir(),'vtg-editorial-')),file=path.join(dir,'notes.db');
  let c=connect(file);t.after(()=>{c.db.close();rmSync(dir,{recursive:true});});await c.tx(migrate);
  const draft=await c.store.createDraft('scene',point),ids=['a','b','c'];
  const first=await c.store.nextEditorial(ids);
  c.db.close();c=connect(file);await c.tx(migrate);
  const second=await c.store.nextEditorial(ids),third=await c.store.nextEditorial(ids);
  assert.equal(new Set([first.id,second.id,third.id]).size,3);
  assert.notEqual((await c.store.nextEditorial(ids)).id,third.id);
  assert.deepEqual(await c.store.getDraft(draft.id,'scene'),draft);
  assert.equal(c.db.prepare('PRAGMA user_version').get().user_version,3);
  assert.equal((await c.store.messages.list('scene',null)).items.length,0);
  assert.equal((await c.store.nextEditorial(['only'])).id,'only');
  assert.equal((await c.store.nextEditorial([])).id,null);
});
test('reopen file: no default, unshared public draft, save/edit/discard and recover original note',async t=>{
  const dir=mkdtempSync(path.join(tmpdir(),'vtg-notes-')),file=path.join(dir,'notes.db');
  let c=connect(file);t.after(()=>{c.db.close();rmSync(dir,{recursive:true});});await c.tx(migrate);
  let d=await c.store.createDraft('scene-a',point);assert.equal(d.visibility,null);
  assert.equal(await c.store.getDraft(d.id,'scene-b'),null);
  d={...d,body:'  한글\n두 번째 줄  ',visibility:'public',revision:1};
  await c.store.saveDraft(d);await assert.rejects(c.store.savePrivate(d));assert.equal((await c.store.messages.list('scene-a',null)).items.length,0);
  c.db.close();c=connect(file);await c.tx(migrate);
  const [r]=await c.store.list();assert.equal(r.body,d.body);assert.equal(r.visibility,'public');assert.equal(r.kind,'draft');
  d={...d,visibility:'private',revision:2};await c.store.savePrivate(d);await c.store.savePrivate(d);
  await assert.rejects(c.store.saveDraft({...d,revision:3,body:'late'}));
  assert.equal((await c.store.list()).length,1);
  assert.equal((await c.store.messages.read('other',d.id)).kind,'unavailable');
  assert.equal((await c.store.messages.read('scene-a',d.id)).message.body,d.body);
  const edit=await c.store.edit(d.id);await c.store.saveDraft({...edit,revision:3,body:'변경'});await c.store.discardDraft(d.id);
  assert.equal((await c.store.list())[0].body,d.body);await c.store.deleteNote(d.id);assert.deepEqual(await c.store.list(),[]);
});
test('keyset pages retain every same-time marker once; other scenes cannot reuse cursor',async t=>{
  const c=connect(':memory:');t.after(()=>c.db.close());await c.tx(migrate);
  const store=createStore(c.tx,randomUUID,()=> '2026-11-07T01:00:00.000Z');
  for(let i=0;i<61;i++){
    const d=await store.createDraft('a',point);await store.savePrivate({...d,revision:1,visibility:'private',body:'쪽지'});
  }
  const one=await store.messages.list('a',null),two=await store.messages.list('a',one.nextCursor);
  assert.equal(one.items.length,60);assert.equal(two.items.length,1);assert.equal(two.nextCursor,null);
  assert.equal(new Set([...one.items,...two.items].map(x=>x.id)).size,61);
  await assert.rejects(store.messages.list('b',one.nextCursor));
});
test('failed transaction keeps draft and no note; stale save rejected; queue recovers',async t=>{
  const c=connect(':memory:');t.after(()=>c.db.close());await c.tx(migrate);
  const d=await c.store.createDraft('a',point), latest={...d,revision:2,body:'글',visibility:'private'};await c.store.saveDraft(latest);
  await assert.rejects(c.store.saveDraft({...latest,revision:1,body:'old'}));
  c.db.exec("CREATE TRIGGER fail BEFORE DELETE ON drafts BEGIN SELECT RAISE(ABORT,'fail'); END");
  await assert.rejects(c.store.savePrivate(latest));assert.equal((await c.store.list())[0].kind,'draft');
  assert.equal((await c.store.messages.list('a',null)).items.length,0);
  c.db.exec('DROP TRIGGER fail');await c.store.savePrivate(latest);assert.equal((await c.store.list())[0].kind,'note');
});
test('unsupported schema is not reset; wrong coordinates and oversized final body rejected',async t=>{
  const c=connect(':memory:');t.after(()=>c.db.close());await c.tx(migrate);await assert.rejects(c.store.createDraft('a',{u:2,v:0}));
  const d=await c.store.createDraft('a',point);await assert.rejects(c.store.savePrivate({...d,revision:1,body:'한'.repeat(5500),visibility:'private'}));
  c.db.exec('PRAGMA user_version=4');await assert.rejects(c.tx(migrate));assert.equal(c.db.prepare('PRAGMA user_version').get().user_version,4);
  assert.equal((await c.store.list())[0].id,d.id);
});
test('private scene reads never substitute old personal copy for a public message',async t=>{
  const c=connect(':memory:');t.after(()=>c.db.close());await c.tx(migrate);
  const d={...await c.store.createDraft('scene',{u:0,v:1}),body:'원래 개인 글',visibility:'private',revision:1};
  await c.store.savePrivate(d);
  const edit=await c.store.edit(d.id),pub={...edit,body:'새 공개 내용',visibility:'public',revision:2};
  const job=await c.store.preparePublication(pub,'a','service');
  assert.equal((await c.store.privateRead('scene',d.id)).kind,'unavailable');
  assert.equal((await c.store.privateMarkers('scene',{snapshot:'2099-01-01T00:00:00.000000Z',before:null,id:null})).length,0);
  await c.store.settlePublication(d.id,job.requestId,'published',1);
  assert.equal((await c.store.privateRead('scene',d.id)).kind,'unavailable');
  assert.equal((await c.store.list())[0].body,'새 공개 내용');
});
