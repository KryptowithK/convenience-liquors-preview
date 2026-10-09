// Lazy-loaded compact catalog index + MiniSearch index (shared by header search and listing pages).
let _data, _search;
export async function loadCatalog() {
  if (!_data) _data = fetch('/convenience-liquors-preview/assets/catalog-index.json').then((r) => r.json()).then((d) => {
    d.items = d.items.map((o) => ({ sku: o.s, slug: o.u, name: o.n, brand: o.b, top: o.t, sub: o.c, price: o.p, inStock: !!o.i, size: o.z || '', ml: o.m || 0, pack: o.k || 0, style: o.y || '', best: !!o.B, staff: !!o.F, isNew: !!o.N, sold: o.q || 0, img: o.g ? { src: o.g } : null, raw: o.r || '' }));
    d.bySku = new Map(d.items.map((p) => [p.sku, p])); return d; });
  return _data;
}
export async function getSearch() {
  if (_search) return _search;
  const [{ default: MiniSearch }, d] = await Promise.all([import('./minisearch.js'), loadCatalog()]);
  const ms = new MiniSearch({ idField: 'sku', fields: ['name', 'brand', 'sub', 'raw', 'style', 'alias'], storeFields: [],
    processTerm: (t) => t.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/'/g, ''),
    searchOptions: { boost: { name: 3, brand: 2 }, prefix: true, fuzzy: (term) => (term.length > 4 ? 0.2 : term.length > 3 ? 1 : 0), combineWith: 'AND' } });
  // aliases: allow searching apostrophe-less & common shorthand
  ms.addAll(d.items.map((p) => ({ ...p, alias: p.name.replace(/'/g, '') + (p.sub === 'Whiskey' ? ' whisky bourbon' : '') + (p.sub === 'Hard Seltzer & RTD' ? ' rtd seltzer cocktail' : '') })));
  _search = (q) => {
    let r = ms.search(q);
    if (!r.length) r = ms.search(q, { combineWith: 'OR' });
    return r.map((x) => ({ p: d.bySku.get(x.id), score: x.score })).filter((x) => x.p);
  };
  return _search;
}
