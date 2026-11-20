'use strict';
/* Mi Rutina — app de gimnasio que funciona sin internet.
   Todo se guarda en el propio cel (IndexedDB): datos y videos. */

/* =========================================================
   Utilidades
   ========================================================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const fmtNum = (n, d = 1) => (n == null ? '—' : String(round(n, d)));
const pad = (n) => String(n).padStart(2, '0');
const dateStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const fmtDate = (s) => { const d = parseDate(s); return `${DIAS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MESES[d.getMonth()]}`; };
const fmtDateShort = (s) => { const d = parseDate(s); return `${d.getDate()} ${MESES[d.getMonth()]}`; };
const fmtDur = (ms) => { const m = Math.max(1, Math.round(ms / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
const fmtClock = (sec) => {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const clone = (o) => JSON.parse(JSON.stringify(o));
const mondayOf = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

/* =========================================================
   Almacenamiento en el cel (IndexedDB)
   ========================================================= */
let dbPromise;
function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('mi-rutina', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('kv');
        db.createObjectStore('videos');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}
async function idb(store, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
const kvGet = (k) => idb('kv', 'readonly', (s) => s.get(k));
const kvSet = (k, v) => idb('kv', 'readwrite', (s) => s.put(v, k));
const vidGet = (id) => idb('videos', 'readonly', (s) => s.get(id));
const vidSet = (id, rec) => idb('videos', 'readwrite', (s) => s.put(rec, id));
const vidDel = (id) => idb('videos', 'readwrite', (s) => s.delete(id));
const vidKeys = () => idb('videos', 'readonly', (s) => s.getAllKeys());

/* =========================================================
   Datos
   ========================================================= */
const GROUPS = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos', 'Core', 'Cardio', 'Otro'];
const SEED = [
  ['Press de banca', 'Pecho'], ['Press inclinado con mancuernas', 'Pecho'], ['Aperturas con mancuernas', 'Pecho'],
  ['Cruces en polea', 'Pecho'], ['Fondos en paralelas', 'Pecho'], ['Lagartijas', 'Pecho'],
  ['Dominadas', 'Espalda'], ['Jalón al pecho', 'Espalda'], ['Remo con barra', 'Espalda'],
  ['Remo con mancuerna', 'Espalda'], ['Remo sentado en polea', 'Espalda'], ['Peso muerto', 'Espalda'],
  ['Sentadilla', 'Piernas'], ['Prensa', 'Piernas'], ['Zancadas', 'Piernas'], ['Peso muerto rumano', 'Piernas'],
  ['Extensión de cuádriceps', 'Piernas'], ['Curl femoral', 'Piernas'], ['Hip thrust', 'Piernas'],
  ['Elevación de pantorrilla', 'Piernas'],
  ['Press militar', 'Hombros'], ['Elevaciones laterales', 'Hombros'], ['Face pull', 'Hombros'],
  ['Pájaros (deltoide posterior)', 'Hombros'],
  ['Curl con barra', 'Brazos'], ['Curl martillo', 'Brazos'], ['Extensión de tríceps en polea', 'Brazos'],
  ['Press francés', 'Brazos'],
  ['Plancha', 'Core'], ['Crunch', 'Core'], ['Elevación de piernas colgado', 'Core'],
  ['Caminadora', 'Cardio'], ['Bicicleta', 'Cardio'], ['Saltar la cuerda', 'Cardio'],
];
const METRICS = [
  ['peso', 'Peso', 'kg'], ['grasa', '% Grasa', '%'], ['cintura', 'Cintura', 'cm'], ['cadera', 'Cadera', 'cm'],
  ['pecho', 'Pecho', 'cm'], ['brazo', 'Brazo', 'cm'], ['pierna', 'Pierna', 'cm'],
];

const defaultState = () => ({
  v: 1,
  profile: { altura: null, descanso: 90, hideInstall: false },
  exercises: SEED.map(([name, group]) => ({ id: uid(), name, group, notes: '', link: '' })),
  days: [],
  schedule: { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null },
  workouts: [],
  body: [],
  active: null,
});

function migrate(s) {
  s.profile = { altura: null, descanso: 90, hideInstall: false, ...(s.profile || {}) };
  s.exercises ||= [];
  s.days ||= [];
  s.schedule ||= {};
  for (let i = 0; i < 7; i++) if (!(i in s.schedule)) s.schedule[i] = null;
  s.workouts ||= [];
  s.body ||= [];
  s.active ||= null;
  s.workouts.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  s.body.sort((a, b) => a.date.localeCompare(b.date));
  return s;
}

let state = defaultState();
let videoIds = new Set();
let storageOk = true;
const ui = { tab: 'hoy', exQ: '', exGroup: 'Todos', metric: 'peso' };

async function load() {
  try {
    const saved = await kvGet('state');
    if (saved) state = saved;
    videoIds = new Set(await vidKeys());
  } catch (e) {
    storageOk = false;
  }
  migrate(state);
}
let saveTimer;
function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 200); }
async function flush() {
  clearTimeout(saveTimer);
  if (!storageOk) return;
  try { await kvSet('state', state); } catch (e) { toast('No se pudo guardar 😬'); }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
addEventListener('pagehide', flush);

const exById = (id) => state.exercises.find((e) => e.id === id);
const dayById = (id) => (id ? state.days.find((d) => d.id === id) : null);
const exName = (id) => exById(id)?.name || 'Ejercicio eliminado';
const volume = (w) => w.entries.reduce((t, e) => t + e.sets.reduce((s, x) => s + (x.w || 0) * (x.r || 0), 0), 0);

function lastPerf(exId) {
  for (let i = state.workouts.length - 1; i >= 0; i--) {
    const w = state.workouts[i];
    const e = w.entries.find((x) => x.exId === exId);
    if (e && e.sets.length) return { date: w.date, sets: e.sets };
  }
  return null;
}
function exHistory(exId) {
  const out = [];
  for (const w of state.workouts) {
    const e = w.entries.find((x) => x.exId === exId);
    if (!e || !e.sets.length) continue;
    const max = Math.max(...e.sets.map((s) => s.w || 0));
    const reps = Math.max(...e.sets.map((s) => s.r || 0));
    const e1rm = Math.max(...e.sets.map((s) => (s.w > 0 && s.r > 0 ? s.w * (1 + s.r / 30) : 0)));
    out.push({ date: w.date, max, reps, e1rm });
  }
  return out;
}
const bestWeight = (exId) => Math.max(0, ...exHistory(exId).map((h) => h.max));

function lastBody(key) {
  for (let i = state.body.length - 1; i >= 0; i--) if (state.body[i][key] != null) return state.body[i];
  return null;
}
function firstBody(key) { return state.body.find((b) => b[key] != null) || null; }
function imcCat(imc) {
  if (imc < 18.5) return 'bajo';
  if (imc < 25) return 'normal';
  if (imc < 30) return 'sobrepeso';
  return 'obesidad';
}

function loadExample() {
  const byName = (n) => state.exercises.find((e) => e.name === n) || addExercise(n, 'Otro');
  const mk = (name, items) => ({ id: uid(), name, items: items.map(([n, sets, reps]) => ({ exId: byName(n).id, sets, reps })) });
  const a = mk('Empuje · pecho, hombro, tríceps', [
    ['Press de banca', 4, '6-8'], ['Press inclinado con mancuernas', 3, '8-10'], ['Press militar', 3, '8-10'],
    ['Elevaciones laterales', 3, '12-15'], ['Extensión de tríceps en polea', 3, '10-12'],
  ]);
  const b = mk('Jalón · espalda, bíceps', [
    ['Dominadas', 4, '6-10'], ['Remo con barra', 4, '8'], ['Jalón al pecho', 3, '10-12'],
    ['Face pull', 3, '15'], ['Curl con barra', 3, '10'], ['Curl martillo', 3, '12'],
  ]);
  const c = mk('Pierna · y abdomen', [
    ['Sentadilla', 4, '6-8'], ['Peso muerto rumano', 3, '8-10'], ['Prensa', 3, '10-12'],
    ['Curl femoral', 3, '12'], ['Elevación de pantorrilla', 4, '15'], ['Plancha', 3, '45 s'],
  ]);
  state.days.push(a, b, c);
  state.schedule = { 0: null, 1: a.id, 2: b.id, 3: c.id, 4: a.id, 5: b.id, 6: c.id };
  persist();
}
function addExercise(name, group) {
  const ex = { id: uid(), name, group: GROUPS.includes(group) ? group : 'Otro', notes: '', link: '' };
  state.exercises.push(ex);
  return ex;
}

/* =========================================================
   Vistas
   ========================================================= */
const TITLES = { hoy: 'Hoy', rutina: 'Mi rutina', ejercicios: 'Ejercicios', cuerpo: 'Mi cuerpo', historial: 'Progreso' };

function render(keepScroll) {
  const y = scrollY;
  $('#title').textContent = state.active && ui.tab === 'hoy' ? 'Entrenando' : TITLES[ui.tab];
  let html = '';
  if (state.active && ui.tab !== 'hoy') {
    html += `<button class="active-banner" data-action="tab" data-tab="hoy"><span>🏋️ Entrenamiento en curso</span><span>Volver →</span></button>`;
  }
  html += VIEWS[ui.tab]();
  $('#main').innerHTML = html;
  $$('.tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
  scrollTo(0, keepScroll ? y : 0);
  tick();
}

const VIEWS = {
  hoy() {
    if (state.active) return viewWorkout();
    const now = new Date();
    const wd = now.getDay();
    const day = dayById(state.schedule[wd]);
    let h = `<p class="kicker">${DIAS[wd]} ${now.getDate()} de ${MESES_LARGO[now.getMonth()].toLowerCase()}</p>`;
    h += installCard();

    if (!state.days.length) {
      h += `<div class="card">
        <h2>Arma tu rutina 💪</h2>
        <p class="muted">Crea tus días (pecho, pierna, lo que quieras) y asígnalos a la semana. La app te dirá qué te toca cada día.</p>
        <button class="btn primary big" data-action="load-example">Usar una rutina de ejemplo</button>
        <button class="btn" data-action="tab" data-tab="rutina">Crear la mía desde cero</button>
        <p class="muted small center">La de ejemplo la puedes cambiar toda después.</p>
      </div>`;
    } else if (day) {
      h += `<div class="card today-card">
        <p class="label">Hoy te toca</p>
        <h2>${esc(day.name)}</h2>
        <ul class="list">${day.items.map((it) => `<li><button class="row-btn" data-action="ex-open" data-id="${it.exId}">
          <span>${esc(exName(it.exId))}</span>
          ${videoIds.has(it.exId) ? '<span class="badge">▶︎</span>' : ''}
          <span class="muted">${it.sets}×${esc(it.reps)}</span></button></li>`).join('')}</ul>
        <button class="btn primary big" data-action="start" data-day="${day.id}">Empezar entrenamiento</button>
      </div>`;
    } else {
      h += `<div class="card"><h2>Hoy es descanso 😴</h2><p class="muted">Recupérate bien. Si de todos modos quieres entrenar, elige abajo.</p></div>`;
    }

    if (state.days.length) {
      h += `<div class="card"><p class="label">¿Entrenar otra cosa?</p><div class="chips">
        ${state.days.filter((d) => d !== day).map((d) => `<button class="chip" data-action="start" data-day="${d.id}">${esc(d.name)}</button>`).join('')}
        <button class="chip" data-action="start" data-day="">Entrenamiento libre</button></div></div>`;
    }

    const mon = dateStr(mondayOf(now));
    const thisWeek = state.workouts.filter((w) => w.date >= mon).length;
    const plannedWeek = Object.values(state.schedule).filter((id) => dayById(id)).length;
    const peso = lastBody('peso');
    h += `<div class="stats">
      <div><b>${thisWeek}${plannedWeek ? `<span class="muted" style="font-size:14px">/${plannedWeek}</span>` : ''}</b><span>Esta semana</span></div>
      <div><b>${state.workouts.length}</b><span>Entrenamientos</span></div>
      <div><b>${peso ? fmtNum(peso.peso) : '—'}</b><span>Peso (kg)</span></div>
    </div>`;
    return h;
  },

  rutina() {
    let h = '';
    if (!state.days.length) {
      h += `<div class="card">
        <h2>Todavía no tienes rutina</h2>
        <p class="muted">Crea un “día” por cada tipo de entrenamiento (ej. <i>Pecho y tríceps</i>), agrégale ejercicios con sus series y repeticiones, y luego dile a la app qué día de la semana toca cada uno.</p>
        <button class="btn primary big" data-action="day-new">+ Crear mi primer día</button>
        <button class="btn" data-action="load-example">Usar rutina de ejemplo</button>
      </div>`;
      return h;
    }
    const today = new Date().getDay();
    h += `<div class="section-head"><h2>Mi semana</h2></div><div class="card">
      ${[1, 2, 3, 4, 5, 6, 0].map((wd) => `<label class="week-row ${wd === today ? 'today' : ''}">
        <span>${DIAS[wd]}</span>
        <select class="input sm" data-sched="${wd}">
          <option value="">Descanso 😴</option>
          ${state.days.map((d) => `<option value="${d.id}" ${state.schedule[wd] === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}
        </select></label>`).join('')}
    </div>`;
    h += `<div class="section-head"><h2>Mis días</h2><button class="btn sm" data-action="day-new">+ Nuevo</button></div>`;
    for (const d of state.days) {
      h += `<button class="card row-btn" style="display:block;border:0" data-action="day-edit" data-id="${d.id}">
        <div class="row between"><h3>${esc(d.name)}</h3><span class="muted small">Editar ›</span></div>
        <p class="muted small">${d.items.length} ejercicio${d.items.length === 1 ? '' : 's'}${d.items.length ? ' · ' : ''}${d.items.map((it) => esc(exName(it.exId))).join(' · ')}</p>
      </button>`;
    }
    return h;
  },

  ejercicios() {
    return `<input class="input" type="search" placeholder="Buscar ejercicio…" value="${esc(ui.exQ)}" data-exq>
      <div class="chips scroll">${['Todos', ...GROUPS].map((g) => `<button class="chip ${ui.exGroup === g ? 'on' : ''}" data-action="ex-group" data-g="${g}">${g}</button>`).join('')}</div>
      <p class="muted small">Toca un ejercicio para agregarle su video, notas de técnica y ver tu progreso.</p>
      <div id="exlist">${exerciseListHtml(ui.exQ, ui.exGroup, 'ex-open')}</div>
      <button class="btn mt" data-action="ex-new">+ Nuevo ejercicio</button>`;
  },

  cuerpo() {
    const alt = state.profile.altura;
    const p = lastBody('peso'), g = lastBody('grasa'), p0 = firstBody('peso');
    const peso = p?.peso, grasa = g?.grasa;
    const imc = peso && alt ? peso / (alt / 100) ** 2 : null;
    let delta = '';
    if (p && p0 && p0 !== p) {
      const d = peso - p0.peso;
      delta = `<p class="small center ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${fmtNum(d)} kg desde el ${fmtDateShort(p0.date)}</p>`;
    }
    let h = `<div class="card">
      <div class="stats">
        <div><b>${peso != null ? fmtNum(peso) : '—'}</b><span>Peso (kg)</span></div>
        <div><b>${grasa != null ? fmtNum(grasa) + '%' : '—'}</b><span>Grasa</span></div>
        <div><b>${imc ? fmtNum(imc) : '—'}</b><span>IMC${imc ? ' · ' + imcCat(imc) : ''}</span></div>
      </div>
      ${delta}
      ${peso != null && grasa != null ? `<p class="muted small center">Masa magra ≈ ${fmtNum(peso * (1 - grasa / 100))} kg · Grasa ≈ ${fmtNum(peso * grasa / 100)} kg</p>` : ''}
      <div class="row between mt"><span class="muted">Altura: <b style="color:var(--text)">${alt ? alt + ' cm' : 'sin registrar'}</b></span>
        <button class="btn sm" data-action="altura">${alt ? 'Cambiar' : 'Agregar altura'}</button></div>
    </div>
    <button class="btn primary big" data-action="body-new">+ Registrar peso y medidas</button>`;

    if (!state.body.length) {
      h += `<p class="muted center mt">Registra tu peso, % de grasa y medidas cada semana para ver cómo vas cambiando 📈</p>`;
      return h;
    }
    const avail = METRICS.filter(([k]) => state.body.some((b) => b[k] != null));
    if (!avail.find(([k]) => k === ui.metric)) ui.metric = avail[0]?.[0] || 'peso';
    const [mk, ml, mu] = METRICS.find(([k]) => k === ui.metric);
    const pts = state.body.filter((b) => b[mk] != null).map((b) => ({ x: b.date, y: b[mk] }));
    h += `<div class="card"><div class="chips">${avail.map(([k, l]) => `<button class="chip ${k === ui.metric ? 'on' : ''}" data-action="metric" data-k="${k}">${l}</button>`).join('')}</div>
      ${lineChart(pts, mu, ml)}</div>`;
    h += `<div class="section-head"><h2>Registros</h2></div><div class="card"><ul class="list">
      ${[...state.body].reverse().map((b) => `<li><button class="row-btn" data-action="body-edit" data-id="${b.id}">
        <span><b>${fmtDate(b.date)}</b><br><span class="muted small">${METRICS.filter(([k]) => b[k] != null).map(([k, l, u]) => `${l}: ${fmtNum(b[k])}${u === '%' ? '%' : ' ' + u}`).join(' · ')}</span></span>
        <span class="muted">›</span></button></li>`).join('')}
    </ul></div>`;
    return h;
  },

  historial() {
    if (!state.workouts.length) {
      return `<div class="card"><h2>Aquí verás tu progreso</h2><p class="muted">Cuando termines tu primer entrenamiento aparecerá aquí, junto con tus récords y gráficas por ejercicio.</p></div>`;
    }
    const now = new Date();
    const mon = dateStr(mondayOf(now));
    const monthStart = dateStr(new Date(now.getFullYear(), now.getMonth(), 1));
    let h = `<div class="stats" style="margin-top:8px">
      <div><b>${state.workouts.filter((w) => w.date >= mon).length}</b><span>Esta semana</span></div>
      <div><b>${state.workouts.filter((w) => w.date >= monthStart).length}</b><span>Este mes</span></div>
      <div><b>${state.workouts.length}</b><span>En total</span></div>
    </div>`;

    // Mapa de las últimas 12 semanas
    const trained = new Set(state.workouts.map((w) => w.date));
    const start = mondayOf(now); start.setDate(start.getDate() - 7 * 11);
    const today = dateStr(now);
    let cells = '';
    for (let i = 0; i < 84; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const ds = dateStr(d);
      cells += `<i class="${trained.has(ds) ? 'on' : ''} ${ds === today ? 'today' : ''} ${ds > today ? 'future' : ''}"></i>`;
    }
    h += `<div class="card"><p class="label">Últimas 12 semanas</p><div class="heat">${cells}</div></div>`;

    // Récords
    const recs = state.exercises
      .map((e) => ({ e, hist: exHistory(e.id) }))
      .filter((x) => x.hist.length)
      .map((x) => ({ ...x, pr: Math.max(...x.hist.map((h) => h.max)), reps: Math.max(...x.hist.map((h) => h.reps)) }))
      .sort((a, b) => a.e.name.localeCompare(b.e.name, 'es'));
    if (recs.length) {
      h += `<div class="section-head"><h2>Récords 🏆</h2></div><div class="card"><ul class="list">
        ${recs.map((r) => `<li><button class="row-btn" data-action="ex-open" data-id="${r.e.id}"><span>${esc(r.e.name)}</span>
          <b>${r.pr > 0 ? fmtNum(r.pr) + ' kg' : r.reps + ' reps'}</b><span class="muted">›</span></button></li>`).join('')}
      </ul></div>`;
    }

    // Lista por mes
    h += `<div class="section-head"><h2>Entrenamientos</h2></div>`;
    let curMonth = '';
    for (const w of [...state.workouts].reverse()) {
      const m = w.date.slice(0, 7);
      if (m !== curMonth) {
        curMonth = m;
        const d = parseDate(w.date);
        h += `<p class="group-title">${MESES_LARGO[d.getMonth()]} ${d.getFullYear()}</p>`;
      }
      h += `<button class="card row-btn" style="border:0;margin:8px 0" data-action="workout-open" data-id="${w.id}">
        <span><b>${esc(w.dayName)}</b><br><span class="muted small">${fmtDate(w.date)} · ${w.entries.length} ejercicio${w.entries.length === 1 ? '' : 's'}${w.end ? ' · ' + fmtDur(w.end - w.start) : ''} · ${fmtNum(volume(w), 0)} kg</span></span>
        <span class="muted">›</span></button>`;
    }
    return h;
  },
};

function exerciseListHtml(q, group, action) {
  const nq = norm(q.trim());
  const list = state.exercises
    .filter((e) => (group === 'Todos' || e.group === group) && (!nq || norm(e.name).includes(nq)))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  if (!list.length) return `<p class="muted center mt">No encontré ejercicios con ese nombre.</p>`;
  const by = {};
  list.forEach((e) => (by[GROUPS.includes(e.group) ? e.group : 'Otro'] ||= []).push(e));
  return GROUPS.filter((g) => by[g]).map((g) => `<p class="group-title">${g}</p><ul class="list">
    ${by[g].map((e) => `<li><button class="row-btn" data-action="${action}" data-id="${e.id}"><span>${esc(e.name)}</span>
      ${videoIds.has(e.id) ? '<span class="badge">▶︎ video</span>' : ''}</button></li>`).join('')}</ul>`).join('');
}

/* ---------- entrenamiento en curso ---------- */
function startWorkout(dayId) {
  const day = dayById(dayId);
  state.active = {
    id: uid(), start: Date.now(), dayId: day?.id || null, dayName: day?.name || 'Entrenamiento libre',
    entries: (day?.items || []).map((it) => newEntry(it.exId, it.sets, it.reps)),
  };
  persist();
  ui.tab = 'hoy';
  render();
}
function newEntry(exId, sets = 3, reps = '') {
  return { exId, reps, sets: Array.from({ length: Math.max(1, sets | 0) }, () => ({ w: '', r: '', done: false })) };
}
function placeholder(last, si, reps) {
  const s = last ? last.sets[si] || last.sets[last.sets.length - 1] : null;
  return {
    w: s && s.w ? fmtNum(s.w) : 'kg',
    r: s && s.r ? String(s.r) : (String(reps).match(/\d+/)?.[0] || 'reps'),
  };
}

function viewWorkout() {
  const a = state.active;
  let h = `<div class="card wk-head"><div><p class="label">${fmtDate(dateStr(new Date(a.start)))}</p><h2>${esc(a.dayName)}</h2></div>
    <div class="elapsed" data-elapsed>0:00</div></div>`;
  if (!a.entries.length) h += `<p class="muted center">Agrega los ejercicios que vas a hacer 👇</p>`;
  a.entries.forEach((en, ei) => {
    const last = lastPerf(en.exId);
    const info = [];
    if (en.reps) info.push(`Meta: ${en.sets.length}×${esc(en.reps)}`);
    if (last) info.push(`Última vez (${fmtDateShort(last.date)}): ${last.sets.map((s) => `${s.w ? fmtNum(s.w) : '—'}×${s.r}`).join(', ')}`);
    h += `<div class="card">
      <div class="wk-ex-head">
        <div><h3>${esc(exName(en.exId))}</h3>${info.length ? `<p class="muted small">${info.join('<br>')}</p>` : ''}</div>
        <div class="row gap">
          <button class="icon-btn sm" data-action="ex-open" data-id="${en.exId}" aria-label="Ver video y notas">${videoIds.has(en.exId) ? '▶︎' : 'i'}</button>
          <button class="icon-btn sm" data-action="wk-remove-ex" data-ei="${ei}" aria-label="Quitar ejercicio">✕</button>
        </div>
      </div>
      <div class="sets">
        <div class="set-row head"><span>#</span><span>kg</span><span>reps</span><span></span></div>
        ${en.sets.map((s, si) => {
          const ph = placeholder(last, si, en.reps);
          return `<div class="set-row ${s.done ? 'done' : ''}">
            <span class="set-n">${si + 1}</span>
            <input inputmode="decimal" enterkeyhint="next" data-set="${ei}:${si}:w" value="${esc(s.w)}" placeholder="${esc(ph.w)}" aria-label="Peso serie ${si + 1}">
            <input inputmode="numeric" enterkeyhint="done" data-set="${ei}:${si}:r" value="${esc(s.r)}" placeholder="${esc(ph.r)}" aria-label="Repeticiones serie ${si + 1}">
            <button class="check" data-action="set-done" data-ei="${ei}" data-si="${si}" aria-label="Marcar serie ${si + 1}">✓</button>
          </div>`;
        }).join('')}
      </div>
      <div class="row gap">
        <button class="btn sm" data-action="set-add" data-ei="${ei}">+ Serie</button>
        ${en.sets.length > 1 ? `<button class="btn sm ghost" data-action="set-del" data-ei="${ei}">− Serie</button>` : ''}
      </div>
    </div>`;
  });
  h += `<button class="btn" data-action="wk-add-ex">+ Agregar ejercicio</button>
    <div class="row gap mt">
      <button class="btn ghost danger" style="width:auto" data-action="wk-cancel">Descartar</button>
      <button class="btn primary grow" data-action="wk-finish">Terminar ✓</button>
    </div>`;
  return h;
}

function finishWorkout() {
  const a = state.active;
  const entries = a.entries
    .map((en) => ({
      exId: en.exId,
      sets: en.sets
        .filter((s) => s.done || s.r !== '')
        .map((s) => ({ w: num(s.w) ?? 0, r: num(s.r) ?? 0 }))
        .filter((s) => s.r > 0 || s.w > 0),
    }))
    .filter((en) => en.sets.length);
  if (!entries.length) {
    if (!confirm('No registraste ninguna serie. ¿Terminar sin guardar?')) return;
    state.active = null; stopRest(); persist(); render();
    return;
  }
  const prs = entries.filter((en) => {
    const prev = bestWeight(en.exId);
    const now = Math.max(...en.sets.map((s) => s.w));
    return prev > 0 && now > prev;
  }).map((en) => exName(en.exId));
  const w = { id: a.id, date: dateStr(new Date(a.start)), start: a.start, end: Date.now(), dayId: a.dayId, dayName: a.dayName, entries };
  state.workouts.push(w);
  migrate(state);
  state.active = null;
  stopRest();
  persist();
  render();
  toast(prs.length ? `🏆 ¡Nuevo récord en ${prs.join(', ')}!` : `¡Bien hecho! 💪 ${fmtNum(volume(w), 0)} kg levantados`);
}

/* ---------- temporizador de descanso ---------- */
const rest = { end: 0, total: 0, fired: false };
let audioCtx;
function startRest(sec = state.profile.descanso || 90) {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume();
  } catch (e) { /* sin sonido */ }
  rest.total = sec;
  rest.end = Date.now() + sec * 1000;
  rest.fired = false;
  $('#rest').hidden = false;
  tick();
}
function stopRest() { rest.end = 0; $('#rest').hidden = true; }
function beep() {
  if (!audioCtx) return;
  try {
    [0, 0.25, 0.5].forEach((t) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      const at = audioCtx.currentTime + t;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.3, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
      o.start(at); o.stop(at + 0.2);
    });
  } catch (e) { /* nada */ }
}
function tick() {
  const el = $('[data-elapsed]');
  if (el && state.active) el.textContent = fmtClock((Date.now() - state.active.start) / 1000);
  if (!rest.end) return;
  const box = $('#rest');
  const left = Math.ceil((rest.end - Date.now()) / 1000);
  if (left > 0) {
    box.classList.remove('over');
    $('.rest-label', box).textContent = 'Descanso';
    $('.rest-time', box).textContent = fmtClock(left);
    $('.rest-fill', box).style.width = `${(left / rest.total) * 100}%`;
  } else {
    if (!rest.fired) { rest.fired = true; beep(); navigator.vibrate?.([250, 120, 250]); }
    box.classList.add('over');
    $('.rest-label', box).textContent = 'Descanso terminado';
    $('.rest-time', box).textContent = '¡A darle! 💪';
    $('.rest-fill', box).style.width = '0%';
    if (left < -8) stopRest();
  }
}
setInterval(tick, 500);

