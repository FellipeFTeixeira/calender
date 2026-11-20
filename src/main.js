"use strict";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WD_LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"];
const WD_FULL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const ZOOM_MS = 560;
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

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
  backLabel: $("back-label"),
};

const now = new Date();
const state = {
  view: "welcome", // "welcome" | "year" | "month"
  year: now.getFullYear(),
  month: now.getMonth(),
  renderedYear: null,
  busy: false,
};

function today() {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
}

const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
const firstDow = (y, m) => new Date(y, m, 1).getDay();

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
      } else if (y === t.y && m === t.m && day === t.d) {
        html += `<span class="today"><i>${day}</i></span>`;
      } else {
        html += `<span>${day}</span>`;
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

  let html = "";
  for (let i = 0; i < rows * 7; i++) {
    const day = i - lead + 1;
    const dow = i % 7;
    const cls = ["day"];
    let label;

    if (day < 1) {
      cls.push("other");
      label = prevTotal + day;
    } else if (day > total) {
      cls.push("other");
      label = day - total;
    } else {
      label = day;
      if (y === t.y && m === t.m && day === t.d) cls.push("today");
    }
    if (dow === 0 || dow === 6) cls.push("weekend");
    html += `<div class="${cls.join(" ")}"><b>${label}</b></div>`;
  }

  el.monthGrid.style.setProperty("--rows", rows);
  el.monthGrid.innerHTML = html;
  el.monthName.textContent = MONTHS[m];
  el.monthYear.textContent = y;
  el.backLabel.textContent = y;
}

/* ---------------- Zoom geometry ---------------- */

// Returns the transforms needed to zoom the year view into a month box
// (and to shrink the full-screen month view down onto that same box).
function zoomGeometry(box) {
  const r = box.getBoundingClientRect();
  const W = window.innerWidth;
  const H = window.innerHeight;
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;

  const s = Math.min(W / r.width, H / r.height);
  const yearZoomed = `translate(${W / 2 - s * cx}px, ${H / 2 - s * cy}px) scale(${s})`;

  const s0 = 1 / s;
  const monthShrunk = `translate(${cx - (s0 * W) / 2}px, ${cy - (s0 * H) / 2}px) scale(${s0})`;

  return { yearZoomed, monthShrunk };
}

async function runTogether(anims) {
  try {
    await Promise.all(anims.map((a) => a.finished));
  } catch (_) {
    /* cancelled */
  }
}

/* ---------------- Transitions ---------------- */

async function openMonth(m) {
  if (state.busy || state.view !== "year") return;
  state.busy = true;

  const box = el.yearGrid.children[m];
  state.month = m;
  state.year = state.renderedYear;
  renderMonth(state.year, m);

  const { yearZoomed, monthShrunk } = zoomGeometry(box);
  el.monthView.hidden = false;

  const opts = { duration: ZOOM_MS, easing: EASE, fill: "forwards" };
  const a1 = el.yearView.animate(
    [
      { transform: "none", opacity: 1 },
      { opacity: 1, offset: 0.35 },
      { transform: yearZoomed, opacity: 0 },
    ],
    opts
  );
  const a2 = el.monthView.animate(
    [
      { transform: monthShrunk, opacity: 0 },
      { opacity: 1, offset: 0.5 },
      { transform: "none", opacity: 1 },
    ],
    opts
  );

  await runTogether([a1, a2]);

  el.yearView.hidden = true;
  a1.cancel();
  a2.cancel();
  state.view = "month";
  state.busy = false;
}

async function closeMonth() {
  if (state.busy || state.view !== "month") return;
  state.busy = true;

  if (state.renderedYear !== state.year) renderYear(state.year);
  el.yearView.hidden = false;

  const box = el.yearGrid.children[state.month];
  const { yearZoomed, monthShrunk } = zoomGeometry(box);

  const opts = { duration: ZOOM_MS, easing: EASE, fill: "forwards" };
  const a1 = el.yearView.animate(
    [
      { transform: yearZoomed, opacity: 0 },
      { opacity: 1, offset: 0.55 },
      { transform: "none", opacity: 1 },
    ],
    opts
  );
  const a2 = el.monthView.animate(
    [
      { transform: "none", opacity: 1 },
      { opacity: 1, offset: 0.3 },
      { transform: monthShrunk, opacity: 0 },
    ],
    opts
  );

  await runTogether([a1, a2]);

  el.monthView.hidden = true;
  a1.cancel();
  a2.cancel();
  box.classList.remove("flash");
  void box.offsetWidth;
  box.classList.add("flash");
  state.view = "year";
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

  await runTogether([a1]);
  el.welcome.remove();
  state.view = "year";
}

/* ---------------- Events ---------------- */

el.welcome.addEventListener("click", start);

el.yearGrid.addEventListener("click", (e) => {
  const box = e.target.closest(".month-box");
  if (box) openMonth(Number(box.dataset.m));
});

$("back-btn").addEventListener("click", closeMonth);
$("prev-month").addEventListener("click", () => shiftMonth(-1));
$("next-month").addEventListener("click", () => shiftMonth(1));
$("prev-year").addEventListener("click", () => shiftYear(-1));
$("next-year").addEventListener("click", () => shiftYear(1));
$("year-today").addEventListener("click", goToday);
$("month-today").addEventListener("click", goToday);

document.addEventListener("keydown", (e) => {
  if (state.view === "welcome") {
    start();
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

/* ---------------- Init ---------------- */

renderWelcomeTile();
renderYear(state.year);
renderMonth(state.year, state.month);
scheduleMidnightRefresh();
el.welcome.focus();
