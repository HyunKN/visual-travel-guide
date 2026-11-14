/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createPhotoInput } = require(path.resolve(__dirname, '../../../../.codex-build/app-photo-tests/photoInput.js'));
const asset = { uri: 'file:///picker/cache/one.jpg', width: 100, height: 80, mimeType: 'image/jpeg', type: 'image' };
const selected = { canceled: false, assets: [asset] };
const setup = overrides => createPhotoInput({
  requestCameraPermission: async () => ({ granted: true, canAskAgain: true }),
  pick: async () => selected,
  recover: async () => null,
  readSize: async () => ({ width: 100, height: 80 }),
  ...overrides,
});

test('selected input exposes an app-only handle and decoder dimensions', async () => {
  const api = setup({ readSize: async () => ({ width: 80, height: 100 }) });
  const result = await api.selectPhoto('library');
  assert.equal(result.kind, 'selected');
  assert.equal(result.photo.origin, 'library');
  assert.equal(result.photo.width, 80);
  assert.equal(result.photo.uri, asset.uri);
  assert.equal(api.getPhoto().photoId, result.photo.photoId);
});
test('camera denial does not launch a picker or drop the previous input', async () => {
  let picks = 0;
  const api = setup({ pick: async () => { picks++; return selected; }, requestCameraPermission: async () => ({ granted: false, canAskAgain: false }) });
  const old = await api.selectPhoto('library');
  assert.deepEqual(await api.selectPhoto('camera'), { kind: 'error', reason: 'permission', canAskAgain: false });
  assert.equal(picks, 1);
  assert.equal(api.getPhoto(), old.photo);
});
test('cancel and unreadable re-selection preserve a valid earlier photo', async () => {
  let result = selected;
  const api = setup({ pick: async () => result });
  const first = await api.selectPhoto('library');
  result = { canceled: true, assets: null };
  assert.equal((await api.selectPhoto('library')).kind, 'cancelled');
  result = { canceled: false, assets: [{ ...asset, uri: 'https://private.invalid/image' }] };
  assert.equal((await api.selectPhoto('library')).reason, 'unreadable');
  assert.equal(api.getPhoto(), first.photo);
});
test('decode failure, invalid dimensions, video and empty selection are rejected', async () => {
  for (const overrides of [
    { readSize: async () => { throw Error('unreadable'); } },
    { readSize: async () => ({ width: NaN, height: 2 }) },
    { pick: async () => ({ canceled: false, assets: [{ ...asset, type: 'video' }] }) },
    { pick: async () => ({ canceled: false, assets: [] }) },
  ]) {
    const api = setup(overrides);
    assert.equal((await api.selectPhoto('library')).reason, 'unreadable');
    assert.equal(api.getPhoto(), null);
  }
});
test('release clears only the matching handle and leaves a newer selection intact', async () => {
  const api = setup();
  const first = await api.selectPhoto('library');
  const second = await api.selectPhoto('camera');
  api.releasePhoto(first.photo.photoId);
  assert.equal(api.getPhoto(), second.photo);
  api.releasePhoto(second.photo.photoId);
  assert.equal(api.getPhoto(), null);
});
test('concurrent launch is rejected and completion after leaving the screen is discarded', async () => {
  let finish;
  const api = setup({ pick: () => new Promise(resolve => { finish = resolve; }) });
  const pending = api.selectPhoto('library');
  assert.equal((await api.selectPhoto('camera')).reason, 'busy');
  api.dispose(); finish(selected);
  assert.equal((await pending).kind, 'cancelled');
  assert.equal(api.getPhoto(), null);
});
test('picker exception is recoverable on the next request', async () => {
  let fail = true;
  const api = setup({ pick: async () => { if (fail) throw Error('system picker'); return selected; } });
  assert.equal((await api.selectPhoto('library')).reason, 'picker');
  fail = false;
  assert.equal((await api.selectPhoto('camera')).kind, 'selected');
});
test('Activity recovery validates the photo and does not invent its origin', async () => {
  const api = setup({ recover: async () => selected });
  assert.equal((await api.recoverPhoto()).photo.origin, 'unknown');
  assert.equal(await setup().recoverPhoto(), null);
  assert.equal((await setup({ recover: async () => ({ code: 'ERR_RECOVERY' }) }).recoverPhoto()).reason, 'picker');
});