/* =========================================================
   Hojas (ventanas que suben desde abajo)
   ========================================================= */
const sheets = [];
function openSheet(html, opts = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-bg" data-action="sheet-close"></div>
    <div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>
    <button class="icon-btn sm sheet-x" data-action="sheet-close" aria-label="Cerrar">✕</button>
    <div class="sheet-body">${html}</div></div>`;
  $('#sheets').appendChild(wrap);
  const s = { el: wrap, body: $('.sheet-body', wrap), ...opts };
  sheets.push(s);
  document.body.classList.add('noscroll');
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  return s;
}
function closeSheet() {
  const s = sheets.pop();
  if (!s) return;
  s.onClose?.();
  revokeVideos(s.el);
  s.el.classList.remove('open');
  setTimeout(() => s.el.remove(), 250);
  if (!sheets.length) document.body.classList.remove('noscroll');
}
function revokeVideos(root) {
  $$('video', root).forEach((v) => { if (v.src.startsWith('blob:')) URL.revokeObjectURL(v.src); });
}
const sheetFor = (el) => { const w = el.closest('.sheet-wrap'); return w ? sheets.find((s) => s.el === w) : null; };

function pickExercise(onPick) {
  const s = openSheet(`<h2>Elegir ejercicio</h2>
    <input class="input" type="search" placeholder="Buscar ejercicio…" data-q style="margin-top:12px">
    <div class="pick-list"></div>
    <button class="btn mt" data-action="new">+ Crear ejercicio nuevo</button>`, {
    onInput(t) { if (t.matches('[data-q]')) fill(t.value); },
    actions: {
      pick(el) { closeSheet(); onPick(el.dataset.id); },
      new() { editExerciseSheet(null, (ex) => { closeSheet(); onPick(ex.id); }); },
    },
  });
  const fill = (q) => { $('.pick-list', s.el).innerHTML = exerciseListHtml(q, 'Todos', 'pick'); };
  fill('');
}

function editExerciseSheet(ex, cb) {
  const isNew = !ex;
  const d = { name: ex?.name || '', group: ex?.group || 'Pecho' };
  openSheet(`<h2>${isNew ? 'Nuevo ejercicio' : 'Editar ejercicio'}</h2>
    <label class="field"><span>Nombre</span><input class="input" data-f="name" value="${esc(d.name)}" placeholder="Ej. Press de banca"></label>
    <label class="field"><span>Grupo muscular</span><select class="input" data-f="group">
      ${GROUPS.map((g) => `<option ${g === d.group ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
    <button class="btn primary big" data-action="save">Guardar</button>`, {
    onInput(t) { if (t.dataset.f) d[t.dataset.f] = t.value; },
    actions: {
      save() {
        const name = d.name.trim();
        if (!name) return toast('Ponle un nombre');
        if (isNew) ex = addExercise(name, d.group);
        else { ex.name = name; ex.group = d.group; }
        persist();
        closeSheet();
        render(true);
        cb?.(ex);
      },
    },
  });
}

function exerciseSheet(id) {
  const ex = exById(id);
  if (!ex) return toast('Ese ejercicio ya no existe');
  const s = openSheet('', {
    onInput(t) {
      const f = t.dataset.f;
      if (f === 'notes' || f === 'link') { ex[f] = t.value; persist(); }
    },
    actions: {
      'vid-add'() { pickVideo(ex.id, draw); },
      'vid-del'() {
        if (!confirm('¿Quitar el video de este ejercicio?')) return;
        vidDel(ex.id).then(() => { videoIds.delete(ex.id); draw(); render(true); });
      },
      edit() { editExerciseSheet(ex, draw); },
      del() {
        if (!confirm(`¿Eliminar "${ex.name}"? Se quitará de tus días de rutina. Tu historial se queda.`)) return;
        state.exercises = state.exercises.filter((e) => e.id !== ex.id);
        state.days.forEach((d) => { d.items = d.items.filter((it) => it.exId !== ex.id); });
        if (videoIds.has(ex.id)) vidDel(ex.id).then(() => videoIds.delete(ex.id));
        persist();
        closeSheet();
        render(true);
      },
    },
  });
  async function draw() {
    revokeVideos(s.el);
    const hasVid = videoIds.has(ex.id);
    const hist = exHistory(ex.id);
    const bodyweight = hist.length && hist.every((h) => h.max === 0);
    const goodLink = /^https?:\/\//i.test(ex.link || '');
    s.body.innerHTML = `<p class="label">${esc(ex.group)}</p><h2>${esc(ex.name)}</h2>
      ${hasVid
        ? `<video class="vid" controls playsinline preload="metadata"></video>
           <div class="row gap"><button class="btn sm" data-action="vid-add">Cambiar video</button><button class="btn sm ghost danger" data-action="vid-del">Quitar video</button></div>`
        : `<button class="vid-empty" data-action="vid-add"><span>🎥</span><b>Agregar video</b>
           <small>Grábalo o elígelo de tu galería. Se guarda en tu cel y lo puedes ver sin internet.</small></button>`}
      <label class="field"><span>Notas de técnica</span><textarea class="input" rows="3" data-f="notes" placeholder="Ej. codos a 45°, bajar lento, apretar arriba…">${esc(ex.notes)}</textarea></label>
      <label class="field"><span>Enlace a video en internet (opcional)</span><input class="input" type="url" data-f="link" value="${esc(ex.link)}" placeholder="https://youtube.com/…"></label>
      ${goodLink ? `<a class="btn sm" href="${esc(ex.link)}" target="_blank" rel="noopener">Abrir enlace ↗</a>` : ''}
      ${hist.length ? `<h3>Tu progreso</h3>
        <div class="stats" style="margin-top:10px">
          <div><b>${bodyweight ? Math.max(...hist.map((h) => h.reps)) : fmtNum(Math.max(...hist.map((h) => h.max)))}</b><span>${bodyweight ? 'Récord reps' : 'Récord (kg)'}</span></div>
          <div><b>${hist.length}</b><span>Veces</span></div>
          <div><b>${bodyweight ? '—' : fmtNum(Math.max(...hist.map((h) => h.e1rm)), 0)}</b><span>1RM estimado</span></div>
        </div>
        ${lineChart(hist.map((h) => ({ x: h.date, y: bodyweight ? h.reps : h.max })), bodyweight ? 'reps' : 'kg', bodyweight ? 'Repeticiones máximas' : 'Peso máximo')}` : ''}
      <div class="row gap mt"><button class="btn sm" data-action="edit">Editar nombre</button><button class="btn sm ghost danger" data-action="del">Eliminar</button></div>`;
    if (hasVid) {
      const rec = await vidGet(ex.id);
      const v = $('video', s.body);
      if (rec && v) v.src = URL.createObjectURL(new Blob([rec.buf], { type: rec.type }));
    }
  }
  draw();
}

function pickVideo(exId, done) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'video/*';
  inp.style.display = 'none';
  document.body.appendChild(inp);
  inp.onchange = async () => {
    const f = inp.files[0];
    inp.remove();
    if (!f) return;
    const mb = f.size / 1048576;
    if (mb > 150 && !confirm(`El video pesa ${Math.round(mb)} MB y ocupará bastante espacio. ¿Guardarlo de todos modos?`)) return;
    toast('Guardando video…');
    try {
      const buf = await f.arrayBuffer();
      await vidSet(exId, { buf, type: f.type || 'video/mp4', size: f.size, name: f.name, added: Date.now() });
      videoIds.add(exId);
      toast('Video guardado ✅');
      done?.();
      render(true);
    } catch (e) {
      toast('No se pudo guardar el video (¿sin espacio?)');
    }
  };
  inp.click();
}

