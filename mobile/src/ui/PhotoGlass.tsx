import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import type { Rect } from '../features/place-messages/geometry';

/** A bounded, photo-only refraction approximation. Never samples arbitrary UI.
 * Nested crops bend the outer 8dp; the centre uses the unmodified photo mapping.
 * Not an Android system Liquid Glass implementation. */
export function PhotoGlass({ source, image, frame, radius = 24, tint = .5 }:
  { source: ImageSourcePropType; image: Rect; frame: Rect; radius?: number; tint?: number }) {
  if (frame.width <= 0 || frame.height <= 0) return null;
  const cx = frame.width / 2, cy = frame.height / 2;
  return <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    {[{ inset: 0, scale: 1.07 }, { inset: 2, scale: 1.045 }, { inset: 5, scale: 1.018 }, { inset: 8, scale: 1 }].map(({ inset, scale }) =>
      <View key={inset} style={{ position: 'absolute', top: inset, left: inset, right: inset, bottom: inset, overflow: 'hidden', borderRadius: Math.max(0, radius - inset) }}>
        <Image source={source} resizeMode="stretch" style={{ position: 'absolute',
          left: cx + (image.x - frame.x - cx) * scale - inset, top: cy + (image.y - frame.y - cy) * scale - inset,
          width: image.width * scale, height: image.height * scale }} />
      </View>)}
    <View style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: `rgba(255,255,255,${tint})`, borderWidth: 1, borderColor: 'rgba(255,255,255,.85)' }]} />
    <View style={{ position: 'absolute', top: 2, left: 2, right: 2, bottom: 2, borderRadius: radius - 2, borderWidth: 1, borderColor: 'rgba(70,70,70,.12)' }} />
  </View>;
}
