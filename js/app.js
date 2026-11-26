import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import * as Core from './cube-core.js';

// ---------------- 場景 ----------------
const container = document.getElementById('viewer');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(6.2, 5.2, 8);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 6;
controls.maxDistance = 20;
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(4, 8, 6);
scene.add(sun, new THREE.AmbientLight(0xffffff, 0.6));

function resize() {
  const { clientWidth: w, clientHeight: h } = container;
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = w + 'px';
  renderer.domElement.style.height = h + 'px';
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(container);

// ---------------- 鏡像魔方幾何 ----------------
// 切割面都在 ±0.5，但每個軸向外側的邊界不同 → 每層厚度不同
const BOUNDS = {
  x: [-1.9, -0.5, 0.5, 1.1],   // L 厚 1.4，M 1.0，R 0.6
  y: [-1.75, -0.5, 0.5, 1.25], // D 厚 1.25，E 1.0，U 0.75
  z: [-1.3, -0.5, 0.5, 1.7],   // B 厚 0.8，S 1.0，F 1.2
};
const GAP = 0.025;
const cubeGroup = new THREE.Group();
cubeGroup.position.set(
  -(BOUNDS.x[0] + BOUNDS.x[3]) / 2, -(BOUNDS.y[0] + BOUNDS.y[3]) / 2, -(BOUNDS.z[0] + BOUNDS.z[3]) / 2);
scene.add(cubeGroup);

const mirrorMat = new THREE.MeshStandardMaterial({ color: 0xf0c869, metalness: 0.9, roughness: 0.22, envMapIntensity: 1.6 });
const innerMat = new THREE.MeshStandardMaterial({ color: 0x18150f, metalness: 0.2, roughness: 0.8 });
// 顏色提示（U 白、R 紅、F 綠、D 黃、L 橙、B 藍）
const HINT_COLORS = { U: 0xf2f2f2, R: 0xc8102e, F: 0x00a651, D: 0xffd500, L: 0xff6a13, B: 0x0051ba };
const hintMats = Object.fromEntries(Object.entries(HINT_COLORS).map(([f, c]) =>
  [f, new THREE.MeshStandardMaterial({ color: c, metalness: 0.35, roughness: 0.3 })]));
// BoxGeometry 材質順序：+x, -x, +y, -y, +z, -z
const BOX_FACES = ['R', 'L', 'U', 'D', 'F', 'B'];

const cubies = [];
for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
  if (!i && !j && !k) continue;
  const [x0, x1] = [BOUNDS.x[i + 1], BOUNDS.x[i + 2]];
  const [y0, y1] = [BOUNDS.y[j + 1], BOUNDS.y[j + 2]];
  const [z0, z1] = [BOUNDS.z[k + 1], BOUNDS.z[k + 2]];
  const geo = new THREE.BoxGeometry(x1 - x0 - 2 * GAP, y1 - y0 - 2 * GAP, z1 - z0 - 2 * GAP);
  geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const outward = [i === 1, i === -1, j === 1, j === -1, k === 1, k === -1];
  const mesh = new THREE.Mesh(geo, outward.map(o => (o ? mirrorMat : innerMat)));
  mesh.userData = { home: new THREE.Vector3(i, j, k), outward };
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: 0x3a2a08, transparent: true, opacity: 0.55 }));
  mesh.add(edges);
  cubeGroup.add(mesh);
  cubies.push(mesh);
}

function setHint(on) {
  for (const c of cubies) c.material = c.userData.outward.map((o, idx) => (o ? (on ? hintMats[BOX_FACES[idx]] : mirrorMat) : innerMat));
}

