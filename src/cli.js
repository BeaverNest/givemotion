#!/usr/bin/env node
// givemotion CLI
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync, statSync, rmSync, mkdtempSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve, dirname, basename, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { parseArgs, parseScale } from './args.js';
import { handleSignals } from './machine.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(HERE, '..');
const pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8'));

const HELP = `givemotion ${pkg.version} — HTML in, video out. Built for AI agents.

Usage: givemotion <command> [options]

Make
  init [dir]                    New project: index.html + the AI skill pack
  dev [file]                    Live preview studio (scrub, play, frame-step)
  render [file] -o out.mp4      Render to mp4 / webm / mov / gif / png frames
                                (or -o sound.mp3/.wav/.m4a for the soundtrack only)
  still [file] -t 2.5 -o a.png  Render one frame

Look (for AI review)
  check [file]                  Find problems: errors, text cut off or off-screen,
                                overlaps, tiny text, low contrast, broken assets
  snapshot [file] -o dir        Key moments as PNGs + one contact sheet (sheet.png)
  review [file] -o dir          The video as a viewer sees it: overview, the frames people read, motion
                                strips at the busy moments, the check report and a scoring rubric (REVIEW.md)
  inspect [file]                Timeline as JSON: size, fps, duration, clips, media
  audio <file>                  Tempo, beats, bar starts and big hits of a sound file
  captions <file.json|.srt>     How the captions block will page the words (--words 3)
  words <page.html|voice.json>  Every word of the voice-over, the times it is said and the token
                                to write for each (@say, @say#2); --near 145: the words around 145 s
  analyze <video.mp4>           Report on any video: cuts, shot lengths, transitions,
                                camera, pacing, colors, beat sync, contact sheets;
                                --motion: smoothness (natural vs robotic), --strips

Share
  bundle [file] -o dir          Standalone page that plays in any browser, plus
                                <gm-player> to embed it in a website or app

Build faster
  blocks                        List ready-made blocks (titles, charts, captions…)
  add <block> [--dir blocks]    Copy a block into your project
  skill [dir]                   Install the AI skill pack (Claude Code, Codex, AGENTS.md)

Setup
  install                       Download the Chrome build used for rendering
  doctor                        Check Chrome, ffmpeg and the installed skill version
  clean                         Delete cached video frames
  bench [file]                  Measure render speed, and what each frame costs to composite

Render options
  -o, --output <file>    out.mp4 (format from extension) or a folder for PNG frames
  --format <f>           mp4 | webm | mov | gif | png
  --quality <q>          draft | standard (default) | high | max
  --crf <n>              Override encoder quality (lower = better)
  --codec <c>            h264 (default) | h265 | av1   (mp4 only)
  --hardware             Use the GPU video encoder (NVENC/VideoToolbox). On a Mac it is on by default once it encodes
                         reproducibly; --no-hardware turns it off
  --scale <n>            Render at n× resolution (2 → 4K from a 1080p layout; 4/3 → 1440p). A fraction must give
                         whole, even pixel sizes, or the render stops and names a scale that does
  --fps <n>  --width <n>  --height <n>   Override the composition settings
  --frames <range>       Part of the video: "0-90" (frames) or "2s-5s" (a new file)
  --redo <range>         Re-render this part ("4s-7s") even if it looks unchanged, keep the rest
  --no-cache             Do not keep or reuse parts (by default only changed parts are re-rendered)
  --cache-dir <dir>      Keep the parts in <dir>/<output name>/ instead of .gm-parts/ next to the output
  --cache-key <name>     Name the parts' folder <name> instead of the output's file name (a new output name per version still reuses them)
  --workers <n>          Parallel browsers (default: this render's share of the computer's cores and memory, split
                         with the other givemotion processes running; GIVEMOTION_MAX_BROWSERS sets the total)
  --transparent          Keep transparency (use --format mov or webm)
  --muted                No audio track
  --motion-blur <mode>   auto (default): a smear on what moves fast in each frame; off: every frame sharp
                         (also data-motion="classic"); or a number of sub-frames for every frame (e.g. 8)
  --shutter <0-1>        Motion blur shutter (default 0.5 = 180°)
  --data <file.json>     Data for data-bind / gm.data
  --props '<json>'       Same, inline
  --seed <n>             Seed for Math.random (default 1)
  --force                Render even if the composition has errors
  --json                 Print a JSON summary (good for agents)
  --progress json        Progress as JSON lines on stderr, for apps: {"event":"progress","phase":"open"|"frames"|
                         "encode"|"done","done":n,"total":n,"fps":n,"eta":s}, plus log/warning/error events
  --capture <m>          auto | beginframe | screenshot
  --chrome <path>        Use a specific Chrome / chrome-headless-shell

Docs: skills/givemotion/SKILL.md in the package (topic files in skills/givemotion/references/),
or \`givemotion skill\` to install the pack for your agent.`;

