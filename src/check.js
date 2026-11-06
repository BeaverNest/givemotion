// `check` and `snapshot`: let an AI (or a human) see problems without watching the video.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import { openComposition, openWorker } from './render.js';
import { reserve, browserMB } from './machine.js';

/** @typedef {import('./types/api.js').Input} Input */

/** If neither <html> nor <body> paints a background, treat the composition as an overlay (alpha). */
async function autoTransparent(ctx, opts) {
  if (opts.transparent) return true;
  const clear = await ctx.page.evaluate(`(() => { const t = (e) => { const c = getComputedStyle(e); return c.backgroundImage === 'none' && /rgba\\(0, 0, 0, 0\\)|transparent/.test(c.backgroundColor); }; return t(document.documentElement) && t(document.body); })()`);
  if (clear) await ctx.page.s('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  return clear;
}

// ---------------------------------------------------------------------------
// Page-side analysis (stringified and evaluated in the composition page)
// ---------------------------------------------------------------------------
const PAGE_ANALYZE = String.raw`((dt, opt) => {
  const W = gm.width, H = gm.height, PX = gm.px;
  // Safe zone for vertical social video (app buttons and titles cover the edges), in px at 1080p
  const ZONES = { shorts: [220, 60, 380, 60], reels: [220, 60, 380, 60], tiktok: [220, 120, 380, 60] };
  const zname = (opt && opt.safeZone) || document.documentElement.getAttribute('data-safe-zone');
  let zone = null;
  if (zname && zname !== 'none' && zname !== 'off') { const z = ZONES[zname] || String(zname).split(/[\s,]+/).map(Number); if (z.length === 4 && z.every((v) => isFinite(v))) zone = { left: z[3] * PX, top: z[0] * PX, right: W - z[1] * PX, bottom: H - z[2] * PX, name: ZONES[zname] ? zname : 'custom' }; }
  const out = [];
  const ignored = (el) => !!el.closest('[data-check~="ignore"],[aria-hidden="true"],[data-gm-internal]');
  // data-check="overlap-ok": text in there may overlap, be covered or be crossed on purpose (a pile of cards)
  const overlapOk = (el) => !!(el && el.closest && el.closest('[data-check~="overlap-ok"]'));
  // A font that is neither loaded (an @font-face, a bundled font) nor installed here is drawn in a fallback that differs
  // from one computer to the next. The first family of the stack is the one that was meant.
  const GENERIC_FONT = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[a-z-]+|emoji|math|fangsong|inherit|initial|unset)$/i;
  const fontSeen = window.__gmFontSeen || (window.__gmFontSeen = new Map());
  const warnedFonts = new Set();
  let fontCtx = null;
  const missingFont = (family) => {
    const first = family.split(',')[0].trim().replace(/^["']|["']$/g, '');
    if (!first || GENERIC_FONT.test(first)) return null;
    if (!fontSeen.has(first)) {
      const faces = [...document.fonts].filter((f) => f.family.replace(/^["']|["']$/g, '').toLowerCase() === first.toLowerCase());
      let missing;
      if (faces.length) missing = faces.every((f) => f.status === 'error');
      else {
        fontCtx = fontCtx || document.createElement('canvas').getContext('2d');
        const w = (f) => { fontCtx.font = '72px ' + f; return fontCtx.measureText('mmmmmmmmmmlli1WwQ@#').width; };
        missing = ['monospace', 'serif', 'sans-serif'].every((g) => w('"' + first + '", ' + g) === w(g));
      }
      fontSeen.set(first, missing);
    }
    return fontSeen.get(first) ? first : null;
  };
  // Characters the text's own font does not have: the browser draws each one from another font (a "₂" or a "→" in a
  // different face, weight and width). Measured like missingFont: the same character with two different fallbacks
  // only differs when the font itself lacks it. Emoji (meant to come from the system's emoji font) are left out.
  const glyphSeen = new Map();
  const missingGlyphs = (family, text) => {
    const first = family.split(',')[0].trim().replace(/^["']|["']$/g, '');
    if (!first || GENERIC_FONT.test(first) || missingFont(family)) return [];
    fontCtx = fontCtx || document.createElement('canvas').getContext('2d');
    const out = [];
    for (const ch of new Set(Array.from(text))) {
      if (/\s|[\u200B-\u200D\uFEFF]|\p{Extended_Pictographic}|\p{Emoji_Modifier}|[\uFE0E\uFE0F]/u.test(ch)) continue;
      const k = first + '|' + ch;
      if (!glyphSeen.has(k)) {
        const w = (f) => { fontCtx.font = '72px ' + f; return fontCtx.measureText(ch).width; };
        glyphSeen.set(k, w('"' + first + '", monospace') !== w('"' + first + '", serif'));
      }
      if (glyphSeen.get(k)) out.push(ch);
    }
    return out;
  };
  const warnedGlyphs = new Set();
  // Alpha of a computed CSS color (rgb(), rgba(), color(srgb … / a), oklch(… / a)…); 'transparent' is 0.
  const cssAlpha = (c) => {
    if (!c || c === 'none' || c === 'transparent') return 0;
    const m = /\(([^)]*)\)/.exec(c);
    if (!m) return 1;
    let a = null;
    if (/^rgba?\(/.test(c) && m[1].includes(',')) a = m[1].split(',')[3];
    else if (m[1].includes('/')) a = m[1].split('/')[1];
    if (a == null) return 1;
    a = a.trim();
    return a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a);
  };
  // Does a background paint (nearly) opaque? A gradient counts when all its stops are opaque, or, for a radial
  // scrim drawn behind something (a pseudo-element), when its middle is.
  const bgSolid = (cs, radialMiddle) => {
    if (cssAlpha(cs.backgroundColor) >= 0.85) return true;
    const bi = cs.backgroundImage;
    if (!bi || bi === 'none') return false;
    if (/url\(/.test(bi)) return true;
    const stops = [...bi.matchAll(/(rgba?|color|oklch|oklab|lab|lch|hsla?)\([^()]*\)|transparent/g)].map((s) => cssAlpha(s[0]));
    if (!stops.length) return false;
    return radialMiddle && /^radial-gradient/.test(bi) ? stops[0] >= 0.85 : Math.min(...stops) >= 0.85;
  };
  const isTextEl = (el) => {
    // Emoji-only text is a picture, not reading text.
    for (const n of el.childNodes) if (n.nodeType === 3 && n.data.trim() && !/^[\s\p{Extended_Pictographic}‍️⃣]+$/u.test(n.data)) return true;
    return false;
  };
  const visible = (el) => {
    let cur = el, op = 1;
    while (cur && cur.nodeType === 1) {
      const cs = getComputedStyle(cur);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return 0;
      op *= parseFloat(cs.opacity);
      // fades the runtime adds as filter: opacity() (a morph's old scene, a morph pair handing over)
      if (cs.filter !== 'none' && cs.filter.includes('opacity(')) for (const m of cs.filter.matchAll(/opacity\(([\d.]+)(%?)\)/g)) op *= parseFloat(m[1]) / (m[2] ? 100 : 1);
      if (op < 0.04) return 0;
      cur = cur.parentElement;
    }
    return op;
  };
  const textRects = (el) => {
    const rects = [];
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.data.trim()) continue;
      const r = document.createRange(); r.selectNodeContents(n);
      for (const q of r.getClientRects()) if (q.width > 0.5 && q.height > 0.5) rects.push(q);
    }
    return rects;
  };
  const union = (rs) => rs.reduce((a, r) => a ? { left: Math.min(a.left, r.left), top: Math.min(a.top, r.top), right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom) } : { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, null);
  const sel = (el) => gm.__selector(el);
  // Glyph boxes are taller than the visible letters; shrink them for clip/overlap tests.
  const tight = (r) => { const h = r.bottom - r.top; return { left: r.left, right: r.right, top: r.top + h * 0.2, bottom: r.bottom - h * 0.22, width: r.right - r.left, height: h * 0.58 }; };
  const area = (r) => Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);
  const inter = (a, b) => ({ left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) });
  // 1. Short animations (entrances, exits, transitions) mean "moving". Camera moves and long
  //    looping/ambient animations do not: they would hide every problem.
  const animating = new Set();
  for (const a of document.getAnimations()) {
    try {
      if (a.__gmCamera) continue;
      const ct = a.effect.getComputedTiming();
      const lt = ct.localTime, d = ct.delay || 0, ad = ct.activeDuration;
      if (ct.progress != null && lt > d && lt < d + ad && isFinite(ad) && ad <= 2500) animating.add(a.effect.target);
    } catch (e) {}
  }
  const inAnim = (el) => { for (let c = el; c; c = c.parentElement) if (animating.has(c)) return true; return false; };
  const transitioning = [...animating].some((m) => m && m.parentElement && m.parentElement.hasAttribute('data-sequence'));
  // 2. Motion from any code (timeline, React, onFrame): compare with the previous sample.
  const prev = window.__gmPrevBoxes || new Map();
  const next = new Map();
  const snippet = (el) => (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const texts = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('[data-gm-hidden]') || ignored(el)) continue;
    if (!isTextEl(el)) continue;
    const op = visible(el);
    if (!op) continue;
    const rs = textRects(el);
    if (!rs.length) continue;
    const u = union(rs);
    // Measure motion inside the biggest moving layer around the text (a camera world, a scene with
    // a camera move): text that sits still in a world the camera pans over is not "moving".
    let cam = null;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      if (a.offsetWidth * a.offsetHeight >= 0.4 * W * H && getComputedStyle(a).transform !== 'none') cam = a;
    }
    let bx = (u.left + u.right) / 2, by = (u.top + u.bottom) / 2, k = 1;
    if (cam) { const r = cam.getBoundingClientRect(); k = r.width / (cam.offsetWidth || r.width) || 1; bx = (bx - r.left) / k; by = (by - r.top) / k; }
    const box = { cx: bx, cy: by, k, w: (u.right - u.left) / k, h: (u.bottom - u.top) / k, op, cam, sx: (u.left + u.right) / 2, sy: (u.top + u.bottom) / 2, sw: u.right - u.left };
    next.set(el, box);
    const p = prev.get(el);
    let speedMoving = false, cv = 0;
    if (p && dt > 0) {
      if (p.cam === box.cam) {
        const v = cv = (Math.hypot(box.cx - p.cx, box.cy - p.cy) * box.k) / dt;
        const sz = Math.abs(box.w - p.w) / Math.max(1, p.w) / dt + Math.abs(box.h - p.h) / Math.max(1, p.h) / dt;
        const fo = Math.abs(box.op - p.op) / dt;
        speedMoving = v > 40 * PX || sz > 0.25 || fo > 0.4;
      }
      // Fast on screen is moving too, whatever carries it (a full-frame panel pushed in, a fast camera move):
      // only slow drifts of a big layer count as "still".
      const sv = Math.hypot(box.sx - p.sx, box.sy - p.sy) / dt, ssz = Math.abs(Math.log(Math.max(1, box.sw) / Math.max(1, p.sw))) / dt;
      if (sv > 600 * PX || ssz > 0.5) speedMoving = true;
    }
    texts.push({ el, rs, u, op, cam, moving: inAnim(el) || speedMoving, fading: !!(p && Math.abs(box.op - p.op) > 0.02),
      cv: p && p.cam === box.cam ? cv : p && dt > 0 ? Math.hypot(box.sx - p.sx, box.sy - p.sy) / dt : 0, sv: p && dt > 0 ? Math.hypot(box.sx - p.sx, box.sy - p.sy) / dt : 0, ssz: p && dt > 0 ? Math.abs(Math.log(Math.max(1, box.sw) / Math.max(1, p.sw))) / dt : 0, fo: p && dt > 0 ? Math.abs(box.op - p.op) / dt : 0 });
  }
  window.__gmPrevBoxes = next;
  // Big transformed layers around text (hand-made cameras: a zoomed or panned stage, data-camera on a scene): which
  // of them move fast right now (like a gm.camera world between shots), compared with the previous sample.
  const prevLayer = window.__gmPrevLayers || new Map(), nextLayer = new Map(), layerMoving = new Set();
  for (const t of texts) {
    const c = t.cam;
    if (!c || nextLayer.has(c)) continue;
    const r = c.getBoundingClientRect(), b = { x: r.left, y: r.top, s: r.width / (c.offsetWidth || r.width || 1) };
    nextLayer.set(c, b);
    const p = prevLayer.get(c);
    if (p && dt > 0 && (Math.hypot(b.x - p.x, b.y - p.y) / dt > 60 * PX || Math.abs(Math.log(b.s / p.s)) / dt > 0.03)) layerMoving.add(c);
  }
  window.__gmPrevLayers = nextLayer;
  // Text cut by the frame edge inside such a layer: is the transform the cause? (A world bigger than the frame is
  // panned on purpose; otherwise the text must fit in the frame with the layer's transform undone.)
  const camCropOf = (t, tu) => {
    const c = t.cam;
    if (!c) return null;
    const res = { cam: c, moving: layerMoving.has(c) };
    if (c.offsetWidth > 1.1 * W || c.offsetHeight > 1.1 * H) return res;
    const cs = getComputedStyle(c);
    let M;
    try { M = new DOMMatrix(cs.transform); } catch (e) { return res; }
    if (!M.is2D || Math.abs(M.b) > 1e-3 || Math.abs(M.c) > 1e-3 || M.a <= 0 || M.d <= 0) return res; // rotated or 3D: cannot tell, lenient
    const [ox, oy] = cs.transformOrigin.split(' ').map(parseFloat);
    const r = c.getBoundingClientRect();
    // screen = L + o + M(p - o): the layer's untransformed top-left L, then a screen point back to layout
    const Lx = r.left - ox + M.a * ox - M.e, Ly = r.top - oy + M.d * oy - M.f;
    const bx = (x) => Lx + ox + (x - Lx - ox - M.e) / M.a, by = (y) => Ly + oy + (y - Ly - oy - M.f) / M.d;
    const fits = bx(tu.left) >= -2 && by(tu.top) >= -2 && bx(tu.right) <= W + 2 && by(tu.bottom) <= H + 2;
    return fits ? res : null;
  };
  // An ellipsis (text-overflow, line-clamp) on the text or a parent up to the clipping box: cut on purpose.
  const ellipsized = (el, box) => {
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.textOverflow && cs.textOverflow !== 'clip' || cs.webkitLineClamp && cs.webkitLineClamp !== 'none') return true;
      if (a === box) break;
    }
    return false;
  };
  // Is a camera world moving right now? Labels the camera passes over on its way to the next shot are not framing mistakes.
  const focus = (window.gm && gm.__cameraFocus) ? gm.__cameraFocus() : [];
  const prevCam = window.__gmPrevCam || new Map(), nextCam = new Map(), camMoving = new Set();
  for (const wEl of document.querySelectorAll('[data-gm-camera-world]')) {
    const r = wEl.getBoundingClientRect(), c = { x: r.left, y: r.top, s: r.width / (wEl.offsetWidth || r.width || 1) };
    nextCam.set(wEl, c);
    const p = prevCam.get(wEl);
    if (p && dt > 0 && (Math.hypot(c.x - p.x, c.y - p.y) / dt > 60 * PX || Math.abs(Math.log(c.s / p.s)) / dt > 0.03)) camMoving.add(wEl);
  }
  window.__gmPrevCam = nextCam;
  // A gradient mask (a world that fades out at its edges, a vignette): how opaque it is at a point of the screen, as
  // a function (x, y) → 0..1, or null when check cannot tell (an image, a luminance mask, a sized or placed mask, a
  // composite other than add): such a mask counts as fully shown, as before. Linear and radial gradients, in the
  // masked element's own border box (a scale or translate of it is followed; a rotation is not).
  const splitTop = (s) => { const a = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; else if (ch === ')') d--; if (ch === ',' && d === 0) { a.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) a.push(cur.trim()); return a; };
  const lenOf = (s, full) => { s = String(s).trim(); if (s.endsWith('%')) return parseFloat(s) / 100 * full; if (s.endsWith('px')) return parseFloat(s); return parseFloat(s) === 0 ? 0 : NaN; };
  const COLOR_RE = /^((?:rgba?|color|oklch|oklab|lab|lch|hsla?|hwb)\([^()]*\)|transparent|currentcolor|[a-z]+)(?:\s+(.*))?$/i;
  // color stops along a gradient line of length L → alpha at a distance along it
  const stopsFn = (parts, L) => {
    const st = [];
    for (const p of parts) {
      const cm = /^[\d.-]/.test(p) ? null : COLOR_RE.exec(p);
      if (cm) {
        const pos = cm[2] ? cm[2].trim().split(/\s+/).map((x) => lenOf(x, L)) : [];
        if (pos.some((x) => !isFinite(x))) return null;
        const a = cssAlpha(cm[1]);
        if (!pos.length) st.push({ a, p: null }); else for (const q of pos) st.push({ a, p: q });
      } else { const h = lenOf(p, L); if (!isFinite(h)) return null; st.push({ a: null, p: h }); } // a color hint
    }
    if (st.length < 2 || st[0].a == null || st[st.length - 1].a == null) return null;
    if (st[0].p == null) st[0].p = 0;
    if (st[st.length - 1].p == null) st[st.length - 1].p = L;
    for (let i = 1; i < st.length; i++) if (st[i].p != null) st[i].p = Math.max(st[i].p, st[i - 1].p ?? -Infinity);
    for (let i = 1; i < st.length; i++) if (st[i].p == null) { let j = i; while (st[j].p == null) j++; const p0 = st[i - 1].p; for (let k = i; k < j; k++) st[k].p = p0 + (st[j].p - p0) * (k - i + 1) / (j - i + 1); }
    // a color hint: the halfway color sits at the hint, the curve on each side is a power curve
    for (let i = st.length - 2; i > 0; i--) if (st[i].a == null) {
      const A = st[i - 1], B = st[i + 1], span = B.p - A.p, hh = span > 0 ? (st[i].p - A.p) / span : 0.5;
      const sub = [];
      for (let k = 1; k < 24; k++) { const x = k / 24, e = hh <= 0 ? 1 : hh >= 1 ? 0 : Math.pow(x, Math.log(0.5) / Math.log(hh)); sub.push({ a: A.a + (B.a - A.a) * e, p: A.p + span * x }); }
      st.splice(i, 1, ...sub);
    }
    return (d) => {
      if (d <= st[0].p) return st[0].a;
      for (let i = 1; i < st.length; i++) if (d <= st[i].p) { const s = st[i].p - st[i - 1].p; return s > 0 ? st[i - 1].a + (st[i].a - st[i - 1].a) * (d - st[i - 1].p) / s : st[i].a; }
      return st[st.length - 1].a;
    };
  };
  const gradientFn = (layer, w, h) => {
    const g = /^(linear|radial)-gradient\((.*)\)$/s.exec(layer);
    if (!g) return null;
    const parts = splitTop(g[2]);
    if (g[1] === 'linear') {
      let ang = Math.PI, m;
      if ((m = /^(-?[\d.]+)(deg|rad|turn|grad)$/.exec(parts[0]))) { const v = +m[1]; ang = m[2] === 'deg' ? v * Math.PI / 180 : m[2] === 'rad' ? v : m[2] === 'turn' ? v * 2 * Math.PI : v * Math.PI / 200; parts.shift(); }
      else if (/^to\s/.test(parts[0])) { const k = parts.shift().slice(3).trim().split(/\s+/); const sx = k.includes('right') ? 1 : k.includes('left') ? -1 : 0, sy = k.includes('bottom') ? 1 : k.includes('top') ? -1 : 0; ang = Math.atan2(sx * h, -sy * w); }
      const dx = Math.sin(ang), dy = -Math.cos(ang), L = Math.abs(w * dx) + Math.abs(h * dy), f = stopsFn(parts, L);
      return f && ((x, y) => f((x - w / 2) * dx + (y - h / 2) * dy + L / 2));
    }
    // radial: [circle|ellipse] [size] [at x y]
    let shape = 'ellipse', size = 'farthest-corner', cx = w / 2, cy = h / 2;
    if (!COLOR_RE.test(parts[0]) || /^(circle|ellipse|closest|farthest|at)\b/.test(parts[0])) {
      const [a, b] = parts.shift().split(/\s*\bat\b\s*/);
      const k = (a || '').trim().split(/\s+/).filter(Boolean);
      if (k.includes('circle')) shape = 'circle';
      const sz = k.filter((x) => x !== 'circle' && x !== 'ellipse');
      if (sz.length === 1 && /^(closest|farthest)-(side|corner)$/.test(sz[0])) size = sz[0];
      else if (sz.length) size = sz;
      if (b) {
        const KW = { left: 0, top: 0, center: 0.5, right: 1, bottom: 1 }, q = b.trim().split(/\s+/);
        const pos = (s, full) => (s in KW ? KW[s] * full : lenOf(s, full));
        if (q.length === 1) { if (q[0] === 'top' || q[0] === 'bottom') cy = pos(q[0], h); else cx = pos(q[0], w); }
        else if (q.length === 2) { const swap = q[0] === 'top' || q[0] === 'bottom' || q[1] === 'left' || q[1] === 'right'; cx = pos(swap ? q[1] : q[0], w); cy = pos(swap ? q[0] : q[1], h); }
        else return null;
        if (!isFinite(cx) || !isFinite(cy)) return null;
      }
    }
    const sides = [cx, w - cx, cy, h - cy].map(Math.abs), corners = [[cx, cy], [w - cx, cy], [cx, h - cy], [w - cx, h - cy]].map(([a, b]) => [Math.abs(a), Math.abs(b)]);
    let rx, ry;
    if (Array.isArray(size)) {
      rx = lenOf(size[0], w); ry = shape === 'circle' ? rx : lenOf(size[1] ?? size[0], h);
      if (!isFinite(rx) || !isFinite(ry)) return null;
    } else {
      const far = /farthest/.test(size), pick = (arr) => (far ? Math.max(...arr) : Math.min(...arr));
      if (shape === 'circle') rx = ry = /side/.test(size) ? pick(sides) : pick(corners.map(([a, b]) => Math.hypot(a, b)));
      else {
        const sx = pick(sides.slice(0, 2)), sy = pick(sides.slice(2));
        if (/side/.test(size)) { rx = sx; ry = sy; }
        else { const c = corners.reduce((best, cn) => (far ? Math.hypot(...cn) > Math.hypot(...best) : Math.hypot(...cn) < Math.hypot(...best)) ? cn : best); const kk = sy / Math.max(1e-6, sx); rx = Math.hypot(c[0], c[1] / Math.max(1e-6, kk)); ry = rx * kk; }
      }
    }
    if (!(rx > 0) || !(ry > 0)) return null;
    const f = stopsFn(parts, rx);
    return f && ((x, y) => f(Math.hypot((x - cx) / rx, (y - cy) / ry) * rx));
  };
  const maskFnOf = (anc, acs) => {
    const img = acs.maskImage && acs.maskImage !== 'none' ? acs.maskImage : acs.webkitMaskImage;
    if (!(anc instanceof HTMLElement) || !anc.offsetWidth || !anc.offsetHeight) return null;
    const layers = splitTop(img), n = layers.length;
    const each = (v, ok) => splitTop(v || '').every((x) => ok.test(x));
    if (!each(acs.maskSize, /^auto( auto)?$/) || !each(acs.maskPosition, /^0(%|px)? 0(%|px)?$/) || !each(acs.maskComposite, /^add$/) || !each(acs.maskMode, /^(match-source|alpha)$/) || !each(acs.maskOrigin, /^border-box$/)) return null;
    const w = anc.offsetWidth, h = anc.offsetHeight, fns = layers.map((l) => gradientFn(l, w, h));
    if (!n || fns.some((f) => !f)) return null;
    const b = anc.getBoundingClientRect(), kx = b.width / w, ky = b.height / h;
    if (!(kx > 0) || !(ky > 0)) return null;
    return (x, y) => { const lx = (x - b.left) / kx, ly = (y - b.top) / ky; if (lx < 0 || ly < 0 || lx > w || ly > h) return 0; let none = 1; for (const f of fns) none *= 1 - Math.max(0, Math.min(1, f(lx, ly))); return 1 - none; };
  };
  // Visible part of the text: inside the frame and inside every clipping ancestor (overflow or clip-path inset).
  const clipBoxOf = (el) => {
    let r = { left: -1e9, top: -1e9, right: 1e9, bottom: 1e9 }, by = null, masked = false;
    const masks = [];
    for (let anc = el; anc && anc !== document.body; anc = anc.parentElement) {
      const acs = getComputedStyle(anc);
      if (acs.maskImage && acs.maskImage !== 'none' || acs.webkitMaskImage && acs.webkitMaskImage !== 'none') { masked = true; const mf = maskFnOf(anc, acs); if (mf) masks.push(mf); }
      if (acs.clipPath && acs.clipPath !== 'none') {
        const m = /inset\(([^)]*)\)/.exec(acs.clipPath);
        if (m) {
          const b = anc.getBoundingClientRect();
          const v = m[1].replace(/round.*/, '').trim().split(/\s+/).map((x) => ({ n: parseFloat(x) || 0, pct: x.endsWith('%') }));
          const [t0, r0 = t0, b0 = t0, l0 = r0] = v;
          const f = (x, size) => (x.pct ? (x.n / 100) * size : x.n);
          const box = { left: b.left + f(l0, b.width), top: b.top + f(t0, b.height), right: b.right - f(r0, b.width), bottom: b.bottom - f(b0, b.height) };
          r = inter(r, box);
        } else masked = true;
      }
      if (/(hidden|clip)/.test(acs.overflowX + acs.overflowY) && !anc.classList.contains('scene') && anc.getAttribute('data-sequence') == null) {
        const b = anc.getBoundingClientRect();
        if (b.width > 0 && b.height > 0) { const n = inter(r, b); if (area(n) < area(r) - 1 && !by) by = anc; r = n; }
      }
    }
    return { r, by, masked, masks };
  };
  // Is the text covered by something drawn on top of it (another layer, a wipe, an iris)?
  const paintsSolid = (c) => {
    // Does this element itself paint an opaque surface at that point? Big see-through layers
    // (a full-frame chart <svg>, a particle <canvas>, a gradient vignette) do not count.
    const r = c.getBoundingClientRect();
    const big = r.width * r.height > 0.5 * W * H;
    const tag = c.tagName.toLowerCase();
    if (tag === 'img' || tag === 'video') return !big;
    if (tag === 'canvas') return !big;
    if (/^(path|rect|circle|ellipse|polygon)$/.test(tag)) {
      const cs = getComputedStyle(c);
      const fillOk = cs.fill !== 'none' && !/rgba\([^)]*,\s*0(\.[0-5]\d*)?\)/.test(cs.fill) && parseFloat(cs.fillOpacity) > 0.6;
      // a thick stroke (a needle, an arrow, a chart line) also hides what is under it
      const strokeOk = cs.stroke !== 'none' && !/rgba\([^)]*,\s*0(\.[0-5]\d*)?\)/.test(cs.stroke) && parseFloat(cs.strokeOpacity) > 0.6 && parseFloat(cs.strokeWidth) >= 3;
      if (!fillOk && !strokeOk) return false;
      let op = 1; for (let a = c; a && a.nodeType === 1; a = a.parentElement) op *= parseFloat(getComputedStyle(a).opacity);
      return op > 0.6;
    }
    if (c instanceof SVGElement) return false;
    const cs2 = getComputedStyle(c);
    const m = /rgba?\(([^)]+)\)/.exec(cs2.backgroundColor);
    const alpha = m ? (m[1].split(',')[3] != null ? parseFloat(m[1].split(',')[3]) : 1) : 0;
    let solid = alpha > 0.6;
    // A gradient counts only if it has no see-through stops (a shine or a glow is see-through).
    if (!solid && cs2.backgroundImage !== 'none' && !big) solid = !/transparent|rgba\([^)]*,\s*0?\.[0-5]\d*\)|rgba\([^)]*,\s*0\)/.test(cs2.backgroundImage);
    if (!solid) return false;
    // faded-out things do not hide what is under them
    let op = 1; for (let a = c; a && a.nodeType === 1; a = a.parentElement) op *= parseFloat(getComputedStyle(a).opacity);
    return op > 0.6;
  };
  // How much of the text is under something solid drawn on top of it (a wipe, a card, a needle)?
  const coverOf = (t) => {
    if (getComputedStyle(t.el).pointerEvents === 'none') return { n: 0, hits: 0, by: null };
    let hits = 0, n = 0, by = null;
    const probe = (x, y) => {
      if (x < 0 || y < 0 || x > W || y > H) return;
      n++;
      // Walk down the stack of things at that point until we reach the text.
      for (const c of document.elementsFromPoint(x, y)) {
        if (c === t.el || c.contains(t.el) || t.el.contains(c)) break;
        if (paintsSolid(c)) { hits++; by = by || c; break; }
      }
    };
    for (const q of t.rs.slice(0, 3)) for (const fx of [0.15, 0.5, 0.85]) probe(q.left + (q.right - q.left) * fx, (q.top + q.bottom) / 2);
    // covered all along the middle: also look above and below it (a caption band over the lower half of a label)
    // (and when the top or bottom edge of the letters is under something, that whole row: a band over half a label)
    const all = n > 0 && hits === n;
    for (const q of t.rs.slice(0, 3)) {
      const tq = tight(q);
      for (const fy of [0.15, 0.85]) {
        const y = tq.top + (tq.bottom - tq.top) * fy, h0 = hits;
        probe(q.left + (q.right - q.left) * 0.5, y);
        if (all || hits > h0) { probe(q.left + (q.right - q.left) * 0.15, y); probe(q.left + (q.right - q.left) * 0.85, y); }
      }
    }
    return { n, hits, by };
  };
  // clip-path shapes on the text and its ancestors (inset, polygon, circle, ellipse): a point test, or null when
  // nothing clips it. (Two scenes clipped to opposite sides of a hand-made wipe never share a pixel.)
  const clipFns = new Map();
  const clipFn = (el) => {
    if (clipFns.has(el)) return clipFns.get(el);
    const tests = [];
    for (let anc = el; anc && anc !== document.body; anc = anc.parentElement) {
      const cp = getComputedStyle(anc).clipPath;
      if (!cp || cp === 'none') continue;
      const m = /^(inset|polygon|circle|ellipse)\((.*)\)/.exec(cp.trim());
      if (!m) continue;
      const b = anc.getBoundingClientRect(), ow = anc.offsetWidth || b.width, oh = anc.offsetHeight || b.height;
      const kx = ow ? b.width / ow : 1, ky = oh ? b.height / oh : 1;
      const len = (v, size) => (/%$/.test(v) ? (parseFloat(v) / 100) * size : parseFloat(v) || 0);
      const args = m[2].replace(/\s+round\s.*$/, '');
      if (m[1] === 'inset') {
        const v = args.trim().split(/\s+/), [t0, r0 = t0, b0 = t0, l0 = r0] = v;
        const L = b.left + len(l0, ow) * kx, T = b.top + len(t0, oh) * ky, R = b.right - len(r0, ow) * kx, B = b.bottom - len(b0, oh) * ky;
        tests.push((x, y) => x >= L && x <= R && y >= T && y <= B);
      } else if (m[1] === 'polygon') {
        const pts = args.replace(/^\s*(nonzero|evenodd)\s*,/, '').split(',').map((p) => { const [px, py] = p.trim().split(/\s+/); return [b.left + len(px, ow) * kx, b.top + len(py, oh) * ky]; });
        tests.push((x, y) => { let inside = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; } return inside; });
      } else {
        const [rad, at] = args.split(/\s+at\s+/), rs0 = rad.trim().split(/\s+/), c = (at || '50% 50%').trim().split(/\s+/);
        const cx = b.left + len(c[0], ow) * kx, cy = b.top + len(c[1] || '50%', oh) * ky;
        const side = (v, size) => (/^(closest|farthest)-side$/.test(v) || !v ? size / 2 : len(v, size));
        const rx = side(rs0[0], m[1] === 'circle' ? Math.hypot(ow, oh) / Math.SQRT2 : ow) * kx, ry = m[1] === 'circle' ? rx / kx * ky : side(rs0[1] || rs0[0], oh) * ky;
        tests.push((x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1);
      }
    }
    const f = tests.length ? (x, y) => tests.every((tf) => tf(x, y)) : null;
    clipFns.set(el, f);
    return f;
  };
  // How much of two texts' letters cover the same pixels (with their clip-paths taken into account)
  const ovArea = (a, b) => {
    const fa = clipFn(a.el), fb = clipFn(b.el);
    let ov = 0;
    for (const ra0 of a.rs) for (const rb0 of b.rs) {
      const q = inter(tight(ra0), tight(rb0)), s = area(q);
      if (!s) continue;
      if (!fa && !fb) { ov += s; continue; }
      let n = 0, k = 0;
      for (let iy = 0; iy < 3; iy++) for (let ix = 0; ix < 5; ix++) { const x = q.left + (q.right - q.left) * (ix + 0.5) / 5, y = q.top + (q.bottom - q.top) * (iy + 0.5) / 3; n++; if ((!fa || fa(x, y)) && (!fb || fb(x, y))) k++; }
      ov += s * k / n;
    }
    return ov;
  };
  const reportedBox = new Set();
  // The linear part of an element's transform on screen (its own and its parents': transform, translate, rotate, scale
  // properties), and whether a backface-hidden face turns away. For mirrored and upside-down text.
  const screenTf = (el) => {
    const one = (c) => {
      let m = new DOMMatrix();
      if (c.translate && c.translate !== 'none') m = m.multiply(new DOMMatrix('translate(' + c.translate.split(' ').slice(0, 2).join(',') + ')'));
      if (c.rotate && c.rotate !== 'none') {
        const r = c.rotate.trim().split(/\s+/);
        m = m.multiply(new DOMMatrix(r.length === 1 ? 'rotate(' + r[0] + ')' : r.length === 2 ? 'rotate' + r[0].toUpperCase() + '(' + r[1] + ')' : 'rotate3d(' + r.join(',') + ')'));
      }
      if (c.scale && c.scale !== 'none') { const q = c.scale.trim().split(/\s+/); m = m.multiply(new DOMMatrix('scale3d(' + q[0] + ',' + (q[1] ?? q[0]) + ',' + (q[2] ?? 1) + ')')); }
      if (c.transform && c.transform !== 'none') m = m.multiply(new DOMMatrix(c.transform));
      return m;
    };
    const chain = []; for (let a = el; a && a !== document.documentElement; a = a.parentElement) chain.push(a);
    let m = new DOMMatrix(), back = false;
    try {
      for (let k = chain.length - 1; k >= 0; k--) {
        const c = getComputedStyle(chain[k]);
        m = m.multiply(one(c));
        if (c.backfaceVisibility === 'hidden' && m.a * m.d - m.b * m.c < 0) back = true;
      }
    } catch (e) { m = new DOMMatrix(); }
    return { m, back };
  };
  // small solid shapes on screen (for stray-mark), found once per frame when first needed
  let marks = null;
  const smallMarks = () => {
    if (marks) return marks;
    marks = [];
    const lim = 80 * (H / 1080);
    for (const c of document.querySelectorAll('path,circle,ellipse,rect,polygon,div,span,i,b')) {
      if (c.closest('[data-gm-internal],defs,clipPath,mask,pattern,symbol,marker')) continue;
      const r = c.getBoundingClientRect();
      if (r.width < 3 || r.height < 3 || r.width > lim || r.height > lim || r.right < 0 || r.bottom < 0 || r.left > W || r.top > H) continue;
      if (c.children.length || (!(c instanceof SVGElement) && /\S/.test(c.textContent || ''))) continue;
      if (c.checkVisibility && !c.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      if (!paintsSolid(c)) continue;
      marks.push({ el: c, r });
    }
    return marks;
  };
  for (const t of texts) {
    const { el, u } = t;
    const cs = getComputedStyle(el);
    const tu = tight(u);
    const frame = { left: 0, top: 0, right: W, bottom: H };
    const cb = clipBoxOf(el);
    const shown = inter(inter(tu, frame), cb.r);
    // a sliver (a clip-path wipe that has not started, a label just past the edge) is not "shown"
    t.hidden = area(shown) < Math.max(4, 0.03 * area(tu)) || cb.masked && t.moving;
    // (a clip-path shape that leaves none of the text showing: hidden too)
    if (!t.hidden && clipFn(el)) { const f = clipFn(el); let any = false; for (let iy = 0; iy < 3 && !any; iy++) for (let ix = 0; ix < 7 && !any; ix++) any = f(shown.left + (shown.right - shown.left) * (ix + 0.5) / 7, shown.top + (shown.bottom - shown.top) * (iy + 0.5) / 3); if (!any) t.hidden = true; }
    // (under the clear part of a gradient mask, a world that fades out at its edges: hidden too; partly faded is shown)
    if (!t.hidden && cb.masks.length) { let any = false; for (let iy = 0; iy < 3 && !any; iy++) for (let ix = 0; ix < 7 && !any; ix++) { const x = shown.left + (shown.right - shown.left) * (ix + 0.5) / 7, y = shown.top + (shown.bottom - shown.top) * (iy + 0.5) / 3; any = cb.masks.reduce((v, f) => v * f(x, y), 1) > 0.06; } if (!any) t.hidden = true; }
    const cov = t.hidden ? { n: 0, hits: 0 } : coverOf(t);
    t.covered = cov.n > 0 && cov.hits === cov.n;
    // Text of a camera world under a screen overlay (a caption band, a title card outside the world) while the camera
    // holds: the shot is framed so that its labels sit behind the overlay. (Fully covered too: that label is lost.)
    const camW0 = el.closest('[data-gm-camera-world]');
    let overlaid = false;
    if (camW0 && !t.moving && !t.hidden && cov.hits > 0 && cov.by && !camW0.contains(cov.by) && !cov.by.contains(camW0) && t.op >= 0.5 && !camMoving.has(camW0) && !transitioning && !ignored(cov.by) && !overlapOk(el) && !overlapOk(cov.by) && !cov.by.closest('[data-gm-internal]')) {
      out.push({ severity: 'warning', code: 'text-covered', selector: sel(el), text: snippet(el), message: (t.covered ? 'This text of the camera world is hidden' : 'Part of this text of the camera world is hidden') + ' behind ' + sel(cov.by) + ', a layer over the world (a caption, a card).', minSpan: 0.3, fix: 'Frame the shot so its labels clear the overlay (more padding on that side, or a different center), or move the overlay.' });
      overlaid = true;
    }
    // Upside-down text (also while it moves: letters riding a looping path): turned more than ~100° on screen while
    // readable. data-check="upside-ok" when it is meant.
    if (!t.hidden && !t.covered && t.op >= 0.5 && !(el instanceof SVGElement) && !el.closest('[data-check~="upside-ok"]') && /\S/.test(el.textContent || '')) {
      const { m, back } = screenTf(el), det = m.a * m.d - m.b * m.c;
      const ang = Math.abs(Math.atan2(m.b, m.a) * 180 / Math.PI);
      if (!back && det > 0 && ang > 100) out.push({ severity: 'warning', code: 'upside-down-text', selector: sel(el), text: snippet(el), message: 'This text is turned ' + Math.round(ang) + '° on screen, so it reads upside down' + (t.moving ? ' while it moves' : '') + '.', minSpan: 0.3, fix: 'Keep letters within about ±90° of upright: on a path that loops, let them ride only the part that runs left to right, flip the ones on the return (rotate 180° more), or lay the text along a gentler curve. If it is meant, add data-check="upside-ok".' });
    }
    if (t.moving || t.hidden || t.covered) continue;
    // Partly hidden behind a shape or box that is drawn on top of it
    // (something flying over it on its way somewhere does not count)
    const passing = (c) => inAnim(c) || texts.some((o) => o.moving && (o.el === c || c.contains(o.el)));
    if (!overlaid && cov.hits > 0 && cov.by && t.op >= 0.5 && !transitioning && !ignored(cov.by) && !overlapOk(el) && !overlapOk(cov.by) && !cov.by.closest('[data-gm-internal]') && !passing(cov.by)) {
      out.push({ severity: 'warning', code: 'text-covered', selector: sel(el), text: snippet(el), message: 'Part of the text is hidden behind ' + sel(cov.by) + ', which is drawn on top of it.', minSpan: 0.3, fix: 'Move one of them, or put the text above it (z-index, or later in the HTML).' });
    }
    // A small solid mark (a dot, a tick, a stray shape) showing inside big text, in front of it or through a gap between
    // its letters: it reads as a typo in the number or word (round 5 brief E: the runner dot parked inside "42.195").
    if (t.op >= 0.5 && !transitioning && !overlapOk(el) && tu.bottom - tu.top >= 30 * (H / 1080)) {
      const th = tu.bottom - tu.top;
      for (const c of smallMarks()) {
        if (c.el === el || el.contains(c.el) || c.el.contains(el)) continue;
        const b = c.r, cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
        if (b.right - b.left > 0.6 * th || b.bottom - b.top > 0.6 * th) continue;
        if (cx < tu.left + 2 || cx > tu.right - 2 || cy < tu.top || cy > tu.bottom + 0.3 * th) continue; // (just under the baseline too: it reads as a decimal point)
        if (ignored(c.el) || overlapOk(c.el) || passing(c.el)) continue;
        out.push({ severity: 'warning', code: 'stray-mark', selector: sel(c.el), text: snippet(el), message: 'A small mark (' + sel(c.el) + ') sits inside the text "' + snippet(el) + '": it reads as a stray dot or a typo in it.', minSpan: 0.4, fix: 'Move the mark out of the text (or hide it while the text is up), or move the text. If it is meant (a dot over an i, a marker on purpose), add data-check="overlap-ok".' });
        break;
      }
    }
    // Inside a camera world (or data-check="crop-ok"), being cut by the frame edge is framing, not a mistake.
    const cropOk = !!el.closest('[data-gm-camera-world],[data-check~="crop-ok"]');
    // 1. Text partly outside the frame (fully outside = not shown, which is fine)
    //    (an ellipsis row whose own box is inside the frame is judged on what that box shows: a list cut on purpose)
    //    (and so is any text whose clipping box sits inside the frame: being cut there is text-clipped's business)
    const boxIn = cb.by && cb.r.left >= -2 && cb.r.top >= -2 && cb.r.right <= W + 2 && cb.r.bottom <= H + 2 && area(cb.r) < 0.95 * W * H;
    const vu = boxIn || cb.by && ellipsized(el, cb.by) ? inter(tu, cb.r) : tu;
    const outX = area(vu) > 0 ? Math.max(0, -vu.left) + Math.max(0, vu.right - W) : 0;
    const outY = area(vu) > 0 ? Math.max(0, -vu.top) + Math.max(0, vu.bottom - H) : 0;
    // In a camera world, text passing by the edge while the camera moves is fine, but a label cut by the edge of a shot
    // at rest is worth a look (even when most of it is out of frame: "st works" of a title reads as a mistake).
    const visFrac = area(inter(tu, frame)) / Math.max(1, area(tu));
    const cropMeant = !!el.closest('[data-check~="crop-ok"]');
    const camWorld = el.closest('[data-gm-camera-world]');
    // (a label of another part of the drawing that sits half in frame is still reported: judges and viewers read a
    //  half-cut label as a mistake, whatever the shot is about)
    const overview = camWorld && focus.some((f) => f.world === camWorld && f.overview);
    if ((outX > 2 || outY > 2) && cropOk && !cropMeant && visFrac >= 0.1 && !(camWorld && camMoving.has(camWorld))) out.push({ severity: 'warning', code: 'text-offscreen', selector: sel(el), text: snippet(el), message: 'Text is cut by the frame edge while the camera is on it.', minSpan: 0.3, fix: 'Frame the shot so labels are fully in view or fully out (more padding, a slightly different center, or move the label); a neighbour half in frame reads as a mistake. If the crop is on purpose, add data-check="crop-ok" to that text or a parent.' });
    // A hand-made camera (a big layer zoomed or panned with a transform: a timeline push-in, data-camera) that crops
    // the text: while it moves that is composition; when the shot holds it is framing (a warning). Only text that is
    // off the frame without that transform (or in no such layer) is stuck off screen (an error).
    const camCrop = (outX > 2 || outY > 2) && !cropOk ? camCropOf(t, tu) : null;
    if (camCrop && !camCrop.moving) out.push({ severity: 'warning', code: 'text-offscreen', selector: sel(el), text: snippet(el), message: 'Text is cut by the frame edge while the shot holds (the zoom or pan on ' + sel(camCrop.cam) + ' crops it).', minSpan: 0.3, fix: 'Frame the shot so the text is fully in view or fully out (zoom a little less, or center the push on it); a word half in frame reads as a mistake. If the crop is on purpose, add data-check="crop-ok" to that text or a parent.' });
    if ((outX > 2 || outY > 2) && !cropOk && !camCrop) out.push({ severity: 'error', code: 'text-offscreen', selector: sel(el), text: snippet(el), message: 'Text runs past the edge of the frame by ' + Math.round(Math.max(outX, outY)) + 'px.', minSpan: 0.2, fix: 'Reduce font-size, allow wrapping (max-width), or move it inside the frame.' });
    // 2. Partly cut by a box with overflow hidden (fully hidden = waiting to enter, which is fine)
    //    (an ellipsis is the design: a mail list, a file list)
    else if (!camCrop && cb.by && !cropOk && area(inter(tu, cb.r)) < area(tu) - 2 * Math.max(1, tu.height) && !reportedBox.has(cb.by) && !ellipsized(el, cb.by)) {
      reportedBox.add(cb.by);
      out.push({ severity: 'error', code: 'text-clipped', selector: sel(el), text: snippet(el), message: 'Text is partly cut off by ' + sel(cb.by) + ' (overflow: hidden).', fix: 'Make the text smaller, let it wrap, or make the container bigger.' });
    }
    // 3. Spills out of its card (nearest ancestor with a visible background or border)
    let anc = el.parentElement;
    let escapes = /^(absolute|fixed)$/.test(cs.position);
    const clipText = cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text';
    while (!escapes && !clipText && anc && anc !== document.body && !anc.classList.contains('scene')) {
      const acs = getComputedStyle(anc);
      if (acs.webkitBackgroundClip === 'text' || acs.backgroundClip === 'text') break;
      const hasBox = (acs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(acs.backgroundColor)) || acs.backgroundImage !== 'none' || parseFloat(acs.borderTopWidth) > 0 && acs.borderTopStyle !== 'none';
      if (hasBox) {
        const r = anc.getBoundingClientRect();
        const slack = 2, vslack = 0.3 * parseFloat(cs.fontSize);
        if ((u.right > r.right + slack || u.left < r.left - slack || u.bottom > r.bottom + vslack || u.top < r.top - vslack) && !reportedBox.has(anc)) {
          reportedBox.add(anc);
          out.push({ severity: 'warning', code: 'text-overflows-box', selector: sel(el), text: snippet(el), message: 'Text spills outside its box ' + sel(anc) + '.', minSpan: 0.15, fix: 'Add padding/width to the box, shorten the text, or reduce font-size.' });
        }
        break;
      }
      if (/^(absolute|fixed)$/.test(acs.position)) escapes = true;
      anc = anc.parentElement;
    }
    // 3b. Text where app buttons and titles will cover it (vertical social video)
    if (zone && t.op >= 0.5 && !el.closest('[data-check~="crop-ok"],[data-check~="safe-ok"]')) {
      const inSafe = area(inter(inter(tu, frame), zone)) / Math.max(1, area(inter(tu, frame)));
      if (inSafe < 0.85) out.push({ severity: 'warning', code: 'unsafe-zone', selector: sel(el), text: snippet(el), message: 'Text sits where the app covers the video (' + zone.name + ' safe zone: ' + Math.round(zone.top / PX) + ' px top, ' + Math.round((H - zone.bottom) / PX) + ' px bottom, ' + Math.round(zone.left / PX) + '/' + Math.round((W - zone.right) / PX) + ' px sides at 1080p).', minSpan: 0.3, fix: 'Move it toward the middle of the frame. If it does not matter when covered, add data-check="safe-ok".' });
    }
    // 4. Tiny text (visual size, after transforms)
    const fs = parseFloat(cs.fontSize);
    const lineH = t.rs.reduce((m, r) => Math.max(m, r.height), 0);
    const scaleY = el.offsetHeight > 0 ? el.getBoundingClientRect().height / el.offsetHeight : 1;
    const visualFs = fs * (isFinite(scaleY) && scaleY > 0 ? scaleY : 1);
    if (visualFs < 22 * PX && lineH > 0 && !overview && !(camWorld && camMoving.has(camWorld))) out.push({ severity: 'warning', code: 'tiny-text', selector: sel(el), text: snippet(el), message: 'Text is ' + Math.round(visualFs) + 'px tall in a ' + W + 'x' + H + ' frame, which is hard to read in a video.', fix: 'Use at least ' + Math.round(24 * PX) + 'px (' + Math.round(28 * PX) + 'px+ for body text).' });
    // 4a. Mirrored text: the text (or a card it sits on) is turned past 90° or flipped, so its back faces the camera and
    // it reads backwards (a card flip that ends showing the front's text through the back). A reflection is faint
    // (under half opacity) and not judged; data-check="mirror-ok" marks one that is meant.
    if (!(el instanceof SVGElement) && t.op >= 0.5 && !el.closest('[data-check~="mirror-ok"]')) {
      const { m, back } = screenTf(el);
      const det = m.a * m.d - m.b * m.c, size = Math.sqrt(Math.abs(m.a * m.d) + Math.abs(m.b * m.c)) || 1;
      if (!back && det < -0.15 * size * size) out.push({ severity: 'warning', code: 'mirrored-text', selector: sel(el), text: snippet(el), message: 'This text reads backwards: it, or a card it sits on, is turned past 90° or flipped, so its back faces the camera.', minSpan: 0.2, fix: 'Show the face that points at the camera: give the front face backface-visibility: hidden and put the back side\'s content on its own face turned 180°, or swap the content when the card is edge-on (90°). If the mirror is meant, add data-check="mirror-ok".' });
    }
    {
      let own = ''; for (const n of el.childNodes) if (n.nodeType === 3) own += n.data;
      const mg = own.trim() ? missingGlyphs(cs.fontFamily, own) : [];
      const fam = cs.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
      const fresh = mg.filter((ch) => !warnedGlyphs.has(fam + '|' + ch));
      if (fresh.length) {
        for (const ch of fresh) warnedGlyphs.add(fam + '|' + ch);
        out.push({ severity: 'warning', code: 'missing-glyph', selector: sel(el), text: snippet(el), message: 'The font "' + fam + '" has no ' + fresh.map((c) => '"' + c + '"').join(', ') + ': ' + (fresh.length > 1 ? 'these characters are' : 'this character is') + ' drawn in a fallback font (another face, weight and width).', fix: 'Use characters the font has (a smaller, lowered "2" for "₂"; "->" or an SVG arrow for "→"), add a font file that covers them (an @font-face with the latin-ext file, for example), or pick a font that has them.' });
      }
    }
    const mf = missingFont(cs.fontFamily);
    if (mf && !warnedFonts.has(mf)) { warnedFonts.add(mf); out.push({ severity: 'warning', code: 'font-unavailable', selector: sel(el), text: snippet(el), message: 'The font "' + mf + '" is not loaded or installed here, so this text is drawn in a fallback font (which differs from one computer to the next).', fix: 'Use a font that comes with givemotion (Inter, JetBrains Mono, Playfair Display, Space Grotesk, Bebas Neue, Caveat), or add an @font-face for a font file next to your HTML.' }); }
    t.fontPx = visualFs;
    t.bold = parseInt(cs.fontWeight, 10) >= 600;
    // (SVG text is painted with its fill, not its CSS color; a gradient fill is judged like clip-filled text: not at all)
    const svgText = el instanceof SVGElement;
    t.color = svgText ? cs.fill : cs.color;
    t.clipText = cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text' || /transparent|rgba\(\d+, \d+, \d+, 0\)/.test(cs.webkitTextFillColor || '') || (svgText && !/^(rgb|#|hsl|color|oklab|oklch|lab|lch)/.test(cs.fill));
  }
  // 4a2. Orphan word: a headline that wraps onto two or more lines and leaves one short word alone on the last line.
  // (Measured per word, so a title split into words or letters counts as one block.)
  {
    const seen = new Set();
    for (const t of texts) {
      if (t.moving || t.hidden || t.covered || t.op < 0.5 || t.fading) continue;
      const blk = t.el.closest('.gm-word, .gm-char') ? (t.el.closest('[data-split]') || t.el.parentElement) : t.el;
      if (!blk || seen.has(blk)) continue;
      seen.add(blk);
      if (blk.closest('[data-check~="orphan-ok"]') || ignored(blk)) continue;
      const k = blk.offsetHeight ? blk.getBoundingClientRect().height / blk.offsetHeight : 1;
      const fsz = parseFloat(getComputedStyle(blk).fontSize) * (isFinite(k) && k > 0 ? k : 1);
      if (fsz < 40 * PX) continue;
      const words = [];
      const wordEls = blk.querySelectorAll('.gm-word');
      if (wordEls.length) for (const w of wordEls) { const r = w.getBoundingClientRect(); if (r.width > 0) words.push({ r, s: w.textContent.trim() }); }
      else {
        const walker = document.createTreeWalker(blk, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const n = walker.currentNode, re = /\S+/g; let m;
          while ((m = re.exec(n.data))) { const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length); const r = rg.getBoundingClientRect(); if (r.width > 0) words.push({ r, s: m[0] }); }
        }
      }
      if (words.length < 3) continue;
      words.sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left);
      const lines = [];
      for (const w of words) { const L = lines[lines.length - 1]; if (L && Math.abs(w.r.top - L.top) < w.r.height * 0.5) { L.ws.push(w); L.right = Math.max(L.right, w.r.right); L.left = Math.min(L.left, w.r.left); } else lines.push({ top: w.r.top, left: w.r.left, right: w.r.right, ws: [w] }); }
      if (lines.length < 2) continue;
      const last = lines[lines.length - 1], widest = Math.max(...lines.map((L) => L.right - L.left));
      if (last.ws.length === 1 && last.right - last.left < 0.35 * widest) out.push({ severity: 'warning', code: 'orphan-word', selector: sel(blk), text: snippet(blk), message: 'This title wraps and leaves one short word ("' + last.ws[0].s.slice(0, 24) + '") alone on its last line.', minSpan: 0.3, fix: 'Add text-wrap: balance to it, set a max-width that breaks it into even lines, or put a <br> where the phrase breaks. If the layout is meant, add data-check="orphan-ok".' });
    }
  }
  // 4b. A line drawn through text (an arrow, the edge of a box): visible strokes that pass through the letters.
  //     Fills (a card behind a label, hatching) are fine; strokes still being drawn on, or hidden under something opaque, are skipped.
  const strokes = [];
  for (const sh of document.querySelectorAll('path,line,polyline,polygon,rect,circle,ellipse')) {
    if (sh.closest('defs,clipPath,mask,marker,pattern,symbol,[data-gm-sketch-guide],[data-gm-sketch-fill],.gm-sketch-mark,[data-gm-internal]') || ignored(sh)) continue;
    const cs = getComputedStyle(sh);
    if (cs.stroke === 'none' || /rgba\([^)]*,\s*0\)/.test(cs.stroke) || cs.visibility !== 'visible' || inAnim(sh)) continue;
    // A dashed line counts (a dashed ring through a label is still a line through it), but a draw-on that has not
    // finished (dash 1 gap 2 on pathLength 1, offset not yet 0) is only partly there: skip it.
    if (cs.strokeDasharray !== 'none') {
      const da = cs.strokeDasharray.split(/[\s,]+/).map(parseFloat), off = parseFloat(cs.strokeDashoffset) || 0;
      if (sh.getAttribute('pathLength') === '1' && da.length === 2 && da[1] >= da[0] && Math.abs(off) > 0.02) continue;
    }
    const b = sh.getBoundingClientRect();
    if (!b.width && !b.height) continue;
    let op = parseFloat(cs.strokeOpacity);
    for (let a = sh; a && a.nodeType === 1 && op > 0.3; a = a.parentElement) op *= parseFloat(getComputedStyle(a).opacity);
    if (op <= 0.3) continue;
    const ctm = sh.getScreenCTM && sh.getScreenCTM();
    if (!ctm || parseFloat(cs.strokeWidth) * Math.hypot(ctm.a, ctm.b) < 1.5 * PX) continue;
    // (an SVGPoint, not a DOMPoint: Chrome before ~136, e.g. the headless shell 132, throws on a DOMPoint here)
    const svg = sh.ownerSVGElement;
    strokes.push({ sh, b, inv: ctm.inverse(), pt: svg && svg.createSVGPoint ? svg.createSVGPoint() : null });
  }
  // Is the stroke covered at this point by something opaque drawn above it (a label's own card, a filled shape,
  // a sketch fill riding the line, a scrim drawn as a ::before)? Painted alpha >= 0.85 counts as covering.
  const opaqueEl = (e, x, y) => {
    const cs = getComputedStyle(e);
    if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') return false; // a multiply highlight does not hide what is under it
    let solid = false;
    if (e instanceof SVGElement) solid = !/^(svg|g|text|tspan|use|foreignObject)$/i.test(e.tagName) && cs.fill !== 'none' && (/^url\(/.test(cs.fill) || cssAlpha(cs.fill) * parseFloat(cs.fillOpacity) >= 0.85);
    else {
      // (a full-frame canvas over everything is an effect layer (particles, grain), not a backing)
      if (e.tagName === 'CANVAS') { const r = e.getBoundingClientRect(); solid = r.width * r.height <= 0.5 * W * H; }
      else if (/^(IMG|VIDEO)$/.test(e.tagName)) solid = true;
      else solid = bgSolid(cs, false);
      // a backing drawn by ::before / ::after (judged where it overlaps the element's own box)
      if (!solid && x != null) for (const pe of ['::before', '::after']) {
        const ps = getComputedStyle(e, pe);
        if (ps.content === 'none' || ps.display === 'none' || ps.visibility !== 'visible' || parseFloat(ps.opacity) < 0.85 || !bgSolid(ps, true)) continue;
        const r = e.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) { solid = true; break; }
      }
    }
    if (!solid) return false;
    let op = 1;
    for (let a = e; a && a.nodeType === 1 && op >= 0.85; a = a.parentElement) op *= parseFloat(getComputedStyle(a).opacity);
    return op >= 0.85;
  };
  // Hit testing skips pointer-events:none (connect arrows, chart grids, overlays), so while looking at what is
  // stacked over a line, every element is made hit-testable for a moment (only after a stroke was found under text).
  let peStyle = null;
  const hitAll = (on) => {
    if (on && !peStyle) { peStyle = document.createElement('style'); peStyle.setAttribute('data-gm-internal', ''); peStyle.textContent = '*{pointer-events:auto!important}'; document.head.appendChild(peStyle); }
    else if (!on && peStyle) { peStyle.remove(); peStyle = null; }
  };
  const coveredAt = (x, y, sh) => {
    hitAll(true);
    const stack = document.elementsFromPoint(x, y);
    const k = stack.indexOf(sh);
    if (k < 0) return false;
    for (let i = 0; i < k; i++) if (stack[i] !== document.documentElement && stack[i] !== document.body && !stack[i].contains(sh) && opaqueEl(stack[i], x, y)) return true;
    return false;
  };
  if (strokes.length) for (const t of texts) {
    if (t.moving || t.hidden || t.covered || t.op < 0.5 || overlapOk(t.el)) continue;
    const tu = tight(t.u);
    let hit = null;
    for (const st of strokes) {
      const b = st.b;
      if (b.right < tu.left || b.left > tu.right || b.bottom < tu.top || b.top > tu.bottom || st.sh.closest('svg') === t.el.closest('svg') && t.el.closest('text') && false) continue;
      // (rows about 4 px apart at 1080p, so a thin line between two rows is not missed)
      const ny = Math.min(8, Math.max(3, Math.ceil((tu.bottom - tu.top) / (4 * PX))));
      for (let iy = 0; iy < ny && !hit; iy++) for (let ix = 0; ix < 7 && !hit; ix++) {
        const x = tu.left + (tu.right - tu.left) * (ix + 0.5) / 7, y = tu.top + (tu.bottom - tu.top) * (iy + 0.5) / ny;
        const p = new DOMPoint(x, y).matrixTransform(st.inv);
        let pt = p;
        if (st.pt) { st.pt.x = p.x; st.pt.y = p.y; pt = st.pt; }
        try { if (st.sh.isPointInStroke(pt) && !coveredAt(x, y, st.sh)) hit = st.sh; } catch (e) {}
      }
      if (hit) break;
    }
    if (hit) out.push({ severity: 'warning', code: 'text-over-line', selector: sel(t.el), text: snippet(t.el), message: 'A line runs through this text: ' + sel(hit) + '.', minSpan: 0.3, fix: 'Move the label off the line (or the line around it), or give the label an opaque backing (alpha 0.85+) drawn above the line.' });
  }
  hitAll(false);
  // 5a. During a scene change: text of the old scene and text of the new one on top of each other, both half visible
  //     (a crossfade of two headlines reads as a smudge; judges call it "ghosted text")
  if (transitioning) {
    const sceneOf = (e) => { for (let c = e; c && c.parentElement; c = c.parentElement) if (c.parentElement.hasAttribute('data-sequence')) return c; return null; };
    const vis = texts.filter((t) => !t.hidden && !t.covered && t.op >= 0.25 && sceneOf(t.el));
    const seen = new Set();
    for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
      const a = vis[i], b = vis[j], sa = sceneOf(a.el), sb = sceneOf(b.el);
      if (sa === sb || seen.has(a.el) || seen.has(b.el) || overlapOk(a.el) || overlapOk(b.el)) continue;
      // the two halves of a morph pair fly together on purpose
      const ma = a.el.closest('[data-morph]'), mb = b.el.closest('[data-morph]');
      if (ma && mb && ma.getAttribute('data-morph') === mb.getAttribute('data-morph')) continue;
      const ov = ovArea(a, b);
      const ar = (t) => t.rs.reduce((m, r0) => m + area(tight(r0)), 0);
      if (ov > 0.2 * Math.min(ar(a), ar(b)) && Math.min(a.op, b.op) >= 0.3) {
        seen.add(a.el); seen.add(b.el);
        out.push({ severity: 'warning', code: 'ghost-overlap', selector: sel(b.el), text: snippet(b.el), message: 'During the scene change, this text and "' + snippet(a.el) + '" from the other scene are both half visible on top of each other.', minSpan: 0.15, fix: 'Use a transition that does not stack the two scenes (push-*, whip-*, cover-*, wipe-*, iris), move one of the texts, or let the old text leave before the new one enters.' });
      }
    }
  }
  // 5. Overlapping text (settled, visible, not covered)
  const live = texts.filter((t) => !t.moving && !t.hidden && !t.covered);
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      if (transitioning) continue;
      if (a.el.contains(b.el) || b.el.contains(a.el) || overlapOk(a.el) || overlapOk(b.el)) continue;
      const splitParent = (e) => e.closest('[data-split]');
      if (splitParent(a.el) && splitParent(a.el) === splitParent(b.el)) continue;
      // letters or short pieces of one word (tight kinetic type) are not "overlapping text"
      if (a.el.parentElement === b.el.parentElement && (a.el.textContent.trim().length <= 2 || b.el.textContent.trim().length <= 2)) continue;
      const ov = ovArea(a, b);
      const ar = (t) => t.rs.reduce((s, r) => s + r.width * r.height * 0.58, 0);
      if (ov > 0.12 * Math.min(ar(a), ar(b))) {
        out.push({ severity: 'warning', code: 'text-overlap', selector: sel(a.el), text: snippet(a.el), message: 'Text overlaps other text: ' + sel(b.el) + ' ("' + snippet(b.el) + '").', minSpan: 0.15, fix: 'Move one of them, or make sure they are not visible at the same time.' });
      }
    }
  }
  // 5c. Two readable texts on top of each other while one of them moves (an exit and the next entrance at the same
  //     time inside one scene: "Your" under "Copy."). Crossfades pass (both are never above half opacity for long),
  //     and so do morph pairs, letters of one split word and copies of the same text.
  if (!transitioning) {
    const rd = texts.filter((t) => !t.hidden && !t.covered && t.op > 0.5 && !overlapOk(t.el));
    const ar = (t) => t.rs.reduce((m, r0) => m + area(tight(r0)), 0);
    const seenM = new Set();
    for (let i = 0; i < rd.length; i++) for (let j = i + 1; j < rd.length; j++) {
      const a = rd[i], b = rd[j];
      if (!a.moving && !b.moving) continue; // settled pairs: text-overlap
      if (a.u.right < b.u.left || b.u.right < a.u.left || a.u.bottom < b.u.top || b.u.bottom < a.u.top) continue;
      if (seenM.has(a.el) || seenM.has(b.el) || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const sp = a.el.closest('[data-split]');
      if (sp && sp === b.el.closest('[data-split]')) continue;
      if (a.el.parentElement === b.el.parentElement && (a.el.textContent.trim().length <= 2 || b.el.textContent.trim().length <= 2)) continue;
      const ma = a.el.closest('[data-morph]'), mb = b.el.closest('[data-morph]');
      if (ma && mb && ma.getAttribute('data-morph') === mb.getAttribute('data-morph')) continue;
      if (snippet(a.el) === snippet(b.el)) continue;
      const ov = ovArea(a, b);
      if (ov > 0.12 * Math.min(ar(a), ar(b))) {
        seenM.add(a.el); seenM.add(b.el);
        const [m, o] = a.moving ? [a, b] : [b, a];
        out.push({ severity: 'warning', code: 'moving-overlap', selector: sel(m.el), text: snippet(m.el), message: 'This text runs over "' + snippet(o.el) + '" (' + sel(o.el) + ') while it moves, both readable: an exit and the next entrance at the same time read as a smudge.', minSpan: 0.2, fix: 'Let the old text leave (or fade below half) before the new one arrives, or move one of them. If the overlap is the point, add data-check="overlap-ok".' });
      }
    }
  }
  // 6. Broken images
  for (const img of document.images) {
    if (img.closest('[data-gm-hidden]') || ignored(img)) continue;
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) out.push({ severity: 'error', code: 'image-broken', selector: sel(img), message: 'Image did not load: ' + img.getAttribute('src'), fix: 'Check the file path (relative to the HTML file).' });
  }
  // Text boxes for the contrast pass. Fading, moving, covered or clip-filled text is not judged.
  // (text cut by the frame edge is not judged for contrast: only part of it can be measured, and the crop is its own issue)
  const inFrame = (t) => t.u.left >= -2 && t.u.top >= -2 && t.u.right <= W + 2 && t.u.bottom <= H + 2;
  // (text that is still fading, or lies partly under another element drawn over it (a scrim, a caption box), is not
  //  judged for contrast: that dimming is on purpose, and a covering box is text-covered's business)
  const underSomething = (t) => {
    const tu = tight(t.u);
    for (let ix = 0; ix < 5; ix++) {
      const x = tu.left + (tu.right - tu.left) * (ix + 0.5) / 5, y = (tu.top + tu.bottom) / 2;
      const st = document.elementsFromPoint(x, y), k = st.findIndex((e) => e === t.el || t.el.contains(e));
      if (k > 0 && st.slice(0, k).some((e) => !e.contains(t.el) && !e.closest('[data-gm-internal]'))) return true;
    }
    return false;
  };
  // The flat color right behind a text, when nothing else is painted between (its card, the page): texts with the same
  // color on the same backing at the same size class get the same contrast verdict, even when only one was measured.
  const flatBacking = (t) => {
    let bgEl = null, bg = null;
    for (let a = t.el; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.backgroundImage !== 'none') return null;
      if (cssAlpha(cs.backgroundColor) >= 0.99) { bgEl = a; bg = cs.backgroundColor; break; }
      if (a !== t.el && parseFloat(cs.opacity) < 0.99) return null;
    }
    if (!bgEl) return null;
    if (bgEl === t.el) { t.bgEl = bgEl; return bg; } // the text's own background (a pill, a badge)
    const q = t.rs[0], st = document.elementsFromPoint((q.left + q.right) / 2, (q.top + q.bottom) / 2);
    let k = st.findIndex((e) => e === t.el || t.el.contains(e));
    if (k < 0) return null;
    for (k++; k < st.length; k++) { const e = st[k]; if (e === bgEl) { t.bgEl = bgEl; return bg; } if (!e.contains(t.el)) return null; }
    return null;
  };
  const tNow = opt && opt.t != null ? opt.t : null;
  if (!window.__gmSigs) window.__gmSigs = {};
  // (text still moving into place is judged once it rests: mid-entrance its pixels and its box do not line up)
  window.__gmTextBoxes = transitioning ? [] : live.filter((t) => !t.clipText && t.op >= 0.75 && !t.fading && !t.moving && inFrame(t) && !underSomething(t)).map((t) => {
    const cs = getComputedStyle(t.el);
    // A dark/light text-shadow or outline gives text its own backing; be lenient then.
    const backed = (cs.textShadow && cs.textShadow !== 'none') || parseFloat(cs.webkitTextStrokeWidth) > 0;
    // Large text (WCAG): 24 px+, or bold 18.66 px+ (on screen, after zoom, at 1080p)
    const large = t.fontPx >= 24 * PX || (t.bold && t.fontPx >= 18.66 * PX);
    const fb = t.op >= 0.99 && !backed ? flatBacking(t) : null;
    const sig = fb ? [t.color, fb, large ? 'L' : 'N'].join('|') : null;
    const s0 = sel(t.el);
    if (sig && tNow != null) { const g = window.__gmSigs[s0]; if (g && g.sig === sig) { g.times.push(tNow); } else window.__gmSigs[s0] = { sig, text: snippet(t.el), times: [tNow] }; }
    // a solid backing that holds the whole text (a pill, a badge): judge against its color, not the pixels around its
    // rounded corners that the text's line box also covers
    const R = fb && t.bgEl ? t.bgEl.getBoundingClientRect() : null;
    const flat = R && t.rs.every((r) => r.left >= R.left - 0.5 && r.right <= R.right + 0.5 && r.top >= R.top - 0.5 && r.bottom <= R.bottom + 0.5) ? fb : null;
    return { sel: s0, text: snippet(t.el), rects: t.rs.map((r) => [r.left, r.top, r.width, r.height]), color: t.color, op: t.op, backed, large, sig, flat };
  });
  // 7. A tween or style on an element with display: contents (a <gm-include> without class or style is one): it draws
  //    no box, so its opacity, transform, filter and clip-path do nothing. Noted once, the first time it is seen.
  if (!window.__gmNoBox) window.__gmNoBox = new Map();
  {
    const cands = new Set(document.body.querySelectorAll('[style]'));
    for (const a of document.getAnimations()) { const tg = a.effect && a.effect.target; if (tg && tg.nodeType === 1) cands.add(tg); }
    for (const el of cands) {
      if (window.__gmNoBox.has(el) || ignored(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.display !== 'contents') continue;
      const props = [];
      if (parseFloat(cs.opacity) < 0.999) props.push('opacity');
      // (a box-less element may report its transform as none: read what was written on it too)
      for (const k of ['transform', 'translate', 'scale', 'rotate']) if (cs[k] && cs[k] !== 'none' || el.style[k] && !/^(none|matrix\(1, 0, 0, 1, 0, 0\)|translate\(0px(, 0px)?\)|scale\(1\))$/.test(el.style[k])) props.push(k);
      if (cs.filter !== 'none') props.push('filter');
      if (cs.clipPath !== 'none') props.push('clip-path');
      if (props.length) window.__gmNoBox.set(el, { t: tNow, props, sel: sel(el), inc: el.getAttribute('data-gm-include') });
    }
  }
  // where each issue's element sits: its scene and when that scene starts (for scene-local times)
  for (const i of out) {
    try { const e = i.selector && document.querySelector(i.selector); const sc = e && (e.closest('.scene') || e.closest('[data-start],[data-duration]')); if (sc) { i.scene = sel(sc); i.sceneStart = gm.timing(sc).start; } } catch (er) {}
  }
  // the biggest readable text on screen (an "empty" frame with a heading on it is not empty)
  let maxFont = 0;
  for (const t of texts) { if (t.hidden || t.covered) continue; const k = t.el.offsetHeight ? t.el.getBoundingClientRect().height / t.el.offsetHeight : 1; maxFont = Math.max(maxFont, parseFloat(getComputedStyle(t.el).fontSize) * (isFinite(k) && k > 0 ? k : 1)); }
  window.__gmTexts = texts; window.__gmTransitioning = transitioning;
  // For the still measure: how much of the frame is entering, leaving or moving right now (a small label fading in
  // in a corner does not make a frozen picture move), and the boxes it leaves out: data-check="pace-ignore"
  // (captions that change with every word over a picture that stands still)
  const paceIgnored = (el) => !!(el.closest && el.closest('[data-check~="pace-ignore"]'));
  const frameShare = (r) => area(inter(r, { left: 0, top: 0, right: W, bottom: H })) / (W * H);
  // ([an id per element, its share]: several small things in one half second add up, a list building item by item)
  const bIds = window.__gmBusyIds || (window.__gmBusyIds = { n: 0, m: new WeakMap() });
  const bId = (el) => { let i = bIds.m.get(el); if (!i) bIds.m.set(el, (i = ++bIds.n)); return i; };
  const busy = [];
  for (const el of animating) {
    if (!el || !el.getBoundingClientRect || paceIgnored(el) || (el.parentElement && inAnim(el.parentElement)) || !visible(el)) continue;
    busy.push([bId(el), frameShare(el.getBoundingClientRect())]);
  }
  for (const t of texts) if (t.moving && !t.hidden && !inAnim(t.el) && !paceIgnored(t.el)) busy.push([bId(t.el), frameShare(t.u)]);
  const paceOut = [...document.querySelectorAll('[data-check~="pace-ignore"]')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0).map((r) => [r.left / W, r.top / H, r.right / W, r.bottom / H]);
  return { issues: out, textCount: texts.length, maxFont: maxFont / PX, boxes: window.__gmTextBoxes.length, busy, paceOut };
})`;

// ---------------------------------------------------------------------------
// Pacing per element (page side, after PAGE_ANALYZE in the same sample): is each text (one reading unit: a line, a
// split headline) and each mark (an icon, a picture) readable right now, which of them vanished by a cut since the
// previous sample, which big things move with a steps() ease, and how much of a clip-path's element shows.
// Per unit: [id, state (2 readable, 1 on screen but moving / fading / covered, 0 just went away), reason, big (24 px+),
// live (changes on screen), and its box when readable: x, y, w, h]
// ---------------------------------------------------------------------------
const PAGE_PACING = String.raw`((dt, tNow) => {
  const W = gm.width, H = gm.height, PX = gm.px;
  const S = window.__gmPace || (window.__gmPace = { id: 0, ids: new WeakMap(), prev: new Map(), clipEls: new Map(), steps: new Map() });
  const out = { units: [], meta: {}, pops: [], clips: [] };
  const ignored = (el) => !!el.closest('[data-check~="ignore"],[aria-hidden="true"],[data-gm-internal]');
  // quick on purpose: captions, data-check="quick-ok"
  const quick = (el) => !!el.closest('[data-check~="quick-ok"],.gmb-cap');
  const sel = (el) => gm.__selector(el);
  const isTextEl = (el) => { for (const n of el.childNodes) if (n.nodeType === 3 && n.data.trim() && !/^[\s\p{Extended_Pictographic}‍️⃣]+$/u.test(n.data)) return true; return false; };
  const vis = (el) => {
    let op = 1;
    for (let c = el; c && c.nodeType === 1; c = c.parentElement) {
      const cs = getComputedStyle(c);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return 0;
      op *= parseFloat(cs.opacity);
      if (cs.filter !== 'none' && cs.filter.includes('opacity(')) for (const m of cs.filter.matchAll(/opacity\(([\d.]+)(%?)\)/g)) op *= parseFloat(m[1]) / (m[2] ? 100 : 1);
      if (op < 0.04) return 0;
    }
    return op;
  };
  const isClip = (e) => e.hasAttribute('data-start') || e.hasAttribute('data-duration') || e.hasAttribute('data-end') || e.classList.contains('scene') || !!(e.parentElement && e.parentElement.hasAttribute('data-sequence'));
  // the scene: the outermost clip around it (a top-level section, a scene of a sequence), else the whole page
  const sceneOf = (el) => { let s = null; for (let c = el; c && c !== document.body; c = c.parentElement) if (isClip(c)) s = c; return s; };
  const shown = (el) => { const r = el.getBoundingClientRect(), a = Math.max(1, r.width * r.height); return (Math.max(0, Math.min(r.right, W) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0))) / a; };
  const idOf = (el, kind) => {
    let id = S.ids.get(el);
    if (id) return id;
    id = ++S.id; S.ids.set(el, id);
    // its own words: text inside it that belongs to this unit (not to a block of its own nested in it)
    let own = '';
    // (word spans laid out with a gap and no spaces between them are still separate words; the letters of a split
    //  word are not)
    if (kind === 'text') {
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let last = null;
      // (pieces on one line that touch, like letters split into their own spans by the page's script, are one word:
      //  decided by the gap on screen, not by the display type)
      // (layout positions, not screen boxes: letters still flying in when the text is first seen are apart on screen)
      const touching = (a, b2) => {
        if (!(a instanceof HTMLElement) || !(b2 instanceof HTMLElement) || a.offsetParent !== b2.offsetParent) return false;
        const fs = parseFloat(getComputedStyle(b2).fontSize) || 16;
        const gap = Math.min(Math.abs(b2.offsetLeft - (a.offsetLeft + a.offsetWidth)), Math.abs(a.offsetLeft - (b2.offsetLeft + b2.offsetWidth)));
        return a.offsetWidth > 0 && b2.offsetWidth > 0 && Math.abs(a.offsetTop - b2.offsetTop) < Math.max(a.offsetHeight, b2.offsetHeight) * 0.5 && gap < 0.2 * fs;
      };
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        if (!n.parentElement || unitOf(n.parentElement) !== el) continue;
        if (last && last !== n.parentElement && !last.closest('.gm-char') && getComputedStyle(last).display !== 'inline' && !touching(last, n.parentElement)) own += ' ';
        own += n.data; last = n.parentElement;
      }
    }
    const words = (own.match(/[\p{L}\p{N}][\p{L}\p{N}'’.,%$€£×-]*/gu) || []).length;
    // live: text that changes by design (counters, typing, scramble); ambient: it rides an endless loop (a floating
    // label, a particle) and is not meant to be read on a schedule
    // (a big layer that drifts in a loop, a stage or a scene, does not make its text ambient)
    const loops = (e) => { for (let c = e; c && c !== document.body && c.offsetWidth * c.offsetHeight < 0.4 * W * H; c = c.parentElement) for (const a of c.getAnimations()) { try { const it = a.effect.getTiming().iterations; if (it === Infinity || it > 1) return true; } catch (er) {} } return false; };
    const live = kind === 'text' && !!(el.closest('[data-count],[data-type],[data-scramble]') || el.querySelector('[data-count],[data-type],[data-scramble]')) || loops(el);
    const sc = sceneOf(el);
    out.meta[id] = { sel: sel(el), kind, words, live, quick: quick(el), text: kind === 'text' ? own.trim().replace(/\s+/g, ' ').slice(0, 40) : '', scene: sc ? sel(sc) : null, sceneStart: sc ? gm.timing(sc).start : 0, overlapOk: !!el.closest('[data-check~="overlap-ok"]'), carryOk: !!el.closest('[data-check~="carry-ok"],[data-check~="ignore"]') };
    return id;
  };
  // 1. Reading units: a line of text with its inline parts (an <em> in a headline, the words of a split line); SVG
  //    text on its own. The unit is readable when every part of it that is on screen is settled (a line that builds
  //    word by word is read as it builds, so its hold starts with its first word).
  //    (a flex row of single words, a caption line made of word spans, is one line too)
  const lineOfWords = (p) => {
    const cs = getComputedStyle(p);
    if (!/flex/.test(cs.display) || /column/.test(cs.flexDirection) || p.children.length < 2) return false;
    return [...p.children].every((c) => !c.querySelector('div,p,h1,h2,h3,h4,h5,h6,ul,ol,li,img,svg,section') && (c.textContent.match(/\S+/g) || []).length <= 2);
  };
  if (!S.units) S.units = new WeakMap();
  const unitOf = (el) => {
    if (S.units.has(el)) return S.units.get(el);
    let u = el;
    if (el instanceof SVGElement) u = el.closest('text') || el;
    else if (el.closest('[data-split]')) u = el.closest('[data-split]');
    else while (u.parentElement && u.parentElement !== document.body && (/^inline/.test(getComputedStyle(u).display) || lineOfWords(u.parentElement))) u = u.parentElement;
    S.units.set(el, u);
    return u;
  };
  // the boxes around a readable unit up to its scene, with their sizes (to tell later what went away with it)
  const layers = (el) => { const a = []; const sc = sceneOf(el); for (let c = el.parentElement; c && c !== document.body; c = c.parentElement) { a.push([c, c.offsetWidth * c.offsetHeight]); if (c === sc) break; } return a; };
  const texts = window.__gmTexts || [];
  const units = new Map();
  for (const t of texts) { const u = unitOf(t.el); if (!units.has(u)) units.set(u, []); units.get(u).push(t); }
  const now = new Map(); // id -> { el, state, rect, op }
  for (const [u, parts] of units) {
    const id = idOf(u, 'text');
    let state = 2, reason = '', big = false;
    for (const t of parts) {
      const cs = getComputedStyle(t.el), k = t.el.offsetHeight ? t.el.getBoundingClientRect().height / t.el.offsetHeight : 1;
      if (parseFloat(cs.fontSize) * (isFinite(k) && k > 0 ? k : 1) >= 24 * PX) big = true;
      const r = t.rs.length ? t.u : null;
      let why = '';
      if (t.hidden) why = 'hidden';
      else if (t.covered) why = 'covered';
      else if (t.op < 0.4 || t.fo > 0.8) why = 'fading';
      else if ((t.cam ? t.cv : t.sv) > 600 * PX || t.sv > 1000 * PX || t.ssz > 0.6) why = 'moving';
      else if (r && (Math.max(0, Math.min(r.right, W) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0))) < 0.7 * (r.right - r.left) * (r.bottom - r.top)) why = 'cropped';
      if (why) { state = 1; reason = reason || why; }
    }
    // text that changes while on screen (a counter, a clock, typing) is not judged for its hold: its text, as a short
    // hash, goes with every sample (the pass compares them in time order)
    const tc = u.textContent;
    let hh = 5381; for (let k = 0; k < tc.length; k++) hh = (hh * 33 + tc.charCodeAt(k)) | 0;
    // (its box: where its letters are, not the box around them: a caption's box can be much taller than its line)
    const rect = parts.reduce((a, t) => ({ left: Math.min(a.left, t.u.left), top: Math.min(a.top, t.u.top), right: Math.max(a.right, t.u.right), bottom: Math.max(a.bottom, t.u.bottom) }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
    rect.width = rect.right - rect.left; rect.height = rect.bottom - rect.top;
    now.set(id, { el: u, state, rect, op: Math.min(...parts.map((t) => t.op)), anc: state === 2 ? layers(u) : null });
    out.units.push([id, state, reason, big ? 1 : 0, (hh >>> 0).toString(36) + ':' + tc.length, ...(state === 2 ? [rect.left, rect.top, rect.width, rect.height].map(Math.round) : [])]);
  }
  // 2. Marks: an icon, a logo, a picture (an <img> or an outer <svg>) between ~40 px square and a fifth of the frame
  for (const el of document.body.querySelectorAll('img,svg')) {
    if (el.tagName.toLowerCase() === 'svg' && el.parentElement && el.parentElement.closest('svg')) continue;
    // (the cursor block's pointer is a pointer, not something to read)
    if (el.closest('[data-gm-hidden],.gmb-cursor') || ignored(el) || el.querySelector('text')) continue;
    const op = vis(el);
    if (!op) continue;
    const r = el.getBoundingClientRect(), a = r.width * r.height;
    if (a < (40 * PX) ** 2 || a > 0.2 * W * H) continue;
    const id = idOf(el, 'mark');
    const p = S.prev.get(id);
    let state = 2, reason = '';
    const sv = p && dt > 0 ? Math.hypot(r.left + r.width / 2 - (p.rect.left + p.rect.width / 2), r.top + r.height / 2 - (p.rect.top + p.rect.height / 2)) / dt : 0;
    const ssz = p && dt > 0 ? Math.abs(Math.log(Math.max(1, r.width) / Math.max(1, p.rect.width))) / dt : 0;
    const fo = p && dt > 0 ? Math.abs(op - p.op) / dt : 0;
    if (op < 0.4 || fo > 0.8) { state = 1; reason = 'fading'; }
    else if (sv > 600 * PX || ssz > 0.6) { state = 1; reason = 'moving'; }
    else if (shown(el) < 0.7) { state = 1; reason = 'cropped'; }
    else {
      // covered: something opaque drawn over its middle
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx >= 0 && cy >= 0 && cx <= W && cy <= H) for (const c of document.elementsFromPoint(cx, cy)) {
        if (c === el || el.contains(c) || c.contains(el)) break;
        if (c.closest('[data-gm-internal]')) continue;
        const cs = getComputedStyle(c), m = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor), al = m ? (m[1].split(',')[3] != null ? parseFloat(m[1].split(',')[3]) : 1) : 0;
        if (al > 0.85 || /^(IMG|VIDEO)$/.test(c.tagName)) { state = 1; reason = 'covered'; }
        break;
      }
    }
    now.set(id, { el, state, rect: r, op, anc: state === 2 ? layers(el) : null });
    out.units.push([id, state, reason, 1, 0, ...(state === 2 ? [r.left, r.top, r.width, r.height].map(Math.round) : [])]);
  }
  // 3. Units that were readable at the previous sample and are gone now (display: none or opacity 0 in one step)
  //    while their scene goes on: a cut with no exit. (A replacement in the same place, a scene change, a scene
  //    transition, a removed element are not.)
  const trans = !!window.__gmTransitioning;
  const ov = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  for (const [id, p] of S.prev) {
    if (now.has(id)) continue;
    const el = p.el;
    const sc = sceneOf(el);
    const sceneOn = !sc || vis(sc) > 0;
    let why = !el.isConnected ? 'moving' : !sceneOn ? 'scene' : vis(el) === 0 ? 'cut' : 'hidden';
    // replaced in place (a state swap: a label or an icon changing, a fly taking off from it): something new is on
    // screen over its box
    if (why === 'cut') for (const [id2, q] of now) {
      if (S.prev.has(id2) && S.prev.get(id2).state > 0) continue;
      if (ov(p.rect, q.rect) >= 0.3 * Math.min(p.rect.width * p.rect.height, q.rect.width * q.rect.height)) { why = 'swap'; break; }
    }
    out.units.push([id, 0, why, 0, 0]);
    // (only between close samples: a fast exit could fit between two samples further apart)
    if (why !== 'cut' || p.state !== 2 || p.op < 0.85 || trans || !(dt > 0 && dt <= 0.135)) continue;
    if (el.closest('[data-morph],[data-check~="quick-ok"],.gmb-cap')) continue;
    // the highest box below the scene that went away (a card that is a clip, a group set to opacity 0); a layer as
    // big as the frame going away is a cut of the whole picture (an edit, like a scene change), not this element
    let cause = el, area = p.rect.width * p.rect.height;
    for (let c = el.parentElement; c && c !== sc && c !== document.body; c = c.parentElement) { const cs = getComputedStyle(c); if (cs.display === 'none' || cs.visibility !== 'visible' || parseFloat(cs.opacity) < 0.04) { cause = c; const k = (p.anc || []).find((x) => x[0] === c); if (k) area = k[1]; } }
    if (area >= 0.5 * W * H) continue;
    out.pops.push({ id, sel: sel(cause), text: (cause.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40), t: tNow - dt, scene: sc ? sel(sc) : null, sceneStart: sc ? gm.timing(sc).start : 0 });
  }
  S.prev = now;
  // 4. steps() eases on big things (more than ~15% of the frame): CSS animations and transitions, and the tween
  //    targets PAGE_EASES found with a steps() ease. Opacity-only steps (a blinking caret) and see-through textures
  //    (grain) are fine.
  const MOVE = /^(transform|translate|scale|rotate|left|top|right|bottom|width|height|clipPath|clip-path|inset|offsetDistance|offset-distance|x|y|scaleX|scaleY|xPercent|yPercent)$/;
  const big = (el) => {
    const op = vis(el);
    if (op < 0.3) return 0;
    const cs = getComputedStyle(el);
    if (cs.mixBlendMode !== 'normal' || parseFloat(cs.opacity) < 0.3) return 0;
    const r = el.getBoundingClientRect(), a = (Math.max(0, Math.min(r.right, W) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0))) / (W * H);
    return a;
  };
  const noteStep = (el, how) => { if (!el || el.nodeType !== 1 || ignored(el)) return; const a = big(el); if (a >= 0.15) { const cur = S.steps.get(el); if (!cur || cur.area < a) S.steps.set(el, { sel: sel(el), area: a, how, t: tNow }); } };
  for (const a of document.getAnimations()) {
    try {
      const tg = a.effect && a.effect.target, tm = a.effect.getTiming(), kf = a.effect.getKeyframes();
      const stepped = /steps\(|step-(start|end)/.test(tm.easing) || kf.some((k) => /steps\(|step-(start|end)/.test(k.easing || ''));
      if (!stepped) continue;
      const props = new Set(); for (const k of kf) for (const key of Object.keys(k)) props.add(key);
      if (![...props].some((k) => MOVE.test(k))) continue;
      noteStep(tg, 'CSS animation');
    } catch (e) {}
  }
  for (const s of window.__gmStepTweens || []) { try { for (const el of document.querySelectorAll(s)) noteStep(el, 'tween'); } catch (e) {} }
  // 5. Elements with a clip-path shape: what fraction of their box shows (a start state that leaves a sliver)
  const cands = new Set(document.body.querySelectorAll('[style*="clip-path"]'));
  for (const a of document.getAnimations()) { const tg = a.effect && a.effect.target; if (tg && tg.nodeType === 1) cands.add(tg); }
  for (const el of cands) { if (!S.clipEls.has(el) && !ignored(el) && getComputedStyle(el).clipPath !== 'none') S.clipEls.set(el, ++S.id); }
  for (const [el, id] of S.clipEls) {
    if (!el.isConnected) continue;
    const op = vis(el);
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!op || op < 0.5 || w * h < 0.01 * W * H || shown(el) < 0.5) { out.clips.push([id, -1]); continue; }
    const cp = getComputedStyle(el).clipPath;
    let f = 1, minDim = Infinity;
    const len = (v, size) => (/%$/.test(v) ? (parseFloat(v) / 100) * size : parseFloat(v) || 0);
    const m = /^(inset|circle|ellipse)\((.*)\)/.exec(cp.trim());
    if (m && m[1] === 'inset') {
      const v = m[2].replace(/\s+round\s.*$/, '').trim().split(/\s+/), [t0, r0 = t0, b0 = t0, l0 = r0] = v;
      const fw = Math.max(0, w - len(l0, w) - len(r0, w)), fh = Math.max(0, h - len(t0, h) - len(b0, h));
      f = (fw * fh) / (w * h); minDim = Math.min(fw, fh);
    } else if (m) {
      const rs = m[2].split(/\s+at\s+/)[0].trim().split(/\s+/);
      const rx = m[1] === 'circle' ? len(rs[0] || '50%', Math.hypot(w, h) / Math.SQRT2) : len(rs[0] || '50%', w), ry = m[1] === 'circle' ? rx : len(rs[1] || rs[0] || '50%', h);
      if (/side/.test(rs[0] || '')) { f = 1; } else { f = Math.min(1, (Math.PI * rx * ry) / (w * h)); minDim = 2 * Math.min(rx, ry); }
    } else if (cp !== 'none') f = 1; // polygon, path, url(): not judged
    out.clips.push([id, Math.round(f * 1000) / 1000, minDim >= 1.5 ? 1 : 0]);
    if (!S.clipSeen) S.clipSeen = new Set();
    if (!S.clipSeen.has(id) && S.clipSeen.add(id)) out.meta['c' + id] = { sel: sel(el), cp, scene: sceneOf(el) ? sel(sceneOf(el)) : null, sceneStart: sceneOf(el) ? gm.timing(sceneOf(el)).start : 0 };
  }
  return out;
})`;

// Collected once at the end of the pass: big things stepped by a steps() ease.

// ---------------------------------------------------------------------------
// Robotic motion (page side): where the things that move are, per sample, and which easing curves the page uses
// ---------------------------------------------------------------------------
// Per sample: [id, screen cx, cy, local cx, cy (in the parent's own px), parent scale, w, h, own scale, flags]
// flags: 1 camera world, 2 inside a camera world, 4 moves along a path (offset-path)
const PAGE_MOTION = String.raw`(() => {
  const W = gm.width, H = gm.height, out = [], names = {};
  let id = window.__gmMoId || 0;
  const cands = new Set(document.querySelectorAll('[data-gm-camera-world]'));
  for (const a of document.getAnimations()) { const t = a.effect && a.effect.target; if (t && t.nodeType === 1) cands.add(t); }
  for (const el of document.body.querySelectorAll('[style]')) { const st = el.style; if (st.transform || st.translate || st.offsetDistance || st.left || st.top) cands.add(el); }
  for (const el of cands) {
    if (!el.isConnected || el === document.body || el === document.documentElement || el.closest('[data-check~="ignore"],[aria-hidden="true"],[data-gm-internal],[data-gm-hidden]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width * r.height < 0.004 * W * H || r.right <= 0 || r.bottom <= 0 || r.left >= W || r.top >= H) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible' || parseFloat(cs.opacity) < 0.3) continue;
    const world = el.hasAttribute('data-gm-camera-world');
    // Local motion is measured in the element's camera world when it has one (world space: a camera move is not the
    // element moving), else in its parent's own px (an SVG parent: its user units, from its screen matrix).
    const camW = world ? null : el.closest('[data-gm-camera-world]');
    const p = camW || el.offsetParent || el.parentElement;
    let pr = p ? p.getBoundingClientRect() : { left: 0, top: 0, width: W }, pk = 1;
    if (p && p.offsetWidth) pk = pr.width / p.offsetWidth || 1;
    else if (p && p.getScreenCTM) { const m = p.getScreenCTM(); if (m) { const s = Math.hypot(m.a, m.b); if (s > 1e-6) { pk = s; pr = { left: m.e, top: m.f, width: pr.width }; } } }
    const ow = el.offsetWidth || r.width, cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    // blurred already (a whip transition, a blur filter on the move)
    let blurred = 0;
    for (let a = el; a && a !== document.body && !blurred; a = a.parentElement) { const m = /blur\(([\d.]+)px\)/.exec(getComputedStyle(a).filter); if (m && parseFloat(m[1]) >= 2) blurred = 8; }
    if (!el.__gmMoId) { el.__gmMoId = ++id; names[id] = gm.__selector(el); }
    // (and, for a camera world, the middle of the view in its parent's own px)
    out.push([el.__gmMoId, cx, cy, (cx - pr.left) / pk, (cy - pr.top) / pk, pk, r.width, r.height, r.width / (ow || 1), (world ? 1 : 0) | (!world && el.closest('[data-gm-camera-world]') ? 2 : 0) | (cs.offsetPath && cs.offsetPath !== 'none' ? 4 : 0) | blurred, (W / 2 - pr.left) / pk, (H / 2 - pr.top) / pk]);
  }
  window.__gmMoId = id;
  return { els: out, names };
})()`;

// Layout position of every visible text, without transforms (a camera or a tween is not a layout shift): the box's place
// in the layout plus where its first text sits inside the box (a taller inline thing next to the text moves the text).
const PAGE_LAYOUT = String.raw`(() => {
  const W = gm.width, H = gm.height, out = [], names = {}, seen = new Set();
  let id = window.__gmLayId || 0;
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  while (walk.nextNode() && seen.size < 400) {
    const n = walk.currentNode, el = n.parentElement;
    if (!n.data.trim() || !(el instanceof HTMLElement) || seen.has(el)) continue;
    seen.add(el);
    if (el.closest('[data-check~="ignore"],[aria-hidden="true"],[data-gm-internal],[data-gm-hidden]') || (!el.offsetParent && getComputedStyle(el).position !== 'fixed')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible' || parseFloat(cs.opacity) < 0.3) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.right <= 0 || r.bottom <= 0 || r.left >= W || r.top >= H || !el.offsetHeight) continue;
    range.selectNodeContents(n);
    const rc = range.getClientRects()[0];
    if (!rc) continue;
    let y = 0;
    for (let e = el; e instanceof HTMLElement; e = e.offsetParent) y += e.offsetTop;
    y += (rc.top - r.top) / (r.height / el.offsetHeight);
    if (!el.__gmLayId) { el.__gmLayId = ++id; names[id] = gm.__selector(el); }
    out.push([el.__gmLayId, Math.round(y * 10) / 10]);
  }
  window.__gmLayId = id;
  return { els: out, names };
})()`;

// Text that goes up and down by a few px again and again with nothing animating it: something next to it or inside it
// changes the line's height (a caret or icon added and removed, a swap between one line and two). A reflow that happens
// once, a smooth bob, and a swap every couple of seconds are not wobbles: three or more abrupt flips back and forth by the
// same amount, each less than 1.2 s after the last.
export function layoutShiftIssues(samples, names, step) {
  const series = new Map(); // id -> [[sample index, time, y]]
  samples.forEach((s, i) => { for (const [id, y] of s.els) { let a = series.get(id); if (!a) series.set(id, (a = [])); a.push([i, s.t, y]); } });
  const out = [];
  for (const [id, a] of series) {
    const ev = [];
    for (let k = 1; k < a.length; k++) {
      if (a[k][0] !== a[k - 1][0] + 1) continue;
      const d = a[k][2] - a[k - 1][2];
      if (Math.abs(d) >= 1.5 && Math.abs(d) <= 40) ev.push({ t: a[k][1], d });
    }
    const runs = [];
    let run = [];
    const flush = () => { if (run.length >= 3) runs.push(run); run = []; };
    for (const e of ev) {
      const p = run[run.length - 1];
      if (p && e.t - p.t <= 1.2 && Math.sign(e.d) === -Math.sign(p.d) && Math.abs(Math.abs(e.d) - Math.abs(p.d)) <= 2) run.push(e);
      else { flush(); run = [e]; }
    }
    flush();
    if (!runs.length) continue;
    const flips = runs.reduce((n, r) => n + r.length, 0), amp = Math.max(...runs.flat().map((e) => Math.abs(e.d)));
    const ranges = runs.map((r) => [Math.max(0, Math.round((r[0].t - step) * 100) / 100), r[r.length - 1].t]);
    out.push({ severity: 'warning', code: 'layout-shift', selector: names[id], time: ranges[0][0], until: ranges[ranges.length - 1][1], ranges,
      message: `This text moves up and down by ${Math.round(amp * 10) / 10} px (${flips} jumps back and forth) with nothing animating it: something next to it or inside it changes the height of its line.`,
      fix: 'Blink or toggle with opacity or visibility, not display or by adding and removing an element; give the parts that change the same height and vertical-align (a caret: height 1em, vertical-align text-bottom), or a fixed line-height on the box.' });
  }
  return out;
}

// Once: is motion blur off (classic motion, or turned off), and which easing curve each tween and entrance uses.
// Script tweens are read from the page's own scripts (blocks are not the author's choice and are left out).
const PAGE_EASES = String.raw`(async () => {
  const I = gm.__internal, html = document.documentElement, classic = gm.motion === 'classic';
  const off = (v) => v != null && /^(off|0|none|false|no)$/i.test(String(v).trim());
  const blurOff = classic || off(html.getAttribute('data-motion-blur')) || off(I.CONFIG && I.CONFIG.motionBlur);
  const blurExplicitOff = !classic && blurOff;
  const canon = (name) => { try { return I.cssEasing(name); } catch (e) { return String(name); } };
  const list = []; // { ease: canonical or 'natural', name }
  const stepTweens = window.__gmStepTweens = [];
  const add = (name, natural) => list.push(natural ? { ease: 'natural', name: 'default' } : { ease: canon(name), name: String(name) });
  // 1. entrances and exits (data-enter="name [duration] [delay] [easing]")
  for (const el of document.querySelectorAll('[data-enter],[data-exit]')) {
    if (el.closest('[data-gm-include],[data-check~="ignore"]')) continue;
    for (const attr of ['data-enter', 'data-exit']) {
      const v = el.getAttribute(attr);
      if (!v || /^\s*(none)?\s*$/.test(v)) continue;
      const toks = v.trim().split(/\s+/).slice(1), e = toks.find((t) => I.isEasingName(t));
      if (e && /^steps\(/.test(e)) stepTweens.push(gm.__selector(el));
      if (e) { add(e); continue; }
      if (!classic) { add(null, true); continue; }
      // classic default: the curve the entrance animation really has
      let got = null;
      for (const x of [el, ...el.querySelectorAll('*')]) { for (const a of x.getAnimations()) { const tm = a.effect && a.effect.getTiming(); if (tm && tm.easing && tm.easing !== 'linear' && isFinite(tm.duration) && tm.duration < 5000) { got = tm.easing; break; } } if (got) break; }
      if (got) list.push({ ease: got, name: v.trim().split(/\s+/)[0] + ' (preset default)' });
    }
  }
  // 2. CSS animations written in the page (not endless loops)
  for (const a of document.getAnimations()) {
    if (!(typeof CSSAnimation !== 'undefined' && a instanceof CSSAnimation)) continue;
    const t = a.effect && a.effect.target, tm = a.effect.getTiming();
    if (!t || t.closest('[data-gm-include]') || !isFinite(tm.iterations) || tm.iterations > 3 || !(tm.duration <= 3000)) continue;
    const kf = a.effect.getKeyframes(), e = tm.easing !== 'linear' ? tm.easing : (kf[0] && kf[0].easing) || 'ease';
    if (e === 'ease' && !classic) continue; // the CSS default, not a choice
    list.push({ ease: canon(e), name: e });
  }
  // 3. tweens in the page's scripts: .to( .from( .fromTo( .fly( .shot( with their ease (or the timeline's defaults)
  const srcs = [];
  for (const s of document.querySelectorAll('script')) {
    if (s.closest('[data-gm-include]') || (s.type && !/javascript|module|babel|jsx/i.test(s.type))) continue;
    const src = s.getAttribute('src');
    if (!src) srcs.push(s.textContent || '');
    else if (!/^\/?__gm\//.test(src) && !/^(https?:)?\/\//.test(src)) { try { srcs.push(await (await fetch(src)).text()); } catch (e) {} }
  }
  for (let code of srcs) {
    code = code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\x60])\/\/[^\n]*/g, '$1');
    const dm = /defaults\s*:\s*\{[^}]*?\bease\s*:\s*(['"\x60])([^'"\x60]+)\1/.exec(code), def = dm ? dm[2] : null;
    const re = /(\b[A-Za-z_$][\w$]*)?\.(to|from|fromTo|fly|shot)\s*\(/g;
    let m;
    while ((m = re.exec(code))) {
      if (m[1] && /^[A-Z]/.test(m[1])) continue; // Array.from, Buffer.from…
      let i = re.lastIndex, depth = 1, q = null;
      for (; i < code.length && depth; i++) { const c = code[i]; if (q) { if (c === q && code[i - 1] !== '\\') q = null; } else if (c === '"' || c === "'" || c === '\x60') q = c; else if (c === '(') depth++; else if (c === ')') depth--; }
      const args = code.slice(re.lastIndex, i - 1);
      if (!/\{/.test(args)) continue;
      const em = /\bease\s*:\s*(['"\x60])([^'"\x60]+)\1/.exec(args);
      // (a steps() ease: remember the target, to see later how big it is on screen)
      const tg = /^\s*(['"\x60])([^'"\x60]+)\1/.exec(args);
      if (em && tg && /^steps\(|^step-(start|end)$/.test(em[2].trim())) stepTweens.push(tg[2]);
      if (em) add(em[2]);
      else if (/\bease\s*:/.test(args)) continue; // computed: unknown
      else if (def) add(def);
      else if (classic) add(m[2] === 'shot' ? 'in-out-cubic' : 'power1.out');
      else add(null, true);
    }
  }
  return { classic, blurOff, blurExplicitOff, eases: list };
})()`;

/**
 * Robotic motion, from the positions sampled during the check pass. Returns issues:
 * camera-stop (a camera that brakes to a halt between moves and sets off again), fast-no-blur (fast moves with motion
 * blur off), straight-move (long straight diagonal moves), same-ease (one easing curve for nearly everything).
 */
export function motionIssues(samples, names, setup, info, step) {
  const out = [];
  if (!setup) return out;
  const W = info.width, H = info.height, PX = Math.min(W, H) / 1080, fps = info.fps, halfDiag = Math.hypot(W, H) / 2;
  const r2 = (x) => Math.round(x * 100) / 100;
  const tracks = new Map();
  for (const { t, els } of samples) for (const e of els) { if (!tracks.has(e[0])) tracks.set(e[0], []); tracks.get(e[0]).push({ t, sx: e[1], sy: e[2], lx: e[3], ly: e[4], pk: e[5], w: e[6], h: e[7], s: e[8], flags: e[9], vx: e[10], vy: e[11] }); }
  const runsOf = (ts, gap) => { const rs = []; for (const x of ts) { const l = rs[rs.length - 1]; if (l && x - l[1] <= gap) l[1] = x; else rs.push([x, x]); } return rs.map(([a, b]) => [r2(a), r2(b)]); };
  const camStops = [], fast = [], straight = [];
  for (const [id, pts] of tracks) {
    if (pts.length < 4) continue;
    const big = pts[0].flags & 1 || pts[0].w * pts[0].h >= 0.4 * W * H;
    // speed per pair of neighbouring samples (screen px per second); a gap in the samples breaks the series
    const sp = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], dt = b.t - a.t;
      if (dt <= 0 || dt > 0.2) { sp.push(null); continue; }
      let v, dir = null;
      if (big) {
        // a camera (or a big layer moved like one): how fast the picture under the middle of the view slides, and
        // zooms, in its parent's px (a scene transition that moves the parent is not the camera)
        const k0 = a.s / a.pk, k1 = b.s / b.pk;
        const wa = [(a.vx - (a.lx - a.w / a.pk / 2)) / k0, (a.vy - (a.ly - a.h / a.pk / 2)) / k0], wb = [(b.vx - (b.lx - b.w / b.pk / 2)) / k1, (b.vy - (b.ly - b.h / b.pk / 2)) / k1];
        v = ((Math.hypot(wb[0] - wa[0], wb[1] - wa[1]) * k1 + Math.abs(Math.log(k1 / k0)) * halfDiag) * b.pk) / dt;
        // which way it goes: pan (screen px) and zoom (px at the frame corner), to tell a turn-around from a stop
        dir = { x: (wb[0] - wa[0]) * k1, y: (wb[1] - wa[1]) * k1, z: Math.log(k1 / k0) * halfDiag };
      } else v = (Math.hypot(b.lx - a.lx, b.ly - a.ly) * b.pk) / dt;
      sp.push({ t: (a.t + b.t) / 2, v, i, blurred: (a.flags & 8) && (b.flags & 8), dir });
    }
    // 1. a camera that stops dead between two moves: the speed drops to almost nothing and comes back within ~0.45 s
    if (pts[0].flags & 1 && step <= 0.15) {
      for (let k = 1; k < sp.length - 1; k++) {
        const c = sp[k];
        if (!c) continue;
        let pb = 0, pa = 0, okB = true, okA = true;
        for (let q = k - 1; q >= 0 && sp[q] && c.t - sp[q].t <= 0.7; q--) pb = Math.max(pb, sp[q].v);
        for (let q = k + 1; q < sp.length && sp[q] && sp[q].t - c.t <= 0.7; q++) pa = Math.max(pa, sp[q].v);
        const minPeak = Math.min(pb, pa);
        if (!(minPeak >= 250 * PX) || c.v > 0.12 * minPeak) continue;
        // how long it stays stopped
        let a = k, b = k;
        while (a > 0 && sp[a - 1] && sp[a - 1].v <= 0.12 * minPeak) a--;
        while (b < sp.length - 1 && sp[b + 1] && sp[b + 1].v <= 0.12 * minPeak) b++;
        // A move that turns around (zooms in, then straight back out; pans one way, then back) passes through zero
        // speed for an instant: that is one blended move, not a stop (a real stop dwells, or goes on the same way).
        const before = sp[a - 1], after = sp[b + 1];
        let turn = false;
        if (before && after && before.dir && after.dir && b - a + 1 <= 2) {
          const d0 = before.dir, d1 = after.dir, p0 = Math.hypot(d0.x, d0.y), p1 = Math.hypot(d1.x, d1.y);
          if (Math.abs(d0.z) > p0 && Math.abs(d1.z) > p1) turn = Math.sign(d0.z) !== Math.sign(d1.z);
          else if (p0 > 0 && p1 > 0) turn = (d0.x * d1.x + d0.y * d1.y) / (p0 * p1) < -0.5;
        }
        if (okB && okA && !turn && sp[b].t - sp[a].t <= 0.45) camStops.push({ id, t: r2((sp[a].t + sp[b].t) / 2) });
        k = b + 1;
      }
    }
    // 2. fast moves with no motion blur (per-frame displacement)
    if (setup.blurOff && (big || pts[0].w * pts[0].h >= 0.005 * W * H)) {
      for (let k = 0; k < sp.length; k++) { const c = sp[k]; if (c && !c.blurred && c.v / fps >= 40 * PX) fast.push({ id, t: c.t, d: c.v / fps }); }
    }
    // 3. long straight diagonal moves of an element (not the camera, not along a path)
    if (!big && !(pts[0].flags & 4)) {
      for (let k = 0; k < sp.length; k++) {
        if (!sp[k] || sp[k].v < 80 * PX) continue;
        // (a sharp turn starts a new leg)
        const dir = (q) => { const a = pts[sp[q].i - 1], b = pts[sp[q].i]; return Math.atan2(b.ly - a.ly, b.lx - a.lx); };
        const turn = (q) => { let d = Math.abs(dir(q) - dir(q - 1)); if (d > Math.PI) d = 2 * Math.PI - d; return d > 0.6; };
        let e = k; while (e + 1 < sp.length && sp[e + 1] && sp[e + 1].v >= 80 * PX && !turn(e + 1)) e++;
        const P = pts.slice(sp[k].i - 1, sp[e].i + 1).map((p) => [p.lx * p.pk, p.ly * p.pk]);
        const [x0, y0] = P[0], [x1, y1] = P[P.length - 1], L = Math.hypot(x1 - x0, y1 - y0);
        if (P.length >= 4 && L >= 0.25 * W && Math.min(Math.abs(x1 - x0), Math.abs(y1 - y0)) >= 0.25 * L) {
          let dev = 0;
          for (const [x, y] of P) dev = Math.max(dev, Math.abs((x - x0) * (y1 - y0) - (y - y0) * (x1 - x0)) / L);
          if (dev <= 0.015 * L) straight.push({ id, t0: r2(pts[sp[k].i - 1].t), t1: r2(pts[sp[e].i].t), L: Math.round(L / PX) });
        }
        k = e;
      }
    }
  }
  const classicNote = setup.classic ? ' (data-motion="classic")' : '';
  if (camStops.length) {
    const byId = new Map(); for (const c of camStops) { if (!byId.has(c.id)) byId.set(c.id, []); byId.get(c.id).push(c.t); }
    for (const [id, ts] of byId) out.push({ severity: 'warning', code: 'camera-stop', selector: names[id], time: ts[0], until: ts[ts.length - 1], ranges: ts.map((t) => [t, t]),
      message: `The camera stops dead between moves at ${ts.slice(0, 5).map((t) => t.toFixed(1) + ' s').join(', ')}${ts.length > 5 ? ', …' : ''} (brakes to a halt, then sets off again)${classicNote}.`,
      fix: setup.classic ? 'drop data-motion="classic" so gm.camera blends back-to-back shots, or hold each shot 0.5 s+ on purpose.' : 'chain the moves so the camera keeps moving (back-to-back gm.camera shots, one tween with keyframes), or hold each shot 0.5 s+ on purpose.' });
  }
  if (fast.length) {
    const worst = fast.reduce((a, b) => (b.d > a.d ? b : a));
    const ranges = runsOf(fast.map((f) => f.t).sort((a, b) => a - b), 0.25).filter(([a, b]) => b - a >= 0.05 || fast.filter((f) => f.t >= a - 0.01 && f.t <= b + 0.01).length >= 2);
    if (ranges.length) out.push({ severity: 'warning', code: 'fast-no-blur', selector: names[worst.id], time: ranges[0][0], until: ranges[ranges.length - 1][1], ranges,
      message: `Moves ${Math.round(worst.d / PX)} px per frame (at 1080p) with no motion blur: it strobes${classicNote}.`,
      fix: setup.blurExplicitOff ? 'remove data-motion-blur="off" (fast moves get motion blur by default), or slow the move down.' : 'render with --motion-blur 8, or drop data-motion="classic" (natural motion blurs fast moves).' });
  }
  if (straight.length) {
    const seen = new Set(), list = straight.filter((s) => (seen.has(s.id) ? false : seen.add(s.id)));
    out.push({ severity: 'warning', code: 'straight-move', selector: names[list[0].id], time: list[0].t0, until: list[0].t1, ranges: list.slice(0, 6).map((s) => [s.t0, s.t1]).sort((a, b) => a[0] - b[0]),
      message: `${list.slice(0, 3).map((s) => names[s.id]).join(', ')}${list.length > 3 ? ` and ${list.length - 3} more` : ''} ${list.length > 1 ? 'move' : 'moves'} ${list[0].L} px on a dead-straight diagonal (real things travel on slight arcs)${classicNote}.`,
      fix: setup.classic ? 'drop data-motion="classic" (moves arc by default), or move along a curve with gm.path.travel.' : 'remove arc: 0, or move along a curve with gm.path.travel (or keyframes through an offset midpoint).' });
  }
  // 4. one easing curve for nearly everything (springs and the natural defaults are not curves of that kind)
  const eases = setup.eases || [];
  if (eases.length >= 8) {
    const count = new Map();
    for (const e of eases) if (/^cubic-bezier\(/.test(e.ease)) count.set(e.ease, (count.get(e.ease) || 0) + 1);
    const top = [...count].sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] / eases.length > 0.9) {
      const name = eases.find((e) => e.ease === top[0]).name;
      out.push({ severity: 'warning', code: 'same-ease', time: null, message: `${top[1]} of ${eases.length} tweens and entrances use the same curve (${name}): everything moves like one machine${classicNote}.`,
        fix: setup.classic ? "drop data-motion=\"classic\" (natural motion gives moves springs), or vary the eases: 'spring'/'out-back' for arrivals, 'in-*' for exits, 'in-out-sine' for long moves." : "leave ease out for the natural spring default, or vary it: 'spring'/'out-back' for arrivals, 'in-*' for exits, 'in-out-sine' for long moves." });
    }
  }
  return out;
}

