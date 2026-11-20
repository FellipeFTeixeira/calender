import { useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';

interface Props {
  editor: Editor;
  onClose: () => void;
}

export function FormatMenu({ editor, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!ref.current?.contains(t) && !t.closest('.fmt-trigger')) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('mousedown', down);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('mousedown', down);
      window.removeEventListener('keydown', key);
    };
  }, [onClose]);

  const c = editor.chain().focus();
  const styles = [
    { label: 'Título', cls: 'fmt-title', active: editor.isActive('heading', { level: 1 }), run: () => c.toggleHeading({ level: 1 }).run() },
    { label: 'Cabeçalho', cls: 'fmt-h2', active: editor.isActive('heading', { level: 2 }), run: () => c.toggleHeading({ level: 2 }).run() },
    { label: 'Subcabeçalho', cls: 'fmt-h3', active: editor.isActive('heading', { level: 3 }), run: () => c.toggleHeading({ level: 3 }).run() },
    { label: 'Corpo', cls: 'fmt-body', active: editor.isActive('paragraph') && !editor.isActive('codeBlock'), run: () => c.setParagraph().run() },
    { label: 'Monoespaçado', cls: 'fmt-mono', active: editor.isActive('codeBlock'), run: () => c.toggleCodeBlock().run() },
  ];

  const marks = [
    { label: 'B', cls: 'b', active: editor.isActive('bold'), run: () => c.toggleBold().run(), title: 'Negrito (Ctrl+B)' },
    { label: 'I', cls: 'i', active: editor.isActive('italic'), run: () => c.toggleItalic().run(), title: 'Itálico (Ctrl+I)' },
    { label: 'U', cls: 'u', active: editor.isActive('underline'), run: () => c.toggleUnderline().run(), title: 'Sublinhado (Ctrl+U)' },
    { label: 'S', cls: 's', active: editor.isActive('strike'), run: () => c.toggleStrike().run(), title: 'Tachado' },
  ];

  const lists = [
    { label: '• Lista', active: editor.isActive('bulletList'), run: () => c.toggleBulletList().run() },
    { label: '1. Lista', active: editor.isActive('orderedList'), run: () => c.toggleOrderedList().run() },
    { label: '☑ Lista', active: editor.isActive('taskList'), run: () => c.toggleTaskList().run() },
    { label: '❝ Citação', active: editor.isActive('blockquote'), run: () => c.toggleBlockquote().run() },
  ];

  return (
    <div className="fmt-menu" ref={ref} onMouseDown={(e) => e.preventDefault()}>
      <div className="fmt-head">Formato</div>
      {styles.map((s) => (
        <button key={s.label} className={`fmt-row ${s.cls}${s.active ? ' active' : ''}`} onClick={s.run}>
          <span>{s.label}</span>
          {s.active && <span className="fmt-check">✓</span>}
        </button>
      ))}
      <div className="fmt-sep" />
      <div className="fmt-marks">
        {marks.map((m) => (
          <button key={m.label} className={`fmt-mark ${m.cls}${m.active ? ' active' : ''}`} onClick={m.run} title={m.title}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="fmt-sep" />
      <div className="fmt-lists">
        {lists.map((l) => (
          <button key={l.label} className={`fmt-list${l.active ? ' active' : ''}`} onClick={l.run}>
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
