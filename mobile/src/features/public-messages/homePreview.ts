import {validMarker,validateBody,type Message} from '../place-messages/contract';
import {timestamp} from './sceneMessages';
export type PreviewState={kind:'idle'|'loading'|'empty'|'error'}|{kind:'ready';message:Message};
export type PreviewRpc=(scenes:readonly string[],signal:AbortSignal)=>Promise<unknown>;
/** Only public server data enters the home. No SQLite, fixtures or author session. */
export function createHomePreview(scenes:readonly string[],rpc:PreviewRpc|null) {
  let state:PreviewState={kind:'idle'},generation=0,request:AbortController|undefined;
  const listeners=new Set<()=>void>();
  function emit(next:PreviewState){state=next;listeners.forEach(l=>l());}
  return {
    snapshot:()=>state,
    subscribe(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener);};},
    clear(){generation++;request?.abort();emit({kind:'idle'});},
    async load(){
      const current=++generation;request?.abort();
      if(!rpc || !scenes.length){emit({kind:'empty'});return;}
      const controller=new AbortController();request=controller;emit({kind:'loading'});
      try{
        const rows=await rpc(scenes,controller.signal);
        if(current!==generation)return;
        if(!Array.isArray(rows)||rows.length>1)throw new Error('Invalid preview');
        if(!rows.length){emit({kind:'empty'});return;}
        const r=rows[0];
        const message:Message={id:r.id,sceneId:r.scene_id,anchor:{u:r.u,v:r.v},createdAt:timestamp(r.created_at),body:r.body,origin:'public'};
        if(!scenes.includes(message.sceneId)||!validMarker(message,message.sceneId)||typeof message.body!=='string'||[...message.body].length>64||validateBody(message.body))throw new Error('Invalid preview');
        emit({kind:'ready',message});
      }catch{if(current===generation)emit({kind:'error'});}
    },
  };
}
