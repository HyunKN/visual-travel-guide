import {bodyBytes} from '../place-messages/contract';
import {validSession,type AuthorSession,type SessionVault} from './session';
export interface SecretStore { get(key:string):Promise<string|null>;set(key:string,value:string):Promise<void>;remove(key:string):Promise<void> }
type Manifest={generation:string;count:number};
function manifest(raw:string):Manifest {
  const m=JSON.parse(raw) as Manifest;
  if(!m || !/^[a-zA-Z0-9-]{1,80}$/.test(m.generation) || !Number.isInteger(m.count) || m.count<1 || m.count>64) throw new Error('Invalid session manifest');
  return m;
}
/** A pointer is committed only after all bounded encrypted pieces are written.
 * Incomplete writes cannot replace the last usable session. No plaintext fallback. */
export function createSessionVault(store:SecretStore,key:string,newGeneration:()=>string):SessionVault {
  const part=(m:Manifest,i:number)=>key+'.'+m.generation+'.'+i;
  return {
    async read() {
      const raw=await store.get(key);
      if(raw===null)return null;
      const m=manifest(raw),chunks:string[]=[];
      for(let i=0;i<m.count;i++){const s=await store.get(part(m,i));if(s===null)throw new Error('Incomplete author session');chunks.push(s);}
      const value:unknown=JSON.parse(chunks.join(''));
      if(!validSession(value))throw new Error('Invalid author session');
      return value;
    },
    async write(session:AuthorSession) {
      if(!validSession(session))throw new Error('Invalid author session');
      const value=JSON.stringify(session);
      if(bodyBytes(value)>64000)throw new Error('Author session too large');
      const old=await store.get(key),previous=old===null?null:manifest(old);
      // 400 UTF-16 units fit below 2KiB even for non-ASCII values.
      const m={generation:newGeneration(),count:Math.ceil(value.length/400)};
      manifest(JSON.stringify(m));
      if(previous?.generation===m.generation)throw new Error('Session generation reused');
      for(let i=0;i<m.count;i++)await store.set(part(m,i),value.slice(i*400,(i+1)*400));
      await store.set(key,JSON.stringify(m));
      // Cleanup failure must not invalidate the newly committed session.
      if(previous)for(let i=0;i<previous.count;i++)await store.remove(part(previous,i)).catch(()=>{});
    },
  };
}
