import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { Text } from '../../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Editor, { Action, s } from '../../features/local-notes/Editor';
import { deviceNotes } from '../../features/local-notes/device';
import type { Draft, LocalItem } from '../../features/local-notes/store';
import { getScene } from '../../features/place-messages/scenes';

export default function MyNotes() {
  const insets=useSafeAreaInsets(), [rows,setRows]=useState<LocalItem[]|null>(null), [error,setError]=useState('');
  const [editor,setEditor]=useState<Draft|null>(null), gen=useRef(0);
  const load=useCallback(async()=>{
    const id=++gen.current; setError(''); setRows(null);
    try { const list=await deviceNotes.list(); if(id===gen.current)setRows(list); }
    catch { if(id===gen.current)setError('기기의 글을 불러오지 못했어요.'); }
  },[]);
  useFocusEffect(useCallback(()=>{void load();return ()=>{gen.current++;};},[load]));
  async function edit(id:string) {
    try {const d=await deviceNotes.edit(id); if(!d)throw new Error();setEditor(d);}
    catch {setError('글을 열지 못했어요.');}
  }
  return <View style={[s.page,{paddingTop:insets.top+16}]}><Text style={s.title} accessibilityRole="header">내 글</Text>
    {!!error && <><Text accessibilityRole="alert" style={s.meta}>{error}</Text><Action label="다시 시도" onPress={()=>{void load();}} /></>}
    {!rows && !error && <Text style={s.meta}>불러오는 중이에요.</Text>}
    {rows?.length===0 && <><Text style={s.meta}>아직 남긴 글이 없어요.</Text><Action label="장소 둘러보기" onPress={()=>router.navigate('/')} /></>}
    <FlatList data={rows} keyExtractor={item=>item.id} renderItem={({item})=><View style={s.form}>
      <Text style={s.label}>{getScene(item.sceneId)?.name} · {item.kind==='draft'?'초안':'나만 보기'}</Text>
      <Text numberOfLines={3} style={s.meta}>{item.body || '빈 초안'}</Text>
      <View style={s.row}><Action label={item.kind==='draft'?'이어 쓰기':'편집'} onPress={()=>{void edit(item.id);}} />
        {item.kind==='note' && <Action label="사진에서 보기" onPress={()=>router.push({pathname:'/scenes/[sceneId]',params:{sceneId:item.sceneId,messageId:item.id}})} />}
        <Action label={item.kind==='draft'?'초안 버리기':'삭제'} onPress={()=>Alert.alert(item.kind==='draft'?'작성 중인 초안을 버릴까요?':'이 기기에서 글을 삭제할까요?',undefined,[{text:'취소',style:'cancel'},
          {text:'삭제',style:'destructive',onPress:()=>{void (item.kind==='draft'?deviceNotes.discardDraft(item.id):deviceNotes.deleteNote(item.id)).then(load,()=>setError('삭제하지 못했어요.'));}}])} /></View>
    </View>} />
    {editor && <Editor initial={editor} onClose={()=>{setEditor(null);void load();}}
      onMove={d=>{setEditor(null);router.push({pathname:'/scenes/[sceneId]',params:{sceneId:d.sceneId,draftId:d.id}});}} />}
  </View>;
}
