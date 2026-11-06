import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url);
const {createStore,migrate}=require('../../.codex-build/app-message-tests/local-notes/store.js');
const {createPublicationRemote,serverRejection}=require('../../.codex-build/app-message-tests/public-messages/remote.js');
const {createPublisher}=require('../../.codex-build/app-message-tests/public-messages/publication.js');
const {createConflictRecovery,createOwnStateRemote,RecoveryChanged}=require('../../.codex-build/app-message-tests/public-messages/recovery.js');
const scene='geunjeongjeon-front-v1';
async function harness(t){
  const pg=new PGlite();t.after(()=>pg.close());
  await pg.exec(`create role anon;create role authenticated;create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;`);
  for(const suffix of ['0001_place_messages','0002_read_snapshot','0003_home_preview','0004_rate_limit_feedback'])
    await pg.exec(await readFile(new URL(`../migrations/20261107${suffix}.sql`,import.meta.url),'utf8'));
  const session=async(role,id='')=>{await pg.exec('reset role');await pg.query("select set_config('test.uid',$1,false)",[id]);await pg.exec('set role '+role);};
  const write=async(p)=>{
    try{return (await pg.query('select public.vtg_write($1,$2,$3,$4,$5,$6,$7,$8) v',
      [p.p_request,p.p_id,p.p_expected,p.p_scene,p.p_u,p.p_v,p.p_body,p.p_withdraw])).rows[0].v;}
    catch(e){throw serverRejection(e.code,e.message,e.detail)??e;}
  };
  const rpc=async(name,p)=>name==='vtg_owner_state'?(await pg.query('select * from public.vtg_owner_state($1,$2)',[p.p_scene,p.p_id])).rows:
    name==='vtg_request_status'?(await pg.query('select public.vtg_request_status($1) v',[p.p_request])).rows[0].v:write(p);
  const upgrade=async()=>{await pg.exec('reset role');await pg.exec(await readFile(new URL('../migrations/202611070005_owner_state.sql',import.meta.url),'utf8'));};
  return {pg,session,write,rpc,upgrade};
}
test('owner management upgrade isolates absent/foreign IDs; hidden/withdrawn body stays owner-only',async t=>{
  const h=await harness(t),a=randomUUID(),b=randomUUID(),id=randomUUID();
  const p={p_request:randomUUID(),p_id:id,p_expected:0,p_scene:scene,p_u:.2,p_v:.7,p_body:'소유자 글',p_withdraw:false};
  await h.session('authenticated',a);await h.write(p);await h.upgrade();
  const own=()=>h.rpc('vtg_owner_state',{p_scene:scene,p_id:id});
  await h.session('anon');await assert.rejects(own(),/permission denied/);
  await h.session('authenticated',b);assert.deepEqual(await own(),[]);
  await h.session('authenticated');assert.deepEqual(await own(),[]);
  await h.session('authenticated',a);assert.equal((await own())[0].version,1);
  assert.deepEqual(await h.rpc('vtg_owner_state',{p_scene:'gyotaejeon-front-v1',p_id:id}),[]);
  assert.deepEqual(await h.rpc('vtg_owner_state',{p_scene:scene,p_id:randomUUID()}),[]);
  await h.pg.exec('reset role');await h.pg.query('update vtg.messages set hidden=true where id=$1',[id]);
  await h.session('anon');assert.deepEqual((await h.pg.query('select * from public.vtg_read($1,$2)',[scene,id])).rows,[]);
  await h.session('authenticated',a);assert.equal((await own())[0].body,p.p_body);assert.equal((await own())[0].hidden,true);
  await assert.rejects(h.pg.query('select * from vtg.messages'),/permission denied/);
  assert.equal(await h.write({...p,p_request:randomUUID(),p_expected:1,p_body:null,p_withdraw:true}),2);
  const withdrawn=(await own())[0];assert.equal(withdrawn.visible,false);assert.equal(withdrawn.body,'');
  await h.session('authenticated',b);assert.deepEqual(await own(),[]);
});
test('actual SQLite/SQL conflict review, stale-state guard, rebase, withdrawal and observed private recovery',async t=>{
  const h=await harness(t);await h.upgrade();const owner=randomUUID();await h.session('authenticated',owner);
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());
  const c={execAsync:async s=>db.exec(s),runAsync:async(s,...a)=>db.prepare(s).run(...a),
    getFirstAsync:async(s,...a)=>db.prepare(s).get(...a)??null,getAllAsync:async(s,...a)=>db.prepare(s).all(...a)};
  const tx=async work=>{db.exec('BEGIN');try{await work(c);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}};
  await tx(migrate);const store=createStore(tx,randomUUID);
  let d={...await store.createDraft(scene,{u:.2,v:.7}),body:'내 초안',revision:1,visibility:'public'};
  const remote=createPublicationRemote(owner,'test',h.rpc),publisher=createPublisher(store,remote);
  const recovery=createConflictRecovery(store,remote,createOwnStateRemote(h.rpc));
  const base={p_id:d.id,p_expected:0,p_scene:scene,p_u:.4,p_v:.6,p_body:'다른 기기의 글',p_withdraw:false};
  await h.write({...base,p_request:randomUUID()});await store.preparePublication(d,owner,'test');
  assert.equal((await publisher.deliver(d.id)).state,'conflict');const original=await store.getPublication(d.id);
  const i=await recovery.inspect(d.id);assert.equal(i.state.body,base.p_body);
  await h.write({...base,p_request:randomUUID(),p_expected:1,p_body:'다시 바뀐 글'});
  await assert.rejects(recovery.act(d,i,'publish'),RecoveryChanged);assert.equal((await store.getPublication(d.id)).requestId,original.requestId);
  const current=await recovery.inspect(d.id);assert.equal(current.state.version,2);
  assert.equal((await recovery.act(d,current,'publish')).serverVersion,3);
  assert.equal((await h.rpc('vtg_owner_state',{p_scene:scene,p_id:d.id}))[0].body,d.body);
  await h.write({...base,p_request:randomUUID(),p_expected:3,p_body:null,p_withdraw:true});
  d={...d,body:'보호할 개인 초안',visibility:'private',revision:2};await store.saveDraft(d);
  await store.preparePublication(d,owner,'test',true);assert.equal((await publisher.deliver(d.id)).state,'conflict');
  const withdrawn=await recovery.inspect(d.id);assert.equal(withdrawn.state.visible,false);
  assert.equal(await recovery.act(d,withdrawn,'private'),null);
  const observed=await store.getPublication(d.id);assert.equal(observed.stateSource,'observation');assert.equal(observed.serverVersion,4);
  // A failed withdrawal was not rewritten as an acknowledged remote request.
  assert.equal(await remote.status(observed.requestId),null);assert.equal((await store.privateRead(scene,d.id)).message.body,d.body);
  assert.equal((await h.rpc('vtg_owner_state',{p_scene:scene,p_id:d.id}))[0].body,'');
});
