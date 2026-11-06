import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from '../../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { photoInput } from './nativePhotoInput';
import type { Photo, PhotoResult } from './photoInput';

const ink = '#243247';
export default function PhotoInputScreen() {
  const [photo, setPhoto] = useState<Photo | null>(photoInput.getPhoto());
  const [pending, setPending] = useState(true);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(false);
  const [modelMissing,setModelMissing]=useState(false);
  const mounted = useRef(false);
  const insets = useSafeAreaInsets();
  const apply = (result: PhotoResult | null) => {
    if (!mounted.current || !result) return;
    if (result.kind === 'selected') { setPhoto(result.photo); setError(''); setSettings(false); setModelMissing(false); }
    if (result.kind === 'error') {
      setError(result.reason === 'permission' ? '카메라 권한을 허용해주세요.' : result.reason === 'unreadable' ? '이 사진을 읽을 수 없어요. 다른 사진을 골라주세요.' : '사진을 열지 못했어요. 다시 시도해주세요.');
      setSettings(result.reason === 'permission' && result.canAskAgain === false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    void photoInput.recoverPhoto().then(result => {
      if (mounted.current) { apply(result); setPending(false); }
    });
    return () => { mounted.current = false; photoInput.dispose(); };
    // One recovery per mounted screen; no picker launch from an effect.
  }, []);
  const select = async (source: 'camera' | 'library') => {
    if (pending) return;
    setPending(true); setError(''); setSettings(false);
    apply(await photoInput.selectPhoto(source));
    if (mounted.current) setPending(false);
  };
  return <ScrollView contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 24 }]}>
    <Stack.Screen options={{ title: '사진' }} />
    {photo && <Image key={photo.photoId} source={{ uri: photo.uri }} accessibilityLabel="선택한 사진" resizeMode="contain" style={styles.preview} onError={() => setError('이 사진을 읽을 수 없어요. 다른 사진을 골라주세요.')} />}
    {photo && <Pressable accessibilityRole="button" disabled={pending} style={styles.button} onPress={()=>setModelMissing(true)}><Text style={styles.buttonText}>장소 찾기</Text></Pressable>}
    {photo && modelMissing && <><Text style={styles.error} accessibilityLiveRegion="polite">이 버전에는 사진 인식 모델이 없어요.</Text><Pressable accessibilityRole="button" style={styles.secondary} onPress={()=>router.dismissTo('/')}><Text style={styles.link}>장소 직접 선택</Text></Pressable></>}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: pending }} disabled={pending} style={[styles.button, pending && styles.disabled]} onPress={() => void select('camera')}><Text style={styles.buttonText}>사진 촬영</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: pending }} disabled={pending} style={[styles.button, pending && styles.disabled]} onPress={() => void select('library')}><Text style={styles.buttonText}>갤러리에서 선택</Text></Pressable>
    {photo && <Pressable accessibilityRole="button" disabled={pending} style={styles.secondary} onPress={() => { photoInput.releasePhoto(photo.photoId); setPhoto(null); setError(''); }}><Text style={styles.link}>사진 선택 해제</Text></Pressable>}
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
