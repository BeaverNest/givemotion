> Raw record: round 6, brief I, 2026-11-06. Versions: givemotion 0.1.3 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief I, remotion

The final message of the maker session (last 3000 characters).

atch strokes, eight streets and a bridge. The three pins drop with an 8 px overshoot and the chip slides in. The dashed 6 px Brass route draws with a leading dot while the camera pans 140 px. Each pin pulses when the route reaches it and its time writes on. "follow the brass" writes along the curve of the route, and "across the river" writes below the bridge as the route crosses. Then everything except the route fades to 15%.
4. **Staff.** The route straightens and splits into five lines 22 px apart. The pins slide onto the staff and turn into note heads with Ink stems. The words drop in with gaps of 10, 5 and 10 frames, each at a rising staff height, and a note bobs as each one lands. A Midnight flood with a boiling edge then spreads out from the last note.
5. **End card.** The moon redraws in Brass. "LOW MOON" rises in letter by letter, "Jazz Festival" writes on, the date fades in, and six stars appear and boil. From 19.0 s only the boil moves.

All lines use a small sketch library I wrote for this. Strokes wobble and get a second, thinner pass so their width varies between about 3 and 5 px. Every line cycles through 3 jittered versions every 3 frames, and rectangles overshoot their corners. Only the six palette colours are used, and the only fonts are Caveat and Space Grotesk, loaded from `fonts/`.

## Render command
```
npx remotion render LowMoon out/video.mp4 --codec=h264
```

## What got in the way, and where I bent the brief
- **Phone at 2.2× doesn't fill the frame.** 460 px × 2.2 is only 1012 px wide, so the phone's sides can't pass the frame edges. I scale it to 2.2× while moving it to the centre, fade its outline out, and fade the full-frame map in around it. The map inside the phone is drawn at 1/2.2 scale, so it lines up with the full map exactly at the end.
- **Phone rows are on two lines.** The schedule rows don't fit on one line at the 26 px minimum UI size. Each is split after the stage name ("19:30 Harbour Stage," / "The Velvet Tides"); the wording is unchanged.
- **Type briefly crosses the safe margin in the beat 1 push.** The brief asks for the poem line to slide out of frame as the camera moves in, so it does cross the 96 px margin. I fade it out within about 6 frames to keep that short.
- **Overlaps fixed after review.** Looking at my own frames, I moved the pin times above the pins and moved two labels so they don't collide with the route. I also added a thin Paper outline behind map text where streets cross it, and fixed the last letter of "Jazz Festival" being clipped by the reveal mask.
- **Studio not used.** The docs say to open Remotion Studio, but nobody was watching a preview here. I checked my work by rendering single frames with `npx remotion render --frames=…` and making contact sheets instead.
- **Setup changes.** I added `@remotion/fonts`, `@remotion/paths` and `@remotion/layout-utils` with `npx remotion add`, and limited `tsconfig.json` to `src/` because the example files inside `skills/` failed the type check.
