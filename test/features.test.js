// Tests for motion tools, React mode, audio analysis and the checker's motion handling.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, mkdirSync, copyFileSync, symlinkSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { findChrome } from '../src/browser.js';
import { ffmpegInfo, ffmpegPath } from '../src/ffmpeg.js';
import { render, check, inspect, openComposition } from '../src/api.js';
import { formatReport } from '../src/check.js';

const skip = !findChrome() || !ffmpegInfo() ? 'needs Chrome and ffmpeg' : false;
const tmp = () => mkdtempSync(join(TMP, 'feat-'));
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const quiet = { quiet: true, log: () => {} };
const page = (body, attrs = 'data-width="640" data-height="360" data-fps="30"') => `<!doctype html><html ${attrs}><head><style>body{background:#111;color:#fff;font-family:sans-serif}</style></head><body>${body}</body></html>`;
async function evalAt(file, t, expr) {
  const ctx = await openComposition(file, { mode: 'render' });
  try { await ctx.page.seek(t); return await ctx.page.evaluate(expr); } finally { await ctx.page.close(); await ctx.server.close(); }
}

test('timeline: from/to/stagger values at exact times', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<div data-duration="3"><i class="b" style="display:block;width:10px;height:10px"></i><i class="b" style="display:block;width:10px;height:10px"></i></div>
    <script>gm.timeline().fromTo('.b', { x: 0, opacity: 0 }, { x: 100, opacity: 1, duration: 1, ease: 'linear', stagger: 0.5 }, 0);</script>`));
  const v = await evalAt(f, 0.5, `[...document.querySelectorAll('.b')].map(e => [Math.round(new DOMMatrix(getComputedStyle(e).transform).e), +getComputedStyle(e).opacity])`);
  assert.deepEqual(v, [[50, 0.5], [0, 0]]);
});

test('audio: beat grid lands on the kicks of a 120 BPM click track', { skip }, async () => {
  const d = tmp(), wav = join(d, 'clicks.wav');
  // 120 BPM kicks (low thumps) starting at 0.25s, with quieter high clicks between them
  execFileSync(ffmpegPath(), ['-v', 'error', '-y', '-f', 'lavfi', '-i', "aevalsrc='0.9*sin(2*PI*60*t)*exp(-30*mod(t-0.25+10,0.5))*gte(t,0.25)+0.3*sin(2*PI*4000*t)*exp(-80*mod(t+10,0.5))*gte(t,0.5):s=22050:d=8'", wav]);
  const f = join(d, 'a.html');
  writeFileSync(f, page(`<audio id="m" src="clicks.wav"></audio><script>window.m = gm.audio('#m');</script>`, 'data-width="320" data-height="180" data-duration="8"'));
  const r = await evalAt(f, 0, `(async () => { await m.ready; return { bpm: m.bpm, beats: m.beats.slice(0, 4) }; })()`);
  assert.ok(Math.abs(r.bpm - 120) < 1, 'bpm ' + r.bpm);
  assert.ok(Math.abs(r.beats[0] - 0.25) < 0.02, 'first beat ' + r.beats[0]);
  assert.ok(Math.abs(r.beats[1] - 0.75) < 0.02, 'second beat ' + r.beats[1]);
});

test('check: text flying in from off-screen is not an error; text stuck off-screen is', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<div data-duration="3"><h1 id="fly" style="position:absolute;left:100px;top:40px;font-size:40px;margin:0">Flying in</h1>
    <h1 id="stuck" style="position:absolute;left:560px;top:200px;font-size:40px;margin:0;white-space:nowrap">Stuck half out</h1></div>
    <script>gm.timeline().from('#fly', { x: 900, duration: 1.2, ease: 'power2.out' }, 0.3);</script>`));
  const rep = await check(f);
  const off = rep.issues.filter((i) => i.code === 'text-offscreen');
  assert.ok(off.some((i) => i.selector === '#stuck'), 'stuck text should be reported');
  assert.ok(!off.some((i) => i.selector === '#fly'), 'flying text should not be reported');
});

test('typewriter: every letter appears where it stays (centred text does not drift, a word does not jump lines)', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<p id="t" data-type="14" data-type-caret style="position:absolute;left:60px;top:40px;width:200px;text-align:center;font:600 24px Inter;margin:0">Extraordinarily synchronised workflows keep teams calm.</p>`, 'data-width="640" data-height="360" data-fps="30" data-duration="5"'));
  // where the first letter and the first letter of the last word are, with 4 letters typed and with all of them
  const at = (t) => evalAt(f, t, `(() => { const el = document.getElementById('t'); const pos = (node, i) => { const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + 1); const b = r.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top)]; };
    const rest = el.querySelector('.gm-rest').firstChild; const w = el.textContent.lastIndexOf('calm'); const typed = el.firstChild.length;
    return { typed, first: pos(el.firstChild, 0), last: w < typed ? pos(el.firstChild, w) : pos(rest, w - typed), height: el.getBoundingClientRect().height }; })()`);
  const early = await at(0.3), late = await at(4.5);
  assert.ok(early.typed < 6 && late.typed > 50, `typed ${early.typed} then ${late.typed}`);
  assert.deepEqual(early.first, late.first, 'the first letter moved while typing');
  assert.deepEqual(early.last, late.last, 'the last word moved while typing');
  assert.equal(early.height, late.height, 'the box changed size while typing');
});

test('check: text that jumps up and down because something next to it changes the line height is reported (a one-time reflow, a smooth bob and an opacity blink are not)', { skip }, async () => {
  const d = tmp();
  const make = (name, script) => { const f = join(d, name + '.html'); writeFileSync(f, page(`<style>#b{position:absolute;left:60px;top:100px;width:500px;line-height:1;font:600 30px Inter}#c{display:inline-block;width:3px;height:1.8em;background:#fff;margin-left:4px}</style>
    <div id="b"><span id="s">Every morning</span><span id="c"></span></div><script>${script}</script>`, 'data-width="640" data-height="360" data-fps="30" data-duration="4"')); return f; };
  const blink = (prop, on, off) => `const tl = gm.timeline(); for (let i = 0; i < 8; i++) tl.set('#c', { ${prop}: i % 2 ? '${on}' : '${off}' }, 0.5 * i);`;
  const codes = async (f) => (await check(f)).issues.filter((i) => i.code === 'layout-shift');
  const wobble = await codes(make('wobble', blink('height', '1.8em', '0em')));
  assert.equal(wobble.length, 1, 'a caret that changes the line height should be reported once');
  assert.equal(wobble[0].selector, '#s');
  assert.deepEqual(await codes(make('opacity', blink('opacity', '1', '0'))), [], 'an opacity blink does not move the text');
  assert.deepEqual(await codes(make('once', `gm.timeline().set('#c', { height: '0em' }, 2);`)), [], 'a reflow that happens once is not a wobble');
  assert.deepEqual(await codes(make('bob', `gm.timeline().to('#b', { top: 130, duration: 1, repeat: 3, yoyo: true, ease: 'sine.inOut' }, 0);`)), [], 'a smooth bob is not a wobble');
});

test('check: a font that is neither loaded nor installed is reported once; bundled, declared and generic fonts are not', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<style>@font-face{font-family:Gone;src:url(nope.woff2) format('woff2')}</style><div data-duration="2" style="font-size:40px">
    <p id="a" style="font-family:Poppins,sans-serif">Poppins</p><p id="b" style="font-family:Poppins,sans-serif">Poppins again</p>
    <p id="c" style="font-family:Gone,serif">Declared, file missing</p>
    <p id="d" style="font-family:Inter">Bundled</p><p id="e" style="font-family:'JetBrains Mono',monospace">Bundled mono</p><p id="g" style="font-family:system-ui">Generic</p></div>`));
  const rep = await check(f);
  const fonts = rep.issues.filter((i) => i.code === 'font-unavailable');
  assert.deepEqual(fonts.map((i) => i.selector).sort(), ['#a', '#c'], 'only the first element of a missing family, and a declared font whose file is missing');
});

test('data-cuts sets scene starts; data-fit="grow" fills the width', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<main data-sequence data-cuts="0 1 2.5" data-transition="fade 0.2"><section class="scene">A</section><section class="scene">B</section><section class="scene" data-duration="1"><div id="w" style="width:500px"><div id="g" data-fit="grow" style="font-size:20px">Fill me</div></div></section></main>`));
  const info = await inspect(f);
  assert.deepEqual(info.clips.map((c) => c.start), [0, 1, 2.5]);
  const w = await evalAt(f, 2.6, `document.getElementById('g').scrollWidth`);
  assert.ok(Math.abs(w - 500) <= 2, 'width ' + w);
});

test('gm.random(seed) is stable per seed and differs across seeds', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<div data-duration="1"></div>`));
  const r = await evalAt(f, 0, `[gm.random('a'), gm.random('a'), gm.random('b'), gm.random(3)]`);
  assert.equal(r[0], r[1]);
  assert.notEqual(r[0], r[2]);
  assert.ok(r.every((x) => x >= 0 && x < 1));
});

test('timeline: two timelines on one element, newest tween wins; CSS centering kept while hidden', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<main data-sequence><section data-duration="1"></section><section id="s1" data-duration="4" style="position:relative">
    <div id="a" style="position:absolute;left:300px;width:100px;height:40px;transform:translateX(-50%)"></div></section></main>
    <script>gm.timeline('#s1').to('#a', { scaleX: 0.2, duration: 0.5 }, 0.5); gm.timeline('#s1').fromTo('#a', { scaleX: 0 }, { scaleX: 1, duration: 0.5 }, 2);</script>`, 'data-width="640" data-height="360" data-fps="30"'));
  const m = await evalAt(f, 4, `(() => { const m = new DOMMatrix(getComputedStyle(document.getElementById('a')).transform); return [m.a, m.e]; })()`);
  assert.deepEqual(m, [1, -50]);
  const m2 = await evalAt(f, 2.6, `new DOMMatrix(getComputedStyle(document.getElementById('a')).transform).a`);
  assert.equal(m2, 0.2);
});

test('timeline: counting keeps the number format; travel moves SVG shapes', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<div data-duration="3"><b id="n1">000</b> <b id="n2">$0.00</b> <b id="n3">0</b>
    <svg width="640" height="360"><path id="p" d="M100 100 L500 100" fill="none" stroke="#fff"/><circle id="c" cx="20" cy="20" r="10" fill="red"/></svg></div>
    <script>gm.timeline().to('#n1', { textContent: 42, duration: 1 }).to('#n2', { textContent: 4.5, duration: 1 }, 0).to('#n3', { textContent: -12, duration: 1 }, 0);
    gm.path.travel('#c', '#p', { stops: [[0, 0], [2, 1]], ease: 'linear' });</script>`));
  const v = await evalAt(f, 1.5, `[n1.textContent, n2.textContent, n3.textContent, Math.round(c.getBoundingClientRect().left + 10 - p.getBoundingClientRect().left)]`);
  assert.deepEqual(v.slice(0, 3), ['042', '$4.50', '−12']);
  assert.ok(Math.abs(v[3] - 300) <= 3, 'circle at ' + v[3]);
});

test('render keeps parts: editing one scene redoes only its parts, and the result equals a full render byte for byte', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  const scenes = (word) => `<main data-sequence data-transition="fade 0.3">${['#225', '#522', '#252', '#552'].map((c, i) => `<section class="scene" data-duration="1.5" style="background:${c};display:grid;place-items:center"><h1 data-enter="rise" style="font-size:60px">${i === 2 ? word : 'Scene ' + i}</h1></section>`).join('')}</main>`;
  writeFileSync(f, page(scenes('Hello')));
  const out = join(d, 'out', 'v.mp4');
  const r1 = await render(f, { output: out, ...quiet });
  assert.equal(r1.parts.reused, 0);
  writeFileSync(f, page(scenes('Changed')));
  const r2 = await render(f, { output: out, ...quiet });
  assert.ok(r2.parts.reused >= 2 && r2.parts.rendered >= 1, JSON.stringify(r2.parts));
  const full = join(d, 'full.mp4');
  await render(f, { output: full, cache: false, workers: 1, ...quiet });
  assert.ok(readFileSync(out).equals(readFileSync(full)), 'patched video differs from a full render');
  const r3 = await render(f, { output: out, redo: '0s-1s', ...quiet });
  assert.equal(r3.parts.rendered, 1);
});

// one long camera-world scene (6 parts of 1 s): late things are a written label, a nested clip and a sketched shape
// (the camera only pans: a zoom that animates leaves Chrome's raster a little different in a fresh worker, see docs/NEXT.md)
const longScene = ({ label = 'later', note = 'note', shape = 'x="600" y="80"', target = { x: 640, y: 380 }, flow = 'first' } = {}) => page(`<section class="scene" data-duration="6" style="background:#fbfaf6;color:#1e1e1e">
  <div id="world" style="position:absolute;left:0;top:0;width:1200px;height:700px">
    <div id="txt" style="position:absolute;left:40px;top:40px;width:420px"><p style="margin:0;font-size:30px" data-enter="fade 0.5 2.5">${flow}</p><p style="margin:0;font-size:30px">second</p></div>
    <div id="a" style="position:absolute;left:60px;top:160px;width:160px;height:80px;background:#1971c2"></div>
    <div id="b" style="position:absolute;left:420px;top:300px;width:160px;height:80px;background:#e8590c" data-enter="fade 0.5 1"></div>
    <div id="late" style="position:absolute;left:640px;top:420px;font:40px Caveat" data-enter="write 0.6 4.2">${label}</div>
    <div data-start="3.4" style="position:absolute;left:80px;top:440px;font-size:28px"><span>${note}</span></div>
    <svg viewBox="0 0 1200 700" style="position:absolute;inset:0;width:1200px;height:700px" data-sketch><rect ${shape} width="200" height="100" fill="#ffd8a8" stroke="#1e1e1e" stroke-width="5" data-enter="draw 0.8 3.6"/></svg>
  </div></section>
  <script>gm.camera('#world').shot(0, { center: { x: 600, y: 350 }, zoom: 0.5 }).shot(2, { center: ${JSON.stringify(target)}, zoom: 0.5, duration: 1 }); gm.connect('#a', '#b', { sketch: true });</script>`);

test('render keeps parts inside one long scene: editing an element that appears late keeps the parts before it, byte for byte', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html'), out = join(d, 'out', 'v.mp4');
  writeFileSync(f, longScene());
  const r1 = await render(f, { output: out, ...quiet });
  assert.equal(r1.parts.total, 6);
  assert.equal(r1.parts.lateOff, null);
  assert.equal(r1.parts.late, 3, JSON.stringify(r1.parts));
  const same = async (opts, label) => {
    writeFileSync(f, longScene(opts));
    const r = await render(f, { output: out, ...quiet });
    const full = join(d, 'full.mp4');
    await render(f, { output: full, cache: false, workers: 1, ...quiet });
    assert.ok(readFileSync(out).equals(readFileSync(full)), label + ': patched video differs from a full render');
    return r.parts;
  };
  // the label is written at 4.2 s: parts 0-3 s stay
  let p = await same({ label: 'much later' }, 'label');
  assert.equal(p.reused, 4, 'label ' + JSON.stringify(p));
  // the nested clip starts at 3.4 s, the sketched rect is drawn from 3.6 s: parts 0-2 s stay
  p = await same({ label: 'much later', note: 'a new note' }, 'nested clip');
  assert.equal(p.reused, 3, 'nested clip ' + JSON.stringify(p));
  p = await same({ label: 'much later', note: 'a new note', shape: 'x="640" y="60"' }, 'sketched shape');
  assert.equal(p.reused, 3, 'shape ' + JSON.stringify(p));
});

test('render keeps parts inside one long scene: a camera target or an element in the flow redoes the whole scene', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html'), out = join(d, 'out', 'v.mp4');
  // #late becomes a camera target: the camera moves to it from 2 s, so it is not late any more
  writeFileSync(f, longScene({ target: '#late' }));
  const r1 = await render(f, { output: out, ...quiet });
  assert.equal(r1.parts.late, 2, JSON.stringify(r1.parts));
  writeFileSync(f, longScene({ target: '#late', label: 'a much longer label now' }));
  const r2 = await render(f, { output: out, ...quiet });
  assert.equal(r2.parts.reused, 0, 'camera target ' + JSON.stringify(r2.parts));
  // a paragraph in normal flow that fades in at 2.5 s: its size moves the line under it, which shows from the start
  writeFileSync(f, longScene({ target: '#late', label: 'a much longer label now', flow: 'a first line that is long enough to wrap' }));
  const r3 = await render(f, { output: out, ...quiet });
  assert.equal(r3.parts.reused, 0, 'in-flow element ' + JSON.stringify(r3.parts));
  const full = join(d, 'full.mp4');
  await render(f, { output: full, cache: false, workers: 1, ...quiet });
  assert.ok(readFileSync(out).equals(readFileSync(full)), 'patched video differs from a full render');
  // a sketched shape added inside the late nested clip moves the seeds of the sketched shapes after it in the page,
  // here a rect that shows from the start: the scene's live print changes, so nothing is reused
  const early = 'x="600" y="80" data-enter="none"';
  writeFileSync(f, longScene({ shape: early }));
  await render(f, { output: out, ...quiet });
  writeFileSync(f, longScene({ shape: early, note: 'note <svg data-sketch width="100" height="50"><rect x="2" y="2" width="60" height="30" stroke="#000" fill="none"/></svg>' }));
  const r4 = await render(f, { output: out, ...quiet });
  assert.equal(r4.parts.reused, 0, 'seeds ' + JSON.stringify(r4.parts));
  await render(f, { output: full, cache: false, workers: 1, ...quiet });
  assert.ok(readFileSync(out).equals(readFileSync(full)), 'seeds: patched video differs from a full render');
});

test('sketch: data-sketch shapes are rough, seeded and keep their id; gm.connect follows a moving element', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<div data-duration="3" style="position:absolute;inset:0"><svg viewBox="0 0 640 360" style="position:absolute;inset:0" data-sketch>
    <rect id="r" x="20" y="20" width="200" height="100" fill="#fd0" stroke="#000" stroke-width="3"/></svg>
    <div id="a" style="position:absolute;left:20px;top:200px;width:80px;height:40px;background:#333"></div>
    <div id="b" style="position:absolute;left:400px;top:200px;width:80px;height:40px;background:#333"></div></div>
    <script>gm.timeline().to('#b', { y: 100, duration: 1, ease: 'linear' }, 0); gm.connect('#a', '#b', { head: 'none' });</script>`));
  const v = await evalAt(f, 1.5, `(() => { const r = document.getElementById('r'); const p = document.querySelector('.gm-connect path').getAttribute('d').match(/-?[\\d.]+/g).map(Number);
    return { tag: r.tagName, paths: r.querySelectorAll('path').length, same: gm.sketch.rect(0, 0, 100, 50, { seed: 3 }) === gm.sketch.rect(0, 0, 100, 50, { seed: 3 }), differ: gm.sketch.rect(0, 0, 100, 50, { seed: 3 }) !== gm.sketch.rect(0, 0, 100, 50, { seed: 4 }), end: p.slice(-2) }; })()`);
  assert.equal(v.tag, 'g');
  assert.equal(v.paths, 4, 'hatching + two passes + the hidden guide');
  assert.ok(v.same && v.differ);
  // the line ends on the left edge of #b (moved down by 100px) minus the gap (10px at 1080p = 3.3px here)
  assert.ok(Math.abs(v.end[0] - 396.8) < 2 && Math.abs(v.end[1] - 308.6) < 2, 'end ' + v.end);
});

test('analyze: finds a hard cut and a fade with their times, and the colors', { skip }, async () => {
  const { analyzeVideo } = await import('../src/analyze.js');
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<main data-sequence><section class="scene" data-duration="1.5" style="background:#1b2a6b"></section><section class="scene" data-duration="1.5" style="background:#c0392b"></section><section class="scene" data-duration="1.5" data-transition="fade 0.5" style="background:#16a085"></section></main>`));
  const out = join(d, 'v.mp4');
  await render(f, { output: out, ...quiet });
  const r = await analyzeVideo(out, { output: join(d, 'an'), sheets: false, audio: false });
  assert.equal(r.transitions.length, 2, JSON.stringify(r.transitions));
  assert.equal(r.transitions[0].type, 'cut');
  assert.ok(Math.abs(r.transitions[0].at - 1.5) < 0.05, 'cut at ' + r.transitions[0].at);
  assert.equal(r.transitions[1].type, 'fade');
  // the fade runs 2.5-3.0 s with the default out-expo easing, so it is visually half done early in that window
  assert.ok(r.transitions[1].at >= 2.45 && r.transitions[1].at <= 2.8, 'fade at ' + r.transitions[1].at);
  assert.equal(r.shots.length, 3);
  assert.equal(r.colors.theme, 'dark');
});

test('analyze: on one shared background, small content that is pushed, wiped and cut is found and named', { skip }, async () => {
  // the scene changes only touch small cards; the gradient behind them stays (bench/analyze has the bigger benchmark)
  const { analyzeVideo } = await import('../src/analyze.js');
  const d = tmp(), f = join(d, 'a.html');
  const card = (x, y, c, t) => `<div style="position:absolute;left:${x}px;top:${y}px;width:190px;padding:14px;border-radius:12px;background:${c};font:700 30px sans-serif;color:#fff">${t}<div style="height:10px;margin-top:10px;width:120px;background:#fff8;border-radius:5px"></div></div>`;
  writeFileSync(f, `<!doctype html><html data-width="640" data-height="360" data-fps="30"><head><style>body{margin:0;background:linear-gradient(135deg,#1d2b64,#5b247a);color:#fff}</style></head><body>
<main data-sequence>
<section class="scene" data-duration="2">${card(60, 60, '#e76f51', 'One')}</section>
<section class="scene" data-duration="2" data-transition="push-left 0.5">${card(360, 170, '#2a9d8f', 'Two')}</section>
<section class="scene" data-duration="2" data-transition="wipe-right 0.6">${card(80, 200, '#e9c46a', 'Three')}${card(380, 40, '#264653', 'Four')}</section>
<section class="scene" data-duration="1.5">${card(220, 120, '#8338ec', 'Five')}</section>
</main></body></html>`);
  const out = join(d, 'v.mp4');
  await render(f, { output: out, ...quiet });
  const r = await analyzeVideo(out, { output: join(d, 'an'), sheets: false, audio: false });
  assert.deepEqual(r.transitions.map((t) => t.type), ['push-left', 'wipe-right', 'cut'], JSON.stringify(r.transitions));
  // push 1.5-2.0, wipe 2.9-3.5, cut at 4.9
  for (const [t, at] of r.transitions.map((t, i) => [t, [1.75, 3.2, 4.9][i]])) assert.ok(Math.abs(t.at - at) <= 0.25, `${t.type} at ${t.at}`);
});

