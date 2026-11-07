import { Image, Platform, StyleSheet, View, type ImageSourcePropType, type ViewProps } from 'react-native';
import { requireNativeViewManager, requireOptionalNativeModule } from 'expo-modules-core';
import { photos } from '../features/place-content/photos';
import type { Rect } from '../features/place-messages/geometry';

type GlassProps = ViewProps & {
  assetKey: string;
  imageRect: number[];
  clipRect: number[];
  cornerRadius: number;
  tintAmount: number;
};

// A JS update must remain usable on a development build without this local module.
const nativeModule = Platform.OS === 'android'
  ? requireOptionalNativeModule<{ isSupported: boolean }>('PhotoGlass') : null;
const NativeGlass = nativeModule?.isSupported
  ? requireNativeViewManager<GlassProps>('PhotoGlass') : null;

/** Photo-only glass. image, frame and stageClip share one coordinate space in dp.
 * Only registered place photos enter the native sampler. Older builds keep one
 * aligned crop and a readable static surface. stageClip bounds visible photo pixels. */
export function PhotoGlass({ source, image, frame, stageClip = image, radius = 24, tint = .1 }:
  { source: ImageSourcePropType; image: Rect; frame: Rect; stageClip?: Rect; radius?: number; tint?: number }) {
  if (![image.x, image.y, image.width, image.height, frame.x, frame.y, frame.width, frame.height,
    stageClip.x, stageClip.y, stageClip.width, stageClip.height].every(Number.isFinite)
    || frame.width <= 0 || frame.height <= 0) return null;
  const assetKey = Object.keys(photos).find(key => photos[key] === source);
  const localImage = { left: image.x - frame.x, top: image.y - frame.y, width: image.width, height: image.height };
  const clipLeft = Math.max(image.x, stageClip.x) - frame.x;
  const clipTop = Math.max(image.y, stageClip.y) - frame.y;
  const clipWidth = Math.max(0, Math.min(image.x + image.width, stageClip.x + stageClip.width) - frame.x - clipLeft);
  const clipHeight = Math.max(0, Math.min(image.y + image.height, stageClip.y + stageClip.height) - frame.y - clipTop);
  const cornerRadius = Number.isFinite(radius) ? Math.max(0, Math.min(radius, frame.width / 2, frame.height / 2)) : 24;
  const tintAmount = Number.isFinite(tint) ? Math.max(0, Math.min(.24, tint)) : .1;
  const validPhoto = image.width > 0 && image.height > 0 && clipWidth > 0 && clipHeight > 0;
  return <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
    style={[StyleSheet.absoluteFill, { borderRadius: cornerRadius, overflow: 'hidden', backgroundColor: '#F5F5F3' }]}>
    {validPhoto && <View style={{ position: 'absolute', left: clipLeft, top: clipTop, width: clipWidth, height: clipHeight, overflow: 'hidden' }}>
      <Image source={source} resizeMode="stretch" style={{ position: 'absolute', left: localImage.left - clipLeft,
        top: localImage.top - clipTop, width: image.width, height: image.height }} />
    </View>}
    <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(255,255,255,${tintAmount})` }]} />
    {NativeGlass && assetKey && validPhoto && <NativeGlass style={StyleSheet.absoluteFill} assetKey={assetKey}
      imageRect={[localImage.left, localImage.top, image.width, image.height]} clipRect={[clipLeft, clipTop, clipWidth, clipHeight]}
      cornerRadius={cornerRadius} tintAmount={tintAmount} />}
  </View>;
}
