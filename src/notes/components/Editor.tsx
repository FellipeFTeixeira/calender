import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Placeholder } from '@tiptap/extensions';
import Image from '@tiptap/extension-image';
import { EditorState } from '@tiptap/pm/state';
import { saveImage, type Note } from '../db';
import { longDate } from '../dates';
import { IconCheck, IconImage, IconPin, IconPinFilled, IconRedo, IconTextFormat, IconTrash, IconUndo } from '../icons';
import { FormatMenu } from './FormatMenu';

const IMAGE_MIME = /^image\/(png|jpe?g|gif|webp|bmp|svg\+xml|avif)$/;

function extFor(file: File) {
  const fromName = file.name.match(/\.[a-z0-9]+$/i)?.[0];
  if (fromName) return fromName.toLowerCase();
  const sub = file.type.split('/')[1] ?? 'png';
  return `.${sub === 'jpeg' ? 'jpg' : sub === 'svg+xml' ? 'svg' : sub}`;
}

async function storeFiles(files: FileList | File[]) {
  const urls: string[] = [];
  for (const f of Array.from(files)) {
    if (!IMAGE_MIME.test(f.type)) continue;
    const bytes = new Uint8Array(await f.arrayBuffer());
    urls.push(await saveImage(bytes, extFor(f)));
  }
  return urls;
}

type Patch = { html: string; text: string; title: string };

interface Props {
  note: Note | null;
  onChange: (id: string, patch: Patch) => void;
  onPin: (id: string, pinned: boolean) => void;
  onTrash: (id: string) => void;
}

const EMPTY_DOC = '<p></p>';

