/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRecognition } = require(path.resolve(__dirname, '../../../../.codex-build/app-recognition-tests/recognition/recognition.js'));
const photo = () => ({ photoId: 'photo-a', uri: 'file:///cache/a.jpg', width: 100, height: 80, mimeType: 'image/jpeg', origin: 'library' });
const configuration = { contentVersion: '1', modelVersion: 'test-model', preprocessingVersion: 'test-preprocess', decisionPolicyVersion: 'test-policy', scoreKind: 'test-similarity', scoreOrder: 'descending', candidateLimit: 2, policyValidation: 'validated' };
const identified = input => ({ ...input, status: 'identified', selectedTargetId: 'a', candidates: [{ targetId: 'a', rank: 1, score: .8 }, { targetId: 'b', rank: 2, score: .2 }], modelVersion: configuration.modelVersion, preprocessingVersion: configuration.preprocessingVersion, decisionPolicyVersion: configuration.decisionPolicyVersion, scoreKind: configuration.scoreKind, locationUsed: false });
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function setup(overrides = {}) {
  const context = { photo: photo(), contentVersion: '1', supportedTargetIds: ['a', 'b'] };
  let onTimeout, stopped = 0, calls = 0;
  const runtime = { configuration: { ...configuration }, recognize: input => { calls++; return Promise.resolve(identified(input)); }, ...overrides };
  const api = createRecognition({ getContext: () => context, runtime: overrides.missing ? null : runtime,
    scheduleTimeout: (callback, ms) => { assert.equal(ms, 30_000); onTimeout = callback; return () => { stopped++; }; } });
  return { api, context, runtime, input: () => api.createRequest(context.photo?.photoId ?? 'absent'), timeout: () => onTimeout(), stopped: () => stopped, calls: () => calls };
}

