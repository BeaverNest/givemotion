// End-to-end tests. They need Chrome (or chrome-headless-shell) and ffmpeg; they skip otherwise.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { findChrome } from '../src/browser.js';
import { ffmpegInfo, ffmpegPath, probe } from '../src/ffmpeg.js';
import { execFileSync, spawnSync } from 'node:child_process';
import { render, stills, check, snapshot, inspect } from '../src/api.js';

// every test's folders go in one per run, removed at the end (each run used to leave dozens in the temp folder)
const TMP = mkdtempSync(join(tmpdir(), 'gm-e2e-'));
after(() => rmSync(TMP, { recursive: true, force: true }));

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const skip = !findChrome() || !ffmpegInfo() ? 'needs Chrome and ffmpeg' : false;
const tmp = () => mkdtempSync(join(TMP, 'test-'));
const md5 = (f) => createHash('md5').update(readFileSync(f)).digest('hex');
const quiet = { quiet: true, log: () => {} };

const md5buf = (b) => createHash('md5').update(b).digest('hex');
function comp(dir, name, body, attrs = 'data-width="640" data-height="360" data-fps="30"') {
  const f = join(dir, name);
  writeFileSync(f, `<!doctype html><html ${attrs}><head><style>body{background:#111;color:#fff;font-family:sans-serif}</style></head><body>${body}</body></html>`);
  return f;
}

test('timeline: sequences, gaps, transitions, nested clips', { skip }, async () => {
  const d = tmp();
  const f = comp(d, 'seq.html', `
    <main data-sequence data-transition="fade 0.5">
      <section class="scene" data-duration="2"><p data-start="0.5" data-duration="1">a</p></section>
      <section class="scene" data-duration="3" data-transition="slide-left 1"></section>
      <section class="scene" data-duration="2"></section>
    </main>`);
  const info = await inspect(f);
  // 2 + 3 + 2 - 1 (slide overlap) - 0.5 (fade overlap)
  assert.equal(info.duration, 5.5);
  const starts = info.clips.map((c) => c.start);
  assert.deepEqual(starts, [0, 0.5, 1, 3.5]);
  assert.equal(info.issues.filter((i) => i.severity === 'error').length, 0);
});

test('time formats and errors are reported with fixes', { skip }, async () => {
  const d = tmp();
  const f = comp(d, 't.html', `<div data-start="15f" data-duration="500ms">x</div><div data-start="banana">y</div><div data-enter="wobble">z</div>`, 'data-width="640" data-height="360" data-duration="2"');
  const info = await inspect(f);
  assert.equal(info.clips[0].start, 0.5);
  assert.equal(info.clips[0].end, 1);
  const codes = info.issues.map((i) => i.code);
  assert.ok(codes.includes('bad-time'));
  assert.ok(codes.includes('bad-enter'));
  assert.ok(info.issues.every((i) => i.severity !== 'error' || i.fix));
});

test('render mp4: duration, size, frame count', { skip }, async () => {
  const d = tmp();
  const f = comp(d, 'r.html', `<h1 style="animation:fade-up .5s both">Hi</h1>`, 'data-width="640" data-height="360" data-fps="24" data-duration="1.5"');
  const out = join(d, 'r.mp4');
  const s = await render(f, { output: out, ...quiet });
  assert.equal(s.frames, 36);
  const p = probe(out);
  assert.equal(p.width, 640);
  assert.ok(Math.abs(p.duration - 1.5) < 0.05);
  // the tags say what Chrome drew (BT.709 primaries and matrix, sRGB transfer); frames from a JPEG pipe used to carry none
  const info = spawnSync(ffmpegPath(), ['-hide_banner', '-i', out], { encoding: 'utf8' }).stderr;
  assert.match(info, /tv, bt709\/bt709\/iec61966-2-1/, 'colour tags: ' + (info.match(/yuv420p\([^)]*\)/) || [''])[0]);
});

