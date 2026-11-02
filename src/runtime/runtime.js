/* givemotion runtime — injected into every composition page.
 * Turns a normal HTML page into a seekable, deterministic video timeline.
 * Exposes window.gm. MIT License.
 */
(function () {
  'use strict';
  if (window.gm && window.gm.__runtime) return;

  const CONFIG = Object.assign({ mode: 'preview', seed: 1, data: null }, window.__GM_CONFIG || {});
  const MODE = CONFIG.mode; // 'render' | 'preview' | 'check'

  // ---------------------------------------------------------------------------
  // Keep real browser APIs before we replace them.
  // ---------------------------------------------------------------------------
  const real = {
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    setInterval: window.setInterval.bind(window),
    clearInterval: window.clearInterval.bind(window),
    raf: window.requestAnimationFrame.bind(window),
    caf: window.cancelAnimationFrame.bind(window),
    perfNow: performance.now.bind(performance),
    Date: window.Date,
    random: Math.random,
    animate: Element.prototype.animate,
  };

  // ---------------------------------------------------------------------------
  // Virtual clock. All time in this page is driven by gm.seek().
  // ---------------------------------------------------------------------------
  const EPOCH = Date.UTC(2026, 0, 1, 12, 0, 0);
  let now = 0; // seconds
  let usedRAF = false;
  let stateful = false; // true once code has run that depends on history (rAF, timers)
  let timerSeq = 0, timerIdCounter = 1;
  const timers = new Map();
  const rafs = new Map();
  let rafId = 0;

  performance.now = () => now * 1000;
  function VDate(...args) {
    if (!new.target) return new real.Date(EPOCH + now * 1000).toString();
    return args.length ? new real.Date(.../** @type {[any]} */ (args)) : new real.Date(EPOCH + now * 1000);
  }
  VDate.prototype = real.Date.prototype;
  VDate.now = () => EPOCH + now * 1000;
  VDate.parse = real.Date.parse;
  VDate.UTC = real.Date.UTC;
  window.Date = /** @type {any} */ (VDate);

  function addTimer(fn, ms, args, interval) {
    if (typeof fn === 'string') { const code = fn; fn = () => (0, eval)(code); }
    if (typeof fn !== 'function') return 0;
    const id = timerIdCounter++;
    const delay = Math.max(0, Number(ms) || 0) / 1000;
    timers.set(id, { due: now + delay, delay, fn, args, interval: interval ? Math.max(delay, 0.001) : 0, seq: timerSeq++ });
    return id;
  }
  window.setTimeout = /** @type {any} */ ((fn, ms, ...args) => addTimer(fn, ms, args, false));
  window.setInterval = /** @type {any} */ ((fn, ms, ...args) => addTimer(fn, ms, args, true));
  window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };
  window.requestAnimationFrame = (fn) => { usedRAF = true; rafs.set(++rafId, fn); return rafId; };
  window.cancelAnimationFrame = (id) => { rafs.delete(id); };

  // Deterministic Math.random (mulberry32)
  function makeRandom(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  Math.random = makeRandom(CONFIG.seed);
  function hashSeed(x) {
    if (typeof x === 'number' && Number.isFinite(x)) x = String(x);
    let h = 2166136261 >>> 0;
    for (const ch of String(x)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
    return h || 1;
  }

  function runTimersUntil(T) {
    let guard = 0;
    for (;;) {
      let next = null;
      for (const [id, t] of timers) {
        if (t.due <= T + 1e-9 && (!next || t.due < next.t.due || (t.due === next.t.due && t.seq < next.t.seq))) next = { id, t };
      }
      if (!next) break;
      if (++guard > 100000) { report('error', 'timer-loop', 'Timers keep scheduling themselves without advancing time.', null, 'Avoid setTimeout/setInterval loops with 0 delay.'); break; }
      stateful = true;
      const { id, t } = next;
      now = Math.max(now, t.due);
      if (t.interval) { t.due += t.interval; t.seq = timerSeq++; } else timers.delete(id);
      try { t.fn(...(t.args || [])); } catch (e) { pageError(e); }
      flushAnimations(now, 'event');
    }
  }
  // While the page is still loading (waiting on gm.wait promises), libraries often poll with short
  // timers (fonts, Lottie, model loaders). The video clock is paused then, so run those short timers
  // for real. Long timers (likely meant as video events) still wait for their video time.
  function loadPump() {
    let ran = 0;
    const due = [...timers.entries()].filter(([, t]) => t.delay <= 0.25).sort((a, b) => a[1].due - b[1].due || a[1].seq - b[1].seq);
    for (const [id, t] of due) {
      if (!timers.has(id)) continue;
      if (t.interval) { t.due += t.interval; t.seq = timerSeq++; } else timers.delete(id);
      try { t.fn(...(t.args || [])); } catch (e) { pageError(e); }
      if (++ran > 200) break;
    }
    if (rafs.size) { const list = [...rafs.values()]; rafs.clear(); for (const fn of list) { try { fn(now * 1000); } catch (e) { pageError(e); } } }
  }
  function runRAF(T) {
    if (!rafs.size) return;
    stateful = true;
    const list = [...rafs.values()];
    rafs.clear();
    for (const fn of list) { try { fn(T * 1000); } catch (e) { pageError(e); } }
  }

  // ---------------------------------------------------------------------------
  // Diagnostics collected for `givemotion check`
  // ---------------------------------------------------------------------------
  const issues = [];
  const issueKeys = new Set();
  let muted = 0; // a provisional timeline built while the page still loads (gm.timing in a script) reports nothing
  function report(severity, code, message, el, fix, time) {
    if (muted) return;
    const sel = el ? selectorOf(el) : null;
    const key = code + '|' + sel + '|' + message;
    if (issueKeys.has(key)) return;
    issueKeys.add(key);
    issues.push({ severity, code, message, selector: sel, fix: fix || null, time: time == null ? null : round(time) });
  }
  function pageError(e) { report('error', 'script-error', String(e && e.stack || e).split('\n').slice(0, 3).join(' | '), null, null, now); setTimeoutReal(() => { throw e; }); }
  const setTimeoutReal = real.setTimeout;
  function round(x) { return Math.round(x * 1000) / 1000; }
  function selectorOf(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.id) return '#' + el.id;
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && parts.length < 4) {
      let s = cur.tagName.toLowerCase();
      if (cur.id) { parts.unshift('#' + cur.id); break; }
      const cls = [...cur.classList].filter((c) => !c.startsWith('gm-')).slice(0, 2);
      if (cls.length) s += '.' + cls.join('.');
      const parent = cur.parentElement;
      if (parent) {
        const same = [...parent.children].filter((c) => c.tagName === cur.tagName);
        if (same.length > 1) s += ':nth-of-type(' + (same.indexOf(cur) + 1) + ')';
      }
      parts.unshift(s);
      cur = parent;
      if (cur === document.body || cur === document.documentElement) break;
    }
    return parts.join(' > ');
  }

  // ---------------------------------------------------------------------------
  // Time parsing: "1.5", "1.5s", "500ms", "45f", "1:02.5"
  // ---------------------------------------------------------------------------
  let FPS = 30;
  // Words of the voice-over (<html data-words="voice.json">): "@pricing" is when "pricing" is first said,
  // "@spring_pricing" a phrase, "@pricing#2" the second time, "@pricing.end" when it ends, "@pricing+0.3" a bit after.
  let wordsCache;
  const normWord = (w) => String(w).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}']+/gu, '').replace(/^'+|'+$/g, '');
  function words() {
    if (wordsCache !== undefined) return wordsCache;
    wordsCache = null;
    const s = document.getElementById('gm-words');
    if (!s) return null;
    try {
      const j = JSON.parse(s.textContent);
      if (j.error) report('error', 'words-file', j.error, null, 'Put the word-timed JSON ([{"word":"Hi","start":0.2,"end":0.5}, …], e.g. from a transcription tool) in the project folder and name it in <html data-words="voice.json">.');
      else wordsCache = { file: j.file, list: j.words.map((w) => ({ ...w, n: normWord(w.word) })) };
    } catch (e) {}
    return wordsCache;
  }
  function wordTime(spec, el, attr) {
    const m = /^@([^#.+\-\s][^#+\s]*?)(?:#(\d+))?(\.end|\.start)?([+-][\d.]+)?$/.exec(String(spec).trim());
    const W = words();
    if (!W) { report('error', 'words-missing', `${attr || 'A time'} "${spec}" names a word, but the page has no transcript.`, el, 'Add <html data-words="voice.json"> (a word-timed JSON: [{"word":"Hi","start":0.2,"end":0.5}, …]).'); return null; }
    if (!m) { report('error', 'bad-time', `Cannot read the word time "${spec}"${attr ? ' in ' + attr : ''}.`, el, 'Write @word, @two_words (a phrase), @word#2 (the 2nd time it is said), @word.end, @word+0.3.'); return null; }
    const want = m[1].split(/[_~]+/).map(normWord).filter(Boolean), nth = m[2] ? +m[2] : 1;
    let seen = 0;
    for (let i = 0; i + want.length <= W.list.length; i++) {
      if (!want.every((w, k) => W.list[i + k].n === w)) continue;
      if (++seen < nth) continue;
      // a bare word said more than once: the first is taken; say where the others are (the wrong one is easy to miss)
      if (!m[2]) {
        const more = [];
        for (let j = i + 1; j + want.length <= W.list.length; j++) if (want.every((w, k) => W.list[j + k].n === w)) more.push(W.list[j].start);
        if (more.length) report('warning', 'word-repeated', `"${spec}"${attr ? ' (' + attr + ')' : ''} is said ${more.length + 1} times; the first, at ${round(W.list[i].start)} s, is used.`, el, `If you meant a later one, write ${more.slice(0, 3).map((t2, k) => '@' + m[1] + '#' + (k + 2) + ' (' + round(t2) + ' s)').join(', ')}, or name a phrase (@${m[1]}_${W.list[i + want.length] ? W.list[i + want.length].n : 'next'}). Add #1 to keep the first and silence this.`);
      }
      const t = m[3] === '.end' ? W.list[i + want.length - 1].end : W.list[i].start;
      return t + (m[4] ? parseFloat(m[4]) : 0);
    }
    const dist = (a, b) => { let p = [...Array(b.length + 1).keys()]; for (let i = 1; i <= a.length; i++) { const c = [i]; for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[b.length]; };
    const miss = want.find((w) => !W.list.some((x) => x.n === w)) || want[0];
    const near = [...new Set(W.list.map((w) => w.n))].filter((n) => n && dist(n, miss) <= Math.max(1, Math.floor(miss.length / 3))).slice(0, 6);
    report('error', 'word-not-found', `"${spec}"${attr ? ' (' + attr + ')' : ''}: ${seen ? `"${want.join(' ')}" is said only ${seen} time${seen > 1 ? 's' : ''}` : `"${want.join(' ')}" is not in ${W.file}`}.`, el, near.length ? `Words like it in the transcript: ${near.join(', ')}.` : 'Check the spelling against the transcript; join the words of a phrase with _ (@spring_pricing).');
    return null;
  }
  function parseTime(v, el, attr) {
    if (v == null || v === '') return null;
    if (String(v).trim()[0] === '@') return wordTime(v, el, attr);
    const s = String(v).trim().toLowerCase();
    let m;
    if ((m = /^(-?[\d.]+)\s*ms$/.exec(s))) return parseFloat(m[1]) / 1000;
    if ((m = /^(-?[\d.]+)\s*s?$/.exec(s))) return parseFloat(m[1]);
    if ((m = /^(-?[\d.]+)\s*f$/.exec(s))) return parseFloat(m[1]) / FPS;
    if ((m = /^(\d+):(\d+(?:\.\d+)?)$/.exec(s))) return parseInt(m[1], 10) * 60 + parseFloat(m[2]);
    report('error', 'bad-time', `Cannot read time "${v}" in ${attr}.`, el, 'Use seconds like "1.5", "1.5s", "500ms", or frames like "45f".');
    return null;
  }

  // ---------------------------------------------------------------------------
  // Easing
  // ---------------------------------------------------------------------------
  function cubicBezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) { const e = sx(t) - x; const d = dx(t); if (Math.abs(e) < 1e-6) break; if (Math.abs(d) < 1e-6) break; t -= e / d; }
      let lo = 0, hi = 1;
      if (Math.abs(sx(t) - x) > 1e-5) { t = x; for (let i = 0; i < 30; i++) { const v = sx(t); if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; } }
      return sy(t);
    };
  }
  function springFn(opts = {}) {
    const k = opts.stiffness ?? 170, c = opts.damping ?? 26, m = opts.mass ?? 1, v0 = opts.velocity ?? 0;
    const w0 = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m));
    return (t) => {
      if (t <= 0) return 0;
      if (z < 1) {
        const wd = w0 * Math.sqrt(1 - z * z);
        return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0 - v0) / wd) * Math.sin(wd * t));
      }
      return 1 - Math.exp(-w0 * t) * (1 + (w0 - v0) * t);
    };
  }
  const BEZ = {
    'linear': [0, 0, 1, 1], 'ease': [0.25, 0.1, 0.25, 1], 'ease-in': [0.42, 0, 1, 1], 'ease-out': [0, 0, 0.58, 1], 'ease-in-out': [0.42, 0, 0.58, 1],
    'in-sine': [0.12, 0, 0.39, 0], 'out-sine': [0.61, 1, 0.88, 1], 'in-out-sine': [0.37, 0, 0.63, 1],
    'in-quad': [0.11, 0, 0.5, 0], 'out-quad': [0.5, 1, 0.89, 1], 'in-out-quad': [0.45, 0, 0.55, 1],
    'in-cubic': [0.32, 0, 0.67, 0], 'out-cubic': [0.33, 1, 0.68, 1], 'in-out-cubic': [0.65, 0, 0.35, 1],
    'in-quart': [0.5, 0, 0.75, 0], 'out-quart': [0.25, 1, 0.5, 1], 'in-out-quart': [0.76, 0, 0.24, 1],
    'in-quint': [0.64, 0, 0.78, 0], 'out-quint': [0.22, 1, 0.36, 1], 'in-out-quint': [0.83, 0, 0.17, 1],
    'in-expo': [0.7, 0, 0.84, 0], 'out-expo': [0.16, 1, 0.3, 1], 'in-out-expo': [0.87, 0, 0.13, 1],
    'in-circ': [0.55, 0, 1, 0.45], 'out-circ': [0, 0.55, 0.45, 1], 'in-out-circ': [0.85, 0, 0.15, 1],
    'in-back': [0.36, 0, 0.66, -0.56], 'out-back': [0.34, 1.56, 0.64, 1], 'in-out-back': [0.68, -0.6, 0.32, 1.6],
  };
  const SPRINGS = { spring: { stiffness: 170, damping: 26, T: 0.71 }, bouncy: { stiffness: 180, damping: 12, T: 1.14 }, snappy: { stiffness: 400, damping: 30, T: 0.4 }, gentle: { stiffness: 120, damping: 20, T: 0.58 } };
  // Curves that are not cubic-beziers. Each takes x in [0,1].
  function bounceOut(x) {
    const n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
    return n * (x -= 2.625 / d) * x + 0.984375;
  }
  function elasticOut(amp = 1, period = 0.3) {
    const a = Math.max(1, amp), s = (period / (2 * Math.PI)) * Math.asin(1 / a);
    return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : a * Math.pow(2, -10 * x) * Math.sin(((x - s) * (2 * Math.PI)) / period) + 1);
  }
  function backOut(o = 1.7) { return (x) => 1 + (o + 1) * Math.pow(x - 1, 3) + o * Math.pow(x - 1, 2); }
  // Physical easing ("natural"): the step response of a damped spring, stretched so it has settled when x reaches 1.
  // zeta = damping ratio: 1 = critically damped (lands without overshoot), 0.7 = about 5% overshoot that settles.
  // It starts from rest (mass: it takes a moment to get going) and lands about where out-expo lands (98% at x = 0.53).
  // v0 = starting speed, in "whole moves per whole duration" (for a move that carries the speed of the one before it).
  // A pure function of x; the tiny rest left at x = 1 is spread over the move so it ends exactly at 1.
  const physCache = new Map();
  function physEase(zeta = 1, v0 = 0) {
    const z = Math.max(0.3, Math.min(1, +zeta || 1)), v = +v0 || 0, ck = z + ',' + v;
    if (physCache.has(ck)) return physCache.get(ck);
    const EPS = 0.0003, env = (w) => (z < 1 ? Math.exp(-z * w) / Math.sqrt(1 - z * z) : Math.exp(-w) * (1 + w));
    let lo = 0.5, hi = 200, w = 10;
    for (let i = 0; i < 60; i++) { w = (lo + hi) / 2; if (env(w) > EPS) lo = w; else hi = w; }
    const wd = z < 1 ? w * Math.sqrt(1 - z * z) : 0;
    const s = z < 1 ? (x) => 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + ((z * w - v) / wd) * Math.sin(wd * x)) : (x) => 1 - Math.exp(-w * x) * (1 + (w - v) * x);
    const r = 1 - s(1);
    const fn = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : s(x) + r * x * x * x);
    physCache.set(ck, fn);
    return fn;
  }
  // A move with mass ("natural-move"): a spring that follows a target sliding from 0 to 1 over the first half. It
  // gathers speed smoothly (no kick), cruises, and settles at the end (zeta 0.7: about 1.5% overshoot). 90% at x = 0.55.
  const moveCache = new Map();
  function moveEase(zeta = 0.7) {
    const z = Math.max(0.3, Math.min(1, +zeta || 1));
    if (moveCache.has(z)) return moveCache.get(z);
    const w = 14, Tr = 0.5, a = z * w, b = z < 1 ? w * Math.sqrt(1 - z * z) : 0;
    // S(t): the integral of the spring's step response (closed form), so the ramp response is (S(t) - S(t - Tr)) / Tr
    const S = (t) => (t <= 0 ? 0 : z >= 1 ? t - (2 - Math.exp(-w * t) * (2 + w * t)) / w : t - (Math.exp(-a * t) * ((b - (a * a) / b) * Math.sin(b * t) - 2 * a * Math.cos(b * t)) + 2 * a) / (w * w));
    const f = (t) => (S(t) - S(t - Tr)) / Tr, r = 1 - f(1);
    const fn = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : f(x) + r * x * x * x);
    moveCache.set(z, fn);
    return fn;
  }
  // A cubic from 0 to 1 that starts with slope a and ends with slope b (for the middle of a chain of moves).
  function hermiteEase(a, b) { return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : ((a + b - 2) * x + (3 - 2 * a - b)) * x * x + a * x); }
  const inv = (f) => (x) => 1 - f(1 - x);
  const inOut = (fOut) => (x) => (x < 0.5 ? (1 - fOut(1 - 2 * x)) / 2 : (1 + fOut(2 * x - 1)) / 2);
  const FUNCS = {
    'out-bounce': () => bounceOut, 'in-bounce': () => inv(bounceOut), 'in-out-bounce': () => inOut(bounceOut),
    'out-elastic': (p) => elasticOut(p[0], p[1]), 'in-elastic': (p) => inv(elasticOut(p[0], p[1])), 'in-out-elastic': (p) => inOut(elasticOut(p[0], p[1] ?? 0.45)),
    'out-back': (p) => backOut(p[0]), 'in-back': (p) => inv(backOut(p[0])), 'in-out-back': (p) => inOut(backOut(p[0] ?? 2.5)),
    'natural': (p) => physEase(p[0] ?? 1, p[1] ?? 0), 'natural-move': (p) => moveEase(p[0] ?? 0.7),
  };
  // GSAP-style names ("power2.out", "back.out(1.7)", "sine.inOut", "none") are accepted because models write them by habit.
  const GS_KIND = { power0: 'linear', none: 'linear', linear: 'linear', power1: 'quad', quad: 'quad', power2: 'cubic', cubic: 'cubic', power3: 'quart', quart: 'quart', power4: 'quint', quint: 'quint', strong: 'quint', sine: 'sine', expo: 'expo', circ: 'circ', back: 'back', elastic: 'elastic', bounce: 'bounce' };
  function normEase(name) {
    let s = String(name || 'linear').trim();
    let params = [];
    const pm = /^([\w.-]+)\(([^)]*)\)$/.exec(s);
    if (pm && !/^(cubic-bezier|linear|steps)$/.test(pm[1])) { s = pm[1]; params = pm[2].split(',').map((x) => parseFloat(x)).filter((x) => isFinite(x)); }
    if (BEZ[s] || SPRINGS[s]) return { key: s, params };
    const g = /^([a-z]+\d?)(?:\.(in|out|inOut|in-out))?$/i.exec(s);
    if (g && GS_KIND[g[1].toLowerCase()] && (g[2] || /^(power\d|none|strong|bounce|elastic)$/i.test(g[1]))) {
      const kind = GS_KIND[g[1].toLowerCase()];
      if (kind === 'linear') return { key: 'linear', params };
      const dir = !g[2] ? 'out' : /^in-?out$/i.test(g[2]) ? 'in-out' : g[2].toLowerCase();
      return { key: dir + '-' + kind, params };
    }
    s = s.replace(/^ease-(?=(in|out|spring|bouncy|snappy|gentle))/, '');
    s = s.replace(/^ease(In|Out|InOut)(\w+)$/, (_, d, k) => (d === 'InOut' ? 'in-out' : d.toLowerCase()) + '-' + k.toLowerCase()); // easeOutCubic
    s = s.replace(/^(in|out|inOut)([A-Z]\w*)$/, (_, d, k) => (d === 'inOut' ? 'in-out' : d) + '-' + k.toLowerCase()); // outCubic
    return { key: s, params };
  }
  const easeCache = new Map();
  function easing(name) {
    if (typeof name === 'function') return name;
    const ck = String(name);
    if (easeCache.has(ck)) return easeCache.get(ck);
    const { key, params } = normEase(name);
    let fn;
    let m;
    if (FUNCS[key] && (params.length || !BEZ[key])) fn = FUNCS[key](params);
    else if (BEZ[key]) fn = cubicBezier(...BEZ[key]);
    else if (SPRINGS[key]) { const s = SPRINGS[key], f = springFn(s); fn = (x) => (x >= 1 ? 1 : f(x * s.T)); }
    else if ((m = /^cubic-bezier\(([^)]+)\)$/.exec(key))) fn = cubicBezier(...m[1].split(',').map(Number));
    else if ((m = /^steps\((\d+)\)$/.exec(key))) { const n = +m[1]; fn = (x) => (x >= 1 ? 1 : Math.floor(x * n) / n); }
    else if ((m = /^linear\((.+)\)$/.exec(key))) { const pts = m[1].split(',').map((v) => parseFloat(v)); fn = (x) => { if (x <= 0) return pts[0]; if (x >= 1) return pts[pts.length - 1]; const f = x * (pts.length - 1), i = Math.floor(f); return pts[i] + (pts[i + 1] - pts[i]) * (f - i); }; }
    else fn = (x) => x;
    easeCache.set(ck, fn);
    return fn;
  }
  function cssEasing(name) {
    if (typeof name === 'function') return sampleLinear(name);
    const { key, params } = normEase(name || 'out-expo');
    if (BEZ[key] && !params.length) return 'cubic-bezier(' + BEZ[key].join(',') + ')';
    if (FUNCS[key] || SPRINGS[key] || /^steps\(/.test(key)) return sampleLinear(easing(name));
    if (/^(cubic-bezier|linear)\(/.test(key)) return key;
    return 'linear';
  }
  function sampleLinear(fn, n = 60) {
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(Math.round(fn(i / n) * 10000) / 10000);
    return 'linear(' + pts.join(', ') + ')';
  }
  function isEasingName(tok) {
    if (/^(cubic-bezier|linear|steps)\(/.test(tok)) return true;
    const { key } = normEase(tok);
    return !!(BEZ[key] || SPRINGS[key] || FUNCS[key]);
  }

  // ---------------------------------------------------------------------------
  // Composition settings
  // ---------------------------------------------------------------------------
  const root = document.documentElement;
  function rootAttr(name) {
    return root.getAttribute('data-' + name) ?? (document.body && document.body.getAttribute('data-' + name));
  }
  const comp = { width: 1920, height: 1080, fps: 30, duration: 0, background: null };

  // ---------------------------------------------------------------------------
  // Timeline: clips, sequences
  // ---------------------------------------------------------------------------
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'LINK', 'META', 'TITLE', 'NOSCRIPT', 'BR']);
  const TRANSITIONS = {
    'fade': { enter: 'fade' },
    'crossfade': { enter: 'fade' },
    'slide-left': { enter: 'slide-left', exit: 'slide-left', ease: 'in-out-cubic' },
    'slide-right': { enter: 'slide-right', exit: 'slide-right', ease: 'in-out-cubic' },
    'slide-up': { enter: 'slide-up', exit: 'slide-up', ease: 'in-out-cubic' },
    'slide-down': { enter: 'slide-down', exit: 'slide-down', ease: 'in-out-cubic' },
    'push-left': { enter: 'slide-left', exit: 'slide-left', ease: 'in-out-quart' },
    'push-right': { enter: 'slide-right', exit: 'slide-right', ease: 'in-out-quart' },
    'push-up': { enter: 'slide-up', exit: 'slide-up', ease: 'in-out-quart' },
    'push-down': { enter: 'slide-down', exit: 'slide-down', ease: 'in-out-quart' },
    'cover-left': { enter: 'slide-left', ease: 'in-out-quart' }, 'cover-right': { enter: 'slide-right', ease: 'in-out-quart' },
    'cover-up': { enter: 'slide-up', ease: 'in-out-quart' }, 'cover-down': { enter: 'slide-down', ease: 'in-out-quart' },
    'whip-left': { enter: 'whip-left', exit: 'whip-left', ease: 'in-out-expo' },
    'whip-right': { enter: 'whip-right', exit: 'whip-right', ease: 'in-out-expo' },
    'whip-up': { enter: 'whip-up', exit: 'whip-up', ease: 'in-out-expo' },
    'whip-down': { enter: 'whip-down', exit: 'whip-down', ease: 'in-out-expo' },
    'wipe-left': { enter: 'wipe-left', ease: 'in-out-cubic' }, 'wipe-right': { enter: 'wipe-right', ease: 'in-out-cubic' },
    'wipe-up': { enter: 'wipe-up', ease: 'in-out-cubic' }, 'wipe-down': { enter: 'wipe-down', ease: 'in-out-cubic' },
    'diagonal': { enter: 'diagonal', ease: 'in-out-cubic' },
    'clock': { enter: 'clock', ease: 'in-out-cubic' },
    'zoom': { enter: 'zoom', exit: 'fade' },
    'zoom-through': { enter: 'zoom-near', exit: 'zoom-past', ease: 'in-out-cubic' },
    'flip': { enter: 'flip-in', exit: 'flip-out', ease: 'in-out-cubic' },
    'dip': { enter: 'dip-in', exit: 'dip-out', ease: 'linear' },
    'blur': { enter: 'blur' },
    'iris': { enter: 'iris', ease: 'in-out-cubic' },
    'fade-up': { enter: 'fade-up', exit: 'fade-up' },
    'morph': { enter: 'fade', ease: 'in-out-cubic', morph: true },
    // a solid colour band sweeps across; the new scene is revealed behind it (its centre crosses the frame centre
    // halfway through, so with data-cut-align="middle" that moment sits on the cut)
    'band': { enter: 'band-right', ease: 'in-out-sine' }, 'band-right': { enter: 'band-right', ease: 'in-out-sine' },
    'band-left': { enter: 'band-left', ease: 'in-out-sine' }, 'band-up': { enter: 'band-up', ease: 'in-out-sine' }, 'band-down': { enter: 'band-down', ease: 'in-out-sine' },
  };
  let clips = []; // {el, start, end, parent}
  let morphPairs = []; // shared-element transitions: {from, to, dur, ease}
  let hasRemap = false;
  const clipOf = new WeakMap();
  let timelineDirty = true;

  function isClipEl(el) {
    if (SKIP_TAGS.has(el.tagName) || el === document.documentElement || el === document.body) return false;
    if (el.hasAttribute('data-start') || el.hasAttribute('data-duration') || el.hasAttribute('data-end')) return true;
    const p = el.parentElement;
    return !!(p && p.hasAttribute('data-sequence'));
  }
  // Band options in a data-transition / data-enter value: a colour (#hex, rgb(...) without spaces, var(--x), a named
  // colour), the band width as a % of the frame side it travels along, and the slant of its edges in deg.
  const isBand = (name) => /^band(-|$)/.test(name || '');
  function bandOpts(toks) {
    const out = { rest: [], color: null, width: null, angle: null };
    for (const t of toks) {
      if (/^-?(\d+\.?\d*|\.\d+)%$/.test(t)) out.width = parseFloat(t);
      else if (/^-?(\d+\.?\d*|\.\d+)deg$/.test(t)) out.angle = parseFloat(t);
      else if (!isEasingName(t) && (/^#[0-9a-f]{3,8}$/i.test(t) || /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|var)\(.*\)$/i.test(t) || (/^[a-z]+$/i.test(t) && CSS.supports('color', t)))) out.color = t;
      else out.rest.push(t);
    }
    return out;
  }
  function bandTail(b) { return b ? (b.color ? ' ' + b.color : '') + (b.width != null ? ' ' + b.width + '%' : '') + (b.angle != null ? ' ' + b.angle + 'deg' : '') : ''; }
  function parseTransition(v) {
    if (!v) return null;
    let toks = v.trim().split(/\s+/);
    const name = toks[0];
    let band = null;
    if (isBand(name)) { band = bandOpts(toks.slice(1)); toks = [name, ...band.rest]; }
    let dur = 0.6;
    for (const t of toks.slice(1)) { if (isEasingName(t)) continue; const n = parseTime(t, null, 'data-transition'); if (n != null) dur = n; }
    if (!TRANSITIONS[name]) { report('error', 'bad-transition', `Unknown transition "${name}".`, null, 'Use one of: ' + Object.keys(TRANSITIONS).join(', ')); return null; }
    return { name, dur, ease: toks.find(isEasingName) || null, band };
  }

  let transitionList = [];
  function buildTimeline() {
    morphPairs = [];
    transitionList = [];
    const els = [...document.querySelectorAll('[data-start],[data-duration],[data-end],[data-sequence] > *')].filter(isClipEl);
    const info = new Map();
    for (const el of els) info.set(el, null);
    const seqCache = new Map();
    function parentClip(el) {
      let p = el.parentElement;
      while (p && !info.has(p)) p = p.parentElement;
      return p || null;
    }
    function seqLayout(container) {
      if (seqCache.has(container)) return seqCache.get(container);
      const tr = parseTransition(container.getAttribute('data-transition'));
      const gap = parseTime(container.getAttribute('data-gap'), container, 'data-gap') || 0;
      const kids = [...container.children].filter((c) => !SKIP_TAGS.has(c.tagName));
      // data-cuts="0 2.13 4.27": when each child starts (e.g. on music beats); durations follow from them.
      const cutsAttr = container.getAttribute('data-cuts');
      // ("beats: 0 4 8 12" / "bars: 0 1 2 4": on the <html data-bpm> beat grid)
      const unit = cutsAttr && /^\s*(beats?|bars?)\s*:/i.exec(cutsAttr);
      const cuts = !cutsAttr ? null : unit
        ? cutsAttr.slice(unit[0].length).trim().split(/[\s,]+/).filter(Boolean).map((x) => { const n = parseFloat(x); if (!isFinite(n)) { report('error', 'bad-time', `data-cuts: "${x}" is not a number of ${unit[1]}.`, container); return null; } const g = beatGrid(); return /^bar/i.test(unit[1]) ? g.barOffset + n * g.perBar * g.period : g.offset + n * g.period; }).filter((x) => x != null)
        : cutsAttr.trim().split(/[\s,]+/).map((x) => parseTime(x, container, 'data-cuts')).filter((x) => x != null);
      if (cuts && cuts.length) {
        const map = new Map(), trs = [];
        let end = 0;
        kids.forEach((k, i) => {
          const own = i > 0 ? parseTransition(k.getAttribute('data-transition')) : null;
          const t = i > 0 ? (own || tr) : null;
          trs.push(t);
          // data-cut-align: is the cut time the start (default), middle or end of the transition into this child?
          const align = container.getAttribute('data-cut-align') || 'start';
          const shift = t ? (align === 'middle' ? t.dur / 2 : align === 'end' ? t.dur : 0) : 0;
          const start = cuts[i] != null ? Math.max(0, cuts[i] - shift) : end;
          const nextT = i + 1 < kids.length ? (parseTransition(kids[i + 1].getAttribute('data-transition')) || tr) : null;
          let d;
          const nshift = nextT ? (align === 'middle' ? nextT.dur / 2 : align === 'end' ? nextT.dur : 0) : 0;
          if (cuts[i + 1] != null) d = cuts[i + 1] - nshift - start + (nextT ? nextT.dur : 0);
          else {
            // the last child runs to the end of the video when <html data-duration> is set
            const own = parseTime(k.getAttribute('data-duration'), k, 'data-duration');
            const total = parseTime(rootAttr('duration'), root, 'data-duration');
            let nested = container.hasAttribute('data-start') || container.hasAttribute('data-duration');
            for (let an = container.parentElement; an && an !== document.body && an !== root; an = an.parentElement) if (an.hasAttribute('data-start') || an.hasAttribute('data-duration')) nested = true;
            d = own ?? (total != null && !nested && total > start ? total - start : 3);
          }
          if (cuts[i] == null && i < kids.length) report('warning', 'cuts-short', `data-cuts has ${cuts.length} times for ${kids.length} children; the rest follow one after another.`, container);
          map.set(k, { start, dur: d, index: i, count: kids.length });
          end = start + d;
        });
        const res = { map, length: end, tr, trs };
        seqCache.set(container, res);
        return res;
      }
      let cursor = 0;
      const map = new Map();
      const trs = [];
      kids.forEach((k, i) => {
        let d = parseTime(k.getAttribute('data-duration'), k, 'data-duration');
        if (d == null) {
          const e = parseTime(k.getAttribute('data-end'), k, 'data-end');
          if (e != null) d = e;
        }
        if (d == null) {
          report('error', 'sequence-missing-duration', 'Every child of a data-sequence needs data-duration.', k, 'Add data-duration="3" (seconds) to this element.');
          d = 0;
        }
        // How this child comes in: its own data-transition, else the container's.
        const own = i > 0 ? parseTransition(k.getAttribute('data-transition')) : null;
        const t = i > 0 ? (own || tr) : null;
        trs.push(t);
        if (t) cursor -= t.dur;
        const offset = parseTime(k.getAttribute('data-start'), k, 'data-start') || 0; // extra shift inside sequence
        map.set(k, { start: cursor + offset, dur: d, index: i, count: kids.length });
        cursor += d + gap;
      });
      const res = { map, length: cursor - gap, tr, trs };
      seqCache.set(container, res);
      return res;
    }
    function compute(el, total) {
      const cur = info.get(el);
      if (cur) return cur;
      const pEl = parentClip(el);
      const P = pEl ? compute(pEl, total) : { start: 0, end: total };
      const parent = el.parentElement;
      let start, dur;
      if (parent && parent.hasAttribute('data-sequence')) {
        // The sequence's own clip (if any) is P when parent is a clip; else the clip enclosing the container.
        const base = info.has(parent) ? compute(parent, total) : P;
        const lay = seqLayout(parent);
        const slot = lay.map.get(el);
        start = base.start + slot.start;
        dur = slot.dur;
        const r = { start, end: Math.min(start + dur, base.end), parent: pEl, seq: lay, slot };
        info.set(el, r);
        return r;
      }
      // a word (data-start="@pricing") is a moment of the whole video, not a time inside the parent clip
      const isWord = (a) => String(el.getAttribute(a) || '').trim()[0] === '@';
      const st0 = parseTime(el.getAttribute('data-start'), el, 'data-start') || 0;
      start = isWord('data-start') ? st0 : P.start + st0;
      dur = parseTime(el.getAttribute('data-duration'), el, 'data-duration');
      if (dur == null) {
        const e = parseTime(el.getAttribute('data-end'), el, 'data-end');
        if (e != null) dur = (isWord('data-end') ? 0 : P.start) + e - start;
      }
      // A sequence container without explicit duration lasts as long as its children.
      if (dur == null && el.hasAttribute('data-sequence')) dur = seqLayout(el).length;
      const end = dur == null ? P.end : Math.min(start + dur, P.end);
      const r = { start, end, parent: pEl };
      info.set(el, r);
      return r;
    }
    // Pass 1: unknown total → find the natural end of the composition.
    let total = parseTime(rootAttr('duration'), root, 'data-duration');
    if (total == null) {
      let maxEnd = 0;
      for (const el of els) { const r = compute(el, Infinity); if (isFinite(r.end)) maxEnd = Math.max(maxEnd, r.end); }
      // Top-level sequences without clip attributes
      for (const s of document.querySelectorAll('[data-sequence]')) {
        if (!info.has(s) && !parentClip(s)) maxEnd = Math.max(maxEnd, seqLayout(s).length);
      }
      for (const k of info.keys()) info.set(k, null);
      seqCache.clear();
      total = maxEnd;
    }
    for (const el of els) compute(el, total);
    comp.duration = total;
    clips = els.map((el) => Object.assign({ el }, info.get(el)));
    clips.forEach((c) => clipOf.set(c.el, c));
    // Time remapping: data-loop, data-freeze, data-speed change the time seen by a clip's content.
    hasRemap = false;
    for (const c of clips) {
      const el = c.el;
      const loop = parseTime(el.getAttribute('data-loop'), el, 'data-loop');
      const freeze = parseTime(el.getAttribute('data-freeze'), el, 'data-freeze');
      const speed = el.hasAttribute('data-speed') ? parseFloat(el.getAttribute('data-speed')) : null;
      if (loop != null || freeze != null || (speed != null && speed !== 1)) {
        c.remap = { loop: loop > 0 ? loop : null, freeze, speed: speed != null && isFinite(speed) ? speed : 1 };
        hasRemap = true;
      }
    }
    for (const c of clips) {
      const chain = [];
      let p = c;
      while (p) { if (p.remap) chain.unshift(p); p = p.parent ? clipOf.get(p.parent) : null; }
      c.chain = chain; // outer → inner, includes c itself if it remaps
      c.outer = chain[chain.length - 1] === c ? chain.slice(0, -1) : chain;
    }
    // Apply sequence transitions to children that do not define their own enter/exit.
    for (const [container, lay] of seqCache) {
      const kids = [...lay.map.keys()];
      kids.forEach((k, i) => {
        const t = lay.trs[i];
        if (!t) return;
        const def = TRANSITIONS[t.name];
        const ez = t.ease || def.ease;
        const tail = `${t.dur}s${ez ? ' ' + ez : ''}${bandTail(t.band)}`;
        if (def.morph) morphPairs.push({ from: kids[i - 1], to: k, dur: t.dur, ease: ez || 'in-out-cubic' });
        const kc = clipOf.get(k);
        if (kc) transitionList.push({ name: t.name, start: round(kc.start), end: round(kc.start + t.dur) });
        // (a scene transition keeps its fixed curve in natural motion too: it is a cut, not an object with mass)
        if (def.enter && !k.hasAttribute('data-enter')) { k.setAttribute('data-enter', `${def.enter} ${tail}`); k.__gmTransition = true; }
        const prev = kids[i - 1];
        if (prev && def.exit && !prev.hasAttribute('data-exit')) prev.setAttribute('data-exit', `${def.exit} ${tail}`);
      });
    }
    // Lint: clips that never show
    for (const c of clips) {
      if (c.end <= c.start && !(c.el.tagName === 'AUDIO')) report('warning', 'empty-clip', `Element is never visible (start ${round(c.start)}s, end ${round(c.end)}s).`, c.el, 'Check data-start / data-duration against its parent clip.');
      if (c.start >= total && total > 0) report('warning', 'clip-after-end', `Element starts at ${round(c.start)}s, after the video ends (${round(total)}s).`, c.el, 'Increase data-duration on <html> or move this clip earlier.');
    }
    timelineDirty = false;
  }

  function applyChain(chain, T) {
    for (const R of chain) {
      const r = R.remap;
      let lt = T - R.start;
      if (r.freeze != null) lt = r.freeze;
      else { lt *= r.speed; if (r.loop) lt = lt >= 0 ? lt % r.loop : lt; }
      T = R.start + lt;
    }
    return T;
  }
  // The time an element's content sees (after loop/freeze/speed of its clips).
  function mapT(el, T) {
    if (!hasRemap || !el) return T;
    const c = nearestClip(el);
    return c && c.chain.length ? applyChain(c.chain, T) : T;
  }
  function nearestClip(el) {
    let cur = el;
    while (cur && cur.nodeType === 1) {
      const c = clipOf.get(cur);
      if (c) return c;
      cur = cur.parentElement || (cur.getRootNode && cur.getRootNode().host) || null;
    }
    return null;
  }
  function beatGrid() {
    const h = document.documentElement;
    const bpm = parseFloat(h.getAttribute('data-bpm'));
    if (!(bpm > 0)) report('warning', 'no-bpm', 'gm.beat()/gm.bar() need <html data-bpm="…">: using 120 BPM.', null, 'Run `npx givemotion audio music.mp3`: it prints the data-bpm, data-beat-offset and data-bar-offset to copy.');
    const period = 60 / (bpm > 0 ? bpm : 120);
    const offset = parseFloat(h.getAttribute('data-beat-offset')) || 0;
    const barOffset = h.hasAttribute('data-bar-offset') ? parseFloat(h.getAttribute('data-bar-offset')) || 0 : offset;
    const perBar = parseInt(h.getAttribute('data-beats-per-bar'), 10) || 4;
    return { period, offset, barOffset, perBar };
  }
  function clipStartOf(el) { const c = nearestClip(el); return c ? c.start : 0; }
  function clipEndOf(el) { const c = nearestClip(el); return c ? c.end : comp.duration; }

  let lastVisible = '';
  function updateVisibility(T) {
    let sig = '';
    for (const c of clips) {
      const tt = hasRemap && c.outer.length ? applyChain(c.outer, T) : T;
      const on = tt >= c.start - 1e-9 && tt < c.end - 1e-9;
      sig += on ? '1' : '0';
      if (on) { if (c.el.hasAttribute('data-gm-hidden')) c.el.removeAttribute('data-gm-hidden'); }
      else if (!c.el.hasAttribute('data-gm-hidden')) c.el.setAttribute('data-gm-hidden', '');
    }
    const changed = sig !== lastVisible;
    lastVisible = sig;
    return changed;
  }

  // ---------------------------------------------------------------------------
  // Animation registry: every CSS animation, CSS transition and WAAPI animation
  // is paused and driven from the virtual clock.
  // ---------------------------------------------------------------------------
  const known = new Set();
  const origin = new WeakMap(); // animation -> seconds
  const ownAnim = new WeakSet();

  // Scrolling is instant. A smooth scroll runs on its own clock, so a frame would catch it part way and differ from run
  // to run (CSS scroll-behavior is switched off in preset.css; this covers behavior: 'smooth' in the calls).
  for (const [proto, names] of /** @type {Array<[any, string[]]>} */ ([[Element.prototype, ['scroll', 'scrollTo', 'scrollBy', 'scrollIntoView']], [window, ['scroll', 'scrollTo', 'scrollBy']]])) {
    for (const n of names) {
      const orig = proto[n];
      if (typeof orig !== 'function') continue;
      proto[n] = function (...args) {
        if (args[0] && typeof args[0] === 'object' && args[0].behavior) args[0] = Object.assign({}, args[0], { behavior: 'instant' });
        return orig.apply(this, args);
      };
    }
  }

  const preInit = [];
  let pendingInit = true;
  Element.prototype.animate = function (...args) {
    const a = real.animate.apply(this, args);
    if (!origin.has(a)) {
      origin.set(a, pendingInit ? 0 : Math.max(now, clipStartOf(this)));
      known.add(a);
      if (pendingInit) preInit.push(a);
    }
    try { a.pause(); a.currentTime = Math.max(0, (now - origin.get(a)) * 1000); } catch (e) {}
    return a;
  };

  function targetOf(a) {
    const eff = a.effect;
    return eff && eff.target ? eff.target : null;
  }
  // mode: 'clip' → origin = start of the target's clip (animations that exist because a clip is visible)
  //       'event' → origin = the time of the event that created it (timer, script)
  function flushAnimations(t, mode) {
    let list;
    try { list = document.getAnimations(); } catch (e) { return; }
    for (const a of list) {
      if (known.has(a)) continue;
      known.add(a);
      const tg = targetOf(a);
      const cs = tg ? clipStartOf(tg) : 0;
      origin.set(a, mode === 'clip' ? cs : Math.max(t, cs));
      trimFill(a);
      if (inFrameCallbacks && mode !== 'clip') {
        report('warning', 'non-seekable-animation', 'A CSS animation/transition started inside gm.onFrame(). It will not seek correctly when rendering in parallel.', tg, 'Inside onFrame, set styles directly from t (use gm.interpolate). To start a CSS animation at a time, use data-start on the element instead.', t);
      }
    }
  }
  let inFrameCallbacks = false;

  // A CSS animation whose @keyframes set nothing at 100% (only `from`, like fade-up and most presets) ends on the
  // element's own style, so the forwards half of `fill-mode: both` changes no pixel. But Chrome keeps every element
  // with an animation in effect on its own composited layer, redrawn on every frame without a GPU, for the rest of
  // the clip. So drop the forwards half for those: same look at every time, fewer layers.
  const endProps = new Map(); // @keyframes name -> Set of properties set at 100% (null: not found)
  const propKey = (p) => p.toLowerCase().replace(/[^a-z]/g, '').replace(/^webkit/, ''); // 'stroke-dashoffset' = 'strokeDashoffset'
  function keyframesEnd(name) {
    if (endProps.has(name)) return endProps.get(name);
    let found = null;
    const walk = (rules) => {
      for (const r of rules) {
        if (r.type === 7 && r.name === name) { // CSSKeyframesRule; the last one wins
          found = new Set();
          for (const k of r.cssRules) if (k.keyText.split(',').some((x) => x.trim() === '100%' || x.trim() === 'to')) for (let i = 0; i < k.style.length; i++) found.add(propKey(k.style[i]));
        } else if (r.cssRules) walk(r.cssRules);
      }
    };
    try { for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch (e) { continue; } walk(rs); } } catch (e) { found = null; }
    endProps.set(name, found);
    return found;
  }
  function trimFill(a) {
    try {
      if (typeof CSSAnimation === 'undefined' || !(a instanceof CSSAnimation) || !a.effect) return;
      const eff = /** @type {KeyframeEffect} */ (a.effect), tm = eff.getTiming();
      if ((tm.fill !== 'both' && tm.fill !== 'forwards') || tm.direction !== 'normal' || tm.iterationStart || !Number.isInteger(tm.iterations) || eff.composite !== 'replace') return;
      const end = keyframesEnd(a.animationName);
      if (!end) return;
      for (const k of eff.getKeyframes()) for (const p of Object.keys(k)) if (!/^(offset|computedOffset|easing|composite)$/.test(p) && end.has(propKey(p))) return;
      eff.updateTiming({ fill: tm.fill === 'both' ? 'backwards' : 'none' });
    } catch (e) {}
  }

  // SVG's own animations (<animate>, <animateTransform>, <animateMotion>, <set>) run on the SVG's clock, which does not
  // follow the video: they sat still at wherever the page happened to be when it loaded, a different place on every
  // run. Each SVG with one is put on the video clock, counted from the start of its clip like a CSS animation.
  let smilRoots = null;
  function seekSmil(T) {
    if (smilRoots === null || mutated) smilRoots = [...document.querySelectorAll('svg')].filter((v) => !(v.parentNode instanceof SVGElement) && v.querySelector('animate,animateTransform,animateMotion,set'));
    for (const v of smilRoots) {
      try { v.pauseAnimations(); v.setCurrentTime(Math.max(0, (hasRemap ? mapT(v, T) : T) - clipStartOf(v))); } catch (e) {}
    }
    return smilRoots.length > 0;
  }

  function seekAnimations(T) {
    let active = false;
    for (const a of known) {
      const ps = a.playState;
      const isCss = (typeof CSSAnimation !== 'undefined' && a instanceof CSSAnimation) || (typeof CSSTransition !== 'undefined' && a instanceof CSSTransition);
      if (isCss && ps === 'idle') { known.delete(a); continue; }
      const tg = targetOf(a);
      if (tg && !tg.isConnected) { known.delete(a); continue; }
      if (!isCss && ps === 'idle' && !ownAnim.has(a)) continue;
      const o = origin.get(a) || 0;
      const own = ownAnim.has(a);
      const rate = own ? 1 : a.playbackRate || 1;
      const ms = ((hasRemap ? mapT(tg, T) : T) - o) * 1000 * rate;
      // Our own enter/exit/camera animations: an exit that has not started (or an enter that is over) changes
      // nothing, but Chrome still counts it as about to run and keeps the element on its own composited layer
      // (with an offscreen pass for blur moves) for its whole life, which costs CPU on every frame without a GPU.
      // So cancel it while it has no effect (setting currentTime later brings it back, paused, as before), and
      // while it holds its first keyframe before it starts, run it "backwards": same look, but not about to play.
      if (own && a.effect) {
        try {
          const ct = a.effect.getComputedTiming(), fill = ct.fill;
          const before = ms < ct.delay, after = ms >= ct.delay + ct.activeDuration;
          if ((before && fill !== 'backwards' && fill !== 'both') || (after && fill !== 'forwards' && fill !== 'both')) {
            if (ps !== 'idle') a.cancel();
            continue;
          }
          const dir = before ? -1 : 1;
          if (a.playbackRate !== dir) a.playbackRate = dir;
        } catch (e) {}
      }
      try {
        if (ps !== 'paused' && ps !== 'idle') a.pause();
        a.currentTime = ms;
      } catch (e) { continue; }
      if (!active) {
        try {
          const ct = a.effect && a.effect.getComputedTiming();
          if (ct && ct.progress != null) {
            const at = ct.localTime, d = ct.delay || 0, ad = ct.activeDuration;
            if (at > d && at < d + ad) active = true; // inside active phase → frame changes
          }
        } catch (e) { active = true; }
      }
    }
    return active;
  }

  // ---------------------------------------------------------------------------
  // data-enter / data-exit
  // ---------------------------------------------------------------------------
  // 1 unit = 1px when the short side of the frame is 1080px (so 1080p, 1080x1920 and 1080x1080 all use the same sizes).
  const PX = () => Math.min(comp.width, comp.height) / 1080;
  const B = (n) => `blur(${n * PX()}px)`;
  const MASK_OUT = 'inset(-30% -10% -18% -10%)';
  const PRESETS = {
    'fade': () => [{ opacity: 0 }, { opacity: 1 }],
    'fade-up': () => [{ opacity: 0, translate: `0 ${48 * PX()}px` }, { opacity: 1, translate: '0 0' }],
    'fade-down': () => [{ opacity: 0, translate: `0 ${-48 * PX()}px` }, { opacity: 1, translate: '0 0' }],
    'fade-left': () => [{ opacity: 0, translate: `${48 * PX()}px 0` }, { opacity: 1, translate: '0 0' }],
    'fade-right': () => [{ opacity: 0, translate: `${-48 * PX()}px 0` }, { opacity: 1, translate: '0 0' }],
    'rise': () => [{ opacity: 0, translate: `0 ${90 * PX()}px`, filter: B(10) }, { opacity: 1, translate: '0 0', filter: B(0) }],
    'scale': () => [{ opacity: 0, scale: '0.85' }, { opacity: 1, scale: '1' }],
    'pop': () => [{ opacity: 0, scale: '0.4', offset: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 1, scale: '1', offset: 1 }],
    'zoom': () => [{ opacity: 0, scale: '1.25' }, { opacity: 1, scale: '1' }],
    'blur': () => [{ opacity: 0, filter: B(18) }, { opacity: 1, filter: B(0) }],
    'slide-up': () => [{ translate: '0 100%' }, { translate: '0 0' }],
    'slide-down': () => [{ translate: '0 -100%' }, { translate: '0 0' }],
    'slide-left': () => [{ translate: '100% 0' }, { translate: '0 0' }],
    'slide-right': () => [{ translate: '-100% 0' }, { translate: '0 0' }],
    'whip-left': () => [{ translate: '100% 0', filter: B(28) }, { translate: '0 0', filter: B(0) }],
    'whip-right': () => [{ translate: '-100% 0', filter: B(28) }, { translate: '0 0', filter: B(0) }],
    'whip-up': () => [{ translate: '0 100%', filter: B(28) }, { translate: '0 0', filter: B(0) }],
    'whip-down': () => [{ translate: '0 -100%', filter: B(28) }, { translate: '0 0', filter: B(0) }],
    'wipe-right': () => [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }],
    'wipe-left': () => [{ clipPath: 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0%)' }],
    'wipe-down': () => [{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)' }],
    'wipe-up': () => [{ clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)' }],
    'diagonal': () => [{ clipPath: 'polygon(0% 0%, 0% 0%, -40% 100%, -40% 100%)' }, { clipPath: 'polygon(0% 0%, 140% 0%, 100% 100%, -40% 100%)' }],
    'clock': () => [{ '--gm-clock': '0%' }, { '--gm-clock': '100%' }],
    'iris': () => [{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)' }],
    // (zoom-through: the new scene grows in behind the old one, which flies past the camera on top)
    // (it stays full size: a smaller scene would show a dark frame around it through the fading old one)
    'zoom-near': () => [{ opacity: 1 }, { opacity: 1 }],
    'flip-in': () => [{ transform: 'perspective(2400px) rotateY(90deg)', opacity: 0, offset: 0 }, { transform: 'perspective(2400px) rotateY(90deg)', opacity: 0, offset: 0.5 }, { opacity: 1, offset: 0.5001 }, { transform: 'perspective(2400px) rotateY(0deg)', opacity: 1, offset: 1 }],
    'dip-in': () => [{ opacity: 0, filter: 'brightness(0)', offset: 0 }, { opacity: 0, filter: 'brightness(0)', offset: 0.5 }, { opacity: 1, filter: 'brightness(0)', offset: 0.5001 }, { opacity: 1, filter: 'brightness(1)', offset: 1 }],
    // (dash 1, gap 2, starting just inside the gap: nothing is painted before the draw, not even a round-cap dot)
    'draw': () => [{ strokeDasharray: '1 2', strokeDashoffset: 1.002 }, { strokeDasharray: '1 2', strokeDashoffset: 0 }],
    // handwriting: the text appears left to right at pen speed (pairs with a hand font and data-split="lines")
    'write': () => [{ clipPath: 'inset(-40% 100% -40% -4%)' }, { clipPath: 'inset(-40% -4% -40% -4%)' }],
    // Text and object entrances
    'mask-up': () => [{ translate: '0 100%', clipPath: 'inset(-30% -10% 100% -10%)' }, { translate: '0 0', clipPath: MASK_OUT }],
    'mask-down': () => [{ translate: '0 -100%', clipPath: 'inset(100% -10% -18% -10%)' }, { translate: '0 0', clipPath: MASK_OUT }],
    'mask-left': () => [{ translate: '100% 0', clipPath: 'inset(-30% 100% -18% -10%)' }, { translate: '0 0', clipPath: MASK_OUT }],
    'mask-right': () => [{ translate: '-100% 0', clipPath: 'inset(-30% -10% -18% 100%)' }, { translate: '0 0', clipPath: MASK_OUT }],
    'flip-up': () => [{ opacity: 0, rotate: '1 0 0 -95deg', transformOrigin: '50% 100%' }, { opacity: 1, rotate: '1 0 0 0deg', transformOrigin: '50% 100%' }],
    'drop': () => [{ opacity: 0, translate: `0 ${-160 * PX()}px` }, { opacity: 1, offset: 0.25 }, { opacity: 1, translate: '0 0' }],
    'swing': () => [{ opacity: 0, rotate: '-28deg', transformOrigin: '0% 100%' }, { opacity: 1, rotate: '0deg', transformOrigin: '0% 100%' }],
    'stretch': () => [{ opacity: 0, scale: '1.9 0.35', filter: B(8) }, { opacity: 1, scale: '1 1', filter: B(0) }],
    'tilt': () => [{ opacity: 0, translate: `0 ${70 * PX()}px`, rotate: '7deg' }, { opacity: 1, translate: '0 0', rotate: '0deg' }],
    'spin-in': () => [{ opacity: 0, scale: '0', rotate: '-200deg' }, { opacity: 1, scale: '1', rotate: '0deg' }],
    'elastic': () => [{ scale: '0' }, { scale: '1' }],
    'grow': () => [{ scale: '0' }, { scale: '1' }],
    'grow-x': () => [{ scale: '0 1', transformOrigin: '0% 50%' }, { scale: '1 1', transformOrigin: '0% 50%' }],
    'grow-y': () => [{ scale: '1 0', transformOrigin: '50% 100%' }, { scale: '1 1', transformOrigin: '50% 100%' }],
    'typewriter': () => [{ opacity: 0 }, { opacity: 1 }],
    'none': () => null,
  };
  const HIDDEN_AT_START = new Set(['write', 'draw', 'wipe-right', 'wipe-left', 'wipe-down', 'wipe-up', 'diagonal', 'clock', 'iris', 'mask-up', 'mask-down', 'mask-left', 'mask-right', 'grow', 'grow-x', 'grow-y', 'elastic']);
  // Default duration and easing per preset (data-enter="name [duration] [delay] [easing]" overrides).
  const PRESET_DEFAULTS = {
    'drop': { ease: 'bouncy', dur: 1 }, 'swing': { ease: 'bouncy', dur: 1 }, 'elastic': { ease: 'out-elastic', dur: 1.1 },
    'spin-in': { ease: 'out-back', dur: 0.8 }, 'grow': { ease: 'out-back', dur: 0.6 }, 'grow-x': { ease: 'out-expo', dur: 0.9 }, 'grow-y': { ease: 'out-expo', dur: 0.9 },
    'mask-up': { ease: 'out-expo', dur: 0.8 }, 'mask-down': { ease: 'out-expo', dur: 0.8 }, 'mask-left': { ease: 'out-expo', dur: 0.8 }, 'mask-right': { ease: 'out-expo', dur: 0.8 },
    'flip-up': { ease: 'out-back', dur: 0.8 }, 'stretch': { ease: 'out-expo', dur: 0.8 }, 'tilt': { ease: 'out-expo', dur: 0.8 },
    'typewriter': { ease: 'steps(1)', dur: 0.02 }, 'write': { ease: 'in-out-sine', dur: 0.8 }, 'draw': { ease: 'in-out-sine', dur: 1 },
    'band': { ease: 'in-out-sine', dur: 0.6 }, 'band-right': { ease: 'in-out-sine', dur: 0.6 }, 'band-left': { ease: 'in-out-sine', dur: 0.6 }, 'band-up': { ease: 'in-out-sine', dur: 0.6 }, 'band-down': { ease: 'in-out-sine', dur: 0.6 },
  };
  // Exit motion keeps going in the named direction (fade-up exit moves up).
  const EXIT_PRESETS = {
    'fade': () => [{ opacity: 1 }, { opacity: 0 }],
    // a row taken out of a list: it slides aside and fades, then its height closes so the rows below move up
    'collapse': (el) => {
      const cs = getComputedStyle(el), h = el.offsetHeight + 'px', box = { height: h, marginTop: cs.marginTop, marginBottom: cs.marginBottom, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, overflow: 'hidden', boxSizing: 'border-box' };
      const gone = { height: '0px', marginTop: '0px', marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px', overflow: 'hidden', boxSizing: 'border-box' };
      return [{ ...box, opacity: 1, translate: '0 0', offset: 0 }, { ...box, opacity: 0, translate: `${60 * PX()}px 0`, offset: 0.45 }, { ...gone, opacity: 0, translate: `${60 * PX()}px 0`, offset: 1 }];
    },
    'fade-up': () => [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: `0 ${-48 * PX()}px` }],
    'fade-down': () => [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: `0 ${48 * PX()}px` }],
    'fade-left': () => [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: `${-48 * PX()}px 0` }],
    'fade-right': () => [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: `${48 * PX()}px 0` }],
    'rise': () => [{ opacity: 1, translate: '0 0', filter: B(0) }, { opacity: 0, translate: `0 ${-90 * PX()}px`, filter: B(10) }],
    'scale': () => [{ opacity: 1, scale: '1' }, { opacity: 0, scale: '0.85' }],
    'pop': () => [{ opacity: 1, scale: '1' }, { opacity: 0, scale: '0.4' }],
    'zoom': () => [{ opacity: 1, scale: '1' }, { opacity: 0, scale: '1.25' }],
    'blur': () => [{ opacity: 1, filter: B(0) }, { opacity: 0, filter: B(18) }],
    'slide-up': () => [{ translate: '0 0' }, { translate: '0 -100%' }],
    'slide-down': () => [{ translate: '0 0' }, { translate: '0 100%' }],
    'slide-left': () => [{ translate: '0 0' }, { translate: '-100% 0' }],
    'slide-right': () => [{ translate: '0 0' }, { translate: '100% 0' }],
    'whip-left': () => [{ translate: '0 0', filter: B(0) }, { translate: '-100% 0', filter: B(28) }],
    'whip-right': () => [{ translate: '0 0', filter: B(0) }, { translate: '100% 0', filter: B(28) }],
    'whip-up': () => [{ translate: '0 0', filter: B(0) }, { translate: '0 -100%', filter: B(28) }],
    'whip-down': () => [{ translate: '0 0', filter: B(0) }, { translate: '0 100%', filter: B(28) }],
    'wipe-right': () => [{ clipPath: 'inset(0 0 0 0%)' }, { clipPath: 'inset(0 0 0 100%)' }],
    'wipe-left': () => [{ clipPath: 'inset(0 0% 0 0)' }, { clipPath: 'inset(0 100% 0 0)' }],
    'wipe-down': () => [{ clipPath: 'inset(0% 0 0 0)' }, { clipPath: 'inset(100% 0 0 0)' }],
    'wipe-up': () => [{ clipPath: 'inset(0 0 0% 0)' }, { clipPath: 'inset(0 0 100% 0)' }],
    'iris': () => [{ clipPath: 'circle(75% at 50% 50%)' }, { clipPath: 'circle(0% at 50% 50%)' }],
    'zoom-past': () => [{ opacity: 1, scale: '1', filter: B(0), zIndex: 2, offset: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0, scale: '2.4', filter: B(14), zIndex: 2, offset: 1 }],
    'flip-out': () => [{ transform: 'perspective(2400px) rotateY(0deg)', opacity: 1, offset: 0 }, { transform: 'perspective(2400px) rotateY(-90deg)', opacity: 1, offset: 0.5 }, { opacity: 0, offset: 0.5001 }, { transform: 'perspective(2400px) rotateY(-90deg)', opacity: 0, offset: 1 }],
    'dip-out': () => [{ filter: 'brightness(1)', offset: 0 }, { filter: 'brightness(0)', offset: 0.5 }, { filter: 'brightness(0)', offset: 1 }],
    'draw': () => [{ strokeDasharray: '1 2', strokeDashoffset: 0 }, { strokeDasharray: '1 2', strokeDashoffset: -1.002 }],
    'mask-up': () => [{ translate: '0 0', clipPath: MASK_OUT }, { translate: '0 -100%', clipPath: 'inset(100% -10% -18% -10%)' }],
    'mask-down': () => [{ translate: '0 0', clipPath: MASK_OUT }, { translate: '0 100%', clipPath: 'inset(-30% -10% 100% -10%)' }],
    'mask-left': () => [{ translate: '0 0', clipPath: MASK_OUT }, { translate: '-100% 0', clipPath: 'inset(-30% -10% -18% 100%)' }],
    'mask-right': () => [{ translate: '0 0', clipPath: MASK_OUT }, { translate: '100% 0', clipPath: 'inset(-30% 100% -18% -10%)' }],
    'flip-up': () => [{ opacity: 1, rotate: '1 0 0 0deg', transformOrigin: '50% 0%' }, { opacity: 0, rotate: '1 0 0 95deg', transformOrigin: '50% 0%' }],
    'drop': () => [{ opacity: 1, translate: '0 0' }, { opacity: 1, offset: 0.7 }, { opacity: 0, translate: `0 ${200 * PX()}px` }],
    'swing': () => [{ opacity: 1, rotate: '0deg', transformOrigin: '100% 100%' }, { opacity: 0, rotate: '28deg', transformOrigin: '100% 100%' }],
    'stretch': () => [{ opacity: 1, scale: '1 1', filter: B(0) }, { opacity: 0, scale: '1.9 0.35', filter: B(8) }],
    'tilt': () => [{ opacity: 1, translate: '0 0', rotate: '0deg' }, { opacity: 0, translate: `0 ${-70 * PX()}px`, rotate: '-7deg' }],
    'spin-in': () => [{ opacity: 1, scale: '1', rotate: '0deg' }, { opacity: 0, scale: '0', rotate: '200deg' }],
    'elastic': () => [{ scale: '1' }, { scale: '0' }],
    'grow': () => [{ scale: '1' }, { scale: '0' }],
    'grow-x': () => [{ scale: '1 1', transformOrigin: '100% 50%' }, { scale: '0 1', transformOrigin: '100% 50%' }],
    'grow-y': () => [{ scale: '1 1', transformOrigin: '50% 100%' }, { scale: '1 0', transformOrigin: '50% 100%' }],
    'typewriter': () => [{ opacity: 1 }, { opacity: 0 }],
    'none': () => null,
  };
  const EXIT_DEFAULTS = { 'collapse': { ease: 'in-out-cubic', dur: 0.6 }, 'elastic': { ease: 'in-back', dur: 0.5 }, 'grow': { ease: 'in-back', dur: 0.5 }, 'spin-in': { ease: 'in-back', dur: 0.6 }, 'typewriter': { ease: 'steps(1)', dur: 0.02 }, 'drop': { ease: 'in-cubic', dur: 0.6 } };
  // Natural motion (gm.motion 'natural'): what an entrance does when its data-enter gives no easing / no duration.
  // z = damping ratio of its spring (1 = lands without overshoot: fades, slides, wipes and text stay crisp; below 1 =
  // a small overshoot that settles, for things that pop, grow or tilt into place). size = how far it travels, as a
  // share of the element's own size ('w', 'h' or 'max' side): its duration grows a little with that distance.
  // Presets not listed (drop, swing, elastic: already springs; draw, write: pen speed; typewriter) keep their curve.
  const NATURAL_ENTER = {
    'fade': { z: 1 }, 'blur': { z: 1 }, 'fade-up': { z: 1 }, 'fade-down': { z: 1 }, 'fade-left': { z: 1 }, 'fade-right': { z: 1 }, 'rise': { z: 1 },
    'scale': { z: 0.85, size: ['max', 0.15] }, 'pop': { z: 0.7, size: ['max', 0.6] }, 'zoom': { z: 0.85, size: ['max', 0.25] },
    'slide-up': { z: 1, size: ['h', 1] }, 'slide-down': { z: 1, size: ['h', 1] }, 'slide-left': { z: 1, size: ['w', 1] }, 'slide-right': { z: 1, size: ['w', 1] },
    'whip-up': { z: 1, size: ['h', 1] }, 'whip-down': { z: 1, size: ['h', 1] }, 'whip-left': { z: 1, size: ['w', 1] }, 'whip-right': { z: 1, size: ['w', 1] },
    'wipe-up': { z: 1, size: ['h', 1] }, 'wipe-down': { z: 1, size: ['h', 1] }, 'wipe-left': { z: 1, size: ['w', 1] }, 'wipe-right': { z: 1, size: ['w', 1] },
    'diagonal': { z: 1, size: ['w', 1.4] }, 'iris': { z: 1, size: ['max', 1] }, 'clock': { z: 1 },
    'mask-up': { z: 1 }, 'mask-down': { z: 1 }, 'mask-left': { z: 1 }, 'mask-right': { z: 1 },
    'flip-up': { z: 0.72 }, 'spin-in': { z: 0.7, size: ['max', 1] }, 'grow': { z: 0.7, size: ['max', 1] },
    'grow-x': { z: 1, size: ['w', 1] }, 'grow-y': { z: 1, size: ['h', 1] }, 'stretch': { z: 0.75, size: ['max', 0.9] }, 'tilt': { z: 0.8 },
  };
  // Bigger moves take a bit longer: duration x (distance / 240px)^0.25, kept within 0.85x-1.3x (distance in 1080p px).
  function distanceFactor(d, ref = 240, lo = 0.85, hi = 1.3) { return d > 0 ? Math.max(lo, Math.min(hi, Math.pow(d / ref, 0.25))) : 1; }
  // Layout sizes of elements where they rest (transforms and scale animations do not count; clips that are not on
  // screen are shown for the measure). Rounded, so every worker gets the same numbers.
  function restSizes(els) {
    const out = new Map();
    if (!els.length) return out;
    const hidden = [];
    for (const e of els) for (let p = e; p; p = p.parentElement) if (p.hasAttribute && p.hasAttribute('data-gm-hidden')) { hidden.push(p); p.removeAttribute('data-gm-hidden'); }
    try {
      for (const e of els) {
        let w = 0, h = 0;
        if (e instanceof HTMLElement) { w = e.offsetWidth; h = e.offsetHeight; }
        else if (e instanceof SVGGraphicsElement) {
          try {
            const b = e.getBBox(), svg = e.ownerSVGElement || (e instanceof SVGSVGElement ? e : null), vb = svg && svg.viewBox && svg.viewBox.baseVal;
            const k = vb && vb.width && svg.clientWidth ? svg.clientWidth / vb.width : 1;
            w = b.width * k; h = b.height * k;
          } catch (err) {}
        }
        out.set(e, { w: Math.round(w), h: Math.round(h) });
      }
    } finally { for (const p of hidden) p.setAttribute('data-gm-hidden', ''); }
    return out;
  }
  // A small seeded variation for a stagger (a row of cards should not move like a machine): the first and the last
  // piece keep their times; the others move by up to +-20% of the stagger step. Same numbers in every worker.
  function staggerJitter(key, n, amount = 0.2) {
    const out = new Array(n).fill(0);
    if (n < 3) return out;
    const rnd = makeRandom(hashSeed('stagger:' + key));
    for (let i = 0; i < n; i++) { const r = rnd(); if (i > 0 && i < n - 1) out[i] = (r * 2 - 1) * amount; }
    return out;
  }
  // Natural motion: an entrance or exit whose scale overshoots (a spring that settles, out-back, elastic) is driven
  // from the clock with inline styles, not as an animation. Chrome keeps the raster of a scaling animated layer at
  // the largest scale it has drawn it at, so a scale that grows past 1 and comes back is drawn differently by a
  // worker that started mid-animation (1 worker != N workers, seen under a moving camera). Inline values are drawn
  // at their exact scale in every frame. Curves that do not overshoot, and those that do not scale, stay animations.
  const CSS_NUM = /(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)([a-z%]*)/gi;
  function mixCss(a, b, p, prop) {
    const clampN = (n) => (prop === 'opacity' ? Math.max(0, Math.min(1, n)) : prop === 'filter' ? Math.max(0, n) : n);
    const r4 = (n) => Math.round(n * 10000) / 10000;
    if (typeof a === 'number' && typeof b === 'number') return clampN(r4(a + (b - a) * p));
    const A = String(a), Bv = String(b), ta = [...A.matchAll(CSS_NUM)], tb = [...Bv.matchAll(CSS_NUM)];
    if (ta.length !== tb.length || A.replace(CSS_NUM, '#') !== Bv.replace(CSS_NUM, '#')) return null;
    let i = 0, bad = false;
    const out = A.replace(CSS_NUM, () => {
      const x = ta[i], y = tb[i]; i++;
      const ux = x[2], uy = y[2];
      if (ux !== uy && !(ux === '' && +x[1] === 0) && !(uy === '' && +y[1] === 0)) bad = true;
      return r4(clampN(+x[1] + (+y[1] - +x[1]) * p)) + (ux || uy);
    });
    return bad ? null : out;
  }
  // (p) => the keyframes' values at progress p (beyond 1: carried on along the last step, as an animation does)
  function kfSampler(kf) {
    const offs = kf.map((k) => k.offset);
    if (offs[0] == null) offs[0] = 0;
    if (offs[offs.length - 1] == null) offs[offs.length - 1] = 1;
    for (let i = 1; i < offs.length - 1; i++) if (offs[i] == null) { let j = i; while (offs[j] == null) j++; const a = offs[i - 1]; for (let k = i; k < j; k++) offs[k] = a + ((offs[j] - a) * (k - i + 1)) / (j - i + 1); }
    const props = new Map();
    kf.forEach((k, i) => { for (const key of Object.keys(k)) if (key !== 'offset' && key !== 'easing' && key !== 'composite') { if (!props.has(key)) props.set(key, []); props.get(key).push({ o: offs[i], v: k[key] }); } });
    for (const [key, list] of props) if (list.length > 1 && key !== 'transformOrigin' && mixCss(list[0].v, list[list.length - 1].v, 0.5, key) == null) return null;
    const sample = (p) => {
      const frame = {};
      for (const [key, list] of props) {
        if (list.length < 2) { if (p <= 0 && list[0].o === 0) frame[key] = list[0].v; continue; } // visibility: hidden before the start
        if (key === 'transformOrigin') { frame[key] = list[0].v; continue; }
        let j = 0;
        while (j < list.length - 2 && p > list[j + 1].o) j++;
        const s0 = list[j], e = list[j + 1], q = e.o === s0.o ? 1 : (p - s0.o) / (e.o - s0.o);
        frame[key] = mixCss(s0.v, e.v, q, key);
      }
      return frame;
    };
    sample.props = [...props.keys()];
    return sample;
  }
  const driven = [];
  const kebabCss = (p) => p.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
  function overshoots(ease) { const fn = easing(ease); for (let i = 1; i < 40; i++) { const v = fn(i / 40); if (v > 1.0005 || v < -0.0005) return true; } return false; }
  function addDriven(el, kf, ease, dur, delay, originTime, enter) {
    if (!kf || !kf.some((k) => k.scale != null) || !overshoots(ease)) return false;
    const sample = kfSampler(kf);
    if (!sample) return false;
    const orig = {};
    for (const p of sample.props) { const k = kebabCss(p); orig[p] = [el.style.getPropertyValue(k), el.style.getPropertyPriority(k)]; }
    driven.push({ el, sample, fn: easing(ease), dur, delay, origin: originTime, enter, orig, last: null });
    return true;
  }
  function updateDriven(T) {
    let changed = false;
    for (const d of driven) {
      if (!d.el.isConnected) continue;
      const lt = (hasRemap ? mapT(d.el, T) : T) - d.origin - d.delay;
      // an enter shows its first values before it starts and the page's own after; an exit the other way round
      const frame = lt < 0 ? (d.enter ? d.sample(0) : null) : lt < d.dur ? d.sample(d.fn(lt / d.dur)) : d.enter ? null : d.sample(1);
      const sig = frame ? JSON.stringify(frame) : '';
      if (sig === d.last) continue;
      d.last = sig;
      changed = true;
      for (const p of d.sample.props) {
        const k = kebabCss(p);
        if (frame && frame[p] != null) d.el.style.setProperty(k, String(frame[p]));
        else { const [v, pr] = d.orig[p]; if (v) d.el.style.setProperty(k, v, pr); else d.el.style.removeProperty(k); }
      }
    }
    return changed;
  }
  function parseMotion(v, el, attr, defDur, defEase) {
    let toks = String(v).trim().split(/\s+/).filter(Boolean);
    const out = { name: toks[0] || 'fade', dur: defDur, delay: 0, ease: defEase, durSet: false, easeSet: false };
    if (isBand(out.name)) { out.band = bandOpts(toks.slice(1)); toks = [out.name, ...out.band.rest]; }
    const nums = [];
    let at = null; // a word ("rise 0.5 @thirsty"): the moment it is said, in video time, wherever the element sits
    for (const t of toks.slice(1)) {
      if (isEasingName(t)) { out.ease = t; out.easeSet = true; }
      else if (t[0] === '@') at = parseTime(t, el, attr);
      else { const n = parseTime(t, el, attr); if (n != null) nums.push(n); }
    }
    if (nums[0] != null) { out.dur = nums[0]; out.durSet = true; }
    if (nums[1] != null) out.delay = nums[1];
    if (at != null) {
      const c = nearestClip(el);
      // an entrance starts on the word; an exit starts on it too (its delay counts back from the clip's end)
      out.delay = attr === 'data-exit' ? Math.max(0, (c && isFinite(c.end) ? c.end : comp.duration) - at - out.dur) : at - (c ? c.start : 0);
    }
    return out;
  }
  function eeTargets(el, stagger) {
    return stagger != null ? splitTargets.get(el) || [...el.children].filter((c) => !SKIP_TAGS.has(c.tagName)) : [el];
  }
  function applyEnterExit() {
    const natural = naturalMotion();
    const els = [...document.querySelectorAll('[data-enter],[data-exit]')].filter((el) => !el.__gmEE);
    // natural motion: measure (once, all together) the elements whose entrance depends on their size
    let sizes = null;
    if (natural) {
      const want = [];
      for (const el of els) {
        const en = el.getAttribute('data-enter'), spec = en && NATURAL_ENTER[String(en).trim().split(/\s+/)[0]];
        if (spec && (spec.size || spec.z < 1)) want.push(...eeTargets(el, parseTime(el.getAttribute('data-stagger'), el, 'data-stagger')));
      }
      sizes = restSizes(want);
    }
    for (const el of els) {
      if (el.__gmEE) continue;
      el.__gmEE = true;
      // data-enter="none" (a block's own entrance turned off from its include: enter="none")
      for (const k of ['data-enter', 'data-exit']) if (el.hasAttribute(k) && /^\s*(none|off)?\s*$/i.test(el.getAttribute(k))) el.removeAttribute(k);
      if (!el.hasAttribute('data-enter') && !el.hasAttribute('data-exit')) continue;
      const stagger = parseTime(el.getAttribute('data-stagger'), el, 'data-stagger');
      const targets = eeTargets(el, stagger);
      const base = nearestClip(el);
      const cStart = base ? base.start : 0;
      const cEnd = base ? base.end : comp.duration;
      const en = el.getAttribute('data-enter');
      const ex = el.getAttribute('data-exit');
      const jit = natural && stagger != null ? staggerJitter(selectorOf(el), targets.length) : null;
      const jrnd = jit ? makeRandom(hashSeed('stagger-dur:' + selectorOf(el))) : null;
      targets.forEach((tg, i) => {
        const extra = stagger != null ? stagger * (i + (jit ? jit[i] : 0)) : 0;
        if (en) {
          const nm = String(en).trim().split(/\s+/)[0];
          // write: as long as a hand needs for the text (about 22 letters a second) unless a duration is given
          const defDur = nm === 'write' ? Math.max(0.35, Math.min(3, (tg.textContent || '').trim().length / 22)) : (PRESET_DEFAULTS[nm] || {}).dur ?? 0.6;
          const m = parseMotion(en, el, 'data-enter', defDur, (PRESET_DEFAULTS[nm] || {}).ease || 'out-expo');
          const spec = natural && !el.__gmTransition && NATURAL_ENTER[m.name];
          if (spec) {
            const sz = sizes && sizes.get(tg), px = PX();
            if (!m.easeSet) {
              // a spring; no overshoot for something as big as the frame (it would show its edges)
              const big = sz && (sz.w >= comp.width * 0.75 || sz.h >= comp.height * 0.75);
              const z = big ? 1 : spec.z;
              m.ease = 'natural(' + z + ')';
            }
            if (!m.durSet && spec.size && sz) {
              const [side, share] = spec.size;
              const len = side === 'w' ? sz.w : side === 'h' ? sz.h : Math.max(sz.w, sz.h);
              m.dur = Math.round(m.dur * distanceFactor((len * share) / px) * 1000) / 1000;
            }
          }
          // a stagger's pieces also differ a little in duration (never longer than asked)
          if (jrnd) m.dur = Math.round(m.dur * (1 - 0.07 * jrnd()) * 1000) / 1000;
          // when the entrance is over, in video time (a word, a stagger, a natural duration: as resolved), for what
          // starts after it (a sketch mark)
          const done = cStart + m.delay + extra + (el.__gmEnterAt || 0) + m.dur;
          tg.__gmEnterEnd = Math.max(tg.__gmEnterEnd ?? -Infinity, done);
          el.__gmEnterEnd = Math.max(el.__gmEnterEnd ?? -Infinity, done);
          if (isBand(m.name)) bandEnter(tg, m, m.delay + extra + (el.__gmEnterAt || 0), cStart);
          else if (!PRESETS[m.name]) { report('error', 'bad-enter', `Unknown data-enter "${m.name}".`, el, 'Use one of: ' + Object.keys(PRESETS).filter((k) => !/^(zoom-near|flip-in|dip-in|clock|diagonal)$/.test(k)).join(', ')); }
          else {
            if (m.name === 'draw') prepDraw(tg);
            if (m.name === 'clock') prepClock(tg);
            let kf = PRESETS[m.name]();
            // sketched solid fills fade in near the end of the drawing (a stroke dash cannot hide a fill)
            if (m.name === 'draw' && tg.querySelector && (tg.matches('[data-gm-sketch-fill="solid"]') || tg.querySelector('[data-gm-sketch-fill="solid"]'))) kf = [{ ...kf[0], fillOpacity: 0 }, { offset: 0.6, fillOpacity: 0 }, { ...kf[1], fillOpacity: 1 }];
            // reveals (clip, scale, dash) are also fully hidden before they start, not just clipped to a sliver
            if (kf && HIDDEN_AT_START.has(m.name)) kf = [{ ...kf[0], visibility: 'hidden' }, ...kf.slice(1)];
            // (el.__gmEnterAt: a chart callout enters when the line reaches its point, its delay counts from there)
            const delay = m.delay + extra + (el.__gmEnterAt || 0);
            if (kf && !(natural && addDriven(tg, kf, m.ease, m.dur, delay, cStart, true))) addOwn(tg, kf, { duration: m.dur * 1000, delay: delay * 1000, easing: cssEasing(m.ease), fill: 'backwards' }, cStart);
          }
        }
        if (ex) {
          const nm = String(ex).trim().split(/\s+/)[0];
          const m = parseMotion(ex, el, 'data-exit', (EXIT_DEFAULTS[nm] || {}).dur ?? 0.45, (EXIT_DEFAULTS[nm] || {}).ease || 'in-cubic');
          if (!EXIT_PRESETS[m.name]) { report('error', 'bad-exit', `Unknown data-exit "${m.name}".`, el, 'Use one of: ' + Object.keys(EXIT_PRESETS).join(', ')); }
          else if (!isFinite(cEnd)) { report('warning', 'exit-no-end', 'data-exit needs the element (or a parent) to have an end time.', el, 'Add data-duration to this element or its clip.'); }
          else {
            if (m.name === 'draw') prepDraw(tg);
            const kf = EXIT_PRESETS[m.name](tg);
            const n = targets.length;
            const ext = stagger != null ? stagger * (n - 1 - i - (jit ? jit[i] : 0)) : 0;
            const startAt = (cEnd - cStart) - m.dur - m.delay - ext;
            if (kf && !(natural && m.name !== 'collapse' && addDriven(tg, kf, m.ease, m.dur, Math.max(0, startAt), cStart, false))) addOwn(tg, kf, { duration: m.dur * 1000, delay: Math.max(0, startAt) * 1000, easing: cssEasing(m.ease), fill: 'forwards' }, cStart);
          }
        }
      });
    }
  }
  // band-right / -left / -up / -down: a solid band (width w, a share of the side it travels along) sweeps across the
  // element; behind it the element is revealed. Two paused animations with the same timing: the element's clip-path
  // (everything behind the band's front edge) and a ::after (or ::before) that paints the band itself on top.
  // The band's centre is at the element's centre at progress 0.5, so a symmetric easing puts that moment halfway.
  function bandEnter(tg, m, delay, cStart) {
    if (!(tg instanceof HTMLElement)) { report('warning', 'bad-enter', `data-enter "${m.name}" needs an HTML element (an SVG element has no ::after to paint the band).`, tg); return; }
    const b = m.band || {};
    const dir = m.name === 'band' ? 'right' : m.name.slice(5);
    const cs = getComputedStyle(tg);
    if (cs.position === 'static') tg.style.position = 'relative';
    // the band paints with ::after unless the page already uses this element's ::after for something
    const used = (p) => { const c = getComputedStyle(tg, p).content; return c && c !== 'none' && c !== 'normal'; };
    const pseudo = used('::after') && !used('::before') ? 'before' : 'after';
    tg.setAttribute('data-gm-band', pseudo);
    if (b.color) tg.style.setProperty('--gm-band-color', b.color);
    const sz = restSizes([tg]).get(tg) || { w: comp.width, h: comp.height };
    const W = sz.w || comp.width, H = sz.h || comp.height;
    const horiz = dir === 'right' || dir === 'left';
    const along = horiz ? W : H, cross = horiz ? H : W;
    const ang = Math.max(-75, Math.min(75, b.angle || 0));
    const s = (Math.tan((ang * Math.PI) / 180) * cross) / along; // how far the edge leans across the element, as a share of `along`
    const as = Math.abs(s);
    // width: a share of the side it travels along; 100% or more also adds the lean, so it covers everything at the middle
    const wp = Math.max(0, b.width != null ? b.width : 35) / 100, w = wp >= 1 ? wp + as : wp;
    const L0 = -as / 2, L1 = 1 + as / 2 + w; // front edge: from just before the start to where the whole band is past the end
    const r = (n) => Math.round(n * 1e6) / 1e4; // share → % with 4 decimals
    const pt = (a, c) => (dir === 'right' ? `${r(a)}% ${r(c)}%` : dir === 'left' ? `${r(1 - a)}% ${r(c)}%` : dir === 'down' ? `${r(c)}% ${r(a)}%` : `${r(c)}% ${r(1 - a)}%`);
    const far = -1 - as;
    const reveal = (L) => `polygon(${pt(far, 0)}, ${pt(L + s / 2, 0)}, ${pt(L - s / 2, 1)}, ${pt(far, 1)})`;
    const band = (L) => `polygon(${pt(L - w + s / 2, 0)}, ${pt(L + s / 2, 0)}, ${pt(L - s / 2, 1)}, ${pt(L - w - s / 2, 1)})`;
    // Driven from the clock with inline styles (one sampler, so the band's front edge and the reveal edge never drift
    // apart): the element's clip-path, and --gm-band-clip that the ::after's clip-path reads. (A paused animation on
    // a pseudo-element stops applying once its element has been display:none, as a scene is before its turn.)
    const sample = kfSampler([{ clipPath: reveal(L0), '--gm-band-clip': band(L0), visibility: 'hidden' }, { clipPath: reveal(L1), '--gm-band-clip': band(L1) }]);
    const orig = {};
    for (const p of sample.props) { const k = kebabCss(p); orig[p] = [tg.style.getPropertyValue(k), tg.style.getPropertyPriority(k)]; }
    driven.push({ el: tg, sample, fn: easing(m.ease), dur: m.dur, delay, origin: cStart, enter: true, orig, last: null });
  }
  let clockReg = false;
  function prepClock(el) {
    if (!clockReg) { clockReg = true; try { CSS.registerProperty({ name: '--gm-clock', syntax: '<percentage>', inherits: false, initialValue: '100%' }); } catch (e) {} }
    el.style.maskImage = el.style.webkitMaskImage = 'conic-gradient(from 0deg, #000 var(--gm-clock), transparent var(--gm-clock))';
  }
  function prepDraw(el) {
    const shapes = el instanceof SVGGeometryElement ? [el] : [...el.querySelectorAll('path,line,polyline,polygon,circle,ellipse,rect')];
    for (const s of shapes) if (!s.hasAttribute('pathLength')) s.setAttribute('pathLength', '1');
  }
  function addOwn(el, keyframes, timing, originTime) {
    const a = real.animate.call(el, keyframes, timing);
    a.pause();
    ownAnim.add(a);
    origin.set(a, originTime);
    known.add(a);
    return a;
  }

  // ---------------------------------------------------------------------------
  // data-split (words / chars / lines) — gives each piece --i for staggering
  // ---------------------------------------------------------------------------
  const splitTargets = new WeakMap();
  function applySplit() {
    for (const el of document.querySelectorAll('[data-split]')) {
      if (el.__gmSplit) continue;
      el.__gmSplit = true;
      const mode = (el.getAttribute('data-split') || 'words').trim();
      const pieces = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const texts = [];
      while (walker.nextNode()) texts.push(walker.currentNode);
      let wi = 0, ci = 0;
      for (const tn of texts) {
        const parts = /** @type {Text} */ (tn).data.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        for (const p of parts) {
          if (!p) continue;
          if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); continue; }
          const w = document.createElement('span');
          w.className = 'gm-word';
          w.style.setProperty('--i', String(wi));
          w.style.setProperty('--wi', String(wi++));
          if (mode === 'chars') {
            for (const ch of Array.from(p)) {
              const c = document.createElement('span');
              c.className = 'gm-char';
              c.textContent = ch;
              c.style.setProperty('--i', String(ci));
              c.style.setProperty('--ci', String(ci++));
              w.appendChild(c);
              pieces.push(c);
            }
          } else { w.textContent = p; pieces.push(w); }
          frag.appendChild(w);
        }
        tn.parentNode.replaceChild(frag, tn);
      }
      el.style.setProperty('--n', String(pieces.length));
      fixClipText(el, pieces);
      if (mode === 'lines') {
        // group words by their rendered line (after fonts load)
        const words = pieces;
        let line = -1, lastTop = null;
        for (const w of words) {
          const top = Math.round(w.offsetTop);
          if (lastTop === null || Math.abs(top - lastTop) > 2) { line++; lastTop = top; }
          w.style.setProperty('--i', String(line));
          w.style.setProperty('--li', String(line));
        }
        el.style.setProperty('--n', String(line + 1));
        // stagger targets: one entry per line → use first word? we animate each word with its line index.
        splitTargets.set(el, words);
        el.__gmLineIndex = true;
      } else splitTargets.set(el, pieces);
    }
  }

  // Gradient text (background-clip: text) on a parent stops painting a child while the child
  // animates on its own layer. Give each piece its own slice of the same gradient.
  function fixClipText(root, pieces) {
    for (const p of pieces) {
      let anc = p.parentElement;
      while (anc) {
        const cs = getComputedStyle(anc);
        if ((cs.backgroundClip === 'text' || cs.webkitBackgroundClip === 'text') && cs.backgroundImage !== 'none') {
          const a = anc.getBoundingClientRect(), r = p.getBoundingClientRect();
          p.style.backgroundImage = cs.backgroundImage;
          p.style.backgroundSize = `${a.width}px ${a.height}px`;
          p.style.backgroundPosition = `${a.left - r.left}px ${a.top - r.top}px`;
          p.style.backgroundRepeat = 'no-repeat';
          p.style.webkitBackgroundClip = 'text';
          p.style.backgroundClip = 'text';
          p.style.color = 'transparent';
          p.style.webkitTextFillColor = 'transparent';
          break;
        }
        if (anc === root) break;
        anc = anc.parentElement;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // data-count and data-type
  // ---------------------------------------------------------------------------
  const counters = [];
  const typers = [];
  function setupCountersAndTypers() {
    for (const el of document.querySelectorAll('[data-count]')) {
      if (el.__gmCount) continue;
      el.__gmCount = true;
      const parts = el.getAttribute('data-count').trim().split(/\s+/).map(Number);
      const from = parts.length > 1 ? parts[0] : 0;
      const to = parts.length > 1 ? parts[1] : parts[0];
      if (!isFinite(from) || !isFinite(to)) { report('error', 'bad-count', 'data-count needs numbers: "1250" or "0 1250".', el); continue; }
      const decAttr = el.getAttribute('data-count-decimals');
      const decimals = decAttr != null ? parseInt(decAttr, 10) : Math.max(dec(from), dec(to));
      const group = el.getAttribute('data-count-group') !== 'false';
      // natural motion: digits all as wide (tabular) unless the page chose otherwise, so the number does not wobble
      if (naturalMotion() && getComputedStyle(el).fontVariantNumeric === 'normal') el.style.fontVariantNumeric = 'tabular-nums';
      // data-count-fixed: every digit in a cell as wide as the font's widest digit (works with any font), and the box
      // reserved for the longest number from the start (the digits sit right-aligned in it, the units digit never moves)
      let fixed = null;
      if (el.hasAttribute('data-count-fixed') && el.getAttribute('data-count-fixed') !== 'false') {
        const a = fmtNumber(from, decimals, group), b = fmtNumber(to, decimals, group);
        fixed = b.length >= a.length ? b : a;
      }
      counters.push({
        el, from, to, decimals,
        dur: parseTime(el.getAttribute('data-count-duration'), el, 'data-count-duration') ?? 1.6,
        delay: parseTime(el.getAttribute('data-count-delay'), el, 'data-count-delay') ?? 0,
        ease: easing(el.getAttribute('data-count-ease') || 'out-expo'),
        prefix: el.getAttribute('data-count-prefix') || '',
        suffix: el.getAttribute('data-count-suffix') || '',
        group, fixed,
        last: null,
      });
    }
    for (const el of document.querySelectorAll('[data-type]')) {
      if (el.__gmType) continue;
      el.__gmType = true;
      const nodes = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) nodes.push({ node: walker.currentNode, text: /** @type {Text} */ (walker.currentNode).data, rest: null });
      const total = nodes.reduce((s, n) => s + n.text.length, 0);
      const v = el.getAttribute('data-type').trim();
      const cps = v ? parseFloat(v) : 30;
      const caret = el.hasAttribute('data-type-caret') ? document.createElement('span') : null;
      if (caret) caret.className = 'gm-caret';
      // The text that is not typed yet stays in the layout, invisible: every letter appears where it will stay (centred
      // text does not drift as it grows, a word does not jump to the next line when it stops fitting, the box keeps its size).
      for (const it of nodes) {
        const rest = document.createElement('span');
        rest.className = 'gm-rest';
        rest.style.visibility = 'hidden';
        rest.appendChild(document.createTextNode(it.text));
        it.node.parentNode.insertBefore(rest, it.node.nextSibling);
        it.rest = rest.firstChild;
      }
      // data-type-caret="0.8": the caret goes away 0.8 s after the typing is done (without a number it keeps blinking)
      const keep = caret ? parseFloat(el.getAttribute('data-type-caret')) : NaN;
      typers.push({ el, nodes, total, cps: cps > 0 ? cps : 30, delay: parseTime(el.getAttribute('data-type-delay'), el, 'data-type-delay') ?? 0, caret, keep: isFinite(keep) ? keep : null, last: -1 });
    }
  }
  function dec(n) { const s = String(n); const i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; }
  function fmtNumber(v, decimals, group) {
    // a real minus sign (−), not a hyphen: it lines up with the digits
    let s = Math.abs(v).toFixed(decimals);
    const neg = v < 0 && /[1-9]/.test(s);
    if (group) { const [i, f] = s.split('.'); s = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? '.' + f : ''); }
    return (neg ? '\u2212' : '') + s;
  }
  function fixedCount(c, num) {
    const el = c.el, pat = c.fixed, pad = pat.length - num.length;
    el.textContent = '';
    if (c.prefix) el.appendChild(document.createTextNode(c.prefix));
    const box = document.createElement('span');
    box.className = 'gm-num';
    for (let i = 0; i < Math.max(pat.length, num.length); i++) {
      const j = i - Math.max(0, pad), ghost = j < 0, ch = ghost ? pat[i] : num[j];
      const cell = document.createElement('span');
      if (/\d/.test(ch)) { cell.className = ghost ? 'gm-dg gm-ghost' : 'gm-dg'; const d = document.createElement('span'); d.textContent = ch; cell.appendChild(d); }
      else { if (ghost) cell.className = 'gm-ghost'; cell.textContent = ch; }
      box.appendChild(cell);
    }
    el.appendChild(box);
    if (c.suffix) el.appendChild(document.createTextNode(c.suffix));
  }
  function updateCounters(T) {
    let changed = false;
    for (const c of counters) {
      const lt = mapT(c.el, T) - clipStartOf(c.el) - c.delay;
      const p = c.dur > 0 ? Math.min(1, Math.max(0, lt / c.dur)) : 1;
      const v = c.from + (c.to - c.from) * c.ease(p);
      const txt = c.prefix + fmtNumber(v, c.decimals, c.group) + c.suffix;
      if (txt !== c.last) { if (c.fixed) fixedCount(c, fmtNumber(v, c.decimals, c.group)); else c.el.textContent = txt; c.last = txt; changed = true; }
    }
    for (const ty of typers) {
      const lt = mapT(ty.el, T) - clipStartOf(ty.el) - ty.delay;
      const n = Math.max(0, Math.min(ty.total, Math.floor(lt * ty.cps + 1e-6)));
      const typing = n > 0 && n < ty.total;
      if (n !== ty.last) {
        changed = true;
        let left = n, lastNode = null;
        for (const it of ty.nodes) {
          const take = Math.max(0, Math.min(it.text.length, left));
          it.node.data = it.text.slice(0, take);
          if (it.rest) it.rest.data = it.text.slice(take);
          left -= take;
          if (take > 0) lastNode = it.node;
        }
        if (ty.caret) {
          if (lastNode) lastNode.parentNode.insertBefore(ty.caret, lastNode.nextSibling);
          else ty.el.insertBefore(ty.caret, ty.el.firstChild);
        }
        ty.last = n;
      }
      if (typing) ty.el.setAttribute('data-gm-typing', ''); else ty.el.removeAttribute('data-gm-typing');
      // no caret before typing starts (a stray blinking bar on an empty line looks like a mistake)
      const wait = lt < 0 || (ty.keep != null && lt > ty.total / ty.cps + ty.keep);
      if (wait !== ty.el.hasAttribute('data-gm-type-wait')) { changed = true; if (wait) ty.el.setAttribute('data-gm-type-wait', ''); else ty.el.removeAttribute('data-gm-type-wait'); }
    }
    return changed;
  }

  // ---------------------------------------------------------------------------
  // Data binding: data-bind="path", data-bind-src="path", data-bind-style-color="path" …
  // ---------------------------------------------------------------------------
  function getPath(obj, path) {
    return String(path).split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  }
  let dataCache, dataFromAddress = false;
  function getData() {
    if (dataCache !== undefined) return dataCache;
    if (CONFIG.data != null) return (dataCache = CONFIG.data);
    // <gm-player data="…"> passes data in the page address. Anyone can write a link, so this data is never HTML.
    const hm = /[#&]gm-data=([^&]+)/.exec(location.hash);
    if (hm) { try { dataCache = JSON.parse(decodeURIComponent(hm[1])); dataFromAddress = true; return dataCache; } catch (e) { report('error', 'bad-data', 'Could not read #gm-data from the page address.', null); } }
    const s = document.getElementById('gm-data');
    if (!s) return null;
    try { dataCache = JSON.parse(s.textContent); } catch (e) { report('error', 'bad-data', 'The <script id="gm-data"> block is not valid JSON: ' + e.message, s); dataCache = null; }
    return dataCache;
  }
  function applyBindings() {
    const data = getData();
    if (!data) return;
    for (const el of document.querySelectorAll('*')) {
      for (const at of [...el.attributes]) {
        if (!at.name.startsWith('data-bind')) continue;
        const v = getPath(data, at.value);
        if (v === undefined) { report('warning', 'bind-missing', `data has no "${at.value}".`, el, 'Pass it with --data file.json or --props \'{"…":…}\'.'); continue; }
        if (at.name === 'data-bind') el.textContent = String(v);
        else if (at.name === 'data-bind-html') { if (dataFromAddress) el.textContent = String(v); else el.innerHTML = String(v); }
        else if (at.name.startsWith('data-bind-style-')) el.style.setProperty(at.name.slice(16), String(v));
        else if (at.name.startsWith('data-bind-')) {
          // Data is text: never an event handler (onclick…) or a script URL.
          const name = at.name.slice(10);
          if (/^on/i.test(name) || /^\s*(javascript|vbscript):/i.test(String(v))) { report('warning', 'bind-unsafe', `data-bind-${name} was not set: data cannot add event handlers or script URLs.`, el); continue; }
          el.setAttribute(name, String(v));
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Media: <video> and <audio>
  // ---------------------------------------------------------------------------
  const videos = []; // {el (original), img (render mode), src, ...}
  function mediaTiming(el) {
    const c = nearestClip(el);
    return {
      start: c ? c.start : 0,
      end: c ? c.end : comp.duration,
      from: parseTime(el.getAttribute('data-from') ?? el.getAttribute('data-trim'), el, 'data-from') || 0,
      rate: parseFloat(el.getAttribute('data-rate') || el.getAttribute('playbackrate') || '1') || 1,
      loop: el.hasAttribute('loop'),
      volume: el.hasAttribute('data-volume') && !el.getAttribute('data-volume').includes(':') ? parseFloat(el.getAttribute('data-volume')) : 1,
      // data-volume="0:0 1:0.8 9:0.8 10:0" → time:volume pairs (seconds into the clip), straight lines between
      volumeKeys: el.hasAttribute('data-volume') && el.getAttribute('data-volume').includes(':') ? el.getAttribute('data-volume').trim().split(/[\s,]+/).map((kv) => { const [k, v] = kv.split(':'); return [parseTime(k, el, 'data-volume'), parseFloat(v)]; }).filter((x) => x[0] != null && isFinite(x[1])).sort((a, b) => a[0] - b[0]) : null,
      // data-duck="0.3": drop to this volume while any other sound (voice, video) plays
      duck: el.hasAttribute('data-duck') ? (parseFloat(el.getAttribute('data-duck')) >= 0 ? parseFloat(el.getAttribute('data-duck')) : 0.3) : null,
      fadeIn: parseTime(el.getAttribute('data-fade-in'), el, 'data-fade-in') || 0,
      fadeOut: parseTime(el.getAttribute('data-fade-out'), el, 'data-fade-out') || 0,
      muted: el.hasAttribute('muted') || el.muted === true,
    };
  }
  function setupVideos() {
    for (const el of [...document.querySelectorAll('video')]) {
      if (el.__gmVideo) continue;
      el.__gmVideo = true;
      const src = el.currentSrc || el.getAttribute('src') || (el.querySelector('source') && el.querySelector('source').getAttribute('src'));
      if (!src) { report('error', 'video-no-src', '<video> has no src.', el); continue; }
      const abs = new URL(src, location.href);
      const v = { el, src: abs.pathname + abs.search, url: abs.href, timing: mediaTiming(el), img: null, lastKey: null, pending: null };
      el.pause && el.pause();
      el.autoplay = false;
      el.removeAttribute('autoplay');
      if (MODE !== 'preview') {
        // Render mode: the <video> element stays (so your CSS still applies) but shows
        // frames decoded by ffmpeg as its background image. Frame-exact and codec-independent.
        el.removeAttribute('src');
        el.removeAttribute('poster');
        for (const s of el.querySelectorAll('source')) s.remove();
        try { el.load(); } catch (e) {}
        const cs = getComputedStyle(el);
        const fit = cs.objectFit || 'contain';
        el.style.backgroundSize = fit === 'fill' ? '100% 100%' : fit === 'none' ? 'auto' : fit === 'scale-down' ? 'contain' : fit;
        el.style.backgroundPosition = cs.objectPosition || '50% 50%';
        el.style.backgroundRepeat = 'no-repeat';
        v.bg = true;
      } else {
        el.muted = true; // preview: audio handled by the player
        el.preload = 'auto';
      }
      videos.push(v);
    }
  }
  function videoTimeAt(v, T) {
    const tm = v.timing;
    let lt = (T - tm.start) * tm.rate + tm.from;
    if (v.duration && tm.loop) lt = tm.from + ((lt - tm.from) % (v.duration - tm.from));
    if (v.duration) lt = Math.min(lt, v.duration - 0.001);
    return Math.max(0, lt);
  }
  const pendingWaits = [];
  function updateVideos(T) {
    let changed = false;
    for (const v of videos) {
      const tm = v.timing;
      const TT = mapT(v.el, T);
      if (TT < tm.start || TT >= tm.end) continue;
      const lt = videoTimeAt(v, TT);
      if (v.bg) {
        // a clip that starts between frames rounds up to one past the file's last frame near its end
        let fi = Math.round(lt * comp.fps);
        if (v.duration) fi = Math.min(fi, Math.max(0, Math.ceil(v.duration * comp.fps - 1e-6) - 1));
        if (fi === v.lastKey) continue;
        v.lastKey = fi;
        changed = true;
        const url = '/__gm/vframe?src=' + encodeURIComponent(v.src) + '&fps=' + comp.fps + '&i=' + fi;
        const pre = new Image();
        pre.src = url;
        pendingWaits.push(pre.decode().then(() => { v.el.style.backgroundImage = 'url("' + url + '")'; v.keep = pre; }, () => { report('error', 'video-frame', `Could not load video frame ${fi} of ${v.src}.`, v.el, 'Check that the file exists and ffmpeg can read it.', T); }));
      } else {
        const el = v.el;
        if (!v.duration && isFinite(el.duration) && el.duration > 0) v.duration = el.duration;
        if (livePlay.on) { if (Math.abs(el.currentTime - lt) > 0.25) { try { el.currentTime = lt; } catch (e) {} } if (el.paused) el.play().catch(() => {}); continue; }
        if (!el.paused) el.pause();
        if (Math.abs(el.currentTime - lt) > 0.5 / comp.fps) {
          changed = true;
          pendingWaits.push(new Promise((res) => {
            const done = () => { el.removeEventListener('seeked', done); res(); };
            el.addEventListener('seeked', done);
            try { el.currentTime = lt; } catch (e) { res(); }
            real.setTimeout(res, 1500);
          }));
        }
      }
    }
    return changed;
  }

  // ---------------------------------------------------------------------------
  // Live playback (studio, player): real sound from <audio>/<video>, following the video clock.
  // Volume curves and ducking match the rendered file.
  // ---------------------------------------------------------------------------
  const livePlay = { on: false, rate: 1, muted: false, volume: 1 };
  function keysAt(keys, t) {
    if (!keys || !keys.length) return 1;
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [a, va] = keys[i - 1], [b, vb] = keys[i]; return b === a ? vb : va + ((t - a) / (b - a)) * (vb - va); }
    return keys[keys.length - 1][1];
  }
  function syncMedia(on, T, opts = {}) {
    livePlay.on = !!on;
    if (opts.rate != null) livePlay.rate = opts.rate;
    if (opts.muted != null) livePlay.muted = opts.muted;
    if (opts.volume != null) livePlay.volume = opts.volume;
    T = T ?? now;
    const auds = [...document.querySelectorAll('audio')];
    const timings = auds.map((el) => ({ el, tm: mediaTiming(el), c: nearestClip(el) }));
    const sounding = (x) => { const st = x.c ? x.c.start : 0, en = x.c ? x.c.end : comp.duration; return T >= st && T < en; };
    for (const x of timings) {
      const { el, tm } = x;
      const st = x.c ? x.c.start : 0, en = x.c ? x.c.end : comp.duration;
      if (!on || T < st || T >= en || livePlay.rate !== 1) { if (!el.paused) el.pause(); continue; }
      let lt = (T - st) * tm.rate + tm.from;
      if (tm.loop && isFinite(el.duration) && el.duration > tm.from) lt = tm.from + ((lt - tm.from) % (el.duration - tm.from));
      let vol = tm.volume * keysAt(tm.volumeKeys, T - st);
      if (tm.fadeIn > 0) vol *= Math.min(1, (T - st) / tm.fadeIn);
      if (tm.fadeOut > 0) vol *= Math.min(1, (en - T) / tm.fadeOut);
      if (tm.duck != null && (timings.some((o) => o !== x && o.tm.duck == null && sounding(o)) || videos.some((v) => !v.timing.muted && T >= v.timing.start && T < v.timing.end))) vol *= tm.duck;
      el.volume = Math.max(0, Math.min(1, vol * livePlay.volume));
      el.muted = livePlay.muted;
      el.playbackRate = tm.rate;
      if (Math.abs(el.currentTime - lt) > 0.15) { try { el.currentTime = lt; } catch (e) {} }
      if (el.paused) el.play().catch(() => {});
    }
    for (const v of videos) { if (!v.bg) { v.el.muted = livePlay.muted || v.timing.muted; v.el.volume = Math.max(0, Math.min(1, (v.timing.volume ?? 1) * livePlay.volume)); if (!on) v.el.pause(); } }
  }
  // Same-origin pages can call gm directly; cross-origin embeds talk with postMessage.
  if (MODE === 'preview') {
    window.addEventListener('message', async (e) => {
      const m = e.data;
      if (!m || typeof m !== 'object' || !m.gm) return;
      const reply = (x) => { try { e.source && /** @type {Window} */ (e.source).postMessage(Object.assign({ gmReply: m.id }, x), '*'); } catch (er) {} };
      try {
        if (m.gm === 'ready') reply({ info: await ready() });
        else if (m.gm === 'seek') { let r = /** @type {any} */ (seek(m.t)); if (r && r.then) r = await r; if (m.playing != null) syncMedia(m.playing, m.t, m); reply({ t: m.t }); }
        else if (m.gm === 'media') { syncMedia(m.playing, m.t, m); reply({}); }
      } catch (er) { reply({ error: String(er && er.message || er) }); }
    });
  }

  // ---------------------------------------------------------------------------
  // Images: wait for newly shown images to decode before a frame is captured.
  // ---------------------------------------------------------------------------
  function waitImages() {
    let eager = false;
    for (const img of document.images) {
      // a lazy image outside the viewport never loads on its own (a camera brings it into view later): the wait for it never ended
      if (img.loading === 'lazy') { img.loading = 'eager'; eager = true; }
      if (!img.complete) pendingWaits.push(new Promise((res) => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', () => { report('error', 'image-failed', `Image failed to load: ${img.getAttribute('src')}`, img, 'Check the path (relative to the HTML file).'); res(); }, { once: true }); }));
    }
    if (eager) dropOwnMutations();
  }

  // ---------------------------------------------------------------------------
  // Frame callbacks
  // ---------------------------------------------------------------------------
  const frameFns = [];
  const layoutFns = []; // run after every animation is placed: safe to measure positions
  function info(T) {
    return { time: T, frame: Math.round(T * comp.fps), fps: comp.fps, duration: comp.duration, progress: comp.duration ? T / comp.duration : 0, width: comp.width, height: comp.height };
  }
  // A frame callback without an element, registered by a <script> inside a clip that does not start at 0, gets the
  // video's time while gm.timeline('#scene') in the same script counts from the scene's start: say so in check.
  // (Checked once the clips are known; the callback keeps the video time, as it always had.)
  const frameFnScripts = [];
  function addFrameFn(list, name, a, b) {
    if (typeof a === 'function') {
      list.push({ fn: a });
      const s = document.currentScript;
      if (s) { frameFnScripts.push({ script: s, name }); if (initialized) lintFrameFnScripts(); }
    } else if (a && typeof b === 'function') {
      const el = typeof a === 'string' ? document.querySelector(a) : a;
      if (!el && typeof a === 'string') report('warning', 'onframe-no-target', `gm.${name}('${a}', fn): the selector matched nothing, so fn gets the video's time.`, null, 'Check the selector, and put the <script> after the element (or inside it).');
      list.push({ el, fn: b });
    } else throw new Error(`gm.${name}(fn) or gm.${name}(element, fn)`);
  }
  function lintFrameFnScripts() {
    for (const { script, name } of frameFnScripts.splice(0)) {
      const c = nearestClip(script);
      if (!c || !(c.start > 1e-6)) continue;
      const sel = selectorOf(c.el);
      report('warning', 'onframe-global-time', `gm.${name}(fn) in a <script> inside ${sel} gets the video's time, not ${sel}'s own time: ${sel} starts at ${round(c.start)} s, while gm.timeline('${sel}') counts from 0 there.`, c.el, `Pass the scene: gm.${name}('${sel}', (local, info, el) => …) counts from its start and runs only while it is on screen. If you meant the video's time, move the script out of the clip.`);
    }
  }
  function runFrameFns(T, list = frameFns) {
    if (!list.length) return false;
    inFrameCallbacks = true;
    let ran = false;
    for (const f of list) {
      try {
        if (f.el) {
          const c = nearestClip(f.el);
          const s = c ? c.start : 0, e = c ? c.end : comp.duration;
          const vis = hasRemap && c && c.outer.length ? applyChain(c.outer, T) : T;
          if (vis < s || vis >= e) continue;
          const tt = hasRemap ? mapT(f.el, T) : T;
          ran = true;
          f.fn(tt - s, Object.assign(info(T), { local: tt - s, clipDuration: e - s }), f.el);
        } else { ran = true; f.fn(T, info(T)); }
      } catch (e) { pageError(e); }
    }
    flushAnimations(T, 'event');
    inFrameCallbacks = false;
    return ran;
  }

  // ---------------------------------------------------------------------------
  // Mutation tracking → static-frame detection
  // ---------------------------------------------------------------------------
  let mutated = true;
  const CLIP_SEL = '[data-start],[data-duration],[data-end],[data-sequence]';
  let mutations = 0; // counts DOM changes seen by handleRecords
  function handleRecords(recs) {
    for (const r of recs) {
      mutated = true; mutations++;
      if (r.type === 'childList') {
        for (const n of r.addedNodes) if (n.nodeType === 1 && (n.matches(CLIP_SEL) || n.querySelector(CLIP_SEL) || (n.parentElement && n.parentElement.hasAttribute('data-sequence')))) timelineDirty = true;
      } else if (r.type === 'attributes' && /^data-(start|duration|end|sequence|transition|gap|cuts|cut-align)$/.test(r.attributeName)) timelineDirty = true;
    }
  }
  const mo = new MutationObserver(handleRecords);
  // Discard mutations the runtime made itself.
  function dropOwnMutations() { mo.takeRecords(); }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  let readyPromise = null;
  let sourceEls = null; // the page's elements before the runtime changed anything (render matches them to the HTML file)
  const waits = [];
  const hooks = { preinit: [], init: [], seek: [], post: [], rebuild: [] };
  let initialized = false;

  function setStageVars() {
    root.style.setProperty('--stage-w', comp.width + 'px');
    root.style.setProperty('--stage-h', comp.height + 'px');
    root.style.setProperty('--px', PX() + 'px');
    root.style.setProperty('--stage-px', /** @type {any} */ (PX()));
  }

  function readSettings() {
    const w = parseInt(rootAttr('width') || '', 10), h = parseInt(rootAttr('height') || '', 10);
    if (w > 0) comp.width = w; if (h > 0) comp.height = h;
    const f = parseFloat(rootAttr('fps') || '');
    if (f > 0) comp.fps = f;
    FPS = comp.fps;
    const bg = rootAttr('background');
    if (bg) comp.background = bg;
    if (CONFIG.width) comp.width = CONFIG.width;
    if (CONFIG.height) comp.height = CONFIG.height;
    if (CONFIG.fps) { comp.fps = CONFIG.fps; FPS = comp.fps; }
    setStageVars();
    if (comp.width % 2 || comp.height % 2) report('warning', 'odd-size', `Size ${comp.width}x${comp.height} has an odd number; most video codecs need even sizes.`, null, 'Use even width and height, e.g. 1920x1080.');
  }

  // A scene file included in a data-sequence (<gm-include src="scenes/intro.html">) is the sequence's child itself: the
  // plain wrapper the include made (display: contents, nothing of its own) goes away and the scene takes its place.
  function unwrapSceneIncludes() {
    for (const seq of document.querySelectorAll('[data-sequence]')) {
      for (const w of [...seq.children]) {
        // (data-gm-plain: the include had no class, style, id or data-* of its own; what the engine added since goes)
        if (!w.hasAttribute('data-gm-plain')) continue;
        for (const x of [...w.attributes]) if (!/^(data-gm-include|data-gm-scope|data-gm-plain|style)$/.test(x.name)) w.removeAttribute(x.name);
        const kids = [...w.childNodes], scene = /** @type {Element | undefined} */ (kids.find((n) => n.nodeType === 1 && !SKIP_TAGS.has(/** @type {Element} */ (n).tagName)));
        if (!scene) continue;
        for (const x of ['data-gm-include', 'data-gm-scope']) if (w.hasAttribute(x) && !scene.hasAttribute(x)) scene.setAttribute(x, w.getAttribute(x));
        w.replaceWith(...kids);
      }
    }
  }
  function init() {
    if (initialized) return;
    initialized = true;
    unwrapSceneIncludes();
    if (document.body) { const els = [...document.body.getElementsByTagName('*')]; sourceEls = { els, parents: els.map((e) => e.parentElement) }; }
    readSettings();
    applyBindings();
    for (const h of hooks.preinit) { try { h(); } catch (e) { pageError(e); } }
    applySplit();
    buildTimeline();
    setupVideos();
    setupCountersAndTypers();
    applyEnterExit();
    for (const h of hooks.init) { try { h(); } catch (e) { pageError(e); } }
    lintFrameFnScripts();
    { const md = document.getElementById('gm-missing-data'); if (md) { try { const j = JSON.parse(md.textContent); report('warning', 'data-missing', (j.keys.length === 1 ? '{{data.' + j.keys[0] + '}} is' : j.keys.slice(0, 5).map((k) => '{{data.' + k + '}}').join(', ') + (j.keys.length > 5 ? ' and ' + (j.keys.length - 5) + ' more are' : ' are')) + ' empty: ' + (j.noData ? 'no data was given.' : 'the data has no value there.'), null, j.noData ? 'Pass --data data.json (or --props \'{...}\'), or put a data.json next to the HTML, or add <script type="application/json" id="gm-data">{...}</script> with default data, or write {{data.title|Default text}}.' : 'Check the path, or give a default: {{data.title|Default text}}.'); } catch (e) {} } }
    for (const el of document.querySelectorAll('[data-gm-include-error]')) report('error', 'include-not-found', `<gm-include src="${el.getAttribute('data-gm-include-error')}"> was not found.`, null, 'The path is relative to the HTML file that contains the include. Check the spelling, or run `npx givemotion add <block>` to copy a block into ./blocks.');
    if (comp.background && !document.body.style.background) document.body.style.background = comp.background;
    for (const a of preInit) { const tg = targetOf(a); origin.set(a, tg ? clipStartOf(tg) : 0); }
    preInit.length = 0;
    flushAnimations(0, 'clip');
    pendingInit = false;
    if (!comp.duration) report('error', 'no-duration', 'The video has no length.', null, 'Add data-duration="8" to <html>, or give elements data-start/data-duration.');
    // Lint: things that look wrong
    for (const el of document.querySelectorAll('[data-sequence]')) {
      if (!el.children.length) report('warning', 'empty-sequence', 'data-sequence has no children.', el);
    }
    for (const el of document.querySelectorAll('audio')) {
      if (!el.getAttribute('src') && !el.querySelector('source')) report('error', 'audio-no-src', '<audio> has no src.', el);
    }
    mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  }

  function ready() {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      if (document.readyState === 'loading') await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
      // Fonts and images that are already in the page
      try { await document.fonts.ready; } catch (e) {}
      // Let user code register waits during load
      if (document.readyState !== 'complete') await new Promise((r) => window.addEventListener('load', r, { once: true }));
      for (;;) {
        const w = waits.splice(0);
        if (!w.length) break;
        let done = false;
        const all = Promise.all(w.map((p) => Promise.resolve(p).catch((e) => pageError(e)))).finally(() => { done = true; });
        const pump = () => { if (done) return; loadPump(); real.setTimeout(pump, 4); };
        real.setTimeout(pump, 4);
        const limit = (CONFIG.loadTimeout || 30) * 1000;
        await Promise.race([all, new Promise((r) => real.setTimeout(r, limit))]);
        if (!done) { done = true; report('error', 'load-timeout', `Something passed to gm.wait() did not finish within ${limit / 1000}s.`, null, 'Check that every promise given to gm.wait() resolves (files exist, libraries load).'); }
      }
      try { await document.fonts.ready; } catch (e) {}
      init();
      // probe video durations (needed for looping)
      for (const v of videos) {
        if (CONFIG.videoDurations && CONFIG.videoDurations[v.src] != null) v.duration = CONFIG.videoDurations[v.src];
      }
      // Fonts used only by split text etc.
      try { await document.fonts.ready; } catch (e) {}
      return gm.inspect();
    })();
    return readyPromise;
  }

  // ---------------------------------------------------------------------------
  // seek(T) — the heart. Returns {dirty} synchronously when possible,
  // or a Promise when media must load.
  // ---------------------------------------------------------------------------
  let lastT = null;
  const logs = [];
  let frameIndex = 0;
  function seek(T) {
    if (!initialized) init();
    T = Math.max(0, Number(T) || 0);
    handleRecords(mo.takeRecords());
    if (timelineDirty) { buildTimeline(); applySplit(); setupVideos(); setupCountersAndTypers(); applyEnterExit(); for (const h of hooks.rebuild) { try { h(); } catch (e) { pageError(e); } } dropOwnMutations(); }
    let needsReload = false;
    if (lastT != null && T < lastT - 1e-9 && stateful) needsReload = true;
    // Step through intermediate frames for code that relies on requestAnimationFrame.
    // (Starting from frame 0 when this page has not rendered anything yet, so parallel
    // workers produce exactly the same frames as a single worker.)
    if (usedRAF && (lastT == null || T > lastT)) {
      const fps = comp.fps;
      const i0 = lastT == null ? 0 : Math.floor(lastT * fps + 1e-6) + 1;
      const i1 = Math.ceil(T * fps - 1e-6) - 1;
      for (let i = i0; i <= i1; i++) {
        const t = i / fps;
        runTimersUntil(t);
        now = t;
        runRAF(t);
      }
    }
    if (lastT == null || T >= lastT) runTimersUntil(T);
    now = T;
    handleRecords(mo.takeRecords());
    const visChanged = updateVisibility(T);
    dropOwnMutations();
    flushAnimations(T, 'clip');
    let hookChanged = false;
    for (const h of hooks.seek) { try { if (h(T)) hookChanged = true; } catch (e) { pageError(e); } }
    const ranFns = runFrameFns(T) || hookChanged;
    const hadRAF = rafs.size > 0;
    runRAF(T);
    if (hadRAF) flushAnimations(T, 'event');
    handleRecords(mo.takeRecords());
    const cChanged = updateCounters(T);
    const vChanged = updateVideos(T);
    dropOwnMutations();
    flushAnimations(T, 'clip');
    let animActive = seekAnimations(T);
    if (seekSmil(T)) animActive = true;
    if (driven.length && updateDriven(T)) animActive = true;
    for (const h of hooks.post) { try { if (h(T)) animActive = true; } catch (e) { pageError(e); } }
    steadyText();
    if (layoutFns.length) { if (runFrameFns(T, layoutFns)) animActive = true; steadyText(); }
    waitImages();
    const tChanged = lastT == null || Math.abs(T - lastT) > 1e-9;
    const dirty = tChanged && (lastT == null || visChanged || cChanged || vChanged || ranFns || hadRAF || animActive || mutated || activeBefore);
    activeBefore = animActive; // an animation that just finished still changes this frame vs the previous one
    mutated = false;
    lastT = T;
    frameIndex++;
    const result = { t: T, dirty: !!dirty, needsReload };
    if (pendingWaits.length) {
      const w = pendingWaits.splice(0);
      return Promise.all(w).then(() => document.fonts.ready).then(() => result);
    }
    if (document.fonts.status !== 'loaded') return document.fonts.ready.then(() => result);
    return result;
  }
  let activeBefore = true;

  // Steady text. When an element's transform only moves and scales it, Chrome puts its glyphs on whole pixels
  // vertically, so text that moves or zooms slowly steps a pixel at a time while the shapes around it glide (it
  // wobbles against its own box). A tiny rotation, just past the angle Chrome still treats as level (sin × scale ≈
  // 1/2048), makes it place glyphs at quarter pixels. Every element moved by an inline transform gets one; it depends
  // only on this frame's styles, so 1 worker == N workers. (Compositor layers would also glide, but keep raster
  // state from earlier frames.)
  const TILT_SEL = '[style*="transform"],[style*="translate"],[style*="scale"]';
  const TILT_DEG = 0.042, TILT_MAX = 0.12;
  const tilted = new Map(); // element -> the rotate value set on it
  const sheetRotate = new WeakMap(); // element -> its stylesheet gives it a rotate of its own
  const setStyle = (v) => v && v !== 'none';
  function ownScale(el) {
    const cs = getComputedStyle(el);
    let k = 1;
    if (setStyle(cs.scale)) {
      const p = cs.scale.split(/\s+/).map(parseFloat);
      k *= Math.sqrt(Math.abs(p[0] * (p.length > 1 ? p[1] : p[0]))) || 1;
    }
    if (setStyle(cs.transform)) { try { const m = new DOMMatrixReadOnly(cs.transform); k *= Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1; } catch (e) {} }
    return k;
  }
  const animMoves = new WeakMap(); // animation -> does it move or scale its target (and leave rotate alone)
  function movesTarget(a) {
    let v = animMoves.get(a);
    if (v === undefined) {
      v = false;
      try {
        let m = false, r = false;
        for (const k of a.effect.getKeyframes()) for (const p in k) { if (p === 'transform' || p === 'translate' || p === 'scale') m = true; else if (p === 'rotate') r = true; }
        v = m && !r;
      } catch (e) {}
      animMoves.set(a, v);
    }
    return v;
  }
  // Only text needs the tilt, and tilting a big blurred glow that drifts behind the scene costs a lot of paint time
  const textOf = new WeakMap(); // element -> [has text, mutations when looked]
  function hasText(el) {
    let v = textOf.get(el);
    if (!v || (!v[0] && v[1] !== mutations)) { v = [el.textContent.trim().length > 0, mutations]; textOf.set(el, v); }
    return v[0];
  }
  function steadyText() {
    handleRecords(mo.takeRecords());
    const seen = new Set(), scales = new Map(), cands = new Set();
    const scaleOf = (el) => { if (!el) return 1; let k = scales.get(el); if (k === undefined) { k = ownScale(el) * scaleOf(el.parentElement); scales.set(el, k); } return k; };
    for (const el of document.querySelectorAll(TILT_SEL)) {
      if (el instanceof HTMLElement && (setStyle(el.style.transform) || setStyle(el.style.translate) || setStyle(el.style.scale))) cands.add(el);
      else if (el instanceof SVGTextElement && setStyle(el.style.transform)) cands.add(el);
    }
    // elements moved by the page's own CSS animation or Web Animation (@keyframes) are on a composited layer that Chrome
    // rasters by its own rules; with the tilt they are drawn like an inline transform. (Not the engine's own enter and
    // exit animations: they already match between a part that continues and one that starts fresh, and the tilt broke that.)
    for (const a of known) {
      if (a.playState === 'idle' || ownAnim.has(a)) continue;
      const tg = targetOf(a);
      if (tg instanceof HTMLElement && tg.isConnected && !(a.effect && /** @type {any} */ (a.effect).pseudoElement) && movesTarget(a) && hasText(tg)) cands.add(tg);
    }
    for (const el of cands) {
      const s = el.style;
      const mine = tilted.get(el);
      // SVG text turns about the origin of the picture unless it has its own pivot: tweens give it its middle (motion.js),
      // and only then is a tiny turn free of any shift
      if (el instanceof SVGElement && !(s.transformBox === 'fill-box' && s.transformOrigin === '50% 50%')) continue;
      if (s.rotate && s.rotate !== mine) continue; // the page rotates it itself
      if (mine === undefined) {
        if (!sheetRotate.has(el)) sheetRotate.set(el, getComputedStyle(el).rotate !== 'none');
        if (sheetRotate.get(el)) continue;
      }
      // smaller on screen needs a larger angle (computed transform and scale leave out rotate: the same answer
      // whatever was drawn before)
      const k = scaleOf(el);
      const v = Math.round(Math.min(TILT_MAX, TILT_DEG / Math.min(1, k)) * 1e4) / 1e4 + 'deg';
      if (mine !== v) { s.rotate = v; tilted.set(el, v); }
      seen.add(el);
    }
    for (const [el, v] of tilted) if (!seen.has(el)) { if (el.style.rotate === v) el.style.rotate = ''; tilted.delete(el); }
    dropOwnMutations();
  }

  // ---------------------------------------------------------------------------
  // Helpers for authors
  // ---------------------------------------------------------------------------
  function interpolate(t, input, output, opts = {}) {
    const ease = easing(opts.easing || 'linear');
    const clampL = opts.clamp !== false && opts.extrapolateLeft !== 'extend';
    const clampR = opts.clamp !== false && opts.extrapolateRight !== 'extend';
    if (input.length !== output.length) throw new Error('gm.interpolate: input and output need the same length');
    let i = 1;
    while (i < input.length - 1 && t > input[i]) i++;
    const a = input[i - 1], b = input[i];
    let p = b === a ? 1 : (t - a) / (b - a);
    if (clampL && p < 0) p = 0;
    if (clampR && p > 1) p = 1;
    const e = p >= 0 && p <= 1 ? ease(p) : p;
    const o0 = output[i - 1], o1 = output[i];
    if (typeof o0 === 'number') return o0 + (o1 - o0) * e;
    return mixColor(o0, o1, e);
  }
  function parseColor(c) {
    const m = /^#([0-9a-f]{3,8})$/i.exec(c);
    if (m) {
      let h = m[1];
      if (h.length <= 4) h = [...h].map((x) => x + x).join('');
      const n = parseInt(h.slice(0, 6), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255, h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1];
    }
    const r = /rgba?\(([^)]+)\)/.exec(c);
    if (r) { const p = r[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat); return [p[0], p[1], p[2], p[3] ?? 1]; }
    return [0, 0, 0, 1];
  }
  let colorMixer = null;
  function mixColor(a, b, p) {
    if (colorMixer) return colorMixer(a, b, p);
    const A = parseColor(a), B = parseColor(b);
    const v = A.map((x, i) => x + (B[i] - x) * p);
    return `rgba(${Math.round(v[0])}, ${Math.round(v[1])}, ${Math.round(v[2])}, ${round(v[3])})`;
  }
  function spring(t, opts = {}) {
    const from = opts.from ?? 0, to = opts.to ?? 1;
    return from + (to - from) * springFn(opts)(Math.max(0, t - (opts.delay || 0)));
  }
  // Smooth value noise (deterministic), handy for organic motion.
  function noise(x, seed = 0) {
    const h = (n) => { const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return s - Math.floor(s); };
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return h(i) * (1 - u) + h(i + 1) * u;
  }

  function inspect() {
    if (!initialized) init();
    return {
      width: comp.width, height: comp.height, fps: comp.fps, duration: comp.duration, background: comp.background,
      frames: Math.max(1, Math.round(comp.duration * comp.fps)),
      clips: clips.map((c) => ({ selector: selectorOf(c.el), start: round(c.start), end: round(isFinite(c.end) ? c.end : comp.duration), scene: !!(c.el.classList.contains('scene') || (c.el.parentElement && c.el.parentElement.hasAttribute('data-sequence'))) })),
      transitions: transitionList.slice(),
      cameraShots: gm.__cameraShots ? gm.__cameraShots().map((c) => ({ ...c, start: round(c.start), arrive: round(c.arrive), next: c.next == null ? null : round(c.next) })) : [],
      media: media(),
      usesRAF: usedRAF, frameCallbacks: frameFns.length,
      issues: issues.slice(),
    };
  }
  function media() {
    const out = [];
    for (const v of videos) out.push(Object.assign({ kind: 'video', src: v.src }, v.timing, { end: isFinite(v.timing.end) ? v.timing.end : comp.duration }));
    for (const a of document.querySelectorAll('audio')) {
      const src = a.getAttribute('src') || (a.querySelector('source') && a.querySelector('source').getAttribute('src'));
      if (!src) continue;
      const u = new URL(src, location.href);
      const tm = mediaTiming(a);
      out.push(Object.assign({ kind: 'audio', src: u.pathname + u.search }, tm, { end: isFinite(tm.end) ? tm.end : comp.duration }));
    }
    return out;
  }

  // One switch for every "natural motion" default. Read at call time: the runtime can start before <html> is parsed.
  function motionStyle() {
    const v = (CONFIG.motion || document.documentElement.getAttribute('data-motion') || '').trim().toLowerCase();
    return v === 'classic' ? 'classic' : 'natural';
  }
  const naturalMotion = () => motionStyle() === 'natural';

  // Read size/fps from <html> right away so CSS (--px, --stage-w) and early scripts see the right values.
  try { readSettings(); } catch (e) {}

  const gm = {
    __runtime: true,
    get mode() { return MODE; },
    get time() { return now; },
    get width() { return comp.width; },
    get height() { return comp.height; },
    get fps() { return comp.fps; },
    get duration() { return comp.duration; },
    get px() { return PX(); },
    get data() { return getData(); },
    // 'natural' (default): physical easing, operator camera, adaptive motion blur, arcs.
    // 'classic': the older motion (fixed beziers, cameras that stop between shots). <html data-motion="classic">.
    get motion() { return motionStyle(); },
    // gm.onFrame(fn): fn(videoTime, info). gm.onFrame(el | selector, fn): fn(localTime, info, el), only while el's
    // clip is on screen, with the time counted from that clip's start.
    onFrame(a, b) { addFrameFn(frameFns, 'onFrame', a, b); },
    // Like onFrame, but runs after all animations are applied for this frame, so
    // getBoundingClientRect() returns where things really are. Use it to follow or aim at elements.
    onLayout(a, b) { addFrameFn(layoutFns, 'onLayout', a, b); },
    wait(p) { waits.push(typeof p === 'function' ? p() : p); return p; },
    // Beat grid from <html data-bpm data-beat-offset data-bar-offset data-beats-per-bar> (printed by `givemotion audio`).
    beat(n = 0) { const g = beatGrid(); return g.offset + n * g.period; },
    // when a word of the voice-over is said (video time): gm.word('pricing'), gm.word('spring_pricing#2.end')
    word(spec) { const t = wordTime(String(spec)[0] === '@' ? spec : '@' + spec, null, 'gm.word'); return t == null ? 0 : t; },
    get words() { const W = words(); return W ? W.list.map(({ word, start, end }) => ({ word, start, end })) : []; },
    bar(n = 0) { const g = beatGrid(); return g.barOffset + n * g.perBar * g.period; },
    timing(el) { if (typeof el === 'string') el = document.querySelector(el); if (!clips.length) { muted++; try { buildTimeline(); timelineDirty = true; } catch (e) {} finally { muted--; } } const c = nearestClip(el); return c ? { start: c.start, end: c.end, duration: c.end - c.start } : { start: 0, end: comp.duration, duration: comp.duration }; },
    interpolate, spring, noise, easing,
    ease: new Proxy({}, { get: (_, k) => easing(String(k).replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())) }),
    clamp: (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)),
    lerp: (a, b, p) => a + (b - a) * p,
    // random('dot-3') → the same number in [0,1) every time for that seed (strings or numbers).
    // random() → next value of the page's seeded Math.random. rng(seed) → a generator function.
    // gm.log(...): like console.log, but check and inspect print it with the video time it happened at
    log: (...a) => { logs.push({ t: round(now), msg: a.map((x) => { if (typeof x === 'string') return x; try { return JSON.stringify(x); } catch (e) { return String(x); } }).join(' ').slice(0, 500) }); if (logs.length > 5000) logs.splice(0, 1000); },
    __logs: (since = 0) => logs.slice(since),
    __logCount: () => logs.length,
    random: (seed) => (seed === undefined || seed === null ? Math.random() : makeRandom(hashSeed(seed))()),
    rng: (seed) => makeRandom(hashSeed(seed ?? 1)),
    ready, seek, inspect,
    // internal
    __issues: () => issues.slice(),
    __report: report,
    __selector: selectorOf,
    __clips: () => clips,
    __nearestClip: nearestClip,
    __real: real,
    __stateful: () => stateful || usedRAF,
    __usesRAF: () => usedRAF, // render: no auto motion blur for pages animated by requestAnimationFrame (history-dependent)
    __sourceEls: () => sourceEls,
    __syncMedia: syncMedia,
    __setVideoDurations(map) { for (const v of videos) if (map[v.src] != null) v.duration = map[v.src]; },
  };
  // Shared internals for runtime extensions (motion.js, audio.js). Not a public API.
  gm.__internal = {
    hooks, comp, real, PX, report, pageError, parseTime, easing, cssEasing, isEasingName, normEase,
    nearestClip, clipStartOf, clipEndOf, mapT, addOwn, transitions: () => transitionList, selectorOf, makeRandom, parseColor, mixColor, info, dropOwnMutations, noteMutations: () => handleRecords(mo.takeRecords()),
    morphPairs: () => morphPairs,
    // the animated state of the page at time T (animations and seek hooks only: no timers, frame callbacks or post
    // hooks). The camera samples the path of a followed element with it while loading, the same in every worker.
    probe(T) { flushAnimations(T, 'clip'); seekAnimations(T); for (const h of hooks.seek) { try { h(T); } catch (e) { pageError(e); } } },
    addOwnAnim(a, originTime) { ownAnim.add(a); origin.set(a, originTime); known.add(a); },
    setColorMixer(fn) { colorMixer = fn; }, clips: () => clips, waits, pendingWaits, MODE, CONFIG, SKIP_TAGS,
    get now() { return now; }, get initialized() { return initialized; }, motionStyle, naturalMotion,
    physEase, moveEase, hermiteEase, distanceFactor, restSizes, staggerJitter, hashSeed,
  };
  window.gm = gm;
  window.givemotion = gm;
})();
