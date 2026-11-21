import { dateKey, holidayOn } from './holidays.js';
import { loadNotes, notesByDate, subscribe } from './notes/db.ts';

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WD_LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"];
const WD_FULL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const WD_LONG = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

const ZOOM_MS = 560;
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const IS_TAURI = "__TAURI_INTERNALS__" in window;

const $ = (id) => document.getElementById(id);
const el = {
  welcome: $("welcome"),
  app: $("app"),
  yearView: $("year-view"),
  yearTitle: $("year-title"),
  yearGrid: $("year-grid"),
  monthView: $("month-view"),
  monthName: $("month-name"),
  monthYear: $("month-year"),
  monthGrid: $("month-grid"),
  backYearLabel: $("back-year-label"),
  dayView: $("day-view"),
  dayName: $("day-name"),
  dayYear: $("day-year"),
  dayHoliday: $("day-holiday"),
  backMonthLabel: $("back-month-label"),
  notesMount: $("notes-mount"),
  pop: $("holiday-pop"),
};

const now = new Date();
const state = {
  view: "welcome", // "welcome" | "year" | "month" | "day"
  year: now.getFullYear(),
  month: now.getMonth(),
  day: now.getDate(),
  renderedYear: null,
  busy: false,
};

function today() {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
}

const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
const firstDow = (y, m) => new Date(y, m, 1).getDay();
const esc = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/* ---------------- Notes (lazy-loaded editor) ---------------- */

let notesModule = null;
function loadNotesUi() {
  notesModule ??= import("./notes/mount.tsx");
  return notesModule;
}

let notesIndex = new Map();
function refreshNotesIndex() {
  notesIndex = notesByDate();
}

/* ---------------- Rendering ---------------- */

function renderWelcomeTile() {
  const d = new Date();
  $("tile-weekday").textContent = WD_FULL[d.getDay()];
  $("tile-day").textContent = d.getDate();
}

function renderYear(y) {
  const t = today();
  const frag = document.createDocumentFragment();

  for (let m = 0; m < 12; m++) {
    const box = document.createElement("button");
    box.className = "month-box";
    box.dataset.m = m;
    box.setAttribute("aria-label", `${MONTHS[m]} de ${y}`);
    if (y === t.y && m === t.m) box.classList.add("current");

    let html = `<div class="m-name">${MONTHS[m]}</div><div class="m-days">`;
    for (const w of WD_LETTERS) html += `<span class="wd">${w}</span>`;

    const lead = firstDow(y, m);
    const total = daysIn(y, m);
    for (let i = 0; i < 42; i++) {
      const day = i - lead + 1;
      if (day < 1 || day > total) {
        html += "<span></span>";
        continue;
      }
      const cls = [];
      if (holidayOn(y, m, day)) cls.push("holiday");
      if (notesIndex.has(dateKey(y, m, day))) cls.push("has-notes");
      const c = cls.length ? ` class="${cls.join(" ")}"` : "";
      if (y === t.y && m === t.m && day === t.d) {
        html += `<span class="today${cls.length ? " " + cls.join(" ") : ""}"><i>${day}</i></span>`;
      } else {
        html += `<span${c}>${day}</span>`;
      }
    }
    html += "</div>";
    box.innerHTML = html;
    frag.appendChild(box);
  }

  el.yearGrid.replaceChildren(frag);
  el.yearTitle.textContent = y;
  state.renderedYear = y;
}

function renderMonth(y, m) {
  const t = today();
  const lead = firstDow(y, m);
  const total = daysIn(y, m);
  const rows = Math.ceil((lead + total) / 7);
  const prevTotal = daysIn(y, m - 1);
  const maxNotes = rows > 5 ? 1 : 2;

  let html = "";
  for (let i = 0; i < rows * 7; i++) {
    const day = i - lead + 1;
    const dow = i % 7;
    const cls = ["day"];
    let label;
    let extra = "";
    let attrs = "";

    if (day < 1) {
      cls.push("other");
      label = prevTotal + day;
    } else if (day > total) {
      cls.push("other");
      label = day - total;
    } else {
      label = day;
      cls.push("in");
      const key = dateKey(y, m, day);
      attrs = ` data-date="${key}" data-d="${day}"`;
      if (y === t.y && m === t.m && day === t.d) cls.push("today");

      const hol = holidayOn(y, m, day);
      if (hol) {
        cls.push("holiday");
        extra += `<span class="pill hol-pill">${esc(hol.short)}</span>`;
      }
      const list = notesIndex.get(key);
      if (list) {
        for (const n of list.slice(0, maxNotes)) {
          extra += `<span class="pill note-pill"><span>${esc(n.title || "Nova Nota")}</span></span>`;
        }
        if (list.length > maxNotes) extra += `<span class="more">+${list.length - maxNotes}</span>`;
      }
    }
    if (dow === 0 || dow === 6) cls.push("weekend");
    html += `<div class="${cls.join(" ")}"${attrs}><b>${label}</b>${extra}</div>`;
  }

  el.monthGrid.style.setProperty("--rows", rows);
  el.monthGrid.innerHTML = html;
  el.monthName.textContent = MONTHS[m];
  el.monthYear.textContent = y;
  el.backYearLabel.textContent = y;
}

