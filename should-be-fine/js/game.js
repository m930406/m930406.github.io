'use strict';
/* ================= 基本設定 ================= */
const W = 960, H = 540;
const WALK_SPEED = 215;   // 走路速度（px / 秒）
const BUSY_RATE = 14;     // 做事時，每秒過幾分鐘遊戲時間
const SLEEP_RATE = 60;    // 睡覺時，每秒過幾分鐘遊戲時間

const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d'), ov = $('ov'), card = $('card');
const DPR = Math.min(2, window.devicePixelRatio || 1);
cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

const RND = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const DECKS = {};
const draw1 = (key, arr) => { const d = DECKS[key] && DECKS[key].length ? DECKS[key] : (DECKS[key] = shuffle(arr)); return d.pop(); };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let BASE = 9;   // 時鐘起點：上班 09:00、on-call 20:00
const hhmm = t => { const m = Math.floor(t) + BASE * 60; return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const dur = m => `${Math.floor(m / 60)}:${String(Math.floor(m % 60)).padStart(2, '0')}`;

/* ================= 地圖 =================
   每張地圖是一塊地板，上面有隔間（牆＋門）和家具（擋路）。
   走路用格子搜尋最短路線，再把轉角拉直。 */
const R = 9, G = 8;   // 人的半徑、尋路格子大小
const MAPS = {
  office: {
    // 開放式辦公室：兩組 OA 桌島；隔間只有會議室、機房、廁所，茶水間是開放的角落
    rooms: [
      { id: 'meet', name: '會議室', x: 20, y: 20, w: 240, h: 190, door: { side: 'right', a: 115, b: 172 } },
      { id: 'srv', name: '機房', x: 760, y: 330, w: 180, h: 190, door: { side: 'top', a: 788, b: 846 } },
      { id: 'wc', name: '廁所', x: 20, y: 400, w: 100, h: 120, door: { side: 'top', a: 42, b: 98 } },
    ],
    obstacles: [
      { x: 55, y: 75, w: 160, h: 50 },     // 會議桌
      { x: 320, y: 90, w: 400, h: 60 },    // 桌島一（PM、QA、主管）
      { x: 330, y: 340, w: 380, h: 60 },   // 桌島二（你、阿凱）
      { x: 130, y: 490, w: 170, h: 30 },   // 茶水間流理台
      { x: 45, y: 480, w: 40, h: 40 },     // 馬桶
      { x: 850, y: 336, w: 86, h: 26 },    // 監控牆
      { x: 770, y: 478, w: 166, h: 40 },   // 機櫃
    ],
    hs: {
      meet: { x: 135, y: 165, ax: 135, ay: 100, label: '會議室' },
      pm: { x: 367, y: 42, ax: 367, ay: 72, label: 'PM 安娜' },
      qa: { x: 462, y: 42, ax: 462, ay: 72, label: 'QA 小芸' },
      boss: { x: 768, y: 120, ax: 738, ay: 116, label: '主管 大衛' },
      wc: { x: 65, y: 450, ax: 65, ay: 495, label: '廁所' },
      coffee: { x: 160, y: 465, ax: 160, ay: 502, label: '咖啡機' },
      bento: { x: 255, y: 465, ax: 255, ay: 502, label: '便當' },
      desk: { x: 472, y: 452, ax: 472, ay: 414, label: '你的座位' },
      rev: { x: 567, y: 452, ax: 567, ay: 414, label: '阿凱' },
      monitor: { x: 893, y: 400, ax: 893, ay: 349, label: '監控牆' },
    },
    start: 'desk',
  },
  home: {
    rooms: [
      { id: 'bedroom', name: '臥室', x: 20, y: 20, w: 300, h: 180, door: { side: 'bottom', a: 225, b: 285 } },
      { id: 'study', name: '書房', x: 330, y: 20, w: 300, h: 180, door: { side: 'bottom', a: 450, b: 510 } },
      { id: 'living', name: '客廳', x: 640, y: 20, w: 300, h: 180, door: { side: 'bottom', a: 675, b: 735 } },
      { id: 'bath', name: '浴室', x: 20, y: 320, w: 200, h: 200, door: { side: 'top', a: 90, b: 150 } },
      { id: 'kitchen', name: '廚房', x: 230, y: 320, w: 300, h: 200, door: { side: 'top', a: 350, b: 410 } },
      { id: 'entry', name: '玄關', x: 540, y: 320, w: 400, h: 200, door: { side: 'top', a: 610, b: 670 } },
    ],
    obstacles: [
      { x: 36, y: 36, w: 140, h: 118 },    // 床
      { x: 390, y: 34, w: 180, h: 46 },    // 書桌
      { x: 735, y: 80, w: 130, h: 40 },    // 沙發
      { x: 45, y: 450, w: 34, h: 58 },     // 馬桶
      { x: 130, y: 440, w: 76, h: 66 },    // 淋浴間
      { x: 244, y: 470, w: 90, h: 34 },    // 流理台
      { x: 350, y: 450, w: 60, h: 40 },    // 餐桌
      { x: 470, y: 444, w: 44, h: 62 },    // 冰箱
      { x: 560, y: 470, w: 90, h: 34 },    // 鞋櫃
    ],
    hs: {
      bed: { x: 200, y: 140, ax: 105, ay: 95, label: '床' },
      laptop: { x: 480, y: 140, ax: 480, ay: 66, label: '筆電' },
      sofa: { x: 800, y: 145, ax: 800, ay: 82, label: '沙發' },
      wc: { x: 70, y: 425, ax: 62, ay: 478, label: '馬桶' },
      shower: { x: 165, y: 422, ax: 168, ay: 472, label: '淋浴' },
      table: { x: 380, y: 420, ax: 380, ay: 470, label: '餐桌' },
      door: { x: 880, y: 420, ax: 922, ay: 420, label: '大門' },
    },
    start: 'door',
  },
};
const FLOOR = { x: 20, y: 20, w: 920, h: 500 };
/* 隔間的牆：四面牆，門那一面留一個缺口 */
function roomWalls(r) {
  const T = 6, out = [];
  const seg = (side, x, y, w, h) => {
    const d = r.door && r.door.side === side ? r.door : null;
    if (!d) return out.push({ x, y, w, h });
    if (w > h) { out.push({ x, y, w: d.a - x, h }, { x: d.b, y, w: x + w - d.b, h }); }
    else { out.push({ x, y, w, h: d.a - y }, { x, y: d.b, w, h: y + h - d.b }); }
  };
  seg('top', r.x - T / 2, r.y - T / 2, r.w + T, T);
  seg('bottom', r.x - T / 2, r.y + r.h - T / 2, r.w + T, T);
  seg('left', r.x - T / 2, r.y - T / 2, T, r.h + T);
  seg('right', r.x + r.w - T / 2, r.y - T / 2, T, r.h + T);
  return out;
}
let MAPK = 'office', ROOMS, HS, WALLS, OBST, FREE, COLS, ROWS;
const inR = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
const grow = (r, d) => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });
const walkable = p => inR(p, grow(FLOOR, -R)) && !WALLS.some(r => inR(p, grow(r, R))) && !OBST.some(r => inR(p, grow(r, R)));
function setMap(k) {
  MAPK = k; const m = MAPS[k];
  ROOMS = m.rooms; HS = m.hs; OBST = m.obstacles; WALLS = m.rooms.flatMap(roomWalls);
  COLS = Math.ceil(W / G); ROWS = Math.ceil(H / G);
  FREE = new Uint8Array(COLS * ROWS);
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) FREE[j * COLS + i] = walkable({ x: i * G + G / 2, y: j * G + G / 2 }) ? 1 : 0;
}
const cellOf = p => ({ i: Math.max(0, Math.min(COLS - 1, Math.floor(p.x / G))), j: Math.max(0, Math.min(ROWS - 1, Math.floor(p.y / G))) });
const cellPt = c => ({ x: c.i * G + G / 2, y: c.j * G + G / 2 });
/* 從某一格往外找最近的空格 */
function nearestFree(p) {
  const c = cellOf(p); if (FREE[c.j * COLS + c.i]) return c;
  for (let r = 1; r < 40; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
    const i = c.i + di, j = c.j + dj;
    if (i >= 0 && j >= 0 && i < COLS && j < ROWS && FREE[j * COLS + i]) return { i, j };
  }
  return c;
}
function clear(a, b) { const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / 4); for (let k = 1; k <= n; k++) if (!walkable({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n })) return false; return true; }
function pathTo(from, to) {
  const s = nearestFree(from), g = nearestFree(to), si = s.j * COLS + s.i, gi = g.j * COLS + g.i;
  const prev = new Int32Array(COLS * ROWS).fill(-1); prev[si] = si;
  const q = [si];
  for (let h = 0; h < q.length && prev[gi] < 0; h++) {
    const cur = q[h], ci = cur % COLS, cj = (cur - ci) / COLS;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= COLS || j >= ROWS) continue;
      const n = j * COLS + i; if (!FREE[n] || prev[n] >= 0) continue;
      if (di && dj && (!FREE[cj * COLS + i] || !FREE[j * COLS + ci])) continue;   // 不切牆角
      prev[n] = cur; q.push(n);
    }
  }
  if (prev[gi] < 0) return [];
  const cells = []; for (let n = gi; n !== si; n = prev[n]) cells.push({ i: n % COLS, j: Math.floor(n / COLS) });
  const pts = cells.reverse().map(cellPt);
  if (walkable(to)) pts.push(to);
  // 把轉角拉直：能直走就直走
  const out = []; let a = from, k = 0;
  while (k < pts.length) { let far = k; for (let m = pts.length - 1; m > k; m--) if (clear(a, pts[m])) { far = m; break; } out.push(pts[far]); a = pts[far]; k = far + 1; }
  return out;
}
const clampWalk = p => walkable(p) ? p : cellPt(nearestFree(p));
setMap('office');

const NPC = {
  pm: { name: 'PM 安娜', tag: 'PM', color: '#D9668F', shirt: '#F2B5C8', hair: '#3B2A25' },
  qa: { name: 'QA 小芸', tag: 'QA', color: '#3E9E6B', shirt: '#A9DDBF', hair: '#2B2B2B' },
  boss: { name: '主管 大衛', tag: '主管', color: '#7466D9', shirt: '#C7C0F2', hair: '#555' },
  rev: { name: '資深工程師 阿凱', tag: '阿凱', color: '#D98A1E', shirt: '#F5D29A', hair: '#1F1F1F' },
  meet: { name: '站會', tag: '會', color: '#3C8DBC' },
  me: { name: '你', tag: '我', color: '#2F8FCB' },
  mon: { name: '監控告警', tag: '🚨', color: '#E5484D' },
  page: { name: 'PagerDuty', tag: '📟', color: '#E5484D' },
  line: { name: '手機訊息', tag: '💬', color: '#06A94D' },
  home: { name: '家', tag: '🏠', color: '#5B6577' },
  fam: { name: '另一半 小雯', tag: '家', color: '#D9774A', shirt: '#F2C6A0', hair: '#4A3426' },
  sys: { name: '系統', tag: '⚙', color: '#5B6577' },
};
const PING_LABEL = { plan: '週末計畫', show: '陪看一集劇', handoff: '交接給白天 on-call', urgent: '⚡ 急件', big: '📅 明天就要', change: '需求變更', status: '問進度', helpReview: '幫看 PR', bounce: 'QA 退件', report: '事故回報', standup: '站會開始' };
const STATUS = { todo: '待開發', dev: '開發中', review: '待 review', qa: '待交測', testing: '測試中', ready: '可上線', done: '已上線' };

/* ================= 遊戲狀態 ================= */
let LV = LEVELS.freeze, MODE = 'day';
let S = null;
const keys = {};
const isNight = () => MODE === 'night';
const isWeekend = () => MODE === 'weekend';
const atHome = () => MODE !== 'day';   // 晚上 on-call 和假日值班都在家
const endT = () => isNight() ? NIGHT_END : isWeekend() ? WEEKEND_END : S && S.ot ? OT_END : DAY_END;

function freshState(lv, mode) {
  LV = lv; MODE = mode; BASE = mode === 'night' ? 20 : mode === 'weekend' ? 0 : 9;
  setMap(mode === 'day' ? 'office' : 'home');
  const st = MAPS[MAPK].hs[mode === 'weekend' ? 'bed' : MAPS[MAPK].start];
  const s = {
    t: 0, score: 0, en: 100, bl: 15, ate: false, coffee: 0,
    me: { x: st.x, y: st.y }, dir: 1, moving: false, path: [], pendingHs: null, busy: null,
    tickets: [], nextId: 101, pings: {}, pq: {}, alert: null, timers: [],
    evI: 0, changeI: 0, nextChange: Infinity,
    log: [], toast: null, deployed: 0, jinx: false,
    stats: { good: 0, bad: 0, changes: 0, deferred: 0, bounces: 0, incidents: 0 },
    started: false, ended: false, paused: false,
  };
  if (mode === 'day') {
    s.tickets = shuffle(TICKET_POOL).slice(0, lv.tickets).map((p, i) => newTicketObj(101 + i, p.title, p.est, p.changes));
    s.nextId = 101 + lv.tickets;
    s.nextChange = lv.changeEvery ? lv.firstChange : lv.changeRand ? RND(...lv.changeRand) : Infinity;
    s.nextUrgent = lv.urgent ? lv.urgent.first : Infinity;
    s.ot = false; s.bigFired = false;
    // 每個人的下班時間；c0～c7 是其他同事
    s.leave = { pm: LEAVE.pm(), qa: LEAVE.qa(lv.stay), rev: LEAVE.rev(lv.stay), boss: LEAVE.boss(lv.stay) };
    for (let i = 0; i < 8; i++) s.leave['c' + i] = LEAVE.cw(lv.stay);
    s.gone = {}; s.leftLog = [];
  } else {
    Object.assign(s, {
      en: 72, bl: 35, page: null, pageQ: [], pages: [], lines: [], lineLog: [], dnd: null,
      sleepMin: 0, showered: false, escalated: 0, woke: 0,
      fam: FAMILY.start, famLog: [], kicked: false, wokePartner: 0, akai: 0, pagesDone: 0, ateTogether: false,
      delivery: { at: TN(20, 40), stage: 'coming', dl: 0 },
      nightEv: nightSchedule(lv),
    });
    if (mode === 'weekend') Object.assign(s, {
      en: 60, bl: 30, dnd: null, delivery: { stage: 'none' }, nightEv: weekendSchedule(lv),
      outing: null, plans: [], resumeOut: null, partnerBackAt: 0,
    });
  }
  return s;
}
function nightSchedule(lv) {
  const ev = [], times = [RND(TN(21, 0), TN(22, 50))];
  for (let n = 0; times.length < lv.night.pages && n < 500; n++) { const t = RND(TN(0, 20), TN(6, 40)); if (times.every(x => Math.abs(x - t) >= 50)) times.push(t); }
  const fakeAt = RND(0, times.length - 1);
  times.sort((a, b) => a - b).forEach((t, i) => ev.push({ t, page: i === fakeAt ? FALSE_ALARM : draw1('night', [...NIGHT_INCIDENTS, ...INCIDENTS.filter(x => !x.afterDeploy)]) }));
  const used = [];
  for (let i = 0; i < lv.night.line; i++) { let t; do { t = RND(TN(22, 0), TN(1, 30)); } while (used.some(x => Math.abs(x - t) < 30)); used.push(t); ev.push({ t, line: (lv.night.msgs || LINE_MSGS)[i % (lv.night.msgs || LINE_MSGS).length] }); }
  ev.push({ t: NIGHT_MSGS.mom.t, line: NIGHT_MSGS.mom }, { t: NIGHT_MSGS.mike.t, line: NIGHT_MSGS.mike });
  ev.push({ t: TN(21, 40), fam: 'show' }, { t: ALARM, handoff: true });
  return ev.sort((a, b) => a.t - b.t);
}
function weekendSchedule(lv) {
  const ev = [], times = [];
  for (let n = 0; times.length < lv.weekend.pages && n < 500; n++) { const t = RND(TW(0, 40), TW(23, 0)); if (times.every(x => Math.abs(x - t) >= 90)) times.push(t); }
  const fakeAt = RND(0, times.length - 1);
  times.sort((a, b) => a - b).forEach((t, i) => ev.push({ t, page: i === fakeAt ? FALSE_ALARM : draw1('night', [...NIGHT_INCIDENTS, ...INCIDENTS.filter(x => !x.afterDeploy)]) }));
  WEEKEND_PLANS.forEach(p => ev.push({ t: p.t, plan: p }));
  ev.push({ t: WEEKEND_MSGS.boss.t, line: WEEKEND_MSGS.boss });
  if (lv.key !== 'freeze') ev.push({ t: WEEKEND_MSGS.pm.t, line: WEEKEND_MSGS.pm });
  ev.push({ t: TW(22, 30), handoff: true, dl: 60 });
  return ev.sort((a, b) => a.t - b.t);
}
/* ---- 另一半：在哪裡、心情如何 ---- */
function famChange(d, text) {
  S.fam = Math.max(0, Math.min(FAMILY.max, S.fam + d));
  S.famLog.push(d);
  add(d * 2, `${text}（家人 ${d > 0 ? '+' : ''}${d} ❤）`);
}
function partnerSpot() {
  if (!S || !atHome() || !S.started) return 'sofa';
  if (isWeekend()) return S.outing || S.t < S.partnerBackAt ? 'out' : (S.t < TW(8, 0) || S.t >= TW(23, 30)) ? (S.kicked ? 'sofa' : 'bed') : 'sofa';
  if (S.t >= TN(23, 0) && S.t < ALARM) return S.kicked ? 'sofa' : 'bed';
  if (S.t >= S.delivery.at && S.t < TN(21, 30) && !S.ate) return 'table';
  return 'sofa';
}
/* 半夜手機一響，睡在旁邊的人也會醒 */
function wakePartner(why) {
  if (partnerSpot() !== 'bed') return;
  S.wokePartner++;
  famChange(-1, why);
  if (S.wokePartner >= 3 && !S.kicked) { S.kicked = true; note('小雯抱著枕頭去客廳睡了', 'b'); }
}
function newTicketObj(n, title, est, changes) {
  return { id: `T-${n}`, title, est, prog: 0, status: 'todo', ver: 1, fuzzy: false, bug: false, qaAt: 0, changes: shuffle(changes || []), pendingChange: false };
}
const ticket = id => S.tickets.find(t => t.id === id);

