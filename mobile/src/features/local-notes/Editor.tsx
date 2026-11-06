import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { validateBody } from '../place-messages/contract';
import { deviceNotes } from './device';
import type { Draft } from './store';
import {getPublicService,publicServiceConfigured} from '../public-messages/nativeService';
import type {PublicationJob} from '../public-messages/publication';
import {editorAction} from '../public-messages/editorAction';
import { Action } from '../../ui/Action';
export { Action } from '../../ui/Action';

export default function Editor({initial,onClose,onMove}: {initial:Draft;onClose:()=>void;onMove?: (draft:Draft)=>void}) {
  const insets = useSafeAreaInsets();
  const [value,setValue] = useState(initial), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const last = useRef(initial), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lock = useRef(false), mounted = useRef(true);
  const [job,setJob]=useState<PublicationJob|null>(null),[jobLoaded,setJobLoaded]=useState(false);
  const publication=job?.state??null;
  async function refreshJob(){
    const next=await deviceNotes.getPublication(initial.id);
    if(mounted.current){setJob(next);setJobLoaded(true);}
  }
  useEffect(()=>{let active=true;void deviceNotes.getPublication(initial.id).then(next=>{if(active){setJob(next);setJobLoaded(true);}},()=>{if(active)setError('공개 상태를 확인하지 못했어요.');});return ()=>{active=false;};},[initial.id]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearTimeout(timer.current); }; },[]);
  function change(patch: Partial<Pick<Draft,'body'|'visibility'>>) {
    if (lock.current) return;
    const next = {...last.current,...patch,revision:last.current.revision+1};
    last.current = next; setValue(next); setError(''); clearTimeout(timer.current);
    timer.current = setTimeout(() => { void deviceNotes.saveDraft(next).catch(() => {
      if (mounted.current && last.current === next && !lock.current) setError('초안을 저장하지 못했어요.');
    }); },500);
  }
  async function finish(mode:'leave'|'save'|'discard'|'move') {
    if (lock.current) return;
    lock.current = true; setBusy(true); clearTimeout(timer.current);
    try {
      const d = last.current;
      if (mode === 'save') await deviceNotes.savePrivate(d);
      else if (mode === 'discard') await deviceNotes.discardDraft(d.id);
      else await deviceNotes.saveDraft(d);
      if (mode === 'move' && onMove) onMove(d); else onClose();
    } catch { setError('저장소에 변경을 반영하지 못했어요. 입력은 그대로 있어요.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  const invalid = validateBody(value.body);
  const action=editorAction(value,job,publicServiceConfigured,jobLoaded);
  async function publish(withdraw=false) {
    if(lock.current)return;
    lock.current=true;setBusy(true);clearTimeout(timer.current);setError('');
    try {
      await deviceNotes.saveDraft(last.current);
      const job=await getPublicService().publish(last.current,withdraw);
      if(mounted.current){
        setJob(job);setJobLoaded(true);
        if(job.state==='published')onClose();
        else if(job.state==='withdrawn')setError('공개를 철회했어요. 초안은 이 기기에 남아 있어요.');
        else setError(job.state==='uncertain'?'공개 결과를 확인하지 못했어요. 다시 확인해 주세요.':
          job.state==='conflict'?'기존 공개 글과 상태가 달라요. 초안은 보관돼요.':'공개하지 못했어요. 초안은 보관돼요.');
      }
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
    Alert.alert('이 글을 공개할까요?','누구나 읽을 수 있어요. 앱을 삭제하거나 세션을 잃으면 공개 글을 수정·철회할 수 없어요.',[
      {text:'취소',style:'cancel'},{text:'공개하기',onPress:()=>{void publish();}},
    ]);
  }
  return <Modal visible onRequestClose={() => { void finish('leave'); }} animationType="none">
    <KeyboardAvoidingView style={[s.page,{paddingTop:insets.top+8,paddingBottom:insets.bottom+8}]} behavior="height">
      <View style={s.row}><Text style={s.title} accessibilityRole="header">쪽지 쓰기</Text><Action label="닫기" disabled={busy} onPress={() => { void finish('leave'); }} /></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.form}>
        <TextInput multiline accessibilityLabel="쪽지 내용" placeholder="무엇을 발견했나요?" placeholderTextColor="#596776" value={value.body}
          editable={!busy} onChangeText={body => change({body})} textAlignVertical="top" style={s.input} />
        {onMove && <Action label="위치 변경" disabled={busy} onPress={() => { void finish('move'); }} />}
        <View accessibilityRole="radiogroup" style={s.row}><Action label="공개" selected={value.visibility==='public'} disabled={busy} onPress={() => change({visibility:'public'})} />
          <Action label="나만 보기" selected={value.visibility==='private'} disabled={busy} onPress={() => change({visibility:'private'})} /></View>
        {value.visibility === 'public' && !publicServiceConfigured && <Text style={s.meta}>공개 공유는 아직 연결되지 않았어요. 초안은 이 기기에 보관돼요.</Text>}
        {publication && ['pending','uncertain'].includes(publication) && <Text style={s.meta}>앞서 공개한 내용의 결과를 확인해야 해요. 지금 수정한 초안은 전송되지 않아요.</Text>}
        {publication==='published' && <Text style={s.meta}>앞서 공개한 글이 있어요. 수정한 내용은 다시 공개하기 전까지 초안으로 남아요.</Text>}
        {value.visibility==='private' && action.canWithdraw && <Text style={s.meta}>공개 철회를 확인한 뒤 나만 보기로 저장할 수 있어요.</Text>}
        {action.canWithdraw && <Action label="공개 철회" disabled={busy} onPress={()=>Alert.alert('공개 글을 철회할까요?','서버에서 철회가 확인되면 다른 사람이 읽을 수 없어요.',[
          {text:'취소',style:'cancel'},{text:'철회',style:'destructive',onPress:()=>{void publish(true);}},
        ])}/>}
        {invalid === 'too-large' && <Text accessibilityRole="alert" style={s.meta}>글이 너무 길어요. 내용을 줄여 주세요.</Text>}
        {error !== '' && <Text accessibilityRole="alert" style={s.meta}>{error}</Text>}
        {!jobLoaded && <Action label="공개 상태 다시 확인" disabled={busy} onPress={()=>{void refreshJob().catch(()=>setError('공개 상태를 확인하지 못했어요.'));}} />}
      </ScrollView>
      <View style={s.row}><Action label="초안 버리기" variant="danger" disabled={busy||!action.canDiscard} onPress={() => Alert.alert('작성 중인 초안을 버릴까요?',undefined,[
        {text:'취소',style:'cancel'},{text:'버리기',style:'destructive',onPress:()=>{ void finish('discard'); }},
      ])} /><Action label={action.label} variant="primary" busy={busy}
        disabled={busy || action.disabled}
        onPress={()=>{if(action.operation!=='private')confirmPublish();else void finish('save');}} /></View>
    </KeyboardAvoidingView>
  </Modal>;
}
export const s = StyleSheet.create({
  page:{flex:1,backgroundColor:'#FFFFFF',paddingHorizontal:20},form:{gap:16,paddingVertical:16},row:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8},
  label:{color:'#243247',fontSize:16,fontWeight:'700'},title:{fontSize:22,lineHeight:32,color:'#243247',fontWeight:'700'},
  input:{minHeight:140,fontFamily:'SpoqaHanSans',fontSize:17,lineHeight:29,color:'#243247',backgroundColor:'#F3F5F7',borderRadius:12,padding:16},meta:{fontSize:15,lineHeight:23,color:'#526071'},
});
