> Raw record: round 8, brief N2, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief N2, hyperframes

it into 14 coral circles that turn teal and drift up. It lands at centre, turns to face the camera with a horizontal squash, and looks up.
3. **9–14 s:** `ONE` and `KEY.` slam in with a 30 px overshoot, and the lock flinches at each one. KEY wipes to amber. `EVERY DOOR.` slides in with the tracking squeeze, then breaks into 40 doors. The lock stomps, and the doors swing shut in a teal ripple outward from it, then collapse into the baseline.
4. **14–18.5 s:** the strong password resolves as a slot-machine scramble that only uses its own characters. It collapses into 16 teal dots, which arc into the keyhole while the lock pulses with each one and squeezes its eyes shut. The shackle snaps closed, then two amber rings and 60 teal particles burst out. The lock shrinks into a 60 px icon.
5. **18.5–22 s:** the particles stream in and fill the letters of `KEYWARD`, which turns solid with a 104% overshoot while the icon squash-bounces. The tagline types in, and the film ends on a 2% push-in.

`npm run check` passes with 0 errors. I kept two warnings on purpose: one says the film is silent, which the brief asks for; the other says the amber "KEY" isn't on screen long enough to read. I think that one is a false alarm caused by the wipe effect, since KEY is on screen for about 1.2 s. I made fixes after looking at the frames: re-centring the cursor, removing a stray crack dot, spreading out the debris, untangling the ONE KEY./EVERY DOOR. overlap, redrawing the doors, and moving the burst behind the lock's face.

**Render command** (run from the project folder):
```
npx --yes hyperframes@0.9.18 render --output out/video.mp4 --fps 30 --quality delivery
```

**What got in the way:**
- **Tagline timing contradicts itself.** 30 characters at 1 frame each takes 1.0 s, which doesn't fit in the brief's 20.2–21.0 s window. I start typing at 19.93 s and the cursor is gone by 20.93 s, so the last second stays clean. The cursor blinks before the typing rather than after.
- **The hops couldn't reach every letter.** Three short hops from x = 300 to centre can't cover letters spread across the middle of the frame. So the letters drift left as they fall, into three clusters under the landing spots.
- **"EVERY DOOR." is readable for only about 0.5 s** before it breaks into doors. The brief's timings leave no more room. This is the weakest moment.
- **Interpretations:** I read "+80 tracking" as 80 px so the squeeze is visible. All colour changes are instant switches rather than fades, so no in-between colours outside the palette appear.
- **One scene instead of several.** HyperFrames prefers one sub-composition per scene, but the padlock and particles carry across every beat, so it's one scene drawn frame by frame from the timeline. The check flags this as a warning only.
- **Rendering is slow here:** about 9 minutes in total, of which the capture was about 1 minute.

The creative calls and weakest spots are also written up in `REVIEW.md`, and the fonts are in `assets/fonts/`.
