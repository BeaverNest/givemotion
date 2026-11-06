> Raw record: round 8, brief P, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief P, hyperframes

s pop in 3 frames apart, the kicker rises from a mask line, and the mint bar wipes the dots into `2026`. A full-width mint band then wipes upward into Beat 2.
- **Beats 2–3 (`vault.html`):** the card outline draws clockwise. `1,284` is revealed left to right and counts up, while 40 particles stream in and make the outline flicker. The card contents then slide left inside the card's frame like a carousel. `3,917` is revealed right to left, with 12-particle sparks at each thousand. The line grows out from the centre and reveals `21 HOURS OF TYPING SKIPPED` letter by letter. A 20° amber-edged diagonal wipe clears the screen.
- **Beat 4 (`fixed.html`):** the amber `37` jitters, then bursts into 120 particles that start from its actual letter shapes. They turn mint, curve back and re-form the `37`. A bar wipes `weak passwords` into `fixed`, and both close onto the centre line.
- **Beat 5 (`lock.html`):** `0` opens out from that same line, shrinks and becomes part of the padlock as it draws. The shackle snaps down in 4 frames with a squash, throwing 80 particles, a shockwave ring and a burst of light. `Locked tight.` and `See you in 2027.` follow, and the background is still moving on the last frame.

**Render command** (run from the project folder):
```
npx --yes hyperframes@0.9.18 render --output out/video.mp4 --fps 30 --quality delivery
```

`check` reports 0 errors. I looked at snapshots of every beat, every handoff and the phone-width review sheet, and fixed what I found. The main fix was wipe bars that would have shown on screen before their wipes started. Notes are in `SPEC.md` and `REVIEW.md`.

**Things that got in the way, or where I departed from the brief**

- **Hold times:** the brief's timings don't give two labels a full 1.0 s on screen. I moved the `fixed` wipe to 11.85–12.25 s and the door close to 13.2–13.5 s so `fixed` holds 1 s. `breaches got through` now wipes away at 14.9 s instead of 14.8 s.
- **Click timing:** the shackle snap starts at 15.7 s, so the particle burst lands on contact at about 15.83 s.
- **Warnings I left in place:**
  - `film_silent`: the brief says no audio.
  - `line_unread` on the last two lines: the brief fixes when they appear, which leaves them on screen 1.7 s and 1.3 s.
  - `gsap_repeated_fromto_without_baseline`: a false positive. The linter can't tell two separate animation objects apart.
  - `composition_file_too_large`: Beats 2 and 3 share one file because the carousel runs across both.
- **Faint grid:** at the brief's 25%–70% opacity of `#232A63`, the dot grid is moving but quite subtle on a phone. Raising those numbers would be a quick change if the client wants it stronger.
- **Card frame:** the brief can be read two ways for the Beat 2→3 slide. I kept the card frame fixed as the window and slid only the contents through it.

I started the Studio preview in the background before rendering, as the docs require, and stopped it afterwards. I didn't send the CLI's optional feedback or telemetry commands.
