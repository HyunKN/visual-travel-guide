import { uuid } from 'expo-modules-core';
import type { SQLiteDatabase } from 'expo-sqlite';
import { createStore, migrate } from './store';
import {accountDatabaseName,bindAccountStore,captureAccount,type AccountScope} from '../auth/accountScope';

const opening=new Map<string,Promise<SQLiteDatabase>>();
function open(name:string) {
  // Load the native module on first use, so older development builds can
  // still navigate to the other features and report a recoverable DB error.
  let pending=opening.get(name);if(pending)return pending;
  pending=(async () => {
    const { openDatabaseAsync } = await import('expo-sqlite');
    const db = await openDatabaseAsync(name);
    try { await db.withExclusiveTransactionAsync(migrate); return db; }
    catch (error) { await db.closeAsync(); throw error; }
  })().catch(error => { opening.delete(name); throw error; });opening.set(name,pending);return pending;
}
const stores=new Map<string,ReturnType<typeof createStore>>();
export function accountNotes(scope:AccountScope=captureAccount()){
  const name=accountDatabaseName(scope.service,scope.ownerId);let store=stores.get(name);
  if(!store){store=createStore(async work=>(await open(name)).withExclusiveTransactionAsync(work),()=>uuid.v4());stores.set(name,store);}
  return bindAccountStore(scope,store);
}
const editorial=createStore(async work=>(await open('editorial-v1.db')).withExclusiveTransactionAsync(work),()=>uuid.v4());
export const editorialNotes={nextEditorial:editorial.nextEditorial};
