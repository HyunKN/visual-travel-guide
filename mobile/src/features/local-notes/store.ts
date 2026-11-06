import { validAnchor, validateBody, type Anchor, type Messages } from '../place-messages/contract';
import type { PublicationJob, PublicationState, WritePayload } from '../public-messages/publication';
import type {Inspection} from '../public-messages/recovery';
import type {Boundary} from '../public-messages/sceneMessages';

export type Visibility = 'private' | 'public' | null;
export type Draft = { id: string; sceneId: string; u: number; v: number; body: string; visibility: Visibility; revision: number; updatedAt: string };
export type LocalItem = Draft & { kind: 'draft' | 'note'; publicationState?:PublicationState|null };
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
  if (version === 3) return;
  if (version !== 0 && version !== 1 && version !== 2) throw new Error('Unsupported database version');
  if (version === 0) await tx.execAsync(`CREATE TABLE drafts(${table});
    CREATE TABLE notes(${table}, createdAt TEXT NOT NULL, CHECK(visibility IS 'private'));
    CREATE INDEX notes_scene ON notes(sceneId,createdAt DESC,id DESC);
    PRAGMA user_version=1;`);
  if(version!==2) await tx.execAsync(`CREATE TABLE publication_jobs(
    noteId TEXT PRIMARY KEY NOT NULL, requestId TEXT NOT NULL UNIQUE,
    ownerId TEXT NOT NULL, serviceId TEXT NOT NULL, submittedRevision INTEGER NOT NULL, payload TEXT NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('pending','uncertain','published','withdrawn','conflict','rejected')),
    serverVersion INTEGER, updatedAt TEXT NOT NULL);
    PRAGMA user_version=2;`);
  await tx.execAsync(`ALTER TABLE publication_jobs ADD COLUMN stateSource TEXT NOT NULL DEFAULT 'request'
    CHECK(stateSource IN ('request','observation')); PRAGMA user_version=3;`);
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
  async function protectPublication(tx: Connection, id: string) {
    const job = await tx.getFirstAsync<{ state: PublicationState; serverVersion:number|null }>('SELECT state,serverVersion FROM publication_jobs WHERE noteId=?',id);
    if (job && job.state!=='withdrawn' && !(job.state==='rejected' && job.serverVersion===null)) throw new Error('Publication must be resolved or withdrawn first');
  }
  const job = async (tx: Connection,id:string):Promise<PublicationJob|null> => {
    const row=await tx.getFirstAsync<Omit<PublicationJob,'payload'> & {payload:string}>('SELECT * FROM publication_jobs WHERE noteId=?',id);
    return row ? {...row,payload:JSON.parse(row.payload)} : null;
  };
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
  async function savePrivate(tx:Connection,d:Draft) {
    await protectPublication(tx,d.id);
    if(d.visibility!=='private'||validateBody(d.body))throw new Error('Invalid note');
    if(!(await draft(tx,d.id))){
      const n=await tx.getFirstAsync<Draft>('SELECT * FROM notes WHERE id=?',d.id);
      if(n&&n.revision===d.revision&&n.body===d.body&&n.sceneId===d.sceneId&&n.u===d.u&&n.v===d.v)return;
      throw new Error('Missing draft');
    }
    await write(tx,d);
    await tx.runAsync(`INSERT INTO notes(${columns},createdAt) SELECT ${columns},? FROM drafts WHERE id=?
      ON CONFLICT(id) DO UPDATE SET body=excluded.body,u=excluded.u,v=excluded.v,revision=excluded.revision,updatedAt=excluded.updatedAt`,now(),d.id);
    await tx.runAsync('DELETE FROM drafts WHERE id=?',d.id);
  }
  async function pending(tx:Connection,d:Draft,ownerId:string,serviceId:string,payload:WritePayload,revision:number,version:number|null) {
    await tx.runAsync(`INSERT INTO publication_jobs(noteId,requestId,ownerId,serviceId,submittedRevision,payload,state,serverVersion,updatedAt,stateSource)
      VALUES(?,?,?,?,?,?,'pending',?,?,'request') ON CONFLICT(noteId) DO UPDATE SET requestId=excluded.requestId,
      submittedRevision=excluded.submittedRevision,payload=excluded.payload,state='pending',serverVersion=excluded.serverVersion,
      updatedAt=excluded.updatedAt,stateSource='request'`,d.id,newId(),ownerId,serviceId,revision,JSON.stringify(payload),version,now());
    return (await job(tx,d.id))!;
  }
  async function conflict(tx:Connection,d:Draft,ownerId:string,serviceId:string,inspection:Inspection) {
    const previous=await job(tx,d.id),state=inspection.state;
    if(!previous||previous.state!=='conflict'||previous.requestId!==inspection.requestId||previous.ownerId!==ownerId||previous.serviceId!==serviceId||
      inspection.noteId!==d.id||state.id!==d.id||state.sceneId!==d.sceneId||previous.payload.p_scene!==d.sceneId||
      (state.kind==='found'&&(!Number.isSafeInteger(state.version)||state.version<1||!validAnchor(state))))throw new Error('Stale conflict inspection');
    return previous;
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
    privateMarkers: (sceneId:string,b:Boundary) => transact(async tx=>{
      const time="substr(createdAt,1,23)||'000Z'";
      const rows=await tx.getAllAsync<{id:string;sceneId:string;u:number;v:number;createdAt:string}>(`SELECT id,sceneId,u,v,createdAt FROM notes
        WHERE sceneId=? AND (${time})<=? AND (? IS NULL OR ((${time}),id)<(?,?))
        AND NOT EXISTS(SELECT 1 FROM publication_jobs j WHERE j.noteId=notes.id AND
          (j.state IN ('pending','uncertain','published','conflict') OR (j.state='rejected' AND j.serverVersion IS NOT NULL)))
        ORDER BY createdAt DESC,id DESC LIMIT 61`,sceneId,b.snapshot,b.before,b.before,b.id);
      return rows.map(({u,v,...r})=>({...r,anchor:{u,v}}));
    }),
    privateRead: (sceneId:string,id:string) => transact(async tx=>{
      const r=await tx.getFirstAsync<Draft & {createdAt:string}>(`SELECT * FROM notes WHERE sceneId=? AND id=?
        AND NOT EXISTS(SELECT 1 FROM publication_jobs j WHERE j.noteId=notes.id AND
          (j.state IN ('pending','uncertain','published','conflict') OR (j.state='rejected' AND j.serverVersion IS NOT NULL)))`,sceneId,id);
      return r?{kind:'found' as const,message:{id:r.id,sceneId,createdAt:r.createdAt,anchor:{u:r.u,v:r.v},body:r.body}}:{kind:'unavailable' as const};
    }),
    publicationOwner: (serviceId:string) => transact(async tx=>{
      const rows=await tx.getAllAsync<{ownerId:string}>('SELECT DISTINCT ownerId FROM publication_jobs WHERE serviceId=?',serviceId);
      if(rows.length>1)throw new Error('Multiple author bindings');
      return rows[0]?.ownerId??null;
    }),
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
    savePrivate: (d: Draft) => transact(tx => savePrivate(tx,d)),
    list: () => transact(tx => tx.getAllAsync<LocalItem>(`SELECT local.*,
      (SELECT state FROM publication_jobs WHERE noteId=local.id) AS publicationState FROM (
      SELECT ${columns},'draft' AS kind FROM drafts UNION ALL
      SELECT ${columns},'note' AS kind FROM notes WHERE id NOT IN (SELECT id FROM drafts)
      ) AS local ORDER BY updatedAt DESC,id DESC`)),
    discardDraft: (id: string) => transact(async tx => {
      await protectPublication(tx,id);
      return tx.runAsync('DELETE FROM drafts WHERE id=?',id);
    }),
    deleteNote: (id: string) => transact(async tx => {
      await protectPublication(tx,id);
      await tx.runAsync('DELETE FROM drafts WHERE id=?',id);
      await tx.runAsync('DELETE FROM notes WHERE id=?',id);
    }),
    getPublication: (id:string) => transact(tx=>job(tx,id)),
    preparePublication: (d:Draft,ownerId:string,serviceId:string,withdraw=false) => transact(async tx=>{
      if(!ownerId || !serviceId) throw new Error('Missing author or service');
      const previous=await job(tx,d.id);
      if(previous && (previous.ownerId!==ownerId || previous.serviceId!==serviceId)) throw new Error('Publication belongs to another session or service');
      if(previous && ['pending','uncertain','conflict'].includes(previous.state)) throw new Error('Resolve previous request first');
      if(withdraw) {
        if(!previous?.serverVersion || !['published','rejected'].includes(previous.state)) throw new Error('No confirmed publication');
      } else {
        if(d.visibility!=='public' || validateBody(d.body)) throw new Error('Public consent and valid body required');
        await write(tx,d);
      }
      const payload=withdraw ? {...previous!.payload,p_expected:previous!.serverVersion!,p_withdraw:true,p_body:null} : {
        p_id:d.id,p_expected:previous?.serverVersion??0,p_scene:d.sceneId,p_u:d.u,p_v:d.v,p_body:d.body,p_withdraw:false,
      };
      return pending(tx,d,ownerId,serviceId,payload,withdraw?previous!.submittedRevision:d.revision,previous?.serverVersion??null);
    }),
    prepareConflictPublication: (d:Draft,ownerId:string,serviceId:string,inspection:Inspection,withdraw:boolean) => transact(async tx=>{
      const previous=await conflict(tx,d,ownerId,serviceId,inspection),state=inspection.state;
      if(withdraw){if(state.kind!=='found'||!state.visible)throw new Error('No visible publication');}
      else if(d.visibility!=='public'||validateBody(d.body)||(state.kind==='found'&&state.hidden))throw new Error('Public consent required');
      await write(tx,d);
      const version=state.kind==='found'?state.version:null;
      const anchor=withdraw&&state.kind==='found'?state:d;
      return pending(tx,d,ownerId,serviceId,{
        p_id:d.id,p_expected:version??0,p_scene:d.sceneId,p_u:anchor.u,p_v:anchor.v,p_body:withdraw?null:d.body,p_withdraw:withdraw,
      },withdraw?previous.submittedRevision:d.revision,version);
    }),
    saveConflictPrivate: (d:Draft,ownerId:string,serviceId:string,inspection:Inspection) => transact(async tx=>{
      await conflict(tx,d,ownerId,serviceId,inspection);
      const state=inspection.state;
      if(state.kind==='found'&&state.visible)throw new Error('Withdraw publication first');
      // This is an observation of current absence, never a receipt for the failed request.
      await tx.runAsync("UPDATE publication_jobs SET state='withdrawn',stateSource='observation',serverVersion=?,updatedAt=? WHERE noteId=?",
        state.kind==='found'?state.version:null,now(),d.id);
      await savePrivate(tx,d);
    }),
    settlePublication: (id:string,requestId:string,state:PublicationState,version:number|null=null) => transact(async tx=>{
      const current=await job(tx,id);
      if(!current || current.requestId!==requestId) throw new Error('Superseded publication');
      if(!['pending','uncertain'].includes(current.state)) throw new Error('Publication already settled');
      if(state==='pending') throw new Error('Cannot reset a sent request');
      if(state==='published' || state==='withdrawn') {
        if(version!==current.payload.p_expected+1 || (state==='withdrawn')!==current.payload.p_withdraw) throw new Error('Invalid server confirmation');
      } else if(version!==null) throw new Error('Unexpected version');
      await tx.runAsync('UPDATE publication_jobs SET state=?,serverVersion=?,updatedAt=? WHERE noteId=? AND requestId=?',
        state,version??current.serverVersion,now(),id,requestId);
    }),
  };
}
