import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, AppState, findNodeHandle, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../ui/Text';
import { Stack, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { photos } from '../place-content/photos';
import { getScene } from './scenes';
import { imageRect, layoutMarkers, project, unproject, type Fit } from './geometry';
import { createMessageReader } from './reader';
import type { Anchor, Messages } from './contract';
import { deviceNotes } from '../local-notes/device';
import type { Draft } from '../local-notes/store';
import Editor from '../local-notes/Editor';
import {productSceneMessages,getPublicService,publicServiceConfigured} from '../public-messages/nativeService';
import {Skeleton} from '../../ui/Skeleton';
import Animated from 'react-native-reanimated';
import { Action as Button } from '../../ui/Action';
import { color, layout, textStyles } from '../../ui/theme';
import { createReaderPresentation } from './presentation';
import { useReaderMotion } from './useReaderMotion';

type FocusTarget = React.ElementRef<typeof View> | null;
function focus(target: FocusTarget) {
  const tag = target && findNodeHandle(target);
  if (tag) AccessibilityInfo.setAccessibilityFocus(tag);
}
export default function SceneScreen({ sceneId, source, messageId, draftId }: { sceneId: string; source?: Messages; messageId?: string; draftId?:string }) {
  const scene = getScene(sceneId), insets = useSafeAreaInsets();
  const local = source===undefined || source === deviceNotes.messages;
  const actual=source??productSceneMessages();
  const [positioning,setPositioning] = useState(false), [anchor,setAnchor] = useState<Anchor|null>(null);
  const [editing,setEditing] = useState<Draft|null>(null), [moving,setMoving] = useState<Draft|null>(null);
  const [writeError,setWriteError] = useState(''), [saving,setSaving] = useState(false);
  const writing = useRef(false), consumedLink = useRef('');
  const [fit, setFit] = useState<Fit>('cover');
  const consumedDraft=useRef('');
  useEffect(()=>{
    let active=true;
    if(local && draftId && consumedDraft.current!==draftId) void deviceNotes.getDraft(draftId,sceneId).then(d=>{
      if(!active)return;
      consumedDraft.current=draftId;
      if(!d){setWriteError('이 사진에서 초안을 찾을 수 없어요.');return;}
      setMoving(d);setFit('contain');setAnchor({u:d.u,v:d.v});setPositioning(true);
    },()=>{if(active)setWriteError('초안을 불러오지 못했어요. 내 글에서 다시 열어 주세요.');});
    return ()=>{active=false;};
  },[local,draftId,sceneId]);
  const controller = useMemo(() => createMessageReader(actual), [actual]);
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  const presentation = useMemo(() => createReaderPresentation(), []);
  const presented = useSyncExternalStore(presentation.subscribe, presentation.snapshot);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [stageOrigin, setStageOrigin] = useState({ x: 0, y: 0 });
  const [cardOrigin, setCardOrigin] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false), [imageFailed, setImageFailed] = useState(false);
  const [imageAttempt, setImageAttempt] = useState(0), [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [opaque, setOpaque] = useState(false);
  const stageRef = useRef<View>(null), modalRef = useRef<View>(null), closeRef = useRef<View>(null), titleRef = useRef<View>(null);
  const markerRefs = useRef(new Map<string, FocusTarget>());
  const returnId = useRef<string | null>(null);
  const cursor = cursors[cursors.length - 1];
  const [reportState,setReportState]=useState<{id:string;busy:boolean;message:string}|null>(null);
  const reporting=useRef(false);
  const foregroundId=useRef<string|undefined>(undefined);
  const [reportFor,setReportFor]=useState<string|null>(null);
  const active = useRef(false), sceneGeneration = useRef(0), editorOpen = useRef(false);
  useEffect(() => { editorOpen.current = !!editing; }, [editing]);
  const restoreFocus = useCallback(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (active.current && !editorOpen.current && !controller.snapshot().reader && presentation.snapshot().phase === 'hidden' && AppState.currentState === 'active')
        focus(markerRefs.current.get(returnId.current ?? '') ?? titleRef.current);
    }));
  }, [controller, presentation]);
  const motion = useReaderMotion(presentation, presented, restoreFocus);
  useFocusEffect(useCallback(()=>{
    active.current = true; sceneGeneration.current++;
    const sub=AppState.addEventListener('change',state=>{
      if(state==='active'){if(local)void controller.refresh(sceneId,cursor,foregroundId.current);foregroundId.current=undefined;}
      else {sceneGeneration.current++;foregroundId.current=local?(controller.snapshot().reader?.id??foregroundId.current):undefined;controller.cancel();presentation.hide();}
    });
    return ()=>{active.current=false;sceneGeneration.current++;sub.remove();presentation.hide();};
  },[local,controller,sceneId,cursor,presentation]));
  async function report(id:string,reason:'spam'|'abuse'|'personal_info'|'other'){
    if(reporting.current)return;
    reporting.current=true;setReportState({id,busy:true,message:''});
    try{await getPublicService().report(id,reason);setReportState({id,busy:false,message:'신고를 접수했어요.'});}
    catch{setReportState({id,busy:false,message:'신고 접수를 확인하지 못했어요. 다시 시도해 주세요.'});}
    finally{reporting.current=false;}
  }
  function chooseReport(id:string){
    setReportFor(id);
  }
  useFocusEffect(useCallback(() => {
    let active = true;
    void controller.load(sceneId, cursor).then(() => {
      if (active && messageId && consumedLink.current !== messageId) { consumedLink.current = messageId; void controller.open(messageId); }
    });
    return () => { active = false; controller.cancel(); };
  }, [controller, sceneId, cursor, messageId]));
  const baseRect = scene && size.width > 48 && size.height > 48
    ? imageRect({ width: scene.imageWidth, height: scene.imageHeight }, size, fit) : null;
  const page = state.list.kind === 'ready' ? state.list.page : null;
  const reader = state.reader ?? (presented.phase === 'hidden' ? null : presented.reader);
  const readingId=state.reader?.id;
  useEffect(()=>{
    if(!local || !readingId)return;
    const timer=setInterval(()=>{if(AppState.currentState==='active')void controller.open(readingId);},30000);
    return ()=>clearInterval(timer);
  },[local,readingId,controller]);
  const selectedAnchor = reader?.kind === 'found' ? reader.message.anchor : page?.items.find(m => m.id === reader?.id)?.anchor
    ?? (presented.phase !== 'hidden' && presented.reader.id === reader?.id ? presented.anchor : null);
  const p = baseRect && selectedAnchor ? project(selectedAnchor,baseRect) : null;
  const outside = !!p && (p.x < 0 || p.y < 0 || p.x > size.width || p.y > size.height);
  const rect = outside && scene ? imageRect({width:scene.imageWidth,height:scene.imageHeight},size,'contain') : baseRect;
  const selectedPoint = rect && selectedAnchor ? project(selectedAnchor,rect) : null;
  const groups = rect ? layoutMarkers(page?.items ?? [],rect,size) : [];
  const side = selectedPoint && selectedPoint.y < size.height / 2 ? 'bottom' : 'top';
  useEffect(() => {
    if (active.current && AppState.currentState === 'active') presentation.sync(state.reader, side);
    else presentation.hide();
  }, [state.reader, side, presentation]);
  async function openEditor(id?:string) {
    if (writing.current) return;
    writing.current = true; setSaving(true); setWriteError('');
    const generation = sceneGeneration.current;
    try {
      let d: Draft|null;
      if (id) d = await deviceNotes.edit(id);
      else if (moving && anchor) { d={...moving,...anchor,revision:moving.revision+1}; await deviceNotes.saveDraft(d); }
      else if (anchor) d = await deviceNotes.createDraft(sceneId,anchor);
      else return;
      if (!active.current || AppState.currentState !== 'active' || generation !== sceneGeneration.current) return;
      if (!d || d.sceneId !== sceneId) throw new Error('Missing draft');
      presentation.hide(); controller.close(); setPositioning(false); setMoving(null); setEditing(d);
    } catch { setWriteError('기기에서 글을 열지 못했어요. 저장소와 개발 빌드를 확인해 주세요.'); }
    finally { writing.current=false; setSaving(false); }
  }
  function close() {
    foregroundId.current=undefined;
    if (outside) setFit('contain');
    controller.close();
  }
  if (!scene) return <View style={s.fallback}><Text accessibilityRole="alert" style={s.body}>이 장소의 사진을 찾을 수 없어요.</Text></View>;
  const photo = photos[scene.photo.file];
  const groupIndex = reader ? groupIds.indexOf(reader.id) : -1;
  return <View style={s.screen}>
    <Stack.Screen options={{ title: scene.name }} />
    <View importantForAccessibility={reader ? 'no-hide-descendants' : 'auto'}>
      <View style={s.toolbar}><Button buttonRef={titleRef} label={fit === 'cover' ? '전체 사진' : '확대 보기'} disabled={!!reader} onPress={() => setFit(fit === 'cover' ? 'contain' : 'cover')} /></View>
    </View>
    <View ref={stageRef} collapsable={false} style={s.stage} importantForAccessibility={reader ? 'no-hide-descendants' : 'auto'} onLayout={({ nativeEvent: { layout } }) => {
      setSize({ width: layout.width, height: layout.height });
      stageRef.current?.measureInWindow((x, y) => setStageOrigin({ x, y }));
    }}>
      {rect && <Image key={`${sceneId}:${imageAttempt}`} source={photo} accessible={false} resizeMode="stretch"
        onLoad={() => { setLoaded(true); setImageFailed(false); }} onError={() => { setLoaded(false); setImageFailed(true); }}
        style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.width, height: rect.height }} />}
      {imageFailed && <View style={s.fallback}><Text style={s.body}>사진을 불러오지 못했어요.</Text><Button label="다시 시도" onPress={() => { setImageFailed(false); setLoaded(false); setImageAttempt(x => x + 1); }} /></View>}
      {loaded && !imageFailed && !positioning && groups.map(g => {
        const key = g.ids.join(':');
        if (reader) return null;
        return <Pressable key={key} ref={node => { markerRefs.current.set(key, node); }} accessibilityRole="button"
          accessibilityLabel={g.ids.length > 1 ? `겹친 쪽지 ${g.ids.length}개 읽기` : '쪽지 읽기'}
          style={[s.target, { left: g.x - 24, top: g.y - 24 }]} onPress={() => {
            returnId.current = key; setGroupIds(g.ids);
            stageRef.current?.measureInWindow((x, y) => setStageOrigin({ x, y }));
            void controller.open(g.ids[0]);
          }}>
          <View style={[s.glyph, { transform: [{ translateX: g.glyph.x - g.x }, { translateY: g.glyph.y - g.y }] }]}>
            {g.ids.length > 1 ? <Text style={s.count}>{g.ids.length}</Text> : <View style={s.bubble} />}
          </View>
        </Pressable>;
      })}
      {reader && selectedPoint && loaded && !imageFailed && <View pointerEvents="none" style={[s.selected, { left: selectedPoint.x - 16, top: selectedPoint.y - 16 }]} />}
      {positioning && rect && loaded && !imageFailed && <>
        <Pressable accessibilityLabel="사진에서 위치 선택" accessibilityRole="button" style={StyleSheet.absoluteFill}
          onPress={({nativeEvent:e})=>{ const a=unproject({x:e.locationX,y:e.locationY},rect,size); if(a) setAnchor(a); }} />
        {anchor && <View pointerEvents="none" style={[s.selected,{left:project(anchor,rect).x-16,top:project(anchor,rect).y-16}]} />}
      </>}
    </View>
    <View style={[s.footer, { paddingBottom: insets.bottom + 8 }]} importantForAccessibility={reader ? 'no-hide-descendants' : 'auto'}>
      {state.list.kind === 'loading' && <Text accessibilityLiveRegion="polite" style={s.meta}>쪽지를 불러오는 중이에요.</Text>}
      {state.list.kind === 'error' && <><Text style={s.meta}>쪽지를 불러올 수 없어요.</Text><Button label="다시 시도" onPress={() => { void controller.load(sceneId, cursor); }} /></>}
      {page?.publicStatus==='error' && <><Text style={s.meta}>공개 쪽지를 불러오지 못했어요. 기기의 글만 보여요.</Text><Button label="공개 쪽지 다시 불러오기" onPress={()=>{setCursors([null]);void controller.load(sceneId,null);}} /></>}
      {page?.items.length === 0 && !positioning && page.publicStatus!=='error' && <Text style={s.meta}>{local && page.publicStatus!=='ready' ? '이 사진에 남긴 내 글이 없어요.' : '아직 쪽지가 없어요.'}</Text>}
      {local && <View style={s.row}>{positioning ? <>
        <Button label="취소" disabled={saving} onPress={()=>{setPositioning(false);setEditing(moving);setMoving(null);setAnchor(null);}} />
        {!anchor && <Button label="사진 중앙 선택" onPress={()=>setAnchor({u:.5,v:.5})} />}
        <Button label="글 쓰기" variant="primary" disabled={!anchor || saving || !loaded || imageFailed} onPress={()=>{void openEditor();}} />
      </> : <Button label="글 남기기" variant="primary" disabled={!loaded || imageFailed} onPress={()=>{setPositioning(true);setAnchor(null);setWriteError('');}} />}</View>}
      {!!writeError && <Text accessibilityRole="alert" style={s.meta}>{writeError}</Text>}
      <View style={s.row}>
        {cursors.length > 1 && <Button label="이전 흔적" onPress={() => setCursors(xs => xs.slice(0, -1))} />}
        {page?.nextCursor && <Button label="다음 흔적" onPress={() => setCursors(xs => [...xs, page.nextCursor])} />}
      </View>
      <Text style={s.meta}>{scene.photo.credit} · {scene.photo.license}</Text>
    </View>
    <Modal visible={presented.phase !== 'hidden'} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={close} onShow={() => {motion.onShow();const phase=presentation.snapshot().phase;if(phase === 'opening' || phase === 'open')focus(closeRef.current);}}>
      <View ref={modalRef} collapsable={false} style={[s.modal, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20, justifyContent: presented.phase !== 'hidden' && presented.side === 'bottom' ? 'flex-end' : 'flex-start' }]}>
        <Animated.View style={[s.card,motion.cardStyle]} pointerEvents={presented.phase === 'closing' ? 'none' : 'auto'} importantForAccessibility={presented.phase === 'closing' ? 'no-hide-descendants' : 'auto'} onLayout={({nativeEvent:{layout:frame}}) => modalRef.current?.measureInWindow((x,y)=>setCardOrigin({x:x+frame.x,y:y+frame.y}))} accessibilityViewIsModal onAccessibilityEscape={close}>
          {!opaque && loaded && !imageFailed && rect && <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Animated.Image source={photo} blurRadius={12} resizeMode="stretch" style={[{ position: 'absolute', left: stageOrigin.x + rect.x - cardOrigin.x, top: stageOrigin.y + rect.y - cardOrigin.y, width: rect.width, height: rect.height },motion.backdropStyle]} />
            <View style={s.tint} />
          </View>}
          <View style={s.row}><Text accessibilityRole="header" style={s.heading}>쪽지</Text><Button buttonRef={closeRef} label="닫기" onPress={close}/></View>
          <ScrollView style={s.bodyScroll} contentContainerStyle={s.bodyContent}>
            {reader?.kind === 'found' && <Text selectable style={s.body}>{reader.message.body}</Text>}
            {reader?.kind==='found' && reportFor===reader.id && <View>
              <Text style={s.meta}>신고 이유</Text>
              <Text style={s.meta}>신고를 위해 익명 세션을 사용해요.</Text>
              {([['spam','스팸'],['abuse','불쾌한 내용'],['personal_info','개인정보'],['other','기타']] as const).map(([reason,label])=>
                <Button key={reason} label={label} disabled={reportState?.busy} onPress={()=>{setReportFor(null);void report(reader.id,reason);}} />)}
              <Button label="취소" onPress={()=>setReportFor(null)} />
            </View>}
            {reader?.kind === 'loading' && <Skeleton />}
            {reader?.kind === 'unavailable' && <Text style={s.body}>지금은 볼 수 없는 글이에요.</Text>}
            {reader?.kind === 'error' && <><Text style={s.body}>글을 불러오지 못했어요.</Text><Button label="다시 시도" onPress={() => { void controller.open(reader.id); }} /></>}
          </ScrollView>
          <View style={s.row}>
            {groupIds.length > 1 && <><Button label="이전 글" disabled={groupIndex <= 0} onPress={() => { void controller.open(groupIds[groupIndex - 1]); }} /><Text style={s.meta}>{groupIndex + 1}/{groupIds.length}</Text><Button label="다음 글" disabled={groupIndex < 0 || groupIndex >= groupIds.length - 1} onPress={() => { void controller.open(groupIds[groupIndex + 1]); }} /></>}
            <Button label={opaque ? '투명 배경' : '불투명 배경'} onPress={() => setOpaque(x => !x)} />
            {local && reader?.kind === 'found' && reader.message.owned!==false && <Button label="편집" disabled={saving} onPress={()=>{void openEditor(reader.id);}} />}
            {local && publicServiceConfigured && reader?.kind==='found' && reader.message.origin==='public' && !reader.message.owned &&
              <Button label="신고" disabled={reportState?.busy} onPress={()=>chooseReport(reader.id)} />}
            {reader && reportState?.id===reader.id && !!reportState.message && <Text accessibilityLiveRegion="polite" style={s.meta}>{reportState.message}</Text>}
            {reader && !!writeError && <Text accessibilityRole="alert" style={s.meta}>{writeError}</Text>}
          </View>
        </Animated.View>
      </View>
    </Modal>
    {editing && <Editor key={editing.id} initial={editing} onClose={()=>{setEditing(null);setCursors([null]);void controller.load(sceneId,null);}}
      onMove={d=>{setEditing(null);setMoving(d);setFit('contain');setAnchor({u:d.u,v:d.v});setPositioning(true);}} />}
  </View>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.page }, stage: { flex: 1, overflow: 'hidden', backgroundColor: color.subtle },
  toolbar: { paddingHorizontal: layout.gutter, alignItems: 'flex-end' }, footer: { paddingHorizontal: layout.gutter, paddingTop: 8, gap: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  body: textStyles.body, heading: { ...textStyles.heading, paddingLeft: 12 }, meta: textStyles.source,
  target: { position: 'absolute', width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  glyph: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#243247DD', borderColor: '#FFFFFF', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bubble: { width: 14, height: 11, borderColor: '#FFFFFF', borderWidth: 1.5, borderRadius: 3 }, count: { color: '#FFFFFF', fontSize: 14 },
  selected: { position: 'absolute', width: 32, height: 32, borderWidth: 2, borderRadius: 16, borderColor: '#FFFFFF', backgroundColor: '#243247' },
  modal: { flex: 1, paddingHorizontal: 20 }, card: { width: '100%', maxWidth: 560, alignSelf: 'center', maxHeight: '100%', backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFFDD', padding: 8, elevation: 4 },
  bodyScroll: { flexGrow: 0, flexShrink: 1 }, bodyContent: { paddingHorizontal: 12, paddingVertical: 8 }, tint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,.86)' },
  fallback: { padding: layout.gutter, backgroundColor: color.page, gap: 12 },
});
