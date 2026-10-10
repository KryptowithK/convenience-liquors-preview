// Online checkout: Square Web Payments SDK card (+ optional Google Pay), pickup or Uber Direct delivery.
// Prices, tax, delivery fee and the final total always come from the checkout API (never computed client-side).
import { CONFIG } from './config.js';
import { getCart, clearCart, saveCart } from './cart-store.js';
import { buildSlots } from './slots.js';
const P = CONFIG.payments; const API = P.apiBase;
const FEE = Number.isInteger(P.deliveryFeeCents) ? P.deliveryFeeCents : 799; // flat customer delivery fee (server is authoritative)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $c = (cents) => '$' + (cents / 100).toFixed(2);
const form = document.getElementById('checkout-form'), sumEl = document.getElementById('co-summary'), wrap = document.getElementById('checkout-wrap');
const dayEl = document.getElementById('slot-day'), timeEl = document.getElementById('slot-time'), errEl = document.getElementById('form-errors');
const payBtn = document.getElementById('place-order'), quoteBox = document.getElementById('quote-box'), quoteBtn = document.getElementById('get-quote');
const delStatus = document.getElementById('delivery-status');
const mode = () => form.fulfillment.value;
const items = () => getCart().map((l) => ({ sku: l.sku, qty: l.qty }));
const address = () => ({ line1: form.line1.value.trim(), line2: form.line2.value.trim(), city: form.city.value.trim(), state: 'NJ', zip: form.zip.value.trim() });
let state = { totals: null, lines: null, quote: null, idem: crypto.randomUUID(), busy: false, deliveryOk: true, completed: null };
const CONF_KEY = 'cl_last_confirmation'; const CONF_TTL_MS = 12 * 3600 * 1000; // last paid order, shown again on reload (this tab only)
function loadConfirmation() {
  try { const c = JSON.parse(sessionStorage.getItem(CONF_KEY)); return c && c.ref && Date.now() - Date.parse(c.at) < CONF_TTL_MS ? c : null; } catch { return null; }
}

