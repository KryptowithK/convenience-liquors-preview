// Pickup / delivery time slots limited to store hours; last slot ends `lastSlotMinutesBeforeClose` before closing.
import { CONFIG } from './config.js';
const H = CONFIG.hours;
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export const fmt = (min) => { const h = Math.floor(min / 60), m = min % 60; return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
// Store-local "now" (America/New_York) regardless of the visitor's timezone.
export function storeNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: H.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { y: +parts.year, mo: +parts.month, d: +parts.day, min: (+parts.hour % 24) * 60 + +parts.minute };
}
/** kind: 'pickup' (slotLengthMinutes starts) | 'delivery' (60-minute windows) */
export function buildSlots(kind = 'pickup', now = storeNow()) {
  const days = []; const base = new Date(Date.UTC(now.y, now.mo - 1, now.d));
  const len = kind === 'delivery' ? 60 : H.slotLengthMinutes; const step = H.slotLengthMinutes;
  for (let i = 0; i <= H.daysAhead; i++) {
    const dt = new Date(base.getTime() + i * 864e5); const dow = dt.getUTCDay(); const day = H.days[dow];
    if (!day || day.closed) continue;
    const open = toMin(day.open), lastEnd = toMin(day.close) - H.lastSlotMinutesBeforeClose;
    let start = open; if (i === 0) { const earliest = now.min + H.minLeadMinutes; start = Math.max(open, Math.ceil(earliest / step) * step); }
    const slots = [];
    for (let s = start; kind === 'delivery' ? s + len <= lastEnd : s <= lastEnd; s += step) slots.push({ start: s, end: kind === 'delivery' ? s + len : null, label: kind === 'delivery' ? `${fmt(s)} – ${fmt(s + len)}` : fmt(s) });
    if (!slots.length) continue;
    const iso = dt.toISOString().slice(0, 10);
    const label = (i === 0 ? 'Today, ' : i === 1 ? 'Tomorrow, ' : '') + dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
    days.push({ iso, label, dow, hours: `${fmt(open)} – ${fmt(toMin(day.close))}`, slots });
  }
  return days;
}
