// Local HTTP server: serves the project folder, injects the runtime into HTML,
// expands <gm-include>, and serves video frames decoded by ffmpeg.
import http from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync, mkdirSync, readdirSync, watch, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { join, extname, resolve, dirname, sep, normalize, basename, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { CACHE_DIR } from './browser.js';
import { ffmpegPath } from './ffmpeg.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNTIME_DIR = join(HERE, 'runtime');
const STUDIO_DIR = join(HERE, 'studio');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4v': 'video/mp4', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac', '.txt': 'text/plain; charset=utf-8',
  '.lottie': 'application/zip', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.wasm': 'application/wasm', '.srt': 'text/plain; charset=utf-8', '.vtt': 'text/vtt',
};

export function readRuntime() {
  return { js: ['runtime.js', 'motion.js', 'sketch.js', 'audio.js', 'chart.js'].filter((f) => existsSync(join(RUNTIME_DIR, f))).map((f) => readFileSync(join(RUNTIME_DIR, f), 'utf8')).join('\n;\n'), css: readFileSync(join(RUNTIME_DIR, 'preset.css'), 'utf8') };
}

/** Expand <gm-include src="file.html" key="value"> recursively. {{key}} in the included file is replaced. */
export function expandIncludes(html, fileDir, rootDir, depth = 0, seen = [], state = { n: 0 }) {
  if (depth > 12) return html;
  // <gm-include src="x.html" a="1"/>  or  <gm-include src="x.html" a="1">inner HTML</gm-include>
  return html.replace(/<gm-include\b((?:[^>"']|"[^"]*"|'[^']*')*?)(?:\/>|>([\s\S]*?)<\/gm-include>)/gi, (m, attrStr, inner) => {
    const attrs = parseAttrs(attrStr);
    if (!attrs.src) return `<!-- gm-include without src -->`;
    const file = resolve(fileDir, attrs.src);
    // Includes are read here on the server, so they may live outside the served folder (../blocks).
    // Only HTML/SVG blocks, never hidden files or folders (.env, .ssh): a page must not be able to read secrets in.
    // A relative src may not name a hidden file or folder. An absolute one may live under a hidden folder (a project in
    // ~/.cache or .claude/worktrees), but not end at a hidden file or go through a folder that holds keys.
    const hiddenSeg = (x) => x.startsWith('.') && x !== '.' && x !== '..';
    const hidden = isAbsolute(String(attrs.src)) ? hiddenSeg(basename(file)) || file.split(/[\\/]/).some((x) => SECRET_DIRS.has(x)) : String(attrs.src).split(/[\\/]/).some(hiddenSeg);
    if (!/\.(html?|svg)$/i.test(file) || hidden) return `<div data-gm-include-error="${esc(attrs.src)}" data-check="ignore" style="color:#f33;font:24px monospace">gm-include only reads .html and .svg files (and no hidden files): ${esc(attrs.src)}</div>`;
    if (!existsSync(file) || !statSync(file).isFile() || !linkIsSafe(file)) return `<div data-gm-include-error="${esc(attrs.src)}" data-check="ignore" style="color:#f33;font:24px monospace">gm-include not found: ${esc(attrs.src)}</div>`;
    if (seen.includes(file)) return `<!-- circular gm-include ${esc(attrs.src)} -->`;
    let body = readFileSync(file, 'utf8');
    // Drop the block's documentation comment. A block's own <style> goes in a cascade layer, so the page's CSS always
    // restyles it (a brand's color, font, a light background), whatever the order or the specificity of its selectors.
    const isBlock = /<!--\s*block:/.test(body);
    body = body.replace(/<!--\s*block:[\s\S]*?-->\s*/, '');
    // `scope`: this copy's ids, their #references and its <style> are private to it (see scopePart)
    const scoped = 'scope' in attrs && attrs.scope !== 'false';
    const tag = scoped ? 's' + (++state.n) : '';
    const vars = { ...attrs, ...(scoped ? { scope: tag } : {}), content: inner != null ? expandIncludes(inner, fileDir, rootDir, depth + 1, seen, state) : '' };
    body = body.replace(/\{\{\s*([\w.-]+)\s*(?:\|\s*([^}]*))?\}\}/g, (mm, key, def) => {
      if (key.startsWith('data.')) return mm; // resolved later from render data
      const v = vars[key];
      if (v != null && v !== '') return key === 'content' ? v : esc(v);
      return def != null ? def.trim() : '';
    });
    if (scoped) body = scopePart(body, tag);
    if (isBlock) body = body.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, o, css, c) => (/@import/i.test(css) ? m : `${o}@layer gm-block{${css}}${c}`));
    body = expandIncludes(body, dirname(file), rootDir, depth + 1, [...seen, file], state);
    const passthrough = Object.entries(attrs).filter(([k]) => k === 'class' || k === 'style' || k === 'id' || k.startsWith('data-'))
      .concat(scoped ? [['data-gm-scope', tag]] : [])
      .map(([k, v]) => `${k}="${esc(v)}"`).join(' ');
    // The wrapper takes no space in layout (display: contents) unless it needs its own box
    // for animation or styling (data-enter/exit, class or style on the include).
    const needsBox = ['data-enter', 'data-exit', 'class', 'style'].some((k) => k in attrs);
    const plain = !Object.keys(attrs).some((k) => k === 'class' || k === 'style' || k === 'id' || k.startsWith('data-'));
    return `<div data-gm-include="${esc(attrs.src)}"${plain ? ' data-gm-plain' : ''}${needsBox ? '' : ' style="display:contents"'} ${passthrough}>${body}</div>`;
  });
}
/**
 * A part included with `scope` keeps its own names: every id it declares gets a suffix (id="title" → "title--s1"), and
 * the `#title` that names it (in its CSS, its script strings, href="#title", url(#title), data-anchor="#title bottom",
 * getElementById('title'), for=) follows. Its <style> applies only inside the copy (@scope), and its @keyframes names
 * get the suffix too. So the same part can be included many times, or scenes written apart can share names, with no
 * {{S}} placeholders. Only ids the part declares itself change; an id from outside is left alone.
 */