const CMD_HELP = {
  render: 'givemotion render [file.html] -o out.mp4 [options]\n\nSee "Render options" in `givemotion --help`.\n  Guide: references/output.md in the givemotion skill.',
  still: 'givemotion still [file.html] -t <seconds> | --frame <n> -o frame.png [--transparent] [--data f.json | --props \'{…}\'] [--json]',
  snapshot: `givemotion snapshot [file.html] [options]
  -o <dir>          Where to write (default: snapshots/ next to the HTML file)
  --times 1,2.5,4   Exact moments (seconds, or frames like 45f) instead of automatic ones
  --every 0.5       One frame every N seconds (or --every 1f for every frame)
  --from 3.2 --to 3.8   Only this part (with --every: a frame-by-frame strip of a move)
  --transitions     Start, middle and end of every scene transition
  --max 12          Max automatic moments (default 12; one per scene when settled)
  --sheet-only      Only write sheet.png
  --cols 2          Columns in the sheet (fewer = bigger pictures)
  --grid            Draw thirds, the center and the safe zone (data-safe-zone / --safe-zone) over the pictures
  --trail           Also write trail.png: the frames layered into one picture (earlier ones as fading ghosts), to see a
                    move's path and spacing at full size (with --from/--to --every 0.1)
  --data f.json / --props '{…}'   Data for {{data.…}} (default: data.json next to the HTML)
  --transparent     Show a checkerboard behind (auto-detected when the page has no background)
  --json            Machine-readable output
  Guide: references/review.md in the givemotion skill.`,
  check: `givemotion check [file.html] [--json] [--samples 10] [--transparent]
  --at 7.5          Check one moment only (fast, after a fix)
  --from 6 --to 9   Check part of the video
  --fast            Fewer samples (quicker, may miss short problems)
  --workers 4       Browsers for a long video (default: what the computer can spare; the report is the same for any number)
  --safe-zone shorts   Warn about text where the app covers vertical video (shorts | reels | tiktok, or "top,right,bottom,left" px);
                    or put data-safe-zone="shorts" on <html>
  --data f.json / --props '{…}'   Data for {{data.…}} (default: data.json next to the HTML)
  The report starts with a motion strip: how much of the picture changes, one mark per half second.
  Moving or fading text is skipped automatically; problems must last ~0.25s to count.
  Mark decorative copies with data-check="ignore" (or aria-hidden="true"), and text meant to be cut by the frame with data-check="crop-ok".
  data-check="pace-ignore" leaves an area (captions) out of the still-picture measure.
  Exit code 1 when there are errors. Warnings do not fail.
  Guide: references/check-codes.md in the givemotion skill.`,
  bundle: 'givemotion bundle [file.html] [-o dir] [--data f.json] [--props \'{…}\'] [--json]\n  Writes a standalone page (runtime inlined, blocks expanded, assets copied), gm-player.js and player.html.\n  Embed: <script src="gm-player.js"></script> <gm-player src="index.html" controls autoplay loop muted></gm-player>\n  Guide: references/output.md in the givemotion skill.',
  analyze: `givemotion analyze video.mp4 [-o dir] [--compare reference.mp4] [--motion] [--strips] [--json]
  Turns any video (a reference to learn from, or your own render) into a report:
  shots and their lengths, scene changes (cut, fade, dip, wipe-*, push-*, zoom, iris), camera per shot,
  a pacing strip, colors (background, accents), where the detail sits, scene changes on the beat,
  and pictures: sheet.png (the whole video at even steps) and shots.png (start, middle, end of every shot).
  -o <dir>          Where to write (default: analysis/<name>/ next to the video)
  --compare ref.mp4 Also analyze a reference and list the differences (yours vs reference)
  --every 0.5       Seconds between pictures on sheet.png (default: fits ~48 pictures)
  --no-sheets       Only the report (faster)
  --no-audio        Skip the music analysis
  --motion          Add a smoothness report: camera stops between moves, stop-and-go, sudden velocity changes,
                    jerk, motion blur on fast frames (strobing), and a 0-10 naturalness score
  --strips [n]      Also write strip-1.png … strip-n.png (default 4): the busiest 1 s moments at 10 frames
                    per second, to judge smoothness from pictures (implies --motion; --out <dir> = -o)
  Guide: references/review.md in the givemotion skill.`,
  words: 'givemotion words [page.html | voice.json] [--near 145] [--span 5] [--json]\n  Lists every word of the voice-over transcript (a page\'s <html data-words>, or the .json itself) in the order\n  first said, each with every time it is said and the exact token that names that occurrence (@say, @say#2, @say#3),\n  so you never count occurrences by hand. --near 145: the words said 140–150 s (--span sets the ±seconds), in order.\n  --json: [{word, start, end, token}]. Guide: references/media-audio.md in the givemotion skill.',
  captions: 'givemotion captions captions.json|captions.srt [--words 5] [--json]\n  Prints the caption pages the captions block will show (times and words), so you can pick --words before rendering.\n  Guide: references/media-audio.md in the givemotion skill.',
  audio: 'givemotion audio music.mp3 [--json] [--fps 30]\n  Prints tempo (BPM), beat times, downbeats (bar starts), big hits and loudness per second, so you can plan cuts on the beat.\n  Guide: references/media-audio.md in the givemotion skill.',
  inspect: 'givemotion inspect [file.html]\n  Prints JSON: width, height, fps, duration, frames, clips (selector, start, end), transitions, media, issues.\n  --at 12.3 [--el "#logo"]   Where elements are at that moment (screen box, opacity, transform, visible), and which clips are on screen with their local time.\n  --at 2 --to 3 --el "#logo" [--every 1f]   One element over time, frame by frame (position, size, opacity).\n  --data f.json / --props \'{…}\'   Data for {{data.…}}',
  dev: 'givemotion dev [file.html] [--port 4400] [--open] [--data f.json] [--props \'{…}\']',
  init: 'givemotion init [dir] [--force]\n  Starter video plus the skill pack (.claude/skills/givemotion, .agents/skills/givemotion, AGENTS.md).',
  skill: 'givemotion skill [dir]\n  Installs the skill pack (SKILL.md + references/) to .claude/skills/givemotion (Claude Code) and\n  .agents/skills/givemotion (Codex), and adds a givemotion section to AGENTS.md (Cursor and other agents).\n  Run it again after updating givemotion; `givemotion doctor` says when the installed pack is older.',
  add: 'givemotion add <block> [more…] [--dir blocks]',
  blocks: 'givemotion blocks [--json]',
  bench: 'givemotion bench [file.html] [--workers n] [--json]',
};

