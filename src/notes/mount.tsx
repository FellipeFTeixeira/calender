import { createRoot, type Root } from 'react-dom/client';
import { DayNotes } from './DayNotes';
import './notes.css';

let root: Root | null = null;

export function showNotes(el: HTMLElement, date: string) {
  root ??= createRoot(el);
  root.render(<DayNotes key={date} date={date} />);
}

export function hideNotes() {
  root?.render(null);
}
