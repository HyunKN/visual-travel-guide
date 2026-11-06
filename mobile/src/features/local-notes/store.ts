import { validAnchor, validateBody, type Anchor, type Messages } from '../place-messages/contract';

export type Visibility = 'private' | 'public' | null;
export type Draft = { id: string; sceneId: string; u: number; v: number; body: string; visibility: Visibility; revision: number; updatedAt: string };
export type LocalItem = Draft & { kind: 'draft' | 'note' };
type Param = string | number | null;
export interface Connection {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...values: Param[]): Promise<{ changes: number }>;
  getFirstAsync<T>(sql: string, ...values: Param[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...values: Param[]): Promise<T[]>;
}
export type Transaction = (work: (tx: Connection) => Promise<void>) => Promise<void>;
const columns = 'id,sceneId,u,v,body,visibility,revision,updatedAt';
const table = `id TEXT PRIMARY KEY NOT NULL, sceneId TEXT NOT NULL, u REAL NOT NULL CHECK(u BETWEEN 0 AND 1),
  v REAL NOT NULL CHECK(v BETWEEN 0 AND 1), body TEXT NOT NULL, visibility TEXT CHECK(visibility IN ('private','public')),
  revision INTEGER NOT NULL CHECK(revision>=0), updatedAt TEXT NOT NULL`;
export async function migrate(tx: Connection) {
  const version = (await tx.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version;
  if (version === 1) return;
  if (version !== 0) throw new Error('Unsupported database version');
  await tx.execAsync(`CREATE TABLE drafts(${table});
    CREATE TABLE notes(${table}, createdAt TEXT NOT NULL, CHECK(visibility IS 'private'));
    CREATE INDEX notes_scene ON notes(sceneId,createdAt DESC,id DESC);
    PRAGMA user_version=1;`);
}
export function createStore(transaction: Transaction, newId: () => string, now = () => new Date().toISOString()) {
  let tail = Promise.resolve();
  function transact<T>(work: (tx: Connection) => Promise<T>): Promise<T> {
    const result = tail.then(async () => {
      let value!: T;
      await transaction(async tx => { value = await work(tx); });
      return value;
    });
    tail = result.then(() => {}, () => {});
    return result;
  }
  const draft = (tx: Connection, id: string) => tx.getFirstAsync<Draft>(`SELECT ${columns} FROM drafts WHERE id=?`, id);
  async function write(tx: Connection, d: Draft) {
    if (!validAnchor(d) || !Number.isSafeInteger(d.revision) || d.revision < 0) throw new Error('Invalid draft');
    const current = await draft(tx, d.id);
    if (!current || current.sceneId !== d.sceneId || d.revision < current.revision) throw new Error('Stale draft');
    if (current.revision === d.revision) {
      if (current.body !== d.body || current.visibility !== d.visibility || current.u !== d.u || current.v !== d.v) throw new Error('Conflicting draft');
      return;
    }
    await tx.runAsync('UPDATE drafts SET u=?,v=?,body=?,visibility=?,revision=?,updatedAt=? WHERE id=?',
      d.u,d.v,d.body,d.visibility,d.revision,now(),d.id);
  }
  const messages: Messages = {
    list: (sceneId, cursor) => transact(async tx => {
      const key: unknown = cursor === null ? null : JSON.parse(cursor);
      if (key !== null && (!Array.isArray(key) || key.length !== 3 || key[0] !== sceneId || typeof key[1] !== 'string' || typeof key[2] !== 'string')) throw new Error('Invalid cursor');
      const args = Array.isArray(key) ? [sceneId,key[1],key[2]] : [sceneId];
      const rows = await tx.getAllAsync<Pick<Draft,'id'|'sceneId'|'u'|'v'> & {createdAt:string}>(`SELECT id,sceneId,u,v,createdAt FROM notes WHERE sceneId=? ${args.length === 3 ? 'AND (createdAt,id)<(?,?)' : ''} ORDER BY createdAt DESC,id DESC LIMIT 61`, ...args);
      const last = rows[59];
      return { items: rows.slice(0,60).map(({ u,v,...r }) => ({ ...r,anchor:{u,v} })), nextCursor: rows.length > 60 ? JSON.stringify([sceneId,last.createdAt,last.id]) : null };
    }),
    read: (sceneId,id) => transact(async tx => {
      const r = await tx.getFirstAsync<Draft & {createdAt:string}>('SELECT * FROM notes WHERE sceneId=? AND id=?',sceneId,id);
      return r ? { kind:'found' as const, message:{id:r.id,sceneId,createdAt:r.createdAt,anchor:{u:r.u,v:r.v},body:r.body} } : { kind:'unavailable' as const };
    }),
  };
  return {
    messages,
    getDraft: (id: string, sceneId: string) => transact(tx => tx.getFirstAsync<Draft>(`SELECT ${columns} FROM drafts WHERE id=? AND sceneId=?`,id,sceneId)),
    createDraft: (sceneId: string, a: Anchor) => transact(async tx => {
      if (!sceneId || !validAnchor(a)) throw new Error('Invalid position');
      const id = newId();
      await tx.runAsync(`INSERT INTO drafts(${columns}) VALUES(?,?,?,?,?,NULL,0,?)`,id,sceneId,a.u,a.v,'',now());
      return (await draft(tx,id))!;
    }),
    edit: (id: string) => transact(async tx => {
      await tx.runAsync(`INSERT OR IGNORE INTO drafts(${columns}) SELECT ${columns} FROM notes WHERE id=?`, id);
      return draft(tx,id);
    }),
    saveDraft: (d: Draft) => transact(tx => write(tx,d)),
    savePrivate: (d: Draft) => transact(async tx => {
      if (d.visibility !== 'private' || validateBody(d.body)) throw new Error('Invalid note');
      if (!(await draft(tx,d.id))) {
        const n = await tx.getFirstAsync<Draft>('SELECT * FROM notes WHERE id=?',d.id);
        if (n && n.revision === d.revision && n.body === d.body && n.sceneId === d.sceneId && n.u === d.u && n.v === d.v) return;
        throw new Error('Missing draft');
      }
      await write(tx,d);
      await tx.runAsync(`INSERT INTO notes(${columns},createdAt) SELECT ${columns},? FROM drafts WHERE id=?
        ON CONFLICT(id) DO UPDATE SET body=excluded.body,u=excluded.u,v=excluded.v,revision=excluded.revision,updatedAt=excluded.updatedAt`,now(),d.id);
      await tx.runAsync('DELETE FROM drafts WHERE id=?',d.id);
    }),
    list: () => transact(tx => tx.getAllAsync<LocalItem>(`SELECT ${columns},'draft' AS kind FROM drafts UNION ALL
      SELECT ${columns},'note' AS kind FROM notes WHERE id NOT IN (SELECT id FROM drafts) ORDER BY updatedAt DESC,id DESC`)),
    discardDraft: (id: string) => transact(tx => tx.runAsync('DELETE FROM drafts WHERE id=?',id)),
    deleteNote: (id: string) => transact(async tx => {
      await tx.runAsync('DELETE FROM drafts WHERE id=?',id);
      await tx.runAsync('DELETE FROM notes WHERE id=?',id);
    }),
  };
}
