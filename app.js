/* TapeOut Academy — concept prototype. Everything is simulated client-side. */
(() => {
'use strict';

const NAND_TR = 4;
const START_WALLET = 160;
const GRANT = 100;
const VB = { w: 640, h: 400 };

/* ---------------- lessons ---------------- */
const LESSONS = [
  { key:'NOT', name:'NOT', sub:'Inverter', inputs:['A'], outputs:['Y'],
    fn:([a]) => [a ? 0 : 1],
    goal:'Flip the signal. Y is 1 only when A is 0.',
    hint:'A NAND with both inputs tied together is an inverter. Wire A into both inputs of one NAND.',
    sol:{ parts:[['n1','NAND',250,170]], wires:[['i0',0,'n1',0],['i0',0,'n1',1],['n1',0,'o0',0]] } },
  { key:'AND', name:'AND', sub:'Both true', inputs:['A','B'], outputs:['Y'],
    fn:([a,b]) => [a & b],
    goal:'Y is 1 only when A and B are both 1.',
    hint:'AND is just NAND, inverted. Feed a NAND into your NOT chip.',
    sol:{ parts:[['n1','NAND',200,150],['c1','NOT',360,152]], wires:[['i0',0,'n1',0],['i1',0,'n1',1],['n1',0,'c1',0],['c1',0,'o0',0]] } },
  { key:'OR', name:'OR', sub:'Either true', inputs:['A','B'], outputs:['Y'],
    fn:([a,b]) => [a | b],
    goal:'Y is 1 when A or B (or both) are 1.',
    hint:"De Morgan's trick: A OR B = NAND(NOT A, NOT B). Invert each input, then NAND them.",
    sol:{ parts:[['c1','NOT',170,80],['c2','NOT',170,240],['n1','NAND',360,160]], wires:[['i0',0,'c1',0],['i1',0,'c2',0],['c1',0,'n1',0],['c2',0,'n1',1],['n1',0,'o0',0]] } },
  { key:'XOR', name:'XOR', sub:'Exactly one', inputs:['A','B'], outputs:['Y'],
    fn:([a,b]) => [a ^ b],
    goal:'Y is 1 when A and B are different.',
    hint:'The classic 4-NAND XOR: M = NAND(A,B). Then P = NAND(A,M) and Q = NAND(B,M). Finally Y = NAND(P,Q).',
    sol:{ parts:[['m','NAND',170,160],['p','NAND',300,70],['q','NAND',300,250],['y','NAND',440,160]],
      wires:[['i0',0,'m',0],['i1',0,'m',1],['i0',0,'p',0],['m',0,'p',1],['m',0,'q',0],['i1',0,'q',1],['p',0,'y',0],['q',0,'y',1],['y',0,'o0',0]] } },
  { key:'HA', name:'HALF ADDER', sub:'Add two bits', inputs:['A','B'], outputs:['S','C'],
    fn:([a,b]) => [a ^ b, a & b],
    goal:'Add two bits. S is the sum bit, C is the carry.',
    hint:'1 + 1 = 10 in binary. The sum bit is XOR, the carry bit is AND. Use your chips.',
    sol:{ parts:[['x','XOR',280,70],['a','AND',280,240]], wires:[['i0',0,'x',0],['i1',0,'x',1],['i0',0,'a',0],['i1',0,'a',1],['x',0,'o0',0],['a',0,'o1',0]] } },
  { key:'FA', name:'FULL ADDER', sub:'Add with carry', inputs:['A','B','Cin'], outputs:['S','Cout'],
    fn:([a,b,c]) => [a ^ b ^ c, (a & b) | (c & (a ^ b))],
    goal:'Add A, B and a carry-in. Chain four of these and you have a 4-bit adder.',
    hint:'Two half adders and an OR. HA1 adds A+B. HA2 adds that sum to Cin. Cout = HA1.C OR HA2.C.',
    sol:{ parts:[['h1','HA',150,60],['h2','HA',300,200],['o','OR',450,100]],
      wires:[['i0',0,'h1',0],['i1',0,'h1',1],['h1',0,'h2',0],['i2',0,'h2',1],['h1',1,'o',0],['h2',1,'o',1],['h2',0,'o0',0],['o',0,'o1',0]] } },
];
const LKEY = Object.fromEntries(LESSONS.map((l, i) => [l.key, i]));

/* ---------------- state ---------------- */
const STORE = 'toa-v1';
let state = load() || fresh();
function fresh(){ return { wallet: START_WALLET, chips:{}, circuits:{}, lesson:0, mints:0 }; }
function load(){ try { const s = JSON.parse(localStorage.getItem(STORE)); return s && s.chips ? s : null; } catch { return null; } }
function save(){ try { localStorage.setItem(STORE, JSON.stringify(state)); } catch {} }

const ui = { sel:null, pending:null, inVals:[], drag:null, pan:null, ptr:{x:-999,y:-999}, hintOpen:false, view:{ x:0, w:VB.w }, zoomed:false };
const MOBILE_W = 420;

const $ = s => document.querySelector(s);
const board = $('#board');
const lesson = () => LESSONS[state.lesson];

/* ---------------- parts ---------------- */
function typeInfo(type){
  if (type === 'NAND') return { ins:2, outs:1, nands:1, label:'NAND', inNames:['',''], outNames:[''], ev:([a,b]) => [(a && b) ? 0 : 1] };
  const c = state.chips[type];
  if (!c) return null;
  return { ins:c.inputs.length, outs:c.outputs.length, nands:c.nands, label:c.short || c.name, inNames:c.inputs, outNames:c.outputs, chip:true,
    ev: ins => c.table[ins.reduce((acc, v) => (acc << 1) | (v ? 1 : 0), 0)] };
}
function dims(n){
  if (n.type === 'IN' || n.type === 'OUT') return { w:64, h:36 };
  if (n.type === 'NAND') return { w:76, h:56 };
  const t = typeInfo(n.type); const rows = Math.max(t.ins, t.outs, 2);
  return { w:100, h:rows * 24 + 16 };
}
function inPin(n, k){
  const d = dims(n);
  if (n.type === 'OUT') return { x:n.x, y:n.y + d.h/2 };
  const t = typeInfo(n.type);
  return { x:n.x, y:n.y + d.h * (k + 1) / (t.ins + 1) };
}
function outPin(n, k){
  const d = dims(n);
  if (n.type === 'IN') return { x:n.x + d.w, y:n.y + d.h/2 };
  const t = typeInfo(n.type);
  return { x:n.x + d.w, y:n.y + d.h * (k + 1) / (t.outs + 1) };
}

/* ---------------- circuits ---------------- */
function ioNodes(L){
  const nodes = [];
  L.inputs.forEach((name, k) => nodes.push({ id:'i'+k, type:'IN', idx:k, name, x:14, y:Math.round(VB.h*(k+1)/(L.inputs.length+1)) - 18 }));
  L.outputs.forEach((name, k) => nodes.push({ id:'o'+k, type:'OUT', idx:k, name, x:VB.w - 78, y:Math.round(VB.h*(k+1)/(L.outputs.length+1)) - 18 }));
  return nodes;
}
function circuit(){
  const L = lesson();
  let c = state.circuits[L.key];
  if (!c) { c = state.circuits[L.key] = { nodes: ioNodes(L), wires: [], seq: 0 }; }
  return c;
}
function byId(c){ const m = {}; c.nodes.forEach(n => m[n.id] = n); return m; }

function simulate(c, inVals){
  const nodes = byId(c);
  const wireTo = new Map();
  c.wires.forEach(w => wireTo.set(w.to + ':' + w.tp, w));
  const memo = new Map(), visiting = new Set();
  let cycle = false;
  const outs = id => {
    if (memo.has(id)) return memo.get(id);
    const n = nodes[id];
    if (!n) return [0];
    if (visiting.has(id)) { cycle = true; return [0,0,0]; }
    visiting.add(id);
    let res;
    if (n.type === 'IN') res = [inVals[n.idx] ? 1 : 0];
    else if (n.type === 'OUT') res = [];
    else {
      const t = typeInfo(n.type);
      const ins = []; for (let k = 0; k < t.ins; k++) ins.push(val(id, k));
      res = t.ev(ins);
    }
    visiting.delete(id); memo.set(id, res);
    return res;
  };
  const val = (id, k) => { const w = wireTo.get(id + ':' + k); return w ? (outs(w.from)[w.fp] ? 1 : 0) : 0; };
  c.nodes.forEach(n => outs(n.id));
  const outsNodes = c.nodes.filter(n => n.type === 'OUT').sort((a,b) => a.idx - b.idx);
  return { outputs: outsNodes.map(n => val(n.id, 0)), memo, cycle, val, wireTo };
}
const combos = n => Array.from({ length: 1 << n }, (_, r) => Array.from({ length: n }, (_, k) => (r >> (n - 1 - k)) & 1));
function test(c){
  const L = lesson();
  let pass = 0, cycle = false;
  const rows = combos(L.inputs.length).map(ins => {
    const s = simulate(c, ins); if (s.cycle) cycle = true;
    const exp = L.fn(ins);
    const ok = exp.every((v, i) => v === s.outputs[i]);
    if (ok) pass++;
    return { ins, got: s.outputs, exp, ok };
  });
  return { rows, pass, total: rows.length, cycle, all: pass === rows.length && !cycle };
}
function countNands(c){ return c.nodes.reduce((s, n) => s + (n.type === 'IN' || n.type === 'OUT' ? 0 : (typeInfo(n.type)?.nands || 0)), 0); }

/* ---------------- board render ---------------- */
const esc = s => String(s).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
function wirePath(a, b){
  const dx = Math.max(36, Math.abs(b.x - a.x) * 0.5);
  return `M${a.x},${a.y} C${a.x+dx},${a.y} ${b.x-dx},${b.y} ${b.x},${b.y}`;
}
const DEFS = `
<defs>
  <linearGradient id="gStroke" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7cf8d0"/><stop offset=".5" stop-color="#6aa8ff"/><stop offset="1" stop-color="#b08bff"/></linearGradient>
  <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="wireGlow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="lampGlow" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <pattern id="dotDim" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="1" fill="#8fa3c8" fill-opacity=".16"/></pattern>
  <pattern id="dotLit" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="1.5" fill="#7cf8d0"/></pattern>
  <radialGradient id="ptrFade"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".55" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <mask id="ptrMask"><circle id="ptrCircle" cx="-999" cy="-999" r="110" fill="url(#ptrFade)"/></mask>
</defs>`;

function render(){
  const c = circuit();
  const nodes = byId(c);
  const s = simulate(c, ui.inVals);
  const hiOut = (id, k) => (s.memo.get(id) || [])[k] ? 1 : 0;
  let h = DEFS;
  h += `<rect width="${VB.w}" height="${VB.h}" fill="url(#dotDim)"/>`;
  h += `<rect width="${VB.w}" height="${VB.h}" fill="url(#dotLit)" mask="url(#ptrMask)" opacity=".85"/>`;

  // wires
  c.wires.forEach((w, i) => {
    const a = nodes[w.from], b = nodes[w.to]; if (!a || !b) return;
    const d = wirePath(outPin(a, w.fp), inPin(b, w.tp));
    const on = hiOut(w.from, w.fp);
    h += `<path class="wire-hit" data-wire="${i}" d="${d}"/>`;
    h += `<path class="wire${on ? ' hi' : ''}" d="${d}" pointer-events="none"/>`;
    if (on) h += `<path class="wire-flow" d="${d}"/>`;
  });
  // pending preview
  if (ui.pending && nodes[ui.pending.id]) {
    const n = nodes[ui.pending.id];
    const p = ui.pending.dir === 'out' ? outPin(n, ui.pending.k) : inPin(n, ui.pending.k);
    h += `<path id="preview" class="wire" stroke-dasharray="4 5" d="${ui.pending.dir === 'out' ? wirePath(p, ui.ptr) : wirePath(ui.ptr, p)}" style="stroke:#fff;opacity:.6" pointer-events="none"/>`;
  }

  // nodes
  c.nodes.forEach(n => {
    const d = dims(n);
    const sel = ui.sel === n.id ? ' n-sel' : '';
    if (n.type === 'IN') {
      const on = ui.inVals[n.idx] ? 1 : 0;
      h += `<g class="node-g${on ? ' io-on' : ''}${sel}" data-node="${n.id}" transform="translate(${n.x},${n.y})">
        <rect class="io-body" width="${d.w}" height="${d.h}" rx="10"/>
        <text class="io-text" x="12" y="${d.h/2}">${esc(n.name)}</text>
        <rect x="${d.w-30}" y="9" width="20" height="18" rx="5" fill="${on ? 'rgba(124,248,208,.18)' : '#151a2a'}"/>
        <text class="io-val" x="${d.w-20}" y="${d.h/2}">${on}</text>
      </g>`;
      h += pinSvg(n, 'out', 0, on);
    } else if (n.type === 'OUT') {
      const on = s.val(n.id, 0);
      h += `<g class="node-g${on ? ' io-on' : ''}" data-node="${n.id}" transform="translate(${n.x},${n.y})">
        <rect class="io-body" width="${d.w}" height="${d.h}" rx="10"/>
        <circle class="lamp${on ? ' on' : ''}" cx="18" cy="${d.h/2}" r="7"/>
        <text class="io-text" x="32" y="${d.h/2}">${esc(n.name)}</text>
      </g>`;
      h += pinSvg(n, 'in', 0, on);
    } else {
      const t = typeInfo(n.type); if (!t) return;
      let body = '';
      for (let k = 0; k < t.ins; k++) { const y = d.h*(k+1)/(t.ins+1); body += `<line class="stub" x1="0" y1="${y}" x2="10" y2="${y}"/>`; }
      for (let k = 0; k < t.outs; k++) { const y = d.h*(k+1)/(t.outs+1); body += `<line class="stub" x1="${d.w-10}" y1="${y}" x2="${d.w}" y2="${y}"/>`; }
      if (n.type === 'NAND') {
        const bx = d.w - 14, r = (d.h - 8) / 2;
        body += `<path class="n-body" d="M10,4 H${bx - r} A${r},${r} 0 0 1 ${bx - r},${d.h - 4} H10 Z"/>`;
        body += `<circle class="n-body" cx="${bx + 4}" cy="${d.h/2}" r="4"/>`;
        body += `<text class="n-label" x="${(10 + bx) / 2 - 4}" y="${d.h/2}">NAND</text>`;
      } else {
        body += `<rect class="n-chip" x="10" y="2" width="${d.w - 20}" height="${d.h - 4}" rx="9"/>`;
        body += `<rect x="10" y="2" width="${d.w - 20}" height="3" rx="1.5" fill="url(#gStroke)" opacity=".9"/>`;
        body += `<text class="n-label" x="${d.w/2}" y="${d.h/2}" style="font-size:${t.label.length > 4 ? 9.5 : 11}px">${esc(t.label)}</text>`;
        if (t.ins > 1 || t.outs > 1) {
          for (let k = 0; k < t.ins; k++) body += `<text class="n-pinlabel" x="15" y="${d.h*(k+1)/(t.ins+1)}">${esc(t.inNames[k])}</text>`;
          for (let k = 0; k < t.outs; k++) body += `<text class="n-pinlabel" x="${d.w-15}" y="${d.h*(k+1)/(t.outs+1)}" text-anchor="end">${esc(t.outNames[k])}</text>`;
        }
      }
      h += `<g class="node-g${sel}" data-node="${n.id}" transform="translate(${n.x},${n.y})">${body}</g>`;
      for (let k = 0; k < t.ins; k++) h += pinSvg(n, 'in', k, s.val(n.id, k));
      for (let k = 0; k < t.outs; k++) h += pinSvg(n, 'out', k, hiOut(n.id, k));
    }
  });
  board.setAttribute('viewBox', `${ui.view.x} 0 ${ui.view.w} ${VB.h}`);
  board.innerHTML = h;
  zoomBtn.textContent = ui.zoomed ? 'Fit board' : 'Zoom in';
  placePtr();
  $('#delBtn').hidden = !(ui.sel && nodes[ui.sel] && !['IN','OUT'].includes(nodes[ui.sel].type));
  $('#boardTip').style.opacity = c.wires.length > 1 ? 0 : 1;
  renderPanels();
}
function pinSvg(n, dir, k, on){
  const p = dir === 'out' ? outPin(n, k) : inPin(n, k);
  const pend = ui.pending && ui.pending.id === n.id && ui.pending.k === k && ui.pending.dir === dir;
  return `<circle class="pin${on ? ' hi' : ''}${pend ? ' pending' : ''}" cx="${p.x}" cy="${p.y}" r="4.5"/>` +
         `<circle class="pin-hit" data-pin="${dir}" data-id="${n.id}" data-k="${k}" cx="${p.x}" cy="${p.y}" r="13"/>`;
}
function placePtr(){
  const pc = document.getElementById('ptrCircle');
  if (pc) { pc.setAttribute('cx', ui.ptr.x); pc.setAttribute('cy', ui.ptr.y); }
}

/* ---------------- side panels ---------------- */
function renderPanels(){
  const L = lesson(), c = circuit(), r = test(c);
  // truth table
  const curIdx = ui.inVals.reduce((a, v) => (a << 1) | (v ? 1 : 0), 0);
  let t = '<tr>' + L.inputs.map(n => `<th>${n}</th>`).join('') +
    L.outputs.map((n, i) => `<th class="${i === 0 ? 'sep' : ''}">${n}</th>`).join('') +
    L.outputs.map((n, i) => `<th class="${i === 0 ? 'sep' : ''}" title="target">${n}<sup>*</sup></th>`).join('') + '<th class="mark"></th></tr>';
  r.rows.forEach((row, i) => {
    t += `<tr class="${i === curIdx ? 'cur' : ''}">` +
      row.ins.map(v => `<td class="${v ? 'one' : 'zero'}">${v}</td>`).join('') +
      row.got.map((v, j) => `<td class="${j === 0 ? 'sep ' : ''}${v !== row.exp[j] ? 'bad' : (v ? 'one' : 'zero')}">${v}</td>`).join('') +
      row.exp.map((v, j) => `<td class="${j === 0 ? 'sep ' : ''}zero">${v}</td>`).join('') +
      `<td class="mark ${row.ok ? 'pass' : 'fail'}">${row.ok ? '✓' : '·'}</td></tr>`;
  });
  $('#truthTable').innerHTML = t;
  const pill = $('#passPill');
  pill.textContent = `${r.pass} / ${r.total}`;
  pill.classList.toggle('ok', r.all);

  const nands = countNands(c), tr = nands * NAND_TR;
  const minted = !!state.chips[L.key];
  $('#statNand').textContent = nands;
  $('#statTr').textContent = tr;
  $('#statAfter').textContent = minted ? '—' : state.wallet - tr;
  const tb = $('#tapeBtn');
  tb.disabled = minted || !r.all || tr > state.wallet;
  tb.textContent = minted ? 'Taped out ✓' : `Tape out · ${tr} TRN`;
  const note = $('#tapeNote');
  if (minted) note.innerHTML = `Minted as <b>${state.chips[L.key].tapeId}</b>. ${state.lesson < LESSONS.length - 1 ? 'Next lesson unlocked.' : 'The block clock is live below.'}`;
  else if (!r.all) note.textContent = 'Pass every row to unlock tape-out.';
  else if (tr > state.wallet) note.textContent = 'Not enough TRN. Claim a grant from the wallet.';
  else note.textContent = `Burns ${tr} transistor tokens and mints this circuit as an NFT.`;

  const st = $('#status');
  st.className = 'status';
  if (r.cycle) { st.textContent = 'Loop detected. These lessons are combinational, so wires cannot feed back into themselves.'; st.classList.add('err'); }
  else if (minted) { st.textContent = 'This circuit is on the wafer. It is now a reusable chip.'; st.classList.add('ok'); }
  else if (r.all) { st.textContent = 'Every row passes. Ready to tape out.'; st.classList.add('ok'); }
  else st.textContent = `${r.pass} of ${r.total} rows correct. Tap the inputs to test live.`;

  $('#walletBal').textContent = state.wallet;
}

function renderLessons(){
  const el = $('#lessonList');
  el.innerHTML = LESSONS.map((L, i) => {
    const unlocked = i === 0 || !!state.chips[LESSONS[i-1].key];
    const done = !!state.chips[L.key];
    return `<button class="lesson-item${i === state.lesson ? ' active' : ''}${done ? ' done' : ''}" data-lesson="${i}" ${unlocked ? '' : 'disabled'}>
      <span class="num">${done ? '✓' : i + 1}</span><span><span class="t">${L.name}</span><span class="s">${L.sub}</span></span></button>`;
  }).join('');
  const L = lesson();
  $('#lessonKicker').textContent = `Lesson ${state.lesson + 1} of ${LESSONS.length}`;
  $('#lessonTitle').textContent = L.name;
  $('#lessonGoal').textContent = L.goal;
  $('#hintText').textContent = L.hint;
  $('#hintText').hidden = !ui.hintOpen;
  $('#hintBtn').textContent = ui.hintOpen ? 'Hide hint' : 'Hint';

  // palette
  const avail = ['NAND', ...LESSONS.slice(0, state.lesson).map(l => l.key).filter(k => state.chips[k])];
  $('#palette').innerHTML = avail.map(k => {
    const t = typeInfo(k);
    return `<button class="part${t.chip ? ' chip-part' : ''}" data-add="${k}"><span class="plus">+</span>${esc(t.label)}<span class="cost">${t.nands * NAND_TR} TRN</span></button>`;
  }).join('');

  // hero path
  const steps = [['NAND', true], ...LESSONS.map(l => [l.name, !!state.chips[l.key]]), ['CPU', false]];
  $('#path').innerHTML = steps.map(([n, d], i) => (i ? '<span class="link"></span>' : '') +
    `<span class="node${d ? ' done' : ''}${n === 'CPU' ? ' cpu' : ''}">${n}</span>`).join('');
}

/* ---------------- gallery ---------------- */
function artSvg(chip){
  const n = chip.inputs.length, m = chip.outputs.length, rows = chip.table.length;
  const cols = n + m, cw = 240 / (cols + 1), rh = 100 / (rows + 1);
  let s = `<svg viewBox="0 0 240 120" preserveAspectRatio="none"><defs>
    <linearGradient id="ag${chip.key}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7cf8d0"/><stop offset=".5" stop-color="#6aa8ff"/><stop offset="1" stop-color="#b08bff"/></linearGradient>
    <filter id="af${chip.key}"><feGaussianBlur stdDeviation="2"/></filter></defs>
    <rect width="240" height="120" fill="#070910"/>`;
  combos(n).forEach((ins, r) => {
    const vals = [...ins, ...chip.table[r]];
    vals.forEach((v, c) => {
      const x = cw * (c + 0.5) + (c >= n ? cw * 0.5 : 0), y = 10 + rh * (r + 0.5);
      const w = cw * 0.72, hh = Math.max(4, rh * 0.62);
      if (v) s += `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="2" fill="url(#ag${chip.key})" filter="url(#af${chip.key})" opacity=".7"/>`;
      s += `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="2" fill="${v ? `url(#ag${chip.key})` : '#141a2a'}"/>`;
    });
  });
  return s + '</svg>';
}
function nftCard(chip){
  return `<div class="nft"><div class="nft-in">
    <div class="nft-art">${artSvg(chip)}</div>
    <div class="nft-top"><span>${chip.tapeId}</span><span>Circuit NFT</span></div>
    <h4>${esc(chip.name)}</h4>
    <dl>
      <dt>NAND gates</dt><dd>${chip.nands}</dd>
      <dt>Transistors burned</dt><dd>${chip.tr}</dd>
      <dt>Pins</dt><dd>${chip.inputs.length} in · ${chip.outputs.length} out</dd>
      <dt>Reused in</dt><dd>${chip.uses || 0} design${chip.uses === 1 ? '' : 's'}</dd>
    </dl>
    <div class="hash">truth table · ${chip.hash.slice(0, 16)}…<br>mint tx · ${chip.tx.slice(0, 16)}…<br>simulated · not onchain</div>
  </div></div>`;
}
function renderGallery(){
  const chips = LESSONS.map(l => state.chips[l.key]).filter(Boolean);
  $('#gallery').innerHTML = chips.length ? chips.map(nftCard).join('') :
    '<div class="empty">Nothing on the wafer yet. Tape out lesson 1 to mint your first circuit.</div>';
}

/* ---------------- block clock ---------------- */
let clockTimer = null, counter = 0, blockNo = 0;
function renderClock(){
  const fa = state.chips.FA;
  $('#clock').classList.toggle('locked', !fa);
  $('#clockLock').hidden = !!fa;
  const draw = () => {
    $('#bits').innerHTML = [3,2,1,0].map(i => `<div class="bit${(counter >> i) & 1 ? ' on' : ''}">${(counter >> i) & 1}</div>`).join('');
    $('#blockNo').textContent = blockNo.toLocaleString();
    $('#clockVal').textContent = counter;
  };
  draw();
  if (fa && !clockTimer) {
    clockTimer = setInterval(() => {
      // counter + 1 through four chained full adders (your taped-out truth table)
      let carry = 0, next = 0;
      for (let i = 0; i < 4; i++) {
        const a = (counter >> i) & 1, b = i === 0 ? 1 : 0;
        const [s, co] = state.chips.FA.table[(a << 2) | (b << 1) | carry];
        next |= s << i; carry = co;
      }
      counter = next; blockNo++;
      draw();
    }, 450);
  }
  if (!fa && clockTimer) { clearInterval(clockTimer); clockTimer = null; counter = 0; blockNo = 0; draw(); }
}

/* ---------------- actions ---------------- */
function setLesson(i){
  state.lesson = i; ui.sel = null; ui.pending = null; ui.hintOpen = false;
  ui.inVals = lesson().inputs.map(() => 0);
  save(); renderLessons(); render();
}
function addPart(type){
  const c = circuit();
  const n = c.nodes.filter(x => x.type !== 'IN' && x.type !== 'OUT').length;
  const d = dims({ type });
  c.seq = (c.seq || 0) + 1;
  const node = { id: 'p' + c.seq, type,
    x: ui.zoomed ? Math.round(Math.min(ui.view.x + ui.view.w - d.w - 20, ui.view.x + 90 + (n % 2) * 140)) : Math.min(VB.w - 90 - d.w, 120 + (n % 3) * 130),
    y: Math.min(VB.h - d.h - 40, 40 + (Math.floor(n / (ui.zoomed ? 2 : 3)) % 3) * 105 + (n % 2) * 14) };
  c.nodes.push(node); ui.sel = node.id;
  save(); render();
}
function removePart(id){
  const c = circuit();
  c.nodes = c.nodes.filter(n => n.id !== id);
  c.wires = c.wires.filter(w => w.from !== id && w.to !== id);
  ui.sel = null; save(); render();
}
function connect(from, fp, to, tp){
  const c = circuit();
  if (from === to) { toast('A part cannot wire into itself here.'); return; }
  c.wires = c.wires.filter(w => !(w.to === to && w.tp === tp));
  c.wires.push({ from, fp, to, tp });
  save();
}
function loadSolution(){
  const L = lesson(), c = { nodes: ioNodes(L), wires: [], seq: 0 };
  const map = {};
  for (const [id, type, x, y] of L.sol.parts) {
    if (!typeInfo(type)) { toast(`Tape out ${type} first.`); return; }
    c.seq++; const nid = 'p' + c.seq; map[id] = nid;
    c.nodes.push({ id:nid, type, x, y });
  }
  for (const [f, fp, t, tp] of L.sol.wires) c.wires.push({ from: map[f] || f, fp, to: map[t] || t, tp });
  state.circuits[L.key] = c; ui.sel = null; ui.pending = null;
  save(); render(); toast('Solution loaded. Tap the inputs to watch it work.');
}

/* hashing (display only) */
function fnv(str){ let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
function hex64(seed){ let out = '', s = seed; while (out.length < 64) { s = fnv(s + out.length); out += s; } return '0x' + out.slice(0, 64); }

function tapeOut(){
  const L = lesson(), c = circuit(), r = test(c);
  if (!r.all || state.chips[L.key]) return;
  const nands = countNands(c), tr = nands * NAND_TR;
  if (tr > state.wallet) return;
  const table = combos(L.inputs.length).map(ins => simulate(c, ins).outputs);
  state.mints++;
  const chip = { key:L.key, name:L.name, short: L.key === 'HA' || L.key === 'FA' ? L.key : L.name,
    inputs:L.inputs, outputs:L.outputs, table, nands, tr,
    tapeId: '#TA-' + String(state.mints).padStart(4, '0'),
    hash: hex64(JSON.stringify(table) + L.key), tx: hex64(Date.now() + L.key + Math.random()), uses:0, ts:Date.now() };
  // royalties-style reuse counter
  new Set(c.nodes.map(n => n.type)).forEach(t => { if (state.chips[t]) state.chips[t].uses = (state.chips[t].uses || 0) + 1; });
  state.wallet -= tr;
  state.chips[L.key] = chip;
  save();
  playTapeOut(chip);
}

function playTapeOut(chip){
  const modal = $('#modal');
  $('#burnStage').hidden = false; $('#mintStage').hidden = true; modal.hidden = false;
  const steps = ['Consuming transistor tokens…', `Routing ${chip.nands} NAND gate${chip.nands > 1 ? 's' : ''}…`, 'Minting circuit NFT…'];
  const dur = 1600, t0 = performance.now();
  const tick = now => {
    const p = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    $('#burnNum').textContent = Math.round(chip.tr * e);
    $('#burnBar').style.width = (e * 100) + '%';
    $('#burnStep').textContent = steps[Math.min(2, Math.floor(p * 3))];
    if (p < 1) requestAnimationFrame(tick);
    else setTimeout(() => {
      $('#burnStage').hidden = true; $('#mintStage').hidden = false;
      $('#mintCard').innerHTML = nftCard(chip);
      const w = $('.wallet'); w.classList.remove('bump'); void w.offsetWidth; w.classList.add('bump');
      renderAll();
    }, 250);
  };
  requestAnimationFrame(tick);
}

let toastT;
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400);
}

function renderAll(){ renderLessons(); render(); renderGallery(); renderClock(); }

/* ---------------- board events ---------------- */
function pt(e){
  const p = board.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
  const m = board.getScreenCTM(); if (!m) return { x:0, y:0 };
  const q = p.matrixTransform(m.inverse());
  return { x:q.x, y:q.y };
}
board.addEventListener('pointerdown', e => {
  const p = pt(e); ui.ptr = p;
  const pinEl = e.target.closest('[data-pin]');
  if (pinEl) {
    e.preventDefault();
    const dir = pinEl.dataset.pin, id = pinEl.dataset.id, k = +pinEl.dataset.k;
    const pend = ui.pending;
    if (pend && pend.id === id && pend.k === k && pend.dir === dir) { ui.pending = null; render(); return; }
    if (pend && pend.dir !== dir) {
      if (dir === 'in') connect(pend.id, pend.k, id, k); else connect(id, k, pend.id, pend.k);
      ui.pending = null; render(); return;
    }
    if (dir === 'in' && !pend) {
      const c = circuit(); const had = c.wires.length;
      c.wires = c.wires.filter(w => !(w.to === id && w.tp === k));
      if (c.wires.length !== had) { save(); render(); toast('Wire removed'); return; }
    }
    ui.pending = { id, k, dir }; render(); return;
  }
  const wireEl = e.target.closest('[data-wire]');
  if (wireEl) { const c = circuit(); c.wires.splice(+wireEl.dataset.wire, 1); save(); render(); toast('Wire removed'); return; }
  const nodeEl = e.target.closest('[data-node]');
  if (nodeEl) {
    const n = byId(circuit())[nodeEl.dataset.node];
    ui.drag = { id:n.id, ox:p.x - n.x, oy:p.y - n.y, sx:p.x, sy:p.y, moved:false };
    try { board.setPointerCapture(e.pointerId); } catch {}
    return;
  }
  ui.pan = { sx:e.clientX, vx:ui.view.x, moved:false };
  try { board.setPointerCapture(e.pointerId); } catch {}
});
board.addEventListener('pointermove', e => {
  const p = pt(e); ui.ptr = p;
  if (ui.drag) {
    const dg = ui.drag;
    if (!dg.moved && Math.hypot(p.x - dg.sx, p.y - dg.sy) > 4) dg.moved = true;
    if (dg.moved) {
      const n = byId(circuit())[dg.id], d = dims(n);
      n.x = Math.round(Math.max(0, Math.min(VB.w - d.w, p.x - dg.ox)));
      n.y = Math.round(Math.max(0, Math.min(VB.h - d.h, p.y - dg.oy)));
      render();
    }
    return;
  }
  if (ui.pan) {
    const dx = e.clientX - ui.pan.sx;
    if (!ui.pan.moved && Math.abs(dx) > 4) ui.pan.moved = true;
    if (ui.pan.moved && ui.zoomed) {
      const scale = ui.view.w / board.getBoundingClientRect().width;
      ui.view.x = Math.round(Math.max(0, Math.min(VB.w - ui.view.w, ui.pan.vx - dx * scale)));
      board.setAttribute('viewBox', `${ui.view.x} 0 ${ui.view.w} ${VB.h}`);
    }
    return;
  }
  if (ui.pending) {
    const pv = document.getElementById('preview');
    const n = byId(circuit())[ui.pending.id];
    if (pv && n) { const a = ui.pending.dir === 'out' ? outPin(n, ui.pending.k) : inPin(n, ui.pending.k); pv.setAttribute('d', ui.pending.dir === 'out' ? wirePath(a, p) : wirePath(p, a)); }
  }
  placePtr();
});
const endDrag = () => {
  if (ui.pan) { const moved = ui.pan.moved; ui.pan = null; if (!moved) { ui.sel = null; ui.pending = null; } render(); return; }
  const dg = ui.drag; if (!dg) return; ui.drag = null;
  const n = byId(circuit())[dg.id];
  if (!dg.moved && n) {
    if (n.type === 'IN') { ui.inVals[n.idx] = ui.inVals[n.idx] ? 0 : 1; }
    else if (n.type !== 'OUT') { ui.sel = ui.sel === n.id ? null : n.id; }
  }
  save(); render();
};
board.addEventListener('pointerup', endDrag);
board.addEventListener('pointercancel', endDrag);
board.addEventListener('pointerleave', () => { if (!ui.drag) { ui.ptr = { x:-999, y:-999 }; placePtr(); } });

document.addEventListener('keydown', e => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && ui.sel && document.activeElement === document.body) {
    const n = byId(circuit())[ui.sel]; if (n && n.type !== 'IN' && n.type !== 'OUT') removePart(ui.sel);
  }
  if (e.key === 'Escape') { ui.pending = null; ui.sel = null; render(); }
});

