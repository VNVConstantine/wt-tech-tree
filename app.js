const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const FALLBACK_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 225'>
    <defs><linearGradient id='g' x1='0' x2='1'>
      <stop stop-color='#0b0e14'/><stop offset='1' stop-color='#121826'/>
    </linearGradient></defs>
    <rect fill='url(#g)' width='100%' height='100%'/>
    <g fill='#2a3a5e' font-family='system-ui,Segoe UI,Roboto' text-anchor='middle'>
      <text x='200' y='115' font-size='20'>No thumbnail</text>
      <text x='200' y='145' font-size='13'>War Thunder Wiki</text>
    </g>
  </svg>
`)}`;

let VEHICLES=[], NATIONS=[], CLASSES=[];
const BR_ORDER = ["1.0","1.3","1.7","2.0","2.3","2.7","3.0","3.3","3.7","4.0","4.3","4.7","5.0","5.3","5.7","6.0","6.3","6.7","7.0","7.3","7.7","8.0","8.3","8.7","9.0","9.3","9.7","10.0","10.3","10.7","11.0","11.3","11.7","12.0"];
const RANK_NUM = { "I":1, "II":2, "III":3, "IV":4, "V":5, "VI":6, "VII":7 };

function parseEmbedded(id){ return JSON.parse(document.getElementById(id).textContent); }

async function loadData(){
  VEHICLES = parseEmbedded('data-vehicles');
  NATIONS  = parseEmbedded('data-nations');
  CLASSES  = parseEmbedded('data-classes');

  buildFilters();

  // Auto-select USA so content shows immediately
  const usaChip = $$('#nation-filters .chip input').find(i=>i.value==='usa');
  if (usaChip && !usaChip.checked) { usaChip.checked = true; usaChip.parentElement.classList.add('active'); }

  wireUI();
  render(); // initial paint
}

function buildFilters(){
  // Nations as chips
  const nf = $('#nation-filters');
  nf.innerHTML = '';
  NATIONS.forEach(n=>{
    const chip = document.createElement('label');
    chip.className = 'chip';
    chip.innerHTML = `<input type="checkbox" value="${n.id}"><span>${n.name}</span>`;
    chip.addEventListener('click', ()=>{ chip.classList.toggle('active'); render(); });
    nf.appendChild(chip);
  });

  // Classes dropdown
  const sel = $('#class-filter');
  sel.innerHTML = '<option value="">All</option>' + CLASSES.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  sel.addEventListener('change', render);

  // BR chips (only BRs present in data)
  const brWrap = $('#br-filters'); brWrap.innerHTML='';
  const brs = Array.from(new Set(VEHICLES.map(v=>v.br))).sort((a,b)=>BR_ORDER.indexOf(a)-BR_ORDER.indexOf(b));
  brs.forEach(br=>{
    const chip = document.createElement('label');
    chip.className = 'chip';
    chip.innerHTML = `<input type="checkbox" value="${br}"><span>${br}</span>`;
    chip.addEventListener('click', ()=>{ chip.classList.toggle('active'); render(); });
    brWrap.appendChild(chip);
  });

  // Search
  $('#search').addEventListener('input', debounce(render, 180));
}

function selectedValues(containerSel){ return $$(containerSel+' .chip input:checked').map(i=>i.value); }

function getFiltered(){
  const selNations = selectedValues('#nation-filters');
  const selBRs = selectedValues('#br-filters');
  const cls = $('#class-filter').value;
  const q = ($('#search').value||'').trim().toLowerCase();

  let list = VEHICLES.slice();
  if (selNations.length) list = list.filter(v=>selNations.includes(v.nation));
  if (cls) list = list.filter(v=>v.class === cls);
  if (selBRs.length) list = list.filter(v=>selBRs.includes(v.br));
  if (q) list = list.filter(v=>[v.name,v.rank,v.notes].join(' ').toLowerCase().includes(q));
  return list;
}

function render(){
  const list = getFiltered();
  renderList(list);
  renderTech(list);
  // Sidebar quick rank filter
  renderSidebar(list);
}

function renderList(list){
  const cards = $('#cards'); cards.innerHTML='';
  list.forEach(v=> cards.appendChild(card(v)));
  $('#empty').classList.toggle('hidden', list.length>0);
}

function card(v){
  const tpl = document.getElementById('card-tpl');
  const node = tpl.content.firstElementChild.cloneNode(true);
  const img = node.querySelector('.thumb');
  img.src = v.image || FALLBACK_SVG;
  img.onerror = () => img.src = FALLBACK_SVG;
  img.alt = v.name;
  node.querySelector('.name').textContent = v.name;
  node.querySelector('.tag-class').textContent = prettyClass(v.class);
  node.querySelector('.tag-br').textContent = `BR ${v.br}`;
  node.querySelector('.nation').textContent = prettyNation(v.nation);
  node.querySelector('.rank').textContent = v.rank;
  node.querySelector('.notes').textContent = v.notes || '';
  return node;
}

function renderSidebar(list){
  const tree = $('#tree');
  const byRank = groupBy(list, x=>x.rank);
  tree.innerHTML = '<h3>Ranks</h3>' + Object.keys(byRank).sort((a,b)=>(RANK_NUM[a]||0)-(RANK_NUM[b]||0)).map(r=>{
    const count = byRank[r].length;
    return `<div class="node" data-rank="${r}">${r} <span style="color:var(--muted)">(${count})</span></div>`;
  }).join('');
  tree.querySelectorAll('.node').forEach(n=>{
    n.addEventListener('click', ()=>{ $('#search').value = n.dataset.rank; render(); });
  });
}

