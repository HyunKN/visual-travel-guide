import test from 'node:test';
import assert from 'node:assert/strict';
import { bindPressFeedback, setMotionPreference } from '../src/motion.js';
import { springState, stepSpring } from '../src/spring.js';
import { edgeVector } from '../src/glass-optics.js';

globalThis.document = Object.assign(new EventTarget(), { documentElement: { dataset: {} } });
globalThis.getComputedStyle = () => ({ transform: 'none' });
let now = 0, frameId = 0;
const frames = new Map();
globalThis.requestAnimationFrame = (fn) => { frames.set(++frameId, fn); return frameId; };
globalThis.cancelAnimationFrame = (id) => frames.delete(id);
function advance(count = 1) {
  for (let i = 0; i < count; i++) {
    now += 16;
    const scheduled = [...frames.values()]; frames.clear(); scheduled.forEach(fn => fn(now));
  }
}

class Control extends EventTarget {
  constructor() {
    super();
    const classes = new Set(['glass']);
    this.classList = { add: (v) => classes.add(v), remove: (v) => classes.delete(v), contains: (v) => classes.has(v) };
    this.properties = new Map();
    this.style = { setProperty: (k, v) => this.properties.set(k, v), removeProperty: (k) => { this.properties.delete(k); if (k === 'transform') delete this.style.transform; } };
    this.animations = [];
    this.isConnected = true;
  }
  matches(selector) { return selector === '.glass'; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 340, height: 60 }; }
  animate(frames, options) {
    const animation = { frames, options, cancelled: false, cancel() { this.cancelled = true; } };
    this.animations.push(animation);
    return animation;
  }
  send(type, properties = {}) { this.dispatchEvent(Object.assign(new Event(type), properties)); }
}
function fixture(enabled = true) {
  document.dispatchEvent(new Event('prototype-motion-change'));
  setMotionPreference(enabled);
  const control = new Control();
  control.dispose = bindPressFeedback({ querySelectorAll: () => [control] });
  return control;
}
test('only the active pointer releases the press; cancellation clears animation and light', () => {
  const c = fixture();
  c.send('pointerdown', { pointerId: 1, button: 0, clientX: 45, clientY: 20 });
  assert.equal(c.classList.contains('is-pressed'), true);
  assert.equal(c.properties.get('--press-x'), '45px');
  c.send('pointerup', { pointerId: 2 });
  assert.equal(c.classList.contains('is-pressed'), true);
  c.send('pointercancel', { pointerId: 1 });
  assert.equal(c.classList.contains('is-pressed'), false);
  assert.equal(c.properties.size, 0);
  assert.equal(frames.size, 0);
  assert.equal(c.style.transform, undefined);
});
test('keyboard release ignores unrelated keys and repeated keydown', () => {
  const c = fixture();
  c.send('keydown', { key: ' ', repeat: false });
  c.send('keydown', { key: ' ', repeat: true });
  c.send('keyup', { key: 'Shift' });
  assert.equal(c.classList.contains('is-pressed'), true);
  assert.equal(frames.size, 1);
  c.send('keyup', { key: ' ' });
  assert.equal(c.classList.contains('is-pressed'), false);
  assert.equal(frames.size, 1);
});
test('reduced motion retains feedback without animations or synthetic clicks', () => {
  const c = fixture(false);
  let clicks = 0;
  c.addEventListener('click', () => clicks++);
  c.send('pointerdown', { pointerId: 1, button: 0 });
  assert.equal(c.classList.contains('is-pressed'), true);
  c.send('pointerup', { pointerId: 1 });
  assert.equal(c.classList.contains('is-pressed'), false);
  assert.equal(c.animations.length, 0);
  assert.equal(clicks, 0);
});
test('disabled, right click and secondary touch do not activate feedback', () => {
  const c = fixture();
  c.disabled = true;
  c.send('pointerdown', { button: 0 });
  c.disabled = false;
  c.send('pointerdown', { button: 2 });
  c.send('pointerdown', { button: 0, isPrimary: false });
  assert.equal(c.classList.contains('is-pressed'), false);
  assert.equal(c.animations.length, 0);
});
test('blur cancels a release spring; disconnected controls do not start one', () => {
  const c = fixture();
  c.send('pointerdown', { pointerId: 1, button: 0 });
  c.send('pointerup', { pointerId: 1 });
  c.send('blur');
  assert.equal(frames.size, 0);
  c.send('pointerdown', { pointerId: 1, button: 0 });
  c.isConnected = false;
  c.send('pointerup', { pointerId: 1 });
  assert.equal(frames.size, 0);
});
test('release retains the current transform; leaving settles and disposal removes RAF and listeners', () => {
  const c = fixture();
  c.send('pointerdown', { pointerId: 1, button: 0, clientX: 240, clientY: 30 });
  advance(7);
  const contact = c.style.transform;
  assert.match(contact, /scale\(1\.0[1-9]/);
  c.send('pointerup', { pointerId: 1 });
  assert.equal(c.style.transform, contact);
  c.send('pointerleave'); advance(100);
  assert.equal(frames.size, 0);
  assert.match(c.style.transform, /scale\(1\.00000,1\.00000\)/);
  c.dispose();
  c.send('pointerdown', { pointerId: 1, button: 0 });
  assert.equal(frames.size, 0);
  assert.equal(c.classList.contains('is-pressed'), false);
});
test('a tap released before the first frame still moves, then settles', () => {
  const c = fixture();
  c.send('pointerdown', { pointerId: 1, button: 0 });
  assert.match(c.style.transform, /scale\(1\.01200,1\.03500\)/);
  c.send('pointerup', { pointerId: 1 }); advance(3);
  assert.notEqual(c.style.transform, 'translate3d(0.000px,0.000px,0) scale(1.00000,1.00000)');
  advance(120); assert.equal(frames.size, 0);
  c.dispose();
});
test('spring reverses toward a new target without losing momentum and settles at different frame rates', () => {
  for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
    const axis = springState(1); axis.target = 1.12;
    stepSpring(axis, .04); const before = { ...axis }; axis.target = 1;
    assert.equal(axis.velocity, before.velocity);
    assert.equal(axis.value, before.value);
    for (let t = 0; t < 3; t += dt) { stepSpring(axis, dt); assert.ok(axis.value > .9 && axis.value < 1.2); }
    assert.equal(axis.value, 1); assert.equal(axis.velocity, 0);
  }
});
test('edge displacement leaves centre neutral and bends symmetric borders in opposite directions', () => {
  assert.deepEqual(edgeVector(170, 30, 340, 60, 30), [0, 0]);
  const left = edgeVector(4, 30, 340, 60, 30), right = edgeVector(336, 30, 340, 60, 30);
  assert.ok(left[0] > 0 && right[0] < 0);
  assert.equal(left[0], -right[0]); assert.equal(left[1], right[1]);
});
