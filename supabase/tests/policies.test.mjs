import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
test('applies migration; anonymous and independent owners cannot bypass publication rules',async()=>{
  const pg=new PGlite();
  try{
    // Only this in-process harness supplies roles/uid; deployed Auth must issue real tokens.
    await pg.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;`);
    await pg.exec(await readFile(new URL('../migrations/202611070001_place_messages.sql',import.meta.url),'utf8'));
    const a=randomUUID(),b=randomUUID(),msg=randomUUID(),req=randomUUID(),scene='geunjeongjeon-front-v1';
    const session=async(role,id='')=>{await pg.exec('reset role');await pg.query("select set_config('test.uid',$1,false)",[id]);await pg.exec('set role '+role);};
    const write=(request=req,expected=0,body='  실제 글\n둘째 줄',withdraw=false)=>pg.query('select public.vtg_write($1,$2,$3,$4,.2,.7,$5,$6) v',[request,msg,expected,scene,body,withdraw]);
    const read=()=>pg.query('select * from public.vtg_read($1,$2)',[scene,msg]);
    await session('anon'); assert.equal((await read()).rows.length,0);await assert.rejects(write(),/permission denied/);
    await session('authenticated',a); assert.equal((await write()).rows[0].v,1);assert.equal((await write()).rows[0].v,1);
    await assert.rejects(write(req,0,'다른 내용'),/conflict/);
    await assert.rejects(write(randomUUID(),0,'이전 버전'),/conflict/);
    await assert.rejects(write(randomUUID(),1,'   '),/invalid_body/);
    await assert.rejects(write(randomUUID(),1,'\u00a0\u3000'),/invalid_body/);
    await session('anon');assert.equal((await read()).rows[0].body,'  실제 글\n둘째 줄');await assert.rejects(pg.query('select * from vtg.messages'),/permission denied/);
    const markers=await pg.query('select * from public.vtg_markers($1,now())',[scene]);assert.deepEqual(Object.keys(markers.rows[0]).sort(),['id','u','v','created_at'].sort());
    await session('authenticated',b);await assert.rejects(write(randomUUID(),1,'타인 수정'),/conflict/);
    assert.equal((await pg.query('select public.vtg_request_status($1) v',[req])).rows[0].v,null);
    for(let i=0;i<2;i++)await pg.query('select public.vtg_report($1,$2)',[msg,'spam']);
    await pg.exec('reset role');assert.equal((await pg.query('select count(*)::int n from vtg.reports')).rows[0].n,1);
    await pg.query('update vtg.messages set hidden=true where id=$1',[msg]);
    await session('anon');assert.equal((await read()).rows.length,0);
    await session('authenticated',a);await assert.rejects(write(randomUUID(),1,'숨김을 덮기'),/conflict/);
    assert.equal((await write(randomUUID(),1,null,true)).rows[0].v,2);assert.equal((await read()).rows.length,0);
  }finally{await pg.close();}
});
