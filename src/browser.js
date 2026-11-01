// Finding, installing and launching Chrome, plus a Page that renders frames.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, statSync, chmodSync, createWriteStream, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir, platform, arch, tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { launchChrome } from './cdp.js';
import { CACHE_DIR, hold, browserMB } from './machine.js';

export { CACHE_DIR };
const CFT_JSON = 'https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json';

function cftPlatform() {
  const p = platform(), a = arch();
  if (p === 'linux') return 'linux64';
  if (p === 'darwin') return a === 'arm64' ? 'mac-arm64' : 'mac-x64';
  if (p === 'win32') return a === 'ia32' ? 'win32' : 'win64';
  return null;
}
function shellBinaryName() { return platform() === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell'; }

function findInDir(dir, name, depth = 4) {
  if (depth < 0 || !existsSync(dir)) return null;
  let entries;
  try { entries = readdirSync(dir); } catch { return null; }
  for (const e of entries) {
    const p = join(dir, e);
    if (e === name) { try { if (statSync(p).isFile()) return p; } catch {} }
  }
  for (const e of entries.sort().reverse()) {
    const p = join(dir, e);
    try { if (statSync(p).isDirectory()) { const r = findInDir(p, name, depth - 1); if (r) return r; } } catch {}
  }
  return null;
}

/** Returns { path, kind: 'shell' | 'chrome' } or null. */
export function findChrome(explicit) {
  const env = explicit || process.env.GIVEMOTION_CHROME || process.env.CHROME_PATH;
  if (env) return { path: env, kind: /headless[-_]shell/i.test(env) || process.env.GIVEMOTION_CHROME_KIND === 'shell' ? 'shell' : (process.env.GIVEMOTION_CHROME_KIND || 'chrome') };
  const own = findInDir(join(CACHE_DIR, 'chrome-headless-shell'), shellBinaryName());
  if (own) return { path: own, kind: 'shell' };
  const pup = findInDir(join(homedir(), '.cache', 'puppeteer', 'chrome-headless-shell'), shellBinaryName(), 5);
  if (pup) return { path: pup, kind: 'shell' };
  // Playwright's browser cache (chromium_headless_shell-NNNN)
  const pwDirs = [process.env.PLAYWRIGHT_BROWSERS_PATH, join(homedir(), '.cache', 'ms-playwright'), join(homedir(), 'Library', 'Caches', 'ms-playwright'), process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'ms-playwright')].filter((d) => d && d !== '0');
  for (const d of pwDirs) {
    let entries = [];
    try { entries = readdirSync(d).filter((e) => e.startsWith('chromium_headless_shell-')).sort().reverse(); } catch {}
    for (const e of entries) { const p = findInDir(join(d, e), shellBinaryName(), 3); if (p) return { path: p, kind: 'shell' }; }
  }
  const candidates = {
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary'],
    linux: ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'],
    win32: [join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'), join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'), join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')],
  }[platform()] || [];
  for (const c of candidates) if (c && existsSync(c)) return { path: c, kind: 'chrome' };
  return null;
}

/** Download chrome-headless-shell (Chrome for Testing, stable) into the cache. */
export async function installChrome({ log = console.error } = {}) {
  const plat = cftPlatform();
  if (!plat) throw new Error(`No Chrome build for ${platform()}/${arch()}. Set GIVEMOTION_CHROME to a Chrome or Chromium binary.`);
  log(`Downloading chrome-headless-shell for ${plat}…`);
  const res = await fetch(CFT_JSON);
  if (!res.ok) throw new Error(`Could not reach ${CFT_JSON} (${res.status}).`);
  const json = await res.json();
  const stable = json.channels.Stable;
  const dl = (stable.downloads['chrome-headless-shell'] || []).find((d) => d.platform === plat);
  if (!dl) throw new Error(`No chrome-headless-shell download for ${plat}.`);
  const dir = join(CACHE_DIR, 'chrome-headless-shell', `${plat}-${stable.version}`);
  mkdirSync(dir, { recursive: true });
  // A fresh private folder: a fixed name in a shared /tmp could be planted by another user.
  const tmp = mkdtempSync(join(tmpdir(), 'gm-chrome-'));
  const zip = join(tmp, 'chrome.zip');
  const r = await fetch(dl.url);
  if (!r.ok) throw new Error(`Download failed (${r.status}): ${dl.url}`);
  await pipeline(Readable.fromWeb(/** @type {any} */ (r.body)), createWriteStream(zip));
  log(`Extracting Chrome ${stable.version}…`);
  if (platform() === 'win32') execFileSync('tar', ['-xf', zip, '-C', dir]);
  else execFileSync('unzip', ['-q', '-o', zip, '-d', dir]);
  rmSync(tmp, { recursive: true, force: true });
  const bin = findInDir(dir, shellBinaryName());
  if (!bin) throw new Error('Extracted Chrome but could not find the binary.');
  if (platform() !== 'win32') chmodSync(bin, 0o755);
  log(`Chrome ready: ${bin}`);
  return { path: bin, kind: 'shell', version: stable.version };
}

