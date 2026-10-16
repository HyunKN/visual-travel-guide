import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexContent } from '../src/content.js';
import { initialState, transition, canRestore } from '../src/state.js';

const data = JSON.parse(readFileSync(new URL('../../docs/prototype/content/content.json', import.meta.url), 'utf8'));
const index = indexContent(data), preset = index.testPresets.get('S4');
const act = (s, type, args = {}, i = index) => transition(s, { type, ...args }, i, preset);
const comparison = () => act(act(initialState(preset), 'view'), 'compare');

test('S4 only enters prepared comparison explicitly; whole/text/tap cannot reveal the input answer', () => {
  const v = act(initialState(preset), 'view');
  for (const [type, args] of [['whole', {}], ['text-target', { targetId: 'sujeongjeon' }], ['point', { point: { x: .5, y: .5 } }]]) assert.equal(act(v, type, args), v);
  assert.equal(comparison().screen, 'C');
  const p = index.testPresets.get('S1'), other = transition(initialState(p), { type: 'view' }, index, p);
  assert.equal(transition(other, { type: 'compare' }, index, p), other);
});

test('candidate A -> question -> compare again -> B changes reference scene, target, answer and context atomically', () => {
  let s = comparison(); assert.equal(s.comparisonOptionId, null);
  s = act(s, 'choose-candidate', { optionId: 'option-sajeongjeon' });
  assert.equal(s.sceneId, 'C05'); assert.equal(s.targetId, 'sajeongjeon'); assert.equal(s.answerId, 'sajeongjeon-overview');
  assert.equal(s.contextKey, 'reference-sajeongjeon'); assert.equal(s.entryOrigin, 'candidate');
  s = act(s, 'questions'); s = act(s, 'question', { questionId: 'sajeongjeon-name' });
  assert.equal(canRestore(s, preset, index), true);
  s = act(s, 'compare-again');
  assert.equal(s.sceneId, 'C04'); assert.equal(s.answerId, null); assert.equal(s.questionId, null);
  assert.equal(s.comparisonOptionId, 'option-sajeongjeon'); assert.equal(canRestore(s, preset, index), true);
  s = act(s, 'choose-candidate', { optionId: 'option-sujeongjeon' });
  assert.equal(s.sceneId, 'C06'); assert.equal(s.targetId, 'sujeongjeon'); assert.equal(s.answerId, 'sujeongjeon-overview');
  assert.equal(s.contextKey, 'gyeonghoeru-south-area'); assert.equal(canRestore(s, preset, index), true);
  assert.equal(s.questionId, null); assert.equal(s.point, null);
});

test('none/retry/new exploration preserve the input without selecting or correcting a candidate', () => {
  const e = act(comparison(), 'no-candidate');
  assert.equal(e.error, 'no-candidate'); assert.equal(e.targetId, null); assert.equal(canRestore(e, preset, index), true);
  const n = act(e, 'new-explore'); assert.equal(n.screen, 'N'); assert.equal(canRestore(n, preset, index), true);
  const v = act(e, 'retry-comparison-photo'); assert.equal(v.screen, 'V'); assert.equal(v.sceneId, 'C04'); assert.equal(canRestore(v, preset, index), true);
  assert.equal(act(v, 'compare').screen, 'C');
  const a = act(comparison(), 'choose-candidate', { optionId: 'option-sajeongjeon' });
  assert.equal(a.targetId, 'sajeongjeon'); // Deliberately do not auto-correct the user's selection.
});

test('forged option/case/target/reference histories cannot open another building answer', () => {
  const c = comparison(), a = act(c, 'choose-candidate', { optionId: 'option-sajeongjeon' });
  assert.equal(act(c, 'choose-candidate', { optionId: 'sujeongjeon' }), c);
  for (const bad of [
    { ...a, sceneId: 'C04', contextKey: 'comparison-area' },
    { ...a, targetId: 'sujeongjeon', answerId: 'sujeongjeon-overview' },
    { ...a, comparisonCaseId: 'missing' }, { ...a, comparisonOptionId: 'option-sujeongjeon' },
    { ...a, entryOrigin: 'whole' }, { ...c, targetId: 'sujeongjeon' },
  ]) assert.equal(canRestore(bad, preset, index), false);
  const broken = indexContent(structuredClone(data)); broken.sources.clear();
  const e = act(c, 'choose-candidate', { optionId: 'option-sajeongjeon' }, broken);
  assert.equal(e.screen, 'E'); assert.equal(e.error, 'missing-source'); assert.equal(e.answerId, null);
  assert.equal(canRestore(e, preset, broken), true);
});
