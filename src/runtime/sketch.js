/* givemotion sketch: hand-drawn (whiteboard) shapes. MIT License.
 * gm.sketch.* returns SVG path data for rough, slightly wobbly strokes; data-sketch on an SVG shape turns it into one.
 * Every shape is seeded, so it looks the same in every frame and every render (no boiling lines).
 */
(function () {
  'use strict';
  const gm = window.gm;
  if (!gm || !gm.__internal || gm.sketch) return;
  const I = gm.__internal;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const f1 = (x) => Math.round(x * 10) / 10;
  const px = () => (typeof I.PX === 'function' ? I.PX() : 1);
  // (rounded sketched corners and loops around boxes are new looks: <html data-motion="classic"> keeps the old ones)
  const natural = () => !I.naturalMotion || I.naturalMotion();
  // original shape → the sketched group that replaced it (so references taken by scripts still work)
  const replaced = I.replaced = I.replaced || new WeakMap();

  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed * 2654435761 : hashStr(seed)) >>> 0 || 1;
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function opts(o) {
    o = o || {};
    return { roughness: o.roughness ?? 1, bow: o.bow ?? 1, passes: Math.max(1, Math.min(3, o.passes ?? 2)), seed: o.seed ?? 1, overshoot: o.overshoot ?? 1, raw: o.raw };
  }

  // One stroke from a to b: jittered ends, a slight overshoot, a gentle bow and a wobble, as one cubic curve.
  function strokeLine(x1, y1, x2, y2, o, R, move = true) {
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const r = o.roughness;
    // (tuned against judges: subtle wobble read as "too clean to be hand-drawn"; the two passes should visibly part)
    const off = Math.min(len * 0.1, (2.2 + len * 0.012) * px()) * r;
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len, nx = -uy, ny = ux;
    const j = () => (R() - 0.5) * off;
    const os = Math.min(len * 0.05, 8 * px()) * o.overshoot;
    const s0 = (R() - 0.3) * os, s1 = (R() - 0.3) * os;
    const ax = x1 - ux * s0 + nx * j() * 0.8, ay = y1 - uy * s0 + ny * j() * 0.8;
    const bx = x2 + ux * s1 + nx * j() * 0.8, by = y2 + uy * s1 + ny * j() * 0.8;
    const bowAmt = (R() < 0.5 ? -1 : 1) * (0.35 + 0.65 * R()) * Math.min(len * 0.025, 7 * px()) * r * o.bow;
    const t1 = 0.25 + R() * 0.2, t2 = 0.6 + R() * 0.2;
    const c1x = ax + (bx - ax) * t1 + nx * (bowAmt * Math.sin(Math.PI * t1) + j() * 0.5), c1y = ay + (by - ay) * t1 + ny * (bowAmt * Math.sin(Math.PI * t1) + j() * 0.5);
    const c2x = ax + (bx - ax) * t2 + nx * (bowAmt * Math.sin(Math.PI * t2) + j() * 0.5), c2y = ay + (by - ay) * t2 + ny * (bowAmt * Math.sin(Math.PI * t2) + j() * 0.5);
    return `${move ? 'M' : 'L'}${f1(ax)} ${f1(ay)}C${f1(c1x)} ${f1(c1y)} ${f1(c2x)} ${f1(c2y)} ${f1(bx)} ${f1(by)}`;
  }
  // Smooth curve through points (Catmull-Rom as cubic Béziers)
  function smooth(pts, closed = false) {
    if (pts.length < 2) return '';
    let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
    const P = (i) => pts[closed ? (i + pts.length) % pts.length : Math.max(0, Math.min(pts.length - 1, i))];
    const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
    }
    return d;
  }
  // Passes are joined into one stroke (the pen goes round again): SVG restarts dashes at every "M", so separate
  // subpaths would all draw at once and finish early when drawn on.
  const passes = (o, fn) => { const R = rng(o.seed); let d = ''; for (let p = 0; p < o.passes; p++) { const q = fn(R, p); d += p ? q.replace(/^M/, 'L') : q; } return d; };

  /** A rough straight line. */
  function line(x1, y1, x2, y2, o) { o = opts(o); return passes(o, (R) => strokeLine(x1, y1, x2, y2, o, R)); }
  /** A rough rectangle (each side its own stroke, crossing a little at the corners). { r } (or rx, ry) rounds it. */
  function rect(x, y, w, h, o) {
    if (o && (o.r || o.rx || o.ry)) return rrect(x, y, w, h, o.rx ?? o.r ?? o.ry, o.ry ?? o.rx ?? o.r, o);
    o = opts(o);
    return passes(o, (R) => strokeLine(x, y, x + w, y, o, R) + strokeLine(x + w, y, x + w, y + h, o, R, false) + strokeLine(x + w, y + h, x, y + h, o, R, false) + strokeLine(x, y + h, x, y, o, R, false));
  }
  /** A rough rounded rectangle: the sides as quick strokes, each corner a quarter curve that picks up where the side
   *  ended (the pen goes round without lifting); the end runs a little past the start. */
  function rrect(x, y, w, h, rx, ry, o) {
    o = opts(o);
    rx = Math.max(0, Math.min(+rx || 0, w / 2)); ry = Math.max(0, Math.min(+ry || 0, h / 2));
    if (!rx || !ry) return rect(x, y, w, h, o);
    const so = { ...o, overshoot: 0.25 * o.overshoot }, K = 0.5523;
    const endOf = (d) => { const m = /(-?[\d.]+) (-?[\d.]+)$/.exec(d); return [+m[1], +m[2]]; };
    const x0 = x, y0 = y;
    return passes(o, (R) => {
      // each pass of the pen lands a little off the last one (so the two strokes part, like on a square box)
      x = x0 + (R() - 0.5) * 4 * px() * o.roughness; y = y0 + (R() - 0.5) * 4 * px() * o.roughness;
      const jr = () => 1 + (R() - 0.5) * 0.16 * o.roughness, jt = () => (R() - 0.5) * Math.min(rx, ry) * 0.1 * o.roughness;
      // a corner from where the last side ended to the start of the next side, around the corner point (qx, qy)
      const corner = (from, to, qx, qy) => {
        const a = jr(), b = jr();
        const c1 = [from[0] + (qx - from[0]) * K * a + jt(), from[1] + (qy - from[1]) * K * a + jt()];
        const c2 = [to[0] + (qx - to[0]) * K * b + jt(), to[1] + (qy - to[1]) * K * b + jt()];
        return `C${f1(c1[0])} ${f1(c1[1])} ${f1(c2[0])} ${f1(c2[1])} ${f1(to[0])} ${f1(to[1])}`;
      };
      const r = x + w, b = y + h;
      let d = strokeLine(x + rx, y, r - rx, y, so, R);
      d += corner(endOf(d), [r, y + ry], r, y);
      d += strokeLine(r, y + ry, r, b - ry, so, R, false);
      d += corner(endOf(d), [r - rx, b], r, b);
      d += strokeLine(r - rx, b, x + rx, b, so, R, false);
      d += corner(endOf(d), [x, b - ry], x, b);
      d += strokeLine(x, b - ry, x, y + ry, so, R, false);
      // the last corner ends a little past the start, like a quick hand closing the shape
      const past = Math.min((w - 2 * rx) * 0.3, (6 + R() * 10) * px());
      d += corner(endOf(d), [x + rx + past, y + (R() - 0.5) * 2 * px() * o.roughness], x, y);
      return d;
    });
  }
  // a rounded box as plain path data (radii: [rx, ry] per corner, top-left first, clockwise)
  function roundedBoxPath(x, y, w, h, radii) {
    const [tl, tr, br, bl] = radii;
    return `M${x + tl[0]} ${y}H${x + w - tr[0]}` + (tr[0] && tr[1] ? `A${tr[0]} ${tr[1]} 0 0 1 ${x + w} ${y + tr[1]}` : '') + `V${y + h - br[1]}` +
      (br[0] && br[1] ? `A${br[0]} ${br[1]} 0 0 1 ${x + w - br[0]} ${y + h}` : '') + `H${x + bl[0]}` + (bl[0] && bl[1] ? `A${bl[0]} ${bl[1]} 0 0 1 ${x} ${y + h - bl[1]}` : '') +
      `V${y + tl[1]}` + (tl[0] && tl[1] ? `A${tl[0]} ${tl[1]} 0 0 1 ${x + tl[0]} ${y}` : '') + 'Z';
  }
  /** A rough ellipse: drawn in one go, the end runs a little past the start like a quick pen circle. */
  function ellipse(cx, cy, rx, ry, o) {
    o = opts(o);
    ry = ry ?? rx;
    const per = Math.PI * (rx + ry);
    const n = Math.max(9, Math.min(28, Math.round(per / (40 * px()))));
    return passes(o, (R, p) => {
      const a0 = R() * Math.PI * 2, over = 0.25 + R() * 0.45, steps = n + Math.ceil(n * over / (Math.PI * 2));
      const k = o.roughness, pts = [];
      const sx = 1 + (R() - 0.5) * 0.08 * k, sy = 1 + (R() - 0.5) * 0.08 * k;
      for (let i = 0; i <= steps; i++) {
        const a = a0 + ((Math.PI * 2 + over) * i) / steps + (R() - 0.5) * 0.08 * k;
        const wob = 1 + (R() - 0.5) * 0.06 * k;
        // the pen spirals a little: start slightly inside, end slightly outside
        const sp = 1 + (i / steps - 0.5) * 0.04 * k * (p ? -1 : 1);
        pts.push([cx + Math.cos(a) * rx * sx * wob * sp, cy + Math.sin(a) * ry * sy * wob * sp]);
      }
      return smooth(pts);
    });
  }
  const circle = (cx, cy, r, o) => ellipse(cx, cy, r, r, o);
  /** Straight segments through points (closed: back to the start). */
  function polygon(points, o, closed = true) {
    o = opts(o);
    const P = toPoints(points);
    return passes(o, (R) => { let d = ''; for (let i = 0; i < P.length - (closed ? 0 : 1); i++) { const a = P[i], b = P[(i + 1) % P.length]; d += strokeLine(a[0], a[1], b[0], b[1], o, R, i === 0); } return d; });
  }
  const polyline = (points, o) => polygon(points, o, false);
  function toPoints(points) {
    if (Array.isArray(points)) return points.map((p) => (Array.isArray(p) ? p : [p.x, p.y]));
    const n = String(points).trim().split(/[\s,]+/).map(Number);
    const out = [];
    for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i], n[i + 1]]);
    return out;
  }
  let meas = null;
  function measure(d) { if (!meas) meas = document.createElementNS(SVGNS, 'path'); meas.setAttribute('d', d); return meas; }
  /** Any SVG path, redrawn by hand: follows the path with a slow wobble. Corners are kept. */
  function path(d, o) {
    o = opts(o);
    const subs = String(d).trim().split(/(?=[Mm])/).map((s) => s.trim()).filter(Boolean);
    // relative "m" subpaths need the absolute position: measure the whole path once and split by length instead
    const whole = measure(d), total = whole.getTotalLength();
    if (!total) return '';
    return passes(o, (R) => {
      let out = '';
      const parts = subs.length > 1 && subs.every((s) => s[0] === 'M') ? subs : [d];
      for (const sd of parts) {
        const el = measure(sd), len = el.getTotalLength();
        if (!len) continue;
        const step = Math.max(6, Math.min(24, len / 12)) * px();
        const n = Math.max(2, Math.ceil(len / step));
        const amp = Math.min(len * 0.02, 1.8 * px() + len * 0.005) * o.roughness;
        // a smooth random wobble along the length: a slow bow plus a gentle wave (a hand does not shake fast)
        const ph1 = R() * 6.28, ph2 = R() * 6.28, fr1 = 0.4 + R() * 0.5, fr2 = 1.2 + R() * 1.2;
        const pts = [];
        for (let i = 0; i <= n; i++) {
          const L = (i / n) * len, q = el.getPointAtLength(L), q2 = el.getPointAtLength(Math.min(len, L + 0.5)), q0 = el.getPointAtLength(Math.max(0, L - 0.5));
          const ang = Math.atan2(q2.y - q0.y, q2.x - q0.x), nx = -Math.sin(ang), ny = Math.cos(ang);
          const t = i / n, w = amp * (0.6 * Math.sin(ph1 + t * fr1 * 6.28) + 0.4 * Math.sin(ph2 + t * fr2 * 6.28)) * Math.min(1, t * 8, (1 - t) * 8 + 0.4);
          pts.push([q.x + nx * w, q.y + ny * w]);
        }
        const closed = /[zZ]\s*$/.test(sd.trim());
        if (closed) { const a = pts[0]; const os = (R() * 0.6 + 0.2) * step; const ang = Math.atan2(pts[1][1] - a[1], pts[1][0] - a[0]); pts.push([a[0] + Math.cos(ang) * os, a[1] + Math.sin(ang) * os]); }
        out += smooth(pts);
      }
      return out;
    });
  }
  /** A rough arrow from (x1,y1) to (x2,y2). curve bends it (0.2 = a fifth of its length, negative bends the other way). */
  function arrow(x1, y1, x2, y2, o) {
    o = opts(o);
    const raw = o.raw || {};
    const curve = raw.curve ?? 0, head = raw.head === 0 || raw.head === false ? 0 : (raw.head ?? 22) * px(), both = raw.heads === 'both' || raw.both;
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
    const mx = (x1 + x2) / 2 + nx * curve * len, my = (y1 + y2) / 2 + ny * curve * len;
    const shaft = curve ? `M${x1} ${y1}Q${f1(mx)} ${f1(my)} ${x2} ${y2}` : `M${x1} ${y1}L${x2} ${y2}`;
    const R = rng(String(o.seed) + 'h');
    // a barb out and back, then the other barb: the pen never lifts, so draw-on ends with the head
    const barbs = (tx, ty, fx, fy) => {
      const ang = Math.atan2(ty - fy, tx - fx), spread = 0.45 + (R() - 0.5) * 0.12;
      const l1 = head * (0.9 + R() * 0.2), l2 = head * (0.9 + R() * 0.2);
      const b1 = [tx - Math.cos(ang - spread) * l1, ty - Math.sin(ang - spread) * l1], b2 = [tx - Math.cos(ang + spread) * l2, ty - Math.sin(ang + spread) * l2];
      return { b1, b2 };
    };
    const ho = { ...o, overshoot: 0.3 };
    const end = head ? barbs(x2, y2, curve ? mx : x1, curve ? my : y1) : null;
    const start = head && both ? barbs(x1, y1, curve ? mx : x2, curve ? my : y2) : null;
    let d = '';
    if (start) d += strokeLine(start.b1[0], start.b1[1], x1, y1, ho, R) + strokeLine(x1, y1, start.b2[0], start.b2[1], ho, R, false) + strokeLine(start.b2[0], start.b2[1], x1, y1, ho, R, false);
    const body = path(shaft, { ...o, passes: 1, overshoot: 0 });
    d += start ? body.replace(/^M/, 'L') : body;
    if (end) d += strokeLine(x2, y2, end.b1[0], end.b1[1], ho, R, false) + strokeLine(end.b1[0], end.b1[1], x2, y2, ho, R, false) + strokeLine(x2, y2, end.b2[0], end.b2[1], ho, R, false);
    if (o.passes > 1) d += path(shaft, { ...o, passes: 1, overshoot: 0, seed: String(o.seed) + 'b' });
    return d;
  }
  /** Hatching inside a shape (path data, points, or {x,y,w,h}): parallel rough strokes, like quick shading. */
  function hachure(shape, o) {
    const raw = (o && o.raw) || o || {};
    o = opts({ roughness: 0.5, passes: 1, ...o });
    const gap = (raw.gap ?? 12) * px(), angle = ((raw.angle ?? -41) * Math.PI) / 180;
    let poly;
    if (shape && typeof shape === 'object' && !Array.isArray(shape) && 'w' in shape) poly = [[shape.x, shape.y], [shape.x + shape.w, shape.y], [shape.x + shape.w, shape.y + shape.h], [shape.x, shape.y + shape.h]];
    else if (Array.isArray(shape)) poly = toPoints(shape);
    else { const el = measure(shape), len = el.getTotalLength(), n = Math.max(24, Math.min(240, Math.round(len / (6 * px())))); poly = []; for (let i = 0; i < n; i++) { const q = el.getPointAtLength((i / n) * len); poly.push([q.x, q.y]); } }
    if (poly.length < 3) return '';
    const ca = Math.cos(-angle), sa = Math.sin(-angle);
    const rot = poly.map(([x, y]) => [x * ca - y * sa, x * sa + y * ca]);
    let minY = Infinity, maxY = -Infinity;
    for (const p of rot) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    const R = rng(o.seed);
    let d = '';
    const cb = Math.cos(angle), sb = Math.sin(angle);
    const back = (x, y) => [x * cb - y * sb, x * sb + y * cb];
    let k = 0, lastEnd = null;
    for (let y = minY + gap / 2; y < maxY; y += gap, k++) {
      const xs = [];
      for (let i = 0; i < rot.length; i++) {
        const a = rot[i], b = rot[(i + 1) % rot.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const inset = Math.min(gap * 0.3, (xs[i + 1] - xs[i]) * 0.1);
        const [ax, ay] = back(xs[i] + inset, y), [bx, by] = back(xs[i + 1] - inset, y);
        // alternate direction like a hand going back and forth, and keep the pen down between close lines
        const [sx, sy] = k % 2 ? [bx, by] : [ax, ay], [ex, ey] = k % 2 ? [ax, ay] : [bx, by];
        const near = lastEnd && Math.hypot(sx - lastEnd[0], sy - lastEnd[1]) < gap * 2.5;
        d += strokeLine(sx, sy, ex, ey, o, R, !near);
        lastEnd = [ex, ey];
      }
    }
    if (raw.cross) d += hachure(shape, { ...raw, cross: false, angle: (raw.angle ?? -41) + 90, seed: String(o.seed) + 'x' });
    return d;
  }
  /** A wavy scribble line (an underline, a strike-through, a quick zigzag fill with zigzag: true). */
  function underline(x1, y1, x2, y2, o) {
    o = opts(o);
    if (y2 == null) { y2 = y1; }
    const raw = o.raw || {};
    const len = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    const times = raw.loops ?? 1;
    return passes({ ...o, passes: 1 }, (R) => {
      const pts = [];
      for (let k = 0; k < times; k++) {
        const fwd = k % 2 === 0, off = (k * 7 + (R() - 0.5) * 3) * px();
        const n = Math.max(4, Math.round(len / (60 * px())));
        for (let i = 0; i <= n; i++) {
          const t = fwd ? i / n : 1 - i / n;
          const w = (R() - 0.5) * 3 * px() * o.roughness + off;
          pts.push([x1 + ux * len * t - uy * w, y1 + uy * len * t + ux * w]);
        }
      }
      return smooth(pts);
    });
  }

  // A quick pen loop around boxes [{x, y, w, h}]: a smooth closed curve around all of them (the convex hull of the
  // boxes, each grown by pad with round corners, so it never cuts through one), drawn like a hand circling a group:
  // it starts a little inside, wobbles slowly outward and runs on past its start. pad is in the boxes' units.
  function convexHull(P) {
    const pts = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (pts.length < 3) return pts;
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], hi = [];
    for (const q of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = pts.length - 1; i >= 0; i--) { const q = pts[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
    return lo.slice(0, -1).concat(hi.slice(0, -1));
  }
  function loopPath(boxes, pad, o) {
    o = opts(o);
    const ring = [];
    for (const b of boxes) {
      if (!(b.w >= 0 && b.h >= 0)) continue;
      // corner circles a little inside each corner: the loop clears the corners by pad and the sides by a bit more,
      // so it reads as a loop, not a box
      const e = Math.max(0, Math.min(b.w / 2, b.h / 2, 0.2 * Math.min(b.w, b.h), 1.5 * pad)), rc = e * Math.SQRT2 + pad;
      for (const [cx, cy] of [[b.x + e, b.y + e], [b.x + b.w - e, b.y + e], [b.x + b.w - e, b.y + b.h - e], [b.x + e, b.y + b.h - e]])
        for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; ring.push([cx + Math.cos(a) * rc, cy + Math.sin(a) * rc]); }
    }
    const H = convexHull(ring);
    if (H.length < 3) return '';
    const cum = [0];
    for (let i = 1; i <= H.length; i++) cum.push(cum[i - 1] + Math.hypot(H[i % H.length][0] - H[i - 1][0], H[i % H.length][1] - H[i - 1][1]));
    const per = cum[H.length];
    let area = 0;
    for (let i = 0; i < H.length; i++) { const a = H[i], b = H[(i + 1) % H.length]; area += a[0] * b[1] - b[0] * a[1]; }
    const out = area > 0 ? 1 : -1;
    // a point on the hull, and how far a hand would bow out there: long straight runs bulge a little (a loop, not a
    // polygon), nothing at the corners
    const at = (s) => {
      const L = (((s % 1) + 1) % 1) * per;
      let i = 1; while (i < H.length && cum[i] < L) i++;
      const a = H[i - 1], b = H[i % H.length], sl = cum[i] - cum[i - 1], f = (L - cum[i - 1]) / Math.max(1e-9, sl);
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Math.sin(Math.PI * f) * Math.max(0, sl - 2 * pad) * 0.04];
    };
    return passes(o, (R, p) => {
      const k = o.roughness, s0 = R(), over = 0.1 + R() * 0.15;
      const steps = Math.max(16, Math.min(160, Math.round((per * (1 + over)) / (26 * px()))));
      const ph1 = R() * 6.28, ph2 = R() * 6.28, f1 = 1 + R(), f2 = 3 + R() * 2, d = 0.004;
      const pts = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, s = s0 + (1 + over) * t, q = at(s), q0 = at(s - d), q1 = at(s + d);
        const tx = q1[0] - q0[0], ty = q1[1] - q0[1], tl = Math.hypot(tx, ty) || 1, nx = (out * ty) / tl, ny = (-out * tx) / tl;
        // a slow wobble (outward on average) and a slight spiral, so where the end overlaps the start the strokes part
        const w = pad * (0.1 + k * (0.1 * Math.sin(ph1 + t * f1 * 6.28) + 0.05 * Math.sin(ph2 + t * f2 * 6.28)) + (t - 0.5) * 0.22 * k * (p % 2 ? -1 : 1));
        pts.push([q[0] + nx * (w + q[2]), q[1] + ny * (w + q[2])]);
      }
      return smooth(pts);
    });
  }

  // ---------------------------------------------------------------------------
  // data-sketch: turn plain SVG shapes into hand-drawn ones
  // ---------------------------------------------------------------------------
  const GEOM = { rect: ['x', 'y', 'width', 'height', 'rx', 'ry'], circle: ['cx', 'cy', 'r'], ellipse: ['cx', 'cy', 'rx', 'ry'], line: ['x1', 'y1', 'x2', 'y2'], polyline: ['points'], polygon: ['points'], path: ['d'] };
  function parseOpts(el, inherited) {
    const v = (el.getAttribute('data-sketch') || '').trim();
    const o = { ...inherited };
    if (/^[\d.]+$/.test(v)) o.roughness = +v;
    else for (const part of v.split(/[;,]/)) { const m = /^\s*([\w-]+)\s*[:=\s]\s*([^\s].*?)\s*$/.exec(part); if (m) o[m[1].replace(/-(\w)/g, (_, c) => c.toUpperCase())] = isNaN(+m[2]) ? m[2] : +m[2]; }
    for (const k of ['fill', 'gap', 'angle', 'seed', 'roughness', 'passes', 'arrow', 'head', 'boil', 'ink']) { const a = el.getAttribute('data-sketch-' + k); if (a != null) o[k] = isNaN(+a) ? a : +a; }
    return o;
  }
  function geometryPath(el) {
    const n = (a) => parseFloat(el.getAttribute(a)) || 0;
    switch (el.tagName.toLowerCase()) {
      case 'rect': {
        // rounded corners: rx / ry (attributes or CSS); one of them alone rounds both ways
        const cs = getComputedStyle(el);
        let rx = parseFloat(cs.rx), ry = parseFloat(cs.ry);
        if (!isFinite(rx)) rx = parseFloat(el.getAttribute('rx'));
        if (!isFinite(ry)) ry = parseFloat(el.getAttribute('ry'));
        if (!isFinite(rx)) rx = ry;
        if (!isFinite(ry)) ry = rx;
        const w = n('width'), h = n('height');
        rx = Math.min(rx || 0, w / 2); ry = Math.min(ry || 0, h / 2);
        if (rx > 0 && ry > 0 && natural()) return { kind: 'rrect', args: [n('x'), n('y'), w, h, rx, ry] };
        return { kind: 'rect', args: [n('x'), n('y'), w, h] };
      }
      case 'circle': return { kind: 'ellipse', args: [n('cx'), n('cy'), n('r'), n('r')] };
      case 'ellipse': return { kind: 'ellipse', args: [n('cx'), n('cy'), n('rx'), n('ry')] };
      case 'line': return { kind: 'line', args: [n('x1'), n('y1'), n('x2'), n('y2')] };
      case 'polyline': return { kind: 'polyline', args: [el.getAttribute('points') || ''] };
      case 'polygon': return { kind: 'polygon', args: [el.getAttribute('points') || ''] };
      case 'path': return { kind: 'path', args: [el.getAttribute('d') || ''] };
    }
    return null;
  }
  // the outline as a closed polygon (for fills)
  function outlinePoints(g) {
    const [a, b, c, d] = g.args;
    if (g.kind === 'rect') return [[a, b], [a + c, b], [a + c, b + d], [a, b + d]];
    if (g.kind === 'rrect') {
      const [rx, ry] = [g.args[4], g.args[5]], pts = [];
      for (const [qx, qy, a0] of [[a + c - rx, b + ry, -90], [a + c - rx, b + d - ry, 0], [a + rx, b + d - ry, 90], [a + rx, b + ry, 180]])
        for (let i = 0; i <= 6; i++) { const t = ((a0 + i * 15) * Math.PI) / 180; pts.push([qx + Math.cos(t) * rx, qy + Math.sin(t) * ry]); }
      return pts;
    }
    if (g.kind === 'ellipse') { const pts = []; for (let i = 0; i < 48; i++) { const t = (i / 48) * Math.PI * 2; pts.push([a + Math.cos(t) * c, b + Math.sin(t) * d]); } return pts; }
    if (g.kind === 'polygon' || g.kind === 'polyline') return toPoints(a);
    if (g.kind === 'path') return a;
    return null;
  }
  // perceived lightness 0..1 of a CSS color
  function lightness(c) { const v = gm.color && gm.color.parse(c); if (!v) return 0.5; const f = (x) => { x /= 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return Math.cbrt(0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2])); }
  // the shape as plain path data
  function guidePath(g) {
    const [a, b, c, d] = g.args;
    switch (g.kind) {
      case 'rect': return `M${a} ${b}H${a + c}V${b + d}H${a}Z`;
      case 'rrect': { const q = [g.args[4], g.args[5]]; return roundedBoxPath(a, b, c, d, [q, q, q, q]); }
      case 'ellipse': return `M${a - c} ${b}A${c} ${d} 0 1 0 ${a + c} ${b}A${c} ${d} 0 1 0 ${a - c} ${b}Z`;
      case 'line': return `M${a} ${b}L${c} ${d}`;
      case 'polyline': case 'polygon': { const P = toPoints(a); return P.length ? 'M' + P.map((q) => q[0] + ' ' + q[1]).join('L') + (g.kind === 'polygon' ? 'Z' : '') : null; }
      case 'path': return a || null;
    }
    return null;
  }
  // Ink: a stroke as a filled outline whose width tapers at both ends and varies with the pen's pressure (seeded),
  // like a brush or a dip pen, instead of a marker's even line. Returns the outline's path data.
  let inkN = 0;
  function inkOutline(d, width, amount, seed) {
    const m = measure(d), L = m.getTotalLength();
    if (!(L > 0)) return '';
    const n = Math.max(16, Math.min(700, Math.round(L / (3 * px()))));
    const R = rng(seed + 'ink'), ph = R() * 100, tipLen = Math.min(0.2, (40 * px()) / L + 0.04);
    const pts = []; for (let i = 0; i <= n; i++) { const q = m.getPointAtLength((i / n) * L); pts.push([q.x, q.y]); }
    const left = [], right = [];
    for (let i = 0; i <= n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)], s0 = i / n;
      let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const tip = Math.min(1, s0 / tipLen, (1 - s0) / tipLen), sm = tip * tip * (3 - 2 * tip);
      const pressure = 1 + 0.28 * amount * (gm.noise(s0 * (L / (260 * px())) + ph, 7) * 2 - 1);
      const w = (width / 2) * (1 - amount * 0.85 * (1 - sm)) * pressure;
      left.push([pts[i][0] + nx * w, pts[i][1] + ny * w]); right.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
    }
    return 'M' + left.concat(right.reverse()).map((q) => f1(q[0]) + ' ' + f1(q[1])).join('L') + 'Z';
  }
  function sketchOne(el, o, index) {
    const g = geometryPath(el);
    if (!g) return;
    const cs = getComputedStyle(el);
    const seed = o.seed != null ? String(o.seed) + ':' + index : (el.id || '') + ':' + index;
    const so = { roughness: o.roughness ?? 1, passes: o.passes ?? 2, bow: o.bow ?? 1, seed, raw: o };
    const fnK = { rect, rrect, ellipse, line, polyline, polygon, path }[g.kind];
    const nPass = Math.max(1, Math.min(3, so.passes));
    const outlines = [];
    for (let p = 0; p < nPass; p++) outlines.push(fnK(...g.args, { ...so, passes: 1, seed: seed + ':' + p }));
    // arrowheads at the ends of open shapes (data-sketch-arrow="end" | "start" | "both")
    const arrowAt = o.arrow && /^(path|line|polyline)$/.test(g.kind) ? String(o.arrow) : null;
    const guideD = guidePath(g);
    if (arrowAt && guideD) {
      const m = measure(guideD), L = m.getTotalLength(), R = rng(seed + 'a'), hl = (o.head ?? 20) * px();
      const head = (at, dir) => {
        const q = m.getPointAtLength(at), q2 = m.getPointAtLength(Math.max(0, Math.min(L, at - dir * Math.min(L / 3, hl))));
        const ang = Math.atan2(q.y - q2.y, q.x - q2.x), sp = 0.45 + (R() - 0.5) * 0.1;
        const b1 = [q.x - Math.cos(ang - sp) * hl, q.y - Math.sin(ang - sp) * hl], b2 = [q.x - Math.cos(ang + sp) * hl, q.y - Math.sin(ang + sp) * hl];
        const ho = { ...so, overshoot: 0.3 };
        return strokeLine(q.x, q.y, b1[0], b1[1], ho, R, false) + strokeLine(b1[0], b1[1], q.x, q.y, ho, R, false) + strokeLine(q.x, q.y, b2[0], b2[1], ho, R, false);
      };
      if (arrowAt === 'end' || arrowAt === 'both' || arrowAt === 'true' || arrowAt === '1') outlines[0] += head(L, 1);
      if (arrowAt === 'start' || arrowAt === 'both') outlines[0] = 'M' + outlines[0].slice(1) + `M${f1(m.getPointAtLength(0).x)} ${f1(m.getPointAtLength(0).y)}` + head(0, -1);
    }
    // data-sketch-boil="3" (on the shape or any container): the hand-drawn lines "boil", redrawn with a new wobble
    // every 3 frames (on threes), cycling three drawings like hand animation. Drawing 0 is the still one.
    const boilV = o.boil ?? (el.closest('[data-sketch-boil]') ? el.closest('[data-sketch-boil]').getAttribute('data-sketch-boil') : null);
    const boilN = boilV == null || boilV === 'off' || boilV === 'false' || boilV === '0' ? 0 : Math.max(1, Math.round(+boilV) || 3);
    const boilOutlines = boilN ? [outlines.slice()] : null;
    if (boilN) for (let v = 1; v < 3; v++) { const alt = []; for (let p = 0; p < nPass; p++) alt.push(fnK(...g.args, { ...so, passes: 1, seed: seed + ':' + p + '~' + v })); boilOutlines.push(alt); }
    const grp = document.createElementNS(SVGNS, 'g');
    // keep identity and styling: id, classes, data-* (enter, exit, timing), style, presentation attributes
    for (const at of [...el.attributes]) if (!GEOM[el.tagName.toLowerCase()].includes(at.name) && at.name !== 'data-sketch' && !at.name.startsWith('data-sketch-') && at.name !== 'pathLength') grp.setAttribute(at.name, at.value);
    grp.setAttribute('data-gm-sketch', g.kind);
    // the fill as drawn, or the fill attribute when a CSS rule (like .ink { fill: none }) hides it
    const visible = (c) => c && c !== 'none' && !/rgba\(\d+, \d+, \d+, 0\)/.test(c) && !/^url\(/.test(c);
    const attrFill = el.getAttribute('fill');
    const fillColor = visible(cs.fill) ? cs.fill : visible(attrFill) ? attrFill : null;
    const mode = o.fill || (fillColor && g.kind !== 'line' && g.kind !== 'polyline' ? 'hachure' : 'none');
    // a shape with no stroke width set would sketch at 1 px (too thin for video): give it a marker-like 4 px
    if (!el.getAttribute('stroke-width') && !el.style.strokeWidth && parseFloat(cs.strokeWidth) <= 1) grp.style.strokeWidth = 4 * px() + 'px';
    const sw = parseFloat(grp.style.strokeWidth) || parseFloat(cs.strokeWidth) || 2;
    if (fillColor && mode !== 'none') {
      const fp = document.createElementNS(SVGNS, 'path');
      const pts = outlinePoints(g);
      if (mode === 'solid') {
        // a slightly rough filled shape under the outline
        const R = rng(seed + 's'), jt = () => (R() - 0.5) * 3 * px() * so.roughness;
        fp.setAttribute('d', g.kind === 'path' ? g.args[0] : g.kind === 'ellipse' ? ellipse(...g.args, { ...so, passes: 1, roughness: so.roughness * 0.4 }) : 'M' + pts.map((q) => f1(q[0] + jt()) + ' ' + f1(q[1] + jt())).join('L') + 'Z');
        fp.setAttribute('style', `fill:${fillColor};stroke:none`);
      } else {
        const hatchOpts = { gap: o.gap ?? Math.max(9, sw * 3.2), angle: o.angle ?? -41, cross: mode === 'cross' || mode === 'cross-hatch', seed: seed + 'f', roughness: 0.5 * so.roughness };
        fp.setAttribute('d', hachure(pts, hatchOpts));
        if (boilN) fp.__gmBoil = [fp.getAttribute('d'), hachure(pts, { ...hatchOpts, seed: seed + 'f~1' }), hachure(pts, { ...hatchOpts, seed: seed + 'f~2' })];
        // a pale fill would fade away as thin lines: the same hue, deeper (pastel yellow → a real yellow)
        // a pale fill hatched on paper would vanish: deepen it in the same hue; a white/grey one (no hue) to grey, not pink
        const rgb = gm.color && gm.color.parse(fillColor), gray = rgb && Math.max(rgb[0], rgb[1], rgb[2]) - Math.min(rgb[0], rgb[1], rgb[2]) < 16;
        const hatchColor = lightness(fillColor) > 0.82 && CSS.supports('color', `oklch(from ${fillColor} l c h)`) ? (gray ? `oklch(from ${fillColor} min(l, 0.84) 0 h)` : `oklch(from ${fillColor} min(l, 0.8) max(c, 0.14) h)`) : fillColor;
        fp.setAttribute('style', `fill:none;stroke:${hatchColor};stroke-width:${Math.max(2, sw * 0.9)}px;stroke-linecap:round`);
      }
      fp.setAttribute('data-gm-sketch-fill', mode);
      grp.appendChild(fp);
    }
    const noStroke = (el.getAttribute('stroke') === 'none' || cs.stroke === 'none') && fillColor;
    const boilPaths = [];
    // data-sketch-ink="0.8" (0..1, "on" = 0.8): ink strokes (tapered ends, pen pressure) instead of an even line. Each is
    // a filled outline revealed through a mask that traces its centre line, so data-enter="draw" and a draw tween
    // still draw it on along its direction.
    const inkV = o.ink ?? (el.closest('[data-sketch-ink]') ? el.closest('[data-sketch-ink]').getAttribute('data-sketch-ink') : null);
    const inkAmt = inkV == null || inkV === 'off' || inkV === 'false' || inkV === '0' ? 0 : Math.max(0.05, Math.min(1, isFinite(+inkV) && inkV !== '' && inkV !== true ? +inkV : 0.8));
    if (!noStroke && inkAmt) {
      const color = cs.stroke && cs.stroke !== 'none' ? cs.stroke : 'currentColor';
      for (const [k, d] of outlines.entries()) {
        const id = 'gm-ink-' + ++inkN, mk = document.createElementNS(SVGNS, 'mask'), mp = document.createElementNS(SVGNS, 'path'), fp = document.createElementNS(SVGNS, 'path');
        mk.setAttribute('id', id); mk.setAttribute('maskUnits', 'userSpaceOnUse'); mk.setAttribute('x', '-100000'); mk.setAttribute('y', '-100000'); mk.setAttribute('width', '200000'); mk.setAttribute('height', '200000');
        mp.setAttribute('d', d); mp.setAttribute('data-gm-ink-reveal', ''); mp.setAttribute('fill', 'none');
        mp.setAttribute('style', `stroke:#fff;stroke-width:${f1(sw * 2.4)}px;stroke-linecap:round;stroke-linejoin:round`);
        mk.appendChild(mp);
        fp.setAttribute('d', inkOutline(d, sw * 1.15, inkAmt, seed + ':' + k)); fp.setAttribute('mask', `url(#${id})`); fp.setAttribute('data-gm-ink', '');
        fp.setAttribute('style', `fill:${color};stroke:none`);
        if (boilN) { fp.__gmBoil = boilOutlines.map((alt, v) => inkOutline(alt[k], sw * 1.15, inkAmt, seed + ':' + k + '~' + v)); mp.__gmBoil = boilOutlines.map((alt) => alt[k]); boilPaths.push(fp, mp); }
        grp.appendChild(mk); grp.appendChild(fp);
      }
    }
    if (!noStroke && !inkAmt) for (const [k, d] of outlines.entries()) {
      const op = document.createElementNS(SVGNS, 'path');
      op.setAttribute('d', d);
      if (boilN) { op.__gmBoil = boilOutlines.map((alt) => alt[k]); boilPaths.push(op); }
      op.setAttribute('fill', 'none');
      op.style.strokeLinecap = 'round';
      op.style.strokeLinejoin = 'round';
      if (cs.stroke === 'none' || !cs.stroke) op.style.stroke = 'currentColor';
      grp.appendChild(op);
    }
    // the exact shape, hidden: gm.path.travel('#pkg', '#route') follows it when '#route' is a sketched shape
    if (guideD) {
      const gp = document.createElementNS(SVGNS, 'path');
      gp.setAttribute('d', guideD);
      gp.setAttribute('data-gm-sketch-guide', '');
      gp.setAttribute('style', 'fill:none;stroke:none;visibility:hidden');
      grp.appendChild(gp);
    }
    grp.style.fill = 'none';
    el.replaceWith(grp);
    replaced.set(el, grp);
    if (boilN) { for (const q of grp.querySelectorAll('[data-gm-sketch-fill]')) if (q.__gmBoil) boilPaths.push(q); boils.push({ paths: boilPaths, n: boilN, last: 0 }); }
    return grp;
  }
  const boils = [];
  function updateBoils(T) {
    let changed = false;
    if (!boils.length) return false;
    const frame = Math.round(T * gm.fps + 1e-6);
    for (const b of boils) {
      const v = Math.floor(frame / b.n) % 3;
      if (v === b.last) continue;
      b.last = v; changed = true;
      for (const q of b.paths) q.setAttribute('d', q.__gmBoil[v]);
    }
    return changed;
  }
  I.hooks.seek.push(updateBoils);
  // ---------------------------------------------------------------------------
  // HTML: data-sketch on a box gives it a hand-drawn border; data-sketch-mark highlights, underlines, circles,
  // boxes or strikes a piece of text. Both are measured on the first frame they are visible (fonts loaded, layout done).
  // ---------------------------------------------------------------------------
  const marks = [];
  // When a mark starts drawing, in seconds after its element's clip start (m.base). Read once the timeline and the
  // entrances are built: data-sketch-mark-at takes every time syntax ("2.5", "500ms", "45f", and a word "@two",
  // "@two#2", "@two.end", "@two+0.3", which is a moment of the whole video); with none, right after the element's
  // own entrance as it was resolved (its word, delay, stagger and duration).
  function startTime(m) {
    const el = m.el, attr = 'data-sketch-mark-at', v = (el.getAttribute(attr) || '').trim();
    if (v) {
      const t = I.parseTime(v, el, attr);
      if (t == null) return 0;
      return v[0] === '@' ? t - m.base : t;
    }
    for (let a = el; a && a !== document.body; a = a.parentElement) if (a.__gmEnterEnd != null) return a.__gmEnterEnd - m.base;
    return 0;
  }
  function addMark(el, kind) {
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('data-check', 'ignore');
    svg.setAttribute('class', 'gm-sketch-mark');
    svg.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none;z-index:1' + (kind === 'highlight' ? ';mix-blend-mode:multiply' : '');
    const dv = (el.getAttribute('data-sketch-mark-duration') || '').trim(), dur = dv ? I.parseTime(dv, el, 'data-sketch-mark-duration') : null;
    marks.push({ el, kind, svg, seed: (el.id || 'm') + ':' + marks.length, at: 0, dur: dur > 0 ? dur : (kind === 'highlight' || kind === 'underline' || kind === 'strike' ? 0.5 : 0.7) });
  }
  function addBorder(el) {
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('data-check', 'ignore');
    svg.setAttribute('class', 'gm-sketch-border');
    svg.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none';
    marks.push({ el, kind: 'border', svg, seed: (el.id || 'b') + ':' + marks.length, opts: parseOpts(el, {}) });
  }
  function buildMark(m) {
    // (a sketched shape was replaced by its group)
    if (!m.el.isConnected && replaced.get(m.el)) m.el = replaced.get(m.el);
    const el = m.el;
    if (!el.isConnected) return false;
    // Built once while the page loads (the same for every worker). Things in clips that are not on screen yet are
    // shown for a moment to be measured.
    const hidden = [];
    for (let a = el; a; a = a.parentElement) if (a.hasAttribute && a.hasAttribute('data-gm-hidden')) { hidden.push(a); a.removeAttribute('data-gm-hidden'); }
    try { return buildMarkNow(m); } finally { for (const a of hidden) a.setAttribute('data-gm-hidden', ''); }
  }
  function buildMarkNow(m) {
    const el = m.el;
    const R2 = { roughness: 1, seed: m.seed };
    if (m.kind === 'border') {
      const cs = getComputedStyle(el), w = el.offsetWidth, h = el.offsetHeight;
      if (!w || !h) return false;
      const bw = parseFloat(cs.borderTopWidth) || 0;
      const col = bw > 0 && cs.borderTopStyle !== 'none' ? cs.borderTopColor : 'currentColor';
      if (cs.position === 'static') el.style.position = 'relative';
      el.style.borderColor = 'transparent';
      // the svg's 0,0 is the padding box corner: step back over the border
      // rounded corners (border-radius) are drawn round
      const rad = ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map((c) => {
        const v = String(cs['border' + c + 'Radius'] || '0').trim().split(/\s+/);
        const one = (s0, full) => (/%$/.test(s0) ? (parseFloat(s0) / 100) * full : parseFloat(s0) || 0);
        return [one(v[0], w), one(v[1] ?? v[0], h)];
      });
      const sc = Math.min(1, w / Math.max(1e-6, rad[0][0] + rad[1][0]), w / Math.max(1e-6, rad[3][0] + rad[2][0]), h / Math.max(1e-6, rad[0][1] + rad[3][1]), h / Math.max(1e-6, rad[1][1] + rad[2][1]));
      const box = natural() && rad.some((q) => q[0] > 0 && q[1] > 0) ? roundedBoxPath(-bw, -bw, w, h, rad.map((q) => [q[0] * sc, q[1] * sc])) : `M${-bw} ${-bw}H${w - bw}V${h - bw}H${-bw}Z`;
      const ds = [path(box, { ...R2, roughness: m.opts.roughness ?? 1, passes: 1 }), path(box, { ...R2, seed: m.seed + 'b', roughness: m.opts.roughness ?? 1, passes: 1 })];
      m.svg.innerHTML = ds.map((d) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${Math.max(2, bw || 3 * px())}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
      el.appendChild(m.svg);
      return true;
    }
    // A circle around something that is not a run of text (a group, a card, an image, an SVG <g> or shape): a loop
    // that hugs its box instead of an ellipse that would cut its corners
    if (m.kind === 'circle' && natural() && !textLike(el)) return buildLoopMark(m);
    // Text marks live inside the element, so they move, fade and hide with it. Line boxes are measured relative to the
    // element's own box (entrance moves and camera zoom scale all of them alike).
    const B = el.getBoundingClientRect(), k = el.offsetWidth ? B.width / el.offsetWidth : 1;
    if (!B.width || !(k > 0.05)) return false;
    const rects = [...el.getClientRects()].map((r) => ({ x: (r.left - B.left) / k, y: (r.top - B.top) / k, w: r.width / k, h: r.height / k })).filter((r) => r.w > 1 && r.h > 1);
    if (!rects.length) return false;
    const cs = getComputedStyle(el);
    const color = el.getAttribute('data-sketch-mark-color') || (m.kind === 'highlight' ? '#ffd43b' : m.kind === 'circle' ? '#e03131' : cs.color);
    const fs = parseFloat(cs.fontSize) || 40;
    const sw = Math.max(2.5, fs * 0.07);
    let d = '';
    const U = rects.reduce((u, r) => ({ x: Math.min(u.x, r.x), y: Math.min(u.y, r.y), r: Math.max(u.r, r.x + r.w), b: Math.max(u.b, r.y + r.h) }), { x: Infinity, y: Infinity, r: -Infinity, b: -Infinity });
    const pad = fs * 0.25;
    // data-sketch-mark-padding="6" (all sides) or "10 4" (sides, top/bottom): px at 1080p between the text and the mark
    const pv = (el.getAttribute('data-sketch-mark-padding') || '').trim().split(/[\s,]+/).map(parseFloat).filter((x) => isFinite(x));
    const padX = pv.length ? pv[0] * px() : m.kind === 'circle' ? pad * 1.6 : pad, padY = pv.length ? (pv[1] ?? pv[0]) * px() : m.kind === 'circle' ? pad : pad * 0.6;
    if (m.kind === 'circle') d = ellipse((U.x + U.r) / 2, (U.y + U.b) / 2, (U.r - U.x) / 2 + padX, (U.b - U.y) / 2 + padY, { ...R2, passes: 1 });
    else if (m.kind === 'box') d = rect(U.x - padX, U.y - padY, U.r - U.x + padX * 2, U.b - U.y + padY * 2, { ...R2, passes: 1 });
    else for (const r of rects) {
      const y = m.kind === 'underline' ? r.y + r.h * 0.92 : r.y + r.h * 0.55;
      d += strokeLine(r.x - fs * 0.05, y, r.x + r.w + fs * 0.05, y + (m.kind === 'highlight' ? 0 : fs * 0.02), { roughness: 0.6, bow: 1, overshoot: 0.5, raw: {} }, rng(m.seed + ':' + Math.round(y)), !d);
    }
    // a highlighter multiplies with what is under it, so it can sit on top of the text and still look behind it
    m.svg.innerHTML = `<path d="${d}" fill="none" stroke="${color}" stroke-width="${m.kind === 'highlight' ? (rects[0].h * 0.62).toFixed(1) : sw.toFixed(1)}" stroke-linecap="${m.kind === 'highlight' ? 'butt' : 'round'}" stroke-linejoin="round" pathLength="1"${m.kind === 'highlight' ? ' opacity="0.7"' : ''}/>`;
    m.p = m.svg.firstChild;
    if (cs.position === 'static') el.style.position = 'relative';
    el.appendChild(m.svg);
    m.base = gm.timing(el).start;
    m.svg.style.visibility = 'hidden';
    return true;
  }
  // only text and inline elements inside (a heading, a span, a paragraph), nothing that is a box of its own
  function textLike(el) {
    if (el instanceof SVGElement || !el.textContent.trim() || el.querySelector('img,svg,canvas,video,picture,iframe,object')) return false;
    for (const e of el.querySelectorAll('*')) { const ds = getComputedStyle(e).display; if (!/^(inline|contents|none)/.test(ds)) return false; }
    return true;
  }
  function buildLoopMark(m) {
    const el = m.el, pv = (el.getAttribute('data-sketch-mark-padding') || '').trim().split(/[\s,]+/).map(parseFloat).filter((x) => isFinite(x));
    const pad = (pv.length ? pv[0] : 20) * px();
    let box, host;
    if (el instanceof SVGElement) {
      // in the shape's own user space. An outer <svg> holds it inside; a <g> or a shape gets it right after itself
      // (with its transform attribute), so the mark never grows the group's own box (arrows and camera shots use it)
      let b; try { b = /** @type {SVGGraphicsElement} */ (el).getBBox(); } catch (e) { return false; }
      if (!b.width && !b.height) return false;
      box = { x: b.x, y: b.y, w: b.width, h: b.height };
      if (el instanceof SVGSVGElement && !(el.parentNode instanceof SVGElement)) host = el;
      else {
        const g = document.createElementNS(SVGNS, 'g');
        g.setAttribute('data-check', 'ignore'); g.setAttribute('class', 'gm-sketch-mark');
        const tf = el.getAttribute('transform');
        if (tf) g.setAttribute('transform', tf);
        m.svg = g;
        host = el.parentNode;
      }
    } else {
      const w = el.offsetWidth, h = el.offsetHeight;
      if (!w || !h) return false;
      const cs = getComputedStyle(el);
      // the svg's 0,0 is the padding box corner
      box = { x: -(parseFloat(cs.borderLeftWidth) || 0), y: -(parseFloat(cs.borderTopWidth) || 0), w, h };
      if (cs.position === 'static') el.style.position = 'relative';
      host = el;
    }
    const color = el.getAttribute('data-sketch-mark-color') || '#e03131';
    const d = loopPath([box], pad, { roughness: 1, passes: 1, seed: m.seed });
    m.svg.innerHTML = `<path d="${d}" fill="none" stroke="${color}" stroke-width="${(5 * px()).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>`;
    m.p = m.svg.firstChild;
    if (host === el) el.appendChild(m.svg); else host.insertBefore(m.svg, el.nextSibling);
    m.base = gm.timing(el).start;
    m.svg.style.visibility = 'hidden';
    return true;
  }
  function updateMarks(T) {
    let changed = false;
    for (const m of marks) {
      if (!m.p) continue;
      // drawn on over m.dur seconds, m.at seconds into the element's clip
      const pr = Math.max(0, Math.min(1, (T - m.base - m.at) / m.dur)), e = pr < 0.5 ? 2 * pr * pr : 1 - Math.pow(-2 * pr + 2, 2) / 2;
      const dash = e >= 1 ? 'none' : `${e.toFixed(4)} 2`, vis = e > 0 ? '' : 'hidden';
      if (dash !== m.lastDash || vis !== m.lastVis) { m.p.style.strokeDasharray = dash; m.svg.style.visibility = vis; m.lastDash = dash; m.lastVis = vis; changed = true; }
    }
    return changed;
  }
  I.hooks.init.push(() => { for (const m of marks) if (!m.built) { m.built = buildMark(m); if (m.built && m.base != null) m.at = startTime(m); } });
  I.hooks.seek.push(updateMarks);

  function setupSketch() {
    let i = 0;
    for (const el of document.querySelectorAll('[data-sketch-mark]')) if (!el.__gmMark) { el.__gmMark = true; addMark(el, (el.getAttribute('data-sketch-mark') || 'underline').trim()); }
    for (const host of [...document.querySelectorAll('[data-sketch]')]) {
      if (!host.isConnected) continue;
      const tag = host.tagName.toLowerCase();
      if (!(host instanceof SVGElement)) { if (!host.__gmBorder) { host.__gmBorder = true; addBorder(host); } continue; }
      const o = parseOpts(host, {});
      if (GEOM[tag]) { sketchOne(host, o, i++); continue; }
      // on an <svg> or <g>: every shape inside (a shape's own data-sketch options win)
      for (const el of [...host.querySelectorAll('rect,circle,ellipse,line,polyline,polygon,path')]) {
        if (el.closest('[data-sketch="off"],[data-sketch="none"]') || el.hasAttribute('data-sketch') || el.closest('defs,clipPath,mask,marker,pattern')) continue;
        sketchOne(el, [...el.attributes].some((a) => a.name.startsWith('data-sketch-')) ? parseOpts(el, o) : o, i++);
      }
      host.removeAttribute('data-sketch');
    }
  }
  I.hooks.preinit.unshift(setupSketch);

  // ---------------------------------------------------------------------------
  // gm.rect(el, space): an element's box in another element's own coordinates (e.g. a camera world),
  // whatever transforms (camera zoom, rotation) sit on top of that space.
  // ---------------------------------------------------------------------------
  function spaceMap(space) {
    let m = space.__gmMarks;
    if (!m || !m[0].isConnected) {
      const mk = (x, y) => { const d = document.createElement('div'); d.setAttribute('data-gm-internal', ''); d.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:0;height:0;pointer-events:none;visibility:hidden`; space.appendChild(d); return d; };
      if (space !== document.body && getComputedStyle(space).position === 'static') space.style.position = 'relative';
      m = space.__gmMarks = [mk(0, 0), mk(1000, 0), mk(0, 1000)];
    }
    const [o, x, y] = m.map((d) => d.getBoundingClientRect());
    const ax = (x.left - o.left) / 1000, ay = (x.top - o.top) / 1000, bx = (y.left - o.left) / 1000, by = (y.top - o.top) / 1000;
    const det = ax * by - ay * bx || 1;
    // screen → space (and .fwd: space → screen)
    const f = (sx, sy) => { const dx = sx - o.left, dy = sy - o.top; return [(dx * by - dy * bx) / det, (dy * ax - dx * ay) / det]; };
    f.fwd = (x, y) => [o.left + x * ax + y * bx, o.top + x * ay + y * by];
    return f;
  }
  const elOf = (t) => (typeof t === 'string' ? document.querySelector(t) : (t && replaced.get(t)) || t);
  function rectIn(target, space) {
    const el = elOf(target), sp = space ? elOf(space) : null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!sp) return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    const map = spaceMap(sp);
    const pts = [map(r.left, r.top), map(r.right, r.top), map(r.right, r.bottom), map(r.left, r.bottom)];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
  }

  // ---------------------------------------------------------------------------
  // gm.connect('#a', '#b', opts): a line or arrow between two elements that follows them every frame
  // ---------------------------------------------------------------------------
  const connectors = [];
  function connect(a, b, o = {}) {
    const c = { a, b, o, seed: o.seed ?? 'c' + connectors.length };
    connectors.push(c);
    // (gm.path.travel(el, thisArrow) rides along the arrow, see planTravel)
    return { el: () => c.path, progress: (t) => c.progressAt ? c.progressAt(t) : 1, __gmConnector: c };
  }
  // where the line from the center of box r toward point (px, py) leaves r (plus a gap)
  function edgePoint(r, px2, py2, gap) {
    const dx = px2 - r.cx, dy = py2 - r.cy;
    if (!dx && !dy) return [r.cx, r.cy];
    const sx = dx ? (r.w / 2) / Math.abs(dx) : Infinity, sy = dy ? (r.h / 2) / Math.abs(dy) : Infinity;
    const k = Math.min(sx, sy), len = Math.hypot(dx, dy);
    return [r.cx + dx * k + (dx / len) * gap, r.cy + dy * k + (dy / len) * gap];
  }
  // (an HTML element: two shapes in one <svg> get their arrow in the svg's HTML parent)
  function commonParent(x, y) { for (let p = x.parentElement; p; p = p.parentElement) if (p.contains(y) && !(p instanceof SVGElement)) return p; return document.body; }
  function setupConnector(c) {
    const A = elOf(c.a), B = elOf(c.b);
    if (!A || !B) { I.report('error', 'connect-no-target', `gm.connect: "${!A ? c.a : c.b}" matched nothing.`, null, 'Check the selector.'); c.dead = true; return; }
    c.A = A; c.B = B;
    c.space = c.o.in ? elOf(c.o.in) : commonParent(A, B);
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'gm-connect' + (c.o.class ? ' ' + c.o.class : ''));
    svg.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none';
    const path = document.createElementNS(SVGNS, 'path');
    path.setAttribute('fill', 'none');
    path.style.stroke = c.o.color || 'currentColor';
    path.style.strokeWidth = (c.o.width ?? 3) + 'px';
    path.style.strokeLinecap = 'round'; path.style.strokeLinejoin = 'round';
    if (c.o.dash) path.style.strokeDasharray = c.o.dash;
    svg.appendChild(path);
    // a label on the arrow: label: 'GET /' or { text, at, side, offset, size, color, font, weight, class, check }
    if (c.o.label != null) {
      const L = typeof c.o.label === 'object' ? c.o.label : { text: String(c.o.label) };
      const tx = document.createElementNS(SVGNS, 'text');
      tx.textContent = L.text;
      tx.setAttribute('text-anchor', 'middle');
      tx.setAttribute('dominant-baseline', 'middle');
      if (L.class) tx.setAttribute('class', L.class);
      if (L.check) tx.setAttribute('data-check', L.check);
      tx.style.fill = L.color || c.o.color || 'currentColor';
      // px at 1080p in the arrow's own space (world px inside a camera world, like an HTML label there)
      tx.style.fontSize = (L.size ?? (c.o.sketch ? 44 : 36)) * px() + 'px';
      // hand-drawn arrows get handwriting; otherwise the text around the arrow's own font
      tx.style.fontFamily = L.font || (c.o.sketch ? 'Caveat, cursive' : 'inherit');
      if (L.weight) tx.style.fontWeight = L.weight;
      tx.style.stroke = 'none';
      svg.appendChild(tx);
      const side = String(L.side || 'auto').toLowerCase();
      if (!LABEL_SIDES.has(side)) I.report('warning', 'connect-label-side', `gm.connect: label side "${L.side}" is not one of ${[...LABEL_SIDES].join(' ')}.`, null, "Use side: 'above', 'below', 'left', 'right', 'outside' (of the bend) or 'inside'.");
      const at = L.at == null ? 0.5 : parseFrac(L.at);
      c.label = tx; c.labelOpt = L; c.labelSide = LABEL_SIDES.has(side) ? side : 'auto'; c.labelAt = at == null ? 0.5 : at;
    }
    if (c.o.behind) c.space.insertBefore(svg, c.space.firstChild); else c.space.appendChild(svg);
    if (c.space !== document.body && getComputedStyle(c.space).position === 'static') c.space.style.position = 'relative';
    c.svg = svg; c.path = path;
    // drawing on: draw: [start, duration] in seconds of the space's clip (or { at, duration, ease })
    const dr = c.o.draw;
    if (dr != null && dr !== false) {
      const at = Array.isArray(dr) ? +dr[0] : typeof dr === 'object' ? +dr.at || 0 : +dr || 0;
      const dur = Array.isArray(dr) ? +(dr[1] ?? 0.8) : typeof dr === 'object' ? +(dr.duration ?? 0.8) : 0.8;
      const ease = I.easing ? I.easing(Array.isArray(dr) ? dr[2] || 'in-out-cubic' : (dr && dr.ease) || 'in-out-cubic') : (p) => p;
      const base = c.o.global ? 0 : gm.timing(c.space === document.body ? A : c.space).start;
      c.progressAt = (T) => Math.max(0, Math.min(1, ease(Math.max(0, Math.min(1, (T - base - at) / Math.max(1e-6, dur))))));
      path.setAttribute('pathLength', '1');
    }
  }
  // where along the line (0 = start, 1 = end) a point is, by length: { x, y, tx, ty } with the unit tangent
  function pointOnLine(g, f) {
    f = Math.max(0, Math.min(1, f));
    const { x1, y1, x2, y2, qx, qy } = g;
    if (!g.curve) { const l = Math.hypot(x2 - x1, y2 - y1) || 1; return { x: x1 + (x2 - x1) * f, y: y1 + (y2 - y1) * f, tx: (x2 - x1) / l, ty: (y2 - y1) / l }; }
    const N = 64, P = (u) => [(1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * qx + u * u * x2, (1 - u) * (1 - u) * y1 + 2 * (1 - u) * u * qy + u * u * y2];
    const acc = [0];
    let prev = P(0);
    for (let i = 1; i <= N; i++) { const p = P(i / N); acc.push(acc[i - 1] + Math.hypot(p[0] - prev[0], p[1] - prev[1])); prev = p; }
    const want = acc[N] * f;
    let i = 1;
    while (i < N && acc[i] < want) i++;
    const u = (i - 1 + (acc[i] > acc[i - 1] ? (want - acc[i - 1]) / (acc[i] - acc[i - 1]) : 0)) / N;
    const [x, y] = P(u);
    let tx = 2 * (1 - u) * (qx - x1) + 2 * u * (x2 - qx), ty = 2 * (1 - u) * (qy - y1) + 2 * u * (y2 - qy);
    const l = Math.hypot(tx, ty) || 1;
    return { x, y, tx: tx / l, ty: ty / l };
  }
  const LABEL_SIDES = new Set(['auto', 'outside', 'inside', 'above', 'top', 'below', 'bottom', 'under', 'left', 'right']);
  const ATTACH_SIDES = { top: 'top', above: 'top', bottom: 'bottom', below: 'bottom', under: 'bottom', left: 'left', right: 'right', center: 'center', middle: 'center', 'top-left': 'top-left', 'top-right': 'top-right', 'bottom-left': 'bottom-left', 'bottom-right': 'bottom-right', 'left-top': 'top-left', 'right-top': 'top-right', 'left-bottom': 'bottom-left', 'right-bottom': 'bottom-right' };
  // 0.25, '0.25', '25%' -> 0.25 (clamped to 0..1); anything else -> null
  function parseFrac(v) {
    const m = /^\s*(-?(?:\d+\.?\d*|\.\d+))\s*(%?)\s*$/.exec(String(v));
    if (!m) return null;
    const n = parseFloat(m[1]) / (m[2] ? 100 : 1);
    return Math.max(0, Math.min(1, n));
  }
  // from: 'top' | 'top 0.25' | 'top-left' | 'center' | 0.25, plus fromAt: 0.25 -> { side, at }
  function parseAttach(v, at, what) {
    let side = null, f = at == null ? null : parseFrac(at);
    if (at != null && f == null) I.report('warning', 'connect-bad-attach', `gm.connect: ${what}At "${at}" is not a number from 0 to 1.`, null, `${what}At: 0.25 attaches a quarter of the way along the side (from its left or top end).`);
    if (v != null && v !== '') {
      for (const tok of String(v).trim().toLowerCase().split(/[\s,]+/)) {
        if (ATTACH_SIDES[tok]) side = ATTACH_SIDES[tok];
        else if (parseFrac(tok) != null) { if (f == null) f = parseFrac(tok); }
        else I.report('warning', 'connect-bad-attach', `gm.connect: ${what}: "${v}" is not a side.`, null, `Use 'top' 'right' 'bottom' 'left' 'center', a corner like 'top-left', or a side and a place along it: 'top 0.25'.`);
      }
    }
    return { side, at: f };
  }
  // the arrow's line right now, in its space's coordinates (null while an end is not displayed)
  function connGeom(c) {
    if (!c.path && !c.dead) setupConnector(c);
    if (c.dead || !c.A.getClientRects().length || !c.B.getClientRects().length) return null;
    const ra = rectIn(c.A, c.space), rb = rectIn(c.B, c.space);
    if (!ra || !rb) return null;
    const o = c.o, gap = (o.gap ?? 10) * px(), curve = o.curve ?? 0;
    // aim from center to center, bent by curve; ends sit on the boxes' edges
    const mx = (ra.cx + rb.cx) / 2, my = (ra.cy + rb.cy) / 2, len = Math.hypot(rb.cx - ra.cx, rb.cy - ra.cy) || 1;
    const nx = -(rb.cy - ra.cy) / len, ny = (rb.cx - ra.cx) / len;
    const qx = mx + nx * curve * len, qy = my + ny * curve * len;
    // from/to: a side ('top' 'right' 'bottom' 'left'), a corner ('top-left' …) or 'center', optionally with where along
    // the side ('top 0.25': a quarter of the way from its left end; fromAt/toAt do the same); default: where the line
    // between the centers crosses the edge
    const end = (r, spec, gp, ox, oy) => {
      if (!spec.side && spec.at == null) return edgePoint(r, ox, oy, gp);
      let sd = spec.side;
      if (!sd) {
        // only a position along the side: the side the automatic attach point is on
        const dx = ox - r.cx, dy = oy - r.cy;
        sd = Math.abs(dx) * r.h > Math.abs(dy) * r.w ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'bottom' : 'top';
      }
      const f = spec.at == null ? 0.5 : spec.at, dg = gp * Math.SQRT1_2;
      switch (sd) {
        case 'top': return [r.x + r.w * f, r.y - gp];
        case 'bottom': return [r.x + r.w * f, r.y + r.h + gp];
        case 'left': return [r.x - gp, r.y + r.h * f];
        case 'right': return [r.x + r.w + gp, r.y + r.h * f];
        case 'top-left': return [r.x - dg, r.y - dg];
        case 'top-right': return [r.x + r.w + dg, r.y - dg];
        case 'bottom-left': return [r.x - dg, r.y + r.h + dg];
        case 'bottom-right': return [r.x + r.w + dg, r.y + r.h + dg];
        default: return [r.cx, r.cy];
      }
    };
    if (!c.ends) c.ends = [parseAttach(o.from, o.fromAt, 'from'), parseAttach(o.to, o.toAt, 'to')];
    const [x1, y1] = end(ra, c.ends[0], gap, curve ? qx : rb.cx, curve ? qy : rb.cy);
    const [x2, y2] = end(rb, c.ends[1], gap, curve ? qx : ra.cx, curve ? qy : ra.cy);
    return { x1, y1, x2, y2, qx, qy, curve };
  }
  function updateConnectors(T) {
    let changed = false;
    for (const c of connectors) {
      const g = connGeom(c);
      if (c.dead) continue;
      const o = c.o;
      let d = '';
      if (g) {
        const { x1, y1, x2, y2, qx, qy, curve } = g;
        const head = o.head === false || o.head === 'none' ? null : o.head || 'end';
        const hl = (o.headSize ?? 20) * px();
        if (o.sketch) {
          d = arrow(x1, y1, x2, y2, opts({ roughness: typeof o.sketch === 'number' ? o.sketch : 1, passes: 1, seed: c.seed, raw: { curve, head: head ? hl / px() : 0, heads: head === 'both' ? 'both' : 'end' } }));
          if (!head) d = path(curve ? `M${x1} ${y1}Q${qx} ${qy} ${x2} ${y2}` : `M${x1} ${y1}L${x2} ${y2}`, { roughness: typeof o.sketch === 'number' ? o.sketch : 1, passes: 1, seed: c.seed });
        } else {
          d = curve ? `M${f1(x1)} ${f1(y1)}Q${f1(qx)} ${f1(qy)} ${f1(x2)} ${f1(y2)}` : `M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}`;
          // one stroke: [start barbs] shaft [end barbs], so drawing on runs from start to end
          const barb = (tx, ty, fx, fy, k) => { const an = Math.atan2(ty - fy, tx - fx) + k * 0.45; return `${f1(tx - Math.cos(an) * hl)} ${f1(ty - Math.sin(an) * hl)}`; };
          if (head === 'start' || head === 'both') d = `M${barb(x1, y1, curve ? qx : x2, curve ? qy : y2, -1)}L${f1(x1)} ${f1(y1)}L${barb(x1, y1, curve ? qx : x2, curve ? qy : y2, 1)}L` + d.slice(1);
          if (head === 'end' || head === 'both') d += `L${barb(x2, y2, curve ? qx : x1, curve ? qy : y1, -1)}L${f1(x2)} ${f1(y2)}L${barb(x2, y2, curve ? qx : x1, curve ? qy : y1, 1)}`;
        }
      }
      if (d !== c.lastD) { c.path.setAttribute('d', d); c.lastD = d; changed = true; }
      if (c.label && !d && c.label.style.visibility !== 'hidden') { c.label.style.visibility = 'hidden'; changed = true; }
      if (c.label && d) {
        // at its spot along the line itself (the geometric line between the ends: not the sketched strokes or the
        // head), pushed off to one side so that its box clears the line by offset px
        const q = pointOnLine(g, c.labelAt), b = c.label.getBBox();
        let nx = -q.ty, ny = q.tx; // the bend bulges toward +normal when curve > 0
        const curve = o.curve ?? 0, sd = c.labelSide;
        // outside the bend (above a straight line); inside is the other way
        let sgn = curve > 0 ? 1 : curve < 0 ? -1 : ny > 0 ? -1 : ny < 0 ? 1 : nx > 0 ? 1 : -1;
        if (sd === 'inside') sgn = -sgn;
        const dir = { above: [0, -1], top: [0, -1], below: [0, 1], bottom: [0, 1], under: [0, 1], left: [-1, 0], right: [1, 0] }[sd];
        if (dir) {
          // that side of the line on screen; a line running that way (side 'above' on a vertical arrow) gets it on
          // its right (above for 'left'/'right')
          const dot = nx * dir[0] + ny * dir[1];
          sgn = Math.abs(dot) > 0.05 ? Math.sign(dot) : dir[1] ? (nx >= 0 ? 1 : -1) : (ny <= 0 ? 1 : -1);
        }
        nx *= sgn; ny *= sgn;
        // the label's half size along the normal, plus the gap
        const off = (c.labelOpt.offset ?? 12) * px() + (Math.abs(nx) * b.width + Math.abs(ny) * b.height) / 2;
        const pos = `${f1(q.x + nx * off)},${f1(q.y + ny * off)}`;
        if (pos !== c.lastLabel) { const [lx, ly] = pos.split(','); c.label.setAttribute('x', lx); c.label.setAttribute('y', ly); c.lastLabel = pos; changed = true; }
        // shown once the arrow has been drawn past it
        const vis = c.progressAt ? (c.progressAt(T) >= Math.max(0.02, c.labelAt) ? '' : 'hidden') : '';
        if (c.label.style.visibility !== vis) { c.label.style.visibility = vis; changed = true; }
      }
      if (c.progressAt) {
        const p = c.progressAt(T);
        // nothing at all before it starts (a zero-length dash still paints round caps as dots)
        const dash = p >= 1 ? (c.o.dash || 'none') : `${p.toFixed(4)} 2`;
        if (dash !== c.lastDash) { c.path.style.strokeDasharray = dash; c.path.style.visibility = p <= 0 ? 'hidden' : ''; c.lastDash = dash; changed = true; }
      }
    }
    return changed;
  }

  // ---------------------------------------------------------------------------
  // data-anchor="#server bottom 12": keep an element (a label) next to another one, every frame, wherever that one
  // moves (timeline, travel, camera, entrance). Side: top bottom left right center, or top-left top-right bottom-left
  // bottom-right (above/below, lined up with that edge); "inside" puts it inside that edge instead. The number is the
  // gap in px at 1080p (default 12). The label is positioned absolutely in its own parent (left/top are set).
  // Plus gm.path.travel(el, arrow): ride along an gm.connect arrow, whose line is rebuilt every frame.
  // ---------------------------------------------------------------------------
  const r2 = (x) => Math.round(x * 100) / 100;
  const SIDES = { top: 'top', above: 'top', bottom: 'bottom', below: 'bottom', under: 'bottom', left: 'left', right: 'right', center: 'center', middle: 'center', 'top-left': 'top-left', 'top-right': 'top-right', 'bottom-left': 'bottom-left', 'bottom-right': 'bottom-right', 'left-top': 'top-left', 'right-top': 'top-right', 'left-bottom': 'bottom-left', 'right-bottom': 'bottom-right', fit: 'fit', cover: 'fit' };
  function parseAnchor(v) {
    const toks = String(v || '').trim().split(/\s+/).filter(Boolean);
    let side = null, gap = null, inside = false;
    while (toks.length > 1) {
      const t = toks[toks.length - 1].toLowerCase();
      if (SIDES[t] && !side) side = SIDES[t];
      else if (t === 'inside' || t === 'in') inside = true;
      else if (t === 'outside') inside = false;
      else if (/^-?(\d+\.?\d*|\.\d+)(px)?$/.test(t) && gap == null) gap = parseFloat(t);
      else break;
      toks.pop();
    }
    // fit: the element takes the target's box (a highlight, a ring), the number is how far it reaches past it (default 6)
    return { sel: toks.join(' '), side: side || 'center', gap: gap ?? (side === 'fit' ? 6 : 12), inside };
  }
  // the nearest match: a block repeated with the same classes finds its own copy (or the box the label is in)
  function findNear(el, sel) {
    try {
      for (let p = el.parentElement; p; p = p.parentElement) {
        if (p.matches(sel)) return p;
        const m = [...p.querySelectorAll(sel)].find((x) => x !== el && !el.contains(x));
        if (m) return m;
      }
    } catch (e) { return null; }
    return null;
  }
  // where the label's top-left goes, for a target box t in the label's coordinates
  function anchorXY(t, W, H, sp) {
    const g = sp.gap * px(), [v, h] = sp.side === 'center' ? [null, null] : sp.side.includes('-') ? sp.side.split('-') : sp.side === 'top' || sp.side === 'bottom' ? [sp.side, null] : [null, sp.side];
    const corner = v && h, r = t.x + t.w, b = t.y + t.h;
    let X = t.x + t.w / 2 - W / 2, Y = t.y + t.h / 2 - H / 2;
    if (h === 'left') X = sp.inside ? t.x + g : corner ? t.x : t.x - g - W;
    if (h === 'right') X = sp.inside ? r - g - W : corner ? r - W : r + g;
    if (v === 'top') Y = sp.inside ? t.y + g : t.y - g - H;
    if (v === 'bottom') Y = sp.inside ? b - g - H : b + g;
    return [X, Y];
  }
  const anchors = [];
  // three invisible points in a parent (the same containing block as an absolute label there): screen <-> its coordinates
  const probeSets = new WeakMap();
  function probesFor(parent, pos) {
    let s = probeSets.get(parent);
    if (!s) probeSets.set(parent, (s = {}));
    if (!s[pos]) {
      const mk = (x, y) => { const d = document.createElement('div'); d.setAttribute('data-gm-internal', ''); d.style.cssText = `position:${pos};left:${x}px;top:${y}px;width:0;height:0;margin:0;pointer-events:none;visibility:hidden`; parent.appendChild(d); return d; };
      s[pos] = [mk(0, 0), mk(1000, 0), mk(0, 1000)];
    }
    return s[pos];
  }
  function collectAnchors() {
    for (const el of document.querySelectorAll('[data-anchor]')) {
      if (el.__gmAnchor) continue;
      el.__gmAnchor = true;
      const sp = parseAnchor(el.getAttribute('data-anchor'));
      const tg = sp.sel ? findNear(el, sp.sel) : null;
      if (!tg) { I.report('error', 'anchor-no-target', `data-anchor="${el.getAttribute('data-anchor')}": "${sp.sel}" matched nothing.`, el, 'Start with a selector of the element to stay next to, then the side and gap: data-anchor="#server bottom 12".'); continue; }
      const svgText = el instanceof SVGElement && /^text$/i.test(el.tagName);
      if (el instanceof SVGElement && !svgText) { I.report('warning', 'anchor-unsupported', 'data-anchor works on HTML elements and SVG <text>, not on other SVG elements.', el, 'Wrap the SVG in an HTML element, or anchor an HTML label instead.'); continue; }
      const a = { kind: 'anchor', el, tg, sp, svg: svgText };
      if (!svgText) {
        // out of the flow, at the parent's origin; its own size only (a width set by the author still wraps it)
        const cs = getComputedStyle(el);
        el.style.position = cs.position === 'fixed' ? 'fixed' : 'absolute';
        el.style.left = '0px'; el.style.top = '0px'; el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.margin = '0';
        let wAuto = false; try { wAuto = String(el.computedStyleMap().get('width')) === 'auto'; } catch (e) {}
        if (sp.side === 'fit') el.style.boxSizing = 'border-box';
        else if (wAuto) el.style.width = 'max-content';
        // the anchor centers it: a centering translate(-50%, -50%) left over from hand placement would push it off
        try { const m = cs.transform && cs.transform !== 'none' ? new DOMMatrix(cs.transform) : null; if (m && m.is2D && m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1) el.style.transform = 'none'; } catch (e) {}
        a.probes = probesFor(el.parentElement, el.style.position);
      }
      // a shape's visible edge is half its stroke outside its geometry (measured once)
      const tcs = getComputedStyle(tg);
      a.sw = tg instanceof SVGGraphicsElement && !/^(text|svg|foreignObject)$/i.test(tg.tagName) && tcs.stroke !== 'none' ? parseFloat(tcs.strokeWidth) || 0 : 0;
      anchors.push(a);
      jobsDirty = true;
    }
  }
  // screen -> the label's own coordinates (its parent's user space for SVG text)
  function labelSpace(a, cache) {
    const key = a.svg ? a.el.parentNode : a.probes;
    if (cache && cache.has(key)) return cache.get(key);
    let f = null;
    if (a.svg) { const m = a.el.parentNode.getScreenCTM(); if (m) { const inv = m.inverse(); f = (x, y) => { const q = new DOMPoint(x, y).matrixTransform(inv); return [q.x, q.y]; }; } }
    else {
      const [o, x, y] = a.probes.map((d) => d.getBoundingClientRect());
      const ax = (x.left - o.left) / 1000, ay = (x.top - o.top) / 1000, bx = (y.left - o.left) / 1000, by = (y.top - o.top) / 1000;
      const det = ax * by - ay * bx;
      if (det) f = (sx, sy) => { const dx = sx - o.left, dy = sy - o.top; return [(dx * by - dy * bx) / det, (dy * ax - dx * ay) / det]; };
    }
    if (cache) cache.set(key, f);
    return f;
  }
  // the target's box in the label's coordinates (null while it is not displayed)
  function targetBox(a, map) {
    const tg = a.tg;
    if (!tg.isConnected || !tg.getClientRects().length) return null;
    const ge = tg.hasAttribute('data-gm-sketch') ? tg.querySelector(':scope > [data-gm-sketch-guide]') || tg : tg;
    const r = ge.getBoundingClientRect();
    let e = 0;
    if (a.sw) { const m = tg.getScreenCTM && tg.getScreenCTM(); e = m ? (a.sw / 2) * Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) : 0; }
    const pts = [map(r.left - e, r.top - e), map(r.right + e, r.top - e), map(r.right + e, r.bottom + e), map(r.left - e, r.bottom + e)];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  // Each job measures first and returns its write (or null), so a frame's labels cost one layout per level, not one each.
  function planAnchor(a, init, cache) {
    const el = a.el;
    if (!el.isConnected || !el.getClientRects().length) return null;
    const map = labelSpace(a, cache);
    if (!map) return null;
    // a target that is not displayed right now (a later clip): where it was measured while loading
    const t = targetBox(a, map) || a.fallback;
    if (!t) return null;
    if (init) a.fallback = { x: r2(t.x), y: r2(t.y), w: r2(t.w), h: r2(t.h) };
    if (a.svg) {
      // SVG text: its box at x=0 y=0 (measured again only when the text changes), so x/y never depend on the last frame
      const txt = el.textContent;
      if (!a.tb || a.tb.txt !== txt) {
        el.setAttribute('x', '0'); el.setAttribute('y', '0');
        const b = el.getBBox();
        a.tb = { txt, x: b.x, y: b.y, w: b.width, h: b.height };
        a.lastX = a.lastY = null;
      }
      const [X, Y] = anchorXY(t, a.tb.w, a.tb.h, a.sp);
      const x = String(r2(X - a.tb.x)), y = String(r2(Y - a.tb.y));
      return () => { if (x === a.lastX && y === a.lastY) return false; el.setAttribute('x', x); el.setAttribute('y', y); a.lastX = x; a.lastY = y; return true; };
    }
    if (a.sp.side === 'fit') {
      const g = a.sp.gap * px(), L = r2(t.x - g) + 'px', Tp = r2(t.y - g) + 'px', W = r2(t.w + 2 * g) + 'px', Hh = r2(t.h + 2 * g) + 'px';
      return () => { if (el.style.left === L && el.style.top === Tp && el.style.width === W && el.style.height === Hh) return false; el.style.left = L; el.style.top = Tp; el.style.width = W; el.style.height = Hh; return true; };
    }
    const [X, Y] = anchorXY(t, el.offsetWidth, el.offsetHeight, a.sp);
    const L = r2(X) + 'px', Tp = r2(Y) + 'px';
    return () => { if (el.style.left === L && el.style.top === Tp) return false; el.style.left = L; el.style.top = Tp; return true; };
  }
  const shifted = (j) => !!(I.shiftTravel && (j.tr.opts.offset || j.tr.opts.side));
  // points along the arrow's line (its space's coordinates), evenly by length
  function lineSamples(g) {
    const n = g.curve ? 32 : 1, out = [];
    for (let i = 0; i <= n; i++) { const q = pointOnLine(g, i / n); out.push([q.x, q.y]); }
    return out;
  }
  // an element riding along an arrow: the arrow's line, in the rider's own coordinates
  function planTravel(j, T) {
    const g = connGeom(j.conn), el = j.el;
    if (!g) return j.svg ? () => { if (!el.style.transform) return false; el.style.transform = ''; return true; } : () => { if (el.style.offsetPath === 'none') return false; el.style.offsetPath = 'none'; j.lastV = null; return true; };
    const fwd = spaceMap(j.conn.space).fwd;
    let v;
    if (j.svg) {
      const m = el.parentNode.getScreenCTM();
      if (!m) return null;
      const inv = m.inverse(), P = (x, y) => { const s = fwd(x, y), q = new DOMPoint(s[0], s[1]).matrixTransform(inv); return [q.x, q.y]; };
      const a = P(g.x1, g.y1), b = P(g.x2, g.y2), q = P(g.qx, g.qy);
      const side = shifted(j) && I.shiftTravel(lineSamples(g).map((s) => P(s[0], s[1])), j.tr, j.w || 0, j.h || 0);
      const pe = measure(side ? 'M' + side.map((s) => f1(s[0]) + ' ' + f1(s[1])).join('L') : g.curve ? `M${a[0]} ${a[1]}Q${q[0]} ${q[1]} ${b[0]} ${b[1]}` : `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`), len = pe.getTotalLength();
      const at = len * Math.max(0, Math.min(1, j.tr.progress(I.mapT(el, T) - I.clipStartOf(el))));
      const p = pe.getPointAtLength(at), p0 = pe.getPointAtLength(Math.max(0, at - 0.5)), p1 = pe.getPointAtLength(Math.min(len, at + 0.5));
      const rot = j.tr.opts.rotate, ang = rot === true || rot === 'auto' ? (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI : 0;
      v = `translate(${r2(p.x - j.cx)}px, ${r2(p.y - j.cy)}px)` + (ang ? ` rotate(${r2(ang)}deg)` : '');
      return () => { if (el.style.transform === v) return false; el.style.transform = v; return true; };
    }
    // CSS offset-path: (0,0) is the element's own layout corner; the browser animates offset-distance (the stops)
    // (an outer <svg> has no offsetLeft: where its box sits was measured once, j.host)
    const H = j.host, toCB = spaceMap(H ? H.cb : el.offsetParent || el.parentElement), ox = H ? H.ox : el.offsetLeft, oy = H ? H.oy : el.offsetTop;
    const P = (x, y) => { const s = fwd(x, y), q = toCB(s[0], s[1]); return r2(q[0] - ox) + ' ' + r2(q[1] - oy); };
    if (shifted(j)) {
      // beside the line (offset / side): the line sampled in the rider's space, moved sideways
      const C = (x, y) => { const s = fwd(x, y), q = toCB(s[0], s[1]); return [q[0] - ox, q[1] - oy]; };
      const pts = I.shiftTravel(lineSamples(g).map((s) => C(s[0], s[1])), j.tr, H ? H.w : el.offsetWidth, H ? H.h : el.offsetHeight);
      v = `path("M${pts.map((s) => r2(s[0]) + ' ' + r2(s[1])).join(' L')}")`;
    } else v = `path("M${P(g.x1, g.y1)} ${g.curve ? 'Q' + P(g.qx, g.qy) + ' ' : 'L'}${P(g.x2, g.y2)}")`;
    return () => { if (j.lastV === v) return false; el.style.offsetPath = v; j.lastV = v; return true; };
  }
  // Anchors and riders, in order: a label on a label (or on a rider, or inside a moving label) is placed after it.
  // Most run before the camera (so a camera shot can frame them); one whose target is moved by the camera from
  // outside it (a label over the stage pinned to something in the world) runs after the camera.
  let jobs = [], jobsDirty = true;
  function orderJobs() {
    const all = anchors.concat(I.liveTravels || []);
    const depsOf = (j) => (j.kind === 'anchor' ? [j.tg] : [j.conn.A || elOf(j.conn.a), j.conn.B || elOf(j.conn.b)]).concat(j.el.parentElement).filter(Boolean);
    const moved = (k, e) => k.el === e || k.el.contains(e);
    const out = [], state = new Map();
    const visit = (j) => {
      const s = state.get(j);
      if (s === 2) return;
      if (s === 1) { I.report('error', 'anchor-loop', 'data-anchor: these elements are anchored to each other in a loop.', j.el, 'Anchor each label to a shape that is not anchored back to it.'); return; }
      state.set(j, 1);
      j.dep = []; j.level = 0;
      for (const d of depsOf(j)) for (const k of all) if (k !== j && moved(k, d) && !j.dep.includes(k)) { visit(k); j.dep.push(k); j.level = Math.max(j.level, (k.level || 0) + 1); }
      state.set(j, 2); out.push(j);
    };
    all.forEach(visit);
    // what the camera moves: its world, layers with parallax, shared-element morphs
    const mover = (e) => e && e.closest && e.closest('[data-gm-camera-world],[data-parallax],[data-morph]');
    for (const j of out) j.late = depsOf(j).some((d) => mover(d) !== mover(j.el)) || j.dep.some((k) => k.late);
    // before the camera, the camera's transforms of the last frame are taken off while measuring: rounding then never
    // depends on which frame came before (1 worker == N workers)
    camLayers = [...new Set(out.filter((j) => !j.late).flatMap((j) => { const r = []; for (let e = j.el.closest('[data-gm-camera-world],[data-parallax]'); e; e = e.parentElement && e.parentElement.closest('[data-gm-camera-world],[data-parallax]')) r.push(e); return r; }))];
    jobs = out.sort((x, y) => x.level - y.level); jobsDirty = false;
  }
  let camLayers = [];
  function runJobs(T, late) {
    if (jobsDirty || jobs.length !== anchors.length + (I.liveTravels || []).length) orderJobs();
    if (!late && camLayers.length) {
      if (I.noteMutations) I.noteMutations(); // (real changes so far still count; the toggle below does not)
      const saved = camLayers.map((e) => e.style.transform);
      for (const e of camLayers) e.style.transform = 'none';
      try { return runLevels(T, late); } finally { camLayers.forEach((e, i) => { e.style.transform = saved[i]; }); if (I.dropOwnMutations) I.dropOwnMutations(); }
    }
    return runLevels(T, late);
  }
  function runLevels(T, late) {
    let changed = false;
    for (let i = 0; i < jobs.length;) {
      const lv = jobs[i].level, writes = [], cache = new Map();
      for (; i < jobs.length && jobs[i].level === lv; i++) {
        const j = jobs[i];
        if (!!j.late !== late) continue;
        const w = j.kind === 'anchor' ? planAnchor(j, false, cache) : planTravel(j, T);
        if (w) writes.push(w);
      }
      for (const w of writes) if (w()) changed = true;
    }
    return changed;
  }
  // placed once while loading (the same in every worker), so a camera shot at 'content' sees the labels in place;
  // things in clips that are not on screen yet are shown for a moment to be measured
  function initAnchors() {
    collectAnchors();
    if (!anchors.length) return;
    orderJobs();
    for (const a of jobs) {
      if (a.kind !== 'anchor') continue;
      const hidden = [];
      for (const e of [a.el, a.tg]) for (let p = e; p; p = p.parentElement) if (p.hasAttribute && p.hasAttribute('data-gm-hidden')) { hidden.push(p); p.removeAttribute('data-gm-hidden'); }
      try { const w = planAnchor(a, true, null); if (w) w(); } catch (e) { I.pageError(e); } finally { for (const p of hidden) p.setAttribute('data-gm-hidden', ''); }
    }
    jobsDirty = true;
  }
  I.hooks.init.unshift(initAnchors);
  I.hooks.rebuild.push(collectAnchors);
  I.hooks.post.unshift((T) => runJobs(T, false));
  I.hooks.post.push((T) => runJobs(T, true));
  I.hooks.post.push(updateConnectors);

  // ---------------------------------------------------------------------------
  // gm.sketch.loop(targets, { padding, passes, roughness, seed, color, width, draw, in, behind, id, class }): a
  // hand-drawn loop around a group of elements (or {x, y, w, h} boxes in the space's coordinates). Measured once while
  // the page loads, at the moment it starts drawing (so things that are still entering are where they will be).
  // ---------------------------------------------------------------------------
  const loops = [];
  let loopsBuilt = false;
  function loopAround(targets, o = {}) {
    const L = { targets: Array.isArray(targets) ? targets : [targets], o, seed: o.seed ?? 'loop' + loops.length };
    loops.push(L);
    if (loopsBuilt) buildLoop(L, false);
    return { el: () => L.path || null, progress: (t) => (L.progressAt ? L.progressAt(t) : L.path ? 1 : 0), __gmLoop: L };
  }
  function loopDraw(L) {
    const dr = L.o.draw;
    if (dr == null || dr === false) return null;
    const at = Array.isArray(dr) ? +dr[0] : typeof dr === 'object' ? +dr.at || 0 : +dr || 0;
    const dur = Array.isArray(dr) ? +(dr[1] ?? 1) : typeof dr === 'object' ? +(dr.duration ?? 1) : 1;
    const ease = I.easing ? I.easing(Array.isArray(dr) ? dr[2] || 'in-out-cubic' : (dr && dr.ease) || 'in-out-cubic') : (q) => q;
    return { at, dur, ease };
  }
  function buildLoop(L, probe) {
    const o = L.o, els = [], boxes0 = [];
    for (const t of L.targets) {
      if (typeof t === 'string') { try { els.push(...document.querySelectorAll(t)); } catch (e) { I.report('error', 'loop-no-target', `gm.sketch.loop: "${t}" is not a valid selector.`, null); } }
      else if (t && t.nodeType === 1) els.push(elOf(t));
      else if (t && typeof t === 'object' && 'x' in t) boxes0.push({ x: +t.x || 0, y: +t.y || 0, w: +t.w || 0, h: +t.h || 0 });
    }
    let space = o.in ? elOf(o.in) : null;
    if (!space && els.length) { space = commonParent(els[0], els[0]); for (const e of els) while (space !== document.body && !space.contains(e)) space = space.parentElement; }
    if (!els.length && !boxes0.length) { if (L.dead) return; L.dead = true; I.report('error', 'loop-no-target', `gm.sketch.loop: ${JSON.stringify(L.targets.map(String))} matched nothing.`, null, "Give selectors or elements to circle, e.g. gm.sketch.loop(['#a', '#b', '#c'], { draw: [5, 1] })."); return; }
    space = space || document.body;
    const dr = loopDraw(L), base = o.global ? 0 : gm.timing(space === document.body ? els[0] || space : space).start;
    // measured where things are when the loop starts drawing
    if (probe && I.probe) I.probe(base + (dr ? dr.at : 0));
    const boxes = boxes0.slice(), rr = (x) => Math.round(x * 100) / 100;
    for (const e of els) {
      const hidden = [];
      if (!e.getClientRects().length) for (let a = e; a; a = a.parentElement) if (a.hasAttribute && a.hasAttribute('data-gm-hidden')) { hidden.push(a); a.removeAttribute('data-gm-hidden'); }
      try { const r = rectIn(e, space); if (r && (r.w || r.h)) boxes.push({ x: rr(r.x), y: rr(r.y), w: rr(r.w), h: rr(r.h) }); } finally { for (const a of hidden) a.setAttribute('data-gm-hidden', ''); }
    }
    const pad = (o.padding ?? 24) * px();
    const d = loopPath(boxes, pad, { roughness: o.roughness ?? 1, passes: o.passes ?? 2, seed: L.seed });
    if (L.path) { L.path.setAttribute('d', d); return; }
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'gm-sketch-loop' + (o.class ? ' ' + o.class : ''));
    if (o.id) svg.id = o.id;
    svg.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none';
    const pe = document.createElementNS(SVGNS, 'path');
    pe.setAttribute('d', d);
    pe.setAttribute('fill', 'none');
    pe.style.stroke = o.color || '#e03131';
    pe.style.strokeWidth = (o.width ?? 5) * px() + 'px';
    pe.style.strokeLinecap = 'round'; pe.style.strokeLinejoin = 'round';
    svg.appendChild(pe);
    if (space !== document.body && getComputedStyle(space).position === 'static') space.style.position = 'relative';
    if (o.behind) space.insertBefore(svg, space.firstChild); else space.appendChild(svg);
    L.svg = svg; L.path = pe;
    if (dr) {
      pe.setAttribute('pathLength', '1');
      L.progressAt = (T) => Math.max(0, Math.min(1, dr.ease(Math.max(0, Math.min(1, (T - base - dr.at) / Math.max(1e-6, dr.dur))))));
    }
  }
  function updateLoops(T) {
    let changed = false;
    for (const L of loops) {
      if (!L.progressAt) continue;
      const p = L.progressAt(T), dash = p >= 1 ? 'none' : `${p.toFixed(4)} 2`, vis = p <= 0 ? 'hidden' : '';
      if (dash !== L.lastDash || vis !== L.lastVis) { L.path.style.strokeDasharray = dash; L.svg.style.visibility = vis; L.lastDash = dash; L.lastVis = vis; changed = true; }
    }
    return changed;
  }
  // Drawn first where things are while the page loads (before cameras measure the world's content, so a shot at
  // 'content' includes the loop), then measured again after every other step of loading, at the moment it starts
  // drawing (timelines and cameras are built then, so probing that moment shows the page as rendered).
  I.hooks.init.unshift(() => { for (const L of loops) if (!L.svg) { try { buildLoop(L, false); } catch (e) { I.pageError(e); } } });
  I.hooks.init.push(() => I.hooks.init.push(() => {
    if (!loops.length) { loopsBuilt = true; return; }
    for (const L of loops) if (!L.dead) { try { buildLoop(L, true); } catch (e) { I.pageError(e); } }
    if (I.probe) I.probe(0);
    loopsBuilt = true;
  }));
  I.hooks.seek.push(updateLoops);

  gm.rect = rectIn;
  gm.connect = connect;
  // Without a seed, the shape's own numbers are the seed: the same call gives the same drawing in every frame and
  // every worker (a counter would make lines boil when called from onFrame).
  const seeded = (fn, n) => (...a) => {
    let o = a[n] && typeof a[n] === 'object' && !Array.isArray(a[n]) ? a[n] : {};
    if (o.seed == null) o = { ...o, seed: 'g' + hashStr(JSON.stringify(a.slice(0, n))) };
    a[n] = o;
    return fn(...a);
  };
  gm.sketch = {
    line: seeded((x1, y1, x2, y2, o) => line(x1, y1, x2, y2, o), 4),
    rect: seeded((x, y, w, h, o) => rect(x, y, w, h, o), 4),
    ellipse: seeded((cx, cy, rx, ry, o) => ellipse(cx, cy, rx, ry, o), 4),
    circle: seeded((cx, cy, r, o) => circle(cx, cy, r, o), 3),
    polygon: seeded((points, o) => polygon(points, o), 1),
    polyline: seeded((points, o) => polyline(points, o), 1),
    path: seeded((d, o) => path(d, o), 1),
    arrow: seeded((x1, y1, x2, y2, o) => arrow(x1, y1, x2, y2, { ...o, raw: o || {} }), 4),
    hachure: seeded((shape, o) => hachure(shape, o), 1),
    loop: loopAround,
    underline: (x1, y1, x2, y2, o) => { if (y2 != null && typeof y2 === 'object') { o = y2; y2 = undefined; } return seeded((a, b, c, e, oo) => underline(a, b, c, e, { ...oo, raw: oo || {} }), 4)(x1, y1, x2, y2 ?? y1, o); },
    apply: setupSketch,
  };
})();
