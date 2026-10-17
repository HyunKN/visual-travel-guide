import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BEZEL, REFRACTION, bendAt, edgeVector, convexMapSVG } from '../src/glass-map.js';

test('convex roundover bends inward only within the outer 14 CSS pixels', () => {
  assert.equal(BEZEL, 14);
  assert.equal(REFRACTION, 7);
  assert.ok(Math.abs(bendAt(0) - 1) < 1e-12);
  let previous = 1;
  for (let distance = .1; distance < 14; distance += .1) {
    const value = bendAt(distance);
    assert.ok(value > 0 && value < previous); previous = value;
  }
  assert.equal(bendAt(14), 0); assert.equal(bendAt(20), 0);
  assert.equal(bendAt(-1), 0);
  // Straight and rounded boundaries all sample inward, toward the flat centre.
  assert.ok(edgeVector(170, 1, 340, 104, 36)[1] > 0);
  assert.ok(edgeVector(170, 103, 340, 104, 36)[1] < 0);
  assert.ok(edgeVector(1, 52, 340, 104, 36)[0] > 0);
  assert.ok(edgeVector(339, 52, 340, 104, 36)[0] < 0);
  assert.equal(Math.hypot(...edgeVector(170, 14, 340, 104, 36)), 0);
  assert.equal(Math.hypot(...edgeVector(170, 52, 340, 104, 36)), 0);
});

test('generated maps contain self-contained SVG vectors and no external assets or raster path', () => {
  for (const [width, height, radius] of [[340,104,36], [345,62,31], [44,44,22]]) {
    const svg = convexMapSVG(width, height, radius);
    assert.match(svg, new RegExp(`viewBox="0 0 ${width} ${height}"`));
    assert.match(svg, /radialGradient/); assert.match(svg, /linearGradient/);
    assert.doesNotMatch(svg, /NaN|Infinity|<image|<canvas|data:image\/png/);
  }
  for (const file of ['glass-map.js', 'glass-optics.js']) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /createElement\(['"]canvas|OffscreenCanvas|getContext\(|createImageData\(|requestAnimationFrame\(/);
  }
});
