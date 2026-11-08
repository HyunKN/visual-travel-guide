import {uuid} from 'expo-modules-core';
import {createSdkGateway} from '../public-messages/sdkGateway';
import {createAuthorSession} from '../public-messages/session';
import {createSessionVault} from '../public-messages/sessionVault';
import {createSocialAuth} from './socialAuth';
import {prepareNativePkce} from './pkceCrypto';
export function publicConfiguration(url:unknown,key:unknown) {
  if(typeof url!=='string'||typeof key!=='string'||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)||!/^sb_publishable_[a-zA-Z0-9_-]+$/.test(key))return null;
  return {url:url.replace(/\/$/,''),key};
}
export const memoConfig=publicConfiguration(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
function build(config:NonNullable<typeof memoConfig>){
  const gateway=createSdkGateway(config.url,config.key);
  const vault=createSessionVault({
    async get(key){const s=await import('expo-secure-store');return s.getItemAsync(key);},
    async set(key,value){const s=await import('expo-secure-store');await s.setItemAsync(key,value,{keychainAccessible:s.WHEN_UNLOCKED_THIS_DEVICE_ONLY});},
    async remove(key){const s=await import('expo-secure-store');await s.deleteItemAsync(key);},
  },'vtg-social-v1-'+new URL(config.url).hostname,()=>uuid.v4());
  const author=createAuthorSession(vault,gateway.auth);
  let dismissBrowser=()=>{};
  const social=createSocialAuth(config.url,{...gateway,async oauth(provider,redirect){await prepareNativePkce();return gateway.oauth(provider,redirect);}},author,async(url,callback)=>{
    const web=await import('expo-web-browser');dismissBrowser=()=>{try{web.dismissAuthSession();}catch{/* A completed browser session needs no further dismissal. */}};return web.openAuthSessionAsync(url,callback);
  },()=>uuid.v4(),Date.now,()=>dismissBrowser());
  return {gateway,author,social};
}
let runtime:ReturnType<typeof build>|undefined;
export function authRuntime(){if(!memoConfig)throw new Error('Memo auth not configured');return runtime??=build(memoConfig);}
