/* givemotion motion tools: gm.timeline (seekable tweens), paths, shapes, camera moves,
 * shared-element morphs, fit-to-box text and scramble text. MIT License.
 * Everything here is a pure function of time, so any frame can be rendered in any order.
 */
(function () {
  'use strict';
  const gm = window.gm;
  if (!gm || !gm.__internal || gm.timeline) return;
  const I = gm.__internal;
  const PX = I.PX;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const r4 = (x) => Math.round(x * 10000) / 10000;

  // ---------------------------------------------------------------------------
  // Colors: parse any CSS color, mix in OKLab (no muddy grey midpoints)
  // ---------------------------------------------------------------------------
  const colorCache = new Map();
  let cctx = null;
  function toRGBA(str) {
    if (Array.isArray(str)) return str;
    str = String(str).trim();
    if (colorCache.has(str)) return colorCache.get(str);
    let out = null, m;
    if ((m = /^#([0-9a-f]{3,8})$/i.exec(str))) {
      let h = m[1];
      if (h.length <= 4) h = [...h].map((x) => x + x).join('');
      const n = parseInt(h.slice(0, 6), 16);
      out = [(n >> 16) & 255, (n >> 8) & 255, n & 255, h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1];
    } else if ((m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(str))) {
      const a = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      out = [+m[1], +m[2], +m[3], a];
    } else if (str === 'transparent') out = [0, 0, 0, 0];
    else if (typeof CSS !== 'undefined' && CSS.supports('color', str)) {
      if (!cctx) { const c = document.createElement('canvas'); c.width = c.height = 1; cctx = c.getContext('2d', { willReadFrequently: true }); }
      cctx.clearRect(0, 0, 1, 1);
      cctx.fillStyle = '#000';
      cctx.fillStyle = str;
      // Read alpha exactly from the serialized style when possible, rgb from a painted pixel.
      cctx.globalAlpha = 1;
      cctx.fillRect(0, 0, 1, 1);
      const d = cctx.getImageData(0, 0, 1, 1).data;
      out = [d[0], d[1], d[2], d[3] / 255];
    }
    colorCache.set(str, out);
    return out;
  }
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const unlin = (c) => { const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(Math.max(0, Math.min(1, v)) * 255); };
  function toLab(c) {
    const r = lin(c[0]), g = lin(c[1]), b = lin(c[2]);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }
  function fromLab(L) {
    const l = (L[0] + 0.3963377774 * L[1] + 0.2158037573 * L[2]) ** 3;
    const m = (L[0] - 0.1055613458 * L[1] - 0.0638541728 * L[2]) ** 3;
    const s = (L[0] - 0.0894841775 * L[1] - 1.291485548 * L[2]) ** 3;
    return [unlin(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), unlin(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), unlin(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
  }
  function mixRGBA(A, B, p) {
    // A fully transparent end takes the other end's hue, so fades do not pass through black.
    if (A[3] === 0 && B[3] > 0) A = [B[0], B[1], B[2], 0];
    if (B[3] === 0 && A[3] > 0) B = [A[0], A[1], A[2], 0];
    const la = toLab(A), lb = toLab(B);
    const rgb = fromLab([la[0] + (lb[0] - la[0]) * p, la[1] + (lb[1] - la[1]) * p, la[2] + (lb[2] - la[2]) * p]);
    const a = r4(A[3] + (B[3] - A[3]) * p);
    return a >= 1 ? `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})` : `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
  }
  function mixColor(a, b, p) { const A = toRGBA(a), B = toRGBA(b); return A && B ? mixRGBA(A, B, p) : (p < 0.5 ? a : b); }

  // ---------------------------------------------------------------------------
  // Value interpolation: numbers, strings with numbers and colors inside
  // ---------------------------------------------------------------------------
  const COLOR_SRC = '#[0-9a-fA-F]{3,8}\\b|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\\([^()]*\\)|\\b(?:transparent|white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|cyan|magenta|lime|navy|teal|gold|silver)\\b';
  const NUM_SRC = '[-+]?(?:\\d*\\.\\d+|\\d+\\.?)(?:e[-+]?\\d+)?';
  const TOK = new RegExp(COLOR_SRC + '|' + NUM_SRC, 'gi');
  function tokenize(s) {
    s = String(s);
    const lits = [], vals = [];
    let last = 0;
    for (const m of s.matchAll(TOK)) {
      const txt = m[0];
      // a number glued to letters before it is part of a name (e.g. "h1"), not a value
      if (/^[-+.\d]/.test(txt) && m.index > 0 && /[a-zA-Z_]/.test(s[m.index - 1]) && !/[-+]/.test(txt[0])) continue;
      lits.push(s.slice(last, m.index));
      vals.push(/^[-+.\d]/.test(txt) ? parseFloat(txt) : (toRGBA(txt) || txt));
      last = m.index + txt.length;
    }
    lits.push(s.slice(last));
    return { lits, vals };
  }
  function sameShape(A, B) {
    if (A.vals.length !== B.vals.length || A.lits.length !== B.lits.length) return false;
    for (let i = 0; i < A.lits.length; i++) if (A.lits[i] !== B.lits[i]) return false;
    for (let i = 0; i < A.vals.length; i++) if (typeof A.vals[i] !== typeof B.vals[i]) return false;
    return true;
  }
  function interpTokens(A, B) {
    return (p) => {
      let out = A.lits[0];
      for (let i = 0; i < A.vals.length; i++) {
        const a = A.vals[i], b = B.vals[i];
        out += (typeof a === 'number' ? String(r4(a + (b - a) * p)) : mixRGBA(a, b, p)) + A.lits[i + 1];
      }
      return out;
    };
  }
  const FILTER_ID = { blur: '0px', brightness: '1', contrast: '1', grayscale: '0', 'hue-rotate': '0deg', invert: '0', opacity: '1', saturate: '1', sepia: '0', 'drop-shadow': '0px 0px 0px transparent' };
  function identityFilter(to) {
    return String(to).replace(/([a-z-]+)\(([^()]*(?:\([^()]*\))?[^()]*)\)/g, (all, fn) => (FILTER_ID[fn] != null ? `${fn}(${FILTER_ID[fn]})` : all));
  }
  // Let the browser interpolate anything it knows how to (transforms, clip-path, mixed units),
  // sampled once up front, so seeking stays cheap.
  let helperEl = null;
  function browserInterp(prop, from, to) {
    if (!helperEl) { helperEl = document.createElement('div'); helperEl.setAttribute('data-gm-internal', ''); helperEl.style.cssText = 'position:absolute;left:-99999px;top:0;width:100px;height:100px;visibility:hidden;pointer-events:none'; document.body.appendChild(helperEl); }
    let a;
    try { a = I.real.animate.call(helperEl, [{ [prop]: from }, { [prop]: to }], { duration: 1000, fill: 'both' }); } catch (e) { return null; }
    a.pause();
    const N = 32, samples = [];
    const kebab = prop.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
    for (let k = 0; k <= N; k++) { a.currentTime = (k / N) * 1000; samples.push(getComputedStyle(helperEl).getPropertyValue(kebab)); }
    a.cancel();
    if (samples[0] === samples[N] && String(from) !== String(to)) return null; // not interpolable
    const toks = samples.map(tokenize);
    return (p) => {
      if (p <= 0) return samples[0];
      if (p >= 1) return samples[N];
      const f = p * N, i = Math.floor(f);
      const A = toks[i], B = toks[i + 1];
      return sameShape(A, B) ? interpTokens(A, B)(f - i) : samples[Math.round(f)];
    };
  }
  /** 'var(--accent)' in a tween value → the element's value of --accent (with fallbacks, nested), so colors and lengths
   *  from CSS variables interpolate instead of snapping or turning black. Done once, when the tween is set up. */
  function resolveVars(el, v) {
    if (typeof v !== 'string' || v.indexOf('var(') < 0 || !(el instanceof Element)) return v;
    const cs = getComputedStyle(el);
    for (let guard = 0; guard < 20 && v.indexOf('var(') >= 0; guard++) {
      const i = v.lastIndexOf('var(');
      let depth = 0, j = i + 3;
      for (; j < v.length; j++) { if (v[j] === '(') depth++; else if (v[j] === ')' && --depth === 0) break; }
      const inner = v.slice(i + 4, j), c = inner.indexOf(',');
      const name = (c < 0 ? inner : inner.slice(0, c)).trim();
      const val = cs.getPropertyValue(name).trim() || (c < 0 ? '' : inner.slice(c + 1).trim());
      v = v.slice(0, i) + val + v.slice(j + 1);
    }
    return v;
  }
  const exitEase = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (0.25 + 0.75 * x)); // eases in, leaves at speed
  function makeInterp(from, to, prop) {
    if (typeof from === 'number' && typeof to === 'number') return (p) => from + (to - from) * p;
    const fs = String(from), ts = String(to);
    if (fs === ts) return () => from;
    let A = tokenize(fs), B = tokenize(ts);
    if (prop === 'filter' || prop === 'backdropFilter') {
      if (fs === 'none') A = tokenize(identityFilter(ts));
      if (ts === 'none') B = tokenize(identityFilter(fs));
    }
    if (sameShape(A, B)) return interpTokens(A, B);
    const ca = toRGBA(fs), cb = ca && toRGBA(ts);
    if (ca && cb) return (p) => mixRGBA(ca, cb, p);
    if (prop && !prop.startsWith('--') && /^[a-zA-Z]+$/.test(prop)) {
      const bi = browserInterp(prop, fs, ts);
      if (bi) return bi;
    }
    return (p) => (p < 0.5 ? from : to); // not interpolable: switch halfway (like CSS)
  }

  // ---------------------------------------------------------------------------
  // Paths and shapes
  // ---------------------------------------------------------------------------
  let measSvg = null;
  function pathEl(d) {
    if (d && d.nodeType === 1) d = d.getAttribute('d');
    if (!measSvg) { measSvg = document.createElementNS(SVGNS, 'svg'); }
    const p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', d || 'M0 0');
    return p;
  }
  const lenCache = new Map();
  function pathInfo(d) {
    if (d && d.nodeType === 1) d = d.getAttribute('d');
    let pi = lenCache.get(d);
    if (!pi) { const el = pathEl(d); pi = { el, len: el.getTotalLength() }; lenCache.set(d, pi); }
    return pi;
  }
  function pointAt(d, p) {
    const { el, len } = pathInfo(d);
    const L = Math.max(0, Math.min(1, p)) * len;
    const a = el.getPointAtLength(L), b = el.getPointAtLength(Math.min(len, L + 0.5)), c = el.getPointAtLength(Math.max(0, L - 0.5));
    return { x: a.x, y: a.y, angle: (Math.atan2(b.y - c.y, b.x - c.x) * 180) / Math.PI };
  }
  function samplePoly(d, n) {
    const el = pathEl(d), len = el.getTotalLength(), pts = [];
    for (let i = 0; i < n; i++) { const q = el.getPointAtLength((i / n) * len); pts.push([q.x, q.y]); }
    return pts;
  }
  function area(pts) { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  function centroid(pts) { let x = 0, y = 0; for (const p of pts) { x += p[0]; y += p[1]; } return [x / pts.length, y / pts.length]; }
  function splitSub(d) { return String(d).trim().split(/(?=M)/).map((s) => s.trim()).filter(Boolean); }
  // Area centroid of a closed polygon (the mean of the samples drifts toward detailed edges).
  function areaCentroid(pts) {
    let a = 0, x = 0, y = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length], c = p[0] * q[1] - q[0] * p[1];
      a += c; x += (p[0] + q[0]) * c; y += (p[1] + q[1]) * c;
    }
    return Math.abs(a) < 1e-9 ? centroid(pts) : [x / (3 * a), y / (3 * a)];
  }
  // The outline as a radius per direction from its centre, when every ray from the centre crosses it once
  // (circles, rounded rects, polygons, stars, blobs). null for anything else (letters, crescents, open paths).
  const RAYS = 360;
  function radialProfile(d) {
    const M = 720, pts = samplePoly(d, M), c = areaCentroid(pts);
    let prev = Math.atan2(pts[0][1] - c[1], pts[0][0] - c[0]), sweep = 0, dir = 0;
    for (let i = 1; i <= M; i++) {
      const q = pts[i % M], a = Math.atan2(q[1] - c[1], q[0] - c[0]);
      let da = a - prev; if (da > Math.PI) da -= 2 * Math.PI; else if (da < -Math.PI) da += 2 * Math.PI;
      if (Math.abs(da) > 1e-9) { const s = Math.sign(da); if (dir && s !== dir) return null; dir = s; }
      sweep += da; prev = a;
    }
    if (Math.abs(Math.abs(sweep) - 2 * Math.PI) > 0.01) return null;
    const r = new Float64Array(RAYS);
    for (let k = 0; k < RAYS; k++) {
      const t = (k / RAYS) * 2 * Math.PI, ux = Math.cos(t), uy = Math.sin(t);
      let best = -1;
      for (let i = 0; i < M; i++) {
        // ray c + s·u against segment P→Q
        const P = pts[i], Q = pts[(i + 1) % M], ex = Q[0] - P[0], ey = Q[1] - P[1];
        const den = ux * ey - uy * ex; if (Math.abs(den) < 1e-12) continue;
        const wx = P[0] - c[0], wy = P[1] - c[1];
        const s = (wx * ey - wy * ex) / den, v = (wx * uy - wy * ux) / den;
        if (s > 0 && v >= -1e-9 && v <= 1 + 1e-9 && (best < 0 || s < best)) best = s;
      }
      if (best < 0) return null;
      r[k] = best;
    }
    return { c, r };
  }
  // A convex outline as its extreme point in each direction (its support points). Blending two shapes' support points
  // direction by direction traces the boundary of their blended shape (a Minkowski mix): every in-between is convex and
  // balanced, with the corners of the start and the end. null when the outline is not convex.
  function supportProfile(d) {
    const M = 720, pts = samplePoly(d, M);
    let dir = 0;
    for (let i = 0; i < M; i++) {
      const a = pts[i], b = pts[(i + 1) % M], c = pts[(i + 2) % M];
      const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(c[0] - b[0], c[1] - b[1]);
      if (Math.abs(cr) <= 1e-3 * len) continue; // straight
      const s = Math.sign(cr); if (dir && s !== dir) return null; dir = s;
    }
    const sp = [];
    for (let k = 0; k < RAYS; k++) {
      const t = (k / RAYS) * 2 * Math.PI, ux = Math.cos(t), uy = Math.sin(t);
      let bi = 0, bv = -Infinity;
      for (let i = 0; i < M; i++) { const v = pts[i][0] * ux + pts[i][1] * uy; if (v > bv + 1e-9) { bv = v; bi = i; } }
      sp.push(pts[bi]);
    }
    return sp;
  }
  /** Overshoot (an ease past 0 or 1: back, elastic, spring) grows or shrinks the shape about its centre instead of
   *  pushing the outline past the target, which dents and spikes it. */
  function overshootScale(pts, p) {
    const s = 1 + (p - Math.max(0, Math.min(1, p)));
    if (s === 1) return pts;
    const c = areaCentroid(pts);
    return pts.map((q) => [c[0] + (q[0] - c[0]) * s, c[1] + (q[1] - c[1]) * s]);
  }
  function morphInterp(dA, dB) {
    if (dA && dA.nodeType === 1) dA = dA.getAttribute('d');
    if (dB && dB.nodeType === 1) dB = dB.getAttribute('d');
    const A = tokenize(dA), B = tokenize(dB);
    if (sameShape(A, B)) return interpTokens(A, B); // same commands: exact
    const sa = splitSub(dA), sb = splitSub(dB);
    // One closed outline each, both seen whole from their centres: match points by direction and blend the radius
    // and the centre, so the in-betweens stay balanced (a square to a triangle no longer passes through a lopsided
    // wedge). The first and last frames are the exact paths.
    if (sa.length === 1 && sb.length === 1 && /z\s*$/i.test(dA) && /z\s*$/i.test(dB) && !/m/.test(dA.slice(1)) && !/m/.test(dB.slice(1))) {
      const ca = supportProfile(dA), cb = ca && supportProfile(dB);
      if (ca && cb) {
        return (p) => {
          if (p === 0) return dA;
          if (p === 1) return dB;
          const q = Math.max(0, Math.min(1, p));
          let pts = ca.map((v, k) => [v[0] + (cb[k][0] - v[0]) * q, v[1] + (cb[k][1] - v[1]) * q]);
          pts = overshootScale(pts.filter((v, k) => k === 0 || v[0] !== pts[k - 1][0] || v[1] !== pts[k - 1][1]), p);
          return 'M' + pts.map((v) => r4(v[0]) + ' ' + r4(v[1])).join('L') + 'Z';
        };
      }
      const ra = radialProfile(dA), rb = ra && radialProfile(dB);
      if (ra && rb) {
        return (p) => {
          if (p === 0) return dA;
          if (p === 1) return dB;
          const q = Math.max(0, Math.min(1, p));
          const cx = ra.c[0] + (rb.c[0] - ra.c[0]) * q, cy = ra.c[1] + (rb.c[1] - ra.c[1]) * q;
          let pts = [];
          for (let k = 0; k < RAYS; k++) {
            const t = (k / RAYS) * 2 * Math.PI, rr = ra.r[k] + (rb.r[k] - ra.r[k]) * q;
            pts.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]);
          }
          pts = overshootScale(pts, p);
          return 'M' + pts.map((v) => r4(v[0]) + ' ' + r4(v[1])).join('L') + 'Z';
        };
      }
    }
    const relative = /m/.test(dA.slice(1)) || /m/.test(dB.slice(1));
    const subsA = relative ? [dA] : sa, subsB = relative ? [dB] : sb;
    const n = Math.max(subsA.length, subsB.length);
    const pairs = [];
    for (let k = 0; k < n; k++) {
      const a = subsA[k], b = subsB[k];
      const la = a ? pathInfo(a).len : 0, lb = b ? pathInfo(b).len : 0;
      const N = Math.max(24, Math.min(360, Math.round(Math.max(la, lb) / 3)));
      let pa = a ? samplePoly(a, N) : null, pb = b ? samplePoly(b, N) : null;
      if (!pa) { const c = centroid(pb); pa = pb.map(() => c.slice()); }
      if (!pb) { const c = centroid(pa); pb = pa.map(() => c.slice()); }
      const closed = /z\s*$/i.test(a || '') || /z\s*$/i.test(b || '');
      if (closed) {
        if (Math.sign(area(pa)) !== Math.sign(area(pb)) && area(pa) !== 0 && area(pb) !== 0) pb.reverse();
        let best = 0, bestD = Infinity;
        const step = Math.max(1, Math.floor(N / 90));
        for (let off = 0; off < N; off += step) {
          let s = 0;
          for (let i = 0; i < N; i += 3) { const p = pa[i], q = pb[(i + off) % N]; s += (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; }
          if (s < bestD) { bestD = s; best = off; }
        }
        pb = pb.map((_, i) => pb[(i + best) % N]);
      }
      pairs.push({ pa, pb, closed });
    }
    return (p) => {
      if (p === 0) return dA;
      if (p === 1) return dB;
      const q = Math.max(0, Math.min(1, p));
      return pairs.map(({ pa, pb, closed }) => {
        let pts = pa.map((v, i) => [v[0] + (pb[i][0] - v[0]) * q, v[1] + (pb[i][1] - v[1]) * q]);
        if (closed) pts = overshootScale(pts, p);
        return 'M' + pts.map((v) => r4(v[0]) + ' ' + r4(v[1])).join('L') + (closed ? 'Z' : '');
      }).join(' ');
    };
  }

  // Shape generators: all return SVG path data centered on (cx, cy).
  function polyPath(pts, closed = true) { return 'M' + pts.map((p) => r4(p[0]) + ' ' + r4(p[1])).join('L') + (closed ? 'Z' : ''); }
  function smoothClosed(pts) {
    // Catmull-Rom through the points, as cubic Beziers
    const n = pts.length;
    let d = `M${r4(pts[0][0])} ${r4(pts[0][1])}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${r4(c1[0])} ${r4(c1[1])} ${r4(c2[0])} ${r4(c2[1])} ${r4(p2[0])} ${r4(p2[1])}`;
    }
    return d + 'Z';
  }
  const shape = {
    circle(r = 50, o = {}) { const { cx = 0, cy = 0 } = o; return `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`; },
    ellipse(rx = 60, ry = 40, o = {}) { const { cx = 0, cy = 0 } = o; return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`; },
    rect(w = 100, h = 100, o = {}) {
      const { cx = 0, cy = 0 } = o; const r = Math.min(o.r || 0, w / 2, h / 2); const x = cx - w / 2, y = cy - h / 2;
      if (!r) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
      return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
    },
    polygon(sides = 6, r = 50, o = {}) {
      const { cx = 0, cy = 0, rotation = 0 } = o; const pts = [];
      for (let i = 0; i < sides; i++) { const a = ((rotation - 90) * Math.PI) / 180 + (i / sides) * Math.PI * 2; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
      return polyPath(pts);
    },
    star(points = 5, outer = 50, inner, o = {}) {
      inner = inner ?? outer * 0.45; const { cx = 0, cy = 0, rotation = 0 } = o; const pts = [];
      for (let i = 0; i < points * 2; i++) { const r = i % 2 ? inner : outer; const a = ((rotation - 90) * Math.PI) / 180 + (i / (points * 2)) * Math.PI * 2; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
      return polyPath(pts);
    },
    heart(size = 100, o = {}) {
      const { cx = 0, cy = 0 } = o; const s = size / 100;
      const P = (x, y) => `${r4(cx + x * s)} ${r4(cy + y * s)}`;
      return `M${P(0, 35)}C${P(-45, 5)} ${P(-55, -30)} ${P(-28, -42)}C${P(-12, -48)} ${P(0, -38)} ${P(0, -24)}C${P(0, -38)} ${P(12, -48)} ${P(28, -42)}C${P(55, -30)} ${P(45, 5)} ${P(0, 35)}Z`;
    },
    // An organic blob. Animate it by passing t (seconds): gm.shape.blob(200, { t })
    blob(r = 100, o = {}) {
      const { cx = 0, cy = 0, points = 8, wobble = 0.22, seed = 1, t = 0, speed = 0.35 } = o; const pts = [];
      for (let i = 0; i < points; i++) {
        const a = (i / points) * Math.PI * 2;
        const k = 1 + wobble * (gm.noise(t * speed + i * 1.7, seed + i * 13.1) * 2 - 1);
        pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k]);
      }
      return smoothClosed(pts);
    },
    // A sine wave from x0 to x0+width (open path)
    wave(width = 400, o = {}) {
      const { x = 0, y = 0, amp = 30, freq = 2, phase = 0, steps = 96 } = o; const pts = [];
      for (let i = 0; i <= steps; i++) { const u = i / steps; pts.push([x + u * width, y + Math.sin(u * freq * Math.PI * 2 + phase) * amp]); }
      return polyPath(pts, false);
    },
    smooth: smoothClosed,
    poly: polyPath,
  };

  // ---------------------------------------------------------------------------
  // Timeline: GSAP-style API, but every value is computed from the time,
  // so frames can be rendered in any order and in parallel.
  // ---------------------------------------------------------------------------
  const TF = { x: 'px', y: 'px', z: 'px', xPercent: '%', yPercent: '%', rotate: 'deg', rotateX: 'deg', rotateY: 'deg', skewX: 'deg', skewY: 'deg', scale: '', scaleX: '', scaleY: '' };
  const ALIAS = { rotation: 'rotate', rotationX: 'rotateX', rotationY: 'rotateY', rotationZ: 'rotate', rotateZ: 'rotate', translateX: 'x', translateY: 'y', translateZ: 'z' };
  const UNITLESS = new Set(['opacity', 'zIndex', 'fontWeight', 'lineHeight', 'flexGrow', 'flexShrink', 'order', 'zoom', 'fillOpacity', 'strokeOpacity', 'stopOpacity', 'scale', 'aspectRatio', 'columnCount', 'orphans', 'widows', 'strokeMiterlimit']);
  const RESERVED = new Set(['hideBefore', 'duration', 'delay', 'ease', 'stagger', 'repeat', 'yoyo', 'repeatDelay', 'onUpdate', 'onStart', 'onComplete', 'immediateRender', 'overwrite', 'id', 'paused', 'keyframes', 'yoyoEase', 'lazy', 'callbackScope', 'data', 'runBackwards', 'startAt', 'inherit', 'arc', '__natFly']);
  const tlList = [];
  const sharedTracks = new Map(); // element -> write state when several timelines animate it
  let tlSeq = 0;
  let initDone = false;

  function toArray(t, scope) {
    if (t == null) return [];
    if (typeof t === 'string') {
      const r = scope ? [...scope.querySelectorAll(t)] : [];
      return r.length ? r : [...document.querySelectorAll(t)];
    }
    // a shape that data-sketch replaced (a reference taken before the video started) means its replacement
    if (t instanceof Element) return [(I.replaced && I.replaced.get(t)) || t];
    if (t === window || !(Symbol.iterator in Object(t)) || typeof t.length !== 'number') return [t];
    return [...t].flatMap((x) => toArray(x, scope));
  }
  function staggerOffsets(st, n, rnd, targets) {
    if (typeof st === 'function') return new Array(n).fill(0).map((_, i) => +st(i, targets && targets[i], targets) || 0);
    if (st == null || n <= 1) return new Array(n).fill(0);
    const o = typeof st === 'object' ? st : { each: st };
    const each = o.amount != null ? o.amount / Math.max(1, n - 1) : (o.each || 0);
    const from = o.from ?? 'start';
    const order = new Array(n).fill(0).map((_, i) => {
      if (from === 'start') return i;
      if (from === 'end') return n - 1 - i;
      if (from === 'center') return Math.abs(i - (n - 1) / 2);
      if (from === 'edges') return (n - 1) / 2 - Math.abs(i - (n - 1) / 2);
      if (from === 'random') return rnd() * (n - 1);
      if (typeof from === 'number') return Math.abs(i - from);
      return i;
    });
    const max = Math.max(...order) || 1;
    const ez = o.ease ? gm.easing(o.ease) : null;
    return order.map((k) => (ez ? ez(k / max) * max : k) * each);
  }
  function evalVal(v, i, el, list, rnd) {
    if (typeof v === 'function') return v(i, el, list);
    if (typeof v === 'string') {
      const m = /^random\((.*)\)$/.exec(v.trim());
      if (m) {
        const arr = /^\[(.*)\]$/.exec(m[1].trim());
        if (arr) { const opts = arr[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')); const pick = opts[Math.floor(rnd() * opts.length)]; return isNaN(+pick) ? pick : +pick; }
        const [a, b, snap] = m[1].split(',').map(Number);
        let x = a + rnd() * (b - a);
        if (snap) x = Math.round(x / snap) * snap;
        return x;
      }
    }
    return v;
  }
  function flattenProps(vars) {
    const out = {};
    for (const k of Object.keys(vars)) {
      if (RESERVED.has(k)) continue;
      if (k === 'css' && vars.css && typeof vars.css === 'object') Object.assign(out, flattenProps(vars.css));
      else if (k === 'attr' && vars.attr && typeof vars.attr === 'object') for (const a of Object.keys(vars.attr)) out['attr:' + a] = vars.attr[a];
      else out[ALIAS[k] || k] = vars[k];
    }
    return out;
  }
  function decompose(el) {
    const base = { x: 0, y: 0, z: 0, xPercent: 0, yPercent: 0, rotate: 0, rotateX: 0, rotateY: 0, skewX: 0, skewY: 0, scale: 1, scaleX: 1, scaleY: 1 };
    if (!el || !(el instanceof Element)) return base;
    const tf = el instanceof SVGElement && !(el instanceof SVGSVGElement) ? el.getAttribute('transform') && null : getComputedStyle(el).transform;
    if (!tf || tf === 'none') return base;
    const m = /matrix\(([^)]+)\)/.exec(tf);
    if (m) {
      const [a, b, c, d, e, f] = m[1].split(',').map(parseFloat);
      const sx = Math.hypot(a, b);
      const rot = Math.atan2(b, a);
      const det = a * d - b * c;
      const sy = sx ? det / sx : 0;
      const skew = sx ? Math.atan2(a * c + b * d, sx * sx) : 0;
      Object.assign(base, { x: e, y: f, rotate: (rot * 180) / Math.PI, skewX: (Math.atan(skew) * 180) / Math.PI * 0, scaleX: sx, scaleY: sy });
      return base;
    }
    const m3 = /matrix3d\(([^)]+)\)/.exec(tf);
    if (m3) { const v = m3[1].split(',').map(parseFloat); base.x = v[12]; base.y = v[13]; base.z = v[14]; }
    return base;
  }
  function kebab(p) { return p.startsWith('--') ? p : p.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()); }
  function readBase(el, prop, tfBase) {
    if (prop in TF) return tfBase[prop];
    if (!(el instanceof Element)) return el[prop];
    if (prop.startsWith('attr:')) { const v = el.getAttribute(prop.slice(5)); return v == null ? 0 : (isNaN(+v) ? v : +v); }
    if (prop === 'autoAlpha') return parseFloat(getComputedStyle(el).opacity);
    if (prop === 'draw') return el.__gmDraw ?? 1;
    if (prop === 'morph') return el.getAttribute('d') || '';
    if (prop === 'text') return el.textContent;
    if (prop === 'textContent' || prop === 'innerText') { const n = parseFloat(String(el.textContent).replace(/[^\d.-]/g, '')); return isNaN(n) ? 0 : n; }
    if (prop === 'transformPerspective') return 0;
    if (prop.startsWith('--')) return getComputedStyle(el).getPropertyValue(prop).trim();
    const v = getComputedStyle(el).getPropertyValue(kebab(prop));
    return v;
  }
  function normalizeEnd(prop, v, from) {
    // relative values "+=100" / "-=50"
    if (typeof v === 'string') {
      const m = /^([-+])=\s*([-+]?[\d.]+)(\D*)$/.exec(v.trim());
      if (m) { const base = parseFloat(from) || 0; const d = parseFloat(m[2]) * (m[1] === '-' ? -1 : 1); const unit = m[3] || unitOf(prop, from); return unit && !(prop in TF) ? (base + d) + unit : base + d; }
    }
    if (typeof v === 'number' && !(prop in TF) && !UNITLESS.has(prop) && !prop.startsWith('attr:') && !prop.startsWith('--') && !['autoAlpha', 'draw', 'textContent', 'innerText', 'transformPerspective'].includes(prop)) {
      if (typeof from === 'string' && /^-?[\d.]+(px)?$/.test(from.trim())) return v + 'px';
      if (typeof from !== 'number') return v + 'px';
    }
    if (prop in TF && typeof v === 'string') { const n = parseFloat(v); if (!isNaN(n) && /^-?[\d.]+(px|deg)?$/.test(v.trim())) return n; }
    return v;
  }
  function unitOf(prop, v) { const m = /[\d.]([a-z%]+)\s*$/i.exec(String(v)); return m ? m[1] : (prop in TF || UNITLESS.has(prop) ? '' : 'px'); }
  function coerceFrom(prop, from, to) {
    // make "from" comparable with "to": numbers stay numbers, "12px" → 12 when to is a number
    if (typeof to === 'number' && typeof from === 'string') { const n = parseFloat(from); if (!isNaN(n) && /^-?[\d.]+(px)?$/.test(from.trim())) return n; }
    if (typeof to === 'string' && typeof from === 'number' && /px$/.test(to)) return from + 'px';
    return from;
  }

  // Natural motion: how far a tween moves its target (in 1080p px), from its x/y/z, scale and rotate values, so that
  // its duration can grow with the distance. Worked out while building (the same in every worker): "from" values of a
  // to() come from the earlier tweens of this timeline (or the CSS start: 0, scale 1). Sizes for scale/rotate are
  // layout sizes where the element rests.
  const restSizeMemo = new WeakMap();
  function restSize(el) {
    if (!(el instanceof Element)) return null;
    if (!restSizeMemo.has(el)) restSizeMemo.set(el, I.restSizes([el]).get(el) || null);
    return restSizeMemo.get(el);
  }
  function natNum(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (typeof v === 'string' && /^-?[\d.]+(px|deg)?$/.test(v.trim())) return parseFloat(v);
    return null;
  }
  function natRel(v, ref) {
    if (typeof v === 'string') { const m = /^([-+])=\s*([-+]?[\d.]+)(px|deg)?$/.exec(v.trim()); if (m) return ref == null ? null : ref + parseFloat(m[2]) * (m[1] === '-' ? -1 : 1); }
    return natNum(v);
  }
  function natDistance(el, it, lastTF) {
    let st = lastTF.get(el);
    if (!st) { st = {}; lastTF.set(el, st); }
    const delta = {};
    for (const k of Object.keys(it.props)) {
      if (!(k in TF)) continue;
      const sp = it.props[k], b = k in st ? st[k] : /^scale/.test(k) ? 1 : 0;
      let from, to;
      if (it.type === 'to') { from = b; to = natRel(sp.to, b); }
      else if (it.type === 'from') { from = natRel(sp.from, b); to = b; }
      else { from = sp.from !== undefined ? natRel(sp.from, b) : b; to = sp.to !== undefined ? natRel(sp.to, from) : from; }
      if (from == null || to == null) { st[k] = null; continue; }
      delta[k] = to - from;
      if (it.type !== 'from') st[k] = to;
    }
    let d = Math.hypot(delta.x || 0, delta.y || 0, delta.z || 0);
    const ds = Math.max(Math.abs(delta.scale || 0), Math.abs(delta.scaleX || 0), Math.abs(delta.scaleY || 0));
    const dr = Math.max(Math.abs(delta.rotate || 0), Math.abs(delta.rotateX || 0), Math.abs(delta.rotateY || 0));
    const dp = Math.max(Math.abs(delta.xPercent || 0), Math.abs(delta.yPercent || 0));
    if (ds || dr || dp) {
      const sz = restSize(el);
      if (sz) { const m = Math.max(sz.w, sz.h); d = Math.max(d, ds * m, (dr * Math.PI / 180) * m / 2, (Math.abs(delta.xPercent || 0) * sz.w + Math.abs(delta.yPercent || 0) * sz.h) / 100); }
    }
    return d / I.PX();
  }

  // textContent / innerText: a number (or a string that is one number with signs around it: '$4.50', '50%', '+=10')
  // counts. A number keeps the look of the number on screen ('000' stays 3 digits, '1,200' keeps its commas); a
  // string like '$4.50' or '1,250' counts in its own look. Any other
  // string is new text: set() swaps it in at that time, to()/fromTo() hold the old text and swap at the tween's end.
  // A set() with a string always writes that exact string; text: '…' types its string out (set: all at once). They
  // share one track per element (the latest segment wins). Each segment's text is worked out here from the page's
  // own text and the earlier segments, so a frame depends only on its time (seeking back shows the earlier text).
  const NUM_TEXT = /^[^\d\p{L}]*?[-+]?\d[\d,]*(\.\d+)?[^\d\p{L}]*$/u;
  function numFormat(text) {
    const m = /^(\D*?)(-?)(\d[\d,]*)(\.(\d+))?(.*)$/s.exec(String(text).trim()) || [];
    const int = m[3] || '';
    return { pre: m[1] || '', post: m[6] || '', dec: m[5] ? m[5].length : 0, group: int.includes(','), pad: /^0\d/.test(int) ? int.length : 0 };
  }
  function fmtNum(f, n) {
    if (!isFinite(n)) n = 0;
    const neg = n < 0 && /[1-9]/.test(Math.abs(n).toFixed(f.dec));
    let [ip, dp] = Math.abs(n).toFixed(f.dec).split('.');
    if (f.pad) ip = ip.padStart(f.pad, '0');
    if (f.group) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return f.pre + (neg ? '\u2212' : '') + ip + (dp ? '.' + dp : '') + f.post;
  }
  const numOfText = (v) => { if (typeof v === 'number') return v; const n = parseFloat(String(v).replace(/[^\d.-]/g, '')); return isNaN(n) ? 0 : n; };
  function textTrack(el, k, segs) {
    const orig = el.__gmOrig && el.__gmOrig[k] != null ? el.__gmOrig[k] : el.textContent;
    let cur = { s: String(orig), n: numOfText(orig) }, fmt = numFormat(orig);
    for (const sg of segs) {
      const { spec, it } = sg;
      // an end point: { n } (a number to count to) or { s } (text to show)
      const end = (v, base) => {
        if (v === undefined) return base;
        if (sg.typing) return { s: String(resolveVars(el, v)), n: numOfText(v), text: true };
        const rel = typeof v === 'string' && /^\s*([-+])=\s*([-+]?[\d.]+)\s*$/.exec(v);
        if (rel) return { n: base.n + parseFloat(rel[2]) * (rel[1] === '-' ? -1 : 1) };
        if (typeof v === 'number') return { n: v };
        v = String(resolveVars(el, v));
        return it.dur > 0 && NUM_TEXT.test(v.trim()) ? { n: numOfText(v), fmt: /^\s*[-+]?\d+\s*$/.test(v) ? null : numFormat(v) } : { s: v, n: numOfText(v), text: true };
      };
      let a, b;
      if (it.type === 'to') { a = cur; b = end(spec.to, cur); }
      else if (it.type === 'from') { a = end(spec.from, cur); b = cur; }
      else { a = spec.from !== undefined ? end(spec.from, cur) : cur; b = spec.to !== undefined ? end(spec.to, a) : a; }
      if (a.text) fmt = numFormat(a.s);
      if (b.fmt || a.fmt) fmt = b.fmt || a.fmt; // a number written with signs ('$4.50', '50%') counts in that look
      const f = fmt;
      if (sg.typing) {
        // text: types its string out over the tween (set: all at once)
        const T = b === cur ? cur.s : b.s;
        sg.from = ''; sg.to = T;
        sg.interp = (p) => T.slice(0, Math.round(p * T.length));
      } else if (!a.text && !b.text) {
        // count (natural motion may chain it with the next count: from/to stay numbers)
        sg.from = a.n; sg.to = b.n;
        sg.interp = (p) => fmtNum(f, a.n + (b.n - a.n) * p);
      } else {
        const sa = a.text || a === cur ? a.s : fmtNum(f, a.n), sb = b.text || b === cur ? b.s : fmtNum(f, b.n);
        sg.from = sa; sg.to = sb; sg.swap = true;
        sg.interp = (p) => (p >= 1 ? sb : sa);
      }
      if (it.type !== 'from') { cur = b.text ? b : { s: sg.interp(1), n: b.n }; if (b.text) fmt = numFormat(b.s); }
    }
    if (segs.some((sg) => sg.it.natural)) naturalChain(k, segs);
    // a swap happens when its tween ends, whatever the ease (a spring reaches 1 before the end)
    for (const sg of segs) if (sg.swap) sg.ease = (p) => p;
  }

  // Natural motion, per (element, property): a tween without its own ease gets a spring, chosen in _build (an entrance
  // springs in like data-enter, a move gathers speed and settles; a slight overshoot for x/y/scale/rotate, none for
  // opacity, colors and the rest). Back-to-back tweens (one ends where and when
  // the next starts) carry their speed through instead of stopping between them: the run eases in at its start,
  // passes each joint at a shared speed (0 where the direction turns back) and eases out at its end.
  function naturalChain(k, segs) {
    const spatial = k in TF;
    for (const sg of segs) if (sg.it.natural) sg.ease = spatial ? sg.it.ease : sg.it.easeSoft;
    const ok = (sg) => sg.it.natural && sg.it.dur > 0 && !sg.it.rep && !sg.it.yoyo && typeof sg.from === 'number' && typeof sg.to === 'number' && sg.to !== sg.from;
    let i = 0;
    while (i < segs.length) {
      let j = i;
      while (j + 1 < segs.length && ok(segs[j]) && ok(segs[j + 1]) && Math.abs(segs[j + 1].it.start - (segs[j].it.start + segs[j].it.dur)) < 1e-4 && Math.abs(segs[j + 1].from - segs[j].to) < 1e-6) j++;
      if (j > i) {
        const run = segs.slice(i, j + 1);
        const slope = run.map((sg) => (sg.to - sg.from) / sg.it.dur);
        // speed at each joint (monotone: never overshoots between two keys)
        const m = run.map((sg, n) => {
          if (n === 0) return 0;
          const s1 = slope[n - 1], s2 = slope[n];
          if (s1 * s2 <= 0) return 0;
          const h1 = run[n - 1].it.dur, h2 = sg.it.dur, w1 = 2 * h2 + h1, w2 = h2 + 2 * h1;
          return (w1 + w2) / (w1 / s1 + w2 / s2);
        });
        run.forEach((sg, n) => {
          const d = sg.it.dur, dv = sg.to - sg.from;
          const a = Math.max(0, Math.min(3, (m[n] * d) / dv)), b = n + 1 < run.length ? Math.max(0, Math.min(3, (m[n + 1] * d) / dv)) : 0;
          sg.ease = I.hermiteEase(a, b);
          sg.chained = true;
        });
      }
      i = j + 1;
    }
  }

  class Timeline {
    constructor(scope, opts) {
      if (scope && !(scope instanceof Element) && typeof scope === 'object' && !Array.isArray(scope)) { opts = scope; scope = opts.scope; }
      this.opts = Object.assign({}, opts || {});
      this.scopeSpec = scope || null;
      this.defaults = Object.assign({ duration: 0.5, ease: 'power1.out' }, this.opts.defaults || {});
      this.ops = [];
      this.built = false;
      this.id = tlSeq++;
      this.rnd = I.makeRandom(9973 + this.id * 7919);
      tlList.push(this);
    }
    get scope() { if (this._scope === undefined) this._scope = typeof this.scopeSpec === 'string' ? document.querySelector(this.scopeSpec) : this.scopeSpec; return this._scope; }
    _op(o) { this.ops.push(o); this.built = false; return this; }
    to(t, vars, pos) { return this._op({ type: 'to', t, a: null, b: vars || {}, pos }); }
    from(t, vars, pos) { return this._op({ type: 'from', t, a: vars || {}, b: null, pos }); }
    fromTo(t, a, b, pos) { return this._op({ type: 'fromTo', t, a: a || {}, b: b || {}, pos }); }
    set(t, vars, pos) { return this._op({ type: 'to', t, a: null, b: Object.assign({}, vars, { duration: 0 }), pos }); }
    // The target flies from where another element is (its box) to its own place: a fromTo of x, y, scaleX, scaleY
    // worked out from the layout (see flyOffset). Options: from (selector or element), size (true | false | 'stretch'),
    // and any tween option (duration 0.8, ease 'power3.inOut', hideBefore true: hidden until it takes off).
    fly(t, vars, pos) {
      const v = Object.assign({}, vars || {});
      const from = v.from, size = v.size === undefined ? true : v.size;
      delete v.from; delete v.size;
      const memo = new Map();
      const off = (el) => {
        if (!memo.has(el)) {
          const src = typeof from === 'string' ? (this.scope && this.scope.querySelector(from)) || document.querySelector(from) : from instanceof Element ? from : null;
          if (!src) I.report('warning', 'fly-no-from', `fly: from "${typeof from === 'string' ? from : 'element'}" matched nothing, so the element does not fly.`, el instanceof Element ? el : null, 'Give from: a selector (or element) of the element it should take off from.');
          memo.set(el, (src && el instanceof Element && flyOffset(el, src, size)) || { x: 0, y: 0, sx: 1, sy: 1 });
        }
        return memo.get(el);
      };
      // natural motion: no fixed duration or curve (a spring that settles, a duration that grows with the distance,
      // a slight arc); classic: 0.8 s power3.inOut on a straight line
      const defs = I.naturalMotion() ? { __natFly: true } : { duration: 0.8, ease: 'power3.inOut' };
      return this.fromTo(t,
        { x: (i, el) => off(el).x, y: (i, el) => off(el).y, scaleX: (i, el) => off(el).sx, scaleY: (i, el) => off(el).sy },
        Object.assign({ x: 0, y: 0, scaleX: 1, scaleY: 1, hideBefore: true }, defs, v), pos);
    }
    addLabel(name, pos) { return this._op({ type: 'label', name, pos }); }
    label(name, pos) { return this.addLabel(name, pos); }
    add(x, pos) {
      if (typeof x === 'string') return this.addLabel(x, pos);
      if (x instanceof Timeline) { const i = tlList.indexOf(x); if (i >= 0) tlList.splice(i, 1); return this._op({ type: 'child', tl: x, pos }); }
      if (typeof x === 'function') return this.call(x, pos);
      return this;
    }
    // A callback that receives the timeline's local time every frame (pure: it must only depend on t).
    call(fn, pos) { return this._op({ type: 'call', fn, pos }); }
    duration() { this._build(); return this.total; }
    totalDuration() { return this.duration(); }
    _pos(pos, cursor) {
      if (pos == null) return cursor.end;
      if (typeof pos === 'number') return pos;
      const s = String(pos).trim();
      let m;
      if ((m = /^([<>])\s*([-+]=?)?\s*([\d.]+)?$/.exec(s))) {
        const base = m[1] === '<' ? cursor.prevStart : cursor.prevEnd;
        const n = m[3] ? parseFloat(m[3]) : 0;
        return base + (m[2] && m[2][0] === '-' ? -n : n);
      }
      if ((m = /^([-+])=\s*([\d.]+)$/.exec(s))) return cursor.end + (m[1] === '-' ? -1 : 1) * parseFloat(m[2]);
      if ((m = /^([\w-]+)\s*(?:([-+])=\s*([\d.]+))?$/.exec(s)) && this.labels[m[1]] != null) return this.labels[m[1]] + (m[2] ? (m[2] === '-' ? -1 : 1) * parseFloat(m[3]) : 0);
      if (!isNaN(parseFloat(s))) return parseFloat(s);
      I.report('warning', 'timeline-position', `Unknown timeline position "${pos}".`, null, 'Use a number, "<", ">", "+=0.5", "-=0.2" or a label name.');
      return cursor.end;
    }
    _build() {
      if (this.built) return;
      this.built = true;
      this.labels = {};
      this.items = [];
      this.calls = [];
      const cursor = { end: 0, prevStart: 0, prevEnd: 0 };
      let opIndex = 0;
      // natural motion (gm.motion): tweens without an ease of their own get a spring, without a duration one that
      // grows with the distance; diagonal moves and flies get a slight arc; staggers a small seeded variation
      const nat = I.naturalMotion(), udef = this.opts.defaults || {};
      const vars = (op) => (op.type === 'from' ? op.a : op.b) || {};
      const natEase = (op) => vars(op).ease != null || udef.ease != null;
      const natDur = (op) => vars(op).duration != null || udef.duration != null;
      const lastTF = new Map(); // element -> { prop: value at the end of its last tween here } (for distances)
      for (const op of this.ops) {
        opIndex++;
        if (op.type === 'label') { this.labels[op.name] = this._pos(op.pos, cursor); continue; }
        if (op.type === 'call') { const at = this._pos(op.pos, cursor); this.calls.push({ at, fn: op.fn }); cursor.prevStart = cursor.prevEnd = at; cursor.end = Math.max(cursor.end, at); continue; }
        if (op.type === 'child') {
          const ch = op.tl; ch._build();
          const at = this._pos(op.pos, cursor);
          for (const it of ch.items) this.items.push(Object.assign({}, it, { start: it.start + at, child: ch }));
          for (const c of ch.calls) this.calls.push({ at: c.at + at, fn: c.fn });
          cursor.prevStart = at; cursor.prevEnd = at + ch.total; cursor.end = Math.max(cursor.end, cursor.prevEnd);
          continue;
        }
        const timing = Object.assign({}, this.defaults, op.type === 'from' ? op.a : op.b);
        // keyframes: [{x:..}, {x:..}] → a chain of tweens
        if (Array.isArray(timing.keyframes) || (timing.keyframes && typeof timing.keyframes === 'object')) {
          const kfs = Array.isArray(timing.keyframes) ? timing.keyframes : (() => {
            const o = timing.keyframes, keys = Object.keys(o).filter((k) => Array.isArray(o[k]));
            const n = Math.max(...keys.map((k) => o[k].length));
            const total = timing.duration;
            const ez = o.ease || (nat && !natEase(op) ? undefined : timing.ease);
            return new Array(n - 1).fill(0).map((_, i) => Object.assign({ duration: total / (n - 1) }, ez != null ? { ease: ez } : {}, Object.fromEntries(keys.map((k) => [k, o[k][Math.min(i + 1, o[k].length - 1)]]))));
          })();
          // (natural motion: steps without an ease of their own keep the natural default, so they carry speed between them)
          const subDefs = nat && !natEase(op) ? Object.assign({}, this.opts.defaults || {}) : Object.assign({}, this.defaults, { ease: timing.ease });
          const sub = new Timeline(this.scopeSpec, { defaults: subDefs });
          tlList.splice(tlList.indexOf(sub), 1);
          // start values: fromTo's from-vars and the first entry of { x: [a, b, c] } keyframes, shown before the start
          // like any fromTo (unless immediateRender: false); hideBefore applies to the first step
          const first = {};
          if (op.type === 'fromTo') for (const k of Object.keys(op.a)) if (!RESERVED.has(k)) first[k] = op.a[k];
          if (!Array.isArray(timing.keyframes)) { const o = timing.keyframes; for (const k of Object.keys(o)) if (Array.isArray(o[k])) first[k] = o[k][0]; }
          const lead = { hideBefore: timing.hideBefore, immediateRender: op.type === 'fromTo' ? timing.immediateRender : false };
          kfs.forEach((kf, i) => {
            if (i === 0 && Object.keys(first).length) sub.fromTo(op.t, first, Object.assign({}, kf, lead));
            else sub.to(op.t, i === 0 ? Object.assign({}, kf, lead) : kf);
          });
          sub._build();
          const at = this._pos(op.pos, cursor) + (timing.delay || 0);
          for (const it of sub.items) this.items.push(Object.assign({}, it, { start: it.start + at }));
          cursor.prevStart = at; cursor.prevEnd = at + sub.total; cursor.end = Math.max(cursor.end, cursor.prevEnd);
          continue;
        }
        const targets = toArray(op.t, this.scope);
        {
          // a list of selectors: name each one that matched nothing, also when the others did match
          const names = typeof op.t === 'string' ? [op.t] : Array.isArray(op.t) ? op.t.filter((x) => typeof x === 'string') : [];
          const none = names.filter((n) => !toArray(n, this.scope).length);
          if (!targets.length || none.length) I.report('warning', 'timeline-no-target', `gm.timeline: ${none.length ? none.map((n) => '"' + n + '"').join(', ') : '"target"'} matched nothing.`, null, 'Check the selector. Targets are looked up when the video starts, inside the timeline scope if one was given. (An id inside a part included with `scope` is renamed: reach it through the include\'s own id or class.)');
        }
        const start = this._pos(op.pos, cursor) + (timing.delay || 0);
        const dur = Math.max(0, +timing.duration || 0);
        const rep = timing.repeat === -1 ? Infinity : Math.max(0, timing.repeat | 0);
        const rd = +timing.repeatDelay || 0;
        const offs = staggerOffsets(timing.stagger, targets.length, this.rnd, targets);
        const fromProps = op.a ? flattenProps(op.a) : null, toProps = op.b ? flattenProps(op.b) : null;
        const keys = Object.keys(Object.assign({}, fromProps || {}, toProps || {}));
        const natE = nat && !natEase(op), natD = nat && !natDur(op) && dur > 0, fly = !!timing.__natFly;
        // an entrance (it starts invisible or at scale 0) springs in like data-enter; anything else is a move with
        // mass: it gathers speed, then settles
        const zero = (k) => fromProps && k in fromProps && typeof fromProps[k] !== 'function' && natNum(fromProps[k]) != null && Math.abs(natNum(fromProps[k])) <= 0.05;
        const entrance = !fly && ['opacity', 'autoAlpha', 'scale', 'scaleX', 'scaleY'].some(zero);
        // an exit (it ends invisible or at scale 0, and is not an entrance) accelerates away: ease-in, like a thing
        // that leaves under its own power, instead of settling into its disappearance
        const zeroTo = (k) => toProps && k in toProps && typeof toProps[k] !== 'function' && natNum(toProps[k]) != null && Math.abs(natNum(toProps[k])) <= 0.05;
        const exit = !fly && !entrance && op.type === 'to' && ['opacity', 'autoAlpha', 'scale', 'scaleX', 'scaleY'].some(zeroTo);
        // arc: explicit (any mode) or, in natural motion, by default for flies and for tweens that move both x and y
        const arc = timing.arc === true ? 0.1 : timing.arc != null && timing.arc !== false ? +timing.arc || 0 : nat && (fly || (keys.includes('x') && keys.includes('y'))) ? 0.1 : 0;
        if (arc && keys.includes('x') && !keys.includes('y')) { keys.push('y'); if (toProps) toProps.y = '+=0'; else fromProps.y = '+=0'; }
        // a stagger's pieces vary a little (the first and the last keep their times; durations only get shorter,
        // and the timeline's layout does not move)
        let jit = null;
        if (nat && targets.length > 2 && timing.stagger != null && typeof timing.stagger !== 'function') {
          const r = I.makeRandom(I.hashSeed('tl-stagger:' + this.id + ':' + opIndex));
          let lo = 0, hi = 0;
          offs.forEach((o, i) => { if (o < offs[lo]) lo = i; if (o > offs[hi]) hi = i; });
          const step = (offs[hi] - offs[lo]) / (targets.length - 1);
          jit = offs.map((o, i) => { const a = r(), b = r(); return { off: i === lo || i === hi ? 0 : (a * 2 - 1) * 0.2 * step, dur: 1 - 0.07 * b }; });
        }
        let last = start;
        targets.forEach((el, i) => {
          const rnd = I.makeRandom(1 + this.id * 1000003 + opIndex * 7919 + i * 104729);
          const s = start + offs[i] + (jit ? jit[i].off : 0);
          const it = { el, i, n: targets.length, type: op.type, start: s, dur, rep, rd, yoyo: !!timing.yoyo, ease: gm.easing(timing.ease), props: {}, onUpdate: timing.onUpdate || null, immediate: op.type !== 'to' && timing.immediateRender !== false, irAuto: timing.immediateRender == null, natural0: nat, seq: this.items.length };
          for (const k of keys) it.props[k] = { from: fromProps && k in fromProps ? evalVal(fromProps[k], i, el, targets, rnd) : undefined, to: toProps && k in toProps ? evalVal(toProps[k], i, el, targets, rnd) : undefined };
          if (natE) { it.natural = true; it.ease = entrance ? I.physEase(0.8) : exit ? exitEase : I.moveEase(0.7); it.easeSoft = entrance ? I.physEase(1) : exit ? exitEase : I.moveEase(1); }
          if (arc) { it.arc = arc; it.arcDefault = timing.arc == null; }
          if (nat) {
            const d = natDistance(el, it, lastTF);
            if (natD) it.dur = Math.round((fly ? 0.8 : dur) * I.distanceFactor(d, fly ? 300 : 200, 0.8, 1.3) * 1000) / 1000;
          }
          const layoutDur = it.dur; // (the stagger variation below does not move later tweens)
          if (jit) it.dur = Math.round(it.dur * jit[i].dur * 1000) / 1000;
          this.items.push(it);
          // hideBefore: hidden (visibility) until this tween starts, then shown; nothing else changes
          if (timing.hideBefore) {
            this.items.push({ el, i, n: targets.length, type: 'to', start: -1e6, dur: 0, rep: 0, rd: 0, yoyo: false, ease: gm.easing('linear'), props: { visibility: { from: undefined, to: 'hidden' } }, onUpdate: null, immediate: false, seq: this.items.length });
            this.items.push({ el, i, n: targets.length, type: 'to', start: s, dur: 0, rep: 0, rd: 0, yoyo: false, ease: gm.easing('linear'), props: { visibility: { from: undefined, to: 'visible' } }, onUpdate: null, immediate: false, seq: this.items.length });
          }
          const end = s - (jit ? jit[i].off : 0) + (rep === Infinity ? layoutDur : layoutDur * (rep + 1) + rd * rep);
          last = Math.max(last, end);
        });
        cursor.prevStart = start;
        cursor.prevEnd = last;
        cursor.end = Math.max(cursor.end, last);
      }
      this.total = cursor.end;
      this.resolved = false;
    }
    // A tween that starts after the clip it is timed in has ended never plays: say so (an unscoped timeline times each
    // target in its own clip, so 15.05 on an element with data-start="15" is 30.05 s of the video). Run at load.
    _warnLate() {
      this._build();
      if (this.opts.global) return;
      const late = new Map(); // element -> earliest late item
      const delay = +this.opts.delay || 0;
      for (const it of this.items) {
        if (it.start < -1e5) continue;
        const anchor = this.scope || (it.el instanceof Element ? it.el : null);
        const c = anchor && I.nearestClip(anchor);
        if (!c || !isFinite(c.end) || !isFinite(c.start) || it.start + delay <= c.end - c.start + 1e-6) continue;
        const prev = late.get(it.el);
        if (!prev || it.start < prev.it.start) late.set(it.el, { it, c });
      }
      for (const [el, { it, c }] of late) {
        const len = c.end - c.start, r = (x) => +x.toFixed(3);
        I.report('warning', 'timeline-after-clip', `gm.timeline: a tween at ${r(it.start)}s on ${gm.__selector(el) || 'an element'} never plays: its times count from the start of its clip (${r(c.start)}s), which lasts only ${r(len)}s${this.scope ? '' : ' (a timeline without a scope times each target in its own clip)'}.`, el, `Give the time inside that clip (${r(Math.max(0, it.start - c.start))} if you meant ${r(it.start)}s of the video), make the clip longer, or use gm.timeline(scope, { global: true }) for video times.`);
      }
    }
    _resolve() {
      this._build();
      if (this.resolved) return;
      this.resolved = true;
      // Tracks: one sorted list of segments per (target, property)
      const tracks = new Map();
      const sorted = this.items.slice().sort((a, b) => a.start - b.start || a.seq - b.seq);
      // natural motion: an element the page itself hides (opacity 0 or visibility: hidden in its CSS) stays hidden until
      // a from()/fromTo() whose start values would show it begins (a ring that pulses at 16 s is not on screen from 0 s).
      // Entrances that start hidden keep showing their start values early, as always; immediateRender: true forces it.
      const hiddenMemo = new Map();
      const cssHidden = (el) => {
        if (!hiddenMemo.has(el)) {
          let h = false;
          // (an animation of something else, like the transform a morph pair puts on its scene, does not decide it)
          const owns = el instanceof Element && el.getAnimations && el.getAnimations().some((an) => { try { return /** @type {KeyframeEffect} */ (an.effect).getKeyframes().some((k) => 'opacity' in k || 'visibility' in k); } catch (e) { return true; } });
          if (el instanceof Element && !el.hasAttribute('data-enter') && !owns) {
            const cs = getComputedStyle(el);
            h = parseFloat(cs.opacity) <= 0.01 || cs.visibility === 'hidden';
          }
          hiddenMemo.set(el, h);
        }
        return hiddenMemo.get(el);
      };
      for (const it of sorted) {
        if (!it.immediate || !it.irAuto || !it.natural0) continue;
        const shows = ['opacity', 'autoAlpha'].some((k) => { const sp = it.props[k]; const n = sp && natNum(sp.from); return n != null && n > 0.05; });
        if (shows && cssHidden(it.el)) it.immediate = false;
      }
      for (const it of sorted) {
        let tm = tracks.get(it.el);
        if (!tm) { tm = { el: it.el, props: new Map(), tfBase: null, cache: new Map(), anchor: null }; tracks.set(it.el, tm); }
        for (const k of Object.keys(it.props)) {
          // text, textContent and innerText all write the element's text: one track, so the latest one wins in any
          // frame order (text types its string out, see textTrack)
          const tk = k === 'text' || k === 'innerText' ? 'textContent' : k;
          if (!tm.props.has(tk)) tm.props.set(tk, []);
          tm.props.get(tk).push({ it, spec: it.props[k], typing: k === 'text' });
        }
      }
      for (const tm of tracks.values()) {
        const el = tm.el;
        // Keep the element's own CSS transform (e.g. translate(-50%,-50%) centering) and add the tween on top.
        tm.tfBase = decompose(null);
        tm.cssPrefix = '';
        if (el instanceof Element && [...tm.props.keys()].some((k) => k in TF || k === 'transformPerspective')) {
          // Read the transform as written (percentages kept, works while the element is hidden),
          // not the resolved matrix: the same in every frame order and every worker.
          let tf = 'none';
          if (!(el instanceof SVGElement) || el instanceof SVGSVGElement) {
            if (el.__gmOwnTf === undefined) el.__gmOwnTf = el.style.transform;
            const cur = el.style.transform;
            el.style.transform = el.__gmOwnTf;
            try { tf = String(el.computedStyleMap().get('transform')); } catch (e) { tf = getComputedStyle(el).transform; }
            el.style.transform = cur;
          }
          if (tf && tf !== 'none' && !/^matrix\(1, 0, 0, 1, 0, 0\)$/.test(tf)) tm.cssPrefix = tf + ' ';
          // A part of the CSS transform that the tween animates is the tween's starting value, not a prefix it multiplies:
          // CSS scaleX(0) and a tween to scaleX 1 ends at 1 (it stayed 0: a strike-through never drew), like rotate and
          // px offsets with x / y. Percent offsets (translate(-50%, -50%) centering) and anything else stay as the prefix.
          if (tm.cssPrefix) {
            const keys = new Set(tm.props.keys()), wS = keys.has('scale') || keys.has('scaleX') || keys.has('scaleY'), wR = keys.has('rotate'), wXY = keys.has('x') || keys.has('y');
            let tv = null;
            if (wS || wR || wXY) {
              const cur = el.style.transform; el.style.transform = el.__gmOwnTf;
              try { tv = el.computedStyleMap().get('transform'); } catch (e) {}
              el.style.transform = cur;
            }
            if (tv && typeof CSSTransformValue !== 'undefined' && tv instanceof CSSTransformValue) {
              // only a trailing run, in the tween's own order (translate, rotate, scale): the kept prefix applies first,
              // so taking anything from before a kept part would change where it lands
              const comps = [...tv], keep = comps.map(String); let took = false, stage = 3;
              const px = (v) => (v instanceof CSSUnitValue && v.unit === 'px' ? v.value : null);
              for (let i = comps.length - 1; i >= 0; i--) {
                const c = comps[i];
                if (wS && stage >= 2 && c instanceof CSSScale && c.is2D) {
                  const sx = +(/** @type {any} */ (c.x).value ?? c.x), sy = +(/** @type {any} */ (c.y).value ?? c.y);
                  if (keys.has('scale') && sx === sy && !keys.has('scaleX') && !keys.has('scaleY')) tm.tfBase.scale *= sx; else { tm.tfBase.scaleX *= sx; tm.tfBase.scaleY *= sy; }
                  stage = 2; took = true; keep.pop(); continue;
                }
                if (wR && stage >= 1 && c instanceof CSSRotate && c.is2D) { tm.tfBase.rotate += c.angle.to('deg').value; stage = 1; took = true; keep.pop(); continue; }
                if (wXY && stage >= 0 && c instanceof CSSTranslate && c.is2D && px(c.x) != null && px(c.y) != null) { tm.tfBase.x += px(c.x); tm.tfBase.y += px(c.y); stage = -1; took = true; keep.pop(); continue; }
                break;
              }
              if (took) tm.cssPrefix = keep.length ? keep.join(' ') + ' ' : '';
            }
          }
        }
        tm.hasTF = [...tm.props.keys()].some((k) => k in TF || k === 'transformPerspective');
        tm.anchor = this.opts.global ? null : (this.scope || (el instanceof Element ? el : null));
        tm.inline = el instanceof Element ? {} : null;
        // what the page had before any tween wrote (restored when the time goes back to before the first tween)
        if (el instanceof Element) {
          const o = el.__gmOrig || (el.__gmOrig = {});
          for (const k of tm.props.keys()) {
            if (k in o) continue;
            if (k === 'autoAlpha') o[k] = [el.style.opacity, el.style.visibility];
            else if (k === 'draw') o[k] = [el.style.strokeDasharray, el.style.strokeDashoffset, el.style.strokeOpacity];
            else if (k.startsWith('attr:')) o[k] = el.getAttribute(k.slice(5));
            else if (k === 'morph') o[k] = el.getAttribute('d');
            else if (k === 'text' || k === 'textContent' || k === 'innerText') o[k] = el.textContent;
          }
        }
        for (const [k, segs] of tm.props) {
          if (k === 'textContent') { textTrack(el, k, segs); continue; }
          let base = readBase(el, k, tm.tfBase);
          if (tm.inline && !(k in TF) && !k.startsWith('attr:') && !['draw', 'morph', 'text', 'textContent', 'innerText', 'autoAlpha', 'transformPerspective'].includes(k)) tm.inline[k] = el.style.getPropertyValue(kebab(k));
          tm.baseVals = tm.baseVals || {};
          tm.baseVals[k] = base;
          let prev = base;
          for (const sg of segs) {
            const { spec, it } = sg;
            let from, to;
            if (it.type === 'to') { from = prev; to = normalizeEnd(k, spec.to, prev); }
            else if (it.type === 'from') { from = normalizeEnd(k, spec.from, prev); to = prev; }
            // (fromTo: a property only in the start values is set there and held, not tweened toward the earlier value)
            else { from = normalizeEnd(k, spec.from !== undefined ? spec.from : prev, prev); to = spec.to !== undefined ? normalizeEnd(k, spec.to, from) : from; }
            from = coerceFrom(k, resolveVars(el, from), resolveVars(el, to)); to = resolveVars(el, to);
            sg.from = from; sg.to = to;
            if (k === 'morph') sg.interp = morphInterp(String(from || to), String(to && to.nodeType ? to.getAttribute('d') : to));
            else sg.interp = makeInterp(from, to, k);
            prev = to;
          }
          if (segs.some((sg) => sg.it.natural)) naturalChain(k, segs);
        }
        // arcs: the path bends up like a thrown object, by `arc` x the horizontal distance at the middle of the move
        // (straight vertical moves stay straight). Not on a move that carries speed into the next one (a default arc).
        const xs = tm.props.get('x'), ys = tm.props.get('y');
        if (xs && ys) for (const sg of xs) {
          const it = sg.it;
          const ysg = ys.find((y) => y.it === it);
          if (!it.arc || typeof sg.from !== 'number' || typeof sg.to !== 'number' || !ysg) continue;
          if (it.arcDefault && (sg.chained || ysg.chained)) continue;
          it.arcY = -it.arc * Math.abs(sg.to - sg.from);
        }
      }
      this.tracks = tracks;
    }
    _localTime(anchor, T) {
      let t;
      if (!anchor) t = T;
      else t = I.mapT(anchor, T) - I.clipStartOf(anchor);
      t -= +this.opts.delay || 0;
      const rep = this.opts.repeat === -1 ? Infinity : (this.opts.repeat | 0);
      if (rep && this.total > 0 && t > 0) {
        const period = this.total + (+this.opts.repeatDelay || 0);
        const cyc = Math.floor(t / period);
        if (cyc <= rep) { t -= cyc * period; if (t > this.total) t = this.total; if (this.opts.yoyo && cyc % 2) t = this.total - t; }
        else t = this.opts.yoyo && rep % 2 ? 0 : this.total;
      }
      return t;
    }
    _apply(T, sink) {
      this._resolve();
      let changed = false;
      const clipsNow = I.clips();
      const perClip = new Map(); // many targets share one clip: work out its time once per frame
      for (const tm of this.tracks.values()) {
        const el = tm.el;
        if (tm.clipsRef !== clipsNow) { tm.clipsRef = clipsNow; tm.clip = tm.anchor ? I.nearestClip(tm.anchor) : null; }
        const c = tm.clip;
        let ct = perClip.get(c || tm.anchor);
        if (!ct) {
          // Skip elements whose clip is not on screen (they get updated when they appear).
          const vis = !c || (() => { const vt = I.mapT(c.parent || null, T); return vt >= c.start - 1e-9 && vt < c.end - 1e-9; })();
          ct = { vis, t: vis ? this._localTime(tm.anchor, T) : 0 };
          perClip.set(c || tm.anchor, ct);
        }
        if (!ct.vis) continue;
        const t = ct.t;
        const vals = {}, prio = {};
        let arcIt = null, arcE = 0, ySeg = null;
        for (const [k, segs] of tm.props) {
          let seg = null;
          for (let i = segs.length - 1; i >= 0; i--) if (segs[i].it.start <= t + 1e-9) { seg = segs[i]; break; }
          let v;
          if (!seg) {
            const first = segs[0];
            if (first.it.immediate) v = first.interp(0);
            else v = undefined; // untouched: leave the page's own value
          } else {
            const it = seg.it;
            let lt = Math.max(0, t - it.start), p; // (a frame a hair before the start, by float error, is the start, not cycle -1)
            if (it.dur <= 0) p = 1;
            else {
              const period = it.dur + it.rd;
              let cyc = Math.floor(lt / period);
              if (it.rep !== Infinity && cyc > it.rep) { cyc = it.rep; lt = it.dur + cyc * period; }
              let w = lt - cyc * period;
              p = w >= it.dur ? 1 : w / it.dur;
              if (it.yoyo && cyc % 2) p = 1 - p;
            }
            const e = (seg.ease || it.ease)(Math.max(0, Math.min(1, p)));
            v = seg.interp(e);
            if (it.arcY && k === 'x' && p > 0 && p < 1) { arcIt = it; arcE = e; }
            if (it.onUpdate && k === (it.firstKey ??= Object.keys(it.props)[0])) { try { it.onUpdate.call(it, p, el, it.i); } catch (e) { I.pageError(e); } }
          }
          vals[k] = v;
          if (k === 'y') ySeg = seg;
          // When two timelines drive the same property, the tween that started last (in video time) wins.
          prio[k] = seg ? T - t + seg.it.start : v === undefined ? -Infinity : -1e9;
        }
        if (arcIt && ySeg && ySeg.it === arcIt && typeof vals.y === 'number') vals.y += arcIt.arcY * 4 * arcE * (1 - arcE);
        if (sink && sink.shared.has(el)) sink.list.push({ tm, vals, prio });
        else if (write(tm, vals)) changed = true;
      }
      for (const c of this.calls) {
        const t = this._localTime(this.opts.global ? null : this.scope, T);
        try { c.fn(t - c.at, t); } catch (e) { I.pageError(e); }
        changed = true;
      }
      return changed;
    }
  }
  const ORIG = '\u0000orig';
  const wrote = (tm, k) => tm.cache.has(k) && tm.cache.get(k) !== ORIG;
  function setCached(tm, key, val, fn) {
    if (tm.cache.get(key) === val) return false;
    tm.cache.set(key, val);
    fn(val);
    return true;
  }
  function write(tm, vals) {
    const el = tm.el;
    let changed = false;
    if (!(el instanceof Element)) {
      for (const k of Object.keys(vals)) if (vals[k] !== undefined && el[k] !== vals[k]) { el[k] = vals[k]; changed = true; }
      return changed;
    }
    if (tm.hasTF) {
      const c = Object.assign({}, tm.tfBase);
      let any = false;
      for (const k of Object.keys(vals)) if ((k in TF || k === 'transformPerspective') && vals[k] !== undefined) { c[k] = typeof vals[k] === 'number' ? vals[k] : parseFloat(vals[k]); any = true; }
      if (any) {
        const sx = c.scale * c.scaleX, sy = c.scale * c.scaleY;
        let s = tm.cssPrefix || '';
        if (c.transformPerspective) s += `perspective(${r4(c.transformPerspective)}px) `;
        // 2D unless 3D is really used: 3D transforms give every element its own layer, which is slower to paint
        s += c.z || c.rotateX || c.rotateY || c.transformPerspective ? `translate3d(${r4(c.x)}px, ${r4(c.y)}px, ${r4(c.z)}px)` : `translate(${r4(c.x)}px, ${r4(c.y)}px)`;
        if (c.xPercent || c.yPercent) s += ` translate(${r4(c.xPercent)}%, ${r4(c.yPercent)}%)`;
        if (c.rotate) s += ` rotate(${r4(c.rotate)}deg)`;
        if (c.rotateY) s += ` rotateY(${r4(c.rotateY)}deg)`;
        if (c.rotateX) s += ` rotateX(${r4(c.rotateX)}deg)`;
        if (c.skewX || c.skewY) s += ` skew(${r4(c.skewX)}deg, ${r4(c.skewY)}deg)`;
        if (sx !== 1 || sy !== 1) s += ` scale(${r4(sx)}, ${r4(sy)})`;
        // SVG shapes turn and scale around their own center, unless an origin was set (then leave it exactly as written).
        if (el instanceof SVGElement && !(el instanceof SVGSVGElement) && tm.svgOrigin === undefined) {
          const cso = getComputedStyle(el);
          tm.svgOrigin = !el.style.transformOrigin && !('transformOrigin' in vals) && /^0px 0px/.test(cso.transformOrigin) && cso.transformBox === 'view-box';
          if (tm.svgOrigin) { el.style.transformBox = 'fill-box'; el.style.transformOrigin = '50% 50%'; }
          // an origin in % on an SVG shape means "% of the shape" to everyone (not of the whole <svg>)
          else if (cso.transformBox === 'view-box' && /%/.test(String(vals.transformOrigin || el.style.transformOrigin || ''))) el.style.transformBox = 'fill-box';
        }
        if (setCached(tm, 'transform', s, (v) => { el.style.transform = v; })) changed = true;
      } else if (wrote(tm, 'transform')) {
        // back before every transform tween (a seek backwards): the element's own transform again
        if (setCached(tm, 'transform', ORIG, () => { el.style.transform = el.__gmOwnTf || ''; })) changed = true;
      }
    }
    const orig = el.__gmOrig || {};
    for (const k of Object.keys(vals)) {
      if (k in TF || k === 'transformPerspective') continue;
      let v = vals[k];
      if (v === undefined && k in orig && wrote(tm, k)) {
        // back before the first tween of this property: what the page had (pure function of the time, in any
        // frame order; a camera that samples later times while loading must not leave end values behind)
        const o = orig[k];
        if (setCached(tm, k, ORIG, () => {
          if (k === 'autoAlpha') { if (vals.opacity === undefined) el.style.opacity = o[0]; if (vals.visibility === undefined) el.style.visibility = o[1]; }
          else if (k === 'draw') { el.style.strokeDasharray = o[0]; el.style.strokeDashoffset = o[1]; el.style.strokeOpacity = o[2]; }
          else if (k.startsWith('attr:') || k === 'morph') { const a = k === 'morph' ? 'd' : k.slice(5); if (o == null) el.removeAttribute(a); else el.setAttribute(a, o); }
          else el.textContent = o; // text, textContent, innerText
        })) changed = true;
        continue;
      }
      if (k.startsWith('attr:')) {
        if (v === undefined) continue;
        if (setCached(tm, k, String(typeof v === 'number' ? r4(v) : v), (s) => el.setAttribute(k.slice(5), s))) changed = true;
        continue;
      }
      if (k === 'autoAlpha') {
        if (v === undefined) continue;
        const o = r4(+v);
        if (setCached(tm, k, o, (x) => { el.style.opacity = x; el.style.visibility = x <= 0 ? 'hidden' : 'inherit'; })) changed = true;
        continue;
      }
      if (k === 'draw') {
        if (v === undefined) continue;
        let a = 0, b = v;
        if (Array.isArray(v)) [a, b] = v; else if (typeof v === 'string') { const m = v.trim().split(/\s+/).map(parseFloat); if (m.length > 1) [a, b] = m; else b = m[0]; }
        const len = Math.max(0, b - a);
        // a group (a data-sketch shape becomes a <g> of rough strokes, or any <g>/<svg>): draw every stroke in it at
        // once, and let solid fills come in over the last 40%, like data-enter="draw" does
        const parts = /** @type {any} */ (el).getTotalLength ? [el] : (tm.drawParts || (tm.drawParts = [...el.querySelectorAll('path,line,polyline,polygon,rect,circle,ellipse')].filter((n) => !n.closest('[data-gm-sketch-guide],defs,clipPath,marker,pattern') && (!n.closest('mask') || n.hasAttribute('data-gm-ink-reveal')))));
        // at zero length, round line caps would still paint a dot: hide the stroke then
        if (setCached(tm, k, r4(a) + ' ' + r4(len), () => {
          for (const n of parts) {
            if (!n.hasAttribute('pathLength')) n.setAttribute('pathLength', '1');
            n.style.strokeDasharray = `${r4(len)} ${r4(1 + len + 1)}`; n.style.strokeDashoffset = String(r4(-a)); n.style.strokeOpacity = len <= 0.0005 ? '0' : '';
            if (n !== el && (n.matches('[data-gm-sketch-fill="solid"]') || n.closest('[data-gm-sketch-fill="solid"]'))) n.style.fillOpacity = String(r4(Math.max(0, Math.min(1, (len - 0.6) / 0.4))));
          }
        })) changed = true;
        continue;
      }
      if (k === 'morph') { if (v !== undefined && setCached(tm, k, v, (d) => el.setAttribute('d', d))) changed = true; continue; }
      if (k === 'textContent' || k === 'innerText') {
        // (textTrack made every value the text to show)
        if (v !== undefined && setCached(tm, k, String(v), (txt) => { el.textContent = txt; })) changed = true;
        continue;
      }
      if (v === undefined) {
        // restore what the page had before
        const orig = tm.inline ? tm.inline[k] : '';
        if (setCached(tm, k, ORIG, () => { if (orig) el.style.setProperty(kebab(k), orig); else el.style.removeProperty(kebab(k)); })) changed = true;
        continue;
      }
      if (typeof v === 'number') v = UNITLESS.has(k) || k.startsWith('--') ? String(r4(v)) : r4(v) + 'px';
      if (setCached(tm, k, v, (s) => el.style.setProperty(kebab(k), s))) changed = true;
    }
    return changed;
  }

  // ---------------------------------------------------------------------------
  // data-camera: slow camera moves that keep a scene alive. Added on top of
  // any transform the element already has.
  // ---------------------------------------------------------------------------
  function setupCameras() {
    for (const el of document.querySelectorAll('[data-camera]')) {
      if (el.__gmCam) continue;
      el.__gmCam = true;
      const c = I.nearestClip(el);
      const cs = c ? c.start : 0, ce = c && isFinite(c.end) ? c.end : I.comp.duration;
      const moves = el.getAttribute('data-camera').split(/[;,]/).map((s) => s.trim()).filter(Boolean);
      const short = Math.min(I.comp.width, I.comp.height);
      for (const mv of moves) {
        const toks = mv.split(/\s+/);
        const name = toks[0];
        let amount = null, ease = 'in-out-sine', from = 0, to = ce - cs;
        for (const t of toks.slice(1)) {
          const r = /^([\d.]+)s?-([\d.]+)s?$/.exec(t);
          if (r) { from = +r[1]; to = +r[2]; } else if (I.isEasingName(t)) ease = t; else if (!isNaN(parseFloat(t))) amount = parseFloat(t);
        }
        const dur = Math.max(0.01, to - from);
        let kf = null;
        const px = PX();
        const cover = (d) => 1 + (2 * Math.abs(d) * px) / short + 0.01;
        switch (name) {
          case 'push': { const a = amount ?? 1.1; kf = [{ transform: 'scale(1)' }, { transform: `scale(${a})` }]; break; }
          case 'pull': { const a = amount ?? 1.1; kf = [{ transform: `scale(${a})` }, { transform: 'scale(1)' }]; break; }
          case 'move-left': case 'move-right': case 'move-up': case 'move-down': {
            const d = amount ?? 80, s = cover(d);
            const v = { 'move-left': [-d, 0], 'move-right': [d, 0], 'move-up': [0, -d], 'move-down': [0, d] }[name];
            kf = [{ transform: `translate(${(-v[0] / 2) * px}px, ${(-v[1] / 2) * px}px) scale(${s})` }, { transform: `translate(${(v[0] / 2) * px}px, ${(v[1] / 2) * px}px) scale(${s})` }];
            break;
          }
          case 'rotate': case 'tilt': {
            // enlarge just enough that the tilted frame still covers every corner (tall or wide)
            const a = amount ?? 3, th = ((a / 2) * Math.PI) / 180, W = I.comp.width, H = I.comp.height;
            const sc = Math.cos(th) + (Math.max(W, H) / Math.min(W, H)) * Math.sin(th) + 0.004;
            kf = [{ transform: `rotate(${-a / 2}deg) scale(${r4(sc)})` }, { transform: `rotate(${a / 2}deg) scale(${r4(sc)})` }]; break;
          }
          case 'orbit': { const a = amount ?? 8; kf = [{ transform: `perspective(${2000 * px}px) rotateY(${-a / 2}deg) rotateX(${a / 6}deg) scale(1.06)` }, { transform: `perspective(${2000 * px}px) rotateY(${a / 2}deg) rotateX(${-a / 6}deg) scale(1.06)` }]; break; }
          case 'float': case 'drift': case 'handheld': case 'shake': {
            // amount is in px (at 1080p): how far the view wanders. shake rises and dies away inside its window.
            const isShake = name === 'shake';
            const a = (amount ?? (isShake ? 12 : name === 'handheld' ? 7 : 14)) * px;
            const freq = isShake ? 9 : name === 'handheld' ? 0.9 : 0.25;
            const step = isShake ? 1 / I.comp.fps : 1 / 10;
            const n = Math.max(2, Math.ceil(dur / step) + 1);
            const seed = (el.__gmSeed = (el.__gmSeed || 0) + 1) * 17 + name.length;
            const s = isShake ? 1 + (2 * a) / short : 1 + (2 * a) / short + 0.01;
            kf = [];
            for (let i = 0; i < n; i++) {
              const u = Math.min(dur, i * step);
              const t = u * freq;
              const env = isShake ? Math.sin(Math.min(1, u / dur) * Math.PI) * (1 - 0.4 * (u / dur)) : 1;
              const nx = gm.noise(t, seed) * 2 - 1, ny = gm.noise(t + 31.7, seed + 3) * 2 - 1, nr = gm.noise(t + 77.1, seed + 9) * 2 - 1;
              const sc = isShake ? 1 + (s - 1) * env : s;
              kf.push({ transform: `translate(${r4(nx * a * env)}px, ${r4(ny * a * env)}px) rotate(${r4(nr * (isShake ? 0.6 : 0.35) * env)}deg) scale(${r4(sc)})`, offset: Math.min(1, u / dur) });
            }
            kf[kf.length - 1].offset = 1;
            ease = 'linear';
            break;
          }
          default:
            I.report('error', 'bad-camera', `Unknown data-camera move "${name}".`, el, 'Use: push, pull, move-left, move-right, move-up, move-down, rotate, orbit, float, handheld, shake.');
        }
        if (!kf) continue;
        const a = I.real.animate.call(el, kf, { duration: dur * 1000, delay: from * 1000, easing: I.cssEasing(ease), fill: name === 'shake' ? 'none' : 'both', composite: 'add' });
        a.pause();
        // register with the runtime clock
        a.__gmCamera = true;
        I.addOwnAnim(a, cs);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Shared-element morph between scenes: data-transition="morph" + data-morph="id"
  // ---------------------------------------------------------------------------
  // Each frame of the transition, both elements are measured where they really are (after camera
  // moves, tweens, layout) and flown along the same path between the two boxes.
  const morphs = [];
  function setupMorphs() {
    for (const pair of I.morphPairs()) {
      const A = pair.from, B = pair.to;
      if (B.__gmMorphed) continue;
      B.__gmMorphed = true;
      const map = new Map();
      for (const e of A.querySelectorAll('[data-morph]')) map.set(e.getAttribute('data-morph'), e);
      let found = 0;
      for (const eb of B.querySelectorAll('[data-morph]')) {
        const ea = map.get(eb.getAttribute('data-morph'));
        if (!ea) continue;
        found++;
        // translate/scale do nothing on an inline box (a <span> or <b> in a line of text): make it an inline-block
        for (const e of [ea, eb]) if (!(e instanceof SVGElement) && getComputedStyle(e).display === 'inline') e.style.display = 'inline-block';
        morphs.push({ a: ea, b: eb, sceneB: B, dur: pair.dur, ease: gm.easing(pair.ease), on: false });
      }
      // Fade out everything in the old scene except the morphing elements (they must stay solid).
      const ca = I.nearestClip(A);
      if (found && ca && isFinite(ca.end)) {
        const keep = [...A.querySelectorAll('[data-morph]')].filter((e) => map.get(e.getAttribute('data-morph')) && [...B.querySelectorAll('[data-morph]')].some((x) => x.getAttribute('data-morph') === e.getAttribute('data-morph')));
        // Fade with filter: opacity() *added* to the element's own filter, so the page's own opacity
        // (an element already faded out) is kept. Boxes that contain a morphing element lose their
        // own paint (background, border, shadow) instead, so no empty card is left behind.
        const timing = { duration: pair.dur * 1000 * 0.7, delay: Math.max(0, ca.end - ca.start - pair.dur) * 1000, easing: 'ease-in-out', fill: 'forwards' };
        const fadeKids = (node) => {
          for (const ch of node.children) {
            if (I.SKIP_TAGS.has(ch.tagName) || ch.hasAttribute('data-gm-internal')) continue;
            if (keep.includes(ch)) continue;
            // wrappers that draw nothing themselves (display: contents, e.g. blocks) pass the fade to their children
            if (getComputedStyle(ch).display === 'contents') { fadeKids(ch); continue; }
            if (keep.some((k) => ch.contains(k))) {
              const cs = getComputedStyle(ch);
              const paints = cs.backgroundImage !== 'none' || !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) || cs.boxShadow !== 'none' || parseFloat(cs.borderTopWidth) > 0;
              if (paints) {
                const an = I.real.animate.call(ch, [{ backgroundColor: cs.backgroundColor, borderColor: cs.borderTopColor, boxShadow: cs.boxShadow }, { backgroundColor: 'transparent', borderColor: 'transparent', boxShadow: 'none', backgroundImage: 'none' }], timing);
                an.pause(); I.addOwnAnim(an, ca.start);
              }
              fadeKids(ch);
              continue;
            }
            let an;
            try { an = I.real.animate.call(ch, [{ filter: 'opacity(1)' }, { filter: 'opacity(0)' }], Object.assign({ composite: 'add' }, timing)); }
            catch (e) { an = I.real.animate.call(ch, [{ opacity: 1 }, { opacity: 0 }], timing); }
            an.pause(); I.addOwnAnim(an, ca.start);
          }
        };
        // A new scene that paints the whole frame fades in over the old one, which is the crossfade itself: fading the old
        // scene's pieces one by one as well would let them show through each other (an app behind a toast)
        const paintsFrame = (e) => {
          if (!e) return false;
          const cs = getComputedStyle(e), r = e.getBoundingClientRect();
          const solid = cs.backgroundImage !== 'none' || /^rgb\(/.test(cs.backgroundColor) || /^rgba\(.*,\s*1\)$/.test(cs.backgroundColor);
          return solid && r.left <= 1 && r.top <= 1 && r.right >= I.comp.width - 1 && r.bottom >= I.comp.height - 1;
        };
        // (measured with the new scene shown for a moment: before its start it is not displayed)
        const hid = [];
        for (let e = B; e; e = e.parentElement) if (e.hasAttribute && e.hasAttribute('data-gm-hidden')) { hid.push(e); e.removeAttribute('data-gm-hidden'); }
        let covers = false;
        try { covers = paintsFrame(B) || paintsFrame(B.firstElementChild); } finally { for (const e of hid) e.setAttribute('data-gm-hidden', ''); }
        if (!covers) fadeKids(A);
      }
      if (!found) I.report('warning', 'morph-no-pairs', 'data-transition="morph" found no matching data-morph ids in the two scenes, so it is a plain crossfade.', B, 'Give the same data-morph="name" to an element in each scene.');
    }
  }
  function clearMorph(el) { el.style.removeProperty('translate'); el.style.removeProperty('scale'); }
  function ancestorScale(el) {
    let p = el.parentElement;
    while (p && !p.offsetWidth) p = p.parentElement;
    if (!p) return 1;
    return p.getBoundingClientRect().width / p.offsetWidth || 1;
  }
  // layout size without transforms (<svg> has no offsetWidth, use its CSS box)
  const boxW = (el) => el.offsetWidth ?? el.clientWidth ?? 0;
  const boxH = (el) => el.offsetHeight ?? el.clientHeight ?? 0;
  function placeAt(el, r, R) {
    // r: where el is now (screen), R: where it should be. Scale happens around the element's own
    // transform-origin, so work that point out on screen, and undo ancestor scaling for the move.
    const k = ancestorScale(el);
    const o = getComputedStyle(el).transformOrigin.split(' ').map(parseFloat);
    const bw = boxW(el), bh = boxH(el);
    const ox = r.left + (bw ? (o[0] / bw) * r.width : 0);
    const oy = r.top + (bh ? (o[1] / bh) * r.height : 0);
    const sx = r.width ? R.width / r.width : 1, sy = r.height ? R.height / r.height : 1;
    const tx = (R.left - ox - sx * (r.left - ox)) / (k || 1), ty = (R.top - oy - sy * (r.top - oy)) / (k || 1);
    el.style.translate = `${r4(tx)}px ${r4(ty)}px`;
    el.style.scale = `${r4(sx)} ${r4(sy)}`;
  }
  function updateMorphs(T) {
    let changed = false;
    for (const m of morphs) {
      const c = I.nearestClip(m.sceneB);
      if (!c) continue;
      const lt = T - c.start;
      const active = lt >= 0 && lt < m.dur;
      if (!active) { if (m.on) { clearMorph(m.a); clearMorph(m.b); setFade(m.a, null); setFade(m.b, null); m.on = false; changed = true; } continue; }
      m.on = true; changed = true;
      clearMorph(m.a); clearMorph(m.b);
      const ra = m.a.getBoundingClientRect(), rb = m.b.getBoundingClientRect();
      const p = m.ease(Math.max(0, Math.min(1, lt / m.dur)));
      const ar = (r) => r.width / Math.max(1, r.height);
      // natural motion: a diagonal flight bends up a little like a thrown object (the same arc a tween of x and y gets)
      const dx = rb.left - ra.left, dy = rb.top - ra.top;
      const bend = I.naturalMotion() && Math.abs(dx) > 1 && Math.abs(dy) > 1 ? -0.1 * Math.abs(dx) * 4 * p * (1 - p) : 0;
      if (Math.abs(Math.log(ar(ra) / ar(rb))) > 0.2) {
        // different shapes (e.g. two text boxes): fly center to center and scale evenly, no stretching
        const cx = (ra.left + ra.width / 2) * (1 - p) + (rb.left + rb.width / 2) * p, cy = (ra.top + ra.height / 2) * (1 - p) + (rb.top + rb.height / 2) * p + bend;
        const h = ra.height * (1 - p) + rb.height * p;
        const box = (r) => { const k = h / r.height; return { left: cx - (r.width * k) / 2, top: cy - (r.height * k) / 2, width: r.width * k, height: r.height * k }; };
        placeAt(m.a, ra, box(ra));
        placeAt(m.b, rb, box(rb));
      } else {
        const R = { left: ra.left + (rb.left - ra.left) * p, top: ra.top + (rb.top - ra.top) * p + bend, width: ra.width + (rb.width - ra.width) * p, height: ra.height + (rb.height - ra.height) * p };
        placeAt(m.a, ra, R);
        placeAt(m.b, rb, R);
      }
      // Same content (a logo, a card, the same number): the old one stays solid and the new one fades in on top, so
      // it reads as one object. Different content ("</>" into a play button, "48,000" into "1,200 → 48,000"): the old
      // one is gone by a bit past the middle of the flight and the new one arrives in the second half, so the two
      // never sit half and half on top of each other.
      {
        const tt = Math.max(0, Math.min(1, lt / m.dur));
        if (morphSig(m.a) === morphSig(m.b)) { setFade(m.a, null); setFade(m.b, null); }
        else {
          const oa = 1 - smooth01(tt / 0.45), want = smooth01((tt - 0.3) / 0.45);
          // the new scene fades in as a whole too: give the element what is missing so it arrives on time
          let anc = 1;
          for (let e = m.b.parentElement; e; e = e.parentElement) { anc *= parseFloat(getComputedStyle(e).opacity) || 0; if (e === m.sceneB) break; }
          const ob = want <= 0 ? 0 : anc > 0.02 ? Math.min(1, want / anc) : 1;
          setFade(m.a, oa); setFade(m.b, ob);
        }
      }
    }
    return changed;
  }
  const smooth01 = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  // o = the share of the element's own opacity to show (null: no fade). The element's opacity without this fade is
  // read first and the product is set inline with !important (above its own animations), so a fade the page put on it
  // is kept; the page's own inline opacity is put back afterwards. (Not a filter or an opacity animation: those give
  // the element its own layer, and a scaled layer rasterizes a hair differently in a fresh worker.)
  function setFade(el, o) {
    const st = el.style;
    if (el.__gmFadeV != null) {
      // still the value written last frame: put the page's own value back (if the page wrote since, keep that)
      if (st.getPropertyValue('opacity') === el.__gmFadeV && st.getPropertyPriority('opacity') === 'important') {
        if (el.__gmFadeOwn) st.setProperty('opacity', el.__gmFadeOwn); else st.removeProperty('opacity');
      }
      el.__gmFadeV = null;
    }
    if (o == null || o >= 1) return;
    el.__gmFadeOwn = st.getPropertyValue('opacity');
    st.setProperty('opacity', String(r4(Math.max(0, o) * (parseFloat(getComputedStyle(el).opacity) || 0))), 'important');
    el.__gmFadeV = st.getPropertyValue('opacity');
  }
  // What a morph element shows: its text and the kind and geometry of its pictures (SVG shapes, images).
  function morphSig(el) {
    let s = (el.textContent || '').replace(/\s+/g, ' ').trim();
    const media = el.matches('svg,img,video,canvas,path,circle,rect,ellipse,polygon,polyline,line') ? [el] : [];
    for (const n of el.querySelectorAll('img,video,canvas,path,circle,rect,ellipse,polygon,polyline,line')) media.push(n);
    for (const n of media) s += '|' + n.tagName + ':' + (n.getAttribute('src') || '') + (n.getAttribute('d') || '') + (n.getAttribute('points') || '') + (n.getAttribute('r') || '');
    return s;
  }

  // ---------------------------------------------------------------------------
  // fly (tl.fly / gm.fly): where an element must start so that it sits on another element's box.
  // ---------------------------------------------------------------------------
  // Measured once, while loading (the same in every worker), where both elements rest: clips that are not on screen
  // yet are shown for a moment, and the animations on both and on their parents (entrances, camera pushes) are taken
  // off for the measure. Returns the x/y (in the target's own parent units) and scaleX/scaleY that put it on `src`.
  function flyOffset(el, src, size) {
    const hidden = [], held = /** @type {any[]} */ ([]), tfs = [];
    for (const e of [el, src]) for (let p = e; p; p = p.parentElement) if (p.hasAttribute && p.hasAttribute('data-gm-hidden')) { hidden.push(p); p.removeAttribute('data-gm-hidden'); }
    try {
      try {
        for (const a of document.getAnimations()) {
          const tg = a.effect && /** @type {KeyframeEffect} */ (a.effect).target;
          if (tg && (tg.contains(el) || tg.contains(src))) { held.push([a, a.effect, a.currentTime]); a.effect = null; }
        }
      } catch (e) {}
      // a timeline's own transform written in an earlier frame (when built late): back to the element's CSS
      for (const e of [el, src]) for (let p = e; p && p.nodeType === 1; p = p.parentElement) if (p.__gmOwnTf !== undefined && p.style.transform !== p.__gmOwnTf) { tfs.push([p, p.style.transform]); p.style.transform = p.__gmOwnTf; }
      const H = el.getBoundingClientRect(), F = src.getBoundingClientRect();
      if (!H.width || !H.height || !F.width || !F.height) return null;
      let k = 1, ox = H.left + H.width / 2, oy = H.top + H.height / 2;
      if (el instanceof SVGElement && !(el instanceof SVGSVGElement)) {
        // SVG shapes: units are the parent's user units; the timeline scales them around their own center
        const m = el.parentNode && /** @type {any} */ (el.parentNode).getScreenCTM && /** @type {any} */ (el.parentNode).getScreenCTM();
        if (m) k = Math.hypot(m.a, m.b) || 1;
      } else {
        k = ancestorScale(el) || 1;
        const o = getComputedStyle(el).transformOrigin.split(' ').map(parseFloat), bw = boxW(el), bh = boxH(el);
        if (bw && bh && isFinite(o[0]) && isFinite(o[1])) { ox = H.left + (o[0] / bw) * H.width; oy = H.top + (o[1] / bh) * H.height; }
      }
      let sx = F.width / H.width, sy = F.height / H.height;
      if (size === false || size === 'none') sx = sy = 1;
      else if (size !== 'stretch' && size !== 'box' && Math.abs(Math.log(sx / sy)) > 0.2) sx = sy = Math.min(sx, sy); // other proportions: no squash, start inside its box
      const fx = F.left + F.width / 2, fy = F.top + F.height / 2, hx = H.left + H.width / 2, hy = H.top + H.height / 2;
      const r2 = (x) => Math.round(x * 100) / 100;
      return { x: r2((fx - ox - sx * (hx - ox)) / k), y: r2((fy - oy - sy * (hy - oy)) / k), sx: r4(sx), sy: r4(sy) };
    } finally {
      for (const [p, v] of tfs) p.style.transform = v;
      for (const [a, eff, ct] of held) { try { a.effect = eff; if (ct != null) a.currentTime = ct; } catch (e) {} }
      for (const p of hidden) p.setAttribute('data-gm-hidden', '');
    }
  }

  // ---------------------------------------------------------------------------
  // gm.camera(world): a virtual camera over a big "world" layer. Shots frame elements,
  // follow moving ones, and blend smoothly from one to the next. Pure function of time.
  //   const cam = gm.camera('#world');
  //   cam.shot(0, { fit: ['#a', '#b'], padding: 80 })
  //      .shot(2, { follow: '#package', zoom: 1.8, duration: 1.2 })
  //      .shot(12, { fit: '#route', duration: 1.5, ease: 'in-out-quart' })
  //      .shake(6.2, { duration: 0.4, amount: 12 });
  // Elements with data-parallax="0.3" next to the world move 30% as much (depth).
  // ---------------------------------------------------------------------------
  const cameras = [];
  // The box of an element that is not displayed right now (its clip starts later), in world coordinates: shown for a
  // moment to be measured, then remembered (rounded, so every worker gets the same numbers).
  function hiddenBox(e, M) {
    if (e.__gmHiddenBox !== undefined) return e.__gmHiddenBox;
    const hidden = [];
    for (let a = e; a; a = a.parentElement) if (a.hasAttribute && a.hasAttribute('data-gm-hidden')) { hidden.push(a); a.removeAttribute('data-gm-hidden'); }
    let box = null;
    if (e.getClientRects().length) {
      const c = e.getBoundingClientRect(), r2 = (x) => Math.round(x * 100) / 100;
      box = { l: r2((c.left - M.ox) / M.k), t: r2((c.top - M.oy) / M.k), r: r2((c.right - M.ox) / M.k), b: r2((c.bottom - M.oy) / M.k) };
    }
    for (const a of hidden) a.setAttribute('data-gm-hidden', '');
    return (e.__gmHiddenBox = hidden.length ? box : null);
  }
  class Camera {
    constructor(world, opts = {}) {
      this.spec = world; this.opts = opts; this.shots = []; this.shakes = [];
      cameras.push(this);
    }
    get world() { if (!this._w) { this._w = typeof this.spec === 'string' ? document.querySelector(this.spec) : this.spec; if (!this._w) I.report('error', 'camera-no-world', `gm.camera: "${this.spec}" matched nothing.`, null); } return this._w; }
    shot(at, s) { this.shots.push(Object.assign({ at: +at || 0, duration: 1, ease: 'in-out-cubic', padding: 60, __ease: !!(s && s.ease) }, s)); this.shots.sort((a, b) => a.at - b.at); this._plan = null; return this; }
    shake(at, o = {}) { this.shakes.push(Object.assign({ at: +at || 0, duration: 0.4, amount: 10, freq: 18 }, o)); return this; }
    // where the camera looks in this frame, in world px: { x, y } centre, zoom, rotate and the visible world rect
    // (view: { x, y, w, h }). Exact in gm.onLayout (after the camera moved); in gm.onFrame it is worked out on the spot.
    state() {
      if (!this._st || Math.abs(this._st.T - I.now) > 1e-9) this._apply(I.now);
      const s = this._st;
      if (!s) return null;
      const w = s.vw / s.zoom, h = s.vh / s.zoom;
      return { x: s.cx, y: s.cy, zoom: s.zoom, rotate: s.rot, view: { x: s.cx - w / 2, y: s.cy - h / 2, w, h } };
    }
    // data-parallax inside the world: each element's centre where it is laid out (world px), measured once at load
    _prepInner() {
      const w = this.world;
      if (!w || this.__inner !== undefined) return;
      const list = [];
      const els = [...w.querySelectorAll('[data-parallax]')];
      if (els.length) {
        const lastTf = w.style.transform;
        w.style.transform = '';
        const hidden = [];
        for (let a = w; a; a = a.parentElement) if (a.hasAttribute && a.hasAttribute('data-gm-hidden')) { hidden.push(a); a.removeAttribute('data-gm-hidden'); }
        for (const a of w.querySelectorAll('[data-gm-hidden]')) { hidden.push(a); a.removeAttribute('data-gm-hidden'); }
        try {
          const M = this._markers(), r2 = (x) => Math.round(x * 100) / 100;
          const area = Math.max(1, w.offsetWidth * w.offsetHeight);
          for (const pl of els) {
            const f = parseFloat(pl.getAttribute('data-parallax'));
            if (!isFinite(f) || f === 1) continue;
            const q = pl.getBoundingClientRect();
            // a layer as big as a good part of the world (a tree layer): every child gets its own depth shift
            const big = (q.width * q.height) / (M.k * M.k) >= 0.25 * area && pl.children.length;
            for (const e of big ? [...pl.children] : [pl]) {
              e.style.translate = '';
              const b = e.getBoundingClientRect();
              list.push({ el: e, f, x: r2(((b.left + b.right) / 2 - M.ox) / M.k), y: r2(((b.top + b.bottom) / 2 - M.oy) / M.k) });
            }
          }
        } finally { for (const a of hidden) a.setAttribute('data-gm-hidden', ''); w.style.transform = lastTf; }
      }
      this.__inner = list.length ? list : null;
    }
    _markers() {
      const w = this.world;
      if (!this._m || !this._m[0].isConnected) {
        const mk = (x) => { const d = document.createElement('div'); d.setAttribute('data-gm-internal', ''); d.style.cssText = `position:absolute;left:${x}px;top:0;width:0;height:0;pointer-events:none`; w.appendChild(d); return d; };
        this._m = [mk(0), mk(1000)];
        w.setAttribute('data-gm-camera-world', '');
        if (getComputedStyle(w).position === 'static') w.style.position = 'relative';
        w.style.transformOrigin = '0 0';
      }
      const a = this._m[0].getBoundingClientRect(), b = this._m[1].getBoundingClientRect();
      return { ox: a.left, oy: a.top, k: (b.left - a.left) / 1000 || 1 };
    }
    // where something is, in world coordinates (unaffected by the camera itself)
    _box(target, M) {
      if (target && typeof target === 'object' && !Array.isArray(target) && !(target instanceof Element) && 'x' in target) return { x: target.x, y: target.y, w: target.w || 0, h: target.h || 0 };
      const w = this.world;
      // the whole world: fit: 'all' (or the world's own selector)
      if (target === 'all' || target === w || (typeof target === 'string' && w.matches(target))) return { x: 0, y: 0, w: w.offsetWidth, h: w.offsetHeight };
      // 'content': everything drawn in the world (shapes, text, images), without its empty margins
      // (measured once while the page loads, before the camera moves: the same in every worker and every frame;
      //  marks and arrows added later do not count)
      if (target === 'content') {
        if (this._contentBox) return this._contentBox;
        const hidden = [];
        for (let a = w; a; a = a.parentElement) if (a.hasAttribute && a.hasAttribute('data-gm-hidden')) { hidden.push(a); a.removeAttribute('data-gm-hidden'); }
        for (const a of w.querySelectorAll('[data-gm-hidden]')) { hidden.push(a); a.removeAttribute('data-gm-hidden'); }
        const els = this._content || (this._content = [...w.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon,text,img,canvas,video,svg image')].concat([...w.querySelectorAll('*')].filter((e) => !(e instanceof SVGElement) && [...e.childNodes].some((n) => n.nodeType === 3 && n.data.trim()))).filter((e) => !e.closest('[data-gm-internal],defs,clipPath,mask,marker,pattern,[data-gm-sketch-guide],.gm-sketch-mark,.gm-connect,[data-check~="ignore"]')));
        let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
        for (const e of els) { const q = e.getBoundingClientRect(); if (!q.width && !q.height) continue; l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); }
        for (const a of hidden) a.setAttribute('data-gm-hidden', '');
        const r4b = (x) => Math.round(x * 100) / 100;
        return (this._contentBox = l === Infinity ? { x: 0, y: 0, w: w.offsetWidth, h: w.offsetHeight } : { x: r4b((l - M.ox) / M.k), y: r4b((t - M.oy) / M.k), w: r4b((r - l) / M.k), h: r4b((b - t) / M.k) });
      }
      const els = (Array.isArray(target) ? target : [target]).flatMap((t) => typeof t === 'string' ? [...w.querySelectorAll(t)] : t ? [(I.replaced && I.replaced.get(t)) || t] : []);
      if (!els.length) {
        if (!this._warned) { this._warned = true; I.report('warning', 'camera-no-target', `gm.camera: shot target ${JSON.stringify(typeof target === 'string' ? target : String(target))} matched nothing inside the world, so that shot does nothing.`, null, "Use a selector of elements inside the world, a list of them, {x, y, w, h}, or fit: 'all' for the whole world."); }
        return null;
      }
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
      for (const e of els) {
        let q;
        if (e.getClientRects().length) {
          const c = e.getBoundingClientRect(); q = { l: (c.left - M.ox) / M.k, t: (c.top - M.oy) / M.k, r: (c.right - M.ox) / M.k, b: (c.bottom - M.oy) / M.k };
          // scaled far down right now (waiting to pop in, or popping): frame its full size around where it is, so the
          // shot does not zoom in on a dot and then drift while the element grows
          const lw = e.offsetWidth, lh = e.offsetHeight;
          if (lw && lh && (q.r - q.l) * (q.b - q.t) < 0.5 * lw * lh) { const cx = (q.l + q.r) / 2, cy = (q.t + q.b) / 2; q = { l: cx - lw / 2, t: cy - lh / 2, r: cx + lw / 2, b: cy + lh / 2 }; }
        }
        else q = hiddenBox(e, M); // not on screen yet (a later clip): frame where it will be, not the corner of the screen
        if (!q) continue;
        l = Math.min(l, q.l); t = Math.min(t, q.t); r = Math.max(r, q.r); b = Math.max(b, q.b);
      }
      if (l === Infinity) return null;
      return { x: l, y: t, w: r - l, h: b - t };
    }
    // screen insets of a shot: padding (fit only) and the camera's / shot's keep-clear band (safe), per side, in px
    _insets(sh, view) {
      const sides = (v) => {
        if (v == null || v === false) return [0, 0, 0, 0];
        if (typeof v === 'number') return [v, v, v, v];
        if (Array.isArray(v)) { const a = v.map((x) => +x || 0); return a.length === 1 ? [a[0], a[0], a[0], a[0]] : a.length === 2 ? [a[0], a[1], a[0], a[1]] : a.length === 3 ? [a[0], a[1], a[2], a[1]] : a.slice(0, 4); }
        if (typeof v === 'object') return [+v.top || 0, +v.right || 0, +v.bottom || 0, +v.left || 0];
        return [0, 0, 0, 0];
      };
      const s1 = sides(this.opts.safe), s2 = sides(sh.safe);
      const safe = s1.map((x, i) => Math.max(0, Math.max(x, s2[i])));
      return { safe, pad: sh.fit != null ? sides(sh.padding) : [0, 0, 0, 0] };
    }
    _state(sh, M, view, t) {
      // camera state = { cx, cy, zoom, rot } in world coordinates
      // (t: natural motion only, for a follow shot that trails its target)
      const target = sh.fit ?? sh.follow ?? sh.center;
      // (natural) a fit frames where its elements rest during the shot (measured while loading), not every step of
      // their entrance: a window that scales in is seen scaling in, not held at one size by the camera
      const box = sh.fit != null && sh.__rest ? sh.__rest : target != null ? this._box(target, M) : { x: view.w / 2, y: view.h / 2, w: 0, h: 0 };
      if (!box) return null;
      const { safe, pad: pad0 } = (sh.safe != null || this.opts.safe != null || typeof sh.padding !== 'number') ? this._insets(sh, view) : { safe: null, pad: null };
      // keep-clear band: the subject is centred in the rest of the frame (screen px -> world units at this zoom)
      const sdx = (z) => (safe ? (safe[3] - safe[1]) / (2 * z) : 0), sdy = (z) => (safe ? (safe[0] - safe[2]) / (2 * z) : 0);
      if (t !== undefined && sh.__trail && sh.fit == null) {
        const zoom = Math.max(sh.minZoom ?? 0.05, Math.min(sh.maxZoom ?? 20, sh.zoom ?? 1)), off = sh.offset || [0, 0];
        const o = trailOffset(sh.__trail, t, view, zoom);
        if (o) return { cx: box.x + box.w / 2 + o[0] + off[0] - sdx(zoom), cy: box.y + box.h / 2 + o[1] + off[1] - sdy(zoom), zoom, rot: sh.rotate || 0 };
      }
      let zoom = sh.zoom, ix = 0, iy = 0;
      // with fit, zoom multiplies the fitted zoom (1.05 = a little closer)
      if (sh.fit != null) {
        if (!pad0) {
          // padding is screen px on each side; never let it eat more than 40% of the frame
          const pad = Math.max(0, Math.min(sh.padding, view.w * 0.4, view.h * 0.4));
          if (pad < sh.padding && !sh.__padWarned) { sh.__padWarned = true; I.report('warning', 'camera-padding', `gm.camera shot at ${sh.at}s: padding ${sh.padding} is more than 40% of the frame, so it was reduced to ${Math.round(pad)}.`, null, 'padding is in screen px on each side of the framed element (the frame is ' + Math.round(view.w) + 'x' + Math.round(view.h) + '). To show the element smaller, use a smaller padding with zoom below 1, or center + zoom.'); }
          zoom = Math.min((view.w - 2 * pad) / Math.max(1, box.w), (view.h - 2 * pad) / Math.max(1, box.h)) * (sh.zoom ?? 1);
        } else {
          // per side: [top, right, bottom, left] padding plus the keep-clear band; together at most 80% of the frame
          const ins = pad0.map((p, i) => Math.max(0, p) + safe[i]);
          const kx = Math.min(1, (view.w * 0.8) / Math.max(1e-9, ins[1] + ins[3])), ky = Math.min(1, (view.h * 0.8) / Math.max(1e-9, ins[0] + ins[2]));
          if ((kx < 1 || ky < 1) && !sh.__padWarned) { sh.__padWarned = true; I.report('warning', 'camera-padding', `gm.camera shot at ${sh.at}s: padding and safe take more than 80% of the frame, so they were reduced.`, null, 'padding and safe are screen px (the frame is ' + Math.round(view.w) + 'x' + Math.round(view.h) + ').'); }
          const [T, R, B, L] = [ins[0] * ky, ins[1] * kx, ins[2] * ky, ins[3] * kx];
          zoom = Math.min((view.w - L - R) / Math.max(1, box.w), (view.h - T - B) / Math.max(1, box.h)) * (sh.zoom ?? 1);
          zoom = Math.max(sh.minZoom ?? 0.05, Math.min(sh.maxZoom ?? 20, zoom));
          ix = (L - R) / (2 * zoom); iy = (T - B) / (2 * zoom);
        }
      }
      zoom = Math.max(sh.minZoom ?? 0.05, Math.min(sh.maxZoom ?? 20, zoom ?? 1));
      // a fit on something small (a tag, an icon) fills the frame with it: say so once, unless a maxZoom was chosen
      if (sh.fit != null && zoom > 4 && sh.maxZoom == null && !sh.__zoomWarned) { sh.__zoomWarned = true; I.report('warning', 'camera-zoom-high', `gm.camera shot at ${sh.at}s: the fit zooms ${Math.round(zoom * 10) / 10}x, so what it frames fills the screen (text looks huge, pictures soft).`, null, 'Fit a bigger area (the card, not the tag), add padding, or cap it with maxZoom: 2.5. If the close-up is meant, give maxZoom to say so.'); }
      const off = sh.offset || [0, 0];
      if (sh.fit == null && safe) { ix = sdx(zoom); iy = sdy(zoom); }
      return { cx: box.x + box.w / 2 + off[0] - ix, cy: box.y + box.h / 2 + off[1] - iy, zoom, rot: sh.rotate || 0 };
    }
    // bounds: the view never shows beyond this world rect (an explicit rect, a selector, 'world'); it slides (softly,
    // near the edge) instead. When the view is bigger than the bounds in one direction, it is centred on them.
    _bounds(M) {
      let b = this.opts.bounds;
      const sh = this._cur;
      if (sh && sh.bounds !== undefined) b = sh.bounds;
      if (b === undefined) b = /** @type {any} */ (this).__autoBounds ? 'world' : null;
      if (b == null || b === false) return null;
      if (b === 'world' || b === true) b = 'all';
      if (typeof b === 'object' && !Array.isArray(b) && !(b instanceof Element) && 'x' in b) return b;
      const key = typeof b === 'string' ? b : null;
      if (key && this.__bcache && this.__bcache.k === key) return this.__bcache.v;
      const v = this._box(b, M);
      if (key && v) this.__bcache = { k: key, v }; // (measured once: bounds are layout, not animation)
      return v;
    }
    _clamp(st, view, M) {
      const b = this._bounds(M);
      if (!b || !st) return st;
      const one = (c, half, lo, hi) => {
        const a = lo + half, z = hi - half;
        if (a >= z) return (lo + hi) / 2;
        const m = Math.min(0.05 * half * 2, (z - a) / 2); // soft zone: 5% of the view, so the camera eases to a stop
        if (c < a + m) { const d = a + m - c; return a + m - m * (1 - Math.exp(-d / m)); }
        if (c > z - m) { const d = c - (z - m); return z - m + m * (1 - Math.exp(-d / m)); }
        return c;
      };
      return { cx: one(st.cx, view.w / 2 / st.zoom, b.x, b.x + b.w), cy: one(st.cy, view.h / 2 / st.zoom, b.y, b.y + b.h), zoom: st.zoom, rot: st.rot };
    }
    _apply(T) {
      const w = this.world;
      if (!w || !this.shots.length) return false;
      const c = I.nearestClip(w);
      if (c) { const vt = I.mapT(c.parent || null, T); if (vt < c.start - 1e-9 || vt >= c.end - 1e-9) { if (/** @type {any} */ (this).__bg) for (const b of /** @type {any} */ (this).__bg) if (b.el.style.transform) b.el.style.transform = ''; return false; } }
      const t = I.mapT(w, T) - (this.opts.global ? 0 : I.clipStartOf(w));
      const parent = w.offsetParent || w.parentElement;
      const view = { w: parent.clientWidth || I.comp.width, h: parent.clientHeight || I.comp.height };
      const natural = I.naturalMotion(), lastTf = w.style.transform;
      // (natural) measure with the camera off, so what it reads never depends on the frame drawn before (the
      // smallest rounding difference would change a pixel between 1 and N workers)
      if (natural && lastTf) w.style.transform = '';
      const M = this._markers();
      let st;
      if (natural) st = this._natural(t, M, view);
      else {
        // current shot and the one before it
        let i = -1;
        for (let k = 0; k < this.shots.length; k++) if (this.shots[k].at <= t + 1e-9) i = k;
        const cur = this.shots[Math.max(0, i)];
        this._cur = cur; // (check asks which shot is on, to judge only what it frames)
        st = this._state(cur, M, view);
        if (!st) return false;
        if (i > 0 && t < cur.at + cur.duration) {
          const prevS = this._state(this.shots[i - 1], M, view);
          if (prevS) {
            const p = gm.easing(cur.ease)(Math.max(0, Math.min(1, (t - cur.at) / Math.max(0.001, cur.duration))));
            // zoom blends in log space so it feels even
            const z = Math.exp(Math.log(prevS.zoom) + (Math.log(st.zoom) - Math.log(prevS.zoom)) * p);
            st = { cx: prevS.cx + (st.cx - prevS.cx) * p, cy: prevS.cy + (st.cy - prevS.cy) * p, zoom: z, rot: prevS.rot + (st.rot - prevS.rot) * p };
          }
        }
      }
      if (!st) { if (natural && lastTf) w.style.transform = lastTf; return false; }
      st = this._clamp(st, view, M);
      this._st = { T, cx: st.cx, cy: st.cy, zoom: st.zoom, rot: st.rot, vw: view.w, vh: view.h };
      let sx = 0, sy = 0, sr = 0;
      if (natural && this.opts.breathe !== false && this.opts.breathe !== 0) {
        // breathing: a hand-held drift of a pixel or two (smooth seeded noise on the time alone), so a held shot is alive
        const a = (typeof this.opts.breathe === 'number' ? this.opts.breathe : 1) * 0.0018 * Math.min(view.w, view.h), sd = 71 + cameras.indexOf(this) * 13;
        sx += a * (gm.noise(t * 0.21, sd) * 2 - 1 + 0.45 * (gm.noise(t * 0.53, sd + 1) * 2 - 1));
        sy += a * (gm.noise(t * 0.17, sd + 2) * 2 - 1 + 0.45 * (gm.noise(t * 0.47, sd + 3) * 2 - 1));
      }
      for (const sk of this.shakes) {
        const lt = t - sk.at;
        if (lt < 0 || lt > sk.duration) continue;
        const env = Math.sin((lt / sk.duration) * Math.PI) * (1 - lt / sk.duration * 0.5);
        sx += (gm.noise(lt * sk.freq, 11) * 2 - 1) * sk.amount * env; sy += (gm.noise(lt * sk.freq, 23) * 2 - 1) * sk.amount * env; sr += (gm.noise(lt * sk.freq, 37) * 2 - 1) * sk.amount * 0.05 * env;
      }
      const ox = w.offsetLeft, oy = w.offsetTop;
      const tx = view.w / 2 - ox - st.zoom * st.cx + sx, ty = view.h / 2 - oy - st.zoom * st.cy + sy;
      const rot = st.rot + sr;
      // (natural) whole eighths of a pixel: a slow drift or a trailing follow moves the world by tiny amounts every frame,
      // and Chrome then rasters a moving element inside it differently in a fresh worker; on this grid it does not
      const p8 = natural ? (x) => Math.round(x * 8) / 8 : r4;
      // A world that keeps its children in 3D (transform-style: preserve-3d) under an ancestor's perspective is zoomed
      // in depth too, as if the camera moved: a flat scale shrinks a big tilted world's width and height but not its
      // depth, so zoomed out to see it whole it looked as if the camera were inches from it (turns read several times
      // stronger, a tilted floor stood up). A uniform zoom s under perspective P projects exactly like a flat zoom s
      // under perspective P / s, so the camera keeps the flat scale (Chrome then rasters the world at the zoomed size;
      // scale3d made it raster at full size, 1.5x slower) and sets that ancestor's perspective.
      if (this._3d === undefined) {
        this._3d = null;
        if (getComputedStyle(w).transformStyle === 'preserve-3d') {
          for (let a = w.parentElement; a && a !== document.documentElement; a = a.parentElement) {
            const cs = getComputedStyle(a), pv = parseFloat(cs.perspective);
            if (cs.perspective !== 'none' && pv > 0) { this._3d = { el: a, base: a.style.perspective, P: pv }; break; }
            if (cs.transformStyle !== 'preserve-3d') break;
          }
        }
      }
      if (this._3d) { const pv = r4(this._3d.P / st.zoom) + 'px'; if (this._3d.el.style.perspective !== pv) this._3d.el.style.perspective = pv; }
      const tf = `translate(${p8(tx)}px, ${p8(ty)}px)` + (rot ? ` rotate(${r4(rot)}deg)` : '') + ` scale(${r4(st.zoom)})`;
      let changed = false;
      if (lastTf !== tf) changed = true;
      if (w.style.transform !== tf) w.style.transform = tf;
      // parallax layers: siblings of the world (or inside its parent) with data-parallax
      for (const pl of parent.querySelectorAll('[data-parallax]')) {
        if (w.contains(pl)) continue;
        const f = parseFloat(pl.getAttribute('data-parallax')) || 0;
        const ptf = `translate(${r4((view.w / 2 - st.zoom * st.cx - ox) * f + sx * f)}px, ${r4((view.h / 2 - st.zoom * st.cy - oy) * f + sy * f)}px) scale(${r4(1 + (st.zoom - 1) * f)})`;
        if (pl.style.transform !== ptf) { pl.style.transform = ptf; pl.style.transformOrigin = '50% 50%'; changed = true; }
      }
      // parallax inside the world: data-parallax="1.15" moves 15% faster than the world (near: trees, posts),
      // "0.8" slower (far); each element is exactly where it was laid out when the camera looks straight at it
      if (this.__inner) for (const it of this.__inner) {
        const v = `${p8((it.f - 1) * (it.x - st.cx))}px ${p8((it.f - 1) * (it.y - st.cy))}px`;
        if (it.el.style.translate !== v) { it.el.style.translate = v; changed = true; }
      }
      // depth (natural motion): background layers next to the world drift a little with the camera, as if far away
      if (natural && /** @type {any} */ (this).__bg && /** @type {any} */ (this).__ref) {
        const ref = /** @type {any} */ (this).__ref;
        for (const b of /** @type {any} */ (this).__bg) {
          const dx = -b.f * st.zoom * (st.cx - ref.cx), dy = -b.f * st.zoom * (st.cy - ref.cy);
          let ptf;
          if (b.cell) ptf = `translate(${p8((((dx % b.cell) - b.cell) % b.cell))}px, ${p8((((dy % b.cell) - b.cell) % b.cell))}px)`; // a repeating grid: any shift, no edge
          else { const Lx = 0.04 * view.w, Ly = 0.04 * view.h; ptf = `translate(${p8(Lx * Math.tanh(dx / Lx))}px, ${p8(Ly * Math.tanh(dy / Ly))}px) scale(1.09)`; } // at most 4% of the frame, scaled up to cover it
          if (b.el.style.transform !== ptf) { b.el.style.transform = ptf; changed = true; }
        }
      }
      return changed;
    }
    // natural motion: where the camera is at time t
    _natural(t, M, view) {
      const S = this.shots, plan = this._getPlan();
      let i = -1;
      for (let k = 0; k < S.length; k++) if (S[k].at <= t + 1e-9) i = k;
      const cur = S[Math.max(0, i)];
      this._cur = cur;
      let st = null;
      // inside a run of back-to-back moves: one continuous move through all their framings
      const run = plan.runs.find((r) => r.keys.length > 2 && t >= r.tau[0] - 1e-9 && t < r.tau[r.tau.length - 1] - 1e-9);
      if (run) {
        const ks = run.keys.map((k) => this._state(S[k], M, view, t));
        if (ks.every(Boolean)) st = splineState(run.tau, ks, t, run.prep && run.prep.every(Boolean) ? run.prep : ks);
      }
      if (!st) {
        st = this._state(cur, M, view, t);
        if (!st) return null;
        if (i > 0 && t < cur.at + cur.duration) {
          const prevS = this._state(S[i - 1], M, view, t);
          if (prevS) {
            const p = (cur.__ease ? gm.easing(cur.ease) : smoother)(Math.max(0, Math.min(1, (t - cur.at) / Math.max(0.001, cur.duration))));
            const z = Math.exp(Math.log(prevS.zoom) + (Math.log(st.zoom) - Math.log(prevS.zoom)) * p);
            st = { cx: prevS.cx + (st.cx - prevS.cx) * p, cy: prevS.cy + (st.cy - prevS.cy) * p, zoom: z, rot: prevS.rot + (st.rot - prevS.rot) * p };
          }
        }
      }
      // a fast zoom goes a touch past its framing and settles back (peak at the arrival, where the move has stopped)
      for (const o of plan.settles) {
        if (t <= o.e - o.S || t >= o.e + o.S) continue;
        const a = this._state(S[o.from], M, view, t), b = this._state(S[o.k], M, view, t);
        if (!a || !b) break;
        const dl = Math.log(b.zoom) - Math.log(a.zoom);
        if (Math.abs(dl) / o.dur < 0.6) break;
        const x = (t - o.e) / o.S, bump = (1 - x * x) ** 3;
        st = { cx: st.cx, cy: st.cy, zoom: st.zoom * Math.exp(Math.sign(dl) * Math.min(0.025, 0.05 * Math.abs(dl)) * bump), rot: st.rot };
        break;
      }
      return st;
    }
    // runs of back-to-back moves (each starts at most CAM_GAP after the one before arrives) and the moves that settle
    _getPlan() {
      if (this._plan) return this._plan;
      const S = this.shots, runs = /** @type {{ keys: number[], tau: number[], prep?: any[] }[]} */ ([]), settles = [];
      // A long shot on the same subject as the one before (a hold, a slow push) rests: it does not flow into or out of
      // its neighbours. Inside a run it took speed from the moves around it and drifted off its subject (200 px over a
      // 3.8 s hold). blend: true keeps it in the run.
      const subject = (q) => { try { return JSON.stringify([q.fit ?? null, q.center ?? null, q.follow ?? null]); } catch { return null; } };
      const holds = (k) => k > 0 && S[k].blend !== true && (+S[k].duration || 0) >= 1 && subject(S[k]) !== null && subject(S[k]) === subject(S[k - 1]);
      let run = null;
      for (let k = 1; k < S.length; k++) {
        const s = S[k], d = Math.max(0, +s.duration || 0), prev = S[k - 1], pe = prev.at + Math.max(0, +prev.duration || 0);
        if (d < 0.05 || s.blend === false || holds(k)) { run = null; continue; }
        if (run && prev.blend !== false && !holds(k - 1) && s.at <= pe + CAM_GAP) {
          const tk = (Math.min(pe, s.at) + s.at) / 2, last = run.tau.length - 1;
          if (tk > run.tau[last - 1] + 0.05 && s.at + d > tk + 0.05) { run.tau[last] = tk; run.keys.push(k); run.tau.push(s.at + d); continue; }
        }
        run = { keys: [k - 1, k], tau: [s.at, s.at + d] };
        runs.push(run);
      }
      for (const r of runs) {
        const n = r.keys.length - 1, k = r.keys[n], s = S[k], nx = S[k + 1];
        if (s.overshoot === false || /back|elastic|spring|bounce|wobbl/i.test(String(s.ease))) continue;
        const e = r.tau[n], dur = r.tau[n] - r.tau[n - 1];
        const room = nx ? nx.at - e : Infinity;
        const Sx = Math.min(0.3, 0.45 * dur, room);
        if (Sx > 0.08) settles.push({ k, from: r.keys[n - 1], e, dur, S: Sx });
      }
      return (this._plan = { runs, settles });
    }
  }
  // natural camera ----------------------------------------------------------------------------------------------
  const CAM_GAP = 0.25; // a pause shorter than this between two camera moves is not a hold: the camera flows through
  // a single move with no ease given: starts and stops with no jolt (speed and acceleration both 0 at the ends)
  const smoother = (s) => s * s * s * (10 + s * (6 * s - 15));
  // One continuous move through the framings ks at times tau: at rest at both ends, never stopping in between. Per
  // axis (center x, y, log zoom, rotation): knot speeds from a clamped cubic spline (smallest change of acceleration),
  // limited so it barely swings past a framing and eased off a little, then quintic pieces whose acceleration is
  // continuous and 0 at both ends. Speeds and accelerations come from pk, the framings measured while loading at the
  // moments the camera passes them (so a later target that is still animating in does not shake the current move);
  // positions come from ks, the framings now, so every framing is met exactly.
  function splineState(tau, ks, t, pk) {
    const n = tau.length - 1;
    let j = 0;
    while (j < n - 1 && t >= tau[j + 1]) j++;
    const h = [], out = [];
    for (let q = 0; q < n; q++) h.push(tau[q + 1] - tau[q]);
    const s = Math.max(0, Math.min(1, (t - tau[j]) / h[j])), s2 = s * s, s3 = s2 * s, s4 = s3 * s, s5 = s4 * s;
    const H0 = 1 - 10 * s3 + 15 * s4 - 6 * s5, H1 = s - 6 * s3 + 8 * s4 - 3 * s5, H2 = (s2 - 3 * s3 + 3 * s4 - s5) / 2;
    const H3 = (s3 - 2 * s4 + s5) / 2, H4 = -4 * s3 + 7 * s4 - 3 * s5, H5 = 10 * s3 - 15 * s4 + 6 * s5;
    for (const get of [(q) => q.cx, (q) => q.cy, (q) => Math.log(q.zoom), (q) => q.rot]) {
      const v = ks.map(get), p = pk.map(get), d = [], m = new Array(n + 1).fill(0);
      for (let q = 0; q < n; q++) d.push((p[q + 1] - p[q]) / h[q]);
      if (n >= 2) {
        // h[q] m[q-1] + 2 (h[q-1] + h[q]) m[q] + h[q-1] m[q+1] = 3 (h[q] d[q-1] + h[q-1] d[q]), m[0] = m[n] = 0
        const a = [], b = [], c = [], r = [];
        for (let q = 1; q < n; q++) { a.push(h[q]); b.push(2 * (h[q - 1] + h[q])); c.push(h[q - 1]); r.push(3 * (h[q] * d[q - 1] + h[q - 1] * d[q])); }
        for (let q = 1; q < b.length; q++) { const w = a[q] / b[q - 1]; b[q] -= w * c[q - 1]; r[q] -= w * r[q - 1]; }
        const x = new Array(b.length);
        x[b.length - 1] = r[b.length - 1] / b[b.length - 1];
        for (let q = b.length - 2; q >= 0; q--) x[q] = (r[q] - c[q] * x[q + 1]) / b[q];
        for (let q = 1; q < n; q++) m[q] = x[q - 1];
      }
      for (let q = 1; q < n; q++) {
        // same direction on both sides: no swing past the framing. An axis that holds or turns back (a corner, a zoom in
        // then out) keeps a little speed and swings past by at most ~4% of the move, so the camera rounds the corner
        // instead of stopping dead.
        // (continuous in the keys: a framing that wobbles by a hair must not flip the camera's speed)
        const lim = Math.max(d[q - 1] * d[q] > 0 ? 3 * Math.min(Math.abs(d[q - 1]), Math.abs(d[q])) : 0, (0.27 * Math.max(Math.abs(d[q - 1] * h[q - 1]), Math.abs(d[q] * h[q]))) / Math.max(h[q - 1], h[q]));
        if (Math.abs(m[q]) > lim) m[q] = Math.sign(m[q]) * lim;
        m[q] *= 0.8; // eases off a little as it passes each framing (so each one reads), without stopping
      }
      // acceleration at a knot: the smaller of the cubic pieces' on both sides, 0 if they disagree (a short fast move
      // next to a long slow one must not make the slow one swing); 0 at both ends of the run
      const acc = (q) => {
        if (q <= 0 || q >= n) return 0;
        const left = (-6 * d[q - 1] + 2 * m[q - 1] + 4 * m[q]) / h[q - 1], right = (6 * d[q] - 4 * m[q] - 2 * m[q + 1]) / h[q];
        return left * right <= 0 ? 0 : Math.abs(left) < Math.abs(right) ? left : right;
      };
      const hh = h[j];
      out.push(H0 * v[j] + H1 * m[j] * hh + H2 * acc(j) * hh * hh + H3 * acc(j + 1) * hh * hh + H4 * m[j + 1] * hh + H5 * v[j + 1]);
    }
    return { cx: out[0], cy: out[1], zoom: Math.exp(out[2]), rot: out[3] };
  }
  // Follow with lag: where the camera aims, relative to where the target is now. A weighted mean of the target's path
  // over the last moments (weights t*e^(-t/s): an operator who reacts, then catches up; mean delay 2s), from samples
  // taken while loading on a fixed time grid, so any frame gives the same answer. Kept within 22% of the frame.
  function trailOffset(tr, t, view, zoom) {
    const n = tr.xs.length, at = (t - tr.t0) / tr.h;
    if (!(at >= 1 && at <= n - 2)) return null;
    let sw = 0, sx = 0, sy = 0;
    for (let k = Math.max(0, Math.ceil(at - tr.W / tr.h)); k <= Math.floor(at); k++) {
      if (tr.xs[k] == null) continue;
      const u = (at - k) * tr.h, w = u * Math.exp(-u / tr.s);
      sw += w; sx += w * tr.xs[k]; sy += w * tr.ys[k];
    }
    if (!(sw > 0)) return null;
    // the sampled path at t (Catmull-Rom between the samples, so the aim moves smoothly)
    const k = Math.floor(at), f = at - k, P = (arr) => {
      const p0 = arr[k - 1], p1 = arr[k], p2 = arr[k + 1], p3 = arr[k + 2] ?? arr[k + 1];
      if (p0 == null || p1 == null || p2 == null || p3 == null) return null;
      return p1 + 0.5 * f * (p2 - p0 + f * (2 * p0 - 5 * p1 + 4 * p2 - p3 + f * (3 * (p1 - p2) + p3 - p0)));
    };
    const qx = P(tr.xs), qy = P(tr.ys);
    if (qx == null || qy == null) return null;
    const Lx = (0.22 * view.w) / zoom, Ly = (0.22 * view.h) / zoom;
    return [Lx * Math.tanh((sx / sw - qx) / Lx), Ly * Math.tanh((sy / sw - qy) / Ly)];
  }
  // While loading (natural motion): sample the path of every followed element, find background layers for depth.
  function prepCameras() {
    if (!I.naturalMotion() || !cameras.length) return;
    const jobs = [], hidden = [], jobsRest = [];
    const unhide = (e) => { for (let a = e; a; a = a.parentElement) if (a.hasAttribute && a.hasAttribute('data-gm-hidden')) { hidden.push(a); a.removeAttribute('data-gm-hidden'); } };
    const resolve = (c, tg) => (Array.isArray(tg) ? tg : [tg]).flatMap((x) => typeof x === 'string' ? [...c.world.querySelectorAll(x)] : x instanceof Element ? [(I.replaced && I.replaced.get(x)) || x] : []);
    try {
      // fit shots: where their elements rest during the shot. Sampled across the hold (from the arrival to the next shot
      // or the end of the clip); the longest run of samples that agree gives the box. A target still moving at the end of
      // its hold (a truck that keeps driving) has no rest: it is measured live, every frame, as before.
      if (I.probe) {
        const rest = new Map();
        for (const c of cameras) {
          const w = c.world;
          if (!w || !c.shots.length) continue;
          const clip = I.nearestClip(w), base = c.opts.global ? 0 : I.clipStartOf(w);
          const endLocal = (clip && isFinite(clip.end) ? clip.end : I.comp.duration) - base;
          c.shots.forEach((sh, k) => {
            const f = sh.fit;
            if (f == null || sh.rest === false || f === 'all' || f === 'content' || (typeof f === 'object' && !Array.isArray(f) && !(f instanceof Element) && 'x' in f)) return;
            if (typeof f === 'string' && w.matches(f)) return;
            const arrive = sh.at + (k ? Math.max(0, +sh.duration || 0) : 0), nx = c.shots[k + 1];
            const hold = Math.min(endLocal, nx ? nx.at : endLocal) - 1e-3;
            if (!(hold > arrive)) return;
            const n = 6, boxes = new Array(n + 1).fill(null);
            for (let j = 0; j <= n; j++) {
              const T = Math.max(0, Math.min(I.comp.duration, base + arrive + ((hold - arrive) * j) / n)), key = Math.round(T * 1e6);
              if (!rest.has(key)) rest.set(key, { T, list: [] });
              rest.get(key).list.push(() => { try { boxes[j] = c._box(f, c._markers()); } catch (e) {} });
            }
            jobsRest.push({ sh, boxes });
          });
        }
        for (const { T, list } of [...rest.values()].sort((x, y) => x.T - y.T)) { I.probe(T); for (const fn of list) fn(); }
        const same = (a, b) => a && b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;
        const r2 = (x) => Math.round(x * 100) / 100;
        for (const { sh, boxes } of jobsRest) {
          // the longest stretch where the box stays put (an entrance before it and an exit after it are not the rest;
          // on a tie, the later one, as an entrance usually comes first)
          let best = null, bestLen = 1;
          for (let j = 1, run = 1; j < boxes.length; j++) {
            run = same(boxes[j], boxes[j - 1]) ? run + 1 : 1;
            if (run >= 2 && run >= bestLen) { bestLen = run; best = boxes[j]; }
          }
          if (best) sh.__rest = { x: r2(best.x), y: r2(best.y), w: r2(best.w), h: r2(best.h) };
        }
        if (rest.size) I.probe(0);
      }
      for (const c of cameras) {
        const w = c.world;
        if (!w || !c.shots.length) continue;
        unhide(w);
        const clip = I.nearestClip(w), base = c.opts.global ? 0 : I.clipStartOf(w);
        const endLocal = (clip && isFinite(clip.end) ? clip.end : I.comp.duration) - base;
        c.shots.forEach((sh, k) => {
          if (sh.follow == null || sh.fit != null || sh.lag === 0 || sh.lag === false) return;
          let els;
          try { els = resolve(c, sh.follow); } catch (e) { return; }
          if (!els.length) return;
          for (const e of els) unhide(e);
          const lag = +sh.lag > 0 ? Math.min(1.5, +sh.lag) : 0.15, s = lag / 2, W = Math.min(2, 6 * s);
          const nx = c.shots[k + 1], end = Math.min(endLocal, nx ? nx.at + Math.max(0, +nx.duration || 0) : endLocal);
          const h = Math.max(1 / 30, (end - sh.at + W) / 900);
          const a = Math.floor((sh.at - W) / h) - 2, b = Math.ceil(end / h) + 2;
          if (b > a) jobs.push({ c, sh, els, a, b, h, s, W, base, xs: new Array(b - a + 1).fill(null), ys: new Array(b - a + 1).fill(null) });
        });
      }
      const at = new Map(), want = (T, fn) => {
        T = Math.max(0, Math.min(I.comp.duration, T));
        const key = Math.round(T * 1e6);
        if (!at.has(key)) at.set(key, { T, list: [] });
        at.get(key).list.push(fn);
      };
      const r2 = (x) => Math.round(x * 100) / 100;
      for (const jb of jobs) for (let k = jb.a; k <= jb.b; k++) {
        const idx = k - jb.a;
        want(jb.base + k * jb.h, () => {
          const M = jb.c._markers();
          let l = Infinity, tp = Infinity, r = -Infinity, bt = -Infinity;
          for (const e of jb.els) { if (!e.getClientRects().length) continue; const q = e.getBoundingClientRect(); l = Math.min(l, q.left); tp = Math.min(tp, q.top); r = Math.max(r, q.right); bt = Math.max(bt, q.bottom); }
          if (l === Infinity) return;
          jb.xs[idx] = r2(((l + r) / 2 - M.ox) / M.k); jb.ys[idx] = r2(((tp + bt) / 2 - M.oy) / M.k);
        });
      }
      // a run of back-to-back moves: each framing as it is when the camera passes it (for the speeds through it)
      for (const c of cameras) {
        const w = c.world;
        if (!w || c.shots.length < 3) continue;
        const base = c.opts.global ? 0 : I.clipStartOf(w), p = w.offsetParent || w.parentElement;
        for (const run of c._getPlan().runs) {
          if (run.keys.length < 3) continue;
          run.prep = run.keys.map(() => null);
          run.keys.forEach((k, q) => {
            for (const e of (() => { try { return resolve(c, c.shots[k].fit ?? c.shots[k].follow ?? c.shots[k].center); } catch (er) { return []; } })()) unhide(e);
            want(base + run.tau[q], () => {
              const s = c._state(c.shots[k], c._markers(), { w: p.clientWidth || I.comp.width, h: p.clientHeight || I.comp.height });
              if (s) run.prep[q] = { cx: r2(s.cx), cy: r2(s.cy), zoom: Math.round(s.zoom * 1e5) / 1e5, rot: s.rot };
            });
          });
        }
      }
      if (at.size && I.probe) {
        for (const { T, list } of [...at.values()].sort((x, y) => x.T - y.T)) { I.probe(T); for (const fn of list) fn(); }
        I.probe(0);
        for (const jb of jobs) jb.sh.__trail = { t0: jb.a * jb.h, h: jb.h, xs: jb.xs, ys: jb.ys, s: jb.s, W: jb.W };
      }
      // depth: background layers next to the world (outside it, in the same frame) drift with the camera, as if far
      // away: the grid-bg and gradient-bg blocks, and full-frame layers behind the world without text. data-parallax
      // on a layer (or around it) is the author's choice and wins; gm.camera(world, { depth: false }) turns it off.
      for (const c of cameras) {
        const w = c.world;
        if (!w || !c.shots.length || c.opts.depth === false) continue;
        const parent = w.offsetParent || w.parentElement;
        if (!parent) continue;
        const pr = parent.getBoundingClientRect(), list = [], seen = new Set();
        const ok = (e) => e && !seen.has(e) && !w.contains(e) && !e.contains(w) && !e.closest('[data-parallax],[data-gm-internal]') && !e.querySelector('[data-parallax]');
        for (const root of parent.querySelectorAll('.gmb-gridbg, .gmb-grad')) {
          if (!ok(root)) continue;
          const grid = root.querySelector('.gmb-gridbg__grid'), cv = root.querySelector('.gmb-grad__c');
          if (grid) { const cell = parseFloat(getComputedStyle(grid).backgroundSize); if (cell > 1) { seen.add(root); list.push({ el: grid, f: 0.12, cell }); } }
          else if (cv) { seen.add(root); list.push({ el: cv, f: 0.12 }); cv.style.transformOrigin = '50% 50%'; }
        }
        const wb = [...parent.children].find((e) => e.contains(w));
        for (const e of parent.children) {
          if (e === wb) break; // only layers before (behind) the world
          if (!ok(e) || e.querySelector('.gmb-gridbg, .gmb-grad') || e.textContent.trim() || e.getAnimations().length || e.style.transform) continue;
          const cs = getComputedStyle(e);
          if (cs.position === 'static' || cs.transform !== 'none' || cs.translate !== 'none' || cs.scale !== 'none' || cs.display === 'none') continue;
          const q = e.getBoundingClientRect();
          const cover = Math.max(0, Math.min(q.right, pr.right) - Math.max(q.left, pr.left)) * Math.max(0, Math.min(q.bottom, pr.bottom) - Math.max(q.top, pr.top));
          if (cover < 0.9 * pr.width * pr.height) continue;
          seen.add(e); list.push({ el: e, f: 0.12 }); e.style.transformOrigin = '50% 50%';
        }
        if (!list.length) continue;
        const view = { w: parent.clientWidth || I.comp.width, h: parent.clientHeight || I.comp.height };
        const ref = c._state(c.shots[0], c._markers(), view);
        if (ref) { c.__bg = list; c.__ref = ref; }
      }
    } finally {
      for (const a of hidden) a.setAttribute('data-gm-hidden', '');
    }
  }
  // ---------------------------------------------------------------------------
  // gm.path.travel(el, path, { stops, ease, rotate }): move an element along an SVG path.
  //   stops: [[time, progress], ...] e.g. [[0, 0], [1.5, 0.3], [2.5, 0.3], [4, 1]] (holds where progress repeats)
  // The path is converted to the element's own coordinates once, then played by the browser
  // (CSS offset-path), so it is exact and cheap. Times are relative to the element's clip.
  // ---------------------------------------------------------------------------
  const travels = [];
  function setupTravel(tr) {
    const el = typeof tr.el === 'string' ? document.querySelector(tr.el) : (I.replaced && I.replaced.get(tr.el)) || tr.el;
    let pth = typeof tr.path === 'string' && !/^\s*[Mm]/.test(tr.path) ? document.querySelector(tr.path) : tr.path;
    // a sketched shape (data-sketch) is a group: travel along its exact shape
    if (pth && pth.nodeType === 1 && !pth.getTotalLength && pth.querySelector) pth = pth.querySelector('[data-gm-sketch-guide]') || pth.querySelector('path') || pth;
    if (!el) { I.report('error', 'travel-no-element', `gm.path.travel: "${tr.el}" matched nothing.`, null); return; }
    // a stop may name a waypoint instead of a progress: [2, '#dock'] = where the path passes closest to #dock's centre
    if ((tr.opts.stops || []).some((s0) => typeof (Array.isArray(s0) ? s0[1] : s0 && s0.to) === 'string')) {
      const geo = pth && pth.getTotalLength && pth.getScreenCTM ? pth : null, M = geo && geo.getScreenCTM(), len = geo ? geo.getTotalLength() : 0;
      const N = Math.max(100, Math.min(2000, Math.round(len / 2))), pts = [];
      if (M) for (let i = 0; i <= N; i++) { const q = geo.getPointAtLength((i / N) * len), sp = new DOMPoint(q.x, q.y).matrixTransform(M); pts.push([sp.x, sp.y]); }
      const resolved = tr.opts.stops.map((s0) => {
        const [t, to] = Array.isArray(s0) ? s0 : [s0.at, s0.to];
        if (typeof to !== 'string') return [t, to];
        const w = document.querySelector(to), r = w && w.getBoundingClientRect();
        if (!pts.length || !r || !(r.width || r.height)) { I.report('error', 'travel-bad-stop', `gm.path.travel: the stop "${to}" ${!w ? 'matched nothing' : !pts.length ? 'needs a path element (an SVG <path>, a shape or a sketched shape) to measure on' : 'is not displayed when the travel is set up'}.`, el, 'Name an element on or near the route, or give a progress from 0 to 1.'); return [t, 0]; }
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let best = 0, bd = Infinity;
        pts.forEach(([x, y], i) => { const dd = (x - cx) ** 2 + (y - cy) ** 2; if (dd < bd) { bd = dd; best = i; } });
        return [t, Math.round((best / N) * 1e4) / 1e4];
      });
      tr.opts = Object.assign({}, tr.opts, { stops: resolved });
      tr.stops = resolved.slice().sort((x, y) => x[0] - y[0]);
    }
    // an inline box (a <span>, an <a>) cannot be moved by offset-path or transforms
    if (el instanceof HTMLElement && getComputedStyle(el).display === 'inline') I.report('warning', 'travel-inline', `gm.path.travel: "${typeof tr.el === 'string' ? tr.el : el.tagName.toLowerCase()}" is an inline element, so it cannot move.`, el, 'Give it display: inline-block (or block), or travel a <div> around it.');
    // along an gm.connect arrow: its path changes every frame, so sketch.js lays it out each frame (I.liveTravels)
    const conn = tr.path && tr.path.__gmConnector;
    if (el instanceof SVGElement && !(el instanceof SVGSVGElement)) return setupTravelSVG(tr, el, pth, conn);
    // an outer <svg> (also one with data-sketch) is a CSS box like a <div>, but has no offsetLeft: measured once
    const host = el instanceof HTMLElement ? null : travelHost(el);
    if (conn) liveTravels.push({ kind: 'travel', tr, el, conn, host });
    else setupTravelPath(tr, el, pth, host);
    el.style.offsetAnchor = 'center';
    setupTravelAnim(tr, el);
  }
  // An element without offsetLeft (an outer <svg>): its containing block and where its own layout box sits in it.
  // A copy without children, transforms or animations (same id and classes, so the same CSS) stands in for it while
  // it is measured.
  function travelHost(el) {
    let cb = el.parentElement;
    while (cb && cb !== document.body) { const cs = getComputedStyle(cb); if (cs.position !== 'static' || cs.transform !== 'none') break; cb = cb.parentElement; }
    cb = cb || document.body;
    const hidden = [];
    for (let a = el; a; a = a.parentElement) if (a.hasAttribute && a.hasAttribute('data-gm-hidden')) { hidden.push(a); a.removeAttribute('data-gm-hidden'); }
    const twin = el.cloneNode(false), disp = el.style.display;
    for (const k of ['transform', 'translate', 'rotate', 'scale', 'offsetPath']) twin.style[k] = 'none';
    twin.style.animation = 'none'; twin.style.transition = 'none';
    el.parentNode.insertBefore(twin, el);
    el.style.display = 'none';
    const mk = (x) => { const d = document.createElement('div'); d.setAttribute('data-gm-internal', ''); d.style.cssText = `position:absolute;left:${x}px;top:0;width:0;height:0`; cb.appendChild(d); return d; };
    const m0 = mk(0), m1 = mk(1000);
    const a = m0.getBoundingClientRect(), b = m1.getBoundingClientRect(), r = twin.getBoundingClientRect();
    const k = (b.left - a.left) / 1000 || 1, r2 = (x) => Math.round(x * 100) / 100;
    m0.remove(); m1.remove(); twin.remove();
    el.style.display = disp;
    for (const h of hidden) h.setAttribute('data-gm-hidden', '');
    return { cb, ox: r2((r.left - a.left) / k), oy: r2((r.top - a.top) / k), w: r2(r.width / k), h: r2(r.height / k) };
  }
  // offset / side: the path moved sideways, so the rider goes beside the line instead of on it.
  //   offset: px (at 1080p, in the path's space) to the right of the direction of travel (below a left-to-right
  //   path); negative = left (above). side: 'above' | 'below' | 'left' | 'right' (on screen): clear of the line by
  //   half the rider's size across it, plus offset as the gap (default 10). pts: [[x, y], ...] in the rider's space.
  function shiftTravel(pts, tr, w, h) {
    const o = tr.opts || {}, side = o.side == null ? null : String(o.side).toLowerCase();
    const dir = side ? { above: [0, -1], top: [0, -1], below: [0, 1], bottom: [0, 1], under: [0, 1], left: [-1, 0], right: [1, 0] }[side] : null;
    if (side && !dir && !tr.__sideWarned) { tr.__sideWarned = true; I.report('warning', 'travel-bad-side', `gm.path.travel: side "${o.side}" is not one of above below left right.`, null, "Use side: 'above' (or 'below', 'left', 'right'), or offset: -40 (px; negative = left of the direction of travel, i.e. above a left-to-right path)."); }
    const off = (+o.offset || 0) * PX(), n = pts.length;
    if ((!dir && !off) || n < 2) return pts;
    const rot = o.rotate === true || o.rotate === 'auto' || (typeof o.rotate === 'string' && /auto/.test(o.rotate));
    let sgn = 1;
    if (dir) {
      // which way is that side for the line as a whole (its first to last point), like an arrow's label
      const cx = pts[n - 1][0] - pts[0][0], cy = pts[n - 1][1] - pts[0][1], cl = Math.hypot(cx, cy) || 1, nx = -cy / cl, ny = cx / cl;
      const dot = nx * dir[0] + ny * dir[1];
      sgn = Math.abs(dot) > 0.05 ? Math.sign(dot) : dir[1] ? (nx >= 0 ? 1 : -1) : (ny <= 0 ? 1 : -1);
    }
    const gap = dir ? (o.offset == null ? 10 * PX() : off) : off;
    return pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      const d = dir ? sgn * (gap + (rot ? h / 2 : (Math.abs(nx) * w + Math.abs(ny) * h) / 2)) : off;
      return [p[0] + nx * d, p[1] + ny * d];
    });
  }
  I.shiftTravel = shiftTravel;
  function setupTravelPath(tr, el, pth, host) {
    const cb = host ? host.cb : el.offsetParent || el.parentElement;
    const mk = (x) => { const d = document.createElement('div'); d.setAttribute('data-gm-internal', ''); d.style.cssText = `position:absolute;left:${x}px;top:0;width:0;height:0`; cb.appendChild(d); return d; };
    const m0 = mk(0), m1 = mk(1000);
    const a = m0.getBoundingClientRect(), b = m1.getBoundingClientRect();
    const k = (b.left - a.left) / 1000 || 1;
    m0.remove(); m1.remove();
    let pts = [];
    if (pth && pth.nodeType === 1 && pth.getTotalLength) {
      const len = pth.getTotalLength(), ctm = pth.getScreenCTM(), sv = pth.ownerSVGElement;
      const N = Math.max(60, Math.min(600, Math.round(len / 4)));
      for (let i = 0; i <= N; i++) {
        const q = pth.getPointAtLength((i / N) * len);
        const sp = sv.createSVGPoint(); sp.x = q.x; sp.y = q.y;
        const s2 = sp.matrixTransform(ctm);
        pts.push([(s2.x - a.left) / k, (s2.y - a.top) / k]);
      }
    } else {
      // raw path data: already in the container's coordinates
      const pe = pathEl(String(tr.path)); const len = pe.getTotalLength(); const N = Math.max(60, Math.min(600, Math.round(len / 4)));
      for (let i = 0; i <= N; i++) { const q = pe.getPointAtLength((i / N) * len); pts.push([q.x, q.y]); }
    }
    if (tr.opts.offset || tr.opts.side) pts = shiftTravel(pts, tr, host ? host.w : el.offsetWidth, host ? host.h : el.offsetHeight);
    // offset-path point (0,0) is the element's own layout top-left corner; its center is placed on the path
    const ox = host ? host.ox : el.offsetLeft, oy = host ? host.oy : el.offsetTop;
    const d = 'M' + pts.map(([x, y]) => r4(x - ox) + ' ' + r4(y - oy)).join(' L');
    el.style.offsetPath = `path('${d}')`;
  }
  function setupTravelAnim(tr, el) {
    el.style.offsetRotate = tr.opts.rotate === false || tr.opts.rotate == null ? '0deg' : tr.opts.rotate === true || tr.opts.rotate === 'auto' ? 'auto' : String(tr.opts.rotate);
    let stops = (tr.opts.stops || [[0, 0], [tr.opts.duration || 2, 1]]).map((s0) => (Array.isArray(s0) ? s0 : [s0.at, s0.to]));
    stops = stops.sort((x, y) => x[0] - y[0]);
    const T0 = stops[0][0], T1 = stops[stops.length - 1][0];
    const total = Math.max(0.001, T1 - T0);
    const ease = tr.opts.ease || 'in-out-cubic';
    const kf = stops.map(([t, pr], i) => ({ offsetDistance: r4(pr * 100) + '%', offset: (t - T0) / total, easing: I.cssEasing(Array.isArray(ease) ? ease[i] || 'linear' : ease) }));
    const c = I.nearestClip(el);
    const an = I.real.animate.call(el, kf, { duration: total * 1000, delay: T0 * 1000, fill: 'both' });
    an.pause(); I.addOwnAnim(an, c ? c.start : 0);
    tr.done = true;
    tr.stops = stops; tr.easeFn = (i) => gm.easing(Array.isArray(ease) ? ease[i] || 'linear' : ease);
  }
  // SVG shapes (a <circle>, a <g>) travel in their own SVG's coordinates, moved by a transform each frame.
  const svgTravels = [];
  const liveTravels = I.liveTravels = [];
  function setupTravelSVG(tr, el, pth, conn) {
    if (conn) {
      const bb = el.getBBox();
      el.style.transformBox = 'fill-box'; el.style.transformOrigin = '50% 50%';
      liveTravels.push({ kind: 'travel', svg: true, tr, el, conn, cx: bb.x + bb.width / 2, cy: bb.y + bb.height / 2, w: bb.width, h: bb.height });
      tr.done = true;
      return;
    }
    const par = el.parentNode;
    const inv = par.getScreenCTM().inverse();
    let pts = [];
    if (pth && pth.nodeType === 1 && pth.getTotalLength) {
      const len = pth.getTotalLength(), ctm = pth.getScreenCTM(), sv = pth.ownerSVGElement || pth;
      const N = Math.max(60, Math.min(600, Math.round(len / 4)));
      for (let i = 0; i <= N; i++) {
        const q = pth.getPointAtLength((i / N) * len);
        const sp = sv.createSVGPoint(); sp.x = q.x; sp.y = q.y;
        const p2 = sp.matrixTransform(ctm).matrixTransform(inv);
        pts.push([p2.x, p2.y]);
      }
    } else {
      const pe = pathEl(String(tr.path)); const len = pe.getTotalLength(); const N = Math.max(60, Math.min(600, Math.round(len / 4)));
      for (let i = 0; i <= N; i++) { const q = pe.getPointAtLength((i / N) * len); pts.push([q.x, q.y]); }
    }
    const bb = el.getBBox();
    if (tr.opts.offset || tr.opts.side) pts = shiftTravel(pts, tr, bb.width, bb.height);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    el.style.transformBox = 'fill-box'; el.style.transformOrigin = '50% 50%';
    svgTravels.push({ tr, el, pts, cum, cx: bb.x + bb.width / 2, cy: bb.y + bb.height / 2, last: null });
    tr.done = true;
  }
  function updateSvgTravels(T) {
    let changed = false;
    for (const st of svgTravels) {
      const t = I.mapT(st.el, T) - I.clipStartOf(st.el);
      const L = st.cum[st.cum.length - 1] * Math.max(0, Math.min(1, st.tr.progress(t)));
      let i = 1; while (i < st.cum.length - 1 && st.cum[i] < L) i++;
      const seg = Math.max(1e-9, st.cum[i] - st.cum[i - 1]), f = Math.max(0, Math.min(1, (L - st.cum[i - 1]) / seg));
      const [x0, y0] = st.pts[i - 1], [x1, y1] = st.pts[i];
      const x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f;
      const rot = st.tr.opts.rotate;
      const ang = rot === true || rot === 'auto' ? (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI : 0;
      const v = `translate(${r4(x - st.cx)}px, ${r4(y - st.cy)}px)` + (ang ? ` rotate(${r4(ang)}deg)` : '');
      if (v !== st.last) { st.last = v; st.el.style.transform = v; changed = true; }
    }
    return changed;
  }
  function travel(el, path, opts = {}) {
    const tr = { el, path, opts, done: false };
    // Stops and easing are known right away, so .progress(t) is the same before and after the video starts.
    const ease0 = opts.ease || 'in-out-cubic';
    tr.stops = (opts.stops || [[0, 0], [opts.duration || 2, 1]]).map((s0) => (Array.isArray(s0) ? s0 : [s0.at, s0.to])).sort((x, y) => x[0] - y[0]);
    tr.easeFn = (i) => gm.easing(Array.isArray(ease0) ? ease0[i] || 'linear' : ease0);
    travels.push(tr);
    if (initDone) setupTravel(tr);
    // progress (0..1) at local time t, e.g. to draw the route behind the traveler
    tr.progress = (t) => {
      const st = tr.stops || (opts.stops || []).map((s0) => (Array.isArray(s0) ? s0 : [s0.at, s0.to]));
      if (!st.length) return 0;
      if (t <= st[0][0]) return st[0][1];
      for (let i = 1; i < st.length; i++) if (t <= st[i][0]) { const p = (t - st[i - 1][0]) / Math.max(1e-6, st[i][0] - st[i - 1][0]); return st[i - 1][1] + (st[i][1] - st[i - 1][1]) * (tr.easeFn ? tr.easeFn(i - 1)(p) : p); }
      return st[st.length - 1][1];
    };
    return tr;
  }

  // ---------------------------------------------------------------------------
  // gm.path.stream(path, { at, until, rate, trip, … }): items flowing along an SVG path (money, data, traffic, cells):
  // emitted at a rate, each with its own speed and a little sideways spread, fading in and out at the ends. Pure
  // function of time (seeded), so seekable and the same in every render; follows a path whose shape changes.
  // ---------------------------------------------------------------------------
  const streams = [];
  function stream(path, opts = {}) {
    const st = { path, opts, built: false, items: [] };
    streams.push(st);
    if (initDone) setupStream(st);
    return st;
  }
  function setupStream(st) {
    st.built = true;
    let p = typeof st.path === 'string' ? document.querySelector(st.path) : st.path;
    p = (I.replaced && p && I.replaced.get(p)) || p;
    if (p && p.nodeType === 1 && !p.getTotalLength && p.querySelector) p = p.querySelector('[data-gm-sketch-guide]') || p.querySelector('path') || p;
    if (!p || !p.getTotalLength) { I.report('error', 'stream-no-path', `gm.path.stream: "${st.path}" is not an SVG path, line or shape.`, null, 'Pass the id of an SVG <path> (or line, polyline, a sketched or gm.connect path).'); return; }
    const o = Object.assign({ at: 0, until: Infinity, rate: 5, trip: 1.6, jitter: 0.3, spread: 0, size: 12, shape: 'dot', color: 'currentColor', stroke: 2, fade: 0.08, limit: null, seed: streams.indexOf(st) + 1 }, st.opts);
    const c = I.nearestClip(p.closest('svg') || p);
    const base = o.global ? 0 : c ? c.start : 0;
    const end = Math.min(base + o.until, gm.duration || 1e9);
    const rnd = I.makeRandom(1 + o.seed * 104729);
    // emissions: time, trip length and sideways offset of each item, known up front
    const t0 = base + o.at, gap = 1 / Math.max(0.01, o.rate), em = [];
    for (let k = 0, t = t0; t < end && k < 5000; k++, t = t0 + k * gap) em.push({ e: t + (rnd() - 0.5) * gap * o.jitter, T: o.trip * (1 + (rnd() * 2 - 1) * o.jitter * 0.5), side: (rnd() * 2 - 1) * o.spread });
    const maxT = em.reduce((m, x) => Math.max(m, x.T), 0);
    const pool = Math.ceil((maxT + gap) * o.rate) + 2;
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('data-gm-internal', ''); g.setAttribute('data-gm-stream', '');
    p.parentNode.insertBefore(g, p.nextSibling);
    const color = resolveVars(p, o.color);
    for (let i = 0; i < pool; i++) {
      const it = typeof o.make === 'function' ? o.make(i) : document.createElementNS(SVGNS, 'circle');
      if (typeof o.make !== 'function') {
        it.setAttribute('r', String(o.size / 2));
        if (o.shape === 'ring') { it.setAttribute('fill', 'none'); it.setAttribute('stroke', color); it.setAttribute('stroke-width', String(o.stroke)); }
        else it.setAttribute('fill', color);
      }
      it.style.display = 'none';
      g.appendChild(it);
      st.items.push(it);
    }
    Object.assign(st, { p, o, em, pool, g, lastD: null, len: 0 });
  }
  function updateStreams(T) {
    let changed = false;
    for (const st of streams) {
      if (!st.p) continue;
      const d = st.p.getAttribute('d') || st.p.getAttribute('points') || '';
      if (d !== st.lastD) { st.lastD = d; st.len = st.p.getTotalLength(); }
      const lim = typeof st.o.limit === 'function' ? st.o.limit(T) : st.o.limit == null ? 1 : +st.o.limit;
      const shown = new Array(st.pool).fill(null);
      for (let k = 0; k < st.em.length; k++) {
        const x = st.em[k], q = (T - x.e) / x.T;
        if (q < 0) break; // emitted in time order (within jitter): the rest are later
        if (q >= 1 || q > lim) continue;
        shown[k % st.pool] = { x, q };
      }
      for (let i = 0; i < st.pool; i++) {
        const it = st.items[i], s = shown[i];
        if (!s) { if (it.style.display !== 'none') { it.style.display = 'none'; changed = true; } continue; }
        const L = s.q * st.len, a = st.p.getPointAtLength(L), b = st.p.getPointAtLength(Math.min(st.len, L + 0.5)), c0 = st.p.getPointAtLength(Math.max(0, L - 0.5));
        let nx = -(b.y - c0.y), ny = b.x - c0.x; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        const op = Math.max(0, Math.min(1, s.q / st.o.fade, (1 - s.q) / st.o.fade, (lim - s.q) / st.o.fade));
        const tf = `translate(${r4(a.x + nx * s.x.side)}px, ${r4(a.y + ny * s.x.side)}px)`;
        if (it.style.display === 'none') it.style.display = '';
        if (it.style.transform !== tf) { it.style.transform = tf; changed = true; }
        const ov = String(r4(op)); if (it.style.opacity !== ov) { it.style.opacity = ov; changed = true; }
      }
    }
    return changed;
  }

  // ---------------------------------------------------------------------------
  // gm.burst(target, { at, kind, x, y, count, colors, … }): confetti, sparks, dust or bubbles
  // thrown from a point at a moment. Pure physics of time: seekable, same in every render.
  // ---------------------------------------------------------------------------
  const bursts = [];
  const BURST_KINDS = {
    confetti: { count: 160, speed: 1000, spread: 360, angle: -90, gravity: 1100, drag: 1.8, duration: 2.8, size: 17, shape: 'paper' },
    sparks: { count: 80, speed: 1600, spread: 360, angle: -90, gravity: 500, drag: 3.2, duration: 1, size: 6, shape: 'streak' },
    dust: { count: 60, speed: 260, spread: 360, angle: -90, gravity: -40, drag: 1.2, duration: 2.2, size: 6, shape: 'dot' },
    bubbles: { count: 40, speed: 380, spread: 120, angle: -90, gravity: -120, drag: 0.8, duration: 2.4, size: 16, shape: 'ring' },
  };
  function burst(target, opts = {}) {
    const b = { target, opts, canvas: null };
    bursts.push(b);
    if (initDone) setupBurst(b);
    return b;
  }
  function setupBurst(b) {
    const el = typeof b.target === 'string' ? document.querySelector(b.target) : b.target;
    if (!el) { I.report('error', 'burst-no-target', `gm.burst: "${b.target}" matched nothing.`, null); return; }
    // edge: 'top' | 'bottom' | 'left' | 'right': pieces start spread along that edge of the target (just outside it) and
    // drift inward over a while (confetti raining from the top), instead of all leaving one point at once
    const edge = /^(top|bottom|left|right)$/.test(b.opts.edge || '') ? b.opts.edge : null;
    if (b.opts.edge && !edge) I.report('warning', 'burst-no-target', `gm.burst: edge "${b.opts.edge}" is not top, bottom, left or right.`, null);
    const EDGE = { top: { x: '50%', y: '0%', angle: 90 }, bottom: { x: '50%', y: '100%', angle: -90 }, left: { x: '0%', y: '50%', angle: 0 }, right: { x: '100%', y: '50%', angle: 180 } };
    const kindDefs = BURST_KINDS[b.opts.kind || 'confetti'] || BURST_KINDS.confetti;
    const edgeDefs = edge ? Object.assign({ spread: 50, speed: 260, stagger: Math.min(1.6, (b.opts.duration ?? kindDefs.duration) * 0.5) }, EDGE[edge]) : null;
    const o = Object.assign({ kind: 'confetti', at: 0, x: '50%', y: '50%', colors: ['#ff5c8a', '#ffd166', '#06d6a0', '#118ab2', '#a78bfa', '#ffffff'], seed: bursts.indexOf(b) + 1 }, kindDefs, edgeDefs, b.opts);
    if (Array.isArray(o.colors)) o.colors = o.colors.map((c) => resolveVars(el, c)); // 'var(--accent)' works here too
    const find = (v) => (typeof v === 'string' ? el.querySelector(v) || document.querySelector(v) : v);
    const behind = o.behind ? find(o.behind) : null;
    if (o.behind && !behind) I.report('warning', 'burst-no-target', `gm.burst: behind "${o.behind}" matched nothing.`, null);
    b.fromEl = o.from ? find(o.from) : null;
    if (o.from && !b.fromEl) I.report('warning', 'burst-no-target', `gm.burst: from "${o.from}" matched nothing.`, null);
    // Where the canvas lives: next to `behind` (just before it, so it paints under it in the same layer), else in the
    // camera world of the `from` element (so the particles pan and zoom with the camera), else in the target.
    const worldOf = (n) => { const c = n && cameras.find((cm) => cm.world && cm.world !== n && cm.world.contains(n)); return c ? c.world : null; };
    const under = behind && behind instanceof SVGElement ? behind.closest('svg').ownerSVGElement || behind.closest('svg') : behind; // (a canvas cannot live inside an SVG)
    const host = under ? under.parentElement : worldOf(b.fromEl) || el;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    const cv = document.createElement('canvas');
    cv.setAttribute('data-gm-internal', '');
    let z = o.zIndex ?? o.z ?? (host === el ? 30 : 'auto');
    if (behind) {
      const bcs = getComputedStyle(under);
      if (bcs.position === 'static') under.style.position = 'relative';
      z = isFinite(parseInt(bcs.zIndex, 10)) ? parseInt(bcs.zIndex, 10) : 'auto';
      host.insertBefore(cv, under);
    } else host.appendChild(cv);
    // two markers map screen points to the host's own (untransformed) coordinates
    const mk = (x) => { const d = document.createElement('div'); d.setAttribute('data-gm-internal', ''); d.style.cssText = `position:absolute;left:${x}px;top:0;width:0;height:0;pointer-events:none`; host.appendChild(d); return d; };
    b.marks = [mk(0), mk(1000)];
    // When does it fire (video time)? Warn if that is outside the time its element is on screen.
    const c = I.nearestClip(el);
    const T0 = o.global ? o.at : (c ? c.start : 0) + o.at;
    b.t0 = T0;
    if (c && (T0 < c.start - 1e-6 || T0 >= c.end)) I.report('warning', 'burst-outside-clip', `gm.burst on ${I.selectorOf ? I.selectorOf(el) : b.target} fires at ${T0.toFixed(2)}s of the video, but that element is only on screen from ${c.start.toFixed(2)}s to ${c.end.toFixed(2)}s.`, null, '`at` counts from the start of the element\'s scene. For a video time (a beat, a voice word) pass { at: 4.2, global: true }.');
    const px = PX();
    const rnd = I.makeRandom(1 + o.seed * 7919);
    const parts = [];
    let x0 = 0, x1 = 0, y0 = 0, y1 = 0, big = 0;
    const k = o.drag || 1e-6;
    // (edge: the length of that edge, in host px, measured in layout, so it is the same in every worker)
    const edgeLen = edge ? (edge === 'top' || edge === 'bottom' ? el.clientWidth || I.comp.width : el.clientHeight || I.comp.height) : 0;
    let end = 0;
    for (let i = 0; i < o.count; i++) {
      const ang = ((o.angle + (rnd() - 0.5) * o.spread) * Math.PI) / 180;
      const sp = o.speed * px * (0.12 + Math.pow(rnd(), 0.8) * 0.95);
      const p = { vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, rot: rnd() * 6.28, spin: (rnd() - 0.5) * 14, flip: rnd() * 6.28, flipS: 4 + rnd() * 8, size: o.size * px * (0.6 + rnd() * 0.8), color: o.colors[Math.floor(rnd() * o.colors.length)], life: o.duration * (0.7 + rnd() * 0.3), delay: rnd() * (o.stagger || 0.06), wob: rnd() * 6.28 };
      // start offset from the emission point: along the edge (a little past both ends), just outside it
      p.sx = 0; p.sy = 0;
      if (edge) {
        const along = (rnd() * 1.1 - 0.55) * edgeLen, out = -(p.size + 10 * px);
        if (edge === 'top' || edge === 'bottom') { p.sx = along; p.sy = edge === 'top' ? out : -out; } else { p.sy = along; p.sx = edge === 'left' ? out : -out; }
      }
      parts.push(p);
      end = Math.max(end, p.delay + p.life);
      // how far it flies (to size the canvas to the particles, not the whole scene)
      for (let j = 0; j <= 12; j++) {
        const lt = (p.life * j) / 12, e = Math.exp(-k * lt);
        const x = p.sx + (p.vx * (1 - e)) / k, y = p.sy + (p.vy * (1 - e)) / k + ((o.gravity * px) / k) * (lt - (1 - e) / k);
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      big = Math.max(big, p.size);
    }
    const pad = big + 80 * px;
    b.box = { x0: x0 - pad, y0: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
    // sharper in a camera world, which may zoom in (a fixed number: the same in every render worker)
    b.res = worldOf(host) || cameras.some((cm) => cm.world === host) ? 2 : 1;
    cv.width = Math.ceil(b.box.w * b.res); cv.height = Math.ceil(b.box.h * b.res);
    cv.style.cssText = `position:absolute;left:0;top:0;width:${r4(b.box.w)}px;height:${r4(b.box.h)}px;pointer-events:none;z-index:${z}`;
    b.host = host;
    // when the last piece is gone (staggered pieces can outlive `duration`; classic motion keeps the old cut-off)
    b.end = edge || (b.opts.stagger && I.naturalMotion()) ? Math.max(o.duration * 1.05 + 0.1, end + 0.05) : o.duration * 1.05 + 0.1;
    b.canvas = cv; b.o = o; b.parts = parts; b.el = el; b.last = null;
  }
  function burstMap(b) {
    const a = b.marks[0].getBoundingClientRect(), c = b.marks[1].getBoundingClientRect();
    return { ox: a.left, oy: a.top, k: (c.left - a.left) / 1000 || 1 };
  }
  function drawBursts(T) {
    let changed = false;
    for (const b of bursts) {
      if (!b.canvas) continue;
      const t = b.o.global ? T - b.o.at : I.mapT(b.el, T) - I.clipStartOf(b.el) - b.o.at;
      const key = t < 0 || t > b.end ? 'off' : Math.round(t * 1000);
      if (key === b.last) continue;
      const g = b.canvas.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, b.canvas.width, b.canvas.height);
      b.last = key; changed = true;
      const px = PX();
      if (key === 'off') { b.canvas.style.visibility = 'hidden'; continue; }
      b.canvas.style.visibility = '';
      if (b.px0 == null && !b.fromEl) {
        // the emission point x/y of the target's box, in host coordinates. Measured in layout (no transforms: not the
        // camera, not a transition), once the scene is shown, so every render worker gets the same point.
        const lay = (n) => { let x = 0, y = 0; for (let e = n; e; e = e.offsetParent) { x += e.offsetLeft + (e.offsetParent ? e.offsetParent.clientLeft : 0); y += e.offsetTop + (e.offsetParent ? e.offsetParent.clientTop : 0); } return [x, y]; };
        const W = b.el.clientWidth || I.comp.width, H = b.el.clientHeight || I.comp.height;
        const pos = (v, size) => (typeof v === 'string' && v.trim().endsWith('%') ? (parseFloat(v) / 100) * size : (parseFloat(v) || 0) * px); // '50%' of the target, or px at 1080p (12 or '12px')
        const [ex0, ey0] = lay(b.el), [hx, hy] = b.host === b.el ? [ex0, ey0] : lay(b.host);
        b.px0 = ex0 + b.el.clientLeft - hx - b.host.clientLeft + pos(b.o.x, W); b.py0 = ey0 + b.el.clientTop - hy - b.host.clientTop + pos(b.o.y, H);
      }
      let ex = b.px0, ey = b.py0;
      if (b.fromEl) {
        const r = b.fromEl.getBoundingClientRect(), M = burstMap(b);
        ex = (r.left + r.width / 2 - M.ox) / M.k; ey = (r.top + r.height / 2 - M.oy) / M.k;
      }
      const left = ex + b.box.x0, top = ey + b.box.y0;
      b.canvas.style.left = r4(left) + 'px'; b.canvas.style.top = r4(top) + 'px';
      g.setTransform(b.res, 0, 0, b.res, 0, 0);
      const { gravity, drag, shape } = b.o;
      const ox = -b.box.x0, oy = -b.box.y0;
      for (const p of b.parts) {
        const lt = t - p.delay;
        if (lt < 0 || lt > p.life) continue;
        // velocity decays with drag k: x = v(1-e^-kt)/k ; gravity falls at terminal-ish speed
        const e = Math.exp(-drag * lt), k = drag || 1e-6;
        const x = ox + p.sx + (p.vx * (1 - e)) / k + Math.sin(lt * 3 + p.wob) * (shape === 'paper' ? 18 * px * Math.min(1, lt) : 0);
        const y = oy + p.sy + (p.vy * (1 - e)) / k + (gravity * px / k) * (lt - (1 - e) / k);
        const fade = Math.min(1, (p.life - lt) / (p.life * 0.25));
        g.globalAlpha = Math.max(0, fade);
        g.fillStyle = g.strokeStyle = p.color;
        if (shape === 'paper') {
          g.save(); g.translate(x, y); g.rotate(p.rot + p.spin * lt); g.scale(1, Math.cos(p.flip + p.flipS * lt));
          g.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6); g.restore();
        } else if (shape === 'streak') {
          const vx = p.vx * e, vy = p.vy * e + gravity * px * (1 - e) / k;
          const L = Math.min(70 * px, Math.hypot(vx, vy) * 0.045);
          const a = Math.atan2(vy, vx);
          g.lineWidth = p.size * 0.6; g.lineCap = 'round';
          g.beginPath(); g.moveTo(x, y); g.lineTo(x - Math.cos(a) * L, y - Math.sin(a) * L); g.stroke();
        } else if (shape === 'ring') {
          g.lineWidth = Math.max(1, p.size * 0.12); g.beginPath(); g.arc(x, y, p.size / 2, 0, 6.283); g.stroke();
        } else { g.beginPath(); g.arc(x, y, p.size / 2, 0, 6.283); g.fill(); }
      }
      g.globalAlpha = 1;
    }
    return changed;
  }

  // ---------------------------------------------------------------------------
  // data-pulse="[beat|bar|half|<n beats>] [amount] [decay]": scales up on the <html data-bpm> beat grid and falls back
  // (default: every beat, 0.06, 0.25 s). Also sets --beat (1 on the beat → 0) on the element, for your own CSS.
  // ---------------------------------------------------------------------------
  /** @type {any} */
  let pulses = null;
  function updatePulses(T) {
    if (!pulses) {
      pulses = [...document.querySelectorAll('[data-pulse]')].map((el) => {
        const tk = (el.getAttribute('data-pulse') || '').trim().split(/\s+/).filter(Boolean);
        let every = /** @type {number | string} */ (1);
        if (tk[0] && /^[a-z]/i.test(tk[0])) { const w = tk.shift().toLowerCase(); every = w.startsWith('bar') ? 'bar' : w.startsWith('half') ? 0.5 : 1; }
        else if (tk.length === 3) every = parseFloat(tk.shift()) || 1;
        return { el, every, amount: tk[0] != null ? parseFloat(tk[0]) : 0.06, decay: tk[1] != null ? parseFloat(tk[1]) : 0.25, last: null };
      });
      if (pulses.length) pulses.grid = { b0: gm.beat(0), period: gm.beat(1) - gm.beat(0), bar0: gm.bar(0), barLen: gm.bar(1) - gm.bar(0) };
    }
    if (!pulses.length) return false;
    const g = pulses.grid;
    let changed = false;
    for (const p of pulses) {
      const len = p.every === 'bar' ? g.barLen : g.period * p.every, o = p.every === 'bar' ? g.bar0 : g.b0;
      const dt = T - o - Math.floor((T - o) / len + 1e-9) * len;
      const v = T < o - 1e-9 ? 0 : Math.pow(Math.max(0, 1 - dt / Math.max(0.01, p.decay)), 2);
      const key = Math.round(v * 1000);
      if (key === p.last) continue;
      p.last = key; changed = true;
      p.el.style.setProperty('--beat', r4(v));
      if (p.amount) p.el.style.scale = String(r4(1 + p.amount * v));
    }
    return changed;
  }
  function updateCameras(T) { let ch = false; for (const c of cameras) if (c._apply(T)) ch = true; return ch; }

  // ---------------------------------------------------------------------------
  // data-fit: shrink (or grow) text so it fits its box exactly
  // ---------------------------------------------------------------------------
  function setupFit() {
    for (const el of document.querySelectorAll('[data-fit]')) {
      if (el.__gmFit) continue;
      el.__gmFit = true;
      const mode = (el.getAttribute('data-fit') || 'shrink').trim() || 'shrink';
      const cs = getComputedStyle(el);
      const fs0 = parseFloat(cs.fontSize);
      const maxAttr = parseFloat(el.getAttribute('data-fit-max'));
      const boxW = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      // natural width of the content on one line, at the current font size
      const natural = () => {
        const sv = [el.style.width, el.style.whiteSpace, el.style.display];
        el.style.width = 'max-content'; el.style.whiteSpace = 'nowrap'; if (cs.display === 'inline') el.style.display = 'inline-block';
        const w = el.getBoundingClientRect().width / (/** @type {HTMLElement} */ (el).offsetWidth ? el.getBoundingClientRect().width / /** @type {HTMLElement} */ (el).offsetWidth : 1);
        [el.style.width, el.style.whiteSpace, el.style.display] = sv;
        return w - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      };
      if (mode === 'grow' || mode === 'fill') {
        if (!(boxW > 0)) { I.report('warning', 'fit-no-width', 'data-fit="grow" needs a box with a width.', el); continue; }
        let fs = fs0;
        for (let i = 0; i < 4; i++) { const w = natural(); if (!(w > 0)) break; fs = fs * (boxW / w); el.style.fontSize = fs + 'px'; }
        if (isFinite(maxAttr)) el.style.fontSize = Math.min(fs, maxAttr * PX()) + 'px';
        el.style.whiteSpace = 'nowrap';
      } else {
        // shrink until it fits: width always; height only when the box has a fixed height
        const fixedH = el.style.height || (cs.height !== 'auto' && el.parentElement && getComputedStyle(el.parentElement).display !== 'flex' && el.scrollHeight > el.clientHeight + 0.25 * fs0);
        const over = () => el.scrollWidth > el.clientWidth + 1 || (fixedH && el.scrollHeight > el.clientHeight + 0.25 * parseFloat(/** @type {any} */ (el.style.fontSize || fs0)));
        if (!over()) continue;
        let lo = fs0 * 0.15, hi = fs0;
        for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; el.style.fontSize = mid + 'px'; if (over()) hi = mid; else lo = mid; }
        el.style.fontSize = lo + 'px';
      }
    }
  }

  // ---------------------------------------------------------------------------
  // data-scramble="1.2": text decodes from random glyphs, left to right
  // ---------------------------------------------------------------------------
  const scramblers = [];
  function setupScramble() {
    for (const el of document.querySelectorAll('[data-scramble]')) {
      if (el.__gmScr) continue;
      el.__gmScr = true;
      const text = el.textContent;
      const dur = I.parseTime(el.getAttribute('data-scramble'), el, 'data-scramble') || 1;
      const delay = I.parseTime(el.getAttribute('data-scramble-delay'), el, 'data-scramble-delay') || 0;
      const chars = el.getAttribute('data-scramble-chars') || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=?';
      if (getComputedStyle(el).display !== 'inline' && !el.style.minWidth) el.style.minWidth = /** @type {HTMLElement} */ (el).offsetWidth + 'px';
      scramblers.push({ el, text, dur, delay, chars, last: null });
    }
  }
  function hash(a, b) { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35); h ^= h >>> 15; return (h >>> 0) / 4294967296; }
  function updateScramble(T) {
    let changed = false;
    for (const s of scramblers) {
      const t = I.mapT(s.el, T) - I.clipStartOf(s.el) - s.delay;
      const N = s.text.length;
      const tick = Math.floor((t + 10) * 18);
      // before its delay the text is hidden (keeping its layout), like data-type, instead of cycling glyphs early
      const hide = t < 0;
      if (hide !== s.hidden) { if (s.vis0 === undefined) s.vis0 = s.el.style.visibility; s.el.style.visibility = hide ? 'hidden' : s.vis0; s.hidden = hide; changed = true; }
      let out = '';
      for (let i = 0; i < N; i++) {
        const ch = s.text[i];
        if (/\s/.test(ch)) { out += ch; continue; }
        const reveal = (i / Math.max(1, N - 1)) * s.dur * 0.85 + s.dur * 0.15;
        out += t >= reveal || hide ? ch : s.chars[Math.floor(hash(i, tick) * s.chars.length)];
      }
      if (out !== s.last) { s.el.textContent = out; s.last = out; changed = true; }
    }
    return changed;
  }

  // ---------------------------------------------------------------------------
  // Animated images (GIF, animated WebP/PNG/AVIF): browsers play them on their own clock,
  // so we decode the frames and show the right one for the current time.
  // ---------------------------------------------------------------------------
  const animImgs = [];
  async function setupAnimatedImages() {
    if (typeof ImageDecoder === 'undefined') return;
    const imgs = [...document.querySelectorAll('img')].filter((im) => !im.__gmAnim && (im.hasAttribute('data-animated') || /\.(gif|webp|apng|avif)(\?|#|$)/i.test(im.getAttribute('src') || '')));
    await Promise.all(imgs.map(async (im) => {
      im.__gmAnim = true;
      const src = im.getAttribute('src');
      try {
        const res = await fetch(src);
        const type = res.headers.get('content-type') || ({ gif: 'image/gif', webp: 'image/webp', apng: 'image/apng', png: 'image/png', avif: 'image/avif' })[(src.split('?')[0].split('.').pop() || '').toLowerCase()];
        if (!(await ImageDecoder.isTypeSupported(type))) return;
        const dec = new ImageDecoder({ data: res.body, type });
        await dec.tracks.ready;
        await dec.completed;
        const n = dec.tracks.selectedTrack.frameCount;
        if (n <= 1) { dec.close(); return; }
        const frames = [];
        const cv = document.createElement('canvas');
        let total = 0;
        for (let i = 0; i < n; i++) {
          const { image } = await dec.decode({ frameIndex: i });
          cv.width = image.displayWidth; cv.height = image.displayHeight;
          cv.getContext('2d').drawImage(image, 0, 0);
          const d = Math.max(0.02, (image.duration || 100000) / 1e6);
          frames.push({ at: total, url: cv.toDataURL('image/png') });
          total += d;
          image.close();
        }
        dec.close();
        const loop = im.getAttribute('data-loop') !== 'false';
        const rate = parseFloat(im.getAttribute('data-rate') || '1') || 1;
        animImgs.push({ im, frames, total, loop, rate, last: -1 });
        im.src = frames[0].url;
      } catch (e) { I.report('warning', 'animated-image', `Could not decode animated image ${src}: ${e && e.message || e}`, im); }
    }));
  }
  function updateAnimatedImages(T) {
    let changed = false;
    for (const a of animImgs) {
      let t = (I.mapT(a.im, T) - I.clipStartOf(a.im)) * a.rate;
      t = a.loop ? ((t % a.total) + a.total) % a.total : Math.min(Math.max(0, t), a.total - 1e-6);
      let i = 0;
      while (i < a.frames.length - 1 && a.frames[i + 1].at <= t + 1e-9) i++;
      if (i === a.last) continue;
      a.last = i; changed = true;
      a.im.src = a.frames[i].url;
      if (!a.im.complete) I.pendingWaits.push(a.im.decode().catch(() => {}));
    }
    return changed;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => gm.wait(setupAnimatedImages()), { once: true });
  else gm.wait(setupAnimatedImages());

  // ---------------------------------------------------------------------------
  // Fast big blurs. A large CSS blur (soft glow blobs) is very slow to paint at full size.
  // For plain shapes (no children, no text) we paint the blur at 1/k size and scale it up,
  // which looks the same because the result is already very soft. Opt out: data-gm-exact.
  // ---------------------------------------------------------------------------
  // Does the element move on its own (a CSS/WAAPI animation, a timeline tween, a path travel or a camera)?
  function movesByItself(el) {
    try {
      if (el.getAnimations().length || el.hasAttribute('data-camera')) return true;
      if (travels.some((tr) => tr.el === el || (typeof tr.el === 'string' && el.matches(tr.el)))) return true;
      const seen = new Set();
      const walk = (tl) => {
        if (seen.has(tl)) return false;
        seen.add(tl);
        return tl.ops.some((op) => (op.type === 'child' ? walk(op.tl) : op.t != null && op.type !== 'label' && op.type !== 'call' && toArray(op.t, tl.scope).includes(el)));
      };
      return tlList.some(walk);
    } catch (e) { return true; }
  }
  function optimizeBlurs() {
    const els = document.body ? document.body.getElementsByTagName('*') : [];
    for (const el of els) {
      if (el.__gmBlur || el.hasAttribute('data-gm-exact') || el.children.length || (el.textContent || '').trim() || !(el instanceof HTMLElement)) continue;
      const cs = getComputedStyle(el);
      const m = /^blur\(([\d.]+)px\)$/.exec(cs.filter);
      if (!m) continue;
      const r = parseFloat(m[1]);
      if (r < 24) continue;
      const w = el.offsetWidth, h = el.offsetHeight;
      if (!w || !h) continue;
      if (/px/.test(cs.backgroundImage) || cs.boxShadow !== 'none' || cs.backdropFilter !== 'none' || (cs.borderStyle !== 'none' && parseFloat(cs.borderWidth) > 0)) continue;
      // skip if something animates its look (not just transform/opacity)
      let animated = false;
      try { for (const an of /** @type {any[]} */ (el.getAnimations())) { const kf = an.effect && an.effect.getKeyframes ? an.effect.getKeyframes() : []; for (const k of kf) for (const p of Object.keys(k)) if (!/^(offset|easing|composite|computedOffset|transform|translate|rotate|scale|opacity|left|top|right|bottom|offsetDistance|offsetPath)$/.test(p)) animated = true; } } catch (e) {}
      if (animated) continue;
      const moves = movesByItself(el);
      const k = Math.min(8, Math.max(2, Math.floor(r / 10)));
      el.__gmBlur = true;
      // Bake: a small SVG image (shape + blur) is decoded once; moving it later is just copying pixels.
      const sw = w / k, sh = h / k, br = r / k, pad = Math.ceil(br * 3);
      const radius = cs.borderRadius.split(' ').map((v) => (v.endsWith('%') ? v : (parseFloat(v) / k) + 'px')).join(' ');
      const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/"/g, "'").replace(/</g, '&lt;');
      const style = `position:absolute;left:${pad}px;top:${pad}px;width:${sw}px;height:${sh}px;background-color:${cs.backgroundColor};background-image:${cs.backgroundImage};background-size:${cs.backgroundSize};background-position:${cs.backgroundPosition};background-repeat:${cs.backgroundRepeat};border-radius:${radius};filter:blur(${br}px)`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sw + 2 * pad}" height="${sh + 2 * pad}"><foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="${esc(style)}"></div></foreignObject></svg>`;
      // An SVG image would be re-rasterized at full size on every paint, so draw it once into a small
      // canvas: a fixed bitmap, scaled up. A canvas always gets its own composited layer, which suits a blob
      // that moves (moving a layer is cheap). A blob that stays put shows the same bitmap as a plain <img>
      // instead: it is painted once into the layer around it, while a layer would be redrawn pixel by pixel on
      // every frame without a GPU (and would pull everything drawn on top of it into layers too).
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(sw + 2 * pad); cv.height = Math.ceil(sh + 2 * pad);
      const box = `position:absolute;left:${-pad * k}px;top:${-pad * k}px;width:${cv.width * k}px;height:${cv.height * k}px;max-width:none;pointer-events:none;display:block`;
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      const done = img.decode().then(() => {
        cv.getContext('2d').drawImage(img, 0, 0);
        let out = /** @type {any} */ (cv);
        if (!moves) { out = new Image(); out.alt = ''; out.src = cv.toDataURL('image/png'); }
        out.setAttribute('data-gm-internal', '');
        out.style.cssText = box;
        return (out === cv ? Promise.resolve() : out.decode()).then(() => {
          el.style.setProperty('filter', 'none', 'important');
          el.style.setProperty('background', 'transparent', 'important');
          if (cs.position === 'static') el.style.position = 'relative';
          el.style.overflow = 'visible';
          el.appendChild(out);
        });
      }).catch(() => {});
      I.pendingWaits.push(done);
    }
  }

  // ---------------------------------------------------------------------------
  // Hook into the runtime
  // ---------------------------------------------------------------------------
  I.hooks.preinit.push(setupFit);
  I.hooks.init.push(() => { for (const c of cameras) if (c.world && c.shots.some((sh) => sh.fit === 'content' || sh.center === 'content')) { try { c._box('content', c._markers()); } catch (e) {} } });
  I.hooks.init.push(() => { initDone = true; try { optimizeBlurs(); } catch (e) {} for (const tr of travels) if (!tr.done) setupTravel(tr); for (const b of bursts) if (!b.canvas) setupBurst(b); for (const st of streams) if (!st.built) setupStream(st); setupCameras(); setupMorphs(); setupScramble(); for (const tl of tlList) { tl._build(); try { tl._warnLate(); } catch (e) {} } });
  // data-parallax inside camera worlds; (natural) a world with its own opaque background keeps its edge out of view
  I.hooks.init.push(() => {
    for (const c of cameras) {
      try { c._prepInner(); } catch (e) { I.pageError(e); }
      const w = c.world;
      if (!w || !I.naturalMotion() || c.opts.bounds !== undefined) continue;
      const bg = toRGBA(getComputedStyle(w).backgroundColor);
      c.__autoBounds = !!(bg && bg[3] > 0.95);
    }
  });
  // A camera shot that only arrives after its scene has started to leave (or ended) is never seen at rest.
  I.hooks.init.push(() => {
    for (const cm of cameras) {
      const w = cm.world, c = w && I.nearestClip(w);
      if (!c || cm.opts.global || !isFinite(c.end)) continue;
      const out = I.transitions().find((tr) => tr.start > c.start + 1e-6 && tr.start < c.end - 1e-6 && tr.end >= c.end - 0.02);
      const leave = out ? out.start : c.end;
      cm.shots.forEach((sh, i) => {
        if (!i) return;
        const arrive = c.start + sh.at + (sh.duration || 0);
        if (arrive > leave + 1e-6) I.report('warning', 'camera-late', `Camera shot ${i + 1} (at ${sh.at}s) arrives at ${(arrive - c.start).toFixed(2)}s of its scene, but the scene ${out ? 'starts its exit transition' : 'ends'} at ${(leave - c.start).toFixed(2)}s, so it is never seen at rest.`, w, 'Start the shot earlier or make it shorter (a shot arrives at its time + duration), or make the scene longer.');
      });
    }
  });
  // (natural motion) after every other init step, so timelines, travels and charts are built when follow paths are sampled
  I.hooks.init.push(() => I.hooks.init.push(() => { try { prepCameras(); } catch (e) { I.pageError(e); } }));
  I.hooks.rebuild.push(() => { setupCameras(); setupMorphs(); setupScramble(); });
  I.hooks.post.push(updateCameras);
  I.hooks.post.push(updateMorphs);
  I.hooks.post.push(updatePulses);
  I.hooks.seek.push((T) => {
    let changed = updateScramble(T);
    if (animImgs.length && updateAnimatedImages(T)) changed = true;
    if (svgTravels.length && updateSvgTravels(T)) changed = true;
    if (bursts.length && drawBursts(T)) changed = true;
    if (streams.length && updateStreams(T)) changed = true;
    // Elements animated by more than one timeline: merge their values, newest tween wins per property.
    const count = new Map();
    for (const tl of tlList) { tl._resolve(); for (const el of tl.tracks.keys()) count.set(el, (count.get(el) || 0) + 1); }
    const shared = new Set([...count].filter(([, n]) => n > 1).map(([el]) => el));
    const sink = { shared, list: [] };
    for (const tl of tlList) if (tl._apply(T, shared.size ? sink : null)) changed = true;
    if (sink.list.length) {
      const byEl = new Map();
      for (const e of sink.list) { if (!byEl.has(e.tm.el)) byEl.set(e.tm.el, []); byEl.get(e.tm.el).push(e); }
      for (const [el, entries] of byEl) {
        let st = sharedTracks.get(el);
        if (!st) {
          const f = entries[0].tm;
          st = { el, cache: new Map(), tfBase: f.tfBase, cssPrefix: f.cssPrefix, hasTF: false, inline: {} };
          sharedTracks.set(el, st);
        }
        const vals = {}, best = {};
        for (const e of entries) {
          if (e.tm.hasTF) st.hasTF = true;
          if (e.tm.inline) for (const k of Object.keys(e.tm.inline)) if (!(k in st.inline)) st.inline[k] = e.tm.inline[k];
          for (const k of Object.keys(e.vals)) if (!(k in best) || e.prio[k] >= best[k]) { best[k] = e.prio[k]; vals[k] = e.vals[k]; }
        }
        if (write(st, vals)) changed = true;
      }
    }
    return changed;
  });

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  function tween(type, t, a, b) {
    const tl = new Timeline(null, {});
    if (type === 'to') tl.to(t, a, 0); else if (type === 'from') tl.from(t, a, 0); else if (type === 'fromTo') tl.fromTo(t, a, b, 0); else tl.set(t, a, 0);
    return tl;
  }
  // what fit: 'content' measured at load, per camera that uses it (render fingerprints it; null = not measured yet)
  gm.__cameraContent = () => cameras.filter((c) => c.shots.some((sh) => (sh.fit ?? sh.follow ?? sh.center) === 'content')).map((c) => c._contentBox || null);
  // camera shots in video time (inspect lists them; snapshot shows each shot once the camera has arrived)
  gm.__cameraShots = () => cameras.flatMap((c) => {
    const base = c.opts.global || !c.world ? 0 : gm.timing(c.world).start;
    // what each shot shows of the world, in world px (a follow shot: where its target is right now)
    let M = null, view = null;
    try { if (c.world) { M = c._markers(); const p = c.world.offsetParent || c.world.parentElement; view = { w: p.clientWidth || I.comp.width, h: p.clientHeight || I.comp.height }; } } catch (e) {}
    const r1 = (x) => Math.round(x);
    const sts = c.shots.map((s) => { try { return M && c._state(s, M, view); } catch (e) { return null; } });
    const settles = I.naturalMotion() ? c._getPlan().settles : [];
    return c.shots.map((s, i) => {
      let shows = null;
      const st = sts[i];
      if (st) { const w = view.w / st.zoom, h = view.h / st.zoom; shows = { x: r1(st.cx - w / 2), y: r1(st.cy - h / 2), w: r1(w), h: r1(h), zoom: Math.round(st.zoom * 1000) / 1000 }; }
      // natural motion: a fast zoom that settles back after a slight overshoot is at rest a moment later
      const o = settles.find((x) => x.k === i), a = o && sts[o.from];
      const settle = o && st && a && Math.abs(Math.log(st.zoom / a.zoom)) / o.dur >= 0.6 ? o.S : 0;
      return { world: c.world ? gm.__selector(c.world) : String(c.spec), start: base + s.at, arrive: base + s.at + (i ? s.duration || 0 : 0) + settle, next: c.shots[i + 1] ? base + c.shots[i + 1].at : null, shows };
    });
  });
  // what the current shot of each camera frames (its fit/follow target), in screen px; for check
  gm.__cameraFocus = () => /** @type {any} */ (cameras).flatMap((c) => {
    const sh = c._cur, target = sh && (sh.fit ?? sh.follow ?? sh.center);
    if (!c.world || !c.world.isConnected || c.world.closest('[data-gm-hidden]')) return [];
    if (sh && sh.overview) return [{ world: c.world, overview: true }]; // a wide shot of everything on purpose: small text is fine
    if (target == null || target === 'all' || target === 'content') return [];
    try { const M = c._markers(), b = c._box(target, M); return b ? [{ world: c.world, l: M.ox + b.x * M.k, t: M.oy + b.y * M.k, r: M.ox + (b.x + b.w) * M.k, b: M.oy + (b.y + b.h) * M.k }] : []; } catch (e) { return []; }
  });
  Object.assign(gm, {
    timeline: (scope, opts) => new Timeline(scope, opts),
    camera: (world, opts) => new Camera(world, opts),
    burst,
    to: (t, v) => tween('to', t, v),
    from: (t, v) => tween('from', t, v),
    fromTo: (t, a, b) => tween('fromTo', t, a, b),
    set: (t, v) => tween('set', t, v),
    // gm.fly('#event', { from: '#slot', at: 7.5, duration: 0.8 }): at = seconds in the element's own clip
    fly: (t, v) => { const o = Object.assign({}, v || {}), at = o.at || 0; delete o.at; return new Timeline(null, {}).fly(t, o, at); },
    color: { mix: mixColor, parse: toRGBA },
    path: { point: pointAt, length: (d) => pathInfo(d).len, morph: morphInterp, interpolate: morphInterp, travel, stream },
    shape,
    mapRange: (v, a, b, c, d, clamp = true) => { let p = (v - a) / (b - a); if (clamp) p = Math.max(0, Math.min(1, p)); return c + (d - c) * p; },
    snap: (v, step) => Math.round(v / step) * step,
    wrap: (v, a, b) => a + ((((v - a) % (b - a)) + (b - a)) % (b - a)),
    pick: (arr, seed = 1) => arr[Math.floor(I.makeRandom(seed)() * arr.length)],
  });
  // interpolate() now mixes any CSS color in OKLab
  I.setColorMixer(mixColor);
  // (for check) which elements gm.timeline moves with transform properties (x, y, scale, rotate…), and which ones
  gm.__tweenedTransforms = () => {
    const out = [];
    for (const tl of tlList) {
      try { tl._resolve(); } catch (e) { continue; }
      for (const [el, tm] of tl.tracks || []) { if (!(el instanceof Element)) continue; const props = [...tm.props.keys()].filter((k) => k in TF); if (props.length) out.push({ el, props }); }
    }
    return out;
  };
})();