test('determinism: a line drawing on in a zoomed world is the same with 1 and 3 workers (no partial raster)', { skip }, async () => {
  // this exact page gave one frame that differed by a pixel or two with partial raster on
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, `<!doctype html><html data-width="1280" data-height="720" data-fps="30"><head><style>
body{background:#fbfaf6;color:#1e1e1e;font-family:Caveat}
.card{position:absolute;padding:24px 34px;font-size:44px;border:4px solid #1971c2;background:#fff}
</style></head><body>
<section class="scene" data-duration="4"><div id="world" style="position:absolute;left:0;top:0;width:2000px;height:1200px;transform-origin:0 0;transform:translate(-68.8534px,54.394px) scale(1.0885)">
<div class="card" id="c1" style="left:100px;top:100px" data-enter="fade 0.4 0.2">browser</div>
<p style="position:absolute;left:100px;top:320px;font-size:56px;margin:0;width:700px" data-enter="write 1 0.5">The address is <span id="ip">93.184.216.34</span> and it is <span>fast</span>, <span>really</span>.</p>
<svg viewBox="0 0 2000 1200" style="position:absolute;inset:0;width:2000px;height:1200px" data-sketch><rect x="900" y="100" width="300" height="160" fill="#ffd8a8" stroke="none" data-enter="draw 1 0.3"/><line x1="900" y1="400" x2="1200" y2="400" stroke="#1e1e1e" stroke-width="6" data-enter="draw 1 2"/></svg>
</div></section>
</body></html>`);
  const a = join(d, 'a'), b = join(d, 'b');
  await render(f, { output: a, workers: 1, ...quiet });
  await render(f, { output: b, workers: 3, ...quiet });
  const fa = readdirSync(a).sort();
  const diff = fa.filter((x) => !readFileSync(join(a, x)).equals(readFileSync(join(b, x))));
  assert.deepEqual(diff, []);
});

test('code-window: ⟦marks⟧ on later lines wrap the right text and keep one element per line', { skip }, async () => {
  const d = tmp();
  mkdirSync(join(d, 'blocks'));
  copyFileSync(join(ROOT, 'blocks', 'code-window.html'), join(d, 'blocks', 'code-window.html'));
  const f = join(d, 'a.html');
  writeFileSync(f, page(`<section class="scene" data-duration="1"><gm-include src="blocks/code-window.html" lang="js">function f() {
  let timer;
  ⟦clearTimeout(timer);⟧
  timer = ⟦setTimeout⟧(go, 300);
}</gm-include></section>`));
  const r = await evalAt(f, 0.5, `({ marks: [...document.querySelectorAll('.gm-mark')].map((m) => [m.textContent, m.closest('.gm-line').dataset.line]), lines: document.querySelectorAll('.gm-line').length })`);
  assert.deepEqual(r, { marks: [['clearTimeout(timer);', '3'], ['setTimeout', '4']], lines: 5 });
});

test('check: a line through text is found (also dashed), not when an opaque panel covers it; SVG text is judged by its fill', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<svg viewBox="0 0 640 360" style="position:absolute;inset:0;width:640px;height:360px"><line x1="0" y1="60" x2="640" y2="60" stroke="#333" stroke-width="4"/><line x1="0" y1="262" x2="640" y2="262" stroke="#333" stroke-width="4" stroke-dasharray="12 6"/>
    <rect x="400" y="130" width="160" height="60" fill="#1c2333"/><text id="btn" x="480" y="170" text-anchor="middle" font-size="30" fill="#fff">Order</text></svg>
    <div style="position:absolute;left:20px;top:30px;width:300px;height:60px;background:#fff"><p id="hud" style="margin:0;font-size:30px;line-height:60px;color:#222">Step one</p></div>
    <p id="bad" style="position:absolute;left:340px;top:244px;margin:0;font-size:30px;color:#fff">Crossed out</p>`, 'data-width="640" data-height="360" data-fps="30" data-duration="2"'));
  const rep = await check(f);
  const by = (code) => rep.issues.filter((i) => i.code === code).map((i) => i.selector);
  assert.deepEqual(by('text-over-line'), ['#bad']);
  assert.deepEqual(by('low-contrast'), []);
});

test('check: text under the clear part of a gradient mask is hidden (a world fading out at the top, a vignette); text the mask shows is still judged', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  // one world, scaled down by a camera-like transform, with a fade at the top and a round vignette on a card in it
  writeFileSync(f, page(`<div style="position:absolute;left:0;top:0;width:1280px;height:720px;transform:scale(0.5);transform-origin:0 0;mask-image:linear-gradient(to bottom,transparent 0,transparent 160px,#000 260px)">
      <svg style="position:absolute;left:0;top:0" width="1280" height="720"><path d="M40 80 L1240 80 M40 440 L1240 440" stroke="#ddd" stroke-width="6"/></svg>
      <p id="faded" style="position:absolute;left:200px;top:52px;margin:0;font-size:56px;color:#fff">Faded away</p>
      <p id="shown" style="position:absolute;left:200px;top:412px;margin:0;font-size:56px;color:#fff">Crossed out</p>
      <div style="position:absolute;left:760px;top:180px;width:440px;height:500px;mask-image:radial-gradient(circle at 50% 50%, #000 120px, transparent 160px)">
        <svg style="position:absolute;left:0;top:0" width="440" height="500"><path d="M0 40 L440 40" stroke="#ddd" stroke-width="6"/></svg>
        <p id="corner" style="position:absolute;left:10px;top:12px;margin:0;font-size:56px;color:#fff">Corner</p>
      </div></div>`, 'data-width="640" data-height="360" data-fps="30" data-duration="2"'));
  const rep = await check(f);
  assert.deepEqual(rep.issues.filter((i) => i.code === 'text-over-line').map((i) => i.selector), ['#shown']);
});

test('check on several browsers gives the same report as on one (units, warm-ups, merged state)', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  // 20 s: five units; scenes with moving and fading text, a counter, a clip-path reveal, low contrast, a cut with no
  // exit, a display: contents include, logs, a mask, and a stepped move on something big
  const scene = (k) => `<section class="scene" data-duration="4" style="background:${k % 2 ? '#123' : '#eee'}">
      <h1 style="position:absolute;left:40px;top:40px;margin:0;font-size:44px;color:${k % 2 ? '#fff' : '#ddd'}" data-enter="rise 0.5 ${0.2 + k * 0.1}">Scene ${k} title</h1>
      <p style="position:absolute;left:40px;top:120px;margin:0;font-size:30px;color:#888" data-count="0 ${100 * k}" data-start="1" data-duration="2">0</p>
      <div style="position:absolute;left:300px;top:110px;width:280px;height:120px;background:#c33;clip-path:inset(0 100% 0 0)" data-enter="wipe-right 0.6 1.2"><p style="margin:10px;font-size:28px;color:#fff">Revealed ${k}</p></div>
      <span id="gone${k}" style="position:absolute;left:40px;top:250px;font-size:34px;color:#fff;background:#000" data-start="0.5" data-duration="${1.5 + k * 0.3}">Gone without exit</span>
      <div style="position:absolute;left:0;top:280px;width:640px;height:80px;mask-image:linear-gradient(to right,transparent 0,transparent 300px,#000 400px)"><p style="margin:0;font-size:30px;color:#fff;background:#000;padding:4px 40px">masked away … shown here</p></div>
    </section>`;
  writeFileSync(f, page(`<main data-sequence data-transition="slide-left 0.4">${[0, 1, 2, 3, 4, 5].map(scene).join('')}</main>
    <div id="big" style="position:absolute;left:0;top:0;width:640px;height:200px;background:rgba(0,0,0,.02);animation:jump 2s steps(4) infinite"></div>
    <style>@keyframes jump { to { transform: translateX(100px) } }</style>
    <script>gm.onFrame((t) => { if (Math.abs(t - 7.5) < 0.05) gm.log('half way'); });</script>`, 'data-width="640" data-height="360" data-fps="30"'));
  const one = await check(f, { workers: 1 }), three = await check(f, { workers: 3 });
  assert.ok(one.issues.length >= 3, 'a report with something in it: ' + one.issues.map((i) => i.code).join(', '));
  assert.deepEqual(three, one);
  // (the pacing issues still name their element after the merge)
  assert.ok(one.issues.filter((i) => /^(short-hold|cut-exit|sliver-start)$/.test(i.code)).every((i) => typeof i.selector === 'string'), 'pacing issues keep their selectors');
});

test('check still: small labels fading in do not keep a frozen picture moving, a card entering does; data-check="pace-ignore" leaves captions out', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  const still = async (body) => {
    writeFileSync(f, page(`<h1 style="position:absolute;left:40px;top:120px;font-size:48px;margin:0">A big still page</h1>${body}`, 'data-width="640" data-height="360" data-fps="30" data-duration="9"'));
    return (await check(f)).issues.filter((i) => i.code === 'still').map((i) => [i.time, i.until]);
  };
  const notes = [2.2, 4.4, 6.6].map((t, i) => `<span style="position:absolute;left:520px;top:${300 + i * 18}px;font-size:12px" data-start="${t}" data-enter="fade 0.3">note ${i}</span>`).join('');
  assert.deepEqual(await still(notes), [[0, 9]], 'three small notes: still all along');
  const card = `<div style="position:absolute;left:330px;top:40px;width:260px;height:200px;background:#2a6" data-start="4.4" data-enter="rise 0.5"></div>`;
  const r = await still(notes + card);
  assert.ok(r.length === 2 && r[0][1] <= 4.6 && r[1][0] >= 4.4, 'the card breaks the stretch in two: ' + JSON.stringify(r));
  // a caption line that changes every 0.3 s over the still picture
  const caps = (attr) => `<p ${attr} style="position:absolute;left:0;right:0;bottom:20px;text-align:center;font-size:40px;margin:0"><span id="cap"></span></p><script>gm.onFrame((t) => { document.getElementById('cap').textContent = ['so', 'this', 'is', 'how', 'it', 'works'][Math.floor(t / 0.3) % 6]; });</script>`;
  assert.deepEqual(await still(caps('')), [], 'captions change the picture');
  assert.deepEqual(await still(caps('data-check="pace-ignore"')), [[0, 9]], 'pace-ignore: the picture under them is still');
});

test('timeline: a tween starting on a frame shows its start values there, even when float error puts the frame a hair early', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  // 0.1 + 0.2 = 0.30000000000000004: the third scene starts just after the frame at 0.3 s
  writeFileSync(f, page(`<main data-sequence><section class="scene" data-duration="0.1"></section><section class="scene" data-duration="0.2"></section>
    <section class="scene" id="c" data-duration="1"><b id="x" style="display:block">X</b></section></main>
    <script>gm.timeline('#c').fromTo('#x', { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0);</script>`));
  assert.equal(await evalAt(f, 0.3, `getComputedStyle(document.getElementById('x')).opacity`), '0');
});

test('timeline: fromTo with keyframes shows its from-values before it starts; hideBefore works with keyframes', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<div data-duration="3"><b id="a" style="display:block">A</b><b id="b" style="display:block">B</b></div>
    <script>gm.timeline().fromTo('#a', { opacity: 0 }, { keyframes: [{ opacity: 1, duration: 0.5 }, { scale: 1.2, duration: 0.2 }] }, 1)
      .to('#b', { keyframes: [{ x: 50, duration: 0.5 }], hideBefore: true }, 1);</script>`));
  assert.deepEqual(JSON.parse(await evalAt(f, 0.5, `JSON.stringify([getComputedStyle(document.getElementById('a')).opacity, getComputedStyle(document.getElementById('b')).visibility])`)), ['0', 'hidden']);
  assert.deepEqual(JSON.parse(await evalAt(f, 2, `JSON.stringify([getComputedStyle(document.getElementById('a')).opacity, getComputedStyle(document.getElementById('b')).visibility])`)), ['1', 'visible']);
});

test('data-anchor keeps labels next to moving shapes (camera, chains, SVG text); travel rides an gm.connect arrow; 1 worker == 2', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<section class="scene" data-duration="2" style="position:absolute;inset:0;overflow:hidden">
    <div id="world" style="position:absolute;left:0;top:0;width:1000px;height:600px;font-size:24px">
      <svg viewBox="0 0 1000 600" width="1000" height="600" style="position:absolute;left:0;top:0" data-sketch>
        <rect id="r" x="60" y="80" width="200" height="120" fill="#fd0" stroke="#000" stroke-width="6"/>
        <text id="st" data-anchor="#r top 10" text-anchor="middle" font-size="24" fill="#fff">top</text></svg>
      <div id="b" style="position:absolute;left:600px;top:120px;width:120px;height:80px;background:#345"></div>
      <div id="l1" data-anchor="#r bottom 12" style="transform:translate(-50%,-50%)">under r</div>
      <div id="l2" data-anchor="#b right 10">right of b</div>
      <div id="l3" data-anchor="#l2 bottom-left 0">chained</div>
      <div id="pkg" style="position:absolute;width:20px;height:20px;background:#e60"></div>
    </div>
    <div id="ov" data-anchor="#b top 20" style="font-size:20px">over the stage</div>
    <p style="position:absolute;left:20px;top:300px;font-size:30px;margin:0"><span id="m0" data-sketch-mark="circle" data-sketch-mark-padding="0">word</span> <span id="m1" data-sketch-mark="circle">word</span></p>
  </section>
  <script>
    gm.timeline('#world').to('#b', { y: 200, x: -100, duration: 2, ease: 'linear' }, 0);
    const arrow = gm.connect('#r', '#b', { head: 'none' });
    gm.path.travel('#pkg', arrow, { stops: [[0, 0], [2, 1]], ease: 'linear' });
    gm.camera('#world').shot(0, { fit: ['#r', '#b'], padding: 20 }).shot(0.5, { fit: '#b', padding: 60, duration: 1 });
  </script>`));
  const v = await evalAt(f, 1, `(() => {
    const R = (s) => gm.rect(s, '#world'), S = (s) => document.querySelector(s).getBoundingClientRect();
    const g = R(document.querySelector('#r [data-gm-sketch-guide]')), l1 = R('#l1'), b = R('#b'), l2 = R('#l2'), l3 = R('#l3'), st = R('#st'), pkg = R('#pkg');
    const p = document.querySelector('.gm-connect path').getAttribute('d').match(/-?[\\d.]+/g).map(Number);
    const ov = S('#ov'), sb = S('#b');
    const mw0 = document.querySelector('#m0 .gm-sketch-mark path').getBBox().width, mw1 = document.querySelector('#m1 .gm-sketch-mark path').getBBox().width;
    return { l1gap: l1.y - (g.y + g.h), l1cx: l1.cx - g.cx, l2gap: l2.x - (b.x + b.w), l2cy: l2.cy - b.cy, l3: [l3.x - l2.x, l3.y - (l2.y + l2.h)], stgap: g.y - (st.y + st.h), stcx: st.cx - g.cx,
      pkg: [pkg.cx - (p[0] + p[2]) / 2, pkg.cy - (p[1] + p[3]) / 2], ov: [ov.left + ov.width / 2 - (sb.left + sb.width / 2), sb.top - (ov.top + ov.height)], marks: [mw0, mw1], issues: gm.inspect().issues.map((i) => i.code) };
  })()`);
  const px = 360 / 1080;
  const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, what + ': ' + a + ' vs ' + b);
  // the visible edge of the sketched rect is half its 6px stroke outside the shape, then the 12px gap
  near(v.l1gap, 3 + 12 * px, 1, 'label under the sketched rect'); near(v.l1cx, 0, 1, 'centered under it (the centering translate is dropped)');
  near(v.l2gap, 10 * px, 1, 'label right of the moving box'); near(v.l2cy, 0, 1, 'vertically centered');
  near(v.l3[0], 0, 1, 'chained label lined up left'); near(v.l3[1], 0, 1, 'chained label right under');
  near(v.stgap, 3 + 10 * px, 2, 'SVG text above the rect'); near(v.stcx, 0, 2, 'SVG text centered');
  near(v.pkg[0], 0, 1.5, 'traveler halfway along the arrow (x)'); near(v.pkg[1], 0, 1.5, 'traveler halfway along the arrow (y)');
  near(v.ov[0], 0, 1.5, 'stage label centered over the zoomed world box'); near(v.ov[1], 20 * px, 1.5, 'stage label gap (after the camera)');
  assert.ok(v.marks[0] < v.marks[1] - 10, 'padding 0 circle is narrower: ' + v.marks);
  assert.deepEqual(v.issues.filter((c) => /anchor|script|connect/.test(c)), []);
  const a = join(d, 'a'), b = join(d, 'b');
  await render(f, { output: a, workers: 1, ...quiet });
  await render(f, { output: b, workers: 2, ...quiet });
  const fa = readdirSync(a).sort();
  assert.equal(fa.length, 60);
  assert.deepEqual(fa.filter((x) => !readFileSync(join(a, x)).equals(readFileSync(join(b, x)))), []);
});

test('data-pulse scales on the beat grid and sets --beat; data-cuts can be written in beats', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<main data-sequence data-cuts="beats: 0 3"><section class="scene" id="a"><b id="p" data-pulse="beat 0.1" style="display:block">X</b></section><section class="scene" id="b" data-duration="1"></section></main>`,
    'data-width="640" data-height="360" data-fps="30" data-bpm="120" data-beat-offset="0.1"'));
  const at = (t) => evalAt(f, t, `JSON.stringify([document.getElementById('p').style.scale, document.getElementById('p').style.getPropertyValue('--beat'), gm.timing('#b').start])`).then(JSON.parse);
  const [s1, b1, start] = await at(0.6);
  assert.equal(start, 1.6); // beat 3 = 0.1 + 3 * 0.5
  assert.equal(+s1, 1.1); assert.equal(+b1, 1);
  const [s2] = await at(0.7);
  assert.ok(+s2 > 1 && +s2 < 1.1);
});

test('check: empty-start when the first half second shows only a gradient background, not when a title is there', { skip }, async () => {
  const d = tmp(), mk = (delay) => { const f = join(d, `e${delay}.html`); writeFileSync(f, `<!doctype html><html data-width="640" data-height="360" data-fps="30"><head><style>body{background:linear-gradient(135deg,#2a1b5c,#0b6e8a);color:#fff;font-family:sans-serif}</style></head><body><section class="scene" data-duration="2"><h1 data-enter="fade 0.3 ${delay}" style="font-size:60px;text-align:center;margin-top:120px">Hello</h1></section></body></html>`); return f; };
  assert.ok((await check(mk(0.7))).issues.some((i) => i.code === 'empty-start'));
  assert.ok(!(await check(mk(0))).issues.some((i) => i.code === 'empty-start'));
  // a single shape without text (a coral drop on a gradient, about 2% of the frame) is something on screen
  const f = join(d, 'drop.html');
  writeFileSync(f, `<!doctype html><html data-width="1280" data-height="720" data-fps="30"><head><style>body{background:linear-gradient(135deg,#2a1b5c,#0b6e8a)}#d{position:absolute;left:340px;top:10px;width:86px;height:186px;background:#ff6b5b;border-radius:50% 50% 50% 50% / 30% 30% 70% 70%}</style></head><body><section class="scene" data-duration="2"><div id="d"></div></section></body></html>`);
  assert.ok(!(await check(f)).issues.some((i) => i.code === 'empty-start'), 'a shape with no text counts as content');
});

test('check: ghost-overlap when a crossfade stacks two headlines, not for a push', { skip }, async () => {
  const d = tmp(), mk = (tr) => { const f = join(d, `${tr}.html`); writeFileSync(f, page(`<main data-sequence><section class="scene" data-duration="2"><h1 style="font-size:70px;text-align:center;margin-top:120px">HTML IN</h1></section><section class="scene" data-duration="2" data-transition="${tr} 0.8"><h1 style="font-size:70px;text-align:center;margin-top:120px">VIDEO OUT</h1></section></main>`)); return f; };
  assert.ok((await check(mk('fade'))).issues.some((i) => i.code === 'ghost-overlap'));
  assert.ok(!(await check(mk('push-left'))).issues.some((i) => i.code === 'ghost-overlap'));
});

test('gm.connect: label at a place along the line and on a chosen side; attach points along a side (fromAt, "top 0.25", corners)', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<div data-duration="2" style="position:absolute;inset:0">
    <div id="a" style="position:absolute;left:100px;top:100px;width:200px;height:100px;background:#345"></div>
    <div id="b" style="position:absolute;left:1000px;top:100px;width:200px;height:100px;background:#345"></div>
    <div id="c" style="position:absolute;left:100px;top:700px;width:200px;height:100px;background:#345"></div>
    <div id="e" style="position:absolute;left:1000px;top:700px;width:200px;height:100px;background:#345"></div></div>
    <script>
      gm.connect('#a', '#b', { head: 'none', class: 'c1', fromAt: 0.25, toAt: 0.75, label: { text: 'below', at: 0.25, side: 'below', offset: 20 } });
      gm.connect('#a', '#c', { head: 'none', class: 'c2', from: 'bottom 0.1', to: 'top-right' });
      gm.connect('#c', '#e', { sketch: true, class: 'c3', curve: 0.3, label: 'mid' });
      gm.connect('#c', '#e', { head: 'none', class: 'c4', label: { text: 'x', side: 'sideways' } });
    </script>`, 'data-width="1920" data-height="1080" data-fps="30"'));
  const v = await evalAt(f, 1, `(() => {
    const nums = (c) => document.querySelector('.' + c + ' path').getAttribute('d').match(/-?[\\d.]+/g).map(Number);
    const lab = (c) => { const t = document.querySelector('.' + c + ' text'); return { x: +t.getAttribute('x'), y: +t.getAttribute('y'), w: t.getBBox().width, h: t.getBBox().height }; };
    return { c1: nums('c1'), l1: lab('c1'), c2: nums('c2'), l3: lab('c3'), issues: gm.inspect().issues.map((i) => i.code) };
  })()`);
  const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, what + ': ' + a + ' vs ' + b);
  // fromAt 0.25 on the side the line leaves from (right of #a), toAt 0.75 on the side it enters (left of #b); gap 10
  near(v.c1[0], 310, 0.2, 'start x'); near(v.c1[1], 125, 0.2, 'start y'); near(v.c1[2], 990, 0.2, 'end x'); near(v.c1[3], 175, 0.2, 'end y');
  // the label a quarter of the way along, below the line: its top edge 20px under the line
  // (measured along the line and across it: its box clears the line by 20px)
  const L = Math.hypot(680, 50), tx = 680 / L, ty = 50 / L, dx = v.l1.x - 310, dy = v.l1.y - 125;
  near((dx * tx + dy * ty) / L, 0.25, 0.002, 'label at 0.25 along');
  near(dx * -ty + dy * tx - (ty * v.l1.w + tx * v.l1.h) / 2, 20, 0.5, 'label box 20px below the line');
  // 'bottom 0.1': a tenth of the way along the bottom side; 'top-right': the corner (gap on the diagonal)
  near(v.c2[0], 120, 0.2, 'bottom 0.1 x'); near(v.c2[1], 210, 0.2, 'bottom 0.1 y');
  near(v.c2[2], 300 + 7.07, 0.2, 'corner x'); near(v.c2[3], 700 - 7.07, 0.2, 'corner y');
  // a sketched curved arrow: the label sits at the middle of the curve (not pulled toward the head), outside the bend
  near(v.l3.x, 650, 2, 'sketched label at the middle');
  assert.ok(v.l3.y > 750 + 0.3 * 900 * 0.5, 'below the sagging curve: ' + v.l3.y);
  assert.ok(v.issues.includes('connect-label-side'), 'unknown side is reported');
});

test('cursor block: beat times, show="auto", lands on its target inside a zoomed camera world (no sized wrapper); 1 worker == 2', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<main data-sequence data-cuts="0 1" data-cut-align="middle" data-transition="fade 0.4">
    <section class="scene" style="position:absolute;inset:0;background:#222"></section>
    <section class="scene" id="s2" data-duration="4" style="position:absolute;inset:0;overflow:hidden">
      <div id="world" style="position:absolute;left:0;top:0;width:1200px;height:800px;background:#123">
        <div id="btn" style="position:absolute;left:400px;top:300px;width:100px;height:50px;background:#36f">Go</div>
        <gm-include src="${join(ROOT, 'blocks/cursor.html')}" points="100,100 #btn!" times="beats: 2 3" show="auto"></gm-include>
      </div>
    </section></main>
    <script>gm.camera('#world').shot(0, { center: { x: 450, y: 325 }, zoom: 2 });</script>`,
    'data-width="640" data-height="360" data-fps="30" data-bpm="60" data-beat-offset="0"'));
  const ctx = await openComposition(f, { mode: 'render' });
  const at = async (t) => { await ctx.page.seek(t); return ctx.page.evaluate(`(() => {
    const c = document.querySelector('#s2 .gmb-cursor'), r = c.getBoundingClientRect(), b = document.getElementById('btn').getBoundingClientRect();
    return { op: +getComputedStyle(c).opacity, x: r.left, y: r.top, bx: b.left + b.width / 2, by: b.top + b.height * 0.56, hover: document.getElementById('btn').hasAttribute('data-gm-hover'), issues: gm.inspect().issues.map((i) => i.code) };
  })()`); };
  let v1, v2, v3, v4;
  try { v1 = await at(1.5); v2 = await at(2.5); v3 = await at(3.2); v4 = await at(4.2); } finally { await ctx.page.close(); await ctx.server.close(); }
  // beats 2 and 3 are video times 2 s and 3 s (the scene itself starts at 0.8, half a transition before its cut)
  assert.equal(v1.op, 0, 'hidden before its first move');
  assert.equal(v2.op, 1, 'shown while it moves');
  assert.ok(Math.abs(v3.x - v3.bx) < 1 && Math.abs(v3.y - v3.by) < 1, 'on the button through the 2x camera: ' + JSON.stringify(v3));
  assert.ok(v3.hover, 'hover set on the target');
  assert.equal(v4.op, 0, 'hidden after its last point');
  assert.deepEqual(v3.issues.filter((c) => /cursor|script/.test(c)), []);
  const a = join(d, 'a'), b = join(d, 'b');
  await render(f, { output: a, workers: 1, ...quiet });
  await render(f, { output: b, workers: 2, ...quiet });
  const fa = readdirSync(a).sort();
  assert.ok(fa.length > 100, 'frames: ' + fa.length);
  assert.deepEqual(fa.filter((x) => !readFileSync(join(a, x)).equals(readFileSync(join(b, x)))), []);
});

