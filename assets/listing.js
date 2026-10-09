// Client-side catalog browsing: instant fuzzy search, facets, sort, pagination; state lives in the URL.
import { CONFIG } from './config.js';
import { loadCatalog, getSearch } from './catalog.js';
import { money } from './cart-store.js';

const root = document.getElementById('listing'); if (!root) throw new Error('no listing');
const preset = JSON.parse(root.dataset.preset || '{}');
const PAGE = CONFIG.catalog.pageSize || 24;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PRICE_BANDS = [[0, 10], [10, 20], [20, 30], [30, 50], [50, 100], [100, 1e9]];
const bandLabel = ([a, b]) => (b >= 1e9 ? `$${a}+` : a === 0 ? `Under $${b}` : `$${a} – $${b}`);
const SIZE_ORDER = ['50ML', '100ML', '187ML', '200ML', '375ML', '500ML', '700ML', '750ML', '1L', '1.5L', '1.75L', '3L', '5L'];

function readState() {
  const u = new URLSearchParams(location.search); const all = (k) => u.getAll(k).flatMap((v) => v.split('|')).filter(Boolean);
  return { q: u.get('q') || '', top: preset.top || u.get('top') || '', sub: preset.sub ? [preset.sub] : all('sub'), brand: all('brand'), size: all('size'), style: all('style'),
    band: all('price'), pmin: u.get('pmin') || '', pmax: u.get('pmax') || '', stock: u.get('stock') === '1', staff: u.get('staff') === '1', best: u.get('best') === '1',
    sort: u.get('sort') || 'featured', page: Math.max(1, parseInt(u.get('page') || '1', 10)) };
}
function writeState(s, push = true) {
  const u = new URLSearchParams();
  if (s.q) u.set('q', s.q); if (!preset.top && s.top) u.set('top', s.top); if (!preset.sub) s.sub.forEach((v) => u.append('sub', v));
  s.brand.forEach((v) => u.append('brand', v)); s.size.forEach((v) => u.append('size', v)); s.style.forEach((v) => u.append('style', v)); s.band.forEach((v) => u.append('price', v));
  if (s.pmin) u.set('pmin', s.pmin); if (s.pmax) u.set('pmax', s.pmax); if (s.stock) u.set('stock', '1'); if (s.staff) u.set('staff', '1'); if (s.best) u.set('best', '1');
  if (s.sort !== 'featured') u.set('sort', s.sort); if (s.page > 1) u.set('page', String(s.page));
  const url = location.pathname + (u.toString() ? '?' + u : '');
  history[push ? 'pushState' : 'replaceState'](null, '', url);
}
const sizeLine = (p) => [p.size, p.pack ? `${p.pack}-pack` : ''].filter(Boolean).join(' · ');
function card(p) {
  const oos = CONFIG.catalog.outOfStock;
  const btn = p.inStock || oos.allowRequest ? `<button class="add${p.inStock ? '' : ' req'}" data-add="${p.sku}" type="button" aria-label="${p.inStock ? 'Add' : 'Request'} ${esc(p.name)} to cart">${p.inStock ? 'Add' : 'Request'}</button>` : '';
  return `<article class="card"><div class="flags">${p.staff ? '<span class="badge staff">Staff pick</span>' : ''}${p.best ? '<span class="badge best">Best seller</span>' : ''}</div><a class="media" href="/convenience-liquors-preview/p/${p.slug}/" tabindex="-1" aria-hidden="true"><img src="${p.img ? p.img.src : `/convenience-liquors-preview/img/p/${p.sku}.svg`}" alt="${esc(p.name)}" loading="lazy" decoding="async" width="200" height="300"></a><div class="body"><div class="brand">${esc(p.brand)}</div><a class="name" href="/convenience-liquors-preview/p/${p.slug}/">${esc(p.name)}</a><div class="meta-row"><span class="size">${esc(sizeLine(p))}</span>${p.inStock ? '<span class="badge in">In stock</span>' : '<span class="badge out">Out of stock</span>'}</div><div class="row"><span class="price">${money(p.price)}</span>${btn}</div></div></article>`;
}

