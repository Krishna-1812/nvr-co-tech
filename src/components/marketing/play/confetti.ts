/*
 * Shared by the public site's calls to action (Play) and the app's moments of
 * real success (celebrate): a voucher approved, a reconciliation that ties.
 */

/* ── Confetti ──────────────────────────────────────────────────────────── */

/**
 * A handful of desert shapes thrown up from a point, pulled down by gravity,
 * and removed. Plain elements on a fixed layer, not a canvas, and the layer
 * ignores the pointer, so nothing it draws can be in the way of a click.
 *
 * The colours are read from the skin's own tokens at the moment of throwing,
 * so they are the page's colours by construction rather than a second copy of
 * them here.
 */
export function confetti(x: number, y: number, n = 44) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Thrown inside the public site's skin when there is one, so the colours
  // resolve in its light scheme whatever theme the app is set to.
  const host = document.querySelector<HTMLElement>('[data-skin]') ?? document.body;
  const css = getComputedStyle(host);
  const colours = ['--p-band-1', '--p-band-2', '--h-cyan', '--p-band-4', '--lc-borrow']
    .map((v) => css.getPropertyValue(v).trim())
    .filter(Boolean);
  const shapes = ['9999px', '9999px 9999px 0 0', '2px', '9999px 0'];

  const layer = document.createElement('div');
  layer.className = 'm-confetti';
  layer.setAttribute('aria-hidden', 'true');

  const bits = Array.from({ length: n }, (_, k) => {
    const b = document.createElement('i');
    const size = 6 + Math.random() * 7;
    b.style.width = `${size}px`;
    b.style.height = `${size * (k % 4 === 1 ? 1.3 : 1)}px`;
    b.style.background = colours[k % colours.length];
    b.style.borderRadius = shapes[k % shapes.length];
    layer.appendChild(b);
    const a = ((-90 + (Math.random() - 0.5) * 120) * Math.PI) / 180;
    const v = 6 + Math.random() * 9;
    return { el: b, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 360, vr: (Math.random() - 0.5) * 22 };
  });
  host.appendChild(layer);

  const t0 = performance.now();
  const step = (now: number) => {
    const life = (now - t0) / 1500;
    for (const p of bits) {
      p.vy += 0.4;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      p.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) rotate(${p.r.toFixed(0)}deg)`;
      p.el.style.opacity = life > 0.7 ? (1 - (life - 0.7) / 0.3).toFixed(2) : '1';
    }
    if (life < 1) requestAnimationFrame(step);
    else layer.remove();
  };
  requestAnimationFrame(step);
}

/**
 * Confetti from the middle of an element, or from the middle of the screen when
 * there is none to hand (an action that finished after its button went away).
 */
export function celebrate(from?: Element | null, n = 56) {
  const r = from?.getBoundingClientRect();
  if (r && r.width) confetti(r.left + r.width / 2, r.top + r.height / 2, n);
  else confetti(window.innerWidth / 2, window.innerHeight * 0.45, n);
}
