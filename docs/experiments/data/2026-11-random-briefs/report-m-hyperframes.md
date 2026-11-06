> Raw record: round 7, brief M, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief M, hyperframes

k slides out. The camera then pushes in until the book's small label becomes the label card.
2. **Address (4.0–8.5 s):** "594.56" rises into the card. The headline words slide in from alternating sides, "DEWEY DECIMAL CLASSIFICATION" types on one letter per frame, and the digits spread apart. The number then docks at the top while the coral background squeezes into band 5 of the next scene.
3. **Levels (8.5–16.0 s):** five levels. At each one the digit turns coral, the category name rises inside its band, and the "1 IN …" counter rolls up. The chosen band then fills the stack and nine divider lines split it into ten again. The decimal point pulses before the fourth level.
4. **Walk (16.0–21.6 s):** the OCTOPUSES band narrows back into the coral book, in its original spot, as the same wall rebuilds around it. A bottom-to-top wipe turns the wall into a floor plan and the book becomes a dot. A teal path draws from the door with five turns, and "÷10" pops at each turn. Everything then dims and the dot drifts to the centre and becomes a bar.
5. **Line (21.6–25.0 s):** the bar sweeps across to reveal the last three lines, folds into an underline, and the frame holds still from about 23.85 s.

`npm run check` passes. Three kinds of warning are left, all deliberate: the film has no sound (the brief says no audio), some words are on screen briefly (the 10-frame "÷10" pops the brief asks for, and band digits that leave during transitions), and two contrast readings are on digits that are clipped out of view.

**Render command** (run from the project folder):
```
npx --yes hyperframes@0.9.18 render --quality delivery --fps 30 -o out/video.mp4
```
It took about 2 min 35 s.

**What got in the way, and where I departed from the brief**
- **Some sizes in the brief can't all be met at once.** At 190 px, "YOU CAN WALK INTO." is 1,173 px wide and would break the 80 px side margins, so the closing lines are 147 px. "A MILLION" is 300 px rather than 250 so that it actually fills the width, as the brief also asks. "594.56" is 170 px rather than 190 so it still fits inside the 760 px card once the digits spread apart.
- **The level timings don't fit the brief's windows.** Nine divider lines at a 2-frame stagger, plus at least 0.6 s to read each name, don't fit into the 1.0 s first level. From level 2 on, each level starts about 0.4 s later than the brief says. Every category name and counter is still readable for at least 0.6 s.
- **The typing runs slightly long.** One letter per frame for 28 letters ends at about 6.83 s instead of 6.6 s.
- **Weakest moment:** around 16.0–16.3 s the slate bands collapse while the wall rises under them, which looks busy for a few frames.

Nothing else blocked the work. GSAP loaded from `vendor/`, the fonts from `assets/fonts/` (copied from `fonts/`), and none of my own files load anything from the network. I didn't watch the video on an actual phone.

Files are in `/home/user/tools5/m/hyperframes`:
- out/video.mp4
- SPEC.md
- REVIEW.md
