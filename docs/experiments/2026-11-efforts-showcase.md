# Opus 5.5 at four effort levels: one illustrated brief (2026-11-02)

The same 20-second illustrated brief, a dog's morning walk, made four times with givemotion by Claude Opus 5.5:
once each at effort low, medium, high and xhigh. Each maker was a fresh, independent session with the same prompt,
the same docs and its own folder; only the effort setting differed. Then eight blind Opus judges scored the four
videos, and one video plays all four in a 2x2 grid, zooms into each in turn and ends on a scoreboard.

<img src="../media/efforts-showcase.gif" width="100%" alt="Biscuit's morning walk made by Claude Opus 5.5 at effort low, medium, high and xhigh with givemotion, playing side by side in a 2x2 grid, then a scoreboard">

One brief and one run per effort level is a showcase, not a benchmark: a second run at the same effort would score
differently, and medium and high are within that noise of each other. Read the numbers with that in mind.

## Results

| | low | medium | high | xhigh |
|---|---|---|---|---|
| Judges' overall (1-10, mean of 8) | 5.3 | 6.9 | 6.6 | **8.0** |
| Average rank (of 4) | 4.0 | 2.4 | 2.5 | **1.1** |
| Judges' #1 picks | 0 of 8 | 1 of 8 | 0 of 8 | **7 of 8** |
| Tokens (input + cache + output) | **0.59M** | 5.09M | 5.00M | 30.8M |
| Output tokens | **26k** | 87k | 104k | 259k |
| Cost at API list prices | **$1.15** | $4.06 | $4.43 | $14.46 |
| Tool calls | **13** | 39 | 34 | 110 |
| Minutes to a finished video | **5.3** | 16.8 | 20.3 | 52.7 |
| Code written (non-empty lines) | 386 | 699 | 855 | 969 |
| `check` / `snapshot` runs | 2 / 2 | 2 / 10 | 2 / 6 | 18 / 22 |
| Frame images it looked at | 4 | 14 | 11 | 32 |
| Render time, 20 s at 1080p, this Mac | 14.2 s | 12.3 s | **9.1 s** | 29.2 s |

Judges' scores per dimension (mean of 8 judges, 1-10):

| | brief | spec | motion | craft | errors | overall |
|---|---|---|---|---|---|---|
| low | 6.4 | 6.6 | 5.8 | 5.4 | 6.9 | 5.3 |
| medium | 7.8 | 6.8 | 7.5 | 7.3 | 5.9 | 6.9 |
| high | 7.3 | 6.8 | 7.0 | 6.6 | 6.4 | 6.6 |
| xhigh | **8.4** | **7.3** | **8.0** | **8.0** | **7.8** | **8.0** |

All four delivered exactly 20.0 s at 1920x1080 and 30 fps, used the fonts and the exact title, and hit all five
beats in order. None needed a second try.

How each judge ranked them:

| judge | 1st | 2nd | 3rd | 4th |
|---|---|---|---|---|
| 1 | xhigh | high | medium | low |
| 2 | medium | xhigh | high | low |
| 3 | xhigh | high | medium | low |
| 4 | xhigh | medium | high | low |
| 5 | xhigh | high | medium | low |
| 6 | xhigh | high | medium | low |
| 7 | xhigh | medium | high | low |
| 8 | xhigh | medium | high | low |

**In short:** xhigh made the best film by a clear margin (first for 7 of 8 judges, 8.0), and low the weakest
(last for all 8, 5.3). Medium and high came out level (6.9 and 6.6, each ahead of the other for 4 judges). The cost
does not climb evenly. Low used a ninth of medium's tokens. Medium and high used about the same. xhigh used six
times as many as either and took three times as long: $14.46 and 53 minutes against about $4 and 17-20 minutes. For this
brief, medium is the best value, and xhigh is worth it when the film matters more than the bill.

## The brief

"Biscuit's morning walk". Written for this round, tool-neutral, and character animation rather than kinetic type or
data: a flat, picture-book 2D short in which the dog is the star.

1. **0-3 s, waking up.** The sun rises behind the hills and the sky warms; a red door opens and Biscuit trots out,
   shakes (head, ears, body, tail, overlapping) and looks at the camera.
