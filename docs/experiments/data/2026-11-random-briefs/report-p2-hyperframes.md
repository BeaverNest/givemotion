> Raw record: round 8, brief P2, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief P2, hyperframes

** each one is built in both neighbouring scenes on the same curve so they meet cleanly:
  - Beat 1 to 2: an upward mint band.
  - Beat 2 to 3: a two-card carousel inside one card-sized window.
  - Beat 3 to 4: a 20° diagonal wipe with an amber edge.
  - Beat 4 to 5: two mint seam lines close the 37 onto the centreline, and the 0 opens from the same line.
- **Numbers:** every number first appears through a masked wipe from dots or from a mask line. The bar wipes cover up, left-to-right, right-to-left and diagonal. Count-ups are right-aligned so the digits don't shift sideways.
- **Particles:** the Beat 4 burst samples the actual pixels of the "37" glyph, so it breaks apart and reassembles on the real letterforms. Particles are kept off numbers while they're being read.
- **Padlock:** it draws itself, the shackle snaps down 40 px in 4 frames with a 2-frame squash, then come 80 particles and a ring growing to 1200 px across. The lock glows through the hold, and the background is still moving on frame 539.

**Render command** (run from `/home/user/tools5/p2/hyperframes`):
```
npx --yes hyperframes@0.9.18 render --quality delivery --fps 30 -o out/video.mp4
```

**What got in the way**
- **Contradictions in the brief:** its own timings don't leave every label 1.0 s fully on screen.
  - `fixed`: I shortened its wipe to 12.0–12.45 s and made the close start slowly, which gets it to about 1.0 s.
  - `breaches got through`: I moved its wipe to 15.0–15.35 s, still inside the brief's 14.8–15.6 s window, which gives it 1.0 s.
  - `2026`: it still only gets about 0.6 s, exactly as the brief times it. I treated it as a number rather than a label.
- **Padlock position:** the brief says the lock body goes "around the lower half of the 0", but that would put the body's stroke through the glyph. I centred the shrunken 0 on the lock body instead.
- **Warnings I left on purpose:**
  - "No sound": the brief says no audio of any kind.
  - "Closing lines held under 2 s": the brief fixes them at 16.2 s and 16.7 s.
- **Bugs I hit:**
  - The wipe bars showed from frame 0, because GSAP draws a `fromTo` tween's start values as soon as it's built. Fixed with `immediateRender: false`.
  - The count-up's measured width was wrong. I replaced the measuring with a CSS layout trick that sizes the box to the final figure.
  - The lint flagged a harmless measurement in a font-load callback. I replaced it with a computed value.
- **Slow render:** this machine has no GPU, so the render took about 2 minutes of capture, plus about 5 more minutes of overhead.
- **Faint by spec:** the dot grid uses the brief's exact colour and 25–70% opacity, so it's subtle. The amber glow tint, capped at 15%, reads slightly grey-violet.

These notes are also in `REVIEW.md` in the project folder. If you want to keep editing, the HyperFrames desktop app opens this project and has an "Edit with Framey" button. The render offered this download link: https://hyperframes.studio/studio/download?os=linux&src=cli
