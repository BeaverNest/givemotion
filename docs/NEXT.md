# Next steps (open work)

Take one task, do it, then remove it from this file (or update it). Keep this list current.

**Several sessions may work at the same time.** Each task below says which files it touches. Work on a branch
named after the task (`git checkout -b task/anchors`), pull `main` and run `npm test` before merging, and
merge often. If two tasks touch the same file, keep the changes small and merge the first one before starting the
second. Do not reformat files you are not changing.

## Open: macOS renders differ under load (found 2026-11-02)

Touches `src/browser.js`, `src/render.js`, `src/runtime/runtime.js`. With screenshot capture (macOS), Chrome runs on
the real clock and keeps per-layer raster state (the raster scale of a layer whose scale keeps changing, and text's raster
phase for ~1 s after a move). On a busy machine that state differs between renders. Repro: a comparison page (a grid of
playing videos with a scoreboard; kept locally). Its tiles have a `scale: 0.94` entrance and its rows slide in.
3–5 of 9 renders under load (3 at once) differ from one rendered alone. Without the scale tween it's 0 of 9.
- Tried, not merged: at each seek the runtime lists the elements whose scale changed and the moved elements with text,
  and the render hides their parents' content for one drawn frame. 0 of 12 differ, at +8% (comparison page) and
  +14–18% (data-story) render time, but it breaks the features test "idle enter/exit … 1 worker equals 3". Hiding a
  parent recreates its siblings' layers too, which gives them new real-time history. Hiding only the element itself
  passes that test, but 8 of 12 still differ.
- Also seen 2026-11-02 on a quiet machine, with no scale tween: two renders of the effort-comparison page (a 2x2 grid of
  four playing videos, tiles entering with opacity + y) differed in frames 13-359, invisibly (lowest PSNR 44.8 dB);
  the rest of the 120 s matched. So it is not only load + scale; layers showing video frames are a second suspect.
- Next idea: a virtual clock on macOS (so Chrome draws only when the render asks), or a way to drop exactly one
  element's layer. `--run-all-compositor-stages-before-draw` breaks screenshot capture.

## Open: heavy 3D pages render slowly without a GPU (found 2026-11-05, partly fixed 2026-11-06)

Touches `src/render.js`, `src/browser.js`. In an agent round (`docs/experiments/2026-11-agent-rounds.md`)
givemotion's maker made a `preserve-3d` world of 24 cards (16000 px wide) with blurred layers. On 4 cores with no GPU it
rendered in 331 s with the headless shell, about twice as long as the reference tools took for the same brief.
Fixed since: the camera no longer makes Chrome raster a zoomed-out 3D world at full size (perspective / zoom instead of
scale3d; the grid section went from 23 s to 17 s per 15 frames), and `check` draws its pictures at half scale (102 s →
30 s on this page). Still open: measure where a heavy frame's time goes (layer count, raster vs composite), as in
`docs/experiments/2026-10-t7-speed.md`. Repro: the round's page (kept locally).

## Done 2026-11-06 (from the agent rounds)

- Path morphs: convex shapes blend support points (balanced, convex in-betweens), star-shaped ones blend radius by
  direction, overshoot grows the shape instead of denting it.
