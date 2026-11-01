// Vanilla SVG renderer for the bloub engine (see LICENSE and https://github.com/jeremy-prt/bloub).
// Port of BloubBot.vue's template and gaze handling; the engine in this folder is the project's own
// code, transpiled from TypeScript, and is not modified.
import { NOTIF_BLUE } from './decor.js';
import { BotEngine } from './engine.js';
import { EXPRESSION_BY_ID } from './expressions.js';
import { clamp, easings } from './math.js';
import { DEMI_VIEWBOX as VB, RAYON as R } from './repere.js';
import { COLOR_BY_ID, SHAPE_BY_ID, mixHex } from './skins.js';
import { STATE_BY_ID } from './states.js';
import { lookTarget, TURN, TURN_TIME } from './gaze.js';

let uid = 0;

export function createBlob(host, opts = {}) {
  const id = 'bl' + ++uid;
  let paper = opts.paper || '#000000';
  const dir = opts.facing === 'right' ? 1 : -1;   // which way the blob looks when nothing else holds its attention
  let ink = (COLOR_BY_ID.get(opts.color) || COLOR_BY_ID.get('creme')).hex;
  const engine = new BotEngine(R, 'idle', SHAPE_BY_ID.get(opts.shape)?.radii ?? null, EXPRESSION_BY_ID.get(opts.expression) ?? null);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `${-VB} ${-VB} ${VB * 2} ${VB * 2}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.overflow = 'visible';
  svg.style.display = 'block';
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';   // unless the page already positions it
  svg.style.position = 'absolute'; svg.style.left = '0'; svg.style.top = '0';
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:none';
  const g2 = cv.getContext('2d');
  host.appendChild(svg);
  host.appendChild(cv);
  let mode = 'svg';
  const useMode = (m) => { if (m === mode) return; mode = m; cv.style.display = m === 'canvas' ? 'block' : 'none'; svg.style.display = m === 'svg' ? 'block' : 'none'; };
  // the sway tilts whatever is showing
  const tilt = (transform, origin) => { for (const n of [svg, cv]) { if (origin) n.style.transformOrigin = origin; n.style.transform = transform; } };
  const eyePaths = new Map();   // an eye's outline rarely changes, so its Path2D is kept

  const f2 = (v) => Math.round(v * 100) / 100;
  function dot(d) {
    const fill = d.color ?? (d.depth === undefined ? ink : mixHex(paper, ink, d.depth));
    return d.d
      ? `<path d="${d.d}" fill="${fill}" opacity="${d.opacity}" transform="translate(${d.x} ${d.y}) rotate(${d.rot ?? 0}) scale(${R})"/>`
      : `<circle cx="${d.x}" cy="${d.y}" r="${d.r}" fill="${fill}" opacity="${d.opacity}"/>`;
  }

  // Sway: a slow side-to-side rock of the head while audio plays (yaw of the gaze plus a small tilt of the whole
  // face), like someone vibing with their eyes closed.
  let sway = false;

  // Everyday frame on the canvas. The eyes are holes in the body, but the paper behind it is the same black as the pill,
  // so painting them in that black on top looks identical (and anything past the edge is invisible, as it should be).
  function drawCanvas(fr) {
    const dpr = window.devicePixelRatio || 1, w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
    if (!w || !h) return;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const s = w / (VB * 2);
    g2.setTransform(1, 0, 0, 1, 0, 0);
    g2.clearRect(0, 0, w, h);
    g2.setTransform(s, 0, 0, s, VB * s, VB * s);
    g2.globalAlpha = fr.bodyAlpha;
    g2.fillStyle = ink;
    g2.fill(new Path2D(fr.bodyPath));
    g2.fillStyle = paper;
    for (const e of fr.eyes) {
      let p = eyePaths.get(e.d);
      if (!p) { p = new Path2D(e.d); eyePaths.set(e.d, p); if (eyePaths.size > 40) eyePaths.delete(eyePaths.keys().next().value); }
      const m = e.matrix.slice(7, -1).split(',');
      g2.save();
      g2.globalAlpha = e.alpha;
      g2.transform(+m[0], +m[1], +m[2], +m[3], +m[4], +m[5]);
      g2.fill(p);
      g2.restore();
    }
  }

  let eyeSide = 0.5;   // where the eyes sit across the face, 0 (left edge) to 1 (right edge)
  function draw(fr) {
    if (fr.eyes.length) { let x = 0; for (const e of fr.eyes) x += +e.matrix.slice(7, -1).split(',')[4]; eyeSide = 0.5 + x / fr.eyes.length / (VB * 2); }
    if (!fr.arcs.length && !fr.dots.length && !fr.notif && !fr.notch && fr.eyes.length <= 2) { useMode('canvas'); drawCanvas(fr); return; }
    useMode('svg');
    const grads = fr.arcs.map((a) =>
      `<linearGradient id="${id}-${a.id}" gradientUnits="userSpaceOnUse" x1="${a.grad.x1}" y1="${a.grad.y1}" x2="${a.grad.x2}" y2="${a.grad.y2}">` +
      a.grad.stops.map((c, i) => `<stop offset="${i / (a.grad.stops.length - 1)}" stop-color="${c}"/>`).join('') + '</linearGradient>').join('');
    const holes = fr.eyes.map((e) => `<path d="${e.d}" transform="${e.matrix}" opacity="${e.alpha}" fill="#000"/>`).join('') +
      (fr.notch ? `<circle cx="${fr.notch.x}" cy="${fr.notch.y}" r="${fr.notch.r}" fill="#000"/>` : '');
    const arcs = (part, key) => `<g fill="none" stroke-linecap="round">${fr.arcs.map((a) =>
      `<path d="${a[part]}" stroke="url(#${id}-${a.id})" stroke-width="${a.width}" opacity="${a.opacity}"/>`).join('')}</g>`;
    const dots = fr.dots.map(dot).join('');
    svg.innerHTML =
      `<defs><clipPath id="${id}b"><path d="${fr.bodyPath}"/></clipPath><mask id="${id}m" maskUnits="userSpaceOnUse" x="${-VB}" y="${-VB}" width="${VB * 2}" height="${VB * 2}">` +
      `<path d="${fr.bodyPath}" fill="#fff"/>${holes}</mask>${grads}</defs>` +
      arcs('back') +
      (fr.dotsBehind ? `<g>${dots}</g>` : '') +
      `<g opacity="${fr.bodyAlpha}"><path d="${fr.bodyPath}" fill="${paper}"/>` +
      `<g mask="url(#${id}m)"><rect x="${-VB}" y="${-VB}" width="${VB * 2}" height="${VB * 2}" fill="${ink}"/></g></g>` +
      (fr.dotsBehind ? '' : `<g>${dots}</g>`) +
      (fr.notif ? `<circle cx="${fr.notif.x}" cy="${fr.notif.y}" r="${fr.notif.r}" fill="${NOTIF_BLUE}"/>` : '') +
      arcs('front') +
      '';
  }

  // ---- clock: runs only while the island is open
  let clock = 0, last = 0, raf = 0, state = 'idle';
  let pointer = null, aiming = false, turnSince = 0;

  // The blob has a mind of its own: it follows the pointer while that is moving, and otherwise
  // glances around by itself every couple of seconds.
  let pointerAt = 0, glance = { nx: 0, ny: 0 }, nextGlance = 0;
  let focusPt = null;            // something specific to stare at (a dragged or dropped file)
  let leaning = false, busyUntil = 0;
  let turnAt = -10, turnFor = 0;   // turning its back on you: a half turn away, a pause, and back
  const backYaw = () => {
    const t = clock - turnAt;
    if (t < 0 || t > turnFor) return 0;
    const k = t < 0.45 ? t / 0.45 : t > turnFor - 0.45 ? (turnFor - t) / 0.45 : 1;
    return 180 * easings.easeInOutCubic(clamp(k));
  };
  let lastBeat = -10, env = 0, headbang = false;   // head nod: a pulse that decays

  let box = null, boxAt = -10;
  function aim() {
    if (!STATE_BY_ID.get(state)?.baseFace) {
      if (aiming) { engine.setLook(null, clock, TURN_TIME); aiming = false; }
      return;
    }
    if (clock - boxAt > (clock < busyUntil ? 0.04 : 0.4)) { box = host.getBoundingClientRect(); boxAt = clock; }
    if (!box.width) return;
    if (!aiming) turnSince = clock;
    const hw = Math.max(1, window.innerWidth / 2), hh = Math.max(1, window.innerHeight / 2);
    const following = pointer !== null && clock - pointerAt < 2.5;
    // Its own head movement never stops: a new glance every couple of seconds, even while the pointer moves.
    if (clock >= nextGlance) {
      // glances stay mostly on its own side (what it is facing), with the odd look away
      glance = { nx: (Math.random() * 2 - 1) * 0.8 + dir * 0.2, ny: (Math.random() * 2 - 1) * 0.7 };
      nextGlance = clock + 1.2 + Math.random() * 1.8;
    }
    let nx = glance.nx, ny = glance.ny;
    if (focusPt) {   // full attention on the point, no wandering
      // `near` is a point on the blob itself (a click): measured against the blob's own size, so the edge means a full turn
      const sx = focusPt.near ? box.width * 0.4 : hw / 1.4, sy = focusPt.near ? box.height * 0.4 : hh / 1.4;
      nx = clamp((focusPt.x - (box.left + box.width / 2)) / sx, -1, 1);
      ny = clamp((focusPt.y - (box.top + box.height / 2)) / sy, -1, 1);
    } else if (following) {   // the pointer pulls the gaze, the glances still ride on top of it
      nx = clamp((pointer.x - (box.left + box.width / 2)) / hw, -1, 1) * 0.7 + glance.nx * 0.55;
      ny = clamp((pointer.y - (box.top + box.height / 2)) / hh, -1, 1) * 0.7 + glance.ny * 0.55;
    }
    const look = lookTarget({
      nx: clamp(nx, -1, 1), ny: clamp(ny, -1, 1),
      tour: easings.easeOutQuint(clamp((clock - turnSince) / TURN_TIME)),
      pointer: false,
    });
    if (focusPt?.near) {
      // a click: the eyes go to the clicked spot itself (as far across the face as the click was from its middle) and the
      // whole blob leans toward it, as if turning to see what was clicked
      const fx = clamp((focusPt.x - (box.left + box.width / 2)) / (box.width / 2), -1, 1) * 0.9;
      const fy = clamp((focusPt.y - (box.top + box.height / 2)) / (box.height / 2), -1, 1) * 0.9;
      look.yaw = -(dir + 1) * TURN + Math.asin(fx) * 180 / Math.PI;   // undo the resting turn added below: this one is absolute
      look.pitch = -Math.asin(fy) * 180 / Math.PI;
      if (!sway) { tilt(`rotate(${(fx * 9).toFixed(2)}deg)`, '50% 62%'); leaning = true; }
    } else if (leaning && !sway) { tilt(''); leaning = false; }
    look.yaw += backYaw();
    look.wander = focusPt ? 0 : 1;   // keep the engine's own gaze drift going while following too
    // headbang: the head itself tilts down on each hit and rocks back up in between (no body movement)
    look.pitch += (headbang ? 9 : 0) - env * 32;
    if (sway) look.yaw += Math.sin(clock * 2.8) * 9;   // about 0.45 swings a second
    look.yaw += (dir + 1) * TURN;     // lookTarget rests turned left; shift by 2*TURN to face right
    engine.setLook(look, clock);
    aiming = true;
  }

  // Every presented frame costs the transparent window a lot (about 1.3% of a core per frame per second), so the
  // blob runs at the full 60 fps only while something quick is happening (a nod, following the pointer, staring at a
  // file, a one-off flourish) and at a steady 30 fps otherwise: the slow drift, the blink and the music sway look the
  // same at 30, and the pacing stays even, which is what reads as smooth.
  let drawnAt = 0;
  function tick(ms) {
    raf = requestAnimationFrame(tick);
    const quick = clock - lastBeat < 0.9 || clock < busyUntil || clock - turnAt < turnFor || focusPt || timer || (pointer && clock - pointerAt < 0.6);
    if (!quick && ms - drawnAt < 28) return;
    drawnAt = ms;
    clock += last ? Math.min((ms - last) / 1000, 0.064) : 0;
    last = ms;
    if (sway) tilt(`rotate(${(Math.sin(clock * 2.8 + 0.9) * 6).toFixed(2)}deg)`, '50% 62%');
    env = clock - lastBeat < 1.2 ? Math.exp(-(clock - lastBeat) / 0.18) : 0;
    aim();
    draw(engine.sample(clock));
  }
  function start() { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  // ---- public API
  let base = 'idle', timer = 0;
  function setState(next) {
    if (next === state) return;
    state = next;
    engine.setState(next, clock);
    if (!raf) draw(engine.sample(clock));
  }
  // Show a state for `seconds`, then go back to the base state.
  function play(next, seconds) {
    clearTimeout(timer);
    setState(next);
    timer = setTimeout(() => setState(base), seconds * 1000);
  }
  function setBase(next) { base = next; if (!timer) setState(next); }
  draw(engine.sample(0));

  return {
    start, stop, play, setBase, setState,
    get state() { return state; },
    setSway(on) { sway = on; if (!on) tilt(''); },
    pulse() { lastBeat = clock; },
    get eyeSide() { return eyeSide; },
    setColors(inkHex, paperHex) { ink = inkHex; paper = paperHex; if (!raf) draw(engine.sample(clock)); },
    busy(seconds) { busyUntil = clock + seconds; },   // something is moving the whole blob: draw at full rate for a moment
    turnAround(seconds) { turnAt = clock; turnFor = seconds; },
    setHeadbang(on) { headbang = on; },
    focus(x, y, near = false) { focusPt = x == null ? null : { x, y, near }; },
    look(x, y) {
      if (x == null) { pointer = null; return; }
      if (!pointer || pointer.x !== x || pointer.y !== y) pointerAt = clock;
      pointer = { x, y };
    },

    setColor(c) { ink = (COLOR_BY_ID.get(c) || COLOR_BY_ID.get('creme')).hex; if (!raf) draw(engine.sample(clock)); },
    setExpression(e) { engine.setExpression(EXPRESSION_BY_ID.get(e) ?? null, clock); },
    setShape(s) { engine.setShape(SHAPE_BY_ID.get(s)?.radii ?? null, clock); },
    clearHold() { clearTimeout(timer); timer = 0; setState(base); },
  };
}
