// State
const HOURS = 7; // 7 days
const PEOPLE = [
  { id: 'p1', name: 'A' },
  { id: 'p2', name: 'B' },
  { id: 'p3', name: 'C' },
];
const schedule = {}; // { personId: Array<'rest'|'work'> }

const barBalance = document.getElementById('bar-balance');
const barFlow = document.getElementById('bar-flow');
const barSurplus = document.getElementById('bar-surplus');
const workerList = document.getElementById('worker-list');
const grid = document.getElementById('grid');
const timehead = document.getElementById('timehead');
const statusText = document.getElementById('status-text');

const btnClear = document.getElementById('btn-clear');
const btnEval = document.getElementById('btn-eval');
const btnHelp = document.getElementById('btn-help');
const btnCloseHelp = document.getElementById('btn-close-help');
const btnSound = document.getElementById('btn-sound');

const dialogHelp = document.getElementById('dialog-help');
const dialogResult = document.getElementById('dialog-result');
const resultTitle = document.getElementById('result-title');
const resultDesc = document.getElementById('result-desc');
const btnCloseResult = document.getElementById('btn-close-result');

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function initData() {
  PEOPLE.forEach(p => schedule[p.id] = Array(HOURS).fill('rest'));
}

function renderHeader() {
  timehead.innerHTML = '';
  const label = document.createElement('div');
  label.textContent = 'Nhân sự';
  label.className = 'rowhead';
  timehead.appendChild(label);
  const days = ['T2','T3','T4','T5','T6','T7','CN'];
  for (let h = 0; h < HOURS; h++) {
    const c = document.createElement('div');
    c.className = 'rowhead';
    c.textContent = days[h];
    timehead.appendChild(c);
  }
}

let paintMode = null; // 'work' | 'rest' | null
let isPainting = false;

function renderGrid() {
  grid.innerHTML = '';
  PEOPLE.forEach(p => {
    const head = document.createElement('div');
    head.className = 'rowhead';
    head.textContent = `👤 ${p.name}`;
    grid.appendChild(head);
    for (let i = 0; i < HOURS; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.person = p.id;
      cell.dataset.index = i.toString();
      cell.dataset.state = schedule[p.id][i];
      cell.addEventListener('mousedown', onCellDown);
      cell.addEventListener('mouseenter', onCellEnter);
      cell.addEventListener('click', onCellClick);
      grid.appendChild(cell);
    }
  });
}