test('deterministic: 1 worker and 3 workers give identical frames (timers, rAF canvas, transitions, WAAPI)', { skip }, async () => {
  const d = tmp();
  copyFileSync(join(HERE, 'fixtures', 'stateful.html'), join(d, 'stateful.html'));
  const a = join(d, 'a'), b = join(d, 'b');
  await render(join(d, 'stateful.html'), { output: a, format: 'png', workers: 1, ...quiet });
  await render(join(d, 'stateful.html'), { output: b, format: 'png', workers: 3, ...quiet });
  const fa = readdirSync(a).sort(), fb = readdirSync(b).sort();
  assert.equal(fa.length, 120);
  assert.deepEqual(fa, fb);
  const diff = fa.filter((x) => md5(join(a, x)) !== md5(join(b, x)));
  assert.deepEqual(diff, []);
});

test('shared computer: a render that starts with 1 worker, grows when another render finishes and gives workers back when one starts gives the same bytes as 1 worker', { skip }, async () => {
  const { CACHE_DIR } = await import('../src/machine.js');
  const { spawn } = await import('node:child_process');
  const d = tmp();
  const f = comp(d, 'long.html', `<style>#b{position:absolute;left:20px;top:110px;width:40px;height:40px;background:#4af}h1{position:absolute;left:20px;top:20px;margin:0;font:32px Inter}</style>
    <h1 id="h">Sharing</h1><div id="b"></div>
    <script>gm.timeline().to('#b', { x: 240, rotate: 720, duration: 20, ease: 'linear' }, 0).from('#h', { opacity: 0, y: 20, duration: 1 }, 0.2);</script>`, 'data-width="320" data-height="180" data-fps="30" data-duration="20"');
  const a = join(d, 'a.mp4'), b = join(d, 'b.mp4');
  await render(f, { output: a, workers: 1, cache: false, ...quiet });
  // another givemotion process (a live child standing in for it) that has 3 of the computer's 4 browsers
  const other = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 120000)'], { stdio: 'ignore' });
  const lease = join(CACHE_DIR, 'run', `${other.pid}.json`);
  mkdirSync(dirname(lease), { recursive: true });
  const env = { max: process.env.GIVEMOTION_MAX_BROWSERS, prof: process.env.GIVEMOTION_PROFILE };
  process.env.GIVEMOTION_MAX_BROWSERS = '4'; process.env.GIVEMOTION_PROFILE = '1';
  writeFileSync(lease, JSON.stringify({ pid: other.pid, browsers: 3, mb: 0, wants: 3, claim: null }));
  const seen = [];
  let phase = 0;
  try {
    await render(f, {
      output: b, cache: false, quiet: true, log: (line) => {
        const m = /active=(\d+) share=\d+ left=(\d+)/.exec(line);
        if (!m) return;
        seen.push([+m[1], +m[2]]);
        // it finishes: room for more workers; then a new render wants all four: give some back
        if (phase === 0 && +m[1] === 1) { phase = 1; rmSync(lease, { force: true }); }
        else if (phase === 1 && +m[1] >= 3) { phase = 2; writeFileSync(lease, JSON.stringify({ pid: other.pid, browsers: 0, mb: 0, wants: 4, claim: null })); }
      },
    });
  } finally {
    rmSync(lease, { force: true }); other.kill();
    for (const [k, v] of [['GIVEMOTION_MAX_BROWSERS', env.max], ['GIVEMOTION_PROFILE', env.prof]]) { if (v == null) delete process.env[k]; else process.env[k] = v; }
  }
  const counts = seen.map(([n]) => n), top = Math.max(...counts);
  assert.equal(counts[0], 1, `started with ${counts[0]} workers while the other process had 3 of 4`);
  assert.ok(top >= 3, `grew to ${top} when the other finished: ${counts.join(' ')}`);
  assert.ok(seen.some(([n, left], i) => i > counts.indexOf(top) && n < top && left > 0), `gave workers back while parts were left: ${counts.join(' ')}`);
  assert.equal(md5(b), md5(a), 'same bytes as 1 worker');
});

