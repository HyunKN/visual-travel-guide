import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import SceneScreen from '../features/place-messages/SceneScreen';
import { developmentMessages } from '../features/place-messages/devMessages';
import { content } from '../features/place-content/content';
export default function DevelopmentSceneRoute() {
  const places = content.listBuildings();
  const [index, setIndex] = useState(0);
  const place = places[index];
  const source = useMemo(() => developmentMessages(place?.sceneId ?? ''), [place?.sceneId]);
  if (!__DEV__ || !place) return <Text>이 화면을 열 수 없어요.</Text>;
  return <View style={{ flex: 1 }}>
    <Pressable accessibilityRole="button" onPress={() => setIndex(i => (i + 1) % places.length)} style={{ minHeight: 48, padding: 12 }}><Text>개발 예시 · {place.name} · 다른 장소</Text></Pressable>
    <SceneScreen key={place.sceneId} sceneId={place.sceneId} source={source} />
  </View>;
}