async function api(path, body) {
  const r = await fetch(API + path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({ ok: false, message: 'Network error. Please try again.' }));
  return { status: r.status, ok: r.ok, d };
}
function showErr(msgs) {
  errEl.innerHTML = Array.isArray(msgs) && msgs.length > 1 ? `<strong>Please fix the following:</strong><ul class="legal-list">${msgs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : esc([].concat(msgs)[0]);
  errEl.hidden = false; errEl.focus?.(); errEl.scrollIntoView({ block: 'center' });
}
function renderSummary() {
  if (state.completed) return; // order paid: the confirmation screen replaces the form and summary
  const c = getCart(); const t = state.totals; const del = mode() === 'delivery';
  const lines = state.lines || c.map((l) => ({ name: l.name, size: l.size, qty: l.qty, lineCents: Math.round(l.qty * l.price * 100) }));
  sumEl.innerHTML = `<h2 style="font-size:1.2rem">Your order</h2><ul class="co-lines">${lines.map((l) => `<li><span>${l.qty} × ${esc(l.name)}${l.size ? ' <small>' + esc(l.size) + '</small>' : ''}</span><span>${$c(l.lineCents)}</span></li>`).join('')}</ul>
  <dl><dt>Subtotal</dt><dd id="co-subtotal">${t ? $c(t.subtotalCents) : '…'}</dd><dt>${del ? 'Delivery' : 'Pickup'}</dt><dd id="co-fee">${del ? (t && state.quote ? (t.deliveryFeeCents ? $c(t.deliveryFeeCents) : 'Free') : $c(FEE)) : 'Free'}</dd>
  <dt>NJ sales tax</dt><dd id="co-tax">${t ? $c(t.taxCents) : '…'}</dd><dt class="total">Total</dt><dd class="total" id="co-total">${t ? $c(t.totalCents) : '…'}</dd></dl><p class="notice"><a href="/convenience-liquors-preview/cart/">Edit cart</a></p>`;
  const ready = t && (!del || state.quote) && !state.busy;
  payBtn.disabled = !ready; payBtn.textContent = ready ? `Pay ${$c(t.totalCents)}` : del && !state.quote ? 'Confirm your delivery address first' : 'Pay';
  gpayUpdate();
}
function fillSlots() {
  const days = buildSlots('pickup'); const prevDay = dayEl.value, prevTime = timeEl.value;
  dayEl.innerHTML = days.map((d) => `<option value="${d.iso}">${d.label}</option>`).join('');
  if (days.some((d) => d.iso === prevDay)) dayEl.value = prevDay;
  const d = days.find((x) => x.iso === dayEl.value) || days[0];
  timeEl.innerHTML = d ? d.slots.map((s) => `<option value="${s.start}">${s.label}</option>`).join('') : '';
  if ([...timeEl.options].some((o) => o.value === prevTime)) timeEl.value = prevTime;
  document.getElementById('hours-note').textContent = d ? `Store hours that day: ${d.hours}.` : '';
}
async function pricePickup() {
  state.totals = null; renderSummary();
  const r = await api('/price', { fulfillment: 'pickup', items: items() });
  if (!r.ok) { cartProblem(r.d); return; }
  state.totals = r.d.totals; state.lines = r.d.lines; renderSummary();
}
function cartProblem(d) {
  if (d.error === 'cart_changed' && d.problems) {
    const bad = new Set(d.problems.map((p) => p.sku)); const names = getCart().filter((l) => bad.has(l.sku)).map((l) => l.name);
    saveCart(getCart().filter((l) => !bad.has(l.sku)));
    showErr(`Removed from your cart (no longer available): ${names.join(', ')}. Please review your order.`);
    if (getCart().length) refresh(); else location.reload();
    return;
  }
  showErr(d.message || 'Something went wrong. Please try again.');
}
function setMode() {
  const del = mode() === 'delivery';
  document.getElementById('pickup-fields').hidden = del; document.getElementById('delivery-fields').hidden = !del;
  document.getElementById('age-where').textContent = del ? 'the door' : 'pickup';
  errEl.hidden = true; refresh();
}
function refresh() {
  if (mode() === 'pickup') { state.quote = null; pricePickup(); }
  else { state.totals = state.quote ? state.totals : null; renderSummary(); }
}
function invalidateQuote() { if (state.quote) { state.quote = null; state.totals = null; quoteBox.hidden = true; renderSummary(); } }
let expiryTimer;
async function getQuote() {
  errEl.hidden = true;
  const a = address(); const errs = [];
  if (a.line1.length < 4) errs.push('Enter your street address.');
  if (a.city.length < 2) errs.push('Enter your city.');
  if (!/^\d{5}$/.test(a.zip)) errs.push('Enter a 5-digit ZIP code.');
  if (!/\d{3}.*\d{3}.*\d{4}/.test(form.phone.value)) errs.push('Enter your mobile phone (the courier may call).');
  if (errs.length) { showErr(errs); return; }
  quoteBtn.disabled = true; quoteBtn.textContent = 'Checking address…';
  const r = await api('/quote-delivery', { items: items(), address: a, customer: { phone: form.phone.value } });
  quoteBtn.disabled = false; quoteBtn.textContent = 'Check address again';
  quoteBox.hidden = false;
  if (!r.ok) { state.quote = null; state.totals = null; quoteBox.className = 'quote-box err'; quoteBox.innerHTML = esc(r.d.message || 'Delivery is unavailable right now.'); if (r.d.error === 'cart_changed') cartProblem(r.d); renderSummary(); return; }
  state.quote = r.d; state.totals = r.d.totals; state.lines = r.d.lines;
  quoteBox.className = 'quote-box';
  quoteBox.innerHTML = `<strong>Delivery: ${r.d.deliveryFeeCents ? $c(r.d.deliveryFeeCents) : 'Free'}</strong>${r.d.etaMinutes ? ` · arrives in about ${Math.round(r.d.etaMinutes)} min` : ''}<br><small>We deliver to this address. An Uber courier will check ID (${CONFIG.legal.minAge}+). Please check out within a few minutes to hold the courier.</small>`;
  clearTimeout(expiryTimer);
  expiryTimer = setTimeout(() => { if (state.quote === r.d) { invalidateQuote(); quoteBox.hidden = false; quoteBox.className = 'quote-box err'; quoteBox.textContent = 'Your delivery check expired. Tap “Check address again”.'; } }, Math.max(30000, Date.parse(r.d.expiresAt) - Date.now() - 15000));
  renderSummary();
}

// ---------- payment methods ----------
let card = null, gpay = null, payReq = null, payments = null;
function loadSdk() {
  if (P.provider === 'mock') return Promise.resolve(null);
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = P.squareEnv === 'sandbox' ? 'https://sandbox.web.squarecdn.com/v1/square.js' : 'https://web.squarecdn.com/v1/square.js';
    s.onload = () => res(window.Square); s.onerror = () => rej(new Error('sdk')); document.head.appendChild(s);
  });
}
// Test-only stand-in (payments.provider = "mock" in a local build): renders a plain field and returns test nonces.
const mockCard = { async attach(sel) { document.querySelector(sel).innerHTML = '<label for="mock-card">Card (test mode)</label><input id="mock-card" value="4111 1111 1111 1111" autocomplete="off">'; },
  async tokenize() { const v = document.getElementById('mock-card').value; return /decline/i.test(v) ? { status: 'OK', token: 'cnon:card-nonce-declined' } : /^[\d ]{12,}$/.test(v) ? { status: 'OK', token: 'cnon:card-nonce-ok' } : { status: 'Invalid', errors: [{ message: 'Card number is invalid.' }] }; } };
async function initPayments() {
  try {
    const Square = await loadSdk();
    if (!Square) { card = mockCard; await card.attach('#card-container'); return; }
    payments = Square.payments(P.squareApplicationId, P.squareLocationId);
    card = await payments.card(); document.getElementById('card-container').innerHTML = ''; await card.attach('#card-container');
    if (P.googlePay) {
      try {
        payReq = payments.paymentRequest({ countryCode: 'US', currencyCode: 'USD', total: { amount: (state.totals ? state.totals.totalCents / 100 : 1).toFixed(2), label: 'Total' } });
        gpay = await payments.googlePay(payReq); await gpay.attach('#gpay-container', { buttonColor: 'black', buttonSizeMode: 'fill', buttonType: 'pay' });
        document.getElementById('gpay-container').addEventListener('click', (e) => { e.preventDefault(); submit(gpay); });
      } catch { gpay = null; document.getElementById('gpay-container').innerHTML = ''; }
    }
  } catch { document.getElementById('card-container').innerHTML = `<p class="alert err">The secure card form couldn't load. Please refresh, or call <a href="tel:${CONFIG.store.phoneE164}">${esc(CONFIG.store.phone)}</a>.</p>`; }
}
function gpayUpdate() { if (payReq && state.totals) payReq.update({ total: { amount: (state.totals.totalCents / 100).toFixed(2), label: 'Total' } }); }