/* ---------------- zoom (small screens) ---------------- */
const zoomBtn = document.createElement('button');
zoomBtn.className = 'zoom-btn'; document.querySelector('.board-wrap').appendChild(zoomBtn);
function setZoom(z){
  ui.zoomed = z;
  ui.view = z ? { x: Math.max(0, Math.min(VB.w - MOBILE_W, ui.view.x)), w: MOBILE_W } : { x:0, w:VB.w };
  document.querySelector('.board-wrap').classList.toggle('zoomed', z);
  render();
}
zoomBtn.addEventListener('click', () => setZoom(!ui.zoomed));

/* ---------------- UI events ---------------- */
$('#lessonList').addEventListener('click', e => { const b = e.target.closest('[data-lesson]'); if (b && !b.disabled) setLesson(+b.dataset.lesson); });
$('#palette').addEventListener('click', e => { const b = e.target.closest('[data-add]'); if (b) addPart(b.dataset.add); });
$('#delBtn').addEventListener('click', () => ui.sel && removePart(ui.sel));
$('#hintBtn').addEventListener('click', () => { ui.hintOpen = !ui.hintOpen; renderLessons(); });
$('#solveBtn').addEventListener('click', loadSolution);
$('#clearBtn').addEventListener('click', () => { const L = lesson(); state.circuits[L.key] = { nodes: ioNodes(L), wires: [], seq: 0 }; ui.sel = null; ui.pending = null; save(); render(); });
$('#tapeBtn').addEventListener('click', tapeOut);
$('#grantBtn').addEventListener('click', () => { state.wallet += GRANT; save(); renderPanels(); const w = $('.wallet'); w.classList.remove('bump'); void w.offsetWidth; w.classList.add('bump'); toast(`Student grant: +${GRANT} TRN (simulated)`); });
$('#modalClose').addEventListener('click', () => {
  $('#modal').hidden = true;
  if (state.lesson < LESSONS.length - 1 && state.chips[lesson().key]) setLesson(state.lesson + 1);
  else document.getElementById('clock').scrollIntoView({ behavior:'smooth', block:'center' });
});
(() => {
  const foot = document.querySelector('.foot');
  const b = document.createElement('button'); b.className = 'ghost sm'; b.textContent = 'Reset progress';
  b.addEventListener('click', () => { if (clockTimer) { clearInterval(clockTimer); clockTimer = null; } counter = 0; blockNo = 0; state = fresh(); save(); setLesson(0); renderAll(); window.scrollTo({ top:0, behavior:'smooth' }); toast('Progress reset'); });
  foot.appendChild(b);
})();

