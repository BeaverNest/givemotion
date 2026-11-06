> Raw record: round 7, brief K2, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief K2, remotion

m the centre out. The sun circle draws clockwise and its rays follow in a stagger. The three wavy vapour paths draw up and meet. The cloud is one 525 px, five-bump stroke. Rain streaks draw behind the drops and erase from the top. The river widens from 8 to 14 px and ends in three sea waves. The 700 px cycle loop draws clockwise through the sun, the cloud and the river, then its arrowhead pops on with a squash.
- **Stage words:** each moves like its stage. "Evaporate." rises letter by letter and its full stop lands last in sun orange. "Condense." squeezes from +60% tracking down to −2%, then does a 92% horizontal squash. "Precipitate." falls letter by letter in random order, each with one bounce. "Collect." flows along a wave and straightens into a level word.
- **Lockup:** the loop shrinks around the droplet as it jumps in and lands. "The Water Cycle" slams in word by word, the subtitle slides up and the mono line types on. The last 18 frames are byte-identical, so the hold from 17.4 s is completely still.
- **Checks:** all type stays inside the 96 px margin (measured on rendered frames), and only the listed colours, fonts and copy are used.

## Choices the brief left open
- **Stage words sit below the horizon,** left-aligned at 96 px, so the top of the frame is free for the drawings. "Evaporate." rises up into that band from below the frame.
- **The river starts at the droplet (x = 960) and flows right,** with the droplet riding at its drawing tip. That means it covers only the right half of the horizon.
- **The loop is off-centre** (centre at 1260, 470) so a single 700 px circle can pass through the sun, the cloud and the river. It then moves to the centre for the lockup.
- **"Collect." follows a wave in its own band rather than the river line itself.** It ends in the same left-aligned position as the other stage words.
- **The droplet splits into three small drops,** each leading the tip of one vapour path, so the "splits apart" moment is clear.

## Render command
Run from `/home/user/tools5/k2/remotion`:
```
npx remotion render WaterCycle out/video.mp4 --log=error
```
I checked frames with `npx remotion render WaterCycle <dir> --sequence --image-format=jpeg` and contact sheets made with ffmpeg.

## What got in the way
- **Studio:** I started it as the docs say, but nobody could watch it, and it was stopped when it hit the background time limit. I didn't restart it and checked rendered frames instead.
- **The 30% fade:** the brief asks for the sun, cloud and river to drop to 30% at 15.0 s. At that opacity they show as blends of their colour and the navy background, so strictly they are off-palette for those frames.
- **Small type-check fixes:** `npx tsc` fails on map example files inside `skills/` that import packages that aren't installed; my own `src/` code type-checks clean. `@remotion/paths` returns values that may be null in its types, so I added non-null assertions. Rendering was otherwise smooth: a full 540-frame pass takes about 20 s.
