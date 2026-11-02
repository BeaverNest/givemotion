# givemotion, HyperFrames and Remotion: one hard brief, same agent (2026-11-02)

The same 20-second brief, made three times by Claude Opus 5.5 at effort medium: once with givemotion, once with
HyperFrames, once with Remotion. Each maker was a fresh, independent session that saw only its own tool's docs and
its own folder. Then six blind Opus judges scored the three videos, and one video plays all three in a 2x2 grid
(the fourth tile is the scoreboard) and zooms into each in turn.

<img src="../media/tools-showcase.gif" width="100%" alt="The FLUX opener made with givemotion, HyperFrames and Remotion, playing side by side in a 2x2 grid with a scoreboard tile">

One brief and one run per tool is a showcase, not a benchmark: a second run of the same maker would score
differently. Read the numbers with that in mind. The wider givemotion vs Remotion test (9 briefs, 2 runs each) is
[2026-10-vs-remotion.md](2026-10-vs-remotion.md).

## Results

| | givemotion | HyperFrames | Remotion |
|---|---|---|---|
| Judges' overall (1-10, mean of 6) | 7.5 | 6.2 | **7.7** |
| Average rank (of 3) | **1.5** | 3.0 | **1.5** |
| Judges' #1 picks | 3 of 6 | 0 of 6 | 3 of 6 |
| Tokens (input + cache + output) | 2.60M | 3.37M | **1.94M** |
| Output tokens (thinking included) | **58k** (33k) | 78k (49k) | 59k (36k) |
| Cost at API list prices | $2.87 | $3.44 | **$2.36** |
| Tool calls | 32 | 36 | **26** (4 of them refused by our sandbox, see below) |
| Minutes to a finished video | 12.2 | 14.8 | **12.1** |
| Code written (non-empty lines) | **446** | 1183 | 1017 |
| Render time, 20 s at 1080p, this Mac | 15.4 s | **11.1 s** | 50.6 s |

Judges' scores per dimension (mean of 6 judges, 1-10):

| | brief | spec | motion | craft | errors | overall |
|---|---|---|---|---|---|---|
| givemotion | **8.3** | **7.7** | 7.5 | **7.7** | **7.7** | 7.5 |
| HyperFrames | 7.5 | 7.0 | 6.8 | 6.3 | 6.7 | 6.2 |
| Remotion | **8.3** | 7.3 | **8.5** | 7.5 | 7.0 | **7.7** |

All three delivered exactly 20.0 s at 1920x1080 and 30 fps, used the palette, fonts and copy, and hit all five
beats in order. None needed a second try.

**In short:** givemotion and Remotion came out level on quality. Remotion won on motion and continuity, givemotion
on spec, craft and visible errors, and their average rank was the same. HyperFrames came third with every judge.
Remotion's maker was the cheapest in tokens and tool calls, givemotion's wrote the least code by far, and HyperFrames
rendered fastest on this machine while Remotion was 3-4x slower than both.

## The brief

"FLUX festival opener". Written for this round and tool-neutral: it says "video", never HTML or React. It asks for
many kinds of motion in 20 s, in one continuous piece with no hard cuts:

1. **0-3 s, the drop.** A #FF5A36 ball falls onto an invisible floor and bounces twice, lower each time, with real
   weight (squash on impact, stretch when fast); on the last landing, rings ripple out along the floor.
2. **3-6.5 s, the line.** The ball rolls off and becomes the tip of a pen that draws one long curve across the frame;
   the camera travels with the tip.
3. **6.5-11 s, three words.** `MOVE`, `BEND`, `FLOW` appear along the curve (Space Grotesk, bold, very large), each
   in a different way that acts out the word; the camera keeps moving between them.
4. **11-15 s, the numbers.** The camera pulls back and tilts: the curve is one line among many in a field seen in
   perspective. A grid of tiles flips over in a 3D wave and three numbers count up: `3 DAYS`, `48 ARTISTS`,
   `120 FILMS` (Bebas Neue numbers, small letter-spaced Inter labels).
5. **15-20 s, the title.** A #2EC4B6 circle grows out of the last number into a full-frame iris; `FLUX 2026` lands
   with energy and settles, `12–14 June · Lisbon` under it; hold at least 2 s.

