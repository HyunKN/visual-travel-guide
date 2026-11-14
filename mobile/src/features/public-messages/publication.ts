import type {Draft,createStore} from '../local-notes/store';
import {validateBody} from '../place-messages/contract';

export type PublicationState='pending'|'uncertain'|'published'|'withdrawn'|'conflict'|'rejected';
export type WritePayload={p_id:string;p_expected:number;p_scene:string;p_u:number;p_v:number;p_body:string|null;p_withdraw:boolean};
export type PublicationJob={noteId:string;requestId:string;ownerId:string;serviceId:string;submittedRevision:number;payload:WritePayload;state:PublicationState;serverVersion:number|null;stateSource:'request'|'observation';updatedAt:string};
export type RateLimitInfo=Readonly<{reason:'rate-limited';retryAt:string|null}>;
/** Feedback describes this attempt only; durable job/consent fields remain unchanged. */
export type DeliveryResult=PublicationJob & {rateLimit?:RateLimitInfo};
export interface PublicationStorage {
  getPublication(id:string):Promise<PublicationJob|null>;
  settlePublication(id:string,requestId:string,state:PublicationState,version?:number|null):Promise<void>;
}
export interface PublicationRemote {
  readonly ownerId:string;
  readonly serviceId:string;
  status(requestId:string):Promise<number|null>;
  write(requestId:string,payload:WritePayload):Promise<number>;
}
/** Only a parsed server rejection can be definite. All other failures are uncertain. */
export class PublicationRejected extends Error {
  constructor(readonly kind:'conflict'|'rejected',readonly rateLimit?:RateLimitInfo) { super(kind); }
}
/** One explicit private-save action; never claim private before withdrawal is confirmed. */
export function createPrivateSaver(storage:Pick<ReturnType<typeof createStore>,'getPublication'|'preparePublication'|'saveDraft'|'savePrivate'|'settlePublication'>,remote:PublicationRemote){
  return async(draft:Draft):Promise<DeliveryResult|null>=>{
    if(draft.visibility!=='private'||validateBody(draft.body))throw new Error('Valid private note required');
    const previous=await storage.getPublication(draft.id);
    if(previous&&(previous.ownerId!==remote.ownerId||previous.serviceId!==remote.serviceId))throw new Error('Wrong publication session or service');
    await storage.saveDraft(draft);
    if(previous&&(['pending','uncertain'].includes(previous.state)||(previous.serverVersion!==null&&previous.state!=='withdrawn'))){
      if(previous.state==='conflict'||(['pending','uncertain'].includes(previous.state)&&!previous.payload.p_withdraw))throw new Error('Resolve previous publication first');
      const next=['pending','uncertain'].includes(previous.state)?previous:await storage.preparePublication(draft,remote.ownerId,remote.serviceId,true);
      const result=await createPublisher(storage,remote).deliver(next.noteId);
      if(result.state!=='withdrawn')return result;
    }
    await storage.savePrivate(draft);
    return null;
  };
}
/** No background sending: call only after explicit publication or retry action. */
export function createPublisher(storage:PublicationStorage,remote:PublicationRemote) {
  const running=new Map<string,Promise<DeliveryResult>>();
  async function deliver(id:string):Promise<DeliveryResult> {
    const job=await storage.getPublication(id);
    if(!job) throw new Error('Missing publication');
    if(job.ownerId!==remote.ownerId || job.serviceId!==remote.serviceId) throw new Error('Wrong publication session or service');
    if(!['pending','uncertain'].includes(job.state)) return job;
    let version:number;
    try {
      // A previous process may have committed the request without its response.
      // Missing status permits only replaying the SAME id and immutable payload.
      const confirmed=await remote.status(job.requestId);
      version=confirmed ?? await remote.write(job.requestId,job.payload);
      if(!Number.isSafeInteger(version) || version!==job.payload.p_expected+1) throw new Error('Invalid confirmation');
    } catch(error) {
      await storage.settlePublication(id,job.requestId,error instanceof PublicationRejected ? error.kind : 'uncertain');
      const settled=(await storage.getPublication(id))!;
      return error instanceof PublicationRejected && error.kind==='rejected' && error.rateLimit ? {...settled,rateLimit:error.rateLimit} : settled;
    }
    // Local acknowledgement failure propagates. It never generates a new request.
    await storage.settlePublication(id,job.requestId,job.payload.p_withdraw?'withdrawn':'published',version);
    return (await storage.getPublication(id))!;
  }
  return { deliver(id:string) {
    const existing=running.get(id);
    if(existing) return existing;
    const promise=deliver(id).finally(()=>running.delete(id));
    running.set(id,promise);
    return promise;
  }};
}