/**
 * Pacing per element, from the PAGE_PACING samples. Returns issues:
 * short-hold (a text or mark readable for less time than it takes to read it), cut-exit (fully on screen, then gone in
 * one step while its scene goes on), sliver-start (a clip-path start state that leaves a sliver showing before the
 * entrance). `range`: { from, to, lastT, duration } of the pass.
 */
export function pacingIssues(samples, meta, pops, range) {
  const out = [];
  if (!samples.length) return out;
  const r2 = (x) => Math.round(x * 100) / 100;
  const T = samples.map((s) => s.t), n = T.length;
  const startOpen = range.from > 1e-6, endOpen = range.to < range.lastT - 1e-6;
  const where = (m) => (m && m.scene ? { scene: m.scene, sceneStart: m.sceneStart } : {});
  // 1. short-hold
  const tracks = new Map();
  samples.forEach((s, i) => {
    for (const [id, state, reason, big, live, x, y, w, h] of s.units) {
      if (!tracks.has(id)) tracks.set(id, { st: new Array(n).fill(0), why: new Array(n).fill(''), box: new Array(n).fill(null), big: false, live: false });
      const tr = tracks.get(id); tr.st[i] = state; tr.why[i] = reason; if (w != null) tr.box[i] = { x, y, w, h };
      if (state === 2 && big) tr.big = true; if (live) tr.live = true;
    }
  });
  const ENDS = { moving: 'it starts to move away', fading: 'it starts to fade', hidden: 'it is wiped or moved out of view', cropped: 'it goes out of frame', covered: 'something covers it', cut: 'it is cut away', swap: 'it is swapped for something else in its place', scene: 'its scene ends', end: 'the video ends' };
  const holds = [];
  for (const [id, tr] of tracks) {
    const m = meta[id];
    if (!m || m.quick || m.live || (m.kind === 'text' && (tr.live || !tr.big || m.words < 1))) continue;
    // runs of readable samples; short breaks while it stays on screen (an emphasis pop, a nudge) do not end them
    const runs = [];
    for (let i = 0; i < n; i++) {
      if (tr.st[i] !== 2) continue;
      let j = i; while (j + 1 < n && tr.st[j + 1] === 2) j++;
      const last = runs[runs.length - 1];
      if (last && T[i] - T[last[1]] <= 0.5 && tr.st.slice(last[1] + 1, i).every((s, k) => s === 1 && tr.why[last[1] + 1 + k] !== 'covered')) last[1] = j;
      else runs.push([i, j]);
      i = j;
    }
    if (!runs.length) continue;
    let best = null, open = false;
    for (const [a, b] of runs) {
      if ((a === 0 && startOpen) || (b === n - 1 && endOpen)) open = true; // it may go on outside the range
      const s0 = a === 0 ? T[0] : (T[a - 1] + T[a]) / 2, e0 = b === n - 1 ? range.duration : (T[b] + T[b + 1]) / 2;
      const why = b === n - 1 ? 'end' : tr.st[b + 1] === 0 ? tr.why[b + 1] || 'cut' : tr.why[b + 1] || 'moving';
      // (how long it stays on screen while it moves on: a cursor, a ball, a card travelling on is not leaving)
      let c = b + 1; while (c < n && tr.st[c] === 1 && tr.why[c] === 'moving') c++;
      const stay = (c >= n ? range.duration : T[c]) - s0, swapped = c < n && tr.st[c] === 0 && tr.why[c] === 'swap';
      if (!best || e0 - s0 > best.d) best = { d: e0 - s0, s0, e0, why, a, b, stay, swapped, first: tr.box[a], last: tr.box[b], skip: false, inTurns: false };
    }
    holds.push({ id, m, open, ...best });
  }
  // A copy that carries the same text on (the next scene's first frame, a ghost that flies off): one hold.
  const norm = (x) => (x || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  for (const a of holds) for (const b of holds) {
    if (a === b || a.skip || b.skip || !norm(a.m.text) || norm(a.m.text) !== norm(b.m.text)) continue;
    if (b.s0 >= a.e0 - 0.3 && b.s0 <= a.e0 + 0.15) { a.d += b.d; a.why = b.why; b.skip = true; }
  }
  // Texts that take turns in one place (captions, a word-by-word kinetic line, a ticker of words): the eye stays
  // there and reads on, so a quick pace is the point. Three or more in a row, each replaced within ~0.4 s.
  // (a caption of two lines replaces one of one line: the boxes overlap, the heights are within about 2x)
  const overlap = (p, q) => !!(p && q) && Math.max(0, Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x)) * Math.max(0, Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y)) >= 0.3 * Math.min(p.w * p.h, q.w * q.h) && Math.min(p.h, q.h) / Math.max(p.h, q.h) >= 0.45;
  const root = new Map(), find = (x) => { while (root.get(x) !== x) x = root.get(x); return x; };
  for (const h of holds) root.set(h, h);
  for (const a of holds) for (const b of holds) {
    if (a === b || a.m.kind !== 'text' || b.m.kind !== 'text') continue;
    if (b.s0 > a.s0 && b.s0 >= a.e0 - 0.3 && b.s0 <= a.e0 + 0.4 && overlap(a.last, b.first)) root.set(find(b), find(a));
  }
  const size = new Map();
  for (const h of holds) size.set(find(h), (size.get(find(h)) || 0) + 1);
  for (const h of holds) if (size.get(find(h)) >= 3) h.inTurns = true;
  for (const h of holds) {
    const { m } = h;
    // (cropped by the frame: text-offscreen speaks for it)
    // (swapped in place: a state change, read as one thing changing)
    if (h.skip || h.inTurns || h.open || h.swapped || (h.why === 'covered' && m.overlapOk) || h.why === 'cropped') continue;
    const need = m.kind === 'text' ? 1 + 0.25 * Math.min(m.words, 12) : 1;
    if (h.d >= need * 0.7 || h.d >= need - 0.25 || (h.why === 'moving' && h.stay >= need)) continue;
    const what = m.kind === 'text' ? `a ${m.words}-word text` : 'an icon or picture';
    out.push({ severity: 'warning', code: 'short-hold', selector: m.sel, ...(m.text ? { text: m.text } : {}), ...where(m), time: r2(T[h.a]), until: r2(T[h.b]), ranges: [[r2(T[h.a]), r2(T[h.b])]],
      message: `Readable for only ~${h.d.toFixed(1)} s (from ${h.s0.toFixed(1)} s, when it is in, until ${ENDS[h.why] || 'it leaves'}); ${what} needs ~${need.toFixed(1)} s to be read.`,
      fix: 'Give it a planned life: in, a hold long enough to read (~1 s + 0.25 s per word, 1 s for an icon), then its way out. Start its exit (or what covers it, or the scene change) later, bring it in sooner, or cut words. If it is meant to flash by, add data-check="quick-ok".' });
  }
  // 2. cut-exit
  const seen = new Set();
  for (const p of pops) {
    const k = p.sel + '|' + p.t.toFixed(2);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ severity: 'warning', code: 'cut-exit', selector: p.sel, ...(p.text ? { text: p.text } : {}), ...where(p), time: r2(p.t), ranges: [[r2(p.t), r2(p.t)]],
      message: `Was fully on screen, then vanishes by a cut (no exit) at ~${p.t.toFixed(1)} s while its scene goes on.`,
      fix: 'Give it a data-exit (or an exit tween: out over 0.2-0.4 s), move it into the next scene (data-morph, gm.fly), or hold it to the end of its scene.' });
  }
  // 3. sliver-start
  const clips = new Map();
  samples.forEach((s, i) => { for (const [id, f, dimOk] of s.clips || []) { if (!clips.has(id)) clips.set(id, new Array(n).fill(null)); clips.get(id)[i] = f < 0 ? null : { f, dimOk }; } });
  for (const [id, fs] of clips) {
    const i0 = fs.findIndex((x) => x);
    if (i0 < 0 || (i0 === 0 && startOpen)) continue;
    const f0 = fs[i0];
    if (!(f0.f > 0 && f0.f <= 0.1 && f0.dimOk)) continue;
    let j = i0; while (j + 1 < n && fs[j + 1] && Math.abs(fs[j + 1].f - f0.f) <= 0.02) j++;
    if (T[j] - T[i0] < 0.2 - 1e-6) continue;
    let opens = false;
    for (let k = j + 1; k < n && fs[k]; k++) if (fs[k].f >= 0.9) { opens = true; break; }
    if (!opens) continue;
    const m = meta['c' + id] || {};
    out.push({ severity: 'warning', code: 'sliver-start', selector: m.sel, ...where(m), time: r2(T[i0]), until: r2(T[j]), ranges: [[r2(T[i0]), r2(T[j])]],
      message: `Before its entrance, ${Math.max(1, Math.round(f0.f * 100))}% of it already shows (its start state clip-path: ${m.cp || '…'} leaves a sliver): it reads as a glitch.`,
      fix: 'Make the start state hide it completely: inset(50%) (or inset(50% 0) / inset(0 50%) to open from the middle), opacity: 0 or scale: 0, until the entrance.' });
  }
  return out;
}

