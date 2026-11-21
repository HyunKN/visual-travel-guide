/* global __dirname */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const base=path.resolve(__dirname,'../../../../.codex-build/app-recognition-tests/recognition');
const {MODEL_OUTPUT_CONTRACT:c,decodeModelOutputs}=require(path.join(base,'modelOutputs.js'));
const {selectStory,emptyStoryEvidence,resolveStory}=require(path.join(base,'storySelection.js'));
function packet(patch={}){
  return {contractVersion:c.version,modelSha256:c.modelSha256,encoderSha256:c.encoderSha256,
    buildingLabels:[...c.buildingLabels],partLabels:[...c.partLabels],focusLabels:[...c.focusLabels],
    buildingLogits:[10000,9999,-10000],partLogits:[0,10000,10000],focusLogits:[10,-10,10,10,-10],...patch};
}
const evidence=(patch={})=>({...emptyStoryEvidence(),...patch});
test('three independent groups retain fixed label order, stable softmax and multiple sigmoid positives',()=>{
  const result=decodeModelOutputs(packet());assert.ok(result);
  assert.deepEqual(result.buildingScores.map(s=>s.label),c.buildingLabels);
  assert.ok(Math.abs(result.buildingScores.reduce((sum,s)=>sum+s.probability,0)-1)<1e-12);
  assert.deepEqual(result.partScores.map(s=>s.label),['signboard','dancheong','japsang']);
  assert.equal(result.partScores[1].probability,1);assert.equal(result.partScores[2].probability,1);
  assert.equal(result.automaticPolicyValidated,false);assert.equal(result.focus.state,'unvalidated');
});
test('five verified actual-weight CPU references match the app group adapter without accepting a subject',()=>{
  const fixture=require('./fixtures/runtime-controls-20261118.json');
  assert.equal(fixture.modelSha256,c.modelSha256);assert.equal(fixture.encoderSha256,c.encoderSha256);assert.equal(fixture.onnxSha256,c.onnxSha256);
  assert.equal(fixture.cases.length,5);
  for(const sample of fixture.cases){
    const variants=['python','runtime'].map(source=>decodeModelOutputs(packet(Object.fromEntries(Object.entries(sample.outputs).map(([head,out])=>[head,out[source]])))));
    assert.ok(variants.every(Boolean),sample.id);
    for(const head of ['buildingScores','partScores'])for(let i=0;i<3;i++)assert.ok(Math.abs(variants[0][head][i].probability-variants[1][head][i].probability)<1e-4,sample.id);
    for(let i=0;i<5;i++)assert.ok(Math.abs(variants[0].focus.scores[i].probability-variants[1].focus.scores[i].probability)<1e-4,sample.id);
    assert.equal(variants[1].automaticPolicyValidated,false);assert.equal(variants[1].focus.state,'unvalidated');
  }
});
test('missing focus is explicit unavailable; zero logits remain available diagnostic data',()=>{
  assert.deepEqual(decodeModelOutputs(packet({focusLogits:null})).focus,{state:'unavailable'});
  const r=decodeModelOutputs(packet({focusLogits:[0,0,0,0,0]}));assert.equal(r.focus.state,'unvalidated');
  assert.deepEqual(r.focus.scores.map(s=>s.probability),[.5,.5,.5,.5,.5]);
});
test('old eaves/two-part outputs, reordered labels, missing fields, hashes and invalid tensors fail closed',()=>{
  for(const patch of [{partLabels:['signboard','eaves'],partLogits:[1,2]},
    {partLabels:['japsang','dancheong','signboard']},{focusLabels:[...c.focusLabels].reverse()},
    {buildingLogits:[1,2]},{partLogits:[1,NaN,2]},{focusLogits:[1,2,Infinity,3,4]},
    {focusLogits:undefined},{modelSha256:'local-old-model'},{encoderSha256:'random-encoder'}])assert.equal(decodeModelOutputs(packet(patch)),null);
});
test('accepted overview keeps small incidental parts and explicit user choice overrides it',()=>{
  const e=evidence({building:'geunjeongjeon',elements:{signboard:'uncertain',dancheong:'accepted_present',japsang:'accepted_present'},focus:{state:'single',candidates:['building_overview']}});
  const first=selectStory(e,null,true);assert.equal(first.primaryTopic,'building');assert.equal(first.buildingId,'geunjeongjeon');
  assert.deepEqual(first.secondaryTopics,['dancheong','japsang']);
  assert.equal(selectStory(e,'japsang',true).primaryTopic,'japsang');assert.equal(selectStory(e,'japsang',true).scope,'generic');
  assert.equal(selectStory(e).mode,'choose_topic');
});
test('generic detail does not require a building and user interest is not proof of visual presence',()=>{
  const e=evidence({elements:{signboard:'uncertain',dancheong:'accepted_present',japsang:'accepted_present'},focus:{state:'single',candidates:['japsang_detail']}});
  const r=selectStory(e,null,true);assert.equal(r.primaryTopic,'japsang');assert.equal(r.scope,'generic');assert.equal(r.buildingId,null);
  assert.equal(selectStory(e,'signboard').visualPresenceConfirmed,false);
  assert.equal(selectStory(e,'building').mode,'choose_place');
});
test('multiple, other, unknown, unavailable and contradictory focus all ask rather than pick a score maximum',()=>{
  for(const focus of [{state:'multiple',candidates:['dancheong_detail','japsang_detail']},{state:'other'},
    {state:'uncertain'},{state:'unavailable'},{state:'single',candidates:['signboard_detail']}]){
    assert.equal(selectStory(evidence({focus}),null,true).mode,'choose_topic');
  }
  assert.equal(selectStory(evidence({focus:{state:'single',candidates:['building_overview']}}),null,true).mode,'choose_place');
});
test('co-detection cannot return a place-specific element story; reviewed generic content is required',()=>{
  const selection=selectStory(evidence({building:'gyotaejeon'}),'dancheong');
  const specific={id:'gyotae-dancheong',topic:'dancheong',scope:'place',placeId:'gyotaejeon',reviewed:true,title:'장소 설명',body:'장소 특정 내용',sourceIds:['reviewed']};
  assert.equal(resolveStory(selection,[specific]).kind,'unavailable');
  const generic={...specific,id:'generic-dancheong',scope:'generic',placeId:undefined};
  assert.equal(resolveStory(selection,[generic]).kind,'story');
  assert.equal(resolveStory(selection,[{...generic,reviewed:false}]).kind,'unavailable');
  assert.equal(resolveStory(selection,[{...generic,sourceIds:[]}]).kind,'unavailable');
  assert.equal(resolveStory(selectStory(evidence({building:'gyotaejeon'}),'building')).placeId,'gyotaejeon');
});
