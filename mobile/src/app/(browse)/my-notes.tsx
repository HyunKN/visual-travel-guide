import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { Text } from '../../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Action } from '../../ui/Action';
import { Skeleton } from '../../ui/Skeleton';
import { color, layout, textStyles } from '../../ui/theme';
import { accountNotes } from '../../features/local-notes/device';
import type { LocalItem } from '../../features/local-notes/store';
import { getScene } from '../../features/place-messages/scenes';
import {MemoGate,AccountActions} from '../../features/auth/MemoGate';
import {OwnPublicationStatus} from '../../features/public-messages/OwnPublicationStatus';

export default function MyNotes() {
  return <MemoGate cancelToHome><MyNotesContent/></MemoGate>;
}
function MyNotesContent() {
  const [deviceNotes]=useState(()=>accountNotes());
  const insets=useSafeAreaInsets(), [rows,setRows]=useState<LocalItem[]|null>(null), [error,setError]=useState('');
  const gen=useRef(0),editRequest=useRef(0);
  const [opening,setOpening]=useState<string|null>(null);
  const load=useCallback(async()=>{
    const id=++gen.current; setError(''); setRows(null);
    try { const list=await deviceNotes.list(); if(id===gen.current)setRows(list); }
    catch { if(id===gen.current)setError('기기의 글을 불러오지 못했어요.'); }
  },[deviceNotes]);
  useFocusEffect(useCallback(()=>{setOpening(null);void load();return ()=>{gen.current++;editRequest.current++;};},[load]));
  async function edit(id:string) {
    const request=++editRequest.current;setOpening(id);setError('');
    try {const d=await deviceNotes.edit(id); if(!d)throw new Error();if(request===editRequest.current)router.push({pathname:'/scenes/[sceneId]',params:{sceneId:d.sceneId,draftId:d.id}});}
    catch {if(request===editRequest.current)setError('글을 열지 못했어요.');}
    finally {if(request===editRequest.current)setOpening(null);}
  }
  return <View style={[styles.page,{paddingTop:insets.top}]}>
    <FlatList style={styles.reading} contentContainerStyle={styles.list} data={rows??[]} keyExtractor={item=>item.id}
      ListHeaderComponent={<View style={styles.header}><Text style={textStyles.story} accessibilityRole="header">내 글</Text>
        <AccountActions/>
        {!!error&&<><Text accessibilityRole="alert" style={textStyles.source}>{error}</Text><Action label="다시 시도" style={styles.alignStart} onPress={()=>{void load();}}/></>}
      </View>}
      ListEmptyComponent={!rows&&!error?<View style={styles.empty}><Skeleton/><Skeleton/></View>:rows?.length===0?<View style={styles.empty}>
        <Text style={textStyles.heading}>아직 남긴 글이 없어요.</Text><Action label="장소 둘러보기" style={styles.alignStart} onPress={()=>router.navigate('/')}/>
      </View>:null}
      ItemSeparatorComponent={()=><View style={styles.separator}/>}
      renderItem={({item})=>{
        const pristine=item.kind==='draft'&&item.revision===0&&item.body===''&&item.visibility===null&&!item.publicationState;
        return <View style={[styles.note,pristine&&styles.pristine]}>
      {pristine?<Text style={styles.pristineTitle}>{getScene(item.sceneId)?.name??'장소를 찾을 수 없어요.'} · 작성 전 초안</Text>:<>
      <Text style={textStyles.heading}>{getScene(item.sceneId)?.name??'장소를 찾을 수 없어요.'}</Text>
      {item.publicationState==='published'?<OwnPublicationStatus item={item}/>:<Text style={textStyles.source}>{
        item.publicationState==='pending'||item.publicationState==='uncertain'?'공개 상태 확인 중':
        item.publicationState==='conflict'||item.publicationState==='rejected'?'공개 상태 확인 필요':item.kind==='draft'?'초안':'나만 보기'}</Text>}
      <Text numberOfLines={3} style={textStyles.body}>{item.body || '빈 초안'}</Text>
      </>}
      <View style={styles.actions}><Action label={opening===item.id?'여는 중':item.kind==='draft'?'이어 쓰기':'편집'} disabled={opening!==null} onPress={()=>{void edit(item.id);}} />
        {item.kind!=='draft' && <Action label="사진에서 보기" onPress={()=>router.push({pathname:'/scenes/[sceneId]',params:{sceneId:item.sceneId,messageId:item.id}})} />}
        {item.kind!=='published'&&<Action label={pristine?'버리기':item.kind==='draft'?'초안 버리기':'삭제'} variant={pristine?'quiet':'danger'} disabled={opening!==null} onPress={()=>Alert.alert(item.kind==='draft'?'작성 중인 초안을 버릴까요?':'이 기기에서 글을 삭제할까요?',undefined,[{text:'취소',style:'cancel'},
          {text:'삭제',style:'destructive',onPress:()=>{void (item.kind==='draft'?deviceNotes.discardDraft(item.id):deviceNotes.deleteNote(item.id)).then(load,()=>setError('삭제하지 못했어요.'));}}])} />}</View>
    </View>;}} />
  </View>;
}
const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:color.page},reading:{flex:1,width:'100%',maxWidth:layout.readingWidth,alignSelf:'center'},
  list:{paddingHorizontal:layout.gutter,paddingBottom:layout.large},header:{paddingTop:16,paddingBottom:layout.section,gap:12},
  empty:{paddingTop:layout.large,gap:12},note:{paddingVertical:layout.section,gap:8},
  pristine:{paddingVertical:12,gap:0},pristineTitle:{...textStyles.body,fontSize:17,lineHeight:26},
  actions:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:8,paddingTop:8},
  separator:{height:StyleSheet.hairlineWidth,backgroundColor:color.line},alignStart:{alignItems:'flex-start'},
});
