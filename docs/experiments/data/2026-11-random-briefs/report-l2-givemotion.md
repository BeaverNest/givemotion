> Raw record: round 7, brief L2, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief L2, givemotion

s, each letter lighting with a short bloom. The apostrophe lights last, in coral.
   - A blurred foreground jellyfish crosses over the letters. At 10.6 s the letters break into points that drift upward, and only the coral light remains.
4. **Logo (11–15 s):** That same coral point becomes the lure, so the coral light never breaks from the apostrophe into the logo.
   - The stalk draws out of it (0.6 s) and continues into the 240 px ring, drawn clockwise (0.8 s) and open at the top right.
   - A faint anglerfish silhouette shows inside the ring for about 1 s, then dissolves.
   - The mark slides left while the ABYSSAL letters come forward out of depth from behind the ring, left to right, 50 ms apart.
   - A lanternfish, a jellyfish and the siphonophore circle the lockup on the far, back and foreground planes.
5. **Hold (15–18 s):**
   - The lockup settles to centre. The 1 px rule draws out from the centre, then the small two-colour tagline and "DEEP OCEAN EXPEDITIONS" set in.
   - The lure pulses at 16.0 s and more softly at 17.2 s, and the circling creatures slow almost to a stop.
   - The final frame is a clean, readable lockup with no fade to black.

## Render command
```
npx givemotion render video.html -o out/video.mp4 --motion-blur auto --quality high
```
Run from `/home/user/tools5/l2/givemotion`.

## How I worked and what got in the way
- **Two conflicts inside the brief:**
  - The counter was asked to sit 64 px from the left edge, but the 5% title-safe margin is 96 px. I followed the Must and put it at 96 px left, 64 px top.
  - The Twilight bar was asked to be a 6 px sliver, but 1% on a true linear scale of 1,000 px is 10 px. I followed the linear-scale Must and made it 10 px.
- **Warnings I left on purpose:** `check` ends with 0 errors and 6 warnings.
  - Four come from the brief's own specs: Silt Grey text is just under 4.4:1 contrast, and the 20 px descriptor is below givemotion's minimum text size.
  - Two are short readable holds. "LIFE DOESN'T." is fully lit for about 0.8 s and "LIGHT ENDS." for under a second, because the brief times the darkening and the 10.6 s handover.
- **Review rounds:** I did two rounds with givemotion's stills and review sheets, plus one with a separate critic agent that only saw the frames. The fixes included:
  - a stray cyan dot left by an undrawn stroke;
  - the siphonophore crossing the counter;
  - lanternfish wandering through "LIGHT ENDS.";
  - ABYSSAL letters piling up and appearing out of order;
  - the descriptor touching the stalk;
  - a second coral accent in Beat 2;
  - stronger snow streaks during the push, which I toned down.
- **Fast moves:** analysis of the first render showed some fast frames strobing, so the final render uses `--motion-blur auto`.
- **Render speed:** renders ran with only one worker because other givemotion processes were open on the machine. That was about 1.5–2 minutes per render, which was fine.

All my working stills and contact sheets are in `frames/` and `review/`.
