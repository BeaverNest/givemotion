> Raw record: round 7, brief K2, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief K2, hyperframes

and its full stop is orange.
3. **Condense:** the vapour tips meet and turn into one white line that draws the five-bump cloud, while the vapour erases upwards into it. "Condense." squeezes from wide spacing to tight, squashes to 92% width and springs back. The cloud breathes twice, then presses down to 88%.
4. **Precipitate:** five drops fall with rain streaks and land squashed; the fifth is the hero, eyes and all. The letters of "Precipitate." fall in a scattered order and bounce once on landing. The four small drops slide over and merge into the hero, which swells with each one.
5. **Collect:** the river draws from the hero to three wave curves at the right edge, thickening from 8 to 14 px. The droplet rides along it, and "Collect." follows the curve before straightening. At 15.0 s everything drops to 30% and the 700 px loop draws clockwise through the sun, the cloud and the river. The arrowhead pops on and the loop pulses once.
6. **Lockup:** the droplet jumps into the loop. "The Water Cycle" slams in word by word, then "Infinitely refillable." slides up and the closing line types on. The droplet blinks at 17.0 s, and nothing moves from 17.4 s to the end.

I looked at about 70 still frames across every beat and handover, plus frames taken from the finished MP4. That caught two bugs, which I fixed: the cursor was in the wrong place, and the "Collect." letters overlapped on the river bends. I also moved "Condense." later so the vapour lines no longer cross it. My notes on the decisions are in `REVIEW.md`.

## Render command
```
npx --yes hyperframes@0.9.18 render --output out/video.mp4 --fps 30 --quality delivery
```

## What got in the way
- **Two parts of the brief pull against each other.** It wants the sun "in the top-right corner" and also a 700 px loop that runs through the sun, cloud and river. A circle that size can't reach the corner, so the sun sits in the upper right at about x=1250, on the loop's path.
- **Lockup size, my own call.** A 700 px loop with 160 px type below it doesn't fit in 1080 px. As the scene clears, I shrink the loop to 60% (the line stays 6 px thick) so it frames the droplet with the type underneath. Keeping it full size would mean the title runs across the ring.
- **Warnings I left in place:** no sound and the lockup lines being on screen under 2 s both come from the brief itself. The "file too large / use sub-compositions" warnings come from keeping one file, because the droplet is one character that runs through every beat.
- **Not perfect:** the moment the droplet turns into vapour (around 4.7 s) is a quick thin-and-fade rather than a clear three-way split. And "Collect." is a little loosely spaced while it travels along the river.
- **Small things:** the fonts were in `fonts/`, so I copied the two I used into `assets/fonts/`, where HyperFrames expects them. The CLI says version 0.9.19 is out; I stayed on the pinned 0.9.18. I didn't send the CLI's optional feedback report, because it posts to a public channel.
