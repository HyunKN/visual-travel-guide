import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

const scene='geunjeongjeon-front-v1';
const secondScene='gyotaejeon-front-v1';
const thirdScene='gwanghwamun-front-v1';
const migrations=['202611070001_place_messages','202611070002_read_snapshot','202611070003_home_preview',
  '202611070004_rate_limit_feedback','202611070005_owner_state','202611090006_permanent_social_auth'];

async function harness(t,{beforeUpgrade}={}){
  const pg=new PGlite();t.after(()=>pg.close());
  // Synthetic trusted JWT claims test SQL policy, not token verification or real OAuth.
  await pg.exec(`create role anon;create role authenticated;create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('test.jwt',true),''),'{}')::jsonb$$;`);
  const session=async(role,id='',claims={is_anonymous:false})=>{
    await pg.exec('reset role');
    await pg.query("select set_config('test.uid',$1,false),set_config('test.jwt',$2,false)",[id,JSON.stringify(claims)]);
    assert.ok(['anon','authenticated'].includes(role));
    await pg.exec('set role '+role);
  };
  const write=(ownerRequest,id,expected=0,body='공개 글',withdraw=false,targetScene=scene)=>
    pg.query('select public.vtg_write($1,$2,$3,$4,.2,.7,$5,$6) v',[ownerRequest,id,expected,targetScene,body,withdraw]);
  const read=(id,targetScene=scene)=>pg.query('select * from public.vtg_read($1,$2)',[targetScene,id]);
  const own=(id,targetScene=scene)=>pg.query('select * from public.vtg_owner_state($1,$2)',[targetScene,id]);
  const preview=(scenes=[scene])=>pg.query('select * from public.vtg_home_preview($1)',[scenes]);
  const report=id=>pg.query('select public.vtg_report($1,$2)',[id,'spam']);
  const status=request=>pg.query('select public.vtg_request_status($1) v',[request]);
  const h={pg,session,write,read,own,preview,report,status};
  for(const [i,file] of migrations.entries()){
    if(i===5&&beforeUpgrade){await beforeUpgrade(h);await pg.exec('reset role');}
    await pg.exec(await readFile(new URL(`../migrations/${file}.sql`,import.meta.url),'utf8'));
  }
  return h;
}

function protectedCalls(h,id,request){
  return [
    ['snapshot',()=>h.pg.query('select public.vtg_snapshot()')],
    ['markers',()=>h.pg.query('select * from public.vtg_markers($1,now())',[scene])],
    ['read',()=>h.read(id)],
    ['write',()=>h.write(request,id)],
    ['withdraw',()=>h.write(randomUUID(),id,1,null,true)],
    ['request_status',()=>h.status(request)],
    ['owner_state',()=>h.own(id)],
    ['report',()=>h.report(id)],
  ];
}

test('all six migrations close every memo RPC to anon/anonymous/missing claims, except the bounded home excerpt',async t=>{
  const h=await harness(t),{pg}=h,owner=randomUUID(),id=randomUUID(),request=randomUUID();
  await h.session('authenticated',owner);
  const body='한😀'.repeat(40)+'비로그인으로 보내면 안 되는 뒤쪽';
  assert.equal((await h.write(request,id,0,body)).rows[0].v,1);
  const sessions=[
    ['anon','',{}],
    ['anon',owner,{is_anonymous:false}], // A role grant must still deny a forged test UID.
    ['authenticated',owner,{is_anonymous:true}],
    ['authenticated',owner,{}],
    ['authenticated',owner,{is_anonymous:null}],
    ['authenticated',owner,{is_anonymous:'false'}],
    ['authenticated',owner,{user_metadata:{is_anonymous:false}}],
    ['authenticated','',{is_anonymous:false}],
  ];
  for(const [role,actor,claims] of sessions){
    await h.session(role,actor,claims);
    const [excerpt]=(await h.preview()).rows;
    assert.equal(excerpt.body,'한😀'.repeat(32));
    assert.equal(Array.from(excerpt.body).length,64);
    assert.equal(excerpt.body.includes('뒤쪽'),false);
    assert.equal(excerpt.id,id);
    for(const [name,call] of protectedCalls(h,id,request)){
      await assert.rejects(call(),e=>{
        assert.equal(e.code,'42501',`${role}/${JSON.stringify(claims)}: ${name}`);
        if(role==='authenticated')assert.equal(e.message,'permanent_login_required');
        return true;
      });
    }
  }
  await h.session('authenticated',owner);
  assert.equal((await h.read(id)).rows[0].body,body);
  assert.equal((await h.status(request)).rows[0].v,1);
  await pg.exec('reset role');
  assert.equal((await pg.query('select count(*)::int n from vtg.requests')).rows[0].n,1);
  assert.equal((await pg.query('select count(*)::int n from vtg.reports')).rows[0].n,0);
});

