import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  createNote,
  deleteNote,
  getNote,
  getVersion,
  isBlank,
  loadNotes,
  notesOn,
  patchNote,
  subscribe,
  upsertNote,
  type Note,
} from './db';
import { NoteList } from './components/NoteList';
import { Editor } from './components/Editor';

const UNDO_MS = 6000;

// Removes a note left empty. Deferred so the editor can flush its last
// debounced change first (React runs parent cleanups before children's).
function dropIfBlank(id: string) {
  window.setTimeout(() => {
    const n = getNote(id);
    if (n && isBlank(n)) deleteNote(id);
  }, 0);
}

export function DayNotes({ date }: { date: string }) {
  useSyncExternalStore(subscribe, getVersion);
  const list = notesOn(date);

  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [undo, setUndo] = useState<Note | null>(null);
  const undoTimer = useRef<number | null>(null);

  // Open the day: select its first note, or start a new one if it has none.
  useEffect(() => {
    let alive = true;
    void loadNotes().then(() => {
      if (!alive) return;
      const existing = notesOn(date);
      setSelectedId(existing.length ? existing[0].id : createNote(date).id);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [date]);

  // Clean up empty notes when moving away from them or closing the day.
  const selRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = selRef.current;
    selRef.current = selectedId;
    if (prev && prev !== selectedId) dropIfBlank(prev);
  }, [selectedId]);
  useEffect(
    () => () => {
      if (selRef.current) dropIfBlank(selRef.current);
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
    },
    [],
  );

  // Keep a valid selection when the selected note disappears.
  useEffect(() => {
    if (!ready) return;
    if (selectedId && list.some((n) => n.id === selectedId)) return;
    setSelectedId(list[0]?.id ?? null);
  }, [ready, list, selectedId]);

  const selected = list.find((n) => n.id === selectedId) ?? null;

  const newNote = useCallback(() => {
    const cur = selRef.current ? getNote(selRef.current) : null;
    if (cur && isBlank(cur)) {
      (document.querySelector('.notes-root .note-body') as HTMLElement | null)?.focus();
      return;
    }
    setSelectedId(createNote(date).id);
  }, [date]);

  const trash = useCallback((id: string) => {
    const n = getNote(id);
    if (!n) return;
    deleteNote(id);
    if (isBlank(n)) return;
    setUndo(n);
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndo(null), UNDO_MS);
  }, []);

  const restore = useCallback(() => {
    if (!undo) return;
    upsertNote(undo);
    setSelectedId(undo.id);
    setUndo(null);
  }, [undo]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        newNote();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [newNote]);

  const onChange = useCallback(
    (id: string, patch: { html: string; text: string; title: string }) => patchNote(id, patch),
    [],
  );
  const onPin = useCallback((id: string, pinned: boolean) => patchNote(id, { pinned }, false), []);

  return (
    <div className="notes-app">
      <NoteList notes={list} selectedId={selectedId} onSelect={setSelectedId} onNew={newNote} onPin={onPin} onTrash={trash} />
      <Editor note={selected} onChange={onChange} onPin={onPin} onTrash={trash} />
      {undo && (
        <div className="undo-toast" role="status">
          <span>Nota apagada</span>
          <button onClick={restore}>Desfazer</button>
        </div>
      )}
    </div>
  );
}
