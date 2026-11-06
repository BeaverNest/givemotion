> Raw record: round 7, brief L2, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief L2, hyperframes

.45 | 0.40 | 2.5 px |
  | Back | 0.45× | 0.65 | 0.55 | 1.2 px |
  | Mid | 0.7× | 0.85 | 0.75 | 0.5 px |
  | Hero | 1.0× | 1.0 | 0.9 | none |
  | Foreground | 1.6× | 2.4 | 0.55 | 18 px |

  They carry marine snow, lanternfish schools, siphonophores, pulsing jellyfish with rippling tentacles, and big out-of-focus foreground passes. The foreground layer sits above the text, so creatures pass both in front of the type and behind it.
- **Beat 1:** the counter rolls 0 → 4,000 M with an ease-in. The axis then draws down and the counter slides to sit at its base.
- **Beat 2:** a chart tilted 8° on the Y axis, with the world dimmed to 40%. Bars grow 0.4 s apart with 2.5% overshoot, to 100%, 1% and an empty 0% with a coral glow pulse. The camera then pushes into the Midnight row and the chart blurs past the lens.
- **Beat 3:** "LIGHT ENDS." darkens letter by letter, 60 ms apart. "LIFE DOESN'T." is built by 12–20 cyan points per letter swimming in on curved paths, and the apostrophe lights last in coral. A blurred foreground jellyfish crosses the line, then the letters burst back into rising points.
- **Beats 4–5:** one coral point carries straight through: it becomes the lure, a stalk draws out of it, and the ring draws clockwise. A faint anglerfish appears inside the ring for about a second, and ABYSSAL slides out from behind the mark. Then the header, the rule and the tagline set in, the lure pulses at 16.0 and 17.2 s, and the three circling creatures slow almost to a stop.

**Render command** (run from `/home/user/tools5/l2/hyperframes`):
```
npx --yes hyperframes@0.9.18 render --quality delivery --fps 30 -o out/video.mp4
```

**What got in the way**
- **Contradictions in the brief:**
  - **1% bar:** a true linear scale where 100% = 1,000 px makes 1% a 10 px bar, not the 6 px sliver the brief describes. I kept the linear scale because it's a Must.
  - **Counter position:** the counter is 64 px from the top but 96 px from the left, because 64 px from the left would break the 5% title-safe margin (also a Must).
  - **Tagline layout:** I set it as two stacked lines so the darkened "LIGHT ENDS." never overlaps "LIFE DOESN'T.".
- **Check warnings I left in place:**
  - Silt Grey on Abyss Black has a contrast of 4.41:1, just under the 4.5:1 the check wants for small text, but the palette is fixed.
  - The 20 px and 22 px labels are below the check's 28 px minimum, but those sizes come from the brief.
  - It flags the film as silent, which the brief asks for.
  - It says the "200–1,000 M" label is on screen too briefly. That's a false alarm: the label is up from 3.4 to 7.0 s.
- **Fonts:** text inside a scene measures as zero width when the script first runs, so I lay out the letters from font measurements instead. That also puts the tagline's coral point exactly where the logo's lure starts.
- **Render time:** the machine has only software graphics, so the render took about 7.5 minutes.

The working notes are in `SPEC.md` and `REVIEW.md` in the project folder.
