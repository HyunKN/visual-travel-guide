const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createLocationController}=require('../../../../.codex-build/app-message-tests/location/controller.js');
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function setup(overrides={}){
  let clock=100_000;
  const calls=[],timers=[];
  const sample={latitude:37,longitude:126,accuracy:100,timestamp:100_000};
  const port={
    requestPermission:async()=>{calls.push('permission');return {granted:true,canAskAgain:true};},
    servicesEnabled:async()=>{calls.push('services');return true;},
    getCurrentPosition:async()=>{calls.push('position');return sample;},
    ...overrides,
  };
  const api=createLocationController(port,{now:()=>clock,schedule:(callback,ms)=>{
    const timer={callback,ms,active:true};timers.push(timer);return ()=>{timer.active=false;};
  }});
  return {api,port,calls,timers,sample,setNow:value=>{clock=value;},fire:ms=>{
    const timer=timers.find(t=>t.active&&t.ms===ms);assert.ok(timer,`active ${ms}ms timer`);timer.active=false;timer.callback();
  }};
}
test('mounting/subscribing/refreshing never requests permissions or starts background tracking',()=>{
  const h=setup();let notifications=0;const unsubscribe=h.api.subscribe(()=>notifications++);
  h.api.refreshAge();assert.deepEqual(h.api.snapshot(),{kind:'idle'});assert.deepEqual(h.calls,[]);
  unsubscribe();h.api.clear();assert.equal(notifications,0);
});
test('explicit request checks permission and provider, returns immutable minimal position and stops request timer',async()=>{
  const h=setup();h.sample.altitude=123;
  await h.api.locate();
  assert.deepEqual(h.calls,['permission','services','position']);
  const state=h.api.snapshot();assert.equal(state.kind,'ready');assert.ok(Object.isFrozen(state));assert.ok(Object.isFrozen(state.fix));
  assert.deepEqual(Object.keys(state.fix).sort(),['accuracy','latitude','longitude','timestamp']);
  h.sample.latitude=12;assert.equal(state.fix.latitude,37);
  assert.equal(h.timers.filter(t=>t.active&&t.ms===15_000).length,0);
  assert.equal(h.timers.filter(t=>t.active&&t.ms===60_001).length,1);
  h.api.clear();
});
test('permission denial retains canAskAgain and never reads coordinates or checks providers',async()=>{
  for(const canAskAgain of [true,false]){
    const h=setup({requestPermission:async()=>({granted:false,canAskAgain})});
    await h.api.locate();assert.deepEqual(h.api.snapshot(),{kind:'denied',canAskAgain});assert.deepEqual(h.calls,[]);
    assert.equal(h.timers.filter(t=>t.active).length,0);
  }
});
test('disabled location services has its own recovery state and never calls GPS',async()=>{
  const h=setup({servicesEnabled:async()=>false});await h.api.locate();
  assert.deepEqual(h.api.snapshot(),{kind:'disabled'});assert.deepEqual(h.calls,['permission']);
});
test('leaving/cancelling during permission, provider check or GPS prevents all later application',async()=>{
  for(const method of ['requestPermission','servicesEnabled','getCurrentPosition']){
    const work=deferred(),h=setup({[method]:()=>work.promise});
    const pending=h.api.locate();await Promise.resolve();await Promise.resolve();
    h.api.clear();assert.deepEqual(h.api.snapshot(),{kind:'idle'});
    work.resolve(method==='requestPermission'?{granted:true,canAskAgain:true}:method==='servicesEnabled'?true:h.sample);
    await pending;assert.deepEqual(h.api.snapshot(),{kind:'idle'});
    assert.equal(h.timers.filter(t=>t.active).length,0);
    if(method!=='getCurrentPosition')assert.ok(!h.calls.includes('position'));
  }
});
test('15-second timeout invalidates a pending permission result before it can start GPS',async()=>{
  const work=deferred(),h=setup({requestPermission:()=>work.promise});
  const pending=h.api.locate();h.fire(15_000);assert.equal(h.api.snapshot().kind,'timeout');
  work.resolve({granted:true,canAskAgain:true});await pending;
  assert.equal(h.api.snapshot().kind,'timeout');assert.deepEqual(h.calls,[]);
});
test('late native success or rejection after timeout cannot overwrite a successful manual retry',async()=>{
  for(const reject of [false,true]){
    const work=deferred(),h=setup({getCurrentPosition:()=>work.promise});
    const pending=h.api.locate();await Promise.resolve();await Promise.resolve();
    h.fire(15_000);assert.equal(h.api.snapshot().kind,'timeout');
    h.port.getCurrentPosition=async()=>({...h.sample,latitude:38});
    await h.api.locate();assert.equal(h.api.snapshot().fix.latitude,38);
    if(reject)work.reject(Error('late GPS error'));else work.resolve(h.sample);
    await pending;assert.equal(h.api.snapshot().fix.latitude,38);h.api.clear();
  }
});
test('repeated taps while requesting do not launch another permission request',async()=>{
  const work=deferred();let calls=0;
  const h=setup({requestPermission:()=>{calls++;return work.promise;}});
  const pending=h.api.locate();await h.api.locate();assert.equal(calls,1);
  work.resolve({granted:false,canAskAgain:true});await pending;assert.equal(h.api.snapshot().kind,'denied');
});
test('stale, future, imprecise and malformed samples expose no fix for map or distances',async()=>{
  for(const [patch,kind] of [[{timestamp:39_999},'stale'],[{timestamp:100_001},'invalid'],[{accuracy:null},'imprecise'],[{accuracy:101},'imprecise'],[{latitude:NaN},'invalid']]){
    const h=setup({getCurrentPosition:async()=>({latitude:37,longitude:126,accuracy:50,timestamp:100_000,...patch})});
    await h.api.locate();assert.deepEqual(h.api.snapshot(),{kind});assert.equal(h.timers.filter(t=>t.active).length,0);
  }
});
test('60-second boundary and foreground recheck expire a fix even when a timer was suspended',async()=>{
  const h=setup();await h.api.locate();h.setNow(160_000);h.api.refreshAge();assert.equal(h.api.snapshot().kind,'ready');
  h.setNow(160_001);h.api.refreshAge();assert.deepEqual(h.api.snapshot(),{kind:'stale'});
  assert.equal(h.timers.filter(t=>t.active).length,0);
  const other=setup();await other.api.locate();other.setNow(160_001);other.fire(60_001);assert.equal(other.api.snapshot().kind,'stale');
});
test('clear discards ready coordinates and expiry timers without acquiring another position',async()=>{
  const h=setup();await h.api.locate();h.api.clear();
  assert.deepEqual(h.api.snapshot(),{kind:'idle'});assert.equal(h.timers.filter(t=>t.active).length,0);
  h.api.refreshAge();assert.equal(h.calls.length,3);
});
test('permission/provider/position errors are recoverable only through a new explicit request',async()=>{
  for(const method of ['requestPermission','servicesEnabled','getCurrentPosition']){
    const h=setup();const original=h.port[method];h.port[method]=async()=>{throw Error('native failure');};
    await h.api.locate();assert.deepEqual(h.api.snapshot(),{kind:'error'});
    assert.equal(h.timers.filter(t=>t.active).length,0);
    h.port[method]=original;await h.api.locate();assert.equal(h.api.snapshot().kind,'ready');h.api.clear();
  }
});