2. **3-9 s, the walk.** A real four-legged walk cycle (alternating gait, body bob, ears and tail following late,
   feet planted while they carry weight) with the camera travelling along and the town in parallax; something reacts
   to Biscuit (pigeons, a cat) and Biscuit reacts back.
3. **9-13 s, the chase.** A butterfly; the walk becomes a bounding gallop (body stretches and bunches) and the camera
   and parallax speed up.
4. **13-16 s, the leap.** Crouch, stretch over a puddle, squash on landing, the reflection follows, the water ripples.
5. **16-20 s, the rest.** A circle and a sit under a tree, tail wagging, the butterfly lands on its nose; title
   `Biscuit` (Caveat) with `a morning walk` (Inter, letter-spaced), held at least 2 s.

The palette is a small set of named colours (caramel dog, red collar, peach-to-blue sky, two greens, brick, cream,
dark ink), with at least three parallax layers and one consistent light. Everything has to be drawn by the maker: no
images or clip art. The full brief is `bench/agents/briefs-tools/walk.md` in the local test harness.

## How it was run

- **Model and effort.** Claude Opus 5.5 for all four, through the Claude Agent SDK on a subscription login, with
  `effort` set to `low`, `medium`, `high` or `xhigh`. Nothing else differed. Output tokens rose with the setting
  (26k, 87k, 104k, 259k), so each session ran at its level. No user settings, memory, CLAUDE.md, MCP
  servers or skills of our own. Web search, web fetch and subagents were off. The four ran at the same time, each in
  its own folder, and none could read another's.
- **What each maker got.** The brief, the fonts as local files, givemotion's agent docs (`SKILL.md`, its reference
  files and `blocks/`), and a `./gm` command running a frozen copy of the engine (main at `6be35ff`). The prompt was
  identical apart from the folder path (the same one as in [2026-11-tools-showcase.md](2026-11-tools-showcase.md)).
- **Sandbox.** The same rules as the three-tool round. Low, medium and high had no refusals. xhigh had three. `git`
  is blocked for every maker, so refusing it was correct. `set`, a harmless shell builtin our list did not include,
  was refused by mistake. A shell script it wrote to tile crops was refused under the existing no-`sh` rule. It
  worked around both with plain `ffmpeg` calls.
- **Judges.** Eight fresh Opus 5.5 sessions, each seeing the four videos unlabeled as contact sheets (one frame every
  0.5 s) and four motion strips each (the busiest 1-second stretches at 10 fps), with the brief. The order was a
  balanced design: every video was A, B, C and D exactly twice, and followed every other video equally often.
  Scores 1-10 for brief, spec, motion, craft, errors and overall, plus a ranking.
- **Render time.** Each final video rendered again with `givemotion render` at default settings after one untimed
  warm-up, one at a time, on an Apple M4 Pro (12 cores), macOS 26. One pass. xhigh's is slower because it blurs whole
  scenery layers with SVG filters while the camera is fast.

## The four videos

All four makers drew everything in SVG and drove the whole film from one per-frame function (`gm.onFrame`): the dog's
legs, the camera and the parallax are all computed from the time. None used a ready-made block for the character.
givemotion has no walk-cycle or character-rig tool, so each one wrote its own.

**low (5.3).** It has the best sunrise of the four: the sky really goes from peach to blue as the sun climbs, which
every judge noticed. It also has a clear cat-on-the-fence reaction and clean parallax layers. But it framed the whole
film as one wide shot, with the dog about a tenth of the frame's height. At that size the shake, the gait change and
the leap barely read, and the dog stops being the star. The town is small stamped houses, and the subtitle is tiny.
It read three docs, looked at four frame images, and finished in five minutes.

**medium (6.9).** A big, outlined, readable dog that trots out of a red door, pigeons that take off, a gallop that
clearly stretches and bunches, and a clean leap with a reflection and a splash. The film moves from the town into a
park. Weak points: the sky is already blue when the sun "rises". At about 5.8 s a pigeon flies across the dog's face
and reads for a moment as if it were in its mouth. In the title, the first letter of `a morning walk` sits on a tree's
dark outline. Every judge read that as the subtitle being clipped at the frame edge, which it is not, but it looks broken.

