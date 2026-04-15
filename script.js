// ── ZONES ──────────────────────────────────────────────
const ZONES = [
  { max: 0,   bar: '#333333', txt: '#666666' },
  { max: 24,  bar: '#E24B4A', txt: '#E24B4A' },
  { max: 49,  bar: '#EF9F27', txt: '#EF9F27' },
  { max: 74,  bar: '#BA7517', txt: '#BA7517' },
  { max: 99,  bar: '#639922', txt: '#639922' },
  { max: 100, bar: '#1D9E75', txt: '#1D9E75' },
];
function getZone(pct) {
  return ZONES.find(z => pct <= z.max) || ZONES[ZONES.length - 1];
}

// ── DATE HELPERS ───────────────────────────────────────
const today = new Date();
today.setHours(0, 0, 0, 0);

function dateKey(d) {
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function formatDate(key) {
  const d = keyToDate(key);
  const isToday = key === todayKey;
  const base = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return isToday ? base + ' — today' : base;
}

const todayKey = dateKey(today);

// ── TRACKER STATE ──────────────────────────────────────
let viewYear = today.getFullYear();
let viewMonth = today.getMonth();
let selKey = todayKey;
let recurringTasks = [];
let oneTasks = {};
let completions = {};

// ── GYM STATE ─────────────────────────────────────────
let gymSelKey = todayKey;
let gymExercises = [];   // recurring: { id, name, cat, days, sets:[{reps,weight}] }
let gymOneEx = {};       // one-off: key -> [{ id, name, cat, sets:[{reps,weight}] }]
let gymLogs = {};        // key -> { exId -> [{reps,weight,done}] }

// ── PERSIST ────────────────────────────────────────────
function load() {
  try {
    const raw = localStorage.getItem('trackerData');
    if (!raw) return;
    const data = JSON.parse(raw);
    recurringTasks = data.recurringTasks || [];
    oneTasks       = data.oneTasks       || {};
    completions    = data.completions    || {};
    gymExercises   = data.gymExercises   || [];
    gymOneEx       = data.gymOneEx       || {};
    gymLogs        = data.gymLogs        || {};
  } catch(e) { console.warn('load error', e); }
}

function save() {
  try {
    localStorage.setItem('trackerData', JSON.stringify({
      recurringTasks, oneTasks, completions,
      gymExercises, gymOneEx, gymLogs
    }));
  } catch(e) { console.warn('save error', e); }
}

// ── TAB SWITCHING ──────────────────────────────────────
let activeTab = 'tracker';
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById('tab-' + activeTab).classList.remove('hidden');
    if (activeTab === 'gym') renderGymAll();
    else if (activeTab === 'progress') {
      renderPRs();
      calculateVolumeStats();
      populateExerciseSelect();
    }
    
    else renderAll();
  });
});

