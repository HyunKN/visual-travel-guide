export type AuthorSession={ownerId:string;accessToken:string;refreshToken:string};
export interface SessionVault {
  read():Promise<AuthorSession|null>;
  write(session:AuthorSession):Promise<void>;
}
export interface AuthPort {
  anonymous():Promise<AuthorSession>;
  restore(session:AuthorSession):Promise<AuthorSession>;
}
export function validSession(s:unknown):s is AuthorSession {
  if(!s || typeof s!=='object') return false;
  const v=s as AuthorSession;
  return typeof v.ownerId==='string' && !!v.ownerId && typeof v.accessToken==='string' && !!v.accessToken
    && typeof v.refreshToken==='string' && !!v.refreshToken;
}
/** Serialize auth + RPC together. Failed persistence never releases an identity
 * to a publisher. Retain a rotated token in memory until storage can retry. */
export function createAuthorSession(vault:SessionVault,auth:AuthPort) {
  let tail=Promise.resolve(), unsaved:AuthorSession|null=null;
  return {
    run<T>(expectedOwner:string|null,allowCreate:boolean,work:(ownerId:string)=>Promise<T>):Promise<T> {
      const result=tail.then(async()=>{
        let session=unsaved;
        if(!session) {
          const saved=await vault.read();
          if(saved && !validSession(saved)) throw new Error('Stored author session is invalid');
          if(saved && expectedOwner && saved.ownerId!==expectedOwner) throw new Error('Author session does not match');
          if(!saved && (expectedOwner || !allowCreate)) throw new Error('Author session is unavailable');
          session=saved ? await auth.restore(saved) : await auth.anonymous();
          if(!validSession(session)) throw new Error('Invalid author response');
          if(saved && session.ownerId!==saved.ownerId) throw new Error('Restored author changed');
          unsaved=session;
        }
        if(expectedOwner && session.ownerId!==expectedOwner) throw new Error('Author session does not match');
        await vault.write(session);
        unsaved=null;
        return work(session.ownerId);
      });
      tail=result.then(()=>{},()=>{});
      return result;
    },
  };
}
