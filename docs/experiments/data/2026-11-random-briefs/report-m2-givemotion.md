> Raw record: round 7, brief M2, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief M2, givemotion

shing the others out, and nine dividers redraw it into ten. The decimal point pulses before CEPHALOPODS. OCTOPUSES holds, then narrows back into the spine at its exact starting position while the wall rebuilds around it.
- **Beat 4:** a bottom-to-top wipe turns the wall into the floor plan and the spine shrinks into the 32 px dot. The Teal path walks five right-angle turns with a "÷10" pop at each, while the headline builds word by word. Everything except the dot then dims to 20% and the dot drifts to the centre.
- **Beat 5:** the dot stretches into the 40 px bar and its sweep reveals the three lines, each 5 frames behind the one above. The bar then turns 90° into the 12 px underline, followed by a still hold to the end.

**Render command** (run from `/home/user/tools5/m2/givemotion`):
```
npx givemotion render video.html -o out/video.mp4
```

**How I worked:** I followed the skill docs: style frames as stills, `check` as I went, then `review`. Two outside critics who had seen only the brief and the frames reviewed it, with a round of fixes after each. The final `check` shows 0 errors. The 6 warnings left are things the brief asks for: the 10-frame "÷10" pops, the persistent counter, and the still final hold.

**Departures from the brief, and what got in the way:**
- **The brief contradicts itself in a few places, so some sizes and timings are compromises:**
  - "YOU CAN WALK INTO." cannot be ~190 px and stay inside the 80 px margins. The closing lines are 148 px.
  - The knockout lines are 266 px, centred, so the 115% stamp stays inside the margins. They don't quite fill the width.
  - The card number is 172 px, so its widened version still fits the card.
  - 28 characters at one per frame need 0.93 s, so the Dewey label types from 5.9 to 6.8 s rather than inside 6.0–6.6 s.
  - Each Beat 3 level needs at least 0.6 s for its 9 staggered dividers on top of the 0.6 s reading time. Levels 2–5 therefore start about 0.3 s after their brief times, with the redraw leading straight into the next pick.
- **Other choices I made:**
  - The Beat 2 card sits at 54% of the frame height instead of exact centre, so five headline lines fit above it.
  - The "÷10" pops have a small Ink plate behind them so they read over the shelving.
  - I count the "fifth row" from the entrance at the bottom.
- **Engine issues:** givemotion's motion-blur option either doesn't apply to code that sets positions frame by frame, or left stepped ghost copies of the type. I rendered without blur and softened the fastest moves instead. Its own motion-smoothness score stayed low (4.7/10) because of the fast camera push and word slides.
- **Weak spots I know about:**
  - The knockout title is low contrast. Slate seen through Ink is all the palette allows.
  - The counter's digits look jumbled for a few frames mid-roll.
- **Files:** working stills and test renders are in `work/`. The last review pass is in `review/` and the render cache in `out/.gm-parts`. All of these are safe to delete.