// Once: an element with a CSS `scale` property that a gm.timeline also tweens with scale. The timeline writes
// `transform`, which the browser applies on top of the individual property: scale: 0 in CSS and a tween to scale 1
// multiply to 0, so the element never shows. (translate and rotate add up, which is often meant: translate: -50% -50%
// for centering plus a tweened x, a resting tilt plus a tweened rotate.)
const PAGE_CSS_VS_TWEEN = String.raw`(() => {
  if (!gm.__tweenedTransforms) return [];
  const list = gm.__tweenedTransforms(), out = [], seen = new Set();
  if (!list.length) return out;
  const rules = [];
  const visit = (rs) => { for (const r of rs) { if (r.selectorText != null && r.style && r.style.scale) rules.push(r); if (r.cssRules) visit(r.cssRules); } };
  for (const sh of document.styleSheets) { try { visit(sh.cssRules); } catch (e) {} }
  const declared = (el, prop) => {
    const own = el.getAttribute('style') || '';
    const m = new RegExp('(^|;)\\s*' + prop + '\\s*:\\s*([^;]+)').exec(own);
    if (m && !el.closest('[data-morph]')) return m[2].trim();
    let v = null;
    for (const r of rules) { const x = r.style.getPropertyValue(prop); if (!x) continue; try { if (el.matches(r.selectorText)) v = x.trim(); } catch (e) {} }
    return v;
  };
  for (const { el, props } of list) {
    if (seen.has(el) || el.closest('[data-check~="ignore"],[data-gm-internal]')) continue;
    for (const [css, tw] of [['scale', ['scale', 'scaleX', 'scaleY']]]) {
      const used = props.filter((p) => tw.includes(p));
      if (!used.length) continue;
      const v = declared(el, css);
      if (!v || v === 'none' || /^1(\s+1)*$/.test(v)) continue;
      seen.add(el);
      out.push({ severity: 'warning', code: 'css-scale-vs-tween', selector: gm.__selector(el), time: null,
        message: 'This element has CSS ' + css + ': ' + v + ' and a gm.timeline tween on ' + used.join('/') + '. The timeline writes transform, which the browser combines with the ' + css + ' property: they multiply, so scale: 0 in CSS stays 0 whatever the tween does.',
        fix: 'Remove ' + css + ' from the CSS and give the start value to the timeline instead (fromTo / from, or gm.set), or set it with transform in the CSS.' });
      break;
    }
  }
  return out;
})()`;

