const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const FALLBACK_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 225'>
    <defs>
      <linearGradient id='g' x1='0' x2='1'>
        <stop stop-color='#0b0e14'/>
        <stop offset='1' stop-color='#121826'/>
      </linearGradient>
    </defs>
    <rect fill='url(#g)' width='100%' height='100%'/>
    <g fill='#2a3a5e' font-family='system-ui,Segoe UI,Roboto' text-anchor='middle'>
      <text x='200' y='115' font-size='20'>No thumbnail</text>
      <text x='200' y='145' font-size='13'>War Thunder Wiki</text>
    </g>
  </svg>
`)}`;

// War Thunder wiki thumbnails (we’ll keep adding here)
const IMAGE_OVERRIDES = {
  // USA ground
  "m4a1": "https://old-wiki.warthunder.com/images/thumb/a/a6/GarageImage_M4A1.jpg/800px-GarageImage_M4A1.jpg",
  "m26": "https://old-wiki.warthunder.com/images/thumb/4/43/GarageImage_M26.jpg/800px-GarageImage_M26.jpg",
  "m1_abrams": "https://old-wiki.warthunder.com/images/thumb/d/da/GarageImage_M1_Abrams.jpg/800px-GarageImage_M1_Abrams.jpg",
  "m36_gmc": "https://old-wiki.warthunder.com/images/thumb/3/32/GarageImage_M36_GMC.jpg/800px-GarageImage_M36_GMC.jpg",
  "m18_premium": "https://old-wiki.warthunder.com/images/thumb/a/a5/GarageImage_M18_GMC.jpg/800px-GarageImage_M18_GMC.jpg",
  "m42_duster": "https://old-wiki.warthunder.com/images/thumb/3/31/GarageImage_M42.jpg/800px-GarageImage_M42.jpg",

  // USA air
  "f86f2": "https://old-wiki.warthunder.com/images/thumb/0/0f/GarageImage_F-86F-2.jpg/800px-GarageImage_F-86F-2.jpg",
  "a2d1": "https://old-wiki.warthunder.com/images/thumb/7/74/GarageImage_A2D-1.jpg/800px-GarageImage_A2D-1.jpg",

  // TODO: add these two next (I’ll send you the URLs)
  "xm8_ags": "",
  "m1128_wolfpack": ""
};

let VEHICLES = [];
let NATIONS = [];
let CLASSES = [];
const BR_ORDER = ["1.0","1.3","1.7","2.0","2.3","2.7","3.0","3.3","3.7","4.0","4.3","4.7","5.0","5.3","5.7","6.0","6.3","6.7","7.0","7.3","7.7","8.0","8.3","8.7","9.0","9.3","9.7","10.0","10.3","10.7","11.0","11.3","11.7","12.0"];

async function loadData(){
  const vEl = document.getElementById('data-vehicles');
  const nEl = document.getElementById('data-nations');
  const cEl = document.getElementById('data-classes');
  VEHICLES = JSON.parse(vEl.textContent);
  NATIONS  = JSON.parse(nEl.textContent);
  CLASSES  = JSON.parse(cEl.textContent);

  // Apply image overrides
  VEHICLES.forEach(v => {
    if (IMAGE_OVERRIDES[v.id]) v.image = IMAGE_OVERRIDES[v.id];
  });

  buildFilters();
  // Auto-select USA so content shows immediately
  const usaChip = Array.from(document.querySelectorAll('#nation-filters .chip input')).find(i=>i.value==='usa');
  if (usaChip && !usaChip.checked) { usaChip.checked = true; usaChip.parentElement.classList.add('active'); }
  render();
}

function buildFilters(){
  // Nations (chips with multi-select)
  const nf = $('#nation-filters');
  nf.innerHTML = '';
  NATIONS.forEach(n=>{
    const chip = document.createElement('label');
    chip.className = 'chip';
    chip.innerHTML = `<input type="checkbox" value="${n.id}"><span>${n.name}</span>`;
    chip.addEventListener('click', e=>{
      chip.classList.toggle('active');
      render();
    });
    nf.appendChild(chip);
  });

  // Classes
  const sel = $('#class-filter');
  sel.innerHTML = '<option value="">All</option>' + CLASSES.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  sel.addEventListener('change', render);

  // BR chips
  const brWrap = $('#br-filters');
  brWrap.innerHTML = '';
  const brs = Array.from(new Set(VEHICLES.map(v=>v.br))).sort((a,b)=>BR_ORDER.indexOf(a)-BR_ORDER.indexOf(b));
  brs.forEach(br=>{
    const chip = document.createElement('label');
    chip.className = 'chip';
    chip.innerHTML = `<input type="checkbox" value="${br}"><span>${br}</span>`;
    chip.addEventListener('click', ()=>{
      chip.classList.toggle('active');
      render();
    });
    brWrap.appendChild(chip);
  });

  // Search
  $('#search').addEventListener('input', debounce(render, 180));
}

function selectedValues(containerSel){
  return $$(containerSel+' .chip input:checked').map(i=>i.value);
}

function render(){
  const selNations = selectedValues('#nation-filters');
  const selBRs = selectedValues('#br-filters');
  const cls = $('#class-filter').value;
  const q = ($('#search').value||'').trim().toLowerCase();

  let list = VEHICLES.slice();

  if (selNations.length) list = list.filter(v=>selNations.includes(v.nation));
  if (cls) list = list.filter(v=>v.class === cls);
  if (selBRs.length) list = list.filter(v=>selBRs.includes(v.br));
  if (q) list = list.filter(v=>[v.name,v.rank,v.notes].join(' ').toLowerCase().includes(q));

  const cards = $('#cards');
  cards.innerHTML = '';
  list.forEach(v=> cards.appendChild(card(v)));
  $('#empty').classList.toggle('hidden', list.length>0);

  // Simple rank list (acts like quick filter)
  const tree = $('#tree');
  const byRank = groupBy(list, x=>x.rank);
  tree.innerHTML = '<h3>Ranks</h3>' + Object.keys(byRank).sort().map(r=>{
    const count = byRank[r].length;
    return `<div class="node" data-rank="${r}">${r} <span style="color:var(--muted)">(${count})</span></div>`;
  }).join('');
  tree.querySelectorAll('.node').forEach(n=>{
    n.addEventListener('click', ()=>{
      $('#search').value = n.dataset.rank;
      render();
    });
  });
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

function prettyNation(id){
  const n = NATIONS.find(n=>n.id===id);
  return n? n.name : id;
}
function prettyClass(id){
  const c = CLASSES.find(c=>c.id===id);
  return c? c.name : id;
}
function groupBy(arr, f){
  return arr.reduce((acc, x)=>{
    const k = f(x); (acc[k] ||= []).push(x); return acc;
  }, {});
}
function debounce(fn, ms){
  let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,args), ms); };
}

loadData();
