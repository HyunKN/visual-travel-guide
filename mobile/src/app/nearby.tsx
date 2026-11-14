import {useCallback,useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import { AppState, Linking, Platform, ScrollView, StyleSheet, TurboModuleRegistry, View } from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import { Text } from '../ui/Text';
import {router,Stack,useFocusEffect} from 'expo-router';
import {Action,s} from '../features/local-notes/Editor';
import {locationDetails,nearbyPlaces} from '../features/location/location';
import {createLocationController,type LocationState} from '../features/location/controller';
import {nativeLocation} from '../features/location/nativeLocation';
import {content} from '../features/place-content/content';
import type PalaceMap from '../features/location/PalaceMap';
import {createMapLoad,mapCredits,type MapFocus,type MapFocusRequest} from '../features/location/mapContract';
import {color} from '../ui/theme';
const locationText: Partial<Record<LocationState['kind'],string>> = {
  denied:'위치 권한이 꺼져 있어요.', disabled:'기기의 위치 서비스가 꺼져 있어요.',
  timeout:'위치 확인 시간이 지났어요.', stale:'최근 위치를 확인하지 못했어요.',
  imprecise:'위치가 정확하지 않아요.', invalid:'이 위치 정보는 사용할 수 없어요.',
  error:'현재 위치를 확인하지 못했어요.',
  interrupted:'위치 확인이 중단됐어요. 다시 시도해주세요.',
};
export default function Nearby(){
  const insets=useSafeAreaInsets();
  const scroll=useRef<ScrollView>(null),focusSerial=useRef(0);
  const [focusRequest,setFocusRequest]=useState<MapFocusRequest|null>(null);
  type LoadedMap={Component:typeof PalaceMap;load:ReturnType<typeof createMapLoad>;attempt:number;generation:number};
  const [map,setMap]=useState<LoadedMap|null>(null),[attempt,setAttempt]=useState(0),[unavailable,setUnavailable]=useState(false),[mapActive,setMapActive]=useState(false);
  const loadedMap=useRef<LoadedMap|null>(null),mapGeneration=useRef(0);
  // Refresh the controller implementation on Fast Refresh, not just the JSX.
  const controller=useMemo(()=>createLocationController(nativeLocation),[]);
  const state=useSyncExternalStore(controller.subscribe,controller.snapshot);
  const [error,setError]=useState('');
  const [devMenu,setDevMenu]=useState(false),[devFailure,setDevFailure]=useState(false);
  const active=useRef(false);
  const fix=state.kind==='ready'?state.fix:null,busy=state.kind==='locating';
  const details=locationDetails(fix,state.kind==='ready'?state.checkedAt:0);
  useFocusEffect(useCallback(()=>{
    active.current=true;setMapActive(AppState.currentState==='active'); controller.refreshAge();
    const subscription=AppState.addEventListener('change',value=>{
      setMapActive(value==='active');
      if(value==='active')controller.refreshAge();
      else if(typeof controller.suspend==='function')controller.suspend();
      else {
        // Fast Refresh can preserve a controller created before suspend existed.
        const interrupted=controller.snapshot().kind==='locating';
        controller.clear();
        if(interrupted)setError('위치 확인이 중단됐어요. 다시 시도해주세요.');
      }
    });
    return ()=>{active.current=false;focusSerial.current++;setMapActive(false);subscription.remove();controller.clear();};
  },[controller]));
  useEffect(()=>{
    if(!mapActive||unavailable)return;
    if(loadedMap.current?.attempt===attempt&&loadedMap.current.load.snapshot()==='ready')return;
    let alive=true;
    const generation=++mapGeneration.current;
    const load=createMapLoad(reason=>{
      if(mapGeneration.current===generation&&active.current&&AppState.currentState==='active'){
        if(__DEV__)console.warn('[NearbyMap] load failed:',reason);
        setUnavailable(true);
      }
    });
    // Do not evaluate MapLibre's getEnforcing imports on an older development APK.
    if(Platform.OS!=='android'||!TurboModuleRegistry.get('MLRNMapViewModule'))load.fail('native-module');
    else void import('../features/location/PalaceMap').then(m=>{if(alive&&load.snapshot()==='loading'){const next={Component:m.default,load,attempt,generation};loadedMap.current=next;setMap(next);}},cause=>{
      if(alive&&__DEV__&&cause instanceof Error)console.warn('[NearbyMap] import error:',cause.message.replace(/https?:\/\/\S+/g,'[URL]').slice(0,240));
      load.fail('import');
    });
    return ()=>{alive=false;if(load.snapshot()==='loading')load.cancel();};
  },[attempt,mapActive,unavailable]);
  const open=(placeId:string)=>router.push({pathname:'/places/[placeId]',params:{placeId}});
  const focusMap=(target:MapFocus)=>{
    setFocusRequest({serial:++focusSerial.current,target});
    scroll.current?.scrollTo({y:0,animated:false});
  };
  const locate=async()=>{
    if(!active.current||AppState.currentState!=='active')return;
    const intent=++focusSerial.current;
    setError('');await controller.locate();
    if(active.current&&AppState.currentState==='active'&&intent===focusSerial.current&&controller.snapshot().kind==='ready')focusMap({kind:'location'});
  };
  async function settings(locationServices=false){
    try {
      if(locationServices && Platform.OS==='android')await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
      else await Linking.openSettings();
    } catch {if(active.current)setError('설정을 열지 못했어요.');}
  }
  const mapPhase=map?.load.snapshot();
  const Map=map?.attempt===attempt&&(mapPhase==='ready'||(mapActive&&mapPhase==='loading'))?map.Component:null;
  return <ScrollView ref={scroll} style={styles.screen} contentContainerStyle={[styles.page,{paddingBottom:insets.bottom+12}]}><Stack.Screen options={{title:'주변 장소'}} />
    <View style={styles.content}>
    {Map && map && !unavailable ? <Map key={map.generation} fix={fix} checkedAt={state.kind==='ready'?state.checkedAt:0} locating={busy} onLocate={()=>{void locate();}} focusRequest={focusRequest} onFocus={focusMap} open={open} onReady={()=>{if(active.current&&AppState.currentState==='active')map.load.ready();}} onFailure={()=>{if(active.current&&AppState.currentState==='active')map.load.fail();}}/> : <Text style={s.meta}>{!unavailable?'지도를 불러오는 중이에요.':'지도를 불러오지 못했어요. 데이터 또는 Wi-Fi 연결을 확인해주세요. 아래 목록에서 장소를 선택할 수 있어요.'}</Text>}
    {unavailable&&<Action label="지도 다시 시도" onPress={()=>{setDevFailure(false);setUnavailable(false);setAttempt(a=>a+1);}}/>}
    <Action label={busy?'위치 확인 중':'현재 위치 확인'} disabled={busy} onPress={()=>{void locate();}}/>
    {busy&&<Action label="취소" onPress={()=>controller.clear()}/>}
    {details&&<Text accessibilityLiveRegion="polite" style={s.meta}>
      {new Date(details.timestamp).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})} 측정 · 위치 오차 {details.accuracyMeters<1?'1m 미만':`약 ${Math.ceil(details.accuracyMeters)}m`}
    </Text>}
    {!!locationText[state.kind]&&<Text accessibilityLiveRegion="polite" style={s.meta}>{locationText[state.kind]}</Text>}
    {state.kind==='denied'&&!state.canAskAgain&&<Action label="앱 권한 설정 열기" onPress={()=>{void settings();}}/>}
    {state.kind==='disabled'&&<Action label="위치 설정 열기" onPress={()=>{void settings(true);}}/>}
    {!!error&&<Text accessibilityRole="alert" style={s.meta}>{error}</Text>}
    {nearbyPlaces(fix,state.kind==='ready'?state.checkedAt:0).map(p=>{const b=content.getBuilding(p.placeId),d=p.distanceMeters;
      const distance=d===null?'':` · 직선 약 ${d<1000?Math.round(d)+'m':(d/1000).toFixed(1)+'km'}`;
      return b.status==='ok'&&<Action key={p.placeId} label={b.data.name+distance} onPress={()=>{if(unavailable)open(p.placeId);else focusMap({kind:'place',placeId:p.placeId});}}/>;})}
    </View>
    {__DEV__&&<View style={styles.content}>
      <Action label="개발 메뉴" onPress={()=>setDevMenu(value=>!value)}/>
      {devMenu&&<Action label="지도 로딩 실패 재현" disabled={!map||unavailable} onPress={()=>{
        if(!map||unavailable)return;
        setDevFailure(true);map.load.fail('render');scroll.current?.scrollTo({y:0,animated:false});
      }}/>}
      {devFailure&&<Text style={s.meta}>개발 테스트 · 지도 로딩 실패</Text>}
    </View>}
    <Text style={styles.credits}>{mapCredits.map(credit=>credit.label).join(' · ')}</Text>
  </ScrollView>;
}
const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:color.page},
  page:{flexGrow:1,padding:20,gap:24},
  content:{gap:12},
  credits:{marginTop:'auto',paddingTop:12,fontSize:12,lineHeight:18,color:color.secondary,textAlign:'center'},
});