const PAGE_HIDE_TEXT =`(() => { let s = document.getElementById('__gm_hide'); if (!s) { s = document.createElement('style'); s.id='__gm_hide'; document.head.appendChild(s); }
  s.textContent = '*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;-webkit-text-stroke-color:transparent!important;caret-color:transparent!important;text-decoration-color:transparent!important} text,text *{fill:transparent!important;stroke:transparent!important} .gm-caret{visibility:hidden!important}';
  return true; })()`;
const PAGE_SHOW_TEXT = `(() => { const s = document.getElementById('__gm_hide'); if (s) s.remove(); return true; })()`;

function contrastScript(dataUrl, scale) {
  return `(async () => {
  const img = new Image(); img.src = ${JSON.stringify(dataUrl)}; await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const S = ${scale};
  const lum = (r, g2, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g2) + 0.0722 * f(b); };
  // Any CSS color (rgb, hsl, oklab, color-mix…) → sRGB bytes, by painting one pixel.
  const pc = document.createElement('canvas'); pc.width = pc.height = 1; const pg = pc.getContext('2d', { willReadFrequently: true });
  const parse = (s) => { pg.clearRect(0, 0, 1, 1); pg.fillStyle = '#000'; pg.fillStyle = s; pg.fillRect(0, 0, 1, 1); const d = pg.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const res = [];
  for (const b of window.__gmTextBoxes || []) {
    const samples = [];
    for (const [x, y, w, h] of b.rects) {
      const X = Math.max(0, Math.floor(x * S)), Y = Math.max(0, Math.floor(y * S)), Wd = Math.min(c.width - X, Math.ceil(w * S)), Hd = Math.min(c.height - Y, Math.ceil(h * S));
      if (Wd <= 0 || Hd <= 0) continue;
      const d = g.getImageData(X, Y, Wd, Hd).data;
      const step = Math.max(1, Math.floor((Wd * Hd) / 4000));
      for (let i = 0; i < Wd * Hd; i += step) samples.push([d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3]]);
    }
    if (b.flat) { const f = parse(b.flat); samples.length = 0; samples.push([f[0], f[1], f[2], 255]); }
    if (!samples.length) continue;
    const [r, gg, bb, a0] = parse(b.color);
    const a = a0 * b.op;
    const opaque = samples.filter((p) => p[3] >= 128);
    if (opaque.length < samples.length * 0.5) continue; // transparent background (overlay render): nothing to judge against
    const ratios = opaque.map(([R, G, B]) => {
      const tr = r * a + R * (1 - a), tg = gg * a + G * (1 - a), tb = bb * a + B * (1 - a);
      const L1 = lum(tr, tg, tb), L2 = lum(R, G, B);
      return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    }).sort((x, y) => x - y);
    const low = ratios[Math.floor(ratios.length * 0.1)];   // the darkest/brightest 10% behind the text
    const typical = ratios[Math.floor(ratios.length * 0.5)];
    // Targets (WCAG): 4.5:1 for normal text, 3:1 for large text (>= 24px, or bold >= 18.66px at 1080p),
    // 1.6:1 when the text has its own shadow or outline. Error below 2/3 of the target.
    const need = b.backed ? 1.6 : b.large ? 3 : 4.5;
    const kind = b.backed ? 'text with a shadow/outline' : b.large ? 'large text' : 'normal text';
    const partly = typical >= need && typical < need * 1.5 && low < need * 0.66;
    if (typical < need || partly) {
      const val = partly ? low : typical;
      // a passing color in the same hue: the text color mixed toward white or black (whichever gains contrast against
      // the typical background), so the fix is one edit
      let suggest = null;
      if (!partly) {
        const mid = opaque.slice().sort((x, y) => lum(x[0], x[1], x[2]) - lum(y[0], y[1], y[2]))[opaque.length >> 1], Lb = lum(mid[0], mid[1], mid[2]);
        const ratio = (q) => { const L = lum(q[0], q[1], q[2]); return (Math.max(L, Lb) + 0.05) / (Math.min(L, Lb) + 0.05); };
        for (const dir of lum(r, gg, bb) >= Lb ? [1, -1] : [-1, 1]) {
          for (let k = 1; k <= 40 && !suggest; k++) {
            const t = k / 40, q = dir > 0 ? [r + (255 - r) * t, gg + (255 - gg) * t, bb + (255 - bb) * t] : [r * (1 - t), gg * (1 - t), bb * (1 - t)];
            if (ratio(q) >= need * 1.05) suggest = '#' + q.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
          }
          if (suggest) break;
        }
      }
      res.push({ severity: val < need * 0.66 ? 'error' : 'warning', code: 'low-contrast', selector: b.sel, text: b.text,
        message: (partly ? 'Parts of this text have low contrast (' + low.toFixed(1) + ':1 where the background is busiest, ' + typical.toFixed(1) + ':1 typical)' : 'Text contrast is ' + typical.toFixed(1) + ':1') + '. Target for ' + kind + ' is ' + need + ':1.',
        fix: partly ? 'Put a solid or semi-opaque backing behind the text, or add a text-shadow.' : (suggest ? 'Use color: ' + suggest + ' (the same hue, passes here), or add a backing or a text-shadow.' : 'Use a lighter/darker text color, add a backing, or a text-shadow.'), suggest, sig: partly ? null : b.sig });
    }
  }
  return res;
})()`;
}

