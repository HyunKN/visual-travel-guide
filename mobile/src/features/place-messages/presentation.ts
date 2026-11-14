import type { ReaderState } from './reader';
import type { Anchor } from './contract';

type Reader = NonNullable<ReaderState['reader']>;
export type Presentation = Readonly<{ phase: 'hidden'; token: number }
  | { phase: 'opening' | 'open' | 'closing'; token: number; reader: Reader; anchor: Anchor | null; side: 'top' | 'bottom' }>;

/** Retain only display data while exiting. Never owns requests, mutations or timers. */
export function createReaderPresentation() {
  let serial = 0, state: Presentation = { phase: 'hidden', token: 0 };
  const listeners = new Set<() => void>();
  const emit = (next: Presentation) => { state = Object.freeze(next); listeners.forEach(listener => listener()); };
  return {
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    sync(reader: Reader | null, side: 'top' | 'bottom') {
      if (!reader) {
        if (state.phase !== 'hidden' && state.phase !== 'closing') emit({ ...state, phase: 'closing', token: ++serial });
      } else if (state.phase === 'hidden' || state.phase === 'closing') {
        emit({ phase: 'opening', token: ++serial, reader, anchor: reader.kind === 'found' ? reader.message.anchor : null, side });
      } else if (state.reader !== reader) {
        // Loading/body changes and adjacent messages preserve the open placement and animation.
        const anchor = reader.kind === 'found' ? reader.message.anchor : reader.id === state.reader.id ? state.anchor : null;
        emit({ ...state, reader, anchor });
      }
    },
    finish(token: number): boolean {
      if (state.token !== token) return false;
      if (state.phase === 'opening') emit({ ...state, phase: 'open' });
      else if (state.phase === 'closing') { emit({ phase: 'hidden', token: ++serial }); return true; }
      return false;
    },
    hide() { if (state.phase !== 'hidden') emit({ phase: 'hidden', token: ++serial }); },
  };
}
