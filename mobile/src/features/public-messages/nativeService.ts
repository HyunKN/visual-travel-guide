import {createClient} from '@supabase/supabase-js';
import {uuid} from 'expo-modules-core';
import {createAuthorSession,type AuthorSession} from './session';
import {createSessionVault} from './sessionVault';
import {createPublicationRemote,serverRejection} from './remote';
import {createPublisher} from './publication';
import {deviceNotes} from '../local-notes/device';
import type {Draft} from '../local-notes/store';

export function publicConfiguration(url:unknown,key:unknown) {
  if(typeof url!=='string' || typeof key!=='string' || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) || !/^sb_publishable_[a-zA-Z0-9_-]+$/.test(key)) return null;
  return {url:url.replace(/\/$/,''),key};
}
const config=publicConfiguration(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
export const publicServiceConfigured=!!config;
let service:ReturnType<typeof build>|undefined;
function build(c:NonNullable<typeof config>) {
  const client=createClient(c.url,c.key,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:async(input,init)=>{
      const controller=new AbortController(),parent=init?.signal;
      const abort=()=>controller.abort();
      if(parent?.aborted)abort();else parent?.addEventListener('abort',abort,{once:true});
      const timer=setTimeout(abort,15000);
      try{return await fetch(input,{...init,signal:controller.signal});}
      finally{clearTimeout(timer);parent?.removeEventListener('abort',abort);}
    }},
  });
  const vault=createSessionVault({
    async get(key){const s=await import('expo-secure-store');return s.getItemAsync(key);},
    async set(key,value){const s=await import('expo-secure-store');await s.setItemAsync(key,value,{keychainAccessible:s.WHEN_UNLOCKED_THIS_DEVICE_ONLY});},
    async remove(key){const s=await import('expo-secure-store');await s.deleteItemAsync(key);},
  },'vtg-author-'+new URL(c.url).hostname,()=>uuid.v4());
  function extract(s:{access_token:string;refresh_token:string;user:{id:string}}|null):AuthorSession {
    if(!s)throw new Error('Author session unavailable');
    return {ownerId:s.user.id,accessToken:s.access_token,refreshToken:s.refresh_token};
  }
  const author=createAuthorSession(vault,{
    async anonymous(){const {data,error}=await client.auth.signInAnonymously();if(error)throw new Error('Anonymous sign-in failed');return extract(data.session);},
    async restore(session){
      const {data,error}=await client.auth.setSession({access_token:session.accessToken,refresh_token:session.refreshToken});
      if(error)throw new Error('Author session could not be restored');
      return extract(data.session);
    },
  });
  return {
    async publish(draft:Draft,withdraw=false) {
      const previous=await deviceNotes.getPublication(draft.id);
      const bound=await deviceNotes.publicationOwner(c.url);
      if(previous && previous.serviceId!==c.url)throw new Error('Publication service changed');
      return author.run(previous?.ownerId??bound,!withdraw,async ownerId=>{
        if(previous && ['pending','uncertain'].includes(previous.state) && previous.payload.p_withdraw!==withdraw)throw new Error('Resolve previous publication first');
        const job=previous && ['pending','uncertain'].includes(previous.state)?previous:await deviceNotes.preparePublication(draft,ownerId,c.url,withdraw);
        const remote=createPublicationRemote(ownerId,c.url,async(name,args)=>{
          const {data,error}=await client.rpc(name,args);
          if(error)throw serverRejection(error.code,error.message)??new Error('Public request failed');
          return data;
        });
        return createPublisher(deviceNotes,remote).deliver(job.noteId);
      });
    },
  };
}
export function getPublicService(){
  if(!config)throw new Error('Public service is not configured');
  return service??=build(config);
}
