> Raw record: round 7, brief M2, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief M2, hyperframes

es, "DEWEY DECIMAL CLASSIFICATION" types on, and the digits of 594.56 spread apart. The number then docks at the top while the coral field squeezes into band 5.
3. **The bands (8.5–16.5 s):** five levels. At each one a digit lights coral, the category name rises inside its band, the counter rolls up, and the chosen band fills the stack and splits into ten again. The OCTOPUSES band then narrows back into the spine, and the wall rebuilds around it.
4. **The walk (16.5–21.6 s):** the wall wipes into a floor plan. A teal path makes five turns to the coral dot, with a "÷10" at each turn, while the headline builds at the top. Everything else dims and the dot drifts to the centre, then stretches into the bar.
5. **The line (21.6–25 s):** the bar sweeps across and reveals the three closing lines, with each line starting 5 frames after the one above. It then turns into the underline, followed by a still hold.

The coral shape is one continuous element throughout. At each of the four scene changes (4.0, 8.5, 16.5 and 21.6 s), the frames on either side show the same shape in the same place. The opening wall is generated from a fixed random seed, so the rebuilt wall at 16.5 s is identical to the first one.

`npm run check` passes with 0 errors. The warnings left are deliberate:
- **No sound:** the brief asks for none.
- **Low contrast:** on the band digits (the brief specifies Paper at 60% on Coral), and on category names measured while they are hidden.
- **Short on screen:** two elements that carry over from one scene into the next.

## Render command
```
npx --yes hyperframes@0.9.18 render --fps 30 --quality delivery -o out/video.mp4
```

## Where I departed from the brief, and what got in the way
- **Outro lines are 148 px, not about 190 px.** At 190 px "YOU CAN WALK INTO." would be about 1160 px wide and break the 80 px side margins.
- **"A MILLION / BOOKS." is 306 px, not 250 px**, because the brief also asks the text to fill the width.
- **The label card is 820×420, not about 760×420**, so the widened 594.56 still fits inside it.
- **Levels 2–4 start up to about 0.7 s late.** Each split into ten has to finish, and each category name has to stay readable for at least 0.6 s, before the next level can start. The last level still lands on time at 14.5 s.
- **The underline turns differently.** The bar shrinks, turns 90° and then extends, because a plain rotation swept it diagonally through the words.
- **A bug I fixed:** the browser shortens symmetric shape values (e.g. `inset(944px 524px round 16px)`). That broke some animations that start from the element's current state, and the dot-to-bar morph briefly became a wide block. I gave every such animation explicit start and end values.
- **Weakest moment:** in the opening "A MILLION / BOOKS.", grey spines showing through dark letters on a dark panel read at only moderate contrast. Teal spines and the shelf lines help, but it is the softest frame.

Notes are in `SPEC.md` and `REVIEW.md` in the project folder.
