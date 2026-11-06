// Builds compare.html for the two-brief round: intro, then per brief a title card and a 2x2 grid (three videos with
// their engine labels + that brief's process numbers), then a scoreboard over both briefs.
// Reads ../stats.json, ../judging/<id>/scores.json, ../render-times.json, ../assignments.json, ../brief-<id>.md.
// Render: node /home/user/givemotion/src/cli.js render compare.html -o out/compare.mp4
import fs from 'node:fs';

const R = '/home/user/tools5';
const J = (p) => JSON.parse(fs.readFileSync(`${R}/${p}`, 'utf8'));
const stats = J('stats.json'), renders = J('render-times.json'), assignments = [...J('harness/assignments.json'), ...(fs.existsSync(`${R}/harness/assignments-r3.json`) ? J('harness/assignments-r3.json') : [])].filter((a) => fs.existsSync(`${R}/judging/${a.id}/scores.json`));
const briefs = assignments.map((a) => ({ ...a, title: (fs.readFileSync(`${R}/brief-${a.id}.md`, 'utf8').match(/^# Brief:\s*(.+)$/m) || [, a.subject])[1].replace(/[*"]/g, ''), scores: J(`judging/${a.id}/scores.json`) }));
const ENG = [
  { key: 'givemotion', name: 'givemotion', ver: '0.1.3+', color: '#FF7A45' },
  { key: 'remotion', name: 'Remotion', ver: '4.0.541', color: '#5B9BFF' },
  { key: 'hyperframes', name: 'HyperFrames', ver: '0.9.17/18', color: '#3DDC97' },
];
const fmtTok = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : Math.round(n / 1e3) + 'k');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const chip = (e, cls = '') => `<div class="chip ${cls}" style="--c:${e.color}"><i></i>${e.name}<span>${e.ver}</span></div>`;
const S = (b, k) => stats[`${b.id}-${k}`];
const rows = [
  ['Judges (mean of 6)', (b, k) => b.scores.mean[k].overall.toFixed(1), 'max'],
  ['Tokens', (b, k) => fmtTok(S(b, k).tokens.total), 'min'],
  ['Cost (API list)', (b, k) => '$' + S(b, k).cost_usd.toFixed(2), 'min'],
  ['Time to finish', (b, k) => S(b, k).minutes.toFixed(1) + ' min', 'min'],
  ['Tool calls', (b, k) => String(S(b, k).tool_calls), 'min'],
  ['Code written', (b, k) => S(b, k).loc + ' lines', 'min'],
  ['Render', (b, k) => Math.round(renders[b.id][k]) + ' s', 'min'],
];
const num = (s) => parseFloat(String(s).replace(/[^0-9.]/g, '')) * (String(s).includes('M') ? 1000 : 1);
const best = (b, f, dir) => { const v = ENG.map((e) => num(f(b, e.key))); const t = dir === 'max' ? Math.max(...v) : Math.min(...v); return ENG[v.indexOf(t)].key; };

const T_INTRO = 5.5, T_CARD = 3.2, T_END = 10;
let t = T_INTRO;
const parts = [];
for (const b of briefs) {
  const gridDur = b.seconds + 1.6;
  b.cardAt = t; t += T_CARD; b.gridAt = t; b.gridDur = gridDur; t += gridDur;
}
const endAt = t, TOTAL = +(t + T_END).toFixed(2);

for (const [i, b] of briefs.entries()) {
  parts.push(`
  <section class="scene card" id="card${i}" data-start="${b.cardAt.toFixed(2)}" data-duration="${T_CARD}">
    <div class="ci">
      <div class="k">Brief ${b.id.toUpperCase()} · drawn at random · round ${'ab'.includes(b.id) ? '2: givemotion before today\'s fixes' : '3: givemotion after them'}</div>
      <h2>${esc(b.title)}</h2>
      <div class="meta">${esc(b.genre)} · ${esc(b.subject)} · ${b.seconds} s</div>
      <div class="tech">${b.techniques.map((x) => `<span>${esc(x)}</span>`).join('')}</div>
    </div>
  </section>
  <section class="scene grid" id="grid${i}" data-start="${b.gridAt.toFixed(2)}" data-duration="${b.gridDur.toFixed(2)}">
    ${ENG.map((e, j) => `<div class="tile t${j}"><video src="media/${b.id}-${e.key}.mp4" data-start="0.8" data-duration="${b.seconds}" muted></video>${chip(e, 'on-video')}</div>`).join('')}
    <div class="tile t3 stats">
      <div class="stats-h">Brief ${b.id.toUpperCase()}: ${esc(b.title)}</div>
      <table>
        <tr><th></th>${ENG.map((e) => `<th style="color:${e.color}">${e.name}</th>`).join('')}</tr>
        ${rows.map(([label, f, dir]) => `<tr class="row"><td>${label}</td>${ENG.map((e) => `<td class="${best(b, f, dir) === e.key ? 'best' : ''}">${f(b, e.key)}</td>`).join('')}</tr>`).join('')}
      </table>
    </div>
  </section>`);
}

// scoreboard: mean of the two briefs' means
const overall = Object.fromEntries(ENG.map((e) => [e.key, briefs.reduce((s, b) => s + b.scores.mean[e.key].overall, 0) / briefs.length]));
const ranked = [...ENG].sort((a, b) => overall[b.key] - overall[a.key]);
const ord = (n) => ['1st', '2nd', '3rd'][n];
const tot = (k, f) => briefs.reduce((s, b) => s + f(S(b, k)), 0);
const firsts = (k) => briefs.reduce((s, b) => s + b.scores.firsts[k], 0);
const board = ranked.map((e, i) => `<div class="b-row" style="--c:${e.color}">
  <div class="b-place">${ord(i)}</div><div class="b-name">${e.name}</div>
  <div class="b-bar"><div class="b-fill" style="--w:${overall[e.key] / 10}"></div></div><b class="b-score num">0.0</b>
  <div class="b-facts">${briefs.map((b) => `<span>Brief ${b.id.toUpperCase()}: ${b.scores.mean[e.key].overall.toFixed(1)}</span>`).join('')}<span>#1 for ${firsts(e.key)} of ${briefs.length * 6} judges</span><span>${fmtTok(tot(e.key, (s) => s.tokens.total))} tokens</span><span>$${tot(e.key, (s) => s.cost_usd).toFixed(2)}</span><span>${tot(e.key, (s) => s.minutes).toFixed(0)} min</span></div>
</div>`).join('');

const html = `<!doctype html>
<html data-width="1920" data-height="1080" data-fps="30" data-duration="${TOTAL}" data-background="#0E0F13">
<head>
<meta charset="utf-8">
<title>Two random briefs: givemotion vs Remotion vs HyperFrames</title>
<style>
  :root { --bg:#0E0F13; --ink:#F3F1EC; --mute:#9A9AA6; --line:#262833; }
  body { background:var(--bg); color:var(--ink); font-family:Inter, sans-serif; margin:0; }
  .scene { overflow:hidden; }
  .chip { display:inline-flex; align-items:center; gap:12px; padding:10px 18px; border-radius:999px; background:rgba(14,15,19,.82); border:1.5px solid var(--c); font:600 28px 'Space Grotesk'; color:var(--ink); }
  .chip i { width:14px; height:14px; border-radius:50%; background:var(--c); }
  .chip span { font:500 24px Inter; color:var(--mute); }
  .on-video { position:absolute; left:18px; top:18px; }
  #intro { display:grid; place-items:center; text-align:center; }
  #intro h1 { font:700 104px/1 'Space Grotesk'; letter-spacing:-.035em; margin:0; }
  #intro .sub { margin-top:30px; font:500 30px Inter; color:var(--mute); }
  #intro .chips { margin-top:56px; display:flex; gap:24px; justify-content:center; }
  #intro .chips .chip { font-size:36px; padding:14px 26px; }
  .card { display:grid; place-items:center; }
  .ci { text-align:center; max-width:1600px; }
  .ci .k { font:600 26px Inter; letter-spacing:.14em; text-transform:uppercase; color:var(--mute); }
  .ci h2 { font:700 96px/1.05 'Space Grotesk'; letter-spacing:-.03em; margin:22px 0 18px; }
  .ci .meta { font:500 32px Inter; color:#D8D6D0; }
  .ci .tech { margin-top:34px; display:flex; gap:16px; justify-content:center; flex-wrap:wrap; }
  .ci .tech span { font:500 26px Inter; padding:10px 20px; border:1.5px solid var(--line); border-radius:999px; color:#C9C7C2; }
  .grid .tile { position:absolute; width:900px; height:506px; border-radius:14px; overflow:hidden; background:#000; }
  .grid .t0 { left:48px; top:22px; } .grid .t1 { left:972px; top:22px; } .grid .t2 { left:48px; top:552px; } .grid .t3 { left:972px; top:552px; }
  .grid video { width:100%; height:100%; display:block; }
  .stats { background:#15161C !important; border:1.5px solid var(--line); padding:24px 32px; box-sizing:border-box; }
  .stats-h { font:600 26px 'Space Grotesk'; margin-bottom:8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .stats table { width:100%; border-collapse:collapse; font-size:24px; }
  .stats th { font:600 24px 'Space Grotesk'; text-align:right; padding:4px 0 8px; }
  .stats td { text-align:right; padding:7px 0; border-top:1px solid var(--line); font-variant-numeric:tabular-nums; color:#C9C7C2; }
  .stats td:first-child { text-align:left; color:var(--mute); }
  .stats td.best { color:var(--ink); font-weight:700; }
  #end h2 { position:absolute; left:120px; top:80px; margin:0; font:700 96px 'Space Grotesk'; letter-spacing:-.03em; }
  #end .meta { position:absolute; left:124px; top:196px; font:500 26px Inter; color:var(--mute); }
  .board { position:absolute; left:120px; top:310px; width:1680px; display:grid; gap:58px; }
  .b-row { display:grid; grid-template-columns:110px 420px 1fr 150px; align-items:center; row-gap:14px; }
  .b-place { font:700 44px 'Space Grotesk'; color:var(--c); }
  .b-name { font:700 56px 'Space Grotesk'; letter-spacing:-.02em; }
  .b-bar { position:relative; height:64px; }
  .b-fill { position:absolute; inset:0 auto 0 0; width:calc(var(--w) * 100%); background:var(--c); border-radius:10px; transform-origin:left center; }
  .b-score { font:700 64px 'Space Grotesk'; text-align:right; font-variant-numeric:tabular-nums; }
  .b-facts { grid-column:2 / 5; display:flex; gap:40px; font-size:26px; color:var(--mute); }
</style>
</head>
<body>
  <section class="scene" id="intro" data-start="0" data-duration="${T_INTRO}">
    <div>
      <h1 data-split="words">Four random briefs, three engines</h1>
      <div class="sub">briefs drawn at random and written blind · Claude Opus 5.5, effort high · 6 blind judges per brief</div>
      <div class="chips">${ENG.map((e) => chip(e)).join('')}</div>
    </div>
  </section>
  ${parts.join('\n')}
  <section class="scene" id="end" data-start="${endAt.toFixed(2)}" data-duration="${T_END}">
    <h2>Final scores</h2>
    <div class="meta">Mean of the ${briefs.length} briefs' blind-judge scores (1-10) · process numbers summed over the ${briefs.length} makers of each tool</div>
    <div class="board">${board}</div>
  </section>
  <script>
    gm.timeline('#intro')
      .from('#intro h1 .gm-word', { y: 90, opacity: 0, filter: 'blur(10px)', duration: 0.8, ease: 'expo.out', stagger: 0.07 }, 0.2)
      .from('#intro .sub', { y: 24, opacity: 0, duration: 0.7, ease: 'power3.out' }, 0.8)
      .from('#intro .chip', { y: 40, scale: 0.8, opacity: 0, duration: 0.6, ease: 'back.out(1.7)', stagger: 0.12 }, 1.3)
      .to('#intro > div', { scale: 1.04, duration: ${T_INTRO}, ease: 'sine.inOut' }, 0.3)
      .to('#intro > div', { y: -60, opacity: 0, filter: 'blur(8px)', duration: 0.5, ease: 'power2.in' }, ${T_INTRO - 0.5});
    ${briefs.map((b, i) => `gm.timeline('#card${i}')
      .from('#card${i} .k', { y: 20, opacity: 0, duration: 0.5, ease: 'power3.out' }, 0.1)
      .from('#card${i} h2', { y: 60, opacity: 0, filter: 'blur(8px)', duration: 0.7, ease: 'expo.out' }, 0.2)
      .from('#card${i} .meta', { y: 20, opacity: 0, duration: 0.5, ease: 'power3.out' }, 0.5)
      .from('#card${i} .tech span', { y: 24, opacity: 0, duration: 0.5, ease: 'back.out(1.6)', stagger: 0.1 }, 0.7)
      .to('#card${i} .ci', { scale: 1.03, duration: ${T_CARD}, ease: 'sine.inOut' }, 0)
      .to('#card${i} .ci', { y: -50, opacity: 0, duration: 0.45, ease: 'power2.in' }, ${T_CARD - 0.45});
    gm.timeline('#grid${i}')
      .from('#grid${i} .tile', { y: 60, opacity: 0, duration: 0.7, ease: 'expo.out', stagger: 0.08 }, 0)
      .from('#grid${i} .on-video', { x: -30, opacity: 0, duration: 0.5, ease: 'power3.out', stagger: 0.08 }, 0.5)
      .from('#grid${i} .stats .row', { x: 30, opacity: 0, duration: 0.5, ease: 'power3.out', stagger: 0.07 }, 0.9)
      .to('#grid${i} .tile', { opacity: 0, y: -40, duration: 0.5, ease: 'power2.in', stagger: 0.05 }, ${(b.gridDur - 0.6).toFixed(2)});`).join('\n    ')}
    gm.timeline('#end')
      .from('#end h2', { y: 60, opacity: 0, duration: 0.7, ease: 'expo.out' }, 0.1)
      .from('#end .meta', { opacity: 0, duration: 0.6, ease: 'power2.out' }, 0.5)
      .from('#end .b-row', { y: 50, opacity: 0, duration: 0.7, ease: 'expo.out', stagger: 0.15 }, 0.7)
      .from('#end .b-fill', { scaleX: 0, duration: 1.4, ease: 'expo.out', stagger: 0.15 }, 1.0)
      ${ranked.map((e, i) => `.to('#end .b-row:nth-child(${i + 1}) .num', { textContent: ${overall[e.key].toFixed(1)}, duration: 1.4, ease: 'power2.out' }, ${(1.0 + i * 0.15).toFixed(2)})`).join('\n      ')}
      .from('#end .b-facts', { opacity: 0, duration: 0.6, ease: 'power2.out', stagger: 0.12 }, 2.0)
      .fromTo('#end .board, #end h2, #end .meta', { scale: 1 }, { scale: 1.03, duration: ${T_END}, ease: 'sine.inOut' }, 0);
  </script>
</body>
</html>
`;
fs.writeFileSync(`${R}/compare/compare.html`, html);
console.log('compare.html', TOTAL, 's');
