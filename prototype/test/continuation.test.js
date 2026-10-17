import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexContent } from '../src/content.js';
import { initialState, transition, canRestore, availableContinuation } from '../src/state.js';
const data = JSON.parse(readFileSync(new URL('../../docs/prototype/content/content.json', import.meta.url), 'utf8'));
const index = indexContent(data), preset = index.testPresets.get('S5');
const act = (s, type, extra = {}, i = index, p = preset) => transition(s, { type, ...extra }, i, p);

test('only reviewed, allowed, sourced continuation appears; no S3 pre-exposure and no self link', () => {
  const a = act(initialState(preset), 'whole');
  assert.equal(availableContinuation(a, preset, index).toSceneId, 'C06');
  assert.equal(availableContinuation(a, index.testPresets.get('S1'), index), undefined);
  assert.equal(availableContinuation(a, index.testPresets.get('S3'), index), undefined);
  for (const change of [
    (i) => { i.continuations.values().next().value.reviewStatus = 'draft'; },
    (i) => { i.continuations.values().next().value.toTargetId = 'gyeonghoeru'; },
    (i) => { i.continuations.values().next().value.toSceneId = 'C03'; },
    (i) => { i.sources.clear(); },
    (i) => { i.answers.delete('sujeongjeon-overview'); },
  ]) {
    const i = indexContent(structuredClone(data)); change(i);
    assert.equal(availableContinuation(a, preset, i), undefined);
  }
});

test('continuation opens destination overview with atomic context and clean question/point/comparison state', () => {
  let a = act(initialState(preset), 'whole');
  a = act(a, 'question', { questionId: 'gyeonghoeru-rebuilt' });
  const next = act(a, 'open-continuation', { continuationId: 'gyeonghoeru-to-sujeongjeon' });
  assert.equal(next.sceneId, 'C06'); assert.equal(next.contextKey, 'gyeonghoeru-south-area'); assert.equal(next.cardVisible, false);
  assert.equal(next.targetId, 'sujeongjeon'); assert.equal(next.answerId, 'sujeongjeon-overview'); assert.equal(next.entryOrigin, 'continuation');
  for (const k of ['questionId', 'point', 'comparisonCaseId', 'comparisonOptionId']) assert.equal(next[k], null);
  assert.equal(canRestore(a, preset, index), true); assert.equal(canRestore(next, preset, index), true);
  assert.equal(availableContinuation(next, preset, index), undefined);
  const q = act(act(next, 'questions'), 'question', { questionId: 'sujeongjeon-jiphyeonjeon-site' });
  assert.equal(q.targetId, 'sujeongjeon'); assert.equal(canRestore(q, preset, index), true);
});

test('unrelated or forbidden continuation action cannot move the scene', () => {
  const a = act(initialState(preset), 'whole');
  assert.equal(act(a, 'open-continuation', { continuationId: 'missing' }), a);
  const p = index.testPresets.get('S1'), s = act(initialState(p), 'whole', {}, index, p);
  assert.equal(act(s, 'open-continuation', { continuationId: 'gyeonghoeru-to-sujeongjeon' }, index, p), s);
});