function dayEditSheet(id) {
  const orig = dayById(id);
  const d = orig ? clone(orig) : { id: uid(), name: '', items: [] };
  const s = openSheet('', {
    onInput(t) {
      if (t.dataset.f === 'name') d.name = t.value;
      else if (t.dataset.item) {
        const [i, f] = t.dataset.item.split(':');
        d.items[i][f] = f === 'sets' ? Math.max(1, parseInt(t.value, 10) || 1) : t.value;
      }
    },
    actions: {
      add() { pickExercise((exId) => { d.items.push({ exId, sets: 3, reps: '8-12' }); draw(); }); },
      up(el) { move(+el.dataset.i, -1); },
      down(el) { move(+el.dataset.i, 1); },
      rm(el) { d.items.splice(+el.dataset.i, 1); draw(); },
      save() {
        d.name = d.name.trim();
        if (!d.name) return toast('Ponle nombre al día');
        if (orig) Object.assign(orig, d); else state.days.push(d);
        persist();
        closeSheet();
        render(true);
        toast(orig ? 'Guardado ✅' : 'Día creado ✅ Ahora asígnalo en “Mi semana”');
      },
      del() {
        if (!confirm(`¿Borrar "${orig.name}"?`)) return;
        state.days = state.days.filter((x) => x.id !== orig.id);
        for (const k in state.schedule) if (state.schedule[k] === orig.id) state.schedule[k] = null;
        persist();
        closeSheet();
        render(true);
      },
    },
  });
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= d.items.length) return;
    [d.items[i], d.items[j]] = [d.items[j], d.items[i]];
    draw();
  };
  function draw() {
    s.body.innerHTML = `<h2>${orig ? 'Editar día' : 'Nuevo día'}</h2>
      <label class="field"><span>Nombre del día</span><input class="input" data-f="name" value="${esc(d.name)}" placeholder="Ej. Pecho y tríceps"></label>
      <p class="label" style="margin-top:18px">Ejercicios</p>
      ${d.items.length ? `<ul class="items">${d.items.map((it, i) => `<li class="item">
        <div class="item-top"><b>${esc(exName(it.exId))}</b>
          <div class="row">
            <button class="icon-btn sm" data-action="up" data-i="${i}" aria-label="Subir" ${i === 0 ? 'disabled style="opacity:.3"' : ''}>↑</button>
            <button class="icon-btn sm" data-action="down" data-i="${i}" aria-label="Bajar" ${i === d.items.length - 1 ? 'disabled style="opacity:.3"' : ''}>↓</button>
            <button class="icon-btn sm" data-action="rm" data-i="${i}" aria-label="Quitar">✕</button>
          </div></div>
        <div class="item-fields">
          <label><input class="input sm" inputmode="numeric" data-item="${i}:sets" value="${it.sets}"><span>series</span></label>
          <label><input class="input sm" data-item="${i}:reps" value="${esc(it.reps)}"><span>reps</span></label>
        </div></li>`).join('')}</ul>` : `<p class="muted">Aún no hay ejercicios en este día.</p>`}
      <button class="btn" data-action="add">+ Agregar ejercicio</button>
      <button class="btn primary big" data-action="save">Guardar</button>
      ${orig ? `<button class="btn ghost danger" data-action="del">Borrar este día</button>` : ''}`;
  }
  draw();
}

