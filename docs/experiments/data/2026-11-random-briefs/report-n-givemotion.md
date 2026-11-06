> Raw record: round 8, brief N, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief N, givemotion

les using only its own characters and locks in left to right, 2 frames apart, each with a squash pop. Each character becomes a teal dot, and the 16 dots arc into the keyhole while the lock pulses and squeezes its eyes shut. The shackle snaps shut (body squash 130/75), then two amber rings and 60 teal particles burst out and hang in a cloud. The lock blinks happily and shrinks into the icon.
- **18.5–22 s:** each particle sheds a ribbon of dots that settle exactly into the `KEYWARD` letterforms. The title snaps solid at 19.8 s (104% then 100% over 4 frames) and the icon squash-bounces. The tagline types out, the cursor is gone by 21.0 s, and the last second is a clean hold with a 2% push-in.

I worked the way the docs describe: `check` while building, two `review` passes, and one fresh sub-agent critic on the near-final cut. Fixes that came out of that:
- Spread out the fallen letters, which were overlapping each other.
- Stopped the incoming `EVERY DOOR.` letters crashing into the outgoing `ONE KEY.`.
- Moved the door grid up so it no longer covers the shackle.
- Made the doors fold into a clean line instead of a jagged staircase.
- Made the scramble characters full cream and kept them off the baseline.
- Brought the dots into the keyhole from the side instead of across the shackle.
- Gave the lock something to do in what had been a 0.8 s still stretch.
- Kept the burst cloud from piling up along the floor.

`check` ends with 0 errors. Its remaining warnings are all deliberate: letters vanishing under the lock or breaking into doors, and the amber copy of `KEY` laid over the cream one.

**Render command** (run from /home/user/tools5/n/givemotion):
```
npx givemotion render video.html -o out/video.mp4
```

**What got in the way:**
- **Brief conflict on the tagline.** It asks for 30 characters at 1 frame each between 20.2 and 21.0 s, but that window is only 24 frames. I started the typing at 20.0 s (the cursor appears and blinks just before) so it finishes and the cursor disappears by 21.0 s. That keeps the "clean final second" rule, at the cost of starting 6 frames early.
- **Unclear specs, and the choices I made:**
  - "A shadow drops in from the top of frame": at first I used a full padlock-shaped shadow, but the critic read it as a second lock. It is now a slate blot that falls from the top and spreads into the floor shadow.
  - "60 px icon": I made the icon's body 60 px tall. When the whole icon was 60 px it looked like a ™ mark next to the 300 px title. Its top lines up with the top of the capitals.
  - "Letter spacing +80": I read this as 80 px.
- **Particles into letterforms.** 60 particles alone can't spell `KEYWARD`, so each one splits into about 20 smaller dots that fill the letters.
- **Tooling.** `review` takes over 2 minutes, which is longer than a normal command is allowed to run, so I ran it in the background. I stopped my first render partway through to apply the critic's fixes and rendered again. There were no other tool problems.
