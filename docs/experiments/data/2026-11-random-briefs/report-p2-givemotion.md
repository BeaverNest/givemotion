> Raw record: round 8, brief P2, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief P2, givemotion

t squares stream into the card's outline and make it flicker. Mint sparks pop at each thousand on the way to 3,917. The carousel slides the card's contents inside a fixed window, with a sideways blur on the fast part of the slide. The 600 px line draws out from the centre and uncovers `21 HOURS OF TYPING SKIPPED` letter by letter.
- **Handoff to Beat 4:** a 20° diagonal wipe with an amber edge clears everything.
- **Beat 4:** the amber `37` rises out of a mask and jitters, then breaks into 120 amber shards. They turn mint in flight and rebuild the `37`, and the dots near the centre pulse mint. A bar swaps `weak passwords` for `fixed`, then the whole group closes to the centreline like a vault door.
- **Beat 5:** the same seam opens into `0`. The `0` shrinks into a padlock drawn around its lower half, and the shackle drops 40 px in 4 frames with a squash. On contact come 80 particles, a shockwave ring and a ripple through the grid, then `Locked tight.` and `See you in 2027.` Particles drift and the lock glows through the last frame.

**Render command** (run from `/home/user/tools5/p2/givemotion`):
```
npx givemotion render video.html -o out/video.mp4
```

**How I checked it:** I used `givemotion check`, contact sheets, frame-by-frame strips and two `review` passes. I also had a separate sub-agent critique the frames against the brief without seeing the code. It found real problems, and I fixed them:
- The counters were zero-padded (`0,963`), which showed text the brief doesn't allow.
- `fixed` and `weak passwords` touched mid-swap and read as one word ("fixewords").
- The card outlines were cut off during the carousel, and the slide strobed.
- The Beat 5 label wipe started late, and the padlock body enclosed the whole `0` rather than its lower half.
- The streaming particles, sparks and grid were too faint to read.

**What got in the way:**
- **Timings in the brief that conflict:**
  - `fixed` can't be fully on screen for 1.0 s inside the 12.0–12.6 wipe and the 13.1 close. It is complete by about 12.55 and still readable partway into the close.
  - `21 HOURS…` and `See you in 2027.` only get about 1.0 s each, so the tool's hold check still warns about them. So does the kicker, at about 1.6 s.
  - The tool also warns about frame 0 being pure navy, which the brief asks for.
- **The grid is dim by design.** `#232A63` dots at 25–70% opacity barely show against the navy. I widened the wave and added a faint mint tint (at most 10%) to the dots at its crest so the breathing reads, and kept the base colour as specified.
- **Places I interpreted the brief:**
  - The rising band leaves Beat 1 visible above it and uncovers Beat 2 below it.
  - In the carousel, the card frame stays still as the window and only the contents slide.
  - The counters count with normal comma grouping.
- **Two bugs of my own, both fixed:** a JavaScript syntax error, and the label rise animations and the wipe clips fighting over the same property, which left stray letters on screen.