// ══════════════════════════════════════════════════════
// TRACKER (original logic, unchanged)
// ══════════════════════════════════════════════════════
function getTasksForKey(key) {
  const dow = keyToDate(key).getDay();
  const rec = recurringTasks.filter(t => t.days.includes(dow)).map(t => ({ id: t.id, label: t.label, recurring: true }));
  const one = (oneTasks[key] || []).map(t => ({ ...t, recurring: false }));
  return [...rec, ...one];
}
function getPct(key) {
  const tasks = getTasksForKey(key);
  if (!tasks.length) return null;
  const done = tasks.filter(t => (completions[key] || {})[t.id]).length;
  return Math.round(done / tasks.length * 100);
}
function toggleTask(key, id) {
  if (!completions[key]) completions[key] = {};
  completions[key][id] = !completions[key][id];
  renderAll();
}
function deleteTask(id, isRecurring) {
  if (isRecurring) {
    recurringTasks = recurringTasks.filter(t => t.id !== id);
  } else {
    if (oneTasks[selKey]) oneTasks[selKey] = oneTasks[selKey].filter(t => t.id !== id);
  }
  renderAll();
}
function getStreak() {
  let streak = 0;
  const d = new Date(today);
  while (true) {
    const k = dateKey(d);
    if (getPct(k) === 100) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}
function getGymStreak() {
  let streak = 0;
  const d = new Date(today);
  while (true) {
    const k = dateKey(d);
    const { total, done } = gymSetsDone(k);
    if (total > 0 && done === total) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

let selectedRecDays = [];
document.querySelectorAll('.day-toggle[data-d]').forEach(btn => {
  btn.addEventListener('click', () => {
    const d = +btn.dataset.d;
    const i = selectedRecDays.indexOf(d);
    if (i > -1) { selectedRecDays.splice(i, 1); btn.classList.remove('on'); }
    else { selectedRecDays.push(d); btn.classList.add('on'); }
    updateRecHint();
  });
});
function updateRecHint() {
  const hint = document.getElementById('rec-hint');
  if (!selectedRecDays.length) hint.textContent = 'No repeat days — task added to this day only';
  else if (selectedRecDays.length === 7) hint.textContent = 'Repeats every day';
  else {
    const names = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    hint.textContent = 'Repeats every ' + [...selectedRecDays].sort((a,b)=>a-b).map(d=>names[d]).join(', ');
  }
}
function addTask() {
  const inp = document.getElementById('new-task-input');
  const val = inp.value.trim();
  if (!val) return;
  if (selectedRecDays.length > 0) {
    recurringTasks.push({ id: 'r' + Date.now(), label: val, days: [...selectedRecDays] });
    selectedRecDays = [];
    document.querySelectorAll('.day-toggle[data-d]').forEach(b => b.classList.remove('on'));
    updateRecHint();
  } else {
    if (!oneTasks[selKey]) oneTasks[selKey] = [];
    oneTasks[selKey].push({ id: 'o' + Date.now(), label: val });
  }
  inp.value = '';
  renderAll();
}
document.getElementById('add-task-btn').addEventListener('click', addTask);
document.getElementById('new-task-input').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });

function renderCalendar() {
  const grid = document.getElementById('cal-grid');
  Array.from(grid.querySelectorAll('.day-cell, .empty-cell')).forEach(c => c.remove());
  document.getElementById('month-lbl').textContent =
    new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  for (let i = 0; i < firstDow; i++) {
    const e = document.createElement('div'); e.className = 'day-cell empty'; grid.appendChild(e);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = dateKey(new Date(viewYear, viewMonth, d));
    const pct = getPct(key);
    const cell = document.createElement('div');
    let cls = 'day-cell';
    if (key === todayKey) cls += ' today';
    if (key === selKey) cls += ' selected';
    cell.className = cls;
    const numEl = document.createElement('div'); numEl.className = 'day-num'; numEl.textContent = d; cell.appendChild(numEl);
    if (pct !== null) {
      const z = getZone(pct);
      const dot = document.createElement('div'); dot.className = 'day-dot'; dot.style.background = z.bar; cell.appendChild(dot);
      const pctEl = document.createElement('div'); pctEl.className = 'day-pct'; pctEl.textContent = pct + '%'; pctEl.style.color = z.txt; cell.appendChild(pctEl);
      if (key === selKey) cell.style.borderColor = z.bar;
    }
    cell.addEventListener('click', () => { selKey = key; renderAll(); });
    grid.appendChild(cell);
  }
}

function renderDayPanel() {
  const tasks = getTasksForKey(selKey);
  const done = tasks.filter(t => (completions[selKey] || {})[t.id]).length;
  const total = tasks.length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const z = getZone(total ? pct : 0);
  document.getElementById('sel-date-lbl').textContent = formatDate(selKey);
  document.getElementById('sel-sub').textContent = total ? done + ' of ' + total + ' tasks done' : 'no tasks yet';
  const badge = document.getElementById('pct-num');
  if (total) { badge.textContent = pct + '%'; badge.style.color = z.txt; }
  else { badge.textContent = '—'; badge.style.color = 'var(--text-dim)'; }
  const fill = document.getElementById('bar-fill');
  fill.style.width = (total ? pct : 0) + '%'; fill.style.backgroundColor = z.bar;
  const streak = getStreak();
  const pill = document.getElementById('streak-pill');
  if (streak > 0) { pill.textContent = streak + ' day streak'; pill.classList.add('active'); }
  else { pill.textContent = 'no streak'; pill.classList.remove('active'); }
  const list = document.getElementById('task-list'); list.innerHTML = '';
  if (!tasks.length) {
    const e = document.createElement('div'); e.className = 'empty-state'; e.textContent = 'nothing here yet — add a task below'; list.appendChild(e); return;
  }
  tasks.forEach(t => {
    const isDone = !!(completions[selKey] || {})[t.id];
    const el = document.createElement('div'); el.className = 'task' + (isDone ? ' done' : '');
    const circ = document.createElement('div'); circ.className = 'task-circ';
    if (isDone) { circ.style.background = z.bar; circ.style.borderColor = z.bar; }
    const ck = document.createElement('div'); ck.className = 'task-check'; circ.appendChild(ck);
    const lbl = document.createElement('span'); lbl.className = 't-lbl'; lbl.textContent = t.label;
    const del = document.createElement('button'); del.className = 'del-btn'; del.innerHTML = '&#10005;';
    del.addEventListener('click', e => { e.stopPropagation(); deleteTask(t.id, t.recurring); });
    const toggle = () => toggleTask(selKey, t.id);
    circ.addEventListener('click', toggle); lbl.addEventListener('click', toggle);
    el.appendChild(circ); el.appendChild(lbl);
    if (t.recurring) { const tag = document.createElement('span'); tag.className = 'rec-tag'; tag.textContent = 'recurring'; el.appendChild(tag); }
    el.appendChild(del); list.appendChild(el);
  });
}

function renderAll() {
  save(); renderCalendar(); renderDayPanel();
}

document.getElementById('prev-btn').addEventListener('click', () => {
  viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } renderAll();
});
document.getElementById('next-btn').addEventListener('click', () => {
  viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } renderAll();
});

// ══════════════════════════════════════════════════════
// GYM TAB LOGIC
// ══════════════════════════════════════════════════════

const CAT_COLORS = {
  push:   { bg: '#2a1a15', border: '#993C1D', text: '#E8896A' },
  pull:   { bg: '#0e1a26', border: '#185FA5', text: '#5FA8E8' },
  legs:   { bg: '#111e0e', border: '#3B6D11', text: '#7DBF44' },
  core:   { bg: '#1a1520', border: '#534AB7', text: '#9B94E8' },
  cardio: { bg: '#1a150e', border: '#854F0B', text: '#EF9F27' },
};

function getExercisesForKey(key) {
  const dow = keyToDate(key).getDay();
  const rec = gymExercises.filter(e => e.days.includes(dow)).map(e => ({ ...e, recurring: true }));
  const one = (gymOneEx[key] || []).map(e => ({ ...e, recurring: false }));
  return [...rec, ...one];
}

function getGymLog(key, exId, numSets, defaultSets) {
  if (!gymLogs[key]) gymLogs[key] = {};
  if (!gymLogs[key][exId]) {
    gymLogs[key][exId] = defaultSets.map(s => ({ reps: s.reps, weight: s.weight, done: false }));
  }
  // ensure right number of sets
  while (gymLogs[key][exId].length < numSets) {
    const last = gymLogs[key][exId][gymLogs[key][exId].length - 1] || { reps: 8, weight: 0 };
    gymLogs[key][exId].push({ reps: last.reps, weight: last.weight, done: false });
  }
  return gymLogs[key][exId];
}

function gymSetsDone(key) {
  const exs = getExercisesForKey(key);
  let total = 0, done = 0;
  exs.forEach(ex => {
    const log = getGymLog(key, ex.id, ex.sets.length, ex.sets);
    total += log.length;
    done += log.filter(s => s.done).length;
  });
  return { total, done };
}

function getPR(exId) {
  let pr = 0;
  Object.values(gymLogs).forEach(dayLog => {
    if (dayLog[exId]) dayLog[exId].forEach(s => { if (s.done && s.weight > pr) pr = s.weight; });
  });
  return pr;
}

// Gym nav
let gymNavDate = new Date(today);
function gymNavKey() { return dateKey(gymNavDate); }

document.getElementById('gym-prev-btn').addEventListener('click', () => {
  gymNavDate.setDate(gymNavDate.getDate() - 1);
  gymSelKey = gymNavKey();
  renderGymAll();
});
document.getElementById('gym-next-btn').addEventListener('click', () => {
  gymNavDate.setDate(gymNavDate.getDate() + 1);
  gymSelKey = gymNavKey();
  renderGymAll();
});

