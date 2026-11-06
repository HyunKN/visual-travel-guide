import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { content } from './content';
import { photos } from './photos';
import HomePreview from '../public-messages/HomePreviewCard';

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
  const featured = content.getEntry('geunjeongjeon-2','geunjeongjeon');
  return <ScrollView contentContainerStyle={{paddingTop:insets.top,paddingBottom:24}}>
    <View style={styles.mast}><Text accessibilityRole="header" style={styles.brand}>Visual Travel Guide</Text>
      <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => router.push('/photo-input')}><Text style={styles.action}>사진으로 찾기</Text></Pressable></View>
    {featured.status==='ok' && <Pressable accessibilityRole="button" accessibilityLabel={`근정전, ${featured.data.title} 읽기`}
      onPress={()=>router.push({pathname:'/places/[placeId]',params:{placeId:'geunjeongjeon',entryId:featured.data.id}})}>
      <PlacePhoto placeId="geunjeongjeon" /><View style={styles.section}>
        <Text style={styles.credit}>근정전</Text><Text style={styles.story}>{featured.data.title}</Text>
        <Text numberOfLines={2} style={styles.body}>{featured.data.body.split('. ')[0]}.</Text></View>
    </Pressable>}
    {places.length === 0 && <Failure text="지금은 장소를 불러올 수 없어요." />}
    <View style={styles.section}><Text accessibilityRole="header" style={styles.heading}>장소</Text>
      <View style={styles.options}>{places.map(place=><Pressable key={place.id} accessibilityRole="button" accessibilityLabel={`${place.name} 이야기 열기`}
        style={styles.choice} onPress={()=>router.push({pathname:'/places/[placeId]',params:{placeId:place.id}})}><Text style={styles.action}>{place.name}</Text></Pressable>)}</View>
      <Pressable accessibilityRole="button" style={styles.secondary} onPress={()=>router.push('/nearby')}><Text style={styles.link}>주변 장소</Text></Pressable></View>
    <HomePreview />
    {__DEV__ && <View style={styles.section}>
      <Pressable accessibilityRole="button" onPress={() => router.push('/place-message-preview')} style={styles.secondary}><Text style={styles.link}>쪽지 읽기 예시</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/development-check')} style={styles.secondary}><Text style={styles.link}>개발 실행 확인</Text></Pressable>
    </View>}
  </ScrollView>;
}
export function PlaceDetailScreen() {
  const { placeId,entryId } = useLocalSearchParams<{ placeId?: string | string[];entryId?:string|string[] }>();
  const id = typeof placeId === 'string' ? placeId : '';
  const result = content.getBuilding(id);
  const insets = useSafeAreaInsets();
  const [expanded,setExpanded]=useState<string[]>([]);
  if (result.status !== 'ok' || (entryId!==undefined && (typeof entryId!=='string' || content.getEntry(entryId,id).status!=='ok'))) return <Failure text="이 장소의 설명을 불러올 수 없어요." />;
  const place = result.data;
  const photo = content.getPhoto(id);
  const primary=entryId??place.entryIds[0];
  const entries = [primary,...place.entryIds.filter(id=>id!==primary)].map(entryId => content.getEntry(entryId, id));
  const sourceIds = [...new Set(entries.flatMap(e => e.status === 'ok' ? e.data.sourceIds : []))];
  return <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
    <Stack.Screen options={{ title: place.name }} />
    <PlacePhoto key={id} placeId={id} />
    <View style={styles.section}><Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/scenes/[sceneId]', params: { sceneId: place.sceneId } })} style={styles.secondary}><Text style={styles.link}>쪽지 보기</Text></Pressable></View>
    {entries.map((entry, i) => entry.status === 'ok' && <View key={entry.data.id} style={styles.section}>
      {i===0 ? <Text accessibilityRole="header" style={styles.story}>{entry.data.title}</Text> :
        <Pressable accessibilityRole="button" accessibilityState={{expanded:expanded.includes(entry.data.id)}} style={styles.secondary}
          onPress={()=>setExpanded(xs=>xs.includes(entry.data.id)?xs.filter(x=>x!==entry.data.id):[...xs,entry.data.id])}><Text style={styles.heading}>{entry.data.title}</Text></Pressable>}
      {(i===0 || expanded.includes(entry.data.id)) && <Text style={styles.body}>{entry.data.body}</Text>}
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
  mast:{minHeight:56,paddingHorizontal:20,flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between'},brand:{color:ink,fontSize:18,fontWeight:'700'},
  story:{color:ink,fontSize:28,lineHeight:38,fontWeight:'700'},options:{flexDirection:'row',flexWrap:'wrap',gap:8},choice:{minHeight:48,justifyContent:'center',backgroundColor:'#F3F5F7',borderRadius:12,paddingHorizontal:16},action:{fontSize:16,color:ink,fontWeight:'700'},
  place: { marginHorizontal: 20, marginTop: 24, borderRadius: 16, overflow: 'hidden', backgroundColor: '#F4F5F7' },
  pressed: { opacity: 0.8 },
  hero: { width: '100%', aspectRatio: 1.75 },
  placeName: { color: ink, fontSize: 22, fontWeight: '700', padding: 20 },
  section: { paddingHorizontal: 20, paddingTop: 24, gap: 12 },
  title: { color: ink, fontSize: 26, lineHeight: 36, fontWeight: '700' },
  heading: { color: ink, fontSize: 21, lineHeight: 30, fontWeight: '700' },
  body: { color: ink, fontSize: 17, lineHeight: 29 },
  button: { minHeight: 48, padding: 16, borderRadius: 12, backgroundColor: ink, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  secondary: { minHeight: 48, paddingVertical: 12, justifyContent: 'center' },
  link: { color: ink, fontSize: 16, lineHeight: 24, textDecorationLine: 'underline' },
  credit: { color: '#4E525A', fontSize: 13, lineHeight: 21 },
  url: { color: ink, fontSize: 14, lineHeight: 24 },
  missingPhoto: { color: ink, padding: 20 },
});