function bodySheet(id) {
  const orig = state.body.find((b) => b.id === id);
  const prev = state.body[state.body.length - 1];
  const d = orig ? clone(orig) : { id: uid(), date: dateStr() };
  openSheet(`<h2>${orig ? 'Editar registro' : 'Registrar medidas'}</h2>
    <label class="field"><span>Fecha</span><input class="input" type="date" data-f="date" value="${d.date}" max="${dateStr()}"></label>
    <div class="grid2">
      ${METRICS.map(([k, l, u]) => `<label class="field"><span>${l} (${u})</span>
        <input class="input" inputmode="decimal" data-f="${k}" value="${d[k] ?? ''}" placeholder="${prev && prev[k] != null ? fmtNum(prev[k]) : ''}"></label>`).join('')}
    </div>
    <label class="field"><span>Notas</span><input class="input" data-f="notas" value="${esc(d.notas || '')}" placeholder="Opcional"></label>
    <p class="muted small">Llena solo lo que tengas. Tip: pésate siempre a la misma hora, en ayunas.</p>
    <button class="btn primary big" data-action="save">Guardar</button>
    ${orig ? `<button class="btn ghost danger" data-action="del">Borrar registro</button>` : ''}`, {
    onInput(t) { if (t.dataset.f) d[t.dataset.f] = t.value; },
    actions: {
      save() {
        if (!d.date) return toast('Elige la fecha');
        METRICS.forEach(([k]) => { d[k] = num(d[k]); });
        if (!METRICS.some(([k]) => d[k] != null)) return toast('Escribe al menos un dato');
        if (orig) Object.assign(orig, d); else state.body.push(d);
        migrate(state);
        persist();
        closeSheet();
        render(true);
        toast('Guardado ✅');
      },
      del() {
        if (!confirm('¿Borrar este registro?')) return;
        state.body = state.body.filter((b) => b.id !== orig.id);
        persist();
        closeSheet();
        render(true);
      },
    },
  });
}

