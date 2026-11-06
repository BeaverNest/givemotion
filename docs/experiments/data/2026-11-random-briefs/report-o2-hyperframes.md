> Raw record: round 8, brief O2, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief O2, hyperframes

pulse, and its label pill wipes out from it.
  - The balance rolls through each figure behind a mask, flashing coral on debits and gold for savings. The label rolls to LEFT TO SPEND at the savings stop.
  - The credits wipe in with a green hairline leading the edge.
  - Then the camera pulls back to 100%, the map un-draws in reverse, and the route retracts into the gold dot.
- **`compositions/title.html`** (17–24 s), beat 5: the title line draws and the gold dot glides to its right end. "Ledgerline" rises letter by letter from behind the line, then the tagline and its hairline wipe in, then AVAILABLE NOW opens from the centre. One ring pulse plays at 22 s, and the last 1.5 s holds still.
- **Checks:**
  - The check command reports 0 errors.
  - The two snapshots taken inside the final hold are byte-identical, so nothing moves there.
  - A frame looks the same whether it is reached from the start or from another time.
- **`REVIEW.md`** in the project folder records these decisions.

## Render command
```
npx --yes hyperframes@0.9.18 render --quality delivery --fps 30 -o out/video.mp4
```
The render took about 2 minutes, run from `/home/user/tools5/o2/hyperframes`.

## What got in the way
- **The brief's map geometry doesn't fully work.** No grid spaced 160 px / 140 px can pass through all the waypoints (x = 240, 720, 1000; y = 800, 300). I offset the grid so the first three legs and the RENT and GROCERIES stops sit on streets. The leg running north at x = 1000 and the leg running east at y = 300 run mid-block, 40 px and 60 px from the nearest street.
- **Pins moved slightly.** The RENT and GROCERIES pins sit about 7 px from their stated points, on the middle of the rounded corner. At the exact corner point they hung off the line.
- **Text crossing the route.** The route's trail passes behind the lower-left credits during beats 2 and 3. I gave the credit text a navy glow (a palette colour) so it stays readable. The leading dot never enters the credit or balance areas.
- **The descender of the "g" in "Ledgerline" is clipped at the title line.** This follows from the brief's mask (the area above the line), and it reads as the letter tucked behind the line.
- **Warnings I left alone:**
  - "No audio": the brief says no audio.
  - "Text below the 28 px readability floor": this covers the brief's own sizes (20, 22 and 24 px).
  - "File too long": the map scene file is long.
- **Motion code:** the HyperFrames runtime seeks the animation without firing GSAP's per-frame update callbacks. So I worked out the camera, dot and route positions for every frame in advance instead of computing them live.
- **Fonts:** I copied the two font files into `assets/fonts/`, where HyperFrames expects them.
- **Skipped:** the CLI's optional usage-tracking command and its post-render feedback rating. Both send data to an outside service, and nobody was here to agree to that.
- **Version note:** the CLI says version 0.9.19 is available. I kept the pinned 0.9.18 as instructed.