export async function ensureChrome(opts = {}) {
  const found = findChrome(opts.chrome);
  if (found) return found;
  if (opts.install === false) throw new Error('Chrome not found. Run `npx givemotion install` or set GIVEMOTION_CHROME.');
  return installChrome(opts);
}

function hasGPU() {
  if (platform() !== 'linux') return true;
  return existsSync('/dev/dri') && !process.env.GIVEMOTION_NO_GPU;
}

/**
 * Tile memory for the page, in MB. Chrome rasters every composited layer into tiles and stops at a memory limit
 * (512 MB-1 GB on desktop, sized for a browser tab). Past it, the tiles left over are simply not drawn: the frame shows
 * blank rectangles, or whatever was under them, or a layer's old content (text of a page that a document covers,
 * the top of a card at its old size). Large composited layers at 4K (crossfading full-frame sections, filter or
 * opacity animations, big overflow boxes) pass that easily. The limit is a ceiling, not an allocation: a page that
 * needs less uses less, and the speed is the same. Chrome reads it once per process, so it covers the largest frame
 * this process may draw: 4K, more for --scale above 2.
 */
export function tileMemoryMB(scale = 1) {
  return 4096 * Math.max(1, Math.ceil((scale * scale) / 4));
}

export function chromeArgs({ kind, beginFrame, gl = 'auto', scale = 1 }) {
  const args = [
    kind === 'shell' ? '--headless=old' : '--headless=new',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-component-extensions-with-background-pages',
    '--disable-background-networking', '--disable-sync', '--disable-translate', '--disable-default-apps', '--disable-breakpad',
    '--disable-client-side-phishing-detection', '--disable-component-update', '--disable-domain-reliability', '--disable-hang-monitor',
    '--disable-ipc-flooding-protection', '--disable-popup-blocking', '--disable-prompt-on-repost', '--metrics-recording-only',
    '--mute-audio', '--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', '--font-render-hinting=none', '--force-color-profile=srgb', '--disable-lcd-text',
    '--autoplay-policy=no-user-gesture-required', '--disable-dev-shm-usage', '--password-store=basic', '--use-mock-keychain',
    '--disable-features=Translate,MediaRouter,OptimizationHints,PaintHolding,BackForwardCache,DialMediaRouteProvider,CalculateNativeWinOcclusion,InterestFeedContentSuggestions',
    '--enable-features=SharedArrayBuffer',
    // Partial raster redraws only the changed part of a tile, on top of pixels from whenever that tile was last drawn:
    // the result then depends on the frame history (1 worker != N workers by a pixel or two). Costs no measurable speed.
    '--disable-partial-raster',
    // Checker imaging draws a frame without an image that is not decoded yet and adds it in a later frame: which frame
    // a capture gets would depend on timing.
    '--disable-checker-imaging',
    // Enough tile memory that no tile of a frame is left undrawn (see tileMemoryMB).
    `--force-gpu-mem-available-mb=${tileMemoryMB(scale)}`,
  ];
  if (platform() === 'linux' && (process.getuid && process.getuid() === 0 || process.env.GIVEMOTION_NO_SANDBOX)) args.push('--no-sandbox');
  const mode = gl === 'auto' ? (hasGPU() ? 'gpu' : 'swiftshader') : gl;
  // No real GPU: WebGL still runs on SwiftShader, but page compositing stays in Chrome's software
  // path, which is 1.5-4x faster than compositing through an emulated GPU.
  if (mode === 'swiftshader') args.push('--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-compositing');
  else if (mode === 'none') args.push('--disable-gpu');
  else args.push('--ignore-gpu-blocklist', '--enable-gpu-rasterization');
  if (process.env.GIVEMOTION_CHROME_ARGS) args.push(...process.env.GIVEMOTION_CHROME_ARGS.split(/\s+/).filter(Boolean));
  if (beginFrame) {
    args.push('--deterministic-mode', '--enable-begin-frame-control', '--disable-threaded-animation', '--disable-threaded-scrolling',
      '--disable-new-content-rendering-timeout', '--run-all-compositor-stages-before-draw', '--disable-image-animation-resync');
  }
  return args;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * A browser + one page, driving the givemotion runtime.
 */
export class FramePage {
  constructor(opts) {
    this.opts = opts; // { chrome:{path,kind}, width, height, scale, capture:'auto'|'beginframe'|'screenshot', gl, transparent, timeoutMs }
    this.errors = [];
    this.ticks = 1000;
    this.interval = 1000 / 30;
  }
  async start() {
    const { chrome } = this.opts;
    let want = this.opts.capture || 'auto';
    if (want === 'auto') want = chrome.kind === 'shell' && platform() !== 'darwin' ? 'beginframe' : 'screenshot';
    try {
      await this._launch(want);
    } catch (e) {
      if (want !== 'beginframe' || this.opts.capture === 'beginframe') throw e;
      await this.close();
      await this._launch('screenshot');
    }
  }
  async _launch(mode) {
    const { chrome, width, height } = this.opts;
    this.mode = mode;
    this.browser = launchChrome(chrome.path, [...chromeArgs({ kind: chrome.kind, beginFrame: mode === 'beginframe', gl: this.opts.gl, scale: this.opts.scale || 1 }), `--window-size=${width},${height}`, ...((this.opts.scale || 1) !== 1 ? [`--force-device-scale-factor=${this.opts.scale}`] : []), 'about:blank']);
    const b = this.browser;
    // count it in the computer's budget, so renders started next leave room for it (see machine.js)
    this._release = hold(1, browserMB(width * height * (this.opts.scale || 1) ** 2));
    const { targetId } = await b.send('Target.createTarget', { url: 'about:blank', width, height, ...(mode === 'beginframe' ? { enableBeginFrameControl: true } : {}) });
    const { sessionId } = await b.send('Target.attachToTarget', { targetId, flatten: true });
    this.sessionId = sessionId;
    const s = (m, p) => b.send(m, p, sessionId);
    this.s = s;
    b.on('Runtime.exceptionThrown', (p) => {
      const d = p.exceptionDetails;
      const e = this._err('script-error', ((d.exception && d.exception.description) || d.text).split('\n')[0]);
      // Say where: line number in the page, plus the text of that line.
      const url = d.url || (d.stackTrace && d.stackTrace.callFrames[0] && d.stackTrace.callFrames[0].url);
      const line = d.lineNumber != null && d.url ? d.lineNumber : d.stackTrace && d.stackTrace.callFrames[0] ? d.stackTrace.callFrames[0].lineNumber : d.lineNumber;
      if (e && url && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url) && line != null) {
        const file = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
        const base = e.message;
        e.message = base + ` (${file} line ${line + 1})`;
        if (typeof fetch === 'function') fetch(url).then((r) => r.text()).then((txt) => {
          const lines = txt.split('\n');
          let n = line;
          // "Identifier 'top' has already been declared": point at the declaration, not the <script> tag
          const id = /Identifier '([\w$]+)' has already been declared/.exec(base);
          if (id) {
            const re = new RegExp('\\b(let|const|class|function)\\s+' + id[1].replace(/\$/g, '\\$') + '\\b');
            for (let i = line; i < lines.length; i++) if (re.test(lines[i])) { n = i; break; }
            e.message = base + ` (${file} line ${n + 1})`;
          }
          const l = lines[n]; if (l && l.trim()) e.message += `: ${l.trim().slice(0, 140)}`;
          // The served page has <gm-include> files expanded, so its line numbers can be ahead of the file you wrote:
          // find the same line in the file itself.
          if (l && l.trim() && /\.html?$/i.test(file)) {
            const k = lines.slice(0, n).filter((x) => x.trim() === l.trim()).length;
            fetch(url.split('?')[0] + '?source=1').then((r) => (r.ok ? r.text() : null)).then((src) => {
              if (!src) return;
              const hits = []; src.split('\n').forEach((x, i) => { if (x.trim() === l.trim()) hits.push(i); });
              const at = hits[Math.min(k, hits.length - 1)];
              e.message = e.message.replace(` (${file} line ${n + 1})`, at != null ? ` (${file} line ${at + 1})` : ` (in a file included into ${file})`);
            }).catch(() => {});
          }
          if (id && /^(top|name|status|parent|self|length|origin|history|location|frames|event|screen|close|open|print|stop|find|focus|blur)$/.test(id[1])) e.message += ` ("${id[1]}" is a built-in browser name: rename the variable, or wrap your script in { … })`;
        }).catch(() => {});
      }
    }, sessionId);
    b.on('Runtime.consoleAPICalled', (p) => {
      if (p.type === 'error' || p.type === 'warning' || (this.opts.verbose && p.type === 'log')) {
        const text = p.args.map((a) => a.value ?? a.description ?? '').join(' ');
        if (this.opts.onConsole) this.opts.onConsole(p.type, text);
        if (p.type === 'error') this._err('console-error', text);
      }
    }, sessionId);
    b.on('Network.responseReceived', (p) => { if (p.response.status >= 400 && !/favicon\.ico/.test(p.response.url)) this._err('http-' + p.response.status, `${p.response.status} for ${p.response.url}`); }, sessionId);
    const urls = new Map();
    b.on('Network.requestWillBeSent', (p) => { if (urls.size > 5000) urls.clear(); urls.set(p.requestId, p.request.url); }, sessionId);
    b.on('Network.loadingFailed', (p) => { if (!p.canceled) this._err('load-failed', `${p.errorText} loading ${urls.get(p.requestId) || p.requestId}. If it is on the internet, download it next to your HTML file instead.`); }, sessionId);
    await Promise.all([s('Page.enable'), s('Runtime.enable'), s('Network.enable')]);
    await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: this.opts.scale || 1, mobile: false });
    // The same page gives the same frames on every computer: the time zone (a clock or new Date()), the language
    // (toLocaleString, Intl) and the media features a page can read (reduced motion, dark mode) do not follow
    // the machine it renders on.
    await Promise.all([
      s('Emulation.setTimezoneOverride', { timezoneId: 'UTC' }),
      s('Emulation.setLocaleOverride', { locale: 'en-US' }),
      s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }, { name: 'prefers-color-scheme', value: 'light' }] }),
    ].map((p) => p.catch(() => {})));
    if (this.opts.transparent) await s('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    if (mode === 'beginframe') {
      // Prime the compositor; fails fast on platforms without BeginFrameControl.
      await Promise.race([this._beginFrame(false), sleep(4000).then(() => { throw new Error('beginFrame did not respond'); })]);
    }
  }
  _err(code, message) {
    if (this.errors.length >= 200) return null;
    const e = { code, message: String(message).slice(0, 500) };
    this.errors.push(e);
    return e;
  }
  async _beginFrame(screenshot, format = 'jpeg', quality = 92) {
    this.ticks += this.interval;
    const params = { frameTimeTicks: this.ticks, interval: this.interval };
    if (screenshot) params.screenshot = { format, ...(format === 'jpeg' ? { quality } : {}) };
    else params.noDisplayUpdates = true;
    return this.s('HeadlessExperimental.beginFrame', params);
  }
  /** Evaluate and await a promise; keeps the compositor ticking in beginFrame mode so loads can finish. */
  async evaluate(expression, { timeoutMs = this.opts.timeoutMs || 60000 } = {}) {
    const p = this.s('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    let done = false, error;
    /** @type {any} */ let result;
    p.then((r) => { done = true; result = r; }, (e) => { done = true; error = e; });
    const t0 = Date.now();
    // fast path
    await new Promise((r) => setImmediate(r));
    while (!done) {
      if (Date.now() - t0 > timeoutMs) throw new Error(`Timed out after ${timeoutMs}ms evaluating: ${expression.slice(0, 80)}`);
      if (this.mode === 'beginframe') { try { await this._beginFrame(false); } catch {} await sleep(2); }
      else await sleep(5);
    }
    if (error) throw error;
    if (result.exceptionDetails) {
      const d = result.exceptionDetails;
      throw new Error((d.exception && d.exception.description) || d.text);
    }
    return result.result.value;
  }
  async open(url, config) {
    const s = this.s;
    this.interval = 1000 / (config.fps || 30);
    await s('Page.addScriptToEvaluateOnNewDocument', { source: `window.__GM_CONFIG = ${JSON.stringify(config)};` });
    const loaded = this.browser.once('Page.loadEventFired', this.sessionId, this.opts.timeoutMs || 60000);
    const nav = await s('Page.navigate', { url });
    if (nav.errorText) throw new Error(`Could not open ${url}: ${nav.errorText}`);
    if (this.mode === 'beginframe') {
      let done = false;
      loaded.then(() => (done = true), () => (done = true));
      const t0 = Date.now();
      while (!done) {
        await this._beginFrame(false);
        await sleep(2);
        if (Date.now() - t0 > (this.opts.timeoutMs || 60000)) throw new Error('Timed out loading page');
      }
    } else await loaded;
    const hasRuntime = await this.evaluate('!!(window.gm && window.gm.__runtime)');
    if (!hasRuntime) throw new Error('The givemotion runtime did not load in the page.');
    return this.evaluate('gm.ready()');
  }
  async setViewport(width, height) {
    await this.s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: this.opts.scale || 1, mobile: false });
  }
  /** Seek to time t (seconds). Returns {dirty, needsReload}. */
  async seek(t) {
    return this.evaluate(`gm.seek(${t})`);
  }
  /** Capture the current frame. format: 'jpeg' | 'png' */
  async capture(format = 'jpeg', quality = 92) {
    if (this.mode === 'beginframe') {
      for (let i = 0; i < 3; i++) {
        const r = await this._beginFrame(true, format, quality);
        if (r.screenshotData) return Buffer.from(r.screenshotData, 'base64');
      }
      throw new Error('Chrome returned no frame.');
    }
    const r = await this.s('Page.captureScreenshot', { format, ...(format === 'jpeg' ? { quality } : {}), optimizeForSpeed: true, fromSurface: true, captureBeyondViewport: false });
    return Buffer.from(r.data, 'base64');
  }
  /**
   * Forget the paint state of earlier frames. Chrome keeps raster state per composited layer from frame to frame: a
   * layer that moves, scales or has will-change keeps the raster scale and sub-pixel offset it was first drawn at (or
   * the largest scale it reached), so a frame could depend on which frames this page drew before it (1 worker !=
   * N workers by a pixel level on grid lines and text). Hiding the page's content for one drawn frame drops every such
   * layer, and the frame drawn after it makes new ones for the current state only. Call it right after a seek: the new
   * layers are made for the time the page is at (it draws once more itself, as the compositor may draw at any moment).
   * `only`: drop just the layers of elements moved or faded by an inline style or an animation that hold text of their
   * own (the ones whose text raster phase outlives the move by about a second); a heavy page keeps the rest, which is
   * why a render can do this at every part start. Returns false when there was nothing to drop.
   */
  async resetPaint(only = false) {
    // only: drop just the layers that can carry text raster state (an element moved or faded by an inline style or an
    // animation, with text of its own), instead of the whole page: far cheaper on a heavy page, same bytes
    const had = await this.evaluate(`(() => {
      const only = ${only ? 'true' : 'false'};
      let els;
      if (only) {
        els = [];
        for (const el of document.body ? document.body.querySelectorAll('*') : []) {
          const st = el.style;
          const moved = st && (st.transform || st.translate || st.scale || st.rotate || st.opacity || st.filter || st.willChange) || (el.getAnimations && el.getAnimations().length);
          if (!moved) continue;
          let own = false;
          for (const n of el.childNodes) if (n.nodeType === 3 && n.data.trim()) { own = true; break; }
          if (own || !el.children.length) els.push(el);
        }
        if (!els.length) return false;
      } else els = [document.body];
      if (!els[0]) return false;
      window.__gmReset = els.map((e) => [e, e.getAttribute('style')]);
      for (const e of els) e.style.setProperty('content-visibility', 'hidden', 'important');
      return true;
    })()`);
    if (!had) return false;
    try {
      await this._drawFrame();
    } finally {
      await this.evaluate(`(() => { for (const [e, s] of window.__gmReset || []) { if (s == null) e.removeAttribute('style'); else e.setAttribute('style', s); } delete window.__gmReset; })()`);
    }
    await this._drawFrame();
    return true;
  }
  /** Have the compositor draw the current state once (a tiny capture). */
  async _drawFrame() {
    if (this.mode === 'beginframe') await this._beginFrame(true, 'jpeg', 1);
    else await this.s('Page.captureScreenshot', { format: 'jpeg', quality: 1, optimizeForSpeed: true, fromSurface: true, clip: { x: 0, y: 0, width: 8, height: 8, scale: 1 } });
  }
  async close() {
    if (this.browser) { const b = this.browser; this.browser = null; await b.close(); }
    if (this._release) { this._release(); this._release = null; }
  }
}

export function chromeVersion(path) {
  try {
    const r = spawnSync(path, ['--version'], { encoding: 'utf8', timeout: 10000 });
    return (r.stdout || r.stderr || '').trim();
  } catch { return null; }
}
