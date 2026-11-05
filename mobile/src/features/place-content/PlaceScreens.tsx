import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { content } from './content';
import { photos } from './photos';

// Native mapping of k-style's ink, page-x, r-l and spacing tokens.
const ink = '#243247';
function Failure({ text }: { text: string }) {
  return <View style={styles.section}><Text accessibilityRole="alert" style={styles.body}>{text}</Text><Pressable accessibilityRole="button" onPress={() => router.dismissTo('/')} style={styles.button}><Text style={styles.buttonText}>장소 선택으로</Text></Pressable></View>;
}
function PlacePhoto({ placeId }: { placeId: string }) {
  const photo = content.getPhoto(placeId);
  const [failed, setFailed] = useState(false);
  const source = photo && photos[photo.file];
  if (!photo || !source || failed) return <Text style={styles.missingPhoto}>사진을 표시할 수 없어요.</Text>;
  return <View style={styles.hero}><Image accessibilityLabel={photo.credit} source={source} onError={() => setFailed(true)} style={{ width: '100%', height: '100%' }} resizeMode="cover" /></View>;
}
export function PlaceHomeScreen() {
  const insets = useSafeAreaInsets();
  const places = content.listBuildings();
  return <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
    <Stack.Screen options={{ title: '경복궁' }} />
    <View style={styles.section}><Pressable accessibilityRole="button" style={styles.button} onPress={() => router.push('/photo-input')}><Text style={styles.buttonText}>사진 선택</Text></Pressable></View>
    {places.length === 0 && <Failure text="지금은 장소를 불러올 수 없어요." />}
    {places.map(place => <Pressable key={place.id} accessibilityRole="button" accessibilityLabel={`${place.name} 이야기 열기`} onPress={() => router.push({ pathname: '/places/[placeId]', params: { placeId: place.id } })} style={({ pressed }) => [styles.place, pressed && styles.pressed]}>
      <PlacePhoto placeId={place.id} /><Text style={styles.placeName}>{place.name}</Text>
    </Pressable>)}
    {__DEV__ && <View style={styles.section}>
      <Pressable accessibilityRole="button" onPress={() => router.push('/place-message-preview')} style={styles.secondary}><Text style={styles.link}>근정전 메시지 시안</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/development-check')} style={styles.secondary}><Text style={styles.link}>개발 실행 확인</Text></Pressable>
    </View>}
  </ScrollView>;
}
export function PlaceDetailScreen() {
  const { placeId } = useLocalSearchParams<{ placeId?: string | string[] }>();
  const id = typeof placeId === 'string' ? placeId : '';
  const result = content.getBuilding(id);
  const insets = useSafeAreaInsets();
  if (result.status !== 'ok') return <Failure text="이 장소의 설명을 불러올 수 없어요." />;
  const place = result.data;
  const photo = content.getPhoto(id);
  const entries = place.entryIds.map(entryId => content.getEntry(entryId, id));
  const sourceIds = [...new Set(entries.flatMap(e => e.status === 'ok' ? e.data.sourceIds : []))];
  return <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
    <Stack.Screen options={{ title: place.name }} />
    <PlacePhoto key={id} placeId={id} />
    {entries.map((entry, i) => entry.status === 'ok' && <View key={entry.data.id} style={styles.section}>
      <Text accessibilityRole="header" style={i === 0 ? styles.title : styles.heading}>{entry.data.title}</Text>
      <Text style={styles.body}>{entry.data.body}</Text>
    </View>)}
    <View style={styles.section}>
      {photo && <Text style={styles.credit}>{photo.credit} · {photo.license}</Text>}
      {sourceIds.map(sourceId => {
        const source = content.getSource(sourceId);
        return source.status === 'ok' && <Pressable key={sourceId} accessibilityRole="button" accessibilityLabel={`${place.name} 출처 보기`} onPress={() => router.push({ pathname: '/sources/[sourceId]', params: { sourceId } })} style={styles.secondary}><Text style={styles.link}>{source.data.publisher} · 출처 보기</Text></Pressable>;
      })}
    </View>
  </ScrollView>;
}
export function SourceScreen() {
  const { sourceId } = useLocalSearchParams<{ sourceId?: string | string[] }>();
  const id = typeof sourceId === 'string' ? sourceId : '';
  const source = content.getSource(id);
  const insets = useSafeAreaInsets();
  const [failed, setFailed] = useState(false);
  const [opening, setOpening] = useState(false);
  if (source.status !== 'ok') return <Failure text="출처를 찾을 수 없어요." />;
  const open = async () => {
    if (opening) return;
    setOpening(true);
    setFailed((await content.openSource(id, url => Linking.openURL(url))).status !== 'opened');
    setOpening(false);
  };
  return <ScrollView contentContainerStyle={[styles.section, { paddingBottom: insets.bottom + 24 }]}>
    <Stack.Screen options={{ title: '출처' }} />
    <Text accessibilityRole="header" style={styles.title}>{source.data.title}</Text>
    <Text style={styles.body}>{source.data.publisher}</Text>
    <Text selectable style={styles.url}>{source.data.url}</Text>
    <Text style={styles.credit}>확인일 {source.data.checkedAt}</Text>
    {failed && <Text accessibilityRole="alert" style={styles.body}>원문을 열지 못했어요. 연결을 확인하고 다시 시도해주세요.</Text>}
    <Pressable disabled={opening} accessibilityRole="button" accessibilityState={{ disabled: opening }} onPress={open} style={styles.button}><Text style={styles.buttonText}>{opening ? '여는 중' : failed ? '다시 시도' : '원문 열기'}</Text></Pressable>
  </ScrollView>;
}
const styles = StyleSheet.create({
  place: { marginHorizontal: 20, marginTop: 24, borderRadius: 16, overflow: 'hidden', backgroundColor: '#F4F5F7' },
  pressed: { opacity: 0.8 },
  hero: { width: '100%', aspectRatio: 1.75 },
  placeName: { color: ink, fontSize: 22, fontWeight: '600', padding: 20 },
  section: { paddingHorizontal: 20, paddingTop: 24, gap: 12 },
  title: { color: ink, fontSize: 26, lineHeight: 36, fontWeight: '700' },
  heading: { color: ink, fontSize: 21, lineHeight: 30, fontWeight: '600' },
  body: { color: ink, fontSize: 17, lineHeight: 29 },
  button: { minHeight: 48, padding: 16, borderRadius: 12, backgroundColor: ink, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  secondary: { minHeight: 48, paddingVertical: 12, justifyContent: 'center' },
  link: { color: ink, fontSize: 16, lineHeight: 24, textDecorationLine: 'underline' },
  credit: { color: '#4E525A', fontSize: 13, lineHeight: 21 },
  url: { color: ink, fontSize: 14, lineHeight: 24 },
  missingPhoto: { color: ink, padding: 20 },
});
