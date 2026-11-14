import {useCallback,useEffect,useState,useSyncExternalStore,type ReactNode} from 'react';
import {BackHandler,ScrollView,StyleSheet,View} from 'react-native';
import {router,useFocusEffect,useNavigation} from 'expo-router';
import {Action} from '../../ui/Action';
import {Text} from '../../ui/Text';
import {layout,textStyles} from '../../ui/theme';
import {authRuntime,memoConfig} from './nativeAuth';
import type {AuthState,SocialProvider} from './socialAuth';

const guest:AuthState={kind:'guest',epoch:0};
const noSubscribe=()=>()=>{};
const guestSnapshot=()=>guest;
export function useMemoAuth(){
  const social=memoConfig?authRuntime().social:null;
  return useSyncExternalStore(social?.subscribe??noSubscribe,social?.snapshot??guestSnapshot);
}
let restored=false;
export function AuthBootstrap(){useEffect(()=>{if(!restored&&memoConfig){restored=true;void authRuntime().social.restore();}},[]);return null;}

export function MemoGate({children,cancelToHome=false}:{children:ReactNode;cancelToHome?:boolean}){
  const state=useMemoAuth(),navigation=useNavigation();
  const cancel=useCallback(()=>{if(memoConfig)authRuntime().social.cancelSignIn();if(cancelToHome||!router.canGoBack())router.replace('/');else router.back();},[cancelToHome]);
  const blocked=state.kind!=='authenticated';
  // A login screen owns no memo child, SQLite read, reader controller or draft.
  useFocusEffect(useCallback(()=>{
    if(!blocked)return;
    const back=BackHandler.addEventListener('hardwareBackPress',()=>{cancel();return true;});return()=>back.remove();
  },[blocked,cancel]));
  // Header back is permitted: unlike a draft there is no data to flush here.
  useEffect(()=>{if(!blocked)return;return navigation.addListener('beforeRemove',()=>{if(memoConfig)authRuntime().social.cancelSignIn();});},[blocked,navigation]);
  if(!blocked)return <View key={state.epoch} style={s.fill}>{children}</View>;
  const busy=state.kind==='restoring'||state.kind==='signing-in'||state.kind==='signing-out';
  const login=(provider:SocialProvider)=>{if(memoConfig)void authRuntime().social.signIn(provider);};
  return <ScrollView style={s.fill} contentContainerStyle={s.page}>
    <Text accessibilityRole="header" style={textStyles.story}>메모를 보려면 로그인해 주세요</Text>
    {memoConfig?<><Action label="Google로 로그인" disabled={busy} onPress={()=>login('google')}/><Action label="네이버로 로그인" disabled={busy} onPress={()=>login('custom:naver')}/></>:<Text style={textStyles.source}>로그인 연결을 준비 중이에요.</Text>}
    {state.kind==='error'&&<Text accessibilityRole="alert" style={textStyles.source}>{state.message}</Text>}
    {state.kind==='error'&&state.logoutPending&&<Action label="로그아웃 다시 시도" onPress={()=>{void authRuntime().social.signOut();}}/>}
    {state.kind==='error'&&state.restorePending&&<Action label="로그인 상태 다시 확인" onPress={()=>{void authRuntime().social.restore();}}/>}
    <Action label="가이드로 돌아가기" onPress={cancel}/>
  </ScrollView>;
}
export function AccountActions(){
  const state=useMemoAuth(),[error,setError]=useState('');
  if(!memoConfig||state.kind!=='authenticated')return null;
  const leave=()=>{setError('');void authRuntime().social.signOut().catch(()=>setError('로그아웃하지 못했어요.'));};
  return <View><Action label="로그아웃" onPress={leave}/>{!!error&&<Text accessibilityRole="alert">{error}</Text>}</View>;
}
const s=StyleSheet.create({fill:{flex:1},page:{flexGrow:1,padding:layout.gutter,gap:12,justifyContent:'center'}});
