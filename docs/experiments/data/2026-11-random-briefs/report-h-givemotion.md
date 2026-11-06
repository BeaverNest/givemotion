> Raw record: round 6, brief H, 2026-11-06. Versions: givemotion 0.1.3 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief H, givemotion

The final message of the maker session (last 3000 characters).

outward from the cursor and the screen opens from it. The depth counter glides from the corner into the slider readout. The cursor grabs the handle and drags it from 200 M to 1000 M; the card icons light up in turn, and ANGLERFISH gets its Biolume border.
- **Beat 4:** clicking the card makes its icon fly up and grow into the hero illustration while the other cards and the slider fall away. The detail panel slides up, the cursor clicks LOG SIGHTING (4 px press, ripple), and the toast springs up with its check mark drawing. The cursor then lands on the hero's lure.
- **Beats 5–6:** the phone sinks out from under the Dot in a stagger, and the counter goes back to its corner. The Dot returns to its beat-2 size and spot, pulses, draws the app icon and settles in the upper middle. HADAL rises letter by letter, the tagline types with a Biolume caret, and the pill scales in. The counter reaches 4000 M at 17.0 s and the last second holds.
- **Throughout:** the counter rolls like an odometer and never goes down, and the 40 snow dots drift upward the whole time.

**Render command** (from the project folder):
```
npx givemotion render video.html -o out/video.mp4 --quality high --motion-blur 4
```

**Where the brief contradicts itself, and what I chose:**
- **Counter vs. slider:** the brief has the counter reach 1000 M in beat 2, then has the slider readout roll from 200 M to 1000 M in beat 3. That would make the counter go backwards, which the Must list forbids. I kept the readout at 1000 M and had the handle dragged down from 200 M to meet it.
- **LIGHT. lighting:** LIGHT. has 6 characters but only 3 pulses are specified, so each pulse lights two characters, left to right.
- **Which card lights:** at 1000 M all three creatures' depth ranges include the handle. I light only the card whose range the handle has just entered, so the others still drop to Silt as the brief describes.
- **Hero size:** the beat-2 fish was too small and cramped to fill the top half of the phone. The hero is therefore larger and centred, so its lure isn't at the Dot's beat-2 spot; in beat 5 the Dot glides back there as the phone sinks.

**What got in the way:**
- I placed the detail panel's contents in screen coordinates inside an offset parent, so they rendered off screen until I spotted it in a still.
- The falling cards spilled past the phone outline; I fixed this by clipping the screen contents to the phone shape.
- A large drop combined with `back.out` overshot into the word above; I replaced it with an accelerating fall and a 16 px overshoot.
- `check` flagged every odometer digit as "short hold" until I marked the counter as intentionally quick.
- The docs disagree on whether motion blur is on by default, so I set it explicitly. The fast word drops still strobe slightly in a few frames (about 1.4 s, 2.0 s, 3.7 s and 4.3 s). I left that because they are meant to be hard, fast drops.

My working stills and the draft render are in `work/`, and the review sheets are in `review/`.