function note(text, kind) { S.log.unshift({ t: S.t, text, kind: kind || '' }); if (S.log.length > 60) S.log.pop(); dirty = true; }
function add(pts, text) { S.score += pts; if (pts > 0) S.stats.good++; if (pts < 0) S.stats.bad++; if (text) note(`${text}（${pts > 0 ? '+' : ''}${pts}）`, pts > 0 ? 'g' : pts < 0 ? 'b' : ''); }
function toast(text, ms) { S.toast = { text, until: performance.now() + (ms || 2600) }; }

/* ================= 上班：呼叫（NPC 頭上的驚嘆號） ================= */
function ping(npc, type, dl, data) {
  const p = { type, dl: S.t + dl, dlMin: dl, data: data || {} };
  if (S.pings[npc]) { (S.pq[npc] = S.pq[npc] || []).push(p); return; }
  S.pings[npc] = p;
  const who = npc === 'meet' ? '會議室' : NPC[npc].name;
  note(`${who}：${PING_LABEL[type]}（${hhmm(p.dl)} 前）`);
  toast(`${who} 找你：${PING_LABEL[type]}`);
  interrupt();
}
/* 寫 code 寫到一半被打斷：馬上停下來，還要付出一點切換脈絡的代價 */
function interrupt() {
  if (!S.busy || S.busy.kind !== 'code' || S.busy.left <= 0) return;
  S.busy.ctxSwitch = true;
  finishBusy(true);
}
function clearPing(npc) {
  S.pings[npc] = null;
  const q = S.pq[npc];
  if (q && q.length) { const p = q.shift(); ping(npc, p.type, p.dlMin, p.data); }
}
function missPing(npc, p) {
  const T = {
    urgent: () => { const t = addUrgent(p.data, false); add(-6, `${t.id} 急件沒先問清楚就硬做`); },
    big: () => { const t = addBig(p.data, false); add(-6, `${t.id} 沒跟 PM 對範圍，只好全部都做`); },
    change: () => { const t = ticket(p.data.tid); applyChange(t, p.data, true); add(-8, `沒跟 PM 確認就照猜的改 ${t.id}`); },
    status: () => add(-6, '主管等不到你的進度回報'),
    helpReview: () => add(-4, '阿凱的 PR 等你等到放棄了'),
    bounce: () => add(-5, 'QA 退件一直沒回'),
    report: () => add(-8, '事故沒有回報主管，主管是從客服那邊聽到的'),
    standup: () => add(-5, '站會沒到'),
    show: () => famChange(-1, '小雯自己把那集劇看完了'),
    plan: () => { S.plans.push({ label: p.data.plan.label, result: '沒回小雯，取消了' }); famChange(-1, `沒回小雯，${p.data.plan.label}取消了`); },
    handoff: () => add(-5, '沒交接，白天的 on-call 一頭霧水'),
  };
  T[p.type] && T[p.type]();
  clearPing(npc);
}

/* ================= 上班：需求變更 ================= */
function fireChange() {
  const live = S.tickets.filter(t => t.status !== 'done' && !t.pendingChange);
  const t = live.length ? pick(live) : null;
  if (!t) {
    const extra = pick(EXTRA_POOL);
    const nt = newTicketObj(S.nextId++, extra.title, extra.est, []);
    S.tickets.push(nt);
    note(`${LV.from}：加開一張新單 ${nt.id}「${nt.title}」`, 'b');
    toast(`新需求：${nt.id} ${nt.title}`);
    return;
  }
  const text = t.changes.length ? t.changes.shift() : '細節要再調整一下，畫面跟流程都要改';
  t.pendingChange = true;
  ping('pm', 'change', LV.changeDl, { tid: t.id, text, add: RND(...COST.changeAdd) });
}
function applyChange(t, d, fuzzy) {
  if (!t) return;
  t.pendingChange = false;
  S.stats.changes++;
  t.ver++; t.fuzzy = t.fuzzy || fuzzy;
  if (t.status === 'done') {
    const nt = newTicketObj(S.nextId++, `${t.title}（追加 v${t.ver}）`, d.add + 10, []);
    nt.fuzzy = fuzzy;
    S.tickets.push(nt);
    note(`${t.id} 已經上線了，變更開成新單 ${nt.id}`, 'b');
    return;
  }
  t.est += d.add;
  const lost = Math.round(t.prog * LV.rework);
  t.prog = Math.max(0, t.prog - lost);
  const back = ['review', 'qa', 'testing', 'ready'].includes(t.status);
  if (t.status !== 'todo') t.status = 'dev';
  note(`${t.id} 改成 v${t.ver}：多 ${d.add} 分鐘${lost ? `，返工 ${lost} 分鐘` : ''}${back ? '，退回開發中' : ''}`, 'b');
}

function addUrgent(d, clear) {
  const t = newTicketObj(S.nextId++, `⚡ ${d.title}`, clear ? Math.round(d.est * 0.75) : d.est, []);
  Object.assign(t, { urgent: true, due: S.t + LV.urgent.due, fuzzy: !clear });
  S.tickets.unshift(t);
  note(`⚡ 急件 ${t.id}：${hhmm(t.due)} 前要上線`, 'b');
  return t;
}
function addBig(d, clear) {
  const t = newTicketObj(S.nextId++, `📅 ${d.title}`, clear ? Math.round(d.est * LV.big.cut) : d.est, []);
  Object.assign(t, { big: true, fuzzy: !clear });
  S.tickets.unshift(t);
  note(`📅 ${t.id}：明天一早就要（約 ${t.est} 分鐘）`, 'b');
  return t;
}

/* ================= 上班：線上告警 ================= */
function fireAlert(afterDeploy) {
  if (S.alert) { S.timers.push({ t: S.t + 20, kind: 'alert', afterDeploy }); return; }
  const inc = afterDeploy ? INCIDENTS.find(i => i.afterDeploy) : draw1('dayInc', INCIDENTS.filter(i => !i.afterDeploy));
  S.alert = { inc, dl: S.t + COST.alertAck, esc: 0 };
  note(`🚨 監控告警：${inc.title}`, 'b');
  toast('🚨 監控告警！到機房看監控牆', 3500);
  // 告警比什麼都優先：手上在做的事先停下來（上廁所除外）
  if (S.busy && S.busy.kind !== 'wc' && S.busy.kind !== 'fix') { if (S.busy.kind === 'code') interrupt(); else finishBusy(true); }
}

/* ================= 下班 on-call：page 與 LINE ================= */
function firePage(inc) {
  if (S.page) { S.pageQ.push(inc); return; }
  S.page = { inc, stage: 'ring', dl: S.t + 5, esc: 0, at: S.t };
  S.pages.push({ inc, at: S.t, result: '處理中' });
  note(`📟 Page：${inc.title}`, 'b');
  if (S.outing) return pageWhileOut();
  toast('📟 page 響了！按「接 page」或 T', 4000);
  if (S.busy && S.busy.kind === 'sleep') { finishBusy(true); add(-12, '被 page 吵醒了 😵'); wakeHit('被 page 吵醒'); wakePartner('page 也把小雯吵醒了'); }
  else if (S.busy && (S.busy.kind === 'rest' || S.busy.kind === 'tv' || S.busy.kind === 'idle')) finishBusy(true);
  dirty = true;
}
/* ---- 假日：出門時被 page ---- */
function startOuting(plan, laptop, phoneOff, mins) {
  S.outing = { plan, laptop, phoneOff, from: S.t };
  S.me = { x: HS.door.x, y: HS.door.y }; S.path = [];
  note(`跟小雯${plan.label}${laptop ? '（背著筆電）' : ''}${phoneOff ? '（手機關機）' : ''}`);
  startBusy('out', mins, plan.label, (done, early) => {
    if (early) return;   // 被 page 打斷的情況另外處理
    const o = S.outing; S.outing = null;
    if (plan.meal) S.ate = true;
    S.en = Math.min(100, S.en + 6);
    const cut = o.cut ? 1 : 0;
    S.plans.push({ label: plan.label, result: o.cut ? '中途開筆電，勉強完成' : '開開心心完成' });
    famChange(plan.fam - cut, `${plan.label}${o.cut ? '，雖然中間跑去處理事故' : '，玩得很開心'}`);
    if (o.phoneOff && S.page) { note('開機一看：page 已經響了好幾次……', 'b'); toast('📟 開機才看到 page！快處理', 4000); }
    else if (o.phoneOff && S.pages.some(x => x.at >= o.from && /升級/.test(x.result))) { note('開機一看：阿凱傳了 12 則「你在哪？」', 'b'); toast('開機才發現 page 已經升級給阿凱了……', 4000); }
  });
}
function pageWhileOut() {
  const o = S.outing;
  if (o.phoneOff) { note('手機關機中，沒聽到 page……', 'b'); return; }
  const left = S.busy && S.busy.kind === 'out' ? S.busy.left : 0;
  S.busy = null;   // 行程先停下來
  S.page.stage = 'acked'; S.page.dl = S.t + (o.laptop ? 15 : 50);
  add(2, '在外面也馬上 ack');
  if (o.laptop) {
    o.cut = true;
    S.resumeOut = { o, left };
    famChange(-1, `${o.plan.label}到一半打開筆電`);
    return info('page', `${o.plan.label}到一半，page 響了`, '你在角落打開筆電、連上手機熱點。小雯滑著手機等你。', handlePage);
  }
  S.outing = null; S.partnerBackAt = S.t + 60;
  S.plans.push({ label: o.plan.label, result: '被 page 打斷，丟下小雯趕回家' });
  famChange(-2, `${o.plan.label}到一半丟下小雯趕回家`);
  info('page', `${o.plan.label}到一半，page 響了`, '沒帶筆電，只能趕回家。小雯說她自己吃完再回去。', () => startBusy('commute', 30, '趕回家', () => { S.me = { x: HS.door.x, y: HS.door.y }; note('到家了，快去書房開筆電'); }));
}
/* 精神條一節 = 10%。第 n 次被叫醒扣 1 + 0.5 × (n − 1) 節 */
function wakeHit(why) {
  S.woke++;
  const mult = 1 + 0.5 * (S.woke - 1), hit = Math.round(10 * mult);
  S.en = Math.max(0, S.en - hit);
  note(`${why}：精神 -${hit}${S.woke > 1 ? `（第 ${S.woke} 次被叫醒，×${mult}）` : ''}`, 'b');
  const m = $('bEn').closest('.meter'); m.classList.remove('hit'); void m.offsetWidth; m.classList.add('hit');
}
function ackPage() {
  if (!S || !S.started || S.ended || S.paused || !ov.hidden || !S.page || S.page.stage !== 'ring') return;
  S.page.stage = 'acked'; S.page.dl = S.t + 15;
  if (!S.page.esc) add(2, '5 分鐘內 ack'); else note('終於 ack 了');
  toast('已 ack。快去書房開筆電');
  dirty = true;
}
function closePage(result) {
  const rec = S.pages[S.pages.length - 1]; if (rec) rec.result = result;
  S.page = null;
  if (S.resumeOut) {   // 假日在外面處理完，繼續行程
    const r = S.resumeOut; S.resumeOut = null;
    if (r.left > 10) { S.outing = null; startOuting(r.o.plan, r.o.laptop, r.o.phoneOff, r.left); S.outing.cut = true; }
    else { S.outing = null; S.plans.push({ label: r.o.plan.label, result: '處理完行程也結束了' }); }
  }
  if (/處理/.test(result) && ++S.pagesDone === 2) S.timers.push({ t: S.t + 3, kind: 'line', msg: NIGHT_MSGS.boss });
  if (S.pageQ.length) { const inc = S.pageQ.shift(); S.timers.push({ t: S.t + 2, kind: 'page', inc }); }
}
function fireLine(msg) {
  S.lines.push(msg);
  note(`💬 ${msg.who} 傳了訊息`);
  if (S.busy && S.busy.kind === 'sleep') {
    if (S.dnd) return;
    finishBusy(true);
    wakeHit(`沒開勿擾，被 ${msg.who} 的 LINE 吵醒`);
    wakePartner('手機半夜一直響，小雯也醒了');
  }
  toast(`💬 ${msg.who}：${msg.text.slice(0, 16)}…`, 3500);
  dirty = true;
}
function readLine() {
  if (!S || !S.started || S.ended || S.paused || !ov.hidden || S.busy || !S.lines.length) return;
  const msg = S.lines.shift();
  if (msg.opts) {
    return runSteps('line', [{ type: 'choice', title: `${msg.who}：「${msg.text}」`, html: `現在 ${hhmm(S.t)}，你怎麼回？`, opts: msg.opts }], res => {
      const i = res[0].pick;
      S.lineLog.push(`${msg.who}：${msg.opts[i].replace(/[「」]/g, '').slice(0, 12)}`);
      if (msg.pts[i]) add(msg.pts[i], `回 ${msg.who}`);
      if (msg.fam[i]) famChange(msg.fam[i], msg.fam[i] > 0 ? `回了${msg.who}` : `${msg.who}那邊冷掉了`);
      const after = () => info('line', '已回覆', esc(msg.why));
      if (msg.busy[i]) startBusy(msg.busy[i] >= 20 ? 'code' : 'phone', msg.busy[i], msg.busy[i] >= 20 ? '半夜爬起來查' : '回訊息', after); else after();
    });
  }
  runSteps('line', [{ type: 'choice', title: `${msg.who}：「${msg.text}」`, html: `現在 ${hhmm(S.t)}，你怎麼回？`, opts: LINE_REPLY.opts }], res => {
    const i = res[0].pick, pts = LINE_REPLY.pts[i];
    S.lineLog.push(`${msg.who}：${['設好界線', '爬起來改', '已讀不回', '亂答應'][i]}`);
    add(pts, i === 0 ? '半夜的需求，明天再說' : i === 1 ? '半夜爬起來改需求' : i === 2 ? '已讀不回，對方很焦慮' : '答應了卻沒改，明天會很尷尬');
    if (i === 1) famChange(-1, '半夜爬起來改需求，小雯翻了個身');
    const after = () => info('line', i === 0 ? '設好界線 👍' : '嗯……', esc(LINE_REPLY.why));
    if (i === 1) startBusy('code', COST.lineCode, '半夜爬起來改', after); else startBusy('phone', COST.lineReply, '回 LINE', after);
  });
}

