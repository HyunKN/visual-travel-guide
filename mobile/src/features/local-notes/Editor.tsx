import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { validateBody } from '../place-messages/contract';
import { deviceNotes } from './device';
import type { Draft } from './store';

export function Action({label,onPress,disabled=false,selected}: {label:string;onPress:()=>void;disabled?:boolean;selected?:boolean}) {
  return <Pressable accessibilityRole={selected === undefined ? 'button' : 'radio'} accessibilityState={{disabled,checked:selected}} disabled={disabled}
    onPress={onPress} style={[s.action,selected && s.chosen,disabled && s.disabled]}><Text style={s.label}>{label}</Text></Pressable>;
}
export default function Editor({initial,onClose,onMove}: {initial:Draft;onClose:()=>void;onMove?: (draft:Draft)=>void}) {
  const insets = useSafeAreaInsets();
  const [value,setValue] = useState(initial), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const last = useRef(initial), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lock = useRef(false), mounted = useRef(true);
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
  return <Modal visible onRequestClose={() => { void finish('leave'); }} animationType="none">
    <KeyboardAvoidingView style={[s.page,{paddingTop:insets.top+8,paddingBottom:insets.bottom+8}]} behavior="height">
      <View style={s.row}><Text style={s.title} accessibilityRole="header">쪽지 쓰기</Text><Action label="닫기" disabled={busy} onPress={() => { void finish('leave'); }} /></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.form}>
        <TextInput multiline accessibilityLabel="쪽지 내용" placeholder="무엇을 발견했나요?" placeholderTextColor="#596776" value={value.body}
          editable={!busy} onChangeText={body => change({body})} textAlignVertical="top" style={s.input} />
        {onMove && <Action label="위치 변경" disabled={busy} onPress={() => { void finish('move'); }} />}
        <View accessibilityRole="radiogroup" style={s.row}><Action label="공개" selected={value.visibility==='public'} disabled={busy} onPress={() => change({visibility:'public'})} />
          <Action label="나만 보기" selected={value.visibility==='private'} disabled={busy} onPress={() => change({visibility:'private'})} /></View>
        {value.visibility === 'public' && <Text style={s.meta}>공개 공유는 아직 연결되지 않았어요. 초안은 이 기기에 보관돼요.</Text>}
        {invalid === 'too-large' && <Text accessibilityRole="alert" style={s.meta}>글이 너무 길어요. 내용을 줄여 주세요.</Text>}
        {error !== '' && <Text accessibilityRole="alert" style={s.meta}>{error}</Text>}
      </ScrollView>
      <View style={s.row}><Action label="초안 버리기" disabled={busy} onPress={() => Alert.alert('작성 중인 초안을 버릴까요?',undefined,[
        {text:'취소',style:'cancel'},{text:'버리기',style:'destructive',onPress:()=>{ void finish('discard'); }},
      ])} /><Action label={value.visibility==='public'?'공개하기':'저장'} disabled={busy || !!invalid || value.visibility!=='private'} onPress={()=>{ void finish('save'); }} /></View>
    </KeyboardAvoidingView>
  </Modal>;
}
export const s = StyleSheet.create({
  page:{flex:1,backgroundColor:'#FFFFFF',paddingHorizontal:20},form:{gap:16,paddingVertical:16},row:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8},
  action:{minWidth:48,minHeight:48,justifyContent:'center',alignItems:'center',paddingHorizontal:12,borderRadius:12},chosen:{backgroundColor:'#E4EBEF',borderWidth:1,borderColor:'#243247'},
  disabled:{opacity:.45},label:{color:'#243247',fontSize:16,fontWeight:'700'},title:{fontSize:22,lineHeight:32,color:'#243247',fontWeight:'700'},
  input:{minHeight:140,fontFamily:'SpoqaHanSans',fontSize:17,lineHeight:29,color:'#243247',backgroundColor:'#F3F5F7',borderRadius:12,padding:16},meta:{fontSize:15,lineHeight:23,color:'#526071'},
});
