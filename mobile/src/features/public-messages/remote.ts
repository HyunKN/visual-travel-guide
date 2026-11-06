import { PublicationRejected, type PublicationRemote, type WritePayload } from './publication';

/** Supabase client wrapper supplies an authenticated, timeout-bounded RPC call.
 * Tokens and arbitrary backend error text never cross this boundary. */
export type Rpc=(name:'vtg_request_status'|'vtg_write',args:Record<string,unknown>)=>Promise<unknown>;
export function createPublicationRemote(ownerId:string,serviceId:string,rpc:Rpc):PublicationRemote {
  if(!ownerId || !serviceId) throw new Error('Missing author or service');
  return {
    ownerId,serviceId,
    async status(requestId) {
      const value=await rpc('vtg_request_status',{p_request:requestId});
      if(value!==null && (!Number.isSafeInteger(value) || (value as number)<1)) throw new Error('Invalid request status');
      return value as number|null;
    },
    async write(requestId:string,payload:WritePayload) {
      const value=await rpc('vtg_write',{...payload,p_request:requestId});
      if(!Number.isSafeInteger(value) || (value as number)<1) throw new Error('Invalid publication version');
      return value as number;
    },
  };
}
// Only known SQL exceptions from a completed RPC response may use this helper.
// Transport failures, auth expiry, 5xx and unknown responses remain uncertain.
export function serverRejection(code:string,message:string):PublicationRejected|null {
  if(code!=='P0001') return null;
  if(['request_conflict','unavailable_or_conflict','already_withdrawn'].includes(message)) return new PublicationRejected('conflict');
  if(['invalid_body','invalid_request','rate_limited'].includes(message)) return new PublicationRejected('rejected');
  return null;
}