const BOOLS = ['json', 'sheets', 'audio', 'motion', 'cache', 'grid', 'force', 'transparent', 'muted', 'fast', 'transitions', 'hardware', 'quiet', 'reuse', 'open', 'sheetOnly', 'help', 'version', 'lossless', 'verbose', 'yes'];

async function main() {
  // Ctrl+C or a kill ends through exit(), which closes this process's browsers and encoders and removes its temporary
  // files (Chrome runs in its own process group, which a Ctrl+C in the terminal does not reach)
  handleSignals();
  const argv = process.argv.slice(2);
  const cmd = argv[0] && !argv[0].startsWith('-') ? argv[0] : (argv.includes('--version') || argv.includes('-v') ? 'version' : 'help');
  const args = parseArgs(cmd === argv[0] ? argv.slice(1) : argv, { boolean: BOOLS, alias: { o: 'output', out: 'output', t: 'time', w: 'workers', q: 'quality', h: 'help', f: 'format' } });
  if (args.help && cmd !== 'help') return console.log(CMD_HELP[cmd] || HELP);
  // an option the command does not read is easy to miss (snapshot --at 1,2 used to give the automatic times): say so.
  // What a command reads is taken from its own code (and commonOpts when it uses it), so this list never goes stale.
  const fns = { render: cmdRender, still: cmdStill, snapshot: cmdSnapshot, review: cmdReview, check: cmdCheck, inspect: cmdInspect, bundle: cmdBundle, export: cmdBundle, audio: cmdAudio, beats: cmdAudio, analyze: cmdAnalyze, analyse: cmdAnalyze, captions: cmdCaptions, words: cmdWords };
  if (fns[cmd]) {
    const src = fns[cmd].toString(), reads = (code) => [...code.matchAll(/args\.([a-zA-Z]+)/g)].map((m) => m[1]);
    const helpers = { commonOpts, loadData }, seen = new Set(), all = [];
    const walk = (code) => { all.push(...reads(code)); for (const [n, f] of Object.entries(helpers)) if (!seen.has(n) && new RegExp('\\b' + n + '\\(').test(code)) { seen.add(n); walk(f.toString()); } };
    walk(src);
    const known = new Set(['help', 'json', 'quiet', '_', ...all]);
    const flag = (k) => '--' + k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
    for (const k of Object.keys(args)) {
      if (known.has(k)) continue;
      const near = [...known].filter((x) => x !== '_' && (x.startsWith(k.slice(0, 3)) || k.startsWith(x.slice(0, 3)) || (k === 'at' && x === 'times')));
      process.stderr.write(`givemotion ${cmd}: unknown option ${flag(k)}, ignored${near.length ? ` (did you mean ${near.slice(0, 3).map(flag).join(', ')}?)` : ''}. See givemotion ${cmd} --help.\n`);
    }
  }
  switch (cmd) {
    case 'help': return console.log(HELP);
    case 'version': return console.log(pkg.version);
    case 'render': return cmdRender(args);
    case 'still': return cmdStill(args);
    case 'snapshot': return cmdSnapshot(args);
    case 'review': return cmdReview(args);
    case 'check': return cmdCheck(args);
    case 'inspect': return cmdInspect(args);
    case 'bundle': case 'export': return cmdBundle(args);
    case 'audio': case 'beats': return cmdAudio(args);
    case 'analyze': case 'analyse': return cmdAnalyze(args);
    case 'captions': return cmdCaptions(args);
    case 'words': return cmdWords(args);
    case 'dev': case 'preview': case 'studio': return cmdDev(args);
    case 'init': return cmdInit(args);
    case 'blocks': return cmdBlocks(args);
    case 'add': return cmdAdd(args);
    case 'skill': return cmdSkill(args);
    case 'install': return cmdInstall();
    case 'doctor': return cmdDoctor();
    case 'bench': return cmdBench(args);
    case 'clean': return cmdClean();
    default:
      console.error(`Unknown command "${cmd}".\n`);
      console.log(HELP);
      process.exitCode = 2;
  }
}

function loadData(args) {
  let data = null;
  if (args.data) data = JSON.parse(readFileSync(resolve(args.data), 'utf8'));
  if (args.props) data = Object.assign(data || {}, JSON.parse(args.props));
  return data;
}
function commonOpts(args) {
  return {
    chrome: args.chrome, capture: args.capture, gl: args.gl, data: loadData(args), seed: args.seed != null ? +args.seed : undefined,
    fps: args.fps ? +args.fps : undefined, width: args.width ? +args.width : undefined, height: args.height ? +args.height : undefined,
    scale: parseScale(args.scale), verbose: args.verbose, timeoutMs: args.timeout ? +args.timeout * 1000 : undefined,
    onConsole: args.verbose ? (type, text) => console.error(`[page ${type}] ${text}`) : undefined,
  };
}
const inputOf = (args) => args._[0] || 'index.html';

