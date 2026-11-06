> Raw record: round 6, brief J, 2026-11-06. Versions: givemotion 0.1.3 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief J, hyperframes

The final message of the maker session (last 3000 characters).

The video is finished and rendered to `/home/user/tools5/j/hyperframes/out/video.mp4`. ffprobe confirms H.264, 1920×1080, 30 fps, 570 frames, exactly 19.000 s, with no audio track. I checked nine frames pulled from the rendered file across the whole 19 s, and they match the preview snapshots.

**What I built**
- **Two layers.** `index.html` holds two full-length scenes: a moving background (`compositions/ambient.html`) and the five beats (`compositions/story.html`).
- **Background.** It never stops: 7 wavy contour lines, 40 rising flecks, and the soft Tide glow drifting from upper left to lower right. It is computed from timeline time with fixed random seeds, so every render is identical.
- **The amber dot.** All five beats are one continuous shot in one file, so the dot is a single element from 1.4 s to 19.0 s. It goes cap → lid → pin → route dot → cap → orbit. A virtual camera handles the 3→1 pull-back and the pan and zoom over the map.
- **Map.** A loose street grid with two diagonal avenues, a river from top left to bottom right and two bridges. The route turns at right angles, reaches SORT at 8.8 s and REMAKE at 10.6 s, and closes into a loop at YOUR CURB.
- **Bottle match cut.** The beat 4 bottle uses exactly the same outline as beat 1. During the morph the dot rides the loop's opening, which becomes the bottle mouth, so it lands as the cap.
- **Lockup.** I placed the RETURN ROUTE letters by measuring Bebas Neue's letter widths, so the 150 px Regrowth ring sits exactly where the "O" goes.
- **Notes.** `SPEC.md` has the numeric plan and `REVIEW.md` has the review notes.

**Render command** (run from the project folder):
```
npx --yes hyperframes@0.9.18 render --quality delivery --fps 30 --workers 2 --output out/video.mp4
```

**What got in the way**
- **Morph tool.** The bundled GSAP morph plugin twisted the loop through itself on the way to the bottle. I replaced it with my own point-by-point morph.
- **Memory.** The machine killed a process for lack of memory during one snapshot run. I rendered with 2 workers instead of the default, and it took 32 s.
- **Two bridges, not one.** A closed loop has to cross a river that spans the frame twice. The outward route uses one bridge, as the brief says, and the return uses the second one the brief already asks for.
- **Warnings left on purpose.** `check` reports no errors. Four warnings remain, all deliberate:
  - frame 0 is a plain colour, because the brief asks for a fade up from Deep Harbor;
  - the film is silent, as the brief asks;
  - the tagline is on screen for 1.93 s against the tool's 2.0 s minimum, because the brief fixes it at 17.0–17.9 s;
  - `story.html` is flagged as long, because all five beats share one file to keep the dot continuous.
- **Weakest part.** The map in beat 3 is dense, and its solid blocks hide most of the moving background except in the street gaps.

There was no one to watch the preview: I started it, confirmed it loaded, then stopped it before rendering.