test('gm.chart.line: values and points at known times, holds, callouts enter on reach, head followed by a camera; 1 worker == 2', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<section class="scene" data-duration="3.5" style="position:absolute;inset:0;overflow:hidden">
    <div id="world" style="position:absolute;left:0;top:0;width:1400px;height:500px">
      <div id="c" style="position:absolute;left:0;top:0;width:1200px;height:400px">
        <b id="rider" data-point="head right 10" data-chart-text="value"></b>
        <i id="lab" data-point="head top 10" data-chart-text="label"></i>
        <div id="dip" data-point="Mar bottom 20">dip</div>
      </div>
    </div>
  </section>
  <script>
    window.ch = gm.chart.line('#c', { values: [0, 10, 5, 20], labels: 'Jan,Feb,Mar,Apr', delay: 0, duration: 3, holds: { Feb: 1 }, ease: 'linear',
      colors: { Mar: '#f44' }, rescale: true, axis: 'head' });
    gm.camera('#world').shot(0, { follow: ch.head, zoom: 1.2 }).shot(2.4, { fit: '#c', duration: 0.6 });
  </script>`));
  // timing: 2 s of drawing over 3 steps (0.667 s each) plus a 1 s hold at Feb
  const r = await evalAt(f, 0, `({ t: [0, 1, 2, 3].map((i) => ch.timeOf(i)), mar: ch.timeOf('Mar'), v: [ch.valueAt(1 / 3), ch.valueAt(1), ch.valueAt(1.5), ch.valueAt(7 / 3), ch.valueAt(9)], p: ch.progress(2), pt: ch.pointAt(1) })`);
  const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, what + ': ' + a + ' vs ' + b);
  [0, 2 / 3, 7 / 3, 3].forEach((x, i) => near(r.t[i], x, 0.002, 'reach time of point ' + i));
  near(r.mar, 7 / 3, 0.002, 'timeOf by label');
  near(r.v[0], 6.25, 0.01, 'value halfway to Feb (monotone curve)'); near(r.v[1], 10, 1e-6, 'held at Feb'); near(r.v[2], 10, 1e-6, 'still held');
  near(r.v[3], 5, 1e-6, 'at Mar'); near(r.v[4], 20, 1e-6, 'after the end');
  near(r.p, 1.5, 1e-6, 'progress halfway between Feb and Mar');
  assert.equal(r.pt.value, 10); assert.equal(r.pt.label, 'Feb');
  const at = (t) => evalAt(f, t, `(() => {
    const S = (s) => document.querySelector(s).getBoundingClientRect(), h = S('.gm-chart-head'), rd = S('#rider'), dip = document.querySelector('#dip');
    const p = ch.pointAt(1, gm.time - gm.timing('#c').start), c = S('#c'), k = c.width / 1200;
    return { head: [h.left + h.width / 2, h.top + h.height / 2], expect: [c.left + p.x * k, c.top + p.y * k], rider: document.querySelector('#rider').textContent, lab: document.querySelector('#lab').textContent,
      riderLeft: rd.left - (h.left + h.width / 2), dipOpacity: +getComputedStyle(dip).opacity, color: getComputedStyle(document.querySelector('#c')).getPropertyValue('--chart-color').trim(),
      line: document.querySelector('#c .gm-chart-line').getAttribute('d') || '', issues: gm.inspect().issues.map((i) => i.code) };
  })()`);
  const a = await at(1.2), b = await at(2.2), c = await at(3.2);
  near(a.head[0], a.expect[0], 1, 'head on Feb during the hold (x)'); near(a.head[1], a.expect[1], 1, 'head on Feb during the hold (y)');
  near(a.head[0], 320, 1, 'camera follows the head (centered)');
  assert.equal(a.rider, '10'); assert.equal(a.lab, 'Feb');
  assert.ok(a.riderLeft > 0, 'rider sits right of the head');
  assert.equal(a.dipOpacity, 0, 'callout hidden before the line reaches Mar');
  assert.equal(b.color, '#f44', 'head takes the color of the segment into Mar');
  assert.equal(c.dipOpacity, 1, 'callout shown after it entered');
  assert.equal(c.rider, '20');
  assert.equal(c.line.split('C').length - 1, 3, 'three segments drawn at the end');
  assert.deepEqual(c.issues.filter((x) => /chart|script|anchor/.test(x)), []);
  const o1 = join(d, 'o1'), o2 = join(d, 'o2');
  await render(f, { output: o1, workers: 1, ...quiet });
  await render(f, { output: o2, workers: 2, ...quiet });
  const fa = readdirSync(o1).sort();
  assert.equal(fa.length, 105);
  assert.deepEqual(fa.filter((x) => !readFileSync(join(o1, x)).equals(readFileSync(join(o2, x)))), []);
});

test('data-split="chars" keeps what a reader sees as one character together: emoji sequences, letters with marks; joined scripts split by word', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<p id="ar" data-split="chars" dir="rtl">\u0645\u0631\u062d\u0628\u0627 \u0628\u0627\u0644\u0639\u0627\u0644\u0645</p>
    <p id="em" data-split="chars">Go \u{1F44D}\u{1F3FD} \u{1F468}\u200D\u{1F469}\u200D\u{1F467}</p><p id="hi" data-split="chars">\u0928\u092e\u0938\u094d\u0924\u0947</p>`, 'data-width="640" data-height="360" data-fps="30" data-duration="1"'));
  const r = await evalAt(f, 0, `(() => { const t = (s) => [...document.querySelectorAll(s + ' .gm-char')].map((e) => e.textContent); return { ar: t('#ar'), em: t('#em'), hi: t('#hi') }; })()`);
  assert.equal(r.ar.length, 2, 'Arabic: one piece per word, letters stay joined: ' + JSON.stringify(r.ar));
  assert.deepEqual(r.em, ['G', 'o', '\u{1F44D}\u{1F3FD}', '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}'], 'emoji with skin tone and a ZWJ family are one piece each');
  assert.ok(r.hi.every((c) => !/^[\u093e-\u094d]/.test(c)), 'no Devanagari vowel sign or virama on its own: ' + JSON.stringify(r.hi));
});

test('check: mirrored-text when a card flip shows its text backwards, not with backface-visibility: hidden, not for a faint reflection', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<style>.st{position:absolute;perspective:1000px}.card{width:260px;height:160px;background:#345;display:grid;place-items:center;transform-style:preserve-3d;font:700 48px Inter}.hide .face{backface-visibility:hidden}</style>
    <div class="st" style="left:20px;top:60px"><div class="card" id="c1"><div id="f1">FLOW</div></div></div>
    <div class="st hide" style="left:340px;top:60px"><div class="card" id="c2"><div class="face" id="f2">MOVE</div></div></div>
    <p id="refl" style="position:absolute;left:20px;top:260px;margin:0;font:700 40px Inter;transform:scaleY(-1);opacity:.3">SHAPE</p>
    <script>gm.timeline().to('#c1, #c2', { rotateY: 180, duration: 0.6, ease: 'power2.inOut' }, 0.3);</script>`, 'data-width="640" data-height="360" data-fps="30" data-duration="2.5"'));
  const rep = await check(f);
  const m = rep.issues.filter((i) => i.code === 'mirrored-text').map((i) => i.selector);
  assert.deepEqual(m, ['#f1'], 'only the text showing through the back: ' + JSON.stringify(m));
});

test('data-sketch-boil: lines are redrawn every N frames, cycling three drawings; a pure function of the frame (1 worker == 2)', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<svg width="640" height="360" viewBox="0 0 640 360" data-sketch="1.4" data-sketch-boil="3" style="stroke:#222;stroke-width:6px"><rect id="r" x="60" y="60" width="200" height="150" fill="#e9a23b"/><circle cx="440" cy="150" r="80" fill="none"/></svg>`, 'data-width="640" data-height="360" data-fps="30" data-duration="1" data-background="#f6efdf"'));
  const ds = await seekEach(f, [0, 2 / 30, 3 / 30, 6 / 30, 9 / 30], `[...document.querySelectorAll('[data-gm-sketch] path:not([data-gm-sketch-guide])')].map((p) => p.getAttribute('d')).join('|')`);
  assert.equal(ds[0], ds[1], 'frames 0-2 are one drawing');
  assert.notEqual(ds[0], ds[2], 'frame 3 is a new drawing');
  assert.notEqual(ds[2], ds[3], 'frame 6 another');
  assert.equal(ds[0], ds[4], 'frame 9 loops back to the first drawing');
  const o1 = join(d, 'o1'), o2 = join(d, 'o2');
  await render(f, { output: o1, workers: 1, ...quiet });
  await render(f, { output: o2, workers: 2, ...quiet });
  const fa = readdirSync(o1).sort();
  assert.deepEqual(fa.filter((x) => !readFileSync(join(o1, x)).equals(readFileSync(join(o2, x)))), []);
});

test('check: orphan-word on a wrapped headline with one short word alone on its last line (also split into words), not with text-wrap: balance', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<h1 id="bad" style="position:absolute;left:20px;top:10px;width:900px;margin:0;font:700 72px Inter">Every frame on purpose always</h1>
    <h1 id="good" style="position:absolute;left:20px;top:300px;width:900px;margin:0;font:700 72px Inter;text-wrap:balance">Every frame on purpose always</h1>
    <h2 id="split" data-split="words" style="position:absolute;left:1000px;top:10px;width:560px;margin:0;font:700 60px Inter">Cities can bloom too</h2>`, 'data-width="1920" data-height="1080" data-fps="30" data-duration="1.5"'));
  const rep = await check(f);
  const o = rep.issues.filter((i) => i.code === 'orphan-word').map((i) => i.selector).sort();
  assert.deepEqual(o, ['#bad', '#split']);
});

test('gm.path.stream: items flow along a path at a rate, stay behind a limit, drain after until; 1 worker == 2', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<svg width="640" height="360" viewBox="0 0 640 360" style="position:absolute;inset:0"><path id="p" d="M20 180 L620 180" fill="none" stroke="#3d9" stroke-width="4"/></svg>
    <script>gm.path.stream('#p', { at: 0.2, until: 2, rate: 5, trip: 1, jitter: 0.2, size: 12, color: '#fb4', limit: (t) => Math.min(1, t / 1.5) });</script>`, 'data-width="640" data-height="360" data-fps="30" data-duration="3.5"'));
  const expr = `[...document.querySelectorAll('[data-gm-stream] circle')].filter((c) => c.style.display !== 'none').map((c) => +new DOMMatrix(getComputedStyle(c).transform).e)`;
  const [early, mid, late] = await seekEach(f, [0.6, 1.6, 3.3], expr);
  assert.ok(early.length >= 1 && early.every((x) => x <= 20 + 600 * 0.4 + 1), 'items stay behind the limit (40% at 0.6 s): ' + JSON.stringify(early));
  assert.ok(mid.length >= 4, 'several items in flight: ' + mid.length);
  assert.equal(late.length, 0, 'no items after the last emitted one finished');
  const o1 = join(d, 'o1'), o2 = join(d, 'o2');
  await render(f, { output: o1, workers: 1, ...quiet });
  await render(f, { output: o2, workers: 2, ...quiet });
  const fa = readdirSync(o1).sort();
  assert.deepEqual(fa.filter((x) => !readFileSync(join(o1, x)).equals(readFileSync(join(o2, x)))), []);
});

test('data-sketch-ink: strokes become tapered filled outlines revealed along their direction by data-enter draw and a draw tween; 1 worker == 2', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<svg width="640" height="360" viewBox="0 0 640 360" data-sketch="1.2" data-sketch-ink="0.8" style="stroke:#222;stroke-width:6px">
    <path id="a" d="M40 300 C 200 100, 400 400, 600 120" fill="none" data-enter="draw 1 0.2"/><rect id="r" x="60" y="40" width="200" height="120" fill="none"/></svg>
    <script>gm.timeline().fromTo('#r', { draw: 0 }, { draw: 1, duration: 1, ease: 'linear' }, 0.2);</script>`, 'data-width="640" data-height="360" data-fps="30" data-duration="1.6" data-background="#f6efdf"'));
  const expr = `(() => { const ink = [...document.querySelectorAll('[data-gm-ink]')], rev = [...document.querySelectorAll('[data-gm-ink-reveal]')];
    return { ink: ink.length, masked: ink.every((p) => p.getAttribute('mask').startsWith('url(#gm-ink-') && /./.test(p.getAttribute('mask'))), strokes: document.querySelectorAll('[data-gm-sketch] > path:not([data-gm-ink]):not([data-gm-sketch-guide])').length,
      dash: rev.map((p) => getComputedStyle(p).strokeDashoffset + '|' + getComputedStyle(p).strokeDasharray) }; })()`;
  const [mid, end] = await seekEach(f, [0.7, 1.5], expr);
  assert.ok(mid.ink >= 2 && mid.masked, 'ink outlines, each under its reveal mask: ' + JSON.stringify(mid));
  assert.equal(mid.strokes, 0, 'no even marker strokes left');
  assert.notDeepEqual(mid.dash, end.dash, 'the reveal masks draw on over time');
  const o1 = join(d, 'o1'), o2 = join(d, 'o2');
  await render(f, { output: o1, workers: 1, ...quiet });
  await render(f, { output: o2, workers: 2, ...quiet });
  const fa = readdirSync(o1).sort();
  assert.deepEqual(fa.filter((x) => !readFileSync(join(o1, x)).equals(readFileSync(join(o2, x)))), []);
});

test('check: letters split into their own spans by the page script count as words, not one word per letter (short-hold)', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<style>.ch{display:inline-block;white-space:pre}</style><div id="t" style="position:absolute;left:40px;top:120px;font:600 64px Inter;white-space:nowrap" data-duration="0.9"></div>
    <script>const el = document.getElementById('t'); for (const ch of 'The City Hive') { const sp = document.createElement('span'); sp.className = 'ch'; sp.textContent = ch; el.appendChild(sp); }
    gm.timeline().from('#t .ch', { x: (i) => (i - 6) * 90, opacity: 0, duration: 0.3, stagger: 0.01 }, 0);</script>`, 'data-width="1280" data-height="720" data-fps="30" data-duration="3"'));
  const rep = await check(f);
  const sh = rep.issues.filter((i) => i.code === 'short-hold');
  assert.ok(sh.every((i) => !/1[0-9]-word/.test(i.message)), 'counted per letter: ' + sh.map((i) => i.message).join(' | '));
  assert.ok(sh.some((i) => /3-word/.test(i.message)), 'judged as the 3 words it is: ' + sh.map((i) => i.message).join(' | '));
});

test('check: text-carried-over when a big label stays put through a scene change, not when it leaves with its beat or is marked carry-ok', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<div id="s1" style="position:absolute;inset:0;background:#335" data-duration="2"></div>
    <div id="s2" style="position:absolute;inset:0;background:repeating-linear-gradient(45deg,#c84 0 40px,#ec9 40px 80px)" data-start="2"></div>
    <p id="left" style="position:absolute;left:40px;top:40px;margin:0;font:700 64px Inter;color:#fff" data-duration="3">3 km</p>
    <p id="gone" style="position:absolute;left:40px;top:180px;margin:0;font:700 64px Inter;color:#fff" data-duration="1.9">Range</p>
    <p id="bug" data-check="carry-ok" style="position:absolute;right:40px;top:40px;margin:0;font:700 40px Inter;color:#fff">CH 2</p>`, 'data-width="1280" data-height="720" data-fps="30" data-duration="4"'));
  const rep = await check(f);
  const c = rep.issues.filter((i) => i.code === 'text-carried-over').map((i) => i.selector);
  assert.deepEqual(c, ['#left'], 'only the label left behind: ' + JSON.stringify(c));
});

test('check: data-expect promises (in-by, gone-by, hold, in-frame) are verified; broken ones are errors, a typo is a warning', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<p id="a" style="position:absolute;left:30px;top:20px;margin:0;font:700 40px Inter" data-start="1" data-duration="3" data-expect="in-by 1.5; hold 2.5; gone-by 4.5">On time</p>
    <p id="b" style="position:absolute;left:30px;top:90px;margin:0;font:700 40px Inter" data-start="2" data-expect="in-by 1.5; gone-by 5">Late, stays</p>
    <p id="c" style="position:absolute;left:30px;top:160px;margin:0;font:700 40px Inter" data-start="1" data-duration="1" data-expect="hold 2">Too short</p>
    <p id="e" style="position:absolute;left:560px;top:230px;margin:0;font:700 40px Inter;white-space:nowrap" data-expect="in-frame; soon 3">Cut off</p>`, 'data-width="640" data-height="360" data-fps="30" data-duration="6"'));
  const rep = await check(f);
  const failed = [...new Set(rep.issues.filter((i) => i.code === 'expect-failed').map((i) => i.selector))].sort();
  assert.deepEqual(failed, ['#b', '#c', '#e']);
  assert.ok(rep.issues.some((i) => i.code === 'expect-bad' && i.selector === '#e'), 'the typo is reported');
  assert.equal(rep.ok, false, 'a broken promise is an error');
});

test('check: missing-glyph for characters the font lacks (drawn from a fallback), not for ones it has, nor emoji', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<p id="a" style="position:absolute;left:20px;top:20px;margin:0;font:700 40px 'Space Grotesk'">CO\u2082 cut \u2192 now</p>
    <p id="b" style="position:absolute;left:20px;top:120px;margin:0;font:700 40px 'Space Grotesk'">Plain 2026 \u2013 caf\u00e9 \u{1F44D}</p>`, 'data-width="640" data-height="360" data-fps="30" data-duration="1"'));
  const rep = await check(f);
  const g = rep.issues.filter((i) => i.code === 'missing-glyph');
  assert.deepEqual(g.map((i) => i.selector), ['#a']);
  assert.match(g[0].message, /\u2082/);
});

test('timeline: a tween takes the CSS transform part it animates as its start (CSS scaleX(0) to scaleX 1 ends at 1), keeps centering as the prefix', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<style>.bar{position:absolute;left:40px;width:300px;height:20px;background:#fb0;transform-origin:0 50%} #c{transform:scaleX(0)} #e{left:320px;top:300px;width:100px;height:40px;transform:translate(-50%,-50%) scale(0.5)}</style>
    <i class="bar" id="a" style="top:40px;transform:scaleX(0)"></i><i class="bar" id="c" style="top:100px"></i><i class="bar" id="e"></i>
    <script>gm.timeline().fromTo('#a', { scaleX: 0 }, { scaleX: 1, duration: 0.5 }, 0.2).to('#c', { scaleX: 1, duration: 0.5 }, 0.2).to('#e', { scale: 1, duration: 0.5 }, 0.2);</script>`, 'data-width="640" data-height="360" data-fps="30" data-duration="1.5"'));
  const v = await evalAt(f, 1.2, `['a', 'c', 'e'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [Math.round(r.width), Math.round(r.left)]; })`);
  assert.deepEqual(v[0], [300, 40], 'inline scaleX(0) bar drawn full: ' + JSON.stringify(v));
  assert.deepEqual(v[1], [300, 40], 'stylesheet scaleX(0) bar drawn full: ' + JSON.stringify(v));
  assert.deepEqual(v[2], [100, 270], 'centered box at full size, still centered: ' + JSON.stringify(v));
});