// Category toggle
let selectedCat = 'push';
document.querySelectorAll('.cat-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedCat = btn.dataset.cat;
    document.querySelectorAll('.cat-toggle').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Gym day toggles
let gymRecDays = [];
document.querySelectorAll('.day-toggle[data-gd]').forEach(btn => {
  btn.addEventListener('click', () => {
    const d = +btn.dataset.gd;
    const i = gymRecDays.indexOf(d);
    if (i > -1) { gymRecDays.splice(i, 1); btn.classList.remove('on'); }
    else { gymRecDays.push(d); btn.classList.add('on'); }
    updateGymRecHint();
  });
});
function updateGymRecHint() {
  const hint = document.getElementById('gym-rec-hint');
  if (!gymRecDays.length) hint.textContent = 'No repeat days — exercise added to this day only';
  else if (gymRecDays.length === 7) hint.textContent = 'Repeats every day';
  else {
    const names = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    hint.textContent = 'Repeats every ' + [...gymRecDays].sort((a,b)=>a-b).map(d=>names[d]).join(', ');
  }
}

function addExercise() {
  const inp = document.getElementById('new-ex-input');
  const name = inp.value.trim();
  if (!name) return;
  const sets = parseInt(document.getElementById('def-sets').value) || 3;
  const reps = parseInt(document.getElementById('def-reps').value) || 8;
  const weight = parseFloat(document.getElementById('def-weight').value) || 0;
  const defaultSets = Array.from({ length: sets }, () => ({ reps, weight }));
  if (gymRecDays.length > 0) {
    gymExercises.push({ id: 'ge' + Date.now(), name, cat: selectedCat, days: [...gymRecDays], sets: defaultSets });
    gymRecDays = [];
    document.querySelectorAll('.day-toggle[data-gd]').forEach(b => b.classList.remove('on'));
    updateGymRecHint();
  } else {
    if (!gymOneEx[gymSelKey]) gymOneEx[gymSelKey] = [];
    gymOneEx[gymSelKey].push({ id: 'goe' + Date.now(), name, cat: selectedCat, sets: defaultSets });
  }
  inp.value = '';
  renderGymAll();
}
document.getElementById('add-ex-btn').addEventListener('click', addExercise);
document.getElementById('new-ex-input').addEventListener('keydown', e => { if (e.key === 'Enter') addExercise(); });

function deleteExercise(id, recurring) {
  if (recurring) {
    gymExercises = gymExercises.filter(e => e.id !== id);
  } else {
    if (gymOneEx[gymSelKey]) gymOneEx[gymSelKey] = gymOneEx[gymSelKey].filter(e => e.id !== id);
  }
  renderGymAll();
}

function addSet(exId, recurring) {
  const log = gymLogs[gymSelKey] && gymLogs[gymSelKey][exId];
  if (!log) return;
  const last = log[log.length - 1] || { reps: 8, weight: 0 };
  log.push({ reps: last.reps, weight: last.weight, done: false });
  // also extend the template sets count for recurring
  if (recurring) {
    const ex = gymExercises.find(e => e.id === exId);
    if (ex) ex.sets.push({ reps: last.reps, weight: last.weight });
  }
  renderGymAll();
}

function renderGymAll() {
  save();
  const key = gymSelKey;
  
  // Get total and done FIRST (this was missing)
  const { total, done } = gymSetsDone(key);
  
  // Date label
  document.getElementById('gym-date-lbl').textContent =
    keyToDate(key).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
  document.getElementById('gym-sel-date').textContent = formatDate(key);

  // Summary
  const pct = total ? Math.round(done / total * 100) : 0;
  const z = getZone(total ? pct : 0);
  document.getElementById('gym-sel-sub').textContent = total ? done + ' of ' + total + ' sets done' : 'no exercises yet';
  const badge = document.getElementById('gym-pct-num');
  if (total) { badge.textContent = done + '/' + total; badge.style.color = z.txt; }
  else { badge.textContent = '—'; badge.style.color = 'var(--text-dim)'; }
  const fill = document.getElementById('gym-bar-fill');
  fill.style.width = (total ? pct : 0) + '%'; fill.style.backgroundColor = z.bar;
  
  // Gym streak
  const gymStreak = getGymStreak();
  const pill = document.getElementById('streak-pill');
  if (gymStreak > 0) { pill.textContent = gymStreak + ' day streak'; pill.classList.add('active'); }
  else { pill.textContent = 'no streak'; pill.classList.remove('active'); }

  // Exercise list
  const list = document.getElementById('exercise-list');
  list.innerHTML = '';
  const exs = getExercisesForKey(key);

  if (!exs.length) {
    const e = document.createElement('div'); e.className = 'empty-state'; e.textContent = 'no exercises yet — add one below'; list.appendChild(e); return;
  }

  exs.forEach(ex => {
    const log = getGymLog(key, ex.id, ex.sets.length, ex.sets);
    const c = CAT_COLORS[ex.cat] || CAT_COLORS.push;
    const pr = getPR(ex.id);

    const card = document.createElement('div');
    card.className = 'ex-card';
    card.style.borderColor = c.border;
    card.style.background = c.bg;

    // Header
    const hdr = document.createElement('div'); hdr.className = 'ex-header';
    const nameEl = document.createElement('span'); nameEl.className = 'ex-name'; nameEl.textContent = ex.name;
    const catBadge = document.createElement('span'); catBadge.className = 'cat-badge';
    catBadge.textContent = ex.cat; catBadge.style.color = c.text; catBadge.style.borderColor = c.border;
    const delBtn = document.createElement('button'); delBtn.className = 'del-btn'; delBtn.innerHTML = '&#10005;';
    delBtn.style.opacity = '1';
    delBtn.addEventListener('click', () => deleteExercise(ex.id, ex.recurring));

    if (pr > 0) {
      const prPill = document.createElement('span'); prPill.className = 'pr-pill'; prPill.textContent = 'PR ' + pr + ' lbs'; 
      hdr.appendChild(nameEl); hdr.appendChild(prPill); hdr.appendChild(catBadge); hdr.appendChild(delBtn);
    } else {
      hdr.appendChild(nameEl); hdr.appendChild(catBadge); hdr.appendChild(delBtn);
    }
    card.appendChild(hdr);

    // Sets table
    const table = document.createElement('table'); table.className = 'sets-table';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Set</th><th>Reps</th><th>Weight (lbs)</th><th></th></table>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');

    log.forEach((s, i) => {
      const row = document.createElement('tr');

      const setNumTd = document.createElement('td');
      setNumTd.className = 'set-num'; setNumTd.textContent = i + 1; row.appendChild(setNumTd);

      const repsTd = document.createElement('td');
      const repsIn = document.createElement('input'); repsIn.type = 'number'; repsIn.className = 'set-input'; repsIn.value = s.reps; repsIn.min = 1; repsIn.max = 999;
      repsIn.addEventListener('change', () => { log[i].reps = parseInt(repsIn.value) || 0; save(); renderGymAll(); });
      repsTd.appendChild(repsIn); row.appendChild(repsTd);

      const wtTd = document.createElement('td');
      const wtIn = document.createElement('input'); wtIn.type = 'number'; wtIn.className = 'set-input'; wtIn.value = s.weight; wtIn.min = 0; wtIn.max = 9999; wtIn.step = 2.5;
      wtIn.addEventListener('change', () => { log[i].weight = parseFloat(wtIn.value) || 0; save(); renderGymAll(); });
      wtTd.appendChild(wtIn); row.appendChild(wtTd);

      const doneTd = document.createElement('td');
      const circ = document.createElement('div'); circ.className = 'task-circ' + (s.done ? ' set-done-circ' : '');
      if (s.done) { circ.style.background = '#1D9E75'; circ.style.borderColor = '#1D9E75'; }
      const ck = document.createElement('div'); ck.className = 'task-check'; if (s.done) ck.style.display = 'block'; circ.appendChild(ck);
      circ.addEventListener('click', () => {
        log[i].done = !log[i].done;
        renderGymAll();
      });
      doneTd.appendChild(circ); row.appendChild(doneTd);
      tbody.appendChild(row);
    });

    table.appendChild(tbody); card.appendChild(table);

    const addSetBtn = document.createElement('button'); addSetBtn.className = 'add-set-btn'; addSetBtn.textContent = '+ add set';
    addSetBtn.addEventListener('click', () => addSet(ex.id, ex.recurring));
    card.appendChild(addSetBtn);

    if (ex.recurring) {
      const tag = document.createElement('span'); tag.className = 'rec-tag'; tag.style.marginTop = '8px'; tag.textContent = 'recurring'; card.appendChild(tag);
    }

    list.appendChild(card);
  });
}

// ── REST TIMER ─────────────────────────────────────────
let timerSecs = 90;
let timerRemaining = 90;
let timerRunning = false;
let timerInterval = null;

function fmtTime(s) {
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
function updateTimerDisp() {
  document.getElementById('timer-disp').textContent = fmtTime(timerRunning ? timerRemaining : timerSecs);
}

document.getElementById('timer-minus').addEventListener('click', () => {
  if (timerRunning) return;
  timerSecs = Math.max(15, timerSecs - 15); updateTimerDisp();
});
document.getElementById('timer-plus').addEventListener('click', () => {
  if (timerRunning) return;
  timerSecs = Math.min(600, timerSecs + 15); updateTimerDisp();
});
document.getElementById('timer-start-btn').addEventListener('click', () => {
  const btn = document.getElementById('timer-start-btn');
  if (timerRunning) {
    clearInterval(timerInterval); timerRunning = false; btn.textContent = 'start'; btn.classList.remove('timer-stop'); updateTimerDisp();
  } else {
    timerRemaining = timerSecs; timerRunning = true; btn.textContent = 'stop'; btn.classList.add('timer-stop');
    timerInterval = setInterval(() => {
      timerRemaining--;
      updateTimerDisp();
      if (timerRemaining <= 0) {
        clearInterval(timerInterval); timerRunning = false; btn.textContent = 'start'; btn.classList.remove('timer-stop');
        document.getElementById('timer-disp').textContent = 'GO!';
        setTimeout(() => updateTimerDisp(), 1200);
      }
    }, 1000);
  }
});

// ── PROGRESS TAB FUNCTIONS ──

function getAllPRs() {
  const prs = {};
  
  // Get all unique exercise IDs from logs
  const allExIds = new Set();
  Object.values(gymLogs).forEach(dayLog => {
    Object.keys(dayLog).forEach(exId => allExIds.add(exId));
  });
  
  // Find PR for each exercise
  allExIds.forEach(exId => {
    let bestWeight = 0;
    let bestDate = null;
    let bestReps = 0;
    let exerciseName = '';
    
    // Find the exercise name from recurring or one-off
    const recurringEx = gymExercises.find(e => e.id === exId);
    if (recurringEx) exerciseName = recurringEx.name;
    
    if (!exerciseName) {
      for (const key in gymOneEx) {
        const ex = gymOneEx[key].find(e => e.id === exId);
        if (ex) {
          exerciseName = ex.name;
          break;
        }
      }
    }
    
    // Check all logs for this exercise
    Object.entries(gymLogs).forEach(([dateKey, dayLog]) => {
      if (dayLog[exId]) {
        dayLog[exId].forEach(set => {
          if (set.done && set.weight > bestWeight) {
            bestWeight = set.weight;
            bestDate = dateKey;
            bestReps = set.reps;
          }
        });
      }
    });
    
    if (bestWeight > 0 && exerciseName) {
      prs[exId] = {
        name: exerciseName,
        weight: bestWeight,
        reps: bestReps,
        date: bestDate
      };
    }
  });
  
  return prs;
}

function renderPRs() {
  const prs = getAllPRs();
  const container = document.getElementById('pr-list');
  
  if (Object.keys(prs).length === 0) {
    container.innerHTML = '<div class="empty-state">No PRs yet — complete some sets to set records!</div>';
    return;
  }
  
  // Sort by weight descending
  const sorted = Object.values(prs).sort((a, b) => b.weight - a.weight);
  
  container.innerHTML = sorted.map(pr => `
    <div class="pr-card" style="border-left-color: var(--orange)">
      <div>
        <div class="pr-name">${escapeHtml(pr.name)}</div>
        <div class="pr-date">${formatDate(pr.date)}</div>
      </div>
      <div class="pr-value">
        <span class="pr-weight">${pr.weight}</span>
        <span class="pr-unit">lbs × ${pr.reps} reps</span>
      </div>
    </div>
  `).join('');
}

function calculateVolumeStats() {
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  let totalVolume = 0;
  let totalSets = 0;
  const workoutDays = new Set();
  
  Object.entries(gymLogs).forEach(([dateKey, dayLog]) => {
    const date = keyToDate(dateKey);
    if (date >= thirtyDaysAgo) {
      let dayHasWorkout = false;
      
      Object.values(dayLog).forEach(sets => {
        sets.forEach(set => {
          if (set.done) {
            totalVolume += set.weight * set.reps;
            totalSets++;
            dayHasWorkout = true;
          }
        });
      });
      
      if (dayHasWorkout) workoutDays.add(dateKey);
    }
  });
  
  document.getElementById('total-volume').textContent = totalVolume.toLocaleString();
  document.getElementById('total-sets').textContent = totalSets;
  document.getElementById('total-workouts').textContent = workoutDays.size;
}

function populateExerciseSelect() {
  const select = document.getElementById('history-ex-select');
  const exercises = new Map();
  
  // Get all recurring exercises
  gymExercises.forEach(ex => {
    exercises.set(ex.id, ex.name);
  });
  
  // Get all one-off exercises
  Object.values(gymOneEx).forEach(exList => {
    exList.forEach(ex => {
      exercises.set(ex.id, ex.name);
    });
  });
  
  const sorted = Array.from(exercises.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  
  select.innerHTML = '<option value="">Select an exercise...</option>' + 
    sorted.map(([id, name]) => `<option value="${id}">${escapeHtml(name)}</option>`).join('');
  
  select.onchange = () => {
    if (select.value) {
      renderExerciseHistory(select.value);
    } else {
      document.getElementById('exercise-history').innerHTML = '<div class="empty-state">Select an exercise to see history</div>';
    }
  };
}

function renderExerciseHistory(exId) {
  const history = [];
  let exerciseName = '';
  
  // Find exercise name
  const recurringEx = gymExercises.find(e => e.id === exId);
  if (recurringEx) exerciseName = recurringEx.name;
  
  if (!exerciseName) {
    for (const key in gymOneEx) {
      const ex = gymOneEx[key].find(e => e.id === exId);
      if (ex) {
        exerciseName = ex.name;
        break;
      }
    }
  }
  
  // Collect all logs for this exercise
  Object.entries(gymLogs).forEach(([dateKey, dayLog]) => {
    if (dayLog[exId]) {
      const sets = dayLog[exId].filter(s => s.done);
      if (sets.length > 0) {
        history.push({
          date: dateKey,
          sets: sets
        });
      }
    }
  });
  
  // Sort by date descending (newest first)
  history.sort((a, b) => keyToDate(b.date) - keyToDate(a.date));
  
  const container = document.getElementById('exercise-history');
  
  if (history.length === 0) {
    container.innerHTML = '<div class="empty-state">No history for this exercise yet</div>';
    return;
  }
  
  container.innerHTML = history.map(entry => `
    <div class="history-item">
      <div class="history-date">${formatDate(entry.date)}</div>
      <div class="history-sets">
        ${entry.sets.map(set => `
          <div class="history-set">
            <span>${set.reps} reps ×</span>
            <strong>${set.weight} lbs</strong>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function escapeHtml(str) {
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function clearAllPRs() {
  if (confirm('⚠️ This will clear ALL personal records. Are you sure?')) {
    // Reset all done flags in gymLogs
    Object.values(gymLogs).forEach(dayLog => {
      Object.values(dayLog).forEach(sets => {
        sets.forEach(set => {
          set.done = false;
        });
      });
    });
    save();
    renderPRs();
    renderGymAll();
    showNotification('All PRs cleared', 'info');
  }
}

// Add clear PRs button listener
document.getElementById('clear-prs-btn')?.addEventListener('click', clearAllPRs);

// Update tab switching to include progress tab
const originalTabSwitch = document.querySelectorAll('.tab-btn');
originalTabSwitch.forEach(btn => {
  btn.removeEventListener('click', () => {});
});
// Re-attach with progress support
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById('tab-' + activeTab).classList.remove('hidden');
    if (activeTab === 'gym') renderGymAll();
    else if (activeTab === 'progress') {
      renderPRs();
      calculateVolumeStats();
      populateExerciseSelect();
    }
    else renderAll();
  });
});
// ── COURSES STATE ─────────────────────────────────────
let courses = []; // { id, name, taskTemplate }
let courseTasks = {}; // key -> [{ id, courseId, label, done }]

// ── HAPPINESS STATE ───────────────────────────────────
let moodRatings = {}; // key -> rating (1-10)
let selectedHappinessDate = todayKey; // Currently selected date in happiness tab


// Update load function to include new data
const originalLoad = load;
load = function() {
  originalLoad();
  try {
    const raw = localStorage.getItem('trackerData');
    if (raw) {
      const data = JSON.parse(raw);
      courses = data.courses || [];
      courseTasks = data.courseTasks || {};
      moodRatings = data.moodRatings || {};
    }
  } catch(e) { console.warn('load error', e); }
}

// Update save function to include new data
const originalSave = save;
save = function() {
  originalSave();
  try {
    localStorage.setItem('trackerData', JSON.stringify({
      recurringTasks, oneTasks, completions,
      gymExercises, gymOneEx, gymLogs,
      courses, courseTasks, moodRatings
    }));
  } catch(e) { console.warn('save error', e); }
}

// ── COURSES FUNCTIONS ─────────────────────────────────
function addCourse() {
  const nameInput = document.getElementById('new-course-input');
  const taskInput = document.getElementById('course-task-input');
  const name = nameInput.value.trim();
  const taskTemplate = taskInput.value.trim();
  
  if (!name) return;
  
  courses.push({
    id: 'c' + Date.now(),
    name: name,
    taskTemplate: taskTemplate || 'Study for'
  });
  
  nameInput.value = '';
  taskInput.value = '';
  renderCourses();
  save();
}

function deleteCourse(courseId) {
  if (confirm('Remove this course? This will also remove all related tasks.')) {
    courses = courses.filter(c => c.id !== courseId);
    // Remove related tasks
    Object.keys(courseTasks).forEach(key => {
      courseTasks[key] = courseTasks[key].filter(t => t.courseId !== courseId);
    });
    renderCourses();
    renderTodayCourseTasks();
    save();
  }
}

function toggleCourseTask(key, taskId) {
  if (!courseTasks[key]) courseTasks[key] = [];
  const task = courseTasks[key].find(t => t.id === taskId);
  if (task) {
    task.done = !task.done;
    save();
    renderTodayCourseTasks();
    renderAll(); // Update tracker tab if it shows course tasks
  }
}

function generateCourseTasksForDay(key) {
  const date = keyToDate(key);
  const todayKey = dateKey(date);
  
  courses.forEach(course => {
    if (!courseTasks[todayKey]) courseTasks[todayKey] = [];
    
    const existingTask = courseTasks[todayKey].find(t => t.courseId === course.id);
    if (!existingTask) {
      courseTasks[todayKey].push({
        id: 'ct' + Date.now() + Math.random(),
        courseId: course.id,
        label: `${course.taskTemplate} ${course.name}`,
        done: false
      });
    }
  });
  save();
}

function renderCourses() {
  const container = document.getElementById('courses-list');
  if (!container) return;
  
  if (courses.length === 0) {
    container.innerHTML = '<div class="empty-state">No courses yet — add one above</div>';
    return;
  }
  
  container.innerHTML = courses.map(course => `
    <div class="course-card">
      <div class="course-info">
        <div class="course-name">${escapeHtml(course.name)}</div>
        <div class="course-task-template">Task: ${escapeHtml(course.taskTemplate)} [course]</div>
      </div>
      <button class="delete-course-btn" data-id="${course.id}">✕</button>
    </div>
  `).join('');
  
  // Add delete event listeners
  document.querySelectorAll('.delete-course-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteCourse(btn.dataset.id));
  });
}

function renderTodayCourseTasks() {
  const container = document.getElementById('today-course-tasks');
  if (!container) return;
  
  generateCourseTasksForDay(todayKey);
  const tasks = courseTasks[todayKey] || [];
  
  if (tasks.length === 0) {
    container.innerHTML = '<div class="empty-state">No course tasks for today — add a course above</div>';
    return;
  }
  
  container.innerHTML = tasks.map(task => `
    <div class="course-task-item" data-id="${task.id}">
      <div class="task-circ ${task.done ? 'done' : ''}" data-id="${task.id}"></div>
      <span class="course-task-label ${task.done ? 'course-task-done' : ''}">${escapeHtml(task.label)}</span>
    </div>
  `).join('');
  
  // Add click handlers
  document.querySelectorAll('#today-course-tasks .task-circ').forEach(circ => {
    circ.addEventListener('click', () => {
      const taskId = circ.dataset.id;
      toggleCourseTask(todayKey, taskId);
    });
  });
}


// ── HAPPINESS FUNCTIONS ───────────────────────────────
function setMoodRating(rating, dateKey = null) {
  const targetDate = dateKey || selectedHappinessDate;
  moodRatings[targetDate] = parseInt(rating);
  save();
  renderHappiness();
  renderAll(); // Update calendar to show the mood
  showNotification(`Mood saved for ${formatDate(targetDate)}: ${getMoodEmoji(rating)} ${rating}/10`, 'success');
}

function getMoodEmoji(rating) {
  const emojis = {
    1: '😢', 2: '😕', 3: '😐', 4: '🙂', 5: '😊',
    6: '😄', 7: '😁', 8: '🎉', 9: '🌟', 10: '💯'
  };
  return emojis[rating] || '😐';
}

function renderHappiness() {
  const currentRating = moodRatings[selectedHappinessDate];
  const currentDisplay = document.getElementById('current-rating-display');
  const selectedLabel = document.getElementById('selected-date-label');
  const dateSelector = document.getElementById('happiness-date-selector');
  
  // Update date selector value
  if (dateSelector && selectedHappinessDate) {
    const [year, month, day] = selectedHappinessDate.split('-');
    dateSelector.value = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Update selected date label
  if (selectedLabel) {
    selectedLabel.textContent = formatDate(selectedHappinessDate);
  }
  
  // Update current rating display
  if (currentDisplay) {
    if (currentRating) {
      currentDisplay.innerHTML = `Current rating: ${getMoodEmoji(currentRating)} ${currentRating}/10`;
    } else {
      currentDisplay.innerHTML = 'No rating yet for this day — select one above!';
    }
  }
  
  // Highlight active rating button
  document.querySelectorAll('.rating-btn').forEach(btn => {
    if (btn.dataset.rating == currentRating) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Render history (all ratings, sorted by date)
  const historyContainer = document.getElementById('rating-history');
  if (historyContainer) {
    const sorted = Object.entries(moodRatings).sort((a, b) => keyToDate(b[0]) - keyToDate(a[0]));
    
    if (sorted.length === 0) {
      historyContainer.innerHTML = '<div class="empty-state">No ratings yet — rate your days!</div>';
    } else {
      historyContainer.innerHTML = sorted.map(([key, rating]) => `
        <div class="history-item" data-date="${key}">
          <span class="history-date">${formatDate(key)}</span>
          <span class="history-rating">${getMoodEmoji(rating)} ${rating}/10</span>
          <button class="edit-rating-btn" data-date="${key}">✎</button>
        </div>
      `).join('');
    }
    
    // Add click handlers for edit buttons
    document.querySelectorAll('.edit-rating-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dateKey = btn.dataset.date;
        selectedHappinessDate = dateKey;
        renderHappiness();
        // Scroll to top
        document.querySelector('.happiness-container')?.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }
  
  // Calculate stats
  const ratings = Object.values(moodRatings);
  const avgRatingEl = document.getElementById('avg-rating');
  const totalRatingsEl = document.getElementById('total-ratings');
  const bestDayEl = document.getElementById('best-day');
  
  if (avgRatingEl && totalRatingsEl && bestDayEl) {
    if (ratings.length > 0) {
      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      avgRatingEl.textContent = avg.toFixed(1);
      totalRatingsEl.textContent = ratings.length;
      
      // Find best day
      let bestRating = 0;
      let bestDay = '';
      Object.entries(moodRatings).forEach(([key, rating]) => {
        if (rating > bestRating) {
          bestRating = rating;
          bestDay = key;
        }
      });
      if (bestDay) {
        bestDayEl.innerHTML = `${getMoodEmoji(bestRating)} ${formatDate(bestDay)}`;
      }
    } else {
      avgRatingEl.textContent = '-';
      totalRatingsEl.textContent = '0';
      bestDayEl.textContent = '-';
    }
  }
}

// Initialize happiness buttons and date picker
function initHappinessTab() {
  // Set up rating buttons
  const ratingBtns = document.querySelectorAll('.rating-btn');
  ratingBtns.forEach(btn => {
    btn.removeEventListener('click', () => {});
    btn.addEventListener('click', () => {
      const rating = parseInt(btn.dataset.rating);
      setMoodRating(rating);
    });
  });
  
  // Set up date selector
  const dateSelector = document.getElementById('happiness-date-selector');
  const selectBtn = document.getElementById('select-happiness-date');
  
  if (dateSelector) {
    // Set default to today
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    dateSelector.value = todayStr;
    
    dateSelector.addEventListener('change', () => {
      if (dateSelector.value) {
        const [year, month, day] = dateSelector.value.split('-');
        selectedHappinessDate = `${parseInt(year)}-${parseInt(month)}-${parseInt(day)}`;
        renderHappiness();
      }
    });
  }
  
  if (selectBtn) {
    selectBtn.addEventListener('click', () => {
      if (dateSelector && dateSelector.value) {
        const [year, month, day] = dateSelector.value.split('-');
        selectedHappinessDate = `${parseInt(year)}-${parseInt(month)}-${parseInt(day)}`;
        renderHappiness();
      }
    });
  }
}

// Update the calendar to show mood emojis
const originalRenderCalendar = renderCalendar;
renderCalendar = function() {
  originalRenderCalendar();
  
  // Add mood indicators to calendar cells
  const grid = document.getElementById('cal-grid');
  const cells = grid.querySelectorAll('.day-cell:not(.empty)');
  
  cells.forEach(cell => {
    const dayNum = cell.querySelector('.day-num')?.textContent;
    if (dayNum) {
      const key = dateKey(new Date(viewYear, viewMonth, parseInt(dayNum)));
      const mood = moodRatings[key];
      
      if (mood) {
        // Remove existing mood indicator if any
        const existingMood = cell.querySelector('.day-mood');
        if (existingMood) existingMood.remove();
        
        // Add mood emoji
        const moodDiv = document.createElement('div');
        moodDiv.className = 'day-mood';
        moodDiv.innerHTML = `<span class="day-mood-emoji">${getMoodEmoji(mood)}</span>`;
        cell.appendChild(moodDiv);
      }
    }
  });
};

// Add course tasks to tracker display
const originalGetTasksForKey = getTasksForKey;
getTasksForKey = function(key) {
  const tasks = originalGetTasksForKey(key);
  // Add course tasks for this day
  const courseTasksForDay = (courseTasks[key] || []).filter(t => !t.done).map(t => ({
    id: t.id,
    label: t.label,
    recurring: false,
    isCourseTask: true
  }));
  return [...tasks, ...courseTasksForDay];
};

// Update toggleTask to handle course tasks
const originalToggleTask = toggleTask;
toggleTask = function(key, id) {
  // Check if it's a course task
  let isCourseTask = false;
  if (courseTasks[key]) {
    const task = courseTasks[key].find(t => t.id === id);
    if (task) {
      task.done = !task.done;
      save();
      renderTodayCourseTasks();
      isCourseTask = true;
    }
  }
  
  if (!isCourseTask) {
    originalToggleTask(key, id);
  }
  renderAll();
};

// Update deleteTask to handle course tasks
const originalDeleteTask = deleteTask;
deleteTask = function(id, isRecurring) {
  // Check if it's a course task
  let found = false;
  Object.keys(courseTasks).forEach(key => {
    const index = courseTasks[key].findIndex(t => t.id === id);
    if (index !== -1) {
      courseTasks[key].splice(index, 1);
      found = true;
    }
  });
  
  if (!found) {
    originalDeleteTask(id, isRecurring);
  }
  renderAll();
  renderTodayCourseTasks();
};

// Update tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById('tab-' + activeTab).classList.remove('hidden');
    
    if (activeTab === 'gym') {
      renderGymAll();
    } else if (activeTab === 'progress') {
      renderPRs();
      calculateVolumeStats();
      populateExerciseSelect();
    } else if (activeTab === 'courses') {
      renderCourses();
      renderTodayCourseTasks();
    } else if (activeTab === 'happiness') {
      initHappinessTab(); 
    } else {
      renderAll();
    }
  });
});


// Initialize courses button
document.getElementById('add-course-btn')?.addEventListener('click', addCourse);
document.getElementById('new-course-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') addCourse();
});