test('entrance (opacity + move) on text: 1 worker == 2 workers byte for byte, also the second after the move ends', { skip }, async () => {
  // Chrome keeps the raster phase of a text layer that was moved and faded in for about a second after the move. A worker
  // that continues from the earlier part has that state, one that starts at a part does not, so frames 60-89 of this
  // 90-frame video used to differ by a few colour levels on glyph edges. Every part start now drops those layers.
  const d = tmp();
  const f = comp(d, 'in.html', `<style>h1{position:absolute;left:40px;top:60px;margin:0;font:56px Inter;color:#fff}p{position:absolute;left:40px;top:180px;margin:0;font:28px Inter;color:#fff}</style>
    <h1 id="h">Hello determinism</h1><p id="p">second line of text</p>
    <script>gm.timeline().from('#h', { opacity: 0, y: 40, duration: 0.8, ease: 'out-cubic' }, 0.1).from('#p', { opacity: 0, y: 30, duration: 0.6 }, 0.4);</script>`, 'data-width="640" data-height="360" data-fps="30" data-duration="3"');
  const a = join(d, 'a.mov'), b = join(d, 'b.mov');
  await render(f, { output: a, workers: 1, cache: false, ...quiet });
  await render(f, { output: b, workers: 2, cache: false, ...quiet });
  const frames = (v) => execFileSync(ffmpegPath(), ['-v', 'error', '-i', v, '-an', '-f', 'framemd5', '-'], { encoding: 'utf8' }).split('\n').filter((l) => l && l[0] !== '#').map((l) => l.split(',')[5].trim());
  const fa = frames(a), fb = frames(b);
  assert.equal(fa.length, 90);
  assert.deepEqual(fa.map((m, i) => (m === fb[i] ? null : i)).filter((i) => i != null), [], 'frames that differ between 1 and 2 workers');
});

test('steady text: slowly moving text glides with its box instead of stepping whole pixels (a timeline tween, SVG text and a CSS animation; 1 worker == 2 workers)', { skip }, async () => {
  // 12 px down in 2 s (0.2 px a frame). Without the runtime's tilt Chrome puts the glyphs on whole pixels: the text
  // stays still for 4 frames and jumps a pixel while the bar under it glides (rms of the 2nd difference ~0.64 px).
  // A CSS @keyframes animation is on a composited layer: a fresh page glides, a worker that starts mid-video steps.
  const d = tmp();
  const box = (style) => `<div id="w" style="position:absolute;left:100px;top:140px;width:440px;${style}"><div style="font:600 40px Inter;color:#fff;line-height:52px">Every morning</div><div style="height:4px;background:#f00"></div></div>`;
  const attrs = 'data-width="640" data-height="360" data-fps="30" data-duration="2"';
  const pages = {
    tween: comp(d, 'tween.html', box('') + `<script>gm.timeline().fromTo('#w', { y: 0 }, { y: 12, duration: 2, ease: 'linear' }, 0)</script>`, attrs),
    svg: comp(d, 'svg.html', `<svg width="640" height="360" style="position:absolute;left:0;top:0"><text id="w" x="100" y="180" font-size="44" font-weight="600" fill="#fff" font-family="Inter">Every morning</text></svg><script>gm.timeline().fromTo('#w', { y: 0 }, { y: 12, duration: 2, ease: 'linear' }, 0)</script>`, attrs),
    css: comp(d, 'css.html', `<style>@keyframes drop { from { transform: translateY(0) } to { transform: translateY(12px) } }</style>` + box('animation:drop 2s linear both'), attrs),
  };
  for (const [name, f] of Object.entries(pages)) {
    const a = join(d, name + 'a'), b = join(d, name + 'b');
    await render(f, { output: a, format: 'png', workers: 1, cache: false, ...quiet });
    await render(f, { output: b, format: 'png', workers: 2, cache: false, ...quiet });
    const fa = readdirSync(a).filter((x) => x.endsWith('.png')).sort();
    assert.deepEqual(fa.filter((x) => md5(join(a, x)) !== md5(join(b, x))), [], name + ': 1 and 2 workers differ');
    const ys = fa.map((x) => {
      const px = execFileSync(ffmpegPath(), ['-v', 'error', '-i', join(a, x), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 26 });
      let w = 0, sum = 0;
      for (let i = 0; i < px.length; i += 3) { const v = Math.min(px[i], px[i + 1], px[i + 2]); if (v > 30) { w += v; sum += v * Math.floor(i / 3 / 640); } }
      return sum / w;
    });
    let q = 0;
    for (let i = 1; i < ys.length - 1; i++) q += (ys[i + 1] - 2 * ys[i] + ys[i - 1]) ** 2;
    const jitter = Math.sqrt(q / (ys.length - 2));
    assert.ok(jitter < 0.15, `${name}: the text steps instead of gliding: rms 2nd difference ${jitter.toFixed(3)} px`);
  }
});