test('check: upside-down-text for letters turned past ~100° (also while moving), not for upright or slightly tilted ones', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<p id="up" style="position:absolute;left:60px;top:60px;margin:0;font:700 56px Inter;transform:rotate(170deg)">NEIGHBOR</p>
    <p id="tilt" style="position:absolute;left:60px;top:200px;margin:0;font:700 56px Inter;transform:rotate(-12deg)">HIVE</p>
    <p id="spin" style="position:absolute;left:360px;top:200px;margin:0;font:700 56px Inter">SPIN</p>
    <script>gm.timeline().to('#spin', { rotate: 540, duration: 1.6, ease: 'linear' }, 0.2);</script>`, 'data-width="640" data-height="360" data-fps="30" data-duration="2"'));
  const rep = await check(f);
  const u = [...new Set(rep.issues.filter((i) => i.code === 'upside-down-text').map((i) => i.selector))].sort();
  assert.ok(u.includes('#up') && !u.includes('#tilt'), JSON.stringify(u));
});

test('path morph: exact ends, convex shapes stay convex and balanced in between, overshoot grows the shape instead of denting it', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<script>window.R = (() => {
    const S = gm.shape, sq = S.rect(130, 130, { r: 30 }), tri = S.polygon(3, 95), m = gm.path.morph(sq, tri);
    const pts = (dd) => dd.replace(/^M/, '').replace(/Z$/, '').split('L').map((s) => s.trim().split(/\\s+/).map(Number));
    const convex = (P) => { let dir = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], c = P[(i + 2) % P.length];
      const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); if (Math.abs(cr) < 1e-6) continue; const s = Math.sign(cr); if (dir && s !== dir) return false; dir = s; } return true; };
    const box = (P) => { const xs = P.map((q) => q[0]), ys = P.map((q) => q[1]); return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]; };
    const mid = pts(m(0.5)), b = box(mid), over = box(pts(m(1.15))), end = box(pts(gm.path.morph(sq, tri)(0.999)));
    return { ends: m(0) === sq && m(1) === tri, convex: [0.25, 0.5, 0.75].every((p) => convex(pts(m(p)))), sym: Math.abs(b[0] + b[1]),
      grow: (over[1] - over[0]) / (end[1] - end[0]), dents: convex(pts(m(1.15))) && convex(pts(m(-0.15))) };
  })();</script>`, 'data-width="320" data-height="180" data-fps="30" data-duration="1"'));
  const r = await evalAt(f, 0, 'window.R');
  assert.equal(r.ends, true, 'p = 0 and p = 1 are the exact paths');
  assert.equal(r.convex, true, 'a square to a triangle stays convex in between');
  assert.ok(r.sym < 1, `in-between is centred left to right (off by ${r.sym})`);
  assert.ok(Math.abs(r.grow - 1.15) < 0.02, `overshoot 1.15 grows the shape by 1.15 (got ${r.grow})`);
  assert.equal(r.dents, true, 'overshoot past either end does not dent the outline');
});

test('morph: inline pairs fly; different content hands over (old out, then new in); same content keeps both solid', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<main data-sequence data-transition="morph 1 linear">
    <section class="scene" data-duration="2"><p style="font-size:40px;margin:40px">Total <span id="a1" data-morph="n">48,000</span></p><div id="c1" data-morph="c" style="position:absolute;left:20px;top:200px;width:80px;height:80px;background:#f55">GO</div></section>
    <section class="scene" data-duration="2"><p style="font-size:30px;margin:260px 0 0 300px">1,200 → <b id="b1" data-morph="n">48,000 users</b></p><div id="c2" data-morph="c" style="position:absolute;left:500px;top:40px;width:80px;height:80px;background:#f55">GO</div></section>
  </main>`));
  const at = (t) => evalAt(f, t, `JSON.stringify(['a1', 'b1', 'c1', 'c2'].map((id) => { const e = document.getElementById(id), r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { x: r.left + r.width / 2, y: r.top + r.height / 2, f: +cs.opacity, disp: cs.display }; }))`).then(JSON.parse);
  const [a0] = await at(0.5);
  assert.equal(a0.disp, 'inline-block'); // an inline <span> cannot be moved by translate/scale
  const [a, b, c1, c2] = await at(1.5); // halfway through the transition (it runs 1 to 2)
  assert.ok(Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2, 'the pair flies together');
  assert.ok(Math.abs(a.x - a0.x) > 50, 'the old text left its place');
  assert.ok(a.f < 0.2, 'old text mostly gone halfway: ' + a.f);
  assert.equal(c1.f, 1); assert.equal(c2.f, 1); // same content: no hand-over fade
  assert.ok(Math.abs(c1.x - c2.x) < 2);
  const [a2, b2] = await at(1.1);
  assert.ok(a2.f > 0.8 && b2.f < 0.05, 'early: old solid, new hidden ' + a2.f + ' ' + b2.f);
  const [, b3] = await at(1.85);
  assert.ok(b3.f > 0.95, 'late: new one solid ' + b3.f);
});

test('fly: starts on the source box (measured where both rest, also in a later scene) and lands home', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<main data-sequence>
    <section class="scene" id="s1" data-duration="1"></section>
    <section class="scene" id="s2" data-duration="3">
      <div data-enter="fade-up 0.6"><div id="slot" style="position:absolute;left:400px;top:250px;width:200px;height:60px;background:#345"></div></div>
      <div id="ev" style="position:absolute;left:50%;top:30%;width:100px;height:100px;transform:translate(-50%,-50%);background:#48f"></div>
      <div id="sq" style="position:absolute;left:40px;top:40px;width:50px;height:50px;background:#f84"></div>
      <div id="src2" style="position:absolute;left:500px;top:40px;width:100px;height:100px"></div>
    </section></main>
    <script>gm.fly('#ev', { from: '#slot', at: 1, duration: 1, ease: 'linear' }); gm.timeline('#s2').fly('#sq', { from: '#src2', duration: 1, ease: 'linear', hideBefore: false }, 0.5);</script>`));
  const at = (t) => evalAt(f, t, `JSON.stringify(['ev', 'slot', 'sq'].map((id) => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height, vis: getComputedStyle(e).visibility }; }))`).then(JSON.parse);
  const [ev0, , sq0] = await at(1.5); // s2 starts at 1: ev waits hidden, sq sits on its source
  assert.equal(ev0.vis, 'hidden');
  assert.ok(Math.abs(sq0.cx - 550) < 1 && Math.abs(sq0.cy - 90) < 1 && Math.abs(sq0.w - 100) < 1, JSON.stringify(sq0));
  const [ev, slot] = await at(2);
  assert.equal(ev.vis, 'visible');
  assert.ok(Math.abs(ev.cx - slot.cx) < 1 && Math.abs(ev.cy - slot.cy) < 1, JSON.stringify([ev, slot]));
  assert.ok(Math.abs(ev.h - 60) < 1 && Math.abs(ev.w - 60) < 1, 'other proportions: scaled evenly to fit inside the source ' + JSON.stringify(ev));
  const [ev2, , sq2] = await at(3.5);
  assert.ok(Math.abs(ev2.cx - 320) < 1 && Math.abs(ev2.cy - 108) < 1 && Math.abs(ev2.w - 100) < 1, JSON.stringify(ev2));
  assert.ok(Math.abs(sq2.cx - 65) < 1 && Math.abs(sq2.w - 50) < 1);
});

test('morph hand-over and fly render the same with 1 and 2 workers', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<main data-sequence data-transition="morph 0.6">
    <section class="scene" data-duration="1"><div id="g" data-morph="g" style="position:absolute;left:40px;top:40px;font-size:60px">&lt;/&gt;</div><div id="slot" style="position:absolute;left:400px;top:200px;width:160px;height:60px;background:#345"></div><div id="ev" style="position:absolute;left:60px;top:220px;width:90px;height:90px;background:#48f"></div></section>
    <section class="scene" data-duration="1"><svg data-morph="g" viewBox="0 0 10 10" style="position:absolute;left:300px;top:120px;width:120px;height:120px"><circle cx="5" cy="5" r="5" fill="#fc3"/></svg></section>
  </main><script>gm.fly('#ev', { from: '#slot', at: 0.1, duration: 0.5 });</script>`));
  const a = join(d, 'a'), b = join(d, 'b');
  await render(f, { output: a, workers: 1, ...quiet });
  await render(f, { output: b, workers: 2, ...quiet });
  const fa = readdirSync(a).sort();
  assert.ok(fa.length >= 40);
  assert.deepEqual(fa.filter((x) => !readFileSync(join(a, x)).equals(readFileSync(join(b, x)))), []);
});

test('speed: idle enter/exit and finished from-only CSS animations hold no layer, still blobs bake to an image, moving ones to a canvas; 1 worker equals 3', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<style>.blob{position:absolute;width:300px;height:300px;border-radius:50%;filter:blur(60px)}
    @keyframes drift{to{translate:120px 40px}} @keyframes dim{to{opacity:.4}}
    #cssin{animation:fade-up .3s .2s both} #cssdim{animation:dim .3s both}</style>
    <main data-sequence><section class="scene" id="s1" data-duration="2" data-exit="blur 0.5">
      <div class="blob" id="still" style="left:-60px;top:-80px;background:#3050c0"></div>
      <div class="blob" id="moving" style="right:-60px;bottom:-80px;background:#c03080;animation:drift 2s linear both"></div>
      <p id="late" style="font-size:40px" data-enter="fade-up 0.4 1">late</p>
      <p id="cssin">css in</p><p id="cssdim">css dim</p>
    </section><section class="scene" data-duration="1"><p>next</p></section></main>`));
  const at = (t) => evalAt(f, t, `(() => { const s = document.getElementById('s1'), $ = (id) => document.getElementById(id); return { anims: s.getAnimations().length, filter: getComputedStyle(s).filter, late: +getComputedStyle($('late')).opacity,
    still: document.querySelector('#still > [data-gm-internal]')?.localName, moving: document.querySelector('#moving > [data-gm-internal]')?.localName,
    cssin: [$('cssin').getAnimations().length, +getComputedStyle($('cssin')).opacity], cssdim: [$('cssdim').getAnimations().length, +getComputedStyle($('cssdim')).opacity] }; })()`);
  const start = await at(0.1);
  assert.equal(start.cssin[1], 0, 'a CSS animation still holds its first keyframe during its delay');
  const mid = await at(0.5);
  assert.deepEqual(mid.cssin, [0, 1], 'a from-only CSS animation that is over is no longer in effect, and ends on the element\'s own style');
  assert.deepEqual(mid.cssdim, [1, 0.4], 'a CSS animation with a real end state keeps it');
  assert.equal(mid.anims, 0, 'the exit has not started: no live animation on the scene');
  assert.equal(mid.filter, 'none');
  assert.equal(mid.late, 0, 'a delayed enter still holds its first keyframe');
  assert.equal(mid.still, 'img');
  assert.equal(mid.moving, 'canvas');
  const out = await at(1.75);
  assert.match(out.filter, /blur/, 'the exit plays');
  assert.equal(out.late, 1);
  const a = join(d, 'a'), b = join(d, 'b');
  await render(f, { output: a, workers: 1, ...quiet });
  await render(f, { output: b, workers: 3, ...quiet });
  const fa = readdirSync(a).sort();
  assert.ok(fa.length >= 90);
  assert.deepEqual(fa.filter((x) => !readFileSync(join(a, x)).equals(readFileSync(join(b, x)))), []);
});

// Natural motion (gm.motion 'natural', the default) vs classic (<html data-motion="classic">)
async function sampleAt(file, times, expr) {
  const ctx = await openComposition(file, { mode: 'render' });
  try { const out = []; for (const t of times) { await ctx.page.seek(t); out.push(await ctx.page.evaluate(expr)); } return out; } finally { await ctx.page.close(); await ctx.server.close(); }
}

test('natural motion: data-enter springs (pop overshoots, fade does not), duration grows with size, explicit ease wins; classic unchanged', { skip }, async () => {
  const d = tmp(), body = `<div data-duration="3">
    <div id="pop" style="position:absolute;left:20px;top:20px;width:100px;height:60px;background:#48f" data-enter="pop"></div>
    <div id="fade" style="position:absolute;left:140px;top:20px;width:100px;height:60px;background:#48f" data-enter="fade"></div>
    <div id="small" style="position:absolute;left:20px;top:120px;width:40px;height:40px;background:#f84" data-enter="slide-left"></div>
    <div id="big" style="position:absolute;left:0;top:200px;width:600px;height:100px;background:#f84" data-enter="slide-left"></div>
    <div id="given" style="position:absolute;left:300px;top:20px;width:100px;height:60px;background:#4f8" data-enter="pop 0.5 out-expo"></div></div>`;
  const fN = join(d, 'n.html'), fC = join(d, 'c.html');
  writeFileSync(fN, page(body));
  writeFileSync(fC, page(body, 'data-width="640" data-height="360" data-fps="30" data-motion="classic"'));
  const expr = `JSON.stringify(Object.fromEntries(['pop', 'fade', 'small', 'big', 'given'].map((id) => { const e = document.getElementById(id), a = e.getAnimations()[0], t = a && a.effect.getTiming(); return [id, { dur: t ? t.duration : null, ease: t ? t.easing : null, scale: getComputedStyle(e).scale, op: +getComputedStyle(e).opacity }]; })))`;
  const nat = (await sampleAt(fN, [0, 0.1, 0.15, 0.2, 0.25, 0.3], expr)).map(JSON.parse);
  const cls = (await sampleAt(fC, [0, 0.2], expr)).map(JSON.parse);
  assert.equal(cls[0].pop.dur, 600);
  assert.match(cls[0].pop.ease, /^cubic-bezier\(0\.16, ?1, ?0\.3, ?1\)$/);
  assert.equal(cls[0].big.dur, 600);
  assert.equal(nat[0].pop.ease, null, 'natural: a scale that overshoots is driven from the clock (inline), not an animation');
  assert.match(nat[0].fade.ease, /^linear\(/, 'natural: a sampled spring');
  assert.ok(nat.some((s) => parseFloat(s.pop.scale) > 1.01), 'pop overshoots a little: ' + nat.map((s) => s.pop.scale));
  assert.ok(nat.every((s) => s.pop.scale === 'none' || parseFloat(s.pop.scale) < 1.08), 'only a little');
  assert.ok(nat.every((s) => s.fade.op <= 1));
  assert.ok(nat[0].big.dur > nat[0].small.dur, 'a bigger slide takes longer ' + nat[0].big.dur + ' ' + nat[0].small.dur);
  assert.ok(nat[0].small.dur >= 600 * 0.85 - 1 && nat[0].big.dur <= 600 * 1.3 + 1);
  assert.equal(nat[0].given.dur, 500, 'a given duration is kept');
  assert.match(nat[0].given.ease, /^cubic-bezier\(0\.16/, 'a given ease is kept');
});

test('natural motion: timeline moves gather speed and settle, back-to-back tweens carry speed, diagonal moves arc (arc: 0 = straight), explicit ease wins', { skip }, async () => {
  const d = tmp(), body = `<div data-duration="4">
    <i id="m" style="position:absolute;left:0;top:0;width:10px;height:10px;background:#fff"></i>
    <i id="c" style="position:absolute;left:0;top:100px;width:10px;height:10px;background:#fff"></i>
    <i id="a" style="position:absolute;left:0;top:200px;width:10px;height:10px;background:#fff"></i>
    <i id="s" style="position:absolute;left:0;top:250px;width:10px;height:10px;background:#fff"></i>
    <i id="l" style="position:absolute;left:0;top:300px;width:10px;height:10px;background:#fff"></i></div>
    <script>
      gm.timeline().to('#m', { x: 300, duration: 1 }, 0);
      gm.timeline().to('#c', { x: 100, duration: 1 }, 0).to('#c', { x: 200, duration: 1 });
      gm.timeline().to('#a', { x: 300, y: 100, duration: 1 }, 0);
      gm.timeline().to('#s', { x: 300, y: 100, duration: 1, arc: 0 }, 0);
      gm.timeline().to('#l', { x: 300, duration: 1, ease: 'linear' }, 0);
    </script>`;
  const fN = join(d, 'n.html'), fC = join(d, 'c.html');
  writeFileSync(fN, page(body));
  writeFileSync(fC, page(body, 'data-width="640" data-height="360" data-fps="30" data-motion="classic"'));
  const expr = `JSON.stringify(Object.fromEntries(['m', 'c', 'a', 's', 'l'].map((id) => { const m = new DOMMatrix(getComputedStyle(document.getElementById(id)).transform); return [id, [Math.round(m.e * 100) / 100, Math.round(m.f * 100) / 100]]; })))`;
  const T = [0.1, 0.5, 0.95, 1, 1.05, 2.5];
  const [n01, n05, n095, n1, n105, nEnd] = (await sampleAt(fN, T, expr)).map(JSON.parse);
  const [c01, , c095, c1] = (await sampleAt(fC, T, expr)).map(JSON.parse);
  // classic: power1.out (an "out" curve: fast at the start), stops dead between back-to-back tweens
  assert.ok(Math.abs(c01.m[0] - 300 * 0.19) < 3, 'classic power1.out ' + c01.m[0]);
  assert.ok(c1.c[0] - c095.c[0] < 1, 'classic: stops before the joint ' + c095.c[0] + ' ' + c1.c[0]);
  assert.ok(Math.abs(c01.a[1] / c01.a[0] - 1 / 3) < 0.01, 'classic: straight line');
  // natural: gathers speed (slower start than power1.out), lands exactly, settles
  assert.ok(n01.m[0] < c01.m[0] * 0.6, 'natural move starts gently ' + n01.m[0]);
  assert.equal(nEnd.m[0], 300);
  assert.ok(n1.c[0] - n095.c[0] > 3 && n105.c[0] - n1.c[0] > 3, 'natural: speed carried through the joint ' + [n095.c[0], n1.c[0], n105.c[0]]);
  assert.ok(Math.abs(n1.c[0] - 100) < 0.5, 'the joint is still on the key');
  assert.equal(nEnd.c[0], 200);
  assert.ok(n05.a[1] < n05.s[1] - 10, 'diagonal move bends up ' + n05.a[1] + ' vs straight ' + n05.s[1]);
  assert.ok(Math.abs(n05.s[1] / n05.s[0] - 1 / 3) < 0.01, 'arc: 0 stays straight');
  assert.deepEqual([nEnd.a, nEnd.s], [[300, 100], [300, 100]]);
  assert.equal(n05.l[0], 150, 'an explicit ease is kept');
});

test('natural motion: staggers vary a little (seeded, first and last on time); renders the same with 1 and 2 workers', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<div data-duration="2"><div id="row" data-enter="fade-up 0.5" data-stagger="0.1" style="display:flex;gap:10px;padding:40px">${'<b style="width:50px;height:50px;background:#fc3"></b>'.repeat(6)}</div>
    <div id="cards" style="position:absolute;top:200px;left:40px;display:flex;gap:10px">${'<i class="k" style="width:50px;height:50px;background:#4cf"></i>'.repeat(5)}</div>
    <div id="fl" style="position:absolute;left:500px;top:40px;width:80px;height:50px;background:#f48"></div><div id="src" style="position:absolute;left:40px;top:280px;width:40px;height:25px"></div></div>
    <script>gm.timeline().from('.k', { y: 60, opacity: 0, stagger: 0.1 }, 0.2); gm.fly('#fl', { from: '#src', at: 0.6 });</script>`));
  const read = () => sampleAt(f, [0], `JSON.stringify([...document.querySelectorAll('#row > b')].map((e) => e.getAnimations()[0].effect.getTiming().delay))`).then((r) => JSON.parse(r[0]));
  const delays = await read();
  assert.equal(delays[0], 0);
  assert.ok(Math.abs(delays[5] - 500) < 1e-6, 'last on time ' + delays[5]);
  assert.ok(delays.slice(1, 5).some((v, i) => Math.abs(v - 100 * (i + 1)) > 2), 'interior pieces vary ' + delays);
  assert.ok(delays.slice(1, 5).every((v, i) => Math.abs(v - 100 * (i + 1)) <= 20 + 1e-6), 'by at most 20% of the step ' + delays);
  assert.deepEqual(await read(), delays, 'the same every time');
  const a = join(d, 'a'), b = join(d, 'b');
  await render(f, { output: a, workers: 1, ...quiet });
  await render(f, { output: b, workers: 2, ...quiet });
  const fa = readdirSync(a).sort();
  assert.ok(fa.length >= 55);
  assert.deepEqual(fa.filter((x) => !readFileSync(join(a, x)).equals(readFileSync(join(b, x)))), []);
});

// A world on a grid with cards: moved by back-to-back camera shots (robotic) or by one long eased move (smooth).
const motionWorld = `<div id="stage" data-duration="4" style="position:absolute;inset:0;overflow:hidden"><div id="world" style="position:absolute;left:0;top:0;width:1800px;height:1000px;transform-origin:0 0;background-image:linear-gradient(#2a3550 2px,transparent 2px),linear-gradient(90deg,#2a3550 2px,transparent 2px);background-size:40px 40px">
  ${[[80, 80, 'Plan'], [700, 120, 'Build'], [1300, 500, 'Ship'], [400, 700, 'Learn']].map(([x, y, t], i) => `<div id="c${i + 1}" style="position:absolute;left:${x}px;top:${y}px;width:200px;height:120px;border-radius:12px;background:#f4f1ea;color:#111;font:700 30px sans-serif;display:flex;align-items:center;justify-content:center">${t}</div>`).join('')}</div></div>`;

test('analyze --motion: camera stops and strobing in a robotic render, a smooth one scores higher; deterministic; strips of the busiest moments', { skip }, async () => {
  const { analyzeMotion, motionStrips } = await import('../src/analyze.js');
  const d = tmp(), fr = join(d, 'robotic.html'), fs = join(d, 'smooth.html');
  writeFileSync(fr, page(`${motionWorld}<script>gm.camera('#world').shot(0, { fit: '#c1', padding: 100, duration: 0 }).shot(0.4, { fit: '#c2', padding: 100, duration: 0.8 }).shot(1.2, { fit: '#c3', padding: 100, duration: 0.8 }).shot(2, { fit: '#c4', padding: 100, duration: 0.8 }).shot(2.8, { fit: '#c1', padding: 100, duration: 0.8 });</script>`, 'data-width="640" data-height="360" data-fps="30" data-duration="4" data-motion="classic"'));
  writeFileSync(fs, page(`${motionWorld}<script>gm.timeline('#stage').fromTo('#world', { x: 0, y: 0 }, { x: -1100, y: -600, duration: 3.8, ease: 'in-out-sine' }, 0.1);</script>`, 'data-width="640" data-height="360" data-fps="30" data-duration="4"'));
  const vr = join(d, 'robotic.mp4'), vs = join(d, 'smooth.mp4');
  await render(fr, { output: vr, ...quiet });
  await render(fs, { output: vs, motionBlur: 4, ...quiet });
  const r = await analyzeMotion(vr, { keepEnergy: true }), s = await analyzeMotion(vs);
  assert.ok(r.camera.stops >= 2, `camera stops between shots: ${JSON.stringify(r.camera)}`);
  assert.equal(s.camera.stops, 0, 'one long move does not stop');
  assert.ok(r.blur.fastFrames >= 10 && r.blur.blurredShare <= 0.2, `fast frames strobe: ${JSON.stringify(r.blur)}`);
  assert.ok(s.naturalness - r.naturalness >= 3, `smooth ${s.naturalness} vs robotic ${r.naturalness}`);
  const again = await analyzeMotion(vr);
  assert.deepEqual({ ...again, seconds: 0 }, { ...r, seconds: 0 }, 'the same video gives the same report');
  const strips = await motionStrips(vr, { output: join(d, 'strips'), energy: r.energy, fps: r.fps, count: 3 });
  assert.equal(strips.length, 3);
  for (const st of strips) assert.ok(readFileSync(st.file).subarray(1, 4).toString() === 'PNG' && st.end - st.start <= 1.01);
  for (let i = 1; i < strips.length; i++) assert.ok(strips[i].start >= strips[i - 1].end - 1e-6, 'windows do not overlap');
  // two busy seconds that leave no 1 s gap between or around them (0.75-1.75 s and 2.25-3.25 s of 4 s): the third window
  // still comes back, next to them, on every platform
  const fake = Array.from({ length: r.energy.length }, (_, k) => { const t = k / r.fps; return (t >= 0.75 && t < 1.75) || (t >= 2.25 && t < 3.25) ? 10 : 1; });
  const packed = await motionStrips(vr, { output: join(d, 'strips2'), energy: fake, fps: r.fps, count: 3 });
  assert.equal(packed.length, 3, JSON.stringify(packed.map((x) => [x.start, x.end])));
  for (let i = 1; i < packed.length; i++) assert.ok(packed[i].start >= packed[i - 1].end - 1e-6, 'packed windows do not overlap');
});

test('check: robotic motion warnings (camera-stop, fast-no-blur, straight-move, same-ease) in classic motion, none for smooth motion', { skip }, async () => {
  const d = tmp(), fr = join(d, 'robotic.html'), fs = join(d, 'smooth.html');
  const dots = [1, 2, 3, 4, 5].map((i) => `<i id="d${i}" style="position:absolute;left:30px;top:${30 + i * 40}px;width:60px;height:30px;background:#ff5a36"></i>`).join('');
  writeFileSync(fr, page(`${motionWorld}${dots}<script>gm.camera('#world').shot(0, { fit: '#c1', padding: 100, duration: 0 }).shot(0.4, { fit: '#c2', padding: 100, duration: 0.8, ease: 'power2.out' }).shot(1.2, { fit: '#c3', padding: 100, duration: 0.8, ease: 'power2.out' }).shot(2, { fit: '#c4', padding: 100, duration: 0.8, ease: 'power2.out' });
    const tl = gm.timeline('#stage');
    ${[1, 2, 3, 4, 5].map((i) => `tl.to('#d${i}', { x: 300, y: 150, duration: 0.8, ease: 'power2.out' }, ${0.2 * i}); tl.to('#d${i}', { x: 0, y: 0, duration: 0.5, ease: 'power2.out' }, ${2 + 0.2 * i});`).join('\n')}</script>`, 'data-width="640" data-height="360" data-fps="30" data-duration="4" data-motion="classic"'));
  writeFileSync(fs, page(`${motionWorld}<script>gm.timeline('#stage').fromTo('#world', { x: 0, y: 0 }, { x: -600, y: -300, duration: 3.8, ease: 'in-out-sine' }, 0.1);</script>`, 'data-width="640" data-height="360" data-fps="30" data-duration="4"'));
  const codes = async (f) => [...new Set((await check(f)).issues.map((i) => i.code))];
  const rep = await check(fr), rc = [...new Set(rep.issues.map((i) => i.code))];
  for (const c of ['camera-stop', 'fast-no-blur', 'straight-move', 'same-ease']) assert.ok(rc.includes(c), `${c} in ${rc.join(', ')}`);
  // style, not faults: reported as notes, so they never block or nag like a warning
  for (const i of rep.issues.filter((x) => ['camera-stop', 'fast-no-blur', 'straight-move', 'same-ease'].includes(x.code))) assert.equal(i.severity, 'info', i.code);
  assert.ok(rep.notes >= 4 && /style note/.test(formatReport(rep)));
  const sc = await codes(fs);
  for (const c of ['camera-stop', 'fast-no-blur', 'straight-move', 'same-ease']) assert.ok(!sc.includes(c), `no ${c} for smooth motion (${sc.join(', ')})`);
});

// natural camera (data-motion natural, the default): runs of back-to-back shots, follow lag, breathing, zoom overshoot, depth
async function seekEach(file, times, expr) {
  const ctx = await openComposition(file, { mode: 'render' });
  try { const out = []; for (const t of times) { await ctx.page.seek(t); out.push(await ctx.page.evaluate(expr)); } return out; } finally { await ctx.page.close(); await ctx.server.close(); }
}
const camExpr = `(() => { const w = document.querySelector('#world'), m = new DOMMatrix(getComputedStyle(w).transform), z = Math.hypot(m.a, m.b);
  const f = gm.__cameraFocus()[0], bg = document.querySelector('#bg'), pl = document.querySelector('#pl');
  return { cx: (320 - m.e) / z, cy: (180 - m.f) / z, z, focus: f && !f.overview ? [(f.l + f.r) / 2, (f.t + f.b) / 2, f.t] : null, bg: bg ? bg.style.transform : null, pl: pl ? pl.style.transform : null }; })()`;
const speeds = (rows) => rows.slice(1).map((r, i) => Math.hypot(r.cx - rows[i].cx, r.cy - rows[i].cy) * r.z + Math.abs(Math.log(r.z / rows[i].z)) * 367);

test('natural camera: back-to-back shots flow through without stopping, the run ends framed exactly, a fast zoom settles after a slight overshoot, background layers get depth; classic unchanged; 1 worker == 2', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html'), fc = join(d, 'c.html');
  const body = `<section class="scene" data-duration="5.5" style="position:absolute;inset:0;overflow:hidden">
    <div id="bg" style="position:absolute;inset:0;background:radial-gradient(circle at 30% 40%,#335,#111)"></div>
    <div id="pl" data-parallax="0.3" style="position:absolute;inset:0"></div>
    <div id="world" style="position:absolute;left:0;top:0;width:2400px;height:1400px">
      <div id="a" style="position:absolute;left:100px;top:100px;width:200px;height:120px;background:#1971c2"></div>
      <div id="b" style="position:absolute;left:900px;top:300px;width:200px;height:120px;background:#e8590c"></div>
      <div id="c" style="position:absolute;left:1700px;top:200px;width:200px;height:120px;background:#2f9e44"></div>
      <div id="d" style="position:absolute;left:1500px;top:1000px;width:200px;height:120px;background:#ae3ec9"></div>
      <div id="e" style="position:absolute;left:1580px;top:1050px;width:24px;height:18px;background:#fff"></div>
    </div></section>
    <script>gm.camera('#world').shot(0, { fit: '#a' }).shot(1, { fit: '#b', duration: 0.8 }).shot(1.8, { fit: '#c', duration: 0.8 }).shot(2.6, { fit: '#d', duration: 0.8 }).shot(4.2, { fit: '#e', duration: 0.5 });</script>`;
  writeFileSync(f, page(body));
  writeFileSync(fc, page(body, 'data-width="640" data-height="360" data-fps="30" data-motion="classic"'));
  const times = Array.from({ length: 79 }, (_, i) => 1 + i / 30); // 1 s .. 3.6 s, every frame
  const nat = await seekEach(f, times, camExpr), cla = await seekEach(fc, times, camExpr);
  const sn = speeds(nat), sc = speeds(cla), at = (s, t) => s[Math.round((t - 1) * 30) - 1];
  const peakN = Math.max(...sn), peakC = Math.max(...sc);
  for (const [t, k] of [[1.8, 0.3], [2.6, 0.1]]) { // at 2.6 s the path turns back (b, c, d): it slows to round the corner, no stop
    assert.ok(at(sn, t) > k * peakN, `natural: still moving at ${t}s (${at(sn, t).toFixed(1)} vs peak ${peakN.toFixed(1)} px/frame)`);
    assert.ok(at(sc, t) < 0.05 * peakC, `classic: stops at ${t}s (${at(sc, t).toFixed(1)} vs peak ${peakC.toFixed(1)})`);
  }
  assert.ok(peakN < peakC, 'one continuous move peaks lower than four separate ones');
  // the run ends at rest, framed as asked: #d centered, the default 60 px padding (within the breathing drift, ~1 px)
  const [held, before, arrive, settled] = await seekEach(f, [4, 4.69, 4.7, 5.1], camExpr);
  assert.ok(Math.abs(held.focus[0] - 320) < 1.5 && Math.abs(held.focus[1] - 180) < 1.5 && Math.abs(held.focus[2] - 60) < 1.5, 'framed: ' + JSON.stringify(held.focus));
  assert.match(held.bg, /^translate\(.+\) scale\(1\.09\)$/, 'background layer drifts with the camera');
  assert.doesNotMatch(held.pl, /1\.09/, 'data-parallax keeps its own depth');
  // fast zoom onto #e (x6.7 in 0.5 s): a touch past at the arrival, exact once settled
  const zE = Math.min(520 / 24, 240 / 18);
  assert.ok(arrive.z > zE * 1.015 && arrive.z < zE * 1.03, 'overshoot at the arrival: ' + arrive.z + ' vs ' + zE);
  assert.ok(before.z < arrive.z, 'still zooming in just before');
  assert.ok(Math.abs(settled.z - zE) < 1e-3, 'settled: ' + settled.z);
  const [cArrive, cHeld] = await seekEach(fc, [4.7, 4], camExpr);
  assert.ok(Math.abs(cArrive.z - zE) < 1e-3, 'classic: no overshoot');
  assert.equal(cHeld.bg, '', 'classic: background stays still');
  const shots = (await seekEach(f, [0], 'gm.__cameraShots()'))[0];
  assert.ok(Math.abs(shots[4].arrive - 4.925) < 1e-6, 'the zoom shot is at rest after it settles: ' + shots[4].arrive);
  const o1 = join(d, 'o1'), o2 = join(d, 'o2');
  await render(f, { output: o1, workers: 1, ...quiet });
  await render(f, { output: o2, workers: 2, ...quiet });
  const fa = readdirSync(o1).sort();
  assert.equal(fa.length, 165);
  assert.deepEqual(fa.filter((x) => !readFileSync(join(o1, x)).equals(readFileSync(join(o2, x)))), []);
});

test('camera: a long shot on the same subject holds still between two moves; a preserve-3d world is zoomed in depth too', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<section class="scene" data-duration="6" style="position:absolute;inset:0;overflow:hidden">
    <div id="world" style="position:absolute;left:0;top:0;width:2400px;height:1400px">
      <div id="a" style="position:absolute;left:100px;top:100px;width:200px;height:120px;background:#1971c2"></div>
      <div id="b" style="position:absolute;left:900px;top:300px;width:200px;height:120px;background:#e8590c"></div>
      <div id="c" style="position:absolute;left:1900px;top:1100px;width:200px;height:120px;background:#2f9e44"></div>
    </div></section>
    <script>gm.camera('#world').shot(0, { fit: '#a' }).shot(1, { fit: '#b', duration: 0.8 }).shot(1.85, { fit: '#b', zoom: 1.15, duration: 2, ease: 'sine.inOut' }).shot(3.9, { fit: '#c', duration: 0.8 });</script>`));
  const rows = await seekEach(f, [1.9, 2.4, 2.9, 3.4, 3.85], camExpr);
  for (const r of rows) assert.ok(Math.abs(r.cx - 1000) < 3 && Math.abs(r.cy - 360) < 3, 'the hold stays on #b: ' + JSON.stringify([r.cx, r.cy]));
  // 3D: a preserve-3d world under a perspective is zoomed in depth too (the perspective becomes P / zoom, which projects
  // like a uniform 3D scale); a flat world keeps its perspective-free flat scale
  const f3 = join(d, 'b.html');
  writeFileSync(f3, page(`<div id="stage" style="position:absolute;inset:0;perspective:900px"><div id="world" style="position:absolute;left:0;top:0;width:2000px;height:1200px;transform-style:preserve-3d">
    <div id="t" style="position:absolute;left:0;top:0;width:2000px;height:1200px;background:#345;transform:rotateX(40deg)"></div></div></div>
    <script>gm.camera('#world').shot(0, { fit: '#t' });</script>`, 'data-width="640" data-height="360" data-fps="30" data-duration="1"'));
  const [r3] = await seekEach(f3, [0.5], `(() => { const m = new DOMMatrix(document.querySelector('#world').style.transform); return { z: m.a, p: parseFloat(document.querySelector('#stage').style.perspective), flat: m.is2D }; })()`);
  assert.ok(r3.z < 0.5 && r3.flat, 'zoomed out with a flat scale: ' + JSON.stringify(r3));
  assert.ok(Math.abs(r3.p * r3.z / 900 - 1) < 0.002, 'perspective is 900 / zoom: ' + JSON.stringify(r3));
});

