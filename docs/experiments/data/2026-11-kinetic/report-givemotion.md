> Raw record: KINETIC round, 2026-11-05. Versions: givemotion 0.1.3 (development branch), Remotion 4.0.541, HyperFrames 0.9.15; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

I built the 20-second "KINETIC" reel and rendered it to `out/video.mp4`. ffprobe confirms H.264, 1920×1080, 30 fps, 600 frames, exactly 20.000 s, no audio. I also checked frames pulled from the finished MP4, not just the previews, and they match. The last `check` run has no errors and no warnings.

## What I built
The source is one HTML file, `video.html`, with one camera moving through one world, as the brief asks. There is a single scene with no slide transitions, and every beat hands over to the next through motion.

1. **The spark, 0–3 s.** A violet dot pops in with an overshoot and pulses once like a heartbeat, with rings going out. It then truly morphs (the outline changes) into a rounded square, a triangle and back to a circle. Each change turns the shape a little and lands with a squash and an elastic settle. The camera pulls back slowly while this happens.
2. **The path, 3–7 s.** The circle squashes backwards and shoots off along a long S-shaped curve. It is the head of a lime line that draws itself behind it. The circle leaves a trail of fading copies and stretches when it moves fast. The camera follows it. Outlined shapes sit at three real depths in 3D space, so they drift past at different speeds.
3. **The words, 7–11 s.** The line snaps into the circle, which bursts.
   - `SHAPE` letters rise out of the burst, blurred until they settle.
   - A lime bar wipes across, cutting `SHAPE` away and revealing `MOVE` behind it.
   - The `MOVE` letters scatter, and `FLOW` reassembles from the same scattered positions.
   - Each word is centred, about 320 px tall on screen, and fully readable for at least 0.8 s.
4. **The system, 11–15 s.** The camera pulls back and the world tilts into a 3D view. `FLOW` turns out to sit on one card of a 6×4 grid, and the other cards rise into place around it. A wave ripples out from the centre: each card lifts and turns, delayed by its distance. Three cards count up to `60 FPS`, `120 SHAPES` and `1 TIMELINE`.
5. **The title, 15–20 s.**
   - F, L and W fly off, and the O shrinks into a lime dot.
   - That card turns to face the camera, flies forward out of the grid and turns violet. It fills the frame exactly as the end card, so the same element carries through rather than cutting.
   - The dot pulses and splits into the circle, the rounded square and the triangle. They slam together, and `KINETIC` bursts out of the impact with a camera shake, sparks and a ring.
   - The shapes bounce into a row above the title, and the tagline tightens into place.
   - The finished title holds for about 2 s with gentle motion: the shapes bob, the title breathes, the glow drifts and the camera pushes in slowly.

It uses only the four palette colours (plus tints and transparency), and only Space Grotesk and Inter, loaded from the local files in `fonts/`.

## Render command
```
cd /home/user/tools4/givemotion && npx givemotion render video.html -o out/video.mp4
```

## What got in the way
- **Rendering is slow.** The full render took about 16 minutes (0.6 frames per second), because of the large 3D world and blurred layers. It overran the 10-minute foreground limit, so I let it finish in the background.
- **3D angles came out about 6× too strong.** The camera scales the world flat (sideways and up-down) but not in depth. At the overview zoom, a 16° card turn looked like about 60°, and the grid looked like it was standing up. I scaled those angles down to about 4°. The same effect made the flying card drift off the top of the frame, which I fixed with a compensating slide.
- **The camera drifted during the words.** Shots placed back to back are blended into one curve, so the 3-second hold on the card swung about 200 px off centre. Giving those holds `blend: false` fixed it. A camera tilt on the opening shot also pushed the spark off centre, so I dropped it.
- **The tilt swung wildly mid-move.** A plain `.to()` on the already-tilted wrapper read its starting angle wrong and briefly swung the whole grid. Giving it explicit start values fixed it.
- **Some letters stayed blurred.** Two overlapping blur animations on the same letters left I, N and C in KINETIC (and L in FLOW) slightly soft to the end. I fixed it.
- **Two small notes from `check` that I kept on purpose:** the far shapes move in a straight line while the camera pulls out, and the camera settles briefly at 16.8 s while the title action plays.

My preview folders (`snapshots/`, `snaps2/`…`snaps9/`, `snapsfull/`, `snapsfinal/`) and the render cache `out/.gm-parts/` are still in the working folder; they can be deleted.
