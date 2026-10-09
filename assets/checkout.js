import { CONFIG } from './config.js';
import { getCart, subtotal, money, clearCart } from './cart-store.js';
import { buildSlots } from './slots.js';
import { checkAddress } from './delivery.js';
import { submitOrder, orderText } from './orders.js';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const D = CONFIG.fulfillment.delivery;
const form = document.getElementById('checkout-form'), sumEl = document.getElementById('co-summary'), wrap = document.getElementById('checkout-wrap');
const dayEl = document.getElementById('slot-day'), timeEl = document.getElementById('slot-time'), errEl = document.getElementById('form-errors'), minAlert = document.getElementById('min-alert');
const addrRes = document.getElementById('addr-result');
let addrCheck = null; // last result
const mode = () => form.fulfillment.value;
if (!D.enabled) { document.getElementById('f-delivery').disabled = true; }

function summary() {
  const c = getCart(); const sub = subtotal(c); const fee = mode() === 'delivery' ? D.fee : 0;
  sumEl.innerHTML = `<h2 style="font-size:1.2rem">Your order</h2><ul style="list-style:none;padding:0;margin:0 0 12px;font-size:.9rem">${c.map((l) => `<li style="display:flex;justify-content:space-between;gap:8px;padding:4px 0"><span>${l.qty} × ${esc(l.name)}${l.size ? ' <small>' + esc(l.size) + '</small>' : ''}</span><span>${money(l.qty * l.price)}</span></li>`).join('')}</ul>
  <dl><dt>Subtotal</dt><dd id="co-subtotal">${money(sub)}</dd><dt>${mode() === 'delivery' ? 'Delivery fee' : 'Pickup'}</dt><dd id="co-fee">${mode() === 'delivery' ? money(fee) : 'Free'}</dd><dt class="total">Est. total</dt><dd class="total" id="co-total">${money(sub + fee)}</dd></dl><p class="notice">Plus applicable NJ sales tax, collected in store / at the door. <a href="/convenience-liquors-preview/cart/">Edit cart</a></p>`;
  const short = D.minimumOrder - sub;
  if (mode() === 'delivery' && short > 0) { minAlert.hidden = false; minAlert.innerHTML = `Delivery requires a ${money(D.minimumOrder)} minimum (subtotal before the delivery fee). Add ${money(short)} more, or <button type="button" class="link-btn" data-switch-pickup>switch to in-store pickup</button>.`; }
  else minAlert.hidden = true;
}
function fillSlots() {
  const kind = mode(); const days = buildSlots(kind);
  const prevDay = dayEl.value, prevTime = timeEl.value;
  dayEl.innerHTML = days.map((d) => `<option value="${d.iso}" data-hours="${d.hours}">${d.label}</option>`).join('');
  if (days.some((d) => d.iso === prevDay)) dayEl.value = prevDay;
  const d = days.find((x) => x.iso === dayEl.value) || days[0];
  timeEl.innerHTML = d ? d.slots.map((s) => `<option value="${s.start}">${s.label}</option>`).join('') : '';
  if ([...timeEl.options].some((o) => o.value === prevTime)) timeEl.value = prevTime;
  document.getElementById('when-legend').textContent = kind === 'delivery' ? 'Delivery window' : 'Pickup time';
  document.getElementById('slot-time-label').textContent = kind === 'delivery' ? 'Window' : 'Time';
  document.getElementById('hours-note').textContent = d ? `Store hours that day: ${d.hours}. ${kind === 'delivery' ? 'Delivery windows' : 'Pickup times'} end ${CONFIG.hours.lastSlotMinutesBeforeClose} minutes before closing.` : '';
}
function setMode() {
  const del = mode() === 'delivery';
  document.getElementById('delivery-fields').hidden = !del;
  ['d-street', 'd-city', 'd-zip'].forEach((id) => (document.getElementById(id).required = del));
  document.getElementById('age-where').textContent = del ? 'the door' : 'pickup';
  document.getElementById('pay-where').textContent = del ? 'at the door on delivery' : 'in store at pickup';
  document.getElementById('place-order').textContent = del ? 'Place delivery order request' : 'Place pickup order request';
  fillSlots(); summary();
}
form.addEventListener('change', (e) => { if (e.target.name === 'fulfillment') setMode(); if (e.target === dayEl) fillSlots(); if (['d-zip', 'd-street', 'd-city'].includes(e.target.id)) { addrCheck = null; addrRes.innerHTML = ''; } });
document.addEventListener('click', (e) => { if (e.target.closest('[data-switch-pickup]')) { document.getElementById('f-pickup').checked = true; setMode(); document.getElementById('f-pickup').focus(); } });
async function runCheck() {
  addrRes.innerHTML = '<p class="notice">Checking delivery area…</p>';
  const r = await checkAddress({ street: form.street.value.trim(), city: form.city.value.trim(), zip: form.zip.value.trim() });
  addrCheck = r; if (r.ok) errEl.hidden = true;
  addrRes.innerHTML = r.ok ? `<div class="alert ok" id="addr-ok">✓ Good news — we deliver there${r.distance != null ? ` (about ${r.distance} mi from the store${r.method === 'zip-centroid' ? ', estimated from ZIP' : ''})` : ''}.</div>`
    : `<div class="alert err" id="addr-bad">${esc(r.reason)} <button type="button" class="link-btn" data-switch-pickup>Choose in-store pickup instead</button></div>`;
  return r;
}
document.getElementById('check-addr').addEventListener('click', runCheck);

