import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, AppState, BackHandler, findNodeHandle, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../ui/Text';
import { Stack, useFocusEffect } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { photos } from '../place-content/photos';
import { getScene } from './scenes';
import { imageRect, layoutMarkers, originalView, zoomedRect, project, unproject, type Fit, type Size } from './geometry';
import { usePhotoGestures } from './usePhotoGestures';
import { PhotoGlass } from '../../ui/PhotoGlass';
import { PhotoReadingText,PhotoReadingAction } from '../../ui/PhotoReading';
import { createMessageReader } from './reader';
import type { Anchor, Messages } from './contract';
import { accountNotes } from '../local-notes/device';
import type { Draft } from '../local-notes/store';
import Editor from '../local-notes/Editor';
import {productSceneMessages,getPublicService,publicServiceConfigured} from '../public-messages/nativeService';
import {Skeleton} from '../../ui/Skeleton';
import Animated from 'react-native-reanimated';
import { Action as Button } from '../../ui/Action';
import { color, layout, textStyles } from '../../ui/theme';
import { createReaderPresentation } from './presentation';
import { useReaderMotion } from './useReaderMotion';
import { PublicationRejected } from '../public-messages/publication';
import { rateLimitText } from '../public-messages/feedback';

type FocusTarget = React.ElementRef<typeof View> | null;
function focus(target: FocusTarget) {
  target?.focus();
  const tag = target && findNodeHandle(target);
  if (tag) AccessibilityInfo.setAccessibilityFocus(tag);
}
export default function SceneScreen({ sceneId, source, messageId, draftId }: { sceneId: string; source?: Messages; messageId?: string; draftId?:string }) {
  const [deviceNotes]=useState(()=>accountNotes());
  const scene = getScene(sceneId), insets = useSafeAreaInsets();
  const local = source===undefined || source === deviceNotes.messages;
  const [actual]=useState(()=>source??productSceneMessages());
  const [positioning,setPositioning] = useState(false), [anchor,setAnchor] = useState<Anchor|null>(null);
  const [editing,setEditing] = useState<Draft|null>(null), [moving,setMoving] = useState<Draft|null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [screenSize,setScreenSize]=useState({width:0,height:0}),[stageFrame,setStageFrame]=useState({x:0,y:0,width:0,height:0});
  const [composingSize,setComposingSize]=useState<Size|null>(null);
  const [writeError,setWriteError] = useState(''), [saving,setSaving] = useState(false);
  const writing = useRef(false), consumedLink = useRef('');
  const [fit, setFit] = useState<Fit>('cover');
  const [photoView,setPhotoView]=useState(originalView);
  function changeFit(next:Fit){setFit(next);setPhotoView(originalView);}
  const consumedDraft=useRef('');
  useEffect(()=>{
    let active=true;
    if(local && draftId && size.width>48 && size.height>48 && consumedDraft.current!==draftId) void deviceNotes.getDraft(draftId,sceneId).then(d=>{
      if(!active)return;
      consumedDraft.current=draftId;
      if(!d){setWriteError('이 사진에서 초안을 찾을 수 없어요.');return;}
      setComposingSize(size);setEditing(d);setAnchor({u:d.u,v:d.v});
    },()=>{if(active)setWriteError('초안을 불러오지 못했어요. 내 글에서 다시 열어 주세요.');});
    return ()=>{active=false;};
  },[local,draftId,sceneId,size,deviceNotes]);
  const controller = useMemo(() => createMessageReader(actual), [actual]);
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  const presentation = useMemo(() => createReaderPresentation(), []);
  const presented = useSyncExternalStore(presentation.subscribe, presentation.snapshot);
  // IME may resize the visible stage, but it must not move the selected photo point.
  const photoSize=editing&&composingSize?composingSize:size;
  const [stageOrigin, setStageOrigin] = useState({ x: 0, y: 0 });
  const [cardOrigin, setCardOrigin] = useState({ x: 0, y: 0 });
  const [cardSize,setCardSize]=useState({width:0,height:0});
  const [loaded, setLoaded] = useState(false), [imageFailed, setImageFailed] = useState(false);
  const [imageAttempt, setImageAttempt] = useState(0), [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [opaque, setOpaque] = useState(false);
  const stageRef = useRef<View>(null), closeRef = useRef<View>(null), titleRef = useRef<View>(null);
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
  const onReaderShow=useRef(motion.onShow);useEffect(()=>{onReaderShow.current=motion.onShow;});
  const closeReader=useRef(()=>{});useEffect(()=>{closeReader.current=close;});
  useEffect(()=>{
    if(presented.phase==='hidden')return;
    onReaderShow.current();
    if(presented.phase==='opening')requestAnimationFrame(()=>focus(closeRef.current));
  },[presented.phase, presented.token]);
  useEffect(()=>{
    if(presented.phase==='hidden'||editing)return;
    const back=BackHandler.addEventListener('hardwareBackPress',()=>{closeReader.current();return true;});
    return()=>back.remove();
  },[presented.phase,controller,editing]);
  usePreventRemove(presented.phase!=='hidden'&&!editing,()=>closeReader.current());
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
    catch(error){setReportState({id,busy:false,message:error instanceof PublicationRejected && error.rateLimit?rateLimitText(error.rateLimit,'신고'):'신고 접수를 확인하지 못했어요. 다시 시도해 주세요.'});}
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
  const fitRect = scene && photoSize.width > 48 && photoSize.height > 48
    ? imageRect({ width: scene.imageWidth, height: scene.imageHeight }, photoSize, fit) : null;
  const baseRect=fitRect?zoomedRect(fitRect,photoSize,photoView):null;
  const page = state.list.kind === 'ready' ? state.list.page : null;
  const reader = state.reader ?? (presented.phase === 'hidden' ? null : presented.reader);
  const readingId=state.reader?.id;
  useEffect(()=>{
    if(!local || !readingId)return;
    const timer=setInterval(()=>{if(AppState.currentState==='active')void controller.open(readingId,'revalidate');},30000);
    return ()=>clearInterval(timer);
  },[local,readingId,controller]);
  const selectedAnchor = editing ?? (reader?.kind === 'found' ? reader.message.anchor : page?.items.find(m => m.id === reader?.id)?.anchor
    ?? (presented.phase !== 'hidden' && presented.reader.id === reader?.id ? presented.anchor : null));
  const p = baseRect && selectedAnchor ? project(selectedAnchor,baseRect) : null;
  const outside = !!p && (p.x < 0 || p.y < 0 || p.x > photoSize.width || p.y > photoSize.height);
  const rect = outside && scene ? imageRect({width:scene.imageWidth,height:scene.imageHeight},photoSize,'contain') : baseRect;
  const gestures=usePhotoGestures(fitRect,baseRect,size,stageOrigin,!reader&&!editing&&loaded&&!imageFailed,setPhotoView);
  const selectedPoint = rect && selectedAnchor ? project(selectedAnchor,rect) : null;
  const groups = rect&&!editing&&!reader&&size.width>48&&size.height>48 ? layoutMarkers(page?.items ?? [],rect,size) : [];
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
      presentation.hide(); controller.close(); setPositioning(false); setMoving(null);setComposingSize(size); setEditing(d);
    } catch { setWriteError('기기에서 글을 열지 못했어요. 저장소와 개발 빌드를 확인해 주세요.'); }
    finally { writing.current=false; setSaving(false); }
  }
  function close() {
    foregroundId.current=undefined;
    if (outside) changeFit('contain');
    controller.close();
  }
  if (!scene) return <View style={s.fallback}><Text accessibilityRole="alert" style={s.body}>이 장소의 사진을 찾을 수 없어요.</Text></View>;
  const photo = photos[scene.photo.file];
  const groupIndex = reader ? groupIds.indexOf(reader.id) : -1;
  return <View style={s.screen} onLayout={e=>setScreenSize(e.nativeEvent.layout)}>
    <Stack.Screen options={{ title: scene.name }} />
    <View pointerEvents={reader || editing ? 'none' : 'auto'} importantForAccessibility={reader || editing ? 'no-hide-descendants' : 'auto'}>
      <View style={s.toolbar}><Button buttonRef={titleRef} label="전체 사진" disabled={!!reader||!!editing} onPress={() => changeFit('contain')} />
        <Button label="축소" disabled={!!reader||!!editing||photoView.zoom<=1} onPress={()=>setPhotoView(v=>({...v,zoom:Math.max(1,v.zoom-.5)}))}/>
        <Button label="확대" disabled={!!reader||!!editing||photoView.zoom>=4} onPress={()=>setPhotoView(v=>({...v,zoom:Math.min(4,v.zoom+.5)}))}/></View>
    </View>
    <View ref={stageRef} collapsable={false} style={s.stage} onLayout={({ nativeEvent: { layout } }) => {
      setSize({ width: layout.width, height: layout.height });
      setStageFrame(layout);
      stageRef.current?.measureInWindow((x, y) => setStageOrigin({ x, y }));
    }}>
      <View {...gestures} style={[StyleSheet.absoluteFill,s.photoClip]} pointerEvents={reader || editing ? 'none' : 'auto'} importantForAccessibility={reader || editing ? 'no-hide-descendants' : 'auto'}>
      {rect && <Image key={`${sceneId}:${imageAttempt}`} source={photo} accessible={false} resizeMode="stretch"
        onLoad={() => { setLoaded(true); setImageFailed(false); }} onError={() => { setLoaded(false); setImageFailed(true); }}
        style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.width, height: rect.height }} />}
      {imageFailed && <View style={s.fallback}><Text style={s.body}>사진을 불러오지 못했어요.</Text><Button label="다시 시도" onPress={() => { setImageFailed(false); setLoaded(false); setImageAttempt(x => x + 1); }} /></View>}
      {loaded && !imageFailed && !positioning && !editing && groups.map(g => {
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
      {(reader||editing) && selectedPoint && loaded && !imageFailed && <View pointerEvents="none" style={[s.selected, { left: selectedPoint.x - 7, top: selectedPoint.y - 7 }]} />}
      {positioning && rect && loaded && !imageFailed && <>
        <Pressable accessibilityLabel="사진에서 위치 선택" accessibilityRole="button" style={StyleSheet.absoluteFill}
          onPress={({nativeEvent:e})=>{ const a=unproject({x:e.locationX,y:e.locationY},rect,size); if(a) setAnchor(a); }} />
        {anchor && <View pointerEvents="none" style={[s.selected,{left:project(anchor,rect).x-7,top:project(anchor,rect).y-7}]} />}
      </>}
      </View>
      {presented.phase !== 'hidden' && <View pointerEvents="box-none" style={[s.modal,{justifyContent:presented.side==='bottom'?'flex-end':'flex-start'}]}>
        <Animated.View style={[s.card,motion.cardStyle]} pointerEvents={presented.phase === 'closing' ? 'none' : 'auto'} importantForAccessibility={presented.phase === 'closing' ? 'no-hide-descendants' : 'auto'} onLayout={({nativeEvent:{layout:frame}}) => {setCardSize({width:frame.width,height:frame.height});setCardOrigin({x:frame.x,y:frame.y});}} accessibilityViewIsModal onAccessibilityEscape={close}>
          {!opaque && loaded && !imageFailed && rect && <PhotoGlass source={photo} image={rect} frame={{...cardOrigin,...cardSize}} stageClip={{x:0,y:0,...size}} radius={20} tint={.12}/>}
          <View style={s.row}><PhotoReadingText accessibilityRole="header" style={s.heading}>쪽지</PhotoReadingText><PhotoReadingAction buttonRef={closeRef} label="닫기" onPress={close}/></View>
          <ScrollView style={s.bodyScroll} contentContainerStyle={s.bodyContent}>
            {reader?.kind === 'found' && <PhotoReadingText selectable style={s.body}>{reader.message.body}</PhotoReadingText>}
            {reader?.kind==='found' && reportFor===reader.id && <View>
              <PhotoReadingText style={s.readingMeta}>신고 이유</PhotoReadingText>
              {([['spam','스팸'],['abuse','불쾌한 내용'],['personal_info','개인정보'],['other','기타']] as const).map(([reason,label])=>
                <PhotoReadingAction key={reason} label={label} disabled={reportState?.busy} onPress={()=>{setReportFor(null);void report(reader.id,reason);}} />)}
              <PhotoReadingAction label="취소" onPress={()=>setReportFor(null)} />
            </View>}
            {reader?.kind === 'loading' && <Skeleton />}
            {reader?.kind === 'unavailable' && <PhotoReadingText style={s.body}>지금은 볼 수 없는 글이에요.</PhotoReadingText>}
            {reader?.kind === 'error' && <><PhotoReadingText style={s.body}>글을 불러오지 못했어요.</PhotoReadingText><PhotoReadingAction label="다시 시도" onPress={() => { void controller.open(reader.id); }} /></>}
          </ScrollView>
          {reader?.kind==='found' && reader.checking && <PhotoReadingText accessibilityLiveRegion="polite" style={s.readingMeta}>글 상태를 다시 확인하고 있어요.</PhotoReadingText>}
          <View style={s.row}>
            {groupIds.length > 1 && <><PhotoReadingAction label="이전 글" disabled={groupIndex <= 0} onPress={() => { void controller.open(groupIds[groupIndex - 1]); }} /><PhotoReadingText style={s.readingMeta}>{groupIndex + 1}/{groupIds.length}</PhotoReadingText><PhotoReadingAction label="다음 글" disabled={groupIndex < 0 || groupIndex >= groupIds.length - 1} onPress={() => { void controller.open(groupIds[groupIndex + 1]); }} /></>}
            <PhotoReadingAction label={opaque ? '투명 배경' : '불투명 배경'} onPress={() => setOpaque(x => !x)} />
            {local && reader?.kind === 'found' && reader.message.owned!==false && <PhotoReadingAction label="편집" disabled={saving} onPress={()=>{void openEditor(reader.id);}} />}
            {local && publicServiceConfigured && reader?.kind==='found' && reader.message.origin==='public' && !reader.message.owned && <PhotoReadingAction label="신고" disabled={reportState?.busy} onPress={()=>chooseReport(reader.id)} />}
            {reader && reportState?.id===reader.id && !!reportState.message && <PhotoReadingText accessibilityLiveRegion="polite" style={s.readingMeta}>{reportState.message}</PhotoReadingText>}
            {reader && !!writeError && <PhotoReadingText accessibilityRole="alert" style={s.readingMeta}>{writeError}</PhotoReadingText>}
          </View>
        </Animated.View>
      </View>}
    </View>
    <View pointerEvents={reader || editing ? 'none' : 'auto'} style={[s.footer, { paddingBottom: insets.bottom + 8 }]} importantForAccessibility={reader || editing ? 'no-hide-descendants' : 'auto'}>
      {state.list.kind === 'loading' && <Text accessibilityLiveRegion="polite" style={s.meta}>쪽지를 불러오는 중이에요.</Text>}
      {state.list.kind === 'error' && <><Text style={s.meta}>쪽지를 불러올 수 없어요.</Text><Button label="다시 시도" onPress={() => { void controller.load(sceneId, cursor); }} /></>}
      {page?.publicStatus==='error' && <><Text style={s.meta}>공개 쪽지를 불러오지 못했어요. 기기의 글만 보여요.</Text><Button label="공개 쪽지 다시 불러오기" onPress={()=>{setCursors([null]);void controller.load(sceneId,null);}} /></>}
      {page?.items.length === 0 && !positioning && page.publicStatus!=='error' && <Text style={s.meta}>{local && page.publicStatus!=='ready' ? '이 사진에 남긴 내 글이 없어요.' : '아직 쪽지가 없어요.'}</Text>}
      {local && <View style={s.row}>{positioning ? <>
        <Button label="취소" disabled={saving} onPress={()=>{setPositioning(false);setComposingSize(size);setEditing(moving);setMoving(null);setAnchor(null);}} />
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
    {editing && <Editor key={editing.id} initial={editing} side={side} compact={size.height<320} stage={stageFrame}
      viewport={size.height<320?{x:0,y:0,...screenSize}:stageFrame}
      photo={rect?{source:photo,rect:{...rect,x:rect.x+stageFrame.x,y:rect.y+stageFrame.y}}:undefined}
      onClose={()=>{setEditing(null);setCursors([null]);void controller.load(sceneId,null);restoreFocus();}}
      onMove={d=>{setEditing(null);setMoving(d);setAnchor({u:d.u,v:d.v});setPositioning(true);requestAnimationFrame(()=>focus(titleRef.current));}} />}
  </View>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.page }, stage: { flex: 1, overflow: 'hidden', backgroundColor: color.subtle },
  photoClip:{overflow:'hidden'},
  toolbar: { paddingHorizontal: layout.gutter, flexDirection:'row',justifyContent:'flex-end',flexWrap:'wrap' }, footer: { paddingHorizontal: layout.gutter, paddingTop: 8, gap: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  body: textStyles.body, heading: { ...textStyles.heading, paddingLeft: 12 }, meta: textStyles.source,
  target: { position: 'absolute', width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  glyph: { minWidth: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,.3)', borderColor: '#FFFFFF', borderWidth: 1, alignItems: 'center', justifyContent: 'center',boxShadow:'0px 0px 3px rgba(0,0,0,.6)' },
  bubble: { width: 4, height: 4, backgroundColor: '#FFFFFF', borderRadius: 2 }, count: { color: color.ink, backgroundColor:'rgba(255,255,255,.8)',fontSize: 10,lineHeight:14,paddingHorizontal:3,borderRadius:7 },
  selected: { position: 'absolute', width: 14, height: 14, borderWidth: 1.5, borderRadius: 7, borderColor: '#FFFFFF', backgroundColor: 'rgba(255,255,255,.35)',boxShadow:'0px 0px 3px rgba(0,0,0,.65)' },
  modal: { ...StyleSheet.absoluteFill, paddingHorizontal: 20,paddingVertical:12 }, card: { width: '100%', maxWidth: 560, alignSelf: 'center', maxHeight: '100%', backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFFDD', padding: 8, elevation: 4 },
  bodyScroll: { flexGrow: 0, flexShrink: 1 }, bodyContent: { paddingHorizontal: 12, paddingVertical: 8 }, tint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,.86)' },
  readingMeta:{...textStyles.source,color:'#353535'},
  fallback: { padding: layout.gutter, backgroundColor: color.page, gap: 12 },
});
