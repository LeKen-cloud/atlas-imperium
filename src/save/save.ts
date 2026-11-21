// Save system: IndexedDB (large worlds), with export/import as JSON files for sharing scenarios.
import type { WorldState } from '../sim/types';

const DB = 'atlas-imperium'; const STORE = 'saves';
export interface SaveMeta { id: string; name: string; date: string; t: number; player: string | null; scenario: string; size: number }

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('no indexedDB'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(STORE); r.result.createObjectStore('meta'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode); const s = t.objectStore(store); const req = fn(s);
    t.oncomplete = () => res(req ? (req as IDBRequest<T>).result : undefined); t.onerror = () => rej(t.error);
  });
}

export async function listSaves(): Promise<SaveMeta[]> {
  try { const all = (await tx<SaveMeta[]>('meta', 'readonly', (s) => s.getAll() as IDBRequest<SaveMeta[]>)) || []; return all.sort((a, b) => b.date.localeCompare(a.date)); } catch { return []; }
}
export async function saveGame(w: WorldState, name: string, id = 'save-' + Date.now()): Promise<SaveMeta | null> {
  try {
    const data = JSON.stringify(w);
    const meta: SaveMeta = { id, name, date: new Date().toISOString(), t: w.t, player: w.player, scenario: w.scenarioName, size: data.length };
    await tx('saves', 'readwrite', (s) => s.put(data, id)); await tx('meta', 'readwrite', (s) => s.put(meta, id));
    return meta;
  } catch { return null; }
}
export async function loadGame(id: string): Promise<WorldState | null> {
  try { const s = await tx<string>('saves', 'readonly', (st) => st.get(id) as IDBRequest<string>); return s ? validate(JSON.parse(s)) : null; } catch { return null; }
}
export async function deleteSave(id: string) { try { await tx('saves', 'readwrite', (s) => s.delete(id)); await tx('meta', 'readwrite', (s) => s.delete(id)); } catch { /* ignore */ } }
export async function renameSave(id: string, name: string) {
  try { const m = await tx<SaveMeta>('meta', 'readonly', (s) => s.get(id) as IDBRequest<SaveMeta>); if (m) { m.name = name; await tx('meta', 'readwrite', (s) => s.put(m, id)); } } catch { /* ignore */ }
}
// Session recovery: the running game is mirrored here regularly and on page hide.
export const SESSION_ID = '__session__';
export async function storeSession(w: WorldState) { return saveGame(w, 'Session', SESSION_ID); }

export function validate(w: any): WorldState | null {
  if (!w || typeof w !== 'object' || !w.countries || !Array.isArray(w.territories) || typeof w.t !== 'number') return null;
  w.proposals ||= []; w.chats ||= {}; w.turn ||= { n: Math.max(1, (w.t | 0) + 1), orders: [], maxOrders: 3, jump: 1 }; w.reports ||= []; w.log ||= []; w.watchlist ||= []; w.portfolio ||= { cash: 0, holdings: [], history: [] };
  for (const c of Object.values<any>(w.countries)) { if (c.fin && c.fin.fxAnchor === undefined) c.fin.fxAnchor = c.fin.fx; }
  return w as WorldState;
}
export async function exportFile(w: WorldState, name: string) {
  const filename = name.replace(/[^\w.-]+/g, '_') + '.atlas.json'; const data = JSON.stringify(w);
  // Inside the hosted artifact viewer, downloads go through its capability (viewer confirms); elsewhere a normal download.
  try {
    const cl = (window as any).claude;
    if (cl?.use) { const d = await Promise.race([cl.use('downloads'), new Promise((r) => setTimeout(() => r(null), 1500))]); if (d) { await (d as any).save({ filename, data }); return; } }
  } catch { /* fall back */ }
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
export async function importFile(file: File): Promise<WorldState | null> {
  try { return validate(JSON.parse(await file.text())); } catch { return null; }
}
