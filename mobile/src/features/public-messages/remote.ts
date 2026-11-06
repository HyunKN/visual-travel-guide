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
export function serverRejection(code:string,message:string,details?:unknown):PublicationRejected|null {
  if(code!=='P0001') return null;
  if(['request_conflict','unavailable_or_conflict','already_withdrawn'].includes(message)) return new PublicationRejected('conflict');
  if(message==='rate_limited') {
    let retryAt:string|null=null;
    try {
      const value=typeof details==='string' && details.length<=512?JSON.parse(details):null;
      const time=value?.retryAt;
      if(typeof time==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(time)
        && Number.isFinite(Date.parse(time)) && new Date(time).toISOString()===time)retryAt=time;
    } catch { /* Old/malformed feedback must not become arbitrary UI text. */ }
    return new PublicationRejected('rejected',{reason:'rate-limited',retryAt});
  }
  if(['invalid_body','invalid_request'].includes(message)) return new PublicationRejected('rejected');
  return null;
}