/* ================= 時間流逝 ================= */
function tick(dm) {
  const prev = S.t; S.t += dm;
  for (const tm of S.timers.slice()) if (S.t >= tm.t) {
    S.timers.splice(S.timers.indexOf(tm), 1);
    if (tm.kind === 'alert') fireAlert(tm.afterDeploy);
    if (tm.kind === 'page') firePage(tm.inc);
    if (tm.kind === 'line') fireLine(tm.msg);
  }
  if (atHome()) tickNight(prev, dm); else tickDay(prev, dm);
  if (S.ended) return;
  dirty = true;
  if (S.en <= 0) return endShift(true);
  if (!isNight() && !S.ot && !S.otAsked && S.t >= DAY_END && S.tickets.some(t => t.status !== 'done')) {
    if (S.busy && S.busy.kind === 'code') finishBusy(true);   // 寫到一半先存檔
    if (S.busy) return;                                        // 其他事做完再問
    return askOvertime();
  }
  if (S.t >= endT()) return endShift(false);
}
/* 18:00 還有單沒上線：準時下班，還是留下來加班？ */
function askOvertime() {
  S.otAsked = true; S.path = []; S.pendingHs = null;
  const left = S.tickets.filter(t => t.status !== 'done'), big = left.some(t => t.big);
  runSteps('boss', [{ type: 'choice', keep: true, title: '18:00 了，看板上還有單沒上線',
    html: `<p>還沒上線：${left.map(t => `<code>${t.id}</code>`).join('、')}。${big ? '<br><b>明天 demo 要用的那張還沒好。</b>' : ''}</p><p>${here('pm') ? '' : '安娜已經準時下班了。'}辦公室還有：${stillHere().join('、') || '沒有人'}。</p>${here('boss') ? '<p>大衛經過你的座位：「今天辛苦了～」然後看了看看板。</p>' : ''}<small>加班最晚到 ${hhmm(OT_END)}。加班時精神掉得更快、每 30 分鐘扣分。小芸、阿凱下班之後就沒人幫你測、幫你 review。沒做完的單每張 -5${big ? '，demo 開天窗再 -15' : ''}。</small>`,
    opts: ['留下來加班', '準時下班'] }], res => {
    if (res[0].pick === 1) { note('18:00 準時下班 🏃'); return endShift(false); }
    startOvertime();
  });
}
function startOvertime() {
  S.ot = true;
  note('18:00 留下來加班', 'b');
  toast(`加班中：右上角可以隨時下班（最晚 ${hhmm(OT_END)}）`, 4500);
}
function leaveWork() {
  if (!S || !S.ot || S.ended || S.paused || !ov.hidden) return;
  note(`${hhmm(S.t)} 收工下班`);
  endShift(false);
}
const here = k => !(S && S.gone && S.gone[k]);
const PEOPLE = { pm: '安娜', qa: '小芸', rev: '阿凱', boss: '大衛' };
function someoneLeaves(k) {
  S.gone[k] = true; S.leftLog.push({ k, t: S.leave[k] });
  if (!LEAVE_NOTE[k]) return;
  note(LEAVE_NOTE[k]);
  if (S.pings[k]) { S.pings[k] = null; S.pq[k] = []; }
  if (k === 'qa') {
    const undone = S.tickets.filter(t => t.status === 'testing');
    undone.forEach(t => { t.status = 'qa'; });
    if (undone.length) note(`小芸下班前沒測完 ${undone.map(t => t.id).join('、')}，退回待測`, 'b');
  }
}
function stillHere() {
  const names = Object.keys(PEOPLE).filter(here).map(k => PEOPLE[k]);
  const cw = Object.keys(S.leave).filter(k => k[0] === 'c' && here(k)).length;
  return names.concat(cw ? [`其他同事 ${cw} 人`] : []);
}
function tickDay(prev, dm) {
  for (const k in S.leave) if (here(k) && S.t >= S.leave[k]) someoneLeaves(k);
  while (S.evI < LV.events.length && LV.events[S.evI].t <= S.t) {
    const ev = LV.events[S.evI++];
    if (ev.ping) ping(...ev.ping);
    if (ev.alert) fireAlert(false);
  }
  while (S.changeI < LV.changeAt.length && LV.changeAt[S.changeI] <= S.t) { S.changeI++; fireChange(); }
  if (S.t >= S.nextUrgent) {
    ping('pm', 'urgent', 10, { ...draw1('urgent', URGENT_POOL) });
    S.nextUrgent = S.t + RND(...LV.urgent.every); if (S.nextUrgent > LV.urgent.last) S.nextUrgent = Infinity;
  }
  if (LV.big && !S.bigFired && S.t >= LV.big.at) { S.bigFired = true; ping('pm', 'big', LV.big.dl, { ...draw1('big', BIG_POOL) }); }
  for (const t of S.tickets) if (t.urgent && t.status !== 'done' && !t.late && S.t > t.due) { t.late = true; add(-10, `⚡ ${t.id} 急件超過時限`); }
  if (S.ot && Math.floor((prev - DAY_END) / 30) !== Math.floor((S.t - DAY_END) / 30)) add(-3, '又加班了 30 分鐘');
  if (S.t >= S.nextChange) { fireChange(); S.nextChange = LV.changeEvery ? S.t + RND(...LV.changeEvery) : Infinity; if (S.nextChange > TM(17, 15)) S.nextChange = Infinity; }
  for (const t of S.tickets) if (t.status === 'testing' && S.t >= t.qaAt) qaResult(t);
  for (const npc in S.pings) { const p = S.pings[npc]; if (p && S.t > p.dl) missPing(npc, p); }
  if (S.alert && S.t > S.alert.dl) { S.alert.esc++; S.alert.dl = S.t + COST.alertAck; add(-10, `告警沒人處理，已經升級第 ${S.alert.esc} 次`); toast('🚨 告警升級了！快去機房', 3000); }
  if (prev < LUNCH.open && S.t >= LUNCH.open) note('12:00 午餐時間，便當在茶水間');
  if (prev < DEPLOY.open && S.t >= DEPLOY.open) { note(`${hhmm(DEPLOY.open)} 部署窗口開了（到 ${hhmm(DEPLOY.close)}）`); toast('部署窗口開了：可上線的單回座位部署'); }
  if (prev < DEPLOY.close - 30 && S.t >= DEPLOY.close - 30 && S.tickets.some(t => t.status === 'ready')) toast('部署窗口剩 30 分鐘！', 3000);
  S.bl = Math.min(100, S.bl + 0.17 * dm);
  let drain = 0.085;
  if (S.busy && S.busy.kind === 'code') drain *= 1.25;
  if (!S.ate && S.t > LUNCH.late) drain *= 2;
  if (S.bl >= 100) drain *= 1.5;
  if (S.ot) drain *= 1.5;
  S.en = Math.max(0, S.en - drain * dm);
  if (S.bl >= 100 && Math.floor(prev / 10) !== Math.floor(S.t / 10)) S.score -= 1;
}
function tickNight(prev, dm) {
  while (S.evI < S.nightEv.length && S.nightEv[S.evI].t <= S.t) {
    const ev = S.nightEv[S.evI++];
    if (ev.page) firePage(ev.page);
    if (ev.line) fireLine(ev.line);
    if (ev.fam) ping('fam', ev.fam, 20);
    if (ev.handoff) ping('rev', 'handoff', ev.dl || 30);
    if (ev.plan) ping('fam', 'plan', 30, { plan: ev.plan });
  }
  for (const npc in S.pings) { const pg = S.pings[npc]; if (pg && S.t > pg.dl) missPing(npc, pg); }
  if (isNight() && prev < TN(23, 0) && S.t >= TN(23, 0)) note('小雯先去睡了：「你也早點睡喔」');
  if (isNight() && prev < TN(0, 30) && S.t >= TN(0, 30) && !(S.busy && S.busy.kind === 'sleep') && !S.page) famChange(-1, '小雯等不到你，自己先睡著了');
  const d = S.delivery;
  if (d.stage === 'coming' && S.t >= d.at) { d.stage = 'arrived'; d.dl = S.t + 15; note('🛵 外送到了，在大門口'); toast('🛵 外送到了！去大門拿'); }
  if (d.stage === 'arrived' && S.t > d.dl) { d.stage = 'cold'; note('外送放在門口放涼了', 'b'); }
  const p = S.page;
  if (p && p.stage === 'ring' && S.t > p.dl) {
    p.esc++;
    if (p.esc >= 3) { S.escalated++; add(-12, 'page 沒人接，升級到 secondary：阿凱被叫醒了'); closePage('升級給阿凱'); }
    else { add(-8, `page 沒有 ack（第 ${p.esc} 次重撥）`); p.dl = S.t + 5; toast('📟 page 又響了！按「接 page」或 T', 3500); }
  } else if (p && p.stage === 'acked' && S.t > p.dl) { add(-5, 'ack 了卻遲遲沒上線處理'); p.dl = S.t + 10; }
  const sleeping = S.busy && S.busy.kind === 'sleep';
  if (sleeping && S.sleepLat > 0) {
    // 還沒睡著：不算睡眠、不回精神
    S.sleepLat -= dm; S.bl = Math.min(100, S.bl + 0.05 * dm);
    if (S.sleepLat <= 0) S.busy.label = '睡覺 zZ';
  } else if (sleeping) { S.sleepMin += dm; S.en = Math.min(100, S.en + 0.2 * dm); S.bl = Math.min(100, S.bl + 0.05 * dm); }
  else {
    S.bl = Math.min(100, S.bl + 0.17 * dm);
    let drain = 0.07;
    if (!S.ate && (isWeekend() ? (S.t > TW(13, 30) && S.t < TW(18, 0)) || S.t > TW(20, 0) : S.t > TN(22, 0))) drain *= 2;
    if (S.bl >= 100) drain *= 1.5;
    S.en = Math.max(0, S.en - drain * dm);
    if (S.bl >= 100 && Math.floor(prev / 10) !== Math.floor(S.t / 10)) S.score -= 1;
  }
  if (sleeping && S.bl >= 95) { finishBusy(true); note('被尿意憋醒了'); }
  if (isWeekend() && prev < WEEKEND_WAKE && S.t >= WEEKEND_WAKE) { if (S.busy && S.busy.kind === 'sleep') finishBusy(true); note('☀ 08:30 自然醒，週六早安'); }
  if (isWeekend() && prev < TW(18, 0) && S.t >= TW(18, 0) && S.ate && !S.outing) { S.ate = false; note('晚餐時間，又餓了'); }
  if (isNight() && prev < ALARM && S.t >= ALARM) { if (S.busy && S.busy.kind === 'sleep') finishBusy(true); note('⏰ 07:30 鬧鐘響了'); toast('⏰ 早安。08:00 交接給白天的 on-call'); }
}
function qaResult(t) {
  const bugP = t.bug ? 0.9 : t.fuzzy ? 0.55 : 0.12;
  if (Math.random() < bugP) {
    t.status = 'dev'; t.prog = Math.max(0, t.est - RND(...COST.bugFix)); t.bug = false; t.fuzzy = false;
    S.stats.bounces++;
    ping('qa', 'bounce', 30, { tid: t.id, text: pick(BUG_TEXTS) });
  } else {
    t.status = 'ready';
    note(`${t.id} QA 測試通過，可以上線`, 'g');
    toast(`${t.id} 測試通過 ✅`);
  }
}

/* ================= 卡片（對話框） ================= */
let MODAL = null;
function whoHead(k) { const n = NPC[k] || NPC.sys; return `<div class="who"><span class="badge" style="background:${n.color}">${n.tag}</span><b>${n.name}</b><span class="when">${S && S.started ? hhmm(S.t) : ''}</span></div>`; }
function openCard(html) { for (const k in keys) keys[k] = false; card.innerHTML = html; ov.hidden = false; card.scrollTop = 0; const b = card.querySelector('.btn.primary,.btn'); b && b.focus({ preventScroll: true }); }
function closeCard() { ov.hidden = true; MODAL = null; dirty = true; }
function info(who, title, html, after, btn) {
  MODAL = { kind: 'info' };
  openCard(`${whoHead(who)}<h4>${title}</h4><div class="body">${html}</div><div class="acts"><button class="btn primary" id="mOK">${btn || '好'}</button></div>`);
  $('mOK').onclick = () => { closeCard(); after && after(); };
}
function menu(who, title, html, items) {
  MODAL = { kind: 'menu', items };
  openCard(`${whoHead(who)}<h4>${title}</h4>${html ? `<div class="body">${html}</div>` : ''}<div class="opts">${items.map((it, i) => `<button class="opt" data-opt="${i}" ${it.disabled ? 'disabled' : ''}><span class="k">${i + 1}</span><b>${it.label}</b>${it.sub ? `<small>${it.sub}</small>` : ''}</button>`).join('')}</div>`);
  card.querySelectorAll('[data-opt]').forEach(b => b.onclick = () => { const it = items[+b.dataset.opt]; closeCard(); it.go && it.go(); });
}

/* 多步驟小測驗。step.type：info / single（有標準答案）/ choice（沒有對錯）/ check（複選） */
function runSteps(who, steps, done) { MODAL = { kind: 'steps', who, steps, i: 0, res: [], done }; renderStep(); }
function renderStep() {
  const m = MODAL, st = m.steps[m.i];
  let h = whoHead(st.who || m.who);
  if (m.steps.length > 1) h += `<div class="stepn">${m.i + 1} / ${m.steps.length}</div>`;
  h += `<h4>${st.title}</h4>`;
  if (st.html) h += `<div class="body">${st.html}</div>`;
  if (st.code) h += `<pre class="code">${esc(st.code)}</pre>`;
  if (st.type === 'info') h += `<div class="acts"><button class="btn primary" id="mNext">${st.btn || '繼續'}</button></div>`;
  if (st.type === 'single' || st.type === 'choice') {
    st.order = st.order || (st.keep ? st.opts.map((_, i) => i) : shuffle(st.opts.map((_, i) => i)));
    h += `<div class="opts">${st.order.map((oi, k) => `<button class="opt" data-opt="${oi}"><span class="k">${k + 1}</span>${esc(st.opts[oi])}</button>`).join('')}</div><div id="fb"></div>`;
  }
  if (st.type === 'check') {
    st.order = st.order || shuffle(st.items.map((_, i) => i));
    h += `<div class="checks">${st.order.map((ii, k) => `<label class="chk"><input type="checkbox" data-ci="${ii}"><span class="k">${k + 1}</span>${esc(st.items[ii].t)}</label>`).join('')}</div><div id="fb"></div><div class="acts"><button class="btn primary" id="mConfirm">確認</button></div>`;
  }
  openCard(h);
  if (st.type === 'info') $('mNext').onclick = next;
  if (st.type === 'single' || st.type === 'choice') card.querySelectorAll('[data-opt]').forEach(b => b.onclick = () => answer(+b.dataset.opt));
  if (st.type === 'check') $('mConfirm').onclick = confirmCheck;
}
function answer(i) {
  const m = MODAL, st = m.steps[m.i];
  if (m.answered) return;
  if (st.type === 'choice') { m.res[m.i] = { pick: i }; return next(); }
  m.answered = true;
  const ok = i === st.a;
  m.res[m.i] = { ok, pick: i };
  card.querySelectorAll('[data-opt]').forEach(b => { b.disabled = true; const oi = +b.dataset.opt; if (oi === st.a) b.classList.add('right'); else if (oi === i) b.classList.add('wrong'); });
  $('fb').innerHTML = `<div class="fb ${ok ? 'g' : 'b'}"><b>${ok ? '正確' : '不太對'}</b>　${esc(st.why || '')}</div><div class="acts"><button class="btn primary" id="mNext">繼續</button></div>`;
  $('mNext').onclick = next; $('mNext').focus({ preventScroll: true });
}
function confirmCheck() {
  const m = MODAL, st = m.steps[m.i];
  if (m.answered) return;
  m.answered = true;
  let right = 0, wrong = 0, miss = 0;
  card.querySelectorAll('[data-ci]').forEach(c => {
    const it = st.items[+c.dataset.ci]; c.disabled = true;
    const lab = c.closest('.chk');
    if (it.ok) lab.classList.add('right');
    if (c.checked && it.ok) right++; else if (c.checked) { wrong++; lab.classList.add('wrong'); } else if (it.ok) miss++;
  });
  const ok = !wrong && !miss;
  m.res[m.i] = { ok, right, wrong, miss };
  $('fb').innerHTML = `<div class="fb ${ok ? 'g' : 'b'}"><b>${ok ? '全部正確' : `勾對 ${right} 項${wrong ? `、多勾 ${wrong} 項` : ''}${miss ? `、漏了 ${miss} 項` : ''}`}</b>　${esc(st.why || '')}</div>`;
  const b = $('mConfirm'); b.textContent = '繼續'; b.onclick = next; b.focus({ preventScroll: true });
}
function next() {
  const m = MODAL;
  m.answered = false;
  if (m.i < m.steps.length - 1) { m.i++; renderStep(); return; }
  closeCard(); m.done && m.done(m.res);
}
function modalKey(e) {
  if (e.key === 'Escape' && MODAL && MODAL.pause) return togglePause();
  if (/^[1-9]$/.test(e.key)) {
    const opts = card.querySelectorAll('[data-opt]:not([disabled])'), chks = card.querySelectorAll('[data-ci]:not([disabled])');
    const k = +e.key - 1;
    if (opts[k]) opts[k].click(); else if (chks[k]) chks[k].checked = !chks[k].checked;
  }
  if (e.key === 'Enter') { const b = card.querySelector('#mNext,#mConfirm,#mOK'); if (b && document.activeElement !== b) { e.preventDefault(); b.click(); } }
}

/* ================= 忙碌中（寫 code、開會、吃飯、睡覺…時間快轉） ================= */
function startBusy(kind, mins, label, onDone) { S.busy = { kind, left: mins, full: mins, label, onDone, logAt: S.log.length }; S.path = []; S.pendingHs = null; }
/* 在家等待：快轉到有事發生為止（最多 1 小時） */
function waitAWhile() {
  if (!S || !atHome() || !S.started || S.ended || S.paused || !ov.hidden || S.busy) return;
  startBusy('idle', 60, '等待中…');
}
function finishBusy(early) {
  const b = S.busy; if (!b) return;
  S.busy = null;
  b.onDone && b.onDone(b.full - Math.max(0, b.left), early, b);
  dirty = true;
}
const busyRate = () => S.busy && S.busy.kind === 'sleep' ? SLEEP_RATE : BUSY_RATE;

/* ================= 互動 ================= */
function interact(id) {
  if (!S.started || S.ended || S.busy || !ov.hidden) return;
  const day = { desk: atDesk, rev: atRev, qa: atQA, pm: atPM, boss: atBoss, meet: atMeet, coffee: atCoffee, bento: atBento, wc: atWC, monitor: atMonitor };
  const night = { bed: atBed, laptop: atLaptop, sofa: atSofa, wc: atWC, shower: atShower, table: atTable, door: atDoor };
  const f = (atHome() ? night : day)[id];
  f && f();
}

