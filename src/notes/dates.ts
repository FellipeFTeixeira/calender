export function timeOf(t: number): string {
  return new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function longDate(t: number): string {
  const d = new Date(t);
  const date = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  return `Editada em ${date} às ${timeOf(t)}`;
}
