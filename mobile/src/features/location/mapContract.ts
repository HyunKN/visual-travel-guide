import { classify, locations, meters, type Fix, type Point } from './location';

export const mapStyleUrl='https://tiles.openfreemap.org/styles/liberty';
export const palaceCenter:[number,number]=[126.97699,37.5785];
export const initialMapView={center:palaceCenter,zoom:16.2,pitch:45,bearing:0};
export const palaceBounds:[number,number,number,number]=[
  Math.min(...locations.map(p=>p.longitude)),Math.min(...locations.map(p=>p.latitude)),
  Math.max(...locations.map(p=>p.longitude)),Math.max(...locations.map(p=>p.latitude)),
];
export const mapCredits=[
  {label:'OpenFreeMap',url:'https://openfreemap.org/'},
  {label:'© OpenMapTiles',url:'https://openmaptiles.org/'},
  {label:'© OpenStreetMap 기여자',url:'https://www.openstreetmap.org/copyright'},
];
export const lngLat=(point:Point):[number,number]=>[point.longitude,point.latitude];
export const supportedMapPlaces=locations.map(p=>({type:'Feature' as const,id:p.placeId,
  properties:{placeId:p.placeId},geometry:{type:'Point' as const,coordinates:lngLat(p)}}));
export const placeFeatures={type:'FeatureCollection' as const,features:supportedMapPlaces};

/** Native event properties are untrusted; only supported place IDs may navigate. */
export function pressedPlace(features:readonly {properties?:unknown}[],coordinate?:readonly number[]):string|null {
  const ids=new Set(features.flatMap(feature=>{
    const value=feature.properties;
    return value&&typeof value==='object'&&'placeId' in value&&typeof value.placeId==='string'?[value.placeId]:[];
  }));
  const candidates=locations.filter(p=>ids.has(p.placeId));
  if(coordinate?.length===2&&Number.isFinite(coordinate[0])&&Math.abs(coordinate[0])<=180&&Number.isFinite(coordinate[1])&&Math.abs(coordinate[1])<=90){
    const point={longitude:coordinate[0],latitude:coordinate[1]};
    candidates.sort((a,b)=>meters(a,point)-meters(b,point)||a.placeId.localeCompare(b.placeId));
  }
  return candidates[0]?.placeId??null;
}

function withinPalaceArea(fix:Fix){return meters(fix,{longitude:palaceCenter[0],latitude:palaceCenter[1]})<=2000;}

/** Geographic metres, not screen pixels: the polygon stays correct under zoom/pitch. */
export function fixFeatures(fix:Fix|null,now:number) {
  const empty={type:'FeatureCollection' as const,features:[]};
  if(!fix||classify(fix,now)!=='good'||!withinPalaceArea(fix))return {point:empty,accuracy:empty};
  const point={type:'FeatureCollection' as const,features:[{type:'Feature' as const,properties:{},geometry:{type:'Point' as const,coordinates:lngLat(fix)}}]};
  if(!fix.accuracy)return {point,accuracy:empty};
  const rad=Math.PI/180,latitude=fix.latitude*rad,longitude=fix.longitude*rad,angle=fix.accuracy/6371000;
  const coordinates=Array.from({length:65},(_,i)=>{
    const bearing=(i%64)*Math.PI/32;
    const lat=Math.asin(Math.sin(latitude)*Math.cos(angle)+Math.cos(latitude)*Math.sin(angle)*Math.cos(bearing));
    const lon=longitude+Math.atan2(Math.sin(bearing)*Math.sin(angle)*Math.cos(latitude),Math.cos(angle)-Math.sin(latitude)*Math.sin(lat));
    return [(lon/rad+540)%360-180,lat/rad];
  });
  return {point,accuracy:{type:'FeatureCollection' as const,features:[{type:'Feature' as const,properties:{},geometry:{type:'Polygon' as const,coordinates:[coordinates]}}]}};
}

/** A distant measurement updates distance text without zooming away from the palace. */
export function nearbyMapBounds(fix:Fix|null,now:number):[number,number,number,number]|null {
  if(!fix||classify(fix,now)!=='good'||!withinPalaceArea(fix))return null;
  // Only a local courtyard fix may reframe the small pitched viewport. A wider
  // 2km-area measurement can still appear on the map without moving palace pins.
  const latitudeMargin=100/111320,longitudeMargin=latitudeMargin/Math.cos(palaceCenter[1]*Math.PI/180);
  if(fix.longitude<palaceBounds[0]-longitudeMargin||fix.longitude>palaceBounds[2]+longitudeMargin
    ||fix.latitude<palaceBounds[1]-latitudeMargin||fix.latitude>palaceBounds[3]+latitudeMargin)return null;
  const points=[fix,...locations];
  return [Math.min(...points.map(p=>p.longitude)),Math.min(...points.map(p=>p.latitude)),Math.max(...points.map(p=>p.longitude)),Math.max(...points.map(p=>p.latitude))];
}

/** One attempt owns one timer. Failure is terminal until an explicit new attempt. */
export function createMapLoad(onFailure:()=>void,schedule=(fn:()=>void,ms:number)=>{const timer=setTimeout(fn,ms);return()=>clearTimeout(timer);}) {
  let state:'loading'|'ready'|'failed'|'cancelled'='loading';
  let stop=()=>{};
  const fail=()=>{if(state==='failed'||state==='cancelled')return;state='failed';stop();onFailure();};
  stop=schedule(()=>{if(state==='loading')fail();},15000);
  return {ready(){if(state!=='loading')return;state='ready';stop();},fail,cancel(){state='cancelled';stop();},snapshot:()=>state};
}