test('public ACLs expose only the guarded RPCs; private helpers, preserved base functions and tables cannot bypass them',async t=>{
  const h=await harness(t),{pg}=h;
  const publicFunctions=(await pg.query(`select p.oid::regprocedure::text signature,p.proname,p.prosecdef,p.proconfig
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'vtg_%'`)).rows;
  assert.equal(publicFunctions.length,8);
  for(const fn of publicFunctions){
    const row=(await pg.query(`select has_function_privilege('anon',$1,'EXECUTE') anon,
      has_function_privilege('authenticated',$1,'EXECUTE') authenticated`,[fn.signature])).rows[0];
    assert.deepEqual(row,{anon:fn.proname==='vtg_home_preview',authenticated:true});
    assert.equal(fn.prosecdef,true);
    assert.ok(fn.proconfig.includes('search_path=""'));
  }
  const internal=(await pg.query(`select p.oid::regprocedure::text signature from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace where n.nspname='vtg'`)).rows;
  assert.equal(internal.length,11);
  for(const fn of internal){
    const row=(await pg.query(`select has_function_privilege('anon',$1,'EXECUTE') anon,
      has_function_privilege('authenticated',$1,'EXECUTE') authenticated`,[fn.signature])).rows[0];
    assert.deepEqual(row,{anon:false,authenticated:false});
  }
  const tables=['scenes','messages','requests','reports'];
  for(const table of tables){
    assert.equal((await pg.query('select relrowsecurity enabled from pg_class where oid=$1::regclass',[`vtg.${table}`])).rows[0].enabled,true);
  }
  for(const role of ['anon','authenticated']){
    await h.session(role,randomUUID());
    for(const table of tables){
      await assert.rejects(pg.query(`select * from vtg.${table}`),e=>e.code==='42501');
      await assert.rejects(pg.query(`delete from vtg.${table}`),e=>e.code==='42501');
    }
    await assert.rejects(pg.query('select vtg.require_permanent_user()'),e=>e.code==='42501');
    await assert.rejects(pg.query('select vtg.snapshot_base()'),e=>e.code==='42501');
  }
  // Even a future accidental schema USAGE grant cannot enable the preserved RPC implementations.
  await pg.exec('reset role;grant usage on schema vtg to anon,authenticated');
  for(const role of ['anon','authenticated']){
    await h.session(role,randomUUID());
    for(const call of [
      ()=>pg.query('select vtg.require_permanent_user()'),
      ()=>pg.query('select vtg.snapshot_base()'),
      ()=>pg.query('select * from vtg.markers_base($1,now(),null,null)',[scene]),
      ()=>pg.query('select * from vtg.read_base($1,$2)',[scene,randomUUID()]),
      ()=>pg.query('select vtg.request_status_base($1)',[randomUUID()]),
      ()=>pg.query('select * from vtg.owner_state_base($1,$2)',[scene,randomUUID()]),
      ...['write_base','write_with_feedback'].map(name=>()=>pg.query(`select vtg.${name}($1,$2,0,$3,.2,.7,$4,false)`,[randomUUID(),randomUUID(),scene,'우회'])),
      ...['report_base','report_with_feedback'].map(name=>()=>pg.query(`select vtg.${name}($1,$2)`,[randomUUID(),'spam'])),
      ()=>pg.query('select vtg.rate_retry_at($1,false)',[randomUUID()]),
    ])await assert.rejects(call(),e=>e.code==='42501');
    for(const table of tables)await assert.rejects(pg.query(`select * from vtg.${table}`),e=>e.code==='42501');
  }
});

