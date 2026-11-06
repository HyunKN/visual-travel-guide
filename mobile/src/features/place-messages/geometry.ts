import { type Anchor, validAnchor } from './contract';
export type Size = Readonly<{ width: number; height: number }>;
export type Point = Readonly<{ x: number; y: number }>;
export type Rect = Size & Point;
export type Fit = 'cover' | 'contain';
export const TOUCH = 48;
export const GAP = 8;
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
function validRect(rect: Rect) {
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
    || rect.width <= 0 || rect.height <= 0) throw new RangeError('Invalid rectangle');
}
export function imageRect(image: Size, stage: Size, fit: Fit): Rect {
  if (![image.width, image.height, stage.width, stage.height].every(Number.isFinite)
    || image.width <= 0 || image.height <= 0 || stage.width <= TOUCH || stage.height <= TOUCH
    || !['cover', 'contain'].includes(fit)) throw new RangeError('Invalid image layout');
  const padding = fit === 'contain' ? TOUCH : 0;
  const scale = (fit === 'cover' ? Math.max : Math.min)(
    (stage.width - padding) / image.width, (stage.height - padding) / image.height);
  const width = image.width * scale, height = image.height * scale;
  return { x: (stage.width - width) / 2, y: (stage.height - height) / 2, width, height };
}
export function project(anchor: Anchor, rect: Rect): Point {
  validRect(rect);
  if (!validAnchor(anchor)) throw new RangeError('Invalid anchor');
  return { x: rect.x + anchor.u * rect.width, y: rect.y + anchor.v * rect.height };
}
export function unproject(point: Point, rect: Rect, stage: Size): Anchor | null {
  validRect(rect);
  if (![point.x, point.y].every(Number.isFinite) || point.x < 0 || point.y < 0
    || point.x > stage.width || point.y > stage.height) return null;
  const u = (point.x - rect.x) / rect.width, v = (point.y - rect.y) / rect.height;
  const epsilon = 1e-12;
  if (u < -epsilon || u > 1 + epsilon || v < -epsilon || v > 1 + epsilon) return null;
  return { u: clamp(u, 0, 1), v: clamp(v, 0, 1) };
}
export type MarkerGroup = Point & { ids: string[]; glyph: Point };
/** Display-only grouping: preserve each stored anchor. Deterministic ID ordering. */
export function layoutMarkers(markers: readonly { id: string; anchor: Anchor }[], rect: Rect, stage: Size): MarkerGroup[] {
  validRect(rect);
  if (stage.width <= TOUCH || stage.height <= TOUCH || !Number.isFinite(stage.width + stage.height)
    || markers.length > 60 || new Set(markers.map(m => m.id)).size !== markers.length
    || markers.some(m => !m.id || !validAnchor(m.anchor))) throw new RangeError('Invalid markers');
  const groups: MarkerGroup[] = [];
  for (const m of [...markers].sort((a, b) => compare(a.id, b.id))) {
    const glyph = project(m.anchor, rect);
    if (glyph.x < 0 || glyph.y < 0 || glyph.x > stage.width || glyph.y > stage.height) continue;
    groups.push({ ids: [m.id], glyph, x: clamp(glyph.x, 24, stage.width - 24), y: clamp(glyph.y, 24, stage.height - 24) });
  }
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i], b = groups[j];
        if (Math.abs(a.x - b.x) < TOUCH + GAP && Math.abs(a.y - b.y) < TOUCH + GAP) {
          const n = a.ids.length + b.ids.length;
          const x = (a.x * a.ids.length + b.x * b.ids.length) / n;
          const y = (a.y * a.ids.length + b.y * b.ids.length) / n;
          groups[i] = { x, y, glyph: { x, y }, ids: [...a.ids, ...b.ids].sort(compare) };
          groups.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }
  return groups;
}