/* ---------- Tech-tree render ---------- */

function renderTech(list){
  const grid = $('#rankGrid'); const svg = $('#wires');
  grid.innerHTML=''; svg.innerHTML='';

  // Build 7 columns (I–VII)
  const cols = [];
  for(let i=1;i<=7;i++){
    const col = document.createElement('div');
    col.className = 'rank-col';
    const roman = Object.keys(RANK_NUM).find(k=>RANK_NUM[k]===i) || String(i);
    col.innerHTML = `<h4>Rank ${roman}</h4>`;
    grid.appendChild(col);
    cols[i]=col;
  }

  // Group by rank number; within rank sort by class then BR then name
  const listWithRank = list.map(v=>({ ...v, _rankNum: RANK_NUM[v.rank] || 0 }));
  const byRank = groupBy(listWithRank, v=>v._rankNum);
  Object.keys(byRank).forEach(key=>{
    const r = Number(key); if (!cols[r]) return;
    const col = cols[r];
    const items = byRank[key].slice().sort((a,b)=>{
      if (a.class !== b.class) return a.class.localeCompare(b.class);
      if (a.br !== b.br) return (BR_ORDER.indexOf(a.br) - BR_ORDER.indexOf(b.br));
      return a.name.localeCompare(b.name);
    });
    items.forEach(v=> col.appendChild(nodeMini(v)));
  });

  // After DOM paints, draw connectors
  requestAnimationFrame(()=> drawConnectors(svg, grid, listWithRank));
}

function nodeMini(v){
  const tpl = $('#node-tpl');
  const el = tpl.content.firstElementChild.cloneNode(true);
  const img = el.querySelector('img');
  img.src = v.image || FALLBACK_SVG;
  img.onerror = ()=> img.src = FALLBACK_SVG;
  img.alt = v.name;
  el.dataset.id = v.id;
  el.dataset.rank = v.rank;
  el.dataset.class = v.class;
  el.dataset.nation = v.nation;
  el.querySelector('.nm-name').textContent = v.name;
  el.querySelector('.nm-class').textContent = prettyClass(v.class);
  el.querySelector('.nm-br').textContent = `BR ${v.br}`;
  return el;
}

function drawConnectors(svg, grid, list){
  // Link within SAME nation + class, sorted by rank then BR (simple “progression” chain)
  const series = groupBy(list, v=>`${v.nation}__${v.class}`);
  const toLink = [];
  Object.values(series).forEach(arr=>{
    const s = arr.slice().sort((a,b)=>{
      if ((a._rankNum||0) !== (b._rankNum||0)) return (a._rankNum||0)-(b._rankNum||0);
      return BR_ORDER.indexOf(a.br) - BR_ORDER.indexOf(b.br);
    });
    for (let i=0;i<s.length-1;i++){
      toLink.push([s[i].id, s[i+1].id]);
    }
  });

  // Build an index of DOM nodes
  const idx = {};
  $$('#rankGrid .node-mini').forEach(n=> idx[n.dataset.id]=n);

  // SVG sizing
  const gRect = grid.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${gRect.width} ${gRect.height}`);
  svg.setAttribute('width', gRect.width);
  svg.setAttribute('height', gRect.height);

  // Draw wires
  toLink.forEach(([a,b])=>{
    const A = idx[a], B = idx[b];
    if (!A || !B) return;
    const ar = A.getBoundingClientRect(), br = B.getBoundingClientRect();

    const x1 = (ar.left + ar.right)/2 - gRect.left;
    const y1 = (ar.top + ar.bottom)/2 - gRect.top;
    const x2 = (br.left + br.right)/2 - gRect.left;
    const y2 = (br.top + br.bottom)/2 - gRect.top;

    // Smooth cubic curve
    const dx = (x2 - x1) * 0.4;
    const d = `M ${x1} ${y1} C ${x1+dx} ${y1}, ${x2-dx} ${y2}, ${x2} ${y2}`;
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d', d);
    path.setAttribute('class','wire');
    svg.appendChild(path);
  });
}

/* ---------- Utilities & UI ---------- */

function prettyNation(id){ const n=NATIONS.find(n=>n.id===id); return n? n.name : id; }
function prettyClass(id){ const c=CLASSES.find(c=>c.id===id); return c? c.name : id; }
function groupBy(arr, f){ return arr.reduce((acc,x)=>{ const k=f(x); (acc[k] ||= []).push(x); return acc; },{}); }
function debounce(fn, ms){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,args),ms); }; }

function wireUI(){
  const listBtn = $('#viewList'), treeBtn = $('#viewTree');
  listBtn.addEventListener('click', ()=>{
    listBtn.classList.add('active'); treeBtn.classList.remove('active');
    $('#list').classList.remove('hidden'); $('#tech').classList.add('hidden');
    // no need to redraw connectors here
  });
  treeBtn.addEventListener('click', ()=>{
    treeBtn.classList.add('active'); listBtn.classList.remove('active');
    $('#tech').classList.remove('hidden'); $('#list').classList.add('hidden');
    // redraw connectors in case layout changed
    renderTech(getFiltered());
  });
  // Keep connectors accurate on resize
  window.addEventListener('resize', debounce(()=> {
    if (!$('#tech').classList.contains('hidden')) renderTech(getFiltered());
  }, 150));
}

loadData();