/** Pick moments worth looking at: each clip once it has settled (late in the clip, before it leaves). */
function keyTimes(info, max = 12) {
  const fps = info.fps, dur = info.duration;
  const lastT = Math.max(0, dur - 1 / fps);
  const set = new Set();
  const add = (t) => set.add(Math.round(Math.min(lastT, Math.max(0, t)) * fps) / fps);
  const clips = info.clips.filter((c) => c.end - c.start > 0.3);
  if (!clips.length) { for (let i = 0; i < 6; i++) add((dur * (i + 0.5)) / 6); }
  for (const c of clips) {
    const d = c.end - c.start;
    // ~85% through the clip: entrances are done, exits/transitions have not started yet
    add(c.start + Math.max(Math.min(d * 0.85, d - 0.75), Math.min(d * 0.5, 1)));
    // long clips (one long scene driven by code) also get evenly spaced moments
    if (d > 4.5) { const n = Math.min(8, Math.floor(d / 1.2)); for (let k = 1; k <= n; k++) add(c.start + (d * k) / (n + 1)); }
  }
  // one long camera scene: each shot once the camera has arrived (and before it leaves)
  for (const c of info.cameraShots || []) {
    const end = c.next ?? dur;
    if (end - c.arrive > 0.25) add(Math.min(c.arrive + Math.max(0.3, (end - c.arrive) * 0.6), end - 0.1));
  }
  add(Math.min(0.5, dur / 2));
  add(lastT);
  let times = [...set].sort((a, b) => a - b);
  times = times.filter((t, i) => i === 0 || t - times[i - 1] > 0.25);
  while (times.length > max) {
    let bi = 1, bd = Infinity;
    for (let i = 1; i < times.length - 1; i++) { const dd = times[i + 1] - times[i - 1]; if (dd < bd) { bd = dd; bi = i; } }
    times.splice(bi, 1);
  }
  return times;
}

