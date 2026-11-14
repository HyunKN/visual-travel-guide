// Tests the JS/native coordinate and compatibility boundary, not Android GPU output.
/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadGlass(supported = true) {
  let viewRegistrations = 0;
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  const modules = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Image: 'Image', View: 'View', Platform: { OS: 'android' }, StyleSheet: { absoluteFill: {} } },
    'expo-modules-core': {
      requireOptionalNativeModule: () => supported ? { isSupported: true } : null,
      requireNativeViewManager: () => { viewRegistrations++; return 'NativeGlass'; },
    },
    '../features/place-content/photos': { photos: { 'geunjeongjeon.jpg': 101, 'gyotaejeon.jpg': 102, 'gwanghwamun.jpg': 103 } },
  };
  const file = path.join(__dirname, 'PhotoGlass.tsx');
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(compiled, { exports, require: name => {
    assert.ok(name in modules, `unexpected runtime import: ${name}`);
    return modules[name];
  } });
  return { render: exports.PhotoGlass, registrations: () => viewRegistrations };
}

function find(tree, type) {
  if (!tree || typeof tree !== 'object') return [];
  const children = tree.props?.children;
  return [ ...(tree.type === type ? [tree.props] : []),
    ...(Array.isArray(children) ? children : [children]).flatMap(child => find(child, type)) ];
}

const input = {
  source: 101,
  image: { x: -50, y: 10, width: 400, height: 200 },
  frame: { x: 90, y: 80, width: 180, height: 100 },
  stageClip: { x: 0, y: 0, width: 300, height: 250 },
};
const plain = value => JSON.parse(JSON.stringify(value));

test('native receives frame-local dp image and only the stage/photo intersection', () => {
  const glass = find(loadGlass().render(input), 'NativeGlass')[0];
  assert.equal(glass.assetKey, 'geunjeongjeon.jpg');
  assert.deepEqual(plain(glass.imageRect), [-140, -70, 400, 200]);
  assert.deepEqual(plain(glass.clipRect), [-90, -70, 300, 200]);
});

test('moving the common coordinate origin does not move the sampled photo', () => {
  const move = rect => ({ ...rect, x: rect.x + 711, y: rect.y + 1000 });
  const { render } = loadGlass();
  const before = find(render(input), 'NativeGlass')[0];
  const after = find(render({ ...input, image: move(input.image), frame: move(input.frame), stageClip: move(input.stageClip) }), 'NativeGlass')[0];
  assert.deepEqual(plain(after.imageRect), plain(before.imageRect));
  assert.deepEqual(plain(after.clipRect), plain(before.clipRect));
});

test('old native build never registers an unavailable view and retains one aligned photo', () => {
  const { render, registrations } = loadGlass(false);
  const tree = render(input);
  assert.equal(registrations(), 0);
  assert.equal(find(tree, 'NativeGlass').length, 0);
  const images = find(tree, 'Image');
  assert.equal(images.length, 1);
  assert.deepEqual(plain(images[0].style), { position: 'absolute', left: -50, top: 0, width: 400, height: 200 });
});

test('fallback applies the requested low tint once, matching the native tint amount', () => {
  for (const [requested, expected] of [[undefined, .1], [.12, .12], [.9, .24], [-1, 0], [NaN, .1]]) {
    const props = { ...input, ...(requested === undefined ? {} : { tint: requested }) };
    const fallback = loadGlass(false).render(props);
    const overlays = find(fallback, 'View').flatMap(view => Array.isArray(view.style) ? view.style : [view.style])
      .filter(style => style?.backgroundColor?.startsWith('rgba('));
    assert.equal(overlays.length, 1);
    assert.equal(overlays[0].backgroundColor, `rgba(255,255,255,${expected})`);
    assert.equal(find(loadGlass().render(props), 'NativeGlass')[0].tintAmount, expected);
  }
});

test('an unregistered photo stays out of the native sampler', () => {
  assert.equal(find(loadGlass().render({ ...input, source: 999 }), 'NativeGlass').length, 0);
});

test('empty stage intersection exposes neither a photo crop nor native sampler', () => {
  const tree = loadGlass().render({ ...input, stageClip: { x: 500, y: 500, width: 10, height: 10 } });
  assert.equal(find(tree, 'Image').length, 0);
  assert.equal(find(tree, 'NativeGlass').length, 0);
});

test('invalid measured frames cannot send NaN coordinates to native', () => {
  const { render } = loadGlass();
  assert.equal(render({ ...input, frame: { ...input.frame, x: NaN } }), null);
  assert.equal(render({ ...input, frame: { ...input.frame, width: 0 } }), null);
});