test('natural camera: follow trails a moving element and settles on it (lag: 0 and classic lock on); 1 worker == 2', { skip }, async () => {
  const d = tmp();
  const mk = (name, shot, attrs) => {
    const f = join(d, name);
    writeFileSync(f, page(`<section class="scene" data-duration="3" style="position:absolute;inset:0;overflow:hidden">
      <div id="world" style="position:absolute;left:0;top:0;width:1400px;height:400px"><div id="m" style="position:absolute;left:0;top:0;width:40px;height:40px;background:#fc3"></div></div></section>
      <script>gm.path.travel('#m', 'M120 180 L920 180', { stops: [[0.5, 0], [1.5, 1]], ease: 'linear' }); gm.camera('#world').shot(0, ${shot});</script>`, attrs));
    return f;
  };
  const expr = `(() => { const r = document.querySelector('#m').getBoundingClientRect(); return { dx: r.left + r.width / 2 - 320, dy: r.top + r.height / 2 - 180, cam: ${camExpr} }; })()`;
  const f = mk('a.html', `{ follow: '#m' }`);
  const [s0, s1, mid, late] = await seekEach(f, [0.5, 0.5 + 1 / 30, 1.0, 2.5], expr);
  assert.ok(mid.dx > 40 && mid.dx < 141, 'the camera trails: the element leads by ' + mid.dx);
  assert.ok(Math.abs(late.dx) < 1.5 && Math.abs(late.dy) < 1.5, 'settled on it a second after it stops: ' + JSON.stringify(late));
  assert.ok((s1.cam.cx - s0.cam.cx) * 30 < 0.5 * 800, 'the camera picks up speed gradually (inertia)');
  const [rigid] = await seekEach(mk('b.html', `{ follow: '#m', lag: 0 }`), [1.0], expr);
  assert.ok(Math.abs(rigid.dx) < 1.5, 'lag: 0 locks on: ' + rigid.dx);
  const [cl] = await seekEach(mk('c.html', `{ follow: '#m' }`, 'data-width="640" data-height="360" data-fps="30" data-motion="classic"'), [1.0], expr);
  assert.ok(Math.abs(cl.dx) < 0.5, 'classic locks on: ' + cl.dx);
  const o1 = join(d, 'o1'), o2 = join(d, 'o2');
  await render(f, { output: o1, workers: 1, ...quiet });
  await render(f, { output: o2, workers: 2, ...quiet });
  const fa = readdirSync(o1).sort();
  assert.equal(fa.length, 90);
  assert.deepEqual(fa.filter((x) => !readFileSync(join(o1, x)).equals(readFileSync(join(o2, x)))), []);
});

// --- motion blur (auto by default in natural motion) ---
import { resolveMotionBlur } from '../src/render.js';
import { imageLength } from '../src/ffmpeg.js';

// every test's folders go in one per run, removed at the end (each run used to leave dozens in the temp folder)
const TMP = mkdtempSync(join(tmpdir(), 'gm-feat-'));
after(() => rmSync(TMP, { recursive: true, force: true }));

test('motion blur: flag values', () => {
  assert.deepEqual(resolveMotionBlur(undefined), { mode: 'off', samples: 1, why: 'default' }); // off unless asked for
  assert.equal(resolveMotionBlur('on').mode, 'auto');
  assert.equal(resolveMotionBlur(undefined, { motion: 'classic' }).mode, 'off');
  assert.equal(resolveMotionBlur('auto', { motion: 'classic' }).mode, 'auto');
  assert.equal(resolveMotionBlur('off').mode, 'off');
  assert.equal(resolveMotionBlur(false).mode, 'off');
  assert.equal(resolveMotionBlur('0').mode, 'off');
  assert.deepEqual(resolveMotionBlur('8'), { mode: 'fixed', samples: 8 });
  assert.throws(() => resolveMotionBlur('lots'), /Bad --motion-blur/);
});

test('motion blur: the image splitter finds whole JPEG and PNG images in a stream', () => {
  const d = tmp();
  for (const f of ['a.jpg', 'a.png']) execFileSync(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=64x48:rate=1:duration=1', '-frames:v', '1', join(d, f)]);
  for (const [f, png] of [['a.jpg', false], ['a.png', true]]) {
    const b = readFileSync(join(d, f));
    assert.equal(imageLength(b, png), b.length);
    assert.equal(imageLength(Buffer.concat([b, b.subarray(0, 10)]), png), b.length);
    assert.equal(imageLength(b.subarray(0, b.length - 1), png), 0);
  }
});

// a fast box (crosses the frame in under a second), a slow box and a static label; a typed line
const blurPage = (attrs = '') => page(`<section data-duration="1.4" style="position:absolute;inset:0">
  <div id="fast" style="position:absolute;left:0;top:60px;width:80px;height:80px;background:#fff"></div>
  <div id="slow" style="position:absolute;left:100px;top:200px;width:60px;height:60px;background:#6cf"></div>
  <div style="position:absolute;right:30px;top:40px;width:120px;height:40px;background:#f80"></div>
  <p data-type="40" style="position:absolute;left:20px;bottom:10px;margin:0;font-size:22px">typing is not motion, it should not blur</p>
</section>
<script>gm.timeline().fromTo('#fast', { x: 0 }, { x: 540, duration: 0.6, ease: 'none' }, 0.3).fromTo('#slow', { x: 0 }, { x: 60, duration: 1.4, ease: 'none' }, 0);</script>`, `data-width="640" data-height="360" data-fps="30" ${attrs}`);

/** one row of one video frame as gray bytes: w pixels from (x, y) */
function grayFrame(video, n, w, x, y) {
  return execFileSync(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-i', video, '-vf', `select=eq(n\\,${n}),crop=${w}:2:${x}:${y},format=gray`, '-frames:v', '1', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 24 }).subarray(0, w);
}

test('motion blur: auto blurs only the frames where something moves fast, the same with 1 and 3 workers; a static box stays sharp', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, blurPage());
  const a = join(d, 'a.mp4'), b = join(d, 'b.mp4'), o = join(d, 'off.mp4');
  const sa = await render(f, { output: a, workers: 1, motionBlur: 'auto', cache: false, ...quiet });
  const sb = await render(f, { output: b, workers: 3, motionBlur: 'auto', cache: false, ...quiet });
  const so = await render(f, { output: o, motionBlur: 'off', cache: false, ...quiet });
  assert.ok(readFileSync(a).equals(readFileSync(b)), '1 worker == 3 workers');
  assert.equal(sa.motionBlur.mode, 'auto');
  // the fast box moves 30 px/frame (x1080/360 = 90 px/frame at 1080p) for 0.6 s: those ~18 frames (+1 on each side), nothing else
  assert.ok(sa.motionBlur.blurred >= 16 && sa.motionBlur.blurred <= 22, `blurred ${sa.motionBlur.blurred}`);
  assert.equal(so.motionBlur.mode, 'off');
  // frame 18 (t=0.6): the fast box's edges are a ramp (several gray levels), without blur a hard edge
  const row = (v) => { const g = grayFrame(v, 18, 640, 0, 100); return [...g]; };
  const levels = (px) => px.filter((x) => x > 40 && x < 215).length;
  const la = levels(row(a)), lo = levels(row(o));
  assert.ok(la >= lo + 6, `edge pixels between the box and the background: blurred ${la}, sharp ${lo}`);
  // the static orange box keeps its hard edge in the blurred frame
  const sa2 = [...grayFrame(a, 18, 200, 440, 60)], so2 = [...grayFrame(o, 18, 200, 440, 60)];
  const mid = (px) => px.filter((x) => x > 30 && x < 130).length;
  assert.ok(mid(sa2) <= mid(so2) + 1 && Math.max(...sa2.map((x, i) => Math.abs(x - so2[i]))) <= 16, `static edge: ${mid(sa2)} vs ${mid(so2)}`);
});

test('motion blur: data-motion="classic" turns it off (same video as --motion-blur off); a re-rendered part equals the full render', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html'), fc = join(d, 'c.html');
  writeFileSync(f, blurPage());
  writeFileSync(fc, blurPage('data-motion="classic"'));
  const off = join(d, 'off.mp4'), cl = join(d, 'classic.mp4');
  await render(f, { output: off, motionBlur: 'off', cache: false, ...quiet });
  const sc = await render(fc, { output: cl, cache: false, ...quiet });
  assert.equal(sc.motionBlur.mode, 'off');
  assert.ok(readFileSync(off).equals(readFileSync(cl)));
  // parts: render once with the cache, re-render the middle part only; must equal a render without the cache
  const full = join(d, 'full.mp4'), part = join(d, 'part.mp4');
  await render(f, { output: full, cache: false, workers: 2, ...quiet });
  await render(f, { output: part, workers: 1, ...quiet });
  const s2 = await render(f, { output: part, redo: '0.5s-0.9s', ...quiet });
  assert.ok(s2.parts.reused >= 1 && s2.parts.rendered >= 1);
  assert.ok(readFileSync(part).equals(readFileSync(full)));
});

// a camera-like world panning fast under a static HUD, and a box moving straight down
const smearPage = () => page(`<section data-duration="1" style="position:absolute;inset:0">
  <div id="world" style="position:absolute;left:0;top:0;width:1600px;height:360px">
    <div style="position:absolute;left:600px;top:60px;width:120px;height:120px;background:#fff"></div>
  </div>
  <div id="drop" style="position:absolute;left:560px;top:0;width:40px;height:40px;background:#fff"></div>
  <div style="position:absolute;right:10px;bottom:10px;width:100px;height:30px;background:#f80"></div>
</section>
<script>gm.timeline().fromTo('#world', { x: 0 }, { x: -960, duration: 0.6, ease: 'none' }, 0.2).fromTo('#drop', { y: -40 }, { y: 360, duration: 0.6, ease: 'none' }, 0.2);</script>`);

