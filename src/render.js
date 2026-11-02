// Render orchestration: open the composition, split frames across workers, encode, mux audio.
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync, readFileSync, renameSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, resolve, dirname, basename, extname, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { ensureChrome, FramePage, CACHE_DIR } from './browser.js';
import { machineLimits, browserMB, reserve, demand, fairShare, atExit } from './machine.js';
import { startServer, safeJoin } from './server.js';
import { requireFfmpeg, encoderPlan, openSegmentWriter, finalize, mixAudio, probe, qualitySettings, wantsHardware, encoderIsReproducible } from './ffmpeg.js';
import { pagePrints } from './parts.js';
import { parseScale } from './args.js';

export { parseScale };

/** @typedef {import('./types/api.js').RenderOptions} RenderOptions @typedef {import('./types/api.js').RenderResult} RenderResult @typedef {import('./types/api.js').OpenOptions} OpenOptions @typedef {import('./types/api.js').Composition} Composition @typedef {import('./types/api.js').Input} Input */

const FORMATS = { '.mp4': 'mp4', '.webm': 'webm', '.mov': 'mov', '.gif': 'gif', '.mkv': 'mkv' };

export function formatFromOutput(out, fmt) {
  if (fmt) return fmt;
  const ext = extname(out).toLowerCase();
  if (FORMATS[ext]) return FORMATS[ext];
  if (ext === '' || ext === '.png' && out.includes('%')) return 'png';
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') return 'png';
  return 'mp4';
}

function parseRange(range, fps, totalFrames) {
  if (!range) return [0, totalFrames];
  // "a-b" in frames, or "1.5s-3s" in seconds
  const m = /^\s*([\d.]+)(s?)\s*[-:]\s*([\d.]*)(s?)\s*$/.exec(String(range));
  if (!m) throw new Error(`Bad --frames range "${range}". Use "0-90" (frames) or "1.5s-4s" (seconds).`);
  const a = m[2] ? Math.round(parseFloat(m[1]) * fps) : parseInt(m[1], 10);
  const b = m[3] === '' ? totalFrames : (m[4] ? Math.round(parseFloat(m[3]) * fps) : parseInt(m[3], 10));
  return [Math.max(0, a), Math.min(totalFrames, Math.max(a + 1, b))];
}

/**
 * The picture size at a scale. A side that is not a whole number of pixels is rounded by the browser on its own (so
 * 1.333 turns 1920x1080 into 2559x1440: stretched, and odd), and video encoders need even sizes: both are refused
 * with the scale that works. (A whole scale keeps the old behaviour: the composition's own size is checked elsewhere.)
 */
export function scaledSize(w, h, scale, format) {
  const W = w * scale, H = h * scale, rw = Math.round(W), rh = Math.round(H);
  if (scale === Math.round(scale)) return { width: rw, height: rh };
  const even = format !== 'png' && format !== 'gif';
  const ok = (x, y) => Math.abs(x - Math.round(x)) < 0.01 && Math.abs(y - Math.round(y)) < 0.01 && (!even || (Math.round(x) % 2 === 0 && Math.round(y) % 2 === 0));
  if (ok(W, H)) return { width: rw, height: rh };
  // a fraction near the asked scale that gives whole (even) sizes: a target height over the layout height
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  let hint = '';
  for (const d of [0, 2, -2, 4, -4, 6, -6, 8, -8]) {
    const th = Math.round(H / 2) * 2 + d;
    if (th <= 0 || !Number.isInteger(h) || !ok((w * th) / h, th)) continue;
    const g = gcd(th, h);
    hint = ` Use --scale ${h / g === 1 ? th / g : th / g + '/' + h / g} (${Math.round((w * th) / h)}x${th}).`;
    break;
  }
  const r2 = (x) => +x.toFixed(2);
  if (Math.abs(W - rw) >= 0.01 || Math.abs(H - rh) >= 0.01) throw new Error(`--scale ${+scale.toFixed(4)} turns ${w}x${h} into ${r2(W)}x${r2(H)} px, not whole pixels (the browser would round each side on its own and stretch the picture).${hint || ' Pick a scale that gives whole pixels, or change the composition size.'}`);
  throw new Error(`--scale ${+scale.toFixed(4)} gives ${rw}x${rh}: video encoders need an even width and height.${hint || ' Pick another scale, or render PNG frames.'}`);
}

/**
 * Auto motion blur settings (see velocityBlur). Every frame is still captured once: each element that moves on its own
 * gets a smear along its move, as long as the distance it covers while the shutter is open (shutter 0.5 = 180°), drawn
 * by the browser in the same capture. `min`: smallest smear drawn, in px on a 1080 px screen; `maxEls`: most elements
 * smeared in one frame (the fastest and biggest first). Changing a value redoes every cached part (parts fingerprint).
 */
export const AUTO_BLUR = { v: 2, min: 3, maxEls: 48 };

/**
 * --motion-blur: unset = off (auto is opt-in until the smear blur is validated) (data-motion="classic"); "auto"; "off" (also
 * 0, false, none); a number = that many samples on every frame (averaged).
 */
export function resolveMotionBlur(value, { motion = 'natural' } = {}) {
  const v = value == null || value === true ? '' : String(value).trim().toLowerCase();
  if (v === 'off' || v === 'false' || v === 'none' || v === 'no' || v === '0') return { mode: 'off', samples: 1 };
  if (v === '' || v === 'auto' || v === 'on') {
    // natural motion (the default): fast moves get a camera's smear, measured per frame (0-3% render time on the
    // examples); classic motion stays sharp
    if (v === '' && motion === 'classic') return { mode: 'off', samples: 1, why: 'classic' };
    return { mode: 'auto', samples: 1 };
  }
  const n = parseInt(v, 10);
  if (!(n >= 1)) throw new Error(`Bad --motion-blur "${value}". Use auto, off, or a number of samples per frame (2-32).`);
  return n === 1 ? { mode: 'off', samples: 1 } : { mode: 'fixed', samples: Math.min(32, n) };
}

/** Resolve the HTML file and the folder that will be served. */
/** @param {Input} input */
export function resolveInput(input) {
  let file = resolve(input || 'index.html');
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) throw new Error(`Composition not found: ${file}`);
  // Serve from the nearest folder that looks like a project root (has package.json) or the file's folder.
  let root = dirname(file);
  let cur = root;
  for (let i = 0; i < 4; i++) {
    if (existsSync(join(cur, 'package.json')) || existsSync(join(cur, 'givemotion.json'))) { root = cur; break; }
    const up = dirname(cur);
    if (up === cur) break;
    cur = up;
  }
  return { file, root, rel: relative(root, file) };
}

/** Workers a render wants if it had the computer to itself (reserve() then takes off what other renders use). */
function defaultWorkers(totalFrames, pixels = 1920 * 1080) {
  const lim = machineLimits();
  let w = Math.max(1, Math.min(lim.browsers, Math.floor(lim.memMB / browserMB(pixels))));
  // Short videos are not worth many browsers
  w = Math.min(w, Math.max(1, Math.floor(totalFrames / 24)));
  return w;
}

/**
 * Open a page for a composition (used by render, still, snapshot, check).
 * @param {Input} input
 * @param {OpenOptions & { mode?: string }} [opts]
 * @returns {Promise<Composition>}
 */
