import { useState } from 'react';
import type { Note } from '../db';
import { timeOf } from '../dates';
import { IconCompose, IconPinFilled } from '../icons';
import { ContextMenu, type MenuItem } from './ContextMenu';

interface Props {
  notes: Note[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onPin: (id: string, pinned: boolean) => void;
  onTrash: (id: string) => void;
}

function titleFor(n: Note) {
  return n.title || 'Nova Nota';
}

function previewFor(n: Note) {
  const body = n.text.slice(n.title.length).replace(/\s+/g, ' ').trim();
  if (body) return body;
  return n.html.includes('<img') ? 'Imagem' : 'Sem texto adicional';
}

export function NoteList(p: Props) {
  const [menu, setMenu] = useState<{ x: number; y: number; note: Note } | null>(null);

  const pinned = p.notes.filter((n) => n.pinned);
  const others = p.notes.filter((n) => !n.pinned);
  const groups = [
    { name: 'Fixadas', notes: pinned },
    { name: pinned.length ? 'Notas' : '', notes: others },
  ].filter((g) => g.notes.length > 0);

  const menuItems: MenuItem[] = menu
    ? [
        { label: menu.note.pinned ? 'Desafixar Nota' : 'Fixar Nota', onClick: () => p.onPin(menu.note.id, !menu.note.pinned) },
        { separator: true, label: '' },
        { label: 'Apagar', danger: true, onClick: () => p.onTrash(menu.note.id) },
      ]
    : [];

  const count = p.notes.length;

  return (
    <section className="notelist">
      <div className="list-head">
        <span className="list-title">
          {count} {count === 1 ? 'nota' : 'notas'}
        </span>
        <button className="n-btn accent" onClick={p.onNew} title="Nova nota (Ctrl+N)">
          <IconCompose />
        </button>
      </div>
      <div className="list-scroll">
        {groups.length === 0 && <div className="list-empty">Sem notas neste dia</div>}
        {groups.map((g) => (
          <div key={g.name || 'all'} className="list-group">
            {g.name && <div className="group-name">{g.name}</div>}
            {g.notes.map((n) => (
              <div
                key={n.id}
                className={`note-row${n.id === p.selectedId ? ' active' : ''}`}
                onClick={() => p.onSelect(n.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  p.onSelect(n.id);
                  setMenu({ x: e.clientX, y: e.clientY, note: n });
                }}
              >
                <div className="note-row-title">
                  {n.pinned && <IconPinFilled className="row-pin" width={12} height={12} />}
                  <span>{titleFor(n)}</span>
                </div>
                <div className="note-row-sub">
                  <span className="note-row-date">{timeOf(n.updatedAt)}</span>
                  <span className="note-row-preview">{previewFor(n)}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />}
    </section>
  );
}