function renderDayHeader(y, m, d) {
  const dow = new Date(y, m, d).getDay();
  el.dayName.textContent = `${WD_LONG[dow]}, ${d} de ${MONTHS[m].toLowerCase()}`;
  el.dayYear.textContent = y;
  el.backMonthLabel.textContent = MONTHS[m];
  const hol = holidayOn(y, m, d);
  el.dayHoliday.hidden = !hol;
  if (hol) {
    el.dayHoliday.textContent = hol.short;
    el.dayHoliday.title = `${hol.name} · ${hol.typeLabel}`;
  }
}

/* ---------------- Zoom transitions ---------------- */

// Transforms that zoom `outer` into `box` while `inner` grows from `box`.
function zoomGeometry(box) {
  const r = box.getBoundingClientRect();
  const W = window.innerWidth;
  const H = window.innerHeight;
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;

  const s = Math.min(W / r.width, H / r.height);
  const outerZoomed = `translate(${W / 2 - s * cx}px, ${H / 2 - s * cy}px) scale(${s})`;

  const s0 = 1 / s;
  const innerShrunk = `translate(${cx - (s0 * W) / 2}px, ${cy - (s0 * H) / 2}px) scale(${s0})`;

  return { outerZoomed, innerShrunk };
}

async function finished(anims) {
  try {
    await Promise.all(anims.map((a) => a.finished));
  } catch (_) {
    /* cancelled */
  }
}

async function zoomIn(outer, inner, box) {
  const { outerZoomed, innerShrunk } = zoomGeometry(box);
  inner.hidden = false;
  const opts = { duration: ZOOM_MS, easing: EASE, fill: "forwards" };
  const a1 = outer.animate(
    [
      { transform: "none", opacity: 1 },
      { opacity: 1, offset: 0.35 },
      { transform: outerZoomed, opacity: 0 },
    ],
    opts
  );
  const a2 = inner.animate(
    [
      { transform: innerShrunk, opacity: 0 },
      { opacity: 1, offset: 0.5 },
      { transform: "none", opacity: 1 },
    ],
    opts
  );
  await finished([a1, a2]);
  outer.hidden = true;
  a1.cancel();
  a2.cancel();
}

async function zoomOut(outer, inner, box) {
  outer.hidden = false;
  const { outerZoomed, innerShrunk } = zoomGeometry(box);
  const opts = { duration: ZOOM_MS, easing: EASE, fill: "forwards" };
  const a1 = outer.animate(
    [
      { transform: outerZoomed, opacity: 0 },
      { opacity: 1, offset: 0.55 },
      { transform: "none", opacity: 1 },
    ],
    opts
  );
  const a2 = inner.animate(
    [
      { transform: "none", opacity: 1 },
      { opacity: 1, offset: 0.3 },
      { transform: innerShrunk, opacity: 0 },
    ],
    opts
  );
  await finished([a1, a2]);
  inner.hidden = true;
  a1.cancel();
  a2.cancel();
  box.classList.remove("flash");
  void box.offsetWidth;
  box.classList.add("flash");
}

async function openMonth(m) {
  if (state.busy || state.view !== "year") return;
  state.busy = true;
  hidePop(true);
  state.month = m;
  state.year = state.renderedYear;
  renderMonth(state.year, m);
  await zoomIn(el.yearView, el.monthView, el.yearGrid.children[m]);
  state.view = "month";
  state.busy = false;
}

async function closeMonth() {
  if (state.busy || state.view !== "month") return;
  state.busy = true;
  hidePop(true);
  if (state.renderedYear !== state.year) renderYear(state.year);
  await zoomOut(el.yearView, el.monthView, el.yearGrid.children[state.month]);
  state.view = "year";
  state.busy = false;
}

async function openDay(d) {
  if (state.busy || state.view !== "month") return;
  const cell = el.monthGrid.querySelector(`.day[data-d="${d}"]`);
  if (!cell) return;
  state.busy = true;
  hidePop(true);
  state.day = d;
  renderDayHeader(state.year, state.month, d);
  const mod = await loadNotesUi();
  mod.showNotes(el.notesMount, dateKey(state.year, state.month, d));
  await zoomIn(el.monthView, el.dayView, cell);
  state.view = "day";
  state.busy = false;
}

