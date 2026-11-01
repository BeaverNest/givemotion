// One budget for the whole computer. Every givemotion process (several projects rendering at once, a studio, a check)
// keeps a small file saying how many browsers it has open, and a render sizes its workers from what the others left.
// Without it each render sized itself as if it had the computer to itself: two renders opened 24 browsers and their
// encoders on 12 cores and 24 GB, and the computer froze. Also: cleanup that still runs when the process is stopped.
import { mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, cpus, totalmem, freemem, platform } from 'node:os';
import { spawnSync } from 'node:child_process';

export const CACHE_DIR = process.env.GIVEMOTION_CACHE || join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'givemotion');
const RUN_DIR = () => join(CACHE_DIR, 'run');
// a process rewrites its file every BEAT_MS while it has browsers open; a file older than STALE_MS is from a process
// that died without removing it (or a pid reused by another program)
const BEAT_MS = 30000, STALE_MS = 90000;

/**
 * Memory one browser worker needs with its encoder, in MB: ~700 MB at 1080p (measured: ~460 MB of Chrome processes and
 * ~150 MB of x264), more at 4K, where tiles and layers grow with the frame.
 */
export function browserMB(pixels = 1920 * 1080) {
  return Math.round(450 + 250 * Math.max(1, pixels / (1920 * 1080)));
}

let fast = 0;
/**
 * Cores that make a worker faster. On Apple Silicon only the performance cores do: on a 12-core M4 Pro (8 performance,
 * 4 efficiency) 8 workers rendered a 1080p video in 9.7 s and 12 workers in 10.3 s, with 5.7 GB of memory instead of 8.2.
 */
function fastCores() {
  if (fast) return fast;
  fast = cpus().length || 2;
  if (platform() === 'darwin') {
    for (const key of ['hw.perflevel0.physicalcpu', 'hw.physicalcpu']) {
      const r = spawnSync('sysctl', ['-n', key], { encoding: 'utf8', timeout: 2000 });
      const n = parseInt(r.stdout, 10);
      if (n > 0) { fast = Math.min(fast, n); break; }
    }
  }
  return fast;
}

/** Memory the system can give now, in MB. macOS counts only never-used pages as free, so ask it for its own estimate. */
function availableMB() {
  if (platform() === 'darwin') {
    const r = spawnSync('sysctl', ['-n', 'kern.memorystatus_level'], { encoding: 'utf8', timeout: 2000 });
    const pct = parseInt(r.stdout, 10);
    if (pct > 0 && pct <= 100) return (totalmem() / 2 ** 20) * (pct / 100);
  }
  return freemem() / 2 ** 20;
}

/**
 * What all givemotion processes on this computer may use together: browsers up to the cores that help, memory up to
 * half of it (the rest is for the system and the apps the person has open).
 */
export function machineLimits() {
  const total = totalmem() / 2 ** 20;
  const max = parseInt(process.env.GIVEMOTION_MAX_BROWSERS || '', 10);
  return { browsers: max > 0 ? max : Math.min(16, fastCores()), memMB: Math.floor(total * 0.5), reserveMB: Math.min(2048, total * 0.1) };
}

// this process: browsers open (and their memory, granted ones included until they open), the workers its renders would
// use (wants) and a request being decided (claim)
const me = { browsers: 0, mb: 0, wants: 0, claim: /** @type {{ n: number, mb: number, t: number } | null} */ (null) };
let beat = null, exitHooked = false;
const myFile = () => join(RUN_DIR(), `${process.pid}.json`);

function publish() {
  const busy = me.browsers > 0 || me.wants > 0 || me.claim;
  try {
    if (!busy) rmSync(myFile(), { force: true });
    else {
      mkdirSync(RUN_DIR(), { recursive: true });
      const tmp = myFile() + '.tmp';
      writeFileSync(tmp, JSON.stringify({ pid: process.pid, browsers: me.browsers, mb: me.mb, wants: me.wants, claim: me.claim }));
      renameSync(tmp, myFile());
    }
  } catch {}
  if (busy && !beat) { beat = setInterval(publish, BEAT_MS); beat.unref(); }
  if (!busy && beat) { clearInterval(beat); beat = null; }
  if (busy && !exitHooked) { exitHooked = true; atExit(() => { try { rmSync(myFile(), { force: true }); } catch {} }); }
}

/** The other live givemotion processes' files. */
function others() {
  const out = [];
  let names = [];
  try { names = readdirSync(RUN_DIR()); } catch { return out; }
  const now = Date.now();
  for (const name of names) {
    const m = /^(\d+)\.json$/.exec(name);
    if (!m || +m[1] === process.pid) continue;
    const file = join(RUN_DIR(), name);
    let alive = true;
    try { process.kill(+m[1], 0); } catch (e) { alive = /** @type {any} */ (e).code === 'EPERM'; }
    let st = null;
    try { st = statSync(file); } catch { continue; }
    if (!alive || now - st.mtimeMs > STALE_MS) { try { rmSync(file, { force: true }); } catch {} continue; }
    try { out.push(JSON.parse(readFileSync(file, 'utf8'))); } catch {}
  }
  return out;
}

