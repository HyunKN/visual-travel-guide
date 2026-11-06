import {useEffect,useRef} from 'react';
import MapView,{Circle,Marker} from 'react-native-maps';
import {content} from '../place-content/content';
import {locations,type Fix} from './location';
export default function PalaceMap({fix,open,onTimeout}:{fix:Fix|null;open:(id:string)=>void;onTimeout:()=>void}) {
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>{timer.current=setTimeout(onTimeout,15000);return ()=>clearTimeout(timer.current);},[onTimeout]);
  const map=useRef<MapView>(null);
  useEffect(()=>{if(fix)map.current?.fitToCoordinates([fix,...locations],{edgePadding:{top:36,bottom:36,left:36,right:36},animated:false});},[fix]);
  return <MapView ref={map} style={{height:280}} initialRegion={{...locations[0],latitudeDelta:.009,longitudeDelta:.009}} rotateEnabled={false} pitchEnabled={false} toolbarEnabled={false}
    onMapLoaded={()=>clearTimeout(timer.current)}>
    {locations.map(p=>{const b=content.getBuilding(p.placeId);return b.status==='ok' && <Marker key={p.placeId} coordinate={p} title={b.data.name} onCalloutPress={()=>open(p.placeId)} />;})}
    {fix && <><Marker coordinate={fix} title="현재 위치" pinColor="#243247" /><Circle center={fix} radius={fix.accuracy??0} fillColor="#24324722" strokeColor="#24324788" /></>}
  </MapView>;
}
