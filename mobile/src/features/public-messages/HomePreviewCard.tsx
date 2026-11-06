import {useCallback,useMemo,useSyncExternalStore} from 'react';
import {AppState,Image,Pressable,StyleSheet,View} from 'react-native';
import {router,useFocusEffect} from 'expo-router';
import {Text} from '../../ui/Text';
import {Skeleton} from '../../ui/Skeleton';
import {content} from '../place-content/content';
import {photos} from '../place-content/photos';
import {createHomePreview} from './homePreview';
import {getPublicService,publicServiceConfigured} from './nativeService';
export default function HomePreview(){
  const controller=useMemo(()=>createHomePreview(content.listBuildings().map(p=>p.sceneId),
    publicServiceConfigured?(scenes,signal)=>getPublicService().homePreview(scenes,signal):null),[]);
  const state=useSyncExternalStore(controller.subscribe,controller.snapshot);
  useFocusEffect(useCallback(()=>{
    void controller.load();
    const listener=AppState.addEventListener('change',s=>{if(s==='active')void controller.load();else controller.clear();});
    return ()=>{listener.remove();controller.clear();};
  },[controller]));
  if(state.kind==='loading')return <View style={s.slot}><Skeleton variant="preview"/></View>;
  if(state.kind!=='ready')return null;
  const m=state.message,place=content.listBuildings().find(p=>p.sceneId===m.sceneId),photo=place&&content.getPhoto(place.id);
  if(!place||!photo)return null;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${place.name} 방문자 쪽지 읽기`} style={s.preview}
    onPress={()=>router.push({pathname:'/scenes/[sceneId]',params:{sceneId:m.sceneId,messageId:m.id}})}>
    <Image accessible={false} source={photos[photo.file]} style={s.photo}/>
    <View style={s.words}><Text style={s.place}>{place.name} · 방문자 쪽지</Text><Text numberOfLines={2} style={s.body}>{m.body}</Text></View>
  </Pressable>;
}
const s=StyleSheet.create({
  slot:{marginHorizontal:20,marginTop:24},
  preview:{marginHorizontal:20,marginTop:24,minHeight:88,paddingVertical:8,flexDirection:'row',alignItems:'center',gap:16},
  photo:{width:72,height:72,borderRadius:8},words:{flex:1,gap:6},
  place:{fontSize:14,lineHeight:21,color:'#526071'},body:{fontSize:17,lineHeight:26,color:'#243247'},
});
