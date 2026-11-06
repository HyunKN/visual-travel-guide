import type {Draft} from '../local-notes/store';
import {validAnchor,validateBody} from '../place-messages/contract';
import {createPublisher,type PublicationJob,type PublicationRemote,type PublicationStorage} from './publication';

export type OwnState=Readonly<{id:string;sceneId:string} & (
  {kind:'missing'} | {kind:'found';version:number;u:number;v:number;body:string;visible:boolean;hidden:boolean}
)>;
export type Inspection=Readonly<{noteId:string;requestId:string;state:OwnState}>;
export type RecoveryOperation='publish'|'withdraw'|'private';
export interface RecoveryStorage extends PublicationStorage {
  prepareConflictPublication(d:Draft,owner:string,service:string,inspection:Inspection,withdraw:boolean):Promise<PublicationJob>;
  saveConflictPrivate(d:Draft,owner:string,service:string,inspection:Inspection):Promise<void>;
}
export class RecoveryChanged extends Error { constructor(){super('Server state changed');} }
export function recoveryOptions(state:OwnState,draft:Draft) {
  return {
    publish:draft.visibility==='public'&&!validateBody(draft.body)&&(state.kind==='missing'||!state.hidden),
    withdraw:state.kind==='found'&&state.visible,
    private:draft.visibility==='private'&&!validateBody(draft.body)&&(state.kind==='missing'||!state.visible),
  };
}
/** Authenticated management read. Other owners and absent IDs are indistinguishable. */
export function createOwnStateRemote(rpc:(name:string,args:Record<string,unknown>)=>Promise<unknown>) {
  return async(sceneId:string,id:string):Promise<OwnState>=>{
    const rows=await rpc('vtg_owner_state',{p_scene:sceneId,p_id:id});
    if(!Array.isArray(rows)||rows.length>1)throw new Error('Invalid owner state');
    if(!rows.length)return {kind:'missing',id,sceneId};
    const r=rows[0];
    if(!r||r.id!==id||r.scene_id!==sceneId||!Number.isSafeInteger(r.version)||r.version<1||!validAnchor(r)||
      typeof r.body!=='string'||((r.visible||r.body!=='')&&validateBody(r.body))||typeof r.visible!=='boolean'||typeof r.hidden!=='boolean')
      throw new Error('Invalid owner state');
    return {kind:'found',id,sceneId,version:r.version,u:r.u,v:r.v,body:r.body,visible:r.visible,hidden:r.hidden};
  };
}
function same(a:OwnState,b:OwnState) {
  return a.id===b.id&&a.sceneId===b.sceneId&&a.kind===b.kind&&(a.kind==='missing'||
    (b.kind==='found'&&a.version===b.version&&a.u===b.u&&a.v===b.v&&a.body===b.body&&a.visible===b.visible&&a.hidden===b.hidden));
}
/** Caller serializes author-session operations. Inspection never sends a write. */
export function createConflictRecovery(storage:RecoveryStorage,remote:PublicationRemote,read:(scene:string,id:string)=>Promise<OwnState>) {
  async function current(id:string,requestId?:string) {
    const job=await storage.getPublication(id);
    if(!job||job.state!=='conflict'||job.ownerId!==remote.ownerId||job.serviceId!==remote.serviceId||
      (requestId!==undefined&&job.requestId!==requestId))throw new RecoveryChanged();
    return job;
  }
  return {
    async inspect(id:string):Promise<Inspection> {
      const job=await current(id);
      return {noteId:id,requestId:job.requestId,state:await read(job.payload.p_scene,id)};
    },
    async act(draft:Draft,inspection:Inspection,operation:RecoveryOperation) {
      const job=await current(draft.id,inspection.requestId);
      if(inspection.noteId!==draft.id||inspection.state.id!==draft.id||inspection.state.sceneId!==draft.sceneId||job.payload.p_scene!==draft.sceneId)
        throw new RecoveryChanged();
      const fresh=await read(draft.sceneId,draft.id);
      if(!same(inspection.state,fresh))throw new RecoveryChanged();
      if(!recoveryOptions(fresh,draft)[operation])throw new Error('Recovery action unavailable');
      if(operation==='private'){
        await storage.saveConflictPrivate(draft,remote.ownerId,remote.serviceId,inspection);
        return null;
      }
      const next=await storage.prepareConflictPublication(draft,remote.ownerId,remote.serviceId,inspection,operation==='withdraw');
      return createPublisher(storage,remote).deliver(next.noteId);
    },
  };
}
