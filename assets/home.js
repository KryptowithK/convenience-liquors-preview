// Homepage: hero carousel (auto-advance, pauses on hover/focus/hidden tab, respects reduced motion) + product rail arrows.
const hero = document.querySelector('.hero');
if (hero) {
  const slides = [...hero.querySelectorAll('.slide')]; const dots = [...hero.querySelectorAll('[data-dot]')];
  let i = 0, timer = null; const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const show = (n) => {
    i = (n + slides.length) % slides.length;
    slides.forEach((s, k) => { const on = k === i; s.classList.toggle('is-active', on); s.setAttribute('aria-hidden', on ? 'false' : 'true'); s.querySelectorAll('a').forEach((a) => (on ? a.removeAttribute('tabindex') : a.setAttribute('tabindex', '-1'))); });
    dots.forEach((d, k) => (k === i ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current')));
  };
  const play = () => { if (reduce || slides.length < 2) return; clearInterval(timer); timer = setInterval(() => show(i + 1), 6500); };
  const stop = () => clearInterval(timer);
  hero.addEventListener('click', (e) => { const b = e.target.closest('[data-hero],[data-dot]'); if (!b) return; if (b.dataset.dot) show(Number(b.dataset.dot)); else show(i + (b.dataset.hero === 'next' ? 1 : -1)); play(); });
  hero.addEventListener('mouseenter', stop); hero.addEventListener('mouseleave', play);
  hero.addEventListener('focusin', stop); hero.addEventListener('focusout', play);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : play()));
  // swipe on touch
  let x0 = null; hero.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  hero.addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) { show(i + (dx < 0 ? 1 : -1)); play(); } x0 = null; });
  play();
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-rail]'); if (!b) return;
  const r = document.getElementById('rail-' + b.dataset.rail); if (!r) return;
  r.scrollBy({ left: Number(b.dataset.dir) * r.clientWidth * 0.9, behavior: 'smooth' });
});
