// review: the video the way a viewer (or a strict judge) sees it, from the page, in one folder.
//   overview.png   the whole video at a glance (24 frames, evenly spread): what happens when, does it flow
//   holds.png      the frames people actually read: the middle of every calm stretch, large. Composition,
//                  type, hierarchy, spacing, anything stray
//   motion-N.png   one second at 10 fps around the busiest moments and every scene hand-over: easing, smears,
//                  things overlapping while one leaves and the next arrives, leftovers
//   REVIEW.md      the check report, what each image is for, and a strict rubric to score and fix against
// It does not judge taste; it makes the look-and-fix pass fast enough to do twice.
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { check, snapshot, formatReport } from './check.js';

/**
 * @param {import('./types/api.js').Input} input
 * @param {{ output?: string, brief?: string, quiet?: boolean, onStep?: (s: string) => void } & Record<string, any>} [opts]
 */
export async function review(input, opts = {}) {
  const step = opts.onStep || (() => {});
  step('check');
  const { output: _o, onStep: _s, ...copts } = opts;
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

  const md = [];
  md.push(`# Review: ${file ? basename(file) : 'composition'} (${info.width}x${info.height}, ${dur.toFixed(2)} s)`, '');
  md.push('Look at every image as a strict senior motion designer who did not write this page and has only the brief.', 'Judge what is on screen, not what the code meant.', '');
  md.push('## Images', '');
  md.push(`- \`overview.png\`: ${overview.times.length} frames evenly spread. Does every beat of the brief happen, in order, at its time? Does each scene come from the last one (no hard swaps, no empty gaps)?`);
  md.push(`- \`holds.png\`: the frames viewers read (${holdsImg.times.map((t) => t.toFixed(1) + 's').join(', ')}). Judge each as a poster: one clear focal point, type hierarchy and size, margins and alignment, color roles from the brief, nothing stray, cramped or cut off.`);
  motion.forEach((s, i) => md.push(`- \`motion-${i + 1}.png\`: ${s.times[0].toFixed(1)}–${s.times[s.times.length - 1].toFixed(1)} s at 10 fps. Does it ease in and out (not linear, not snapping)? Does the outgoing thing leave before the incoming one lands on it? Is moving text readable? Any leftovers?`));
  md.push('', '## check', '', '```', formatReport(rep, { file: file || undefined }), '```', '');
  md.push('## Score it, then fix', '');
  md.push('Score 1-10, harshly (5 = flawed, 7 = competent, 9 = portfolio piece):', '');
  md.push('| | Score | Why (with times) |', '|---|---|---|');
  for (const k of ['Brief: every beat, Must and Must not, in order and on time', 'Spec: exact colors, fonts, copy, format', 'Motion: easing, flow between beats, camera, rhythm', 'Craft: composition, typography, polish of every hold', 'Errors: stray marks, overlaps, cut-offs, leftovers, glitches']) md.push(`| ${k} | | |`);
  md.push('', 'Then write the five biggest visible problems with their times, fix them in the page, and run `givemotion review` again.');
  md.push('Stop when check has no errors and no row is below 8, or after two passes. A fresh pair of eyes finds more: if you can,');
  md.push('give another agent only the brief and this folder and ask it for the same table and five problems.');
  writeFileSync(join(dir, 'REVIEW.md'), md.join('\n') + '\n');
  return { dir, review: join(dir, 'REVIEW.md'), overview: overview.file, holds: holdsImg.file, motion: motion.map((s) => s.file), errors: rep.errors, warnings: rep.warnings, report: rep };
}
