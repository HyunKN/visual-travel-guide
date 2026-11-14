import { classify, type Fix } from './location';

export type LocationState = Readonly<
  | { kind: 'ready'; fix: Readonly<Fix>; checkedAt: number }
  | { kind: 'denied'; canAskAgain: boolean }
  | { kind: 'idle' | 'locating' | 'interrupted' | 'disabled' | 'timeout' | 'stale' | 'imprecise' | 'invalid' | 'error' }
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
  let foreground=true;
  const foregroundWaiters=new Set<()=>void>();
  const wakeForegroundWaiters=()=>{const waiting=[...foregroundWaiters];foregroundWaiters.clear();waiting.forEach(resolve=>resolve());};
  const waitForForeground=(started:number)=>new Promise<void>(resolve=>{
    if(foreground||started!==generation)resolve();else foregroundWaiters.add(resolve);
  });
  let stopRequest = () => {}, stopExpiry = () => {};
  const listeners = new Set<() => void>();
  const emit = (next: LocationState) => { state = Object.freeze(next); listeners.forEach(listener => listener()); };
  function invalidate(next:LocationState) {
    generation++; stopRequest(); stopExpiry();
    wakeForegroundWaiters();
    emit(next);
  }
  function clear() { invalidate({kind:'idle'}); }
  function suspend() {
    foreground=false;
    // Permission/settings activities temporarily hide this screen. Keep the
    // existing one-shot request, but do not start another stage or expose its
    // result until foreground. Route exit/cancel still calls clear().
    if(state.kind==='locating')return;
    invalidate(state.kind==='ready'?{kind:'idle'}:state);
  }
  function refreshAge() {
    foreground=true;wakeForegroundWaiters();
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
    suspend,
    refreshAge,
    async locate() {
      if (state.kind === 'locating'||!foreground) return;
      const started = ++generation;
      stopRequest(); stopExpiry(); emit({ kind: 'locating' });
      stopRequest = schedule(() => {
        if (started !== generation) return;
        generation++; wakeForegroundWaiters();emit({ kind: 'timeout' });
      }, 15_000);
      try {
        const permission = await port.requestPermission();
        if(!foreground)await waitForForeground(started);
        if (started !== generation||!foreground) return;
        if (!permission.granted) { emit({ kind: 'denied', canAskAgain: permission.canAskAgain }); return; }
        const enabled = await port.servicesEnabled();
        if(!foreground)await waitForForeground(started);
        if (started !== generation||!foreground) return;
        if (!enabled) { emit({ kind: 'disabled' }); return; }
        const sample = await port.getCurrentPosition();
        if(!foreground)await waitForForeground(started);
        if (started !== generation||!foreground) return;
        const fix = Object.freeze({ latitude: sample.latitude, longitude: sample.longitude, accuracy: sample.accuracy, timestamp: sample.timestamp });
        const checkedAt = now(), kind = classify(fix, checkedAt);
        if (kind !== 'good') { emit({ kind }); return; }
        emit({ kind: 'ready', fix, checkedAt }); refreshAge();
      } catch {
        if(!foreground)await waitForForeground(started);
        if (started === generation&&foreground) emit({ kind: 'error' });
      } finally {
        if (started === generation) stopRequest();
      }
    },
  };
}