function workoutSheet(id) {
  const w = state.workouts.find((x) => x.id === id);
  if (!w) return;
  openSheet(`<p class="label">${fmtDate(w.date)}${w.end ? ' · ' + fmtDur(w.end - w.start) : ''}</p><h2>${esc(w.dayName)}</h2>
    ${w.entries.map((e) => `<div class="card" style="background:var(--card2)">
      <div class="row between"><h3>${esc(exName(e.exId))}</h3>${exById(e.exId) ? `<button class="btn sm ghost" data-action="ex-open" data-id="${e.exId}">Ver</button>` : ''}</div>
      <p class="muted">${e.sets.map((s, i) => `${i + 1}) ${s.w ? fmtNum(s.w) + ' kg × ' : ''}${s.r} reps`).join('<br>')}</p></div>`).join('')}
    <p class="muted center">Volumen total: <b>${fmtNum(volume(w), 0)} kg</b></p>
    <button class="btn ghost danger" data-action="del">Borrar entrenamiento</button>`, {
    actions: {
      del() {
        if (!confirm('¿Borrar este entrenamiento del historial?')) return;
        state.workouts = state.workouts.filter((x) => x.id !== id);
        persist();
        closeSheet();
        render(true);
      },
    },
  });
}

function alturaSheet() {
  let v = state.profile.altura ?? '';
  openSheet(`<h2>Tu altura</h2>
    <label class="field"><span>Altura en centímetros</span><input class="input" inputmode="decimal" data-f="alt" value="${v}" placeholder="Ej. 175"></label>
    <button class="btn primary big" data-action="save">Guardar</button>`, {
    onInput(t) { v = t.value; },
    actions: {
      save() {
        const n = num(v);
        if (n != null && (n < 80 || n > 250)) return toast('Escríbela en centímetros (ej. 175)');
        state.profile.altura = n;
        persist(); closeSheet(); render(true);
      },
    },
  });
}

