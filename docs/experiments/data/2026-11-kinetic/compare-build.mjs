// Builds compare.html: the three KINETIC videos in one film (intro, 2x2 grid with labels and process stats,
// each video large with its scores, final scoreboard). Reads ../stats.json, ../judging/scores.json,
// ../render-times.json. Render: npx givemotion render compare.html -o out/compare.mp4
import fs from 'node:fs';

const R = '/home/user/tools4';
const D = process.env.CMP_DATA || R; // data folder (a test folder while laying out)
const stats = JSON.parse(fs.readFileSync(`${D}/stats.json`, 'utf8'));
const scores = JSON.parse(fs.readFileSync(`${D}/judging/scores.json`, 'utf8'));
const renders = JSON.parse(fs.readFileSync(`${D}/render-times.json`, 'utf8'));

const ENG = [
  { key: 'givemotion', name: 'givemotion', ver: '0.1.3', color: '#FF7A45' },
  { key: 'remotion', name: 'Remotion', ver: '4.0.541', color: '#5B9BFF' },
  { key: 'hyperframes', name: 'HyperFrames', ver: '0.9.15', color: '#3DDC97' },
];
const notes = JSON.parse(fs.readFileSync(`${D}/compare/notes.json`, 'utf8')); // one line per engine, written after judging

const fmtTok = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : Math.round(n / 1e3) + 'k');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const ranked = [...ENG].sort((a, b) => scores.mean[b.key].overall - scores.mean[a.key].overall);
const place = (k) => ranked.findIndex((e) => e.key === k) + 1;
const ord = (n) => ['1st', '2nd', '3rd'][n - 1];

const rows = [
  ['Tokens', (k) => fmtTok(stats[k].tokens.total)],
  ['Output tokens', (k) => fmtTok(stats[k].tokens.output)],
  ['Cost (API list)', (k) => '$' + stats[k].cost_usd.toFixed(2)],
  ['Time to finish', (k) => stats[k].minutes.toFixed(1) + ' min'],
  ['Tool calls', (k) => String(stats[k].tool_calls)],
  ['Code written', (k) => stats[k].loc + ' lines'],
  ['Render, 20 s 1080p', (k) => Math.round(renders[k]) + ' s'],
];
const best = (label) => {
  // lowest value wins for every process row
  const f = rows.find((r) => r[0] === label)[1];
  const vals = ENG.map((e) => parseFloat(f(e.key).replace(/[^0-9.]/g, '')) * (f(e.key).includes('M') ? 1000 : 1));
  return ENG[vals.indexOf(Math.min(...vals))].key;
};

const T_INTRO = 5, T_GRID = 21.6, T_SOLO = 21.6, T_END = 9;
const startGrid = T_INTRO, startSolo = startGrid + T_GRID, startEnd = startSolo + 3 * T_SOLO;
const TOTAL = +(startEnd + T_END).toFixed(2);

const chip = (e, cls = '') =>
  `<div class="chip ${cls}" style="--c:${e.color}"><i></i>${e.name}<span>${e.ver}</span></div>`;

const gridTiles = ENG.map(
  (e, i) => `
  <div class="tile t${i}">
    <video src="media/${e.key}.mp4" data-start="0.8" data-duration="20" muted></video>
    ${chip(e, 'on-video')}
  </div>`,
).join('');

const table = `
  <div class="tile t3 stats">
    <div class="stats-h">How each one got there</div>
    <table>
      <tr><th></th>${ENG.map((e) => `<th style="color:${e.color}">${e.name}</th>`).join('')}</tr>
      ${rows
        .map(
          ([label, f]) =>
            `<tr class="row"><td>${label}</td>${ENG.map(
              (e) => `<td class="${best(label) === e.key ? 'best' : ''}">${f(e.key)}</td>`,
            ).join('')}</tr>`,
        )
        .join('')}
    </table>
    <div class="foot">Opus 5.5 · effort high · same brief and prompt</div>
  </div>`;

