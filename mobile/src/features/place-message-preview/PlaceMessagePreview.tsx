import { useEffect, useState } from 'react';
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const photo = require('../../../assets/places/geunjeongjeon.jpg');
const photoSize = Image.resolveAssetSource(photo);
// Native adaptation of k-style's surface, brand, page-x, stack-s/m, r-l and h-tab tokens.
const theme = { white: '#FFFFFF', ink: '#243247', gutter: 20, gap: 8, inset: 12, radius: 16, footer: 64 };
const fixture = [
  { id: 'step', u: 0.40, v: 0.70, location: '왼쪽 돌계단 근처', count: 24, body: '돌계단 앞에 서서 올려다봤어요. 멀리서는 지붕이 먼저 보였는데, 여기서는 그 아래에 색이 겹쳐 있는 게 눈에 들어와요.' },
  { id: 'yard', u: 0.60, v: 0.79, location: '오른쪽 앞마당', count: 7, body: '마당을 걷다 보니 돌 틈이 다 다르더라고요. 고개를 들었을 때 처마가 한꺼번에 보여서 잠깐 멈췄어요.' },
  { id: 'path', u: 0.49, v: 0.91, location: '아래쪽 돌길', count: 2, body: '건물을 한참 보고 나서야 발밑을 봤어요. 걸어온 길을 돌아보니 들어올 때는 못 봤던 게 많네요.' },
] as const;
type Trace = (typeof fixture)[number];
const hitRadius = 24;

export default function PlaceMessagePreview() {
  const safe = useSafeAreaInsets();
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<Trace | null>(null);
  const [liked, setLiked] = useState<ReadonlySet<Trace['id']>>(new Set());
  useEffect(() => {
    if (!open) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpen(null);
      return true;
    });
    return () => listener.remove();
  }, [open]);

  // Render a center cover crop. The photo, its blurred layer and traces share this rect.
  const scale = Math.max(stage.width / photoSize.width, stage.height / photoSize.height);
  const width = photoSize.width * scale;
  const height = photoSize.height * scale;
  const x = (stage.width - width) / 2;
  const y = (stage.height - height) / 2;
  const cardWidth = Math.max(0, Math.min(480, stage.width - theme.gutter * 2));
  const cardLeft = (stage.width - cardWidth) / 2;
  const cardTop = theme.gutter;

  return (
    <View style={styles.screen}>
      <View
        style={styles.stage}
        onLayout={({ nativeEvent: { layout } }) => setStage({ width: layout.width, height: layout.height })}
      >
        {scale > 0 && (
          <Image
            source={photo}
            accessibilityLabel="근정전 정면과 앞마당"
            accessible={!open}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            style={[styles.photo, { left: x, top: y, width, height }]}
          />
        )}
        {failed && <Text style={styles.failure}>사진을 불러오지 못했어요.</Text>}
        {loaded && !failed && fixture.map((trace) => {
          const cx = x + trace.u * width;
          const cy = y + trace.v * height;
          if (cx < hitRadius || cx > stage.width - hitRadius || cy < hitRadius || cy > stage.height - hitRadius) return null;
          return (
            <Pressable
              key={trace.id}
              accessibilityRole="button"
              accessibilityLabel={`${trace.location} 흔적 열기`}
              importantForAccessibility={open ? 'no-hide-descendants' : 'yes'}
              disabled={open !== null}
              onPress={() => setOpen(trace)}
              style={[styles.target, { left: cx - hitRadius, top: cy - hitRadius }]}
            >
              <View style={[styles.glyph, open?.id === trace.id && styles.activeGlyph]}>
                <View style={styles.bubble}>
                  <View style={styles.bubbleTail} />
                </View>
              </View>
            </Pressable>
          );
        })}
        {open && (
          <View
            accessibilityViewIsModal
            onAccessibilityEscape={() => setOpen(null)}
            style={[styles.card, { left: cardLeft, top: cardTop, width: cardWidth, maxHeight: stage.height - cardTop * 2 }]}
          >
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Image source={photo} blurRadius={12} style={[styles.photo, { left: x - cardLeft, top: y - cardTop, width, height }]} />
              <View style={styles.tint} />
            </View>
            <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
              <Text style={styles.body}>{open.body}</Text>
            </ScrollView>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: liked.has(open.id) }}
                accessibilityLabel={`추천 ${open.count + Number(liked.has(open.id))}개`}
                onPress={() => setLiked((previous) => {
                  const next = new Set(previous);
                  if (next.has(open.id)) next.delete(open.id);
                  else next.add(open.id);
                  return next;
                })}
                style={[styles.control, liked.has(open.id) && styles.recommended]}
              >
                <Text style={[styles.controlText, liked.has(open.id) && styles.onRecommended]}>
                  {liked.has(open.id) ? '추천함' : '추천'} {open.count + Number(liked.has(open.id))}
                </Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setOpen(null)} style={styles.control}>
                <Text style={styles.controlText}>닫기</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
      <View style={[styles.footer, { paddingBottom: safe.bottom + theme.inset }]} importantForAccessibility={open ? 'no-hide-descendants' : 'auto'}>
        <Text style={styles.credit}>사진: 국가유산청 궁능유적본부 · 공공누리 제1유형</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.white },
  stage: { flex: 1, overflow: 'hidden', backgroundColor: '#E9EBED' },
  photo: { position: 'absolute', resizeMode: 'stretch' },
  failure: { padding: theme.gutter, color: theme.ink },
  target: { position: 'absolute', width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  glyph: { width: 28, height: 28, borderRadius: 16, borderColor: '#FFFFFFB3', borderWidth: 1, backgroundColor: 'rgba(36,50,71,0.82)', alignItems: 'center', justifyContent: 'center' },
  activeGlyph: { width: 32, height: 32, borderWidth: 2, borderColor: theme.white, backgroundColor: theme.ink },
  bubble: { width: 13, height: 10, borderColor: theme.white, borderWidth: 1.25, borderRadius: 3, marginBottom: 2 },
  bubbleTail: { position: 'absolute', bottom: -3, left: 2, height: 4, borderLeftWidth: 1.25, borderColor: theme.white, transform: [{ rotate: '27deg' }] },
  card: { position: 'absolute', borderRadius: theme.radius, borderWidth: 1, borderColor: '#FFFFFFC9', overflow: 'hidden', backgroundColor: '#F8FAFC', elevation: 4 },
  tint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(248,250,252,0.66)' },
  bodyScroll: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { padding: theme.gutter, paddingBottom: theme.inset },
  body: { color: theme.ink, fontSize: 16, lineHeight: 25 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: theme.gap, paddingHorizontal: theme.gutter, paddingBottom: theme.inset },
  control: { minHeight: 48, minWidth: 48, paddingHorizontal: theme.inset, justifyContent: 'center', borderRadius: theme.inset },
  controlText: { color: theme.ink, fontSize: 14, fontWeight: '600' },
  recommended: { backgroundColor: theme.ink },
  onRecommended: { color: theme.white },
  footer: { minHeight: theme.footer, justifyContent: 'center', alignItems: 'center', paddingTop: theme.inset, paddingHorizontal: theme.gutter, backgroundColor: theme.white },
  credit: { color: '#4E525A', textAlign: 'center', fontSize: 12, lineHeight: 18 },
});