- Camera: 3D worlds keep their depth proportions at any zoom (the ancestor's perspective becomes P / zoom); a 1 s+ shot on
  the same subject rests instead of drifting with its neighbours (`blend: true` keeps the flow).
- `data-split="chars"` keeps graphemes (emoji sequences, marks) and words of joined scripts (Arabic…) whole.
- `check`: `mirrored-text`, a passing color on `low-contrast`, pictures at half scale.
- `snapshot --trail` (onion skin of a move), `data-sketch-boil` (hand-drawn line boil), `data-sketch-ink` (tapered,
  pressure-varied strokes that still draw on), `gm.path.stream` (items flowing along a path).
- No banding on dark gradients (frames captured at JPEG 98, not 92). Renders no longer fail with "Another frame is
  pending" on heavy pages (one beginFrame request at a time).
- `check`: `orphan-word`, `text-carried-over`, letters split into spans count as words (`short-hold`).
- Skill: plant the next set early, effects off the hero, holds inside their beat, audit each beat against the brief
  before rendering, mask rises fade in, prefer the engine's drawing tools, what `onFrame` draws gets no auto blur.
- Fair rounds on random briefs: `docs/experiments/2026-11-agent-rounds.md`.

## Decided: motion blur off by default (2026-11-06)

Touches `src/render.js` (`resolveMotionBlur`, `velocityBlur`, `AUTO_BLUR`). Across the agent rounds
(`docs/experiments/2026-11-agent-rounds.md`), blind judges flagged the automatic smear as ghosting, doubled text or
"a glowing blob" in four briefs and never credited it, even after capping it (0.3 em on text, 0.15 of the smaller side
on objects under 15% of the frame). It is now opt-in (`--motion-blur auto`). Open: a blind A/B on fast camera moves
only, where a smear may still help.

## Next from round 5 (2026-11-06)

- Done: `check` warns `stray-mark` for a small solid mark inside big text or just under its baseline (round 5 brief E).
- Done: `check` warns `no-expect` when the shot list has timed beats but nothing carries `data-expect` (brief G ran ~1.3 s late).
- Not done: brief G's overlap was canvas particles under a blurred word, which `check` cannot see as text; a rule there needs pixel-level detection.

## Ideas from the gap research (2026-11-06), not started

From the other tools' docs (features only, never their code) and our rounds. Where each belongs in brackets.
- [engine] A deterministic effects/grade pass: `data-fx="grain .04, vignette .3"` and a grade (exposure, contrast,
  temperature, `.cube`) on media or the whole frame, applied after capture (not Chrome filters, which double the cost).
  The looks themselves are taste and belong in brand kits.
- [engine] Motion expectations checked by `check` (`data-expect="in-by 2.4; in-frame; after #a"`).
- [engine] `gm.text.measure` / `gm.text.fit(el, {min, max})` and multi-line `data-fit` with a minimum size.
- [engine] Typed props (`type`, `min`, `max`, `color`) read by `dev`, `check` and `render --batch rows.json`.
- [engine, optional, local] `transcribe` writing the word-timed file givemotion already reads; loudness normalisation.
- [skill] Token cost: the maker read ~25k tokens of references against ~14k for the others; tighten the references the
  makers read most (camera, timeline, javascript, review, techniques).

## Done in the October 2026 session (for context)

- **Test harness** `bench/agents/` (briefs, maker/judge prompts, friction template, `round.js setup/render/sheets/add/pack/results`,
  frozen engine per round). How to run a round: `bench/agents/README.md`.
- **T2** round-3 examples vs the old ones: 7.9 vs 3.7 (`docs/experiments/2026-10-t2-examples.md`).
- **T3** hand-drawn: `data-sketch`, `gm.sketch`, `data-sketch-mark`, Caveat font, `write`, `gm.connect`, `gm.rect`,
  `fit: 'content'`, many check fixes. Three agent rounds; the last one beat the no-tools baseline on every judge
  (7.6 vs 6.7) and the versions made with another framework were behind both (`docs/experiments/2026-10-t3-hand-drawn.md`).
- **T4** renders keep fixed parts with fingerprints; only changed parts re-render, byte-identical to a full render.
- **T5** `givemotion analyze` (cuts, transitions, camera, pacing, palette, beat sync, sheets, `--compare`).
- **T6** `gm.connect`, `gm.rect`, `data-safe-zone` / `unsafe-zone`, `gm.log`, `hideBefore`, `snapshot --grid`, `captions` command.
- **T7** speed study (`docs/experiments/2026-10-t7-speed.md`): time is mostly software compositing; fixed an encoder stall
  and a determinism bug (Chrome partial raster).
- **N2** labels that stay with their shapes: `data-anchor="#server bottom 12"` (HTML and SVG text, follows timeline/travel/
  camera, chains), `data-sketch-mark-padding`, `gm.path.travel(el, gm.connect(...))` rides a live arrow. Not yet tried by
  a fresh agent round: the next hand-drawn round should check that makers use it and that moving a part is one edit.
- **N1** round 8, all 9 briefs x 2 runs, 2 judges each: 7.1 average, no video under 6 (`docs/experiments/2026-10-r8.md`).
  ~20 fixes from the friction logs and judge notes: code-window marks, `zoom-through`, `gm.burst` layering in camera
  worlds, a frame-start tween glitch, `fromTo` + keyframes, pop-in `fit`, many `check` false positives (SVG text,
  occluded lines, fades/scrims), new `camera-late`, `ghost-overlap`, `data-pulse`, beat `data-cuts`, shot `overview`.
- Also: tests no longer hang, camera shots at elements that appear later frame correctly, `empty-frame` and
  `text-over-line` checks, script error lines map to the file you wrote.

---

## After round 10
- The r10 agent branches (maker-friction fixes, cheaper motion blur, a determinism fix, check fixes) were merged on
  2026-10-24. Motion blur stays opt-in (`--motion-blur auto`); turning it on by default still needs it to meet quality at <25% cost.
- The examples with music (code-explainer, product-promo, vertical-short, coffee-promo) were removed before open-sourcing
  (the repo ships no audio). New examples with sound need music whose license is clear (e.g. generated by a script in the repo).
- Open question from r10: natural motion is not visible to judges and `analyze --motion` ranks it below classic; makers override defaults with explicit ease/duration. Diagnose (motion or metric), and find a judge method that can see motion.

## Open-source pass and embedding feedback (2026-10-27)
- Done: security fixes (preview page, bundle, data escaping, links, media paths), `captions` works again, per-element
  pacing checks (`short-hold`, `cut-exit`, `sliver-start`, `stepped-move`, `contents-no-box`), text on the timeline,
  `onFrame(sel, (local, info, el))`, `--cache-dir`, `--progress json`, fractional `--scale`, and Chrome's tile memory
  raised so 4K frames with many composited layers draw every tile (blank or stale rectangles before).
- Done (see 2026-10-30 below): determinism of opacity + movement on text.
- Done 2026-10-29: steady text. Elements moved by an inline transform or by the page's own CSS animation / Web Animation get a tiny
  `rotate` (runtime `steadyText`), so their text lands at quarter pixels instead of stepping whole pixels (rms 2nd
  difference 0.64 → 0.02 px on a slow move, 0.15 → 0.02 on a camera drift). A plain `@keyframes` move is now also
  identical for 1 and N workers (before, a worker starting mid-video stepped while the first glided). Not covered: the engine's own `data-enter`/`data-exit` animations (the tilt broke their 1 == N match; they step like
  any composited layer, but entrances are short). SVG `<text>` moved by a tween is now tilted too
  (about its own middle, which tweens already set as its pivot; jitter 0.64 → 0.03 px). Not covered or not tried: SVG text
  moved by a CSS animation, elements shown smaller than ~0.35x, CSS `transition`s.
