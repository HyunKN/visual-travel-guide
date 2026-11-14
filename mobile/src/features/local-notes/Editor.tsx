import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, type ImageSourcePropType } from 'react-native';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useNavigation } from 'expo-router';
import { isHomeAction } from '../../navigation/home';
import { PhotoReadingText as Text,PhotoReadingAction as Action,photoReadingSurface } from '../../ui/PhotoReading';
import { validateBody,bodyLength,limitBodyInput,MAX_BODY_CHARACTERS } from '../place-messages/contract';
import { accountNotes } from './device';
import type { Draft } from './store';
import {getPublicService,publicServiceConfigured} from '../public-messages/nativeService';
import type {DeliveryResult,PublicationJob} from '../public-messages/publication';
import {RecoveryChanged,recoveryOptions,type Inspection,type RecoveryOperation} from '../public-messages/recovery';
import {editorAction} from '../public-messages/editorAction';
import { color, layout, textStyles } from '../../ui/theme';
import { rateLimitText } from '../public-messages/feedback';
import { PhotoGlass } from '../../ui/PhotoGlass';
import type { Rect } from '../place-messages/geometry';
export { Action } from '../../ui/Action';

export default function Editor({initial,onClose,onMove,photo,side='bottom',stage,viewport,compact=false}: {initial:Draft;onClose:(returnToReader?:boolean)=>void;onMove?: (draft:Draft)=>void;photo?:{source:ImageSourcePropType;rect:Rect};side?:'top'|'bottom';stage?:Rect;viewport?:Rect;compact?:boolean}) {
  const [deviceNotes]=useState(()=>accountNotes());
  const navigation=useNavigation();
  const [value,setValue] = useState(initial), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const last = useRef(initial);
  const lock = useRef(false), mounted = useRef(true);
  const [job,setJob]=useState<PublicationJob|null>(null),[jobLoaded,setJobLoaded]=useState(false);
  const [inspection,setInspection]=useState<Inspection|null>(null);
  const [editingSaved,setEditingSaved]=useState(false),[originalLoaded,setOriginalLoaded]=useState(false);
  const inputRef=useRef<TextInput>(null),panelRef=useRef<View>(null),focused=useRef(false),closeAction=useRef(()=>{});
  const [panel,setPanel]=useState<Rect>({x:0,y:0,width:0,height:0});
  const publication=job?.state??null;
  async function refreshJob(){
    const next=await deviceNotes.getPublication(initial.id);
    if(mounted.current){setJob(next);setJobLoaded(true);}
  }
  useEffect(()=>{let active=true;void deviceNotes.getPublication(initial.id).then(next=>{if(active){setJob(next);setJobLoaded(true);}},()=>{if(active)setError('공개 상태를 확인하지 못했어요.');});return ()=>{active=false;};},[initial.id,deviceNotes]);
  useEffect(()=>{let active=true;void deviceNotes.getSavedNote(initial.id).then(note=>{if(active){setEditingSaved(!!note);setOriginalLoaded(true);}},()=>{if(active){setOriginalLoaded(true);setError('원래 쪽지를 확인하지 못했어요. 닫으면 수정 내용을 초안으로 보관해요.');}});return()=>{active=false;};},[initial.id,deviceNotes]);
  useEffect(() => {
    mounted.current = true;
    const background=AppState.addEventListener('change',state=>{if(state!=='active')void deviceNotes.saveDraft(last.current).catch(()=>{if(mounted.current)setError('초안을 저장하지 못했어요. 입력은 이 화면에 남아 있어요.');});});
    const back=BackHandler.addEventListener('hardwareBackPress',()=>{closeAction.current();return true;});
    return () => { mounted.current = false;background.remove();back.remove(); };
  },[deviceNotes]);
  usePreventRemove(true,({data})=>{
    if(isHomeAction(data.action)) {
      if(lock.current){setError('처리가 끝난 뒤 홈으로 이동해 주세요.');return;}
      // Home preserves edits as a draft; only explicit cancel/Back restores the original.
      void finish('leave',()=>requestAnimationFrame(()=>navigation.dispatch(data.action)));
    } else if(editingSaved)void finish('cancel');
    else void finish('leave',()=>requestAnimationFrame(()=>navigation.dispatch(data.action)));
  });
  closeAction.current=()=>{if(originalLoaded)void finish(editingSaved?'cancel':'leave');};
  function change(patch: Partial<Pick<Draft,'body'|'visibility'>>) {
    if (lock.current) return;
    const next = {...last.current,...patch,revision:last.current.revision+1};
    last.current = next; setValue(next); setError('');
    // Queue every edit immediately: backgrounding or route changes cannot cancel a debounce.
    void deviceNotes.saveDraft(next).catch(() => {
      if (mounted.current && last.current === next && !lock.current) setError('초안을 저장하지 못했어요.');
    });
  }
  async function finish(mode:'leave'|'save'|'discard'|'move'|'cancel',after?:()=>void) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const d = last.current;
      if (mode === 'cancel') await deviceNotes.cancelEdit(d.id);
      else if (mode === 'save') await deviceNotes.savePrivate(d);
      else if (mode === 'discard') await deviceNotes.discardDraft(d.id);
      else await deviceNotes.saveDraft(d);
      if (mode === 'move' && onMove) onMove(d); else onClose(mode==='cancel');
      after?.();
    } catch { setError(mode==='cancel'?'수정을 취소하지 못했어요. 공개 상태를 확인한 뒤 다시 시도해 주세요.':'저장소에 변경을 반영하지 못했어요. 입력은 그대로 있어요.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  const invalid = validateBody(value.body);
  const action=editorAction(value,job,publicServiceConfigured,jobLoaded);
  function delivered(next:DeliveryResult){
    setJob(next);setJobLoaded(true);setInspection(null);
    if(next.state==='published')onClose();
    else if(next.state==='withdrawn')setError('공개를 철회했어요. 초안은 이 기기에 남아 있어요.');
    else setError(next.rateLimit?rateLimitText(next.rateLimit,'공개'):next.state==='uncertain'?'공개 결과를 확인하지 못했어요. 다시 확인해 주세요.':
      next.state==='conflict'?'기존 공개 글과 상태가 달라요. 서버 상태를 확인해 주세요.':'공개하지 못했어요. 초안은 보관돼요.');
  }
  async function recover(operation:RecoveryOperation|'inspect') {
    if(lock.current)return;
    lock.current=true;setBusy(true);setError('');
    try{
      await deviceNotes.saveDraft(last.current);
      const service=getPublicService();
      if(operation==='inspect'){
        const next=await service.inspectPublication(last.current.id);
        if(mounted.current)setInspection(next);
      }else{
        if(!inspection)throw new RecoveryChanged();
        const next=await service.recoverPublication(last.current,inspection,operation);
        if(mounted.current){
          if(next?.state==='withdrawn'&&last.current.visibility==='private'&&!validateBody(last.current.body)){
            setJob(next);await deviceNotes.savePrivate(last.current);if(mounted.current)onClose();
          }else if(next)delivered(next);else onClose();
        }
      }
    }catch(error){
      if(mounted.current){
        setInspection(null);setJobLoaded(false);
        setError(error instanceof RecoveryChanged?'서버 상태가 다시 달라졌어요. 다시 확인해 주세요.':'서버 상태나 세션을 확인하지 못했어요. 초안은 그대로 있어요.');
      }
      try{await refreshJob();}catch{/* Keep the draft and offer explicit retry. */}
    }finally{lock.current=false;if(mounted.current)setBusy(false);}
  }
  function confirmRecovery(operation:RecoveryOperation){
    Alert.alert(operation==='publish'?(inspection?.state.kind==='missing'?'이 초안을 공개할까요?':'이 초안으로 서버 글을 바꿀까요?'):'나만 보기로 저장할까요?',
      operation==='publish'?'확인한 서버 글 대신 현재 초안이 공개돼요.':'기존 공개 글을 내린 뒤 이 기기에 저장해요.',[
        {text:'취소',style:'cancel'},{text:operation==='publish'?'반영':'저장',onPress:()=>{void recover(operation);}},
      ]);
  }
  async function publish(withdraw=false) {
    if(lock.current)return;
    lock.current=true;setBusy(true);setError('');
    try {
      await deviceNotes.saveDraft(last.current);
      const job=await getPublicService().publish(last.current,withdraw);
      if(mounted.current)delivered(job);
    } catch {
      // A request may already be durable even if its local acknowledgement failed.
      if(mounted.current)setJobLoaded(false);
      try{await refreshJob();}catch{/* Retry explicitly from this screen. */}
      if(mounted.current)setError('공개에 필요한 세션이나 저장소를 확인하지 못했어요. 초안은 유지돼요.');
    }
    finally{lock.current=false;if(mounted.current)setBusy(false);}
  }
  function confirmPublish() {
    if(action.operation==='reconcile'){void publish(job!.payload.p_withdraw);return;}
    Alert.alert('이 글을 공개할까요?','로그인한 사용자가 읽을 수 있고, 홈에는 일부 내용이 공개돼요.',[
      {text:'취소',style:'cancel'},{text:'공개하기',onPress:()=>{void publish();}},
    ]);
  }
  async function saveAsPrivate(){
    if(lock.current)return;
    lock.current=true;setBusy(true);setError('');
    try{
      const result=await getPublicService().savePrivate(last.current);
      if(mounted.current){if(result)delivered(result);else onClose();}
    }catch{
      if(mounted.current)setError('나만 보기로 저장하지 못했어요. 기존 공개 상태는 확인이 필요해요. 수정 내용은 보관돼요.');
      try{await refreshJob();}catch{/* Keep the draft and require explicit retry. */}
    }finally{lock.current=false;if(mounted.current)setBusy(false);}
  }
  function confirmPrivate(){
    Alert.alert('나만 보기로 저장할까요?','기존 공개 글을 내린 뒤 이 기기에 저장해요.',[
      {text:'취소',style:'cancel'},{text:'저장',onPress:()=>{void saveAsPrivate();}},
    ]);
  }
  const form=<>
      <View style={s.row}><Text style={s.title} accessibilityRole="header">{editingSaved?'쪽지 편집':'쪽지 쓰기'}</Text><Action label={editingSaved?'수정 취소':'닫기'} disabled={busy||!originalLoaded} onPress={() => { void finish(editingSaved?'cancel':'leave'); }} /></View>
      <View style={s.form}>
        <TextInput ref={inputRef} showSoftInputOnFocus multiline accessibilityLabel="쪽지 내용" placeholder="무엇을 발견했나요?" placeholderTextColor="#353535" value={value.body}
          underlineColorAndroid="transparent" selectionColor={color.accent} cursorColor={color.ink} submitBehavior="newline"
          editable={!busy} onChangeText={body => change({body:limitBodyInput(body,last.current.body)})} textAlignVertical="top" style={s.input} />
        <View style={s.row}><Text style={s.meta}>최대 {MAX_BODY_CHARACTERS}자</Text><Text accessibilityLabel={`${bodyLength(value.body)}자 입력, 최대 ${MAX_BODY_CHARACTERS}자`} style={s.meta}>{bodyLength(value.body)}/{MAX_BODY_CHARACTERS}</Text></View>
        {onMove && <Action label="위치 변경" containerStyle={s.alignStart} disabled={busy} onPress={() => { void finish('move'); }} />}
        <View accessibilityRole="radiogroup" style={s.visibility}><Action label="공개" selected={value.visibility==='public'} disabled={busy} onPress={() => change({visibility:'public'})} />
          <Action label="나만 보기" selected={value.visibility==='private'} disabled={busy} onPress={() => change({visibility:'private'})} /></View>
        {value.visibility === 'public' && !publicServiceConfigured && <Text style={s.meta}>공개 공유는 아직 연결되지 않았어요. 초안은 이 기기에 보관돼요.</Text>}
        {publication && ['pending','uncertain'].includes(publication) && <Text style={s.meta}>앞서 공개한 내용의 결과를 확인해야 해요. 지금 수정한 초안은 전송되지 않아요.</Text>}
        {publication==='published' && <Text style={s.meta}>앞서 공개한 글이 있어요. 수정한 내용은 다시 공개하기 전까지 초안으로 남아요.</Text>}
        {inspection && <View style={s.server}>
          <Text style={s.title} accessibilityRole="header">서버 글</Text>
          <Text style={s.meta}>{inspection.state.kind==='missing'?'본인 공개 사본 없음':inspection.state.hidden?'관리자에 의해 숨겨진 글':inspection.state.visible?'공개 중':'철회됨'}</Text>
          {inspection.state.kind==='found'&&inspection.state.body!==''&&<Text style={textStyles.body}>{inspection.state.body}</Text>}
          <View style={s.row}>
            {recoveryOptions(inspection.state,value).publish&&<Action label="이 초안으로 반영" disabled={busy} onPress={()=>confirmRecovery('publish')}/>}
            {value.visibility==='private'&&!invalid&&(recoveryOptions(inspection.state,value).withdraw||recoveryOptions(inspection.state,value).private)&&<Action label="나만 보기로 저장" disabled={busy} onPress={()=>confirmRecovery(recoveryOptions(inspection.state,value).withdraw?'withdraw':'private')}/>}
          </View>
        </View>}
        {error !== '' && <Text accessibilityRole="alert" style={s.meta}>{error}</Text>}
        {!jobLoaded && <Action label="공개 상태 다시 확인" disabled={busy} onPress={()=>{void refreshJob().catch(()=>setError('공개 상태를 확인하지 못했어요.'));}} />}
      </View>
      <View style={s.row}>{!editingSaved&&<Action label="초안 버리기" disabled={busy||!action.canDiscard||!originalLoaded} onPress={() => Alert.alert('작성 중인 초안을 버릴까요?',undefined,[
        {text:'취소',style:'cancel'},{text:'버리기',style:'destructive',onPress:()=>{ void finish('discard'); }},
      ])} />}<Action label={action.label} variant="primary" busy={busy}
        disabled={busy || action.disabled}
        onPress={()=>{if(action.operation==='inspect')void recover('inspect');else if(action.operation==='make-private'||(action.operation==='reconcile'&&job?.payload.p_withdraw&&value.visibility==='private'&&!invalid))confirmPrivate();else if(action.operation!=='private')confirmPublish();else void finish('save');}} /></View>
  </>;
  return <KeyboardAvoidingView pointerEvents="box-none" style={[s.overlay,{justifyContent:side==='top'?'flex-start':'flex-end'},viewport&&{top:viewport.y,left:viewport.x,width:viewport.width,height:viewport.height,bottom:undefined,right:undefined}]} behavior={Platform.OS==='ios'?'padding':undefined}>
    <View ref={panelRef} collapsable={false} style={[s.page,compact&&s.compactPage]} accessibilityViewIsModal onAccessibilityEscape={()=>{if(originalLoaded)void finish(editingSaved?'cancel':'leave');}}
      onLayout={({nativeEvent:{layout}})=>{setPanel(layout);if(!focused.current){focused.current=true;requestAnimationFrame(()=>{if(mounted.current)inputRef.current?.focus();});}}}>
      {photo&&<PhotoGlass source={photo.source} image={photo.rect} frame={{...panel,x:panel.x+(viewport?.x??0),y:panel.y+(viewport?.y??0)}} stageClip={stage} tint={.12}/>}
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="none" style={s.scroll} contentContainerStyle={s.content}>{form}</ScrollView>
    </View></KeyboardAvoidingView>;
}
export const s = StyleSheet.create({
  overlay:{...StyleSheet.absoluteFill,paddingHorizontal:12,paddingVertical:8},
  compactPage:{maxHeight:'100%'},unboundedScroll:{flexShrink:0},
  page:{width:'100%',maxHeight:'78%',maxWidth:layout.readingWidth,alignSelf:'center',backgroundColor:color.page,padding:10,borderRadius:24,overflow:'hidden',borderWidth:1,borderColor:'#FFFFFF',boxShadow:'0px 6px 24px rgba(0,0,0,.16)'},scroll:{flexGrow:0,flexShrink:1,backgroundColor:photoReadingSurface,borderRadius:14},content:{padding:8},form:{gap:12,paddingVertical:8},row:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8},
  visibility:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'flex-start',gap:8},alignStart:{alignSelf:'flex-start'},
  label:textStyles.action,title:textStyles.heading,
  server:{gap:16,borderTopWidth:1,borderTopColor:color.secondary,paddingTop:16},
  input:{...textStyles.body,minHeight:120,maxHeight:220,fontFamily:'SpoqaHanSans',backgroundColor:'transparent',borderWidth:1,borderColor:color.line,borderRadius:layout.radius,padding:12},meta:{...textStyles.source,color:'#353535'},
});
