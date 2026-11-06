> Raw record: round 7, brief K, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief K, remotion

 and springs back once. The cloud breathes twice, then presses down to 88% like a sponge.
- **Precipitate:** five drops fall from the cloud with rain streaks that erase after impact. The fifth is the hero, eyes and all. "Precipitate." falls in random letter order with one bounce each. The four small drops then slide along the horizon and merge into the hero, which swells with each merge.
- **Collect:** the river draws from 8 to 14 px wide with the droplet riding its tip, and ends in three waves. "Collect." flows along a curve that runs parallel to the river and straightens as it lands. At 15.0 s everything fades to 30%, and the 700 px loop draws clockwise through the sun, the cloud, the rain and the river. Its arrowhead pops on with a squash.
- **Lockup:** the loop pulses and shrinks around the droplet, which jumps in and lands. The three lines of closing copy arrive, the droplet blinks at 17.0 s, and the frame is completely still from 17.4 s.

**Choices the brief left open:**
- Stage words sit below the horizon, inside the 96 px safe margin. "Collect." ends right-aligned under the sea; the other three are left-aligned.
- The sun, cloud and river are placed so a single 700 px circle really passes through all of them.
- The loop shrinks for the lockup, because "The Water Cycle" at 160 px is wider than a 700 px circle and would have been crossed by it.

**Render command** (run from `/home/user/tools5/k/remotion`):
```
npx remotion render WaterCycle out/video.mp4
```

**What got in the way:**
- **Studio and preview rendering advice:** the docs say to open Studio and keep it open while you work, and not to render unless asked. With no one watching, I skipped Studio and checked frames by rendering image sequences (`npx remotion render … --sequence`) and making contact sheets with a small script.
- **Browser setting:** the render docs say not to set a custom browser executable, but this machine is offline, so I kept the preinstalled Chrome Headless Shell in `remotion.config.ts`.
- **Studio editing pattern:** the docs push keeping every animation as an inline `interpolate()` on `Interactive.*` elements so it can be edited in Studio. Squash and stretch that preserves volume, drawing along a path and riding the river need computed values, so most of the motion is plain computed styles and SVG. The composition renders correctly, but much of it can't be edited from Studio's controls.
- **Fixes after reviewing frames:**
  - The vapour first looked like a leaf shape, so I reshaped it into separate wisps.
  - "Collect." first read backwards and ran ahead of the river; it now flows as a word that keeps pace with the river's tip.
  - The river was too squiggly, so I smoothed it.
  - "Precipitate." overlapped "Collect." during the handover; it now leaves earlier.
  - I adjusted the spacing in the lockup.
- **Type-check:** `tsc` also reports errors from example files inside `skills/`; those are unrelated to the video, and my own code in `src/` type-checks cleanly.
