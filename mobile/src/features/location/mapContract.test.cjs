const {test}=require('node:test');
const assert=require('node:assert/strict');
const {meters}=require('../../../../.codex-build/app-message-tests/location/location.js');
const {lngLat,mapStyleUrl,placeFeatures,pressedPlace,fixFeatures,mapCameraTarget,nextMapZoom,mapZoomLimits,palaceBounds,createMapLoad}=require('../../../../.codex-build/app-message-tests/location/mapContract.js');
const now=1_000_000,fix={latitude:37.5785,longitude:126.977,accuracy:45,timestamp:now};

test('map longitude/latitude and supported feature IDs preserve place navigation',()=>{
  assert.equal(mapStyleUrl,'https://tiles.openfreemap.org/styles/liberty');
  assert.deepEqual(lngLat(fix),[126.977,37.5785]);
  assert.equal(placeFeatures.features.length,3);
  for(const f of placeFeatures.features){assert.equal(f.id,f.properties.placeId);assert.ok(f.geometry.coordinates[0]>120);assert.ok(f.geometry.coordinates[1]<40);}
  assert.equal(pressedPlace([{properties:{placeId:'unknown'}},{properties:null}]),null);
  assert.equal(pressedPlace([{properties:{placeId:'gyotaejeon'}},{properties:{placeId:'geunjeongjeon'}}]),'geunjeongjeon');
  assert.equal(pressedPlace([{properties:{placeId:'geunjeongjeon'}},{properties:{placeId:'gyotaejeon'}}],[126.9770581,37.5799157]),'gyotaejeon');
});

test('accuracy is a closed geographic metre polygon; stale and invalid samples remove both layers',()=>{
  const geo=fixFeatures(fix,now),ring=geo.accuracy.features[0].geometry.coordinates[0];
  assert.equal(ring.length,65);assert.deepEqual(ring[0],ring.at(-1));
  for(const [longitude,latitude] of ring)assert.ok(Math.abs(meters(fix,{longitude,latitude})-45)<.001);
  assert.deepEqual(geo.point.features[0].geometry.coordinates,[126.977,37.5785]);
  assert.equal(fixFeatures({...fix,accuracy:0},now).accuracy.features.length,0);
  for(const f of [null,{...fix,timestamp:now-60001},{...fix,accuracy:null},{...fix,latitude:NaN},{...fix,timestamp:now+1}]){
    const next=fixFeatures(f,now);assert.equal(next.point.features.length,0);assert.equal(next.accuracy.features.length,0);
  }
});

test('explicit location focus accepts a distant emulator fix; palace and supported-place focus remain independent',()=>{
  const remote={...fix,latitude:37.422,longitude:-122.084};
  assert.deepEqual(mapCameraTarget({kind:'location'},remote,now).center,[-122.084,37.422]);
  assert.equal(fixFeatures(remote,now).point.features.length,1);
  assert.deepEqual(mapCameraTarget({kind:'palace'},remote,now).bounds,palaceBounds);
  const place=placeFeatures.features.find(f=>f.id==='gyotaejeon');
  assert.deepEqual(mapCameraTarget({kind:'place',placeId:'gyotaejeon'},remote,now).center,place.geometry.coordinates);
  assert.equal(mapCameraTarget({kind:'place',placeId:'unknown'},remote,now),null);
  for(const invalid of [null,{...fix,timestamp:now-60001},{...fix,accuracy:101},{...fix,longitude:NaN}]){
    assert.equal(mapCameraTarget({kind:'location'},invalid,now),null);
    assert.equal(fixFeatures(invalid,now).point.features.length,0);
    assert.ok(mapCameraTarget({kind:'place',placeId:'gyotaejeon'},invalid,now));
  }
});

test('zoom buttons step from gesture zoom and clamp repeated presses at both limits',()=>{
  assert.equal(nextMapZoom(15.5,1),16.5);assert.equal(nextMapZoom(15.5,-1),14.5);
  let zoom=16;
  for(let i=0;i<30;i++)zoom=nextMapZoom(zoom,1);
  assert.equal(zoom,mapZoomLimits.max);
  for(let i=0;i<30;i++)zoom=nextMapZoom(zoom,-1);
  assert.equal(zoom,mapZoomLimits.min);assert.ok(Number.isFinite(nextMapZoom(NaN,1)));
});

test('one map attempt covers import and rendering timeout; failure stays terminal and late old callbacks are ignored',()=>{
  let fail=0,fire,stopped=0;const reasons=[];
  const attempt=createMapLoad(reason=>{fail++;reasons.push(reason);},(fn,ms)=>{assert.equal(ms,15000);fire=fn;return()=>stopped++;});
  fire();assert.equal(attempt.snapshot(),'failed');assert.equal(fail,1);
  assert.deepEqual(reasons,['timeout']);
  attempt.ready();attempt.fail();assert.equal(attempt.snapshot(),'failed');assert.equal(fail,1);
  const retry=createMapLoad(()=>fail++,(fn)=>{fire=fn;return()=>stopped++;});
  retry.ready();assert.equal(retry.snapshot(),'ready');fire();assert.equal(fail,1);
  retry.cancel();retry.ready();retry.fail();assert.equal(retry.snapshot(),'cancelled');assert.equal(fail,1);assert.ok(stopped>=2);
  for(const reason of ['native-module','import','render']){
    let callback;const errors=[];
    const load=createMapLoad(value=>errors.push(value),fn=>{callback=fn;return()=>{};});
    load.fail(reason);callback();load.ready();
    assert.equal(load.snapshot(),'failed');assert.deepEqual(errors,[reason]);
  }
});
