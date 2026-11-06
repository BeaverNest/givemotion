> Raw record: round 8, brief N2, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief N2, remotion

by 30 px, and the lock flinches at each hit. `KEY` flips to amber with a small pop. The line then scales up and exits off the top. `EVERY DOOR.` slides in letter by letter from the right, and its +80 px letter spacing snaps to 0 with an elastic overshoot. It breaks into 40 slate door outlines that fan out into a grid. The doors flip shut and fill teal, rippling outward from the lock, then collapse into a line at y = 360.
- **Beat 4:** the password scrambles using only its own characters, and each character locks in 2 frames after the last with a small squash pop. Each one then collapses to a teal `•`. The 16 dots fly on curved paths into the keyhole while the lock pulses and squeezes its eyes shut. The shackle snaps closed with a 130/75 squash. Two amber rings expand as their stroke thins to 0, and 60 teal particles spray out with drag and hang in a cloud.
- **Beat 5:** the lock gives a happy blink and shrinks into a 60 px icon. The cloud streams into the letterforms of `KEYWARD`, then snaps solid with a 104% → 100% overshoot. The icon sits left of the K and does one last squash-bounce. The tagline types at 1 frame per character, the cursor blinks and disappears, and the last second has only the 2% push-in.

**Render command** (run from `/home/user/tools5/n2/remotion`):
```
npx remotion render Keyward out/video.mp4 --codec=h264
```

**Things that got in the way, and what I chose**
- **Tagline timing doesn't add up:** 30 characters at 1 frame each don't fit in 20.2–21.0 s (24 frames), and the brief also wants the final second still. I started typing at about 19.9 s (frame 596) so the cursor is gone by frame 630 and the final second really is static.
- **Unclear brief wording:** I read "60 px icon" as a 60 px wide lock body, with the top of the shackle lined up with the title's cap height. "+80" letter spacing I took as 80 px.
- **No live preview:** the docs say to keep Remotion Studio open while working, but there is no browser or viewer here. I checked my work by rendering frames to images instead, as the render docs also suggest.
- **Browser:** the render docs say to use Remotion's own downloaded browser, but this machine can't download it, so I kept the Chrome Headless Shell already set in `remotion.config.ts`.
- **Studio editing:** most of the motion is computed by shared helper functions so the padlock stays in sync across beats. That means fewer values can be edited by dragging in Studio than the docs' "inline" style allows. Each layer is still its own named `<Sequence>`.
- **Lint:** `tsc` reports errors only in example files inside the `skills/` folder, which are missing map packages. My code in `src` passes both eslint and tsc.

**Files changed**
- I added `@remotion/fonts` and `@remotion/layout-utils` with `npx remotion add`.
- I copied the two fonts into `public/fonts/`.
- The code is in `src/timeline.ts`, `src/lib.ts`, `src/fonts.ts`, `src/Keyward.tsx` and `src/layers/*`. `src/Composition.tsx` now registers the composition as `Keyward`.
