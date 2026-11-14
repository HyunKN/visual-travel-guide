const {test}=require('node:test');
const assert=require('node:assert/strict');
const {classify,locationDetails,meters,locations,nearbyPlaces}=require('../../../../.codex-build/app-message-tests/location/location.js');
const catalog=require('../place-content/catalog.json');
test('never use a stale, future, unusable or imprecise fix for distances',()=>{
  const now=80000,fix={latitude:37,longitude:126,accuracy:100,timestamp:20000};
  assert.equal(classify(fix,now),'good');
  assert.equal(classify(fix,NaN),'invalid');
  assert.equal(classify({...fix,timestamp:-1},now),'invalid');
  for(const [patch,result] of [[{timestamp:19999},'stale'],[{accuracy:101},'imprecise'],[{accuracy:null},'imprecise'],[{timestamp:80001},'invalid'],[{latitude:91},'invalid']])
    assert.equal(classify({...fix,...patch},now),result);
});
test('location display preserves measurement time and uncertainty without exposing raw coordinates',()=>{
  const now=100_000,fix=Object.freeze({latitude:37.5,longitude:126.9,accuracy:12.4,timestamp:now-59_000});
  const details=locationDetails(fix,now);
  assert.deepEqual(details,{timestamp:41_000,accuracyMeters:12.4});
  assert.notEqual(details.timestamp,now);assert.equal(details.latitude,undefined);assert.equal(details.longitude,undefined);
  assert.equal(locationDetails({...fix,accuracy:0},now).accuracyMeters,0);
  assert.equal(locationDetails({...fix,timestamp:now-60_000,accuracy:100},now).timestamp,now-60_000);
});
test('unavailable, expired, future and inaccurate samples cannot appear as current location details',()=>{
  const now=100_000,fix={latitude:37.5,longitude:126.9,accuracy:10,timestamp:now};
  for(const sample of [null,{...fix,timestamp:now-60_001},{...fix,timestamp:now+1},{...fix,accuracy:null},
    {...fix,accuracy:101},{...fix,accuracy:NaN},{...fix,latitude:91},{...fix,longitude:Infinity}])assert.equal(locationDetails(sample,now),null);
  assert.equal(locationDetails(fix,NaN),null);
  assert.equal(locationDetails({...fix,timestamp:1e20},1e20),null);
});
test('controller rechecks do not relabel an old measurement; expiry and clear remove its display',async()=>{
  const {createLocationController}=require('../../../../.codex-build/app-message-tests/location/controller.js');
  let now=100_000;
  const controller=createLocationController({requestPermission:async()=>({granted:true,canAskAgain:true}),
    servicesEnabled:async()=>true,getCurrentPosition:async()=>({latitude:37.5,longitude:126.9,accuracy:20,timestamp:99_000})},
  {now:()=>now,schedule:()=>()=>{}});
  const display=()=>{const state=controller.snapshot();return locationDetails(state.kind==='ready'?state.fix:null,state.kind==='ready'?state.checkedAt:0);};
  assert.equal(display(),null);await controller.locate();assert.equal(display().timestamp,99_000);
  now=159_000;controller.refreshAge();assert.equal(display().timestamp,99_000);
  now++;controller.refreshAge();assert.equal(controller.snapshot().kind,'stale');assert.equal(display(),null);
  now=100_000;await controller.locate();assert.equal(display().accuracyMeters,20);controller.clear();assert.equal(display(),null);
});
test('three distinct catalog buildings and straight-line distance in metres',()=>{
  assert.deepEqual(locations.map(x=>x.placeId).sort(),catalog.places.map(x=>x.id).sort());
  assert.equal(new Set(locations.map(x=>x.way)).size,3);
  assert.equal(meters(locations[0],locations[0]),0);
  assert.ok(Math.abs(meters({latitude:0,longitude:0},{latitude:0,longitude:1})-111195)<1);
});
test('nearby orders valid fixes by straight-line distance; unavailable or weak fixes expose no distance',()=>{
  const now=100_000,fix={...locations[2],accuracy:30,timestamp:now};
  const places=nearbyPlaces(fix,now);
  assert.equal(places[0].placeId,'gwanghwamun');assert.equal(places[0].distanceMeters,0);
  assert.ok(places[1].distanceMeters<=places[2].distanceMeters);
  assert.deepEqual(locations.map(x=>x.placeId),['geunjeongjeon','gyotaejeon','gwanghwamun']);
  for(const sample of [null,{...fix,timestamp:now-60_001},{...fix,accuracy:101},{...fix,longitude:NaN}]){
    const fallback=nearbyPlaces(sample,now);assert.ok(fallback.every(p=>p.distanceMeters===null));
    assert.deepEqual(fallback.map(x=>x.placeId),locations.map(x=>x.placeId));
  }
});

test('nearby returns at most ten nearest registered landmarks without mutating the catalog',()=>{
  const now=100_000,fix={latitude:37,longitude:127,accuracy:20,timestamp:now};
  const source=Array.from({length:14},(_,i)=>({placeId:`place-${i}`,latitude:37+i*.001,longitude:127,way:`${i}/1`})).reverse();
  const original=source.map(p=>p.placeId);
  const result=nearbyPlaces(fix,now,source);
  assert.equal(result.length,10);assert.equal(result[0].placeId,'place-0');assert.equal(result[9].placeId,'place-9');
  assert.deepEqual(source.map(p=>p.placeId),original);
  assert.equal(nearbyPlaces(null,now,source).length,10);
});
