import {useEffect,useMemo,useRef,useState} from 'react';
import {StyleSheet,View} from 'react-native';
import {Camera,GeoJSONSource,Layer,Map,type CameraRef} from '@maplibre/maplibre-react-native';
import {Action} from '../../ui/Action';
import {Text} from '../../ui/Text';
import {TapArea} from '../../ui/TapArea';
import {color,textStyles} from '../../ui/theme';
import {content} from '../place-content/content';
import type {Fix} from './location';
import {fixFeatures,initialMapView,mapStyleUrl,mapCameraTarget,mapZoomLimits,nextMapZoom,placeFeatures,pressedPlace,type MapFocus,type MapFocusRequest} from './mapContract';

export default function PalaceMap({fix,checkedAt,locating,onLocate,focusRequest,onFocus,open,onReady,onFailure}:{fix:Fix|null;checkedAt:number;locating:boolean;onLocate:()=>void;focusRequest:MapFocusRequest|null;onFocus:(target:MapFocus)=>void;open:(id:string)=>void;onReady:()=>void;onFailure:()=>void}) {
  const camera=useRef<CameraRef>(null),[ready,setReady]=useState(false);
  const selected=focusRequest?.target.kind==='place'?focusRequest.target.placeId:null;
  const [width,setWidth]=useState(0),lastFocus=useRef<number|null>(null);
  const zoomRef=useRef(initialMapView.zoom),[zoom,setZoom]=useState(initialMapView.zoom);
  const geo=useMemo(()=>fixFeatures(fix,checkedAt),[fix,checkedAt]);
  useEffect(()=>{
    if(!ready||!width||!focusRequest||lastFocus.current===focusRequest.serial)return;
    const target=mapCameraTarget(focusRequest.target,fix,checkedAt);
    if(!target)return;
    lastFocus.current=focusRequest.serial;
    if('bounds' in target&&target.bounds)camera.current?.fitBounds(target.bounds,{padding:{top:36,right:36,bottom:36,left:36},pitch:target.pitch,bearing:target.bearing,duration:0});
    else if(target.center){zoomRef.current=target.zoom;camera.current?.jumpTo(target);}
  },[focusRequest,fix,checkedAt,ready,width]);
  const changeZoom=(delta:1|-1)=>{
    const next=nextMapZoom(zoomRef.current,delta);
    zoomRef.current=next;setZoom(next);camera.current?.zoomTo(next,{duration:0});
  };
  const selectedPlace=selected?content.getBuilding(selected):null;
  return <View style={s.section}>
    <Map style={s.map} onLayout={e=>setWidth(e.nativeEvent.layout.width)} mapStyle={mapStyleUrl} androidView="texture" tintColor={color.ink} touchRotate touchPitch attribution compass scaleBar
      onRegionIsChanging={e=>{if(Number.isFinite(e.nativeEvent.zoom))zoomRef.current=e.nativeEvent.zoom;}}
      onRegionDidChange={e=>{if(Number.isFinite(e.nativeEvent.zoom)){zoomRef.current=e.nativeEvent.zoom;setZoom(e.nativeEvent.zoom);}}}
      onDidFailLoadingMap={onFailure}
      onDidFinishRenderingMapFully={()=>{setReady(true);onReady();}}>
      <Camera ref={camera} initialViewState={initialMapView} minZoom={mapZoomLimits.min} maxZoom={mapZoomLimits.max}/>
      <GeoJSONSource id="accuracy" data={geo.accuracy}>
        <Layer id="accuracy-fill" type="fill" paint={{'fill-color':'#626262','fill-opacity':.14}}/>
        <Layer id="accuracy-edge" type="line" paint={{'line-color':'#626262','line-opacity':.6,'line-width':1}}/>
      </GeoJSONSource>
      <GeoJSONSource id="supported-places" data={placeFeatures} hitbox={{top:17,right:17,bottom:17,left:17}}
        onPress={event=>{event.stopPropagation();const placeId=pressedPlace(event.nativeEvent.features,event.nativeEvent.lngLat);if(placeId)onFocus({kind:'place',placeId});}}>
        <Layer id="place-points" type="circle" paint={{'circle-radius':7,'circle-color':color.ink,'circle-stroke-color':'#FFFFFF','circle-stroke-width':2}}/>
      </GeoJSONSource>
      <GeoJSONSource id="measured-location" data={geo.point}>
        <Layer id="location-point" type="circle" paint={{'circle-radius':6,'circle-color':color.accent,'circle-stroke-color':'#FFFFFF','circle-stroke-width':2}}/>
      </GeoJSONSource>
    </Map>
    {!ready&&<Text accessibilityLiveRegion="polite" style={textStyles.source}>지도를 불러오는 중이에요.</Text>}
    {selectedPlace?.status==='ok'&&<Action label={`${selectedPlace.data.name} 둘러보기`} variant="soft" onPress={()=>open(selectedPlace.data.id)}/>}
    <View style={s.controls}>
      <Action label="경복궁 보기" disabled={!ready} onPress={()=>onFocus({kind:'palace'})}/>
      <Action label={locating?'위치 확인 중':'내 위치로'} disabled={!ready} busy={locating} onPress={()=>{if(geo.point.features.length)onFocus({kind:'location'});else onLocate();}}/>
      <View style={s.zoomControls}>
        <TapArea accessibilityRole="button" accessibilityLabel="지도 축소" accessibilityState={{disabled:!ready||zoom<=mapZoomLimits.min}} disabled={!ready||zoom<=mapZoomLimits.min} onPress={()=>changeZoom(-1)} style={[s.zoomButton,(!ready||zoom<=mapZoomLimits.min)&&s.disabled]}><Text accessible={false} style={s.zoomText}>−</Text></TapArea>
        <TapArea accessibilityRole="button" accessibilityLabel="지도 확대" accessibilityState={{disabled:!ready||zoom>=mapZoomLimits.max}} disabled={!ready||zoom>=mapZoomLimits.max} onPress={()=>changeZoom(1)} style={[s.zoomButton,(!ready||zoom>=mapZoomLimits.max)&&s.disabled]}><Text accessible={false} style={s.zoomText}>＋</Text></TapArea>
      </View>
    </View>
  </View>;
}
const s=StyleSheet.create({section:{gap:8},map:{height:280,width:'100%'},
  controls:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8},
  zoomControls:{flexDirection:'row',gap:8},zoomButton:{width:48,height:48,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:color.subtle},
  zoomText:{fontSize:24,lineHeight:30,color:color.ink},disabled:{opacity:.45},
});