test('motion blur: auto draws a smooth smear along the move (no stepped copies), keeps a HUD over a moving world sharp, and is the same with 1 and 3 workers', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, smearPage());
  const a = join(d, 'a.mp4'), b = join(d, 'b.mp4'), o = join(d, 'off.mp4');
  const sa = await render(f, { output: a, workers: 1, motionBlur: 'auto', cache: false, ...quiet });
  await render(f, { output: b, workers: 3, motionBlur: 'auto', cache: false, ...quiet });
  await render(f, { output: o, motionBlur: 'off', cache: false, ...quiet });
  assert.ok(readFileSync(a).equals(readFileSync(b)), '1 worker == 3 workers');
  assert.equal(sa.motionBlur.mode, 'auto');
  // both movers run from 0.2 s to 0.8 s: frames 7-24 (a frame is smeared when it moved in the half shutter before it)
  assert.ok(sa.motionBlur.blurred >= 17 && sa.motionBlur.blurred <= 19, `blurred ${sa.motionBlur.blurred}`);
  // frame 15: the world moves 53 px/frame; the card's edges are one smooth ramp about half that wide, no steps
  const row = [...grayFrame(a, 15, 640, 0, 120)], sharp = [...grayFrame(o, 15, 640, 0, 120)];
  const ramp = (px, lo, hi) => {
    const seg = px.slice(Math.max(0, lo), hi), min = Math.min(...seg), max = Math.max(...seg), rise = max - min;
    let jump = 0, wide = 0;
    for (let i = 1; i < seg.length; i++) jump = Math.max(jump, Math.abs(seg[i] - seg[i - 1]));
    for (const v of seg) if (v > min + 0.1 * rise && v < max - 0.1 * rise) wide++;
    return { rise, jump, wide };
  };
  const edge = sharp.findIndex((v) => v > 128); // the card's left edge in the sharp frame
  const ra = ramp(row, edge - 40, edge + 40), ro = ramp(sharp, edge - 40, edge + 40);
  assert.ok(ra.rise > 150 && ro.rise > 150, `card edge found: ${ra.rise}, ${ro.rise}`);
  assert.ok(ra.wide >= 12 && ro.wide <= 3, `ramp width: smeared ${ra.wide}, sharp ${ro.wide}`);
  assert.ok(ra.jump <= 0.2 * ra.rise, `largest step in the smear ${ra.jump} of ${ra.rise}`);
  // the box moving down keeps sharp left/right edges (the smear goes along the move only)
  const mids = (px) => px.filter((v) => v > 40 && v < 215).length;
  const ya = [...grayFrame(a, 15, 120, 520, 180)], yo = [...grayFrame(o, 15, 120, 520, 180)];
  assert.ok(Math.max(...yo) > 200 && mids(ya) <= mids(yo) + 2, `side edges of the falling box: ${mids(ya)} vs ${mids(yo)}`);
  // the static HUD box is the same as without blur
  const ha = [...grayFrame(a, 15, 160, 470, 335)], ho = [...grayFrame(o, 15, 160, 470, 335)];
  assert.ok(Math.max(...ha.map((v, i) => Math.abs(v - ho[i]))) <= 12, 'HUD unchanged');
});

// an SVG street: a wide band of houses that never moves, and a bird in the same group that flies up fast (the
// group's box grows as the bird rises; that is not the houses moving)
const streetPage = () => page(`<svg width="640" height="360" viewBox="0 0 640 360" style="position:absolute;inset:0">
  <g id="street">
    <g id="houses"><rect x="-200" y="150" width="1040" height="90" fill="#c86"/><rect x="100" y="170" width="60" height="40" fill="#fff"/><rect x="300" y="170" width="60" height="40" fill="#fff"/></g>
    <g id="bird"><rect x="480" y="250" width="24" height="16" fill="#fff"/></g>
  </g>
</svg>
<script>gm.timeline().fromTo('#bird', { y: 0 }, { y: -250, duration: 0.5, ease: 'none' }, 0.3);</script>`, 'data-width="640" data-height="360" data-fps="30" data-duration="1"');

test('motion blur: in an SVG group, a child flying off does not smear its still siblings (the group box growing is not a move)', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, streetPage());
  const a = join(d, 'a.mp4'), o = join(d, 'off.mp4');
  const sa = await render(f, { output: a, motionBlur: 'auto', cache: false, ...quiet });
  await render(f, { output: o, motionBlur: 'off', cache: false, ...quiet });
  // the bird is smeared while it flies (frames 10-24), nothing else is
  assert.ok(sa.motionBlur.blurred >= 13 && sa.motionBlur.blurred <= 17, `blurred ${sa.motionBlur.blurred}`);
  // every frame while the bird flies: the houses' windows and the top edge of the band are as sharp as without blur
  for (const n of [12, 15, 18, 21]) {
    const col = (v) => [...execFileSync(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-i', v, '-vf', `select=eq(n\\,${n}),crop=2:120:128:130,format=gray`, '-frames:v', '1', '-f', 'rawvideo', '-'])].filter((_, i) => i % 2 === 0);
    const ca = col(a), co = col(o);
    assert.ok(Math.max(...ca.map((v, i) => Math.abs(v - co[i]))) <= 12, `frame ${n}: houses column differs from the unblurred frame by ${Math.max(...ca.map((v, i) => Math.abs(v - co[i])))}`);
  }
});

test('motion blur: a world that speeds up gets a smear that grows frame by frame, never one that switches on at full length', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  // a full-screen world with tall white bars, speeding up smoothly from still to 30 px/frame
  writeFileSync(f, page(`<div id="w" style="position:absolute;left:0;top:0;width:4000px;height:360px;background:repeating-linear-gradient(90deg,#fff 0 40px,#000 40px 120px)"></div>
<script>gm.timeline().fromTo('#w', { x: 0 }, { x: -900, duration: 1.5, ease: 'power2.in' }, 0);</script>`, 'data-width="640" data-height="360" data-fps="30" data-duration="1.5"'));
  const a = join(d, 'a.mp4');
  await render(f, { output: a, motionBlur: 'auto', cache: false, ...quiet });
  // per frame: the pixels between black and white along a row (how soft the bar edges are)
  const soft = [];
  for (let n = 1; n < 45; n++) { const g = [...grayFrame(a, n, 640, 0, 180)]; soft.push(g.filter((v) => v > 40 && v < 215).length); }
  const first = soft.findIndex((v) => v > 0);
  assert.ok(first > 3 && first + 4 < soft.length, `slow start is sharp, the fast end smeared: ${soft.join(' ')}`);
  // the first smeared frame is a light smear (well under the one 4 frames later), not a full one switching on
  assert.ok(soft[first] <= 0.5 * soft[first + 4], `smear onset ${soft[first]} vs ${soft[first + 4]} four frames later (${soft.join(' ')})`);
});

test('timeline: color tweens to var(--x) and color-mix() resolve against the element (no black, no snap); gm.burst colors too', { skip }, async () => {
  const d = tmp(), f = join(d, 'v.html');
  writeFileSync(f, page(`<style>:root{--accent:#ff0000;--mix:color-mix(in srgb, var(--accent) 50%, #0000ff)}</style>
    <div id="a" style="position:absolute;left:0;top:0;width:100px;height:100px;background:#0000ff"></div>
    <div id="b" style="position:absolute;left:200px;top:0;width:100px;height:100px;background:#000"></div>
    <script>gm.timeline('#stage').to('#a', { backgroundColor: 'var(--accent)', duration: 1, ease: 'linear' }, 0).to('#b', { backgroundColor: 'var(--mix, #fff)', duration: 1 }, 0);</script>`, 'data-width="640" data-height="360" data-fps="30" data-duration="2"'));
  const rows = await seekEach(f, [0.5, 1.5], `[getComputedStyle(document.querySelector('#a')).backgroundColor, getComputedStyle(document.querySelector('#b')).backgroundColor]`);
  const rgb = (s) => s.match(/[\d.]+/g).map(Number);
  const [mr, , mb] = rgb(rows[0][0]);
  assert.ok(mr > 40 && mb > 40, `halfway between blue and red: ${rows[0][0]}`);
  assert.deepEqual(rgb(rows[1][0]).slice(0, 3), [255, 0, 0]);
  const [er, , eb] = rgb(rows[1][1]);
  assert.ok(er > 100 && eb > 100, `color-mix end resolved: ${rows[1][1]}`);
});

test('data-scramble: hidden (layout kept) until its delay, then decodes to the real text', { skip }, async () => {
  const d = tmp(), f = join(d, 's.html');
  writeFileSync(f, page(`<h1 id="s" data-scramble="0.5" data-scramble-delay="1">Decode me</h1>`, 'data-width="640" data-height="360" data-fps="30" data-duration="2"'));
  const rows = await seekEach(f, [0.5, 1.2, 1.9], `[document.querySelector('#s').style.visibility, document.querySelector('#s').textContent]`);
  assert.deepEqual(rows[0], ['hidden', 'Decode me']);
  assert.equal(rows[1][0], '');
  assert.notEqual(rows[1][1], 'Decode me');
  assert.equal(rows[2][1], 'Decode me');
});

test('timeline draw on a data-sketch shape (a <g> of rough strokes) draws it on progressively, not all at once', { skip }, async () => {
  const d = tmp(), f = join(d, 'k.html');
  writeFileSync(f, page(`<svg viewBox="0 0 640 360" data-sketch style="position:absolute;inset:0"><rect id="box" x="100" y="100" width="300" height="150" fill="none" stroke="#fff" stroke-width="6"/></svg>
    <script>gm.timeline('body').fromTo('#box', { draw: 0 }, { draw: 1, duration: 1, ease: 'linear' }, 0.5);</script>`, 'data-width="640" data-height="360" data-fps="30" data-duration="2"'));
  const rows = await seekEach(f, [0.2, 1.0, 1.8], `[...document.querySelectorAll('#box path')].filter((p) => !p.closest('[data-gm-sketch-guide]') && p.style.visibility !== 'hidden').map((p) => parseFloat(p.style.strokeDasharray))`);
  assert.ok(rows[0].length && rows[0].every((x) => +x === 0), `hidden before: ${rows[0]}`);
  assert.ok(rows[1].every((x) => +x > 0.3 && +x < 0.7), `half drawn: ${rows[1]}`);
  assert.ok(rows[2].every((x) => +x === 1), `done: ${rows[2]}`);
});

test('captions: the command pages a word-timed file (and writes nothing next to it)', { skip }, () => {
  const d = tmp();
  const words = 'one two three four five six seven'.split(' ').map((w, i) => ({ word: w, start: i * 0.4, end: i * 0.4 + 0.35 }));
  writeFileSync(join(d, 'words.json'), JSON.stringify(words));
  const out = JSON.parse(execFileSync(process.execPath, [join(ROOT, 'src', 'cli.js'), 'captions', join(d, 'words.json'), '--words', '3', '--json'], { encoding: 'utf8' }));
  // at most 3 words a page, every word once and in order (the block balances pages: no lone last word)
  assert.ok(out.length >= 3 && out.every((p) => p.text.split(' ').length <= 3));
  assert.equal(out.map((p) => p.text).join(' '), words.map((w) => w.word).join(' '));
  assert.deepEqual(readdirSync(d), ['words.json']);
});

