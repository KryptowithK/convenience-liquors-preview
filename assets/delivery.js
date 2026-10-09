// Delivery-area check. Pluggable geocoder: 'nominatim' (OpenStreetMap, no key) or 'zip' (ZIP centroid, offline).
// To use Google/Mapbox later, add a geocoder below that returns {lat, lng}.
import { CONFIG } from './config.js';
const D = CONFIG.fulfillment.delivery; const G = CONFIG.store.geo;
export function miles(a, b) { const R = 3958.8, r = (x) => (x * Math.PI) / 180; const dl = r(b.lat - a.lat), dn = r(b.lng - a.lng); const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
let zipTable;
async function zipCentroid(zip) { zipTable ||= await fetch('/convenience-liquors-preview/assets/zip-centroids.json').then((r) => r.json()); const z = zipTable[zip]; return z ? { lat: z[0], lng: z[1] } : null; }
const GEOCODERS = {
  async nominatim({ street, city, zip }) {
    const u = new URL('https://nominatim.openstreetmap.org/search');
    Object.entries({ format: 'jsonv2', limit: '1', countrycodes: 'us', street, city, state: 'NJ', postalcode: zip }).forEach(([k, v]) => v && u.searchParams.set(k, v));
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    try { const r = await fetch(u, { signal: ctl.signal, headers: { Accept: 'application/json' } }); const j = await r.json(); if (j[0]) return { lat: +j[0].lat, lng: +j[0].lon, precise: true, label: j[0].display_name }; } catch {} finally { clearTimeout(t); }
    return null;
  },
  async zip({ zip }) { const c = await zipCentroid(zip); return c ? { ...c, precise: false } : null; },
};
// Hook: window.ConvenienceHooks.geocode can override.
export async function checkAddress(addr) {
  const zip = String(addr.zip || '').trim().slice(0, 5);
  if (!/^\d{5}$/.test(zip)) return { ok: false, reason: 'Please enter a valid 5-digit ZIP code.' };
  if (D.mode === 'zips') { const ok = D.allowedZips.includes(zip); return { ok, method: 'zip-list', reason: ok ? '' : `Sorry, we don't deliver to ${zip} yet.` }; }
  let loc = null;
  if (window.ConvenienceHooks?.geocode) loc = await window.ConvenienceHooks.geocode(addr);
  if (!loc && D.geocoder === 'nominatim' && addr.street) loc = await GEOCODERS.nominatim({ ...addr, zip });
  // sanity: a precise geocode must land in the ZIP's area (guards against bad matches)
  const zc = await zipCentroid(zip);
  if (loc && zc && miles(loc, zc) > 8) loc = null;
  if (!loc) loc = await GEOCODERS.zip({ zip });
  if (!loc) return { ok: false, method: 'none', reason: `Sorry, ${zip} is outside our ${D.radiusMiles}-mile delivery area.` };
  const dist = miles(G, loc); const ok = dist <= D.radiusMiles;
  return { ok, distance: Math.round(dist * 10) / 10, method: loc.precise ? 'address' : 'zip-centroid', reason: ok ? '' : `That address is about ${dist.toFixed(1)} miles from the store — outside our ${D.radiusMiles}-mile delivery area.` };
}
