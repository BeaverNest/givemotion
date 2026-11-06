> Raw record: round 8, brief P2, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief P2, remotion

er as they land. The cards then slide like a carousel inside a fixed window. The second card wipes right to left into `3,917`, with a mint spark at each thousand. The 600 px line draws out from the center and reveals `21 HOURS OF TYPING SKIPPED` letter by letter. A 20° diagonal wipe with an amber leading edge clears the screen.
- **Beat 4:** the amber `37` rises from a mask and jitters. It bursts into about 120 squares and shards taken from the actual shapes of the digits, which turn mint and reassemble. A bar wipes `weak passwords` into `fixed`, and the whole scene closes toward the centerline like a vault door, with a thin mint seam.
- **Beat 5:** the `0` opens from the centerline and its label rises. The `0` shrinks into a padlock that draws itself, and the shackle snaps down with a squash. The click sends out 80 particles, a shockwave ring out to 1200 px and the grid ripple. `Locked tight.` is wiped in by a bar and `See you in 2027.` rises in. Particles drift and the lock glows through the last frame; there is no fade to black.

**Render command** (run from `/home/user/tools5/p2/remotion`):
```
npx remotion render LockedTight out/video.mp4 --codec=h264 --log=error
```

**Where I departed from the brief, and what got in the way**
- **Timing conflicts:** several of the brief's exact timings break its own rule that each label stays fully on screen for at least 1.0 s. I nudged them so the hold rule wins:
  - The `weak passwords` → `fixed` wipe runs 11.7–12.13 s instead of 12.0–12.6 s, and the Beat 4 close starts at 13.2 s instead of 13.1 s.
  - The `breaches got through` label wipes away at about 15.07 s instead of 14.8 s.
  - The `2026` sweep runs 1.4–1.9 s instead of 1.5–2.1 s. Even so, `2026` is fully visible for only about 0.9 s before the band erases it; it's a number rather than a label, so I left it.
- **Padlock:** I left a small gap in the top edge of the padlock body where the shrunken `0` sits. Without it the stroke cut straight through the digit.
- **Grid rows:** the grid uses 33 rows instead of 32, so the upward drift wraps off-screen without dots popping in. About 32 rows are on screen at any time.
- **Dim grid:** at the brief's 25% opacity the indigo grid is very faint on the navy background. It reads mostly where the wave passes over it.
- **Docs vs. this setup:**
  - The Remotion docs say to work with Studio open, but nobody was watching, so I checked frames with `npx remotion render --frames=… --image-format=png` and contact sheets instead.
  - The docs also say not to set a custom browser. I kept the preinstalled Chrome Headless Shell that `remotion.config.ts` already points to, because the machine can't download Remotion's browser.
- **No other problems:** the full render took about 2 minutes. I installed `@remotion/fonts` with `npx remotion add` and copied the Space Grotesk and JetBrains Mono files into `public/fonts/`.

All the code is in `src/`; the main file is `src/LockedTight.tsx`, which places each scene on the timeline.
