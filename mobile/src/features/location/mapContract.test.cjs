const {test}=require('node:test');
const assert=require('node:assert/strict');
const {meters}=require('../../../../.codex-build/app-message-tests/location/location.js');
const {lngLat,mapStyleUrl,placeFeatures,pressedPlace,fixFeatures,nearbyMapBounds,palaceBounds,createMapLoad}=require('../../../../.codex-build/app-message-tests/location/mapContract.js');
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

test('camera may include a nearby fix but a distant or expired fix never replaces palace framing',()=>{
  const bounds=nearbyMapBounds(fix,now);assert.ok(bounds);
  assert.ok(bounds[0]<=palaceBounds[0]&&bounds[1]<=palaceBounds[1]&&bounds[2]>=palaceBounds[2]&&bounds[3]>=palaceBounds[3]);
  assert.equal(nearbyMapBounds({...fix,latitude:35.1,longitude:129.1},now),null);
  assert.equal(nearbyMapBounds({...fix,longitude:126.998},now),null);
  assert.equal(fixFeatures({...fix,longitude:179.9999},now).accuracy.features.length,0);
  assert.equal(nearbyMapBounds({...fix,timestamp:now-60001},now),null);
  assert.equal(nearbyMapBounds(null,now),null);
});

test('one map attempt covers import and rendering timeout; failure stays terminal and late old callbacks are ignored',()=>{
  let fail=0,fire,stopped=0;
  const attempt=createMapLoad(()=>fail++,(fn,ms)=>{assert.equal(ms,15000);fire=fn;return()=>stopped++;});
  fire();assert.equal(attempt.snapshot(),'failed');assert.equal(fail,1);
  attempt.ready();attempt.fail();assert.equal(attempt.snapshot(),'failed');assert.equal(fail,1);
  const retry=createMapLoad(()=>fail++,(fn)=>{fire=fn;return()=>stopped++;});
  retry.ready();assert.equal(retry.snapshot(),'ready');fire();assert.equal(fail,1);
  retry.cancel();retry.ready();retry.fail();assert.equal(retry.snapshot(),'cancelled');assert.equal(fail,1);assert.ok(stopped>=2);
});
