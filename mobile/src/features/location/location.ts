export type Point={latitude:number;longitude:number};
export type Fix=Point & {accuracy:number|null;timestamp:number};
export function classify(fix:Fix,now:number):'good'|'invalid'|'stale'|'imprecise' {
  if(!Number.isFinite(now)||now<0||!Number.isFinite(fix.latitude)||Math.abs(fix.latitude)>90||!Number.isFinite(fix.longitude)||Math.abs(fix.longitude)>180||!Number.isFinite(fix.timestamp)||fix.timestamp<0||fix.timestamp>now)return 'invalid';
  if(now-fix.timestamp>60_000)return 'stale';
  if(fix.accuracy===null||!Number.isFinite(fix.accuracy)||fix.accuracy<0||fix.accuracy>100)return 'imprecise';
  return 'good';
}
/** Display the measurement's own time/uncertainty, never a fresh UI check time. */
export function locationDetails(fix:Fix|null,now:number){
  if(!fix||classify(fix,now)!=='good'||!Number.isFinite(new Date(fix.timestamp).getTime()))return null;
  return {timestamp:fix.timestamp,accuracyMeters:fix.accuracy!};
}
export function meters(a:Point,b:Point) {
  const rad=Math.PI/180;
  const h=Math.sin((b.latitude-a.latitude)*rad/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin((b.longitude-a.longitude)*rad/2)**2;
  return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));
}
// Bounding-box centers of named building footprints, not visitor entrances.
// OpenStreetMap API 0.6, checked 2026-11-07; source way/version is pinned.
export const locations=[
  {placeId:'geunjeongjeon',latitude:37.57854455,longitude:126.97699045,way:'170199428/17'},
  {placeId:'gyotaejeon',latitude:37.5799157,longitude:126.9770581,way:'279961704/8'},
  {placeId:'gwanghwamun',latitude:37.5759283,longitude:126.9768176,way:'170199440/22'},
];

/** Distances are to sourced building centers, not entrances or walking routes. */
export function nearbyPlaces(fix:Fix|null,now:number,source:readonly typeof locations[number][]=locations){
  const usable=fix!==null&&classify(fix,now)==='good';
  const places=source.map(place=>({...place,distanceMeters:usable?meters(fix,place):null}));
  return (usable?places.sort((a,b)=>a.distanceMeters!-b.distanceMeters!||a.placeId.localeCompare(b.placeId)):places).slice(0,10);
}
