> Raw record: round 2, brief B, 2026-11-06. Versions: givemotion 0.1.3 (development branch), Remotion 4.0.541, HyperFrames 0.9.17; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

I built and rendered the Pocketfold title sequence to `out/video.mp4`. ffprobe confirms H.264, 1920×1080, 30 fps, exactly 450 frames, 15.000 s, and no audio track.

**What's in it**
- **Background (full 15 s):** two soft `#183A52` glows, 900 px and 700 px, drifting in figure-eight loops that each take 12 s. Over them sits a 48 px dot grid (3 px dots at 6%) with a diagonal wave that swells dots to 4.5 px and 12%, one wave every 5 s. It never stops, including the final hold.
- **Beat 1:** the coin drops at 0.3 s, lands at 960, 300 with a soft bounce and a ring pulse. The mint line draws down to 960, 560 led by a bright tip. "Every coin takes a path." comes in word by word, 4 frames apart, then fades out over 0.4 s as the tip reaches the split.
- **Beat 2:** four S-curves draw out to the nodes at x 360/760/1160/1560, y 820, 5 frames apart and 1.2 s each. Coins flow along them at uneven spacing and speeds. Each node pops in with a little overshoot, gets its label, counts its amount up over 1 s, and pulses when the count lands. The amounts use Space Grotesk tabular numerals; I rendered a test to confirm the digit widths stay equal.
- **Beat 3:** the paths bend into a U and pull back to its bottom center. The mark then draws outward from that point over 1.6 s: a U with 60 px corners and a diagonal flap tucking inside the right wall. Coins spiral into the pocket and shrink, the original coin drops in last behind the flap, the mark tightens to 0.94, then 2 frames of stillness.
- **Beat 4:** the mark snaps back. 104 amber particles (dots and spinning coin rings) burst out, slow down and drift up like embers, and about a quarter stay as dust until the end. A mint shockwave expands to 700 px, and POCKETFOLD rises letter by letter from a mask line, center letters first.
- **Beat 5:** the tagline, then a wavy underline drawn over 0.8 s, then "Available now" at 13.0 s at 70% opacity. The mark breathes slowly through to the end with no fade to black.

**Render command** (run from `/home/user/tools5/b/remotion`):
```
npx remotion render Pocketfold out/video.mp4 --muted
```

**Decisions I made where the brief left a gap or contradicted itself**
- **"Available now" position:** centered at y 946 instead of 960. Centered at 960 the text would have crossed the 120 px safe margin.
- **Amounts sitting on the paths:** each path arrives at its node from directly above, so the amount would sit on the line. I masked a small gap in the line behind each amount, so it reads like a station label on a transit map.
- **Path draw order:** the inner pair draws first, then the outer pair, still 5 frames apart. This keeps the delta symmetrical.
- **Brightness breath:** done only with opacity (plus a faint wide mint stroke at up to 10% opacity), since the brief allows tints only through opacity.

**Fixed after reviewing frames**
- The node rings looked like "power" icons because the paths ran into the ring centers.
- The first mark was too squat and read as a tub.
- A leftover stub of the first line stayed inside the mark for the rest of the video.
- The nodes stayed on screen after their paths had pulled away.
- The handover between the folding paths and the mark drawing on had a dip; I retimed it.

**What got in the way**
- Several shell commands were blocked by the sandbox (`cd` combined with writes, heredocs, brace expansion, running a shell script), so I used Python and direct file edits instead.
- Remotion's bundled ffmpeg has no `tile` filter, so I made frame contact sheets with Python/PIL.
- The docs say to preview in Remotion Studio, but there was no browser or viewer here, so I checked my work by rendering stills and pulling frames from the finished MP4.
- The render docs advise against setting a custom browser, but the project's config already points to the preinstalled offline Chrome Headless Shell, and I left that as it was.

I added `@remotion/paths` and `@remotion/fonts` with `npx remotion add`, and copied the two font files into `public/`.