**high (6.6).** The most appealing dog drawing to some judges: chunky, round and expressive, with a nice turn toward
the camera before it sits. It also has a real puddle splash. But it put a thick black lamp post in the near
foreground layer, and it cuts across the frame and often across the dog for the first 8 seconds. All 8 judges called
it out. The opening is dim, the sitting pose reads as a round blob from behind, and the butterfly on the nose is too
small to see.

**xhigh (8.0).** The most finished world: chimney smoke, shuttered windows, a far layer of town, hedges, brick
gate posts. Biscuit bursts out of the door with a squash, the pigeons scatter and the dog looks up to follow them,
which is the clearest reaction of the four. The chase adds a directional blur to the scenery layers. The leap has a
crouch, a long stretch, a reflection and a splash. It ends with the butterfly clearly on the nose under a well-placed
title. Weak points: the blur smears the houses around 12 s while the near lamp post stays sharp, which looks backwards
(the nearer layer moves faster). The palette has slips (grey roofs, green doors and shutters, pink far houses). The
walk's body bob is small. It worked the review loop hardest by far: 18 `check` runs, 22 snapshots and 32 frame images
looked at, against 2, 2-10 and 4-14 for the others.

## My scores

From frames of all four: a sheet every 2 s, the walk (5-6 s at 10 fps), the leap (12.5-16.5 s), and the opening
and ending of each.

| | brief | motion | craft | overall |
|---|---|---|---|---|
| low | 6 | 5 | 5 | **5.0** |
| medium | 8 | 7.5 | 7 | **7.0** |
| high | 7 | 7 | 6.5 | **6.5** |
| xhigh | 8.5 | 8 | 8 | **8.0** |

I agree with the judges' order. Low's problem is one decision, a camera too wide for a character film, made early
and never revisited: it looked at four frames in total. Medium and high are a coin toss. Medium has the better
gallop and leap, and high has the better character but the lamp post. xhigh is the only one I would show as is.

## What it means for givemotion

Sorted by where the fix belongs (CLAUDE.md, "How to handle feedback"):

- **Skill.** The biggest quality gap came from framing, not from motion skill: low's dog is too small for the
  brief's "the dog is the star". General craft says the subject a shot is about should be large enough to read its
  action. The skill's review guide should say so, with a reason: look at the subject at the size the viewer will
  see it, not at the composition.
- **Skill.** High's foreground lamp post crossing the dog is a near-layer mistake any motion designer would avoid:
  keep thick foreground parallax objects out of the subject's path, or make them pass quickly. `check` already
  knows the camera and which elements move. A rule that flags a large opaque element covering a moving subject for
  more than a moment would have caught it.
- **Engine.** All four hand-built a four-legged walk cycle and a parallax camera in `gm.onFrame`. givemotion already
  has the parallax (`gm.camera` with `data-parallax` layers), and none of them used it, so the camera doc's
  side-scrolling case needs to be easier to find. Each one wrote its own walk cycle,
  though, and character animation is common in explainers. Whether a small rig tool belongs in the engine (limbs
  on pivots, a gait cycle you can time and blend from walk to gallop) is worth an agent test, not a guess.
- **Cost.** Effort is the biggest lever on what a video costs. On this brief, xhigh bought about one point of
  quality for 3.5x the money and 3x the time of medium. Low saved most of the cost but lost 1.6 points, mostly by
  checking its frames less. Medium is a sensible default for agents using givemotion. The docs could also ask
  low-effort agents to always look at a few frames before rendering, since that is where low lost.
- **Engine, determinism.** The comparison video showed the open macOS render difference again. Two renders of
  the comparison page on a quiet machine differed in frames 13-359, the opening grid with four videos playing at
  once. The differences are invisible (lowest PSNR 44.8 dB). This page has no scale tween, so the case is wider than
  the one in `docs/NEXT.md`, which now records it.

## Files

- The comparison video: `bench/agents/runs/efforts1/compare/out/compare.mp4` (120 s: the grid for 20 s, each
  effort full frame with its tokens, tool calls and minutes, then the scoreboard). Built by
  `bench/agents/runs/efforts1/compare/build.mjs`.
- Each maker's video, code, session log (`*.jsonl`) and stats (`*.stats.json`), the judges' prompts, pictures and
  scores, and the unblinding key: `bench/agents/runs/efforts1/` (local harness, not committed).
