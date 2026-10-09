// Order submission — pluggable. CONFIG.orders.submitMode: 'mailto' | 'webhook' | 'none'.
// Hooks for later: window.ConvenienceHooks = { beforeSubmit(order), submitOrder(order) -> {ok, ref}, startPayment(order) }.
import { CONFIG } from './config.js';
const money = (n) => '$' + Number(n).toFixed(2);
export function orderText(o) {
  const L = [`ORDER REQUEST ${o.id} — ${CONFIG.store.name}`, `Placed: ${new Date(o.createdAt).toLocaleString('en-US', { timeZone: CONFIG.hours.timezone })} (store time)`, '',
    `Fulfillment: ${o.fulfillment === 'delivery' ? 'LOCAL DELIVERY' : 'IN-STORE PICKUP'}`, `When: ${o.slot.dayLabel}, ${o.slot.timeLabel}`,
    `Customer: ${o.customer.name} · ${o.customer.phone} · ${o.customer.email}`];
  if (o.fulfillment === 'delivery') L.push(`Address: ${o.address.street}${o.address.apt ? ', ' + o.address.apt : ''}, ${o.address.city}, NJ ${o.address.zip} (${o.address.check})`);
  L.push('', 'Items:'); for (const l of o.items) L.push(`  ${l.qty} x ${l.name}${l.size ? ' ' + l.size : ''}${l.pack ? ' ' + l.pack + '-pack' : ''} [#${l.sku}] @ ${money(l.price)} = ${money(l.qty * l.price)}${l.inStock ? '' : ' (REQUEST - out of stock)'}`);
  L.push('', `Subtotal: ${money(o.subtotal)}`); if (o.deliveryFee) L.push(`Delivery fee: ${money(o.deliveryFee)}`); L.push(`Estimated total before tax: ${money(o.total)}`, '');
  if (o.notes) L.push(`Notes: ${o.notes}`, '');
  L.push('Payment: in store at pickup / at the door on delivery. No payment taken online.', `Customer confirmed age ${CONFIG.legal.minAge}+; valid photo ID required.`);
  return L.join('\n');
}
export async function submitOrder(order) {
  const H = window.ConvenienceHooks || {};
  if (H.beforeSubmit) order = (await H.beforeSubmit(order)) || order;
  if (H.submitOrder) return H.submitOrder(order);
  const mode = CONFIG.orders.submitMode;
  if (mode === 'webhook' && CONFIG.orders.webhookUrl) {
    const r = await fetch(CONFIG.orders.webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) });
    return { ok: r.ok, mode, ref: order.id };
  }
  const subject = `Web order request ${order.id} — ${order.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'} ${order.slot.dayLabel} ${order.slot.timeLabel}`;
  const mailto = `mailto:${CONFIG.store.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(orderText(order))}`;
  return { ok: true, mode, ref: order.id, mailto };
}