// 面標籤（中心塊永遠不動，標籤固定在世界座標）
const labelGroup = new THREE.Group();
cubeGroup.add(labelGroup);
function makeLabel(text) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(176,122,28,0.92)';
  g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 72px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 70);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv) }));
  sp.scale.set(0.55, 0.55, 1);
  return sp;
}
const LABEL_POS = {
  U: [0, BOUNDS.y[3] + 0.7, 0], D: [0, BOUNDS.y[0] - 0.7, 0],
  R: [BOUNDS.x[3] + 0.7, 0, 0], L: [BOUNDS.x[0] - 0.7, 0, 0],
  F: [0, 0, BOUNDS.z[3] + 0.7], B: [0, 0, BOUNDS.z[0] - 0.7],
};
for (const [f, p] of Object.entries(LABEL_POS)) { const s = makeLabel(f); s.position.set(...p); labelGroup.add(s); }

// ---------------- 轉動 ----------------
const AXIS = Object.fromEntries(Object.entries(Core.NORMALS).map(([f, n]) => [f, new THREE.Vector3(...n)]));
function moveInfo(m) {
  const turns = m.endsWith('2') ? 2 : m.endsWith("'") ? -1 : 1;
  return { face: m[0], axis: AXIS[m[0]], angle: -Math.PI / 2 * turns };
}
function layerOf(face) {
  const n = AXIS[face];
  return cubies.filter(c => Math.round(c.userData.home.clone().applyQuaternion(c.quaternion).dot(n)) === 1);
}
const _m = new THREE.Matrix4();
function snap(q) {
  _m.makeRotationFromQuaternion(q);
  const e = _m.elements;
  for (const idx of [0, 1, 2, 4, 5, 6, 8, 9, 10]) e[idx] = Math.round(e[idx]);
  q.setFromRotationMatrix(_m);
}
function applyInstant(m) {
  const { face, axis, angle } = moveInfo(m);
  const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  for (const c of layerOf(face)) { c.quaternion.premultiply(q); snap(c.quaternion); }
}

let history = [];                 // 從復原狀態到目前畫面的所有轉動
const logicalState = () => Core.applyMoves(Core.solvedState(), history);
function rebuild(moves) {
  history = moves.slice();
  for (const c of cubies) c.quaternion.identity();
  for (const m of history) applyInstant(m);
}

// 動畫佇列
const queue = [];
let anim = null;
let speed = 1;
const banner = document.getElementById('move-banner');
let bannerTimer;
function showBanner(text) {
  banner.textContent = text;
  banner.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => banner.classList.remove('show'), 900);
}
function enqueue(move, onDone, onStart) { queue.push({ move, onDone, onStart }); }
function startNext() {
  const job = queue.shift();
  const { face, axis, angle } = moveInfo(job.move);
  const layer = layerOf(face);
  anim = { ...job, axis, angle, layer, starts: layer.map(c => c.quaternion.clone()), t: 0,
    dur: (Math.abs(angle) > 2 ? 420 : 300) / speed };
  showBanner(job.move);
  job.onStart?.();
}
function finishAnim() {
  const q = new THREE.Quaternion().setFromAxisAngle(anim.axis, anim.angle);
  anim.layer.forEach((c, i) => { c.quaternion.copy(anim.starts[i]).premultiply(q); snap(c.quaternion); });
  const done = anim.onDone;
  anim = null;
  done?.();
}
// 立即完成目前動畫並清空佇列
function flush() { queue.length = 0; if (anim) finishAnim(); }
const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

let last = performance.now();
const tmpQ = new THREE.Quaternion();
renderer.setAnimationLoop(now => {
  const dt = now - last; last = now;
  if (!anim && queue.length) startNext();
  if (anim) {
    anim.t = Math.min(1, anim.t + dt / anim.dur);
    tmpQ.setFromAxisAngle(anim.axis, anim.angle * ease(anim.t));
    anim.layer.forEach((c, i) => c.quaternion.copy(anim.starts[i]).premultiply(tmpQ));
    if (anim.t >= 1) finishAnim();
  }
  controls.update();
  renderer.render(scene, camera);
});

// ---------------- UI：操作 ----------------
const $ = id => document.getElementById(id);
const scrambleText = $('scramble-text');
const solveMsg = $('solve-msg');

