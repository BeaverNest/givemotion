> Raw record: round 8, brief P, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief P, remotion

re and the 21-hours line appears letter by letter behind it. A 20° diagonal wipe with an amber edge clears the screen.
- **Beat 4:** the amber `37` rises out of a mask line and jitters. It bursts into 120 squares and shards taken from the real glyph shape, which turn mint in flight and reassemble into `37`. A bar wipe turns `weak passwords` into `fixed`, then everything closes to the centreline between two mint "door" edges.
- **Beat 5:** the `0` opens from that same seam. It shrinks into the padlock as the body and raised shackle draw. On the click, the shackle snaps down with a squash, 80 particles burst out, and a shockwave ring expands. `Locked tight.` (revealed by a wipe bar) and `See you in 2027.` follow. The lock keeps glowing and the background keeps moving through the last frame.

The counters count up as zero-padded `0,000` style vault digits, so the numbers don't shift sideways while counting.

## Render command
```
npx remotion render LockedTight out/video.mp4 --codec=h264 --crf=16 --jpeg-quality=95 --color-space=bt709
```

## Where I moved off the brief, and other issues
- **Timing nudges:** the brief's own timings would have broken its rule that every label stays fully on screen for at least 1 s. I moved three things:
  - The `fixed` wipe now runs 11.87–12.33 s instead of 12.0–12.6 s.
  - The Beat 4 door close now runs about 13.17–13.5 s instead of 13.1–13.5 s.
  - `breaches got through` now wipes away at about 15.07 s instead of 14.8 s. The padlock still draws at 14.9–15.6 s and clicks at about 15.8 s.
- **`2026` is fully visible for only about 0.7 s:** I kept the brief's exact 1.5–2.1 s sweep for it, because I read the 1 s rule as covering labels rather than numbers.
- **Padlock placement:** the `0` sits centred inside the lock body rather than with the body around only its lower half. Followed literally, the body's top edge would have cut through the digit.
- **Colours slightly off the palette hexes:** the amber tint on the blob mixes with indigo into a muted brown, as the brief's 15% cap implies. The blob tints are also blends rather than exact palette colours, since the brief asks for a partial tint.
- **Card outline flicker:** about 40 particles landing in under 2 s means the outline is almost always mid-flash, so it shimmers rather than blinking separately.
- **Colour tagging:** by default Remotion 4 tagged the file as full-range (`yuvj420p`, colour space untagged), which some phone players show wrong. Adding `--color-space=bt709` gives a standard limited-range BT.709 file.
- **Rendering browser:** the agent docs say to use Remotion's own bundled browser, but this machine can't download it. I used the Chrome Headless Shell already set in `remotion.config.ts`.
- **Other notes:** the `tsc` check also fails on example files inside `skills/` (missing map libraries), which has nothing to do with the video. I started Studio as the docs suggest but checked my work by rendering frames to images, since nobody was watching the preview.
