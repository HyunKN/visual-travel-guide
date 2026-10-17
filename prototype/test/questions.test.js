import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexContent, reviewedQuestions } from '../src/content.js';
import { initialState, transition, canRestore } from '../src/state.js';
const data = JSON.parse(readFileSync(new URL('../../docs/prototype/content/content.json', import.meta.url), 'utf8'));
const index = indexContent(data);
const p = (id) => index.testPresets.get(id);
const act = (s, type, args = {}, i = index) => transition(s, { type, ...args }, i);

test('zero/one/two questions expose only reviewed answers, zero does not force Q', () => {
  assert.equal(reviewedQuestions(index, 'geunjeongjeon').length, 0);
  assert.equal(reviewedQuestions(index, 'courtyard-floor').length, 1);
  assert.equal(reviewedQuestions(index, 'longevity-panel').length, 2);
  const a = act(initialState(p('S2')), 'whole');
  assert.equal(act(a, 'questions'), a);
  assert.equal(canRestore({ ...a, screen: 'Q' }, p('S2'), index), true); // Old Q entry still renders an explicit empty state.
  const i = indexContent(structuredClone(data)); i.answers.get('chimney-panel-made-answer').reviewStatus = 'draft';
  assert.equal(reviewedQuestions(i, 'longevity-panel').length, 1);
});

test('unsupported question returns to overview or new exploration without a free-text response', () => {
  const a = act(initialState(p('S2')), 'whole');
  const e = act(a, 'unsupported-question');
  assert.equal(canRestore(e, p('S2'), index), true);
  assert.equal(act(e, 'overview').answerId, a.answerId);
  const n = act(e, 'new-explore'); assert.equal(canRestore(n, p('S2'), index), true);
  const v = act(n, 'choose-scene', { sceneId: 'C01' });
  assert.equal(v.questionId, null); assert.equal(v.answerId, null); assert.equal(v.targetId, null);
});

test('candidate question -> unsupported -> overview and compare retain the selected reference', () => {
  let s = act(act(initialState(p('S4')), 'view'), 'compare');
  s = act(s, 'choose-candidate', { optionId: 'option-sajeongjeon' });
  s = act(s, 'question', { questionId: 'sajeongjeon-name' });
  const e = act(s, 'unsupported-question');
  assert.equal(canRestore(e, p('S4'), index), true);
  assert.equal(act(e, 'overview').sceneId, 'C05');
  assert.equal(act(e, 'overview').answerId, 'sajeongjeon-overview');
  assert.equal(act(e, 'compare-again').screen, 'C');
  assert.equal(act(s, 'question', { questionId: 'gyeonghoeru-rebuilt' }).screen, 'E');
});
