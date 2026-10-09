// Generated product placeholder art (SVG). Shared by the static build (Node) and the browser.
// Colors + silhouette chosen by subcategory; label shows brand + size. No third-party imagery.
export const PALETTE = {
  'Red Wine': ['#5c1424', '#8e2a3e', '#f3e6e8', 'wine'], 'White Wine': ['#c9b26b', '#e8d9a0', '#fbf7ea', 'wine'],
  'Rosé': ['#d9798b', '#f2b8c2', '#fdf0f2', 'wine'], 'Sparkling & Champagne': ['#2b3a2e', '#c9a45c', '#f7f2e4', 'sparkling'],
  'Dessert & Fortified': ['#4a1a12', '#8a3b22', '#f5ebe6', 'port'], 'Sake & Fruit Wine': ['#7a4e8c', '#c79bd6', '#f6eef9', 'wine'],
  'Other Wine': ['#6b1d2f', '#a8495d', '#f6ecee', 'wine'],
  'Whiskey': ['#7a3f0e', '#c27a2c', '#fbf1e4', 'whiskey'], 'Vodka': ['#7f96ad', '#d8e3ee', '#f2f6fa', 'vodka'],
  'Tequila & Mezcal': ['#6c7a2d', '#d4b55d', '#f7f5e6', 'tequila'], 'Rum': ['#5a2d0c', '#b8732f', '#faefe3', 'whiskey'],
  'Gin': ['#1f6f6a', '#9fd2c7', '#ecf7f5', 'gin'], 'Cognac & Brandy': ['#5b2a10', '#a8582a', '#f8ece4', 'cognac'],
  'Liqueurs & Cordials': ['#5b2a6e', '#b07cc6', '#f5eef8', 'liqueur'], 'Soju & Asian Spirits': ['#2f7a4f', '#a6dcb9', '#eef8f2', 'vodka'],
  'Other Spirits': ['#3a3335', '#8c8285', '#f3f1f1', 'whiskey'],
  'Domestic Beer': ['#1d3f8a', '#d7e2f6', '#eef3fb', 'can'], 'Imported Beer': ['#1f5a32', '#a3d0ae', '#edf6ef', 'beer'],
  'Craft Beer': ['#a8551c', '#f0b37a', '#fbf0e6', 'can'], 'Hard Seltzer & RTD': ['#2a8fa8', '#bfe8f0', '#ecf8fb', 'slim'],
  'Cider': ['#6f8f1f', '#d3e59a', '#f4f8e7', 'beer'], 'Non-Alcoholic': ['#55606b', '#c9d1d8', '#f1f3f5', 'can'],
  'Cocktail Mixers': ['#b0324f', '#f2a6b6', '#fcf0f3', 'mixer'], 'Soda, Water & Juice': ['#1e7bc4', '#a9d4f5', '#eef6fd', 'slim'],
  'Snacks & Candy': ['#c78a12', '#f5d68a', '#fdf6e6', 'bag'], 'Bar Tools & Gifts': ['#3b3b3b', '#c9a45c', '#f4f2ee', 'gift'],
  'Ice': ['#5aa9d6', '#e3f3fc', '#f2f9fd', 'bag'],
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function wrap(text, max, lines) {
  const words = String(text || '').split(/\s+/).filter(Boolean); const out = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) out.push(cur);
  if (out.length > lines) { out.length = lines; out[lines - 1] = out[lines - 1].replace(/.{0,2}$/, '') + '…'; }
  return out;
}
const SHAPES = {
  wine: 'M88 20h24v62c0 8 22 22 22 52v140c0 8-6 12-12 12H78c-6 0-12-4-12-12V134c0-30 22-44 22-52z',
  sparkling: 'M86 14h28v66c0 10 24 22 24 54v140c0 8-6 12-12 12H74c-6 0-12-4-12-12V134c0-32 24-44 24-54z',
  port: 'M88 22h24v56c0 10 26 18 26 44v152c0 8-6 12-12 12H74c-6 0-12-4-12-12V122c0-26 26-34 26-44z',
  whiskey: 'M86 22h28v40c0 6 6 8 12 12 10 6 14 14 14 26v174c0 8-6 12-12 12H72c-6 0-12-4-12-12V100c0-12 4-20 14-26 6-4 12-6 12-12z',
  vodka: 'M90 18h20v52c0 6 26 10 26 30v174c0 8-6 12-12 12H76c-6 0-12-4-12-12V100c0-20 26-24 26-30z',
  tequila: 'M84 26h32v34c0 6 30 8 30 30v184c0 8-6 12-12 12H66c-6 0-12-4-12-12V90c0-22 30-24 30-30z',
  gin: 'M88 24h24v40c0 6 32 10 32 32v178c0 8-6 12-12 12H68c-6 0-12-4-12-12V96c0-22 32-26 32-32z',
  cognac: 'M90 24h20v44c0 8 40 24 40 70v118c0 12-8 20-20 20H70c-12 0-20-8-20-20V138c0-46 40-62 40-70z',
  liqueur: 'M88 22h24v42c0 6 34 14 34 40v170c0 8-6 12-12 12H66c-6 0-12-4-12-12V104c0-26 34-34 34-40z',
  can: 'M58 70c0-8 6-12 14-12h56c8 0 14 4 14 12v4c4 4 4 8 4 12v176c0 4 0 8-4 12v4c0 8-6 12-14 12H72c-8 0-14-4-14-12v-4c-4-4-4-8-4-12V86c0-4 0-8 4-12z',
  slim: 'M72 46c0-6 4-10 10-10h36c6 0 10 4 10 10v4c3 3 3 6 3 9v214c0 3 0 6-3 9v4c0 6-4 10-10 10H82c-6 0-10-4-10-10v-4c-3-3-3-6-3-9V59c0-3 0-6 3-9z',
  beer: 'M90 24h20v50c0 10 22 20 22 46v154c0 8-6 12-12 12H80c-6 0-12-4-12-12V120c0-26 22-36 22-46z',
  mixer: 'M84 30h32v28c0 6 26 10 26 30v186c0 8-6 12-12 12H70c-6 0-12-4-12-12V88c0-20 26-24 26-30z',
  bag: 'M46 60h108l-6 18 10 200c0 6-4 8-10 8H52c-6 0-10-2-10-8l10-200z',
  gift: 'M50 110h100v170c0 4-4 8-8 8H58c-4 0-8-4-8-8zM44 90h112v24H44zM96 90h8v198h-8z',
};
export function placeholderSVG(p, { title = true } = {}) {
  const [dark, light, bg, shape] = PALETTE[p.sub] || ['#6b1d2f', '#c9a45c', '#f6f1ea', 'wine'];
  const brand = (p.brand || p.name || '').toUpperCase();
  const lines = wrap(brand, 12, 2);
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const isCanish = ['can', 'slim', 'bag', 'gift'].includes(shape);
  const labelY = isCanish ? 165 : 182;
  const id = 'g' + String(p.sku || Math.random().toString(36).slice(2));
  const sizeLbl = [p.size, p.pack ? p.pack + '-pk' : ''].filter(Boolean).join(' · ');
  const lw = isCanish ? 80 : 74; const fs = Math.min(12, Math.max(7, (lw - 8) / (longest * 0.66)));
  const t = lines.map((l, i) => `<text x="100" y="${labelY + i * (fs + 3)}" text-anchor="middle" font-family="Georgia,serif" font-size="${fs.toFixed(1)}" font-weight="700" fill="${dark}">${esc(l)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300" role="img" aria-label="${esc(p.name)} illustration" class="ph"><defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="${dark}"/><stop offset=".55" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs><rect width="200" height="300" fill="${bg}"/><ellipse cx="100" cy="290" rx="58" ry="6" fill="#000" opacity=".08"/><path d="${SHAPES[shape]}" fill="url(#${id})"/>${shape === 'sparkling' ? `<path d="M84 14h32v40H84z" fill="#c9a45c"/>` : ''}<rect x="${100 - lw / 2}" y="${labelY - 22}" width="${lw}" height="${lines.length > 1 ? 54 : 42}" rx="4" fill="#fffdf8" opacity=".95"/>${t}<text x="100" y="${labelY + (lines.length > 1 ? fs + 3 : 0) + 15}" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="8.5" fill="#555">${esc(sizeLbl)}</text></svg>`;
}