/* ---- 上班 ---- */
function atDesk() {
  const rank = t => t.urgent ? t.due : t.big ? 1e5 : 2e5;
  const codable = S.tickets.filter(t => t.status === 'todo' || t.status === 'dev').sort((a, b) => rank(a) - rank(b));
  const ready = S.tickets.filter(t => t.status === 'ready'), hot = ready.filter(t => t.urgent);
  const open = S.ot || (S.t >= DEPLOY.open && S.t <= DEPLOY.close);
  const items = [];
  if (ready.length && open) items.push({ label: `部署 ${ready.map(t => t.id).join('、')} 到正式環境`, sub: '大約 15 分鐘', go: () => deploy(ready) });
  else {
    if (hot.length) items.push({ label: `緊急部署 ${hot.map(t => t.id).join('、')}`, sub: '急件走 hotfix，不用等部署窗口', go: () => deploy(hot) });
    if (ready.length > hot.length) items.push({ label: `部署 ${ready.filter(t => !t.urgent).map(t => t.id).join('、')}`, sub: `部署窗口 ${hhmm(DEPLOY.open)}–${hhmm(DEPLOY.close)}`, disabled: true });
  }
  codable.forEach(t => items.push({
    label: `寫 ${t.id}「${t.title}」${t.ver > 1 ? ` v${t.ver}` : ''}`,
    sub: `還要 ${t.est - t.prog} 分鐘${t.urgent ? `　⚡ ${hhmm(t.due)} 前要上線` : ''}${t.big ? '　📅 明天一早要' : ''}${t.pendingChange ? '　⚠ PM 正在找你談這張的變更' : ''}`,
    go: () => code(t),
  }));
  if (!items.length) return info('me', '你的電腦', '目前沒有可以寫的單。看看右邊的看板：要 review、交測，還是等 QA？');
  items.push({ label: '先不要', sub: '' });
  menu('me', '你的電腦', '要做什麼？寫 code 時點一下地圖可以先停下來。', items);
}
function code(t) {
  if (t.status === 'todo') t.status = 'dev';
  const mins = Math.min(COST.codeBlock, t.est - t.prog);
  startBusy('code', mins, `寫 ${t.id}`, (done, early, b) => {
    if (b.ctxSwitch) { const lost = Math.min(COST.ctxSwitch, Math.round(done)); done -= lost; if (lost) note(`寫 ${t.id} 寫到一半被打斷，回神又花了 ${lost} 分鐘`, 'b'); }
    t.prog = Math.min(t.est, t.prog + Math.round(done));
    if (t.prog >= t.est) { t.status = 'review'; note(`${t.id} 寫完了，去找阿凱 code review`, 'g'); toast(`${t.id} 寫完了 → 找阿凱 review`); }
  });
}
function deploy(ready) {
  runSteps('me', [{ type: 'choice', keep: true, title: '按下部署前，在團隊群組說一聲：', opts: DEPLOY_SAY.opts }], res => {
    const p = res[0].pick;
    if (p === 0) add(3, '部署前有先通知大家');
    if (p === 1) { S.jinx = true; note('你說了「應該沒問題」……機房的燈好像閃了一下', 'b'); }
    if (p === 2) add(-2, '默默部署，大家嚇一跳');
    startBusy('deploy', COST.deploy, '部署中', () => {
      ready.forEach(t => {
        if (t.status !== 'ready') return;
        t.status = 'done'; S.deployed++; add(15, `${t.id} 上線了 🚀`);
        if (t.urgent && !t.late) add(8, `⚡ ${t.id} 急件準時上線`);
      });
      if (S.ot && S.tickets.every(t => t.status === 'done')) { note('全部上線了，終於可以回家', 'g'); return endShift(false); }
      const risk = 0.15 + (p === 1 ? 0.45 : 0) + (S.ot ? 0.15 : 0);  // 下班時間部署比較容易出事
      if (Math.random() < risk) S.timers.push({ t: S.t + RND(4, 12), kind: 'alert', afterDeploy: true });
    });
  });
}
function reviewOwn(t, after) {
  const q = draw1('review', REVIEW);
  runSteps('rev', [{ type: 'single', title: `阿凱在看你的 ${t.id}：「這段你自己看得出問題嗎？」`, code: q.code, opts: q.opts, a: q.a, why: q.why }], res => {
    if (res[0].ok) { add(5, `${t.id} review 一次過`); }
    else { t.bug = true; add(-3, `${t.id} review 沒抓到問題，QA 可能會退`); }
    t.status = 'qa'; note(`${t.id} 可以交給小芸測試了`);
    startBusy('review', COST.reviewOwn, 'Code review', after);
  });
}
function atRev() {
  const p = S.pings.rev;
  const own = S.tickets.find(t => t.status === 'review');
  if (!here('rev')) {
    if (!own) return info('rev', '阿凱已經下班了', '螢幕上貼著一張便利貼：「明天再說」。');
    return info('rev', '阿凱已經下班了', `沒人幫你 review ${own.id}，只能自己看一遍就 merge。<br><small>沒有第二雙眼睛，比較容易有 bug 跑到 QA 那邊。</small>`, () => startBusy('review', COST.reviewOwn, '自己 review', () => {
      if (Math.random() < 0.5) own.bug = true;
      own.status = 'qa'; note(`${own.id} 自己 review 完 merge 了（祈禱）`);
      if (S.tickets.some(t => t.status === 'review')) atRev();
    }));
  }
  if (p) {
    const q = draw1('review', REVIEW);
    runSteps('rev', [{ type: 'single', title: '阿凱：「幫我看一下這個 PR，總覺得哪裡怪怪的」', code: q.code, opts: q.opts, a: q.a, why: q.why }], res => {
      clearPing('rev');
      if (res[0].ok) add(6, '幫阿凱抓到 bug'); else add(-2, '幫阿凱 review 卻按了 LGTM');
      startBusy('review', COST.reviewHelp, '幫阿凱 review', () => { if (own) atRev(); });
    });
    return;
  }
  if (own) return reviewOwn(own, () => { if (S.tickets.some(t => t.status === 'review')) atRev(); });
  info('rev', '阿凱戴著降噪耳機', '他在專心寫 code。等你有寫完的單再來找他 review。');
}
function atQA() {
  if (!here('qa')) return handoff(true);
  const p = S.pings.qa;
  if (p) {
    const t = ticket(p.data.tid);
    runSteps('qa', [{ type: 'single', title: `小芸：「${t.id} ${p.data.text}，我退回去囉」`, html: '你怎麼回？', opts: QA_REPLY.opts, a: QA_REPLY.a, why: QA_REPLY.why }], res => {
      clearPing('qa');
      if (res[0].ok) add(4, `${t.id} 找到 bug 原因`); else { add(-3, `${t.id} 跟 QA 來回拉扯`); t.est += 15; }
      startBusy('talk', COST.bounceTalk, '跟小芸重現 bug', () => handoff());
    });
    return;
  }
  handoff(true);
}
function handoff(alone) {
  const q = S.tickets.filter(t => t.status === 'qa');
  if (!here('qa')) {
    if (!q.length) { if (alone) info('qa', '小芸已經下班了', '座位上只剩一杯喝完的珍奶。'); return; }
    return info('qa', '小芸已經下班了', '只能自己測了。', () => startBusy('test', COST.selfTest, '自己測', () => { q.forEach(t => { if (t.status === 'qa') t.status = 'ready'; }); note(`自己測完 ${q.map(t => t.id).join('、')}，可以部署了`); }));
  }
  if (!q.length) { if (alone) info('qa', '小芸', '「目前沒有要測的東西喔。寫好、review 過再拿來給我。」'); return; }
  q.forEach(t => { t.status = 'testing'; t.qaAt = S.t + COST.handoff + (t.urgent ? RND(...COST.qaUrgent) : RND(...COST.qa)); });
  const hasHot = q.some(t => t.urgent);
  info('qa', '交給小芸測試', `「收到，${q.map(t => t.id).join('、')} ${hasHot ? '急件我先測，20 分鐘內給你結果' : '我大概一個小時內測完'}。」<br><small>測試期間如果需求又改了，就要重測。</small>`, () => startBusy('talk', COST.handoff, '寫測試說明'));
}
function atPM() {
  const p = S.pings.pm;
  if (!here('pm')) return info('pm', '安娜已經下班了', '座位上只剩一杯喝完的手搖，和一張寫著「需求 v3？」的便利貼。');
  if (!p) return info('pm', '安娜在講電話', '「對對對，那個我們評估一下……」她揮手示意你先回去。');
  if (p.type === 'urgent') {
    return runSteps('pm', [
      { type: 'info', title: `⚡ 急件：${p.data.title}`, html: `<div class="quote">${LV.from}：<b>「${esc(p.data.title)}」，${LV.urgent.due / 60} 小時內要上線。</b></div><p>預估 ${p.data.est} 分鐘。急件可以不等部署窗口，直接緊急部署。</p>` },
      { type: 'check', title: '動手之前，先跟安娜確認哪些事？（複選）', items: URGENT_ITEMS, why: '急件更要問清楚：最小範圍、哪張單往後延、怎麼驗證。範圍砍對了，做起來快很多。' },
    ], res => {
      clearPing('pm');
      const clear = res[1].ok, t = addUrgent(p.data, clear);
      if (clear) add(3, '急件範圍對清楚了'); else add(-3, '急件只問了一半');
      startBusy('talk', COST.urgentTalk, '跟安娜對急件');
      info('pm', '急件排進來了', `${t.id} 約 ${t.est} 分鐘，<b>${hhmm(t.due)} 前</b>要上線。${clear ? '<br><small>範圍砍到最小，比原本少 25%。</small>' : '<br><small>範圍沒對清楚，QA 退件的機率會變高。</small>'}`);
    });
  }
  if (p.type === 'big') {
    return runSteps('pm', [
      { type: 'info', title: `📅 明天就要：${p.data.title}`, html: `<div class="quote">${LV.from}：<b>「${esc(p.data.title)}」明天早上 demo 要用。</b></div><p>全部做完大約 ${p.data.est} 分鐘。18:00 做不完就得加班（最晚 ${hhmm(OT_END)}）。</p>` },
      { type: 'check', title: '要怎麼跟安娜談？（複選）', items: BIG_ITEMS, why: '先把 demo 真正需要的部分做出來，其他的排到之後。講好回報時間，大家都安心。' },
    ], res => {
      clearPing('pm');
      const clear = res[1].ok, t = addBig(p.data, clear);
      if (clear) add(3, '範圍砍到 demo 要用的部分'); else add(-3, '範圍沒談好，只好全部都做');
      startBusy('talk', COST.bigTalk, '跟安娜談範圍');
      info('pm', clear ? '範圍談好了' : '只好全部都做', `${t.id} 約 ${t.est} 分鐘。${clear ? `<br><small>只做 demo 需要的部分，少了 ${Math.round((1 - LV.big.cut) * 100)}%。</small>` : ''}<br>18:00 前做不完就得加班。`);
    });
  }
  const t = ticket(p.data.tid);
  runSteps('pm', [
    { type: 'info', title: `需求變更：${t.id}「${t.title}」`, html: `<div class="quote">${LV.from}：<b>${esc(p.data.text)}</b></div><p>目前狀態：${STATUS[t.status]}，進度 ${t.prog}/${t.est} 分鐘。</p>` },
    { type: 'check', title: '動手改之前，先跟安娜確認哪些事？（複選）', items: CLARIFY_ITEMS, why: '問清楚驗收條件、影響範圍和時程，才不會改完又要再改。' },
    { type: 'choice', keep: true, title: '這個改動要放這一版嗎？', opts: ['放這一版，接受返工', '跟安娜協商，排到下一版'] },
  ], res => {
    clearPing('pm');
    const clear = res[1].ok;
    if (clear) add(2, '需求問得很清楚'); else add(-3, '需求只問了一半');
    let defer = false;
    if (res[2].pick === 1) defer = Math.random() < LV.negotiate + (clear ? 0.2 : 0);
    startBusy('talk', (clear ? COST.pmTalk.clear : COST.pmTalk.rushed) + (res[2].pick === 1 ? COST.pmTalk.negotiate : 0), '跟安娜討論需求');
    if (defer) {
      t.pendingChange = false; S.stats.deferred++;
      add(2, `${t.id} 的變更排到下一版`);
      info('pm', '協商成功 🎉', '安娜：「好，這個我們下個 sprint 再做。」');
    } else {
      applyChange(t, p.data, !clear);
      info('pm', res[2].pick === 1 ? '協商失敗' : '接受變更', `${res[2].pick === 1 ? '安娜：「老闆說這版一定要……拜託了 🙏」<br>' : ''}${t.id} 變成 v${t.ver}，多 ${p.data.add} 分鐘的工作。${clear ? '' : '<br><small>需求沒問清楚，QA 退件的機率會變高。</small>'}`);
    }
  });
}
function atBoss() {
  const p = S.pings.boss;
  if (!here('boss')) return info('boss', '大衛已經下班了', '椅子推得整整齊齊。');
  if (!p) return info('boss', '大衛在看報表', '「有事再找我，沒事就去寫 code 吧。」');
  if (p.type === 'status') {
    const done = S.tickets.filter(t => t.status === 'done').length, risky = S.tickets.filter(t => t.ver > 1 && t.status !== 'done').length;
    const opts = [`「${done} 張上線、${S.tickets.length - done} 張進行中；${risky ? `${risky} 張因為需求變更可能會晚，我已經跟 PM 在對範圍` : '目前沒有風險'}」`, '「都很順，應該沒問題」', '「還在寫」', '把每個 function 的實作細節講一遍'];
    runSteps('boss', [{ type: 'single', title: '大衛：「進度怎麼樣？等下要跟老闆報告」', opts, a: 0, why: '回報講結論：完成多少、還剩多少、有什麼風險、你打算怎麼處理。壞消息早點講比晚點講好。' }], res => {
      clearPing('boss');
      if (res[0].ok) add(5, '進度回報清楚'); else add(-3, '主管聽完還是不知道進度');
      startBusy('talk', COST.status, '跟主管報告');
      if (res[0].pick === 1) { S.jinx = true; note('你說了「應該沒問題」……', 'b'); }
    });
  } else if (p.type === 'report') {
    runSteps('boss', [{ type: 'check', title: `大衛：「剛剛的『${p.data.title}』怎麼回事？」要回報哪些？（複選）`, items: REPORT_ITEMS, why: '事故回報講事實：影響、時間、狀態、下一步。檢討是事後的事，而且對事不對人。' }], res => {
      clearPing('boss');
      if (res[0].ok) add(6, '事故回報完整'); else add(-2, '事故回報漏東漏西');
      startBusy('talk', COST.report, '回報事故');
    });
  }
}
function atMeet() {
  const p = S.pings.meet;
  if (!p) return info('sys', '會議室', '會議室空著，白板上寫著「Sprint 42：不要再改需求了」。');
  const first = S.tickets.find(t => t.status !== 'done') || S.tickets[0];
  const opts = STANDUP.opts.slice(); opts[0] = opts[0].replace('#1', first.id);
  runSteps('meet', [{ type: 'single', title: '站會輪到你了，你說：', opts, a: STANDUP.a, why: STANDUP.why }], res => {
    clearPing('meet');
    if (res[0].ok) add(4, '站會講得簡潔'); else add(-1, '站會講太久，大家都在看手錶');
    startBusy('meet', COST.standup[res[0].ok ? 0 : 1], '開站會');
  });
}
function atCoffee() {
  if (S.coffee >= 3) return info('me', '咖啡機', '你已經喝了三杯，手開始抖了。今天不要再喝了。');
  startBusy('coffee', COST.coffee, '泡咖啡', () => { S.coffee++; S.en = Math.min(100, S.en + 18); S.bl = Math.min(100, S.bl + 15); note(`喝了第 ${S.coffee} 杯咖啡 ☕`); });
}
function atBento() {
  if (S.ate) return info('me', '便當', '已經吃過了。');
  if (S.t < LUNCH.open) return info('me', '便當', `還沒到午餐時間（${hhmm(LUNCH.open)} 開飯）。`);
  startBusy('eat', COST.lunch, '吃便當', () => { S.ate = true; S.en = Math.min(100, S.en + 12); add(S.t <= LUNCH.late ? 2 : 0, S.t <= LUNCH.late ? '準時吃午餐' : '終於吃到午餐了'); });
}
function atWC() { startBusy('wc', COST.wc, '上廁所', () => { S.bl = 0; }); }
function atMonitor() {
  if (!S.alert) return info('sys', '監控牆', '所有圖表都是綠的 ✅<br><small>希望一直這樣下去。</small>');
  const a = S.alert, inc = a.inc;
  runSteps('mon', [{ type: 'single', title: `🚨 ${inc.title}`, html: `<ul class="mono">${inc.data.map(d => `<li>${esc(d)}</li>`).join('')}</ul><p>第一步要做什麼？</p>`, opts: inc.opts, a: inc.a, why: inc.why }], res => {
    S.alert = null; S.stats.incidents++;
    if (res[0].ok) add(10, `${inc.title}：處理得當`); else add(-5, `${inc.title}：繞了一大圈才修好`);
    startBusy('fix', COST.alertFix[res[0].ok ? 0 : 1], '處理事故', () => { note('事故排除了，記得去跟主管回報'); ping('boss', 'report', 25, { title: inc.title }); });
  });
}

