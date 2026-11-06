/* global __dirname */
const { Buffer } = require('node:buffer');
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const path = require('node:path');
const built = path.resolve(__dirname, '../../../../.codex-build/app-message-tests/place-messages');
const { imageRect, project, unproject, layoutMarkers } = require(path.join(built, 'geometry.js'));
const { createMessageReader } = require(path.join(built, 'reader.js'));
const { getScene } = require(path.join(built, 'scenes.js'));
const { bodyBytes, validateBody } = require(path.join(built, 'contract.js'));
const scenes = require('./scenes.json');
test('foreground refresh reopens current selection but close during refresh stays closed',async()=>{
  let finish;
  const source={list:async()=>({items:[],nextCursor:null}),read:async()=>({kind:'unavailable'})};
  const c=createMessageReader(source);await c.load('scene');await c.open('gone');
  await c.refresh('scene');assert.equal(c.snapshot().reader.kind,'unavailable');
  source.list=()=>new Promise(resolve=>{finish=resolve;});
  const refresh=c.refresh('scene');c.close();finish({items:[],nextCursor:null});await refresh;
  assert.equal(c.snapshot().reader,null);
});
const marker = (id, sceneId = 'a', anchor = { u: .5, v: .5 }) => ({ id, sceneId, anchor, createdAt: '2026-11-07T00:00:00Z' });
const message = (id, sceneId = 'a') => ({ ...marker(id, sceneId), body: '실제 내용\n두 번째 줄' });
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
test('three scenes match catalog and exact image bytes; unknown scene rejected', () => {
  assert.equal(scenes.length, 3);
  for (const row of scenes) {
    const scene = getScene(row.id);
    assert.equal(scene.placeId, row.placeId);
    const bytes = readFileSync(path.resolve(__dirname, '../../../assets/places', scene.photo.file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), scene.imageSha256);
  }
  assert.equal(getScene('missing'), null);
});
test('coordinate round trips for contain/cover, different aspect ratios and stages', () => {
  for (const image of [{ width: 2000, height: 1151 }, { width: 900, height: 1600 }])
    for (const stage of [{ width: 320, height: 500 }, { width: 390, height: 716 }, { width: 600, height: 400 }])
      for (const fit of ['contain', 'cover']) {
        const rect = imageRect(image, stage, fit);
        for (const a of [{ u: 0, v: 0 }, { u: 1, v: 1 }, { u: .5, v: .5 }, { u: .62, v: .73 }]) {
          const p = project(a, rect), result = unproject(p, rect, stage);
          if (p.x < 0 || p.y < 0 || p.x > stage.width || p.y > stage.height) assert.equal(result, null);
          else { assert.ok(Math.abs(result.u - a.u) < 1e-10); assert.ok(Math.abs(result.v - a.v) < 1e-10); }
        }
      }
});
test('letterbox, outside viewport, NaN and invalid layout cannot create anchors', () => {
  const stage = { width: 390, height: 716 }, rect = imageRect({ width: 2000, height: 1151 }, stage, 'contain');
  for (const p of [{ x: 0, y: 0 }, { x: -1, y: 400 }, { x: NaN, y: 300 }, { x: 400, y: 400 }]) assert.equal(unproject(p, rect, stage), null);
  assert.throws(() => imageRect({ width: 0, height: 1 }, stage, 'cover'));
  assert.throws(() => project({ u: Infinity, v: 0 }, rect));
});
test('60 colliding and edge markers preserve IDs, bounds and input-order independence', () => {
  const stage = { width: 390, height: 716 }, rect = imageRect({ width: 2000, height: 1151 }, stage, 'contain');
  const markers = Array.from({ length: 60 }, (_, i) => marker(String(i), 'a', { u: (i % 10) / 9, v: Math.floor(i / 10) / 5 }));
  const groups = layoutMarkers(markers, rect, stage);
  assert.deepEqual(groups, layoutMarkers([...markers].reverse(), rect, stage));
  assert.deepEqual(groups.flatMap(g => g.ids).sort(), markers.map(m => m.id).sort());
  groups.forEach((g, i) => {
    assert.ok(g.x >= 24 && g.x <= stage.width - 24 && g.y >= 24 && g.y <= stage.height - 24);
    groups.slice(i + 1).forEach(h => assert.ok(Math.abs(g.x - h.x) >= 56 || Math.abs(g.y - h.y) >= 56));
  });
  assert.throws(() => layoutMarkers([markers[0], markers[0]], rect, stage));
});
test('cover-hidden markers return in contain without changing stored anchors', () => {
  const stage = { width: 390, height: 716 }, size = { width: 2000, height: 1151 };
  const marks = [marker('left', 'a', { u: 0, v: .5 }), marker('right', 'a', { u: 1, v: .5 })];
  const before = JSON.stringify(marks);
  assert.equal(layoutMarkers(marks, imageRect(size, stage, 'cover'), stage).length, 0);
  assert.equal(layoutMarkers(marks, imageRect(size, stage, 'contain'), stage).length, 2);
  assert.equal(JSON.stringify(marks), before);
});
test('late list response cannot replace a newly selected scene', async () => {
  const a = deferred();
  const r = createMessageReader({ list: async id => id === 'a' ? a.promise : { items: [marker('b1', 'b')], nextCursor: null }, read: async () => ({ kind: 'unavailable' }) });
  const old = r.load('a'); await r.load('b'); a.resolve({ items: [marker('a1')], nextCursor: null }); await old;
  assert.equal(r.snapshot().sceneId, 'b'); assert.equal(r.snapshot().list.page.items[0].id, 'b1');
});
test('closed and superseded reads never reopen a panel', async () => {
  const a = deferred();
  const r = createMessageReader({ list: async () => ({ items: [], nextCursor: null }), read: async (_, id) => id === 'old' ? a.promise : { kind: 'found', message: message(id) } });
  await r.load('a'); const old = r.open('old'); await r.open('new');
  a.resolve({ kind: 'found', message: message('old') }); await old;
  assert.equal(r.snapshot().reader.id, 'new');
  const late = deferred(), closing = createMessageReader({ list: async () => ({ items: [], nextCursor: null }), read: async () => late.promise });
  await closing.load('a'); const pending = closing.open('x'); closing.close(); late.resolve({ kind: 'found', message: message('x') }); await pending;
  assert.equal(closing.snapshot().reader, null);
});
test('cross-scene body, duplicate markers and looping cursors fail explicitly', async () => {
  const r = createMessageReader({ list: async () => ({ items: [marker('x'), marker('x')], nextCursor: null }), read: async () => ({ kind: 'found', message: message('x', 'b') }) });
  await r.load('a'); assert.equal(r.snapshot().list.kind, 'error');
  await r.open('x'); assert.equal(r.snapshot().reader.kind, 'error');
  const loop = createMessageReader({ list: async () => ({ items: [], nextCursor: 'same' }), read: async () => ({ kind: 'unavailable' }) });
  await loop.load('a', 'same'); assert.equal(loop.snapshot().list.kind, 'error');
});
test('missing message, retried failure and genuinely empty list remain distinct', async () => {
  let fail = true;
  const r = createMessageReader({ list: async () => { if (fail) throw Error(); return { items: [], nextCursor: null }; }, read: async () => ({ kind: 'unavailable' }) });
  await r.load('a'); assert.equal(r.snapshot().list.kind, 'error'); fail = false; await r.load('a'); assert.equal(r.snapshot().list.kind, 'ready');
  await r.open('deleted'); assert.equal(r.snapshot().reader.kind, 'unavailable');
});
test('UTF-8 guard matches real encoding and supports free text beyond fifty chars', () => {
  for (const s of ['한글\n본문', 'a'.repeat(16384), '🙂', '\ud800', '\udc00']) assert.equal(bodyBytes(s), Buffer.byteLength(s));
  assert.equal(validateBody('한'.repeat(60)), null);
  assert.equal(validateBody('a'.repeat(16384)), null); assert.equal(validateBody('a'.repeat(16385)), 'too-large');
  assert.equal(validateBody(' \n\t '), 'empty');
});