/** Count `n` open browsers using `mb` MB in this process. Returns the function that gives them back (once). */
export function hold(n, mb) {
  me.browsers += n; me.mb += mb;
  publish();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    me.browsers -= n; me.mb -= mb;
    publish();
  };
}

/**
 * Up to `want` more browsers of `mbEach` MB for a render, from what the computer has left: other givemotion processes'
 * browsers and the memory free now count against it. The grant is held until `release()` (call it once the workers have
 * opened: they count themselves then). Two renders that start at the same moment do not both take everything: each first
 * writes what it wants, then takes what is left after the ones that asked before it and the ones already granted.
 * @returns {{ n: number, others: number, release: () => void, limitedBy: string | null }} (`others`: browsers other
 *   givemotion processes have open or asked for first)
 */
export function reserve(want, mbEach) {
  if (want <= 0) return { n: 0, others: 0, release: () => {}, limitedBy: null };
  const lim = machineLimits();
  const claim = { n: want, mb: want * mbEach, t: Date.now() };
  me.claim = claim;
  publish();
  let othersB = 0, othersMB = 0;
  for (const o of others()) {
    const before = o.claim && (o.claim.t < claim.t || (o.claim.t === claim.t && o.pid < process.pid));
    othersB += (o.browsers || 0) + (before ? o.claim.n : 0);
    othersMB += (o.mb || 0) + (before ? o.claim.mb : 0);
  }
  const byCpu = lim.browsers - me.browsers - othersB;
  const byMem = Math.floor((lim.memMB - me.mb - othersMB) / mbEach);
  const byFree = Math.floor((availableMB() - lim.reserveMB) / mbEach);
  const n = Math.max(0, Math.min(want, byCpu, byMem, byFree));
  const limitedBy = n >= want ? null : byFree <= Math.min(byCpu, byMem) ? 'free memory' : othersB ? 'other givemotion processes' : null;
  // the grant counts as open browsers until the workers have opened (they then count themselves)
  me.claim = null;
  const release = n ? hold(n, n * mbEach) : (publish(), () => {});
  return { n, others: othersB, release, limitedBy };
}

/**
 * Say how many workers a render would use now (it changes as the render goes: no more than the parts it has left).
 * Renders share the computer by these: see fairShare. Returns { set(n), drop() }.
 */
export function demand(n) {
  let cur = 0;
  const set = (k) => { k = Math.max(0, Math.round(k)); if (k === cur) return; me.wants += k - cur; cur = k; publish(); };
  set(n);
  return { set, drop: () => set(0) };
}

/**
 * The workers this process's renders should have now: the computer's browsers (and memory, in workers of `mbEach` MB)
 * shared between every givemotion process that wants some. One that wants fewer than an even share gets what it wants
 * and the rest is split between the others; every process computes the same split from the same files. A process that
 * says nothing of what it wants (a check, a still) keeps the browsers it has.
 */
export function fairShare(mbEach) {
  const lim = machineLimits();
  const total = Math.max(1, Math.min(lim.browsers, Math.floor(lim.memMB / mbEach)));
  const asks = others().map((o) => ({ pid: o.pid, d: o.wants > 0 ? o.wants : o.browsers || 0 })).filter((x) => x.d > 0);
  asks.push({ pid: process.pid, d: me.wants });
  return Math.max(1, split(total, asks).get(process.pid) || 0);
}

/** Water-filling: smallest asks first, each gets at most an even share of what is left; leftovers go by pid. */
export function split(total, asks) {
  const order = [...asks].sort((x, y) => x.d - y.d || x.pid - y.pid);
  const got = new Map();
  let left = total, k = order.length;
  for (const x of order) { const g = Math.min(x.d, Math.floor(left / k)); got.set(x.pid, g); left -= g; k--; }
  for (const x of [...asks].sort((p, q) => p.pid - q.pid)) if (left > 0 && got.get(x.pid) < x.d) { got.set(x.pid, got.get(x.pid) + 1); left--; }
  return got;
}

/** Browsers other givemotion processes have open (and how many processes). */
export function othersUsage() {
  let browsers = 0, procs = 0;
  for (const o of others()) { if (o.browsers > 0) { browsers += o.browsers; procs++; } }
  return { browsers, procs };
}

const exitFns = new Set();
let exitInstalled = false, signalsHooked = false;
/**
 * Run `fn` when the process exits, even by process.exit() or (with handleSignals) Ctrl+C: Chrome runs in its own process
 * group, so a stopped render would otherwise leave its browsers, encoders and temporary folders behind. Returns a
 * function that unregisters it (call it after cleaning up the normal way).
 */
export function atExit(fn) {
  if (!exitInstalled) {
    exitInstalled = true;
    process.on('exit', () => { for (const f of [...exitFns]) { try { f(); } catch {} } });
  }
  exitFns.add(fn);
  return () => exitFns.delete(fn);
}

/** For the CLI: Ctrl+C, a closed terminal or a kill ends the process through exit(), so the atExit cleanup runs. */
export function handleSignals() {
  if (signalsHooked) return;
  signalsHooked = true;
  for (const [sig, code] of /** @type {[NodeJS.Signals, number][]} */ ([['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]])) process.on(sig, () => process.exit(code));
}