/* ---- 下班 on-call ---- */
function atBed() {
  if (isWeekend() && !S.page && S.t >= TW(8, 0) && S.t < TW(21, 0)) return startBusy('sleep', 40, '午睡', (done) => { S.en = Math.min(100, S.en + 4); note(`午睡了 ${Math.round(done)} 分鐘`); });
  if (S.page) return info('home', '現在不能睡', S.page.stage === 'ring' ? '手機在響！先接 page。' : '你 ack 了一個 page，得先去書房處理完。');
  const sleep = () => {
    S.sleepLat = Math.min(COST.fallAsleep + COST.fallAsleepWoke * S.woke, 50);
    const until = isWeekend() ? (S.t < WEEKEND_WAKE ? WEEKEND_WAKE : WEEKEND_END) : ALARM;
    startBusy('sleep', Math.max(5, until - S.t), S.woke ? '翻來覆去睡不著…' : '躺著準備睡…', () => { if (S.napStart !== undefined) note(`睡了 ${dur(S.sleepMin - S.napStart)}`); S.napStart = undefined; });
    S.napStart = S.sleepMin;
  };
  if (S.dnd !== null) return sleep();
  runSteps('home', [{ type: 'choice', keep: true, title: '睡前，手機要開勿擾模式嗎？', html: 'PagerDuty 可以設成勿擾模式下也會響。', opts: ['開勿擾，只讓 on-call 的 page 響', '不用，所有通知照常響'] }], res => {
    S.dnd = res[0].pick === 0;
    if (S.dnd) add(2, '開了勿擾模式，只放行 page');
    sleep();
  });
}
function atLaptop() {
  const p = S.page;
  if (!p && S.pings.rev) {
    return runSteps('rev', [{ type: 'check', title: '交接給白天的 on-call 阿凱，要寫哪些？（複選）', items: HANDOFF_ITEMS, why: '交接要讓接手的人不用再問你：發生什麼、做到哪、還要追什麼。' }], res => {
      clearPing('rev');
      if (res[0].ok) add(5, '交接寫得清楚'); else add(-2, '交接寫得零零落落');
      startBusy('talk', 10, '寫交接', () => info('rev', '阿凱', res[0].ok ? '「收到，昨晚辛苦了，去睡吧！」' : '「呃……那 CPU 那個告警後來怎樣了？」'));
    });
  }
  if (!p) return info('home', '筆電', `Dashboard 一片綠 ✅<br><small>${isWeekend() ? '沒事就去過週末吧。' : '沒事就去休息吧，on-call 也要睡覺。'}</small>`);
  handlePage();
}
/* 處理 page：在書房的筆電，或假日在外面背著的筆電 */
function handlePage() {
  const p = S.page;
  if (!p) return;
  if (p.stage === 'ring') ackPage();
  if (p.stage === 'fixing') return info('home', '處理中', '你已經在處理這個 page 了。');
  p.stage = 'fixing';
  const inc = p.inc;
  runSteps('page', [{ type: 'single', title: `📟 ${inc.title}`, html: `<p>連上 VPN，打開 dashboard：</p><ul class="mono">${inc.data.map(d => `<li>${esc(d)}</li>`).join('')}</ul><p>${inc.fake ? '這要怎麼處理？' : '第一步要做什麼？'}</p>`, opts: inc.opts, a: inc.a, why: inc.why }], res => {
    S.stats.incidents++;
    if (res[0].ok) add(6, `${inc.title}：處理得當`); else add(-6, `${inc.title}：繞了一大圈才搞定`);
    let mins = (inc.fake ? COST.fakeFix : COST.pageFix)[res[0].ok ? 0 : 1];
    const work = () => startBusy('fix', mins, inc.fake ? '調整告警' : '半夜救火', () => {
      const when = hhmm(p.at);
      const opts = [`「${when} ${inc.title}，已處理完畢，目前服務正常。影響：${inc.fake ? '無（假警報，已調整閾值）' : '部分使用者約 20 分鐘'}。明天追蹤根本原因。」`, '「修好了」', '什麼都不寫，趕快回去睡', '貼一張很長的 log 截圖'];
      runSteps('page', [{ type: 'single', title: '在事故頻道更新狀態：', opts, a: 0, why: '白天的同事醒來第一件事就是看這則。寫清楚時間、影響、目前狀態和後續，他們就不用再叫醒你。' }], r2 => {
        if (r2[0].ok) add(2, '事故頻道更新清楚'); else add(-4, '事故頻道只寫一半，早上大家一頭霧水');
        startBusy('fix', COST.incUpdate, '寫事故更新', () => {
          closePage(res[0].ok ? '已處理' : '處理完（繞了遠路）');
          toast('處理完了，回去睡吧 😴');
        });
      });
    });
    if (res[0].ok || inc.fake) return work();
    // 判斷錯了、越弄越久：要不要叫醒 secondary？
    runSteps('page', [{ type: 'choice', keep: true, title: '越弄越久，還是找不到原因……', html: `<p>照現在這樣大概還要 ${mins} 分鐘。secondary on-call 是阿凱。</p>`, opts: ['打給阿凱，兩個人一起看', '自己撐下去'] }], r => {
      if (r[0].pick === 0) {
        S.akai++; mins = COST.pageFix[0];
        add(-2, '凌晨把阿凱叫醒');
        info('rev', '阿凱（睡眼惺忪）', '「……嗯，我看一下。欸，是不是這裡？」<br><small>兩個人一起看快多了，但明天要請他喝咖啡。</small>', work);
      } else work();
    });
  });
}
function atSofa() {
  if (S.pings.fam && S.pings.fam.type === 'plan') return askPlan(S.pings.fam.data.plan);
  if (S.pings.fam) {
    return runSteps('fam', [{ type: 'choice', keep: true, title: '小雯：「要不要一起看一集劇？」', html: '一集大約 45 分鐘。', opts: ['好啊，一起看', '「我在 on-call，可能看到一半就要跑」', '「改天吧，我想先休息」'] }], res => {
      clearPing('fam');
      const i = res[0].pick;
      if (i === 1) return famChange(1, '先講清楚 on-call 的狀況，小雯說沒關係');
      if (i === 2) return famChange(-1, '小雯自己看了');
      startBusy('tv', 45, '跟小雯看劇', (done, early) => {
        S.en = Math.min(100, S.en + 6);
        if (early && S.page) famChange(-1, '劇看到一半跑去救火，小雯嘆了一口氣');
        else if (!early) famChange(2, '跟小雯看完一集劇');
      });
    });
  }
  startBusy('rest', COST.sofa, partnerSpot() === 'sofa' && (isWeekend() || S.t < TN(23, 0)) ? '跟小雯窩在沙發' : '癱在沙發上', () => { S.en = Math.min(100, S.en + 5); });
}
/* 假日：小雯約你出門 */
function askPlan(plan) {
  const steps = [{ type: 'choice', keep: true, title: `小雯：${plan.ask}`, html: `<small>${plan.label}大約 ${plan.mins} 分鐘。你今天在值班。</small>`, opts: ['好啊，走吧', '「我在值班，去近一點、早點回來」', '「今天值班，不去了」'] }];
  runSteps('fam', steps, res => {
    clearPing('fam');
    const i = res[0].pick;
    if (i === 2) { S.plans.push({ label: plan.label, result: '值班沒去' }); return famChange(-1, `值班，${plan.label}沒去`); }
    const mins = i === 1 ? Math.round(plan.mins * 0.6) : plan.mins;
    const gear = [{ type: 'choice', keep: true, title: '出門前：要帶筆電嗎？', html: '<small>沒帶的話，page 一響就得趕回家。</small>', opts: ['帶筆電，背包重一點', '不帶，相信今天很平靜'] }];
    if (plan.movie) gear.push({ type: 'choice', keep: true, title: '電影院裡，手機要怎麼辦？', opts: ['調震動放口袋', '關機，專心看電影'] });
    runSteps('me', gear, g => {
      if (i === 1) famChange(0, '先說好值班要早點回來');
      startOuting(i === 1 ? { ...plan, fam: plan.fam - 1 } : plan, g[0].pick === 0, plan.movie && g[1].pick === 1, mins);
    });
  });
}
function atShower() {
  if (S.showered) return info('home', '淋浴', '已經洗過了。');
  startBusy('shower', COST.shower, '洗澡', () => { S.showered = true; S.en = Math.min(100, S.en + 4); add(3, '洗好澡，舒服多了'); });
}
function atTable() {
  if (S.ate) return info('home', '餐桌', '已經吃過了。');
  if (isWeekend()) {
    if (S.t < TW(11, 30)) return info('home', '餐桌', '還不餓，中午再吃。');
    const together = partnerSpot() === 'sofa';
    return startBusy('eat', 25, together ? '跟小雯煮麵吃' : '煮泡麵', () => { S.ate = true; S.en = Math.min(100, S.en + 8); if (together) famChange(1, '跟小雯在家吃午餐'); });
  }
  const d = S.delivery;
  if (d.stage === 'got' || d.stage === 'gotCold') {
    const together = partnerSpot() === 'table';
    return startBusy('eat', COST.dinner, together ? '跟小雯吃晚餐' : '吃晚餐', () => {
      S.ate = true; S.en = Math.min(100, S.en + (d.stage === 'got' ? 12 : 6));
      add(d.stage === 'got' ? 3 : 0, d.stage === 'got' ? '熱騰騰的晚餐' : '吃了冷掉的外送');
      if (together) { S.ateTogether = true; famChange(2, '跟小雯一起吃了晚餐'); } else famChange(-1, '小雯自己先吃了');
    });
  }
  if (d.stage === 'coming') return info('home', '餐桌', `晚餐叫了外送，大約 ${hhmm(d.at)} 到。`);
  info('home', '餐桌', '外送在大門口，先去拿。');
}
function atDoor() {
  if (isWeekend()) return info('home', '大門', S.pings.fam && S.pings.fam.type === 'plan' ? '小雯在沙發上等你回覆要不要出門。' : '週末，外面天氣很好。');
  const d = S.delivery;
  if (d.stage === 'arrived') { d.stage = 'got'; note('拿到外送了，去餐桌吃'); return info('home', '外送到了', '還是熱的。拿去餐桌吃吧。', () => startBusy('pickup', COST.pickup, '拿外送')); }
  if (d.stage === 'cold') { d.stage = 'gotCold'; note('外送已經冷了', 'b'); return info('home', '外送', '放在門口太久，已經冷掉了……', () => startBusy('pickup', COST.pickup, '拿外送')); }
  info('home', '大門', d.stage === 'coming' ? `外送還沒到（大約 ${hhmm(d.at)}）。` : '門鎖好了 🔒');
}

/* ================= 開始／結束 ================= */
const bestKey = (k, mode) => `dev-sim-best-${k}-${mode}`;
function bestOf(k, mode) { try { const v = localStorage.getItem(bestKey(k, mode)); return v === null ? null : +v; } catch (e) { return null; } }
function saveBest(k, mode, v) { try { const b = bestOf(k, mode); if (b === null || v > b) localStorage.setItem(bestKey(k, mode), v); } catch (e) { /* 無痕模式之類的，略過 */ } }