function validate() {
  const f = form, errs = [];
  if (!getCart().length && !state.completed) errs.push('Your cart is empty.');
  if (f.name.value.trim().length < 2) errs.push('Please enter your name.');
  if (!/\d{3}.*\d{3}.*\d{4}/.test(f.phone.value)) errs.push('Please enter a valid phone number.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.value)) errs.push('Please enter a valid email address.');
  if (mode() === 'pickup' && !timeEl.value) errs.push('Please choose a pickup time.');
  if (mode() === 'delivery' && !state.quote) errs.push('Please tap “Check address & delivery time” for your address.');
  if (!f.age.checked) errs.push(`Please confirm you are ${CONFIG.legal.minAge} or older and will show valid photo ID.`);
  return errs;
}
async function submit(method = card) {
  if (state.busy || state.completed) return; // no double submits; nothing to pay once the order is paid
  errEl.hidden = true;
  const errs = validate(); if (errs.length) { showErr(errs); return; }
  if (!state.totals) { showErr('Please wait for your total to load.'); return; }
  state.busy = true; renderSummary(); payBtn.disabled = true; payBtn.textContent = 'Processing…';
  try {
    const f = form, del = mode() === 'delivery', a = address();
    const [given, ...rest] = f.name.value.trim().split(/\s+/);
    const verificationDetails = { amount: (state.totals.totalCents / 100).toFixed(2), currencyCode: 'USD', intent: 'CHARGE', customerInitiated: true, sellerKeyedIn: false,
      billingContact: { givenName: given, familyName: rest.join(' '), email: f.email.value.trim(), phone: f.phone.value.trim(), ...(del ? { addressLines: [a.line1, a.line2].filter(Boolean), city: a.city, state: 'NJ', postalCode: a.zip } : {}), countryCode: 'US' } };
    const tok = method === card ? await card.tokenize(verificationDetails) : await method.tokenize();
    if (tok.status !== 'OK') { showErr((tok.errors || []).map((e) => e.message).filter(Boolean)[0] || 'Please check your card details.'); return; }
    const body = { idempotencyKey: state.idem, sourceId: tok.token, fulfillment: mode(), items: items(), expectedTotalCents: state.totals.totalCents, ageConfirmed: true,
      customer: { name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim() }, notes: f.notes.value.trim(),
      ...(del ? { address: a, quoteToken: state.quote.quoteToken } : { pickupSlot: { date: dayEl.value, start: Number(timeEl.value) } }) };
    let r;
    try { r = await api('/checkout', body); } catch { showErr('Network problem — we could not confirm your order. Please check your email for a receipt before trying again, or call the store.'); return; }
    if (r.ok && r.d && r.d.ok) { done(r.d, { name: f.name.value.trim(), del, address: a }); return; }
    state.idem = crypto.randomUUID(); // definitive failure: next attempt is a new checkout
    if (r.d.error === 'price_changed' && r.d.totals) { state.totals = r.d.totals; showErr(`${r.d.message} New total: ${$c(r.d.totals.totalCents)}.`); }
    else if (['quote_expired', 'quote_mismatch', 'invalid_quote'].includes(r.d.error)) { invalidateQuote(); showErr(r.d.message); }
    else if (r.d.error === 'cart_changed') cartProblem(r.d);
    else showErr(r.d.message || 'Payment failed. Your card was not charged.');
  } finally { state.busy = false; renderSummary(); }
}
function done(d, ctx = {}) {
  // Payment succeeded: build the confirmation from the SERVER response (Square totals), persist it, empty the cart, swap the screen.
  const t = d.totals || {};
  const conf = { ref: d.ref, orderId: d.orderId || null, at: new Date().toISOString(), fulfillment: d.fulfillment, name: ctx.name || '',
    lines: (d.lines || state.lines || []).map((l) => ({ name: l.name, size: l.size || '', qty: l.qty, lineCents: l.lineCents })),
    totals: { subtotalCents: t.subtotalCents, deliveryFeeCents: t.deliveryFeeCents || 0, taxCents: t.taxCents, totalCents: t.totalCents },
    chargedCents: Number.isInteger(d.chargedCents) ? d.chargedCents : t.totalCents, card: d.card || null, receiptUrl: d.receiptUrl || null,
    pickupAt: d.pickupAt || null, address: d.address || (ctx.del ? ctx.address : null), trackingUrl: d.delivery?.trackingUrl || null };
  state.completed = conf;
  try { sessionStorage.setItem(CONF_KEY, JSON.stringify(conf)); } catch {}
  try { localStorage.setItem('cl_last_order', JSON.stringify({ ref: conf.ref, at: conf.at, fulfillment: conf.fulfillment, totalCents: conf.chargedCents })); } catch {}
  clearCart(); // localStorage + 'cart:change' -> header badge repaints to 0
  clearTimeout(expiryTimer);
  renderConfirmation(conf);
}
function renderConfirmation(c) {
  const st = CONFIG.store, ad = st.address, tz = CONFIG.hours.timezone;
  const when = c.pickupAt ? new Date(c.pickupAt).toLocaleString('en-US', { timeZone: tz, weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  const storeAddr = `${ad.street}, ${ad.locality}, ${ad.region} ${ad.postalCode}`;
  const card = c.card && (c.card.brand || c.card.last4) ? `${esc(String(c.card.brand || 'Card').replace(/_/g, ' '))}${c.card.last4 ? ' ending in ' + esc(c.card.last4) : ''}` : '';
  const del = c.fulfillment === 'delivery', a = c.address;
  wrap.hidden = true; wrap.replaceChildren(); // remove the form + sidebar entirely (no stale Pay button or "Edit cart")
  const el = document.getElementById('confirmation'); el.hidden = false;
  el.innerHTML = `<div class="alert ok conf-head"><h2>Thank you${c.name ? ', ' + esc(c.name.split(/\s+/)[0]) : ''}! Your order is paid.</h2>
  <p>Order reference <strong id="conf-ref">${esc(c.ref)}</strong></p></div>
  <div class="order-box">
   <h3>${del ? 'Delivery' : 'Pickup'}</h3>
   ${del ? `<p id="conf-when">An Uber courier is being assigned now${a ? ` to <strong>${esc([a.line1, a.line2].filter(Boolean).join(', '))}, ${esc(a.city)}, ${esc(a.state || 'NJ')} ${esc(a.zip)}</strong>` : ''}.${c.trackingUrl ? ` <a href="${esc(c.trackingUrl)}" target="_blank" rel="noopener">Track your delivery ↗</a>` : ''} Someone ${CONFIG.legal.minAge}+ with valid photo ID must receive it.</p>`
     : `<p id="conf-when">Pickup: <strong>${esc(when)}</strong>. Bring a valid photo ID (${CONFIG.legal.minAge}+).</p>`}
   <p class="conf-store"><strong>${esc(st.name)}</strong><br>${esc(storeAddr)}<br><a href="tel:${esc(st.phoneE164)}">${esc(st.phone)}</a></p>
  </div>
  <div class="order-box">
   <h3>Your order</h3>
   <ul class="co-lines" id="conf-lines">${c.lines.map((l) => `<li><span>${l.qty} × ${esc(l.name)}${l.size ? ' <small>' + esc(l.size) + '</small>' : ''}</span><span>${$c(l.lineCents)}</span></li>`).join('')}</ul>
   <dl><dt>Subtotal</dt><dd id="conf-subtotal">${$c(c.totals.subtotalCents)}</dd>
   ${del || c.totals.deliveryFeeCents ? `<dt>Delivery</dt><dd id="conf-fee">${c.totals.deliveryFeeCents ? $c(c.totals.deliveryFeeCents) : 'Free'}</dd>` : '<dt>Pickup</dt><dd>Free</dd>'}
   <dt>NJ sales tax</dt><dd id="conf-tax">${$c(c.totals.taxCents)}</dd>
   <dt class="total">Total charged</dt><dd class="total" id="conf-total">${$c(c.chargedCents)}</dd></dl>
   ${card ? `<p id="conf-card">Paid with ${card}.</p>` : ''}${c.receiptUrl ? `<p><a href="${esc(c.receiptUrl)}" target="_blank" rel="noopener">View Square receipt ↗</a></p>` : ''}
  </div>
  <p>Questions? Call <a href="tel:${esc(st.phoneE164)}">${esc(st.phone)}</a> and mention ${esc(c.ref)}.</p>
  <p class="no-print"><a class="btn" id="conf-continue" href="/convenience-liquors-preview/shop/">Continue shopping</a></p>`;
  document.title = `Order ${c.ref} confirmed | ${st.name}`;
  window.scrollTo({ top: 0 }); el.focus({ preventScroll: true });
}

// ---------- wiring ----------
const lastConf = loadConfirmation();
if (!getCart().length && lastConf) { state.completed = lastConf; renderConfirmation(lastConf); } // reload after paying: show it again
else if (!getCart().length) { wrap.innerHTML = `<div class="empty" style="grid-column:1/-1"><h2>Your cart is empty</h2><a class="btn" href="/convenience-liquors-preview/shop/">Start shopping</a></div>`; }
else {
  form.addEventListener('change', (e) => { if (e.target.name === 'fulfillment') setMode(); if (e.target === dayEl) fillSlots(); });
  ['line1', 'line2', 'city', 'zip'].forEach((n) => form[n].addEventListener('input', invalidateQuote));
  quoteBtn.addEventListener('click', getQuote);
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(card); });
  fillSlots(); setMode(); initPayments();
  api('/status').then((r) => {
    if (r.ok && r.d.delivery && !r.d.delivery.available) { delStatus.hidden = false; delStatus.textContent = `Delivery: ${r.d.delivery.reason}`; }
  }).catch(() => {});
}