export async function openComposition(input, opts = {}) {
  opts = { ...opts, scale: parseScale(opts.scale) };
  const { file, root, rel } = resolveInput(input);
  // No --data and the page has no data of its own: use data.json next to the HTML if there is one.
  if (opts.data == null && /\.html?$/i.test(file)) {
    const dj = join(dirname(file), 'data.json');
    if (existsSync(dj) && !/id=["']gm-data["']/i.test(readFileSync(file, 'utf8'))) { try { opts = { ...opts, data: JSON.parse(readFileSync(dj, 'utf8')) }; } catch (e) { throw new Error(`data.json next to the composition is not valid JSON: ${e.message}`); } }
  }
  const chrome = await ensureChrome({ chrome: opts.chrome, log: opts.log });
  const server = await startServer({ root, maxW: 3840, maxH: 2160, data: opts.data ?? null });
  const config = { mode: opts.mode || 'render', seed: opts.seed ?? 1, data: opts.data ?? null, fps: opts.fps, width: opts.width, height: opts.height };
  const url = server.url(rel);
  // First page discovers size; reopen at the right size if needed.
  const page = new FramePage({ chrome, width: opts.width || 1920, height: opts.height || 1080, scale: opts.scale || 1, capture: opts.capture, gl: opts.gl, transparent: opts.transparent, timeoutMs: opts.timeoutMs, verbose: opts.verbose, onConsole: opts.onConsole });
  let info;
  try {
    await page.start();
    info = await page.open(url, config);
    if (info.width !== page.opts.width || info.height !== page.opts.height) {
      page.opts.width = info.width; page.opts.height = info.height;
      await page.setViewport(info.width, info.height);
      info = await page.evaluate('gm.inspect()');
    }
  } catch (e) {
    // do not leave Chrome and the server running (the process would never exit)
    await page.close().catch(() => {});
    await server.close().catch(() => {});
    throw e;
  }
  return { page, info, server, chrome, url, config, file, root, rel };
}

/**
 * Another browser on an open composition (same page, same size and capture mode): render's and check's workers.
 * @param {Composition} ctx
 * @param {any} opts
 */
export async function openWorker(ctx, opts) {
  const page = new FramePage({ chrome: ctx.chrome, width: ctx.info.width, height: ctx.info.height, scale: opts.scale || 1, capture: ctx.page.mode, gl: opts.gl, transparent: opts.transparent, timeoutMs: opts.timeoutMs });
  try {
    await page.start();
    await page.open(ctx.url, ctx.config);
  } catch (e) {
    await page.close().catch(() => {});
    throw e;
  }
  return page;
}

async function prepareMedia(ctx, page) {
  const media = ctx.info.media || [];
  const durations = {};
  const audio = [];
  for (const m of media) {
    // Same rule as the server: inside the project folder, never hidden files.
    const file = safeJoin(ctx.root, decodeURIComponent(m.src.split('?')[0]));
    if (!file) throw new Error(`Media files must be inside the project folder (and not hidden): ${m.src}`);
    if (!existsSync(file)) throw new Error(`Media file not found: ${m.src}`);
    const p = probe(file);
    if (!p) throw new Error(`ffprobe could not read ${m.src}`);
    if (m.kind === 'video') durations[m.src] = p.duration;
    const wantsAudio = (m.kind === 'audio' || (m.kind === 'video' && !m.muted)) && p.hasAudio && (m.volume ?? 1) > 0;
    if (wantsAudio) audio.push({ file, start: m.start, end: m.end, from: m.from || 0, rate: m.rate || 1, loop: !!m.loop, volume: m.volume ?? 1, fadeIn: m.fadeIn || 0, fadeOut: m.fadeOut || 0, volumeKeys: m.volumeKeys || null, duck: m.duck ?? null });
  }
  applyDucking(audio);
  return { durations, audio };
}

// Piecewise-linear [t, v] helpers for volume curves
function evalKeys(keys, t) {
  if (!keys || !keys.length) return 1;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [a, va] = keys[i - 1], [b, vb] = keys[i]; return b === a ? vb : va + ((t - a) / (b - a)) * (vb - va); }
  return keys[keys.length - 1][1];
}
/** Music with data-duck gets quieter while other sounds play (voice-over, video). */
function applyDucking(audio) {
  for (const a of audio) {
    if (a.duck == null) continue;
    const spans = audio.filter((o) => o !== a && o.duck == null).map((o) => [Math.max(o.start, a.start) - a.start, Math.min(o.end, a.end) - a.start]).filter(([s, e]) => e > s).sort((x, y) => x[0] - y[0]);
    const merged = [];
    for (const sp of spans) { const l = merged[merged.length - 1]; if (l && sp[0] <= l[1] + 0.6) l[1] = Math.max(l[1], sp[1]); else merged.push(sp.slice()); }
    if (!merged.length) continue;
    const down = 0.25, up = 0.45, lv = a.duck;
    const duckKeys = [[0, 1]];
    for (const [s, e] of merged) duckKeys.push([Math.max(0, s - down), 1], [Math.max(0, s), lv], [e, lv], [e + up, 1]);
    duckKeys.sort((x, y) => x[0] - y[0]);
    const pts = new Set([...duckKeys.map((k) => k[0]), ...(a.volumeKeys || []).map((k) => k[0])]);
    const ts = [...pts].sort((x, y) => x - y);
    const fine = [];
    ts.forEach((t, i) => { fine.push(t); if (i < ts.length - 1) fine.push((t + ts[i + 1]) / 2); });
    a.volumeKeys = fine.map((t) => [t, evalKeys(duckKeys, t) * evalKeys(a.volumeKeys, t)]);
  }
}

const AUDIO_FORMATS = { '.mp3': 'mp3', '.wav': 'wav', '.m4a': 'm4a', '.aac': 'm4a', '.ogg': 'ogg', '.opus': 'ogg', '.flac': 'flac' };

/**
 * Render a composition to a video file.
 * Returns a summary object.
 */
/**
 * @param {Input} input
 * @param {RenderOptions} [opts]
 * @returns {Promise<RenderResult>}
 */
export async function render(input, opts = {}) {
  const t0 = Date.now();
  opts = { ...opts, scale: parseScale(opts.scale) };
  const log = opts.log || ((s) => process.stderr.write(s + '\n'));
  // opts.onProgress({ phase: 'open' | 'frames' | 'encode' | 'done', ... }): frames carries done, total, fps, eta
  const phase = (p, extra) => { if (opts.onProgress) { try { opts.onProgress({ phase: p, ...extra }); } catch (e) {} } };
  phase('open');
  const out = resolve(opts.output || 'out.mp4');
  const format = formatFromOutput(out, opts.format);
  const info = format === 'png' ? null : requireFfmpeg();
  const q = qualitySettings(opts.quality);
  const transparent = !!opts.transparent;
  const captureFormat = format === 'png' || transparent || opts.quality === 'max' || opts.lossless ? 'png' : 'jpeg';
  // The GPU video encoder: on by default on a Mac (VideoToolbox) once it has shown it encodes reproducibly here.
  let hardware = format === 'png' ? false : wantsHardware({ hardware: opts.hardware, format, transparent, quality: opts.quality, codec: opts.codec, info });
  if (hardware === 'auto') hardware = encoderIsReproducible(encoderPlan({ format, quality: opts.quality, crf: opts.crf, codec: opts.codec, transparent, info, hardware: true }), info, { cacheFile: join(CACHE_DIR, 'hardware-encoders.json'), tmp: opts.tmpdir });
  const plan = format === 'png' ? null : encoderPlan({ format, quality: opts.quality, crf: opts.crf, codec: opts.codec, transparent, info, hardware });
  const shutter = opts.shutter ?? 0.5;

  if (AUDIO_FORMATS[extname(out).toLowerCase()] && !opts.format) {
    const r = await renderAudioOnly(input, out, AUDIO_FORMATS[extname(out).toLowerCase()], opts, log, t0);
    phase('done', { output: out, seconds: r.seconds, frames: 0 });
    return r;
  }
  // say at once that this render wants workers (the size comes later), so renders that start together share evenly
  const want = opts.workers ? null : demand(machineLimits().browsers);
  let ctx;
  try { ctx = await openComposition(input, { ...opts, mode: 'render', log }); } catch (e) { if (want) want.drop(); throw e; }
  const cleanup = [];
  if (want) cleanup.push(want.drop);
  const tmp = mkdtempSync(join(opts.tmpdir || tmpdir(), 'gm-render-'));
  const removeTmp = () => rmSync(tmp, { recursive: true, force: true });
  const unhookTmp = atExit(removeTmp);
  cleanup.push(removeTmp, unhookTmp);
  const pages = [ctx.page];
  try {
    const comp = ctx.info;
    const size = scaledSize(comp.width, comp.height, opts.scale, format);
    const errors = comp.issues.filter((i) => i.severity === 'error');
    if (errors.length && !opts.force) {
      const e = new Error('The composition has errors:\n' + errors.map((i) => `  - [${i.code}] ${i.message}${i.selector ? ' (' + i.selector + ')' : ''}${i.fix ? '\n    fix: ' + i.fix : ''}`).join('\n') + '\nFix them or pass --force.');
      /** @type {any} */ (e).issues = comp.issues;
      throw e;
    }
    const fps = comp.fps;
    // motion blur: off, a fixed number of samples for every frame, or auto (the default in natural motion)
    const motion = await ctx.page.evaluate('gm.motion').catch(() => 'natural');
    let blur = resolveMotionBlur(opts.motionBlur, { motion });
    // requestAnimationFrame code keeps its own state from call to call: extra sub-frame calls would change what it
    // draws next (and differ between workers), so such pages get no auto blur
    const usesRAF = () => ctx.page.evaluate('gm.__usesRAF ? gm.__usesRAF() : gm.__stateful()');
    if (blur.mode === 'auto' && (await usesRAF())) blur = { mode: 'off', samples: 1, why: 'requestAnimationFrame' };
    const blurSamples = blur.mode === 'fixed' ? blur.samples : 1;
    const blurStats = { blurred: 0, samples: 0, ref: Math.min(comp.width, comp.height) / 1080 };
    const totalFrames = Math.max(1, Math.round(comp.duration * fps));
    const [f0, f1] = parseRange(opts.frames, fps, totalFrames);
    const nFrames = f1 - f0;
    const media = format === 'png' ? { durations: {}, audio: [] } : await prepareMedia(ctx, ctx.page);
    if (opts.muted) media.audio = [];

    // Work list. Whole videos are cut into fixed parts (1-2 s) that are kept next to the output with a fingerprint
    // of what they depend on; the next render redoes only the parts that changed and joins all parts again.
    // A part is the same bytes whichever worker renders it, so a patched video equals a full render.
    // (--no-cache: same parts, in a temporary folder, so the bytes never depend on the worker count either)
    const useParts = format !== 'png' && !opts.frames;
    const keepParts = useParts && opts.cache !== false;
    let ranges, parts = null;
    if (useParts) {
      const segF = Math.max(1, Math.round((totalFrames / fps < 12 ? 1 : 2) * fps));
      // (opts.cacheDir / --cache-dir: keep them there instead, for apps that move the output away;
      //  opts.cacheKey / --cache-key: the folder's name, for callers that name each version's output differently)
      if (opts.cacheKey != null && (!/^[^/\\]+$/.test(String(opts.cacheKey)) || /^\.+$/.test(String(opts.cacheKey)))) throw new Error(`Bad cache key "${opts.cacheKey}": use a plain name, without slashes.`);
      const dir = keepParts ? join(opts.cacheDir ? resolve(opts.cacheDir) : join(dirname(out), '.gm-parts'), opts.cacheKey != null ? String(opts.cacheKey) : basename(out)) : join(tmp, 'parts');
      const settings = hashOf(JSON.stringify({ v: 2, engine: engineHash(), format, plan, captureFormat, jpeg: q.jpeg, blurSamples, blur: blur.mode === 'auto' ? AUTO_BLUR : null, shutter, w: comp.width, h: comp.height, scale: opts.scale || 1, fps, seed: ctx.config.seed, data: ctx.config.data, transparent, segF }));
      const deps = await dependencyPrints(ctx);
      const old = keepParts ? readJson(join(dir, 'parts.json')) : null;
      const redo = opts.redo ? parseRange(opts.redo, fps, totalFrames) : null;
      const list = [];
      for (let a = 0, i = 0; a < totalFrames; a += segF, i++) {
        const b = Math.min(totalFrames, a + segF);
        const t0s = (a - 1) / fps, t1s = b / fps; // one frame of margin for motion blur
        // a clip's late elements count once they can show (with margin for the motion blur shutter)
        const tLate = (b + 1 + Math.max(1, shutter)) / fps;
        const used = deps.clips.filter((c) => c.end > t0s && c.start < t1s).map((c) => [c.fp, c.start, c.end, c.units.map((u, k) => (u.t < tLate ? [k, u.fp, u.t, u.end] : null)).filter(Boolean)]);
        const fp = hashOf(JSON.stringify([settings, deps.shared, a, b, used]));
        const file = join(dir, `part-${String(i).padStart(5, '0')}.${plan.segExt}`);
        const prev = old && old.settings === settings && old.parts[i];
        const keep = prev && prev.a === a && prev.b === b && prev.fp === fp && existsSync(file) && !(redo && a < redo[1] && b > redo[0]);
        list.push({ i, a, b, fp, file, keep });
      }
      const why = !old ? 'first render' : old.settings !== settings ? 'settings, data or engine changed' : old.shared !== deps.shared ? 'shared code, styles or files changed' : null;
      const same = (o, c) => o.fp === c.fp && o.start === c.start && o.end === c.end;
      const changedClips = old && old.settings === settings && old.shared === deps.shared ? deps.clips.flatMap((c) => {
        const o = (old.clips || []).find((x) => same(x, c));
        return !o ? [c.name] : c.units.filter((u, k) => { const x = o.units && o.units[k]; return !(x && x.fp === u.fp && x.t === u.t && x.end === u.end); }).map((u) => u.name);
      }) : [];
      parts = { dir, settings, deps, list, why, changedClips, redo };
      ranges = list.filter((p) => !p.keep).map((p) => ({ a: p.a, b: p.b, file: p.file }));
      mkdirSync(dir, { recursive: true });
    } else {
      ranges = [{ a: f0, b: f1, file: format === 'png' ? null : join(tmp, `seg.${plan.segExt}`) }];
    }
    const todoFrames = ranges.reduce((s, r) => s + r.b - r.a, 0);
    const mbEach = browserMB(size.width * size.height);
    let workers = Math.max(1, Math.min(opts.workers || defaultWorkers(todoFrames, size.width * size.height), Math.max(1, todoFrames)));
    // The browsers come out of the computer's budget, shared with the other givemotion processes running now (other
    // projects' renders, a check): each render gets an even share, gains workers as the others finish and gives some
    // back between parts when a new one starts. --workers is taken as asked.
    const shared = !opts.workers && todoFrames > 0;
    const wanted = workers;
    if (want) want.set(shared ? wanted : 0);
    const grant = shared ? reserve(Math.min(wanted, fairShare(mbEach)) - 1, mbEach) : null;
    if (grant) { cleanup.push(grant.release); workers = 1 + grant.n; }
    const auto = blur.mode === 'auto';
    // each worker gets a run of neighbouring frames; one that runs out takes the back half of the longest run left
    const runs = splitRanges(ranges, workers, useParts ? 1 : 0, tmp, plan).map((g) => ({ parts: g, owner: -1 }));
    const segmentFiles = runs.flatMap((r) => r.parts.map((p) => p.file));
    let nWorkers = Math.max(1, runs.length);
    if (!opts.quiet) {
      log(`givemotion: ${comp.width}x${comp.height}${opts.scale !== 1 ? ' @' + +(/** @type {number} */ (opts.scale)).toFixed(4) + 'x (' + size.width + 'x' + size.height + ')' : ''} ${fps}fps ${(nFrames / fps).toFixed(2)}s (${nFrames} frames) → ${relativeOut(out)} [${format}, ${nWorkers} worker${nWorkers > 1 ? 's' : ''}, ${ctx.page.mode}${blurSamples > 1 ? ', motion blur x' + blurSamples : auto ? ', motion blur auto' : blur.why ? ', no motion blur: the page uses requestAnimationFrame' : ''}${hardware ? ', GPU encoder' : ''}]`);
      if (parts && parts.list.some((p) => p.keep)) {
        const kept = parts.list.filter((p) => p.keep).length;
        log(`  reusing ${kept} of ${parts.list.length} parts from the last render; redoing ${parts.list.length - kept}${parts.redo ? ' (--redo)' : ''}${parts.changedClips.length ? ' (changed: ' + parts.changedClips.slice(0, 4).join(', ') + (parts.changedClips.length > 4 ? ', …' : '') + ')' : ''}`);
      } else if (keepParts && parts.why && parts.why !== 'first render') log(`  redoing every part: ${parts.why}`);
      if (grant && workers < wanted) log(`  ${workers} worker${workers > 1 ? 's' : ''}${useParts ? ' for now' : ''} instead of ${wanted}: ${grant.limitedBy === 'free memory' ? 'the computer is low on free memory' : `the computer is shared with other givemotion processes (${grant.others} browser${grant.others === 1 ? '' : 's'} open)`}${useParts ? '; more join when they finish' : ''} (--workers <n> to override)`);
    }

    if (process.env.GIVEMOTION_PROFILE) log(`  setup ${Date.now() - t0}ms`);
    const setDurations = Object.keys(media.durations).length ? `(() => { const d = ${JSON.stringify(media.durations)}; gm.__setVideoDurations && gm.__setVideoDurations(d); })()` : null;
    // Start other workers in parallel
    // (the ones that opened are closed below even when another failed to: they would keep their browsers running)
    const started = todoFrames ? await Promise.allSettled(Array.from({ length: nWorkers - 1 }, () => openWorker(ctx, opts))) : [];
    for (const r of started) if (r.status === 'fulfilled') pages.push(r.value);
    const failed = started.find((r) => r.status === 'rejected');
    if (failed) throw /** @type {PromiseRejectedResult} */ (failed).reason;
    if (grant) grant.release(); // the workers are open and count themselves now
    if (setDurations) await Promise.all(pages.map((p) => p.evaluate(setDurations)));
    // Auto blur: seek with velocityBlur (installed once per page), which also smears what moves fast at that time
    const vbArgs = JSON.stringify({ min: AUTO_BLUR.min * blurStats.ref, maxEls: AUTO_BLUR.maxEls });
    const installed = new WeakSet();
    const seekFrame = async (page, f) => {
      const t = Math.max(0, f / fps);
      if (!auto) return page.seek(t);
      if (!installed.has(page)) { await page.evaluate(`window.__gmVelocityBlur = ${velocityBlur.toString()}; 1`); installed.add(page); }
      return page.evaluate(`__gmVelocityBlur(${t}, ${shutter / fps}, ${vbArgs})`);
    };

    let done = 0, reused = 0, partsBytes = 0;
    let lastLog = 0;
    const tFrames = Date.now();
    const progress = () => {
      const now = Date.now();
      if (now - lastLog < 1000 && done < todoFrames && done > 0) return;
      lastLog = now;
      const el = (now - tFrames) / 1000;
      const rate = done / Math.max(0.001, el);
      const eta = rate > 0 ? (todoFrames - done) / rate : null;
      if (opts.onProgress) phase('frames', { done, total: todoFrames, fps: +rate.toFixed(1), eta: eta == null ? null : +eta.toFixed(1), frames: nFrames, reusedParts: parts ? parts.list.filter((p) => p.keep).length : 0 });
      else if (done > 0 && !opts.quiet) log(`  ${String(Math.round((done / Math.max(1, todoFrames)) * 100)).padStart(3)}%  ${done}/${todoFrames} frames  ${rate.toFixed(1)} fps  eta ${(eta || 0).toFixed(0)}s`);
    };
    progress();

    if (format === 'png') mkdirSync(out.includes('%') ? dirname(out) : out, { recursive: true });
    const jpegQ = q.jpeg;
    // the work: a worker takes the next range of its own run; out of work, it takes a retired worker's run, or the back
    // half of the longest run (its owner takes from the front), so the runs stay neighbouring frames
    let active = 0, retire = 0, stopped = false;
    const partsLeft = () => runs.reduce((n, r) => n + r.parts.length, 0);
    const next = (wi) => {
      if (stopped) return null;
      if (retire > 0 && active > 1 && wi !== 0) { retire--; return null; }
      let own = runs.find((r) => r.owner === wi);
      if (!own) { own = runs.find((r) => r.owner === -1 && r.parts.length); if (own) own.owner = wi; }
      if (own && own.parts.length) return own.parts.shift();
      const left = runs.find((r) => r.owner === -2 && r.parts.length);
      if (left && own) { own.parts = left.parts; left.parts = []; return own.parts.shift(); }
      if (left) { left.owner = wi; return left.parts.shift(); }
      const longest = runs.filter((r) => r.parts.length).sort((x, y) => y.parts.length - x.parts.length)[0];
      if (!longest) return null;
      const take = longest.parts.splice(longest.parts.length - Math.max(1, Math.floor(longest.parts.length / 2)));
      if (own) own.parts = take; else runs.push((own = { parts: take, owner: wi }));
      return own.parts.shift();
    };
    const runWorker = async (page, wi) => {
      active++;
      let last = null, prevFrame = -2;
      const prof = { seek: 0, cap: 0, write: 0, end: 0 };
      // a finished part's encoder keeps working while the next part is captured (the encoder pipeline stays full)
      const ending = [], open = [];
      let frames = 0;
      try {
      for (let range; (range = next(wi)); ) {
        const { a, b, file } = range;
        frames += b - a;
        const tmpFile = file ? file + '.tmp.' + plan.segExt : null;
        const writer = file ? openSegmentWriter({ fps, inputCodec: captureFormat === 'png' ? 'png' : 'mjpeg', out: tmpFile, plan, motionBlur: blurSamples > 1 ? { samples: blurSamples } : null }) : null;
        try {
          // Warm up on the previous frame: Chrome's paint caches then match a single worker exactly.
          // and Chrome's paint state from earlier frames is dropped, so any split between workers gives the same bytes
          // A part that starts at frame 0 has no previous frame to warm up on: right after the page opens (several
          // browsers starting at once) its first capture could catch the page before it drew (elements at their CSS
          // rest, tiles missing), so frame 0 is captured once and thrown away first (below).
          const coldStart = a === 0 && prevFrame === -2;
          // A part starts the same way whether this worker just drew the frame before it or is new to it: the layers that
          // hold animated text are dropped (resetPaint), so the bytes do not depend on how parts were split between workers.
          const follows = a === prevFrame + 1;
          if (!follows) last = null;
          if (a > 0 && (!follows || useParts)) {
            if (!follows) await seekFrame(page, a - 1);
            const did = await page.resetPaint(useParts);
            if (did) last = null; else if (!follows) await page.capture(captureFormat, jpegQ);
          }
          for (let f = a; f < b; f++) {
            for (let s = 0; s < blurSamples; s++) {
              let q0 = Date.now();
              const r = blurSamples > 1 ? await page.seek(Math.max(0, (f + (s / (blurSamples - 1) - 0.5) * shutter) / fps)) : await seekFrame(page, f);
              prof.seek += Date.now() - q0; q0 = Date.now();
              if (r && r.needsReload) throw new Error('Internal: page needs reload during render.');
              let buf;
              if (coldStart && f === 0 && s === 0) await page.capture(captureFormat, jpegQ);
              if (!last || (r && r.dirty) || opts.noReuse) buf = await page.capture(captureFormat, jpegQ);
              else { buf = last; if (s === 0) reused++; }
              last = buf;
              if (auto && r && r.blurred) { blurStats.blurred++; blurStats.samples += r.blurred; }
              prof.cap += Date.now() - q0; q0 = Date.now();
              if (writer) { await writer.write(buf); prof.write += Date.now() - q0; }
              else if (s === 0) writeFileSync(out.includes('%') ? out.replace(/%0?(\d*)d/, (m, n) => String(f).padStart(parseInt(n || '1', 10), '0')) : join(out, `frame-${String(f).padStart(6, '0')}.png`), buf);
            }
            prevFrame = f;
            done++;
            progress();
          }
          if (writer) { open.push(writer); ending.push(writer.end().then(() => { renameSync(tmpFile, file); open.splice(open.indexOf(writer), 1); })); }
          // do not let more than two parts queue up behind the encoder
          if (ending.length > 2) { const q1 = Date.now(); await ending[ending.length - 3]; prof.end += Date.now() - q1; }
        } catch (e) {
          if (writer) writer.kill();
          throw e;
        }
      }
      const q1 = Date.now();
      await Promise.all(ending);
      prof.end += Date.now() - q1;
      } catch (e) {
        for (const w of open) w.kill();
        await Promise.allSettled(ending);
        throw e;
      } finally {
        active--;
        // what it had not started goes to the others
        for (const r of runs) if (r.owner === wi) r.owner = -2;
      }
      if (process.env.GIVEMOTION_PROFILE) log(`  worker ${wi}: seek ${prof.seek}ms, capture ${prof.cap}ms, write ${prof.write}ms, encoder flush ${prof.end}ms for ${frames} frames`);
      // a worker given back to the computer closes its browser now, not at the end
      if (wi !== 0 && !stopped) await page.close();
    };
    // the first error stops every worker (at its next part) and is what the render throws
    const running = new Set();
    let failure = null;
    const launch = (page, wi) => {
      const p = runWorker(page, wi).catch((e) => { if (!failure) failure = e; stopped = true; }).finally(() => running.delete(p));
      running.add(p);
    };
    pages.forEach((p, wi) => launch(p, wi));
    // Every second: take this render's share of the computer. More workers when others finished, fewer (between parts)
    // when a render started since; never fewer than one, never more than the parts left.
    let peak = nWorkers, ticking = false, launched = nWorkers, spawning = 0;
    const tick = async () => {
      if (ticking || stopped) return;
      ticking = true;
      try {
        const left = partsLeft();
        want.set(Math.min(wanted, active + left));
        const share = Math.min(fairShare(mbEach), active + left);
        const have = active + spawning;
        if (process.env.GIVEMOTION_PROFILE) log(`  t=${((Date.now() - tFrames) / 1000).toFixed(1)} active=${active} share=${share} left=${left} retire=${retire}`);
        if (have > share) retire = Math.max(0, active - share);
        else if (retire === 0 && have < share && left > spawning + 1) {
          const g = reserve(Math.min(share - have, left - spawning - 1), mbEach);
          if (g.n) {
            spawning += g.n;
            const add = (async () => {
              const opened = await Promise.allSettled(Array.from({ length: g.n }, () => openWorker(ctx, opts)));
              g.release();
              spawning -= g.n;
              for (const r of opened) {
                if (r.status !== 'fulfilled') continue;
                const page = r.value;
                pages.push(page);
                if (setDurations) await page.evaluate(setDurations);
                if (stopped || !partsLeft()) { await page.close(); continue; }
                launch(page, launched++);
              }
              peak = Math.max(peak, active);
            })().catch(() => {}).finally(() => running.delete(add));
            running.add(add);
          }
        }
      } finally { ticking = false; }
    };
    const ticker = shared && useParts ? setInterval(tick, 1000) : null;
    try {
      while (running.size) await Promise.race(running);
    } finally {
      stopped = true;
      if (ticker) clearInterval(ticker);
      // encoding the end needs no browsers: let other renders have them
      if (want) want.set(0);
    }
    if (failure) throw failure;
    nWorkers = Math.max(peak, nWorkers);
    const tLoop = Date.now();
    const pageErrors = pages.flatMap((p) => p.errors);
    await Promise.all(pages.map((p) => p.close()));
    pages.length = 0;
    if (format !== 'png') {
      phase('encode');
      mkdirSync(dirname(out), { recursive: true });
      const segments = parts ? parts.list.map((p) => p.file) : segmentFiles;
      await finalize({ segments, listFile: join(tmp, 'list.txt'), out, format, duration: nFrames / fps, audio: media.audio.map((a) => ({ ...a, start: a.start - f0 / fps, end: a.end - f0 / fps })).filter((a) => a.end > 0).map((a) => (a.start < 0 ? { ...a, from: a.from + -a.start * a.rate, start: 0 } : a)), fps, plan, transparent });
      if (parts && keepParts) {
        writeFileSync(join(parts.dir, 'parts.json'), JSON.stringify({ settings: parts.settings, shared: parts.deps.shared, clips: parts.deps.clips, parts: parts.list.map(({ a, b, fp }) => ({ a, b, fp })) }));
        // parts of an older, longer video
        for (const f of readdirSync(parts.dir)) if (/^part-\d+\./.test(f) && !parts.list.some((p) => basename(p.file) === f)) rmSync(join(parts.dir, f), { force: true });
        partsBytes = parts.list.reduce((n, p) => n + (existsSync(p.file) ? statSync(p.file).size : 0), 0);
        if (!opts.quiet && partsBytes > 5e8) log(`  parts kept: ${(partsBytes / 1e9).toFixed(1)} GB in ${parts.dir} (--no-cache keeps none; delete the folder when it is not needed)`);
      }
    }
    if (process.env.GIVEMOTION_PROFILE) log(`  finalize ${Date.now() - tLoop}ms, total ${Date.now() - t0}ms`);
    const elapsed = (Date.now() - t0) / 1000;
    const summary = {
      output: out, format, width: size.width, height: size.height, fps, frames: nFrames, duration: nFrames / fps,
      seconds: +elapsed.toFixed(2), renderFps: +(nFrames / elapsed).toFixed(1), reusedFrames: reused, workers: nWorkers, capture: ctx.page.mode, encoder: plan ? plan.vargs[plan.vargs.indexOf('-c:v') + 1] : 'png',
      motionBlur: auto ? { mode: 'auto', frames: todoFrames, blurred: blurStats.blurred, elements: blurStats.samples } : { mode: blur.mode, samples: blurSamples },
      parts: keepParts ? { total: parts.list.length, reused: parts.list.filter((p) => p.keep).length, rendered: parts.list.filter((p) => !p.keep).length, folder: parts.dir, bytes: partsBytes, late: parts.deps.clips.reduce((n, c) => n + c.units.length, 0), lateOff: parts.deps.fine } : null,
      bytes: format === 'png' ? null : statSync(out).size,
      warnings: comp.issues.filter((i) => i.severity !== 'error'),
      pageErrors: dedupe(pageErrors),
    };
    if (!opts.quiet && auto && todoFrames) log(`  motion blur: ${blurStats.blurred} of ${todoFrames} frames (${Math.round((blurStats.blurred / todoFrames) * 100)}%) had fast moves, smeared in the same capture (--motion-blur off to skip)`);
    if (!opts.quiet) log(`done in ${elapsed.toFixed(1)}s (${summary.renderFps} fps, ${reused} static frames reused) → ${relativeOut(out)}`);
    phase('done', { output: out, seconds: summary.seconds, frames: nFrames });
    return summary;
  } finally {
    await Promise.all(pages.map((p) => p.close().catch(() => {})));
    await ctx.server.close();
    for (const c of cleanup) { try { c(); } catch {} }
  }
}

/**
 * Auto motion blur. Runs inside the page (it is turned into a string and installed once per page). Seeks to time t for
 * the frame capture that follows, and smears whatever moves fast at t, like a camera shutter open for `dt` seconds:
 * every element that moves on its own (not just carried by a moving parent) gets an SVG blur along its move, as long
 * as the distance it covers in `dt`. The browser draws it in the same capture, so a frame costs one capture as without
 * blur, the smear is continuous (no stepped copies), and what does not move stays as sharp as before (a static title
 * over a moving background, a HUD over a camera pan). The move is measured from the boxes at t - dt/2 and t (two
 * forward seeks, so pages driven by timers work too) and doubled, so the result depends only on t.
 * Not motion: boxes that only moved because text or children changed (typing, counters), elements at opacity 0, ones
 * already softened by a CSS blur at least a quarter of the smear. A zoom (scale change) gets no smear, only the move of
 * the element's centre does. An element is smeared only if it already is a stacking context (a transform, opacity,
 * filter...), so the filter cannot change what draws over what or how it blends; 3D (preserve-3d) is left alone.
 * Returns { dirty, needsReload, blurred }: dirty when the frame can differ from the frame before (also when the
 * previous frame had a smear), blurred = number of elements smeared.
 */
export async function velocityBlur(t, dt, o = {}) {
  const MIN = o.min ?? 3, MAXN = o.maxEls ?? 48;
  const st = window.__gmVB || (window.__gmVB = { els: [], svg: null });
  const had = st.els.length > 0;
  for (const [el, prev, prio] of st.els) { if (prev) el.style.setProperty('filter', prev, prio); else el.style.removeProperty('filter'); }
  st.els = [];
  if (st.svg) st.svg.replaceChildren();
  const seek = async (x) => { let r = gm.seek(x); if (r && r.then) r = await r; return r || {}; };
  // pages drawn by requestAnimationFrame code keep state between calls: an extra seek would change what they draw
  if (!(dt > 0) || t - dt / 2 <= 0 || (gm.__usesRAF && gm.__usesRAF())) { const r = await seek(t); return { dirty: !!r.dirty || had, needsReload: !!r.needsReload, blurred: 0 }; }
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'LINK', 'META', 'TITLE', 'NOSCRIPT', 'BR', 'HEAD', 'DEFS', 'FILTER', 'CLIPPATH', 'MASK', 'LINEARGRADIENT', 'RADIALGRADIENT', 'STOP', 'TSPAN', 'SYMBOL', 'MARKER', 'PATTERN']);
  const W = innerWidth, H = innerHeight;
  const all = document.getElementsByTagName('*');
  // the layout box (no transforms) of the nearest HTML element, in page coordinates
  const layoutOf = (el, memo) => {
    let h = el;
    while (h && !('offsetLeft' in h)) h = h.parentElement;
    if (!h) return null;
    let v = memo.get(h);
    if (v) return v;
    const p = h.offsetParent, pv = p ? layoutOf(p, memo) : null;
    v = [h.offsetLeft + (pv ? pv[0] : 0), h.offsetTop + (pv ? pv[1] : 0), h.offsetWidth, h.offsetHeight];
    memo.set(h, v);
    return v;
  };
  // An SVG group's box is the union of its children's boxes: it grows, shrinks and shifts when one child moves (a bird
  // flying off a street), with no move of its own. So SVG groups and the SVG elements' parents are measured by their
  // transforms (screen CTM), not by their boxes.
  const isGroup = (el) => el instanceof SVGGElement || el instanceof SVGAElement || el instanceof SVGSwitchElement;
  const snap = (lay, ctm) => {
    const m = new Map(), memo = new Map();
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (SKIP.has(el.tagName.toUpperCase()) || el === document.documentElement || el === document.body || el === st.svg) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        m.set(el, r);
        if (lay) lay.set(el, layoutOf(el, memo));
        if (el instanceof SVGSVGElement || isGroup(el)) { const q = /** @type {SVGGraphicsElement} */ (el).getScreenCTM(); if (q) ctm.set(el, DOMMatrix.fromMatrix(q)); }
      }
    }
    return m;
  };
  const r0 = await seek(t - dt / 2);
  const layA = new Map(), layB = new Map(), ctmA = new Map(), ctmB = new Map();
  const A = snap(layA, ctmA);
  const mo = new MutationObserver(() => {});
  mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  let r1, reflow = false;
  try { r1 = await seek(t); } finally { reflow = mo.takeRecords().length > 0; mo.disconnect(); }
  // when text or children changed, boxes whose layout moved are not motion (layout boxes read only then)
  const B = snap(reflow ? layB : null, ctmB);
  const seen = (q) => q.right > 0 && q.bottom > 0 && q.left < W && q.top < H;
  const parentOf = (el) => { for (let p = el.parentElement; p; p = p.parentElement) if (A.has(p) && B.has(p)) return p; return null; };
  // where a transform change (from mA to mB) takes a point, and how much it scales x and y
  const carry = (mA, mB, x, y) => { const q = mB.multiply(mA.inverse()).transformPoint(new DOMPoint(x, y)); return [q.x, q.y]; };
  const scales = (mA, mB) => [Math.hypot(mB.a, mB.b) / Math.hypot(mA.a, mA.b), Math.hypot(mB.c, mB.d) / Math.hypot(mA.c, mA.d)];
  const cand = [];
  for (const [el, b] of B) {
    const a = A.get(el);
    if (!a || (a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height)) continue;
    const ca = [(a.left + a.right) / 2, (a.top + a.bottom) / 2];
    // an SVG group moves only by its transform (its box follows its children, which are judged on their own)
    const gA = isGroup(el) ? ctmA.get(el) : null, gB = gA ? ctmB.get(el) : null;
    // (a filter on a layer whose scale is changing is rastered at a scale Chrome picks by timing: not the same bytes
    // every render, so what grows or shrinks is not smeared)
    if (gA && gB) { const [sx, sy] = scales(gA, gB); if (Math.abs(sx - 1) > 1e-4 || Math.abs(sy - 1) > 1e-4) continue; }
    else if (Math.abs(b.width / a.width - 1) > 1e-4 || Math.abs(b.height / a.height - 1) > 1e-4) continue;
    if (!seen(a) && !seen(b)) continue;
    if (reflow) { const p = layA.get(el), q = layB.get(el); if (!(p === q || (p && q && p[0] === q[0] && p[1] === q[1] && p[2] === q[2] && p[3] === q[3]))) continue; }
    // own move: where the centre went, against where the parent's move+scale would have taken it
    let px = ca[0], py = ca[1], psx = 1, psy = 1;
    const p = parentOf(el);
    const pA = p && ctmA.get(p), pB = p && ctmB.get(p);
    if (pA && pB) {
      [px, py] = carry(pA, pB, ca[0], ca[1]);
      [psx, psy] = scales(pA, pB);
    } else if (p) {
      const pa = A.get(p), pb = B.get(p);
      psx = pb.width / pa.width; psy = pb.height / pa.height;
      px = pb.left + (ca[0] - pa.left) * psx;
      py = pb.top + (ca[1] - pa.top) * psy;
    }
    const [cx, cy] = gA && gB ? carry(gA, gB, ca[0], ca[1]) : [(b.left + b.right) / 2, (b.top + b.bottom) / 2];
    const vx = 2 * (cx - px), vy = 2 * (cy - py);
    const L = Math.hypot(vx, vy);
    // own zoom: how far the farthest visible point of the box moves while the shutter is open
    const ex = Math.max(Math.abs(Math.max(0, b.left) - cx), Math.abs(Math.min(W, b.right) - cx));
    const ey = Math.max(Math.abs(Math.max(0, b.top) - cy), Math.abs(Math.min(H, b.bottom) - cy));
    const [osx, osy] = gA && gB ? scales(gA, gB) : [b.width / a.width, b.height / a.height];
    const zx = 2 * Math.abs(osx / psx - 1) * ex, zy = 2 * Math.abs(osy / psy - 1) * ey, Z = Math.max(zx, zy);
    // a smear costs about in proportion to the area it covers on screen: a big element (a camera world, a whole
    // scene) needs a longer smear (up to 4x) before it is drawn
    const area = (Math.max(0, Math.min(W, b.right) - Math.max(0, b.left)) * Math.max(0, Math.min(H, b.bottom) - Math.max(0, b.top))) / (W * H);
    const min = MIN * (1 + 3 * area);
    // the smear fades in: none at the threshold, its full length at twice the threshold. A move hovering around the
    // threshold (a camera speeding up, a gallop) would otherwise switch a full smear on and off between frames, which
    // reads as the picture shaking
    const ramp = (v, lo) => (v >= 2 * lo ? 1 : v > lo ? 2 * (v - lo) / v : 0);
    const kL = ramp(L, min), kZ = ramp(Z, 4 * min);
    if (kL > 0 || kZ > 0) cand.push({ el, vx: vx * kL, vy: vy * kL, L: L * kL, zx: zx * kZ, zy: zy * kZ, Z: Z * kZ, b, w: Math.max(L * kL, Z * kZ / 2) * Math.sqrt(area) });
  }
  cand.sort((x, y) => y.w - x.w);
  const ns = 'http://www.w3.org/2000/svg';
  const num = (x) => String(Math.round(x * 1000) / 1000);
  const linear = (s) => {
    let m = new DOMMatrix();
    if (s.transform && s.transform !== 'none') { const q = new DOMMatrix(s.transform); m = new DOMMatrix([q.a, q.b, q.c, q.d, 0, 0]); }
    if (s.scale && s.scale !== 'none') { const v = s.scale.split(/\s+/).map(parseFloat); m = new DOMMatrix().scale(v[0], v.length > 1 ? v[1] : v[0]).multiply(m); }
    const rot = s.rotate && /^(?:(?:z|0 0 1)\s+)?(-?[\d.]+)deg$/.exec(s.rotate.trim()); // (a 3D rotate is left out)
    if (rot) m = new DOMMatrix().rotate(parseFloat(rot[1])).multiply(m);
    return m;
  };
  let n = 0;
  for (const c of cand) {
    if (n >= MAXN) break;
    const el = c.el, svgChild = el instanceof SVGElement && !(el instanceof SVGSVGElement);
    const cs = getComputedStyle(el);
    if (cs.transformStyle === 'preserve-3d' || cs.mixBlendMode !== 'normal') continue;
    if (svgChild) { let e = el.parentElement; while (e && !SKIP.has(e.tagName.toUpperCase())) e = e.parentElement; if (e) continue; } // in a clip path, mask, symbol...
    if (!svgChild) {
      const stacking = cs.transform !== 'none' || cs.translate !== 'none' || cs.rotate !== 'none' || cs.scale !== 'none' || cs.filter !== 'none' || parseFloat(cs.opacity) < 1 ||
        (cs.position !== 'static' && cs.zIndex !== 'auto') || cs.position === 'fixed' || cs.position === 'sticky' || cs.isolation === 'isolate' || /transform|opacity|filter/.test(cs.willChange);
      if (!stacking) continue;
    }
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    // the element's own units (its transforms and its parents'), and how soft it already is
    let m = new DOMMatrix(), soft = 0, alpha = 1, ox = c.b.left, oy = c.b.top;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const s = e === el ? cs : getComputedStyle(e);
      alpha *= parseFloat(s.opacity);
      if (s.filter && s.filter !== 'none') for (const g of s.filter.matchAll(/blur\(([\d.]+)px\)/g)) soft += parseFloat(g[1]);
      if (!svgChild && !(e instanceof SVGElement && !(e instanceof SVGSVGElement))) m = linear(s).multiply(m);
    }
    if (svgChild) {
      const q = /** @type {SVGGraphicsElement} */ (el).getScreenCTM && /** @type {SVGGraphicsElement} */ (el).getScreenCTM();
      if (!q) continue;
      m = new DOMMatrix([q.a, q.b, q.c, q.d, 0, 0]); ox = q.e; oy = q.f;
    }
    if (alpha < 0.05 || soft * 4 >= Math.max(c.L, c.Z / 2)) continue;
    const inv = m.inverse();
    const ux = inv.a * c.vx + inv.c * c.vy, uy = inv.b * c.vx + inv.d * c.vy;
    // a zoom (or a box growing along one axis) adds a blur along each axis of about half the smear its edges get (the
    // centre of a zoom stays sharper in a real camera; a filter cannot vary across the element)
    const Lu = Math.hypot(ux, uy), zs = 0.145 * Math.sqrt(Math.abs(inv.a * inv.d - inv.b * inv.c)), zux = zs * c.zx, zuy = zs * c.zy;
    if (!(Lu > 0 || c.Z > 0) || !isFinite(Lu) || !isFinite(zs)) continue;
    if (!st.svg) {
      st.svg = document.createElementNS(ns, 'svg');
      st.svg.setAttribute('aria-hidden', 'true');
      st.svg.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;overflow:hidden;pointer-events:none';
      document.body.appendChild(st.svg);
    }
    const f = document.createElementNS(ns, 'filter');
    const id = 'gm-mblur-' + n;
    f.setAttribute('id', id);
    f.setAttribute('color-interpolation-filters', 'sRGB');
    // a box of length L along the move has the spread of a gaussian with sigma L/sqrt(12). Straight moves (close to
    // horizontal or vertical) get that along their axis. A gaussian can only spread along the element's axes, so a
    // diagonal move first averages 2-8 copies spaced evenly along it (each halving step doubles them), then a gaussian
    // half the spacing wide melts the copies into one even smear (no steps)
    let src = 'SourceGraphic', k = 0.289;
    if (Lu > 0 && Math.min(Math.abs(ux), Math.abs(uy)) > 0.38 * Lu) {
      const lv = Math.max(1, Math.min(3, Math.ceil(Math.log2(c.L / 8))));
      for (let i = 0; i < lv; i++) {
        const d = 1 / 2 ** (i + 2), a1 = document.createElementNS(ns, 'feOffset'), a2 = document.createElementNS(ns, 'feOffset'), mix = document.createElementNS(ns, 'feComposite');
        a1.setAttribute('in', src); a1.setAttribute('dx', num(ux * d)); a1.setAttribute('dy', num(uy * d)); a1.setAttribute('result', 'a' + i);
        a2.setAttribute('in', src); a2.setAttribute('dx', num(-ux * d)); a2.setAttribute('dy', num(-uy * d)); a2.setAttribute('result', 'b' + i);
        mix.setAttribute('in', 'a' + i); mix.setAttribute('in2', 'b' + i); mix.setAttribute('operator', 'arithmetic');
        mix.setAttribute('k2', '0.5'); mix.setAttribute('k3', '0.5'); mix.setAttribute('result', 'c' + i);
        f.append(a1, a2, mix);
        src = 'c' + i;
      }
      k = 0.71 / 2 ** lv; // sigma along the move = half the spacing of the copies (L / 2^lv)
    }
    const g = document.createElementNS(ns, 'feGaussianBlur');
    g.setAttribute('in', src);
    const sx = Math.hypot(k * ux, zux), sy = Math.hypot(k * uy, zuy);
    g.setAttribute('stdDeviation', `${num(sx)} ${num(sy)}`);
    f.append(g);
    // region: what shows (the viewport, in the element's units) plus the reach of the smear: content just outside the
    // viewport smears into it. Drawing the filter costs in proportion to this area, so it is kept tight (a camera world
    // can be much bigger than the screen). Rotated or flipped elements get a viewport of margin instead.
    f.setAttribute('filterUnits', 'userSpaceOnUse');
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [qx, qy] of [[0, 0], [W, 0], [0, H], [W, H]]) {
      const lx = inv.a * (qx - ox) + inv.c * (qy - oy), ly = inv.b * (qx - ox) + inv.d * (qy - oy);
      x0 = Math.min(x0, lx); y0 = Math.min(y0, ly); x1 = Math.max(x1, lx); y1 = Math.max(y1, ly);
    }
    const loose = !svgChild && (Math.abs(m.b) + Math.abs(m.c) > 1e-6 || m.a < 0 || m.d < 0);
    const mx = (loose ? x1 - x0 : 0) + Math.abs(ux) / 2 + 3 * sx + 2, my = (loose ? y1 - y0 : 0) + Math.abs(uy) / 2 + 3 * sy + 2;
    f.setAttribute('x', num(x0 - mx)); f.setAttribute('y', num(y0 - my)); f.setAttribute('width', num(x1 - x0 + 2 * mx)); f.setAttribute('height', num(y1 - y0 + 2 * my));
    st.svg.appendChild(f);
    const prev = el.style.getPropertyValue('filter'), prio = el.style.getPropertyPriority('filter');
    // !important: above the page's own filter animations, which are kept (the smear is added after them)
    el.style.setProperty('filter', (cs.filter !== 'none' ? cs.filter + ' ' : '') + `url(#${id})`, 'important');
    st.els.push([el, prev, prio]);
    n++;
  }
  return { dirty: !!(r0.dirty || r1.dirty) || had || n > 0, needsReload: !!(r0.needsReload || r1.needsReload), blurred: n };
}

