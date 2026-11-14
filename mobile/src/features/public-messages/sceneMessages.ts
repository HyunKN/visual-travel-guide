import {validMarker,validateStoredBody,type Marker,type Messages,type ReadResult} from '../place-messages/contract';
export type Boundary={snapshot:string;before:string|null;id:string|null};
export type SceneRpc=(name:'vtg_snapshot'|'vtg_markers'|'vtg_read',args:Record<string,unknown>,signal:AbortSignal)=>Promise<unknown>;
export interface LocalScene {
  markers(sceneId:string,boundary:Boundary):Promise<Marker[]>;
  read(sceneId:string,id:string):Promise<ReadResult>;
  owned(id:string):Promise<boolean>;
}
// Preserve PostgreSQL microseconds when sorting against SQLite milliseconds.
export function timestamp(raw:unknown):string {
  if(typeof raw!=='string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(raw) || !Number.isFinite(Date.parse(raw)))throw new Error('Invalid timestamp');
  const fraction=raw.match(/\.(\d+)/)?.[1]??'';
  return raw.slice(0,19)+'.'+fraction.padEnd(6,'0')+'Z';
}
function mapRow(value:unknown,sceneId:string):Marker {
  if(!value || typeof value!=='object')throw new Error('Invalid public marker');
  const r=value as Record<string,unknown>;
  const marker={id:r.id as string,sceneId,anchor:{u:r.u as number,v:r.v as number},createdAt:timestamp(r.created_at)};
  if(!validMarker(marker,sceneId))throw new Error('Invalid public marker');
  return marker;
}
type Cursor=Boundary & {sceneId:string;mode:'public'|'private';failed:boolean};
function cursor(raw:string,sceneId:string):Cursor {
  if(raw.length>1024)throw new Error('Invalid cursor');
  const c=JSON.parse(raw) as Cursor;
  if(c.sceneId!==sceneId || !['public','private'].includes(c.mode) || typeof c.failed!=='boolean'
    || timestamp(c.snapshot)!==c.snapshot || c.before===null || timestamp(c.before)!==c.before
    || typeof c.id!=='string' || !/^[a-zA-Z0-9-]{1,200}$/.test(c.id))throw new Error('Invalid cursor');
  return c;
}
function compare(a:Marker,b:Marker) {
  return b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id);
}
export function createSceneMessages(local:LocalScene,rpc:SceneRpc|null,now=()=>new Date().toISOString()):Messages {
  return {
    async list(sceneId,raw,signal) {
      let c:Cursor=raw?cursor(raw,sceneId):{sceneId,snapshot:timestamp(now()),before:null,id:null,mode:rpc?'public':'private',failed:false};
      let remote:Marker[]=[];
      if(c.mode==='public' && rpc) {
        try {
          if(!raw)c={...c,snapshot:timestamp(await rpc('vtg_snapshot',{},signal))};
          const rows=await rpc('vtg_markers',{p_scene:sceneId,p_snapshot:c.snapshot,p_before:c.before,p_id:c.id},signal);
          if(!Array.isArray(rows)||rows.length>61)throw new Error('Invalid public page');
          remote=rows.map(r=>mapRow(r,sceneId));
          if(new Set(remote.map(r=>r.id)).size!==remote.length)throw new Error('Duplicate public markers');
          if(remote.some(m=>m.createdAt>c.snapshot || (c.before!==null &&
            (m.createdAt>c.before || (m.createdAt===c.before && m.id>=c.id!)))))throw new Error('Out-of-page public markers');
        } catch(error) {
          if(signal.aborted)throw error;
          remote=[];
          c={...c,mode:'private',failed:true};
        }
      }
      const privateRows=await local.markers(sceneId,c);
      if(privateRows.length>61 || privateRows.some(m=>!validMarker(m,sceneId)))throw new Error('Invalid local page');
      const unique=new Map(privateRows.map(m=>[m.id,{...m,createdAt:timestamp(m.createdAt)}]));
      remote.forEach(m=>unique.set(m.id,m));
      const sorted=[...unique.values()].sort(compare),items=sorted.slice(0,60),last=items[items.length-1];
      return {items,nextCursor:sorted.length>60?JSON.stringify({...c,before:last.createdAt,id:last.id}):null,
        publicStatus:c.failed?'error':rpc?'ready':'unconfigured'};
    },
    async read(sceneId,id,signal) {
      const own=await local.read(sceneId,id);
      if(own.kind==='found')return {kind:'found',message:{...own.message,origin:'private',owned:true}};
      if(!rpc) return {kind:'unavailable'};
      const rows=await rpc('vtg_read',{p_scene:sceneId,p_id:id},signal);
      if(!Array.isArray(rows)||rows.length>1)throw new Error('Invalid public read');
      if(!rows.length)return {kind:'unavailable'};
      const marker=mapRow(rows[0],sceneId),body=(rows[0] as Record<string,unknown>).body;
      if(marker.id!==id || typeof body!=='string' || validateStoredBody(body))throw new Error('Invalid public message');
      return {kind:'found',message:{...marker,body,origin:'public',owned:await local.owned(id)}};
    },
  };
}