// ── DATA EXPORT/IMPORT ─────────────────────────────────

function exportData() {
  console.log('Export triggered');
  
  const exportData = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    recurringTasks: recurringTasks,
    oneTasks: oneTasks,
    completions: completions,
    gymExercises: gymExercises,
    gymOneEx: gymOneEx,
    gymLogs: gymLogs
  };
  
  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  const date = new Date().toISOString().split('T')[0];
  link.download = `fitness-tracker-backup-${date}.json`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  showNotification('Data exported successfully!', 'success');
}

function importData(file) {
  console.log('Import triggered', file);
  
  const reader = new FileReader();
  
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      console.log('Imported data:', importedData);
      
      // Validate the imported data structure
      if (!importedData.recurringTasks || !importedData.oneTasks || 
          !importedData.completions || !importedData.gymExercises || 
          !importedData.gymOneEx || !importedData.gymLogs) {
        throw new Error('Invalid backup file format');
      }
      
      // Show confirmation dialog
      const confirmMsg = `This will replace ALL your current data with the backup from ${new Date(importedData.timestamp).toLocaleString()}. Are you sure you want to continue?`;
      
      if (confirm(confirmMsg)) {
        // Apply imported data
        recurringTasks = importedData.recurringTasks;
        oneTasks = importedData.oneTasks;
        completions = importedData.completions;
        gymExercises = importedData.gymExercises;
        gymOneEx = importedData.gymOneEx;
        gymLogs = importedData.gymLogs;
        
        save();
        renderAll();
        if (activeTab === 'gym') renderGymAll();
        
        showNotification('Data imported successfully!', 'success');
      }
      
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import data: Invalid file format');
    }
  };
  
  reader.onerror = function() {
    alert('Failed to read file');
  };
  
  reader.readAsText(file);
}

