import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { color } from './theme';

/** Press feedback never delays an action, changes layout or shrinks the touch target. */
export function TapArea({ children, containerStyle, disabled, onPressIn, onPressOut, onFocus, onBlur, ...props }:
  PressableProps & { containerStyle?: StyleProp<ViewStyle> }) {
  const opacity = useSharedValue(1), [focused, setFocused] = useState(false);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  useEffect(() => {
    if (disabled) { cancelAnimation(opacity); opacity.set(1); }
    return () => cancelAnimation(opacity);
  }, [disabled, opacity]);
  return <Animated.View style={[containerStyle, animated]}>
    <Pressable {...props} disabled={disabled}
      onPressIn={event => { opacity.set(withTiming(.96, { duration: 100, reduceMotion: ReduceMotion.System })); onPressIn?.(event); }}
      onPressOut={event => { opacity.set(withTiming(1, { duration: 140, reduceMotion: ReduceMotion.System })); onPressOut?.(event); }}
      onFocus={event => { setFocused(true); onFocus?.(event); }}
      onBlur={event => { setFocused(false); opacity.set(1); onBlur?.(event); }}>{children}</Pressable>
    {focused && !disabled && <View pointerEvents="none" accessible={false} importantForAccessibility="no" style={[StyleSheet.absoluteFill, styles.focus]} />}
  </Animated.View>;
}
const styles = StyleSheet.create({ focus: { borderWidth: 2, borderColor: color.accent, borderRadius: 8 } });