test('upgrade preserves existing ownership/replay/version and independent A/B reads, reports, hiding and withdrawal',async t=>{
  const a=randomUUID(),b=randomUUID(),id=randomUUID(),request=randomUUID(),body='업그레이드 전 공개 글';
  const h=await harness(t,{beforeUpgrade:async old=>{
    await old.session('authenticated',a);
    assert.equal((await old.write(request,id,0,body)).rows[0].v,1);
  }}),{pg}=h;
  await h.session('authenticated',a);
  assert.equal((await h.write(request,id,0,body)).rows[0].v,1);
  assert.equal((await h.status(request)).rows[0].v,1);
  await assert.rejects(h.write(request,id,0,'바뀐 요청'),/request_conflict/);
  await assert.rejects(h.write(randomUUID(),id,0,'낡은 버전'),/unavailable_or_conflict/);
  await assert.rejects(h.write(randomUUID(),id,1,'\u00a0\u3000'),/invalid_body/);
  assert.equal((await h.own(id)).rows[0].body,body);
  assert.deepEqual((await h.own(id,secondScene)).rows,[]);
  assert.deepEqual((await h.own(randomUUID())).rows,[]);

  await h.session('authenticated',b);
  assert.equal((await h.read(id)).rows[0].body,body);
  assert.equal((await h.status(request)).rows[0].v,null);
  assert.deepEqual((await h.own(id)).rows,[]);
  await assert.rejects(h.write(randomUUID(),id,1,'타인 수정'),/unavailable_or_conflict/);
  await assert.rejects(h.write(randomUUID(),id,1,null,true),/unavailable_or_conflict/);
  const snapshot=(await pg.query('select public.vtg_snapshot() v')).rows[0].v;
  const markers=(await pg.query('select * from public.vtg_markers($1,$2)',[scene,snapshot])).rows;
  assert.equal(markers[0].id,id);
  assert.deepEqual(Object.keys(markers[0]).sort(),['id','u','v','created_at'].sort());
  await h.report(id);await h.report(id);
  await pg.exec('reset role');
  assert.equal((await pg.query('select count(*)::int n from vtg.reports')).rows[0].n,1);
  await pg.query('update vtg.messages set hidden=true where id=$1',[id]);
  await h.session('authenticated',b);
  assert.deepEqual((await h.read(id)).rows,[]);
  assert.deepEqual((await pg.query('select * from public.vtg_markers($1,now())',[scene])).rows,[]);
  await assert.rejects(h.report(id),/unavailable/);
  await h.session('anon');assert.deepEqual((await h.preview()).rows,[]);
  await h.session('authenticated',a);
  assert.equal((await h.own(id)).rows[0].hidden,true);
  await assert.rejects(h.write(randomUUID(),id,1,'숨김 덮어쓰기'),/unavailable_or_conflict/);
  assert.equal((await h.write(randomUUID(),id,1,null,true)).rows[0].v,2);
  assert.equal((await h.own(id)).rows[0].visible,false);
  assert.equal((await h.own(id)).rows[0].body,'');
  await h.session('anon');assert.deepEqual((await h.preview()).rows,[]);
});

