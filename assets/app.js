import { CONFIG } from './config.js';
import { getCart, cartCount, addToCart, money } from './cart-store.js';
import { loadCatalog, getSearch } from './catalog.js';

// ---- age gate (remembered for N days) ----
const AGE_KEY = 'cl_age_ok';
const gate = document.getElementById('age-gate');
function ageOk() { const t = Number(localStorage.getItem(AGE_KEY) || 0); return t && Date.now() - t < CONFIG.legal.ageGateDays * 864e5; }
if (gate && !ageOk()) {
  gate.hidden = false; document.body.classList.add('gated');
  const yes = document.getElementById('age-yes'); yes.focus();
  gate.addEventListener('keydown', (e) => { if (e.key === 'Tab') { const f = [...gate.querySelectorAll('button')]; const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); } });
  yes.addEventListener('click', () => { localStorage.setItem(AGE_KEY, String(Date.now())); gate.hidden = true; document.body.classList.remove('gated'); });
  document.getElementById('age-no').addEventListener('click', () => { document.getElementById('age-denied').hidden = false; gate.querySelector('.age-actions').hidden = true; });
}

// ---- cart badge + toast ----
const badge = document.getElementById('cart-count');
const paint = () => { if (badge) badge.textContent = cartCount(); };
paint(); window.addEventListener('cart:change', paint); window.addEventListener('storage', paint);
const toastEl = document.getElementById('toast'); let tt;
export function toast(html) { toastEl.innerHTML = html; toastEl.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => toastEl.classList.remove('show'), 2800); }

// ---- add-to-cart delegation (cards + PDP) ----
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-add]'); if (!b) return;
  e.preventDefault();
  const d = await loadCatalog(); const p = d.bySku.get(b.dataset.add); if (!p) return;
  let qty = 1; if (b.dataset.qtyFrom) qty = Math.max(1, parseInt(document.querySelector(b.dataset.qtyFrom).value, 10) || 1);
  addToCart(p, qty);
  const label = b.textContent; b.classList.add('added'); b.textContent = '✓ Added';
  setTimeout(() => { b.classList.remove('added'); b.textContent = label; }, 1400);
  toast(`Added ${qty} × ${p.name.replace(/</g, '')} <a href="/convenience-liquors-preview/cart/">View cart</a>`);
});

// ---- mobile drawer ----
const drawer = document.getElementById('drawer'); const opener = document.getElementById('menu-open');
opener?.addEventListener('click', () => { drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); opener.setAttribute('aria-expanded', 'true'); drawer.querySelector('a,button,summary')?.focus(); });
drawer?.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); opener.setAttribute('aria-expanded', 'false'); opener.focus(); } });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer?.classList.contains('open')) drawer.querySelector('[data-close]').click(); });

// ---- header search with instant suggestions ----
const form = document.getElementById('site-search'); const input = document.getElementById('q'); const list = document.getElementById('suggest');
const params = new URLSearchParams(location.search); if (params.get('q') && input) input.value = params.get('q');
let sel = -1, items = [];
input?.addEventListener('focus', () => getSearch(), { once: true });
input?.addEventListener('input', async () => {
  const q = input.value.trim(); if (q.length < 2) { list.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
  const search = await getSearch(); if (input.value.trim() !== q) return;
  const res = search(q).sort((a, b) => (b.p.inStock - a.p.inStock) * 0.0001 + (b.score - a.score)).slice(0, 7); items = res; sel = -1;
  list.innerHTML = res.map(({ p }, i) => `<li role="option" id="sg-${i}" aria-selected="false"><a href="/convenience-liquors-preview/p/${p.slug}/"><span class="s-img"><img src="${p.img ? p.img.src : `/convenience-liquors-preview/img/p/${p.sku}.svg`}" alt="" width="36" height="54"></span><span><span>${p.name.replace(/</g, '&lt;')}</span><br><span class="s-meta">${[p.size, p.pack ? p.pack + '-pack' : '', p.sub].filter(Boolean).join(' · ')}${p.inStock ? '' : ' · Out of stock'}</span></span><strong>${money(p.price)}</strong></a></li>`).join('')
    + `<li><a class="s-all" href="/convenience-liquors-preview/shop/?q=${encodeURIComponent(q)}">See all results for “${q.replace(/</g, '&lt;')}”</a></li>`;
  list.hidden = false; input.setAttribute('aria-expanded', 'true');
});
input?.addEventListener('keydown', (e) => {
  if (list.hidden) return; const opts = [...list.querySelectorAll('li[role=option]')];
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length; opts.forEach((o, i) => o.setAttribute('aria-selected', String(i === sel))); input.setAttribute('aria-activedescendant', 'sg-' + sel); }
  else if (e.key === 'Enter' && sel >= 0) { e.preventDefault(); location.href = opts[sel].querySelector('a').href; }
  else if (e.key === 'Escape') { list.hidden = true; }
});
document.addEventListener('click', (e) => { if (list && !form.contains(e.target)) list.hidden = true; });

// ---- open / closed status in header (store-local time from config) ----
(() => {
  const els = document.querySelectorAll('[data-open-status]'); if (!els.length) return;
  try {
    const tz = CONFIG.hours.timezone || 'America/New_York';
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date()).map((p) => [p.type, p.value]));
    const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday); const now = Number(parts.hour) * 60 + Number(parts.minute);
    const mins = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
    const f12 = (s) => { const [h, m] = s.split(':').map(Number); return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''} ${h >= 12 ? 'PM' : 'AM'}`; };
    const d = CONFIG.hours.days[dow]; let txt;
    if (now >= mins(d.open) && now < mins(d.close)) txt = `Open now · until ${f12(d.close)}`;
    else if (now < mins(d.open)) txt = `Opens today at ${f12(d.open)}`;
    else { const n = CONFIG.hours.days[(dow + 1) % 7]; txt = `Closed · opens ${f12(n.open)} tomorrow`; }
    els.forEach((el) => { el.textContent = txt; el.classList.add('is-set'); });
    document.querySelectorAll(`.visit-hours [data-dow="${dow}"]`).forEach((li) => li.classList.add('today'));
  } catch { /* keep static text */ }
})();
