import { type MessagePage, type Messages, type ReadResult, validMarker, validateBody } from './contract';
export type ReaderState = Readonly<{
  sceneId: string;
  list: { kind: 'idle' | 'loading' | 'error' } | { kind: 'ready'; page: MessagePage };
  reader: null | { kind: 'loading' | 'error'; id: string } | ({ id: string } & ReadResult);
}>;
/** Network/local adapters are injected. No React, fixtures, SQL or global requests. */
export function createMessageReader(source: Messages) {
  let state: ReaderState = { sceneId: '', list: { kind: 'idle' }, reader: null };
  let listGeneration = 0, readGeneration = 0;
  let listing: AbortController | undefined, reading: AbortController | undefined;
  const listeners = new Set<() => void>();
  const emit = (next: ReaderState) => { state = next; listeners.forEach(l => l()); };
  function close() {
    readGeneration++; reading?.abort();
    emit({ ...state, reader: null });
  }
  return {
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    close,
    cancel() { listGeneration++; listing?.abort(); close(); },
    async load(sceneId: string, cursor: string | null = null) {
      const generation = ++listGeneration;
      listing?.abort(); close();
      const request = new AbortController(); listing = request;
      emit({ sceneId, list: { kind: 'loading' }, reader: null });
      try {
        const page = await source.list(sceneId, cursor, request.signal);
        if (generation !== listGeneration) return;
        if (!Array.isArray(page.items) || page.items.length > 60
          || new Set(page.items.map(m => m.id)).size !== page.items.length
          || page.items.some(m => !validMarker(m, sceneId))
          || !(page.nextCursor === null || (typeof page.nextCursor === 'string' && page.nextCursor.length > 0 && page.nextCursor !== cursor))) throw new Error('Invalid marker page');
        emit({ ...state, list: { kind: 'ready', page } });
      } catch {
        if (generation === listGeneration) emit({ ...state, list: { kind: 'error' } });
      }
    },
    async open(id: string) {
      const generation = ++readGeneration, sceneId = state.sceneId;
      reading?.abort();
      const request = new AbortController(); reading = request;
      emit({ ...state, reader: { kind: 'loading', id } });
      try {
        const result = await source.read(sceneId, id, request.signal);
        if (generation !== readGeneration || sceneId !== state.sceneId) return;
        if (result.kind !== 'unavailable' && (result.kind !== 'found'
          || !validMarker(result.message, sceneId) || result.message.id !== id
          || typeof result.message.body !== 'string' || validateBody(result.message.body))) throw new Error('Invalid message');
        emit({ ...state, reader: { ...result, id } });
      } catch {
        if (generation === readGeneration && sceneId === state.sceneId) emit({ ...state, reader: { kind: 'error', id } });
      }
    },
  };
}
