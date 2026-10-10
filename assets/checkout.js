import { CONFIG } from './config.js';
import { getCart, subtotal, money, clearCart } from './cart-store.js';
import { buildSlots } from './slots.js';
import { submitOrder, orderText } from './orders.js';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Delivery is fulfilled by DoorDash or Uber Eats: choosing it shows both links instead of the order form (no site delivery orders).
const form = document.getElementById('checkout-form'), sumEl = document.getElementById('co-summary'), wrap = document.getElementById('checkout-wrap');
const dayEl = document.getElementById('slot-day'), timeEl = document.getElementById('slot-time'), errEl = document.getElementById('form-errors');
const ddPanel = document.getElementById('dd-panel'), pickupFields = document.getElementById('pickup-fields');
const mode = () => form.fulfillment.value;

function summary() {
  const c = getCart(); const sub = subtotal(c); const del = mode() === 'delivery';
  sumEl.innerHTML = `<h2 style="font-size:1.2rem">Your order</h2><ul style="list-style:none;padding:0;margin:0 0 12px;font-size:.9rem">${c.map((l) => `<li style="display:flex;justify-content:space-between;gap:8px;padding:4px 0"><span>${l.qty} × ${esc(l.name)}${l.size ? ' <small>' + esc(l.size) + '</small>' : ''}</span><span>${money(l.qty * l.price)}</span></li>`).join('')}</ul>
  ${del ? `<p class="notice" id="co-dd-note">Delivery orders are placed and paid on DoorDash or Uber Eats, so this cart isn't submitted. Add your items in the DoorDash or Uber Eats store.</p>` : `<dl><dt>Subtotal</dt><dd id="co-subtotal">${money(sub)}</dd><dt>Pickup</dt><dd id="co-fee">Free</dd><dt class="total">Est. total</dt><dd class="total" id="co-total">${money(sub)}</dd></dl><p class="notice">Plus applicable NJ sales tax, collected in store. <a href="/convenience-liquors-preview/cart/">Edit cart</a></p>`}`;
}
function fillSlots() {
  const kind = 'pickup'; const days = buildSlots(kind);
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
  ddPanel.hidden = !del; pickupFields.hidden = del; errEl.hidden = true;
  fillSlots(); summary();
}
form.addEventListener('change', (e) => { if (e.target.name === 'fulfillment') setMode(); if (e.target === dayEl) fillSlots(); });
document.addEventListener('click', (e) => { if (e.target.closest('[data-switch-pickup]')) { document.getElementById('f-pickup').checked = true; setMode(); document.getElementById('f-pickup').focus(); } });

form.addEventListener('submit', async (e) => {
  e.preventDefault(); errEl.hidden = true;
  const c = getCart(); const errs = [];
  if (!c.length) errs.push('Your cart is empty.');
  const f = form; const del = false;
  if (mode() === 'delivery') { setMode(); document.getElementById('co-dd-btn')?.focus(); return; }
  if (!f.name.value.trim()) errs.push('Please enter your name.');
  if (!/\d{3}.*\d{3}.*\d{4}/.test(f.phone.value)) errs.push('Please enter a valid phone number.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.value)) errs.push('Please enter a valid email address.');
  if (!timeEl.value) errs.push('Please choose a time.');
  if (!f.age.checked) errs.push(`Please confirm you are ${CONFIG.legal.minAge} or older.`);
  const sub = subtotal(c);
  if (errs.length) { errEl.innerHTML = `<strong>Please fix the following:</strong><ul class="legal-list">${errs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`; errEl.hidden = false; errEl.focus?.(); errEl.scrollIntoView({ block: 'center' }); return; }
  const dOpt = dayEl.selectedOptions[0], tOpt = timeEl.selectedOptions[0];
  const d = new Date(); const id = `CL-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const order = { id, createdAt: d.toISOString(), fulfillment: del ? 'delivery' : 'pickup', customer: { name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim() },
    address: null,
    slot: { date: dayEl.value, dayLabel: dOpt.textContent, start: Number(timeEl.value), timeLabel: tOpt.textContent }, items: c.map(({ sku, name, size, pack, price, qty, inStock }) => ({ sku, name, size, pack, price, qty, inStock })),
    subtotal: sub, total: Math.round(sub * 100) / 100, notes: f.notes.value.trim(), payment: { method: del ? 'pay-on-delivery' : 'pay-in-store', online: false }, ageConfirmed: true };
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
