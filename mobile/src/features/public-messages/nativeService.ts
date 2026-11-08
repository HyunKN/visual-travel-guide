import {AuthenticationRequired} from './session';
import {authRuntime,memoConfig} from '../auth/nativeAuth';
import {captureAccount,accountIsCurrent,accountRpc,type AccountScope} from '../auth/accountScope';
import {createPublicationRemote} from './remote';
import {createPublisher} from './publication';
import {accountNotes} from '../local-notes/device';
import type {Draft} from '../local-notes/store';
import {createSceneMessages} from './sceneMessages';
import {createConflictRecovery,createOwnStateRemote,type Inspection,type RecoveryOperation} from './recovery';
export {publicConfiguration} from '../auth/nativeAuth';
export const publicServiceConfigured=!!memoConfig;
let service:ReturnType<typeof build>|undefined;
function build(c:NonNullable<typeof memoConfig>) {
  const {gateway,author,social}=authRuntime();
  async function run<T>(scope:AccountScope,work:(owner:string)=>Promise<T>){
    try{
      if(!accountIsCurrent(scope))throw new AuthenticationRequired();
      const value=await author.run(scope.ownerId,false,owner=>{if(!accountIsCurrent(scope))throw new AuthenticationRequired();return work(owner);});
      if(!accountIsCurrent(scope))throw new AuthenticationRequired();return value;
    }catch(error){if(error instanceof AuthenticationRequired&&accountIsCurrent(scope))social.expire();throw error;}
  }
  const rpc=(scope:AccountScope)=>accountRpc(scope,gateway.write,()=>social.expire());
  async function recovery<T>(work:(value:ReturnType<typeof createConflictRecovery>)=>Promise<T>) {
    const scope=captureAccount(),store=accountNotes(scope);
    return run(scope,owner=>work(createConflictRecovery(store,
      createPublicationRemote(owner,c.url,rpc(scope)),createOwnStateRemote(rpc(scope)))));
  }
  return {
    inspectPublication:(id:string)=>recovery(value=>value.inspect(id)),
    recoverPublication:(draft:Draft,inspection:Inspection,operation:RecoveryOperation)=>recovery(value=>value.act(draft,inspection,operation)),
    async homePreview(scenes:readonly string[],signal:AbortSignal) {
      return gateway.read('vtg_home_preview',{p_scenes:[...scenes]},signal);
    },
    messages(){
      const scope=captureAccount(),store=accountNotes(scope);
      return createSceneMessages({markers:store.privateMarkers,read:store.privateRead,
        owned:async id=>(await store.getPublication(id))?.serviceId===c.url,
      },(name,args,signal)=>run(scope,()=>gateway.authenticatedRead(name,args,signal)));
    },
    async report(id:string,reason:'spam'|'abuse'|'personal_info'|'other') {
      const scope=captureAccount(),store=accountNotes(scope),existing=await store.getPublication(id);
      if(existing?.serviceId===c.url)throw new Error('Cannot report own message');
      return run(scope,async()=>{
        await rpc(scope)('vtg_report',{p_id:id,p_reason:reason});
      });
    },
    async publish(draft:Draft,withdraw=false) {
      const scope=captureAccount(),store=accountNotes(scope);
      return run(scope,async ownerId=>{
        // Read inside the serialized author operation, not before queued actions.
        const previous=await store.getPublication(draft.id);
        if(previous && previous.serviceId!==c.url)throw new Error('Publication service changed');
        if(previous && previous.ownerId!==ownerId)throw new Error('Publication author changed');
        if(previous && ['pending','uncertain'].includes(previous.state) && previous.payload.p_withdraw!==withdraw)throw new Error('Resolve previous publication first');
        const job=previous && ['pending','uncertain'].includes(previous.state)?previous:await store.preparePublication(draft,ownerId,c.url,withdraw);
        const remote=createPublicationRemote(ownerId,c.url,rpc(scope));
        return createPublisher(store,remote).deliver(job.noteId);
      });
    },
  };
}
export function getPublicService(){
  if(!memoConfig)throw new Error('Public service is not configured');
  return service??=build(memoConfig);
}
export function productSceneMessages(){
  if(memoConfig)return getPublicService().messages();
  const store=accountNotes();return createSceneMessages({markers:store.privateMarkers,read:store.privateRead,owned:async()=>true},null);
}
