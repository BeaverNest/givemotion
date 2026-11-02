# Four Claude models, one hard brief (2026-10-31)

A showcase round: the same brief made by Claude Opus 5.5, Sonnet 5.5, Haiku 5.5 and Fable 5.1, then one video that plays
all four in a 2x2 grid and zooms into each in turn. Not a judged round (no blind judges); the point is to show what the
engine does in each model's hands.

## Setup

- Brief: `bench/agents/briefs-models/showcase.md` ("Code in, motion out"): 20 s, one continuous take, a typed `<motion>`
  that breaks into 3D shapes, which lock into SHAPE / CAMERA / TIME, dissolve into a tilted orbiting ring, and collapse
  into the title. Palette, fonts and every word fixed; craft free.
- Makers: `round.js setup models2 --brief-set models --lean`, one folder per model, the same lean prompt (no tool-call or
  time limit). Each ran as a fresh Claude Agent SDK session on a subscription login: no user settings, memory, CLAUDE.md
  or MCP servers, default effort, web and subagents off.
- Sandbox instead of skipped permissions: each maker could touch only its own folder; Bash ran `./gm` and plain
  file/shell commands, not node/python/git/npm/network. Three launches were stopped and restarted from clean folders
  because the filter refused harmless commands (`cd` into the folder, a `;` inside a quoted sed script, `time`) and so
  cost some models more than others. The final rules were replayed against every earlier tool call before launch,
  reloaded on each call, and every refusal was logged. Refusals in the counted runs were only python edits (all four
  models tried this once or more and switched to the Edit tool) and writes to /tmp.
- Fable's first counted run hit the subscription's 5-hour limit after 29 min with no video; it was re-run alone from a
  clean folder after the reset (independent sessions, so the later start does not matter).

## Results

| model | minutes | tool calls | video |
|---|---|---|---|
| Opus 5.5 | 17.6 | 55 | 20.0 s, all five beats; depth-of-field shapes, three different word entrances, a lit ring with trails |
| Sonnet 5.5 | 22.6 | 31 | 20.0 s, all five beats; the densest 3D particle field, a canvas-drawn camera, a ring-to-point collapse |
| Haiku 5.5 | 7.4 | 30 | 20.0 s, all five beats; flat shapes, simpler camera, a few shapes left over the title at the end |
| Fable 5.1 | 24.0 | 67 | 20.0 s, all five beats; shapes that rebuild the words, a chunky shape ring, a clean collapse |

All four rendered exactly 20.0 s at 1920x1080 and followed the palette, fonts and copy.

## What it changed in the engine

- A `<video>` clip that starts between two frames and plays to the end of its file asked for one frame past the file's
  last frame (e.g. frame 600 of a 600-frame file); ffmpeg cannot start there, so the frame server answered 500 and the
  last frame of the clip went missing. The runtime now clamps to the last frame when it knows the file's length (render),
  and the frame server returns the last frame when a seek lands past the end (still, check). Test in `e2e.test.js`.
- `check` waited forever on a page whose own script spun the CPU (Fable's first draft): a renderer busy in page script
  never answers a frame request, so the wait never reached its time limit. It now stops at the limit (60 s, `--timeout`)
  with a message that names the time the page got stuck and what usually causes it, and later calls on that page fail at
  once instead of waiting the limit again. Test in `e2e.test.js`.