async function closeDay() {
  if (state.busy || state.view !== "day") return;
  state.busy = true;
  // The month view may be stale (day navigation, note edits).
  refreshNotesIndex();
  renderMonth(state.year, state.month);
  const cell = el.monthGrid.querySelector(`.day[data-d="${state.day}"]`);
  await zoomOut(el.monthView, el.dayView, cell);
  (await loadNotesUi()).hideNotes();
  state.view = "month";
  state.busy = false;
}

function slideIn(node, dir) {
  node.animate(
    [
      { transform: `translateX(${dir * 36}px)`, opacity: 0 },
      { transform: "none", opacity: 1 },
    ],
    { duration: 280, easing: EASE }
  );
}

function shiftMonth(delta) {
  if (state.busy || state.view !== "month") return;
  hidePop(true);
  let m = state.month + delta;
  let y = state.year;
  if (m < 0) { m = 11; y--; }
  if (m > 11) { m = 0; y++; }
  state.month = m;
  state.year = y;
  renderMonth(y, m);
  slideIn(el.monthGrid, delta);
}

function shiftYear(delta) {
  if (state.busy || state.view !== "year") return;
  state.year = state.renderedYear + delta;
  renderYear(state.year);
  slideIn(el.yearGrid, delta);
}

async function shiftDay(delta) {
  if (state.busy || state.view !== "day") return;
  const d = new Date(state.year, state.month, state.day + delta);
  state.year = d.getFullYear();
  state.month = d.getMonth();
  state.day = d.getDate();
  renderDayHeader(state.year, state.month, state.day);
  (await loadNotesUi()).showNotes(el.notesMount, dateKey(state.year, state.month, state.day));
  slideIn(el.notesMount, delta);
}

function goToday() {
  const t = today();
  if (state.view === "year") {
    if (state.renderedYear === t.y) return;
    const dir = t.y > state.renderedYear ? 1 : -1;
    state.year = t.y;
    renderYear(t.y);
    slideIn(el.yearGrid, dir);
  } else if (state.view === "month") {
    if (state.year === t.y && state.month === t.m) return;
    const dir = t.y * 12 + t.m > state.year * 12 + state.month ? 1 : -1;
    state.year = t.y;
    state.month = t.m;
    renderMonth(t.y, t.m);
    slideIn(el.monthGrid, dir);
  }
}

async function start() {
  if (state.view !== "welcome") return;
  state.view = "starting";
  el.app.hidden = false;

  const a1 = el.welcome.animate(
    [
      { opacity: 1, transform: "none" },
      { opacity: 0, transform: "scale(1.06)" },
    ],
    { duration: 420, easing: EASE, fill: "forwards" }
  );
  el.yearView.animate(
    [
      { opacity: 0, transform: "scale(0.97)", transformOrigin: "50% 50%" },
      { opacity: 1, transform: "none", transformOrigin: "50% 50%" },
    ],
    { duration: 520, delay: 80, easing: EASE, fill: "backwards" }
  );

  await finished([a1]);
  el.welcome.remove();
  state.view = "year";
}

/* ---------------- Holiday popover ---------------- */

let popTimer = null;
let popCell = null;
let popHoliday = null;

function showPop(cell) {
  clearTimeout(popTimer);
  if (popCell === cell) return;
  const d = Number(cell.dataset.d);
  const hol = holidayOn(state.year, state.month, d);
  if (!hol) return;
  popCell = cell;
  popHoliday = hol;

  const dow = new Date(state.year, state.month, d).getDay();
  $("hp-type").textContent = hol.typeLabel;
  $("hp-name").textContent = hol.name;
  $("hp-date").textContent = `${WD_LONG[dow]}, ${d} de ${MONTHS[state.month].toLowerCase()} de ${state.year}`;
  $("hp-link").href = hol.url;

  const pop = el.pop;
  pop.hidden = false;
  const anchor = cell.querySelector(".hol-pill") ?? cell;
  const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;
  let left = r.left + r.width / 2 - pw / 2;
  left = Math.max(12, Math.min(left, window.innerWidth - pw - 12));
  let top = r.bottom + 8;
  if (top + ph > window.innerHeight - 12) top = r.top - ph - 8;
  pop.style.left = `${left}px`;
  pop.style.top = `${Math.max(12, top)}px`;
  // Restart the entry animation.
  pop.style.animation = "none";
  void pop.offsetWidth;
  pop.style.animation = "";
}