test('home excerpt keeps latest-one semantics, validates scene bounds and removes hidden/withdrawn messages',async t=>{
  const h=await harness(t),{pg}=h,a=randomUUID(),first=randomUUID(),second=randomUUID(),third=randomUUID();
  await h.session('authenticated',a);
  await h.write(randomUUID(),first,0,'짧은 글',false,scene);
  await h.write(randomUUID(),second,0,'나'.repeat(100),false,secondScene);
  await h.write(randomUUID(),third,0,'세 번째 글',false,thirdScene);
  await pg.exec('reset role');
  await pg.query("update vtg.messages set created_at=now()-interval '2 minutes' where id=$1",[first]);
  await pg.query("update vtg.messages set created_at=now()-interval '1 minute' where id=$1",[second]);
  await h.session('anon');
  assert.equal((await h.preview()).rows[0].body,'짧은 글');
  assert.equal((await h.preview([scene,secondScene,thirdScene])).rows.length,1);
  assert.equal((await h.preview([scene,secondScene,thirdScene])).rows[0].id,third);
  for(const scenes of [[],null,['unknown'],[scene,secondScene,thirdScene,scene]])assert.deepEqual((await h.preview(scenes)).rows,[]);
  await pg.exec('reset role');await pg.query('update vtg.messages set hidden=true where id=$1',[third]);
  await h.session('anon');
  assert.equal((await h.preview([scene,secondScene,thirdScene])).rows[0].body,'나'.repeat(64));
  await h.session('authenticated',a);await h.write(randomUUID(),second,1,null,true,secondScene);
  await h.session('anon');assert.equal((await h.preview([scene,secondScene,thirdScene])).rows[0].id,first);
  await h.session('authenticated',a);await h.write(randomUUID(),first,1,null,true);
  await h.session('anon');assert.deepEqual((await h.preview([scene,secondScene,thirdScene])).rows,[]);
});

test('permanent-user wrappers preserve minute/day limits, replay and withdrawal during limits, and hourly report limits',async t=>{
  const h=await harness(t),{pg}=h,a=randomUUID(),b=randomUUID(),id=randomUUID(),request=randomUUID();
  await h.session('authenticated',a);await h.write(request,id);
  for(let i=0;i<4;i++)await h.write(randomUUID(),randomUUID());
  const rateLimited=action=>assert.rejects(action(),e=>{
    assert.equal(e.code,'P0001');assert.equal(e.message,'rate_limited');
    assert.ok(Number.isFinite(Date.parse(JSON.parse(e.detail).retryAt)));
    return true;
  });
  await rateLimited(()=>h.write(randomUUID(),randomUUID()));
  assert.equal((await h.write(request,id)).rows[0].v,1);
  assert.equal((await h.write(randomUUID(),id,1,null,true)).rows[0].v,2);
  await pg.exec('reset role');
  await pg.query("update vtg.requests set created_at=now()-interval '2 minutes' where owner_id=$1",[a]);
  for(let i=0;i<44;i++)await pg.query("insert into vtg.requests values($1,$2,$3,1,now()-interval '2 hours')",[a,randomUUID(),new Uint8Array([0])]);
  await h.session('authenticated',a);await rateLimited(()=>h.write(randomUUID(),randomUUID()));
  await pg.exec('reset role');
  await pg.query("update vtg.requests set created_at=now()-interval '2 days' where owner_id=$1",[a]);
  await h.session('authenticated',a);assert.equal((await h.write(randomUUID(),randomUUID())).rows[0].v,1);

  const ids=Array.from({length:11},()=>randomUUID());
  await pg.exec('reset role');
  for(const msg of ids)await pg.query('insert into vtg.messages(id,owner_id,scene_id,u,v,body,version,visible) values($1,$2,$3,.2,.7,$4,1,true)',[msg,a,scene,'신고 대상']);
  await h.session('authenticated',b);
  for(const msg of ids.slice(0,10))await h.report(msg);
  await h.report(ids[0]); // Duplicate report succeeds at the limit.
  await rateLimited(()=>h.report(ids[10]));
  await pg.exec('reset role');
  await pg.query("update vtg.reports set created_at=now()-interval '2 hours' where owner_id=$1",[b]);
  await h.session('authenticated',b);await h.report(ids[10]);
  await pg.exec('reset role');
  assert.equal((await pg.query('select count(*)::int n from vtg.reports where owner_id=$1',[b])).rows[0].n,11);
});
