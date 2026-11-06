> Raw record: round 8, brief O2, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief O2, remotion

T TO SPEND` at 12.2 s.
- **Credits:** each wipes in with a 2 px green hairline on the wipe edge.
- **Beat 4:** the view eases back to 100%, the map un-draws, and the route un-draws from its PAYDAY end. The title line then draws while the gold dot glides to (1580, 640).
- **Title card:** `Ledgerline` rises letter by letter from behind the line, the tagline wipes in with its hairline, `AVAILABLE NOW` opens from the centre, the gold dot pulses once, and the frame holds still.

**Render command** (run from `/home/user/tools5/o2/remotion`):
```
npx remotion render Ledgerline out/video.mp4 --codec=h264 --crf=10 --x264-preset=slow
```

**Where I departed from the brief, and why**
- **Street grid vs. waypoints:** the brief's waypoints don't all fit a 160/140 px grid. Streets at x = 80+160k and y = 100+140k put the y=800, y=520 and x=720 legs on streets. I added two short side streets (x=1000 and y=300) so the rest of the route still follows streets.
- **Pins at corners:** the RENT and GROCERIES pins sit on the rounded corner, about 7 px from the exact waypoint, so they land on the line instead of beside it.
- **Grid beyond the frame:** I extended the grid past the 1920×1080 map so the 180% view never shows empty navy. Each line's on-screen part still strokes on over 0.8 s.
- **Sizes stay fixed on screen:** pins, the dot, label pills and stroke widths stay the same size while the view zooms. Only positions scale.
- **Camera height:** the follow point is at screen y=400, so the trailing route stays mostly above the lower-left credits.
- **Additions not in the brief:**
  - A faint navy scrim (an opacity of the background colour) sits behind each credit while it's on screen, so the route passing underneath stays quiet.
  - Label pills fade near the frame edges, to keep text 100 px in, and fade when they slide under a credit.
- **The "g" in Ledgerline:** its tail is cut off where it meets the green line. That is the literal result of masking to "the area above the line" with the specified baseline (616) and line (y=640).

**What got in the way**
- **Encoder flicker:** at Remotion's default quality, x264 left visible frame-to-frame changes in the "perfectly still" hold, up to 35 grey levels around the text. Raising quality to `--crf=10 --x264-preset=slow` fixed it (now 0–4 levels). The file grows from about 3 MB to 5.7 MB.
- **No live preview:** the docs say to open Remotion Studio, but nobody was there to watch it. I checked my work by rendering still frames and contact sheets instead.
- **Rendering browser:** the render docs advise against setting a custom browser. I kept the preinstalled one from `remotion.config.ts` because the machine is offline, and it worked without trouble.

The code is in `src/ledgerline/` and the composition is registered as `Ledgerline` in `src/Root.tsx`. I added `@remotion/fonts`, `@remotion/paths` and `@remotion/layout-utils`, copied the two font families into `public/fonts/`, and deleted the unused template `src/Composition.tsx`.
