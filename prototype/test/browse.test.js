import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexContent, configurePreset } from '../src/content.js';
import { browsePreset, searchTargets } from '../src/browse.js';
import { initialState, transition, canRestore, explorationScenes, availableContinuation } from '../src/state.js';

const data = JSON.parse(readFileSync(new URL('../../docs/prototype/content/content.json', import.meta.url), 'utf8'));
const index = indexContent(data);
const preset = browsePreset(index, configurePreset(index, 'S1'));
const act = (s, type, extra = {}) => transition(s, { type, ...extra }, index, preset);

test('every scenario only changes the start; all six photos remain available', () => {
  for (const start of index.testPresets.values()) {
    const p = browsePreset(index, start);
    const s = transition(initialState(p), { type: 'new-explore' }, index, p);
    assert.equal(s.screen, 'N');
    assert.equal(explorationScenes(s, p, index).length, data.scenes.length);
    assert.equal(canRestore(s, p, index), true);
  }
  assert.equal(index.testPresets.get('S1').navigationScenes.length, 2, 'legacy input is not mutated');
});

test('photo input, comparison, correction, question and home stay in one run', () => {
  let s = act(initialState(preset), 'new-explore');
  s = act(s, 'choose-scene', { sceneId: 'C04' });
  s = act(s, 'compare'); assert.equal(s.screen, 'C');
  assert.equal(canRestore(s, preset, index), true);
  s = act(s, 'choose-candidate', { optionId: 'option-sajeongjeon' });
  assert.equal(s.targetId, 'sajeongjeon');
  s = act(s, 'compare-again');
  s = act(s, 'choose-candidate', { optionId: 'option-sujeongjeon' });
  assert.equal(s.targetId, 'sujeongjeon'); assert.equal(canRestore(s, preset, index), true);
  s = act(s, 'home'); assert.equal(s.screen, 'H'); assert.equal(s.presetId, 'S1');
  s = act(s, 'card', { cardId: 'chimney-curiosity' });
  assert.equal(s.targetId, 'longevity-panel'); assert.equal(canRestore(s, preset, index), true);
});

test('search matches prepared names, parts and multiword terms, never fabricates a result', () => {
  assert.equal(searchTargets(index, ' 근정전   바닥 ')[0].target.id, 'courtyard-floor');
  assert.ok(searchTargets(index, '문양').some(r => r.target.id === 'longevity-panel'));
  assert.equal(searchTargets(index, '수정전')[0].sceneId, 'C06');
  assert.deepEqual(searchTargets(index, '없는건물xyz'), []);
  assert.deepEqual(searchTargets(index, '<img onerror=alert(1)>'), []);
  const broken = indexContent(structuredClone(data)); broken.sources.clear();
  assert.deepEqual(searchTargets(broken, ''), []);
});

test('search history retains query and rejects unrelated result and forged snapshots', () => {
  let s = act(initialState(preset), 'search');
  s = act(s, 'search-query', { query: '바닥' });
  assert.equal(canRestore(s, preset, index), true);
  assert.equal(act(s, 'open-search-result', { targetId: 'sajeongjeon' }), s);
  const result = act(s, 'open-search-result', { targetId: 'courtyard-floor' });
  assert.equal(result.answerId, 'courtyard-floor-overview');
  assert.equal(result.navTab, 'search'); assert.equal(result.query, '바닥');
  assert.equal(canRestore(result, preset, index), true);
  assert.equal(canRestore({ ...s, query: {} }, preset, index), false);
  assert.equal(canRestore({ ...s, targetId: 'sajeongjeon' }, preset, index), false);
  assert.equal(canRestore({ ...result, answerId: 'sajeongjeon-overview' }, preset, index), false);
});

test('next viewing is available outside S5 and clears the previous search answer', () => {
  let s = act(initialState(preset), 'search');
  s = act(s, 'open-search-result', { targetId: 'gyeonghoeru' });
  const next = availableContinuation(s, preset, index);
  assert.ok(next);
  s = act(s, 'open-continuation', { continuationId: next.id });
  assert.equal(s.targetId, 'sujeongjeon'); assert.equal(s.questionId, null);
  assert.equal(canRestore(s, preset, index), true);
});
