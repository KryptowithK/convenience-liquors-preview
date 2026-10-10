// Online checkout: Square Web Payments SDK card + Apple Pay (Safari/iOS only) + optional Google Pay, optional PayPal / Venmo
// (staged: only when config.payments.paypal is present), pickup or Uber Direct delivery.
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
let card = null, gpay = null, applePay = null, payReq = null, payments = null;
const METHOD_LABEL = new Map(); // tokenizer -> label shown on the confirmation ("Apple Pay", "Google Pay")
function loadScript(src, globalName) {
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src;
    s.onload = () => (window[globalName] ? res(window[globalName]) : rej(new Error(globalName))); s.onerror = () => rej(new Error(globalName)); document.head.appendChild(s);
  });
}
function loadSdk() {
  if (P.provider === 'mock') return Promise.resolve(null);
  return loadScript(P.squareEnv === 'sandbox' ? 'https://sandbox.web.squarecdn.com/v1/square.js' : 'https://web.squarecdn.com/v1/square.js', 'Square');
}
// Test-only stand-in (payments.provider = "mock" in a local build): renders a plain field and returns test nonces.
const mockCard = { async attach(sel) { document.querySelector(sel).innerHTML = '<label for="mock-card">Card (test mode)</label><input id="mock-card" value="4111 1111 1111 1111" autocomplete="off">'; },
  async tokenize() { const v = document.getElementById('mock-card').value; return /decline/i.test(v) ? { status: 'OK', token: 'cnon:card-nonce-declined' } : /^[\d ]{12,}$/.test(v) ? { status: 'OK', token: 'cnon:card-nonce-ok' } : { status: 'Invalid', errors: [{ message: 'Card number is invalid.' }] }; } };
const totalReq = () => ({ amount: (state.totals ? state.totals.totalCents / 100 : 1).toFixed(2), label: CONFIG.store.name || 'Total' });
async function initPayments() {
  initPayPal(); // independent of Square (no-op unless PayPal is configured)
  try {
    const Square = await loadSdk();
    if (!Square) { card = mockCard; await card.attach('#card-container'); return; }
    payments = Square.payments(P.squareApplicationId, P.squareLocationId);
    card = await payments.card(); document.getElementById('card-container').innerHTML = ''; await card.attach('#card-container');
    if (P.applePay || P.googlePay) payReq = payments.paymentRequest({ countryCode: 'US', currencyCode: 'USD', total: totalReq() });
    if (P.applePay) {
      // Throws unless the browser supports Apple Pay (Safari on iPhone/iPad/Mac with a card in Wallet) and the domain is registered.
      try {
        applePay = await payments.applePay(payReq); METHOD_LABEL.set(applePay, 'Apple Pay');
        const btn = document.getElementById('apple-pay-button');
        // Apple requires tokenize() to start in the click handler with no await before it (submit() is synchronous up to tokenize).
        btn.addEventListener('click', (e) => { e.preventDefault(); submit(applePay); });
        document.getElementById('applepay-container').hidden = false;
      } catch { applePay = null; }
    }
    if (P.googlePay) {
      try {
        gpay = await payments.googlePay(payReq); METHOD_LABEL.set(gpay, 'Google Pay'); await gpay.attach('#gpay-container', { buttonColor: 'black', buttonSizeMode: 'fill', buttonType: 'pay' });
        document.getElementById('gpay-container').addEventListener('click', (e) => { e.preventDefault(); submit(gpay); });
      } catch { gpay = null; document.getElementById('gpay-container').innerHTML = ''; }
    }
  } catch { document.getElementById('card-container').innerHTML = `<p class="alert err">The secure card form couldn't load. Please refresh, or call <a href="tel:${CONFIG.store.phoneE164}">${esc(CONFIG.store.phone)}</a>.</p>`; }
}
function gpayUpdate() { if (payReq && state.totals) payReq.update({ total: totalReq() }); } // keeps Apple Pay + Google Pay sheets on the server total