/* ---------------- interactive dot field ---------------- */
(() => {
  const cv = document.getElementById('dots'); const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GAP = 26, R = 170;
  let W, H, dpr, dots = [], mx = -9999, my = -9999, tx = -9999, ty = -9999;
  const sparks = [];
  function resize(){
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dots = [];
    for (let y = GAP / 2; y < H + GAP; y += GAP) for (let x = GAP / 2; x < W + GAP; x += GAP) dots.push(x, y);
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  function color(x){ // mint -> blue -> violet across the screen
    const t = x / W;
    const A = [124,248,208], B = [106,168,255], C = [176,139,255];
    const [p, q, u] = t < .5 ? [A, B, t * 2] : [B, C, (t - .5) * 2];
    return [lerp(p[0], q[0], u) | 0, lerp(p[1], q[1], u) | 0, lerp(p[2], q[2], u) | 0];
  }
  function frame(){
    mx = lerp(mx, tx, .14); my = lerp(my, ty, .14);
    ctx.clearRect(0, 0, W, H);
    if (Math.random() < .08 && sparks.length < 14) { const i = (Math.random() * dots.length / 2 | 0) * 2; sparks.push({ i, life: 1 }); }
    for (let i = 0; i < dots.length; i += 2) {
      let x = dots[i], y = dots[i + 1];
      const dx = x - mx, dy = y - my, d = Math.hypot(dx, dy);
      let a = .1, r = .9;
      if (d < R) {
        const f = 1 - d / R, ff = f * f;
        x += dx / (d || 1) * ff * 10; y += dy / (d || 1) * ff * 10;
        a = .1 + ff * .85; r = .9 + ff * 1.4;
        const [cr, cg, cb] = color(x);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${a})`;
        if (ff > .25) { ctx.shadowColor = `rgba(${cr},${cg},${cb},.9)`; ctx.shadowBlur = 10 * ff; } else ctx.shadowBlur = 0;
      } else { ctx.shadowBlur = 0; ctx.fillStyle = `rgba(143,163,200,${a})`; }
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
    }
    ctx.shadowBlur = 0;
    for (let s = sparks.length - 1; s >= 0; s--) {
      const sp = sparks[s]; sp.life -= .012;
      if (sp.life <= 0) { sparks.splice(s, 1); continue; }
      const x = dots[sp.i], y = dots[sp.i + 1], a = Math.sin(sp.life * Math.PI);
      const [cr, cg, cb] = color(x);
      ctx.shadowColor = `rgba(${cr},${cg},${cb},1)`; ctx.shadowBlur = 12;
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${a * .9})`;
      ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 6.283); ctx.fill();
    }
    ctx.shadowBlur = 0;
    if (!reduce) requestAnimationFrame(frame);
  }
  addEventListener('resize', resize);
  addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; if (mx < -1000) { mx = tx; my = ty; } }, { passive:true });
  document.addEventListener('pointerleave', () => { tx = ty = -9999; });
  resize(); frame();
})();

/* ---------------- boot ---------------- */
ui.inVals = lesson().inputs.map(() => 0);
ui.zoomed = board.getBoundingClientRect().width < 560;
if (ui.zoomed) { ui.view = { x:0, w:MOBILE_W }; document.querySelector('.board-wrap').classList.add('zoomed'); }
renderAll();
window.__toa = { state: () => state, setLesson, loadSolution, tapeOut, test: () => test(circuit()) };
})();