function manualMove(m) {
  clearPlayer();
  enqueue(m, () => history.push(m));
}
const grid = $('move-grid');
for (const suffix of ['', "'", '2']) for (const f of ['U', 'D', 'L', 'R', 'F', 'B']) {
  const b = document.createElement('button');
  b.textContent = f + suffix;
  b.onclick = () => manualMove(f + suffix);
  grid.appendChild(b);
}
document.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
  const f = e.key.toUpperCase();
  if ('UDLRFB'.includes(f) && f.length === 1) { manualMove(e.shiftKey ? f + "'" : f); e.preventDefault(); }
  if (e.key === ' ' && !player.root.hidden) { togglePlay(); e.preventDefault(); }
  if (e.key === 'ArrowRight' && !player.root.hidden) stepForward();
  if (e.key === 'ArrowLeft' && !player.root.hidden) stepBack();
});

$('btn-scramble').onclick = () => {
  flush(); clearPlayer();
  const scr = Core.randomScramble(22);
  scrambleText.textContent = '打亂：' + scr.join(' ');
  rebuild([]);
  scr.forEach(m => enqueue(m, () => history.push(m)));
  speedBoost(scr.length);
};
$('btn-reset').onclick = () => { flush(); clearPlayer(); rebuild([]); scrambleText.textContent = ''; };
$('btn-apply').onclick = () => {
  let moves;
  try { moves = Core.parseAlg($('scramble-input').value); } catch (err) { scrambleText.textContent = err.message; return; }
  if (!moves.length) return;
  flush(); clearPlayer();
  scrambleText.textContent = '套用：' + moves.join(' ');
  moves.forEach(m => enqueue(m, () => history.push(m)));
  speedBoost(moves.length);
};
$('scramble-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-apply').click(); });
// 打亂時暫時加速
function speedBoost(n) {
  const old = speed;
  speed = 4;
  let left = n;
  const orig = queue.slice(-n);
  orig.forEach(job => { const d = job.onDone; job.onDone = () => { d?.(); if (--left === 0) speed = +$('speed').value || old; }; });
}
$('hint').onchange = e => setHint(e.target.checked);
$('labels').onchange = e => { labelGroup.visible = e.target.checked; };
$('speed').oninput = e => { speed = +e.target.value; };

// ---------------- 求解播放器 ----------------
const player = { root: $('player'), list: $('solution'), base: [], moves: [], pos: 0, playing: false, tokens: [] };

function clearPlayer() {
  player.playing = false;
  player.root.hidden = true;
  player.moves = [];
  solveMsg.textContent = '';
}

$('btn-solve').onclick = () => {
  flush();
  const state = logicalState();
  if (Core.isSolved(state)) { clearPlayer(); solveMsg.textContent = '魔方已經是復原狀態，先打亂看看吧！'; return; }
  let stages;
  try { stages = Core.solve(state); } catch (err) { solveMsg.textContent = err.message; return; }
  player.base = history.slice();
  player.moves = [];
  player.pos = 0;
  player.tokens = [];
  player.stageStart = [];
  player.list.innerHTML = '';
  stages.forEach((st, si) => {
    const li = document.createElement('li');
    li.className = 'stage';
    const count = st.steps.reduce((a, s) => a + s.moves.length, 0);
    li.innerHTML = `<div class="stage-head"><h3>${si + 1}. ${st.name}</h3><span class="small">${count} 步</span></div>
      <p class="small stage-desc">${count ? st.desc : '這一步已經完成，可以跳過。'}</p>`;
    const startIdx = player.moves.length;
    player.stageStart.push(startIdx);
    li.querySelector('.stage-head').onclick = () => jumpTo(startIdx);
    for (const step of st.steps) {
      const div = document.createElement('div');
      div.className = 'step';
      div.innerHTML = `<span class="step-label">${step.label}</span>`;
      for (const m of step.moves) {
        const idx = player.moves.length;
        player.moves.push(m);
        const tok = document.createElement('span');
        tok.className = 'mv';
        tok.textContent = m;
        tok.title = '跳到這一步之前';
        tok.onclick = () => jumpTo(idx);
        div.appendChild(tok);
        player.tokens.push(tok);
      }
      li.appendChild(div);
    }
    player.list.appendChild(li);
  });
  player.root.hidden = false;
  solveMsg.textContent = `共 ${player.moves.length} 步（逐層法，適合學習；不是最少步數）。點任何一步可以跳轉。`;
  updatePlayerUI();
};