- Done 2026-10-30: determinism of entrances (opacity + move) and of CSS animations that move and scale. Chrome keeps a
  text layer's raster phase for about a second after a move; a worker that continued from the earlier part had it, one that
  started at a part did not. Every part start now drops the layers of animated elements that hold text
  (`resetPaint(true)` in `src/browser.js`), for fresh and continuing workers alike. Cost +5% on bench, +3% on data-story
  (the whole-page reset tried first cost 10% and 42%). Not covered: an animated layer with no text of its own that
  keeps state (none found).
- Done 2026-10-30: a peak limiter after the audio mix (two loud tracks hard-clipped 15% of samples). Quiet mixes stay
  within one 16-bit step; the 239-sample look-ahead is padded in and cut out, so length and timing are unchanged. The
  'unexplained 4633-level difference' was the lost last 239 samples (the limiter does not flush its look-ahead).
- Done 2026-10-29 (found by looking for edge cases, each with a test): the time zone is pinned to UTC, language to en-US,
  reduced-motion and dark mode off (a clock read 12:00 on one machine and 21:00 on another); smooth scrolling is instant
  (frames differed per run); `loading="lazy"` images no longer hang the render for 60 s; SVG SMIL animations follow the
  video clock (they sat still at a different place every run); `check` warns `font-unavailable` for a font that is neither
  loaded nor installed.