// PayPal + Venmo Smart Buttons (staged; rendered only when the build includes payments.paypal, Venmo only with paypal.venmo).
// The Worker creates and captures the PayPal order for the server-priced total and records it in Square, so no prices are sent.
async function initPayPal() {
  const pc = P.paypal; const box = document.getElementById('paypal-container');
  if (!pc || !pc.clientId || !box) return;
  try {
    // Pay Later / guest card funding stay off: cards already go through Square, and alcohol is a restricted category.
    const q = `client-id=${encodeURIComponent(pc.clientId)}&currency=USD&intent=capture&components=buttons${pc.venmo ? '&enable-funding=venmo' : ''}&disable-funding=card,credit,paylater${pc.venmo ? '' : ',venmo'}`;
    const paypal = await loadScript(`https://www.paypal.com/sdk/js?${q}`, 'paypal');
    const sources = [['paypal', 'PayPal', { color: 'gold', label: 'paypal' }], ...(pc.venmo ? [['venmo', 'Venmo', { color: 'blue' }]] : [])];
    let shown = 0;
    for (const [fundingSource, label, look] of sources) {
      const btn = paypal.Buttons(walletButton(fundingSource, label, look));
      if (btn.isEligible && !btn.isEligible()) continue; // e.g. Venmo: US buyer with the Venmo app on a supported browser only
      const el = document.createElement('div'); el.id = `${fundingSource}-button`; el.className = 'wallet-btn'; box.appendChild(el);
      await btn.render(el); shown++;
    }
    box.hidden = !shown;
  } catch { box.hidden = true; box.innerHTML = ''; }
}
function walletButton(fundingSource, label, look) {
  return {
    fundingSource,
    style: { layout: 'horizontal', shape: 'rect', height: 48, tagline: false, ...look },
    onClick: (data, actions) => {
      if (state.busy || state.completed) return actions.reject();
      errEl.hidden = true;
      const errs = validate(); if (!errs.length && !state.totals) errs.push('Please wait for your total to load.');
      if (errs.length) { showErr(errs); return actions.reject(); }
      return actions.resolve();
    },
    createOrder: async () => {
      const r = await api('/paypal/create-order', { ...orderBody(), fundingSource });
      if (!r.ok || !r.d.ok) { failed(r.d, label); throw new Error(r.d.error || 'paypal_create'); }
      if (r.d.totals) { state.totals = r.d.totals; renderSummary(); }
      return r.d.paypalOrderId;
    },
    onApprove: async (data, actions) => {
      if (state.completed) return;
      state.busy = true; renderSummary(); payBtn.textContent = 'Processing…';
      try {
        const f = form, del = mode() === 'delivery';
        let r;
        try { r = await api('/checkout', { ...orderBody(), paymentMethod: 'paypal', fundingSource, paypalOrderId: data.orderID }); }
        catch { showErr('Network problem — we could not confirm your order. Please check your email for a receipt before trying again, or call the store.'); return; }
        if (r.ok && r.d && r.d.ok) { done(r.d, { name: f.name.value.trim(), del, address: address(), method: r.d.paymentMethod === 'venmo' ? 'Venmo' : 'PayPal' }); return; }
        if (r.d.restart) { state.busy = false; return actions.restart(); } // funding source declined: let the buyer pick another one
        failed(r.d, label);
      } finally { state.busy = false; renderSummary(); }
    },
    onCancel: () => {},
    onError: () => { if (errEl.hidden) showErr(`${label} could not complete the payment. You were not charged. Please try again or pay by card.`); },
  };
}

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
function orderBody() {
  const f = form, del = mode() === 'delivery', a = address();
  return { idempotencyKey: state.idem, fulfillment: mode(), items: items(), expectedTotalCents: state.totals?.totalCents, ageConfirmed: true,
    customer: { name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim() }, notes: f.notes.value.trim(),
    ...(del ? { address: a, quoteToken: state.quote?.quoteToken } : { pickupSlot: { date: dayEl.value, start: Number(timeEl.value) } }) };
}
function failed(d, via = 'card') {
  // Definitive failure: next attempt is a new checkout (new idempotency key / order ref).
  if (!['paypal_disabled', 'venmo_disabled'].includes(d.error)) state.idem = crypto.randomUUID();
  if (d.error === 'price_changed' && d.totals) { state.totals = d.totals; showErr(`${d.message} New total: ${$c(d.totals.totalCents)}.`); }
  else if (['quote_expired', 'quote_mismatch', 'invalid_quote'].includes(d.error)) { invalidateQuote(); showErr(d.message); }
  else if (d.error === 'cart_changed') cartProblem(d);
  else showErr(d.message || (via !== 'card' ? `${via} payment failed. You were not charged.` : 'Payment failed. Your card was not charged.'));
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
    // First await: wallet sheets (Apple Pay) must open synchronously from the click.
    const tok = method === card ? await card.tokenize(verificationDetails) : await method.tokenize();
    if (tok.status !== 'OK') { if (method === card || tok.status !== 'Cancel') showErr((tok.errors || []).map((e) => e.message).filter(Boolean)[0] || (method === card ? 'Please check your card details.' : 'The payment was not completed. You were not charged.')); return; }
    const body = { ...orderBody(), sourceId: tok.token };
    let r;
    try { r = await api('/checkout', body); } catch { showErr('Network problem — we could not confirm your order. Please check your email for a receipt before trying again, or call the store.'); return; }
    if (r.ok && r.d && r.d.ok) { done(r.d, { name: f.name.value.trim(), del, address: a, method: METHOD_LABEL.get(method) || null }); return; }
    failed(r.d);
  } finally { state.busy = false; renderSummary(); }
}
function done(d, ctx = {}) {
  // Payment succeeded: build the confirmation from the SERVER response (Square totals), persist it, empty the cart, swap the screen.
  const t = d.totals || {};
  const conf = { ref: d.ref, orderId: d.orderId || null, at: new Date().toISOString(), fulfillment: d.fulfillment, name: ctx.name || '',
    lines: (d.lines || state.lines || []).map((l) => ({ name: l.name, size: l.size || '', qty: l.qty, lineCents: l.lineCents })),
    totals: { subtotalCents: t.subtotalCents, deliveryFeeCents: t.deliveryFeeCents || 0, taxCents: t.taxCents, totalCents: t.totalCents },
    chargedCents: Number.isInteger(d.chargedCents) ? d.chargedCents : t.totalCents, card: d.card || null, method: ctx.method || ({ paypal: 'PayPal', venmo: 'Venmo' }[d.paymentMethod] || null), receiptUrl: d.receiptUrl || null,
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
  const cardTxt = c.card && (c.card.brand || c.card.last4) ? `${esc(String(c.card.brand || 'Card').replace(/_/g, ' '))}${c.card.last4 ? ' ending in ' + esc(c.card.last4) : ''}` : '';
  const card = c.method ? `${esc(c.method)}${cardTxt ? ' (' + cardTxt + ')' : ''}` : cardTxt;
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
