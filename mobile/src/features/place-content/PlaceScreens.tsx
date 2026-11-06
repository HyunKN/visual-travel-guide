import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { content } from './content';
import { photos } from './photos';
import HomePreview from '../public-messages/HomePreviewCard';
import { Action } from '../../ui/Action';
import { TapArea } from '../../ui/TapArea';
import { color, layout, textStyles } from '../../ui/theme';

function Failure({ text }: { text: string }) {
  return <View style={styles.section}><Text accessibilityRole="alert" style={textStyles.body}>{text}</Text><Action label="장소 선택으로" variant="primary" onPress={() => router.dismissTo('/')} /></View>;
}
function PlacePhoto({ placeId }: { placeId: string }) {
  const photo = content.getPhoto(placeId);
  const [failed, setFailed] = useState(false);
  const source = photo && photos[photo.file];
  if (!photo || !source) return <Text style={styles.missingPhoto}>사진을 표시할 수 없어요.</Text>;
  const asset = Image.resolveAssetSource(source);
  return <View style={[styles.hero, { aspectRatio: asset.width / asset.height }]}>
    {failed ? <View style={styles.photoFailure}><Text style={textStyles.source}>사진을 표시할 수 없어요.</Text><Action label="다시 시도" onPress={() => setFailed(false)} /></View> :
      <Image accessible accessibilityLabel={photo.credit} source={source} onError={() => setFailed(true)} style={styles.image} resizeMode="contain" />}
  </View>;
}
export function PlaceHomeScreen() {
  const insets = useSafeAreaInsets();
  const places = content.listBuildings();
  const featured = content.getEntry('geunjeongjeon-2','geunjeongjeon');
  return <ScrollView contentContainerStyle={[styles.reading, {paddingTop:insets.top,paddingBottom:32}]}>
    <View style={styles.mast}><Text accessibilityRole="header" style={styles.brand}>Visual Travel Guide</Text>
      <Action label="사진으로 찾기" variant="soft" onPress={() => router.push('/photo-input')} /></View>
    {featured.status==='ok' && <><PlacePhoto placeId="geunjeongjeon" />
      <TapArea accessibilityRole="button" accessibilityLabel={`근정전, ${featured.data.title} 읽기`} style={styles.feature}
        onPress={()=>router.push({pathname:'/places/[placeId]',params:{placeId:'geunjeongjeon',entryId:featured.data.id}})}>
        <Text style={textStyles.source}>근정전</Text>
        <View style={styles.storyRow}><Text style={[textStyles.story, styles.grow]}>{featured.data.title}</Text><View accessible={false} style={styles.chevron} /></View>
        <Text numberOfLines={2} style={textStyles.body}>{featured.data.body.split('. ')[0]}.</Text>
      </TapArea></>}
    {places.length === 0 && <Failure text="지금은 장소를 불러올 수 없어요." />}
    <View style={styles.section}><Text accessibilityRole="header" style={textStyles.heading}>장소</Text>
      <View style={styles.options}>{places.map(place=><Action key={place.id} label={place.name} variant="soft"
        onPress={()=>router.push({pathname:'/places/[placeId]',params:{placeId:place.id}})} />)}</View>
      <Action label="주변 장소" style={styles.alignStart} onPress={()=>router.push('/nearby')} /></View>
    <HomePreview />
    {__DEV__ && <View style={styles.section}>
      <Action label="쪽지 읽기 예시" style={styles.alignStart} onPress={() => router.push('/place-message-preview')} />
      <Action label="개발 실행 확인" style={styles.alignStart} onPress={() => router.push('/development-check')} />
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
  return <ScrollView contentContainerStyle={[styles.reading, { paddingBottom: insets.bottom + 24 }]}>
    <Stack.Screen options={{ title: place.name }} />
    <PlacePhoto key={id} placeId={id} />
    {entries.map((entry, i) => entry.status === 'ok' && <View key={entry.data.id} style={styles.section}>
      {i===0 ? <Text accessibilityRole="header" style={textStyles.story}>{entry.data.title}</Text> :
        <TapArea accessibilityRole="button" accessibilityState={{expanded:expanded.includes(entry.data.id)}} style={styles.disclosure}
          onPress={()=>setExpanded(xs=>xs.includes(entry.data.id)?xs.filter(x=>x!==entry.data.id):[...xs,entry.data.id])}>
          <Text style={[textStyles.heading, styles.grow]}>{entry.data.title}</Text>
          <View accessible={false} style={styles.disclosureIcon}><View style={styles.minus}/>{!expanded.includes(entry.data.id)&&<View style={styles.plus}/>}</View>
        </TapArea>}
      {(i===0 || expanded.includes(entry.data.id)) && <Text selectable style={textStyles.body}>{entry.data.body}</Text>}
      {i===0 && <Action label="사진 속 쪽지 보기" variant="soft" style={styles.alignStart} onPress={() => router.push({ pathname: '/scenes/[sceneId]', params: { sceneId: place.sceneId } })} />}
    </View>)}
    <View style={styles.section}>
      {photo && <Text style={textStyles.source}>{photo.credit} · {photo.license}</Text>}
      {sourceIds.map(sourceId => {
        const source = content.getSource(sourceId);
        return source.status === 'ok' && <Action key={sourceId} label={`${source.data.publisher} · 출처 보기`} style={styles.alignStart} onPress={() => router.push({ pathname: '/sources/[sourceId]', params: { sourceId } })} />;
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
  return <ScrollView contentContainerStyle={[styles.reading, styles.section, { paddingBottom: insets.bottom + 24 }]}>
    <Stack.Screen options={{ title: '출처' }} />
    <Text accessibilityRole="header" style={textStyles.story}>{source.data.title}</Text>
    <Text style={textStyles.body}>{source.data.publisher}</Text>
    <Text selectable style={textStyles.source}>{source.data.url}</Text>
    <Text style={textStyles.source}>확인일 {source.data.checkedAt}</Text>
    {failed && <Text accessibilityRole="alert" style={textStyles.body}>원문을 열지 못했어요. 연결을 확인하고 다시 시도해주세요.</Text>}
    <Action label={opening ? '여는 중' : failed ? '다시 시도' : '원문 열기'} busy={opening} variant="primary" onPress={() => void open()} />
  </ScrollView>;
}
const styles = StyleSheet.create({
  reading: { width: '100%', maxWidth: layout.readingWidth, alignSelf: 'center' },
  mast: { minHeight: 56, paddingHorizontal: layout.gutter, paddingVertical: 8, gap: 8, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: color.ink, fontSize: 18, lineHeight: 26, fontWeight: '700', flexShrink: 1 },
  hero: { width: '100%', backgroundColor: color.subtle }, image: { width: '100%', height: '100%' },
  photoFailure: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  section: { paddingHorizontal: layout.gutter, paddingTop: layout.section, gap: 12 },
  feature: { padding: layout.gutter, paddingBottom: layout.large, gap: 12 },
  storyRow: { flexDirection: 'row', alignItems: 'center', gap: 20 }, grow: { flex: 1 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, alignStart: { alignItems: 'flex-start' },
  disclosure: { minHeight: layout.touch, borderTopWidth: StyleSheet.hairlineWidth, borderColor: color.line, paddingTop: 16, gap: 16, flexDirection: 'row', alignItems: 'center' },
  chevron: { width: 9, height: 9, borderTopWidth: 1.5, borderRightWidth: 1.5, borderColor: color.ink, transform: [{ rotate: '45deg' }], marginRight: 4 },
  disclosureIcon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  minus: { width: 14, height: 1.5, backgroundColor: color.ink }, plus: { position: 'absolute', width: 1.5, height: 14, backgroundColor: color.ink },
  missingPhoto: { ...textStyles.source, padding: layout.gutter },
});
