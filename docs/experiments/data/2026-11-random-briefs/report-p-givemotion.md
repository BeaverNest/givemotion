> Raw record: round 8, brief P, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief P, givemotion

wipe reveals `3,917`, with a 12-particle spark at each thousand. The 600 px line draws out from the centre and uncovers `21 HOURS OF TYPING SKIPPED`. A 20° diagonal wipe with an amber leading edge clears everything.
- **Beat 4:** the amber `37` rises from a mask and jitters for 1 s. It bursts into 120 squares and shards, which turn mint in flight and rebuild the number. A mint bar turns `weak passwords` into `fixed`, and then the content closes to the centre line like vault doors.
- **Beat 5:** the `0` opens from that same seam. It shrinks into the padlock as the body and raised shackle draw on. The click drops the shackle in 4 frames with a 2-frame squash, and on the contact frame fires 80 particles, a shockwave ring and a grid ripple. `Locked tight.` is revealed by a bar wipe and `See you in 2027.` rises in. The background stays alive through the last frame.

**Render command** (run from `/home/user/tools5/p/givemotion`):
```
npx givemotion render video.html -o out/video.mp4 --motion-blur auto --quality high
```

**Process:** I wrote `check`/`snapshot` stills first, then two `givemotion review` passes, then one independent critic agent working only from the brief and the frames. The critic found real bugs, which I fixed:
- The amber diagonal edge was drawn 540 px away from where the wipe actually cleared.
- The card frame never moved, so the hand-over between cards didn't read as a carousel.
- Rebuild particles were still showing on top of the solid mint `37`.
- Leftover lines and wipe bars hung around in frames where people are reading.

**What got in the way**
- **Some brief values work against each other:**
  - The grid dots and the glows are the same colour (#232A63), so the dots disappeared over the glows. I drew the dots as added light so they show everywhere, keeping the brief's opacity values.
  - A 15% amber tint mixed into indigo comes out a muddy mauve, so I laid the tint on as a separate light layer.
  - Read literally, the card hand-over could mean only the contents slide. I made each card slide with its own frame, so it reads as a carousel.
- **Three `check` warnings remain, all caused by timings the brief sets:**
  - The opening fades up from pure navy.
  - The kicker is readable for about 1.6 s, where `check` suggests 2.3 s.
  - The last line is readable for about 1.1 s, where `check` suggests 2.0 s; the brief only asks for 1.0 s.
- **`fixed` is fully on screen for about 1.0 s:** that is the most the 12.0–12.6 s reveal and the 13.1 s close allow.
- **Two judgement calls on things the brief leaves open:**
  - I kept the brief's count-ups, even though the docs advise against showing in-between numbers when the copy list is closed.
  - Motion blur also softens the amber diagonal edge a little.
- **Tool friction:** `givemotion review` takes longer than the 2-minute shell timeout, so I ran it in the background. Wipes that have to line up exactly with a moving bar had to be done in my own per-frame code rather than with `gm.timeline`.
