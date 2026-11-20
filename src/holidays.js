// Brazilian national holidays (fixed + Easter-based), computed per year.

const WIKI = 'https://pt.wikipedia.org/wiki/';

export const HOLIDAY_TYPES = {
  feriado: 'Feriado nacional',
  facultativo: 'Ponto facultativo',
  comemorativa: 'Data comemorativa',
};

// month is 1-based here for readability.
const FIXED = [
  { m: 1, d: 1, short: 'Ano-Novo', name: 'Confraternização Universal', type: 'feriado', wiki: 'Ano-novo' },
  { m: 4, d: 21, short: 'Tiradentes', name: 'Tiradentes', type: 'feriado', wiki: 'Dia_da_Inconfidência' },
  { m: 5, d: 1, short: 'Dia do Trabalho', name: 'Dia do Trabalhador', type: 'feriado', wiki: 'Dia_Internacional_dos_Trabalhadores' },
  { m: 9, d: 7, short: 'Independência', name: 'Independência do Brasil', type: 'feriado', wiki: 'Independência_do_Brasil' },
  { m: 10, d: 12, short: 'N. Sra. Aparecida', name: 'Nossa Senhora Aparecida', type: 'feriado', wiki: 'Nossa_Senhora_Aparecida' },
  { m: 11, d: 2, short: 'Finados', name: 'Finados', type: 'feriado', wiki: 'Dia_dos_Fiéis_Defuntos' },
  { m: 11, d: 15, short: 'Proclamação da República', name: 'Proclamação da República', type: 'feriado', wiki: 'Proclamação_da_República_do_Brasil' },
  // National holiday since 2024 (Lei 14.759/2023).
  { m: 11, d: 20, short: 'Consciência Negra', name: 'Dia Nacional de Zumbi e da Consciência Negra', type: 'feriado', wiki: 'Dia_Nacional_de_Zumbi_e_da_Consciência_Negra', from: 2024 },
  { m: 12, d: 25, short: 'Natal', name: 'Natal', type: 'feriado', wiki: 'Natal' },
];

// Offsets in days from Easter Sunday.
const MOVABLE = [
  { off: -48, short: 'Carnaval', name: 'Carnaval (segunda-feira)', type: 'facultativo', wiki: 'Carnaval_do_Brasil' },
  { off: -47, short: 'Carnaval', name: 'Carnaval (terça-feira)', type: 'facultativo', wiki: 'Carnaval_do_Brasil' },
  { off: -46, short: 'Cinzas', name: 'Quarta-feira de Cinzas (até as 14h)', type: 'facultativo', wiki: 'Quarta-feira_de_Cinzas' },
  { off: -2, short: 'Sexta-feira Santa', name: 'Sexta-feira Santa (Paixão de Cristo)', type: 'feriado', wiki: 'Sexta-feira_Santa' },
  { off: 0, short: 'Páscoa', name: 'Páscoa', type: 'comemorativa', wiki: 'Páscoa' },
  { off: 60, short: 'Corpus Christi', name: 'Corpus Christi', type: 'facultativo', wiki: 'Corpus_Christi' },
];

// Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
function easter(y) {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}

export function dateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const cache = new Map();

/** Map of 'YYYY-MM-DD' -> { short, name, type, typeLabel, url } for the year. */
export function holidaysFor(y) {
  let map = cache.get(y);
  if (map) return map;
  map = new Map();
  const add = (date, h) => {
    map.set(dateKey(date.getFullYear(), date.getMonth(), date.getDate()), {
      short: h.short,
      name: h.name,
      type: h.type,
      typeLabel: HOLIDAY_TYPES[h.type],
      url: WIKI + encodeURI(h.wiki),
    });
  };
  for (const h of FIXED) {
    if (h.from && y < h.from) continue;
    add(new Date(y, h.m - 1, h.d), h);
  }
  const e = easter(y);
  for (const h of MOVABLE) {
    add(new Date(e.getFullYear(), e.getMonth(), e.getDate() + h.off), h);
  }
  cache.set(y, map);
  return map;
}

export function holidayOn(y, m, d) {
  return holidaysFor(y).get(dateKey(y, m, d)) ?? null;
}
