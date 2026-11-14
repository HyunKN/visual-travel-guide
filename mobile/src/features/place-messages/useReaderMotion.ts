import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { createReaderPresentation, Presentation } from './presentation';

export function useReaderMotion(presentation: ReturnType<typeof createReaderPresentation>, state: Presentation, onClosed: () => void) {
  const initiallyReduced = useReducedMotion(), [reduced, setReduced] = useState(initiallyReduced);
  const progress = useSharedValue(0), shown = useRef(false), afterClose = useRef(onClosed);
  useEffect(() => { afterClose.current = onClosed; }, [onClosed]);
  useEffect(() => {
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => subscription.remove();
  }, []);
  const settle = useCallback((token: number) => { if (presentation.finish(token)) afterClose.current(); }, [presentation]);
  const animate = useCallback((current: Presentation) => {
    cancelAnimation(progress);
    if (current.phase === 'hidden') { progress.set(0); return; }
    if (current.phase === 'open') { progress.set(1); return; }
    const opening = current.phase === 'opening', token = current.token;
    progress.set(withTiming(opening ? 1 : 0, {
      duration: reduced ? 0 : opening ? 220 : 140,
      easing: opening ? Easing.bezier(.2, 0, 0, 1) : Easing.bezier(.4, 0, 1, 1), reduceMotion: ReduceMotion.System,
    }, finished => { if (finished) scheduleOnRN(settle, token); }));
  }, [progress, reduced, settle]);
  useEffect(() => {
    const current = presentation.snapshot();
    if (current.phase === 'hidden') { shown.current = false; animate(current); }
    else if (current.phase === 'opening') {
      progress.set(reduced ? 1 : 0);
      if (shown.current) animate(current); // Reopened during an exit; native Modal is still present.
    } else if (current.phase === 'closing' && !shown.current) settle(current.token);
    else animate(current);
    return () => cancelAnimation(progress);
  }, [state.phase, state.token, presentation, animate, progress, reduced, settle]);
  useEffect(() => () => { shown.current = false; presentation.hide(); }, [presentation]);
  const onShow = () => {
    const current = presentation.snapshot();
    if (current.phase === 'hidden') return;
    shown.current = true; animate(current);
  };
  // The lens and the photographed landmark share a stationary stage coordinate system.
  const cardStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: 1 }));
  return { cardStyle, backdropStyle, onShow };
}
