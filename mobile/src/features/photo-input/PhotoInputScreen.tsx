import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, Linking, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from '../../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { photoInput } from './nativePhotoInput';
import type { Photo, PhotoResult } from './photoInput';
import { recognition } from '../recognition/nativeRecognition';
import type { ErrorCode, RecognitionResult } from '../recognition/recognition';

const ink = '#243247';
const recognitionErrors: Record<ErrorCode, string> = {
  PHOTO_UNREADABLE: '이 사진을 읽을 수 없어요. 다른 사진을 골라주세요.',
  IMAGE_UNSUPPORTED: '이 형식의 사진은 아직 읽을 수 없어요. 다른 사진을 골라주세요.',
  MODEL_NOT_READY: '이 버전에는 사진 인식 모델이 없어요.',
  MODEL_INCOMPATIBLE: '인식 모델을 사용할 수 없어요. 장소를 직접 골라주세요.',
  CONTENT_MISMATCH: '인식 결과와 장소 정보가 맞지 않아요. 장소를 직접 골라주세요.',
  INFERENCE_FAILED: '사진에서 장소를 찾지 못했어요. 다시 시도해주세요.',
  TIMEOUT: '사진 처리가 오래 걸려 기다림을 멈췄어요.',
  BUSY: '이전 사진을 처리 중이에요. 잠시 후 다시 시도해주세요.',
};
export default function PhotoInputScreen() {
  const [photo, setPhoto] = useState<Photo | null>(photoInput.getPhoto());
  const [pending, setPending] = useState(true);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [outcome, setOutcome] = useState<RecognitionResult | null>(null);
  const currentRequest = useRef<string | null>(null);
  const focused = useRef(false);
  const mounted = useRef(false);
  const insets = useSafeAreaInsets();
  const cancel = useCallback((reason: 'user' | 'superseded' = 'user') => {
    const id = currentRequest.current;
    currentRequest.current = null;
    if (id) recognition.cancelRecognition(id, reason);
    if (mounted.current) { setRecognizing(false); setOutcome(null); }
  }, []);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') cancel(); });
    return () => { focused.current = false; subscription.remove(); cancel(); };
  }, [cancel]));
  const apply = useCallback((result: PhotoResult | null) => {
    if (!mounted.current || !result) return;
    if (result.kind === 'selected') { cancel('superseded'); setPhoto(result.photo); setError(''); setSettings(false); }
    if (result.kind === 'error') {
      setError(result.reason === 'permission' ? '카메라 권한을 허용해주세요.' : result.reason === 'unreadable' ? '이 사진을 읽을 수 없어요. 다른 사진을 골라주세요.' : '사진을 열지 못했어요. 다시 시도해주세요.');
      setSettings(result.reason === 'permission' && result.canAskAgain === false);
    }
  }, [cancel]);
  useEffect(() => {
    mounted.current = true;
    void photoInput.recoverPhoto().then(result => {
      if (mounted.current) { apply(result); setPending(false); }
    });
    return () => { mounted.current = false; cancel(); photoInput.dispose(); };
    // One recovery per mounted screen; no picker launch from an effect.
  }, [apply, cancel]);
  const select = async (source: 'camera' | 'library') => {
    if (pending) return;
    cancel('superseded');
    setPending(true); setError(''); setSettings(false);
    apply(await photoInput.selectPhoto(source));
    if (mounted.current) setPending(false);
  };
  const findPlace = async () => {
    if (!photo || pending || currentRequest.current || !focused.current || AppState.currentState !== 'active') return;
    const input = recognition.createRequest(photo.photoId);
    currentRequest.current = input.requestId;
    setRecognizing(true); setOutcome(null); setError('');
    const result = await recognition.recognize(input);
    if (!mounted.current || !focused.current || currentRequest.current !== input.requestId) return;
    currentRequest.current = null;
    setRecognizing(false);
    setOutcome(result);
    if (result.status === 'identified') router.push({ pathname: '/places/[placeId]', params: { placeId: result.selectedTargetId, origin: 'model', requestId: result.requestId } });
  };
  return <ScrollView contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 24 }]}>
    <Stack.Screen options={{ title: '사진' }} />
    {photo && <Image key={photo.photoId} source={{ uri: photo.uri }} accessibilityLabel="선택한 사진" resizeMode="contain" style={styles.preview} onError={() => setError('이 사진을 읽을 수 없어요. 다른 사진을 골라주세요.')} />}
    {photo && <Pressable accessibilityRole="button" accessibilityState={{ disabled: pending || recognizing, busy: recognizing }} disabled={pending || recognizing} style={[styles.button, (pending || recognizing) && styles.disabled]} onPress={() => void findPlace()}><Text style={styles.buttonText}>{recognizing ? '장소 찾는 중' : '장소 찾기'}</Text></Pressable>}
    {recognizing && <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => cancel()}><Text style={styles.link}>취소</Text></Pressable>}
    {outcome?.status === 'error' && <Text style={styles.error} accessibilityLiveRegion="polite">{recognitionErrors[outcome.code]}</Text>}
    {outcome?.status === 'uncertain' && <Text style={styles.error} accessibilityLiveRegion="polite">장소를 확실히 찾지 못했어요. 다른 사진으로 시도하거나 직접 골라주세요.</Text>}
    {photo && <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => { cancel(); router.dismissTo('/'); }}><Text style={styles.link}>장소 직접 선택</Text></Pressable>}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: pending }} disabled={pending} style={[styles.button, pending && styles.disabled]} onPress={() => void select('camera')}><Text style={styles.buttonText}>사진 촬영</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: pending }} disabled={pending} style={[styles.button, pending && styles.disabled]} onPress={() => void select('library')}><Text style={styles.buttonText}>갤러리에서 선택</Text></Pressable>
    {photo && <Pressable accessibilityRole="button" disabled={pending} style={styles.secondary} onPress={() => { cancel('superseded'); photoInput.releasePhoto(photo.photoId); setPhoto(null); setError(''); }}><Text style={styles.link}>사진 선택 해제</Text></Pressable>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {settings && <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => void Linking.openSettings().catch(() => setError('설정을 열지 못했어요. 휴대폰 설정에서 카메라 권한을 확인해주세요.'))}><Text style={styles.link}>설정 열기</Text></Pressable>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { padding: 20, gap: 16 },
  preview: { width: '100%', height: 280, backgroundColor: '#F4F5F7', borderRadius: 16 },
  button: { minHeight: 48, backgroundColor: ink, borderRadius: 12, padding: 16, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  secondary: { minHeight: 48, justifyContent: 'center' },
  link: { color: ink, fontSize: 16, textDecorationLine: 'underline' },
  error: { color: ink, fontSize: 16, lineHeight: 26 },
});
