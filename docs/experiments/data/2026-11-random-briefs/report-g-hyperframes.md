> Raw record: round 5, brief G, 2026-11-06. Versions: givemotion 0.1.3 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief G, hyperframes

The final message of the maker session (last 3000 characters).

then breaks into cream particles sampled from its actual letters. They drift up like smoke. "no roar" arrives with an 8-frame shake, shrinks, turns cyan and collapses to a point. The point bursts into 80 sparks that build "just current" letter by letter. Those letters then stream as sparks into the mast arm, which flashes.
- **Charging:** the cable draws and SHORE POWER types on. Eight speeding-up pulses travel the cable and light the windows bow to stern while "plugged into the shore" drops in word by word. Then FULL flickers in, a 120-particle amber and cyan burst fires, and the cable retracts.
- **Crossing:** the ferry glides right as the pier slides off, with three wake arcs behind it. "we cross" spreads its letters as it tracks. The dotted route arcs to a far pier that draws itself. A zigzag strikes "lightning", which turns cyan and throws 30 sparks.
- **Homecoming:** "quiet water" settles on the waterline with a rippling 25% reflection. It dissolves into amber particles that become 14 twinkling harbor lights, and "carries us home" assembles. The windows glow once on "home". Then the ferry, wake, route and far pier un-draw, and the last 6 frames hold still.

**Render command** (run from `/home/user/tools5/g/hyperframes`):
```
npx --yes hyperframes@0.9.18 render --output out/video.mp4 --fps 30 --quality delivery
```

**What got in the way**
- **The brief's own timings break its 1-second rule.** With the sub-beat times as written, "no smoke", "no roar" and "just current" would each be fully readable for only about 0.4–0.5 s. I kept the five beats and their order but shifted times inside them by up to about 0.9 s, so every line gets 1.0–1.5 s at full opacity and no two lines overlap. `REVIEW.md` lists every shift.
- **The last line is short of the tool's 2-second guideline.** "carries us home" is complete for about 1.0 s, because the brief puts the ending at 16–17 s. The check warns about this; I left it as is.
- **My first mast looked like a gallows.** The upright, arm, diagonal brace and hanging drop made that shape, which I only saw in the frames. I redrew it as a curved arm ending in a connector box.
- **The check fails on animated letter-spacing.** It rejects that, so the "we cross" spacing effect moves each letter outward instead, which looks the same.
- **Warnings I kept on purpose:** no audio (the brief asks for none), the 22 px labels (the brief sets that size), and the file being large. One scene file is simpler here because the strokes, text and particles all interact across the whole film.
- **Smaller notes:** fonts were copied into `assets/fonts/`, which is where the tool expects them. I installed hyperframes 0.9.18 into the project's `node_modules` only to read how its runtime hides clips. With nobody here to approve a preview, I skipped the docs' step of opening the editor before the final render.

Files are in /home/user/tools5/g/hyperframes:
- `out/video.mp4`
- `index.html`
- `compositions/harbor.html`
- `SPEC.md`
- `REVIEW.md`
