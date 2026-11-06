import {createSdkGateway} from './sdkGateway';
import {uuid} from 'expo-modules-core';
import {createAuthorSession} from './session';
import {createSessionVault} from './sessionVault';
import {createPublicationRemote} from './remote';
import {createPublisher} from './publication';
import {deviceNotes} from '../local-notes/device';
import type {Draft} from '../local-notes/store';
import {createSceneMessages} from './sceneMessages';
import {createConflictRecovery,createOwnStateRemote,type Inspection,type RecoveryOperation} from './recovery';

export function publicConfiguration(url:unknown,key:unknown) {
  if(typeof url!=='string' || typeof key!=='string' || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) || !/^sb_publishable_[a-zA-Z0-9_-]+$/.test(key)) return null;
  return {url:url.replace(/\/$/,''),key};
}
const config=publicConfiguration(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
export const publicServiceConfigured=!!config;
let service:ReturnType<typeof build>|undefined;
function build(c:NonNullable<typeof config>) {
  const gateway=createSdkGateway(c.url,c.key);
  const vault=createSessionVault({
    async get(key){const s=await import('expo-secure-store');return s.getItemAsync(key);},
    async set(key,value){const s=await import('expo-secure-store');await s.setItemAsync(key,value,{keychainAccessible:s.WHEN_UNLOCKED_THIS_DEVICE_ONLY});},
    async remove(key){const s=await import('expo-secure-store');await s.deleteItemAsync(key);},
  },'vtg-author-'+new URL(c.url).hostname,()=>uuid.v4());
  const author=createAuthorSession(vault,gateway.auth);
  async function recovery<T>(work:(value:ReturnType<typeof createConflictRecovery>)=>Promise<T>) {
    const bound=await deviceNotes.publicationOwner(c.url);
    return author.run(bound,false,owner=>work(createConflictRecovery(deviceNotes,
      createPublicationRemote(owner,c.url,gateway.write),createOwnStateRemote(gateway.write))));
  }
  return {
    inspectPublication:(id:string)=>recovery(value=>value.inspect(id)),
    recoverPublication:(draft:Draft,inspection:Inspection,operation:RecoveryOperation)=>recovery(value=>value.act(draft,inspection,operation)),
    async homePreview(scenes:readonly string[],signal:AbortSignal) {
      return gateway.read('vtg_home_preview',{p_scenes:[...scenes]},signal);
    },
    messages:createSceneMessages({
      markers:deviceNotes.privateMarkers,read:deviceNotes.privateRead,
      owned:async id=>(await deviceNotes.getPublication(id))?.serviceId===c.url,
    },gateway.read),
    async report(id:string,reason:'spam'|'abuse'|'personal_info'|'other') {
      const existing=await deviceNotes.getPublication(id);
      if(existing?.serviceId===c.url)throw new Error('Cannot report own message');
      const bound=await deviceNotes.publicationOwner(c.url);
      return author.run(bound,true,async()=>{
        await gateway.write('vtg_report',{p_id:id,p_reason:reason});
      });
    },
    async publish(draft:Draft,withdraw=false) {
      const bound=await deviceNotes.publicationOwner(c.url);
      return author.run(bound,!withdraw,async ownerId=>{
        // Read inside the serialized author operation, not before queued actions.
        const previous=await deviceNotes.getPublication(draft.id);
        if(previous && previous.serviceId!==c.url)throw new Error('Publication service changed');
        if(previous && previous.ownerId!==ownerId)throw new Error('Publication author changed');
        if(previous && ['pending','uncertain'].includes(previous.state) && previous.payload.p_withdraw!==withdraw)throw new Error('Resolve previous publication first');
        const job=previous && ['pending','uncertain'].includes(previous.state)?previous:await deviceNotes.preparePublication(draft,ownerId,c.url,withdraw);
        const remote=createPublicationRemote(ownerId,c.url,gateway.write);
        return createPublisher(deviceNotes,remote).deliver(job.noteId);
      });
    },
  };
}
export function getPublicService(){
  if(!config)throw new Error('Public service is not configured');
  return service??=build(config);
}
export const localSceneMessages=createSceneMessages({
  markers:deviceNotes.privateMarkers,read:deviceNotes.privateRead,
  owned:async()=>true,
},null);
export function productSceneMessages(){return config?getPublicService().messages:localSceneMessages;}
