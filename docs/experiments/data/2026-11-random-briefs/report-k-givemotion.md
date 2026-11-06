> Raw record: round 7, brief K, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief K, givemotion

from the top on impact. "Precipitate." letters fall in shuffled order and bounce once. The small drops slide along the horizon and merge into the hero, which swells with each one.
- **Beat 5:** the river draws from the hero to the right edge, 8 px growing to 14 px, and ends in three sea waves. The droplet rides it and squashes at the bends. "Collect." flows along the river's curve, then levels out. At 15.0 s everything dims to 30%, the 700 px loop draws clockwise, the arrowhead pops on with a squash and the loop pulses.
- **Beat 6:** the droplet jumps into the loop and lands with a squash. The title slams in word by word, the tagline slides up, the closing line types on, and the droplet blinks at 17.0 s. Nothing moves from 17.4 s to the end.

Every line draws itself and erases along its path, with round caps and joins. Only the brief's colours, copy and fonts are used; the fonts load from `fonts/`.

## Render command
```
cd /home/user/tools5/k/givemotion && npx givemotion render video.html -o out/video.mp4
```

## Process
I followed the docs' loop: check, snapshots, two `review` passes, and an independent critic sub-agent that saw only the frames. The critic's valid findings were all fixed:
- the droplet faded out instead of splitting into the vapour;
- the river ignored the 30% dim;
- the INTRODUCING wipe never ran;
- "Condense." ran off the right edge;
- the "Collect." letters collided;
- the river tangled with the horizon line;
- the hand-over into the lockup was cluttered.

## Things that got in the way
- **Letter-spacing start values come out doubled.** A start value of `letterSpacing: '0.6em'` (or `'84px'`) in a `gm.timeline` `fromTo` measured as about 170 px. I had to write `'42px'` to get the 84 px that +60% means.
- **`clipPath` tween didn't run.** A `clipPath: inset(...)` tween on the INTRODUCING line had no effect, so I drive that wipe from `gm.onFrame` instead.
- **Stagger as a function misbehaved.** With `stagger: (i) => …` on a `fromTo`, some "Precipitate." letters showed from frame 0. I replaced it with one tween per letter.
- **Two false check errors.** `check` reported `expect-failed` while all the letters were hidden but their container still had full opacity, so I fade the containers too. It also reports `layout-shift` on the "Collect." letters, which my per-frame code moves on purpose.
- **Departures from the brief:**
  - At the lockup the loop shrinks to about 300 px and wraps the droplet like a product mark. At 700 px it would cut through the 160 px title.
  - The loop passes through the cloud and the river but can't reach the sun: a 700 px circle can't touch both the cloud and a sun in the top-right corner.
  - I added a slow turn of the sun's rays as background motion.
- **Short holds remain.** `check` still warns about short holds on "Precipitate.", "Collect." and the final lockup. Those come from the brief's own timings (for example, everything dims at 15.0 s, less than a second after "Collect." settles), so I left them.