const DIMS = ['brief', 'spec', 'motion', 'craft', 'errors'];
const solo = ENG.map((e, i) => {
  const m = scores.mean[e.key];
  return `
  <section class="scene solo" id="solo${i}" data-start="${(startSolo + i * T_SOLO).toFixed(2)}" data-duration="${T_SOLO}" style="--c:${e.color}">
    <div class="solo-v"><video src="media/${e.key}.mp4" data-start="0.8" data-duration="20" muted></video>${chip(e, 'on-video big')}</div>
    <div class="panel">
      <div class="p-label">Blind judges, mean of ${scores.judges}</div>
      <div class="p-score"><b class="num" data-to="${m.overall.toFixed(1)}">0.0</b><span>/10</span></div>
      <div class="p-place">${ord(place(e.key))} of 3</div>
      <div class="dims">
        ${DIMS.map(
          (d) =>
            `<div class="dim"><span>${d}</span><div class="track"><div class="fill" style="--w:${m[d] / 10}"></div></div><em>${m[d].toFixed(1)}</em></div>`,
        ).join('')}
      </div>
      <div class="facts">
        <div><span>Tokens</span><b>${fmtTok(stats[e.key].tokens.total)}</b></div>
        <div><span>Cost</span><b>$${stats[e.key].cost_usd.toFixed(2)}</b></div>
        <div><span>Time to finish</span><b>${stats[e.key].minutes.toFixed(1)} min</b></div>
        <div><span>Tool calls</span><b>${stats[e.key].tool_calls}</b></div>
        <div><span>Code</span><b>${stats[e.key].loc} lines</b></div>
        <div><span>Render</span><b>${Math.round(renders[e.key])} s</b></div>
      </div>
    </div>
    <div class="note">${esc(notes[e.key])}</div>
  </section>`;
}).join('');

const board = ranked
  .map((e, i) => {
    const m = scores.mean[e.key];
    return `<div class="b-row" style="--c:${e.color}">
      <div class="b-place">${ord(i + 1)}</div>
      <div class="b-name">${e.name}</div>
      <div class="b-bar"><div class="b-fill" style="--w:${m.overall / 10}"></div></div><b class="b-score num">0.0</b>
      <div class="b-facts"><span>${fmtTok(stats[e.key].tokens.total)} tokens</span><span>$${stats[e.key].cost_usd.toFixed(2)}</span><span>${stats[e.key].minutes.toFixed(1)} min</span><span>${Math.round(renders[e.key])} s render${renders.fixed && renders.fixed[e.key] ? ` (${Math.round(renders.fixed[e.key])} s with the Chrome fix)` : ''}</span><span>#1 for ${scores.firsts[e.key]} of ${scores.judges} judges</span></div>
    </div>`;
  })
  .join('');

