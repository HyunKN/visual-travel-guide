import {AuthenticationRequired} from '../public-messages/session';
export type AccountScope=Readonly<{service:string;ownerId:string;epoch:number}>;
let current:AccountScope|null=null,epoch=0;
export function setAccountScope(service:string|null,ownerId?:string){
  epoch++;current=service&&ownerId?Object.freeze({service,ownerId,epoch}):null;return epoch;
}
export function captureAccount(){if(!current)throw new Error('Memo login required');return current;}
export function accountIsCurrent(scope:AccountScope){return current===scope;}
export function accountRpc(scope:AccountScope,rpc:(name:string,args:Record<string,unknown>)=>Promise<unknown>,onExpired:()=>void){
  return async(name:string,args:Record<string,unknown>)=>{
    if(!accountIsCurrent(scope))throw new AuthenticationRequired();
    try{return await rpc(name,args);}catch(error){if(error instanceof AuthenticationRequired&&accountIsCurrent(scope))onExpired();throw error;}
  };
}
export function bindAccountStore<T extends {messages:object}>(scope:AccountScope,store:T):T {
  const wrap=(fn:unknown)=>(...args:unknown[])=>{
    if(!accountIsCurrent(scope))return Promise.reject(new Error('Memo account changed'));
    return Promise.resolve(Reflect.apply(fn as (...args:unknown[])=>unknown,store,args)).then(value=>{if(!accountIsCurrent(scope))throw new Error('Memo account changed');return value;});
  };
  return new Proxy(store,{get:(target,key)=>{
    if(key==='messages')return Object.fromEntries(Object.entries(target.messages).map(([name,fn])=>[name,wrap(fn)]));
    return wrap(Reflect.get(target,key));
  }});
}
export function accountDatabaseName(service:string,ownerId:string){
  const url=new URL(service);
  if(url.protocol!=='https:'||!/^([a-z0-9-]+)\.supabase\.co$/.test(url.hostname)||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(ownerId))throw new Error('Invalid memo namespace');
  return `memo-${url.hostname.split('.')[0]}-${ownerId.toLowerCase()}.db`;
}