test('the same page gives the same frames on every computer: time zone, instant scrolling, lazy images, SVG animation', { skip }, async () => {
  const d = tmp();
  writeFileSync(join(d, 'pic.png'), execFileSync(ffmpegPath(), ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=64x64', '-frames:v', '1', '-f', 'image2', '-c:v', 'png', '-'], { maxBuffer: 1 << 24 }));
  const attrs = 'data-width="400" data-height="300" data-fps="30" data-duration="2"';
  const body = (scrollStyle) => `<div id="clock" style="font:600 40px Inter;color:#fff"></div>
    <div id="b" style="position:absolute;left:20px;top:80px;width:200px;height:100px;overflow:auto;${scrollStyle}"><div style="height:3000px;background:repeating-linear-gradient(#f00 0 20px,#00f 20px 40px)"></div></div>
    <img loading="lazy" src="pic.png" style="position:absolute;left:5000px;top:10px;width:64px">
    <svg width="400" height="40" style="position:absolute;left:0;top:250px"><circle cy="20" r="12" fill="#4ade80"><animate attributeName="cx" from="20" to="380" dur="2s" fill="freeze"/></circle></svg>
    <script>document.getElementById('clock').textContent = new Date().toString().slice(16, 24);
    gm.onFrame((t) => { document.getElementById('b').scrollTop = Math.round(t * 400); });</script>`;
  const plain = comp(d, 'plain.html', body(''), attrs), smooth = comp(d, 'smooth.html', body('scroll-behavior:smooth'), attrs);
  const grab = async (f, tz) => { const old = process.env.TZ; process.env.TZ = tz; try { return (await stills(f, [0.5, 1.5])).buffers.map((b) => md5buf(b)); } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old; } };
  const utc = await grab(plain, 'UTC');
  assert.deepEqual(await grab(plain, 'Asia/Tokyo'), utc, 'the frames follow the time zone of the computer');
  assert.deepEqual(await grab(smooth, 'UTC'), utc, 'a smooth scroll shows a different frame than an instant one');
  // a lazy image the page never scrolls to must not hold the render up (the wait for it never ended); the SVG circle
  // is at cx 20 + 360 * t / 2 s: 200 px at 1 s
  const out = join(d, 'f');
  await render(plain, { output: out, format: 'png', frames: '30-31', workers: 1, cache: false, ...quiet });
  const px = execFileSync(ffmpegPath(), ['-v', 'error', '-i', join(out, 'frame-000030.png'), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 26 });
  let n = 0, sx = 0;
  for (let y = 250; y < 290; y++) for (let x = 0; x < 400; x++) { const i = (y * 400 + x) * 3; if (px[i + 1] > 150 && px[i] < 120) { n++; sx += x; } }
  assert.ok(n > 0 && Math.abs(sx / n - 200) < 3, `the SVG animation is not on the video clock: circle at x ${n ? (sx / n).toFixed(0) : 'none'}, expected 200`);
});

test('4K with many composited layers: every tile is drawn (still and render match the same page on one layer)', { skip }, async () => {
  // 48 full-frame layers at --scale 2 need more tile memory than Chrome gives a tab by default; past the
  // limit the frame came out with blank or stale rectangles. The same page without will-change paints into one layer.
  const d = tmp();
  const layers = (deep) => Array.from({ length: 48 }, (_, i) => `<div style="position:absolute;inset:0;opacity:.9;${deep ? 'will-change:transform;' : ''}background:repeating-linear-gradient(${(i * 37) % 180}deg,hsl(${(i * 53) % 360} 80% 50%) 0 ${7 + (i % 5)}px,hsl(${(i * 53 + 180) % 360} 80% 40%) 0 ${14 + (i % 7)}px)"></div>`).join('');
  const attrs = 'data-width="1920" data-height="1080" data-fps="30" data-duration="0.1"';
  const deep = comp(d, 'deep.html', layers(true), attrs), flat = comp(d, 'flat.html', layers(false), attrs);
  const rgb = (buf) => execFileSync(ffmpegPath(), ['-v', 'error', '-i', '-', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { input: buf, maxBuffer: 1 << 26 });
  const off = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 3) if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > 24) n++; return n / (a.length / 3); };
  const ref = rgb((await stills(flat, [0], { scale: 2 })).buffers[0]);
  const still = rgb((await stills(deep, [0], { scale: 2 })).buffers[0]);
  assert.ok(off(still, ref) < 0.001, `still: ${(off(still, ref) * 100).toFixed(1)}% of the pixels are wrong`);
  const out = join(d, 'frames');
  await render(deep, { output: out, format: 'png', scale: 2, frames: '0-2', workers: 1, cache: false, ...quiet });
  for (const fr of readdirSync(out).filter((x) => x.endsWith('.png'))) {
    const got = rgb(readFileSync(join(out, fr)));
    assert.ok(off(got, ref) < 0.001, `render ${fr}: ${(off(got, ref) * 100).toFixed(1)}% of the pixels are wrong`);
  }
});

