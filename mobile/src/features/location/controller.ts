import { classify, type Fix } from './location';

export type LocationState = Readonly<
  | { kind: 'ready'; fix: Readonly<Fix>; checkedAt: number }
  | { kind: 'denied'; canAskAgain: boolean }
  | { kind: 'idle' | 'locating' | 'disabled' | 'timeout' | 'stale' | 'imprecise' | 'invalid' | 'error' }
>;
export type LocationPort = {
  requestPermission(): Promise<{ granted: boolean; canAskAgain: boolean }>;
  servicesEnabled(): Promise<boolean>;
  getCurrentPosition(): Promise<Fix>;
};

/** Foreground one-shot request. Invalidating UI waiting does not stop an OS position request. */
export function createLocationController(port: LocationPort, options: {
  now?: () => number;
  schedule?: (callback: () => void, ms: number) => () => void;
} = {}) {
  const now = options.now ?? Date.now;
  const schedule = options.schedule ?? ((callback, ms) => { const id = setTimeout(callback, ms); return () => clearTimeout(id); });
  let state: LocationState = { kind: 'idle' }, generation = 0;
  let stopRequest = () => {}, stopExpiry = () => {};
  const listeners = new Set<() => void>();
  const emit = (next: LocationState) => { state = Object.freeze(next); listeners.forEach(listener => listener()); };
  function clear() {
    generation++; stopRequest(); stopExpiry();
    emit({ kind: 'idle' });
  }
  function refreshAge() {
    stopExpiry();
    if (state.kind !== 'ready') return;
    const checkedAt = now(), kind = classify(state.fix, checkedAt);
    if (kind !== 'good') emit({ kind });
    else {
      const fix = state.fix;
      if (state.checkedAt !== checkedAt) emit({ kind: 'ready', fix, checkedAt });
      stopExpiry = schedule(refreshAge, Math.max(1, fix.timestamp + 60_001 - checkedAt));
    }
  }
  return {
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    clear,
    refreshAge,
    async locate() {
      if (state.kind === 'locating') return;
      const started = ++generation;
      stopRequest(); stopExpiry(); emit({ kind: 'locating' });
      stopRequest = schedule(() => {
        if (started !== generation) return;
        generation++; emit({ kind: 'timeout' });
      }, 15_000);
      try {
        const permission = await port.requestPermission();
        if (started !== generation) return;
        if (!permission.granted) { emit({ kind: 'denied', canAskAgain: permission.canAskAgain }); return; }
        const enabled = await port.servicesEnabled();
        if (started !== generation) return;
        if (!enabled) { emit({ kind: 'disabled' }); return; }
        const sample = await port.getCurrentPosition();
        if (started !== generation) return;
        const fix = Object.freeze({ latitude: sample.latitude, longitude: sample.longitude, accuracy: sample.accuracy, timestamp: sample.timestamp });
        const checkedAt = now(), kind = classify(fix, checkedAt);
        if (kind !== 'good') { emit({ kind }); return; }
        emit({ kind: 'ready', fix, checkedAt }); refreshAge();
      } catch {
        if (started === generation) emit({ kind: 'error' });
      } finally {
        if (started === generation) stopRequest();
      }
    },
  };
}
