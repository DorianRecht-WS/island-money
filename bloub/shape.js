import { TAU, lerp, r2 } from './math.js';
import { PROFILES, PROFILE_SAMPLES } from './profiles.js';
const ANGLES = Array.from({
    length: PROFILE_SAMPLES
}, (_, i)=>i / PROFILE_SAMPLES * TAU);
const COS = ANGLES.map(Math.cos);
const SIN = ANGLES.map(Math.sin);
export function silhouette(name, pose = {}) {
    return {
        radii: [
            ...PROFILES[name]
        ],
        rot: 0,
        cx: 0,
        cy: 0,
        sx: 1,
        sy: 1,
        ...pose
    };
}
export function circle(radius, pose = {}) {
    return {
        radii: new Array(PROFILE_SAMPLES).fill(radius),
        rot: 0,
        cx: 0,
        cy: 0,
        sx: 1,
        sy: 1,
        ...pose
    };
}
export function blend(a, b, t, out) {
    const dst = out ?? {
        radii: new Array(PROFILE_SAMPLES),
        rot: 0,
        cx: 0,
        cy: 0,
        sx: 1,
        sy: 1
    };
    for(let i = 0; i < PROFILE_SAMPLES; i++){
        dst.radii[i] = lerp(a.radii[i] ?? 1, b.radii[i] ?? 1, t);
    }
    let dRot = b.rot - a.rot;
    while(dRot > Math.PI)dRot -= TAU;
    while(dRot < -Math.PI)dRot += TAU;
    dst.rot = a.rot + dRot * t;
    dst.cx = lerp(a.cx, b.cx, t);
    dst.cy = lerp(a.cy, b.cy, t);
    dst.sx = lerp(a.sx, b.sx, t);
    dst.sy = lerp(a.sy, b.sy, t);
    return dst;
}
export function toPoints(s, scale, out = []) {
    const cr = Math.cos(s.rot);
    const sr = Math.sin(s.rot);
    for(let i = 0; i < PROFILE_SAMPLES; i++){
        const r = s.radii[i] ?? 1;
        const x = r * (COS[i] ?? 0);
        const y = r * (SIN[i] ?? 0);
        const rx = x * cr - y * sr;
        const ry = x * sr + y * cr;
        const p = out[i] ?? {
            x: 0,
            y: 0
        };
        p.x = (rx * s.sx + s.cx) * scale;
        p.y = (ry * s.sy + s.cy) * scale;
        out[i] = p;
    }
    out.length = PROFILE_SAMPLES;
    return out;
}
export function closedPath(pts, tension = 1 / 6) {
    const n = pts.length;
    if (n < 3) return '';
    const first = pts[0];
    let d = `M${r2(first.x)} ${r2(first.y)}`;
    for(let i = 0; i < n; i++){
        const p0 = pts[(i - 1 + n) % n];
        const p1 = pts[i];
        const p2 = pts[(i + 1) % n];
        const p3 = pts[(i + 2) % n];
        const c1x = p1.x + (p2.x - p0.x) * tension;
        const c1y = p1.y + (p2.y - p0.y) * tension;
        const c2x = p2.x - (p3.x - p1.x) * tension;
        const c2y = p2.y - (p3.y - p1.y) * tension;
        d += `C${r2(c1x)} ${r2(c1y)} ${r2(c2x)} ${r2(c2y)} ${r2(p2.x)} ${r2(p2.y)}`;
    }
    return `${d}Z`;
}
export function profileFromPolygon(poly, cx, cy) {
    const radii = new Array(PROFILE_SAMPLES).fill(0);
    const n = poly.length;
    for(let k = 0; k < PROFILE_SAMPLES; k++){
        const dx = COS[k] ?? 0;
        const dy = SIN[k] ?? 0;
        let best = 0;
        for(let i = 0; i < n; i++){
            const a = poly[i];
            const b = poly[(i + 1) % n];
            const ex = b.x - a.x;
            const ey = b.y - a.y;
            const den = dx * ey - dy * ex;
            if (Math.abs(den) < 1e-9) continue;
            const px = a.x - cx;
            const py = a.y - cy;
            const t = (px * ey - py * ex) / den;
            const u = (px * dy - py * dx) / den;
            if (t > best && u >= 0 && u <= 1) best = t;
        }
        radii[k] = best;
    }
    return radii;
}
export function hullOfCircles(x1, y1, r1, x2, y2, r2v, steps = 96) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy) || 1e-6;
    const base = Math.atan2(dy, dx);
    const spread = Math.acos(Math.max(-1, Math.min(1, (r1 - r2v) / dist)));
    const pts = [];
    for(let i = 0; i <= steps / 2; i++){
        const a = base + spread + (TAU - 2 * spread) * i / (steps / 2);
        pts.push({
            x: x1 + Math.cos(a) * r1,
            y: y1 + Math.sin(a) * r1
        });
    }
    for(let i = 0; i <= steps / 2; i++){
        const a = base - spread + 2 * spread * i / (steps / 2);
        pts.push({
            x: x2 + Math.cos(a) * r2v,
            y: y2 + Math.sin(a) * r2v
        });
    }
    return pts;
}
export function radiusAtAngle(radii, angle) {
    const n = radii.length;
    const t = (angle / TAU % 1 + 1) % 1 * n;
    const i = Math.floor(t);
    return lerp(radii[i % n] ?? 1, radii[(i + 1) % n] ?? 1, t - i);
}
export function superellipseProfile(n, sx = 1, sy = 1) {
    return ANGLES.map((_, i)=>{
        const c = Math.abs((COS[i] ?? 0) / sx) ** n;
        const s = Math.abs((SIN[i] ?? 0) / sy) ** n;
        return (c + s) ** (-1 / n);
    });
}
export function unionOfCirclesProfile(circles) {
    const out = new Array(PROFILE_SAMPLES).fill(0);
    for(let i = 0; i < PROFILE_SAMPLES; i++){
        const dx = COS[i] ?? 0;
        const dy = SIN[i] ?? 0;
        let best = 0;
        for (const c of circles){
            const b = dx * c.x + dy * c.y;
            const disc = b * b - (c.x * c.x + c.y * c.y - c.r * c.r);
            if (disc < 0) continue;
            const t = b + Math.sqrt(disc);
            if (t > best) best = t;
        }
        out[i] = best;
    }
    return out;
}
function roundedPolygon(verts, rc, arcSteps = 10) {
    const n = verts.length;
    const out = [];
    const normal = (a, b)=>{
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        return Math.atan2(-dx / len, dy / len);
    };
    for(let i = 0; i < n; i++){
        const prev = verts[(i - 1 + n) % n];
        const cur = verts[i];
        const next = verts[(i + 1) % n];
        const a0 = normal(prev, cur);
        const a1 = normal(cur, next);
        let d = a1 - a0;
        while(d > Math.PI)d -= TAU;
        while(d < -Math.PI)d += TAU;
        for(let k = 0; k <= arcSteps; k++){
            const a = a0 + d * k / arcSteps;
            out.push({
                x: cur.x + Math.cos(a) * rc,
                y: cur.y + Math.sin(a) * rc
            });
        }
    }
    return out;
}
export function regularPolygonProfile(sides, radius, rc, rotationDeg = 0) {
    const rot = rotationDeg * Math.PI / 180;
    const verts = Array.from({
        length: sides
    }, (_, i)=>{
        const a = rot + i / sides * TAU;
        return {
            x: Math.cos(a) * (radius - rc),
            y: Math.sin(a) * (radius - rc)
        };
    });
    return profileFromPolygon(roundedPolygon(verts, rc), 0, 0);
}
export function polyPath(pts, scale = 1) {
    if (pts.length < 3) return '';
    let d = '';
    for(let i = 0; i < pts.length; i++){
        const p = pts[i];
        d += `${i === 0 ? 'M' : 'L'}${r2(p.x * scale)} ${r2(p.y * scale)}`;
    }
    return `${d}Z`;
}
export function capsulePath(w, h) {
    const hw = Math.max(w, 0.01) / 2;
    const hh = Math.max(h, 0.01) / 2;
    const r = Math.min(hw, hh);
    return `M${r2(-hw)} ${r2(-hh + r)}` + `A${r2(r)} ${r2(r)} 0 0 1 ${r2(-hw + r)} ${r2(-hh)}` + `L${r2(hw - r)} ${r2(-hh)}` + `A${r2(r)} ${r2(r)} 0 0 1 ${r2(hw)} ${r2(-hh + r)}` + `L${r2(hw)} ${r2(hh - r)}` + `A${r2(r)} ${r2(r)} 0 0 1 ${r2(hw - r)} ${r2(hh)}` + `L${r2(-hw + r)} ${r2(hh)}` + `A${r2(r)} ${r2(r)} 0 0 1 ${r2(-hw)} ${r2(hh - r)}Z`;
}

