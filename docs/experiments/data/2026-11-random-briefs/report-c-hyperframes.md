> Raw record: round 3, brief C, 2026-11-06. Versions: givemotion 0.1.3 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

I've rendered the video to `out/video.mp4`. ffprobe confirms 1920×1080, 30 fps, exactly 450 frames (15.0 s), and a video stream only, with no audio. `check` passes with 0 errors.

## What I built
The video is a root `index.html` plus six scene files in `compositions/`:
- **`ambient`** (runs 0–15 s): nine sine-wave contour lines drifting in alternating directions at 8–22 px/s, and a breathing 6% teal glow moving from lower-left to upper-right. The waves move at 0.3× during the push-in, the slide-down and the closing pull-back.
- **`horizon`** (0–2.5 s): the lime point pops in, the horizon draws out from it to both edges, the title rises, "2026 IN REVIEW" types on, and the straight line bends into the harbour's north coastline.
- **`routes`** (2.5–6 s): the map builds around that coastline. Three teal routes draw from NORTH QUAY, each with a ferry glyph on its tip and a lime spark ring when it arrives. 41,600 counts up, then the camera pushes into the Asher Island ferry until it becomes the 1100 px hull.
- **`battery`** (6–9 s): a waterline and dock post appear, the lime cable draws down from the top edge, and the 10 cells fill with a 4-frame flash each. Only the top edge of the charge stays, and it slides down to become the chart's x-axis.
- **`energy`** (9–12 s): the axis widens and the months appear. The curve draws with the lime point on its tip, with a winter dip, a summer peak and December highest. The point drifts on a little after the rest fades.
- **`signoff`** (12–15 s): the point drops onto a small ferry as the wake draws right to left, ending at frame centre. The copy fades in word by word, the camera pulls back 6%, and the point pulses once.

The lime point or line is on screen continuously from 0.3 s to the end, so every handover is a shared-element match cut.

## Render command
```
npx --yes hyperframes@0.9.18 render --output out/video.mp4 --fps 30 --quality delivery
```

## What got in the way
- **No subscript ₂ in Space Grotesk.** I set CO₂ as a smaller, lowered Space Grotesk "2" so no fallback font appears.
- **Brief and checker disagree in places.** `check` still warns about three things the brief specifies, so I left them as written: 26 px mono for "CHARGED AT THE DOCK IN 7 MIN", short on-screen times for that line and the CO₂ line, and "SEE YOU IN 2027" rendering at about 26 px after the 6% pull-back.
- **Number hold times.** "Everything fades at 11.6 s" didn't leave the CO₂ number on screen for 1.0 s after it settles, so it fades last, from 11.84 s. To give 41,600 its full second, the counter stays fixed through the camera push and clears at 6.4 s.
- **Bugs found while reviewing frames, now fixed:**
  - GSAP scaled the battery fills from the wrong origin, so they floated above their cells.
  - The routes were cut short during the camera push because of how the line-drawing dashes behave on zoom.
  - A stray teal sliver of the chart fill showed at 9.05 s.
- **Permission prompts.** `pip install` and chained shell commands were blocked, so I checked the fonts with an npm package (fontkit) installed in `.tools/` and ran commands one at a time. You can delete `.tools/`.
- **Brief wording I interpreted:** the routes all start from NORTH QUAY, and the "glides to frame centre" step in beat 5 happens while the wake draws.

I also wrote `REVIEW.md` with these notes. I opened the Studio preview before the final render, as the docs ask, then stopped it.
