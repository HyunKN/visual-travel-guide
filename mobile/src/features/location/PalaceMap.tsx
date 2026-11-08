import {useEffect,useMemo,useRef,useState} from 'react';
import {StyleSheet,View} from 'react-native';
import {Camera,GeoJSONSource,Layer,Map,type CameraRef} from '@maplibre/maplibre-react-native';
import {Action} from '../../ui/Action';
import {Text} from '../../ui/Text';
import {color,textStyles} from '../../ui/theme';
import {content} from '../place-content/content';
import type {Fix} from './location';
import {fixFeatures,initialMapView,mapStyleUrl,nearbyMapBounds,palaceBounds,placeFeatures,pressedPlace} from './mapContract';

export default function PalaceMap({fix,checkedAt,open,onReady,onFailure}:{fix:Fix|null;checkedAt:number;open:(id:string)=>void;onReady:()=>void;onFailure:()=>void}) {
  const camera=useRef<CameraRef>(null),[ready,setReady]=useState(false),[selected,setSelected]=useState<string|null>(null);
  const [width,setWidth]=useState(0),initialFit=useRef(false),lastFix=useRef<Fix|null>(null);
  const geo=useMemo(()=>fixFeatures(fix,checkedAt),[fix,checkedAt]);
  useEffect(()=>{
    if(!ready||!width)return;
    const bounds=nearbyMapBounds(fix,checkedAt);
    if((bounds&&fix!==lastFix.current)||!initialFit.current){camera.current?.fitBounds(bounds??palaceBounds,{padding:{top:36,right:36,bottom:36,left:36},pitch:45,duration:0});initialFit.current=true;}
    lastFix.current=fix;
  },[fix,checkedAt,ready,width]);
  const selectedPlace=selected?content.getBuilding(selected):null;
  return <View style={s.section}>
    <Map style={s.map} onLayout={e=>setWidth(e.nativeEvent.layout.width)} mapStyle={mapStyleUrl} androidView="texture" tintColor={color.ink} touchRotate touchPitch attribution compass scaleBar
      onDidFailLoadingMap={onFailure}
      onDidFinishRenderingMapFully={()=>{setReady(true);onReady();}}>
      <Camera ref={camera} initialViewState={initialMapView} minZoom={14} maxZoom={19}/>
      <GeoJSONSource id="accuracy" data={geo.accuracy}>
        <Layer id="accuracy-fill" type="fill" paint={{'fill-color':'#626262','fill-opacity':.14}}/>
        <Layer id="accuracy-edge" type="line" paint={{'line-color':'#626262','line-opacity':.6,'line-width':1}}/>
      </GeoJSONSource>
      <GeoJSONSource id="supported-places" data={placeFeatures} hitbox={{top:17,right:17,bottom:17,left:17}}
        onPress={event=>{event.stopPropagation();setSelected(pressedPlace(event.nativeEvent.features,event.nativeEvent.lngLat));}}>
        <Layer id="place-points" type="circle" paint={{'circle-radius':7,'circle-color':color.ink,'circle-stroke-color':'#FFFFFF','circle-stroke-width':2}}/>
      </GeoJSONSource>
      <GeoJSONSource id="measured-location" data={geo.point}>
        <Layer id="location-point" type="circle" paint={{'circle-radius':6,'circle-color':color.accent,'circle-stroke-color':'#FFFFFF','circle-stroke-width':2}}/>
      </GeoJSONSource>
    </Map>
    {!ready&&<Text accessibilityLiveRegion="polite" style={textStyles.source}>지도를 불러오는 중이에요.</Text>}
    {selectedPlace?.status==='ok'&&<Action label={`${selectedPlace.data.name} 둘러보기`} variant="soft" onPress={()=>open(selectedPlace.data.id)}/>}
    <Action label="경복궁 보기" onPress={()=>camera.current?.fitBounds(palaceBounds,{padding:{top:36,right:36,bottom:36,left:36},pitch:45,bearing:0,duration:0})}/>
  </View>;
}
const s=StyleSheet.create({section:{gap:8},map:{height:280,width:'100%'}});