async function cmdRender(args) {
  const { render } = await import('./render.js');
  const out = args.output || defaultOut(inputOf(args), args.format);
  // --progress json: stderr carries only JSON lines (progress, log, warning, error events); stdout keeps the --json summary
  if (args.progress != null && args.progress !== 'json') return fail(new Error(`Bad --progress "${args.progress === true ? '' : args.progress}". Use --progress json (one JSON object per line on stderr).`), args);
  const jsonl = args.progress === 'json' ? (o) => process.stderr.write(JSON.stringify(o) + '\n') : null;
  if (args.cacheDir === true) return fail(new Error('--cache-dir needs a folder.'), args);
  if (args.cacheKey === true) return fail(new Error('--cache-key needs a name.'), args);
  try {
    const summary = await render(inputOf(args), {
      ...commonOpts(args), output: out, format: args.format, quality: args.quality, crf: args.crf != null ? +args.crf : undefined, codec: args.codec,
      hardware: args.hardware, workers: args.workers ? +args.workers : undefined, frames: args.frames, transparent: args.transparent, muted: args.muted,
      motionBlur: args.noMotionBlur ? 'off' : args.motionBlur, shutter: args.shutter != null ? +args.shutter : undefined, force: args.force, quiet: args.quiet || args.json || !!jsonl,
      noReuse: args.reuse === false, lossless: args.lossless, redo: args.redo, cache: args.cache, cacheDir: args.cacheDir, cacheKey: args.cacheKey != null ? String(args.cacheKey) : undefined,
      ...(jsonl ? { onProgress: (p) => jsonl({ event: 'progress', ...p }), log: (message) => jsonl({ event: 'log', message: String(message) }) } : {}),
    });
    if (args.json) console.log(JSON.stringify(summary, null, 2));
    if (jsonl) {
      for (const w of summary.warnings) jsonl({ event: 'warning', code: w.code, message: w.message, selector: w.selector || null, fix: w.fix || null });
      for (const e of summary.pageErrors) jsonl({ event: 'warning', code: 'page-' + e.code, message: e.message });
    } else if (!args.json) {
      for (const w of summary.warnings) console.error(`⚠ [${w.code}] ${w.message}${w.selector ? ' (' + w.selector + ')' : ''}`);
      for (const e of summary.pageErrors) console.error(`⚠ page ${e.code}: ${e.message}`);
    }
  } catch (e) {
    if (jsonl) { jsonl({ event: 'error', message: e.message, issues: e.issues ? e.issues.filter((i) => i.severity === 'error') : undefined }); if (!args.json) { process.exitCode = 1; return; } }
    fail(e, args);
  }
}
function defaultOut(input, format) {
  const base = basename(input).replace(/\.html?$/i, '') || 'out';
  return join('out', `${base === 'index' ? 'video' : base}.${format && format !== 'png' ? format : format === 'png' ? '' : 'mp4'}`).replace(/\.$/, '');
}

async function cmdStill(args) {
  const { stills, openComposition } = await import('./render.js');
  try {
    const opts = commonOpts(args);
    const out = resolve(args.output || 'still.png');
    const fmt = /\.jpe?g$/i.test(out) ? 'jpeg' : 'png';
    let t = args.time != null ? parseFloat(args.time) : 0;
    if (args.frame != null) {
      const { inspect } = await import('./api.js');
      const info = await inspect(inputOf(args), opts);
      t = +args.frame / info.fps;
    }
    const r = await stills(inputOf(args), [t], { ...opts, format: fmt, transparent: args.transparent });
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, r.buffers[0]);
    const problems = [...(r.info.issues || []).filter((i) => i.severity === 'error'), ...(r.errors || [])];
    if (args.json) console.log(JSON.stringify({ output: out, time: t, problems }));
    else {
      console.error(`wrote ${shortPath(out)} (t=${t}s)`);
      if (problems.length) console.error(`⚠ the page has ${problems.length} problem${problems.length > 1 ? 's' : ''} (run check for details): ${problems.slice(0, 3).map((p) => p.message).join(' | ')}`);
    }
  } catch (e) { fail(e, args); }
}

async function cmdSnapshot(args) {
  const { snapshot } = await import('./check.js');
  try {
    const progress = args.json ? null : (i, n) => { if (n > 8 && (i === 1 || i % 10 === 0 || i === n)) process.stderr.write(`  frame ${i}/${n}\n`); };
    const r = await snapshot(inputOf(args), { ...commonOpts(args), transparent: args.transparent, output: args.output, times: args.times ?? args.at, every: args.every, from: args.from, to: args.to, transitions: args.transitions, max: args.max ? +args.max : undefined, sheetOnly: args.sheetOnly, grid: args.grid, trail: args.trail, safeZone: args.safeZone, cols: args.cols ? +args.cols : undefined, onProgress: progress });
    if (args.json) console.log(JSON.stringify(r, null, 2));
    else {
      console.log(`sheet: ${shortPath(r.sheet)}`);
      if (r.trail) console.log(`trail: ${shortPath(r.trail)}`);
      console.log(`times: ${r.times.map((t) => t.toFixed(2) + 's').join(', ')}`);
      if (r.files.length) console.log(`frames (${r.files.length}): ${r.files.map((f) => shortPath(f)).slice(0, 6).join(', ')}${r.files.length > 6 ? ', …' : ''}`);
      if (r.problems && r.problems.length) console.log(`⚠ the page has ${r.problems.length} problem${r.problems.length > 1 ? 's' : ''} (run check for details): ${r.problems.slice(0, 3).map((p) => p.message).join(' | ')}`);
    }
  } catch (e) { fail(e, args); }
}

async function cmdReview(args) {
  const { review } = await import('./review.js');
  try {
    const r = await review(inputOf(args), { ...commonOpts(args), output: args.output, onStep: args.json ? null : (s) => process.stderr.write(`  ${s}\n`) });
    if (args.json) console.log(JSON.stringify({ ...r, report: undefined }, null, 2));
    else {
      console.log(`review: ${shortPath(r.dir)}  (${r.errors} error${r.errors === 1 ? '' : 's'}, ${r.warnings} warning${r.warnings === 1 ? '' : 's'})`);
      console.log(`open ${shortPath(r.review)}, then look at overview.png, holds.png and ${r.motion.length} motion strip${r.motion.length === 1 ? '' : 's'}`);
    }
  } catch (e) { fail(e, args); }
}