function chooseLevel() {
  S = freshState(LEVELS.freeze, 'day');
  S.tickets = [];
  dirty = true;
  $('lvLabel').textContent = '工程師上班模擬';
  MODAL = { kind: 'title' };
  const lv = Object.values(LEVELS).map(l => {
    const bd = bestOf(l.key, 'day'), bn = bestOf(l.key, 'night'), bw = bestOf(l.key, 'weekend');
    return `<div class="lvbox"><div class="lvhead"><span class="lvname">${l.name}</span><span class="lvfreq">${l.freq}</span></div>
      <p class="lvdesc">${l.desc}</p>
      <div class="lvbtns"><button class="lvbtn" data-lv="${l.key}" data-mode="day"><b>☀ 上班</b><small>09:00–18:00${bd !== null ? `　最佳 ${bd}` : ''}</small></button>
      <button class="lvbtn night" data-lv="${l.key}" data-mode="night"><b>🌙 下班 on-call</b><small>20:00–08:00　約 ${l.night.pages} 次 page${bn !== null ? `　最佳 ${bn}` : ''}</small></button>
      <button class="lvbtn weekend" data-lv="${l.key}" data-mode="weekend"><b>🏖 假日值班</b><small>週六 00:00–24:00　約 ${l.weekend.pages} 次 page${bw !== null ? `　最佳 ${bw}` : ''}</small></button></div></div>`;
  }).join('');
  openCard(`<div class="title"><div class="logo">&lt;/&gt;</div><h1>上線不要說應該沒問題</h1><p class="tag">工程師上班模擬</p></div>
    <p class="lead">工程師圈的老迷信：部署前說出「應該沒問題」，當天一定出事。今天請管好你的嘴。</p>
    <h4>選擇需求變更的頻率</h4><p class="hint">需求改得越兇，白天越難上線，晚上和週末值班也越常被 page。</p><div class="lvs">${lv}</div>
    <p class="fine">非官方、非商業的練習作品。玩法結構參考「值班模擬」類遊戲，內容與程式為獨立製作。</p>`);
  card.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => intro(LEVELS[b.dataset.lv], b.dataset.mode));
}
function intro(lv, mode) {
  S = freshState(lv, mode);
  dirty = true;
  $('lvLabel').textContent = `${lv.name} · ${mode === 'night' ? '下班 on-call' : mode === 'weekend' ? '假日值班' : lv.freq}`;
  MODAL = { kind: 'intro' };
  const body = mode === 'weekend'
    ? `${whoHead('fam')}<h4>週六 00:00，這週末輪到你值班（${lv.name}）</h4>
      <div class="body"><p>${lv.weekend.desc}</p>
      <ul class="rules"><li>值班 24 小時：現在是週五晚上剛過午夜，先去<b>睡覺</b>（半夜一樣可能被 page 叫醒）。週末沒鬧鐘，08:30 自然醒。</li>
      <li>小雯排了週末計畫：<b>10:30 早午餐、14:00 看電影、17:30 回爸媽家吃飯</b>。她會到沙發問你要不要去。</li>
      <li>出門前要決定：<b>帶不帶筆電</b>？看電影時手機要<b>調震動還是關機</b>？</li>
      <li>在外面 page 響了：有帶筆電就在角落處理，處理完繼續行程；沒帶就只能趕回家。關機的話……就聽不到了。</li>
      <li>page 一樣要 ack、處理、更新事故頻道。週末也會有人傳訊息來「打擾一下」。</li>
      <li>22:30 之後要開筆電交接給下一班（23:30 前），24:00 值班結束。</li></ul></div>
      <div class="acts"><button class="btn primary" id="go">開始值班 ▶</button><button class="btn" id="back">換關卡</button></div>`
    : mode === 'night'
    ? `${whoHead('boss')}<h4>這週輪到你 on-call（${lv.name}）</h4>
      <div class="body"><p>${lv.night.desc}</p>
      <ul class="rules"><li><b>被叫醒</b>會直接扣一節精神，越常被叫醒扣越多（第 2 次 1.5 節、第 3 次 2 節……）。</li>
      <li><b>page 響了</b>：5 分鐘內按「接 page」（或 T）ack，不然會一直重撥，第三次就升級叫醒阿凱。</li>
      <li>ack 之後 15 分鐘內到<b>書房開筆電</b>：判斷狀況、處理、在事故頻道更新。</li>
      <li>有些是<b>假警報</b>，判斷對了就能很快回去睡。</li>
      <li>${lv.night.line ? '半夜可能有人傳 LINE 改需求。睡前記得想想要不要開勿擾。' : '睡前記得想想手機要不要開勿擾。'}</li>
      <li>生活也要顧：晚餐外送 ${hhmm(TN(20, 40))} 到、洗澡、<b>睡飽</b>。</li>
      <li><b>另一半小雯</b>也在家：一起吃晚餐、陪看劇會加家人 ❤；半夜 page 響會連她一起吵醒。</li>
      <li>判斷錯越弄越久時，可以打給 secondary <b>阿凱</b>。07:30 鬧鐘響，08:00 前要開筆電交接給白天的 on-call。</li></ul></div>
      <div class="acts"><button class="btn primary" id="go">開始 on-call ▶</button><button class="btn" id="back">換關卡</button></div>`
    : `${whoHead('boss')}<h4>早安，今天的看板（${lv.name}）</h4>
      <div class="body"><ul class="tlist">${S.tickets.map(t => `<li><code>${t.id}</code> ${esc(t.title)} <small>約 ${t.est} 分鐘</small></li>`).join('')}</ul>
      <p>每張單都要走完：<b>寫 code → 阿凱 review → 交給小芸測試 → ${hhmm(DEPLOY.open)} 後部署</b>。</p>
      <ul class="rules"><li>點地圖走路，走到人或東西旁邊就會互動（鍵盤：方向鍵／WASD 移動、E 互動、P 暫停）。</li>
      <li>有人頭上冒 <b>!</b> 就是在找你，寫 code 會被打斷。超過時間會扣分。監控牆變紅要在 15 分鐘內到機房處理（手上的事會被打斷）。</li>
      <li>PM 會來改需求：<b>${lv.freq}</b>。先問清楚再動手，能協商就協商。</li>
      ${lv.urgent ? '<li>⚡ <b>急件</b>會插進來：先去找安娜問清楚範圍，2 小時內要上線。急件可以不等部署窗口直接緊急部署，QA 也會先測。</li>' : ''}
      ${lv.big ? `<li>📅 ${hhmm(lv.big.at)} 會來一張<b>明天就要</b>的大單。先跟安娜把範圍砍到 demo 需要的部分；18:00 做不完就得加班，不然 demo 會開天窗。</li>` : ''}
      <li>記得喝咖啡、吃午餐、上廁所。精神歸零就會趴在鍵盤上。</li></ul></div>
      <div class="acts"><button class="btn primary" id="go">開始上班 ▶</button><button class="btn" id="back">換關卡</button></div>`;
  openCard(body);
  $('go').onclick = () => {
    closeCard(); S.started = true;
    if (mode === 'weekend') { note(`00:00 週六，開始 24 小時值班（${lv.name}）`); toast('週末值班開始。先去睡吧，手機放枕頭旁'); }
    else if (mode === 'night') { note(`20:00 到家，開始 on-call（${lv.name}）`); toast('到家了。外送 20:40 到，記得吃飯'); }
    else { note(`09:00 上班（${lv.name}）`); toast('先回座位寫 code，09:30 要開站會'); }
  };
  $('back').onclick = chooseLevel;
}
function endShift(collapsed) {
  if (S.ended) return;
  S.ended = true; S.busy = null;
  return isWeekend() ? endWeekend(collapsed) : isNight() ? endNight(collapsed) : endDay(collapsed);
}
function endDay(collapsed) {
  const left = S.tickets.filter(t => t.status !== 'done');
  const debt = left.length * -5;
  S.score += debt;
  const bigLeft = S.tickets.some(t => t.big && t.status !== 'done');
  if (bigLeft) { S.score -= 15; note('明天的 demo 要開天窗了（-15）', 'b'); }
  const total = S.score;
  saveBest(LV.key, 'day', total);
  const rank = collapsed ? ['趴在鍵盤上睡著了', '精神歸零。明天記得喝咖啡、吃午餐。']
    : total >= 90 ? ['準時下班的傳說', '同事看你的眼神充滿敬意。']
    : total >= 60 ? ['可靠的資深工程師', '大家有事都想找你。']
    : total >= 30 ? ['還在苦撐的工程師', '今天辛苦了，回家好好睡。']
    : ['明天記得帶睡袋', '看板上還有好多單……'];
  const extra = [];
  const hot = S.tickets.filter(t => t.urgent);
  if (LV.urgent) extra.push(['急件準時上線', `${hot.filter(t => t.status === 'done' && !t.late).length} / ${hot.length}`]);
  if (LV.big) extra.push(['明天要的單', bigLeft ? '沒做完，demo 開天窗（-15）' : '做完了 ✓']);
  const actual = [LV.changeAt.length || LV.changeEvery || LV.changeRand ? `需求改了 ${S.stats.changes + S.stats.deferred} 次` : '', LV.urgent ? `插了 ${hot.length} 張急件` : '', LV.big ? '下午來了 1 張明天就要的大單' : ''].filter(Boolean).join('、') || '需求一次都沒改';
  resultCard(collapsed ? `${hhmm(S.t)}，你倒下了` : S.ot ? `${hhmm(S.t)} 加班結束` : '18:00 準時下班', total, rank, [
    ['需求頻率', `<b>${LV.name}</b>：${LV.freq}<br><small>今天實際：${actual}</small>`],
    ['上線的單', `${S.deployed} / ${S.tickets.length}`],
    ...extra,
    ['加班', S.ot ? `${dur(S.t - DAY_END)}<br><small>加班費：0 元（責任制）</small>` : '沒有 🎉'],
    ...(collapsed ? [] : leaveRows()),
    ['需求變更', `${S.stats.changes} 次（協商延後 ${S.stats.deferred} 次）`],
    ['QA 退件', `${S.stats.bounces} 次`],
    ['處理事故', `${S.stats.incidents} 件`],
    ['沒做完的單', `${left.length} 張（${debt} 分）`],
    ['做對／出包', `${S.stats.good} / ${S.stats.bad}`],
  ], '接著下班 on-call 🌙');
}
/* 下班順序和主管印象：印象不算分，只是讓你看看職場怎麼想 */
function leaveRows() {
  const order = S.leftLog.filter(x => PEOPLE[x.k]).map(x => ({ n: PEOPLE[x.k], t: x.t })).concat([{ n: '<b>你</b>', t: S.t }]).sort((a, b) => a.t - b.t);
  const stay = Object.keys(PEOPLE).filter(here).map(k => `${PEOPLE[k]}（還在）`);
  const last = !stillHere().length;
  const imp = here('boss') ? '比主管早走，大衛默默記下了 📝' : S.ot ? '比主管晚走，大衛很滿意 👍' : '大衛比你早走';
  return [
    ['下班順序', order.map(x => `${x.n} ${hhmm(x.t)}`).concat(stay).join(' → ') + (last ? '<br><small>你是辦公室最後一個走的</small>' : '')],
    ['主管印象', `${imp}<br><small>不影響分數，就跟現實一樣。</small>`],
  ];
}
function endNight(collapsed) {
  const h = S.sleepMin / 60;
  const sleepPts = Math.max(-18, Math.min(18, Math.round((h - 5) * 6)));
  S.score += sleepPts;
  if (!S.ate) S.score -= 5;
  if (S.page) { S.score -= 10; closePage('沒處理完'); }
  if (S.pings.rev) { S.score -= 5; S.pings.rev = null; note('沒交接就下線了（-5）', 'b'); }
  const total = S.score;
  saveBest(LV.key, 'night', total);
  const handled = S.pages.filter(p => p.result.startsWith('已處理') || p.result.startsWith('處理完')).length;
  const rank = collapsed ? ['在沙發上昏過去了', '精神歸零。on-call 也要記得吃飯睡覺。']
    : total >= 30 ? ['睡得好又救得了火', '這才是可以長久的 on-call。']
    : total >= 15 ? ['可靠的 on-call', '白天的同事看到事故頻道，安心多了。']
    : total >= 0 ? ['熬過了一晚', '回去補眠吧，今天早點睡。']
    : ['需要一杯超大杯咖啡', '這一晚太漫長了……'];
  resultCard(collapsed ? `${hhmm(S.t)}，你撐不住了` : '08:00 交接給白天的 on-call', total, rank, [
    ['需求頻率', `<b>${LV.name}</b>：${LV.freq}<br><small>晚上：被 page ${S.pages.length} 次、半夜 LINE ${LV.night.line} 則</small>`],
    ['處理的 page', `${handled} / ${S.pages.length}`],
    ['升級叫醒阿凱', `${S.escalated} 次`],
    ['睡眠', `${dur(S.sleepMin)}（${sleepPts > 0 ? '+' : ''}${sleepPts}）`],
    ['被吵醒', `${S.woke} 次`],
    ['晚餐／洗澡', `${S.ate ? '✓' : '✗（-5）'} ／ ${S.showered ? '✓' : '✗'}`],
    ['家人', `❤ ${S.fam} / ${FAMILY.max}<br><small>${famComment()}</small>`],
    ['同事', `叫醒阿凱 ${S.akai + S.escalated} 次${S.akai + S.escalated ? '（欠他一杯咖啡）' : ''}`],
    ['半夜訊息', S.lineLog.length ? S.lineLog.join('<br>') : '沒有回任何訊息'],
  ], '假日值班 🏖');
}
function endWeekend(collapsed) {
  const sleepPts = Math.max(-18, Math.min(18, Math.round((S.sleepMin / 60 - 5) * 6)));
  S.score += sleepPts;
  if (S.page) { S.score -= 10; closePage('沒處理完'); }
  if (S.pings.rev) { S.score -= 5; S.pings.rev = null; note('沒交接就下班了（-5）', 'b'); }
  const total = S.score;
  saveBest(LV.key, 'weekend', total);
  const handled = S.pages.filter(p => /處理/.test(p.result) && !/沒/.test(p.result)).length;
  const done = S.plans.filter(p => /完成/.test(p.result)).length;
  const rank = collapsed ? ['週末也累倒了', '值班也要吃飯休息。']
    : total >= 25 ? ['週末有過到', '事故處理好，家人也陪到了。']
    : total >= 10 ? ['勉強算有週末', '值班和家人之間，你盡力了。']
    : total >= 0 ? ['這週末跟上班差不多', '下次排班記得跟主管反映。']
    : ['週末去哪了', '小雯：「你這週末根本沒在家。」'];
  resultCard(collapsed ? `${hhmm(S.t)}，你撐不住了` : '24:00 值班結束', total, rank, [
    ['需求頻率', `<b>${LV.name}</b>：${LV.freq}<br><small>週末：被 page ${S.pages.length} 次</small>`],
    ['處理的 page', `${handled} / ${S.pages.length}`],
    ['睡眠', `${dur(S.sleepMin)}（${sleepPts > 0 ? '+' : ''}${sleepPts}），被吵醒 ${S.woke} 次`],
    ['週末計畫', S.plans.length ? S.plans.map(p => `${p.label}：${p.result}`).join('<br>') : '一個都沒去'],
    ['家人', `❤ ${S.fam} / ${FAMILY.max}<br><small>${famComment()}</small>`],
    ['同事', `叫醒阿凱 ${S.akai + S.escalated} 次${S.akai + S.escalated ? '（他的週末也毀了）' : ''}`],
    ['週末訊息', S.lineLog.length ? S.lineLog.join('<br>') : '沒有回任何訊息'],
  ], '回到白天上班 ☀');
}
function famComment() {
  if (S.kicked) return '小雯抱著枕頭去客廳睡了。早餐桌上很安靜。';
  if (S.fam >= 9) return '小雯：「辛苦了，今天早點回來，我們出去吃。」';
  if (S.fam >= 6) return '小雯：「昨晚還好嗎？」';
  if (S.fam >= 3) return '小雯：「下次 on-call 可以不要排週五嗎……」';
  return '小雯已經出門了，冰箱上貼著一張「我們談談」。';
}
function resultCard(title, total, rank, rows, nextLabel) {
  MODAL = { kind: 'end' };
  openCard(`${whoHead('sys')}<h4>${title}</h4>
    <div class="result"><div class="big">${total}</div><div><b>${rank[0]}</b><br><small>${rank[1]}</small></div></div>
    <table class="stats">${rows.map(r => `<tr${['需求頻率', '下班順序', '主管印象', '家人', '同事', '半夜訊息', '週末計畫', '週末訊息'].includes(r[0]) ? ' class="txt"' : ''}><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>
    <div class="acts"><button class="btn primary" id="again">再來一次</button><button class="btn" id="other">${nextLabel}</button><button class="btn" id="lvs">換需求頻率</button></div>`);
  const mode = MODE;
  $('again').onclick = () => intro(LV, mode);
  $('other').onclick = () => intro(LV, { day: 'night', night: 'weekend', weekend: 'day' }[mode]);
  $('lvs').onclick = chooseLevel;
  updateUI();
}
function togglePause() {
  if (!S || !S.started || S.ended) return;
  if (S.paused) { S.paused = false; closeCard(); return; }
  if (!ov.hidden) return;
  S.paused = true; MODAL = { kind: 'pause', pause: true };
  openCard(`<h4>暫停中</h4><p>時間停住了，需求暫時不會變。</p><div class="acts"><button class="btn primary" id="mOK">繼續</button><button class="btn" id="quit">放棄，回到選單</button></div>`);
  $('mOK').onclick = togglePause;
  $('quit').onclick = () => { S.paused = false; S.ended = true; closeCard(); chooseLevel(); };
}
function showHelp() {
  if (!ov.hidden) return;
  const wasPaused = S && S.paused;
  if (S && S.started && !S.ended) S.paused = true;
  MODAL = { kind: 'help' };
  openCard(`<h4>怎麼玩</h4><div class="body"><ul class="rules">
    <li><b>移動：</b>點地圖，或方向鍵／WASD。走到人或東西旁邊會自動互動，也可以按 E。</li>
    <li><b>上班流程：</b>座位寫 code → 阿凱 review → 小芸測試 → 14:00–17:30 回座位部署。</li>
    <li><b>需求變更：</b>安娜頭上出現 ! 就是要改需求。去問清楚，可以試著協商延後。沒去的話會照猜的改，QA 容易退件。</li>
    <li><b>告警：</b>監控牆變紅，15 分鐘內到機房處理，之後要跟主管回報。</li>
    <li><b>加班：</b>18:00 還有單沒上線，可以選擇留下來加班（最晚 21:00）。精神掉得更快、每 30 分鐘扣分，QA 也下班了。右上角「下班」隨時可以走。</li>
    <li><b>急件／明天就要：</b>急件 2 小時內要上線，可以緊急部署；明天就要的大單 18:00 做不完就加班。</li>
    <li><b>下班 on-call：</b>page 響了按「接 page」或 T，再去書房開筆電處理、更新事故頻道。手機訊息按「手機」或 L 看。被叫醒會扣一節精神，越常被叫醒扣越多。</li>
    <li><b>自己：</b>咖啡補精神但會想上廁所；沒吃飯精神掉兩倍快；on-call 晚上要睡飽。</li>
    <li><b>在家等待：</b>晚上和假日沒事的時候，按「⏩ 等一下」或 F 快轉，有事發生會自動停下。</li>
    <li><b>對話框：</b>數字鍵選答案，Enter 繼續。</li></ul></div>
    <div class="acts"><button class="btn primary" id="mOK">知道了</button></div>`);
  $('mOK').onclick = () => { closeCard(); if (S && !wasPaused) S.paused = false; };
}

/* ================= 輸入 ================= */
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key) && e.target === document.body) e.preventDefault();
  if (!ov.hidden) { modalKey(e); return; }
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (k === 'e') { const h = nearHs(); if (h) interact(h); }
  if (k === 'p' || k === 'escape') togglePause();
  if (k === 't' && atHome()) ackPage();
  if (k === 'l' && atHome()) readLine();
  if (k === 'f' && atHome()) waitAWhile();
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
$('btnPause').onclick = togglePause;
$('btnHelp').onclick = showHelp;
$('btnLeave').onclick = leaveWork;
$('btnWait').onclick = waitAWhile;
$('btnPhone').onclick = () => { if (S && S.page && S.page.stage === 'ring') ackPage(); else readLine(); };

function nearHs() { let best = null, bd = 50; for (const id in HS) { const h = HS[id]; const d = Math.hypot(h.x - S.me.x, h.y - S.me.y); if (d < bd) { bd = d; best = id; } } return best; }
function hitTest(p) {
  let best = null, bd = 48;
  for (const id in HS) { const h = HS[id]; const d = Math.min(Math.hypot(h.x - p.x, h.y - p.y), Math.hypot(h.ax - p.x, h.ay - p.y)); if (d < bd) { bd = d; best = id; } }
  return best;
}
function mapPoint(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
let HOVER = null;
cv.addEventListener('pointermove', e => { HOVER = hitTest(mapPoint(e)); cv.style.cursor = HOVER ? 'pointer' : 'default'; });
cv.addEventListener('pointerleave', () => { HOVER = null; });
cv.addEventListener('click', e => {
  if (!S || !S.started || S.ended || S.paused || !ov.hidden) return;
  if (S.busy) {
    // 寫 code、睡覺、癱在沙發可以隨時中斷
    if (['code', 'sleep', 'rest', 'idle'].includes(S.busy.kind)) finishBusy(true);
    return;
  }
  const p = mapPoint(e), hit = hitTest(p);
  const target = hit ? { x: HS[hit].x, y: HS[hit].y } : clampWalk(p);
  if (hit && Math.hypot(target.x - S.me.x, target.y - S.me.y) < 6) return interact(hit);
  S.path = pathTo(S.me, target); S.pendingHs = hit;
});

/* ================= 移動 ================= */
function move(dt) {
  const vx = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0);
  const vy = (keys.arrowdown || keys.s ? 1 : 0) - (keys.arrowup || keys.w ? 1 : 0);
  if (vx || vy) {
    S.path = []; S.pendingHs = null;
    const l = Math.hypot(vx, vy), nx = S.me.x + vx / l * WALK_SPEED * dt, ny = S.me.y + vy / l * WALK_SPEED * dt;
    if (walkable({ x: nx, y: S.me.y })) S.me.x = nx;
    if (walkable({ x: S.me.x, y: ny })) S.me.y = ny;
    if (vx) S.dir = vx;
    S.moving = true; return;
  }
  if (!S.path.length) { S.moving = false; return; }
  let step = WALK_SPEED * dt;
  while (step > 0 && S.path.length) {
    const g = S.path[0], dx = g.x - S.me.x, dy = g.y - S.me.y, d = Math.hypot(dx, dy);
    if (Math.abs(dx) > 1) S.dir = dx < 0 ? -1 : 1;
    if (d <= step) { S.me.x = g.x; S.me.y = g.y; S.path.shift(); step -= d; }
    else { S.me.x += dx / d * step; S.me.y += dy / d * step; step = 0; }
  }
  S.moving = true;
  if (!S.path.length && S.pendingHs) { const id = S.pendingHs; S.pendingHs = null; S.moving = false; interact(id); }
}

/* ================= 主迴圈 ================= */
let last = performance.now(), lastUI = 0, dirty = true;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (S && S.started && !S.ended && !S.paused && ov.hidden) {
    if (S.busy) {
      const d = Math.min(S.busy.left, dt * busyRate()); S.busy.left -= d; tick(d);
      if (S.busy && S.busy.kind === 'idle' && S.log.length !== S.busy.logAt) finishBusy(true);   // 有新動態就停止快轉
      else if (S.busy && S.busy.left <= 0) finishBusy(false);
    }
    else { move(dt); tick(dt * COST.walk[MAPK]); }
  }
  draw(now);
  if (dirty && now - lastUI > 150) { updateUI(); lastUI = now; dirty = false; }
  requestAnimationFrame(loop);
}

/* ================= 畫圖 ================= */
const C = { floor: '#E3E8EE', corridor: '#D3DAE2', room: '#F5F7FA', wall: '#2B3442', label: '#5B6677', desk: '#C9A27A', deskTop: '#D9B68E', screen: '#1F2733' };
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function text(t, x, y, size, color, align, weight) { ctx.font = `${weight || 500} ${size}px "Noto Sans TC", system-ui, sans-serif`; ctx.fillStyle = color; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); }
function pill(t, x, y, bg, fg, size) {
  ctx.font = `700 ${size || 12}px "Noto Sans TC", system-ui, sans-serif`;
  const w = ctx.measureText(t).width + 16, h = (size || 12) + 10;
  x = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, x));
  ctx.fillStyle = bg; rr(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y + 1);
}
function person(x, y, look, opts) {
  opts = opts || {};
  ctx.fillStyle = 'rgba(30,40,55,.18)'; ctx.beginPath(); ctx.ellipse(x, y + 16, 13, 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = look.shirt; rr(x - 11, y - 2, 22, 18, 7); ctx.fill();
  ctx.fillStyle = '#F0CBA8'; ctx.beginPath(); ctx.arc(x, y - 10, 9, 0, 7); ctx.fill();
  ctx.fillStyle = look.hair; ctx.beginPath(); ctx.arc(x, y - 12, 9, Math.PI, 0); ctx.fill();
  if (opts.headphones) { ctx.strokeStyle = '#333'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 11, 11, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); ctx.fillStyle = '#333'; ctx.fillRect(x - 13, y - 13, 5, 8); ctx.fillRect(x + 8, y - 13, 5, 8); }
  if (opts.glasses) { ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 7, y - 11, 5, 4); ctx.strokeRect(x + 2, y - 11, 5, 4); }
}
function deskWithScreen(x, y, w, screens, glow) {
  ctx.fillStyle = C.desk; rr(x - w / 2, y - 14, w, 28, 4); ctx.fill();
  ctx.fillStyle = C.deskTop; rr(x - w / 2 + 3, y - 12, w - 6, 20, 3); ctx.fill();
  for (let i = 0; i < screens; i++) {
    const sx = x - (screens - 1) * 22 + i * 44;
    ctx.fillStyle = C.screen; rr(sx - 19, y - 10, 38, 18, 2); ctx.fill();
    ctx.fillStyle = glow || '#5FB3E6';
    for (let k = 0; k < 3; k++) ctx.fillRect(sx - 15, y - 7 + k * 5, 10 + ((k * 13 + i * 7) % 18), 2);
  }
}
function toilet(x, y) { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#9AA6B4'; ctx.lineWidth = 1.5; rr(x - 17, y + 22, 34, 14, 3); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(x, y, 15, 19, 0, 0, 7); ctx.fill(); ctx.stroke(); }
function steam(x, y, now) { ctx.strokeStyle = 'rgba(120,120,120,.6)'; ctx.lineWidth = 2; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(x + i * 6, y); ctx.quadraticCurveTo(x - 5 + i * 6 + Math.sin(now / 200) * 4, y - 10, x + 1 + i * 6, y - 20); ctx.stroke(); } }
/* 一組 OA 桌島：兩排桌子背對背，中間有隔板。seats 依序是北排、南排每個位子坐誰（null = 空位） */
const COWORKERS = [
  { shirt: '#B9C7D9', hair: '#2B2B2B' }, { shirt: '#E2C6A8', hair: '#4A3426' }, { shirt: '#C9D9B9', hair: '#1F1F1F' },
  { shirt: '#D8C2E0', hair: '#3A2E2A' }, { shirt: '#F0D9A0', hair: '#2B2B2B' },
];
function island(x, y, n, north, south, glowOf) {
  const dw = 95, h = 60, w = dw * n;
  ctx.fillStyle = '#B9C3CF'; rr(x - 2, y - 2, w + 4, h + 4, 4); ctx.fill();
  for (let i = 0; i < n; i++) for (let r = 0; r < 2; r++) {
    ctx.fillStyle = '#E7DCCB'; ctx.fillRect(x + i * dw + 1, y + r * 30 + 1, dw - 2, 28);
    // 螢幕靠隔板、面向坐的人
    const sx = x + i * dw + dw / 2, sy = r ? y + 36 : y + 18;
    ctx.fillStyle = C.screen; rr(sx - 17, sy - 6, 34, 10, 2); ctx.fill();
    ctx.fillStyle = (glowOf && glowOf(r, i)) || '#5FB3E6'; ctx.fillRect(sx - 14, r ? sy - 4 : sy - 3, 28, 4);
    ctx.fillStyle = '#C8CDD4'; ctx.fillRect(sx - 12, r ? y + 48 : y + 6, 24, 5);   // 鍵盤
  }
  ctx.fillStyle = '#7C8796'; ctx.fillRect(x, y + 29, w, 3);   // 隔板
  const seat = (sx, sy, who) => {
    ctx.fillStyle = '#4A5568'; rr(sx - 12, sy - 8, 24, 18, 5); ctx.fill();
    if (who) person(sx, sy, who.look, who.opts);
  };
  north.forEach((who, i) => seat(x + i * dw + dw / 2, y - 14, who));
  south.forEach((who, i) => seat(x + i * dw + dw / 2, y + h + 14, who));
}
function nameTag(t, x, y) { ctx.font = '700 10px "Noto Sans TC", system-ui, sans-serif'; const w = ctx.measureText(t).width + 10; ctx.fillStyle = 'rgba(255,255,255,.85)'; rr(x - w / 2, y - 7, w, 14, 7); ctx.fill(); text(t, x, y, 10, '#3A4558', 'center', 700); }
function drawOffice(now) {
  const cw = i => here('c' + i) ? { look: COWORKERS[i % COWORKERS.length] } : null;
  const who = (k, look, opts) => here(k) ? { look, opts } : null;
  // 會議室
  ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#B9C3CF'; ctx.lineWidth = 2; rr(60, 30, 140, 12, 2); ctx.fill(); ctx.stroke();
  text('Sprint 42：不要再改需求了', 130, 54, 10, '#7A8699');
  ctx.fillStyle = '#B48C66'; rr(55, 75, 160, 50, 8); ctx.fill();
  ctx.fillStyle = '#7C8796'; [75, 115, 155, 195].forEach(a => { [66, 134].forEach(b => { ctx.beginPath(); ctx.arc(a, b, 6, 0, 7); ctx.fill(); }); });
  // 桌島一：北排 安娜、小芸、同事、同事；南排 同事、空、同事、空；桌頭是主管
  island(320, 90, 4, [who('pm', NPC.pm), who('qa', NPC.qa, { glasses: true }), cw(0), cw(1)], [cw(2), null, cw(3), null]);
  ctx.fillStyle = '#E7DCCB'; ctx.fillRect(701, 91, 18, 58); ctx.fillStyle = C.screen; ctx.fillRect(704, 106, 8, 28);
  ctx.fillStyle = '#4A5568'; rr(728, 106, 18, 24, 5); ctx.fill(); if (here('boss')) person(738, 116, NPC.boss);
  for (let i = 0; i < 5; i++) { ctx.fillStyle = '#2E3542'; rr(470 + i * 10, 152, 7, 4, 1); ctx.fill(); }   // 小芸的測試手機
  // 桌島二：北排 同事、空、同事、同事；南排 空、你的位子、阿凱、同事
  const coding = S && S.busy && S.busy.kind === 'code';
  island(330, 340, 4, [cw(4), null, cw(5), cw(6)], [null, null, who('rev', NPC.rev, { headphones: true }), cw(7)],
    (r, i) => r === 1 && i === 1 ? (coding ? '#9BE38F' : '#5FB3E6') : r === 1 && i === 2 ? '#F5C26B' : null);
  ctx.fillStyle = '#FFE27A'; ctx.fillRect(500, 386, 9, 9);   // 你螢幕上的便利貼
  nameTag('安娜 PM', 367, 46); nameTag('小芸 QA', 462, 46); nameTag('大衛 主管', 738, 146);
  nameTag('你', 472, 434); nameTag('阿凱', 567, 434);
  // 茶水間（開放角落）：流理台、咖啡機、便當
  ctx.fillStyle = '#C9D1DA'; rr(130, 490, 170, 30, 3); ctx.fill();
  ctx.fillStyle = '#3A3F48'; rr(146, 488, 28, 30, 4); ctx.fill(); ctx.fillStyle = '#C8743A'; ctx.fillRect(154, 506, 12, 8);
  if (S && S.busy && S.busy.kind === 'coffee') steam(156, 500, now);
  if (!S || !S.ate) { ctx.fillStyle = '#E5484D'; rr(240, 494, 30, 20, 3); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(253, 494, 4, 20); }
  ctx.fillStyle = '#E8ECF0'; ctx.strokeStyle = '#9AA6B4'; ctx.lineWidth = 1.5; rr(276, 486, 22, 32, 3); ctx.fill(); ctx.stroke();
  text('茶水間', 215, 470, 12, C.label, 'center', 700);
  // 廁所
  toilet(65, 488);
  // 機房：監控牆、機櫃
  const alarm = S && S.alert, flash = alarm && Math.floor(now / 350) % 2;
  ctx.fillStyle = '#1B212B'; rr(850, 336, 86, 26, 3); ctx.fill();
  for (let i = 0; i < 3; i++) {
    const sx = 854 + i * 27;
    ctx.fillStyle = alarm ? (flash ? '#E5484D' : '#7A1E22') : '#16302A'; rr(sx, 339, 24, 20, 2); ctx.fill();
    ctx.strokeStyle = alarm ? '#FFD2D2' : '#4CC38A'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let k = 0; k <= 5; k++) { const px = sx + 2 + k * 4, py = 350 - (alarm && i === 1 && k > 3 ? 7 : Math.sin(k + i + now / 600) * 3); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke();
  }
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = '#2E3542'; rr(772 + i * 33, 480, 30, 36, 3); ctx.fill();
    for (let k = 0; k < 3; k++) { ctx.fillStyle = (Math.floor(now / 300) + k + i) % 3 ? '#4CC38A' : '#1E6B47'; ctx.fillRect(778 + i * 33, 486 + k * 9, 4, 4); }
  }
  // 盆栽、印表機
  [[290, 34], [920, 300]].forEach(([x, y]) => { ctx.fillStyle = '#8B6B4A'; rr(x - 8, y, 16, 14, 3); ctx.fill(); ctx.fillStyle = '#4E9A5E'; ctx.beginPath(); ctx.arc(x, y - 4, 11, 0, 7); ctx.fill(); });
  ctx.fillStyle = '#D5DAE0'; rr(860, 200, 46, 30, 4); ctx.fill(); ctx.fillStyle = '#9AA6B4'; ctx.fillRect(866, 206, 34, 6); text('印表機', 883, 240, 10, C.label, 'center', 700);
}
function drawHome(now) {
  const sleeping = S && S.busy && S.busy.kind === 'sleep';
  // 臥室：床、床頭櫃
  ctx.fillStyle = '#8A6A4F'; rr(36, 36, 140, 118, 8); ctx.fill();
  ctx.fillStyle = '#F4F1EA'; rr(42, 42, 128, 106, 6); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; rr(52, 48, 48, 26, 8); ctx.fill(); rr(112, 48, 48, 26, 8); ctx.fill();
  ctx.fillStyle = sleeping ? '#7C93C9' : '#9DB4E0'; rr(42, 84, 128, 64, 6); ctx.fill();
  if (sleeping) {
    ctx.fillStyle = '#F0CBA8'; ctx.beginPath(); ctx.arc(76, 66, 10, 0, 7); ctx.fill(); ctx.fillStyle = '#2B2B2B'; ctx.beginPath(); ctx.arc(76, 63, 10, Math.PI, 0); ctx.fill();
    text('z', 98 + Math.sin(now / 300) * 3, 50 - (now / 40 % 20), 14, '#5B6677', 'center', 700); text('Z', 112, 38 - (now / 60 % 12), 18, '#5B6677', 'center', 700);
  }
  ctx.fillStyle = '#B48C66'; rr(186, 40, 34, 30, 4); ctx.fill();
  ctx.fillStyle = '#FFE9A8'; ctx.beginPath(); ctx.arc(203, 52, 7, 0, 7); ctx.fill();
  // 書房：書桌、筆電、外接螢幕
  const pg = S && S.page, flash = pg && Math.floor(now / 350) % 2;
  ctx.fillStyle = C.desk; rr(390, 40, 180, 40, 5); ctx.fill(); ctx.fillStyle = C.deskTop; rr(394, 43, 172, 32, 4); ctx.fill();
  ctx.fillStyle = C.screen; rr(410, 34, 56, 32, 3); ctx.fill();
  ctx.fillStyle = pg ? (flash ? '#E5484D' : '#7A1E22') : '#16302A'; rr(414, 38, 48, 24, 2); ctx.fill();
  ctx.fillStyle = '#5B6677'; rr(462, 54, 52, 22, 3); ctx.fill(); ctx.fillStyle = pg ? '#FFB3B5' : '#5FB3E6'; ctx.fillRect(468, 58, 40, 13);
  ctx.fillStyle = '#4A5568'; rr(466, 92, 28, 18, 5); ctx.fill();
  ctx.fillStyle = '#5E8C61'; ctx.beginPath(); ctx.arc(600, 50, 12, 0, 7); ctx.fill(); ctx.fillStyle = '#8B6B4A'; ctx.fillRect(594, 58, 12, 12);
  // 客廳：電視、茶几、沙發
  ctx.fillStyle = '#2E3542'; rr(740, 30, 120, 10, 3); ctx.fill();
  ctx.fillStyle = '#C9B8A6'; rr(745, 52, 110, 18, 6); ctx.fill();
  ctx.fillStyle = '#7A8FA6'; rr(735, 80, 130, 40, 10); ctx.fill(); ctx.fillStyle = '#93A7BD'; rr(745, 86, 52, 28, 6); ctx.fill(); rr(803, 86, 52, 28, 6); ctx.fill();
  // 浴室：馬桶、淋浴間
  toilet(62, 470);
  ctx.strokeStyle = '#9AA6B4'; ctx.lineWidth = 2; ctx.fillStyle = '#E3EEF5'; rr(130, 440, 76, 66, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#9AA6B4'; ctx.beginPath(); ctx.arc(168, 452, 6, 0, 7); ctx.fill();
  if (S && S.busy && S.busy.kind === 'shower') for (let i = 0; i < 6; i++) { ctx.fillStyle = '#7FB8E0'; ctx.fillRect(152 + i * 6, 462 + ((now / 8 + i * 13) % 34), 2, 6); }
  // 廚房：流理台、冰箱、餐桌
  ctx.fillStyle = '#B9C3CF'; rr(244, 470, 90, 34, 4); ctx.fill(); ctx.fillStyle = '#2E3542'; ctx.beginPath(); ctx.arc(270, 487, 9, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(306, 487, 9, 0, 7); ctx.fill();
  ctx.fillStyle = '#E8ECF0'; ctx.strokeStyle = '#9AA6B4'; ctx.lineWidth = 1.5; rr(470, 444, 44, 62, 4); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#9AA6B4'; ctx.fillRect(476, 458, 3, 14);
  ctx.fillStyle = '#B48C66'; rr(350, 450, 60, 40, 6); ctx.fill();
  const d = S && S.delivery;
  if (d && (d.stage === 'got' || d.stage === 'gotCold') && !S.ate) { ctx.fillStyle = '#F2F2F2'; rr(366, 458, 28, 22, 3); ctx.fill(); ctx.fillStyle = '#E5484D'; ctx.fillRect(366, 466, 28, 4); }
  if (S && S.busy && S.busy.kind === 'eat') steam(376, 458, now);
  // 玄關：鞋櫃、大門
  ctx.fillStyle = '#B48C66'; rr(560, 470, 90, 34, 4); ctx.fill();
  ctx.fillStyle = '#8A6A4F'; rr(916, 380, 12, 80, 2); ctx.fill(); ctx.fillStyle = '#D8B13A'; ctx.beginPath(); ctx.arc(918, 424, 3, 0, 7); ctx.fill();
  if (d && (d.stage === 'arrived' || d.stage === 'cold')) { ctx.fillStyle = '#F0A020'; rr(880, 448, 30, 24, 4); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(892, 448, 6, 24); }
  // 小雯
  const spot = partnerSpot();
  if (spot === 'bed') { ctx.fillStyle = '#F0CBA8'; ctx.beginPath(); ctx.arc(136, 64, 10, 0, 7); ctx.fill(); ctx.fillStyle = NPC.fam.hair; ctx.beginPath(); ctx.arc(136, 61, 10, Math.PI, 0); ctx.fill(); }
  else if (spot === 'table') { person(428, 466, NPC.fam); nameTag('小雯', 428, 496); }
  else if (spot === 'sofa') { person(775, 96, NPC.fam); nameTag('小雯', 775, 128); }
  // 客廳窗外：晚上是月亮，假日白天是太陽
  if (isWeekend() && S.t >= TW(6, 0) && S.t < TW(19, 0)) { ctx.fillStyle = '#FFD45C'; ctx.beginPath(); ctx.arc(905, 44, 9, 0, 7); ctx.fill(); }
  else { ctx.fillStyle = '#FFF4C2'; ctx.beginPath(); ctx.arc(905, 44, 9, 0, 7); ctx.fill(); ctx.fillStyle = '#F3EEE6'; ctx.beginPath(); ctx.arc(910, 41, 8, 0, 7); ctx.fill(); }
}
function drawRooms() {
  const night = isNight(), office = MAPK === 'office';   // 假日白天在家用亮色
  ctx.fillStyle = night ? '#8C96A5' : '#9EA9B6'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = office ? '#E3E8EE' : night ? '#C2CAD4' : '#CFD6DF'; ctx.fillRect(FLOOR.x, FLOOR.y, FLOOR.w, FLOOR.h);
  if (office) {   // 辦公室地毯格
    ctx.strokeStyle = 'rgba(120,135,155,.12)'; ctx.lineWidth = 1;
    for (let x = FLOOR.x; x <= FLOOR.x + FLOOR.w; x += 40) { ctx.beginPath(); ctx.moveTo(x, FLOOR.y); ctx.lineTo(x, FLOOR.y + FLOOR.h); ctx.stroke(); }
    for (let y = FLOOR.y; y <= FLOOR.y + FLOOR.h; y += 40) { ctx.beginPath(); ctx.moveTo(FLOOR.x, y); ctx.lineTo(FLOOR.x + FLOOR.w, y); ctx.stroke(); }
  } else {        // 家裡的走廊
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.setLineDash([14, 12]); ctx.beginPath(); ctx.moveTo(30, 260); ctx.lineTo(930, 260); ctx.stroke(); ctx.setLineDash([]);
  }
  for (const r of ROOMS) { ctx.fillStyle = ['srv', 'wc', 'bath'].includes(r.id) ? '#E8EDF2' : r.id === 'bedroom' || r.id === 'living' ? '#F3EEE6' : C.room; ctx.fillRect(r.x, r.y, r.w, r.h); }
  ctx.fillStyle = C.wall;
  for (const w of WALLS) ctx.fillRect(w.x, w.y, w.w, w.h);
  ctx.strokeStyle = C.wall; ctx.lineWidth = 6; ctx.strokeRect(FLOOR.x, FLOOR.y, FLOOR.w, FLOOR.h);
  // 門在上面的房間，名字放左上角；其他放左下角，才不會被家具擋住
  for (const r of ROOMS) text(r.name, r.x + 14, r.door && r.door.side === 'top' ? r.y + 18 : r.y + r.h - 18, 12, C.label, 'left', 700);
}
function bubble(x, y, urgent, now, ch) {
  const pulse = 1 + 0.12 * Math.sin(now / 160);
  ctx.save(); ctx.translate(x, y); ctx.scale(pulse, pulse);
  ctx.fillStyle = urgent ? '#E5484D' : '#F0A020';
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-4, 9); ctx.lineTo(0, 17); ctx.lineTo(4, 9); ctx.fill();
  text(ch || '!', 0, 1, 15, '#fff', 'center', 900);
  ctx.restore();
}
function drawPings(now) {
  if (atHome()) {
    if (S.page && S.page.stage === 'acked') bubble(440, 24, S.page.dl - S.t < 5, now);
    if (S.delivery.stage === 'arrived') bubble(895, 425, S.delivery.dl - S.t < 5, now);
    if (S.pings.fam) bubble(775, 52, S.pings.fam.dl - S.t < 5, now);
    if (S.pings.rev && !S.page) bubble(520, 24, true, now);
    return;
  }
  const spots = { pm: [367, 36], qa: [462, 36], boss: [738, 84], rev: [567, 386], meet: [135, 52] };
  for (const npc in spots) { const p = S.pings[npc]; if (p) bubble(spots[npc][0], spots[npc][1], p.dl - S.t < 10, now); }
  if (S.alert) bubble(893, 318, true, now);
}
function drawMe(now) {
  if (S.busy && S.busy.kind === 'sleep') { drawBusyBar(105, 120); return; }
  if (S.busy && (S.busy.kind === 'out' || S.busy.kind === 'commute')) { pill(S.busy.kind === 'out' ? `🏖 出門中：${S.busy.label}` : '🏃 趕回家中', W / 2, 290, '#5FA37A', '#fff', 14); drawBusyBar(W / 2, 360); return; }
  const { x, y } = S.me, bob = S.moving ? Math.sin(now / 90) * 1.5 : 0;
  const ringing = atHome() && S.page && S.page.stage === 'ring' && !(S.outing && S.outing.phoneOff);
  if (ringing) { ctx.strokeStyle = 'rgba(229,72,77,.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 22 + (now / 25 % 18), 0, 7); ctx.stroke(); }
  ctx.save(); ctx.translate(x, y + bob);
  ctx.fillStyle = 'rgba(30,40,55,.22)'; ctx.beginPath(); ctx.ellipse(0, 17 - bob, 14, 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = isNight() ? '#6D7FA8' : isWeekend() ? '#5FA37A' : '#2F8FCB'; rr(-12, -3, 24, 20, 8); ctx.fill();
  ctx.fillStyle = isNight() ? '#56668C' : isWeekend() ? '#4A8A63' : '#1F6E9E'; rr(-12, -3, 24, 7, 4); ctx.fill();
  ctx.fillStyle = '#F0CBA8'; ctx.beginPath(); ctx.arc(0, -11, 9.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#2B2B2B'; ctx.beginPath(); ctx.arc(0, -13, 9.5, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#2B2B2B'; ctx.fillRect(S.dir > 0 ? 2 : -5, -12, 3, 3);
  ctx.restore();
  if (ringing) pill('📟 page！按 T 接', x, y - 40, '#E5484D', '#fff', 12);
  if (S.busy) drawBusyBar(x, y);
}
function drawBusyBar(x, y) {
  const f = 1 - S.busy.left / S.busy.full;
  ctx.fillStyle = 'rgba(27,33,43,.88)'; rr(x - 54, y - 52, 108, 26, 6); ctx.fill();
  text(S.busy.label, x, y - 44, 11, '#fff', 'center', 700);
  ctx.fillStyle = '#3B4656'; ctx.fillRect(x - 46, y - 35, 92, 4); ctx.fillStyle = '#4FC3F7'; ctx.fillRect(x - 46, y - 35, 92 * f, 4);
}
function drawHover() {
  if (!HOVER || !S || !S.started || S.ended || !HS[HOVER]) return;
  const h = HS[HOVER];
  ctx.strokeStyle = '#2F8FCB'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(h.ax, h.ay, 30, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  pill(h.label, h.ax, h.ay - 40, '#1B212B', '#fff', 12);
}
function drawPath() {
  if (!S.path.length) return;
  ctx.fillStyle = 'rgba(47,143,203,.5)';
  let p = S.me;
  for (const q of S.path) { const d = Math.hypot(q.x - p.x, q.y - p.y); for (let s = 14; s < d; s += 18) { ctx.beginPath(); ctx.arc(p.x + (q.x - p.x) * s / d, p.y + (q.y - p.y) * s / d, 2.5, 0, 7); ctx.fill(); } p = q; }
}
/* 越接近半夜畫面越暗，天亮再亮回來 */
function weekendShade() { const h = S.t / 60; return h < 5 ? 0.2 : h < 7 ? 0.2 * (7 - h) / 2 : h < 18 ? 0 : h < 21 ? 0.2 * (h - 18) / 3 : 0.2; }
function nightShade() { const t = S.t; return t < TN(0, 0) ? 0.05 + 0.15 * t / TN(0, 0) : t < TN(5, 0) ? 0.2 : Math.max(0, 0.2 - 0.2 * (t - TN(5, 0)) / (TN(8, 0) - TN(5, 0))); }
function draw(now) {
  ctx.clearRect(0, 0, W, H);
  drawRooms();
  if (MAPK === 'home') drawHome(now); else drawOffice(now);
  if (!S) return;
  drawPath();
  drawPings(now);
  drawMe(now);
  drawHover();
  if (atHome() && S.started) { const a = isNight() ? nightShade() : weekendShade(); if (a > 0) { ctx.fillStyle = `rgba(20,28,60,${a})`; ctx.fillRect(0, 0, W, H); } }
  if (S.toast && now < S.toast.until) pill(S.toast.text, W / 2, 245, 'rgba(27,33,43,.92)', '#fff', 14);
  if (S.started && !S.ended && S.bl >= 85 && !(S.busy && S.busy.kind === 'sleep')) pill(S.bl >= 100 ? '膀胱爆了！快去廁所' : '想上廁所…', S.me.x, S.me.y + 34, '#F0A020', '#1B212B', 11);
}

/* ================= 右側面板 ================= */
function updateUI() {
  if (!S) return;
  $('clock').textContent = hhmm(S.t);
  const left = Math.max(0, endT() - S.t);
  $('left').textContent = S.started ? (S.ended ? (atHome() ? '值班結束' : '已下班') : S.ot ? `加班中（最晚 ${hhmm(OT_END)}）` : `${isNight() ? '距離交接' : isWeekend() ? '距離值班結束' : '距離下班'} ${dur(left)}`) : '選擇關卡開始';
  $('vEn').textContent = Math.round(S.en) + '%'; $('bEn').style.width = S.en + '%';
  $('bEn').className = S.en < 25 ? 'bad' : S.en < 50 ? 'warn' : '';
  $('vBl').textContent = Math.round(S.bl) + '%'; $('bBl').style.width = S.bl + '%';
  $('bBl').className = S.bl >= 85 ? 'bad' : S.bl >= 65 ? 'warn' : '';
  $('vHu').textContent = S.ate ? '吃飽了' : isNight() ? (S.t > TN(22, 0) ? '餓扁了' : '有點餓') : isWeekend() ? (S.t > TW(20, 0) || (S.t > TW(13, 30) && S.t < TW(18, 0)) ? '餓扁了' : S.t >= TW(11, 30) ? '有點餓' : '還好') : S.t > LUNCH.late ? '餓扁了' : S.t >= LUNCH.open ? '有點餓' : '還好';
  $('score').textContent = S.score;
  const phone = $('btnPhone');
  const ring = atHome() && S.page && S.page.stage === 'ring' && !(S.outing && S.outing.phoneOff);
  if (atHome() && S.started && !S.ended && (ring || S.lines.length)) {
    phone.hidden = false;
    phone.textContent = ring ? '📟 接 page (T)' : `💬 手機 ${S.lines.length} (L)`;
    phone.classList.toggle('ring', !!ring);
  } else phone.hidden = true;
  $('btnLeave').hidden = !(S.ot && !S.ended);
  $('btnWait').hidden = !(atHome() && S.started && !S.ended);
  if (atHome()) updateNightPanel(); else updateDayPanel();
  $('feed').innerHTML = S.log.slice(0, 14).map(l => `<li class="${l.kind}"><time>${hhmm(l.t)}</time>${esc(l.text)}</li>`).join('');
}
function updateDayPanel() {
  $('boardTitle').textContent = '今日看板';
  $('board').innerHTML = !S.tickets.length ? '<div class="tk-empty">選好關卡後，今天的工作單會出現在這裡</div>' : S.tickets.map(t => {
    const pct = t.status === 'dev' || t.status === 'todo' ? Math.round(t.prog / t.est * 100) : 100;
    const flag = t.status === 'done' ? '' : t.urgent ? `<div class="due ${t.late ? 'late' : ''}">⚡ ${t.late ? '已超過時限' : `${hhmm(t.due)} 前上線`}</div>` : t.big ? '<div class="due">📅 明天一早要</div>' : '';
    return `<div class="tk s-${t.status}${t.urgent ? ' hot' : ''}${t.big ? ' big' : ''}"><div class="tk-top"><code>${t.id}</code><span class="st">${STATUS[t.status]}</span></div>
      <div class="tk-title">${esc(t.title)}${t.ver > 1 ? ` <span class="ver">v${t.ver}</span>` : ''}${t.pendingChange ? ' <span class="chg">變更中</span>' : ''}</div>
      ${flag}${t.status === 'dev' || t.status === 'todo' ? `<div class="tk-bar"><i style="width:${pct}%"></i></div><div class="tk-sub">${t.prog} / ${t.est} 分鐘</div>` : t.status === 'testing' ? `<div class="tk-sub">預計 ${hhmm(t.qaAt)} 測完</div>` : ''}</div>`;
  }).join('');
  const todo = [];
  if (S.ot) todo.push({ u: true, t: `加班中：可以隨時按右上角「下班」（最晚 ${hhmm(OT_END)}）` }, { t: `辦公室還有：${stillHere().join('、') || '只剩你'}` });
  if (S.alert) todo.push({ u: true, t: `🚨 監控告警：到機房（${hhmm(S.alert.dl)} 前）` });
  S.tickets.filter(t => t.urgent && t.status !== 'done' && !t.late).forEach(t => todo.push({ u: t.due - S.t < 30, t: `⚡ ${t.id} 要在 ${hhmm(t.due)} 前上線（${STATUS[t.status]}）` }));
  for (const npc in S.pings) { const p = S.pings[npc]; if (p) todo.push({ u: p.dl - S.t < 10, t: `${npc === 'meet' ? '會議室' : NPC[npc].name}：${PING_LABEL[p.type]}（${hhmm(p.dl)} 前）` }); }
  const ids = st => S.tickets.filter(t => t.status === st).map(t => t.id);
  const rv = ids('review'), qa = ids('qa'), rd = ids('ready');
  if (rv.length) todo.push({ t: `找阿凱 review：${rv.join('、')}` });
  if (qa.length) todo.push({ t: `交給小芸測試：${qa.join('、')}` });
  if (rd.length) todo.push({ u: S.t >= DEPLOY.close - 30, t: S.t < DEPLOY.open ? `可上線：${rd.join('、')}（${hhmm(DEPLOY.open)} 後部署）` : `回座位部署：${rd.join('、')}（${hhmm(DEPLOY.close)} 前）` });
  if (!S.ate && S.t >= LUNCH.open) todo.push({ u: S.t > LUNCH.late, t: S.t > LUNCH.late ? '還沒吃午餐，精神掉得很快' : `吃午餐（${hhmm(LUNCH.late)} 前）` });
  if (S.bl >= 70) todo.push({ u: S.bl >= 90, t: '去廁所' });
  if (S.en < 35) todo.push({ u: S.en < 20, t: '精神快不行了：喝咖啡或吃飯' });
  $('todo').innerHTML = todo.length ? todo.map(x => `<li class="${x.u ? 'u' : ''}">${esc(x.t)}</li>`).join('') : '<li class="none">目前沒有人在找你，專心寫 code 吧</li>';
}
function updateNightPanel() {
  $('boardTitle').textContent = isWeekend() ? '週六值班' : '今晚 on-call';
  const cls = r => r === '處理中' ? 's-dev' : r.startsWith('升級') || r.startsWith('沒') ? 's-review' : 's-done';
  const pages = S.pages.map((p, i) => `<div class="tk ${cls(p.result)}"><div class="tk-top"><code>Page #${i + 1}　${hhmm(p.at)}</code><span class="st">${p.result}</span></div><div class="tk-title">${esc(p.inc.title)}</div></div>`).join('');
  const life = isWeekend()
    ? `<div class="life"><span class="${S.ate ? 'ok' : ''}">吃飯 ${S.ate ? '✓' : '—'}</span><span class="${S.outing && S.outing.laptop ? 'ok' : ''}">${S.outing ? (S.outing.laptop ? '背著筆電' : '沒帶筆電') : '在家'}</span>${S.plans.map(p => `<span class="${/完成/.test(p.result) ? 'ok' : ''}">${p.label.replace(/出門|去|回/, '')} ${/完成/.test(p.result) ? '✓' : '✗'}</span>`).join('')}`
    : `<div class="life"><span class="${S.ate ? 'ok' : ''}">晚餐 ${S.ate ? '✓' : '—'}</span><span class="${S.showered ? 'ok' : ''}">洗澡 ${S.showered ? '✓' : '—'}</span><span class="${S.sleepMin >= 360 ? 'ok' : ''}">睡眠 ${dur(S.sleepMin)}</span><span>勿擾 ${S.dnd === null ? '—' : S.dnd ? '開' : '關'}</span>`;
  const life2 = `<span class="${S.fam >= 6 ? 'ok' : ''}">家人 ❤ ${S.fam}/${FAMILY.max}</span><span>叫醒阿凱 ${S.akai + S.escalated}</span></div>`;
  $('board').innerHTML = life + life2 + (pages || '<div class="tk-empty">目前還沒有 page。希望今晚很平靜。</div>');
  const todo = [];
  const p = S.page;
  if (p && p.stage === 'ring') todo.push({ u: true, t: `📟 page 響了！按「接 page」或 T（${hhmm(p.dl)} 前）` });
  if (p && p.stage === 'acked') todo.push({ u: p.dl - S.t < 5, t: `到書房開筆電處理（${hhmm(p.dl)} 前）` });
  if (S.delivery.stage === 'arrived') todo.push({ u: S.delivery.dl - S.t < 5, t: `🛵 外送到了，去大門拿（${hhmm(S.delivery.dl)} 前）` });
  if ((S.delivery.stage === 'got' || S.delivery.stage === 'gotCold') && !S.ate) todo.push({ t: '去餐桌吃晚餐' });
  if (S.delivery.stage === 'cold') todo.push({ t: '外送在門口放涼了，還是去拿吧' });
  if (S.pings.fam) todo.push({ u: S.pings.fam.dl - S.t < 5, t: S.pings.fam.type === 'plan' ? `小雯在沙發等你回覆：${S.pings.fam.data.plan.label}（${hhmm(S.pings.fam.dl)} 前）` : `小雯在沙發：「要不要一起看一集劇？」（${hhmm(S.pings.fam.dl)} 前）` });
  if (S.outing) todo.push({ t: `🏖 跟小雯${S.outing.plan.label}中${S.outing.phoneOff ? '（手機關機）' : ''}` });
  if (isWeekend() && !S.ate && S.t >= TW(11, 30) && !S.outing) todo.push({ u: S.t > TW(13, 30), t: '還沒吃飯（餐桌可以煮麵）' });
  if (isWeekend() && !p && (S.t < TW(6, 0) || S.t > TW(23, 0)) && !(S.busy && S.busy.kind === 'sleep')) todo.push({ u: S.t > TW(1, 0) && S.t < TW(6, 0), t: '該去睡了' });
  if (S.pings.rev) todo.push({ u: true, t: `開筆電交接給白天的 on-call 阿凱（${hhmm(S.pings.rev.dl)} 前）` });
  if (partnerSpot() === 'table' && !S.ate && S.delivery.stage !== 'coming') todo.push({ t: '小雯在餐桌等你一起吃' });
  if (S.lines.length) todo.push({ t: `💬 ${S.lines.length} 則訊息未讀（按「手機」或 L）` });
  if (isNight() && !S.showered && S.t > TN(21, 0)) todo.push({ t: '去洗澡' });
  if (isNight() && !p && S.t > TN(23, 0) && !(S.busy && S.busy.kind === 'sleep') && S.t < ALARM) todo.push({ u: S.t > TN(0, 30), t: '該去睡了' });
  if (S.bl >= 70) todo.push({ u: S.bl >= 90, t: '去廁所' });
  $('todo').innerHTML = todo.length ? todo.map(x => `<li class="${x.u ? 'u' : ''}">${esc(x.t)}</li>`).join('') : '<li class="none">沒事。去休息吧</li>';
}

/* ================= 啟動 ================= */
chooseLevel();
updateUI();
requestAnimationFrame(loop);
