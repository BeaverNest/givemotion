> Raw record: round 6, brief I, 2026-11-06. Versions: givemotion 0.1.3 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief I, givemotion

The final message of the maker session (last 3000 characters).

 the map takes over the frame.
3. **8–13 s:** The map has the River Arden, about ten streets and a bridge. Three red pins drop with a small bounce and the route chip slides in. A dashed Brass route draws behind a lead dot while the camera pans 140 px; each pin pulses and its time writes on. "follow the brass" writes along the route's curve, and "across the river" writes as the route crosses the bridge. Then the map fades to 15%.
4. **13–17 s:** The route pulls straight and splits into a five-line staff 22 px apart. The pins slide on and become red note heads with stems. "until the streets swing" lands on rising staff lines in 10/5/10-frame swing, the note heads bob, and the words sway slightly. A Midnight ink flood with a wobbly edge spreads from the last note head.
5. **17–20 s:** The Brass moon redraws, LOW MOON rises letter by letter, "Jazz Festival" writes on, the date fades in and six stars appear. From 19–20 s only the line boil moves.

Every drawn line boils (three drawings, changing every 3 frames); type and the cursor do not. Only the brief's six colours, two fonts and listed copy are used.

## Render command
```
npx givemotion render video.html -o out/video.mp4
```
(run from `/home/user/tools5/i/givemotion`)

## What got in the way, and two deviations from the brief
- **The brief's own numbers don't fit in two places.**
  - Poem line 3 at 84–96 px, starting at x = 1080, runs past the 96 px right margin (it measured to x = 1881). I kept the margin and wrapped it as "the night chooses / the song".
  - A 460 px phone at 2.2× is about 1,012 px wide, so it can't pass the left and right edges. I kept 2.2× (it passes top and bottom) and faded the outline as the map opened to the full frame.
- **Lingering elements:** shapes that were drawn on later stayed visible even after their layer was hidden, which left a beat-1 window and the phone's row boxes on screen. I fixed it by hiding layers with opacity instead.
- **Stray dots:** the overhangs of "J" and "y" showed before their words were written. I fixed the reveal so nothing shows early.
- **Thick strokes during the zooms:** the stroke-width setting meant to keep lines thin had no effect while the phone was scaled. I moved the phone outline's scaling into SVG so it stays 4 px; the skyline still thickens a little while it fades.
- **A second review:** a fresh agent given only the brief and the frames flagged the thick strokes, the line-3 margin, the pin-to-note-head ghosting, "22:45" showing too briefly and "Jazz Festival" finishing late. I fixed all of these and checked the result frame by frame.
- **Remaining check warnings (12):**
  - Text-over-line on the map and staff text. These are by design: each has a paper-coloured outline behind the letters, which the checker doesn't account for.
  - Short reading time before the 7.3 s hand-over.
  - A "still" ending, which is the hold the brief asks for.
  - No timing assertions (`data-expect`) on the elements; I checked the beat times by eye instead.