export function scopePart(body, tag) {
  const ids = [...new Set([...body.matchAll(/(?<![\w-])id\s*=\s*["']([A-Za-z_][\w-]*)["']/g)].map((m) => m[1]))];
  const sfx = '--' + tag;
  if (ids.length) {
    const alt = ids.sort((a, b) => b.length - a.length).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    body = body
      .replace(new RegExp(`(?<![\\w&-])id(\\s*=\\s*["'])(${alt})(?=["'])`, 'g'), `id$1$2${sfx}`)
      .replace(new RegExp(`(?<![\\w&])#(${alt})(?![\\w-])`, 'g'), `#$1${sfx}`)
      .replace(new RegExp(`(\\b(?:for|aria-labelledby|aria-describedby|aria-controls)\\s*=\\s*["'])(${alt})(?=["'])`, 'g'), `$1$2${sfx}`)
      .replace(new RegExp(`(getElementById\\(\\s*["'])(${alt})(?=["'])`, 'g'), `$1$2${sfx}`);
  }
  return body.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, open, css, close) => {
    const names = [...new Set([...css.matchAll(/@keyframes\s+([A-Za-z_][\w-]*)/g)].map((x) => x[1]))];
    for (const n of names) css = css.replace(new RegExp(`(?<![\\w-])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'g'), n + sfx);
    // rules go inside @scope; at-rules that must stay at the top level (@keyframes, @font-face, @import, @property) stay out
    let rules = '', keep = '', depth = 0, start = 0;
    const flush = (end) => { const chunk = css.slice(start, end); start = end; if (/^\s*@(keyframes|font-face|import|property|charset|layer\s+[\w.-]+\s*;)/.test(chunk)) keep += chunk; else rules += chunk; };
    for (let i = 0; i < css.length; i++) {
      const c = css[i];
      if (c === '{') depth++;
      else if (c === '}' && --depth === 0) flush(i + 1);
      else if (c === ';' && depth === 0) flush(i + 1);
    }
    flush(css.length);
    return `${open}${keep}${rules.trim() ? `@scope ([data-gm-scope="${tag}"]) {${rules}}` : ''}${close}`;
  });
}
function parseAttrs(s) {
  const out = {};
  const re = /([\w:.-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(s))) out[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
  return out;
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** JSON that is safe inside an inline <script> (a value holding "</script>" cannot end the tag). */
export const scriptJSON = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

/**
 * <html data-words="voice.json">: the word-timed transcript of the voice-over ([{word, start, end}], the captions
 * format) is put in the page, so times can name a word: data-start="@pricing", data-cuts="0 @spring_pricing",
 * gm.word('pricing'). Only a file inside the project (like every file the page reads).
 */
export function inlineWords(html, fileDir, rootDir) {
  const m = /<html\b[^>]*\bdata-words\s*=\s*["']([^"']+)["']/i.exec(html);
  if (!m) return html;
  const f = resolve(fileDir, m[1]), rel = f.startsWith(resolve(rootDir) + sep) ? f.slice(resolve(rootDir).length + 1) : null;
  const safe = rel != null && safeJoin(resolve(rootDir), rel);
  let words = null, error = null;
  if (!safe || !existsSync(safe)) error = `data-words: ${m[1]} was not found (it must be inside the project folder).`;
  else {
    try {
      const j = JSON.parse(readFileSync(safe, 'utf8'));
      const list = Array.isArray(j) ? j : Array.isArray(j.words) ? j.words : Array.isArray(j.segments) ? j.segments.flatMap((x) => x.words || []) : null;
      if (!list) error = `data-words: ${m[1]} is not a list of {word, start, end}.`;
      else words = list.map((w) => ({ word: String(w.word ?? w.text ?? ''), start: +w.start, end: +(w.end ?? w.start) })).filter((w) => w.word && isFinite(w.start));
    } catch (e) { error = `data-words: ${m[1]} is not valid JSON (${e.message}).`; }
  }
  const tag = `<script type="application/json" id="gm-words">${scriptJSON({ file: m[1], words, error })}</script>`;
  const head = /<head\b[^>]*>/i.exec(html);
  return head ? html.slice(0, head.index + head[0].length) + tag + html.slice(head.index + head[0].length) : /<body\b[^>]*>/i.test(html) ? html.replace(/<body\b[^>]*>/i, (b) => b + tag) : tag + html;
}

/**
 * Replace {{data.path}} / {{data.path|default}} with values from the render data
 * (--data / --props, or the page's <script type="application/json" id="gm-data">).
 * Arrays become comma lists, objects become JSON. Values are HTML-escaped (safe in text and quoted
 * attributes), and a value that starts a URL attribute cannot be a script URL. In JS, read gm.data instead.
 */
export function applyData(html, data) {
  if (data == null) {
    const m = /<script[^>]*id=["']gm-data["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
    if (m) { try { data = JSON.parse(m[1]); } catch { data = null; } }
  }
  const missing = new Set();
  const out = html.replace(/\{\{\s*data\.([\w.\[\]-]+)\s*(?:\|\s*([^}]*))?\}\}/g, (mm, path, def, at, all) => {
    const v = path.replace(/\[(\d+)\]/g, '.$1').split('.').reduce((o, k) => (o == null ? o : o[k]), data);
    if (v == null) { if (def == null) missing.add(path); return def != null ? esc(def.trim()) : ''; }
    let text = Array.isArray(v) ? v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : x)).join(',') : typeof v === 'object' ? JSON.stringify(v) : String(v);
    // At the start of src="…", href="…" and the like, data is a link, never a script.
    if (URL_ATTR_START.test(all.slice(Math.max(0, at - 40), at)) && /^[\s\0-\x1f]*(javascript|vbscript):/i.test(text.replace(/[\s\0-\x1f]+/g, ''))) text = 'about:blank';
    return esc(text);
  });
  // Tell the page which templates came out empty, so `check` can say so.
  if (!missing.size) return out;
  const tag = `<script type="application/json" id="gm-missing-data">${scriptJSON({ keys: [...missing], noData: data == null })}</script>`;
  return /<\/body>/i.test(out) ? out.replace(/<\/body>/i, tag + '</body>') : out + tag;
}

const URL_ATTR_START = /\b(?:src|href|xlink:href|action|formaction|poster|data|srcdoc)\s*=\s*["']?$/i;

/** @param {string} html @param {{ inlineConfig?: Record<string, any> }} [opts] */
export function injectRuntime(html, { inlineConfig } = {}) {
  const tags = `<link rel="stylesheet" href="/__gm/preset.css" data-gm-preset><script>window.__GM_CONFIG = window.__GM_CONFIG || ${scriptJSON(inlineConfig || { mode: 'preview' })};</script><script src="/__gm/runtime.js"></script>`;
  const head = /<head\b[^>]*>/i.exec(html);
  if (head) return html.slice(0, head.index + head[0].length) + tags + html.slice(head.index + head[0].length);
  const htmlTag = /<html\b[^>]*>/i.exec(html);
  if (htmlTag) return html.slice(0, htmlTag.index + htmlTag[0].length) + '<head>' + tags + '</head>' + html.slice(htmlTag.index + htmlTag[0].length);
  const doctype = /<!doctype[^>]*>/i.exec(html);
  if (doctype) return html.slice(0, doctype.index + doctype[0].length) + tags + html.slice(doctype.index + doctype[0].length);
  return tags + html;
}

// ---------------------------------------------------------------------------
// Video frame extraction
// ---------------------------------------------------------------------------
class FrameExtractor {
  constructor(maxW, maxH) { this.jobs = new Map(); this.maxW = maxW; this.maxH = maxH; pruneFrames(); }
  key(file, fps) {
    const st = statSync(file);
    return createHash('sha1').update(`${file}|${st.size}|${st.mtimeMs}|${fps}|${this.maxW}x${this.maxH}`).digest('hex').slice(0, 16);
  }
  /** Ensure frames [startIdx, endIdx] exist; resolves file path of frame idx. */
  async frame(file, fps, idx) {
    const key = this.key(file, fps);
    const dir = join(CACHE_DIR, 'frames', key);
    mkdirSync(dir, { recursive: true });
    const p = (i) => join(dir, `${String(i).padStart(7, '0')}.jpg`);
    let jobs = this.jobs.get(key);
    if (!jobs) {
      jobs = []; this.jobs.set(key, jobs);
      // in use: pruneFrames keeps it
      try { const now = new Date(); utimesSync(dir, now, now); } catch {}
    }
    const complete = (i) => existsSync(p(i + 1)) || (existsSync(p(i)) && !jobs.some((j) => !j.done && i >= j.start && i <= j.end));
    if (complete(idx)) return p(idx);
    let job = jobs.find((j) => !j.done && idx >= j.start && idx <= j.start + Math.ceil(fps * 4) + (j.reached || 0));
    if (!job) job = this._spawn(file, fps, idx, dir, jobs);
    for (;;) {
      if (job.failed) throw new Error(job.failed);
      if (complete(idx) || job.done) break;
      await new Promise((r) => setTimeout(r, 3));
    }
    if (existsSync(p(idx))) return p(idx);
    // Past the end of the video: return the last frame we have
    for (let i = idx - 1; i >= Math.max(0, idx - 900); i--) if (existsSync(p(i))) return p(i);
    throw new Error(`No frame ${idx} for ${file}`);
  }
  _spawn(file, fps, startIdx, dir, jobs) {
    const window = Math.ceil(fps * 120);
    const job = { start: startIdx, end: startIdx + window, done: false, failed: null, reached: 0 };
    jobs.push(job);
    const ss = startIdx / fps;
    const vf = `fps=${fps},scale='min(iw,${this.maxW})':'min(ih,${this.maxH})':force_original_aspect_ratio=decrease:flags=lanczos`;
    const args = ['-hide_banner', '-loglevel', 'error', '-ss', String(ss), '-i', file, '-t', String(window / fps), '-vf', vf,
      '-q:v', '2', '-start_number', String(startIdx), join(dir, '%07d.jpg')];
    const proc = spawn(ffmpegPath(), args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    proc.stderr.on('data', (d) => (err += d));
    const tick = setInterval(() => { job.reached += Math.ceil(fps); }, 1000);
    proc.on('exit', (code) => { clearInterval(tick); job.done = true; if (code !== 0) job.failed = `ffmpeg could not decode ${file}: ${err.trim().split('\n').slice(-2).join(' ')}`; });
    proc.on('error', (e) => { clearInterval(tick); job.done = true; job.failed = `ffmpeg not available: ${e.message}`; });
    return job;
  }
}

/**
 * Start the server for a project root.
 * Returns { url(pathname), port, close, events }.
 */
/**
 * @param {import('./types/api.js').ServerOptions} opts
 * @returns {Promise<import('./types/api.js').Server>}
 */
export async function startServer({ root, maxW = 3840, maxH = 2160, studio = false, inlineConfig, port: wantPort = 0, host = '127.0.0.1', data = null }) {
  root = resolve(root);
  const runtime = () => readRuntime();
  const extractor = new FrameExtractor(maxW, maxH);
  const clients = new Set();
  const loopback = LOOPBACK.has(host);
  const server = http.createServer(async (req, res) => {
    try {
      // Only answer requests addressed to this machine by name (blocks DNS rebinding from web pages).
      if (loopback && !LOOPBACK.has(hostname(req.headers.host))) return send(res, 403, 'text/plain', 'givemotion only serves localhost');
      const u = new URL(req.url, 'http://localhost');
      let path = decodeURIComponent(u.pathname);
      if (path === '/__gm/runtime.js') return send(res, 200, MIME['.js'], runtime().js);
      if (path.startsWith('/__gm/fonts/')) {
        const f = join(RUNTIME_DIR, 'fonts', basename(path));
        if (!/\.woff2?$/.test(f) || !existsSync(f)) return send(res, 404, 'text/plain', 'no such font');
        res.writeHead(200, { 'Content-Type': 'font/woff2', 'Cache-Control': 'max-age=31536000, immutable' });
        return createReadStream(f).pipe(res);
      }
      if (path === '/__gm/player.js') return send(res, 200, MIME['.js'], readFileSync(join(HERE, 'player', 'gm-player.js'), 'utf8'));
      if (path === '/__gm/preset.css') return send(res, 200, MIME['.css'], runtime().css);
      if (path === '/__gm/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        res.write('retry: 500\n\n');
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
      }
      if (path === '/__gm/vframe') {
        const src = u.searchParams.get('src');
        // Bounded: any web page can make the browser request this URL.
        const fps = Math.min(240, Math.max(1, parseFloat(u.searchParams.get('fps')) || 30));
        const i = Math.min(10_000_000, Math.max(0, parseInt(u.searchParams.get('i'), 10) || 0));
        const file = safeJoin(root, decodeURIComponent(new URL(src, 'http://x').pathname));
        if (!file || !existsSync(file)) return send(res, 404, 'text/plain', 'video not found: ' + src);
        const f = await extractor.frame(file, fps, i);
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'max-age=31536000, immutable' });
        return createReadStream(f).pipe(res);
      }
      if (path === '/__gm_analyze') {
        // Tiny page used by `givemotion audio <file>`
        const src = scriptJSON(u.searchParams.get('src') || '');
        const fps = Math.min(240, Math.max(1, parseFloat(u.searchParams.get('fps')) || 30));
        return send(res, 200, MIME['.html'], injectRuntime(`<!doctype html><html data-width="320" data-height="180" data-fps="${fps}" data-duration="1"><body><script>window.__gmA = gm.audio(${src});</script></body></html>`, { inlineConfig: { mode: 'render' } }), { 'Cache-Control': 'no-store' });
      }
      if (path === '/__gm/pcm') {
        // Mono 32-bit float PCM of any audio/video file, for in-page analysis (gm.audio).
        const src = u.searchParams.get('src');
        const sr = Math.min(48000, Math.max(8000, parseInt(u.searchParams.get('sr'), 10) || 22050));
        const file = safeJoin(root, decodeURIComponent(new URL(src, 'http://x').pathname));
        if (!file || !existsSync(file)) return send(res, 404, 'text/plain', 'audio not found: ' + src);
        const buf = await decodePCM(file, sr);
        if (!buf) return send(res, 500, 'text/plain', 'ffmpeg could not decode ' + src);
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': buf.length, 'Cache-Control': 'max-age=31536000, immutable' });
        return res.end(buf);
      }
      if (studio && path.startsWith('/__gm/studio')) {
        const rel = path.slice('/__gm/studio'.length).replace(/^\/+/, '') || 'index.html';
        const f = safeJoin(STUDIO_DIR, rel);
        if (!f || !existsSync(f)) return send(res, 404, 'text/plain', 'not found');
        return send(res, 200, MIME[extname(f)] || 'application/octet-stream', readFileSync(f));
      }
      if (path.endsWith('/')) path += 'index.html';
      const file = safeJoin(root, path);
      if (!file || !existsSync(file) || !statSync(file).isFile()) return send(res, 404, 'text/plain', 'not found: ' + path);
      const ext = extname(file).toLowerCase();
      if (ext === '.html' || ext === '.htm') {
        // the file as written (error lines are mapped back to it)
        if (u.searchParams.has('source')) return send(res, 200, 'text/plain; charset=utf-8', readFileSync(file, 'utf8'), { 'Cache-Control': 'no-store' });
        let html = readFileSync(file, 'utf8');
        html = expandIncludes(html, dirname(file), root);
        html = inlineWords(html, dirname(file), root);
        html = applyData(html, data);
        // Pages that host <gm-player>, or are already bundled, are normal web pages: no runtime.
        if (!u.searchParams.has('raw') && !/<gm-player\b|data-gm-preset>|<meta[^>]+name=["']givemotion["'][^>]+off/i.test(html)) html = injectRuntime(html, { inlineConfig: data != null ? { ...(inlineConfig || { mode: 'preview' }), data } : inlineConfig });
        return send(res, 200, MIME[ext], html, { 'Cache-Control': 'no-store' });
      }
      return serveFile(req, res, file, MIME[ext] || 'application/octet-stream');
    } catch (e) {
      send(res, 500, 'text/plain', String(e && e.message || e));
    }
  });
  await new Promise((r, j) => { server.once('error', j); server.listen(wantPort, host, () => r(undefined)); });
  const port = /** @type {import('node:net').AddressInfo} */ (server.address()).port;
  let watcher = null;
  if (studio) {
    let t = null;
    try {
      watcher = watch(root, { recursive: true }, (ev, name) => {
        if (!name || /(^|[\\/])(\.|node_modules|out|renders?)([\\/]|$)/.test(name) || /\.(mp4|mov|webm|gif)$/i.test(name)) return;
        clearTimeout(t);
        t = setTimeout(() => { for (const c of clients) c.write(`data: ${JSON.stringify({ type: 'reload', file: name })}\n\n`); }, 80);
      });
    } catch {}
  }
  return {
    port,
    origin: `http://127.0.0.1:${port}`,
    url: (p) => `http://127.0.0.1:${port}/${String(p).split(sep).join('/').replace(/^\/+/, '')}`,
    close: () => new Promise((r) => { if (watcher) watcher.close(); for (const c of clients) c.end(); server.closeAllConnections?.(); server.close(() => r()); }),
  };
}

/**
 * Video frames decoded for earlier renders stay in the cache, so the next render of the same video starts at once. A
 * video's frames not used for two weeks are removed (checked once a day): the folder grew by every video ever rendered.
 */
function pruneFrames() {
  const root = join(CACHE_DIR, 'frames'), stamp = join(root, '.pruned');
  const now = Date.now(), DAY = 86400000;
  try { if (now - statSync(stamp).mtimeMs < DAY) return; } catch {}
  let names = [];
  try { names = readdirSync(root); } catch { return; }
  for (const n of names) {
    if (!/^[0-9a-f]{16}$/.test(n)) continue;
    try { if (now - statSync(join(root, n)).mtimeMs > 14 * DAY) rmSync(join(root, n), { recursive: true, force: true }); } catch {}
  }
  try { writeFileSync(stamp, ''); } catch {}
}

// Decoded audio (for the waveform and audio data): a studio session keeps it while it runs, so it is capped (the oldest
// go first) and a file's older versions are dropped when it changes. 10 minutes of audio at 48 kHz is ~110 MB.
const pcmCache = new Map();
const PCM_MAX = 512 * 1024 * 1024;
let pcmBytes = 0;
function decodePCM(file, sr) {
  const st = statSync(file);
  const key = `${file}|${st.size}|${st.mtimeMs}|${sr}`;
  if (pcmCache.has(key)) { const p = pcmCache.get(key); pcmCache.delete(key); pcmCache.set(key, p); return p; }
  for (const [k, v] of pcmCache) if (k.startsWith(file + '|') && k.endsWith('|' + sr)) { pcmCache.delete(k); pcmBytes -= /** @type {any} */ (v).bytes || 0; }
  const p = new Promise((resolveP) => {
    const ff = ffmpegPath();
    if (!ff) return resolveP(null);
    const proc = spawn(ff, ['-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', String(sr), '-f', 'f32le', '-'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    proc.stdout.on('data', (d) => chunks.push(d));
    proc.on('error', () => resolveP(null));
    proc.on('close', (code) => resolveP(code === 0 ? Buffer.concat(chunks) : null));
  });
  pcmCache.set(key, p);
  p.then((buf) => {
    if (!buf || pcmCache.get(key) !== p) return;
    /** @type {any} */ (p).bytes = buf.length;
    pcmBytes += buf.length;
    for (const [k, v] of pcmCache) {
      if (pcmBytes <= PCM_MAX || k === key) break;
      pcmCache.delete(k); pcmBytes -= /** @type {any} */ (v).bytes || 0;
    }
  });
  return p;
}

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
function hostname(h = '') {
  return h.startsWith('[') ? h.slice(0, h.indexOf(']') + 1) : h.split(':')[0];
}
// Paths under the root, never hidden files or folders (.env, .git, .npmrc...): the root is often the project folder.
export function safeJoin(root, p) {
  if (String(p).split(/[\\/]/).some((x) => x.startsWith('.') && x !== '.well-known')) return null;
  const f = normalize(join(root, p));
  if (f !== root && !f.startsWith(root + sep)) return null;
  return linkIsSafe(f) ? f : null;
}
// Symbolic links inside the project are followed (that is how projects share styles, sounds and blocks), but a link
// may not end at a hidden file (env.txt -> .env) or lead into a folder that holds keys (assets -> ~/.ssh).
const SECRET_DIRS = new Set(['.ssh', '.gnupg', '.aws', '.azure', '.kube', '.docker', '.git', '.config', '.password-store', '.netrc', '.npmrc', '.env']);
export function linkIsSafe(f) {
  let real;
  try { real = realpathSync(f); } catch { return true; } // does not exist (yet): nothing to read
  if (real === f) return true;
  const parts = real.split(/[\\/]/);
  return !parts[parts.length - 1].startsWith('.') && !parts.some((x) => SECRET_DIRS.has(x));
}
function send(res, code, type, body, headers = {}) {
  res.writeHead(code, { 'Content-Type': type, ...headers });
  res.end(body);
}
function serveFile(req, res, file, type) {
  const st = statSync(file);
  const range = req.headers.range;
  const base = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : st.size - 1;
    if (!m || start >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
    end = Math.min(end, st.size - 1);
    res.writeHead(206, { ...base, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
    return createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...base, 'Content-Length': st.size });
  createReadStream(file).pipe(res);
}