function updatePlayerUI() {
  player.tokens.forEach((t, i) => {
    t.classList.toggle('done', i < player.pos);
    t.classList.toggle('current', i === player.pos);
  });
  player.tokens[player.pos]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  $('progress').textContent = `${player.pos} / ${player.moves.length}`;
  $('p-play').textContent = player.playing ? '⏸ 暫停' : '▶ 播放';
}
function setPos(p) { player.pos = p; history = player.base.concat(player.moves.slice(0, p)); updatePlayerUI(); }
function jumpTo(p) {
  player.playing = false;
  flush();
  rebuild(player.base.concat(player.moves.slice(0, p)));
  setPos(p);
}
function stepForward() {
  if (anim || queue.length || player.pos >= player.moves.length) return;
  const p = player.pos;
  enqueue(player.moves[p], () => {
    setPos(p + 1);
    if (player.playing) {
      if (player.pos < player.moves.length) stepForward();
      else { player.playing = false; updatePlayerUI(); showBanner('完成！'); }
    }
  }, () => player.tokens[p]?.classList.add('current'));
}
function stepBack() {
  if (anim || queue.length || player.pos <= 0) return;
  player.playing = false;
  const p = player.pos;
  enqueue(Core.invertMove(player.moves[p - 1]), () => setPos(p - 1));
}
function togglePlay() {
  if (player.playing) { player.playing = false; updatePlayerUI(); return; }
  if (player.pos >= player.moves.length) jumpTo(0);
  player.playing = true;
  updatePlayerUI();
  stepForward();
}
$('p-play').onclick = togglePlay;
$('p-next').onclick = () => { player.playing = false; updatePlayerUI(); stepForward(); };
$('p-prev').onclick = stepBack;
$('p-start').onclick = () => jumpTo(0);
$('p-end').onclick = () => jumpTo(player.moves.length);

