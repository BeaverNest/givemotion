> Raw record: round 2, brief A, 2026-11-06. Versions: givemotion 0.1.3 (development branch), Remotion 4.0.541, HyperFrames 0.9.17; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

The finished video is at `/home/user/tools5/a/givemotion/out/video.mp4`: 1920×1080, 30 fps, exactly 690 frames and 23.000 s, with no audio track. I checked those numbers with ffprobe, and the last frame is clean paper with only the grain. The composition is `video.html`, with the shot list as a comment at the top.

**What I built**

Everything is drawn in code inside `gm.onFrame`, because givemotion's built-in sketch look draws the same lines on every frame and can't do the boil or tapered ends the brief asks for.

- **Lines:** every line is a tapered, uneven, wobbly ink stroke that draws on with an ease-out. Every 3 frames each line is redrawn with a small random offset (the 10 fps boil), while the camera is worked out on every frame so it stays smooth. Shading is loose diagonal or cross hatching, and colour washes sit 4–6 px off their outlines and spread in with a wavy edge.
- **Camera and planes:** a real dolly camera moves over four flat planes. They travel at 15%, 45%, 100% and 140% of the camera speed and cast soft ink-10% shadows. The front leaf sprigs are blurred 8 px. In Beats 3 and 5 the planes tilt 35° and the farther ones rise on screen, so the city reads as a tabletop diorama.
- **Text:** every word and numeral writes on left to right, letter by letter, behind a slanted reveal. Nothing counts up and nothing types on.

**Beat by beat**
- **Beat 1:** the hexagon draws and its amber wash fills in. The title writes on, then the subtitle and its underline. The page pushes in from 100% to 106%. The title and subtitle slide down out of frame while the hexagon spins, shrinks and flies up and right.
- **Beat 2:** the skyline, mid buildings, rooftop, hive and potted plant draw in, and the camera trucks 220 px. The hexagon snaps on as the hive's entrance plate. "Rooftop" writes on with a curved arrow, a dozen bees loop out on short trails, and "Up to / 50,000" writes on with its caption.
- **Beat 3:** the camera pulls back into the diorama. The lead bee flies a dashed amber route shaped like petals, and the four plants grow with their labels as it arrives. The haze-blue circle draws clockwise, "3 km" writes on, and the camera rushes into the hive marker as the planes fly apart.
- **Beat 4:** the spoon and its amber drop draw in, and the jar draws and fills with a wobbly edge. The drop arcs over and splashes into the jar at 17.0 s. The 60 px drift separates the two planes. At 18.5 s the jar's outline morphs into the opening hexagon.
- **Beat 5:** the camera pulls back out to the diorama with the hexagon over the hive. The last petal loops home, the flower doodles pop in every 2 frames, the two closing lines write on, and everything fades to paper.

**Render command (final)**
```
npx givemotion render video.html -o out/video.mp4 --workers 1
```

**What got in the way**
- **Render crashes:** with motion blur on (the default), renders with 4 workers, and later 2, failed with `HeadlessExperimental.beginFrame: Another frame is pending`. With 2 workers it went through once, then failed again. One worker has worked every time; it just takes about 2 minutes. Turning motion blur off also renders cleanly.
- **`check` warnings:** it ends with 0 errors and 12 short-hold warnings. They are expected: `check` counts every per-letter span as a word, and the hold lengths come from the brief's own timings. All four facts get at least 1.5 s of fully readable hold.
- **Timing changes:**
  - The bee's four arrivals are about 0.15–0.3 s earlier than "about 1.2 s each" would put them, so the "Community garden" label stays readable longer.
  - The "10–25 kg" caption finishes at 18.0 s instead of 18.2 s, so it can hold 1.5 s and clear before the city comes back.
  - The end fade finishes at 22.95 s instead of 23.0 s so the last frame is clean paper.
- **Interpretations:**
  - "3 km" stays fixed on screen beside the circle's lower-right edge rather than riding the circle. Otherwise the rush-in at 14.6 s would cut its 1.5 s hold short.
  - In the diorama shots the mid buildings are dimmed to about 55% opacity so the flight map reads over them.
  - The four place labels are not shown again in Beat 5.
- **Remaining flaw:** the analyzer still flags some strobing frames, mainly as the title slides out and as the skyline washes sweep in. Motion blur barely applies to what my own code draws.