/**
 * Check a composition for problems. Returns { ok, errors, warnings, issues, info }.
 */
/**
 * @param {Input} input
 * @param {import('./types/api.js').CheckOptions} [opts]
 * @returns {Promise<import('./types/api.js').CheckReport>}
 */
export async function check(input, opts = {}) {
  // The pictures check takes (the pacing grid, contrast under text) are small or sampled: drawn at half the pixels they
  // give the same report, and a heavy page (big blurs, a 3D world) checks ~3x faster. Layout is in CSS px either way.
  if (opts.scale == null) opts = { ...opts, scale: 0.5 };
  const ctx = await openComposition(input, { ...opts, mode: 'render' });
  /** @type {any[]} */
  const issues = [];
  await autoTransparent(ctx, opts);
  const push = (arr, t) => { for (const i of arr) issues.push({ time: t == null ? i.time ?? null : Math.round(t * 100) / 100, ...i }); };
  /** @type {any[]} the other browsers of a long pass */
  const extraPages = [];
  try {
    const info = ctx.info;
    push(info.issues);
    const fps = info.fps;
    const lastT = Math.max(0, info.duration - 1 / fps);
    // A pass over the video, split over browsers for a long one (a seek gives the same page whatever came before, as
    // for a render's workers). Elements that are moving (seen by comparing samples) are skipped; problems must last
    // 2 samples to count.
    const from = opts.from != null ? Math.max(0, +opts.from) : 0, to = opts.to != null ? Math.min(lastT, +opts.to) : lastT;
    const step = opts.at != null ? 1 / fps : Math.max(1 / fps, Math.min(opts.fast ? 0.25 : 0.12, info.duration / 300));
    const planned = new Set();
    if (opts.at != null) { const at = +opts.at; for (const d of [-2, -1, 0]) planned.add(Math.round(Math.max(0, at + d / fps) * fps) / fps); }
    else {
      for (let t = from; t <= to + 1e-9; t += step) planned.add(Math.round(t * fps) / fps);
      for (const k of keyTimes(info, 24)) if (k >= from && k <= to) planned.add(k);
    }
    const times = [...planned].sort((a, b) => a - b);
    const contrastEvery = opts.at != null ? 0 : Math.max((to - from) / (opts.contrastSamples || 10), 0.4);
    const full = opts.at == null;
    // Pacing: a tiny grey picture of the frame every half second finds long stretches where nothing moves.
    const GW = 192, GH = 108;
    const pace = full && opts.pacing !== false;
    const GRID_JS = `window.__gmGrid = async (src) => { const im = new Image(); im.src = src; await im.decode(); const c = document.createElement('canvas'); c.width = ${GW}; c.height = ${GH}; const g = c.getContext('2d'); g.drawImage(im, 0, 0, ${GW}, ${GH}); const d = g.getImageData(0, 0, ${GW}, ${GH}).data; const o = new Array(${GW * GH}); for (let i = 0, j = 0; i < d.length; i += 4, j++) o[j] = (54 * d[i] + 183 * d[i + 1] + 19 * d[i + 2]) >> 8; return o; }`;
    // (the samples that take a grid picture: every ~0.5 s, fixed by the sample times alone)
    const gridAt = new Set();
    if (pace) { let lg = -Infinity; times.forEach((t, i) => { if (t - lg >= 0.49) { gridAt.add(i); lg = t; } }); }
    // robotic motion: where the moving things are at every sample, and the easing curves in use
    const watchMotion = full && opts.motion !== false;
    const setupPage = async (page) => {
      if (pace) await page.evaluate(GRID_JS);
      // (also lists the tweens with a steps() ease for the pacing pass)
      if (watchMotion) { try { return await page.evaluate(PAGE_EASES); } catch (e) { return null; } }
      return null;
    };
    const moSetup = await setupPage(ctx.page);
    if (full) { try { push(await ctx.page.evaluate(PAGE_CSS_VS_TWEEN)); } catch (e) {} }

    // The pass over the video, in units: runs of neighbouring samples, ~4 s of video each. Their bounds depend on the
    // video only, and each unit gives the same results on any browser (a unit that does not follow the one its browser
    // just did first replays the sample before it and the samples since the last grid picture, all the page and the
    // pass carry from one sample to the next), so 1 browser and N browsers report the same.
    const units = [];
    {
      const per = full ? Math.max(24, Math.round(4 / step)) : times.length;
      for (let i = 0; i < times.length; i += per) units.push({ i0: i, i1: Math.min(times.length, i + per) });
      if (units.length > 1 && units[units.length - 1].i1 - units[units.length - 1].i0 < per / 2) units[units.length - 2].i1 = units.pop().i1;
    }
    // where a unit's warm-up starts: one sample before the sample before it, or before the last grid picture before it
    // if that is earlier (like a render part, the first frame drawn after a jump is not one that is used)
    const warmStart = (U) => { let i = U.i0 - 1; if (pace) { let g = U.i0 - 1; while (g > 0 && !gridAt.has(g)) g--; i = Math.min(i, g); } return Math.max(0, i - 1); };
    // Chrome keeps raster state from frames drawn before (a layer keeps the scale it was first drawn at): every browser
    // drops it at these samples, the one that plays through and the one that jumps in alike, so grid and contrast
    // pictures after them do not depend on which frames a browser drew before
    const resetAt = new Set(units.filter((U) => U.i0 > 0).map(warmStart));
    const analyzeAt = (P, t) => P.page.evaluate(`(${PAGE_ANALYZE})(${P.prevT == null ? 0 : t - P.prevT}, ${JSON.stringify({ safeZone: opts.safeZone || null, t })})`);
    /** One unit on one page; P is that page's state from sample to sample. */
    const runUnit = async (P, U) => {
      /** @type {any} */
      const R = { U, perSample: [], pace: [], layout: [], motion: [], pops: [], change: [], openFrames: [], emptyGrid: [], boxes: [], meta: {}, sigs: {}, noBox: [], steps: [], logs: [], contrast: null };
      let i = U.i0;
      if (P.cursor !== U.i0 - 1) {
        // warm-up: the sample before, and back to the last grid picture (what entered or moved since it counts)
        i = warmStart(U);
        P.prevT = null; P.lastGrid = null; P.busy = new Map(); P.lastOut = [];
      }
      for (; i < U.i1; i++) {
        const t = times[i], own = i >= U.i0 && (full || Math.abs(t - +opts.at) <= 0.5 / fps);
        await P.page.seek(t);
        if (resetAt.has(i)) await P.page.resetPaint(true);
        const a = await analyzeAt(P, t);
        if (full) {
          try {
            const pc = await P.page.evaluate(`(${PAGE_PACING})(${P.prevT == null ? 0 : t - P.prevT}, ${t})`);
            for (const [id, m] of Object.entries(pc.meta)) P.meta[id] = { ...m, t };
            if (own) { R.pace.push({ t, units: pc.units, clips: pc.clips }); R.pops.push(...pc.pops); }
          } catch (e) {}
        }
        P.prevT = t;
        if (full) { try { const l = await P.page.evaluate(PAGE_LAYOUT); Object.assign(P.layNames, l.names); if (own) R.layout.push({ t, els: l.els }); } catch (e) {} }
        if (moSetup) { try { const m = await P.page.evaluate(PAGE_MOTION); Object.assign(P.moNames, m.names); if (i >= U.i0) R.motion.push({ t, els: m.els }); } catch (e) {} }
        if (!own) { if (i < U.i0) for (const [id, share] of a.busy || []) P.busy.set(id, Math.max(P.busy.get(id) || 0, share)); }
        else { R.perSample.push({ t, issues: a.issues }); R.boxes.push(a.boxes ? 1 : 0); for (const [id, share] of a.busy || []) P.busy.set(id, Math.max(P.busy.get(id) || 0, share)); }
        if (gridAt.has(i)) {
          const jpg = await P.page.capture('jpeg', 60);
          const g = await P.page.evaluate(`window.__gmGrid('data:image/jpeg;base64,${jpg.toString('base64')}')`);
          if (own) {
            const srt = [...g].sort((x, y) => x - y), med = srt[srt.length >> 1]; let off = 0; for (const v of g) if (Math.abs(v - med) > 10) off++;
            // (the opening frame: empty = no readable text and almost no edges; a smooth gradient or a flat color is empty)
            if (t < 0.6) { let edge = 0; for (let k = 0; k < g.length; k++) if ((k % GW < GW - 1 && Math.abs(g[k] - g[k + 1]) > 12) || (k + GW < g.length && Math.abs(g[k] - g[k + GW]) > 12)) edge++; R.openFrames.push({ t, empty: edge / g.length < 0.004 && !(a.maxFont >= 24) }); }
            R.emptyGrid.push([t, off / g.length < 0.015 && !(a.maxFont >= 24)]);
            // (cells under data-check="pace-ignore", now or at the last grid, are left out)
            const out = [...P.lastOut, ...(a.paceOut || [])].map(([l, tp, r, b]) => [Math.floor(l * GW), Math.floor(tp * GH), Math.ceil(r * GW), Math.ceil(b * GH)]);
            if (P.lastGrid) {
              let n = 0, all = 0;
              for (let k = 0; k < g.length; k++) {
                const x = k % GW, y = (k / GW) | 0;
                if (out.length && out.some(([l, tp, r, b]) => x >= l && x < r && y >= tp && y < b)) continue;
                all++;
                if (Math.abs(g[k] - P.lastGrid[k]) > 6) n++;
              }
              let share = 0; for (const v of P.busy.values()) share += v;
              R.change.push([t, all ? n / all : 0, Math.min(1, share)]);
            }
          }
          P.lastGrid = g; P.busy = new Map(); P.lastOut = a.paceOut || [];
        }
        // --at: the contrast picture of that moment
        if (!full && own && a.boxes) R.contrast = { t, issues: await contrastNow(P.page) };
      }
      P.cursor = U.i1 - 1;
      // what the page gathered over the unit: contrast signatures, display: contents notes, stepped moves, logs
      {
        try {
          const g = await P.page.evaluate(`(() => { const r = { sigs: window.__gmSigs || {}, noBox: [...(window.__gmNoBox || new Map()).values()], steps: window.__gmPace ? [...window.__gmPace.steps.values()] : [] }; window.__gmSigs = {}; window.__gmNoBox = new Map(); if (window.__gmPace) window.__gmPace.steps = new Map(); return r; })()`);
          R.sigs = g.sigs; R.noBox = g.noBox; R.steps = g.steps;
        } catch (e) {}
      }
      try { const lg = await P.page.evaluate(`window.gm && gm.__logs ? gm.__logs(${P.logN}) : []`); P.logN += lg.length; R.logs = lg; } catch (e) {}
      // the page's own ids → selectors (the same element on every page)
      const pick = (names, id) => names[id] ?? null;
      R.pace = R.pace.map((s) => ({ t: s.t, units: s.units.map((u) => [pick(P.meta, u[0]) ? P.meta[u[0]].sel : null, ...u.slice(1)]).filter((u) => u[0] != null), clips: (s.clips || []).map((c) => [P.meta['c' + c[0]] ? P.meta['c' + c[0]].sel : null, ...c.slice(1)]).filter((c) => c[0] != null) }));
      R.pops = R.pops.map((p) => ({ ...p, id: P.meta[p.id] ? P.meta[p.id].sel : p.id }));
      R.meta = P.meta;
      R.layout = R.layout.map((s) => ({ t: s.t, els: s.els.map(([id, y]) => [pick(P.layNames, id), y]).filter((e) => e[0] != null) }));
      R.motion = R.motion.map((s) => ({ t: s.t, els: s.els.map((e) => [pick(P.moNames, e[0]), ...e.slice(1)]).filter((e) => e[0] != null) }));
      return R;
    };
    const contrastNow = async (page) => {
      await page.evaluate(PAGE_HIDE_TEXT);
      const png = await page.capture('png');
      await page.evaluate(PAGE_SHOW_TEXT);
      return page.evaluate(contrastScript('data:image/png;base64,' + png.toString('base64'), opts.scale || 1));
    };
    const newState = (page) => ({ page, cursor: -1, prevT: null, lastGrid: null, busy: new Map(), lastOut: [], meta: {}, layNames: {}, moNames: {}, logN: 0 });
    const pages = [newState(ctx.page)];
    // more browsers for a long pass: what the computer can spare (shared with other givemotion processes, like a
    // render), never more than one per two units; --workers sets it
    const wantN = Math.max(1, Math.min(opts.workers ? +opts.workers : 8, Math.floor(units.length / 2)));
    const queue = units.slice();
    const results = [];
    const work = async (P) => { for (let U = queue.shift(); U; U = queue.shift()) results.push(await runUnit(P, U)); };
    if (wantN > 1) {
      const grant = opts.workers ? null : reserve(wantN - 1, browserMB(info.width * info.height));
      const n = grant ? grant.n : wantN - 1;
      // the first browser starts while the others open
      const firstDone = work(pages[0]);
      const opened = await Promise.allSettled(Array.from({ length: n }, () => openWorker(ctx, opts).then(async (pg) => { extraPages.push(pg); await autoTransparent({ page: pg }, opts); await setupPage(pg); return pg; })));
      if (grant) grant.release();
      await Promise.all([firstDone, ...opened.filter((o) => o.status === 'fulfilled').map((o) => { const P = newState(/** @type {any} */ (o).value); pages.push(P); return work(P); })]);
    } else await work(pages[0]);
    results.sort((x, y) => x.U.i0 - y.U.i0);

    // Merge the units in time order.
    const perSample = results.flatMap((r) => r.perSample);
    const openFrames = results.flatMap((r) => r.openFrames), emptyGrid = results.flatMap((r) => r.emptyGrid), change = results.flatMap((r) => r.change);
    const layoutSamples = results.flatMap((r) => r.layout), moSamples = results.flatMap((r) => r.motion), pops = results.flatMap((r) => r.pops);
    const ident = (rows) => { const o = {}; for (const s of rows) for (const e of s.els) o[e[0]] = e[0]; return o; };
    const layoutNames = ident(layoutSamples), moNames = ident(moSamples);
    // what is known of each reading unit: from the first time any browser saw it
    const paceMeta = {};
    for (const r of results) for (const [id, m] of Object.entries(r.meta)) {
      const key = (id[0] === 'c' ? 'c' : '') + m.sel;
      if (!paceMeta[key] || m.t < paceMeta[key].t) paceMeta[key] = m;
    }
    // text that changes while on screen (a counter, typing): from the merged samples in time order
    const paceSamples = results.flatMap((r) => r.pace);
    { const last = new Map(), live = new Set(); for (const s of paceSamples) for (const u of s.units) { if (typeof u[4] === 'string') { if (last.has(u[0]) && last.get(u[0]) !== u[4]) live.add(u[0]); last.set(u[0], u[4]); } u[4] = live.has(u[0]) ? 1 : 0; } }
    // data-expect: timing promises written on elements (the brief's times), checked here on every run.
    // "in-by 2.5" visible by then; "gone-by 15" gone by then (and stays gone a moment); "hold 1.5" once in, stays in that
    // long; "in-frame" never cut by the frame while visible. Visible = opacity >= 0.5 (with its parents), at least half
    // of its box in the frame, not display: none / visibility: hidden. Times are video seconds.
    // A shot list with timed beats (the skill's plan comment) but no data-expect anywhere: nothing holds the page to its
    // own times, and beats drift late unseen (round 5 brief G ran ~1.3 s behind its brief).
    if (full) {
      try {
        const n = await ctx.page.evaluate(`(() => { if (document.querySelector('[data-expect]')) return 0; const w = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT); let t = ''; while (w.nextNode()) t += w.currentNode.data + '\\n';
          for (const sc of document.scripts) { const m = sc.textContent.match(/\\/\\*[\\s\\S]*?\\*\\//g); if (m) t += m.join('\\n'); }
          return (t.match(/(^|\\s)\\d+(?:\\.\\d+)?\\s*s?\\s*[-\u2013]\\s*\\d+(?:\\.\\d+)?\\s*s?(?=\\s)/gm) || []).length; })()`);
        if (n >= 3) issues.push({ severity: 'warning', code: 'no-expect', time: null, message: `The shot list has ${n} timed beats, but no element carries data-expect, so nothing checks that the beats land on time.`, fix: 'Put the brief\'s times on the elements they are about: data-expect="in-by 4.2; hold 1.5; gone-by 9" on each beat\'s main text or shape. check then reports a beat that runs late as an error.' });
      } catch (e) {}
    }
    if (full) {
      try {
        const specs = await ctx.page.evaluate(`[...document.querySelectorAll('[data-expect]')].map((el) => ({ sel: gm.__selector(el), v: el.getAttribute('data-expect') || '' }))`);
        if (specs.length) {
          await ctx.page.evaluate(`window.__gmVis = (sels) => sels.map((sel) => { const el = document.querySelector(sel); if (!el || !el.isConnected) return [0, 0];
            let op = 1; for (let a = el; a && a.nodeType === 1; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.display === 'none' || (a === el && cs.visibility === 'hidden')) return [0, 0]; op *= +cs.opacity; }
            const r = el.getBoundingClientRect(), W = innerWidth, H = innerHeight, A = r.width * r.height;
            const ix = Math.max(0, Math.min(r.right, W) - Math.max(r.left, 0)), iy = Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0)), sh = A > 0 ? (ix * iy) / A : 0;
            return [op >= 0.5 && sh >= 0.5 ? 1 : 0, op >= 0.5 && sh > 0 && sh < 0.995 ? 1 : 0]; })`);
          const r2 = (x) => Math.round(x * 100) / 100, num = (x) => parseFloat(String(x).replace(/s$/, ''));
          const rules = [];
          for (const sp of specs) for (const part of sp.v.split(';').map((x) => x.trim()).filter(Boolean)) {
            const m = /^(in-by|gone-by|hold)\s+([\d.]+s?)$|^(in-frame)$/.exec(part);
            if (!m || (m[2] != null && !isFinite(num(m[2])))) { issues.push({ severity: 'warning', code: 'expect-bad', selector: sp.sel, time: null, message: `data-expect "${part}" is not one of: in-by <s>, gone-by <s>, hold <s>, in-frame.`, fix: 'Write e.g. data-expect="in-by 2.5; hold 1.5; gone-by 9; in-frame" (video seconds).' }); continue; }
            rules.push({ sel: sp.sel, kind: m[1] || m[3], t: m[2] != null ? num(m[2]) : null });
          }
          // one pass over the video for hold and in-frame, every 0.1 s; single moments for in-by and gone-by
          const swept = [...new Set(rules.filter((r) => r.kind === 'hold' || r.kind === 'in-frame').map((r) => r.sel))];
          const sweep = new Map(swept.map((sel) => [sel, []]));
          if (swept.length) for (let t = 0; t <= lastT + 1e-9; t = Math.round((t + 0.1) * 1000) / 1000) {
            await ctx.page.seek(t);
            const v = await ctx.page.evaluate(`window.__gmVis(${JSON.stringify(swept)})`);
            swept.forEach((sel, k) => sweep.get(sel).push([t, v[k][0], v[k][1]]));
          }
          const at = async (sel, t) => { await ctx.page.seek(Math.min(lastT, Math.max(0, t))); return (await ctx.page.evaluate(`window.__gmVis(${JSON.stringify([sel])})`))[0]; };
          const fail = (r, time, message) => issues.push({ severity: 'error', code: 'expect-failed', selector: r.sel, time: time == null ? null : r2(time), message, fix: 'Change the timeline so the promise holds (it is the brief\'s timing), or change data-expect if the brief allows it.' });
          for (const r of rules) {
            if (r.kind === 'in-by') { if (!(await at(r.sel, r.t))[0]) fail(r, r.t, `Expected to be visible by ${r.t} s (data-expect "in-by ${r.t}"), but it is not on screen then.`); }
            else if (r.kind === 'gone-by') { for (const dt of [0, 0.25, 0.5]) { if (r.t + dt > lastT + 1e-9) break; if ((await at(r.sel, r.t + dt))[0]) { fail(r, r.t + dt, `Expected to be gone by ${r.t} s (data-expect "gone-by ${r.t}"), but it is still on screen at ${r2(r.t + dt)} s.`); break; } } }
            else if (r.kind === 'hold') {
              const rows = sweep.get(r.sel), i0 = rows.findIndex((x) => x[1]);
              if (i0 < 0) fail(r, null, `Expected to stay visible for ${r.t} s (data-expect "hold ${r.t}"), but it is never on screen.`);
              else { let j = i0; while (j + 1 < rows.length && rows[j + 1][1]) j++; const held = rows[j][0] - rows[i0][0] + 0.1; if (held + 1e-6 < r.t && rows[j][0] < lastT - 0.05) fail(r, rows[i0][0], `Expected to stay visible for ${r.t} s once in (data-expect "hold ${r.t}"), but it is visible for only ~${r2(held)} s from ${r2(rows[i0][0])} s.`); }
            } else if (r.kind === 'in-frame') { const row = sweep.get(r.sel).find((x) => x[2]); if (row) fail(r, row[0], `Expected to stay inside the frame while visible (data-expect "in-frame"), but it is cut by the frame edge at ${r2(row[0])} s.`); }
          }
        }
      } catch (e) {}
    }
    // Contrast pictures: one every contrastEvery seconds, at the first sample with text on screen. Taken after the
    // pass, spread over the browsers: each one seeks to the sample before (text that moves is left out), then there.
    if (full) {
      const boxes = results.flatMap((r) => r.boxes), jobs = [];
      let lastC = -Infinity;
      perSample.forEach((smp, k) => { if (boxes[k] && smp.t - lastC >= contrastEvery) { lastC = smp.t; jobs.push(times.indexOf(smp.t)); } });
      const got = new Map(), q = jobs.slice();
      await Promise.all(pages.map(async (P) => {
        for (let k = q.shift(); k != null; k = q.shift()) {
          P.prevT = null; P.cursor = -1;
          // (like a render part: paint state dropped on the sample before, so the picture does not depend on this
          // browser's earlier frames)
          await P.page.seek(times[Math.max(0, k - 1)]);
          await P.page.resetPaint(true);
          if (k > 0) { await analyzeAt(P, times[k - 1]); P.prevT = times[k - 1]; }
          await P.page.seek(times[k]);
          await analyzeAt(P, times[k]);
          got.set(k, await contrastNow(P.page));
        }
      }));
      for (const k of jobs) push(got.get(k), times[k]);
    } else for (const r of results) if (r.contrast) push(r.contrast.issues, r.contrast.t);
    // Keep layout problems that last at least two samples in a row (or the single --at moment).
    const key = (i) => i.code + '|' + i.selector;
    for (let k = 0; k < perSample.length; k++) {
      const { t, issues: list } = perSample[k];
      const nb = new Set([...(perSample[k - 1]?.issues || []), ...(perSample[k + 1]?.issues || [])].map(key));
      push(list.filter((i) => opts.at != null || nb.has(key(i)) || i.code === 'image-broken'), t);
    }
    // Same text color on the same flat backing at the same size class: same contrast verdict for every such text
    // (only some of them were on screen and settled when a contrast picture was taken).
    if (opts.at == null) {
      const flagged = issues.filter((i) => i.code === 'low-contrast' && i.sig);
      if (flagged.length) {
        // (each unit's signatures, in time order: the same signature goes on, a new one starts over)
        /** @type {Record<string, any>} */
        const sigs = {};
        for (const r of results) for (const [k, g] of Object.entries(r.sigs)) { const cur = sigs[k]; if (cur && cur.sig === g.sig) cur.times.push(...g.times.filter((x) => !cur.times.includes(x))); else sigs[k] = { ...g, times: [...g.times] }; }
        const has = new Set(issues.filter((i) => i.code === 'low-contrast').map((i) => i.selector));
        for (const [selector, g] of Object.entries(sigs)) {
          if (has.has(selector)) continue;
          const src = flagged.find((i) => i.sig === g.sig);
          if (!src) continue;
          has.add(selector);
          const ts = g.times.filter((t) => t >= from - 1e-6 && t <= to + 1e-6);
          for (const t of pickSpread(ts, 12)) issues.push({ ...src, selector, text: g.text, time: Math.round(t * 100) / 100 });
        }
      }
    }
    for (const i of issues) delete i.sig;
    const logs = groupLogs((() => { const seen = new Set(), all = []; for (const r of results) for (const l of r.logs) { const k = l.t + '|' + l.msg; if (!seen.has(k)) { seen.add(k); all.push(l); } } return all.sort((x, y) => x.t - y.t); })());
    if (change.length) issues.push(...stillStretches(change, info, from, to));
    if (moSetup) issues.push(...motionIssues(moSamples, moNames, moSetup, info, step));
    if (opts.at == null) issues.push(...layoutShiftIssues(layoutSamples, layoutNames, step));
    if (opts.at == null) {
      issues.push(...pacingIssues(paceSamples, paceMeta, pops, { from, to, lastT, duration: info.duration }));
      try {
        /** @type {Map<string, any>} */
        const steps = new Map();
        for (const r of results) for (const st of r.steps) { const cur = steps.get(st.sel); if (!cur || cur.area < st.area) steps.set(st.sel, st); }
        for (const s of steps.values()) issues.push({ severity: 'info', code: 'stepped-move', selector: s.sel, time: Math.round(s.t * 100) / 100,
          message: `This element covers ${Math.round(s.area * 100)}% of the frame and moves with a steps() ease (${s.how}): on something this big, stepped motion reads as dropped frames.`,
          fix: 'Keep steps() for small things (a counter, a blinking caret, text typing); give windows, cards and the camera a smooth ease (or leave ease out for the natural default).' });
      } catch (e) {}
    }
    // a tween or style on a display: contents element (a bare <gm-include> wrapper) does nothing
    try {
      /** @type {Map<string, any>} */
      const noBox = new Map();
      for (const r of results) for (const b of r.noBox) { const cur = noBox.get(b.sel); if (!cur || (b.t ?? Infinity) < (cur.t ?? Infinity)) noBox.set(b.sel, b); }
      for (const b of noBox.values()) issues.push({ severity: 'warning', code: 'contents-no-box', selector: b.sel, time: b.t == null ? null : Math.round(b.t * 100) / 100,
        message: `This element has display: contents${b.inc ? ' (a <gm-include> without class or style gets it)' : ''}, so it draws no box: its ${b.props.join(', ')} ${b.props.length > 1 ? 'do' : 'does'} nothing.`,
        fix: b.inc ? 'Give the <gm-include> a class or a style (e.g. style="display:block") so it gets a box, or animate the elements inside it.' : 'Animate the elements inside it, or give it a box (display: block / flex / grid).' });
    } catch (e) {}
    if (from === 0 && openFrames.length >= 2 && openFrames.every((o) => o.empty)) issues.push({ severity: 'warning', code: 'empty-start', time: 0, message: 'The first half second shows only the background. The first frame is often the thumbnail, and the hook: viewers decide in the first second.', fix: 'Show something from frame 0 (a shape, the background art, the first word already in place), or start the first entrance at 0.' });
    // Almost nothing on screen for a second or more in the middle (a camera between two far-apart parts, a gap
    // between scenes, a zoom so far out that everything is a speck)
    for (let i = 0; i < emptyGrid.length; i++) {
      if (!emptyGrid[i][1]) continue;
      let j = i; while (j + 1 < emptyGrid.length && emptyGrid[j + 1][1]) j++;
      const a0 = emptyGrid[i][0], b0 = emptyGrid[j][0];
      if (j > i && a0 > 0.6) issues.push({ severity: 'warning', code: 'empty-frame', time: Math.round(a0 * 100) / 100, until: Math.round(b0 * 100) / 100, ranges: [[Math.round(a0 * 100) / 100, Math.round(b0 * 100) / 100]], message: 'Almost nothing is on screen from ' + a0.toFixed(1) + ' s to ' + b0.toFixed(1) + ' s.', fix: 'Keep something in view: move the camera between parts that are closer together (or faster), start the next element sooner, or do not zoom out that far.' });
      i = j;
    }
    // Text carried over a scene change: a big readable text stays put, unchanged, while almost the whole picture around
    // it changes (a new beat, a camera rush), and is still there half a second later: it reads as left behind.
    try {
      const near = (t) => { let best = null; for (const sm of paceSamples) if (Math.abs(sm.t - t) < 0.1 && (!best || Math.abs(sm.t - t) < Math.abs(best.t - t))) best = sm; return best; };
      const same = (sm, u) => sm && sm.units.find((x) => x[0] === u[0] && x[1] === 2 && x.length > 6 && Math.abs(x[5] - u[5]) <= 6 && Math.abs(x[6] - u[6]) <= 6);
      const done = new Set();
      for (const [tc, frac] of change) {
        if (frac < 0.45) continue;
        const A = near(tc - 0.5), B = near(tc), C = near(tc + 0.5);
        if (!A || !B || !C || C === B) continue;
        for (const u of B.units) {
          if (u[1] !== 2 || !u[3] || u[4] || u.length < 7 || done.has(u[0])) continue;
          const m = paceMeta[u[0]];
          if (!m || m.carryOk || m.quick || m.live) continue;
          if (!same(A, u) || !same(C, u)) continue;
          done.add(u[0]);
          issues.push({ severity: 'warning', code: 'text-carried-over', selector: u[0], text: m.text, time: Math.round(tc * 100) / 100,
            message: `This text stays put while almost the whole picture changes around it (${Math.round(frac * 100)}% of the frame at ${tc.toFixed(1)} s), and is still there half a second later: it reads as left behind from the last beat.`,
            fix: 'Let it leave with its beat (an exit that ends before the hand-over; if it then has too little time to be read, bring it in sooner rather than holding it into the next beat), or carry it across on purpose (gm.fly, a morph). If it is meant to stay (a logo bug, a chapter label), add data-check="carry-ok".' });
        }
      }
    } catch (e) {}
    const motion = change.length ? { every: 0.5, from: change[0][0] - 0.5, values: change.map(([, f, b]) => Math.round((b >= BUSY_MIN ? Math.max(f, 0.06) : f) * 1000) / 1000) } : null;
    let merged = mergeIssues(issues, step * 2.5, Math.max(step * 2.5, contrastEvery * 1.6));
    // Some problems only matter if they last (a label sliding past the frame edge during a pan is fine).
    if (opts.at == null) merged = merged.filter((i) => {
      if (!i.minSpan) return true;
      if (i.ranges) i.ranges = i.ranges.filter(([a, b]) => b - a >= i.minSpan - 1e-6);
      if (!i.ranges || !i.ranges.length) return false;
      i.time = i.ranges[0][0]; i.until = i.ranges[i.ranges.length - 1][1];
      return true;
    });
    for (const i of merged) delete i.minSpan;
    merged = groupMany(merged);
    // A script that failed can make the video look still or empty: say so instead of sending the reader on a hunt.
    if (merged.some((i) => i.code === 'script-error')) for (const i of merged) if (i.code === 'still' || i.code === 'empty-start') i.message += ' This may only be because of the script error: fix that first.';
    // Taste, not faults: these are hints to look at, never something to chase until check is quiet.
    for (const i of merged) if (STYLE_NOTES.has(i.code) && i.severity === 'warning') i.severity = 'info';
    const errors = merged.filter((i) => i.severity === 'error').length;
    const warnings = merged.filter((i) => i.severity === 'warning').length;
    const notes = merged.filter((i) => i.severity === 'info').length;
    return { ok: errors === 0, errors, warnings, notes, issues: merged, info: summarizeInfo(info), motion, logs };
  } finally {
    await Promise.all(extraPages.map((pg) => pg.close().catch(() => {})));
    await ctx.page.close();
    await ctx.server.close();
  }
}