let DATA, SEARCH, state = readState();
const facetsEl = document.getElementById('facets'), grid = document.getElementById('grid'), pager = document.getElementById('pager'), countEl = document.getElementById('result-count'), activeEl = document.getElementById('active-filters'), sortEl = document.getElementById('sort');
const brandShowAll = { v: false }; let brandFilter = '';

function matches(p, s, skip) {
  if (s.top && p.top !== s.top) return false;
  if (skip !== 'sub' && s.sub.length && !s.sub.includes(p.sub)) return false;
  if (skip !== 'brand' && s.brand.length && !s.brand.includes(p.brand)) return false;
  if (skip !== 'size' && s.size.length && !s.size.includes(p.size || (p.pack ? p.pack + '-pack' : ''))) return false;
  if (skip !== 'style' && s.style.length && !s.style.includes(p.style)) return false;
  if (skip !== 'price') {
    if (s.band.length && !s.band.some((b) => { const [a, z] = b.split('-').map(Number); return p.price >= a && p.price < z; })) return false;
    if (s.pmin && p.price < Number(s.pmin)) return false; if (s.pmax && p.price > Number(s.pmax)) return false;
  }
  if (skip !== 'stock' && s.stock && !p.inStock) return false;
  if (s.staff && !p.staff) return false; if (s.best && !p.best) return false;
  return true;
}
function sorter(s, rel) {
  const oosLast = CONFIG.catalog.outOfStock.sortLast;
  const base = { 'price-asc': (a, b) => a.price - b.price, 'price-desc': (a, b) => b.price - a.price, 'name-asc': (a, b) => a.name.localeCompare(b.name), 'name-desc': (a, b) => b.name.localeCompare(a.name),
    featured: rel ? (a, b) => (rel.get(b.sku) || 0) - (rel.get(a.sku) || 0) : (a, b) => ((b.staff ? 2 : 0) + (b.best ? 1 : 0)) - ((a.staff ? 2 : 0) + (a.best ? 1 : 0)) || b.sold - a.sold || a.name.localeCompare(b.name) }[s.sort] || ((a, b) => 0);
  return (a, b) => (oosLast ? b.inStock - a.inStock : 0) || base(a, b);
}
function facetCounts(list, key) { const m = new Map(); for (const p of list) { const k = key(p); if (k) m.set(k, (m.get(k) || 0) + 1); } return m; }
function checkboxList(name, entries, selected, labelFn = (x) => x) {
  return entries.map(([v, n]) => `<li><label><input type="checkbox" name="${name}" value="${esc(v)}" ${selected.includes(v) ? 'checked' : ''}> ${esc(labelFn(v))}</label></li>`).join('');
}
function render() {
  const s = state;
  let base = DATA.items, rel = null;
  if (s.q) { const r = SEARCH(s.q); rel = new Map(r.map((x) => [x.p.sku, x.score])); base = r.map((x) => x.p); }
  const results = base.filter((p) => matches(p, s)).sort(sorter(s, rel));
  // facets (each computed ignoring its own selection)
  const fSub = facetCounts(base.filter((p) => matches(p, s, 'sub')), (p) => p.sub);
  const fBrand = facetCounts(base.filter((p) => matches(p, s, 'brand')), (p) => p.brand);
  const fSize = facetCounts(base.filter((p) => matches(p, s, 'size')), (p) => p.size || (p.pack ? p.pack + '-pack' : ''));
  const fStyle = facetCounts(base.filter((p) => matches(p, s, 'style')), (p) => p.style);
  const fPriceList = base.filter((p) => matches(p, s, 'price'));
  const fStock = base.filter((p) => matches(p, s, 'stock')).filter((p) => p.inStock).length;
  const subOrder = s.top ? DATA.tax[s.top].subs : Object.values(DATA.tax).flatMap((t) => t.subs);
  const subs = [...fSub].sort((a, b) => subOrder.indexOf(a[0]) - subOrder.indexOf(b[0]));
  let brands = [...fBrand].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (brandFilter) brands = brands.filter(([b]) => b.toLowerCase().includes(brandFilter.toLowerCase()));
  const selB = brands.filter(([b]) => s.brand.includes(b)); const shownBrands = brandShowAll.v ? brands : [...selB, ...brands.filter(([b]) => !s.brand.includes(b)).slice(0, 12)];
  const sizes = [...fSize].sort((a, b) => { const ia = SIZE_ORDER.indexOf(a[0]), ib = SIZE_ORDER.indexOf(b[0]); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || b[1] - a[1]; }).slice(0, 24);
  const bands = PRICE_BANDS.map((b) => [b.join('-'), fPriceList.filter((p) => p.price >= b[0] && p.price < b[1]).length]).filter(([, n]) => n);
  const ae = document.activeElement; const focusSel = ae && ae.closest('#facets') ? (ae.name ? `[name="${ae.name}"][value="${CSS.escape(ae.value)}"]` : ae.id ? '#' + ae.id : null) : null;
  facetsEl.innerHTML = `
    ${CONFIG.catalog.outOfStock.mode === 'hide' ? '' : `<div class="facet"><label style="font-weight:600;padding:0"><input type="checkbox" name="stock" ${s.stock ? 'checked' : ''}> In stock only</label></div>`}
    ${!preset.sub && subs.length ? `<div class="facet"><h3>Category</h3><ul>${checkboxList('sub', subs, s.sub)}</ul></div>` : ''}
    ${fStyle.size ? `<div class="facet"><h3>Whiskey style</h3><ul>${checkboxList('style', [...fStyle].sort((a, b) => b[1] - a[1]), s.style)}</ul></div>` : ''}
    <div class="facet"><h3>Brand</h3><input type="search" id="brand-filter" placeholder="Find a brand" value="${esc(brandFilter)}" aria-label="Filter brands"><ul>${checkboxList('brand', shownBrands, s.brand)}</ul>${brands.length > 12 ? `<button class="more" type="button" id="brand-more">${brandShowAll.v ? 'Show fewer' : 'Show all brands'}</button>` : ''}</div>
    <div class="facet"><h3>Size</h3><ul>${checkboxList('size', sizes, s.size)}</ul></div>
    <div class="facet"><h3>Price</h3><ul>${checkboxList('price', bands, s.band, (v) => bandLabel(v.split('-').map(Number)))}</ul>
      <div class="price-inputs" style="margin-top:8px"><input id="pmin" type="number" min="0" placeholder="Min $" value="${esc(s.pmin)}" aria-label="Minimum price"><span>–</span><input id="pmax" type="number" min="0" placeholder="Max $" value="${esc(s.pmax)}" aria-label="Maximum price"><button class="btn btn-sm" id="price-go" type="button">Go</button></div></div>`;
  if (focusSel) facetsEl.querySelector(focusSel)?.focus();
  // active chips
  const chips = [];
  if (s.q) chips.push(['q', s.q, `“${s.q}”`]); if (!preset.top && s.top) chips.push(['top', s.top, DATA.tax[s.top].label]);
  if (!preset.sub) s.sub.forEach((v) => chips.push(['sub', v, v])); s.brand.forEach((v) => chips.push(['brand', v, v])); s.size.forEach((v) => chips.push(['size', v, v])); s.style.forEach((v) => chips.push(['style', v, v]));
  s.band.forEach((v) => chips.push(['price', v, bandLabel(v.split('-').map(Number))])); if (s.pmin) chips.push(['pmin', s.pmin, `Min $${s.pmin}`]); if (s.pmax) chips.push(['pmax', s.pmax, `Max $${s.pmax}`]);
  if (s.stock) chips.push(['stock', '1', 'In stock']); if (s.staff) chips.push(['staff', '1', 'Staff picks']); if (s.best) chips.push(['best', '1', 'Best sellers']);
  activeEl.innerHTML = chips.map(([k, v, l]) => `<button type="button" data-rm="${k}" data-v="${esc(v)}" aria-label="Remove filter ${esc(l)}">${esc(l)} ✕</button>`).join('') + (chips.length > 1 ? '<button type="button" data-rm="all">Clear all</button>' : '');
  // results
  const pages = Math.max(1, Math.ceil(results.length / PAGE)); if (s.page > pages) s.page = pages;
  const slice = results.slice((s.page - 1) * PAGE, s.page * PAGE);
  countEl.textContent = s.q ? `Results for “${s.q}”` : ''; // no item counts shown (owner request)
  grid.innerHTML = slice.length ? slice.map(card).join('') : `<div class="empty" style="grid-column:1/-1"><h3>No products match</h3><p>Try removing a filter or searching for something else.</p></div>`;
  sortEl.value = s.sort;
  const btn = (n, lbl = n) => `<button type="button" data-page="${n}" ${n === s.page ? 'aria-current="page"' : ''} aria-label="Page ${n}">${lbl}</button>`;
  let ph = ''; if (pages > 1) {
    if (s.page > 1) ph += `<button type="button" data-page="${s.page - 1}" aria-label="Previous page">‹</button>`;
    const set = new Set([1, pages, s.page - 1, s.page, s.page + 1, s.page - 2, s.page + 2].filter((n) => n >= 1 && n <= pages)); let last = 0;
    for (const n of [...set].sort((a, b) => a - b)) { if (n - last > 1) ph += '<span>…</span>'; ph += btn(n); last = n; }
    if (s.page < pages) ph += `<button type="button" data-page="${s.page + 1}" aria-label="Next page">›</button>`;
  }
  pager.innerHTML = ph;
}
function update(mut, { resetPage = true, push = true } = {}) { mut(state); if (resetPage) state.page = 1; writeState(state, push); render(); }