- Done 2026-10-30: `check` `layout-shift` (text going up and down because its line's height changes, like the caret
  bug seen in a React video) and the typewriter keeps the untyped text in the layout (no drift, no word jumping).
- Done 2026-10-30: the default worker count takes the frame size into account (~700 MB a worker at 1080p, ~1.5 GB at 4K).

## Reusable parts and brand kits (decided 2026-10-29, not started)
A real 90 s product demo (16 scenes, many rounds of edits) showed what agents hand-build when they need reuse. The agent
wrote its own build script to stitch scene files, put a `{{S}}` placeholder in every id because ids clashed across
scenes, kept a shared helpers file for camera and highlight functions, and kept scene starts in a separate JSON.
This is the reason people reach for React components; the answer is to have it in HTML (CLAUDE.md, "Authoring format").
- **Scoped parts.** Done 2026-10-30, opt-in: `<gm-include scope>` (`scopePart` in `src/server.js`) suffixes the ids a part
  declares, rewrites the `#id` names in its CSS and script strings, applies its `<style>` with `@scope` and suffixes
  its `@keyframes`. Tried by two fresh agents (see below); a part's own timeline is `gm.timeline('[data-gm-scope="{{scope}}"]')`.
- **Parts that bring behaviour.** A part's script runs with its own element and its own clip time, so a part is a
  component with params, style, timeline and helpers in one file.
- **Brand kits.** Done 2026-10-30 as a convention, no new engine feature: a folder (tokens in `kit.css`, fonts, scoped parts,
  `motion.js` helpers) linked into each project with `ln -s` (symlinks are followed and a kit change invalidates the
  parts); in `data-templates.md`. A `data-kit` option was not added: it would need support in the server, the part
  fingerprints and `bundle` for what a link already does. Taste stays in the kit, never in engine defaults.
- **Scene assembly in the page.** Done 2026-10-30: a scene file included in a `data-sequence` is the sequence's child
  (`unwrapSceneIncludes` in the runtime). Scene starts from word times: `<html data-words>` and `data-cuts="0 @word …"` (done 2026-10-30).