function showNotification(message, type = 'info') {
  // Remove existing notification
  const oldNotif = document.querySelector('.notification');
  if (oldNotif) oldNotif.remove();
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'notification';
  
  // Set color based on type
  const colors = {
    success: '#1D9E75',
    error: '#E24B4A',
    info: '#639922'
  };
  
  notification.style.backgroundColor = colors[type] || colors.info;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

// Initialize backup buttons
function initBackupFeatures() {
  console.log('Initializing backup features');
  
  const exportBtn = document.getElementById('export-data-btn');
  const importBtn = document.getElementById('import-data-btn');
  const fileInput = document.getElementById('import-file-input');
  
  console.log('Buttons found:', { 
    exportBtn: !!exportBtn, 
    importBtn: !!importBtn, 
    fileInput: !!fileInput 
  });
  
  if (exportBtn) {
    exportBtn.addEventListener('click', function(e) {
      e.preventDefault();
      exportData();
    });
  } else {
    console.error('Export button not found! Make sure element with id="export-data-btn" exists');
  }
  
  if (importBtn && fileInput) {
    importBtn.addEventListener('click', function(e) {
      e.preventDefault();
      fileInput.click();
    });
    
    fileInput.addEventListener('change', function(e) {
      if (e.target.files && e.target.files[0]) {
        importData(e.target.files[0]);
        fileInput.value = ''; // Clear the input
      }
    });
  } else {
    console.error('Import button or file input not found!');
  }
}

// ── INITIAL DATA LOAD ─────────────────────────────────
function initializeApp() {
  load();

  if (recurringTasks.length === 0 || gymExercises.length === 0) {
    if (recurringTasks.length === 0) {
      recurringTasks = [
        { id: 'r_default_1', label: 'Morning workout', days: [1, 2, 3, 4, 5] },
        { id: 'r_default_2', label: 'Take supplements', days: [0, 1, 2, 3, 4, 5, 6] },
        { id: 'r_default_3', label: 'Skincare routine', days: [0, 1, 2, 3, 4, 5, 6] },
      ];
    }
    if (gymExercises.length === 0) {
      gymExercises = [
        { id: 'ge_1', name: 'Bench Press', cat: 'push', days: [1, 3, 5], sets: [{reps:8,weight:135},{reps:8,weight:145},{reps:6,weight:155}] },
        { id: 'ge_2', name: 'Overhead Press', cat: 'push', days: [1, 3, 5], sets: [{reps:10,weight:95},{reps:8,weight:95},{reps:8,weight:100}] },
        { id: 'ge_3', name: 'Pull-ups', cat: 'pull', days: [2, 4], sets: [{reps:8,weight:0},{reps:8,weight:0},{reps:6,weight:0}] },
        { id: 'ge_4', name: 'Barbell Row', cat: 'pull', days: [2, 4], sets: [{reps:8,weight:115},{reps:8,weight:115},{reps:8,weight:125}] },
        { id: 'ge_5', name: 'Squat', cat: 'legs', days: [6], sets: [{reps:5,weight:185},{reps:5,weight:185},{reps:5,weight:185}] },
      ];
    }
  }
  // Set initial selected happiness date
  selectedHappinessDate = todayKey;
  renderAll();
  updateRecHint();
  updateGymRecHint();
  initBackupFeatures();
  

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('SW registered'))
      .catch(err => console.warn('SW failed', err));
  }
}

