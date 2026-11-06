> Raw record: round 6, brief I, 2026-11-06. Versions: givemotion 0.1.3 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief I, hyperframes

The final message of the maker session (last 3000 characters).

to the phone outline.
2. **App (3–8 s):** a sketched phone app with a crisp cursor. It clicks SAT (red ring, brass underline), the rows slide in, and it clicks "+ Add" three times; each flips to "Added" and a brass check draws on. Then it presses "Plan my route". Poem lines 2 and 3 write on at x = 1080.
3. **Map (7.3–13 s):** the phone screen wipes to a map and the outline scales 2.2×. Three red pins drop in and the route chip slides in. The dashed brass route and its lead dot draw from pin to pin while the camera pans 140 px. "follow the brass" writes along the route's curve and "across the river" writes under the bridge. Everything except the route then fades to 15%.
4. **Staff (13–17 s):** the route pulls straight and splits into a five-line staff 22 px apart. The pins become red note heads with ink stems. "until the streets swing" lands word by word with gaps of 10, 5 and 10 frames, then a Midnight ink flood spreads from the last note.
5. **End card (17–20 s):** the moon redraws in brass, then LOW MOON, "Jazz Festival", the date and six stars appear. From 19 s only the boil moves.

Every sketch line boils between three jittered versions every 3 frames; I confirmed this by measuring pixel changes in the rendered end-card hold. The text doesn't boil. `npm run check` passes.

**Render command** (from `/home/user/tools5/i/hyperframes`):
```
npx --yes hyperframes@0.9.18 render --quality delivery --fps 30 -o out/video.mp4
```

## What got in the way
- **Strokes appeared all at once.** The registry's hand-drawn helpers move a whole group rather than redrawing each line, so I wrote my own small library (`assets/sketch.js`). Its first version drew strokes with several segments (skyline, windows, map ticks) almost instantly, because SVG restarts the dash pattern on every segment. I found this in the review frames and rebuilt the drawing so the pen goes through the segments in order.
- **Two layout calls the brief forced:**
  - "the night chooses the song" doesn't fit between x = 1080 and the 96 px right margin at 84–96 px, so it wraps after "chooses".
  - Dashed lines inside the river made it read like a road, so I gave it a 12% River Blue tint (opacity only) and wave strokes instead.
- **Two check warnings I kept on purpose:** one for having no sound, which the brief requires, and one because the date line is on screen for about 1.6 s rather than 2 s, since the brief starts it at 18.4 s.
- **Smaller fixes:** I raised the 26 px UI text to 28 px so it passes the readable-on-a-phone check (still within the brief's 26–40 px). I tightened the swing gaps on "the night chooses the song" so "song" finishes before the handover, and moved the star timing so only the boil moves after 19 s.

The weakest moment is beat 4, which is fairly sparse: one thin staff across a mostly empty frame. Also, the line sweeping up into the beat-1 moon bulges near the right edge for about half a second before it retracts. `REVIEW.md` has the full notes and `SPEC.md` the shot plan.