- **Highlight primitive.** Done 2026-10-30: `data-anchor="#x fit 6"` (the element takes the target's box every frame) and
  `blocks/highlight.html` (wash, ring, underline, glow). Not tried by a fresh agent; the look to use is the brand's (kit).
- Fifth agent test (2026-10-30, data explainer): fixed from it: numeric chart labels ('2020') were read as indices,
  `gm.chart.line` `series` (several lines on one scale, labels once, end names kept apart), `snapshot --at`. Its
  "opacity tween on a data-point callout does nothing" did not reproduce (likely the label bug: the callout was unplaced).
- Fourth agent test (2026-10-30, vertical short): fixed from it: `word-repeated` (a bare @word said twice silently took
  the first), camera fit takes the longest rest (an exit at the end of a hold moved the framing), cursor show="auto"
  leaves during waits of 3 s+, `enter="none"` on device blocks (phone, browser-window, code-window) and data-enter="none",
  captions `fit="true"` (one line, shrunk when too wide).
- Third agent test (2026-10-30, UI product demo with voice-timed captions): fixed from it: cursor `times` take words,
  block styles sit in a cascade layer (the page's CSS always restyles a block), captions read the page transcript and
  take `color`/`shadow`, the CLI warns about options a command does not read (`snapshot --at`), a morph into a scene that
  paints the frame no longer fades the old scene piece by piece (an app showed through a toast), low-contrast judges
  text on its own pill against the pill and waits until moving text rests, and `camera-zoom-high` warns when a fit zooms
  past 4x. Its "fit frames a later element at its from() state" did not reproduce.
- Second agent test (2026-10-30, one Opus agent, three voice-timed videos from transcripts): word times, the
  highlight block, the kit and scene files all used; a stretched transcript moved every cut with no code change. Fixed
  from it: @word inside a scene was added to the scene's start (now always video time, also in data-enter/data-exit),
  a scene file calling gm.timing() stayed wrapped (provisional build now reports nothing and plain wrappers are marked
  by the server), and a rounded built-in font (Nunito). Its short-hold report on a word pop did not reproduce.
- First agent test of these (2026-10-30, one Opus agent, a two-video series): the kit, scene files, scoped parts and
  `fit` all worked from the docs (398 lines for the kit and two videos, each rendered in ~3.7 s). It found and we fixed:
  a CSS-hidden `fromTo` shown early when the sequence has a morph pair, a false `empty-start` (a shape with no text),
  the morph's straight flight (now an arc in natural motion), `timeline-no-target` not naming the selector of a list,
  and the include-path rule (relative to the containing file) missing from the docs. Not tried: three videos, word-time
  scene starts, the stock `highlight` block (the agent built its own on `fit`), a second agent for variance.
- Test: fresh Opus agents get a three-video series brief with one brand; measure how much they reuse and whether
  they still write build scripts. Files: `src/server.js` (includes), `src/runtime/runtime.js`, skill pack.

## README claims that need data (updated 2026-11-06)
The README no longer compares givemotion with named tools (see the independence policy in CONTRIBUTING.md). Still open:
- Publish the agent-test method and a harness that runs givemotion on anyone's briefs (no third-party tools in it).
- Benchmark render speed on an Apple Silicon Mac; no Mac speed claim until then.

## Type checking (started 2026-10-27)
`npm run typecheck` is clean with `strict: false`. Next, one flag at a time, file by file, without behaviour changes:
`strictNullChecks` (most useful; start with `src/render.js`, `src/check.js`, `src/server.js`), then `noImplicitAny`
for exported functions. Types for `window.gm` (the composition API agents write against) would also let `check` or an
editor flag a misspelled `gm.timline()`; today `gm` is `any` (`typings/env.d.ts`).

## N7. Natural, real-world motion (Leo's request; start here)
**Status 2026-10-30: mostly built.** `gm.motion` is 'natural' by default (physical easing, operator camera that blends
shots, arcs, natural exits), `check` has `camera-stop` and `fast-no-blur`, and `--motion-blur auto` exists. Still open:
motion blur on by default (done 2026-10-30; elements that grow or shrink in a frame are not smeared, because a filter
on a layer whose scale changes is rastered at a scale Chrome picks by timing: 4 of 30 loaded runs differed, 0 of 24 after; auto costs 0-3% on bench and data-story and its smear has no steps;
classic stays sharp; the breathing drift was already there), a smoothness number in `analyze`, and the blind-judge comparison of old vs new motion.
The list below is the original plan; check the code before building any item.

Videos still move like software: every move eases from a dead stop to a dead stop, consecutive moves and camera shots
brake to zero between them, a `follow` shot locks rigidly onto its target, and everything uses the same bezier
curves (`out-expo` entrances, `in-out-cubic` camera, `power1.out` tweens). The tools for more natural motion exist
but are opt-in, and agents don't use them: in round 8, `data-parallax` 0 of 18 videos, `--motion-blur` 0 of 18,
springs/bouncy 5 of 18. **The lever is defaults, not new options.** Make natural motion the default, keep one switch
to get today's motion back (`<html data-motion="classic">` or similar), and keep every frame a pure function of time
(1 worker == N workers, byte for byte). In priority order:

1. **Motion blur on by default, adaptive.** Real cameras blur fast motion; at 30 fps without it fast moves strobe.
   Today `--motion-blur 8` renders every frame 8 times, so nobody uses it. The runtime knows what moves and how fast
   (timeline values, camera, travel; or the difference between two sub-frame captures): take extra sub-frame samples
   only for frames where something moves faster than ~N px/frame, scaled by speed (2-8 samples). Measure the cost on
   the round-8 compositions first; this decides the default. (`src/render.js` capture loop, `src/runtime/*`.)
2. **A camera that moves like an operator** (`src/runtime/motion.js`, Camera):
   - consecutive shots blend with continuous velocity (a spline through the shot keys; ease only at the start and end
     of a run of moves), so the camera does not stop dead between shots;
   - `follow` with lag and inertia (the camera trails the target and settles), computed as a smoothing of the target's
     path over the last ~0.3-0.6 s, sampled at fixed sub-steps from the time alone (no frame-to-frame state);
   - a tiny seeded "breathing" drift on held shots (on by default, very small), and a slight overshoot-and-settle on
     fast zooms.
3. **Physical easing as the default** (`src/runtime/runtime.js` easing, `motion.js` Timeline):
   - entrances and moves get mass: critically damped or slightly underdamped springs (pure functions of time) instead
     of fixed beziers, unless an ease is given;
   - when no duration is given, duration scales with distance and size (bigger moves take a bit longer, not linearly);
   - back-to-back tweens on the same property carry their velocity through instead of stopping between them.
4. **Arcs and follow-through:** `gm.fly` and x/y moves travel on a slight arc by default (`arc: 0` to turn off); things
   that land settle (a small overshoot or squash); staggers get a small seeded variation in timing so a row of cards
   does not move like a machine.
5. **Depth by default:** in camera worlds, background layers get mild automatic parallax; shadows grow and soften when
   an element lifts or scales up; optional depth blur on far layers during camera moves.
6. **`check` warnings for robotic motion:** a camera that stops dead between consecutive shots; fast moves without
   blur (displacement per frame over a threshold); one easing curve used for everything; long straight-line moves.

**How to measure it** (the 2 fps contact sheets the judges use cannot show smoothness):
- Re-render the 18 round-8 compositions (`bench/agents/runs/r8/*/video.html` if still present, else make new ones)
  with old and new defaults, and have blind judges compare short clips or 10 fps strips of the key moves: "which
  feels more natural / more like real motion design".
- Add a smoothness number to `analyze` or `inspect`: stop-and-go count between moves, jerk (change of acceleration)
  of the camera and of moving elements, motion-blur coverage of fast frames.
- Render time before/after (motion blur is the expensive part).
Files: `src/render.js`, `src/runtime/motion.js`, `src/runtime/runtime.js`, `src/check.js`, `src/analyze.js`, SKILL.md
(a short "motion principles" paragraph: anticipation, follow-through, arcs, ease out on entrances, ease in on exits).

## N8. Token cost for agents (measure and lower it)
Measured in agent rounds, givemotion makers write a median ~29k output tokens per video but read a lot of
context (median ~2.6M tokens processed, almost all cached), from the agent docs kept in context every turn,
the `check`/`snapshot` output and contact-sheet images, and many turns. At list prices that is roughly 10-20%
more per video (cache reads are cheap; this is an estimate, not a bill). They also made fewer visible errors, and
renders cost half the CPU time. Ideas, measured with `bench/agents` (tokens per video at the same quality):
- `SKILL.md` is ~54 KB (~13.5k tokens) and growing: a short core (~15 KB: the composition format, the top tools, the
  check loop) plus topic files read on demand (camera, charts, hand-drawn, audio, blocks), linked from the core.
- terser `check` output (one line per issue, details on request), smaller snapshot sheets by default, `snapshot --times`
  recipes so agents look at fewer images.
- count tokens per maker in `round.js results` (the agent transcripts have the usage) so every round reports it.

## N6. Open items from round 8 (each one came up in 2+ friction logs or judge notes)
- ~~Live line chart~~ done (`task/live-chart`): `gm.chart.line` in `src/runtime/chart.js` (head element, `data-point` callouts, `data-chart-text`, holds, segment colors, `rescale`, `overview`, `timeOf`/`valueAt`/`pointAt`); `line-chart` block built on it; SKILL recipe. Not yet tried by a fresh data-story maker.
- Done: **`gm.connect` labels**: `label: { at, side, offset }` placed on the geometric line, box clears the line; `from: 'top 0.25'`, corners, `fromAt`/`toAt` (`src/runtime/sketch.js`).
- Done: **Cursor block**: `times="video: …"`/`"beats: …"`/`"bars: …"`, `show="auto"`, lands through any camera zoom with no wrapper size (`blocks/cursor.html`).
- Done: **Morph** between different shapes or texts: a pair whose content differs (text, SVG shapes, image src) hands
  over in flight (old out by 45%, new in from 30% to 75%, inline opacity so 1 worker == N stays exact); same-content
  pairs keep the old look. Inline `<span>` pairs now move at all (they were stuck: translate does nothing on inline
  boxes; that was the data-story "48,000" bug). `check`: ghost-overlap skips a morph pair and reads `filter: opacity()`.
  Open: a blur at the crossing looked better, but a filter on a scaled element is not byte-exact across workers.
- Done: **Fly**: `gm.fly(el, { from, at, duration, ease, size })` / `tl.fly(el, vars, pos)`, a fromTo of x/y/scaleX/
  scaleY measured once at load where both boxes rest (animations taken off, hidden clips shown for the measure).
  `check` no longer reports text covered by something flying over it, and text-overlap / text-overflows-box need
  0.15 s (a tween's first frame was reported). **Ride**: no new API; SKILL.md has the recipe (one leg per vehicle,
  a package copy per vehicle with `data-anchor`, swap at the hand-over). Done 2026-10-30: travel stops by waypoint
  (`stops: [[t, '#dock']]`).
- **Balance check**: judges marked layouts that leave most of the frame empty or crowd the top half (5 notes). Tried:
  the centre of the picture's edges per half second did not match the judges at all (year-recap-2, "crowds the top
  left", scored balanced; code-explainer-2, judged polished, scored off-centre 16 times), so nothing was added. A
  better signal may be the boxes of text and shapes from the DOM, weighted by size. Files: `src/check.js`.
- Run a shorter round (3-4 briefs, 2 runs) after these to see whether the "errors" score (6.9, the lowest) moves.

## N3. Partial re-render inside one long scene (first version done; follow-ups)
Done: inside a top-level clip, "late" elements get their own print plus the time T before which they cannot change a
pixel, so an edit to something that appears at 40 s keeps 0-40 s (`src/parts.js`, called from `dependencyPrints` in
`src/render.js`; tests "render keeps parts inside one long scene" in `test/features.test.js`). Late = a nested clip
(display:none before its start), or an element held at opacity 0 / visibility hidden by its own delayed entrance that
is out of the flow (absolute/fixed) or an SVG shape; and nothing names it (no script string, selector, attribute or
url(#id); no named SVG group around it), no CSS sibling/:has()/counter/anchor rules, no script walks the page. Every
print also covers the live HTML after the runtime set it up, which also fixes an older hole: a sketched shape added in
one scene moved the seeds of the shapes in later scenes, and those parts were wrongly reused. Reveal presets (`write`,
`draw`, wipes, `iris`, masks, `grow`) now hide fully before they start (they showed a sliver before).
Follow-ups:
- CSS animations the runtime has not taken over at load (`animation: pop-in … both` in a later scene) do not count as
  hiding (their state at load depends on Chrome's clock). Could be read from the keyframes and the clip start instead.
- `data-split` + `data-stagger` text (each piece has its own entrance) is not late; nor is anything inside a block whose
  script uses `document`/`window` (cursor, lottie), and any script that walks the page (`children`, `getBBox`,
  `scrollWidth`, text reads) turns the rule off (`render` result: `parts.lateOff` says why). Blocks could declare their
  scope instead.
- An edit that changes what `fit: 'content'` measures redoes everything (correct, but a shot list could be finer).

## N4. Render speed
See `docs/experiments/2026-10-t7-speed.md`. Done: `bench` prints layers, layer area and render passes per frame;
idle enter/exit animations and finished from-only CSS animations (`fade-up ... both`) no longer keep elements on
layers (whole scenes with filter passes); still blur blobs bake to an image. Compositor draw -13..-28% on the
examples, -34% with still blobs. Next: wall time on a quiet machine, a GPU machine and 8-16 cores; the second render
pass most frames take; cheaper gradient-bg/grid-bg (their cost is part of their look); raster cost of an SVG with
`drop-shadow` that redraws (data-story). Files: `src/browser.js`, `src/render.js`, `src/bench.js`, blocks.
Machine budget (2026-10-31, `src/machine.js`): several projects rendering at once froze a 24 GB Mac (each render
took 12 browsers as if alone; 3 renders: 222 processes, 17.8 GB, 22.2 s). Now all givemotion processes share one
budget (performance cores, half the memory, free memory now) through `<cache>/run/<pid>.json`, split evenly and
re-split between parts: 3 renders 6.4 GB, 19.0 s; 1 render 8 workers 8.9 s (12 workers was 10.3 s); x264 has 4
threads. Measured on an M4 Pro only: check on Linux whether every logical core helps (the cap there is all cores).
The 4 GB tile ceiling per browser is left as is (a ceiling, not used by normal pages; lowering it gives blank tiles).
Calls into the page (2026-11-01): `FramePage.evaluate` in screenshot mode (macOS) waited in 5 ms timer steps, so every
call cost ~6 ms (Chrome answers in ~0.1 ms); now it waits for the answer. A render seek went 5.7 → 1.9 ms. beginFrame
mode (Linux) still pumps a frame and sleeps 2 ms while it waits: measure there and shorten it if it costs as much.
`check` runs on several browsers: units of ~4 s of video, same report for any number (tested in beginFrame mode too).

## N5. `analyze` accuracy
Measured: `node bench/analyze/score.mjs` renders 13 videos with known scene changes (from `inspect`) and scores
`analyze`. Now: scene changes found 100% (tuning) / 90% (held-out), precision 0.95 / 0.77, transition type right
81% / 65% of found (was 64% / 69% found, 61% / 50% typed); 30 s 1080p analyzes in 6 s (was 18 s).
Results and the method: `docs/experiments/2026-10-analyze-accuracy.md`. Still open: see-through scenes whose content
enters during a wipe/iris (direction taken from the entrances), dip on a dark shared background (reads as fade), `zoom`
(reads as fade), flip/morph/clock, fast `gm.camera` pans and pull-outs over a world (read as push/zoom-out). Ideas:
a "see-through transition" model, OCR as an optional extra, per-minute summaries for long videos.
Files: `src/analyze.js`, `bench/analyze/`.

## Small known issues
- `text-covered` skips dimmed text (opacity < 0.5) and transitions; a moving element fully covering a settled label for
  ~1 s is not reported (fully covered text is treated as hidden). (`src/check.js`)
- A camera `float` makes labels at the frame edge flicker in and out of `text-offscreen`: correct (the float cuts them
  in those frames); the fix is to keep text further from the edge than the float's reach.
- Done 2026-10-30: the camera-zoom determinism case (fit shots, `pop` on `#b`) gives 0 of 180 differing frames for 1 vs 3
  workers since part starts drop animated layers.
