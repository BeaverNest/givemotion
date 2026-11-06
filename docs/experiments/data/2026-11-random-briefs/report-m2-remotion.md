> Raw record: round 7, brief M2, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief M2, remotion

cked digits turn Coral one by one, the decimal point pulses, and the Mustard counter rolls. OCTOPUSES then narrows back into the spine while the wall rebuilds around it.
4. **The walk:** a bottom-to-top wipe turns the wall into a floor plan, and the spine becomes the dot. A Teal path makes five right-angle turns, with a "÷10" popping at each, while the headline snaps in above. Everything then dims to 20% and the dot drifts to the centre.
5. **The line:** the dot stretches into a bar that sweeps across and reveals the three lines with a slanted edge. The bar tips over and settles as the underline, and the last 36 frames are a completely still hold.

All four scene changes are seamless: I compared the frames on either side of each cut pixel by pixel.

**Render command** (run from `/home/user/tools5/m2/remotion`):
```
npx remotion render AddressOfEveryBook out/video.mp4
```

## How I checked it and what I fixed
There was no one to watch Studio, so I rendered still frames and contact sheets of the encoded video and fixed what I saw:
- **Cut-out letters didn't read:** the spines were short, so the letters mostly showed Ink. I made the spines tall and seated each line of type exactly inside one shelf row.
- **Bar crossed the text:** the bar swung diagonally across the last lines on its way to becoming the underline. It now tips over into the empty space on the right, then slides left into place.
- Smaller fixes: band digits floating over the Coral field, the counter's old value sliding back into view as it exited, spine tops poking above their shelves, a grey midpoint in the number's colour change, and the underline settling one frame late.

## Where the brief didn't add up
- **Outro type size:** "YOU CAN WALK INTO." at about 190 px would break the 80 px side margin. I kept the margin and set all three lines at the size that fits, about 148 px.
- **Opening type size:** "A MILLION" at about 250 px doesn't fill the width the brief asks for. I filled the width, which makes it about 300 px.
- **Typing timing:** one character per frame for "DEWEY DECIMAL CLASSIFICATION" takes 28 frames, longer than the 0.6 s window. It finishes at about 6.9 s.
- **SCIENCE starts early:** the first level only lasts 1 s, so SCIENCE rises as the band lands, about 0.2 s before 8.5 s. That gives it about a second on screen.

## What got in the way
- **Studio:** the docs say to open Remotion Studio and keep it running, but with no viewer I checked my own rendered frames instead.
- **Browser setting:** the render docs say not to set a browser executable, but the provided config sets one so rendering works offline. I left it as it was.
- `npx tsc` reports errors only in the agent docs' own example files under `skills/`; my code under `src/` type-checks cleanly.
- `render --frames` with a range like `714-749` writes a video, not PNG frames.
- Chrome rescales clip-path insets when opposite sides add up to more than 100%, which leaked slivers of hidden layers until I worked around it.