const html = `<!doctype html>
<html data-width="1920" data-height="1080" data-fps="30" data-duration="${TOTAL}" data-background="#0E0F13">
<head>
<meta charset="utf-8">
<title>KINETIC: givemotion vs Remotion vs HyperFrames</title>
<style>
  :root { --bg:#0E0F13; --ink:#F3F1EC; --mute:#9A9AA6; --line:#262833; }
  body { background:var(--bg); color:var(--ink); font-family:Inter, sans-serif; margin:0; }
  .scene { overflow:hidden; }
  .chip { display:inline-flex; align-items:center; gap:12px; padding:10px 18px; border-radius:999px;
    background:rgba(14,15,19,.82); border:1.5px solid var(--c); font:600 28px 'Space Grotesk'; color:var(--ink); }
  .chip i { width:14px; height:14px; border-radius:50%; background:var(--c); }
  .chip span { font:500 24px Inter; color:var(--mute); letter-spacing:.04em; }
  .on-video { position:absolute; left:18px; top:18px; }
  .on-video.big { left:24px; top:24px; font-size:34px; }

  /* intro */
  #intro { display:grid; place-items:center; text-align:center; }
  #intro h1 { font:700 132px/1 'Space Grotesk'; letter-spacing:-.035em; margin:0; }
  #intro .sub { margin-top:30px; font:500 30px Inter; color:var(--mute); letter-spacing:.01em; }
  #intro .chips { margin-top:56px; display:flex; gap:24px; justify-content:center; }
  #intro .chips .chip { font-size:36px; padding:14px 26px; }

  /* grid */
  #grid .tile { position:absolute; width:900px; height:506px; border-radius:14px; overflow:hidden; background:#000; }
  #grid .t0 { left:48px; top:22px; } #grid .t1 { left:972px; top:22px; }
  #grid .t2 { left:48px; top:552px; } #grid .t3 { left:972px; top:552px; }
  #grid video, .solo video { width:100%; height:100%; display:block; }
  .stats { background:#15161C !important; border:1.5px solid var(--line); padding:26px 34px; box-sizing:border-box; }
  .stats-h { font:600 30px 'Space Grotesk'; margin-bottom:12px; }
  .stats table { width:100%; border-collapse:collapse; font-size:24px; }
  .stats th { font:600 24px 'Space Grotesk'; text-align:right; padding:4px 0 10px; }
  .stats td { text-align:right; padding:7px 0; border-top:1px solid var(--line); font-variant-numeric:tabular-nums; }
  .stats td:first-child { text-align:left; color:var(--mute); }
  .stats td.best { color:var(--ink); font-weight:700; }
  .stats td:not(.best):not(:first-child) { color:#C9C7C2; }
  .foot { position:absolute; bottom:18px; left:34px; font-size:24px; color:var(--mute); }

  /* solo */
  .solo-v { position:absolute; left:48px; top:48px; width:1344px; height:756px; border-radius:16px; overflow:hidden; background:#000;
    box-shadow:0 0 0 2px var(--c); }
  .panel { position:absolute; left:1432px; top:48px; width:440px; }
  .p-label { font:600 24px Inter; letter-spacing:.12em; text-transform:uppercase; color:var(--mute); }
  .p-score { margin-top:6px; font:700 150px/1 'Space Grotesk'; letter-spacing:-.04em; color:var(--c); }
  .p-score span { font-size:44px; color:var(--mute); margin-left:6px; letter-spacing:0; }
  .p-place { font:600 30px 'Space Grotesk'; margin-top:4px; }
  .dims { margin-top:26px; display:grid; gap:12px; }
  .dim { display:grid; grid-template-columns:104px 1fr 52px; align-items:center; gap:12px; font-size:24px; color:var(--mute); }
  .dim em { font-style:normal; color:var(--ink); text-align:right; font-variant-numeric:tabular-nums; }
  .track { height:10px; border-radius:5px; background:var(--line); overflow:hidden; }
  .fill { height:100%; width:calc(var(--w) * 100%); background:var(--c); border-radius:5px; transform-origin:left center; }
  .facts { margin-top:30px; display:grid; grid-template-columns:1fr 1fr; gap:18px 20px; }
  .facts span { display:block; font-size:24px; color:var(--mute); letter-spacing:.06em; text-transform:uppercase; }
  .facts b { font:600 32px 'Space Grotesk'; }
  .note { position:absolute; left:48px; top:836px; width:1344px; font:500 32px/1.35 Inter; color:#D8D6D0; }

  /* scoreboard */
  #end h2 { position:absolute; left:120px; top:90px; margin:0; font:700 96px 'Space Grotesk'; letter-spacing:-.03em; }
  #end .meta { position:absolute; left:124px; top:206px; font:500 26px Inter; color:var(--mute); }
  .board { position:absolute; left:120px; top:330px; width:1680px; display:grid; gap:64px; }
  .b-row { display:grid; grid-template-columns:110px 420px 1fr 150px; align-items:center; row-gap:14px; }
  .b-place { font:700 44px 'Space Grotesk'; color:var(--c); }
  .b-name { font:700 56px 'Space Grotesk'; letter-spacing:-.02em; }
  .b-bar { position:relative; height:64px; }
  .b-fill { position:absolute; inset:0 auto 0 0; width:calc(var(--w) * 100%); background:var(--c); border-radius:10px; transform-origin:left center; }
  .b-score { font:700 64px 'Space Grotesk'; text-align:right; font-variant-numeric:tabular-nums; }
  .b-facts { grid-column:2 / 5; display:flex; gap:44px; font-size:26px; color:var(--mute); }
</style>
</head>
<body>
  <section class="scene" id="intro" data-start="0" data-duration="${T_INTRO}">
    <div>
      <h1 data-split="words">One brief, three engines</h1>
      <div class="sub">“KINETIC”, a 20 s motion reel · same prompt · Claude Opus 5.5, effort high · a fresh session per engine</div>
      <div class="chips">${ENG.map((e) => chip(e)).join('')}</div>
    </div>
  </section>

  <section class="scene" id="grid" data-start="${startGrid}" data-duration="${T_GRID}">
    ${gridTiles}
    ${table}
  </section>

  ${solo}

  <section class="scene" id="end" data-start="${startEnd.toFixed(2)}" data-duration="${T_END}">
    <h2>Final scores</h2>
    <div class="meta">Mean overall score from ${scores.judges} blind Opus 5.5 judges (1-10) · process numbers from each maker's session · renders on 4 CPU cores, no GPU</div>
    <div class="board">${board}</div>
  </section>

  <script>
    // intro
    gm.timeline('#intro')
      .from('#intro h1 .gm-word', { y: 90, opacity: 0, filter: 'blur(10px)', duration: 0.8, ease: 'expo.out', stagger: 0.08 }, 0.2)
      .from('#intro .sub', { y: 24, opacity: 0, duration: 0.7, ease: 'power3.out' }, 0.8)
      .from('#intro .chip', { y: 40, scale: 0.8, opacity: 0, duration: 0.6, ease: 'back.out(1.7)', stagger: 0.12 }, 1.3)
      .to('#intro > div', { scale: 1.04, duration: 4.4, ease: 'sine.inOut' }, 0.4)
      .to('#intro > div', { y: -60, opacity: 0, filter: 'blur(8px)', duration: 0.5, ease: 'power2.in' }, ${T_INTRO - 0.5});

    // grid
    gm.timeline('#grid')
      .from('.tile', { y: 60, opacity: 0, duration: 0.7, ease: 'expo.out', stagger: 0.08 }, 0)
      .from('.on-video', { x: -30, opacity: 0, duration: 0.5, ease: 'power3.out', stagger: 0.08 }, 0.5)
      .from('.stats .row', { x: 30, opacity: 0, duration: 0.5, ease: 'power3.out', stagger: 0.07 }, 0.9)
      .to('.tile', { opacity: 0, y: -40, duration: 0.5, ease: 'power2.in', stagger: 0.05 }, ${T_GRID - 0.6});

    // solos
    ${ENG.map(
      (e, i) => `gm.timeline('#solo${i}')
      .from('.solo-v', { x: -80, opacity: 0, duration: 0.7, ease: 'expo.out' }, 0)
      .from('.panel > *', { x: 40, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.06 }, 0.3)
      .to('.num', { textContent: ${scores.mean[e.key].overall.toFixed(1)}, duration: 1.4, ease: 'power2.out' }, 0.5)
      .from('.fill', { scaleX: 0, duration: 0.9, ease: 'expo.out', stagger: 0.07 }, 0.8)
      .from('.facts > div', { y: 20, opacity: 0, duration: 0.5, ease: 'power3.out', stagger: 0.05 }, 1.2)
      .from('.note', { y: 20, opacity: 0, duration: 0.6, ease: 'power3.out' }, 2)
      .to('.solo-v, .panel, .note', { opacity: 0, x: -40, duration: 0.5, ease: 'power2.in' }, ${T_SOLO - 0.6});`,
    ).join('\n    ')}

    // scoreboard
    gm.timeline('#end')
      .from('h2', { y: 60, opacity: 0, duration: 0.7, ease: 'expo.out' }, 0.1)
      .from('.meta', { opacity: 0, duration: 0.6, ease: 'power2.out' }, 0.5)
      .from('.b-row', { y: 50, opacity: 0, duration: 0.7, ease: 'expo.out', stagger: 0.15 }, 0.7)
      .from('.b-fill', { scaleX: 0, duration: 1.4, ease: 'expo.out', stagger: 0.15 }, 1.0)
      ${ranked
        .map((e, i) => `.to('.b-row:nth-child(${i + 1}) .num', { textContent: ${scores.mean[e.key].overall.toFixed(1)}, duration: 1.4, ease: 'power2.out' }, ${(1.0 + i * 0.15).toFixed(2)})`)
        .join('\n      ')}
      .from('.b-facts', { opacity: 0, duration: 0.6, ease: 'power2.out', stagger: 0.12 }, 2.0)
      .fromTo('.board, h2, .meta', { scale: 1 }, { scale: 1.035, duration: ${T_END}, ease: 'sine.inOut' }, 0);
  </script>
</body>
</html>
`;
fs.writeFileSync(`${R}/compare/compare.html`, html);
console.log('compare.html', TOTAL, 's');