const hashOf = (s) => createHash('sha1').update(s).digest('hex').slice(0, 20);
function readJson(f) { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } }
let engineFp = null;
/** Fingerprint of the engine's own code: a new version redoes every part. */
function engineHash() {
  if (engineFp) return engineFp;
  const h = createHash('sha1');
  const walk = (d) => { for (const e of readdirSync(d).sort()) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else if (/\.(js|css)$/.test(e)) h.update(e).update(readFileSync(p)); } };
  walk(dirname(fileURLToPath(import.meta.url)));
  return (engineFp = h.digest('hex').slice(0, 20));
}

/**
 * Split the work between workers. Whole parts (useParts) are grouped into runs of neighbours with about the same number
 * of frames; a single range (--frames, png) is cut into one chunk per worker, as before.
 */
function splitRanges(ranges, workers, useParts, tmp, plan) {
  const total = ranges.reduce((s, r) => s + r.b - r.a, 0);
  if (!total) return [];
  if (!useParts) {
    const { a: f0, b: f1, file } = ranges[0];
    const per = Math.ceil(total / workers), out = [];
    for (let i = 0; i < workers; i++) {
      const a = f0 + i * per, b = Math.min(f1, a + per);
      if (a < b) out.push([{ a, b, file: file ? join(tmp, `seg${String(i).padStart(3, '0')}.${plan.segExt}`) : null }]);
    }
    return out;
  }
  const groups = [];
  let cur = [], n = 0, left = total, wLeft = workers;
  for (const r of ranges) {
    cur.push(r); n += r.b - r.a;
    if (wLeft > 1 && n >= left / wLeft - 1e-9) { groups.push(cur); left -= n; wLeft--; cur = []; n = 0; }
  }
  if (cur.length) groups.push(cur);
  return groups;
}