async function cmdCheck(args) {
  const { check, formatReport } = await import('./check.js');
  try {
    const rep = await check(inputOf(args), { ...commonOpts(args), transparent: args.transparent, contrastSamples: args.samples ? +args.samples : undefined, at: args.at, from: args.from, to: args.to, fast: args.fast, safeZone: args.safeZone, workers: args.workers ? +args.workers : undefined });
    if (args.json) console.log(JSON.stringify(rep, null, 2));
    else console.log(formatReport(rep, { file: inputOf(args) }));
    const note = staleSkillNote(dirname(resolve(inputOf(args))));
    if (note) console.error(note);
    if (!rep.ok) process.exitCode = 1;
  } catch (e) { fail(e, args); }
}

async function cmdInspect(args) {
  const { inspect } = await import('./api.js');
  if (args.at != null) {
    // Where elements are at one moment: rect on screen, opacity, transform, visible or not.
    const { openComposition } = await import('./render.js');
    const ctx = await openComposition(inputOf(args), { ...commonOpts(args), mode: 'render' });
    try {
      const sel = args.el || args.selector || '[data-start],[data-duration],[data-morph],h1,h2,h3';
      if (args.to != null) {
        // a strip of values over time for one element: x, y, size, opacity per frame
        const fps = ctx.info.fps, step = args.every ? (String(args.every).endsWith('f') ? parseFloat(args.every) / fps : +args.every) : 1 / fps;
        const rows = [];
        for (let t = +args.at; t <= +args.to + 1e-9 && rows.length < 400; t += step) {
          await ctx.page.seek(Math.round(t * fps) / fps);
          rows.push(await ctx.page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); let op = 1; for (let c = e; c && c.nodeType === 1; c = c.parentElement) op *= +getComputedStyle(c).opacity; const r1 = (x) => Math.round(x * 10) / 10; return { t: ${Math.round(t * 1000) / 1000}, x: r1(b.left), y: r1(b.top), w: r1(b.width), h: r1(b.height), opacity: Math.round(op * 1000) / 1000 }; })()`));
        }
        console.log(args.json ? JSON.stringify(rows, null, 2) : ['t       x       y       w       h       opacity', ...rows.filter(Boolean).map((r) => [r.t, r.x, r.y, r.w, r.h, r.opacity].map((v) => String(v).padEnd(8)).join(''))].join('\n'));
        return;
      }
      const nLog = await ctx.page.evaluate('gm.__logCount ? gm.__logCount() : 0');
      await ctx.page.seek(+args.at);
      const logs = await ctx.page.evaluate(`gm.__logs ? gm.__logs(${nLog}) : []`);
      const r = await ctx.page.evaluate(`(() => [...document.querySelectorAll(${JSON.stringify(sel)})].slice(0, 40).map((e) => {
        const b = e.getBoundingClientRect(), cs = getComputedStyle(e);
        let op = 1, shown = true; for (let c = e; c && c.nodeType === 1; c = c.parentElement) { const s2 = getComputedStyle(c); op *= +s2.opacity; if (s2.display === 'none' || s2.visibility === 'hidden') shown = false; }
        const r1 = (x) => Math.round(x * 10) / 10;
        return { selector: gm.__selector(e), visible: shown && op > 0.01 && b.right > 0 && b.bottom > 0 && b.left < gm.width && b.top < gm.height, x: r1(b.left), y: r1(b.top), width: r1(b.width), height: r1(b.height), opacity: Math.round(op * 1000) / 1000, transform: cs.transform, translate: cs.translate, scale: cs.scale, rotate: cs.rotate, text: (e.textContent || '').trim().slice(0, 40) };
      }))()`);
      // Which clips are on screen, and what their own clock says (data-enter delays, burst `at`, scoped onFrame use it)
      const T = +args.at, r3 = (x) => Math.round(x * 1000) / 1000;
      const clips = (ctx.info.clips || []).filter((c) => T >= c.start && T < c.end).map((c) => ({ selector: c.selector, start: r3(c.start), end: r3(c.end), local: r3(T - c.start) }));
      console.log(JSON.stringify({ time: T, clips, elements: r, ...(logs.length ? { logs } : {}) }, null, 2));
    } catch (e) { fail(e, args); } finally { await ctx.page.close(); await ctx.server.close(); }
    return;
  }
  try {
    const info = await inspect(inputOf(args), commonOpts(args));
    console.log(JSON.stringify(info, null, 2));
  } catch (e) { fail(e, args); }
}

async function cmdAudio(args) {
  const { analyzeAudio, formatAudio } = await import('./audio-cli.js');
  try {
    const f = args._[0];
    if (!f) throw new Error('Usage: givemotion audio music.mp3 [--json]');
    const r = await analyzeAudio(f, { fps: args.fps ? +args.fps : 30, chrome: args.chrome });
    console.log(args.json ? JSON.stringify(r, null, 2) : formatAudio(r));
  } catch (e) { fail(e, args); }
}

async function cmdCaptions(args) {
  const f = args._[0];
  if (!f) return fail(new Error('Usage: givemotion captions captions.json [--words 5]'), args);
  const file = resolve(f);
  if (!existsSync(file)) return fail(new Error(`Not found: ${file}`), args);
  // A tiny page with the captions block in it (the block itself does the paging), in a temp folder with a copy of the
  // captions file: nothing is written next to your file, and no path needs to go through a hidden folder (npx).
  const words = parseInt(args.words || '5', 10);
  const tmp = mkdtempSync(join(tmpdir(), 'gm-captions-'));
  const name = 'captions' + (extname(file).toLowerCase() || '.json');
  copyFileSync(file, join(tmp, name));
  copyFileSync(join(PKG_ROOT, 'blocks', 'captions.html'), join(tmp, 'captions-block.html'));
  const page = join(tmp, 'index.html');
  writeFileSync(page, `<!doctype html><html data-width="1080" data-height="1920" data-duration="1"><body><gm-include src="captions-block.html" file="${name}" words="${words}"></gm-include></body></html>`);
  const { openComposition } = await import('./render.js');
  let ctx;
  try {
    ctx = await openComposition(page, { ...commonOpts(args), mode: 'render' });
    const pages = await ctx.page.evaluate(`(document.querySelector('.gmb-cap') || {}).__gmPages || []`);
    if (args.json) return console.log(JSON.stringify(pages.map((p) => ({ start: p.start, end: p.end, text: p.words.map((w) => w.word).join(' ') })), null, 2));
    console.log(`${pages.length} caption pages with words="${words}":`);
    for (const p of pages) console.log(`  ${p.start.toFixed(2).padStart(6)}–${p.end.toFixed(2).padEnd(6)} ${p.words.map((w) => w.word).join(' ')}`);
  } catch (e) { fail(e, args); } finally { if (ctx) { await ctx.page.close(); await ctx.server.close(); } try { rmSync(tmp, { recursive: true, force: true }); } catch {} }
}

async function cmdWords(args) {
  const { loadWords, wordTokens, formatWords } = await import('./words.js');
  try {
    const t = loadWords(inputOf(args));
    const near = args.near != null ? parseFloat(args.near) : undefined, span = args.span != null ? parseFloat(args.span) : undefined;
    if (args.json) {
      const toks = wordTokens(t.words).filter((w) => near == null || Math.abs(w.start - near) <= (span ?? 5));
      return console.log(JSON.stringify(toks.map((w) => ({ word: w.word, start: w.start, end: w.end, token: w.token })), null, 2));
    }
    console.log(formatWords(t, { near, span }));
  } catch (e) { fail(e, args); }
}

async function cmdAnalyze(args) {
  const { analyzeVideo, formatAnalysis, compareAnalyses } = await import('./analyze.js');
  try {
    // (--strips takes an optional count: "--strips video.mp4" means the video, not a count)
    if (typeof args.strips === 'string' && !/^\d+$/.test(args.strips)) { args._.unshift(args.strips); args.strips = true; }
    const f = args._[0];
    if (!f) throw new Error('Usage: givemotion analyze video.mp4 [--compare reference.mp4] [-o dir] [--motion] [--strips] [--json]');
    const o = { output: args.output, every: args.every, sheets: args.sheets, audio: args.audio, chrome: args.chrome, motion: args.motion, strips: args.strips };
    const r = await analyzeVideo(f, o);
    let cmp = null;
    if (args.compare) {
      const ref = await analyzeVideo(args.compare, { ...o, output: args.output ? join(args.output, 'reference') : undefined });
      cmp = { reference: ref, differences: compareAnalyses(r, ref) };
    }
    if (args.json) return console.log(JSON.stringify(cmp ? { ...r, compare: cmp } : r, null, 2));
    console.log(formatAnalysis(r).replace(/\n$/, ''));
    if (cmp) console.log(['', `## Yours vs ${basename(args.compare)}`, ...cmp.differences.map((d) => '- ' + d), `(reference report: ${shortPath(cmp.reference.files.md)})`].join('\n'));
    console.log(`\nreport: ${shortPath(r.files.md)}${r.files.sheet ? `\nlook at: ${shortPath(r.files.sheet)} and ${shortPath(r.files.shots)}` : ''}${r.strips && r.strips.length ? `\nstrips: ${r.strips.map((x) => shortPath(x.file)).join(', ')}` : ''}`);
  } catch (e) { fail(e, args); }
}

async function cmdBundle(args) {
  const { bundle } = await import('./bundle.js');
  try {
    const r = bundle(inputOf(args), { output: args.output, data: loadData(args) });
    if (args.json) return console.log(JSON.stringify(r, null, 2));
    console.log(`Standalone page: ${shortPath(r.page)} (${r.files} asset file${r.files === 1 ? '' : 's'} copied)\nPlayer demo:     ${shortPath(r.player)}\nEmbed anywhere:  <script src="gm-player.js"></script> <gm-player src="${relative(r.outDir, r.page).split('\\').join('/')}" controls></gm-player>\n(Open through a web server, not file://.)`);
    if (r.skipped.length) console.log(`Not copied (outside the project folder, or hidden like .env): ${r.skipped.map(shortPath).join(', ')}`);
  } catch (e) { fail(e, args); }
}

async function cmdDev(args) {
  const { dev } = await import('./dev.js');
  await dev(inputOf(args), { port: args.port ? +args.port : undefined, open: args.open, data: loadData(args) });
}

async function cmdInit(args) {
  const dir = resolve(args._[0] || '.');
  mkdirSync(dir, { recursive: true });
  const tpl = join(PKG_ROOT, 'templates', args.template || 'starter');
  if (!existsSync(tpl)) throw new Error('Template not found: ' + (args.template || 'starter'));
  copyDir(tpl, dir, args.force);
  installSkill(dir, true);
  console.log(`Created ${shortPath(dir) || '.'}/
  index.html                     your video (edit me)
  .claude/skills/givemotion/     how AI agents use givemotion (SKILL.md + references/), for Claude Code
  .agents/skills/givemotion/     the same pack for Codex
  AGENTS.md                      the loop and what to read, for other agents

Next:
  npx givemotion dev ${relative(process.cwd(), join(dir, 'index.html'))}      # preview
  npx givemotion check ${relative(process.cwd(), join(dir, 'index.html'))}    # find problems
  npx givemotion render ${relative(process.cwd(), join(dir, 'index.html'))} -o out/video.mp4`);
}
function copyDir(src, dst, force) {
  mkdirSync(dst, { recursive: true });
  for (const e of readdirSync(src)) {
    const s = join(src, e), d = join(dst, e);
    if (statSync(s).isDirectory()) copyDir(s, d, force);
    else if (!existsSync(d) || force) copyFileSync(s, d);
  }
}

function blockList() {
  const dir = join(PKG_ROOT, 'blocks');
  return readdirSync(dir).filter((f) => f.endsWith('.html')).map((f) => {
    const txt = readFileSync(join(dir, f), 'utf8');
    const meta = /<!--\s*block:\s*([\s\S]*?)-->/.exec(txt);
    let m = {};
    if (meta) for (const line of meta[1].split('\n')) { const i = line.indexOf(':'); if (i > 0) m[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
    return /** @type {{ name: string, file: string, description?: string, params?: string, usage?: string }} */ ({ name: f.replace(/\.html$/, ''), file: join(dir, f), ...m });
  });
}
async function cmdBlocks(args) {
  const list = blockList();
  if (args.json) return console.log(JSON.stringify(list.map(({ file, ...r }) => r), null, 2));
  console.log('Blocks (copy one with `givemotion add <name>`, then <gm-include src="blocks/<name>.html" …>):\n');
  for (const b of list) console.log(`  ${b.name.padEnd(18)} ${b.description || ''}${b.params ? '\n' + ' '.repeat(21) + 'params: ' + b.params : ''}`);
}
async function cmdAdd(args) {
  const names = args._;
  if (!names.length) { console.error('Usage: givemotion add <block> [more blocks] [--dir blocks]'); process.exitCode = 2; return; }
  const list = blockList();
  const dir = resolve(args.dir || 'blocks');
  mkdirSync(dir, { recursive: true });
  for (const n of names) {
    const b = list.find((x) => x.name === n);
    if (!b) { console.error(`No block "${n}". Run \`givemotion blocks\`.`); process.exitCode = 1; continue; }
    const dst = join(dir, `${n}.html`);
    copyFileSync(b.file, dst);
    console.log(`added ${relative(process.cwd(), dst)}`);
    if (b.usage) console.log(`  use: ${b.usage}`);
  }
}

// The skill pack: skills/givemotion/ (SKILL.md + references/). Installed whole, so the links in SKILL.md resolve.
const SKILL_SRC = join(PKG_ROOT, 'skills', 'givemotion');
const SKILL_DIRS = [['.claude', 'skills', 'givemotion'], ['.agents', 'skills', 'givemotion']]; // Claude Code, Codex
const AGENTS_START = '<!-- givemotion:start -->', AGENTS_END = '<!-- givemotion:end -->';

function listFiles(dir, base = dir) {
  const out = [];
  for (const e of readdirSync(dir).sort()) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...listFiles(p, base));
    else out.push(relative(base, p));
  }
  return out;
}
// metadata.version in a SKILL.md frontmatter (null for installs from before versions)
function skillVersion(text) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const m = fm && /^\s+version:\s*["']?([^"'\s]+)["']?\s*$/m.exec(fm[1]);
  return m ? m[1] : null;
}
const stampVersion = (text) => text.replace(/^(\s+version:\s*)["']?[^"'\n]*["']?/m, `$1"${pkg.version}"`);

