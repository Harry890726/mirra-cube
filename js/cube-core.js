// 鏡像魔方核心：以 54 個貼面 (facelet) 表示狀態，並提供逐層 (LBL) 初級解法求解器。
// 鏡像魔方的內部結構與標準 3x3 完全相同，只是以「形狀」取代「顏色」，
// 所以這裡的「顏色」代表每一面在復原時所屬的面 (0..5 = U R F D L B)。

export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
export const NORMALS = {
  U: [0, 1, 0], D: [0, -1, 0],
  R: [1, 0, 0], L: [-1, 0, 0],
  F: [0, 0, 1], B: [0, 0, -1],
};

const key = (p, n) => p.join(',') + '|' + n.join(',');
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// 以軸 a 旋轉 -90°（從該面外側看為順時針）
function rotCW(v, a) {
  const c = cross(a, v), d = dot(a, v);
  return [-c[0] + a[0] * d, -c[1] + a[1] * d, -c[2] + a[2] * d].map(x => x + 0);
}

// 建立 54 個貼面
export const FACELETS = [];
const INDEX = new Map();
for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
  const p = [x, y, z];
  for (const f of FACES) {
    const n = NORMALS[f];
    if (dot(p, n) === 1) {
      INDEX.set(key(p, n), FACELETS.length);
      FACELETS.push({ p, n, face: FACES.indexOf(f) });
    }
  }
}
export const faceletIndex = (p, n) => INDEX.get(key(p, n));

// 18 個基本轉動的排列
const PERM = {};
for (const f of FACES) {
  const a = NORMALS[f];
  const perm = new Int8Array(54);
  FACELETS.forEach((fl, i) => {
    if (dot(fl.p, a) === 1) perm[i] = faceletIndex(rotCW(fl.p, a), rotCW(fl.n, a));
    else perm[i] = i;
  });
  PERM[f] = perm;
  PERM[f + '2'] = compose(perm, perm);
  PERM[f + "'"] = compose(PERM[f + '2'], perm);
}
// compose(a, b): 先 a 再 b
function compose(a, b) {
  const r = new Int8Array(54);
  for (let i = 0; i < 54; i++) r[i] = b[a[i]];
  return r;
}
export const MOVES = Object.keys(PERM);

