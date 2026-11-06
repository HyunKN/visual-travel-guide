import {useCallback,useEffect,useRef,useState} from 'react';
import { Linking, ScrollView } from 'react-native';
import { Text } from '../ui/Text';
import {router,Stack} from 'expo-router';
import Constants from 'expo-constants';
import {Action,s} from '../features/local-notes/Editor';
import {locations,meters,classify,type Fix} from '../features/location/location';
import {content} from '../features/place-content/content';
import type PalaceMap from '../features/location/PalaceMap';
export default function Nearby(){
  const [map,setMap]=useState<typeof PalaceMap|null>(null),[attempt,setAttempt]=useState(0),[unavailable,setUnavailable]=useState(false);
  const [fix,setFix]=useState<Fix|null>(null),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
  const gen=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>()=>{gen.current++;clearTimeout(timer.current);},[]);
  useEffect(()=>{
    let alive=true;
    if(Constants.expoConfig?.extra?.androidMapsConfigured)void import('../features/location/PalaceMap').then(m=>{if(alive)setMap(()=>m.default);},()=>{if(alive)setUnavailable(true);});
    return ()=>{alive=false;};
  },[attempt]);
  const failure=useCallback(()=>setUnavailable(true),[]);
  const open=(placeId:string)=>router.push({pathname:'/places/[placeId]',params:{placeId}});
  async function locate(){
    const id=++gen.current;clearTimeout(timer.current);setFix(null);setBusy(true);setStatus('');
    timer.current=setTimeout(()=>{if(id===gen.current){gen.current++;setBusy(false);setStatus('위치 확인 시간이 지났어요.');}},15000);
    try{
      const api=await import('expo-location');if(id!==gen.current)return;
      const permission=await api.requestForegroundPermissionsAsync();if(id!==gen.current)return;
      if(!permission.granted){setStatus('위치 권한이 없어도 장소를 선택할 수 있어요.');return;}
      const sample=await api.getCurrentPositionAsync({accuracy:api.Accuracy.Balanced});if(id!==gen.current)return;
      const p={...sample.coords,timestamp:sample.timestamp},kind=classify(p,Date.now());
      if(kind==='good')setFix(p);else setStatus(kind==='stale'?'최근 위치를 확인하지 못했어요.':'위치가 정확하지 않아요.');
    }catch{if(id===gen.current)setStatus('현재 위치를 확인하지 못했어요.');}
    finally{if(id===gen.current){clearTimeout(timer.current);setBusy(false);}}
  }
  useEffect(()=>{if(!fix)return;const t=setTimeout(()=>{setFix(null);setStatus('최근 위치를 다시 확인해 주세요.');},Math.max(0,fix.timestamp+60001-Date.now()));return ()=>clearTimeout(t);},[fix]);
  const Map=map;
  return <ScrollView contentContainerStyle={{padding:20,gap:12}}><Stack.Screen options={{title:'주변 장소'}} />
    {Map && !unavailable ? <Map key={attempt} fix={fix} open={open} onTimeout={failure}/> : <Text style={s.meta}>{Constants.expoConfig?.extra?.androidMapsConfigured&&!unavailable?'지도를 불러오는 중이에요.':'지도를 사용할 수 없어요. 목록에서 장소를 선택해 주세요.'}</Text>}
    {unavailable&&<Action label="지도 다시 시도" onPress={()=>{setUnavailable(false);setAttempt(a=>a+1);}}/>}
    <Action label={busy?'위치 확인 중':'현재 위치 확인'} disabled={busy} onPress={()=>{void locate();}}/>
    {!!status&&<Text accessibilityLiveRegion="polite" style={s.meta}>{status}</Text>}
    {locations.map(p=>{const b=content.getBuilding(p.placeId);return b.status==='ok'&&<Action key={p.placeId} label={b.data.name+(fix?' · 직선 '+Math.round(meters(fix,p))+'m':'')} onPress={()=>open(p.placeId)}/>;})}
    <Action label="장소 좌표 © OpenStreetMap 기여자" onPress={()=>{void Linking.openURL('https://www.openstreetmap.org/copyright').catch(()=>setStatus('출처를 열지 못했어요.'));}}/>
  </ScrollView>;
}