/** Codes that judge style (a move's path, easing variety, camera pauses): reported as ℹ notes, not ⚠ warnings. */
export const STYLE_NOTES = new Set(['straight-move', 'camera-stop', 'fast-no-blur', 'same-ease', 'empty-frame', 'stepped-move']);

/** gm.log() lines: the same message at neighbouring times becomes one line with a time range and a count. */
export function groupLogs(list) {
  const out = [];
  for (const l of list || []) {
    const last = out[out.length - 1];
    if (last && last.msg === l.msg && l.t - last.until <= 0.6) { last.until = l.t; last.count++; }
    else out.push({ time: l.t, until: l.t, count: 1, msg: l.msg });
  }
  return out;
}

/** An entrance, exit or move counts as change on screen when what moves covers this share of the frame (about a
 *  short headline): a small label fading in in a corner leaves the picture as still as it was. */
const BUSY_MIN = 0.01;

/** Long stretches where (almost) nothing on screen changes: viewers read these as the video stalling. */
function stillStretches(change, info, from, to) {
  const out = [];
  const QUIET = 0.05; // under 5% of the picture changed in half a second, and nothing big entering, leaving or moving
  let start = null, prevT = from;
  const flush = (end, atEnd) => {
    if (start == null) return;
    const len = end - start;
    // (an end card that sits still for ~2 s already reads as dead air: judges named it in most videos of round 8)
    if (len >= (atEnd ? 1.9 : 2.5) - 1e-6) {
      const r = (x) => Math.round(x * 100) / 100;
      out.push({ severity: 'warning', code: 'still', time: r(start), until: r(end), ranges: [[r(start), r(end)]],
        message: 'Little changes on screen from ' + start.toFixed(1) + ' s to ' + end.toFixed(1) + ' s (' + len.toFixed(1) + ' s' + (atEnd ? ', at the end' : '') + '). Viewers read this as the video stalling.',
        fix: atEnd ? 'End sooner (shorter last scene), or keep a little life in the end card: a slow camera push, a shine, a looping accent.' : 'Cut this hold shorter, or start the next beat earlier: a camera move, the next element entering, a counter or a highlight.' });
    }
    start = null;
  };
  for (const [t, f, busy] of change) {
    if (f < QUIET && busy < BUSY_MIN) { if (start == null) start = prevT; }
    else flush(prevT, false);
    prevT = t;
  }
  flush(Math.min(to + 1 / info.fps, info.duration), to >= info.duration - 2 / info.fps);
  return out;
}

