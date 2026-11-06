> Raw record: round 5, brief E, 2026-11-06. Versions: givemotion 0.1.3 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief E, hyperframes

The final message of the maker session (last 3000 characters).

home/user/tools5/e/hyperframes/out/video.mp4`. ffprobe shows 1920×1080, 30 fps, 570 frames, exactly 19.000 s, and no audio stream. `check` reports 0 errors.

**What I built**

The project has three scenes, all drawn from a custom perspective camera:

- **Beats 1–3 (`compositions/city.html`)** are one continuous camera move through a single 3D city:
  - **Skyline:** three flat skyline layers with real 1 : 0.5 : 0.2 parallax, and the title wipe with its 6 px orange edge. The camera then tilts about 54° down onto the ground.
  - **Map:** the orange dot draws a route loop that crosses the river twice. START, HALF and FINISH labels pop up on stems, and the six district boxes rise as the line reaches them. 42.195 comes in on a 15° diagonal wipe.
  - **Aid stations:** the camera pushes in to the dot, which turns into a blue drop by filling from the bottom. In a lower-angle view, the 18 markers stand up as drops one after another, near to far. "18" opens with an iris from the nearest drop, and "120,000 CUPS OF WATER" uses a wavy-edged wipe.
- **Beat 4 (`compositions/runners.html`):** the 18 drops become the 10×10 dot grid, and a diagonal wipe turns the dots paper-white. One wipe swaps 31,000 for FINISH TIMES. Each cluster lines up as a row of exactly its count, then a bar grows over it at 26 px per dot. The percentages ride the bar tips, and the bars curl into a ring.
- **Beat 5 (`compositions/medal.html`):** the ring becomes a medal with real thickness, which turns 25° while the skyline moves the opposite way. The date opens from the centre and the last line rises in. At 17.6–17.8 s the medal collapses into the 24 px dot, and from 17.8 s the frame is completely still.

Both joins between scene files line up exactly frame to frame. I looked at decoded frames from the MP4 for every beat, and they match the preview snapshots.

**Render command** (run from `/home/user/tools5/e/hyperframes`):
```
npx --yes hyperframes@0.9.18 render --quality delivery --fps 30 -o out/video.mp4
```

**What got in the way**
- **Labels not showing:** the START/HALF/FINISH labels didn't appear at first. Code that hid them early in the move never un-hid them. I found it by printing each label's computed style into a frame.
- **Skyline not leaving the frame:** in the map view, the camera geometry kept the near skyline layer in shot. I pushed the skyline layers further back and reframed the shots several times.
- **Two check warnings kept on purpose:** "no sound", because the brief forbids audio, and "city.html is too large". That file holds beats 1–3 as one continuous camera move. Splitting it would turn the tilt and the push-in into joins I'd have to match by hand.
- **Weakest moment:** the 0.5 s camera rise at 11.0–11.5 s. As the camera goes overhead, the skyline flats look like zigzags for a few frames before they fold away. It's noted in `REVIEW.md`, along with the other creative calls.

The CLI said version 0.9.19 is available. I kept the project's pinned 0.9.18 as instructed.