test('missing runtime reports unavailable without invoking a model or returning sample recognition', async () => {
  const h = setup({ missing: true });
  const input = h.input();
  assert.deepEqual(await h.api.recognize(input), { ...input, status: 'error', code: 'MODEL_NOT_READY', retryable: false });
  assert.equal(h.calls(), 0);
});
test('current validated result preserves provenance, photo-only input and an immutable photo snapshot', async () => {
  const work = deferred(); let received;
  const h = setup({ recognize: (input, selected) => { received = { input, selected }; return work.promise; } });
  const input = h.input(), pending = h.api.recognize(input);
  assert.deepEqual(Object.keys(received.input).sort(), ['contentVersion', 'photoId', 'requestId']);
  assert.notEqual(received.selected, h.context.photo);
  h.context.photo.uri = 'file:///changed.jpg';
  assert.equal(received.selected.uri, 'file:///cache/a.jpg');
  assert.ok(Object.isFrozen(received.selected));
  work.resolve(identified(input));
  assert.deepEqual(await pending, identified(input));
  assert.equal(h.stopped(), 1);
});
test('unvalidated policy cannot turn even a first-ranked candidate into an identified place', async () => {
  const h = setup({ configuration: { ...configuration, policyValidation: 'pending' } });
  const result = await h.api.recognize(h.input());
  assert.equal(result.status, 'uncertain'); assert.equal(result.reason, 'policy-unvalidated');
  assert.equal(result.selectedTargetId, undefined);
});
test('cancel resolves waiting immediately, is idempotent and holds native lock across a new photo/screen', async () => {
  const work = deferred(); let runs = 0;
  const h = setup({ recognize: input => { runs++; return runs === 1 ? work.promise : Promise.resolve(identified(input)); } });
  const input = h.input(), pending = h.api.recognize(input);
  assert.equal(h.api.cancelRecognition('other').status, 'not-active');
  assert.equal(h.api.cancelRecognition(input.requestId).status, 'accepted');
  assert.deepEqual(await pending, { ...input, status: 'cancelled', reason: 'user' });
  assert.equal(h.api.cancelRecognition(input.requestId).status, 'not-active');
  h.context.photo = { ...photo(), photoId: 'photo-b' };
  assert.equal((await h.api.recognize(h.input())).code, 'BUSY'); assert.equal(runs, 1);
  work.resolve(identified(input)); await Promise.resolve();
  assert.equal((await h.api.recognize(h.input())).status, 'identified'); assert.equal(runs, 2);
});
test('timeout ends UI wait but a late native rejection must settle before another inference', async () => {
  const work = deferred();
  const h = setup({ recognize: () => work.promise });
  const input = h.input(), pending = h.api.recognize(input);
  h.timeout();
  assert.equal((await pending).code, 'TIMEOUT');
  assert.equal((await h.api.recognize(h.input())).code, 'BUSY');
  work.reject(new Error('late native failure')); await Promise.resolve();
  h.runtime.recognize = async input => identified(input);
  assert.equal((await h.api.recognize(h.input())).status, 'identified');
});
test('late success after timeout cannot replace timeout and cannot cancel a subsequent request', async () => {
  const work = deferred(); const h = setup({ recognize: () => work.promise });
  const input = h.input(), pending = h.api.recognize(input);
  h.timeout(); const result = await pending;
  work.resolve(identified(input)); await Promise.resolve();
  assert.equal(result.code, 'TIMEOUT');
  h.runtime.recognize = async input => identified(input);
  assert.equal((await h.api.recognize(h.input())).status, 'identified');
  assert.equal(h.api.cancelRecognition(input.requestId).status, 'not-active');
});
test('changing or releasing the photo or changing content discards a late successful result', async () => {
  for (const change of [c => { c.photo = { ...photo(), photoId: 'new' }; }, c => { c.photo = null; }, c => { c.contentVersion = '2'; }]) {
    const work = deferred(), h = setup({ recognize: () => work.promise });
    const input = h.input(), pending = h.api.recognize(input);
    change(h.context); work.resolve(identified(input));
    assert.deepEqual(await pending, { ...input, status: 'cancelled', reason: 'superseded' });
  }
});
test('double submission returns BUSY without invalidating the original request', async () => {
  const work = deferred(), h = setup({ recognize: () => work.promise });
  const input = h.input(), pending = h.api.recognize(input);
  assert.equal((await h.api.recognize(h.input())).code, 'BUSY');
  work.resolve(identified(input)); assert.equal((await pending).status, 'identified');
});
test('foreign request/photo/content identities are rejected, never used for navigation', async () => {
  for (const field of ['requestId', 'photoId', 'contentVersion']) {
    const h = setup({ recognize: async input => ({ ...identified(input), [field]: 'foreign' }) });
    assert.equal((await h.api.recognize(h.input())).code, 'CONTENT_MISMATCH');
  }
});
test('unsupported IDs, duplicate IDs, nonfinite scores, rank gaps, wrong ordering or selection are rejected', async () => {
  const variants = [
    r => { r.candidates[0].targetId = 'unknown'; },
    r => { r.candidates[1].targetId = 'a'; },
    r => { r.candidates[0].score = NaN; },
    r => { r.candidates[0].score = Infinity; },
    r => { r.candidates[1].rank = 3; },
    r => { r.candidates[1].score = .9; },
    r => { r.selectedTargetId = 'b'; },
    r => { r.candidates = []; },
    r => { r.candidates.push({ targetId: 'b', rank: 3, score: .1 }); },
  ];
  for (const mutate of variants) {
    const h = setup({ recognize: async input => { const result = identified(input); mutate(result); return result; } });
    const result = await h.api.recognize(h.input());
    assert.equal(result.status, 'error'); assert.ok(['CONTENT_MISMATCH', 'INFERENCE_FAILED'].includes(result.code));
  }
});
test('mismatched provenance and unvalidated location enrichment cannot produce identified', async () => {
  for (const [key, value] of [['modelVersion', 'other'], ['preprocessingVersion', 'other'], ['decisionPolicyVersion', 'other'], ['scoreKind', 'other'], ['locationUsed', true]]) {
    const h = setup({ recognize: async input => ({ ...identified(input), [key]: value }) });
    assert.equal((await h.api.recognize(h.input())).code, 'MODEL_INCOMPATIBLE');
  }
});
test('missing input and incompatible artifact configuration fail before inference', async () => {
  const h = setup(); h.context.photo = null;
  assert.equal((await h.api.recognize(h.input())).code, 'PHOTO_UNREADABLE'); assert.equal(h.calls(), 0);
  for (const config of [{ contentVersion: '2' }, { preprocessingVersion: '' }, { candidateLimit: 0 }, { scoreOrder: 'unknown' }]) {
    const h = setup({ configuration: { ...configuration, ...config } });
    assert.equal((await h.api.recognize(h.input())).status, 'error'); assert.equal(h.calls(), 0);
  }
});
test('native throw/rejection is caught and releases the lock for a manual retry', async () => {
  for (const recognize of [() => { throw Error('decode'); }, async () => { throw Error('inference'); }]) {
    const h = setup({ recognize }); assert.equal((await h.api.recognize(h.input())).code, 'INFERENCE_FAILED');
    h.runtime.recognize = async input => identified(input);
    assert.equal((await h.api.recognize(h.input())).status, 'identified');
  }
});
test('known errors and uncertain outcomes are preserved; malformed status/reasons are errors', async () => {
  const h = setup({ recognize: async input => ({ ...input, status: 'error', code: 'IMAGE_UNSUPPORTED', retryable: true }) });
  assert.equal((await h.api.recognize(h.input())).code, 'IMAGE_UNSUPPORTED');
  h.runtime.recognize = async input => ({ ...identified(input), status: 'uncertain', reason: 'below-policy' });
  assert.equal((await h.api.recognize(h.input())).reason, 'below-policy');
  h.runtime.recognize = async input => ({ ...identified(input), status: 'uncertain', candidates: [], reason: 'no-candidate' });
  assert.equal((await h.api.recognize(h.input())).reason, 'no-candidate');
  for (const recognize of [
    async () => null, async () => ({}),
    async input => ({ ...identified(input), status: 'unknown' }),
    async input => ({ ...identified(input), status: 'uncertain', reason: 'invented' }),
    async input => ({ ...identified(input), status: 'uncertain', reason: 'no-candidate' }),
    async input => ({ ...input, status: 'error', code: 'INVENTED', retryable: true }),
  ]) {
    h.runtime.recognize = recognize;
    assert.equal((await h.api.recognize(h.input())).status, 'error');
  }
});