async function settingsSheet() {
  const s = openSheet(`<h2>Ajustes</h2>
    <label class="field"><span>Descanso entre series (segundos)</span>
      <input class="input" inputmode="numeric" data-f="descanso" value="${state.profile.descanso}"></label>
    <h3>Respaldo</h3>
    <p class="muted small">Todo vive solo en este cel. Si borras la app o cambias de cel, se pierde. Haz un respaldo de vez en cuando y guárdalo (WhatsApp, Drive, correo…). Los videos no van en el respaldo.</p>
    <div class="row gap"><button class="btn" data-action="export">Guardar respaldo</button><button class="btn" data-action="import">Cargar respaldo</button></div>
    <p class="muted small" data-usage></p>
    <h3>Instalar en tu cel</h3>
    <p class="muted small"><b>iPhone:</b> abre la página en Safari → botón Compartir → “Agregar a pantalla de inicio”.<br>
    <b>Android:</b> abre la página en Chrome → menú ⋮ → “Instalar app”.<br>
    Después ábrela desde el ícono: funciona sin internet.</p>
    <h3>Zona peligrosa</h3>
    <button class="btn ghost danger" data-action="wipe">Borrar todos mis datos</button>
    <p class="muted small center mt">Mi Rutina · funciona 100% sin internet</p>`, {
    onInput(t) {
      if (t.dataset.f === 'descanso') { const n = parseInt(t.value, 10); if (n > 0) { state.profile.descanso = n; persist(); } }
    },
    actions: {
      export: exportData,
      import: importData,
      async wipe() {
        if (!confirm('¿Borrar TODO? Rutina, historial, medidas y videos. No se puede deshacer.')) return;
        if (!confirm('¿Seguro seguro?')) return;
        try { await idb('videos', 'readwrite', (st) => st.clear()); } catch (e) { /* nada */ }
        videoIds.clear();
        state = migrate(defaultState());
        stopRest();
        await flush();
        closeSheet();
        ui.tab = 'hoy';
        render();
        toast('Listo, empezamos de cero');
      },
    },
  });
  try {
    const est = await navigator.storage?.estimate?.();
    const persisted = await navigator.storage?.persisted?.();
    if (est) $('[data-usage]', s.el).textContent = `Espacio usado: ${fmtNum(est.usage / 1048576)} MB${persisted ? ' · almacenamiento protegido ✅' : ''}`;
  } catch (e) { /* nada */ }
}

