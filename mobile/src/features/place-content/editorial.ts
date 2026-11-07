export type EditorialState = { remaining: string[]; last: string | null };
export const emptyEditorialState: EditorialState = { remaining: [], last: null };

/** A reviewed catalogue shuffle bag. No user, location or message data is stored. */
export function nextEditorial(ids: string[], previous: EditorialState, random = Math.random) {
  const candidates = [...new Set(ids)];
  if (!candidates.length) return { id: null, state: emptyEditorialState };
  let remaining = [...new Set(previous.remaining)].filter(id => candidates.includes(id));
  if (!remaining.length) {
    remaining = [...candidates];
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    if (remaining.length > 1 && remaining[0] === previous.last) [remaining[0], remaining[1]] = [remaining[1], remaining[0]];
  }
  const id = remaining.shift()!;
  return { id, state: { remaining, last: id } };
}

export function decodeEditorial(raw: string | null): EditorialState {
  try {
    const data: unknown = raw && JSON.parse(raw);
    if (data && typeof data === 'object' && 'remaining' in data && Array.isArray(data.remaining)
      && data.remaining.every(id => typeof id === 'string') && 'last' in data && (data.last === null || typeof data.last === 'string'))
      return { remaining: data.remaining, last: data.last };
  } catch { /* An invalid bag contains no trusted catalogue selection. */ }
  return emptyEditorialState;
}

/** Horizontal intent and fling must agree; a vertical scroll never swaps cards. */
export function deckDirection(dx: number, dy: number, vx: number): -1 | 0 | 1 {
  if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.3) return 0;
  if (Math.abs(dx) < 42 && !(Math.abs(vx) > .5 && Math.sign(vx) === Math.sign(dx))) return 0;
  return dx < 0 ? 1 : -1;
}
