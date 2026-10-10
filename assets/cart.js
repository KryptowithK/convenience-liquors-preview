import { CONFIG } from './config.js';
import { getCart, setQty, subtotal, money, saveCart } from './cart-store.js';
import { loadCatalog } from './catalog.js';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const linesEl = document.getElementById('cart-lines'), sumEl = document.getElementById('cart-summary');
const DD = (CONFIG.fulfillment.delivery && CONFIG.fulfillment.delivery.doordashUrl) || 'https://order.online/business/convenience-liquors-23567847';
const UE = (CONFIG.fulfillment.delivery && CONFIG.fulfillment.delivery.ubereatsUrl) || 'https://www.order.store/store/convenience-liquors-1129-us-highway-46/UhcPTSgsXhmivovl-o4uZg';
const PAY = !!(CONFIG.payments && CONFIG.payments.enabled);
function render() {
  const c = getCart();
  if (!c.length) { linesEl.innerHTML = `<div class="empty"><h2>Your cart is empty</h2><p>Find something good to drink.</p><a class="btn" href="/convenience-liquors-preview/shop/">Start shopping</a></div>`; sumEl.innerHTML = ''; sumEl.hidden = true; return; }
  sumEl.hidden = false;
  linesEl.innerHTML = c.map((l) => `<div class="cart-line" data-sku="${l.sku}"><a class="ph-mini" href="/convenience-liquors-preview/p/${l.slug}/" aria-hidden="true" tabindex="-1"><img src="${l.img ? l.img.src : `/convenience-liquors-preview/img/p/${l.sku}.svg`}" alt=""></a>
    <div><a class="ln-name" href="/convenience-liquors-preview/p/${l.slug}/">${esc(l.name)}</a><div class="ln-meta">${esc([l.size, l.pack ? l.pack + '-pack' : ''].filter(Boolean).join(' · '))} · ${money(l.price)} each</div>${l.inStock ? '' : '<span class="badge out">Out of stock — request</span>'}</div>
    <div class="ln-right"><strong>${money(l.price * l.qty)}</strong><div class="qty"><button type="button" data-d="-1" aria-label="Decrease quantity of ${esc(l.name)}">−</button><input type="number" min="0" max="99" value="${l.qty}" aria-label="Quantity of ${esc(l.name)}"><button type="button" data-d="1" aria-label="Increase quantity of ${esc(l.name)}">+</button></div><button class="link-btn" type="button" data-remove>Remove</button></div></div>`).join('');
  const sub = subtotal(c);
  sumEl.innerHTML = `<h2 style="font-size:1.25rem">Order summary</h2><dl><dt>Items</dt><dd>${c.reduce((a, l) => a + l.qty, 0)}</dd><dt>Subtotal</dt><dd id="cart-subtotal">${money(sub)}</dd><dt>Pickup</dt><dd>Free</dd><dt>Delivery</dt><dd>${PAY ? `$${(CONFIG.payments.deliveryFeeCents / 100).toFixed(2)} via Uber` : `<a href="${DD}" target="_blank" rel="noopener">DoorDash ↗</a> · <a href="${UE}" target="_blank" rel="noopener">Uber Eats ↗</a>`}</dd></dl>
  <p class="notice">${PAY ? 'NJ sales tax is added at checkout. Pay securely online by card.' : `Taxes calculated in store. ${esc(CONFIG.orders.payment.note)}`}</p>
  <a class="btn btn-block" href="/convenience-liquors-preview/checkout/" id="to-checkout">Checkout — pickup or delivery</a><a class="btn btn-ghost btn-block" style="margin-top:8px" href="/convenience-liquors-preview/shop/">Continue shopping</a>`;
}
linesEl.addEventListener('click', (e) => {
  const line = e.target.closest('.cart-line'); if (!line) return; const sku = line.dataset.sku; const l = getCart().find((x) => x.sku === sku);
  if (e.target.closest('[data-remove]')) { setQty(sku, 0); render(); }
  const d = e.target.closest('[data-d]'); if (d) { setQty(sku, l.qty + Number(d.dataset.d)); render(); line.isConnected || document.querySelector(`.cart-line[data-sku="${sku}"] [data-d="${d.dataset.d}"]`)?.focus(); }
});
linesEl.addEventListener('change', (e) => { if (e.target.matches('input')) { const sku = e.target.closest('.cart-line').dataset.sku; setQty(sku, Math.max(0, parseInt(e.target.value, 10) || 0)); render(); } });
render();
// refresh prices/stock against current catalog
loadCatalog().then((d) => { const c = getCart(); let ch = false; for (const l of c) { const p = d.bySku.get(l.sku); if (p && (p.price !== l.price || p.inStock !== l.inStock)) { l.price = p.price; l.inStock = p.inStock; ch = true; } } if (ch) { saveCart(c); render(); } });
