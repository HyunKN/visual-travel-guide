/** Design reference, not connected to mobile or a remote database. */
export type Anchor = Readonly<{ u: number; v: number }>;

export type PlaceScene = Readonly<{
  id: string; // Immutable photo composition, e.g. geunjeongjeon-front-v1
  placeId: string; // Existing target ID, not a second place catalogue
  assetId: string;
  imageWidth: number;
  imageHeight: number;
  imageSha256: string;
}>;

export type LocalNote = Readonly<{
  id: string; // UUID generated once, reused on retries
  sceneId: string;
  anchor: Anchor;
  body: string;
  updatedAt: string;
  publication:
    | { state: 'private' }
    | { state: 'publishing'; ownerId: string; requestId: string }
    | { state: 'published'; ownerId: string; serverUpdatedAt: string }
    | { state: 'uncertain'; ownerId: string; requestId: string };
}>;

export type PublicMarker = Readonly<{
  id: string;
  sceneId: string;
  anchor: Anchor;
  createdAt: string;
}>;

export type PublicMessage = PublicMarker & Readonly<{
  body: string;
  updatedAt: string;
}>;

export type MarkerPage = Readonly<{
  items: readonly PublicMarker[];
  nextCursor: string | null; // Server-issued cursor, scope includes scene and snapshot
}>;

export type SceneMode =
  | { kind: 'explore' }
  | { kind: 'placing'; anchor: Anchor | null }
  | { kind: 'composing'; noteId: string; anchor: Anchor }
  | { kind: 'reading'; messageIds: readonly string[]; activeId: string };

// Proposed technical payload guard, not a writing prompt or a 50-character format.
export const MAX_BODY_UTF8_BYTES = 16_384;

export function validateBody(body: string): 'empty' | 'too-large' | null {
  if (!body.trim()) return 'empty';
  return new TextEncoder().encode(body).length > MAX_BODY_UTF8_BYTES
    ? 'too-large'
    : null;
}

export type LoadMessageResult =
  | { kind: 'found'; message: PublicMessage }
  | { kind: 'unavailable' }
  | { kind: 'offline' }
  | { kind: 'failed'; retryable: boolean };

// Intended external interface of the public-message module.
// Auth, cursor validation, RLS and retry reconciliation belong inside its adapter.
export interface PublicMessages {
  list(sceneId: string, cursor: string | null, signal: AbortSignal): Promise<MarkerPage>;
  read(messageId: string, signal: AbortSignal): Promise<LoadMessageResult>;
  publish(note: LocalNote, signal: AbortSignal): Promise<
    | { kind: 'published'; updatedAt: string }
    | { kind: 'auth-required' }
    | { kind: 'rejected'; reason: 'body' | 'scene' | 'anchor' | 'rate-limit' }
    | { kind: 'uncertain' }
  >;
  remove(messageId: string, signal: AbortSignal): Promise<
    'removed' | 'auth-required' | 'forbidden' | 'uncertain'
  >;
}