/**
 * What each part of the video depends on: a shared print (the page around the scenes, every script, style and loaded
 * file) and one print per top-level clip, with the clip's late elements (src/parts.js) and the time each can first show.
 */
async function dependencyPrints(ctx) {
  const r = await ctx.page.evaluate(`(${pagePrints.toString()})()`);
  // files the page loaded (stylesheets, scripts, images, fonts, data, video frames, audio), by content
  const files = new Set();
  const origin = new URL(ctx.url).origin;
  for (const u of [...r.resources, ...(ctx.info.media || []).map((m) => new URL(m.src, ctx.url).href)]) {
    let url;
    try { url = new URL(u); } catch { continue; }
    if (url.origin !== origin) { files.add('remote:' + u); continue; }
    let p = decodeURIComponent(url.pathname);
    if (p.startsWith('/__gm/')) { const s2 = url.searchParams.get('src'); if (!s2) continue; p = decodeURIComponent(new URL(s2, url).pathname); }
    files.add(p);
  }
  const fileHash = [...files].sort().map((p) => {
    if (p.startsWith('remote:')) return p;
    const f = safeJoin(ctx.root, p);
    if (!f) return p + ':outside';
    try { const st = statSync(f); return p + ':' + (st.size > 64 * 1024 * 1024 ? st.size + '-' + st.mtimeMs : hashOf(readFileSync(f))); } catch { return p + ':missing'; }
  });
  const units = (c) => c.units.map((u) => ({ fp: hashOf(u.print), t: +u.t.toFixed(6), end: u.end == null ? null : +u.end.toFixed(6), name: u.name }));
  return { shared: hashOf(r.shared + '\n' + fileHash.join('\n')), clips: r.clips.map((c) => ({ fp: hashOf(c.print), start: +c.start.toFixed(6), end: +c.end.toFixed(6), name: c.name, units: units(c) })), fine: r.fine };
}

