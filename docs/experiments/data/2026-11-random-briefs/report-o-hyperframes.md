> Raw record: round 8, brief O, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief O, hyperframes

nstant-speed middle, and the last leg is the single arc into SAVINGS. Pins pop with ring pulses, pills wipe out from their pins, and the balance rolls 3,200 → 1,950 → 1,540 → 1,444 → 844 with coral flashes (gold for savings, plus the label roll to LEFT TO SPEND). The credits wipe in and out with the green edge line.
3. **Beat 4:** the view pulls back to 100% and the balance wipes off. The map un-draws, pins and pills retract, the route un-draws into the gold dot, and the title line draws while the gold dot glides to its end.
4. **Beat 5:** the letters of "Ledgerline" rise from behind the line, the tagline wipes in with its line, then AVAILABLE NOW, then one gold pulse and the hold.

**Calls I made where the brief was silent or didn't fit together** (all recorded in `REVIEW.md`):
- **Grid vs. waypoints:** the waypoints don't all fall on a 160/140 px grid. I shifted the grid so most of them sit on streets and added two short lanes for the rest.
- **Labels closing early:** once the route leaves a stop, that stop's label closes back into its pin, then reopens for the pulled-back overview at 14.5 s. Otherwise old labels drifted into the credits or got cut off at the frame edge.
- **Shading behind credits:** a soft navy shading sits behind each credit so the route passing underneath doesn't hurt legibility.
- **The "g" in Ledgerline:** its tail stays hidden behind the line, because the brief makes the area above the line the mask.

**Weakest spot:** around 8–10 s the trailing route still passes behind the "featuring" credit. The shading keeps the text clean but the route dims there.

## Render command
```
npx --yes hyperframes@0.9.18 render --output out/video.mp4 --fps 30 --quality delivery
```

## What got in the way
- **Cropped descenders:** text reveals using `clip-path: inset(0)` cut off letter tails (the "y" in "Every"). I fixed it by padding the reveal boxes vertically.
- **Seeking backwards:** setting start states with `tl.set` at 0, or reusing `fromTo` on the same property, risks wrong states when the timeline is scrubbed back. I restructured the tweens so each property starts from one `fromTo` and only uses `to` after that.
- **Minus sign:** JetBrains Mono draws the minus sign (U+2212) the same as a hyphen. The text uses the correct character; it just looks like "-$96".
- **Fixed positions:** the credits and the route can't always avoid each other with the positions the brief fixes, which is why I closed old labels and added the shading.
- **Studio preview:** following the skill, I started the preview in the background before rendering and stopped it after. HyperFrames suggests the desktop app for further edits (download: https://hyperframes.studio/studio/download?os=linux&src=cli).
- **Speed:** each check, snapshot or render takes a few minutes on this machine because it renders in software, but it never blocked anything.

Files are in `/home/user/tools5/o/hyperframes`:
- `out/video.mp4`
- `index.html`
- `compositions/film.html`
- `REVIEW.md`