// Eyes that are not capsules: a cross (dead eyes) and a four-pointed Y2K sparkle. `w`/`h` give the size, like a capsule's.
export function eyeShapePath(shape, w, h) {
    const size = Math.max(w, h, 0.01);
    if (shape === 'cross') {
        const L = size * 0.58, q = size * 0.15;
        const plus = [[q, -L], [q, -q], [L, -q], [L, q], [q, q], [q, L], [-q, L], [-q, q], [-L, q], [-L, -q], [-q, -q], [-q, -L]];
        const k = Math.SQRT1_2;
        return 'M' + plus.map(([x, y]) => `${r2((x - y) * k)} ${r2((x + y) * k)}`).join('L') + 'Z';
    }
    if (shape === 'star') {
        const r = size * 0.62, c = r * 0.16;
        return `M0 ${r2(-r)}Q${r2(c)} ${r2(-c)} ${r2(r)} 0Q${r2(c)} ${r2(c)} 0 ${r2(r)}Q${r2(-c)} ${r2(c)} ${r2(-r)} 0Q${r2(-c)} ${r2(-c)} 0 ${r2(-r)}Z`;
    }
    if (shape === 'codeslash') {   // </> as one eye
        const u = size, part = (pts, dx) => pts.map(([x, y]) => [(x + dx) * u, y * u]);
        const chev = (dx, k) => part([[-0.2 * k, -0.3], [(-0.2 + 0.15) * k, -0.3], [0.2 * k, 0], [(-0.2 + 0.15) * k, 0.3], [-0.2 * k, 0.3], [(0.2 - 0.18) * k, 0]], dx);
        const bar = part([[0.1, -0.3], [0.2, -0.3], [-0.1, 0.3], [-0.2, 0.3]], 0);
        return [chev(-0.42, -1), bar, chev(0.42, 1)].map((pts) => 'M' + pts.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L') + 'Z').join('');
    }
    if (shape === 'branch') {   // the git branch symbol: a stem with two dots, and a branch curving off to a third
        const u = size, ring = (cx, cy, r) => `M${r2((cx + r) * u)} ${r2(cy * u)}A${r2(r * u)} ${r2(r * u)} 0 1 1 ${r2((cx - r) * u)} ${r2(cy * u)}A${r2(r * u)} ${r2(r * u)} 0 1 1 ${r2((cx + r) * u)} ${r2(cy * u)}Z`;
        const stem = [[-0.36, -0.42], [-0.24, -0.42], [-0.24, 0.42], [-0.36, 0.42]].map(([x, y]) => [x * u, y * u]);
        // the branch is a band of constant width along a curve from the stem to the right-hand dot
        const bez = (t) => { const a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3; return [a * -0.30 + b * 0.0 + c * 0.30 + d * 0.30, a * 0.22 + b * 0.22 + c * 0.18 + d * -0.14]; };
        const left = [], right = [];
        for (let i = 0; i <= 14; i++) {
            const t = i / 14, [x, y] = bez(t), [x2, y2] = bez(Math.min(1, t + 0.02)), [x1, y1] = bez(Math.max(0, t - 0.02));
            const dx = x2 - x1, dy = y2 - y1, n = Math.hypot(dx, dy) || 1, nx = -dy / n * 0.06, ny = dx / n * 0.06;
            left.push([(x + nx) * u, (y + ny) * u]); right.push([(x - nx) * u, (y - ny) * u]);
        }
        let band = left.concat(right.reverse());
        const area = band.reduce((a, [x, y], i) => { const [x2, y2] = band[(i + 1) % band.length]; return a + x * y2 - x2 * y; }, 0);
        if (area < 0) band = band.reverse();   // same winding as the stem and the dots, so they merge instead of cancelling
        const poly = (pts) => 'M' + pts.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L') + 'Z';
        return poly(stem) + poly(band) + ring(-0.30, -0.42, 0.14) + ring(-0.30, 0.42, 0.14) + ring(0.30, -0.14, 0.14);
    }
    if (shape === 'dollar') {   // $: an S made of two circular arcs, with a bar through it
        const u = size, W = 0.075, pts = [];
        const arc = (cx, cy, r, a0, a1) => { for (let i = 0; i <= 18; i++) { const a = (a0 + (a1 - a0) * i / 18) * Math.PI / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
        arc(0, -0.2, 0.2, -25, -270);   // over the top of the upper bowl, round the left, to the middle
        arc(0, 0.2, 0.2, -90, 155);     // from the middle round the right of the lower bowl, to the lower left
        const left = [], right = [];
        pts.forEach(([x, y], i) => {
            const [x1, y1] = pts[Math.max(0, i - 1)], [x2, y2] = pts[Math.min(pts.length - 1, i + 1)];
            const dx = x2 - x1, dy = y2 - y1, n = Math.hypot(dx, dy) || 1, nx = -dy / n * W, ny = dx / n * W;
            left.push([(x + nx) * u, (y + ny) * u]); right.push([(x - nx) * u, (y - ny) * u]);
        });
        let band = left.concat(right.reverse());
        const area = band.reduce((a, [x, y], i) => { const [x2, y2] = band[(i + 1) % band.length]; return a + x * y2 - x2 * y; }, 0);
        if (area < 0) band = band.reverse();   // one winding for the S and the bar, so they merge instead of cancelling
        // the bar is two short stubs above and below the S (not a line through it), so no two strokes cross at a small size
        const stub = (y0, y1) => [[-0.06, y0], [0.06, y0], [0.06, y1], [-0.06, y1]].map(([x, y]) => [x * u, y * u]);
        const poly = (q) => 'M' + q.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L') + 'Z';
        return poly(band) + poly(stub(-0.58, -0.36)) + poly(stub(0.36, 0.58));
    }
    if (shape === 'gt' || shape === 'lt') {   // the code eyes: the two angle brackets of </>
        const hw = size * 0.4, hh = size * 0.56, d = size * 0.3;
        const pts = [[-hw, -hh], [-hw + d, -hh], [hw, 0], [-hw + d, hh], [-hw, hh], [hw - d * 1.2, 0]];
        const k = shape === 'lt' ? -1 : 1;
        return 'M' + pts.map(([x, y]) => `${r2(x * k)} ${r2(y)}`).join('L') + 'Z';
    }
    return capsulePath(w, h);
}