export function Editor({ note, onChange, onPin, onTrash }: Props) {
  const noteIdRef = useRef<string | null>(null);
  const timer = useRef<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [fmtOpen, setFmtOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Nova Nota' }),
      Image.configure({ allowBase64: false, HTMLAttributes: { class: 'note-img' } }),
    ],
    content: EMPTY_DOC,
    editorProps: {
      attributes: { class: 'note-body', spellcheck: 'true' },
      handlePaste: (view, event) => {
        const files = event.clipboardData?.files;
        if (!files || files.length === 0) return false;
        if (!Array.from(files).some((f) => IMAGE_MIME.test(f.type))) return false;
        event.preventDefault();
        void storeFiles(files).then((urls) => {
          for (const src of urls) view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.image.create({ src })));
        });
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        if (!Array.from(files).some((f) => IMAGE_MIME.test(f.type))) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.to;
        void storeFiles(files).then((urls) => {
          let tr = view.state.tr;
          let at = pos;
          for (const src of urls) {
            const node = view.state.schema.nodes.image.create({ src });
            tr = tr.insert(at, node);
            at += node.nodeSize;
          }
          view.dispatch(tr);
        });
        return true;
      },
    },
    onUpdate: ({ editor, transaction }) => {
      const id = noteIdRef.current;
      if (!id || !transaction.docChanged) return;
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        const doc = editor.state.doc;
        const first = doc.firstChild;
        const title = (first?.textContent ?? '').trim().slice(0, 120);
        onChangeRef.current(id, { html: editor.getHTML(), text: doc.textBetween(0, doc.content.size, '\n', ' '), title });
      }, 350);
    },
  });

  // Writes any pending (debounced) change of the current note right away.
  const flush = useCallback(() => {
    if (!editor || !timer.current) return;
    window.clearTimeout(timer.current);
    timer.current = null;
    const id = noteIdRef.current;
    if (!id) return;
    const doc = editor.state.doc;
    onChangeRef.current(id, {
      html: editor.getHTML(),
      text: doc.textBetween(0, doc.content.size, '\n', ' '),
      title: (doc.firstChild?.textContent ?? '').trim().slice(0, 120),
    });
  }, [editor]);

  // Never lose the last keystrokes when the notes view closes.
  useEffect(() => flush, [flush]);

  // Reload content when switching notes; flush pending save of previous note first.
  useEffect(() => {
    if (!editor) return;
    flush();
    noteIdRef.current = null;
    editor.commands.setContent(note?.html || EMPTY_DOC, { emitUpdate: false });
    // Fresh plugin state so undo/redo history never leaks across notes.
    editor.view.updateState(EditorState.create({ doc: editor.state.doc, plugins: editor.state.plugins }));
    noteIdRef.current = note?.id ?? null;
    editor.setEditable(!!note);
    if (note) editor.commands.focus(note.text ? 'start' : 'end');
    setFmtOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, note?.id]);

  const toggleFmt = useCallback(() => setFmtOpen((v) => !v), []);
  const closeFmt = useCallback(() => setFmtOpen(false), []);

  const onPickFiles = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!editor || !files || files.length === 0) return;
      const urls = await storeFiles(files);
      e.target.value = '';
      if (urls.length === 0) return;
      let chain = editor.chain().focus();
      for (const src of urls) chain = chain.setImage({ src });
      chain.run();
    },
    [editor],
  );

  // Re-render toolbar state on selection / history changes.
  const hist = useEditorState({
    editor,
    selector: (s) => ({
      sel: s.editor?.state.selection.from ?? 0,
      canUndo: s.editor?.can().undo() ?? false,
      canRedo: s.editor?.can().redo() ?? false,
    }),
    equalityFn: (a, b) => !!a && !!b && a.sel === b.sel && a.canUndo === b.canUndo && a.canRedo === b.canRedo,
  });

  if (!note) {
    return (
      <section className="editor">
        <div className="editor-head" />
        <div className="editor-empty">Nenhuma Nota Selecionada</div>
      </section>
    );
  }

  return (
    <section className="editor">
      <div className="editor-head">
        <div className="toolbar">
          <button
            className="tb-btn"
            disabled={!hist?.canUndo}
            onClick={() => editor?.chain().focus().undo().run()}
            onMouseDown={(e) => e.preventDefault()}
            title="Desfazer (Ctrl+Z)"
          >
            <IconUndo />
          </button>
          <button
            className="tb-btn"
            disabled={!hist?.canRedo}
            onClick={() => editor?.chain().focus().redo().run()}
            onMouseDown={(e) => e.preventDefault()}
            title="Refazer (Ctrl+Y ou Ctrl+Shift+Z)"
          >
            <IconRedo />
          </button>
          <span className="tb-gap" />
          <button
            className={`tb-btn fmt-trigger${fmtOpen ? ' active' : ''}`}
            onClick={toggleFmt}
            title="Formato"
            onMouseDown={(e) => e.preventDefault()}
          >
            <IconTextFormat />
          </button>
          <button
            className={`tb-btn${editor?.isActive('taskList') ? ' active' : ''}`}
            onClick={() => editor?.chain().focus().toggleTaskList().run()}
            onMouseDown={(e) => e.preventDefault()}
            title="Lista de verificação (Ctrl+Shift+9)"
          >
            <IconCheck />
          </button>
          <button className="tb-btn" onClick={() => fileInput.current?.click()} title="Anexar imagem (ou cole / arraste uma imagem)">
            <IconImage />
          </button>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={onPickFiles} />
          <span className="tb-gap" />
          <button
            className={`tb-btn${note.pinned ? ' active' : ''}`}
            onClick={() => onPin(note.id, !note.pinned)}
            title={note.pinned ? 'Desafixar' : 'Fixar'}
          >
            {note.pinned ? <IconPinFilled /> : <IconPin />}
          </button>
          <button className="tb-btn danger" onClick={() => onTrash(note.id)} title="Apagar nota">
            <IconTrash />
          </button>
          {fmtOpen && editor && <FormatMenu editor={editor} onClose={closeFmt} />}
        </div>
      </div>
      <div className="editor-scroll" onClick={() => editor?.commands.focus()}>
        <div className="editor-page">
          <div className="note-date">{longDate(note.updatedAt)}</div>
          <EditorContent editor={editor} />
        </div>
      </div>
    </section>
  );
}