// Start the app
initializeApp();

// ── SIMPLE BACKUP BUTTON SETUP (ADD THIS AT THE VERY END) ──
(function setupBackupButtons() {
  // Wait a bit for the DOM to be fully ready
  setTimeout(function() {
    console.log('Setting up backup buttons...');
    
    const exportBtn = document.getElementById('export-data-btn');
    const importBtn = document.getElementById('import-data-btn');
    const fileInput = document.getElementById('import-file-input');
    
    console.log('Export button exists:', !!exportBtn);
    console.log('Import button exists:', !!importBtn);
    
    if (exportBtn) {
      // Remove any existing listeners
      const newExportBtn = exportBtn.cloneNode(true);
      exportBtn.parentNode.replaceChild(newExportBtn, exportBtn);
      
      newExportBtn.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Export button clicked');
        
        const backupData = {
          version: '1.0',
          timestamp: new Date().toISOString(),
          recurringTasks: recurringTasks,
          oneTasks: oneTasks,
          completions: completions,
          gymExercises: gymExercises,
          gymOneEx: gymOneEx,
          gymLogs: gymLogs
        };
        
        const jsonStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date().toISOString().split('T')[0];
        a.download = `tracker-backup-${date}.json`;
        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('✅ Data exported successfully!');
      });
    }
    
    if (importBtn && fileInput) {
      // Remove any existing listeners
      const newImportBtn = importBtn.cloneNode(true);
      importBtn.parentNode.replaceChild(newImportBtn, importBtn);
      
      newImportBtn.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Import button clicked');
        fileInput.click();
      });
      
      fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(ev) {
          try {
            const imported = JSON.parse(ev.target.result);
            
            // Validate the data
            if (!imported.recurringTasks || !imported.gymExercises) {
              throw new Error('Invalid backup file format');
            }
            
            const confirmMsg = `Replace all data with backup from ${imported.timestamp ? new Date(imported.timestamp).toLocaleString() : 'unknown date'}?`;
            
            if (confirm(confirmMsg)) {
              recurringTasks = imported.recurringTasks || [];
              oneTasks = imported.oneTasks || {};
              completions = imported.completions || {};
              gymExercises = imported.gymExercises || [];
              gymOneEx = imported.gymOneEx || {};
              gymLogs = imported.gymLogs || {};
              
              save();
              renderAll();
              if (activeTab === 'gym') renderGymAll();
              
              alert('✅ Data imported successfully!');
            }
          } catch(err) {
            console.error('Import error:', err);
            alert('❌ Failed to import: ' + err.message);
          }
        };
        reader.onerror = function() {
          alert('❌ Failed to read file');
        };
        reader.readAsText(file);
        fileInput.value = '';
      });
    }
  }, 100);
})();