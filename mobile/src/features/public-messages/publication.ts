export type PublicationState='pending'|'uncertain'|'published'|'withdrawn'|'conflict'|'rejected';
export type WritePayload={p_id:string;p_expected:number;p_scene:string;p_u:number;p_v:number;p_body:string|null;p_withdraw:boolean};
export type PublicationJob={noteId:string;requestId:string;ownerId:string;serviceId:string;submittedRevision:number;payload:WritePayload;state:PublicationState;serverVersion:number|null;updatedAt:string};
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
  constructor(readonly kind:'conflict'|'rejected') { super(kind); }
}
/** No background sending: call only after explicit publication or retry action. */
export function createPublisher(storage:PublicationStorage,remote:PublicationRemote) {
  const running=new Map<string,Promise<PublicationJob>>();
  async function deliver(id:string):Promise<PublicationJob> {
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
      return (await storage.getPublication(id))!;
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