/** Many pieces of text with the same problem at the same times (e.g. every token of a code block
 *  after one camera move) → one issue that names their common parent. */
function groupMany(list) {
  const groups = new Map();
  for (const i of list) {
    if (!i.selector || !i.ranges) continue;
    const k = i.code + '|' + i.severity + '|' + JSON.stringify(i.ranges);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(i);
  }
  const drop = new Set(), add = [];
  for (const g of groups.values()) {
    if (g.length < 4) continue;
    const parts = g.map((i) => i.selector.split(' > '));
    let common = [];
    for (let d = 0; d < parts[0].length; d++) { const seg = parts[0][d]; if (parts.every((p) => p[d] === seg)) common.push(seg); else break; }
    for (const i of g) drop.add(i);
    add.push({ ...g[0], selector: common.length ? common.join(' > ') : g[0].selector, text: g.length + ' pieces of text, e.g. "' + (g[0].text || '') + '"', message: g[0].message + ' (the same for ' + (g.length - 1) + ' more inside it)' });
  }
  if (!drop.size) return list;
  const rank = { error: 0, warning: 1, info: 2 };
  return [...list.filter((i) => !drop.has(i)), ...add].sort((a, b) => rank[a.severity] - rank[b.severity] || (a.time ?? -1) - (b.time ?? -1));
}

function pickSpread(arr, n) {
  if (arr.length <= n) return arr;
  const out = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.round((i * (arr.length - 1)) / (n - 1))]);
  return [...new Set(out)];
}

/** Same issue at many times → one entry listing when it happens (separate ranges). */
function mergeIssues(list, gap = 0.3, contrastGap = gap) {
  const rank = { error: 0, warning: 1, info: 2 };
  const map = new Map();
  for (const i of list) {
    const k = [i.code, i.selector || i.message].join('|');
    const cur = map.get(k);
    if (!cur) { map.set(k, { ...i, times: i.time != null ? [i.time] : [], own: i.ranges || null }); continue; }
    if (i.time != null) cur.times.push(i.time);
    if (rank[i.severity] < rank[cur.severity]) { cur.severity = i.severity; cur.message = i.message; }
  }
  const out = [...map.values()].map((i) => {
    const ts = [...new Set(i.times)].sort((a, b) => a - b);
    const r = { ...i };
    delete r.times; delete r.own;
    // an issue that knows its own time span (a still stretch, an empty stretch) keeps it
    if (i.own && ts.length <= 1) { r.ranges = i.own; r.time = i.own[0][0]; r.until = i.own[i.own.length - 1][1]; }
    else if (ts.length) {
      const ranges = [];
      const g = i.code === 'low-contrast' ? contrastGap : gap;
      for (const t of ts) { const l = ranges[ranges.length - 1]; if (l && t - l[1] <= g + 1e-6) l[1] = t; else ranges.push([t, t]); }
      r.time = ts[0];
      if (ts.length > 1) r.until = ts[ts.length - 1];
      r.ranges = ranges;
    }
    return r;
  });
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || (a.time ?? -1) - (b.time ?? -1));
}

function summarizeInfo(info) {
  return { width: info.width, height: info.height, fps: info.fps, duration: info.duration, frames: info.frames, clips: info.clips.length, media: info.media.length };
}

/** How much changes on screen over time, as a text strip (one mark per half second). */
export function motionStrip(m) {
  const bars = ' ▁▂▃▄▅▆▇█';
  const marks = m.values.map((f) => bars[f < 0.02 ? 0 : Math.max(1, Math.min(8, Math.ceil((f / 0.5) * 8)))]).join('');
  let ruler = '';
  for (let i = 0; i < m.values.length; i += 4) ruler += String(Math.round(m.from + i * m.every)).padEnd(4).slice(0, 4);
  return ['motion  |' + marks + '|  (one mark = ' + m.every + ' s, taller = more of the picture changing)', '        ' + ' ' + ruler + 's'];
}

/** @param {import('./types/api.js').CheckReport} rep @param {{ file?: string }} [opts] */
export function formatReport(rep, { file } = {}) {
  const lines = [];
  const i = rep.info;
  lines.push(`${file ? basename(file) + ': ' : ''}${i.width}x${i.height} ${i.fps}fps ${i.duration.toFixed(2)}s, ${i.clips} timed elements`);
  if (rep.motion) lines.push(...motionStrip(rep.motion));
  if (rep.logs && rep.logs.length) {
    for (const l of rep.logs.slice(0, 30)) lines.push(`log ${l.time.toFixed(2)}s${l.until > l.time ? '–' + l.until.toFixed(2) + 's' : ''}${l.count > 1 ? ' (' + l.count + 'x)' : ''}  ${l.msg}`);
    if (rep.logs.length > 30) lines.push(`log … ${rep.logs.length - 30} more (--json for all)`);
  }
  if (!rep.issues.length) { lines.push('✓ No problems found.'); return lines.join('\n'); }
  for (const x of rep.issues) {
    const rg = (r) => (r[0] === r[1] ? `${r[0].toFixed(2)}s` : `${r[0].toFixed(2)}–${r[1].toFixed(2)}s`);
    let when = x.time == null ? '' : x.ranges ? ' at ' + x.ranges.slice(0, 4).map(rg).join(', ') + (x.ranges.length > 4 ? ` (+${x.ranges.length - 4} more)` : '') : ` at ${x.time.toFixed(2)}s`;
    if (x.time != null && x.scene && x.sceneStart > 0) when += ` (${(x.time - x.sceneStart).toFixed(2)}s into ${x.scene})`;
    lines.push(`${x.severity === 'error' ? '✖' : x.severity === 'warning' ? '⚠' : 'ℹ'} [${x.code}]${when}${x.selector ? '  ' + x.selector : ''}${x.text ? '  "' + x.text + '"' : ''}`);
    lines.push(`    ${x.message}`);
    if (x.fix) lines.push(`    fix: ${x.fix}`);
  }
  lines.push(`${rep.errors} error${rep.errors === 1 ? '' : 's'}, ${rep.warnings} warning${rep.warnings === 1 ? '' : 's'}` +
    (rep.notes ? `, ${rep.notes} style note${rep.notes === 1 ? '' : 's'} (ℹ: look at the frames; ignore it if the move is what you meant)` : ''));
  return lines.join('\n');
}

/**
 * Snapshot: render key moments into PNGs plus one contact sheet image.
 */
/**
 * @param {Input} input
 * @param {import('./types/api.js').SnapshotOptions} [opts]
 * @returns {Promise<import('./types/api.js').SnapshotResult>}
 */
export async function snapshot(input, opts = {}) {
  const ctx = await openComposition(input, { ...opts, mode: 'render' });
  try {
    const info = ctx.info;
    opts = { ...opts, transparent: await autoTransparent(ctx, opts) };
    const fps = info.fps;
    const lastT = Math.max(0, info.duration - 1 / fps);
    let times;
    const sec = (v) => { const s0 = String(v).trim(); return /f$/.test(s0) ? parseFloat(s0) / fps : parseFloat(s0); };
    const from = opts.from != null ? sec(opts.from) : 0, to = opts.to != null ? Math.min(lastT, sec(opts.to)) : lastT;
    if (opts.times) {
      // (with --from/--to too: only the times inside that range)
      times = String(opts.times).split(',').map(sec).filter((x) => isFinite(x));
      if (opts.from != null || opts.to != null) {
        const all = times, hi = opts.to != null ? sec(opts.to) : Infinity;
        times = all.filter((t) => t >= from - 1e-9 && t <= hi + 1e-9);
        if (!times.length) throw new Error(`None of the --times (${all.join(', ')}) is inside --from ${opts.from ?? 0} --to ${opts.to ?? 'end'}.`);
      }
    }
    else if (opts.every) { times = []; const st = Math.max(1 / fps, sec(opts.every)); for (let t = from; t <= to + 1e-9; t += st) times.push(t); }
    else if (opts.transitions) {
      // start, middle and end of every scene transition, plus each scene's first frame
      times = [];
      for (const c of info.clips) if (c.scene) times.push(c.start);
      for (const tr of info.transitions || []) times.push(tr.start, (tr.start + tr.end) / 2, tr.end);
      times = times.filter((t) => t >= from && t <= to);
    }
    else times = [...(from === 0 ? [0] : []), ...keyTimes(info, opts.max || 12).filter((t) => t >= from && t <= to)];
    times = [...new Set(times.map((t) => Math.round(t * fps) / fps))].sort((a, b) => a - b);
    if (times.length > 120) throw new Error(`That is ${times.length} frames; use a shorter range (--from/--to) or a bigger --every.`);
    times = times.map((t) => Math.round(Math.min(lastT, Math.max(0, t)) * fps) / fps);
    const dir = resolve(opts.output || join(dirname(ctx.file), 'snapshots'));
    mkdirSync(dir, { recursive: true });
    const files = [];
    const thumbs = [];
    let n = 0;
    for (const t of times) {
      if (opts.onProgress) opts.onProgress(++n, times.length);
      await ctx.page.seek(t);
      const png = await ctx.page.capture('png');
      const f = join(dir, `t${t.toFixed(2).replace('.', '_')}s.png`);
      if (!opts.sheetOnly) { writeFileSync(f, png); files.push(f); }
      const thumb = opts.transparent ? png : await ctx.page.capture('jpeg', 88);
      thumbs.push({ t, data: thumb.toString('base64'), mime: opts.transparent ? 'png' : 'jpeg', frame: Math.round(t * fps), scene: sceneAt(info, t) });
    }
    const sheet = join(dir, 'sheet.png');
    // --grid: thirds, the center and the safe zone (if any) drawn over every picture, to judge placement
    let overlay = '';
    if (opts.grid) {
      const W = info.width, H = info.height, PX = Math.min(W, H) / 1080;
      const zn = opts.safeZone || await ctx.page.evaluate(`document.documentElement.getAttribute('data-safe-zone')`).catch(() => null);
      const Z = { shorts: [220, 60, 380, 60], reels: [220, 60, 380, 60], tiktok: [220, 120, 380, 60] }[zn] || (zn && String(zn).split(/[\s,]+/).map(Number).length === 4 ? String(zn).split(/[\s,]+/).map(Number) : null);
      const ln = (x1, y1, x2, y2, c) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${2 * PX}" vector-effect="non-scaling-stroke"/>`;
      overlay = `<svg class="ov" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${ln(W / 3, 0, W / 3, H, '#0ff8')}${ln((2 * W) / 3, 0, (2 * W) / 3, H, '#0ff8')}${ln(0, H / 3, W, H / 3, '#0ff8')}${ln(0, (2 * H) / 3, W, (2 * H) / 3, '#0ff8')}${ln(W / 2 - 30 * PX, H / 2, W / 2 + 30 * PX, H / 2, '#f0f')}${ln(W / 2, H / 2 - 30 * PX, W / 2, H / 2 + 30 * PX, '#f0f')}${Z ? `<rect x="${Z[3] * PX}" y="${Z[0] * PX}" width="${W - (Z[1] + Z[3]) * PX}" height="${H - (Z[0] + Z[2]) * PX}" fill="none" stroke="#ff0" stroke-width="2" stroke-dasharray="8 6" vector-effect="non-scaling-stroke"/>` : ''}</svg>`;
    }
    const cols = opts.cols || (times.length <= 4 ? 2 : times.length <= 9 ? 3 : 4);
    const cellW = Math.round(Math.min(640, 1920 / cols));
    const cellH = Math.round((cellW * info.height) / info.width);
    const rows = Math.ceil(thumbs.length / cols);
    const sheetW = cols * cellW + (cols + 1) * 12;
    const sheetH = rows * (cellH + 34) + (rows + 1) * 12 + 40;
    const html = `<!doctype html><html><head><style>
      html,body{margin:0;background:#111;font:14px/1.2 Inter,Helvetica,Arial,sans-serif;color:#ddd;width:${sheetW}px;height:${sheetH}px;overflow:hidden}
      header{height:40px;display:flex;align-items:center;padding:0 12px;color:#aaa}
      .g{display:grid;grid-template-columns:repeat(${cols},${cellW}px);gap:12px;padding:0 12px 12px}
      figure{margin:0;position:relative} .ov{position:absolute;left:0;top:0;width:${cellW}px;height:${cellH}px;pointer-events:none} img{display:block;width:${cellW}px;height:${cellH}px;outline:1px solid #333;background:repeating-conic-gradient(#3a3a3a 0% 25%,#2a2a2a 0% 50%) 50%/24px 24px}
      figcaption{height:34px;display:flex;align-items:center;gap:8px;color:#eee} b{color:#fff} span{color:#999}
    </style></head><body><header>${escapeHtml(basename(ctx.file))} · ${info.width}x${info.height} · ${info.fps}fps · ${info.duration.toFixed(2)}s</header><div class="g">${thumbs.map((x) => `<figure><img src="data:image/${x.mime};base64,${x.data}">${overlay}<figcaption><b>${x.t.toFixed(2)}s</b><span>frame ${x.frame}${x.scene ? ' · ' + escapeHtml(x.scene) : ''}</span></figcaption></figure>`).join('')}</div></body></html>`;
    const png = await renderHtmlToPng(ctx.page, html, sheetW, sheetH);
    writeFileSync(sheet, png);
    // --trail: every frame layered into one picture (an onion skin): the earlier frames as fading ghosts under the
    // last one, so a move's path, arc and spacing (its easing) read at full size in one image
    let trail = null;
    if (opts.trail && thumbs.length > 1) {
      const tw = Math.min(1920, info.width), th = Math.round((tw * info.height) / info.width), n = thumbs.length;
      // a running mean of all but the last frame (frame k at opacity 1/(k+1)), then the last frame over it at 0.6
      const layers = thumbs.map((x, k) => `<img src="data:image/${x.mime};base64,${x.data}" style="opacity:${k === n - 1 ? 0.6 : (1 / (k + 1)).toFixed(4)}">`).join('');
      const thtml = `<!doctype html><html><head><style>html,body{margin:0;width:${tw}px;height:${th}px;overflow:hidden;background:#000}img{position:absolute;left:0;top:0;width:${tw}px;height:${th}px}
        b{position:absolute;left:12px;bottom:10px;font:600 22px Inter,Helvetica,Arial,sans-serif;color:#fff;background:#000a;padding:4px 8px}</style></head><body>${layers}<b>${times[0].toFixed(2)}s → ${times[n - 1].toFixed(2)}s · ${n} frames (last one strongest)</b></body></html>`;
      trail = join(dir, 'trail.png');
      writeFileSync(trail, await renderHtmlToPng(ctx.page, thtml, tw, th));
    }
    const problems = [...info.issues.filter((i) => i.severity === 'error'), ...ctx.page.errors];
    return { sheet, files, times, info: summarizeInfo(info), errors: ctx.page.errors, problems, ...(trail ? { trail } : {}) };
  } finally {
    await ctx.page.close();
    await ctx.server.close();
  }
}

function sceneAt(info, t) {
  // The deepest clip that is active at t and lasts > 0.3s
  const act = info.clips.filter((c) => t >= c.start && t < c.end && c.end - c.start > 0.3);
  if (!act.length) return '';
  act.sort((a, b) => (b.start - a.start) || (a.end - a.start) - (b.end - b.start));
  return act[0].selector || '';
}
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function renderHtmlToPng(page, html, w, h) {
  await page.setViewport(w, h);
  const { frameTree } = await page.s('Page.getFrameTree');
  await page.s('Page.setDocumentContent', { frameId: frameTree.frame.id, html });
  await page.evaluate(`Promise.all([...document.images].map(i => i.decode().catch(()=>{}))).then(() => document.fonts.ready).then(() => true)`);
  return page.capture('png');
}