/** Only the soundtrack: `render comp.html -o sound.mp3` (also .wav .m4a .ogg .flac) */
async function renderAudioOnly(input, out, fmt, opts, log, t0) {
  requireFfmpeg();
  const ctx = await openComposition(input, { ...opts, mode: 'render', log });
  try {
    const media = await prepareMedia(ctx, ctx.page);
    if (!media.audio.length) throw new Error('This composition has no audio to export.');
    mkdirSync(dirname(out), { recursive: true });
    await mixAudio({ audio: media.audio, out, format: fmt, duration: ctx.info.duration });
    const elapsed = (Date.now() - t0) / 1000;
    if (!opts.quiet) log(`done in ${elapsed.toFixed(1)}s → ${relativeOut(out)}`);
    return { output: out, format: fmt, duration: ctx.info.duration, seconds: +elapsed.toFixed(2), bytes: statSync(out).size, warnings: ctx.info.issues.filter((i) => i.severity !== 'error'), pageErrors: [] };
  } finally {
    await ctx.page.close();
    await ctx.server.close();
  }
}

function dedupe(errs) {
  const seen = new Set();
  return errs.filter((e) => { const k = e.code + e.message; if (seen.has(k)) return false; seen.add(k); return true; });
}
function relativeOut(p) {
  const r = relative(process.cwd(), p);
  return r && !r.startsWith('..') && !isAbsolute(r) ? r : p;
}

/** Render single frames to image files. times: seconds[] */
/**
 * @param {Input} input
 * @param {number[]} times
 * @param {import('./types/api.js').StillOptions} [opts]
 */
export async function stills(input, times, opts = {}) {
  const ctx = await openComposition(input, { ...opts, mode: 'render' });
  try {
    const out = [];
    for (const t of times) {
      await ctx.page.seek(Math.min(t, Math.max(0, ctx.info.duration - 1 / ctx.info.fps)));
      out.push(await ctx.page.capture(opts.format || 'png', 95));
    }
    return { buffers: out, info: ctx.info, errors: ctx.page.errors };
  } finally {
    await ctx.page.close();
    await ctx.server.close();
  }
}