test('video frames are exact and <video> keeps its CSS', { skip }, async () => {
  const d = tmp();
  mkdirSync(join(d, 'media'));
  // *.mp4 is not committed: make the test clip (moving picture + a tone) when it is missing
  const clip = join(HERE, 'fixtures', 'media', 'clip.mp4');
  if (!existsSync(clip)) {
    mkdirSync(dirname(clip), { recursive: true });
    execFileSync(ffmpegPath(), ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=30:duration=5', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', clip]);
  }
  copyFileSync(clip, join(d, 'media', 'clip.mp4'));
  const f = comp(d, 'v.html', `<video src="media/clip.mp4" data-start="0.5" data-from="2" style="position:absolute;left:0;top:0;width:640px;height:360px;object-fit:fill"></video>`, 'data-width="640" data-height="360" data-fps="30" data-duration="2"');
  const r = await stills(f, [0.5, 1.5]);
  assert.equal(r.buffers.length, 2);
  assert.ok(r.buffers[0].length > 1000);
  assert.notEqual(md5Buf(r.buffers[0]), md5Buf(r.buffers[1]));
  const out = join(d, 'v.mp4');
  const s = await render(f, { output: out, ...quiet });
  const p = probe(out);
  assert.ok(p.hasAudio, 'video audio is mixed in');
  assert.equal(s.pageErrors.length, 0);

  // A clip that starts between two frames and plays to the end of its file: the last frames round up to one
  // past the file's last frame (150 of a 5 s, 30 fps clip). They show the last frame instead of failing.
  const g = comp(d, 'end.html', `<video src="media/clip.mp4" data-start="0.51" data-from="2" style="position:absolute;left:0;top:0;width:640px;height:360px;object-fit:fill"></video>`, 'data-width="640" data-height="360" data-fps="30" data-duration="3.6"');
  const e = await stills(g, [3.4, 3.5]);
  assert.deepEqual([...(e.info.issues || []).filter((i) => i.severity === 'error'), ...(e.errors || [])].map((i) => i.message), []);
  assert.ok(e.buffers[1].length > 1000);
});
const md5Buf = (b) => createHash('md5').update(b).digest('hex');

test('check finds the classic layout problems', { skip }, async () => {
  const rep = await check(join(HERE, 'fixtures', 'bad.html'));
  const codes = new Set(rep.issues.map((i) => i.code));
  for (const c of ['text-clipped', 'text-offscreen', 'low-contrast', 'tiny-text', 'text-overlap', 'text-overflows-box', 'image-broken', 'bad-enter']) assert.ok(codes.has(c), 'missing ' + c);
  assert.equal(rep.ok, false);
});

