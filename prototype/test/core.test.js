import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateContent, indexContent, pointInImage, hitTarget, answerProblem } from '../src/content.js';
import { initialState, transition, canRestore } from '../src/state.js';

const original = JSON.parse(readFileSync(new URL('../../docs/prototype/content/content.json', import.meta.url), 'utf8'));
const index = indexContent(original);
const preset = (id) => index.testPresets.get(id);
const act = (s, type, extra = {}, i = index) => transition(s, { type, ...extra }, i);

test('actual reviewed content has consistent scene/target/question/source links', () => {
  assert.deepEqual(validateContent(original), []);
  assert.equal(original.scenes.length, 6);
});

test('rejects mismatched question, dangling source, missing attribution, wrong parent and overlapping regions', () => {
  const mutations = [
    (d) => { d.questions[0].targetId = 'courtyard-floor'; },
    (d) => { d.answers[0].sourceIds = ['absent']; },
    (d) => { d.assets[0].creatorCredit = ''; },
    (d) => { d.targets[2].parentTargetId = 'longevity-panel'; },
    (d) => { d.scenes[2].regions[1].y = 0.46; },
    (d) => { d.cards[0].sceneId = 'C02'; },
    (d) => { d.assets[0].localPath = '../private-file.jpg'; },
  ];
  for (const mutate of mutations) {
    const d = structuredClone(original); mutate(d);
    assert.ok(validateContent(d).length > 0);
  }
});

test('contain excludes letterbox and maps image/region edges without snapping', () => {
  assert.equal(pointInImage(100, 20, 200, 300, 2000, 1000), null);
  assert.deepEqual(pointInImage(0, 100, 200, 300, 2000, 1000), { x: 0, y: 0 });
  assert.deepEqual(pointInImage(200, 200, 200, 300, 2000, 1000), { x: 1, y: 1 });
  assert.equal(pointInImage(10, 10, 0, 0, 2000, 1000), null);
  const scene = index.scenes.get('C02');
  assert.equal(hitTarget(scene, { x: 0.32, y: 0.82 }), 'courtyard-floor');
  assert.equal(hitTarget(scene, { x: 0.31, y: 0.82 }), null);
  assert.equal(hitTarget(scene, { x: 0.5, y: 0.3 }), null);
});

test('whole building, prepared question, overview, correction and unsupported question', () => {
  let s = initialState(preset('S1'));
  s = act(s, 'view'); assert.equal(s.screen, 'V');
  s = act(s, 'whole'); assert.equal(s.answerId, 'gyeonghoeru-overview');
  s = act(s, 'questions'); assert.equal(s.screen, 'Q');
  s = act(s, 'question', { questionId: 'gyeonghoeru-rebuilt' });
  assert.equal(s.answerId, 'gyeonghoeru-rebuilt-answer');
  s = act(s, 'overview'); assert.equal(s.questionId, null);
  s = act(s, 'unsupported-question'); assert.equal(s.error, 'unsupported-question');
  s = act(s, 'view'); assert.equal(s.targetId, null); assert.equal(s.answerId, null);
});

test('part taps need confirmation; new unsupported tap clears downstream values', () => {
  let s = initialState(preset('S2'));
  s = act(s, 'point', { point: { x: 0.5, y: 0.9 } });
  assert.equal(s.screen, 'V'); assert.equal(s.answerId, null);
  s = act(s, 'confirm'); assert.equal(s.answerId, 'courtyard-floor-overview');
  s = act(s, 'point', { point: { x: 0.5, y: 0.2 } });
  assert.equal(s.targetId, null); assert.equal(s.answerId, null); assert.equal(s.error, 'unsupported-part');
});

test('card keeps scene and target; chimney cannot select an absent whole building', () => {
  let s = act(initialState(preset('S3')), 'card');
  assert.equal(s.screen, 'A'); assert.equal(s.targetId, 'longevity-panel');
  assert.equal(s.sceneId, 'C03'); assert.equal(s.entryOrigin, 'card');
  s = act(s, 'view'); const unchanged = act(s, 'whole'); assert.equal(unchanged, s);
  s = act(s, 'text-target', { targetId: 'smoke-outlets' });
  s = act(s, 'confirm'); assert.equal(s.answerId, 'smoke-outlets-overview');
  const off = { ...preset('S3'), cardVisible: false };
  s = initialState(off); assert.equal(act(s, 'card'), s);
});

test('draft, missing answer and missing source fail closed rather than show unrelated text', () => {
  for (const [mutate, expected] of [
    [(i) => i.answers.delete('gyeonghoeru-overview'), 'missing-answer'],
    [(i) => { i.answers.get('gyeonghoeru-overview').reviewStatus = 'draft'; }, 'missing-answer'],
    [(i) => i.sources.clear(), 'missing-source'],
  ]) {
    const i = indexContent(structuredClone(original)); mutate(i);
    const s = act(initialState(preset('S1')), 'whole', {}, i);
    assert.equal(s.screen, 'E'); assert.equal(s.answerId, null); assert.equal(s.error, expected);
  }
  assert.equal(answerProblem(index, 'courtyard-floor', 'gyeonghoeru-overview'), 'missing-answer');
});

test('history restoration rejects stale scene/settings or corrupt answer references', () => {
  const p = preset('S1'), s = act(initialState(p), 'whole');
  assert.equal(canRestore(s, p, index), true);
  assert.equal(canRestore(s, preset('S2'), index), false);
  assert.equal(canRestore({ ...s, answerId: 'smoke-outlets-overview' }, p, index), false);
  assert.equal(canRestore({ ...s, screen: 'not-a-screen' }, p, index), false);
  assert.equal(canRestore(s, { ...p, cardVisible: true }, index), false);
});
