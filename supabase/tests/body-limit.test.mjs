import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const migrations=['202611070001_place_messages','202611070002_read_snapshot','202611070003_home_preview',
  '202611070004_rate_limit_feedback','202611070005_owner_state','202611090006_permanent_social_auth'];
test('100-character writes preserve legacy reads, receipt replay, withdrawal and access control',async t=>{
  const pg=new PGlite();t.after(()=>pg.close());
  await pg.exec(`create role anon;create role authenticated;create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('test.jwt',true),''),'{}')::jsonb$$;`);
  for(const name of migrations)await pg.exec(await readFile(new URL(`../migrations/${name}.sql`,import.meta.url),'utf8'));
  const owner=randomUUID(),scene='geunjeongjeon-front-v1',legacyId=randomUUID(),legacyRequest=randomUUID(),legacy='한'.repeat(200);
  const session=async(role,claims={is_anonymous:false})=>{
    await pg.exec('reset role');await pg.query("select set_config('test.uid',$1,false),set_config('test.jwt',$2,false)",[owner,JSON.stringify(claims)]);await pg.exec(`set role ${role}`);
  };
  const write=(body,{id=randomUUID(),request=randomUUID(),expected=0,withdraw=false}={})=>
    pg.query('select public.vtg_write($1,$2,$3,$4,.2,.7,$5,$6) v',[request,id,expected,scene,body,withdraw]);
  await session('authenticated');await write(legacy,{id:legacyId,request:legacyRequest});
  await pg.exec('reset role');await pg.exec(await readFile(new URL('../migrations/20261114085157_message_body_100_characters.sql',import.meta.url),'utf8'));
  await session('authenticated');
  for(const char of ['a','한','🙂']){
    assert.equal((await write(char.repeat(100))).rows[0].v,1);
    await assert.rejects(write(char.repeat(101)),/invalid_body/);
  }
  assert.equal((await pg.query('select * from public.vtg_read($1,$2)',[scene,legacyId])).rows[0].body,legacy);
  assert.equal((await write(legacy,{id:legacyId,request:legacyRequest})).rows[0].v,1);
  await assert.rejects(write(legacy+'x',{id:legacyId,request:legacyRequest}),/request_conflict/);
  assert.equal((await write(null,{id:legacyId,expected:1,withdraw:true})).rows[0].v,2);
  assert.equal((await pg.query('select * from public.vtg_read($1,$2)',[scene,legacyId])).rows.length,0);
  await session('authenticated',{is_anonymous:true});await assert.rejects(write('글'),/permanent_login_required/);
  await session('anon');await assert.rejects(write('글'),/permission denied/);
});
