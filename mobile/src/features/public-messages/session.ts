export type AuthorSession={ownerId:string;accessToken:string;refreshToken:string;permanent:true};
export class AuthenticationRequired extends Error { constructor(){super('Permanent login required');} }
export interface SessionVault {
  read():Promise<AuthorSession|null>;
  write(session:AuthorSession):Promise<void>;
  clear():Promise<void>;
}
export interface AuthPort {
  restore(session:AuthorSession):Promise<AuthorSession>;
}
export function validSession(s:unknown):s is AuthorSession {
  if(!s || typeof s!=='object') return false;
  const v=s as AuthorSession;
  return v.permanent===true && typeof v.ownerId==='string' && !!v.ownerId && typeof v.accessToken==='string' && !!v.accessToken
    && typeof v.refreshToken==='string' && !!v.refreshToken;
}
/** Serialize auth + RPC together. Failed persistence never releases an identity
 * to a publisher. Retain a rotated token in memory until storage can retry. */
export function createAuthorSession(vault:SessionVault,auth:AuthPort) {
  let tail=Promise.resolve(), unsaved:AuthorSession|null=null,generation=0;
  function queue<T>(work:()=>Promise<T>){const result=tail.then(work);tail=result.then(()=>{},()=>{});return result;}
  return {
    invalidate(){generation++;unsaved=null;},
    accept(session:AuthorSession){const current=generation;return queue(async()=>{
      if(current!==generation||!validSession(session))throw new AuthenticationRequired();
      unsaved=session;await vault.write(session);
      if(current!==generation)throw new AuthenticationRequired();unsaved=null;return session.ownerId;
    });},
    clear(){return vault.clear().then(()=>{unsaved=null;});},
    run<T>(expectedOwner:string|null,_allowCreate:boolean,work:(ownerId:string)=>Promise<T>):Promise<T> {
      const current=generation;
      return queue(async()=>{
        if(current!==generation)throw new AuthenticationRequired();
        let session=unsaved;
        if(!session) {
          const saved=await vault.read();
          if(saved && !validSession(saved)) throw new Error('Stored author session is invalid');
          if(saved && expectedOwner && saved.ownerId!==expectedOwner) throw new Error('Author session does not match');
          if(!saved) throw new AuthenticationRequired();
          session=await auth.restore(saved);
          if(!validSession(session)) throw new Error('Invalid author response');
          if(saved && session.ownerId!==saved.ownerId) throw new Error('Restored author changed');
          if(current!==generation)throw new AuthenticationRequired();unsaved=session;
        }
        if(expectedOwner && session.ownerId!==expectedOwner) throw new Error('Author session does not match');
        await vault.write(session);
        if(current!==generation)throw new AuthenticationRequired();
        unsaved=null;
        const value=await work(session.ownerId);
        if(current!==generation)throw new AuthenticationRequired();return value;
      });
    },
  };
}
