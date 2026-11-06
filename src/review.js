// review: the video the way a viewer (or a strict judge) sees it, from the page, in one folder.
//   overview.png   the whole video at a glance (24 frames, evenly spread): what happens when, does it flow
//   holds.png      the frames people actually read: the middle of every calm stretch, large. Composition,
//                  type, hierarchy, spacing, anything stray
//   motion-N.png   one second at 10 fps around the busiest moments and every scene hand-over: easing, smears,
//                  things overlapping while one leaves and the next arrives, leftovers
//   beats.png      with a brief (brief.md next to the page, or --brief): for every beat the brief times, a frame in its
//                  middle and one just before it ends, plus every "at 4.2 s" moment it names. Is each beat there,
//                  complete and on time?
//   REVIEW.md      the check report, what each image is for, the brief's beats to check, and a strict rubric
// It does not judge taste; it makes the look-and-fix pass fast enough to do twice.
import { mkdirSync, renameSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { check, snapshot, formatReport } from './check.js';

/**
 * The beats a brief gives times for ("Beat 2 · 3.0–6.5 s", "| 0:03–0:06 |", "**4.0-9.0 s**"), with the moments it
 * names inside them ("at 2.4 s"). Generic on purpose: any brief that writes times in seconds.
 * @param {string} text @param {number} dur
 * @returns {{ from: number, to: number, title: string, text: string, moments: number[] }[]}
 */
export function briefBeats(text, dur) {
  const num = (a, b) => (b != null ? +a * 60 + +b : +a);
  const T = String.raw`(\d+)(?::(\d\d(?:\.\d+)?))?(?:\.(\d+))?`;
  const range = new RegExp(String.raw`(?:^|[^\d.:])` + T + String.raw`\s*(?:s|sec|seconds)?\s*[-–—]+\s*` + T + String.raw`\s*(s|sec|seconds)?\b`, 'i');
  const lines = text.split('\n'), found = [];
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i], m = range.exec(L);
    if (!m) continue;
    const a = m[2] != null ? num(m[1], m[2]) : parseFloat(m[1] + (m[3] ? '.' + m[3] : ''));
    const b = m[5] != null ? num(m[4], m[5]) : parseFloat(m[4] + (m[6] ? '.' + m[6] : ''));
    const head = /^\s*(#|\||\*\*|beat\b)/i.test(L);
    // a range of seconds only when the line says so (s, sec, a mm:ss) or it heads a section; "10-25 kg" is not a beat
    if (!(m[7] || m[2] != null || m[5] != null || head)) continue;
    if (!(b > a) || a < 0 || b > dur + 0.5 || b - a < 0.3) continue;
    // the text: this line and what follows until the next heading or timed heading
    let body = L.replace(/^[#|*\s-]+/, '');
    for (let k = i + 1; k < lines.length && k < i + 14; k++) { if (/^\s*#/.test(lines[k]) || (range.test(lines[k]) && /^\s*(\||\*\*|beat\b)/i.test(lines[k]))) break; body += ' ' + lines[k].trim(); }
    found.push({ from: a, to: Math.min(b, dur), head, body: body.replace(/\s+/g, ' ').trim() });
  }
  // beats: the timed headings (or every range when there are none); ranges inside a beat's text become its moments
  const heads = found.filter((x) => x.head);
  const base = heads.length >= 2 ? heads : found;
  const beats = [];
  for (const x of base) if (!beats.some((y) => Math.abs(y.from - x.from) < 0.05 && Math.abs(y.to - x.to) < 0.05)) beats.push(x);
  beats.sort((x, y) => x.from - y.from);
  const inside = (y, x) => y !== x && y.from >= x.from - 0.01 && y.to <= x.to + 0.01;
  const over = (x, y) => Math.max(0, Math.min(x.to, y.to) - Math.max(x.from, y.from));
  // not a beat: a range around two or more beats (the whole video, an act), or one that mostly overlaps an earlier beat
  const keep = [];
  for (const x of beats) {
    if (beats.filter((y) => inside(y, x)).length >= 2) continue;
    if (keep.some((y) => over(x, y) > 0.5 * (x.to - x.from))) continue;
    keep.push(x);
  }
  return keep.slice(0, 12).map((x) => {
    const inner = found.filter((y) => !beats.includes(y) && y.from > x.from + 0.05 && y.from < x.to - 0.1).map((y) => y.from);
    const ats = [...x.body.matchAll(/\bat\s+(\d+(?:\.\d+)?)\s*s\b/gi)].map((m) => +m[1]).filter((t) => t > x.from && t < x.to);
    return { from: x.from, to: x.to, title: x.body.slice(0, 70), text: x.body.slice(0, 600), moments: [...new Set([...ats, ...inner])].sort((p, q) => p - q).slice(0, 3) };
  });
}

/**
 * @param {import('./types/api.js').Input} input
 * @param {{ output?: string, brief?: string, quiet?: boolean, onStep?: (s: string) => void } & Record<string, any>} [opts]
 */
export async function review(input, opts = {}) {
  const step = opts.onStep || (() => {});
  step('check');
  const { output: _o, onStep: _s, brief: _b, ...copts } = opts;
  const rep = await check(input, /** @type {any} */ (copts));
  const info = rep.info, dur = info.duration, fps = info.fps;
  const file = typeof input === 'string' ? resolve(input) : null;
  const dir = resolve(opts.output || join(file ? dirname(file) : process.cwd(), 'review'));
  mkdirSync(dir, { recursive: true });
  const last = Math.max(0, dur - 1 / fps);
  const q = (t) => Math.round(Math.min(last, Math.max(0, t)) * fps) / fps;

  // calm stretches and busy moments from check's motion strip (share of the picture changing per half second)
  const m = rep.motion;
  const bins = m ? m.values.map((v, i) => ({ t: m.from + i * m.every + m.every / 2, v })) : [];
  const holds = [];
  for (let i = 0; i < bins.length;) {
    if (bins[i].v < 0.02) { let j = i; while (j + 1 < bins.length && bins[j + 1].v < 0.02) j++; if (j > i || bins.length < 4) holds.push(q((bins[i].t + bins[j].t) / 2)); i = j + 1; } else i++;
  }
  // (a video that never rests: its least busy half second in each fifth)
  if (holds.length < 3 && bins.length) for (let k = 0; k < 5; k++) { const seg = bins.filter((b) => b.t >= (k * dur) / 5 && b.t < ((k + 1) * dur) / 5); if (seg.length) holds.push(q(seg.reduce((a, b) => (b.v < a.v ? b : a)).t)); }
  holds.push(q(last));
  const holdTimes = [...new Set(holds)].sort((a, b) => a - b).slice(0, 9);

  const busy = [];
  for (const tr of /** @type {any} */ (info).transitions || []) busy.push((tr.start + tr.end) / 2);
  const peaks = bins.filter((b, i) => b.v >= 0.06 && (i === 0 || b.v >= bins[i - 1].v) && (i === bins.length - 1 || b.v >= bins[i + 1].v)).sort((a, b) => b.v - a.v);
  for (const p of peaks) if (busy.every((t) => Math.abs(t - p.t) > 1.2)) busy.push(p.t);
  if (!busy.length) for (const p of [0.2, 0.5, 0.8]) busy.push(p * dur);
  const strips = busy.slice(0, 6).map((c) => Math.max(0, Math.min(last - 0.9, c - 0.5))).sort((a, b) => a - b);

  const shot = async (name, times, cols) => {
    const tmp = join(dir, '.tmp-' + name);
    const r = await snapshot(input, { ...opts, output: tmp, times: times.map((t) => q(t).toFixed(3)).join(','), sheetOnly: true, cols });
    const out = join(dir, name + '.png');
    renameSync(r.sheet, out);
    rmSync(tmp, { recursive: true, force: true });
    return { file: out, times: r.times };
  };
  step('overview');
  const n = Math.min(24, Math.max(6, Math.round(dur * 1.5)));
  const overview = await shot('overview', Array.from({ length: n }, (_, i) => ((i + 0.5) * dur) / n), 6);
  step('holds');
  const holdsImg = await shot('holds', holdTimes, holdTimes.length <= 4 ? 2 : 3);
  const motion = [];
  for (let i = 0; i < strips.length; i++) {
    step('motion ' + (i + 1) + '/' + strips.length);
    motion.push(await shot('motion-' + (i + 1), Array.from({ length: 10 }, (_, k) => strips[i] + k / 10), 5));
  }

  // the brief's beats
  let briefFile = opts.brief ? resolve(opts.brief) : null;
  if (!briefFile && file) for (const n of ['brief.md', 'BRIEF.md', 'brief.txt']) if (existsSync(join(dirname(file), n))) { briefFile = join(dirname(file), n); break; }
  const beats = briefFile && existsSync(briefFile) ? briefBeats(readFileSync(briefFile, 'utf8'), dur) : [];
  let beatShots = null;
  const beatTimes = [];
  for (const [i, b] of beats.entries()) {
    beatTimes.push({ t: q((b.from + b.to) / 2), what: `beat ${i + 1} middle` }, { t: q(Math.max(b.from, b.to - 0.15)), what: `beat ${i + 1} end` });
    for (const t of b.moments) beatTimes.push({ t: q(t + 0.1), what: `beat ${i + 1}, just after ${t} s` });
  }
  beatTimes.sort((x, y) => x.t - y.t);
  if (beatTimes.length) { step('beats'); beatShots = await shot('beats', beatTimes.slice(0, 36).map((x) => x.t), 4); }

  const md = [];
  md.push(`# Review: ${file ? basename(file) : 'composition'} (${info.width}x${info.height}, ${dur.toFixed(2)} s)`, '');
  md.push('Look at every image as a strict senior motion designer who did not write this page and has only the brief.', 'Judge what is on screen, not what the code meant.', '');
  md.push('## Images', '');
  md.push(`- \`overview.png\`: ${overview.times.length} frames evenly spread. Does every beat of the brief happen, in order, at its time? Does each scene come from the last one (no hard swaps, no empty gaps)?`);
  md.push(`- \`holds.png\`: the frames viewers read (${holdsImg.times.map((t) => t.toFixed(1) + 's').join(', ')}). Judge each as a poster: one clear focal point, type hierarchy and size, margins and alignment, color roles from the brief, nothing stray, cramped or cut off.`);
  motion.forEach((s, i) => md.push(`- \`motion-${i + 1}.png\`: ${s.times[0].toFixed(1)}–${s.times[s.times.length - 1].toFixed(1)} s at 10 fps. Does it ease in and out (not linear, not snapping)? Does the outgoing thing leave before the incoming one lands on it? Is moving text readable? Any leftovers?`));
  if (beatShots) {
    md.push(`- \`beats.png\`: the brief's own moments, in order (from \`${basename(briefFile || '')}\`): ${beatTimes.slice(0, 36).map((x) => x.t.toFixed(2) + 's ' + x.what).join('; ')}.`);
    md.push('', '## The brief, beat by beat', '', 'For each beat, check its frames in `beats.png` against every word of it: is everything it names on screen, in the');
    md.push('stated colour, size and position, in the stated state (numbers, labels, which item is selected), by the time it says,');
    md.push('and is nothing extra there (an effect, a glow, a leftover from the last beat, a part cut by an old container)?', '');
    beats.forEach((b, i) => md.push(`${i + 1}. **${b.from}–${b.to} s**: ${b.text}${b.text.length >= 600 ? '…' : ''}`, ''));
  } else md.push(`- No brief found: put \`brief.md\` next to the page or pass \`--brief <file>\` to get \`beats.png\`, the brief's beats at their own times.`);
  md.push('', '## check', '', '```', formatReport(rep, { file: file || undefined }), '```', '');
  md.push('## Score it, then fix', '');
  md.push('Score 1-10, harshly (5 = flawed, 7 = competent, 9 = portfolio piece):', '');
  md.push('| | Score | Why (with times) |', '|---|---|---|');
  for (const k of ['Brief: every beat, Must and Must not, in order and on time', 'Spec: exact colors, fonts, copy, format', 'Motion: easing, flow between beats, camera, rhythm', 'Craft: composition, typography, polish of every hold', 'Errors: stray marks, overlaps, cut-offs, leftovers, glitches']) md.push(`| ${k} | | |`);
  md.push('', 'Then write the five biggest visible problems with their times, fix them in the page, and run `givemotion review` again.');
  md.push('Stop when check has no errors and no row is below 8, or after two passes. Use the critic once, on the near-final cut.', '');
  md.push('## Critic prompt (for a sub-agent that has not seen the page)', '');
  md.push('A fresh reviewer finds what the author no longer sees. Give a sub-agent this, word for word:', '', '```');
  md.push(`You are a strict senior motion designer reviewing a video you did not make. Read the brief at ${briefFile || '<path to the brief>'}`);
  md.push(`and look at every image in ${dir}: overview.png (the whole video), holds.png (the frames people read), the`);
  md.push('motion-*.png strips (1 s at 10 fps) and beats.png (each brief beat at its own times). Do not read any code.');
  md.push('List, with times: every place the video departs from the brief (a beat late, missing or incomplete; a wrong');
  md.push('number, label, state, colour, size or position; anything on screen the brief did not ask for); every visible');
  md.push('error (stray or leftover marks, something cut by an old container, doubled or ghosted shapes, overlaps while one');
  md.push('thing leaves and the next arrives, text too close to the edge or smaller than the brief asks, unreadable moving');
  md.push('text, half-rolled digits); and the weakest holds as');
  md.push('designs. Then score brief, spec, motion, craft and errors from 1 to 10, harshly, and name the five fixes that would');
  md.push('raise the score most.', '```');
  writeFileSync(join(dir, 'REVIEW.md'), md.join('\n') + '\n');
  return { dir, review: join(dir, 'REVIEW.md'), overview: overview.file, holds: holdsImg.file, motion: motion.map((s) => s.file), beats: beatShots ? beatShots.file : null, beatList: beats, errors: rep.errors, warnings: rep.warnings, report: rep };
}
