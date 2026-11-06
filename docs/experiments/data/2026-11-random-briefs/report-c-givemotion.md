> Raw record: round 3, brief C, 2026-11-06. Versions: givemotion 0.1.3 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

I've rendered the video to `out/video.mp4`, and I'm happy with it. ffprobe confirms 1920×1080, 30 fps, exactly 450 frames (15.000 s), with only a video stream (no audio).

## What I built
It's one composition, `video.html`, with a shot list at the top. The whole film is one continuous scene, and the lime point appears at 0.3 s and stays on screen to the end:

1. **The first line (0–2.5 s):** the point pops in at the centre and the horizon draws out from it to both edges, with the title above and `2026 IN REVIEW` typing on below. The horizon then bends and breaks into three pieces: the north coast, Asher Island and the south coast. The point rides the island piece down to the Asher Island dock.
2. **The routes (2.5–6.0 s):** three teal routes draw one after another, each with a ferry riding its tip and a lime spark ring on arrival. `41,600` counts up in the top-right. The Asher ferry pulls into a berth beside the lime point. The camera then pushes about 18× into that ferry, which turns into the 1,100 px hull, and the point becomes the head of the dock post.
3. **The battery (6.0–9.0 s):** the lime cable draws down from the top edge to the point, and the 10 cells fill left to right. At the end only the top edge of the fill stays; it closes into one lime line, and a camera slide carries it down to become the chart's axis.
4. **The year in energy (9.0–12.0 s):** the month labels appear one by one, and the curve draws with the point on its tip: a small winter dip, a summer peak, and December highest. The monthly values add up to 12.4. As everything fades, the point at December surges forward, then swoops down with a short trail.
5. **The sign-off (12.0–15.0 s):** a ferry grows out of the point and glides to the centre, drawing a lime wake behind it. The camera pulls back 6%, and the hold ends with one soft pulse.

The nine wave lines and the glow move on every frame, and they spread with 0.3× parallax during the push, the slide and the pull-back.

**Render command** (run from `/home/user/tools5/c/givemotion`):
```
npx givemotion render video.html -o out/video.mp4
```

## What I fixed after looking at frames
- The land fill showed its final shape while the coastline was still morphing; it now follows the morph.
- The Asher ferry's idle bob got multiplied by the 18× push, so the big hull floated about 8 px above its waterline. It now settles before the push.
- The chart's start looked like a cliff. I changed the baseline and smoothed where the curve leaves the axis.
- A giant ghost of the "ASHER ISLAND" label lingered during the push; the map now fades out faster.
- The frames around 12 s were nearly empty, so I added the swoop trail and brought the slogan in a little sooner.

## What got in the way
- **Two parts of the brief conflict:**
  - **Cell flashes:** ten cells filling one by one between 6.4 and 8.2 s means about 5.5 flashes per second, but the brief says nothing should flash more than 3 times per second. I kept the 4-frame flash on each cell but made it faint (a 45% foam-white overlay on a small cell) and never full brightness. Please check this one.
  - **Counter hold:** `41,600` settles at 5.4 s, but beat 2 ends at 6.0 s and the brief wants every number held 1.0 s. I kept the counter on screen until 6.45 s, so it overlaps the start of the battery scene briefly.
- **Hold times:** `8,300 t CO₂ AVOIDED` starts coming in at 10.45 s rather than exactly 10.6 s, so it gets its full second before the fade at 11.75 s.
- **What `check` still flags:** 0 errors. It warns that the first half second is empty and that some lines are on screen too briefly to read. The brief's own timings cause all of these (the waves-only opening, `2026 IN REVIEW` leaving at 2.1 s, the dock line between 7.2 and 8.6 s, and so on), so I left them.
- **Parallax:** a literal 0.3× of the 18× push would have blown the waves up to more than twice their size. Instead the waves spread about 14% in their spacing during the push and keep their size, so all nine lines stay evenly spaced and in frame.
- **Shell blocks:** a few shell commands were blocked by the sandbox, so I re-ran them in a simpler form. This cost nothing.

Files are in `/home/user/tools5/c/givemotion`:
- `out/video.mp4`
- `video.html`
