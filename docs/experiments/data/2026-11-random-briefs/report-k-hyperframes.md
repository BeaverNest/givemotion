> Raw record: round 7, brief K, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief K, hyperframes

precipitate`, `collect`, `lockup`), so the copy stays easy to edit.
- **The beats, as the brief describes them:**
  - The horizon draws out from the centre and the droplet drops onto it, squashing to 135/70 and settling with two smaller bounces.
  - "INTRODUCING" types in with a block cursor, and the droplet blinks at 2.2 s.
  - The sun draws clockwise and its rays stagger out. The droplet stretches, lifts off and splits into three beads that draw the vapour paths.
  - "Evaporate." rises out of the horizon line, with the full stop in orange.
  - The cloud draws in one stroke while the vapour erases up into it. "Condense." squeezes from +60% to −2% tracking and the cloud breathes twice, then gets pressed like a sponge.
  - Four small drops and the hero fall with rain streaks, and "Precipitate." lands letter by letter in a fixed random order. The small drops then slide in and merge into the hero.
  - The droplet rides the river as it draws, and "Collect." follows the curve before straightening into a level word.
  - The 700 px loop draws through the sun, cloud, rain and river, the arrowhead pops on and the loop pulses.
  - The droplet jumps into the loop, "The Water Cycle" slams in word by word, then the subline and the closing line. The droplet blinks at 17.0 s.

**Two layout decisions the brief didn't specify:**
- **Loop position:** I placed the sun, cloud, rain and river on one 700 px circle so the loop really passes through all four stages. The catch is that the sun sits a bit inside the top-right corner rather than right in it.
- **Lockup:** the loop shrinks to 300 px and becomes a ring around the droplet. At its full 700 px, the 160 px headline wouldn't fit inside or below it.

## Render command
```
npx --yes hyperframes@0.9.18 render --quality delivery --fps 30 -o out/video.mp4
```

## What got in the way
- **"Collect." on the river:** the letters tangled badly on the river's bends. I made the curves gentler, seated each letter across its own width on the path, and loosened the spacing while it rides. It reads clearly now, but neighbouring letters still overlap slightly in the dips.
- **Rain vs. text:** "Precipitate." is 764 px wide and collided with the rain, so I moved the cloud and rain 60 px right of centre.
- **Animated letter-spacing:** the linter rejects it, so the "Condense." squeeze moves each letter instead. It looks the same.
- **Warnings left on purpose:**
  - "No sound": the brief asks for no audio.
  - "Closing lines on screen too briefly": the brief fixes the lockup at 16–18 s.
  - "Stage file is long": it's one file so the lines carry across beats.
- **Snapshot glitch:** one preview snapshot once showed the horizon missing at 0.9 s. It didn't happen again, and the rendered video is fine at that moment.
- **Weakest spot:** the cloud stroke starts as a straight run along its flat bottom, so the vapour doesn't really "curl" into it.

My notes on what I'd improve are in `REVIEW.md`, and the timing and layout plan is in `SPEC.md`.
