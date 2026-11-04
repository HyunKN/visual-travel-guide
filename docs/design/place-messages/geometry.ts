import type { Anchor } from './contract';

export type Size = Readonly<{ width: number; height: number }>;
export type Point = Readonly<{ x: number; y: number }>;
export type ImageRect = Size & Point;
export const TOUCH_SIZE = 48;
export const TOUCH_GAP = 8;
export const STAGE_PADDING = TOUCH_SIZE / 2;

/** Image and markers must use exactly this rectangle. Never use cover cropping. */
export function containRect(image: Size, stage: Size): ImageRect {
  if (![image.width, image.height, stage.width, stage.height].every(Number.isFinite)
    || image.width <= 0 || image.height <= 0
    || stage.width <= STAGE_PADDING * 2 || stage.height <= STAGE_PADDING * 2) {
    throw new RangeError('Invalid image or stage size');
  }
  const scale = Math.min(
    (stage.width - STAGE_PADDING * 2) / image.width,
    (stage.height - STAGE_PADDING * 2) / image.height,
  );
  const width = image.width * scale;
  const height = image.height * scale;
  return { x: (stage.width - width) / 2, y: (stage.height - height) / 2, width, height };
}

function validateRect(rect: ImageRect): void {
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
    || rect.width <= 0 || rect.height <= 0) throw new RangeError('Invalid rectangle');
}

export function project(anchor: Anchor, rect: ImageRect): Point {
  validateRect(rect);
  if (![anchor.u, anchor.v].every(Number.isFinite)
    || anchor.u < 0 || anchor.u > 1 || anchor.v < 0 || anchor.v > 1) {
    throw new RangeError('Invalid anchor');
  }
  return { x: rect.x + anchor.u * rect.width, y: rect.y + anchor.v * rect.height };
}

/** Input point is relative to the stage, not to an inner Pressable or the screen. */
export function unproject(point: Point, rect: ImageRect): Anchor | null {
  validateRect(rect);
  if (![point.x, point.y].every(Number.isFinite)) return null;
  const u = (point.x - rect.x) / rect.width;
  const v = (point.y - rect.y) / rect.height;
  const epsilon = 1e-12;
  return u < -epsilon || u > 1 + epsilon || v < -epsilon || v > 1 + epsilon
    ? null
    : { u: Math.min(1, Math.max(0, u)), v: Math.min(1, Math.max(0, v)) };
}

export type PositionedMarker = Point & Readonly<{ id: string }>;
export type MarkerGroup = Point & Readonly<{ ids: readonly string[] }>;

/** At most 60 loaded markers. Stable input-order-independent collision grouping.
 * Groups are display-only: stored anchors never change.
 */
export function groupMarkers(markers: readonly PositionedMarker[]): MarkerGroup[] {
  if (markers.length > 60 || new Set(markers.map(m => m.id)).size !== markers.length
    || markers.some(m => !m.id || !Number.isFinite(m.x) || !Number.isFinite(m.y))) {
    throw new RangeError('Invalid marker page');
  }
  const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
  const groups: { ids: string[]; x: number; y: number }[] = [...markers]
    .sort((a, b) => compare(a.id, b.id))
    .map(m => ({ ids: [m.id], x: m.x, y: m.y }));
  let changed = true;
  while (changed) {
    changed = false;
    merge: for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i], b = groups[j];
        if (Math.abs(a.x - b.x) < TOUCH_SIZE + TOUCH_GAP
          && Math.abs(a.y - b.y) < TOUCH_SIZE + TOUCH_GAP) {
          const count = a.ids.length + b.ids.length;
          groups[i] = {
            ids: [...a.ids, ...b.ids].sort(compare),
            x: (a.x * a.ids.length + b.x * b.ids.length) / count,
            y: (a.y * a.ids.length + b.y * b.ids.length) / count,
          };
          groups.splice(j, 1);
          changed = true;
          break merge;
        }
      }
    }
  }
  return groups;
}