// The section for a project's AGENTS.md (Cursor, Codex and other agents that read it): the loop and the
// recipe and reference tables of SKILL.md, pointing at the installed files.
function agentsSection() {
  const skill = readFileSync(join(SKILL_SRC, 'SKILL.md'), 'utf8');
  const i = skill.indexOf('## Technique recipes');
  const table = (i >= 0 ? skill.slice(i) : '').replace(/^## Technique recipes.*$/m, '## What to read: technique recipes').replace(/`references\//g, '`.agents/skills/givemotion/references/').trim();
  return `${AGENTS_START}
# Videos with givemotion

Videos in this folder are made with givemotion (HTML + CSS + JS in, MP4 out). Before writing or editing a composition, read
\`.agents/skills/givemotion/SKILL.md\` (the same pack is in \`.claude/skills/givemotion/\`). Paths below are relative to this folder.

Loop: plan a shot list (time, what is on screen, camera, transition per scene) → write the \`.html\` →
\`npx givemotion check video.html\` (fix every error) → \`npx givemotion snapshot video.html\` (open \`snapshots/sheet.png\` and look) →
\`npx givemotion render video.html -o out/video.mp4\`.

${table}
${AGENTS_END}
`;
}
function writeAgents(dir) {
  const file = join(dir, 'AGENTS.md'), section = agentsSection();
  if (!existsSync(file)) { writeFileSync(file, section); return 'wrote'; }
  const cur = readFileSync(file, 'utf8');
  const a = cur.indexOf(AGENTS_START), b = cur.indexOf(AGENTS_END);
  if (a >= 0 && b > a) { writeFileSync(file, cur.slice(0, a) + section.trimEnd() + cur.slice(b + AGENTS_END.length)); return 'updated'; }
  // the short pointer older versions wrote: replace it
  if (cur.startsWith('# Video projects in this folder') && cur.length < 600) { writeFileSync(file, section); return 'updated'; }
  writeFileSync(file, cur.replace(/\s*$/, '\n\n') + section);
  return 'added a givemotion section to';
}
function installSkill(dir, quiet) {
  const files = listFiles(SKILL_SRC);
  const targets = SKILL_DIRS.map((parts) => join(dir, ...parts));
  for (const t of targets) {
    // replace an earlier install of this pack, so files dropped from the pack do not linger
    const old = join(t, 'SKILL.md');
    if (existsSync(old) && /^name:\s*givemotion\s*$/m.test(readFileSync(old, 'utf8'))) rmSync(t, { recursive: true, force: true });
    for (const f of files) {
      const d = join(t, f);
      mkdirSync(dirname(d), { recursive: true });
      if (f === 'SKILL.md') writeFileSync(d, stampVersion(readFileSync(join(SKILL_SRC, f), 'utf8')));
      else copyFileSync(join(SKILL_SRC, f), d);
    }
  }
  const how = writeAgents(dir);
  if (!quiet) console.log(`installed the givemotion skill ${pkg.version} (${files.length} files) to\n${targets.map((t) => '  ' + (shortPath(t) || '.') + '/').join('\n')}\nand ${how} ${shortPath(join(dir, 'AGENTS.md'))}`);
  return { files, targets };
}
async function cmdSkill(args) { installSkill(resolve(args._[0] || '.'), false); }

// Installed copies of the pack under these folders: [{ dir, version }]
function installedSkills(dirs) {
  const found = [];
  for (const base of dirs) for (const parts of [...SKILL_DIRS, ['.codex', 'skills', 'givemotion']]) {
    const f = join(base, ...parts, 'SKILL.md');
    if (existsSync(f)) { try { found.push({ dir: dirname(f), version: skillVersion(readFileSync(f, 'utf8')) }); } catch (e) {} }
  }
  return found;
}
// One line for `check` when the nearest installed pack (from the composition's folder up) is from another version.
function staleSkillNote(fromDir) {
  for (let d = resolve(fromDir); ; d = dirname(d)) {
    const s = installedSkills([d]);
    if (s.length) {
      const old = s.find((x) => x.version !== pkg.version);
      return old ? `note: the givemotion skill in ${shortPath(old.dir)} is ${old.version ? 'version ' + old.version : 'from an older version'}, the engine is ${pkg.version}: run \`npx givemotion skill ${shortPath(d) || '.'}\` to update it.` : null;
    }
    if (dirname(d) === d || d === homedir()) return null;
  }
}

async function cmdInstall() {
  const { installChrome } = await import('./browser.js');
  await installChrome({ log: (s) => console.error(s) });
}

async function cmdDoctor() {
  const { findChrome, chromeVersion, CACHE_DIR } = await import('./browser.js');
  const { ffmpegInfo } = await import('./ffmpeg.js');
  const c = findChrome();
  console.log(`node        ${process.version}`);
  console.log(`chrome      ${c ? `${c.path} (${c.kind === 'shell' ? 'headless shell: fast frame capture' : 'regular Chrome: screenshot capture'}) ${chromeVersion(c.path) || ''}` : 'not found → run `npx givemotion install`'}`);
  const f = ffmpegInfo();
  console.log(`ffmpeg      ${f ? f.version + '  encoders: ' + Object.entries(f.encoders).filter(([, v]) => v).map(([k]) => k).join(', ') : 'not found → install ffmpeg (brew/apt/winget) or set GIVEMOTION_FFMPEG'}`);
  if (f) {
    // Which video encoder a render uses here: the GPU one on a Mac once it has shown it encodes reproducibly
    const { wantsHardware, encoderPlan, encoderIsReproducible } = await import('./ffmpeg.js');
    const want = wantsHardware({ format: 'mp4', info: f });
    const ok = want === 'auto' && encoderIsReproducible(encoderPlan({ format: 'mp4', info: f, hardware: true }), f, { cacheFile: join(CACHE_DIR, 'hardware-encoders.json') });
    console.log(`encoder     ${ok ? 'GPU (VideoToolbox), checked: same bytes every time (--no-hardware to turn off)' : want === 'auto' ? 'software (x264): VideoToolbox did not encode the same bytes twice here' : process.platform === 'darwin' ? 'software (x264): this ffmpeg has no VideoToolbox encoder' : 'software (x264); --hardware uses NVENC/VideoToolbox when available'}`);
  }
  console.log(`cache       ${CACHE_DIR}`);
  // the AI skill pack installed in this project (or for the user) should match this engine
  const skills = installedSkills([...new Set([process.cwd(), homedir()])]);
  if (!skills.length) console.log('skill       not installed here → `npx givemotion skill` (or `npx givemotion init`)');
  for (const k of skills) {
    const same = k.version === pkg.version, here = !relative(process.cwd(), k.dir).startsWith('..');
    console.log(`skill       ${k.version || 'unversioned'}  ${shortPath(k.dir)}  ${same ? '(same as the engine)' : `⚠ the engine is ${pkg.version}: run \`npx givemotion skill${here ? '' : ' ' + dirname(dirname(dirname(k.dir)))}\` to update it`}`);
  }
  if (!c || !f) process.exitCode = 1;
}

async function cmdBench(args) {
  const { bench } = await import('./bench.js');
  await bench(args._[0], { workers: args.workers ? +args.workers : undefined, json: args.json, chrome: args.chrome });
}

async function cmdClean() {
  const { CACHE_DIR } = await import('./browser.js');
  const { rmSync } = await import('node:fs');
  rmSync(join(CACHE_DIR, 'frames'), { recursive: true, force: true });
  console.log(`removed ${join(CACHE_DIR, 'frames')}`);
}

function shortPath(p) { const r = relative(process.cwd(), p); return r && !r.startsWith('..') ? r : p; }

function fail(e, args) {
  if (args && args.json) console.log(JSON.stringify({ ok: false, error: e.message, issues: e.issues || undefined }, null, 2));
  else console.error(`✖ ${e.message}`);
  if (process.env.GIVEMOTION_DEBUG) console.error(e.stack);
  process.exitCode = 1;
}

main().catch((e) => fail(e));