form.addEventListener('submit', async (e) => {
  e.preventDefault(); errEl.hidden = true;
  const c = getCart(); const errs = [];
  if (!c.length) errs.push('Your cart is empty.');
  const f = form; const del = mode() === 'delivery';
  if (!f.name.value.trim()) errs.push('Please enter your name.');
  if (!/\d{3}.*\d{3}.*\d{4}/.test(f.phone.value)) errs.push('Please enter a valid phone number.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.value)) errs.push('Please enter a valid email address.');
  if (!timeEl.value) errs.push('Please choose a time.');
  if (!f.age.checked) errs.push(`Please confirm you are ${CONFIG.legal.minAge} or older.`);
  const sub = subtotal(c);
  if (del) {
    if (sub < D.minimumOrder) errs.push(`Delivery requires a ${money(D.minimumOrder)} minimum order (subtotal before fee). Your subtotal is ${money(sub)}.`);
    if (!f.street.value.trim() || !f.city.value.trim() || !f.zip.value.trim()) errs.push('Please enter your full delivery address.');
    else { const r = addrCheck || (await runCheck()); if (!r.ok) errs.push(r.reason + ' Please choose in-store pickup instead.'); }
  }
  if (errs.length) { errEl.innerHTML = `<strong>Please fix the following:</strong><ul class="legal-list">${errs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`; errEl.hidden = false; errEl.focus?.(); errEl.scrollIntoView({ block: 'center' }); return; }
  const dOpt = dayEl.selectedOptions[0], tOpt = timeEl.selectedOptions[0];
  const d = new Date(); const id = `CL-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const order = { id, createdAt: d.toISOString(), fulfillment: del ? 'delivery' : 'pickup', customer: { name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim() },
    address: del ? { street: f.street.value.trim(), apt: f.apt.value.trim(), city: f.city.value.trim(), zip: f.zip.value.trim(), check: addrCheck ? `${addrCheck.distance ?? '?'} mi via ${addrCheck.method}` : '' } : null,
    slot: { date: dayEl.value, dayLabel: dOpt.textContent, start: Number(timeEl.value), timeLabel: tOpt.textContent }, items: c.map(({ sku, name, size, pack, price, qty, inStock }) => ({ sku, name, size, pack, price, qty, inStock })),
    subtotal: sub, deliveryFee: del ? D.fee : 0, total: Math.round((sub + (del ? D.fee : 0)) * 100) / 100, notes: f.notes.value.trim(), payment: { method: del ? 'pay-on-delivery' : 'pay-in-store', online: false }, ageConfirmed: true };
  const res = await submitOrder(order);
  localStorage.setItem('cl_last_order', JSON.stringify(order)); clearCart();
  wrap.hidden = true; const conf = document.getElementById('confirmation'); conf.hidden = false;
  conf.innerHTML = `<div class="alert ok"><h2 style="margin:0">Thank you! Your ${del ? 'delivery' : 'pickup'} request ${esc(order.id)} is ready to send.</h2></div>
  ${res.mailto ? `<p><strong>One more step:</strong> this site doesn't have an order server yet, so please send the order to the store by email (or call <a href="tel:${CONFIG.store.phoneE164}">${esc(CONFIG.store.phone)}</a>). We'll confirm availability and your ${del ? 'delivery window' : 'pickup time'}.</p><p class="no-print"><a class="btn" id="mailto-btn" href="${esc(res.mailto)}">Email order to the store</a> <button class="btn btn-ghost" type="button" onclick="window.print()">Print summary</button></p>` : `<p>We've received your request and will contact you to confirm.</p>`}
  <div class="order-box"><pre style="white-space:pre-wrap;font:inherit;margin:0" id="order-text">${esc(orderText(order))}</pre></div>
  <div class="alert info"><strong>Remember:</strong> ${del ? `Someone ${CONFIG.legal.minAge}+ must be present with valid photo ID; we cannot deliver to anyone who appears intoxicated. Pay at the door.` : `Bring a valid photo ID. Pay in store at pickup.`}</div><p class="no-print"><a href="/convenience-liquors-preview/shop/">Continue shopping</a></p>`;
  conf.focus(); window.scrollTo({ top: 0 });
});
if (!getCart().length) { wrap.innerHTML = `<div class="empty" style="grid-column:1/-1"><h2>Your cart is empty</h2><a class="btn" href="/convenience-liquors-preview/shop/">Start shopping</a></div>`; }
else setMode();
