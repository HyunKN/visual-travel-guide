const {test}=require('node:test');
const assert=require('node:assert/strict');
const {classify,meters,locations}=require('../../../../.codex-build/app-message-tests/location/location.js');
const catalog=require('../place-content/catalog.json');
test('never use a stale, future, unusable or imprecise fix for distances',()=>{
  const now=80000,fix={latitude:37,longitude:126,accuracy:100,timestamp:20000};
  assert.equal(classify(fix,now),'good');
  for(const [patch,result] of [[{timestamp:19999},'stale'],[{accuracy:101},'imprecise'],[{accuracy:null},'imprecise'],[{timestamp:80001},'invalid'],[{latitude:91},'invalid']])
    assert.equal(classify({...fix,...patch},now),result);
});
test('three distinct catalog buildings and straight-line distance in metres',()=>{
  assert.deepEqual(locations.map(x=>x.placeId).sort(),catalog.places.map(x=>x.id).sort());
  assert.equal(new Set(locations.map(x=>x.way)).size,3);
  assert.equal(meters(locations[0],locations[0]),0);
  assert.ok(Math.abs(meters({latitude:0,longitude:0},{latitude:0,longitude:1})-111195)<1);
});
