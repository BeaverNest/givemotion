> Raw record: round 2, brief A, 2026-11-06. Versions: givemotion 0.1.3 (development branch), Remotion 4.0.541, HyperFrames 0.9.17; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

I've rendered the 23-second city-hive video to `out/video.mp4`. ffprobe confirms 1920×1080, 30 fps, exactly 690 frames, 23.0 s and no audio stream. HyperFrames' own `check` reports 0 errors and lint reports 0 warnings.

**What I built.** It's one continuous camera move, so the film is a single scene (`compositions/city.html`, mounted from `index.html`). All the drawing and motion live in `assets/city-hive.js`:
- **Lines:** every line is a tapered, uneven ink stroke that draws on with an ease-out and is redrawn with a small random offset every 3 frames (the 10 fps boil). The camera itself moves smoothly at 30 fps.
- **Fills and shading:** washes sit 4–6 px off their outlines and shading is loose diagonal crosshatching.
- **Bees:** striped amber ovals with two looping wings that switch drawings every 2 frames. They spill out of the hive on looping trails.
- **Depth:** four paper planes move at 15%, 45%, 100% and 140% of the camera's sideways drift. Each casts a 10% ink shadow, and the foreground sprigs are blurred 8 px. For the flight map all planes tilt 35°.
- **Text:** all words and numerals use the real Caveat and Space Grotesk letter outlines, written on contour by contour from left to right. Nothing counts up or types on.
- **Continuity:** the opening hexagon is the same object all the way through. It becomes the hive's entrance plate, then the map marker. In Beat 4 the jar's outline redraws into a hexagon that lands back on that marker.

**Where I departed from the brief's timings:**
- **"3 km" hold:** the 14.6 s rush only leaves about 0.6 s of reading time after "3 km" writes on. To reach 1.5 s, the circle and its label reappear with the city in Beat 5.
- **Title and closing line:** the brief's timings give these short holds (the subtitle has 0.4 s before the title slides away). I kept them as written.
- **Weakest moment:** around 19.4–19.6 s the returning city shows faintly behind the honey facts as they fade out.

**Render command:**
```
npx --yes hyperframes@0.9.17 render --quality delivery --fps 30 -o out/video.mp4
```
It took about 4 minutes.

**What got in the way:**
- **Fonts:** the font library I used to extract the letter outlines (fontkit) crashes when it reads the bundled variable fonts directly. I fixed it by converting them to TTF in memory with another package (wawoff2). Both are installed in `node_modules` without being added to `package.json`.
- **Text checks:** because text is drawn as shapes rather than live text, HyperFrames' automated contrast and reading-time checks can't see it. I judged legibility by eye on full-size snapshots and on frames pulled from the finished MP4.
- **Changing copy:** edit `tools/copy.json`, then run `node tools/build-glyphs.cjs` to rebuild the letter data.
- **Skipped steps:** I left out the docs' optional telemetry and feedback commands, since they send data outside this machine.
- **Notes:** the creative calls and the weakest spots are written up in `REVIEW.md`.
