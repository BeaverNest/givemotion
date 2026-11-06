> Raw record: round 7, brief L2, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief L2, remotion

nd cyan bars on a true linear scale (100% = 1,000 px). The bars overshoot by 2.5%, and 0% fades in with a coral glow pulse. The chart is tilted 8° in depth, and creatures pass in front of and behind it. At 6.4–7.0 s the camera pushes into the Midnight row and the chart blurs past the lens.
- **Beat 3:** "LIGHT ENDS." goes dark letter by letter, 60 ms apart (fading to grey, sinking 40 px, shrinking to 0.8). For "LIFE DOESN'T.", 12–18 glow points per letter swim in along curves and land inside the actual letter shapes. I got those shapes from the Bebas Neue font file with fontTools. The apostrophe lights last, in coral. A blurred foreground jellyfish passes in front of the line. The letters then break back into points that drift up; only the coral light remains.
- **Beats 4–5:** that same coral point (one continuous element) becomes the lure. The stalk draws out of it, then the 240 px cyan ring draws clockwise, open at the top right. The anglerfish silhouette shows for about 1 s. "ABYSSAL" slides out from behind the ring in depth, 50 ms apart, while the mark glides left to centre the lockup. The rule, the tagline and "DEEP OCEAN EXPEDITIONS" set in, and the lure pulses at 16.0 s and, smaller, at 17.2 s. Three creatures circle the lockup and slow almost to a stop. The last frame is a clean lockup with no fade.

The code is in `src/` (`Abyssal.tsx`, `world/`, `scenes/`, `lib/`), with the fonts copied to `public/fonts/` and loaded through `@remotion/fonts`.

## Render command
```
npx remotion render Abyssal out/video.mp4 --concurrency=4
```
This was run from `/home/user/tools5/l2/remotion` and took about 15 minutes.

## Where the brief and my choices differ
- **Brief contradictions.** In both cases I followed the brief's "Must" list:
  - **Counter position:** "64 px from the edges" conflicts with the 5% title-safe margin, which is 96 px at the sides. The counter is 64 px from the top and 96 px from the left.
  - **Twilight bar:** "a 6 px sliver" conflicts with "true linear scale", where 1% = 10 px. The bar is 10 px.
- **Rendering is slow** because of all the blur layers, about 0.5–0.6 frames per second. My first full test render hit the 10-minute command limit at frame 330. After that I checked selected frames, and ran the final render in the background.
- **A Chrome rendering glitch:** a mask combined with 3D transforms on the wordmark left a stale copy of the ring across the letters. I replaced the 3D with depth computed by hand in 2D and cut the letters off at the ring's edge. The glitch is gone.
- **I didn't follow some of the Remotion docs' usual workflow:**
  - **Studio:** I didn't open the Studio preview, since there was no browser or viewer. I checked by rendering frames instead.
  - **Chrome path:** the render docs say not to set a browser path, but I kept the preinstalled one in `remotion.config.ts` because this machine is offline.
  - **Studio editing:** most styles are calculated in code, so the Studio can't edit those animations directly.
