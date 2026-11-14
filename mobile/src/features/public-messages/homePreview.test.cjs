const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHomePreview}=require('../../../../.codex-build/app-message-tests/public-messages/homePreview.js');
const row={id:'message-id',scene_id:'scene-a',u:.2,v:.7,body:'  누군가의 이야기\n둘째 줄',created_at:'2026-11-07T00:00:00.123456Z'};
test('home accepts at most 64 Unicode characters and never exposes an old server full body',async()=>{
  const allowed=createHomePreview(['scene-a'],async()=>[{...row,body:'🙂'.repeat(64)}]);await allowed.load();assert.equal(allowed.snapshot().kind,'ready');
  const oversized=createHomePreview(['scene-a'],async()=>[{...row,body:'🙂'.repeat(65)}]);await oversized.load();assert.equal(oversized.snapshot().kind,'error');
});
test('home loads one scoped public message with intact text and route IDs',async()=>{
  const c=createHomePreview(['scene-a'],async(scenes,signal)=>{
    assert.deepEqual(scenes,['scene-a']);assert.equal(signal.aborted,false);return [row];
  });
  await c.load();const s=c.snapshot();assert.equal(s.kind,'ready');
  assert.equal(s.message.id,row.id);assert.equal(s.message.sceneId,row.scene_id);assert.equal(s.message.body,row.body);assert.equal(s.message.origin,'public');
});
test('unconfigured, empty and failed preview never replace missing data with examples',async()=>{
  for(const rpc of [null,async()=>[],async()=>{throw new Error('offline');}]){
    const c=createHomePreview(['scene-a'],rpc);await c.load();assert.notEqual(c.snapshot().kind,'ready');
  }
});
test('unknown scene, oversized or empty body and multiple rows cannot enter home',async()=>{
  for(const rows of [[{...row,scene_id:'other'}],[{...row,body:' '}],[{...row,body:'한'.repeat(5500)}],[row,row]]){
    const c=createHomePreview(['scene-a'],async()=>rows);await c.load();assert.equal(c.snapshot().kind,'error');
  }
});
test('leaving home or a newer refresh invalidates delayed preview and cancels its request',async()=>{
  let resolve,signal;
  const c=createHomePreview(['scene-a'],async(_,s)=>{signal=s;return new Promise(r=>{resolve=r;});});
  const loading=c.load();assert.equal(c.snapshot().kind,'loading');c.clear();assert.equal(signal.aborted,true);
  resolve([row]);await loading;assert.equal(c.snapshot().kind,'idle');
  let firstResolve,n=0;
  const next=createHomePreview(['scene-a'],async()=>++n===1?new Promise(r=>{firstResolve=r;}):[]);
  const first=next.load();await next.load();firstResolve([row]);await first;assert.equal(next.snapshot().kind,'empty');
});
