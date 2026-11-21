import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Image, Linking, ScrollView, StyleSheet } from 'react-native';
import { Text } from '../../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { photoInput } from './nativePhotoInput';
import type { Photo, PhotoResult } from './photoInput';
import { recognition } from '../recognition/nativeRecognition';
import { iosModel } from '../recognition/deviceRuntime';
import type { ErrorCode, RecognitionResult } from '../recognition/recognition';
import { content } from '../place-content/content';
import { Action } from '../../ui/Action';
import { color, layout, textStyles } from '../../ui/theme';

const recognitionErrors: Record<ErrorCode, string> = {
  PHOTO_UNREADABLE: '이 사진을 읽을 수 없어요. 다른 사진을 골라주세요.',
  IMAGE_UNSUPPORTED: '이 형식의 사진은 아직 읽을 수 없어요. 다른 사진을 골라주세요.',
  MODEL_NOT_READY: iosModel ? '사진 인식 모델 설정에서 모델 파일을 먼저 가져와 주세요.' : '이 버전에는 사진 인식 모델이 없어요.',
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
  const [showOtherPlaces, setShowOtherPlaces] = useState(false);
  const currentRequest = useRef<string | null>(null);
  const queuedPhoto = useRef<string | null>(null);
  const focused = useRef(false);
  const mounted = useRef(false);
  const insets = useSafeAreaInsets();
  const cancel = useCallback((reason: 'user' | 'superseded' = 'user') => {
    queuedPhoto.current = null;
    const id = currentRequest.current;
    currentRequest.current = null;
    if (id) recognition.cancelRecognition(id, reason);
    if (mounted.current) { setRecognizing(false); setOutcome(null); setShowOtherPlaces(false); }
  }, []);
  const findPlace = useCallback(async (photoId: string) => {
    if (!mounted.current || currentRequest.current || !focused.current || AppState.currentState !== 'active') return;
    queuedPhoto.current = null;
    const input = recognition.createRequest(photoId);
    currentRequest.current = input.requestId;
    setRecognizing(true); setOutcome(null); setError(''); setShowOtherPlaces(false);
    const result = await recognition.recognize(input);
    if (!mounted.current || !focused.current || currentRequest.current !== input.requestId) return;
    currentRequest.current = null;
    setRecognizing(false);
    setOutcome(result);
  }, []);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && queuedPhoto.current) void findPlace(queuedPhoto.current);
      if (state !== 'active' && currentRequest.current) cancel();
    });
    return () => {
      focused.current = false;
      subscription.remove();
      if (currentRequest.current || queuedPhoto.current) cancel();
    };
  }, [cancel, findPlace]));
  const apply = useCallback((result: PhotoResult | null) => {
    if (!mounted.current || !result) return;
    if (result.kind === 'selected') {
      cancel('superseded');
      setPhoto(result.photo); setError(''); setSettings(false);
      if (focused.current) {
        queuedPhoto.current = result.photo.photoId;
        void findPlace(result.photo.photoId);
      }
    }
    if (result.kind === 'error') {
      setError(result.reason === 'permission' ? '카메라 권한을 허용해주세요.' : result.reason === 'unreadable' ? '이 사진을 읽을 수 없어요. 다른 사진을 골라주세요.' : '사진을 열지 못했어요. 다시 시도해주세요.');
      setSettings(result.reason === 'permission' && result.canAskAgain === false);
      if (result.reason === 'permission') {
        Alert.alert(
          '카메라 권한이 필요해요',
          '사진을 촬영하려면 카메라 권한을 허용해 주세요.',
          result.canAskAgain === false
            ? [
                { text: '취소', style: 'cancel' },
                { text: '설정 열기', onPress: () => {
                  void Linking.openSettings().catch(() => {
                    if (mounted.current) setError('설정을 열지 못했어요. 휴대폰 설정에서 카메라 권한을 확인해주세요.');
                  });
                } },
              ]
            : [{ text: '확인' }],
        );
      }
    }
  }, [cancel, findPlace]);
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
  const identified=outcome?.status==='identified'?outcome:null;
  const place=identified?content.getBuilding(identified.selectedTargetId):null;
  const [top,...otherPlaces] = outcome?.status === 'analyzed'
    ? [...outcome.analysis.buildingScores].sort((a,b)=>b.probability-a.probability).flatMap(score=>{
        const result=content.getBuilding(score.label);
        return result.status==='ok'?[result.data]:[];
      })
    : [];
  const openCandidate=(placeId: string)=>{
    if (!photo || photoInput.getPhoto()?.photoId!==photo.photoId || AppState.currentState!=='active') return;
    router.push({pathname:'/places/[placeId]',params:{placeId,origin:'manual-topic',photoId:photo.photoId}});
  };
  return <ScrollView contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 24 }]}>
    <Stack.Screen options={{ title: '사진' }} />
    {photo && <Image key={photo.photoId} source={{ uri: photo.uri }} accessible accessibilityLabel="선택한 사진" resizeMode="contain" style={styles.preview} onError={() => {if(photoInput.getPhoto()?.photoId===photo.photoId)setError('이 사진을 읽을 수 없어요. 다른 사진을 골라주세요.');}} />}
    {recognizing && <Text accessibilityLiveRegion="polite" style={styles.error}>장소를 찾는 중이에요.</Text>}
    {recognizing && <Action label="분석 취소" onPress={() => cancel()}/>}
    {photo && !recognizing && !identified && !top && <Action label="다시 분석" variant="soft" disabled={pending} onPress={() => void findPlace(photo.photoId)}/>}
    {identified && place?.status==='ok' && <>
      <Text accessibilityRole="header" style={textStyles.heading}>{place.data.name}으로 보여요</Text>
      <Text style={textStyles.body}>{place.data.overview}</Text>
      <Action label={`${place.data.name} 이야기 보기`} variant="primary" onPress={() => router.push({ pathname: '/places/[placeId]', params: { placeId: place.data.id, origin: 'model', requestId: identified.requestId } })}/>
    </>}
    {top && <>
      <Text accessibilityRole="header" style={textStyles.heading}>{top.name}일까요?</Text>
      <Text style={textStyles.body}>{top.overview}</Text>
      <Action label={`${top.name} 이야기 보기`} variant="primary" onPress={()=>openCandidate(top.id)}/>
      {otherPlaces.length>0&&<Action label={showOtherPlaces?'다른 후보 접기':'다른 후보 보기'} onPress={()=>setShowOtherPlaces(value=>!value)}/>}
      {showOtherPlaces&&otherPlaces.map(candidate=><Action key={candidate.id} label={candidate.name} variant="soft" onPress={()=>openCandidate(candidate.id)}/>)}
    </>}
    {outcome?.status === 'error' && <Text style={styles.error} accessibilityLiveRegion="polite">{recognitionErrors[outcome.code]}</Text>}
    {outcome?.status === 'uncertain' && <Text style={styles.error} accessibilityLiveRegion="polite">장소를 확실히 찾지 못했어요. 다른 사진으로 시도하거나 직접 골라주세요.</Text>}
    {photo && <Action label="장소 직접 선택" onPress={() => { cancel(); router.dismissTo('/'); }}/>}
    <Action label="사진 촬영" disabled={pending} variant={photo?'soft':'primary'} onPress={() => void select('camera')}/>
    <Action label="갤러리에서 선택" disabled={pending} variant="soft" onPress={() => void select('library')}/>
    {photo && <Action label="사진 선택 해제" disabled={pending} onPress={() => { cancel('superseded'); photoInput.releasePhoto(photo.photoId); setPhoto(null); setError(''); }}/>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {settings && <Action label="설정 열기" onPress={() => void Linking.openSettings().catch(() => {if(mounted.current)setError('설정을 열지 못했어요. 휴대폰 설정에서 카메라 권한을 확인해주세요.');})}/>}
    {iosModel && <Action label="사진 인식 모델 설정" disabled={pending||recognizing} onPress={()=>router.push('/development-check')}/>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: layout.readingWidth, alignSelf: 'center', padding: layout.gutter, gap: 16 },
  preview: { width: '100%', height: 280, backgroundColor: color.subtle, borderRadius: 16 },
  error: textStyles.body,
});
