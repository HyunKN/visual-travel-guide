import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateContent, indexContent, configurePreset } from '../src/content.js';
import { initialState, transition, canRestore, explorationScenes } from '../src/state.js';

const data = JSON.parse(readFileSync(new URL('../../docs/prototype/content/content.json', import.meta.url), 'utf8'));
const index = indexContent(data);
const preset = (id) => index.testPresets.get(id);
const act = (s, type, extra = {}, p = preset(s.presetId)) => transition(s, { type, ...extra }, index, p);

test('v2 rejects legacy, broken comparisons, clues, destinations and inconsistent navigation', () => {
  const mutations = [
    (d) => { d.schemaVersion = 1; },
    (d) => { delete d.comparisonCases; },
    (d) => { delete d.comparisonCases[0].options; },
    (d) => { d.comparisonCases[0].options.pop(); },
    (d) => { d.comparisonCases[0].options.push(structuredClone(d.comparisonCases[0].options[0])); },
    (d) => { d.comparisonCases[0].options[1].targetId = 'sajeongjeon'; },
    (d) => { d.comparisonCases[0].options[0].referenceSceneId = 'missing'; },
    (d) => { d.comparisonCases[0].options[0].clues[0].sourceIds = ['missing']; },
    (d) => { d.answers.find((a) => a.id === 'sajeongjeon-overview').reviewStatus = 'draft'; },
    (d) => { d.comparisonCases[0].reviewStatus = 'draft'; },
    (d) => { d.continuations[0].toTargetId = 'gyeonghoeru'; },
    (d) => { d.continuations[0].toSceneId = 'C02'; },
    (d) => { d.continuations.push(structuredClone(d.continuations[0])); },
    (d) => { d.testPresets[0].navigationScenes[0].contextKey = 'wrong'; },
    (d) => { d.testPresets[0].navigationScenes.push(d.testPresets[0].navigationScenes[0]); },
    (d) => { d.testPresets[3].navigationScenes.pop(); },
    (d) => { d.testPresets[3].comparisonCaseId = 'missing'; },
  ];
  for (const mutate of mutations) {
    const broken = structuredClone(data); mutate(broken);
    assert.ok(validateContent(broken).length > 0, mutate.toString());
  }
});

test('runtime URL/test overrides normalize only the start navigation entry', () => {
  const p = configurePreset(index, 'S3', { contextKey: 'before-visit', cardVisible: false });
  assert.equal(canRestore(initialState(p), p, index), true);
  assert.equal(p.navigationScenes.find((n) => n.sceneId === 'C03').contextKey, 'before-visit');
  assert.equal(p.navigationScenes.find((n) => n.sceneId === 'C02').contextKey, 'courtyard-area');
  assert.equal(preset('S3').contextKey, 'chimney-area');
  assert.equal(configurePreset(index, 'S2', { contextKey: 'chimney-area' }), null);
  assert.equal(configurePreset(index, 'S1', { cardVisible: '1' }), null);
  assert.equal(configurePreset(index, 'absent'), null);
});

test('new exploration clears old selection and changes scene/context/card together; history restores both answers', () => {
  const p = preset('S3');
  const originalAnswer = act(initialState(p), 'card');
  const n = act(originalAnswer, 'new-explore');
  assert.equal(n.screen, 'N'); assert.equal(n.answerId, originalAnswer.answerId);
  const v = act(n, 'choose-scene', { sceneId: 'C02' });
  assert.equal(v.sceneId, 'C02'); assert.equal(v.contextKey, 'courtyard-area'); assert.equal(v.cardVisible, false);
  for (const key of ['targetId', 'questionId', 'answerId', 'point', 'comparisonCaseId', 'comparisonOptionId', 'entryOrigin']) assert.equal(v[key], null);
  const answer = act(v, 'whole');
  assert.equal(answer.answerId, 'geunjeongjeon-overview');
  for (const snapshot of [originalAnswer, n, v, answer]) assert.equal(canRestore(snapshot, p, index), true);
  const home = act(answer, 'home');
  assert.equal(home.sceneId, 'C02'); assert.equal(home.screen, 'H'); assert.equal(home.targetId, null);
  assert.equal(canRestore(answer, p, index), true);
  assert.equal(canRestore(answer, preset('S2'), index), false);
  assert.equal(canRestore({ ...answer, contextKey: 'chimney-area' }, p, index), false);
  assert.equal(canRestore({ ...answer, answerId: originalAnswer.answerId }, p, index), false);
  assert.equal(act(n, 'choose-scene', { sceneId: 'C03' }), n);
  assert.equal(act(n, 'choose-scene', { sceneId: 'C04' }), n);
  assert.equal(act(answer, 'choose-scene', { sceneId: 'C01' }), answer);
});

test('candidate references stay hidden before S4 and empty exploration remains restorable', () => {
  for (const id of ['S1', 'S2', 'S3']) {
    const s = act(initialState(preset(id)), 'whole');
    assert.ok(explorationScenes(s, preset(id), index).every((n) => !['C04', 'C05', 'C06'].includes(n.sceneId)));
    assert.equal(canRestore({ ...initialState(preset(id)), sceneId: 'C04', contextKey: 'comparison-area', cardVisible: false }, preset(id), index), false);
    if (id !== 'S3') {
      assert.ok(explorationScenes(s, preset(id), index).every((n) => n.sceneId !== 'C03'));
      assert.equal(canRestore({ ...initialState(preset(id)), sceneId: 'C03', contextKey: 'chimney-area', cardVisible: true }, preset(id), index), false);
    }
  }
  const s = act(initialState(preset('S4')), 'whole'); // Candidate UI is P03; test empty N infrastructure only.
  const n = act(s, 'new-explore');
  assert.deepEqual(explorationScenes(n, preset('S4'), index), []);
  assert.equal(canRestore(n, preset('S4'), index), true);
});

test('restoration rejects hidden stale values and out-of-photo points', () => {
  const s = initialState(preset('S1'));
  for (const bad of [
    { ...s, screen: 'N' }, { ...s, answerId: 'gyeonghoeru-overview' },
    { ...s, comparisonCaseId: 'compare-single-storey-halls' },
    { ...s, screen: 'V', point: { x: 3, y: 0.5 } },
    { ...s, screen: 'V', questionId: 'gyeonghoeru-rebuilt' },
  ]) assert.equal(canRestore(bad, preset('S1'), index), false);
});
