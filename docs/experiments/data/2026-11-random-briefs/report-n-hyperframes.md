> Raw record: round 8, brief N, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief N, hyperframes

- `index.html` loads a single scene file, `compositions/keyward.html`, which runs the whole 22 s. I kept it as one scene on purpose, because the padlock is on screen from 4 s to the end and carries every handover.
- The lock, letters, doors, rings and all the type are drawn as vector shapes and animated with GSAP. A separate drawing layer handles the three particle moments (the coral-to-teal pops, the 60-particle burst, and the streams forming `KEYWARD`). Both are pure functions of time, so every frame renders the same way each time.
- All five beats follow the brief. The lock squashes and stretches on every landing, hop and snap. Scramble glyphs come only from `x7#Rq!vL9@mZ2$wK`. Coral appears only on `password123` and its debris. Every handover is a motion, with no hard cuts. The last second shows only the title with a 2% push-in.
- I looked at about 70 snapshot frames, plus frame strips from a draft render around the fall, the turn, the dots flying into the keyhole and the shackle snap. I fixed what I saw: letter piles overlapping, `ONE KEY.` colliding with `EVERY DOOR.` as it came in, the tracking snap squeezing letters too far, particles drawing on top of the lock body, a messy scramble wobble, and too much noise in the title streams.
- I also wrote `SPEC.md` (the plan in numbers) and `REVIEW.md` (the choices and checks below).

**Render command**
```
npx --yes hyperframes@0.9.18 render --quality delivery -o out/video.mp4
```
I opened the Studio preview with `preview --background` and confirmed it answered before rendering, then stopped it.

**What got in the way**
- **Tagline timing in the brief doesn't add up.** 30 characters at 1 frame each takes 1.0 s, but the brief allows 20.2–21.0 s. I start typing at 19.87 s so it finishes and the cursor is gone by 21.0, keeping the last second clean.
- **Two lines of the brief needed interpreting.**
  - "A shadow drops in from the top": I made it the lock's floor shadow growing at x = 300 just before the lock drops in.
  - "Lands at center": after the three hops right, a fourth short hop brings the lock back to center, which also gives the turn to camera a reason.
- **Warnings I left in on purpose:**
  - The film has no sound, because the brief asks for silence.
  - The tagline is on screen less than 2 s; that timing is fixed by the brief.
  - The scene file is "too large", because it is one continuous scene.
  - Falling letters rotate around a moving point, which is intended.
- **Small friction:** Bebas Neue isn't built into HyperFrames, so I copied both fonts into `assets/fonts/` and declared them myself. The draft render took over 10 minutes of wall-clock time while its progress was being logged, though the CLI reported only about 75 s of actual rendering. The delivery render took 58 s.
- **Weakest moment:** the particle stream into `KEYWARD` (about 18.8–19.6 s) is still busy. The door outlines are faint on the navy before they fill, because the palette's outline colour is close to the background.
