/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createPlaceContent } = require(path.resolve(__dirname, '../../../../.codex-build/app-content-tests/content.js'));
const bundled = require('./catalog.json');
const copy = () => structuredClone(bundled);
const {nextEditorial,decodeEditorial,emptyEditorialState,deckDirection}=require('../../../../.codex-build/app-content-tests/editorial.js');

test('editorial bag consumes every reviewed candidate once and avoids the restart boundary duplicate',()=>{
  const api=createPlaceContent(copy()),ids=api.listEditorialStories().map(x=>x.entry.id);
  assert.equal(ids.length,9);
  let state=emptyEditorialState;const seen=[];
  for(let i=0;i<ids.length;i++){const next=nextEditorial(ids,state,()=>0);seen.push(next.id);state=decodeEditorial(JSON.stringify(next.state));}
  assert.equal(new Set(seen).size,ids.length);
  const next=nextEditorial(ids,state,()=>0);assert.notEqual(next.id,seen.at(-1));
  assert.equal(nextEditorial([],state).id,null);assert.equal(nextEditorial(['one'],{remaining:[],last:'one'}).id,'one');
  assert.deepEqual(decodeEditorial('broken'),emptyEditorialState);
  assert.equal(nextEditorial(['valid'],{remaining:['removed'],last:'removed'}).id,'valid');
});

test('editorial candidates exclude unreviewed destinations and invalid credited photos',()=>{
  const data=copy();data.entries[0].reviewed=false;data.assets[1].credit='';
  const stories=createPlaceContent(data).listEditorialStories();
  assert.equal(stories.length,3);assert.ok(stories.every(x=>x.place.id==='gwanghwamun'));
});

test('deck uses horizontal distance or matching instantaneous fling and ignores scroll, tap and reversed fling',()=>{
  assert.equal(deckDirection(-70,4,-.1),1);assert.equal(deckDirection(70,4,.1),-1);
  assert.equal(deckDirection(-15,2,-.8),1);assert.equal(deckDirection(15,2,.8),-1);
  assert.equal(deckDirection(6,1,1),0);assert.equal(deckDirection(20,40,.9),0);assert.equal(deckDirection(-20,1,.9),0);
});

test('local name search handles spaces, canonical Hangul, partial and missing names', () => {
  const api=createPlaceContent(copy());
  assert.deepEqual(api.searchBuildings(' 근 정 전 ').map(p=>p.id),['geunjeongjeon']);
  assert.deepEqual(api.searchBuildings('교태전'.normalize('NFD')).map(p=>p.id),['gyotaejeon']);
  assert.equal(api.searchBuildings('전').length,2);
  assert.equal(api.searchBuildings('부산').length,0);
  assert.deepEqual(api.searchBuildings('  '),api.listBuildings());
});
test('search never promotes unreviewed or broken content to a destination', () => {
  const data=copy();data.entries.find(e=>e.placeId==='geunjeongjeon').reviewed=false;
  assert.equal(createPlaceContent(data).searchBuildings('근정전').length,0);
});

test('all three supported places have their own reviewed entries, photo credit and source', () => {
  const api = createPlaceContent(copy());
  assert.deepEqual(api.getStartOptions().map(option => option.kind), ['direct-selection', 'camera', 'library']);
  assert.deepEqual(api.listBuildings().map(p => p.id), ['geunjeongjeon', 'gyotaejeon', 'gwanghwamun']);
  for (const place of api.listBuildings()) {
    assert.equal(api.getBuilding(place.id).status, 'ok');
    assert.equal(api.getPhoto(place.id).placeId, place.id);
    for (const id of place.entryIds) {
      const entry = api.getEntry(id, place.id);
      assert.equal(entry.status, 'ok');
      assert.ok(entry.data.sourceIds.every(s => api.getSource(s).status === 'ok'));
    }
  }
});
test('unknown IDs and entries owned by another place never return plausible substitute content', () => {
  const api = createPlaceContent(copy());
  assert.equal(api.getBuilding('unknown').status, 'not-found');
  assert.deepEqual(api.getEntry(bundled.places[0].entryIds[0], bundled.places[1].id), { status: 'error', code: 'TARGET_MISMATCH' });
  assert.deepEqual(api.getBuilding(' '), { status: 'error', code: 'INVALID_ARGUMENT' });
  assert.equal(api.getPhoto('unknown'), null);
});
test('unreviewed entries and broken source references make the place unavailable', () => {
  for (const broken of ['review', 'source', 'body']) {
    const data = copy();
    if (broken === 'review') data.entries[0].reviewed = false;
    if (broken === 'source') data.sources[0].url = 'file:///private';
    if (broken === 'body') data.entries[0].body = '  ';
    const api = createPlaceContent(data);
    assert.equal(api.getBuilding('geunjeongjeon').status, 'unavailable');
    assert.equal(api.listBuildings().length, 2);
  }
});
test('missing or wrong-place photos do not substitute another place or hide valid text', () => {
  const data = copy();
  data.assets[0].placeId = 'gyotaejeon';
  const api = createPlaceContent(data);
  assert.equal(api.getPhoto('geunjeongjeon'), null);
  assert.equal(api.getBuilding('geunjeongjeon').status, 'ok');
});
test('external source failure is retryable without changing the current place or entry', async () => {
  const api = createPlaceContent(copy());
  const before = api.getBuilding('geunjeongjeon');
  assert.deepEqual(await api.openSource('royal-geunjeongjeon', async () => { throw new Error('no handler'); }), { status: 'error', code: 'SOURCE_OPEN_FAILED' });
  let opened;
  assert.deepEqual(await api.openSource('royal-geunjeongjeon', async url => { opened = url; }), { status: 'opened' });
  assert.equal(opened, bundled.sources[0].url);
  assert.deepEqual(api.getBuilding('geunjeongjeon'), before);
});
test('missing sources never invoke an external URL opener', async () => {
  const api = createPlaceContent(copy());
  assert.deepEqual(await api.openSource('unknown', async () => assert.fail('must not open')), { status: 'error', code: 'SOURCE_NOT_FOUND' });
});