function renderWorkers() {
  workerList.innerHTML = '';
  PEOPLE.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="chip work"></span> <strong>${p.name}</strong>`;
    workerList.appendChild(li);
  });
}

function onCellDown(e) {
  const cell = e.currentTarget;
  const person = cell.dataset.person;
  const idx = Number(cell.dataset.index);
  const current = schedule[person][idx];
  paintMode = current === 'work' ? 'rest' : 'work';
  isPainting = true;
  setCell(person, idx, paintMode);
  sfx.play('click');
}
function onCellEnter(e) {
  if (!isPainting) return;
  const cell = e.currentTarget;
  const person = cell.dataset.person;
  const idx = Number(cell.dataset.index);
  setCell(person, idx, paintMode);
}
function onCellClick(e) {
  // handled by mousedown; prevent double toggle on some browsers
  e.preventDefault();
}

document.addEventListener('mouseup', () => { isPainting = false; paintMode = null; });

function setCell(personId, index, state) {
  schedule[personId][index] = state;
  const q = `.cell[data-person="${personId}"][data-index="${index}"]`;
  const cell = grid.querySelector(q);
  if (cell) cell.dataset.state = state;
  updateMeters();
}

function countStreaks(arr) {
  let best = 0, cur = 0;
  for (const v of arr) {
    if (v === 'work') { cur++; best = Math.max(best, cur); }
    else { cur = 0; }
  }
  return best;
}

function restGaps(arr) {
  // count number of single rest cells that break long works
  let gaps = 0, cur = 0;
  for (const v of arr) {
    if (v === 'work') cur++;
    else {
      if (cur >= 2) gaps++;
      cur = 0;
    }
  }
  return gaps;
}

function utilizationAtHour(h) {
  let working = 0;
  PEOPLE.forEach(p => { if (schedule[p.id][h] === 'work') working++; });
  return working / PEOPLE.length; // 0..1
}

function updateMeters() {
  // balance: punish long streaks, reward rest gaps
  let penalties = 0; let rewards = 0;
  PEOPLE.forEach(p => {
    const arr = schedule[p.id];
    penalties += Math.max(0, countStreaks(arr) - 3) * 8;
    rewards += restGaps(arr) * 4;
  });
  const balance = clamp(70 + rewards - penalties, 0, 100);

  // flow: prefer stable utilization around ~70%
  let variance = 0; let sum = 0;
  for (let h = 0; h < HOURS; h++) sum += utilizationAtHour(h);
  const avg = sum / HOURS; // 0..1
  for (let h = 0; h < HOURS; h++) {
    const u = utilizationAtHour(h);
    variance += Math.abs(u - avg);
  }
  const stability = clamp(100 - variance * 100 / HOURS, 0, 100);
  const target = 0.7; // ideal avg utilization
  const proximity = clamp(100 - Math.abs(avg - target) * 220, 0, 100);
  const flow = Math.round(0.6 * stability + 0.4 * proximity);

  // surplus: combine both
  const surplus = Math.round(0.5 * balance + 0.5 * flow);

  barBalance.style.width = `${balance}%`;
  barFlow.style.width = `${flow}%`;
  barSurplus.style.width = `${surplus}%`;
}

function clearAll() {
  PEOPLE.forEach(p => schedule[p.id].fill('rest'));
  renderGrid();
  updateMeters();
  statusText.textContent = 'Đã xoá lịch.';
  sfx.play('drop');
}

function evaluate() {
  // Provide a short narrative based on meters
  const b = parseInt(barBalance.style.width) || 0;
  const f = parseInt(barFlow.style.width) || 0;
  const s = parseInt(barSurplus.style.width) || 0;
  let title = 'Kết quả';
  let desc = '';
  if (s >= 75 && b >= 70 && f >= 70) { title = 'Lịch ca tối ưu'; desc = 'Cân bằng tốt giữa làm và nghỉ, nhịp ổn định và thặng dư cao.'; sfx.play('win'); }
  else if (b < 50) { title = 'Quá tải lao động'; desc = 'Có chuỗi làm liên tiếp dài. Xen kẽ thêm nghỉ để phục hồi.'; sfx.play('lose'); }
  else if (f < 55) { title = 'Nhịp chưa ổn định'; desc = 'Phân bổ ca chưa đều giữa các giờ. Hãy dàn trải tổ làm việc.'; sfx.play('lose'); }
  else { title = 'Tạm ổn'; desc = 'Bạn có thể tối ưu thêm: giảm chuỗi làm dài và giữ nhịp đều hơn.'; sfx.play('click'); }
  resultTitle.textContent = title;
  resultDesc.textContent = desc;
  if (typeof dialogResult.showModal === 'function') dialogResult.showModal();
}

// UI events
btnClear.addEventListener('click', clearAll);
btnEval.addEventListener('click', evaluate);
btnHelp.addEventListener('click', () => { sfx.play('click'); if (typeof dialogHelp.showModal === 'function') dialogHelp.showModal(); });
btnCloseHelp.addEventListener('click', () => { sfx.play('click'); dialogHelp.close(); });
btnCloseResult.addEventListener('click', () => { sfx.play('click'); dialogResult.close(); });
btnSound.addEventListener('click', () => {
  const on = btnSound.dataset.on === 'true';
  btnSound.dataset.on = on ? 'false' : 'true';
  btnSound.textContent = on ? '🔇' : '🔊';
  sfx.enabled = !on;
  sfx.play('click');
});

// Init
initData();
renderHeader();
renderWorkers();
renderGrid();
updateMeters();

// SFX (minimal WebAudio)
const sfx = (() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx; let enabled = true; let unlocked = false;
  function ensure() { if (!ctx && AC) ctx = new AC(); return ctx; }
  function unlock() {
    if (unlocked || !ensure()) return;
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); if (s.start) s.start(0); unlocked = true;
  }
  ['click','keydown','touchstart'].forEach(ev => document.addEventListener(ev, unlock, { once: true }));
  function beep({ type='sine', freq=440, dur=0.1, vol=0.15 }) {
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); const g = ctx.createGain(); g.gain.value = vol;
    o.type = type; o.frequency.value = freq; o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + dur);
  }
  function click(){ beep({ type:'square', freq:900, dur:0.05, vol:0.08 }); }
  function drop(){ beep({ type:'triangle', freq:300, dur:0.08, vol:0.12 }); }
  function win(){ beep({ type:'sine', freq:700, dur:0.22, vol:0.18 }); setTimeout(()=>beep({ type:'sine', freq:940, dur:0.22, vol:0.18 }), 120); }
  function lose(){ beep({ type:'sawtooth', freq:220, dur:0.22, vol:0.12 }); setTimeout(()=>beep({ type:'sawtooth', freq:180, dur:0.22, vol:0.12 }), 120); }
  return { get enabled(){ return enabled; }, set enabled(v){ enabled = v; }, play(name){ if(!enabled) return; ({click,drop,win,lose}[name]?.()); } };
})();



