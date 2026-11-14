export type Anchor = Readonly<{ u: number; v: number }>;
export type Marker = Readonly<{ id: string; sceneId: string; anchor: Anchor; createdAt: string }>;
export type Message = Marker & Readonly<{ body: string; origin?:'private'|'public'; owned?:boolean }>;
export type MessagePage = Readonly<{ items: readonly Marker[]; nextCursor: string | null; publicStatus?:'ready'|'error'|'unconfigured' }>;
export type ReadResult = { kind: 'found'; message: Message } | { kind: 'unavailable' };
export interface Messages {
  list(sceneId: string, cursor: string | null, signal: AbortSignal): Promise<MessagePage>;
  read(sceneId: string, id: string, signal: AbortSignal): Promise<ReadResult>;
}
export const MAX_BODY_BYTES = 16_384;
export const MAX_BODY_CHARACTERS = 100;
// Count Unicode code points, including spaces/newlines; never split a surrogate pair.
export function bodyLength(body: string): number { return [...body].length; }
export function limitBodyInput(body: string, previous: string): string {
  if(bodyLength(previous)>MAX_BODY_CHARACTERS && bodyLength(body)>MAX_BODY_CHARACTERS)
    return bodyLength(body)<bodyLength(previous)?body:previous;
  return [...body].slice(0,MAX_BODY_CHARACTERS).join('');
}
// UTF-8 byte length without a TextEncoder polyfill in native. Lone surrogates
// have the same replacement-character size as UTF-8 encoding.
export function bodyBytes(body: string): number {
  let bytes = 0;
  for (const char of body) {
    const cp = char.codePointAt(0)!;
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return bytes;
}
export function validateBody(body: string): 'empty' | 'too-large' | null {
  return validateStoredBody(body) ?? (bodyLength(body)>MAX_BODY_CHARACTERS?'too-large':null);
}
// Older saved messages remain readable; only new saves/publications use the 100-character limit.
export function validateStoredBody(body: string): 'empty' | 'too-large' | null {
  return !body.trim() ? 'empty' : bodyBytes(body) > MAX_BODY_BYTES ? 'too-large' : null;
}
export function validAnchor(a: Anchor): boolean {
  return !!a && Number.isFinite(a.u) && Number.isFinite(a.v)
    && a.u >= 0 && a.u <= 1 && a.v >= 0 && a.v <= 1;
}
export function validMarker(m: Marker, sceneId: string): boolean {
  return !!m && typeof m.id === 'string' && m.id.length > 0 && m.id.length <= 200
    && m.sceneId === sceneId && validAnchor(m.anchor)
    && typeof m.createdAt === 'string' && Number.isFinite(Date.parse(m.createdAt));
}