async function exportData() {
  await flush();
  const data = JSON.stringify({ app: 'mi-rutina', exportado: new Date().toISOString(), state });
  const name = `mi-rutina-respaldo-${dateStr()}.json`;
  const file = new File([data], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Respaldo Mi Rutina' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

function importData() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'application/json,.json';
  inp.style.display = 'none';
  document.body.appendChild(inp);
  inp.onchange = async () => {
    const f = inp.files[0];
    inp.remove();
    if (!f) return;
    try {
      const obj = JSON.parse(await f.text());
      const s = obj.state || obj;
      if (!Array.isArray(s.exercises) || !Array.isArray(s.workouts)) throw new Error('formato');
      if (!confirm('Esto reemplaza tus datos actuales con los del respaldo. ¿Continuar?')) return;
      state = migrate(s);
      await flush();
      closeSheet();
      render();
      toast('Respaldo cargado ✅');
    } catch (e) {
      toast('Ese archivo no es un respaldo válido');
    }
  };
  inp.click();
}

/* ---------- instalar ---------- */
let deferredPrompt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; if (ui.tab === 'hoy' && !state.active) render(true); });
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function installCard() {
  if (isStandalone() || state.profile.hideInstall) return '';
  const how = isIOS
    ? 'En Safari toca <b>Compartir</b> y luego <b>Agregar a pantalla de inicio</b>.'
    : deferredPrompt ? 'Ábrela como app y úsala sin internet.' : 'En Chrome toca el menú <b>⋮</b> → <b>Instalar app</b>.';
  return `<div class="card install"><div><b>📲 Instálala en tu cel</b><p class="small muted">${how}</p></div>
    <div class="row gap">${deferredPrompt ? '<button class="btn sm primary" data-action="install">Instalar</button>' : ''}
    <button class="btn sm ghost" data-action="hide-install">Ocultar</button></div></div>`;
}

/* =========================================================
   Gráfica de línea (SVG, sin librerías)
   ========================================================= */