Palette near-black #101014, off-white #F4EFE6, #FF5A36, #2EC4B6, no other hues. Must: everything eases or follows
physics, real depth in beats 2-4, readable text. Must not: hard cuts, slide fades, website layouts, emoji, extra words.
The full brief is `bench/agents/briefs-tools/showreel.md` in the local test harness.

## How it was run

- **Model.** Claude Opus 5.5, effort medium, for all three makers, through the Claude Agent SDK on a subscription
  login. No user settings, memory, CLAUDE.md, MCP servers or skills of our own: only Claude Code's built-in skills,
  the same for all three. Web search, web fetch and subagents were off. The three ran at the same time, each in its own
  folder; none could read another's folder (see the sandbox below), so no maker saw another tool's docs or work.
- **What each maker got.** The brief, the fonts as local files, and its own tool's best agent docs, at the latest
  release on 2 November 2026:
  - givemotion 0.1.2 (main at the start of the round): `SKILL.md`, its reference files and `blocks/`, and a `./gm`
    command running a frozen copy of the engine.
  - HyperFrames 0.8.230: a project made by `hyperframes init --example blank` (with its own `CLAUDE.md`), and the core
    agent skills `hyperframes skills update` installs (hyperframes, hyperframes-cli, hyperframes-registry, media-use),
    copied into the folder.
  - Remotion 4.0.539: a blank project with Remotion's official packages and its agent skills
    (`remotion-dev/skills` at the latest commit, `30d4553`, version 4.0.539).
- **Prompt.** The same short prompt shape for all three: read the brief and your tool's docs, work the way a normal
  user would, look at your frames and fix what you see, no tool-call or time limit, render `out/video.mp4`. The
  HyperFrames prompt also says there is no person to ask (its skill otherwise stops for the person to pick a
  storyline and approve a preview). All three could keep files their docs ask for (the HyperFrames maker wrote
  `SPEC.md` and `REVIEW.md`, as its skill says).
- **Sandbox.** File tools only inside the maker's folder; Bash ran plain shell commands, node, npx, npm and python,
  with paths inside the folder, and not commands that publish, log in, use a cloud or install skills. Four of
  Remotion's 26 tool calls were refused by mistakes in our rules (a `../` that stayed inside its folder, `find -exec`,
  a quoted sed pattern starting with `/` read as a path, and `perl -pi`). Each rule was fixed while the round ran, so
  later calls passed. Remotion's maker lost 4 tool calls and a few thousand tokens to this; the other two had no
  refusals.
- **Judges.** Six fresh Opus 5.5 sessions, each seeing the three videos unlabeled as contact sheets (one frame every
  0.5 s) and four motion strips each (the busiest 1-second stretches at 10 fps), with the brief. Each tool was A, B and
  C exactly twice across the six judges. Scores 1-10 for brief, spec, motion, craft, errors and overall, plus a ranking.
- **Render time.** Each final video rendered again by its own tool's command at default settings, after one untimed
  warm-up, one at a time, two passes (they agreed within 0.2 s): `givemotion render --no-cache`,
  `remotion render --bundle-cache=false`, `hyperframes render`. Apple M4 Pro (12 cores, GPU), macOS 26. Note the
  defaults differ: HyperFrames encodes at CRF 16 with Chrome on the Metal GPU; givemotion at CRF 18 with 8 workers and
  automatic motion blur on fast frames (40 of 600 here); Remotion at its default CRF 18. givemotion was 1.7x faster than
  HyperFrames on a 2-core Linux machine without a GPU in October (`benchmarks/vs-hyperframes`); on this Mac with a GPU
  HyperFrames was 1.4x faster.

## The three videos, beat by beat