function hidePop(now = false) {
  clearTimeout(popTimer);
  const hide = () => {
    el.pop.hidden = true;
    popCell = null;
    popHoliday = null;
  };
  if (now) hide();
  else popTimer = setTimeout(hide, 220);
}

function openExternal(url) {
  if (IS_TAURI) {
    import("@tauri-apps/plugin-opener")
      .then((m) => m.openUrl(url))
      .catch((e) => console.error("[calendario] openUrl", e));
  } else {
    window.open(url, "_blank", "noopener");
  }
}

el.monthGrid.addEventListener("mouseover", (e) => {
  if (state.busy || state.view !== "month") return;
  const cell = e.target.closest(".day.holiday");
  if (cell) showPop(cell);
  else if (popCell) hidePop();
});
el.monthGrid.addEventListener("mouseleave", () => popCell && hidePop());
el.pop.addEventListener("mouseenter", () => clearTimeout(popTimer));
el.pop.addEventListener("mouseleave", () => hidePop());
$("hp-link").addEventListener("click", (e) => {
  e.preventDefault();
  if (popHoliday) openExternal(popHoliday.url);
});

el.dayHoliday.addEventListener("click", () => {
  const hol = holidayOn(state.year, state.month, state.day);
  if (hol) openExternal(hol.url);
});

/* ---------------- Events ---------------- */

el.welcome.addEventListener("click", start);

el.yearGrid.addEventListener("click", (e) => {
  const box = e.target.closest(".month-box");
  if (box) openMonth(Number(box.dataset.m));
});

el.monthGrid.addEventListener("click", (e) => {
  const cell = e.target.closest(".day.in");
  if (cell) openDay(Number(cell.dataset.d));
});

$("back-year").addEventListener("click", closeMonth);
$("back-month").addEventListener("click", closeDay);
$("prev-month").addEventListener("click", () => shiftMonth(-1));
$("next-month").addEventListener("click", () => shiftMonth(1));
$("prev-year").addEventListener("click", () => shiftYear(-1));
$("next-year").addEventListener("click", () => shiftYear(1));
$("prev-day").addEventListener("click", () => shiftDay(-1));
$("next-day").addEventListener("click", () => shiftDay(1));
$("year-today").addEventListener("click", goToday);
$("month-today").addEventListener("click", goToday);

document.addEventListener("keydown", (e) => {
  if (state.view === "welcome") {
    start();
    return;
  }
  if (state.view === "day") {
    // Esc closes open menus inside the notes first.
    if (e.key === "Escape" && !document.querySelector(".notes-root .fmt-menu, .notes-root .ctx-menu")) closeDay();
    return;
  }
  if (state.view === "month") {
    if (e.key === "Escape" || e.key === "Backspace") closeMonth();
    else if (e.key === "ArrowLeft") shiftMonth(-1);
    else if (e.key === "ArrowRight") shiftMonth(1);
  } else if (state.view === "year") {
    if (e.key === "ArrowLeft") shiftYear(-1);
    else if (e.key === "ArrowRight") shiftYear(1);
  }
});

// Feel like a native app, not a web page.
document.addEventListener("contextmenu", (e) => e.preventDefault());

// Keep "today" correct if the app stays open past midnight.
function scheduleMidnightRefresh() {
  const n = new Date();
  const next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 2);
  setTimeout(() => {
    renderWelcomeTile();
    if (!state.busy) {
      renderYear(state.renderedYear);
      renderMonth(state.year, state.month);
    }
    scheduleMidnightRefresh();
  }, next - n);
}

// Re-draw markers when notes change; while the notes view is open the
// calendar is redrawn on close instead.
subscribe(() => {
  refreshNotesIndex();
  if (state.busy || state.view === "day") return;
  if (state.renderedYear !== null) renderYear(state.renderedYear);
  renderMonth(state.year, state.month);
});

/* ---------------- Init ---------------- */

renderWelcomeTile();
renderYear(state.year);
renderMonth(state.year, state.month);
scheduleMidnightRefresh();
el.welcome.focus();
loadNotes();
// Warm up the editor bundle so the first day opens instantly.
(window.requestIdleCallback ?? setTimeout)(() => loadNotesUi(), { timeout: 3000 });

// Look for a new version a few seconds after start, without slowing it down.
if (IS_TAURI) {
  setTimeout(async () => {
    const { checkForUpdate } = await import("./updater.js");
    checkForUpdate({
      // Close the open day so the editor writes pending changes before the
      // installer closes the app.
      beforeInstall: async () => {
        if (state.view !== "day") return;
        (await loadNotesUi()).hideNotes();
        await new Promise((r) => setTimeout(r, 400));
      },
    });
  }, 3000);
}