test('check fails fast with a clear message when the page script never returns', { skip }, async () => {
  const d = tmp();
  const f = comp(d, 'spin.html', `<h1>Hello</h1><script>setTimeout(() => { for (;;) {} }, 1000)</script>`, 'data-width="640" data-height="360" data-fps="30" data-duration="3"');
  const t0 = Date.now();
  await assert.rejects(check(f, { timeoutMs: 2000 }), /did not answer within 2 s at 1(\.\d+)? s: its own script is stuck/);
  assert.ok(Date.now() - t0 < 20000, `check took ${Date.now() - t0} ms`);
});

test('snapshot writes a contact sheet', { skip }, async () => {
  const d = tmp();
  const f = comp(d, 's.html', `<main data-sequence><section class="scene" data-duration="1"><h1>A</h1></section><section class="scene" data-duration="1"><h1>B</h1></section></main>`);
  const r = await snapshot(f, { output: join(d, 'snaps') });
  assert.ok(existsSync(r.sheet));
  assert.ok(r.times.length >= 2);
});

test('transparent ProRes keeps alpha', { skip: skip || (!ffmpegInfo()?.encoders.prores_ks && 'no prores') }, async () => {
  const d = tmp();
  const f = comp(d, 'a.html', `<div style="position:absolute;left:100px;top:100px;width:100px;height:100px;background:red"></div>`, 'data-width="320" data-height="240" data-duration="0.5"');
  writeFileSync(f, readFileSync(f, 'utf8').replace('background:#111;', 'background:transparent;'));
  const out = join(d, 'a.mov');
  await render(f, { output: out, transparent: true, ...quiet });
  assert.ok(probe(out).hasVideo);
});

test('every block renders without errors', { skip }, async () => {
  const d = tmp();
  const blocks = readdirSync(join(ROOT, 'blocks')).filter((b) => b.endsWith('.html'));
  const body = blocks.map((b, i) => `<section class="scene" data-duration="1"><gm-include src="blocks/${b}"></gm-include></section>`).join('\n');
  mkdirSync(join(d, 'blocks'));
  for (const b of blocks) copyFileSync(join(ROOT, 'blocks', b), join(d, 'blocks', b));
  writeFileSync(join(d, 'cap.json'), '[{"word":"hi","start":0,"end":0.5}]');
  // A tiny stand-in for lottie-web, so the test needs no network
  writeFileSync(join(d, 'fake-lottie.js'), 'window.lottie={loadAnimation(o){const h={};const a={frameRate:30,totalFrames:30,addEventListener(n,f){h[n]=f;if(n==="DOMLoaded")setTimeout(f,5)},goToAndStop(f){o.container.dataset.f=f}};return a}};');
  writeFileSync(join(d, 'anim.json'), '{}');
  const html = body.replace('src="blocks/captions.html"', 'src="blocks/captions.html" file="cap.json"').replace('src="blocks/lottie.html"', 'src="blocks/lottie.html" file="anim.json" lib="fake-lottie.js"')
    .replace('<gm-include src="blocks/highlight.html">', '<b id="hl-t" style="position:absolute;left:100px;top:100px">x</b><gm-include src="blocks/highlight.html" target="#hl-t">');
  const f = comp(d, 'blocks.html', `<main data-sequence>${html}</main>`, 'data-width="1280" data-height="720"');
  const info = await inspect(f);
  assert.deepEqual(info.issues.filter((i) => i.severity === 'error'), []);
  assert.deepEqual(info.pageErrors, []);
  assert.equal(info.duration, blocks.length);
});

test('examples pass check', { skip }, async () => {
  for (const ex of ['data-story', 'generative', 'personalized', 'bench']) {
    const rep = await check(join(ROOT, 'examples', ex, 'index.html'));
    assert.equal(rep.errors, 0, `${ex}: ${JSON.stringify(rep.issues.filter((i) => i.severity === 'error'))}`);
  }
});