test('render: media files must be inside the project folder', { skip }, async () => {
  const d = tmp();
  mkdirSync(join(d, 'proj'));
  writeFileSync(join(d, 'proj', 'package.json'), '{}');
  execFileSync(ffmpegPath(), ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', join(d, 'outside.wav')]);
  writeFileSync(join(d, 'proj', 'index.html'), page('<audio src="..%2foutside.wav"></audio>', 'data-width="320" data-height="180" data-fps="10" data-duration="1"'));
  await assert.rejects(render(join(d, 'proj', 'index.html'), { output: join(d, 'out.mp4'), ...quiet }), /inside the project folder/);
});

test('timeline text: set() swaps a string in at its time, to() swaps at its end, numbers still count, seeking back restores; 1 worker == 2', { skip }, async () => {
  const d = tmp(), f = join(d, 'tx.html');
  writeFileSync(f, page(`<main data-sequence><section class="scene" data-duration="1">A</section>
    <section class="scene" id="s2" data-duration="2" style="font-size:40px"><b id="y">Score 0</b> <i id="c">00:00</i> <u id="z">old</u> <em id="w">0</em> <s id="n">000</s> <span id="t"></span>
    <script>gm.timeline('#s2').set('#y', { textContent: 'Live now' }, 0.5).to('#y', { textContent: 'Done', duration: 0.5 }, 1)
      .set('#c', { text: '12:30' }, 0.5).set('#c', { textContent: '12:45' }, 1.2)
      .fromTo('#z', { textContent: 'from' }, { textContent: 'to', duration: 0.5 }, 1)
      .to('#w', { textContent: '50%', duration: 1, ease: 'linear' }, 0.5).set('#n', { textContent: 42 }, 0.5)
      .to('#t', { text: 'Hello', duration: 1, ease: 'linear' }, 0.5);</script></section></main>`, 'data-width="640" data-height="360" data-fps="30" data-duration="3"'));
  const expr = `['y', 'c', 'z', 'w', 'n', 't'].map((id) => document.getElementById(id).textContent)`;
  const rows = await seekEach(f, [1.2, 1.6, 2.3, 2.7, 1.6, 1.2], expr);
  assert.deepEqual(rows[0], ['Score 0', '00:00', 'from', '0', '000', '']); // fromTo shows its start text before it starts
  assert.deepEqual(rows[1], ['Live now', '12:30', 'from', '5%', '042', 'H']);
  assert.deepEqual(rows[2], ['Live now', '12:45', 'from', '40%', '042', 'Hell']); // to() holds the old text until its end
  assert.deepEqual(rows[3], ['Done', '12:45', 'to', '50%', '042', 'Hello']); // text: types its string out
  assert.deepEqual(rows[4], rows[1], 'seeking back shows the earlier text');
  assert.deepEqual(rows[5], rows[0]);
  const a = join(d, 'a'), b = join(d, 'b');
  await render(f, { output: a, format: 'png', workers: 1, ...quiet });
  await render(f, { output: b, format: 'png', workers: 2, ...quiet });
  const fa = readdirSync(a).sort();
  assert.equal(fa.length, 90);
  for (const x of fa) assert.ok(readFileSync(join(a, x)).equals(readFileSync(join(b, x))), 'frame differs: ' + x);
});

test('gm.onFrame(sel, fn) passes the element; onFrame(fn) inside a later scene is reported with the fix (check shows it)', { skip }, async () => {
  const d = tmp(), f = join(d, 'of.html');
  writeFileSync(f, page(`<section id="s0" data-duration="1"><script>gm.onFrame(() => {});</script></section>
    <section id="s2" data-start="1" data-duration="2"><b id="o"></b><script>
      gm.onFrame('#s2', (t, info, el) => { el.dataset.t = [t.toFixed(2), el.id, info.time.toFixed(2)].join('|'); });
      gm.onLayout('#s2', (t, info, el) => { el.dataset.l = el.id; });
      gm.onFrame((t) => { o.textContent = t.toFixed(2); });</script></section>
    <script>gm.onFrame('#missing', () => {});</script>`, 'data-width="640" data-height="360" data-fps="30" data-duration="3"'));
  const [v] = await seekEach(f, [1.5], `[s2.dataset.t, s2.dataset.l, o.textContent]`);
  assert.deepEqual(v, ['0.50|s2|1.50', 's2', '1.50'], 'local time, info, element; the global callback keeps the video time');
  const rep = await check(f, { fast: true });
  const g = rep.issues.filter((i) => i.code === 'onframe-global-time');
  assert.equal(g.length, 1, 'only the scene that does not start at 0');
  assert.equal(g[0].severity, 'warning');
  assert.equal(g[0].selector, '#s2');
  assert.match(g[0].fix, /gm\.onFrame\('#s2', \(local/);
  assert.ok(rep.issues.some((i) => i.code === 'onframe-no-target'), 'a selector that matches nothing is reported');
});

test('render for apps: --cache-dir, onProgress phases, --progress json lines; scale 4/3 gives exact even sizes, 1 worker == 2; 1.333 is refused with the fix', { skip }, async () => {
  const d = tmp(), f = join(d, 'sc.html');
  writeFileSync(f, page(`<div id="b" style="position:absolute;left:40px;top:60px;width:120px;height:120px;background:#f80;border-radius:20px"></div>
    <script>gm.timeline().to('#b', { x: 280, duration: 1.4, ease: 'linear' }, 0);</script>`, 'data-width="480" data-height="270" data-fps="30" data-duration="1.5"'));
  const phases = [];
  const out1 = join(d, 'o1', 'v.mp4'), cache = join(d, 'cache');
  const s = await render(f, { output: out1, workers: 1, scale: '4/3', cacheDir: cache, onProgress: (p) => phases.push(p), ...quiet });
  assert.equal(s.width, 640); assert.equal(s.height, 360);
  assert.ok(readdirSync(join(cache, 'v.mp4')).includes('parts.json'), 'parts kept in the cache dir');
  assert.ok(!readdirSync(join(d, 'o1')).includes('.gm-parts'), 'nothing next to the output');
  const names = phases.map((p) => p.phase).filter((p, i, a) => p !== a[i - 1]);
  assert.deepEqual(names, ['open', 'frames', 'encode', 'done']);
  const last = phases.filter((p) => p.phase === 'frames').pop();
  assert.equal(last.done, 45); assert.equal(last.total, 45); assert.ok(last.fps > 0);
  // the CLI: stderr is only JSON lines
  const out2 = join(d, 'o2', 'v.mp4');
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, [join(ROOT, 'src', 'cli.js'), 'render', f, '-o', out2, '--scale', '4/3', '--workers', '2', '--no-cache', '--progress', 'json'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const events = r.stderr.trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(events[0].phase, 'open');
  assert.equal(events[events.length - 1].phase, 'done');
  assert.ok(events.some((e) => e.event === 'progress' && e.phase === 'frames' && e.done === 45));
  assert.ok(readFileSync(out1).equals(readFileSync(out2)), '4/3: 1 worker == 2 workers');
  await assert.rejects(render(f, { output: join(d, 'x.mp4'), scale: 1.333, ...quiet }), /not whole pixels.*--scale 4\/3 \(640x360\)/);
});

test('render: --cache-key shares the parts between outputs with different names (render-v1, render-v2), and keeps them in one folder', { skip }, async () => {
  const d = tmp(), f = join(d, 'k.html');
  writeFileSync(f, page(`<div id="b" style="position:absolute;left:40px;top:60px;width:120px;height:120px;background:#f80"></div>
    <script>gm.timeline().to('#b', { x: 200, duration: 1.4, ease: 'linear' }, 0);</script>`, 'data-width="320" data-height="180" data-fps="30" data-duration="1.5"'));
  const a = await render(f, { output: join(d, 'o', 'render-v1.mp4'), workers: 1, cacheKey: 'job', ...quiet });
  const b = await render(f, { output: join(d, 'o', 'render-v2.mp4'), workers: 1, cacheKey: 'job', ...quiet });
  assert.equal(b.parts.rendered, 0, 'the second name reuses every part');
  assert.equal(b.parts.reused, a.parts.total);
  assert.deepEqual(readdirSync(join(d, 'o', '.gm-parts')), ['job'], 'one folder for both versions');
  assert.ok(b.parts.bytes > 0, 'the summary says how much the parts take');
  assert.ok(readFileSync(join(d, 'o', 'render-v1.mp4')).equals(readFileSync(join(d, 'o', 'render-v2.mp4'))));
  await assert.rejects(render(f, { output: join(d, 'x.mp4'), cacheKey: '../x', ...quiet }), /Bad cache key/);
});

test('gm-include scope: the same part twice, each copy with its own ids, tween targets, style and keyframes; without scope the names clash', { skip }, async () => {
  const d = tmp(), f = join(d, 'sc.html');
  writeFileSync(join(d, 'card.html'), `<style>.box{background:{{color}};width:60px;height:60px;position:absolute;top:{{top}}px;left:10px;animation:spin-{{scope|x}} 2s linear both}@keyframes spin-{{scope|x}}{from{opacity:1}to{opacity:1}}.t{outline-width:7px;outline-style:solid}#mark{position:absolute;top:{{top}}px;left:200px;width:20px;height:20px;background:{{color}}}</style>
    <div class="box t"></div><div id="mark"></div>
    <svg width="0" height="0"><defs><linearGradient id="g"><stop offset="0" stop-color="{{color}}"/></linearGradient></defs></svg>
    <script>gm.timeline().to('#mark', { x: {{dx}}, duration: 1, ease: 'linear' }, 0);</script>`);
  const body = (scope) => `<section class="scene" data-duration="2"><i class="t" id="out" style="position:absolute;top:300px"></i>
    <gm-include src="card.html" color="red" top="20" dx="100" ${scope}></gm-include>
    <gm-include src="card.html" color="blue" top="120" dx="300" ${scope}></gm-include></section>`;
  const probe = async (scope) => {
    writeFileSync(f, page(body(scope), 'data-width="640" data-height="360" data-fps="30" data-duration="2"'));
    const ctx = await openComposition(f, { mode: 'render' });
    try {
      await ctx.page.seek(1);
      return await ctx.page.evaluate(`(() => [...document.querySelectorAll('[id^=mark]')].map((e) => [e.id, Math.round(e.getBoundingClientRect().left)]).concat([[getComputedStyle(document.querySelector('.box')).outlineStyle, getComputedStyle(document.querySelector('#out')).outlineStyle]]))()`);
    } finally { await ctx.page.close(); await ctx.server.close(); }
  };
  const on = await probe('scope');
  assert.deepEqual(on.slice(0, 2), [['mark--s1', 300], ['mark--s2', 500]], 'each copy moves its own mark');
  assert.deepEqual(on[2], ['solid', 'none'], 'the part style reaches its own copy and nothing outside it');
  const off = await probe('');
  assert.ok(off.slice(0, 2).some(([id]) => id === 'mark') && !off.some(([id]) => /--s/.test(id)), 'unscoped ids keep their names');
  assert.notDeepEqual(off.slice(0, 2).map((x) => x[1]), [300, 500], 'unscoped: both tweens hit the first #mark');
  assert.equal(off[2][1], 'solid', 'unscoped: the part style leaks out');
});

test('audio: two loud tracks are limited instead of hard-clipping; quiet audio and timing stay exact', { skip }, async () => {
  const d = tmp(), f = join(d, 'au.html'), ff = ffmpegPath();
  const tone = (name, freq, vol) => execFileSync(ff, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `sine=f=${freq}:d=2,volume=${vol}`, '-ar', '48000', '-ac', '2', join(d, name)]);
  tone('a.wav', 220, 6.4); tone('b.wav', 330, 6.4); // 0.8 each: the sum reaches 1.6
  const wav = async (loud) => {
    writeFileSync(f, page(`<audio src="a.wav" data-volume="${loud ? 1 : 0.25}"></audio><audio src="b.wav" data-volume="${loud ? 1 : 0.25}"></audio>`, 'data-width="160" data-height="90" data-fps="10" data-duration="2"'));
    const o = join(d, loud ? 'loud.mov' : 'quiet.mov'); // mov keeps the sound as 16-bit PCM
    await render(f, { output: o, ...quiet });
    const b = execFileSync(ff, ['-v', 'error', '-i', o, '-vn', '-f', 's16le', '-ac', '2', '-ar', '48000', '-'], { maxBuffer: 1 << 26 }), n = b.length >> 1;
    return { n, at: (i) => b.readInt16LE(2 * i) };
  };
  const L = await wav(true), Q = await wav(false);
  let peakL = 0, clipped = 0, peakQ = 0;
  for (let i = 0; i < L.n; i++) { const v = Math.abs(L.at(i)); peakL = Math.max(peakL, v); if (v >= 32767) clipped++; }
  for (let i = 0; i < Q.n; i++) peakQ = Math.max(peakQ, Math.abs(Q.at(i)));
  assert.equal(clipped, 0, 'no hard-clipped samples');
  assert.ok(peakL > 28000 && peakL <= 31700, 'limited near 0.966, not squashed: ' + peakL);
  assert.equal(L.n, 2 * 96000, 'the mix is exactly 2 s of stereo');
  // quiet (each track at 0.25, the sum is well below the limit): the limiter changes nothing (within one 16-bit step of rounding)
  const ref = execFileSync(ff, ['-v', 'error', '-i', join(d, 'a.wav'), '-i', join(d, 'b.wav'), '-filter_complex', '[0]volume=0.25[x];[1]volume=0.25[y];[x][y]amix=inputs=2:normalize=0', '-f', 's16le', '-ac', '2', '-ar', '48000', '-'], { maxBuffer: 1 << 26 });
  assert.ok(peakQ > 6000 && peakQ < 20000, 'quiet mix level ' + peakQ);
  let off = 0, mx = 0;
  for (let i = 0; i < Q.n; i++) { const df = Math.abs(Q.at(i) - ref.readInt16LE(2 * i)); if (df) { off++; mx = Math.max(mx, df); } }
  assert.ok(mx <= 1, 'quiet samples that differ from the plain mix: ' + off + ' of ' + Q.n + ', max ' + mx);
});

test('data-anchor fit: a mark takes the box of its target every frame (moving, scaled), inside the container it is placed in', { skip }, async () => {
  const d = tmp(), f = join(d, 'fit.html');
  writeFileSync(f, page(`<section class="scene" data-duration="2"><div id="panel" style="position:absolute;left:20px;top:20px;width:400px;height:200px;overflow:hidden">
      <div id="mark" data-anchor="#word fit 10" style="background:rgba(255,200,0,.4)"></div>
      <b id="word" style="position:absolute;left:30px;top:70px;font-size:40px">Revenue</b></div>
    <script>gm.timeline().to('#word', { x: 250, scale: 1.4, duration: 1.5, ease: 'linear' }, 0);</script></section>`, 'data-width="640" data-height="360" data-fps="30" data-duration="2"'));
  const ctx = await openComposition(f, { mode: 'render' });
  const out = [];
  try {
    for (const t of [0.2, 0.9, 1.4]) {
      await ctx.page.seek(t);
      out.push(await ctx.page.evaluate(`(() => { const r = (e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; }; const w = r(document.querySelector('#word')), m = r(document.querySelector('#mark')), g = 10 * gm.px; return { w, m, g, clip: document.querySelector('#mark').parentElement.id }; })()`));
    }
  } finally { await ctx.page.close(); await ctx.server.close(); }
  for (const { w, m, g } of out) {
    const want = [w[0] - g, w[1] - g, w[2] + g, w[3] + g];
    assert.ok(want.every((v, i) => Math.abs(v - m[i]) < 1), `mark ${m.map((x) => x.toFixed(1))} vs word box + gap ${want.map((x) => x.toFixed(1))}`);
  }
  assert.ok(out[2].m[0] > out[0].m[0] + 100, 'the mark moved with the word');
  assert.equal(out[0].clip, 'panel');
});

test('a scoped part brings its own timeline: times count from its own start, selectors stay inside the copy', { skip }, async () => {
  const d = tmp(), f = join(d, 'pt.html');
  writeFileSync(join(d, 'card.html'), `<b class="t" style="position:absolute;left:20px;top:{{top}}px">{{label}}</b>
    <script>gm.timeline('[data-gm-scope="{{scope}}"]').from('.t', { x: -100, duration: 1, ease: 'linear' }, 0);</script>`);
  writeFileSync(f, page(`<section class="scene" data-duration="6"><gm-include src="card.html" scope top="20" label="one" data-start="0" data-duration="6"></gm-include>
    <gm-include src="card.html" scope top="120" label="two" data-start="3" data-duration="3"></gm-include></section>`, 'data-width="640" data-height="360" data-fps="30" data-duration="6"'));
  const ctx = await openComposition(f, { mode: 'render' });
  try {
    const at = async (t) => { await ctx.page.seek(t); return ctx.page.evaluate(`[...document.querySelectorAll('.t')].map((e) => Math.round(e.getBoundingClientRect().left))`); };
    assert.equal((await at(0.5))[0], -30, 'the first copy plays from 0');
    assert.deepEqual(await at(3.5), [20, -30], 'the second copy plays from its own start (3 s), not from 0');
  } finally { await ctx.page.close(); await ctx.server.close(); }
});

test('scene files: <gm-include> of a scene inside data-sequence is the sequence child (duration from the file, transitions between them)', { skip }, async () => {
  const d = tmp(), f = join(d, 'as.html');
  mkdirSync(join(d, 'scenes'));
  writeFileSync(join(d, 'scenes', 's.html'), `<style>.sc-{{title}}{color:#fff}</style><section class="scene" data-duration="{{len}}" style="background:{{bg}}"><h1 class="sc-{{title}}" style="position:absolute;left:40px;top:40px">{{title}}</h1></section>`);
  writeFileSync(f, page(`<main data-sequence data-transition="push-left 0.5">
    <gm-include src="scenes/s.html" title="One" bg="#c33" len="2"></gm-include>
    <gm-include src="scenes/s.html" title="Two" bg="#33c" len="3"></gm-include>
    <gm-include src="scenes/s.html" title="Three" bg="#3a3" len="2"></gm-include></main>`, 'data-width="640" data-height="360" data-fps="30"'));
  const rep = await check(f, { fast: true });
  assert.deepEqual(rep.issues.filter((i) => i.severity === 'error').map((i) => i.code), []);
  assert.equal(rep.info.duration, 6, '2 + 3 + 2 s, minus two 0.5 s transitions');
  assert.equal(await evalAt(f, 1, `document.querySelectorAll('main > section.scene').length`), 3, 'the scenes are the sequence children');
});

test('brand kit: a folder linked into the project (symlink) brings its tokens, fonts path and scoped parts; a kit change redoes the parts', { skip }, async () => {
  const d = tmp(), proj = join(d, 'ep1'), kit = join(d, 'brand');
  mkdirSync(join(kit, 'parts'), { recursive: true }); mkdirSync(proj);
  writeFileSync(join(kit, 'kit.css'), ':root{--brand:rgb(224,69,123)}');
  writeFileSync(join(kit, 'parts', 'tag.html'), '<b id="tag" style="position:absolute;left:30px;top:30px;color:var(--brand);font-size:40px">{{text}}</b>');
  symlinkSync('../brand', join(proj, 'brand'));
  writeFileSync(join(proj, 'index.html'), page(`<link rel="stylesheet" href="brand/kit.css"><gm-include src="brand/parts/tag.html" scope text="Hello"></gm-include>`, 'data-width="320" data-height="180" data-fps="10" data-duration="1"'));
  assert.equal(await evalAt(join(proj, 'index.html'), 0.5, `getComputedStyle(document.querySelector('[id^=tag]')).color`), 'rgb(224, 69, 123)');
  const out = join(d, 'o', 'v.mp4');
  await render(join(proj, 'index.html'), { output: out, ...quiet });
  writeFileSync(join(kit, 'kit.css'), ':root{--brand:rgb(60,200,255)}');
  const s2 = await render(join(proj, 'index.html'), { output: out, ...quiet });
  assert.equal(s2.parts.reused, 0, 'a change in the kit redoes every part');
});

test('a CSS-hidden element with a fromTo stays hidden until it starts, also when the sequence has a morph pair', { skip }, async () => {
  const d = tmp(), f = join(d, 'mh.html');
  writeFileSync(f, page(`<style>#r{position:absolute;left:100px;top:100px;width:50px;height:50px;background:red;opacity:0}</style>
    <main data-sequence data-transition="morph 0.8"><section class="scene" id="s" data-duration="2"><i id="r"></i><div data-morph="d" style="width:40px;height:40px;background:blue"></div></section>
    <section class="scene" id="t" data-duration="2"><div data-morph="d" style="width:20px;height:20px;background:blue;margin:200px"></div></section></main>
    <script>gm.timeline('#s').fromTo('#r', { scale: 0.3, opacity: 0.8 }, { scale: 1.8, opacity: 0, duration: 0.9 }, 0.6);</script>`, 'data-width="640" data-height="360"'));
  const ctx = await openComposition(f, { mode: 'render' });
  try {
    const at = async (t) => { await ctx.page.seek(t); return ctx.page.evaluate(`+getComputedStyle(document.querySelector('#r')).opacity`); };
    assert.equal(await at(0.3), 0, 'hidden before its tween starts');
    assert.equal(await at(0.6), 0.8, 'visible from the start of the tween');
  } finally { await ctx.page.close(); await ctx.server.close(); }
});

test('morph between scenes flies on a slight arc in natural motion, straight in classic', { skip }, async () => {
  const d = tmp();
  const pg = (attr) => page(`<main data-sequence data-transition="morph 1"><section class="scene" data-duration="2"><div id="a" data-morph="m" style="position:absolute;left:100px;top:250px;width:40px;height:40px;background:#f55"></div></section>
    <section class="scene" data-duration="2"><div id="b" data-morph="m" style="position:absolute;left:500px;top:50px;width:40px;height:40px;background:#f55"></div></section></main>`, `data-width="640" data-height="360" ${attr}`);
  const mid = async (attr) => { const f = join(d, `mo${attr.length}.html`); writeFileSync(f, pg(attr)); return evalAt(f, 1.5, `(() => { const r = document.querySelector('#a').getBoundingClientRect(); return [r.left, r.top]; })()`); };
  const [nx, ny] = await mid(''), [cx, cy] = await mid('data-motion="classic"');
  assert.ok(Math.abs(cy - 150) < 2 && Math.abs(cx - 300) < 2, `classic flies straight: ${cx},${cy}`);
  assert.ok(Math.abs(nx - 300) < 2 && cy - ny > 25 && cy - ny < 45, `natural bends up by about 10% of the horizontal distance (40 px): ${nx},${ny}`);
});

test('check: timeline-no-target names each selector of a list that matched nothing, also when the others matched', { skip }, async () => {
  const d = tmp(), f = join(d, 'nt.html');
  writeFileSync(f, page(`<section class="scene" data-duration="2"><b id="a" style="position:absolute;left:10px;top:10px">a</b></section><script>gm.timeline('.scene').to(['#a', '#gone'], { x: 50, duration: 1 }, 0);</script>`, 'data-width="320" data-height="180" data-fps="10" data-duration="2"'));
  const w = (await check(f, { fast: true })).issues.filter((i) => i.code === 'timeline-no-target');
  assert.equal(w.length, 1);
  assert.match(w[0].message, /"#gone" matched nothing/);
  assert.doesNotMatch(w[0].message, /"#a"/);
});

test('word times: data-words names the voice-over transcript; @word in data-cuts, data-start and gm.word; a word that is not said is an error with near matches', { skip }, async () => {
  const d = tmp(), f = join(d, 'w.html');
  writeFileSync(join(d, 'voice.json'), JSON.stringify([['Meet', 0.2], ['Tidewell.', 0.6], ['Spring', 1.9], ['pricing', 2.3], ['has', 2.9], ['three', 3.4], ['plans.', 3.7], ['Pricing', 5.1]].map(([word, start]) => ({ word, start, end: start + 0.35 }))));
  writeFileSync(f, page(`<main data-sequence data-cuts="0 @spring_pricing @three_plans"><section class="scene" id="a">A</section><section class="scene" id="b">B</section><section class="scene" id="c" data-duration="2">C</section></main>
    <b id="tag" data-start="@pricing#2" style="position:absolute">!</b><script>window.__w = [gm.word('pricing'), gm.word('tidewell.end'), gm.word('plans+0.5')];</script>`, 'data-width="320" data-height="180" data-fps="30" data-words="voice.json"'));
  const info = await inspect(f);
  const clip = (sel) => info.clips.find((c) => c.selector === sel);
  assert.deepEqual([clip('#a').start, clip('#b').start, clip('#c').start, clip('#tag').start], [0, 1.9, 3.4, 5.1]);
  assert.deepEqual(await evalAt(f, 0, 'window.__w.map((x) => Math.round(x * 100) / 100)'), [2.3, 0.95, 4.2]);
  writeFileSync(f, readFileSync(f, 'utf8').replace('@three_plans', '@tree_plans'));
  const bad = (await check(f, { fast: true })).issues.find((i) => i.code === 'word-not-found');
  assert.ok(bad && bad.severity === 'error', 'a word that is not in the transcript');
  assert.match(bad.fix, /three/);
});

test('word times inside a scene are video times: data-start="@word" and data-enter="rise 0.4 @word" on elements of a later scene', { skip }, async () => {
  const d = tmp(), f = join(d, 'ws.html');
  writeFileSync(join(d, 'voice.json'), JSON.stringify([['One', 0.2], ['two', 1.0], ['waters', 3.1], ['thirsty', 3.6]].map(([word, start]) => ({ word, start, end: start + 0.3 }))));
  writeFileSync(f, page(`<main data-sequence data-cuts="0 @two"><section class="scene" id="a">A</section><section class="scene" id="b" data-duration="4">
    <h1 id="h" data-start="@waters" style="position:absolute">W</h1><p id="p" data-enter="rise 0.4 @thirsty" style="position:absolute;top:80px">T</p></section></main>`, 'data-width="320" data-height="180" data-fps="30" data-words="voice.json"'));
  const info = await inspect(f);
  assert.equal(info.clips.find((c) => c.selector === '#h').start, 3.1, 'the word, not the scene start (1.0) plus the word');
  const op = (t) => evalAt(f, t, `+getComputedStyle(document.querySelector('#p')).opacity`);
  assert.equal(await op(3.5), 0, 'hidden until the word');
  assert.equal(await op(4.2), 1, 'in after the word');
});

test('givemotion words: every token it prints names the very time it prints next to it (repeats, accents, apostrophes, numbers)', { skip }, async () => {
  const d = tmp(), f = join(d, 'w.html');
  const said = 'So the engine works. The engine renders it, and THE Engine… Café don’t 3.5 2026 the'.split(' ');
  writeFileSync(join(d, 'voice.json'), JSON.stringify(said.map((word, i) => ({ word, start: 0.2 + i * 0.4, end: 0.5 + i * 0.4 }))));
  writeFileSync(f, page('', 'data-width="320" data-height="180" data-fps="30" data-duration="8" data-words="voice.json"'));
  const toks = JSON.parse(execFileSync(process.execPath, [join(ROOT, 'src', 'cli.js'), 'words', f, '--json'], { encoding: 'utf8' }));
  assert.equal(toks.length, said.length);
  assert.deepEqual(toks.filter((w) => /^@the/.test(w.token)).map((w) => w.token), ['@the', '@the#2', '@the#3', '@the#4']);
  const got = await evalAt(f, 0, `${JSON.stringify(toks.map((w) => w.token))}.map((k) => Math.round(gm.word(k) * 100) / 100)`);
  assert.deepEqual(got, toks.map((w) => Math.round(w.start * 100) / 100));
  const near = execFileSync(process.execPath, [join(ROOT, 'src', 'cli.js'), 'words', f, '--near', '1.9', '--span', '0.3'], { encoding: 'utf8' });
  assert.match(near, /1\.80\s+The\s+@the#2/);
  assert.doesNotMatch(near, /@so\b/);
});

test('sketch marks take word times: data-sketch-mark-at="@two", and the default waits for an entrance timed to a word', { skip }, async () => {
  const d = tmp(), f = join(d, 'wm.html');
  writeFileSync(join(d, 'voice.json'), JSON.stringify([['one', 0.5], ['two', 3.0], ['three', 5.0]].map(([word, start]) => ({ word, start, end: start + 0.3 }))));
  writeFileSync(f, page(`<section class="scene" data-start="1" data-duration="5">
    <p style="position:absolute;left:20px;top:20px;font-size:30px;margin:0"><span id="a" data-enter="fade 0.4 @two" data-sketch-mark="underline">enter on two</span></p>
    <p style="position:absolute;left:20px;top:100px;font-size:30px;margin:0"><span id="b" data-sketch-mark="underline" data-sketch-mark-at="@two">mark at two</span></p>
    <p style="position:absolute;left:20px;top:180px;font-size:30px;margin:0"><span id="c" data-sketch-mark="underline" data-sketch-mark-at="30f" data-sketch-mark-duration="500ms">a second in</span></p></section>`, 'data-width="640" data-height="360" data-fps="30" data-words="voice.json"'));
  // how much of each mark is drawn: hidden, part of it (a dash), or all of it
  const drawn = (t) => evalAt(f, t, `['#a', '#b', '#c'].map((s) => { const sv = document.querySelector(s + ' .gm-sketch-mark'), p = sv && sv.querySelector('path'); if (!p || sv.style.visibility === 'hidden') return 0; const da = p.style.strokeDasharray; return da && da !== 'none' ? Math.round(parseFloat(da) * 100) / 100 : 1; })`);
  assert.deepEqual(await drawn(1.5), [0, 0, 0], 'nothing drawn before the word');
  const at32 = await drawn(3.2);
  assert.equal(at32[0], 0, 'A waits for its entrance (on "two", 0.4 s) to finish');
  assert.ok(at32[1] > 0 && at32[1] < 1, 'B is being drawn from "two" (3.0 s): ' + at32[1]);
  assert.equal(at32[2], 1, 'C: 30 frames into its clip (2.0 s), over 500 ms');
  const at36 = await drawn(3.6);
  assert.ok(at36[0] > 0 && at36[0] < 1, 'A is drawn right after the entrance (3.4 s): ' + at36[0]);
  assert.deepEqual(await drawn(4.2), [1, 1, 1]);
});

test('a scene file whose script calls gm.timing still becomes the sequence child (transitions work, no stale errors)', { skip }, async () => {
  const d = tmp(), f = join(d, 'ec.html');
  mkdirSync(join(d, 'scenes'));
  writeFileSync(join(d, 'scenes', 'a.html'), '<section class="scene" data-duration="2" style="background:#c33"><h1 id="first">Hi</h1></section><script>window.__t = gm.timing("#first")</script>');
  writeFileSync(join(d, 'scenes', 'b.html'), '<section class="scene" data-duration="2" style="background:#33c;color:#fff"><h1>Two</h1></section>');
  writeFileSync(f, page(`<main data-sequence data-transition="push-left 0.5"><gm-include src="scenes/a.html" scope></gm-include><gm-include src="scenes/b.html"></gm-include></main>`, 'data-width="320" data-height="180" data-fps="30"'));
  const rep = await check(f, { fast: true });
  assert.deepEqual(rep.issues.filter((i) => i.severity === 'error' || i.code === 'contents-no-box').map((i) => i.code), []);
  assert.equal(rep.info.duration, 3.5);
  assert.equal(await evalAt(f, 1, `document.querySelectorAll('main > section.scene').length`), 2);
});

test('path travel stops can name waypoints: [1, "#dock"] is where the route passes closest to #dock', { skip }, async () => {
  const d = tmp(), f = join(d, 'tv.html');
  writeFileSync(f, page(`<section class="scene" data-duration="3"><div id="w" style="position:absolute;left:0;top:0;width:640px;height:360px">
    <svg width="640" height="360" style="position:absolute;left:0;top:0"><path id="route" d="M40 200 L600 200" stroke="#888" fill="none"/></svg>
    <div id="d1" style="position:absolute;left:170px;top:150px;width:20px;height:20px;background:#3a3"></div><div id="d2" style="position:absolute;left:450px;top:230px;width:20px;height:20px;background:#3a3"></div>
    <div id="pkg" style="position:absolute;left:0;top:0;width:24px;height:24px;background:#f80"></div></div>
    <script>gm.path.travel('#pkg', '#route', { stops: [[0, 0], [1, '#d1'], [1.5, '#d1'], [2.5, '#d2']] });</script></section>`, 'data-width="640" data-height="360" data-fps="30"'));
  const cx = (t) => evalAt(f, t, `(() => { const r = document.querySelector('#pkg').getBoundingClientRect(); return Math.round(r.left + r.width / 2); })()`);
  assert.ok(Math.abs((await cx(1.2)) - 180) <= 2, 'holds at the first dock');
  assert.ok(Math.abs((await cx(2.6)) - 460) <= 2, 'ends at the second dock');
});

test('blocks restyle from the page CSS (cascade layer); captions read the page transcript; cursor times take words', { skip }, async () => {
  const d = tmp(), f = join(d, 'cap.html');
  mkdirSync(join(d, 'blocks'));
  for (const b of ['captions.html', 'cursor.html']) copyFileSync(join(ROOT, 'blocks', b), join(d, 'blocks', b));
  writeFileSync(join(d, 'voice.json'), JSON.stringify([['Book', 0.3], ['a', 0.6], ['room', 0.8], ['now.', 1.1], ['Send', 2.0], ['it.', 2.3]].map(([word, start]) => ({ word, start, end: start + 0.25 }))));
  writeFileSync(f, page(`<style>.gmb-cap__line{color:rgb(10, 20, 30)}</style><section class="scene" data-duration="3" style="background:#fff">
    <button id="send" style="position:absolute;left:400px;top:200px">Send</button>
    <gm-include src="blocks/captions.html" shadow="none"></gm-include>
    <gm-include src="blocks/cursor.html" points="100,100 #send!" times="@book @send"></gm-include></section>`, 'data-width="640" data-height="360" data-fps="30" data-words="voice.json"'));
  const r = await evalAt(f, 2.1, `(() => { const l = document.querySelector('.gmb-cap__line'); const cs = getComputedStyle(l); return { text: l.textContent.replace(/\\s+/g, ' ').trim(), color: cs.color, shadow: cs.textShadow }; })()`);
  assert.equal(r.color, 'rgb(10, 20, 30)', 'the page CSS beats the block style, though it comes first');
  assert.equal(r.shadow, 'none');
  assert.match(r.text, /Send/, 'captions from <html data-words> with no file');
  const rep = await check(f, { fast: true });
  assert.ok(!rep.issues.some((i) => i.code === 'cursor-times'), 'cursor times="@book @send" is fine');
});

test('morph into a scene that paints the whole frame: the new scene fades in over the old one, whose pieces do not show through each other', { skip }, async () => {
  const d = tmp(), f = join(d, 'mx.html');
  writeFileSync(f, page(`<main data-sequence data-transition="morph 1"><section class="scene" data-duration="2" style="position:absolute;inset:0;background:#fff">
      <div id="app" style="position:absolute;left:0;top:0;width:640px;height:360px"><b id="under" style="position:absolute;left:100px;top:100px;font-size:40px;color:#000">UNDER</b></div>
      <div id="toast" style="position:absolute;left:60px;top:80px;width:400px;height:120px;background:#fff;z-index:2"><i data-morph="logo" style="position:absolute;right:10px;top:10px;width:30px;height:30px;background:#2a6"></i></div>
      <div id="t1" style="position:absolute;left:60px;top:80px;width:300px;height:120px;background:#fff;z-index:3"></div></section>
    <section class="scene" data-duration="2" style="position:absolute;inset:0;background:#fff"><i data-morph="logo" style="position:absolute;left:300px;top:160px;width:60px;height:60px;background:#2a6"></i></section></main>`, 'data-width="640" data-height="360" data-fps="30"'));
  // halfway through the transition, over the opaque card, nothing of the text under it may show
  const v = await evalAt(f, 1.6, `[getComputedStyle(document.querySelector('#app')).filter, getComputedStyle(document.querySelector('#t1')).filter]`);
  assert.deepEqual(v, ['none', 'none'], 'the old scene pieces are not faded one by one');
});

test('check: camera-zoom-high when a fit zooms past 4x onto a small target, not when maxZoom says it is meant', { skip }, async () => {
  const d = tmp();
  const mk = (extra) => { const f = join(d, `z${extra.length}.html`); writeFileSync(f, page(`<section class="scene" data-duration="3" style="position:absolute;inset:0;overflow:hidden"><div id="world" style="position:absolute;left:0;top:0;width:1200px;height:700px">
    <div id="tag" style="position:absolute;left:500px;top:300px;width:60px;height:24px;background:#36c"></div></div>
    <script>gm.camera('#world').shot(0, { center: { x: 600, y: 350 }, zoom: 0.5 }).shot(1, { fit: '#tag', padding: 10, duration: 0.8${extra} });</script></section>`, 'data-width="640" data-height="360" data-fps="30"')); return f; };
  assert.ok((await check(mk(''), { fast: true })).issues.some((i) => i.code === 'camera-zoom-high'));
  assert.ok(!(await check(mk(', maxZoom: 6'), { fast: true })).issues.some((i) => i.code === 'camera-zoom-high'));
});

test('camera fit frames where the target rests longest, not where its exit leaves it at the end of the hold', { skip }, async () => {
  const d = tmp(), f = join(d, 'fx.html');
  writeFileSync(f, page(`<section class="scene" data-duration="6" style="position:absolute;inset:0;overflow:hidden"><div id="world" style="position:absolute;left:0;top:0;width:2000px;height:1200px">
    <div id="ph" style="position:absolute;left:800px;top:300px;width:300px;height:500px;background:#36c"></div></div>
    <script>gm.timeline().to('#ph', { y: 1400, duration: 0.2, ease: 'in-cubic' }, 4.3);
    gm.camera('#world').shot(0, { center: { x: 1000, y: 600 }, zoom: 0.6 }).shot(1, { fit: '#ph', padding: 80, duration: 0.8 });</script></section>`, 'data-width="1280" data-height="720" data-fps="30" data-duration="6"'));
  const box = await evalAt(f, 3, `(() => { const b = document.querySelector('#ph').getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; })()`);
  assert.deepEqual(box, [80, 640], 'framed with its padding while it rests');
});

test('transcript: a bare word said more than once warns word-repeated with the later times; #1 keeps the first quietly', { skip }, async () => {
  const d = tmp(), f = join(d, 'wr.html');
  writeFileSync(join(d, 'voice.json'), JSON.stringify([['Tap', 0.3], ['for', 0.8], ['more', 1.0], ['follow', 3.0], ['for', 3.4], ['tips', 3.6]].map(([word, start]) => ({ word, start, end: start + 0.2 }))));
  const mk = (w) => { writeFileSync(f, page(`<b data-start="${w}" style="position:absolute">x</b>`, 'data-width="320" data-height="180" data-fps="30" data-duration="4" data-words="voice.json"')); return f; };
  const w1 = (await check(mk('@for'), { fast: true })).issues.find((i) => i.code === 'word-repeated');
  assert.ok(w1 && /@for#2 \(3\.4 s\)/.test(w1.fix), w1 && w1.fix);
  assert.ok(!(await check(mk('@for#1'), { fast: true })).issues.some((i) => i.code === 'word-repeated'));
});

test('captions fit="true" keeps every line on one line, smaller when too wide; phone enter="none" has no entrance', { skip }, async () => {
  const d = tmp(), f = join(d, 'cf.html');
  mkdirSync(join(d, 'blocks'));
  for (const b of ['captions.html', 'phone.html']) copyFileSync(join(ROOT, 'blocks', b), join(d, 'blocks', b));
  writeFileSync(join(d, 'voice.json'), JSON.stringify([['Subscriptions', 0.2], ['everywhere', 0.9], ['nobody', 1.5], ['remembers.', 2.0]].map(([word, start]) => ({ word, start, end: start + 0.4 }))));
  const mk = (fit) => { writeFileSync(f, page(`<section class="scene" data-duration="3"><gm-include src="blocks/captions.html" size="150" words="4" ${fit}></gm-include><gm-include src="blocks/phone.html" enter="none"></gm-include></section>`, 'data-width="1080" data-height="1920" data-fps="30" data-words="voice.json"')); return f; };
  const lines = (fit) => evalAt(mk(fit), 2.3, `(() => { const l = document.querySelector('.gmb-cap__line'); return Math.round(l.getBoundingClientRect().height / parseFloat(getComputedStyle(l).lineHeight)); })()`);
  assert.ok((await lines('')) >= 2, 'wraps without fit');
  assert.equal(await lines('fit="true"'), 1);
  assert.equal(await evalAt(mk(''), 0.1, `+getComputedStyle(document.querySelector('.gmb-phone')).opacity`), 1, 'no entrance');
});

test('data-exit="collapse": a list row slides away, then its height closes and the rows below move up', { skip }, async () => {
  const d = tmp(), f = join(d, 'col.html');
  writeFileSync(f, page(`<section class="scene" data-duration="3"><ul style="position:absolute;left:40px;top:20px;margin:0;padding:0;list-style:none;font-size:24px">
    <li style="height:40px;margin:6px 0">One</li><li id="gone" data-start="0" data-duration="2" data-exit="collapse" style="height:40px;margin:6px 0">Two</li><li id="three" style="height:40px;margin:6px 0">Three</li></ul></section>`, 'data-width="320" data-height="240" data-fps="30" data-duration="3"'));
  const top = (t) => evalAt(f, t, `Math.round(document.querySelector('#three').getBoundingClientRect().top)`);
  const before = await top(1.0), during = await top(1.95);
  assert.ok(before - during >= 25, `Three moves up while the row closes, before the clip ends: ${before} -> ${during}`);
});

test('gm.chart.line series: one scale for every line, x labels once, names at the ends kept apart; numeric labels are labels, not indices', { skip }, async () => {
  const d = tmp(), f = join(d, 'ms.html');
  writeFileSync(f, page(`<section class="scene" data-duration="5"><div id="c" style="position:absolute;left:40px;top:40px;width:1100px;height:560px"><b id="y20" data-point="2020 top 20">here</b></div>
    <script>window.ch = gm.chart.line('#c', { labels: [2015, 2016, 2017, 2018, 2019, 2020], duration: 3, stops: [[0, 0], [3, '2020']],
      series: [{ name: 'Solar', values: [300, 220, 160, 110, 70, 50], color: '#e8a10c' }, { name: 'Wind', values: [140, 120, 100, 85, 70, 60], color: '#2b7bb9' }, { name: 'Coal', values: [110, 110, 112, 110, 111, 112] }] });</script></section>`, 'data-width="1280" data-height="720" data-fps="30" data-duration="5"'));
  const r = await evalAt(f, 4, `(() => {
    const ns = [...document.querySelectorAll('.gm-chart-name')].map((e) => e.getBoundingClientRect());
    const overlap = ns.some((a, i) => ns.some((b, j) => j > i && a.top < b.bottom && b.top < a.bottom && a.left < b.right && b.left < a.right));
    return { series: ch.series.length, labels: document.querySelectorAll('.gm-chart-label').length, names: ns.length, overlap, reach: ch.timeOf('2020'), at: ch.pointAt('2016').label };
  })()`);
  assert.deepEqual([r.series, r.labels, r.names, r.overlap], [3, 6, 3, false]);
  assert.ok(Math.abs(r.reach - 3) < 0.01, 'stop "2020" is the label 2020 (the last point), not index 2020: ' + r.reach);
  assert.equal(r.at, '2016');
});

test('bar-chart direction="horizontal": rows grow right, the value rides the end of its bar, colors per bar', { skip }, async () => {
  const d = tmp(), f = join(d, 'hb.html');
  mkdirSync(join(d, 'blocks'));
  copyFileSync(join(ROOT, 'blocks', 'bar-chart.html'), join(d, 'blocks', 'bar-chart.html'));
  writeFileSync(f, page(`<section class="scene" data-duration="3"><gm-include src="blocks/bar-chart.html" direction="horizontal" values="45,50,117" labels="Solar,Wind,Coal" colors="#e8a10c,#2b7bb9,#555"></gm-include></section>`, 'data-width="1280" data-height="720" data-fps="30" data-duration="3"'));
  const at = (t) => evalAt(f, t, `[...document.querySelectorAll('.gmb-bars__row')].map((r) => { const b = r.querySelector('.gmb-bars__bar').getBoundingClientRect(), v = r.querySelector('.gmb-bars__val').getBoundingClientRect(); return [Math.round(b.right), Math.round(v.left - b.right), getComputedStyle(r.querySelector('.gmb-bars__bar')).backgroundImage.includes('232, 161, 12')]; })`);
  const mid = await at(0.7), end = await at(2.8);
  assert.ok(end[2][0] > mid[2][0] + 20, 'the bar grows');
  assert.ok(end.every((r) => r[1] >= 0 && r[1] < 30) && mid.every((r) => r[1] >= 0 && r[1] < 30), 'the value sits just past the bar end while it grows');
  assert.equal(end[0][2], true, 'first bar takes its own color');
});

test('highlight block: wash, ring, underline and glow sit on the target and follow it', { skip }, async () => {
  const d = tmp(), f = join(d, 'hl.html');
  mkdirSync(join(d, 'blocks'));
  copyFileSync(join(ROOT, 'blocks', 'highlight.html'), join(d, 'blocks', 'highlight.html'));
  writeFileSync(f, page(`<section class="scene" data-duration="2"><b id="t" style="position:absolute;left:60px;top:100px;font-size:40px">Price</b>
    ${['wash', 'ring', 'underline', 'glow'].map((l) => `<gm-include src="blocks/highlight.html" target="#t" look="${l}" pad="4"></gm-include>`).join('')}
    <script>gm.timeline().to('#t', { x: 300, duration: 1.5, ease: 'linear' }, 0);</script></section>`, 'data-width="640" data-height="360" data-fps="30" data-duration="2"'));
  const ctx = await openComposition(f, { mode: 'render' });
  try {
    await ctx.page.seek(1);
    const r = await ctx.page.evaluate(`(() => { const t = document.querySelector('#t').getBoundingClientRect(); return [...document.querySelectorAll('.gmb-hl')].map((e) => { const b = e.getBoundingClientRect(), c = getComputedStyle(e); return { look: e.className.replace(/.*--/, ''), dl: Math.round(t.left - b.left - 4 * gm.px), dw: Math.round(b.width - t.width - 8 * gm.px), bg: c.backgroundImage !== 'none' || c.backgroundColor !== 'rgba(0, 0, 0, 0)', shadow: c.boxShadow !== 'none' }; }); })()`);
    assert.deepEqual(r.map((x) => [x.look, x.dl, x.dw]), [['wash', 0, 0], ['ring', 0, 0], ['underline', 0, 0], ['glow', 0, 0]]);
    assert.ok(r[0].bg && r[1].shadow && r[2].bg && r[3].shadow, 'each look draws something');
  } finally { await ctx.page.close(); await ctx.server.close(); }
});

test('check: pacing per element: short-hold and cut-exit; transitions, the last scene, exits, counters, quick-ok and swaps in place pass', { skip }, async () => {
  const d = tmp(), f = join(d, 'p.html');
  writeFileSync(f, page(`<style>h1,h2,p{margin:0;position:absolute}.card{position:absolute;background:#2a3a6a;padding:10px;border-radius:8px}</style>
    <main data-sequence data-transition="push-left 0.5"><section class="scene" id="s1" data-duration="4">
      <h1 id="short" style="left:20px;top:20px;font-size:36px">Five words are here now</h1>
      <h1 id="good" style="left:20px;top:90px;font-size:36px">This one stays</h1>
      <div class="card" id="popcard" data-start="0.5" data-duration="1.8" style="left:20px;top:170px"><b style="font-size:28px">Cut card</b></div>
      <div class="card" id="exitcard" data-start="0.5" data-duration="1.8" data-exit="fade 0.3" style="left:220px;top:170px"><b style="font-size:28px">Exit card</b></div>
      <b id="send" data-start="0.5" data-duration="1.5" style="position:absolute;left:440px;top:170px;font-size:28px">Send</b><b id="sent" data-start="2" style="position:absolute;left:440px;top:170px;font-size:28px">Sent</b>
      <p id="count" style="left:20px;top:260px;font-size:30px" data-count="0 100 0.8">0</p>
      <p id="quick" data-check="quick-ok" style="left:320px;top:260px;font-size:30px">Flash word</p>
      <p id="setoff" style="left:20px;top:310px;font-size:30px">Set off</p>
    </section><section class="scene" data-duration="3" style="background:#222"><h2 id="end" style="left:20px;top:20px;font-size:40px">Last scene text</h2></section></main>
    <script>gm.timeline('#s1').from('#short', { opacity: 0, y: 20, duration: 0.5 }, 0.3).to('#short', { opacity: 0, y: -20, duration: 0.3 }, 1.2)
      .from('#good', { opacity: 0, y: 20, duration: 0.5 }, 0.3).from('#quick', { opacity: 0, duration: 0.2 }, 1).to('#quick', { opacity: 0, duration: 0.2 }, 1.4)
      .set('#setoff', { opacity: 0 }, 2.6);</script>`));
  const rep = await check(f);
  const of = (code) => rep.issues.filter((i) => i.code === code).map((i) => i.selector);
  assert.deepEqual(of('short-hold'), ['#short']);
  assert.match(rep.issues.find((i) => i.code === 'short-hold').message, /5-word text needs/);
  assert.deepEqual(of('cut-exit').sort(), ['#popcard', '#setoff']);
  assert.ok(Math.abs(rep.issues.find((i) => i.selector === '#popcard' && i.code === 'cut-exit').time - 2.27) < 0.15);
});

test('check: a hand-made push-in that crops text is a warning (stuck text stays an error); ellipsis rows; display: contents tweens; steps() on big things; sliver start states', { skip }, async () => {
  const d = tmp(), f = join(d, 'c.html');
  writeFileSync(join(d, 'part.html'), '<p id="partp" style="position:absolute;margin:0;left:20px;top:200px;font-size:24px">From the include</p>');
  writeFileSync(f, page(`<style>h1{margin:0;position:absolute;white-space:nowrap;font-size:40px}.row{position:absolute;width:220px;white-space:nowrap;overflow:hidden;font-size:24px}</style>
    <section class="scene" data-duration="4">
      <div id="stage" style="position:absolute;inset:0"><h1 id="wide" style="left:30px;top:40px">A wide title that the push crops</h1><h1 id="stuck" style="left:540px;top:120px">Stuck out</h1></div>
      <div class="row" id="ell" style="left:400px;top:250px;text-overflow:ellipsis">A long mail subject line cut with an ellipsis</div>
      <div class="row" id="cut" style="left:400px;top:300px">A long line that is cut without an ellipsis</div>
      <gm-include src="part.html"></gm-include>
      <div id="win" style="position:absolute;left:300px;top:150px;width:300px;height:140px;background:#345"></div>
      <div id="caret" style="position:absolute;left:20px;top:150px;width:4px;height:30px;background:#fff"></div>
      <div id="grain" style="position:absolute;inset:-50%;opacity:.07;mix-blend-mode:overlay;background:#888;animation:gr .5s steps(5) infinite"></div>
      <div id="slv" style="position:absolute;left:20px;top:240px;width:250px;height:50px;background:#c84"></div>
      <div id="hid" style="position:absolute;left:20px;top:300px;width:250px;height:50px;background:#4c8"></div>
    </section><style>@keyframes gr{to{transform:translate(10%,5%)}}</style>
    <script>gm.timeline('.scene').to('#stage', { scale: 1.5, duration: 0.6, ease: 'power2.inOut' }, 0.5)
      .to('[data-gm-include]', { opacity: 0, duration: 0.5 }, 3)
      .fromTo('#win', { x: -200 }, { x: 0, duration: 1.5, ease: 'steps(5)' }, 0.5).fromTo('#caret', { x: 0 }, { x: 60, duration: 1, ease: 'steps(6)' }, 0.5)
      .fromTo('#slv', { clipPath: 'inset(45% 0% 45% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.6 }, 1.0)
      .fromTo('#hid', { clipPath: 'inset(50% 0% 50% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.6 }, 1.0);</script>`));
  const rep = await check(f);
  const of = (code, sev) => rep.issues.filter((i) => i.code === code && (!sev || i.severity === sev)).map((i) => i.selector).sort();
  assert.deepEqual(of('text-offscreen', 'error'), ['#stuck']);
  assert.deepEqual(of('text-offscreen', 'warning'), ['#wide']);
  assert.ok(rep.issues.find((i) => i.selector === '#wide' && i.code === 'text-offscreen').time >= 1.0, 'not while the push moves');
  assert.deepEqual(of('text-clipped'), ['#cut']);
  assert.equal(of('contents-no-box').length, 1);
  assert.match(rep.issues.find((i) => i.code === 'contents-no-box').message, /gm-include/);
  assert.deepEqual(of('stepped-move', 'info'), ['#win']);
  assert.deepEqual(of('sliver-start'), ['#slv']);
});

test('data-count-roll: an odometer whose digits stay on their own wheels, read the right number and never show a neighbour', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<p id="n" style="font:700 60px/0.9 monospace" data-count="0 12480" data-count-roll data-count-duration="2"></p>`, 'data-width="640" data-height="360" data-fps="30" data-duration="3"'));
  const ctx = await openComposition(f, { mode: 'render' });
  const read = `(() => { const n = document.querySelector('#n'); const cells = [...n.querySelectorAll('.gm-roll')];
    const box = (e) => e.getBoundingClientRect();
    return { text: cells.map((c) => c.firstChild.textContent).join(''), seps: [...n.querySelectorAll('.gm-num > span:not(.gm-roll)')].map((s) => s.style.visibility),
      // the line clip: the digit not showing sits fully outside the cell's box
      clean: cells.every((c) => { const cb = box(c), a = box(c.children[0]), b = box(c.children[1]);
        const vis = (r) => Math.max(0, Math.min(r.bottom, cb.bottom) - Math.max(r.top, cb.top));
        return vis(a) + vis(b) <= cb.height + 1; }) }; })()`;
  try {
    await ctx.page.seek(2.5);
    const end = await ctx.page.evaluate(read);
    assert.equal(end.text, '12480');
    assert.deepEqual(end.seps, ['']);
    await ctx.page.seek(0);
    const start = await ctx.page.evaluate(read);
    assert.equal(start.text, '0', 'leading wheels are blank at 0');
    assert.deepEqual(start.seps, ['hidden']);
    for (const t of [0.2, 0.5, 1, 1.5, 1.9]) { await ctx.page.seek(t); assert.ok((await ctx.page.evaluate(read)).clean, 'no neighbour bleeds in at ' + t); }
  } finally { await ctx.page.close(); await ctx.server.close(); }
});

test('check: a timed shot list with no data-expect anywhere is a warning (no-expect); one promise is enough to clear it', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  const body = (attr) => `<!-- shot list
    0.0-1.0  title rises
    1.0-2.0  card slides in
    2.0-3.0  end hold -->
    <h1 style="position:absolute;left:40px;top:40px;margin:0;font-size:40px" ${attr}>Title</h1>`;
  writeFileSync(f, page(body(''), 'data-width="640" data-height="360" data-fps="30" data-duration="3"'));
  assert.ok((await check(f)).issues.some((i) => i.code === 'no-expect'), 'warned');
  writeFileSync(f, page(body('data-expect="in-by 0.5"'), 'data-width="640" data-height="360" data-fps="30" data-duration="3"'));
  assert.ok(!(await check(f)).issues.some((i) => i.code === 'no-expect'), 'cleared by a promise');
});

test('check: a small dot parked inside big text is a stray-mark; a dot beside it, or one marked overlap-ok, is not', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  const mk = (left, extra = '') => page(`<h1 id="big" style="position:absolute;left:40px;top:40px;margin:0;font:700 120px/1 sans-serif">42195</h1>
    <div id="dot" ${extra} style="position:absolute;left:${left}px;top:150px;width:14px;height:14px;border-radius:50%;background:#f60"></div>`, 'data-width="640" data-height="360" data-fps="30" data-duration="2"');
  const codes = async (html) => { writeFileSync(f, html); return (await check(f)).issues.filter((i) => i.code === 'stray-mark').map((i) => i.selector); };
  assert.deepEqual(await codes(mk(150)), ['#dot'], 'under the digits');
  assert.deepEqual(await codes(mk(560)), [], 'beside the number');
  assert.deepEqual(await codes(mk(150, 'data-check="overlap-ok"')), [], 'meant');
});

test('review: overview, holds and motion strips from the page, plus REVIEW.md with the check report and the rubric', { skip }, async () => {
  const { review } = await import('../src/review.js');
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<h1 id="t" style="position:absolute;left:40px;top:40px;margin:0;font-size:48px">Hello there</h1>
    <div id="b" style="position:absolute;left:40px;top:200px;width:80px;height:80px;background:#3a6"></div>
    <script>gm.timeline().from('#t', { opacity: 0, y: 30, duration: 0.6, ease: 'expo.out' }, 0.2).to('#b', { x: 400, duration: 0.8, ease: 'power2.inOut' }, 2)</script>`, 'data-width="640" data-height="360" data-fps="30" data-duration="4"'));
  const r = await review(f, { output: join(d, 'rv') });
  for (const p of [r.overview, r.holds, r.review, ...r.motion]) assert.ok(readFileSync(p).length > 100, p);
  assert.ok(r.motion.length >= 1);
  const md = readFileSync(r.review, 'utf8');
  assert.match(md, /## check/);
  assert.match(md, /\| Errors: /);
  assert.ok(!readdirSync(join(d, 'rv')).some((x) => x.startsWith('.tmp')), 'no temp folders left');
});

test('data-roll: a readout that changes value at given times; only the changed part rolls, each slot clipped to one line', { skip }, async () => {
  const d = tmp(), f = join(d, 'a.html');
  writeFileSync(f, page(`<p id="r" style="font:700 60px/1 monospace" data-roll="0: 1 IN 10; 1: 1 IN 100; 2: 0200 M"></p>`, 'data-width="640" data-height="360" data-fps="30" data-duration="3"'));
  const ctx = await openComposition(f, { mode: 'render' });
  const read = `(() => { const cells = [...document.querySelectorAll('#r .gm-roll')]; const box = (e) => e.getBoundingClientRect();
    return { text: cells.map((c) => c.children[0].textContent).join(''), moving: cells.filter((c) => c.children[0].style.transform).length,
      clean: cells.every((c) => { const cb = box(c); const vis = (r) => Math.max(0, Math.min(r.bottom, cb.bottom) - Math.max(r.top, cb.top)); return vis(box(c.children[0])) + vis(box(c.children[1])) <= cb.height + 1; }) }; })()`;
  try {
    await ctx.page.seek(0.5); assert.equal((await ctx.page.evaluate(read)).text, '1 IN 10');
    await ctx.page.seek(1.1); const mid = await ctx.page.evaluate(read);
    assert.equal(mid.moving, 1, 'only the new digit rolls (the shared "1 IN 10" stays still)'); assert.ok(mid.clean);
    await ctx.page.seek(1.9); assert.equal((await ctx.page.evaluate(read)).text, '1 IN 100');
    await ctx.page.seek(2.9); assert.equal((await ctx.page.evaluate(read)).text, '0200 M');
  } finally { await ctx.page.close(); await ctx.server.close(); }
});