export function parseAlg(str) {
  return str.replace(/[’‘`]/g, "'").trim().split(/\s+/).filter(Boolean).map(m => {
    const mm = m.replace(/2'|'2/, '2');
    if (!PERM[mm]) throw new Error('無法辨識的轉動：' + m);
    return mm;
  });
}
export function invertMove(m) {
  if (m.endsWith('2')) return m;
  if (m.endsWith("'")) return m[0];
  return m + "'";
}
export const invertAlg = moves => moves.slice().reverse().map(invertMove);

function algPerm(moves) {
  let p = new Int8Array(54).map((_, i) => i);
  for (const m of moves) p = compose(p, PERM[m]);
  return p;
}

export function solvedState() { return Uint8Array.from(FACELETS, f => f.face); }
export function applyPerm(state, perm) {
  const r = new Uint8Array(54);
  for (let i = 0; i < 54; i++) r[perm[i]] = state[i];
  return r;
}
export function applyMoves(state, moves) {
  for (const m of moves) state = applyPerm(state, PERM[m]);
  return state;
}
export const isSolved = s => s.every((c, i) => c === FACELETS[i].face);

export function randomScramble(n = 25) {
  const res = [];
  const axis = f => 'UDRLFB'.indexOf(f) >> 1;
  while (res.length < n) {
    const f = FACES[Math.floor(Math.random() * 6)];
    const last = res[res.length - 1], prev = res[res.length - 2];
    if (last && last[0] === f) continue;
    if (last && prev && axis(last[0]) === axis(f) && axis(prev[0]) === axis(f)) continue;
    res.push(f + ['', "'", '2'][Math.floor(Math.random() * 3)]);
  }
  return res;
}

// ---------------- 求解器 ----------------

// 取得某方塊（以面字母組合表示，如 'DF'、'DFR'）的貼面索引
function pieceFacelets(name) {
  const p = [0, 0, 0];
  for (const ch of name) { const n = NORMALS[ch]; for (let k = 0; k < 3; k++) p[k] += n[k]; }
  return [...name].map(ch => faceletIndex(p, NORMALS[ch]));
}

// 以 y 轉體重新對應面字母，產生四個槽位的公式
const Y_MAP = { F: 'R', R: 'B', B: 'L', L: 'F', U: 'U', D: 'D' };
function yRotate(alg, k) {
  return alg.split(' ').map(m => { let f = m[0]; for (let i = 0; i < k; i++) f = Y_MAP[f]; return f + m.slice(1); }).join(' ');
}

function macro(label, alg) {
  const moves = parseAlg(alg);
  return { label, moves, perm: algPerm(moves) };
}
const U_MACROS = [macro('U', 'U'), macro("U'", "U'"), macro('U2', 'U2')];

function solvedFacelets(state, idxs) {
  for (const i of idxs) if (state[i] !== FACELETS[i].face) return false;
  return true;
}

// 以「巨集」(單步或公式) 做迭代加深搜尋
function search(state, macros, goal, maxDepth, sameGroup) {
  const path = [];
  function dfs(s, depth, lastGroup) {
    if (depth === 0) return goal(s);
    for (const m of macros) {
      if (sameGroup && lastGroup !== null && sameGroup(m, lastGroup)) continue;
      path.push(m);
      if (dfs(applyPerm(s, m.perm), depth - 1, m)) return true;
      path.pop();
    }
    return false;
  }
  for (let d = 0; d <= maxDepth; d++) if (dfs(state, d, null)) return { path, state: path.reduce((s, m) => applyPerm(s, m.perm), state) };
  throw new Error('搜尋失敗（狀態可能無效）');
}

export const STAGE_INFO = [
  { id: 'cross', name: '底層十字', desc: '把底面 (D) 的四個邊塊放回正確位置，形成十字。' },
  { id: 'corners', name: '底層角塊', desc: '將底層四個角塊轉到上方對準位置，重複 (R U R\' U\') 直到歸位。' },
  { id: 'middle', name: '中層邊塊', desc: '用左/右插入公式把四個中層邊塊放進去。' },
  { id: 'ucross', name: '頂層十字', desc: '用 F R U R\' U\' F\' 讓頂層邊塊形成十字（點 → L → 一字 → 十字）。' },
  { id: 'uedges', name: '頂層邊塊歸位', desc: '用 R U R\' U R U2 R\' 交換頂層邊塊，使其與中心對齊。' },
  { id: 'ucorners', name: '頂層角塊歸位', desc: '用 U R U\' L\' U R\' U\' L 循環三個角塊，讓每個角塊位置正確。' },
  { id: 'orient', name: '頂層角塊翻轉', desc: '把要翻的角塊放在右前上方，重複 (R\' D\' R D) 直到其頂面正確，再轉 U 處理下一個。' },
];

const FACE_AXIS = f => 'UDRLFB'.indexOf(f) >> 1;

export function solve(start) {
  let state = Uint8Array.from(start);
  const stages = [];
  const keep = [];
  const add = (id, steps) => stages.push({ ...STAGE_INFO.find(s => s.id === id), steps });

  // 1. 底層十字：逐一以 18 種單步轉動搜尋
  {
    const single = MOVES.map(m => macro(m, m));
    const steps = [];
    for (const e of ['DF', 'DR', 'DB', 'DL']) {
      const goalIdx = keep.concat(pieceFacelets(e));
      const r = search(state, single, s => solvedFacelets(s, goalIdx), 8,
        (m, last) => m.moves[0][0] === last.moves[0][0] ||
          (FACE_AXIS(m.moves[0][0]) === FACE_AXIS(last.moves[0][0]) && 'UDRLFB'.indexOf(m.moves[0][0]) < 'UDRLFB'.indexOf(last.moves[0][0])));
      if (r.path.length) steps.push({ label: `邊塊 ${e}`, moves: r.path.map(m => m.moves[0]) });
      state = r.state; keep.push(...pieceFacelets(e));
    }
    add('cross', steps);
  }

  // 2. 底層角塊
  {
    const slotFace = { DFR: 'R', DRB: 'B', DBL: 'L', DLF: 'F' };
    const macros = [...U_MACROS];
    for (const [slot, f] of Object.entries(slotFace)) for (let k = 1; k <= 5; k++) {
      const base = `${f} U ${f}' U'`;
      macros.push(macro(k === 1 ? base : `(${base}) ×${k}`, Array(k).fill(base).join(' ')));
    }
    const steps = [];
    for (const c of Object.keys(slotFace)) {
      const goalIdx = keep.concat(pieceFacelets(c));
      const r = search(state, macros, s => solvedFacelets(s, goalIdx), 4, (m, l) => m.label[0] === 'U' && l.label[0] === 'U');
      for (const m of r.path) steps.push({ label: `角塊 ${c}：${m.label}`, moves: m.moves });
      state = r.state; keep.push(...pieceFacelets(c));
    }
    add('corners', steps);
  }

  // 3. 中層邊塊
  {
    const macros = [...U_MACROS];
    for (let k = 0; k < 4; k++) {
      macros.push(macro('右插：' + yRotate("U R U' R' U' F' U F", k), yRotate("U R U' R' U' F' U F", k)));
      macros.push(macro('左插：' + yRotate("U' L' U L U F U' F'", k), yRotate("U' L' U L U F U' F'", k)));
    }
    const steps = [];
    for (const e of ['FR', 'RB', 'BL', 'LF']) {
      const goalIdx = keep.concat(pieceFacelets(e));
      const r = search(state, macros, s => solvedFacelets(s, goalIdx), 5, (m, l) => m.label[0] === 'U' && l.label[0] === 'U');
      for (const m of r.path) steps.push({ label: `邊塊 ${e}：${m.label}`, moves: m.moves });
      state = r.state; keep.push(...pieceFacelets(e));
    }
    add('middle', steps);
  }

  const toSteps = path => path.map(m => ({ label: m.label, moves: m.moves }));
  const uEdges = ['UF', 'UR', 'UB', 'UL'];
  const uCorners = ['UFR', 'URB', 'UBL', 'ULF'];

  // 4. 頂層十字（只看頂面）
  {
    const topIdx = uEdges.map(e => pieceFacelets(e)[0]);
    const goalIdx = keep.concat(topIdx);
    const macros = [...U_MACROS, macro("F R U R' U' F'", "F R U R' U' F'")];
    const r = search(state, macros, s => solvedFacelets(s, goalIdx), 5, (m, l) => m.label[0] === 'U' && l.label[0] === 'U');
    add('ucross', toSteps(r.path)); state = r.state;
  }

  // 5. 頂層邊塊歸位
  {
    const goalIdx = keep.concat(...uEdges.map(pieceFacelets));
    const macros = [...U_MACROS, macro("R U R' U R U2 R'", "R U R' U R U2 R'")];
    const r = search(state, macros, s => solvedFacelets(s, goalIdx), 6, (m, l) => m.label[0] === 'U' && l.label[0] === 'U');
    add('uedges', toSteps(r.path)); state = r.state;
    keep.push(...uEdges.flatMap(pieceFacelets));
  }

  // 6. 頂層角塊歸位（只看位置，不看方向）
  {
    const cornerOk = s => uCorners.every(c => {
      const idx = pieceFacelets(c);
      const want = idx.map(i => FACELETS[i].face).sort().join();
      return idx.map(i => s[i]).sort().join() === want;
    });
    const macros = [];
    for (let k = 0; k < 4; k++) macros.push(macro(yRotate("U R U' L' U R' U' L", k), yRotate("U R U' L' U R' U' L", k)));
    const r = search(state, macros, s => solvedFacelets(s, keep) && cornerOk(s), 3);
    add('ucorners', toSteps(r.path)); state = r.state;
  }

  // 7. 頂層角塊翻轉（初級法：固定在 UFR 重複 R' D' R D）
  {
    const steps = [];
    const sexy = parseAlg("R' D' R D");
    const uFacelet = pieceFacelets('UFR')[0];
    let pendingU = 0;
    // U 轉動先套用到 state，只在需要時才記錄成一步（合併連續的 U）
    const flushU = () => {
      const m = ['', 'U', 'U2', "U'"][pendingU % 4];
      if (m) steps.push({ label: m, moves: [m] });
      pendingU = 0;
    };
    for (let i = 0; i < 4; i++) {
      let k = 0;
      let s = state;
      while (s[uFacelet] !== 0) { s = applyMoves(s, sexy); k++; }
      if (k) {
        flushU();
        steps.push({ label: k === 1 ? "R' D' R D" : `(R' D' R D) ×${k}`, moves: Array(k).fill(sexy).flat() });
        state = s;
      }
      if (i < 3) { state = applyMoves(state, ['U']); pendingU++; }
    }
    // 撤銷尚未記錄的 U，再做最後對齊
    for (; pendingU > 0; pendingU--) state = applyMoves(state, ["U'"]);
    for (const m of ['', 'U', 'U2', "U'"]) {
      const s = m ? applyMoves(state, [m]) : state;
      if (isSolved(s)) { if (m) steps.push({ label: m, moves: [m] }); state = s; break; }
    }
    add('orient', steps);
  }

  if (!isSolved(state)) throw new Error('求解失敗');
  return stages;
}
