> Raw record: round 8, brief N, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief N, remotion

 landing). Each landing turns a pile of letters into 14 coral circles that turn teal in mid-air and drift up. It then turns to face the camera and looks up.
- **Beat 3:** `ONE` and `KEY.` slam down with a 30 px overshoot, and the lock squashes on each hit. `KEY` pops to amber. `EVERY DOOR.` slides in letter by letter while the spacing springs from 80 px to 0. It then breaks into 40 door outlines. They flip shut in a ripple spreading out from the lock, filling teal as they close, and collapse into a line at y=360.
- **Beat 4:** the password resolves as a slot-machine reel. Each character locks with a small squash pop and then collapses into a teal `•`. The 16 dots curve into the keyhole while the lock pulses and squeezes its eyes shut. The shackle snaps closed, and a burst follows: 2 amber rings that thin out and 60 teal particles with drag that hang in a cloud.
- **Beat 5:** the lock blinks happily and shrinks to a 60 px icon. The particles stream into the shape of `KEYWARD`, which snaps solid (104% then 100%). The icon hops to the left of the K and squash-bounces. The tagline types out and the cursor disappears. The last second is a still hold with a 2% push-in.

**Render command** (run from `/home/user/tools5/n/remotion`):
```
npx remotion render Keyward out/video.mp4 --codec=h264
```

**How I checked it:** I rendered sample frames with `npx remotion render Keyward <dir> --frames=...` and pulled frame strips from the MP4. That led to four fixes:
- The coral pops were drawn on top of the lock and looked like spots on it.
- The fallen letters still read as one word instead of piles.
- The trailing-shackle effect made the closing snap look open again.
- `ONE KEY.` collided with the incoming `EVERY` letters.

**Where I departed from the brief**
- **Tagline timing:** the brief asks for it to start at 20.2 s, type at 1 frame per character, and the last second to be clean. Its 30 characters can't fit in the 24 frames between 20.2 s and 21.0 s. I started typing at about 19.9 s so it finishes, and the cursor blinks and disappears, before 21.0 s.
- **Particle count:** 60 dots alone can't spell `KEYWARD` legibly. Each hanging particle splits into about 10 dots as it streams in, and shrinks as they leave.
- **Ambiguous points:** I read "letter spacing +80" as 80 px. I drew "a shadow drops in from the top" as the lock's shadow growing on the floor before the lock arrives.

**What got in the way**
- The skill docs point to `remotion-create/REFERENCE.md`, which doesn't exist; the file is `SKILL.md`.
- The render docs say not to set a custom browser, but this setup needs the preinstalled one from `remotion.config.ts`, so I kept it.
- There was no one to open a Studio preview for, so I checked rendered frames instead.
- `tsc` reports errors from the example files under `skills/`. `src/` itself passes type-checking and lint.

I added `@remotion/fonts` with `npx remotion add`, copied the two fonts into `public/`, and replaced the scaffold's `src/Composition.tsx`.