facetsEl.addEventListener('change', (e) => {
  const t = e.target; if (!t.name) return;
  if (t.name === 'stock') return update((s) => (s.stock = t.checked));
  const key = t.name === 'price' ? 'band' : t.name;
  update((s) => { s[key] = t.checked ? [...s[key], t.value] : s[key].filter((v) => v !== t.value); });
});
facetsEl.addEventListener('input', (e) => { if (e.target.id === 'brand-filter') { brandFilter = e.target.value; render(); const bf = document.getElementById('brand-filter'); bf.focus(); bf.setSelectionRange(bf.value.length, bf.value.length); } });
facetsEl.addEventListener('click', (e) => {
  if (e.target.id === 'brand-more') { brandShowAll.v = !brandShowAll.v; render(); }
  if (e.target.id === 'price-go') update((s) => { s.pmin = document.getElementById('pmin').value; s.pmax = document.getElementById('pmax').value; });
});
activeEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-rm]'); if (!b) return; const k = b.dataset.rm, v = b.dataset.v;
  update((s) => {
    if (k === 'all') { Object.assign(s, { q: '', sub: preset.sub ? [preset.sub] : [], brand: [], size: [], style: [], band: [], pmin: '', pmax: '', stock: false, staff: false, best: false }); if (!preset.top) s.top = ''; document.getElementById('q').value = ''; return; }
    if (k === 'q') { s.q = ''; document.getElementById('q').value = ''; } else if (k === 'top') s.top = ''; else if (['stock', 'staff', 'best'].includes(k)) s[k] = false; else if (k === 'pmin' || k === 'pmax') s[k] = '';
    else { const key = k === 'price' ? 'band' : k; s[key] = s[key].filter((x) => x !== v); }
  });
});
sortEl.addEventListener('change', () => update((s) => (s.sort = sortEl.value)));
pager.addEventListener('click', (e) => { const b = e.target.closest('[data-page]'); if (!b) return; update((s) => (s.page = Number(b.dataset.page)), { resetPage: false }); root.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
window.addEventListener('popstate', () => { state = readState(); render(); });
document.getElementById('open-filters').addEventListener('click', () => document.getElementById('filters').classList.add('open'));
document.querySelector('[data-close-filters]').addEventListener('click', () => document.getElementById('filters').classList.remove('open'));
// instant search when typing in header on listing pages
const q = document.getElementById('q'); let deb;
document.getElementById('site-search').addEventListener('submit', (e) => { if (location.pathname.startsWith('/convenience-liquors-preview/shop/') || preset.top) { e.preventDefault(); document.getElementById('suggest').hidden = true; update((s) => (s.q = q.value.trim())); } });
q.addEventListener('input', () => { if (!location.pathname.startsWith('/convenience-liquors-preview/shop/')) return; clearTimeout(deb); deb = setTimeout(() => update((s) => (s.q = q.value.trim()), { push: false }), 180); });

(async () => {
  DATA = await loadCatalog();
  if (state.q) SEARCH = await getSearch(); else getSearch().then((f) => (SEARCH = f));
  if (!SEARCH) SEARCH = await getSearch();
  render();
  root.dataset.ready = '1';
})();
