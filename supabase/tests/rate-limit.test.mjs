import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const scene='geunjeongjeon-front-v1';
const iso=ms=>new Date(ms).toISOString();
const feedbackTime=ms=>iso(Math.floor(ms/1000)*1000+1000);
async function harness(){
  const pg=new PGlite();
  await pg.exec(`create role anon;create role authenticated;create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;`);
  for(const file of ['0001_place_messages','0002_read_snapshot','0003_home_preview'])
    await pg.exec(await readFile(new URL(`../migrations/20261107${file}.sql`,import.meta.url),'utf8'));
  const actor=randomUUID();
  const session=async()=>{await pg.query("select set_config('test.uid',$1,false)",[actor]);await pg.exec('set role authenticated');};
  const write=(request,id,expected=0,withdraw=false)=>pg.query('select public.vtg_write($1,$2,$3,$4,.2,.7,$5,$6) v',[request,id,expected,scene,withdraw?null:'공개 글',withdraw]);
  const upgrade=async()=>{await pg.exec('reset role');await pg.exec(await readFile(new URL('../migrations/202611070004_rate_limit_feedback.sql',import.meta.url),'utf8'));};
  return {pg,actor,session,write,upgrade};
}
async function rejection(action,expected){
  await assert.rejects(action(),e=>{
    assert.equal(e.code,'P0001');assert.equal(e.message,'rate_limited');assert.equal(JSON.parse(e.detail).retryAt,expected);return true;
  });
}
test('migration preserves existing publication/replay; minute/day retry respects thresholds and withdrawal bypass',async()=>{
  const h=await harness(),{pg,actor}=h;
  try{
    const id=randomUUID(),request=randomUUID();await h.session();assert.equal((await h.write(request,id)).rows[0].v,1);
    await h.upgrade();const base=(await pg.query('select floor(extract(epoch from now())*1000)::double precision n')).rows[0].n;
    // Six recent events: losing only the oldest still leaves five, so use the fifth newest.
    for(const seconds of [25,20,15,10,5])await pg.query('insert into vtg.requests values($1,$2,$3,1,$4)',[actor,randomUUID(),new Uint8Array([0]),iso(base-seconds*1000)]);
    await h.session();await rejection(()=>h.write(randomUUID(),randomUUID()),feedbackTime(base+40_000));
    assert.equal((await h.write(request,id)).rows[0].v,1); // Same request succeeds even while limited.
    await pg.exec('reset role');
    for(let i=0;i<44;i++)await pg.query('insert into vtg.requests values($1,$2,$3,1,$4)',[actor,randomUUID(),new Uint8Array([0]),iso(base-(120-i)*60_000)]);
    await h.session();await rejection(()=>h.write(randomUUID(),randomUUID()),feedbackTime(base+22*3600_000));
    assert.equal((await h.write(randomUUID(),id,1,true)).rows[0].v,2); // Privacy action stays available.
    assert.equal((await pg.query('select * from public.vtg_read($1,$2)',[scene,id])).rows.length,0);
    await pg.exec('reset role');await pg.query("update vtg.requests set created_at=now()-interval '2 days' where owner_id=$1",[actor]);
    const granted=(await pg.query(`select
      has_function_privilege('authenticated','public.vtg_write(uuid,uuid,integer,text,double precision,double precision,text,boolean)','execute') allowed,
      has_function_privilege('anon','public.vtg_write(uuid,uuid,integer,text,double precision,double precision,text,boolean)','execute') anon,
      has_function_privilege('authenticated','vtg.write_base(uuid,uuid,integer,text,double precision,double precision,text,boolean)','execute') internal,
      has_function_privilege('authenticated','vtg.rate_retry_at(uuid,boolean)','execute') helper`)).rows[0];
    assert.deepEqual(granted,{allowed:true,anon:false,internal:false,helper:false});
    await h.session();assert.equal((await h.write(randomUUID(),randomUUID())).rows[0].v,1);
  }finally{await pg.close();}
});
test('report retry feedback uses hourly boundary; duplicates remain idempotent and expiry permits retry',async()=>{
  const h=await harness(),{pg,actor}=h;
  try{
    await h.upgrade();const base=(await pg.query('select floor(extract(epoch from now())*1000)::double precision n')).rows[0].n;
    const owner=randomUUID(),ids=Array.from({length:11},()=>randomUUID());
    for(const [i,id] of ids.entries()){
      await pg.query('insert into vtg.messages(id,owner_id,scene_id,u,v,body,version,visible) values($1,$2,$3,.2,.7,$4,1,true)',[id,owner,scene,'공개 글']);
      if(i<10)await pg.query('insert into vtg.reports values($1,$2,$3,$4)',[actor,id,'spam',iso(base-(59-i)*60_000)]);
    }
    await h.session();const report=id=>pg.query('select public.vtg_report($1,$2)',[id,'spam']);
    await report(ids[0]);await rejection(()=>report(ids[10]),feedbackTime(base+60_000));
    await pg.exec('reset role');await pg.query("update vtg.reports set created_at=now()-interval '2 hours' where owner_id=$1",[actor]);
    await h.session();await report(ids[10]);
    await pg.exec('reset role');assert.equal((await pg.query('select count(*)::int n from vtg.reports where owner_id=$1',[actor])).rows[0].n,11);
  }finally{await pg.close();}
});
