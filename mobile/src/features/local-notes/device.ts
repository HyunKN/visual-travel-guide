import { uuid } from 'expo-modules-core';
import type { SQLiteDatabase } from 'expo-sqlite';
import { createStore, migrate } from './store';

let opening: Promise<SQLiteDatabase> | undefined;
function open() {
  // Load the native module on first use, so older development builds can
  // still navigate to the other features and report a recoverable DB error.
  return opening ??= (async () => {
    const { openDatabaseAsync } = await import('expo-sqlite');
    const db = await openDatabaseAsync('place-notes.db');
    try { await db.withExclusiveTransactionAsync(migrate); return db; }
    catch (error) { await db.closeAsync(); throw error; }
  })().catch(error => { opening = undefined; throw error; });
}
export const deviceNotes = createStore(async work => (await open()).withExclusiveTransactionAsync(work), () => uuid.v4());
