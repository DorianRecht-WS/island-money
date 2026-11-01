const NOTCH_SPEED = 1.35;   // playback speed of the whole animation (1 = as tuned below)
const NOTCH_SPRING = { k: 140, c: 8.5 };   // opening: stiffness and damping, ~30% overshoot, a couple of visible wobbles, settles in ~1 s
function notchGeom(W, H) {
  const r = 13, m = 16, f = 6, R = 15.4 + 5;                     // corner radius, chip centre inset, fillet radius, open bite radius
  const k = Math.sqrt((R + f) ** 2 - (m - f) ** 2), cx = W - m, cy = m, t = R / (R + f);
  const xf = cx - k, yf = Math.min(cy + k, H - r);
  const p1 = [cx + (xf - cx) * t, cy + (f - cy) * t], p2 = [cx + (W - f - cx) * t, cy + k * t];
  return {
    W, H, r,
    closed: [W - r, r, W, r, 1, W, r, 1, W, r],                 // x1 rx1 | x2 y2 rx2 | x3 y3 rx3 | x4 y4
    open: [xf, f, p1[0], p1[1], R, p2[0], p2[1], f, W, yf],
  };
}
function notchPath(g, u, second) {
  const v = g.closed.map((c, i) => (c + (g.open[i] - c) * u).toFixed(2)), { W, H, r } = g;
  const tr = `H ${v[0]} A ${v[1]} ${v[1]} 0 0 1 ${v[2]} ${v[3]} A ${v[4]} ${v[4]} 0 0 0 ${v[5]} ${v[6]} A ${v[7]} ${v[7]} 0 0 1 ${v[8]} ${v[9]}`;
  const n = (x) => x.toFixed(2);
  // the same three arcs turned to another corner, so the outline keeps running clockwise: half a turn gives the bottom-left,
  // a quarter turn the bottom-right
  const half = (x, y) => `${n(W - x)} ${n(H - y)}`, quarter = (x, y) => `${n(W - y)} ${n(H - W + x)}`;
  const arcs = (m) => `A ${v[1]} ${v[1]} 0 0 1 ${m(+v[2], +v[3])} A ${v[4]} ${v[4]} 0 0 0 ${m(+v[5], +v[6])} A ${v[7]} ${v[7]} 0 0 1 ${m(+v[8], +v[9])}`;
  let body;
  if (second === 'bl') body = `${tr} V ${Math.max(H - r, +v[9])} A ${r} ${r} 0 0 1 ${W - r} ${H} H ${n(W - v[0])} ${arcs(half)} V ${Math.min(r, H - v[9])}`;
  else if (second === 'br') body = `${tr} V ${n(Math.max(+v[9], H - W + +v[0]))} ${arcs(quarter)} H ${r} A ${r} ${r} 0 0 1 0 ${H - r} V ${r}`;
  else body = `${tr} V ${Math.max(H - r, +v[9])} A ${r} ${r} 0 0 1 ${W - r} ${H} H ${r} A ${r} ${r} 0 0 1 0 ${H - r} V ${r}`;
  return `path('M ${r} 0 ${body} A ${r} ${r} 0 0 1 ${r} 0 Z')`;
}
const notchState = new WeakMap();
function notchRender(el) {
  const n = notchState.get(el);
  if (!n || !n.g) return;
  el.style.setProperty('--p', notchPath(n.g, n.u, el.dataset.bl === '1' ? 'bl' : el.dataset.br === '1' ? 'br' : ''));
  if (n.chip) n.chip.style.transform = `rotate(${(-12 * n.u).toFixed(2)}deg) scale(${(1 + 0.1 * n.u).toFixed(3)})`;
  if (n.chip2) {
    const c = n.chip2;
    if (c.classList.contains('mx') || c.classList.contains('mplus')) {   // these chips only exist while their card is hovered
      c.style.transform = `rotate(${(90 * n.u).toFixed(2)}deg) scale(${(0.4 + 0.6 * n.u).toFixed(3)})`;
      c.style.opacity = Math.max(0, Math.min(1, n.u * 1.4)).toFixed(3);
      c.style.pointerEvents = n.u > 0.45 ? 'auto' : 'none';   // and cannot be hit by accident while hidden
    } else c.style.transform = `rotate(${(90 * n.u).toFixed(2)}deg) scale(${(1 + 0.1 * n.u).toFixed(3)})`;
  }
}
function notchStep(el) {
  const n = notchState.get(el);
  let last = performance.now();
  const tick = (now) => {
    let dt = Math.min((now - last) / 1000, 0.05) * NOTCH_SPEED; last = now;
    for (; dt > 0; dt -= 1 / 240) {                            // small fixed steps keep the spring stable
      const h = Math.min(dt, 1 / 240);
      n.v += (-NOTCH_SPRING.k * (n.u - n.target) - (n.target ? NOTCH_SPRING.c : 2 * Math.sqrt(NOTCH_SPRING.k)) * n.v) * h;
      n.u = Math.max(0, n.u + n.v * h);
    }
    if (Math.abs(n.u - n.target) < 0.0015 && Math.abs(n.v) < 0.01) { n.u = n.target; n.v = 0; n.raf = 0; notchRender(el); return; }
    notchRender(el);
    n.raf = requestAnimationFrame(tick);
  };
  if (!n.raf) n.raf = requestAnimationFrame(tick);
}
function notchSet(el, open) {
  const n = notchState.get(el);
  n.target = open ? 1 : 0;
  notchStep(el);
}
const notchRO = new ResizeObserver((entries) => {
  for (const e of entries) {
    const n = notchState.get(e.target), W = e.target.offsetWidth, H = e.target.offsetHeight;
    if (!n || !W) continue;
    n.g = notchGeom(W, H);
    notchRender(e.target);
  }
});
// In the app the cards are always notched (a phone has no hover): they start open, and notchReplay springs one open again from closed
// whenever its screen comes into view.
function notchAttach(el) {
  notchState.set(el, { g: null, u: 1, v: 0, target: 1, raf: 0, chip: el.querySelector(':scope > i > svg'), chip2: null });
  notchRO.observe(el);
}
function notchReplay(el) {
  const n = notchState.get(el);
  if (!n) return;
  n.u = 0; n.v = 0; n.target = 1;
  notchStep(el);
}
for (const el of document.querySelectorAll('.notch')) notchAttach(el);
