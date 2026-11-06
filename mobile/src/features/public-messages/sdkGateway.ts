import {createClient,type Session} from '@supabase/supabase-js';
import type {AuthPort,AuthorSession} from './session';
import {serverRejection} from './remote';

/** Supabase Auth/PostgREST use JSON. Keep the HTTP deadline active through
 * response-body consumption; receiving headers alone is not completion. */
export function boundedJsonFetch(transport:typeof fetch,timeoutMs=15000):typeof fetch {
  return async(input,init)=>{
    const controller=new AbortController(),parent=init?.signal;
    if(parent?.aborted){const error=new Error('Public request cancelled');error.name='AbortError';throw error;}
    let rejectAbort:(error:Error)=>void=()=>{};
    const aborted=new Promise<never>((_,reject)=>{rejectAbort=reject;});
    const abort=()=>{controller.abort();const error=new Error('Public request cancelled');error.name='AbortError';rejectAbort(error);};
    parent?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(abort,timeoutMs);
    try{
      if(controller.signal.aborted)throw new Error('Public request cancelled');
      return await Promise.race([aborted,(async()=>{
        const response=await transport(input,{...init,signal:controller.signal});
        const text=await response.text();
        return new Response([204,205,304].includes(response.status)?null:text,{status:response.status,statusText:response.statusText,headers:response.headers});
      })()]);
    }finally{clearTimeout(timer);parent?.removeEventListener('abort',abort);}
  };
}
export function createSdkGateway(url:string,key:string,transport:typeof fetch=fetch,timeoutMs=15000) {
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:boundedJsonFetch(transport,timeoutMs)}};
  const client=createClient(url,key,options),reader=createClient(url,key,options);
  function extract(session:Session|null):AuthorSession{
    if(!session)throw new Error('Author session unavailable');
    return {ownerId:session.user.id,accessToken:session.access_token,refreshToken:session.refresh_token};
  }
  const auth:AuthPort={
    async anonymous(){const {data,error}=await client.auth.signInAnonymously();if(error)throw new Error('Anonymous sign-in failed');return extract(data.session);},
    async restore(session){const {data,error}=await client.auth.setSession({access_token:session.accessToken,refresh_token:session.refreshToken});
      if(error)throw new Error('Author session could not be restored');return extract(data.session);},
  };
  return {
    auth,
    async read(name:string,args:Record<string,unknown>,signal:AbortSignal){
      const {data,error}=await reader.rpc(name,args).abortSignal(signal);
      if(error)throw new Error('Public read failed');
      return data;
    },
    async write(name:string,args:Record<string,unknown>){
      const {data,error,status}=await client.rpc(name,args);
      if(error)throw (status===400?serverRejection(error.code,error.message,error.details):null)??new Error('Public request failed');
      return data;
    },
  };
}
