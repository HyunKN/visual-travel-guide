import type {createSdkGateway} from '../public-messages/sdkGateway';
import type {createAuthorSession} from '../public-messages/session';
import {AuthenticationRequired} from '../public-messages/session';
import {setAccountScope} from './accountScope';
export const authCallback='visual-travel-guide://auth/callback';
export type SocialProvider='google'|'custom:naver';
export type AuthState=Readonly<{kind:'guest'|'restoring'|'signing-in'|'signing-out'|'error';epoch:number;message?:string;logoutPending?:boolean;restorePending?:boolean}|{kind:'authenticated';ownerId:string;epoch:number}>;
function callbackOrigin(url:URL){
  const expected=new URL(authCallback);
  if(url.protocol!==expected.protocol||url.host!==expected.host||url.pathname!==expected.pathname||url.username||url.password)throw new Error('Invalid auth callback');
}
/** Validate failure envelopes before deciding whether they belong to this attempt.
 * Descriptions are compared for mirroring only, never interpreted or logged. */
function callbackFailure(url:URL):'cancelled'|'failed'|null {
  const fields=['error','error_code','error_description'];
  const query=url.searchParams,fragment=new URLSearchParams(url.hash.slice(1));
  if(!fields.some(key=>query.has(key)||fragment.has(key)))return null;
  if([...query.keys()].some(key=>!['attempt',...fields].includes(key))
    ||[...fragment.keys()].some(key=>![...fields,'sb'].includes(key)))throw new Error('Invalid denial parameters');
  for(const params of [query,fragment])for(const key of new Set(params.keys()))if(params.getAll(key).length!==1)throw new Error('Duplicate denial parameter');
  if(fragment.has('sb')&&fragment.get('sb')!=='')throw new Error('Invalid denial metadata');
  const queryFields=fields.filter(key=>query.has(key)),fragmentFields=fields.filter(key=>fragment.has(key));
  if(queryFields.length&&fragmentFields.length&&(
    ['error','error_code'].some(key=>query.has(key)!==fragment.has(key)||query.get(key)!==fragment.get(key))
    ||(query.get('error_description')??'')!==(fragment.get('error_description')??'')
  ))throw new Error('Conflicting denial envelopes');
  const error=queryFields.length?query:fragment;
  if(!error.get('error'))throw new Error('Missing provider error');
  return error.get('error')==='access_denied'&&!error.has('error_code')?'cancelled':'failed';
}
export function callbackCode(value:string,attempt?:string){
  const url=new URL(value);callbackOrigin(url);
  if(url.hash||url.searchParams.has('error'))throw new Error('Invalid auth callback');
  if(attempt&&(url.searchParams.getAll('attempt').length!==1||url.searchParams.get('attempt')!==attempt))throw new Error('Unrelated auth callback');
  if([...url.searchParams.keys()].some(key=>!['code','attempt','sb_flow_id'].includes(key)))throw new Error('Invalid auth parameters');
  const code=url.searchParams.get('code');
  if(!code||url.searchParams.getAll('code').length!==1||code.length>4096)throw new Error('Invalid auth code');
  return {code,flowId:url.searchParams.get('sb_flow_id')??undefined};
}

export function createSocialAuth(service:string,gateway:ReturnType<typeof createSdkGateway>,author:ReturnType<typeof createAuthorSession>,browser:(url:string,callback:string)=>Promise<{type:string;url?:string}>,newAttempt:()=>string,now=Date.now,cancelBrowser:()=>void=()=>{}) {
  let generation=0,state:AuthState={kind:'guest',epoch:0},pending:number|null=null;
  const listeners=new Set<()=>void>();
  const emit=(next:AuthState)=>{state=Object.freeze(next);listeners.forEach(fn=>fn());};
  const lock=()=>{generation++;author.invalidate();const epoch=setAccountScope(null);return {generation,epoch};};
  const authenticated=(ownerId:string,current:number)=>{if(current!==generation)return;const epoch=setAccountScope(service,ownerId);emit({kind:'authenticated',ownerId,epoch});};
  async function clearCredentials(){await author.clear();await gateway.clear();}
  async function finishClear(task:{generation:number;epoch:number}){
    try{await clearCredentials();if(task.generation===generation)emit({kind:'guest',epoch:task.epoch});}
    catch{if(task.generation===generation)emit({kind:'error',epoch:task.epoch,logoutPending:true,message:'로그아웃을 안전하게 저장하지 못했어요. 다시 시도해 주세요.'});}
  }
  return {
    snapshot:()=>state,subscribe(fn:()=>void){listeners.add(fn);return()=>listeners.delete(fn);},
    async restore(){const task=lock();emit({kind:'restoring',epoch:task.epoch});
      try{const owner=await author.run(null,false,async owner=>owner);authenticated(owner,task.generation);}
      catch(error){if(task.generation===generation)emit(error instanceof AuthenticationRequired?{kind:'guest',epoch:task.epoch}:{kind:'error',epoch:task.epoch,restorePending:true,message:'로그인 상태를 확인하지 못했어요.'});}
    },
    async signIn(provider:SocialProvider){
      if(pending!==null||state.kind==='signing-out')return;const task=lock();pending=task.generation;emit({kind:'signing-in',epoch:task.epoch});
      try{
        // The durable tombstone also makes cancelling an account switch safe on restart.
        await clearCredentials();if(task.generation!==generation)return;
        const attempt=newAttempt(),deadline=now()+300000,redirect=authCallback+'?attempt='+encodeURIComponent(attempt);
        const url=await gateway.oauth(provider,redirect);if(task.generation!==generation)return;
        let callback:ReturnType<typeof callbackCode>|undefined;
        while(!callback){
          const result=await browser(url,authCallback);if(task.generation!==generation)return;
          if(result.type==='cancel'||result.type==='dismiss'){emit({kind:'guest',epoch:task.epoch});return;}
          if(result.type!=='success'||!result.url)throw new Error('Invalid browser result');
          const incoming=new URL(result.url);callbackOrigin(incoming);
          if(incoming.searchParams.getAll('attempt').length!==1||!incoming.searchParams.get('attempt'))throw new Error('Missing auth attempt');
          const failure=callbackFailure(incoming);
          if(!failure)callbackCode(result.url);
          if(incoming.searchParams.get('attempt')!==attempt){if(now()>deadline)throw new Error('Login attempt expired');continue;}
          if(failure==='cancelled'){emit({kind:'guest',epoch:task.epoch});return;}
          if(failure==='failed')throw new Error('Provider login failed');
          if(now()>deadline)throw new Error('Login attempt expired');
          callback=callbackCode(result.url,attempt);
        }
        const session=await gateway.exchange(callback.code,callback.flowId);
        if(task.generation!==generation)return;
        const owner=await author.accept(session);authenticated(owner,task.generation);
      }catch{if(task.generation===generation)emit({kind:'error',epoch:task.epoch,message:'로그인을 완료하지 못했어요. 다시 시도해 주세요.'});}
      finally{if(pending===task.generation)pending=null;}
    },
    async signOut(){const task=lock();pending=null;cancelBrowser();emit({kind:'signing-out',epoch:task.epoch});
      await finishClear(task);
    },
    expire(){const task=lock();emit({kind:'guest',epoch:task.epoch});},
    cancelSignIn(){if(state.kind!=='signing-in')return;pending=null;const task=lock();cancelBrowser();emit({kind:'signing-out',epoch:task.epoch});return finishClear(task);},
  };
}