All three makers built the same thing underneath: one 3D "camera world" driven by a single per-frame function
(givemotion's maker with `gm.onFrame`, HyperFrames' with a GSAP `onUpdate`, Remotion's with `useCurrentFrame`), plus
physics for the bounce. None used a ready-made camera or block from its tool for the main move.

**givemotion.** A glowing ball with clear squash and stretch and two sets of floor rings. The pen line glows, the
camera rides it, and dust drifts past in parallax. The words are the largest of the three and each one acts itself
out: MOVE springs up letter by letter, BEND lands flat and then bends onto the hump, FLOW is revealed by a moving
gradient mask. The camera whip-pans from word to word. The pull-back into a field of wavy lines is the most convincing
depth of the three. Weak spots: the tiles are dark grey on near-black, so the flip wave barely reads; FLOW's
coral-to-teal fill looks muddy while it arrives; the title holds still for the last 3 s (the brief asked for a calm
end, and one judge still called it static).

**HyperFrames.** The ball has a seam, so you see it roll and spin, a nice physical detail. MOVE, BEND and FLOW are
large and crisp, and the tile board is the brightest and clearest of the three (orange and teal tiles, cream number
cards). Weak spots: grey and teal out-of-focus dashes float through the line beat and read as artifacts to every
judge; the moves between words are fast whips onto curves that change shape, so it feels like separate shots; the
tile board looks like a game board; the DAYS card is cut by the frame just before the iris, and the title arrives with
little energy. Its maker's own review says beat 2 was its weakest.

**Remotion.** The most continuous: the pen writes the words as it goes, and when the camera pulls back, BEND and FLOW
are still lying on the curve inside the field, so the whole piece reads as one line. The tiles flip in a clear wave,
the iris grows out of the 0 of 120, and the 2026 digits arc in and bounce before settling. Weak spots: the ball and
the words are small for "very large", words get cut by the frame during camera moves, a stray teal squiggle trails
FLOW, the tiles are muddy brown-to-teal gradients, and the labels under the numbers are hard to read.

## My scores and feedback

I work on givemotion, so read this part as one opinion, and weigh the blind judges above it. Where I was unsure, I
scored against givemotion.

| | story and continuity | motion quality | look and craft | errors | process (tokens, calls, code) | render speed | overall |
|---|---|---|---|---|---|---|---|
| givemotion | 7 | 7.5 | 8 | 8 | 8 | 8 | **7.5** |
| HyperFrames | 6 | 6.5 | 6.5 | 6 | 6 | 9 | **6.5** |
| Remotion | 9 | 8 | 7 | 7 | 8.5 | 5 | **7.5** |

- **Remotion** made the best film: its maker thought in one line from start to end and kept it on screen, which is
  what the brief was really about. It also got there with the fewest tokens and calls, even after losing four calls to
  our sandbox. It wrote twice the code givemotion did and renders 3-4x slower, and its frames had more small mistakes.
- **givemotion** made the most polished frames with the least code (446 lines in one file) and the fewest visible
  mistakes, but its story is three good shots joined by whip-pans rather than one continuous line, and its numbers
  beat is too dark. It used about a third more tokens than Remotion (a known cost: the givemotion docs are long).
- **HyperFrames** followed every beat and has the clearest numbers board, and it is the fastest renderer here. Its
  maker spent the most tokens and time, partly on its skill's process (a spec and a review file), and the result had
  the most artifacts and the least continuity. Its docs are written around a person in the loop (pick a storyline,
  approve the preview, the desktop app), which fits less well when an agent works alone.

## What this means for givemotion

Sorted by where the fix belongs (CLAUDE.md, "How to handle feedback"):

- **Engine.** Rendering the comparison video showed a frame bug: with the default render (unchanged parts kept in
  `.gm-parts`, 60-frame parts), two renders of the same page could differ, and in one of them four
  `backdrop-filter` labels over video tiles came out as empty dark boxes for about 1.5 s. Renders with `--no-cache`
  were byte-identical every time, and the video in this round was made that way. This is being fixed on its own branch.
- **Skill.** The givemotion maker hand-built its camera with `gm.onFrame` instead of using givemotion's camera, path
  and travel tools, as all three makers did with their own tools. The skill should show how to build one continuous
  camera world (a follow-cam on a path, a pull-back) from the built-in parts, because that is where Remotion's maker
  got its edge: continuity. Low-contrast tiles (dark grey on near-black) are something `check` could flag.
- **Speed.** On a Mac with a GPU, HyperFrames rendered this video 1.4x faster than givemotion. givemotion's speed work so
  far was on Linux without a GPU; it is worth measuring where its time goes on macOS.

## Files

- Round folder (local, not in git): `bench/agents/runs/tools3/`: the three makers' folders, their full transcripts
  (`*.jsonl`) and stats, the sandbox rules (`sdk/guard.mjs`) and refusals, the judging packs and scores, and
  `compare/` (the comparison video `compare/out/compare.mp4`, 94.5 s, and its builder `build.mjs`).
- HyperFrames runs can now be set up by the harness: `round.js setup <round> --tools givemotion,remotion,hyperframes --lean`.
