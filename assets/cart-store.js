// Cart persisted in localStorage. Items keep a snapshot (name/price/size) so the cart renders without the full catalog.
const KEY = 'cl_cart_v1';
export function getCart() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
export function saveCart(c) { localStorage.setItem(KEY, JSON.stringify(c)); window.dispatchEvent(new CustomEvent('cart:change', { detail: c })); }
export function cartCount(c = getCart()) { return c.reduce((a, l) => a + l.qty, 0); }
export function subtotal(c = getCart()) { return Math.round(c.reduce((a, l) => a + l.qty * l.price, 0) * 100) / 100; }
export function addToCart(item, qty = 1) {
  const c = getCart(); const l = c.find((x) => x.sku === item.sku);
  if (l) l.qty = Math.min(99, l.qty + qty); else c.push({ sku: item.sku, slug: item.slug, name: item.name, brand: item.brand, size: item.size, pack: item.pack, price: item.price, sub: item.sub, inStock: item.inStock, img: item.img || null, qty: Math.min(99, qty) });
  saveCart(c); return c;
}
export function setQty(sku, qty) { let c = getCart(); if (qty <= 0) c = c.filter((l) => l.sku !== sku); else { const l = c.find((x) => x.sku === sku); if (l) l.qty = Math.min(99, qty); } saveCart(c); return c; }
export function clearCart() { saveCart([]); }
export const money = (n) => '$' + Number(n).toFixed(2);
