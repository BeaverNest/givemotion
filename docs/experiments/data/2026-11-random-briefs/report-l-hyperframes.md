> Raw record: round 7, brief L, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief L, hyperframes

 and blur. The world drops to 40% brightness behind the chart.
- **Counter and chart (0–7 s):** the depth counter rolls from 0 M to 4,000 M with an ease-in. The axis draws down and the counter slides to sit at its base. The chart tilts 8° on the Y axis. Bars are on a linear scale where 100% = 1,000 px, grow 0.4 s apart and overshoot by 2.3%. The Midnight Zone's coral "0%" comes in with a glow pulse. The camera then pushes into the empty Midnight row and the chart blurs past the lens.
- **Tagline and logo (7–18 s):**
  - Each letter of LIGHT ENDS. goes dark one at a time, 60 ms apart.
  - LIFE DOESN'T. builds from 12–20 glow points per letter, placed inside the real Bebas Neue letter shapes. The coral apostrophe lights last.
  - The letters break into rising points, and the apostrophe's light becomes the lure. It slides to centre, grows the stalk and then the clockwise ring, with the anglerfish silhouette shown for 1 s.
  - ABYSSAL slides out from behind the ring, then the rule, the tagline and DEEP OCEAN EXPEDITIONS set in. The lure pulses at 16.0 s and again, smaller, at 17.2 s.
- **Foreground plane:** large, heavily blurred creatures. A jellyfish crosses in beat 1, a lanternfish passes in front of the chart, a jellyfish crosses over the tagline, and the siphonophore circles the lockup. The circling creatures slow almost to a stop by the end.

All motion is calculated from the timeline's time, so any frame renders the same on its own. `npx hyperframes check` passes with 0 errors.

## Render command
Run from `/home/user/tools5/l/hyperframes`:
```
npx --yes hyperframes@0.9.18 render --fps 30 --quality delivery -o out/video.mp4
```

## What got in the way
- **The brief contradicts itself twice:**
  - The counter is asked for at 64 px from the edges but also inside a 5% title-safe margin (96 px at the sides). I put it at 96 px from the left and 64 px from the top, which satisfies both.
  - The Twilight bar is called "a 6 px sliver" but also has to sit on a true linear scale where 100% = 1,000 px. On that scale 1% is 10 px, so the bar is 10 px.
- **Warnings I left in on purpose:** the 22 px and 20 px text sizes and the Silt Grey colour (4.42:1 contrast against the background) are set by the brief, so I kept them even though `check` warns. It also warns that the film has no sound, which is what the brief asks for.
- **My first logo layout came out wrong.** The tagline-and-logo scene is hidden when it is first built, so measuring text sizes on the page returned zero. That pushed the lockup off-centre and hid the glow points. I fixed it by measuring from the font itself instead.
- **Rendering is shared on this machine.** The render first waited for other people's renders to finish, then took 6 minutes using software graphics.

The full notes are in `REVIEW.md`. The weakest parts are the far lanternfish schools, which are faint enough to read as specks, and the beat-1 foreground jellyfish, which is so blurred that it reads more as a glow than an outline.
