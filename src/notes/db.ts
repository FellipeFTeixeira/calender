// Notes store shared by the calendar (day markers) and the notes UI.
// Kept outside React so the calendar can read it without loading the editor.

export interface Note {
  id: string;
  /** Day the note belongs to, 'YYYY-MM-DD'. */
  date: string;
  title: string;
  html: string;
  text: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
}

/* ---------------- Backend (Tauri, or localStorage when running in a browser) ---------------- */

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const MOCK_KEY = 'calendario-notes-dev';

async function invoke<T>(cmd: string, args?: unknown, headers?: Record<string, string>): Promise<T> {
  const core = await import('@tauri-apps/api/core');
  return core.invoke<T>(cmd, args as never, headers ? { headers } : undefined);
}

function mockRead(): Note[] {
  try {
    return JSON.parse(localStorage.getItem(MOCK_KEY) ?? '[]');
  } catch {
    return [];
  }
}
function mockWrite(list: Note[]) {
  try {
    localStorage.setItem(MOCK_KEY, JSON.stringify(list));
  } catch {}
}

const api = {
  load: (): Promise<Note[]> => (isTauri ? invoke<Note[]>('notes_load') : Promise.resolve(mockRead())),
  save: (note: Note): Promise<void> => {
    if (isTauri) return invoke('notes_save', { note });
    mockWrite([...mockRead().filter((n) => n.id !== note.id), note]);
    return Promise.resolve();
  },
  remove: (id: string): Promise<void> => {
    if (isTauri) return invoke('notes_delete', { id });
    mockWrite(mockRead().filter((n) => n.id !== id));
    return Promise.resolve();
  },
  saveImage: (bytes: Uint8Array, ext: string): Promise<string> => {
    if (isTauri) return invoke<string>('image_save', bytes, { 'x-ext': ext });
    return Promise.resolve(URL.createObjectURL(new Blob([bytes as BlobPart])));
  },
};

export const saveImage = api.saveImage;

/* ---------------- Store ---------------- */

const notes = new Map<string, Note>();
const listeners = new Set<() => void>();
let version = 0;
let loading: Promise<void> | null = null;

function emit() {
  version++;
  for (const fn of listeners) fn();
}

function report(e: unknown) {
  console.error('[notas]', e);
}

export function loadNotes(): Promise<void> {
  if (!loading) {
    loading = api
      .load()
      .then((list) => {
        for (const n of list) {
          if (!n?.id || !n.date) continue;
          notes.set(n.id, { ...n, pinned: n.pinned ?? false });
        }
        emit();
      })
      .catch(report);
  }
  return loading;
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getVersion = () => version;

export function isBlank(n: Note) {
  return !n.text.trim() && !n.html.includes('<img');
}

/** Notes of one day: pinned first, then most recently edited. */
export function notesOn(date: string): Note[] {
  const list: Note[] = [];
  for (const n of notes.values()) if (n.date === date) list.push(n);
  return list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
}

/** Non-empty notes grouped by day, for the calendar markers. */
export function notesByDate(): Map<string, Note[]> {
  const out = new Map<string, Note[]>();
  for (const n of notes.values()) {
    if (isBlank(n)) continue;
    const list = out.get(n.date);
    if (list) list.push(n);
    else out.set(n.date, [n]);
  }
  for (const list of out.values()) {
    list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.createdAt - b.createdAt);
  }
  return out;
}

export function getNote(id: string) {
  return notes.get(id) ?? null;
}

export function upsertNote(note: Note) {
  notes.set(note.id, note);
  emit();
  api.save(note).catch(report);
}

export function patchNote(id: string, patch: Partial<Note>, touch = true) {
  const cur = notes.get(id);
  if (!cur) return;
  upsertNote({ ...cur, ...patch, updatedAt: touch ? Date.now() : cur.updatedAt });
}

export function createNote(date: string): Note {
  const now = Date.now();
  const note: Note = {
    id: crypto.randomUUID(),
    date,
    title: '',
    html: '',
    text: '',
    createdAt: now,
    updatedAt: now,
    pinned: false,
  };
  upsertNote(note);
  return note;
}

export function deleteNote(id: string) {
  if (!notes.delete(id)) return;
  emit();
  api.remove(id).catch(report);
}
