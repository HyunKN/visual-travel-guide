const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createSceneMessages,timestamp}=require('../../../../.codex-build/app-message-tests/public-messages/sceneMessages.js');
const signal=()=>new AbortController().signal;
const stamp='2026-11-07T01:00:00.123456Z';
const row=i=>({id:String(i).padStart(8,'0')+'-aaaa-aaaa-aaaa-aaaaaaaaaaaa',u:.2,v:.7,created_at:stamp});
const marker=r=>({id:r.id,sceneId:'scene',anchor:{u:r.u,v:r.v},createdAt:r.created_at});
const local={markers:async()=>[],read:async()=>({kind:'unavailable'}),owned:async()=>false};
test('merged keyset pages preserve same-microsecond rows and avoid duplicates across sources',async()=>{
  const rows=Array.from({length:145},(_,i)=>row(i)).reverse();
  const select=(rows,b)=>rows.filter(r=>!b.before || r.id<b.id).slice(0,61);
  const source=createSceneMessages({...local,markers:async(_,b)=>select(rows.filter((_,i)=>i%2===0),b).map(marker)},
    async(name,args)=>name==='vtg_snapshot'?stamp:select(rows.filter((_,i)=>i%2===1 || i%7===0),{before:args.p_before,id:args.p_id}));
  let cursor=null;const ids=[];
  do{const p=await source.list('scene',cursor,signal());assert.ok(p.items.length<=60);ids.push(...p.items.map(m=>m.id));cursor=p.nextCursor;}while(cursor);
  assert.equal(ids.length,145);assert.equal(new Set(ids).size,145);assert.deepEqual(ids,rows.map(r=>r.id));
});
test('remote failure keeps private markers and exposes failure; later pages stay in private fallback mode',async()=>{
  const rows=Array.from({length:61},(_,i)=>row(i)).reverse();let requests=0;
  const source=createSceneMessages({...local,markers:async(_,b)=>rows.filter(r=>!b.before || r.id<b.id).map(marker)},
    async()=>{requests++;throw new Error('offline');},()=>stamp);
  const page=await source.list('scene',null,signal());assert.equal(page.publicStatus,'error');assert.equal(page.items.length,60);
  const next=await source.list('scene',page.nextCursor,signal());assert.equal(next.items.length,1);assert.equal(next.publicStatus,'error');assert.equal(requests,1);
  await assert.rejects(source.list('wrong',page.nextCursor,signal()));
});
test('private body never sent to RPC; public deleted body is unavailable and failed read remains error',async()=>{
  let mode='found';
  const source=createSceneMessages({...local,read:async(_,id)=>id==='private'?{kind:'found',message:{...marker(row(1)),id,body:'비공개'}}:{kind:'unavailable'}},
    async(name,args)=>{assert.equal(name,'vtg_read');assert.notEqual(args.p_id,'private');if(mode==='error')throw new Error('offline');return mode==='gone'?[]:[{...row(1),body:'공개 글'}];});
  assert.equal((await source.read('scene','private',signal())).message.origin,'private');
  assert.equal((await source.read('scene',row(1).id,signal())).message.owned,false);
  mode='gone';assert.equal((await source.read('scene',row(1).id,signal())).kind,'unavailable');
  mode='error';await assert.rejects(source.read('scene',row(1).id,signal()));
});
test('bad remote payload does not become public content; microseconds remain distinct',async()=>{
  const source=createSceneMessages(local,async(name)=>name==='vtg_snapshot'?stamp:[{...row(1),u:NaN}]);
  assert.equal((await source.list('scene',null,signal())).publicStatus,'error');
  assert.equal(timestamp('2026-11-07T01:00:00.123Z'),'2026-11-07T01:00:00.123000Z');
  assert.notEqual(timestamp(stamp),timestamp('2026-11-07T01:00:00.123455Z'));
});