let chartN = 0;
function lineChart(pts, unit, label) {
  if (pts.length < 2) return `<p class="muted small chart-empty">Registra al menos 2 veces para ver tu gráfica 📈</p>`;
  const W = 320, H = 170, P = { l: 36, r: 12, t: 14, b: 24 };
  const xs = pts.map((p) => parseDate(p.x).getTime());
  const ys = pts.map((p) => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 864e5; x1 += 864e5; }
  const ymin = Math.min(...ys), ymax = Math.max(...ys);
  const padY = (ymax - ymin) * 0.2 || Math.max(1, ymax * 0.05);
  const y0 = ymin - padY, y1 = ymax + padY;
  const X = (t) => P.l + ((t - x0) / (x1 - x0)) * (W - P.l - P.r);
  const Y = (v) => P.t + (1 - (v - y0) / (y1 - y0)) * (H - P.t - P.b);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(xs[i]).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  const area = `${line}L${X(xs[xs.length - 1]).toFixed(1)},${H - P.b}L${X(xs[0]).toFixed(1)},${H - P.b}Z`;
  const id = `cg${++chartN}`;
  const ticks = [ymin, (ymin + ymax) / 2, ymax].filter((v, i, a) => i === 0 || v !== a[i - 1]);
  const dots = pts.length <= 40 ? pts.map((p, i) => `<circle cx="${X(xs[i]).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${i === pts.length - 1 ? 4.5 : 2.5}" style="fill:${i === pts.length - 1 ? 'var(--accent)' : 'var(--card)'};stroke:var(--accent);stroke-width:2"/>`).join('') : '';
  const last = pts[pts.length - 1], first = pts[0];
  const diff = last.y - first.y;
  return `<div class="row between" style="margin-top:12px"><span class="muted small">${esc(label || '')}</span>
      <span class="small"><b>${fmtNum(last.y)} ${unit}</b> <span class="muted">(${diff > 0 ? '+' : ''}${fmtNum(diff)})</span></span></div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label || 'Gráfica')}: de ${fmtNum(first.y)} a ${fmtNum(last.y)} ${unit}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.35"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs>
    ${ticks.map((v) => `<line class="grid" x1="${P.l}" x2="${W - P.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text x="${P.l - 6}" y="${(Y(v) + 3.5).toFixed(1)}" text-anchor="end">${fmtNum(v)}</text>`).join('')}
    <path d="${area}" fill="url(#${id})"/>
    <path d="${line}" fill="none" style="stroke:var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    <text x="${P.l}" y="${H - 6}">${fmtDateShort(first.x)}</text>
    <text x="${W - P.r}" y="${H - 6}" text-anchor="end">${fmtDateShort(last.x)}</text>
  </svg>`;
}

/* =========================================================
   Toast
   ========================================================= */
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.classList.remove('show'); setTimeout(() => { t.hidden = true; }, 300); }, 2800);
}

/* =========================================================
   Acciones (botones)
   ========================================================= */
const ACTIONS = {
  tab(el) { ui.tab = el.dataset.tab; render(); },
  settings: settingsSheet,
  'load-example'() { if (!state.days.length) loadExample(); ui.tab = 'hoy'; render(); toast('Rutina de ejemplo lista ✅ Cámbiala en “Rutina”'); },
  start(el) {
    if (state.active) return toast('Ya tienes un entrenamiento en curso');
    startWorkout(el.dataset.day);
  },
  'ex-open'(el) { exerciseSheet(el.dataset.id); },
  'ex-new'() { editExerciseSheet(null, (ex) => exerciseSheet(ex.id)); },
  'ex-group'(el) { ui.exGroup = el.dataset.g; render(true); },
  'set-done'(el) {
    const ei = +el.dataset.ei, si = +el.dataset.si;
    const s = state.active.entries[ei].sets[si];
    if (!s.done) {
      const [wi, ri] = $$('input', el.closest('.set-row'));
      if (s.w === '' && num(wi.placeholder) != null) s.w = wi.placeholder;
      if (s.r === '' && num(ri.placeholder) != null) s.r = ri.placeholder;
      s.done = true;
      startRest();
    } else {
      s.done = false;
    }
    persist();
    render(true);
  },
  'set-add'(el) {
    const sets = state.active.entries[+el.dataset.ei].sets;
    const prev = sets[sets.length - 1];
    sets.push({ w: prev?.w ?? '', r: prev?.r ?? '', done: false });
    persist(); render(true);
  },
  'set-del'(el) {
    const sets = state.active.entries[+el.dataset.ei].sets;
    if (sets.length > 1) sets.pop();
    persist(); render(true);
  },
  'wk-remove-ex'(el) {
    const en = state.active.entries[+el.dataset.ei];
    if (en.sets.some((s) => s.done) && !confirm(`¿Quitar ${exName(en.exId)} de este entrenamiento?`)) return;
    state.active.entries.splice(+el.dataset.ei, 1);
    persist(); render(true);
  },
  'wk-add-ex'() {
    pickExercise((exId) => { state.active.entries.push(newEntry(exId, 3, '')); persist(); render(true); setTimeout(() => scrollTo(0, document.body.scrollHeight), 50); });
  },
  'wk-cancel'() {
    if (!confirm('¿Descartar este entrenamiento? No se guardará nada.')) return;
    state.active = null; stopRest(); persist(); render();
  },
  'wk-finish': finishWorkout,
  'rest-add'(el) { rest.end += +el.dataset.s * 1000; rest.total = Math.max(rest.total, Math.ceil((rest.end - Date.now()) / 1000)); rest.fired = false; tick(); },
  'rest-stop': stopRest,
  'day-new'() { dayEditSheet(null); },
  'day-edit'(el) { dayEditSheet(el.dataset.id); },
  altura: alturaSheet,
  'body-new'() { bodySheet(null); },
  'body-edit'(el) { bodySheet(el.dataset.id); },
  metric(el) { ui.metric = el.dataset.k; render(true); },
  'workout-open'(el) { workoutSheet(el.dataset.id); },
  async install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => {});
    deferredPrompt = null;
    render(true);
  },
  'hide-install'() { state.profile.hideInstall = true; persist(); render(true); },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const name = el.dataset.action;
  const s = sheetFor(el);
  if (s) {
    if (name === 'sheet-close') return closeSheet();
    if (s.actions?.[name]) return s.actions[name](el, e);
  }
  ACTIONS[name]?.(el, e);
});

function onField(e) {
  const t = e.target;
  const s = sheetFor(t);
  if (s) { s.onInput?.(t, e); return; }
  if (t.dataset.set && state.active) {
    const [ei, si, f] = t.dataset.set.split(':');
    const set = state.active.entries[ei]?.sets[si];
    if (set) { set[f] = t.value; persist(); }
  } else if (t.dataset.sched !== undefined) {
    state.schedule[t.dataset.sched] = t.value || null;
    persist();
  } else if (t.matches('[data-exq]')) {
    ui.exQ = t.value;
    $('#exlist').innerHTML = exerciseListHtml(ui.exQ, ui.exGroup, 'ex-open');
  }
}
document.addEventListener('input', onField);
document.addEventListener('change', onField);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheets.length) closeSheet(); });

/* =========================================================
   Arranque
   ========================================================= */
(async () => {
  await load();
  navigator.storage?.persist?.().catch(() => {});
  render();
  if (!storageOk) toast('⚠️ Este navegador no deja guardar datos (¿modo incógnito?)');
})();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