// ---------------- 教學 ----------------
const LESSONS = [
  {
    title: '底層十字',
    text: `先選一面當底（建議選最厚的中心塊當 D 面，比較好辨認）。找出四個與底面中心相鄰的邊塊，
      讓它們的底面和側面都與對應中心塊<strong>齊平</strong>。鏡像魔方沒有顏色，判斷依據是：邊塊與中心塊的高度一致、外觀連成一個平面。`,
    algs: [
      { alg: 'F2', note: '邊塊在頂層且方向正確：轉到目標上方後轉 180° 放下' },
      { alg: "F' D R' D'", note: '邊塊在底層但方向翻轉：先拿出來再翻正放回' },
    ],
  },
  {
    title: '底層角塊',
    text: `找一個屬於底層的角塊，轉 U 讓它位於目標位置的正上方（右前上）。
      然後重複 R U R' U'，直到角塊三個面都與周圍齊平（最多 5 次）。鏡像魔方的角塊三個方向厚度都不同，很容易看出有沒有對齊。`,
    algs: [
      { alg: "R U R' U' R U R' U' R U R' U'", note: '(R U R\' U\') ×3：常見的角塊方向修正' },
      { alg: "U R U' R'", note: '角塊在右前上、方向剛好時的快速插入' },
    ],
  },
  {
    title: '中層邊塊',
    text: `把魔方翻過來後（底層朝下保持不變），在頂層找一個不屬於頂面的邊塊。
      轉 U 讓它的側面與前方中心「齊平」形成一條直線，再依它要去的方向使用右插或左插公式。`,
    algs: [
      { alg: "U R U' R' U' F' U F", note: '右插：從頂前放入前右位置' },
      { alg: "U' L' U L U F U' F'", note: '左插：從頂前放入前左位置' },
    ],
  },
  {
    title: '頂層十字',
    text: `觀察頂面：四個頂層邊塊的頂面是否和頂面中心齊平。依「點 → L 形 → 一字 → 十字」的順序，
      L 形放在左後方、一字橫放，然後做公式。`,
    algs: [{ alg: "F R U R' U' F'", note: '每做一次會往十字前進一個階段' }],
  },
  {
    title: '頂層邊塊歸位',
    text: `轉 U 讓盡量多的頂層邊塊與側面中心齊平。若有兩個相鄰的邊塊不對，把它們放在右方和後方再做公式；
      若是相對的兩個，就先做一次再重新調整。`,
    algs: [{ alg: "R U R' U R U2 R' U", note: '交換前方與左方的頂層邊塊' }],
  },
  {
    title: '頂層角塊歸位',
    text: `只看位置、不管方向：角塊所在位置的三個相鄰中心「形狀對得上」就算位置正確。
      把一個位置正確的角塊放在右前上，重複公式直到四個角塊都在正確位置。`,
    algs: [{ alg: "U R U' L' U R' U' L", note: '循環其餘三個頂層角塊' }],
  },
  {
    title: '頂層角塊翻轉',
    text: `把方向錯誤的角塊放在右前上，重複 R' D' R D 直到它的頂面齊平（2 或 4 次）。
      期間底層會暫時被打亂——這是正常的！接著<strong>只轉 U</strong> 換下一個角塊，全部完成後底層會自動恢復。`,
    algs: [{
      alg: "R' D' R D R' D' R D U R' D' R D R' D' R D R' D' R D R' D' R D U'",
      note: '兩個角塊的翻轉：(R\' D\' R D)×2，U，(R\' D\' R D)×4，U\'',
    }],
  },
];

const lessonsEl = $('lessons');
let demoTokens = [];
LESSONS.forEach((ls, i) => {
  const card = document.createElement('div');
  card.className = 'card lesson';
  card.innerHTML = `<h3><span class="num">${i + 1}</span>${ls.title}</h3><p>${ls.text}</p>`;
  for (const a of ls.algs) {
    const row = document.createElement('div');
    row.className = 'alg';
    const left = document.createElement('div');
    const moves = Core.parseAlg(a.alg);
    const tokWrap = document.createElement('span');
    tokWrap.className = 'mono';
    const toks = moves.map(m => { const s = document.createElement('span'); s.textContent = m + ' '; tokWrap.appendChild(s); return s; });
    left.appendChild(tokWrap);
    left.insertAdjacentHTML('beforeend', `<small>${a.note}</small>`);
    const btn = document.createElement('button');
    btn.textContent = '示範';
    btn.onclick = () => demo(moves, toks);
    row.append(left, btn);
    card.appendChild(row);
  }
  lessonsEl.appendChild(card);
});

// 示範：先擺出「做完公式就會復原」的情況，再播放公式
function demo(moves, toks) {
  flush(); clearPlayer();
  demoTokens.forEach(t => (t.style.color = ''));
  demoTokens = toks;
  rebuild(Core.invertAlg(moves));
  scrambleText.textContent = '';
  showBanner('示範');
  moves.forEach((m, i) => enqueue(m, () => { history.push(m); toks[i].style.color = ''; },
    () => { toks.forEach(t => (t.style.color = '')); toks[i].style.color = 'var(--accent)'; }));
}

// 分頁
document.querySelectorAll('.tab').forEach(tab => tab.onclick = () => {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
  $('tab-play').hidden = tab.dataset.tab !== 'play';
  $('tab-learn').hidden = tab.dataset.tab !== 'learn';
});

resize();
