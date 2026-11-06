> Raw record: round 8, brief O, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief O, givemotion

$844), flashing coral on debits and gold on savings. The label rolls to `LEFT TO SPEND` at 12.2 s.
- **Credits:** they wipe in left to right with a 2 px green line on the wipe edge, and wipe off the same way.
- **Ending:** the view pulls back to 100%, the map un-draws, and the route retracts into the gold dot. The title line draws while the dot glides to its end, then `Ledgerline` rises out of the line letter by letter. The tagline wipe with its hairline and `AVAILABLE NOW` follow, then the gold ring pulse, then a completely still hold from 22.5 to 24.0 s.

I measured the brief's placements on rendered frames: the title baseline is at 616, the tagline at 720 and `AVAILABLE NOW` at 920, and all three are centred.

**Render command** (run from `/home/user/tools5/o/givemotion`):
```
npx givemotion render video.html -o out/video.mp4
```

**Choices you might not expect**
- **Two extra short streets.** The brief's waypoints can't all sit on one even 160 × 140 grid. I lined the grid up with PAYDAY, RENT and GROCERIES and added two short streets for the GROCERIES → TRANSIT leg, each ending at a grid crossing.
- **The dot sits a little above centre** (screen y ≈ 400). Centring it put old labels right on top of the credits; this height keeps them apart.
- **Pill placement.** Pills sit on the side away from the route (north or north-west of the pin, below it for SAVINGS), so no label sits on the line or near the frame edge.
- **Soft navy shading behind the credits and balance.** It uses the background colour at reduced opacity, so it stays within the palette. It keeps the text readable while the map slides underneath. A critic sub-agent flagged it as something the brief didn't ask for; I kept it because without it, labels and the route pass straight through the credit text.

**What got in the way**
- givemotion's `check` reported one error, text cut off in the balance at 2.40–2.47 s. That was the balance wiping in on purpose, so I marked the roll boxes with the docs' `data-check="crop-ok"`. `check` now shows 0 errors.
- Four warnings remain, all caused by the brief itself: 20 px balance labels, a plain navy opening, the 1.5 s still hold at the end, and the short almost-empty moment around 17 s.
- One fresh-critic pass found real problems, all fixed:
  - Cues read about 0.1 s late because of slow-starting easing curves and extra space inside the wipe boxes.
  - The credit's green edge line overshot the text and lingered after it.
  - The `g` left a notch in the title line.
  - `AVAILABLE NOW` revealed off-centre.
  - One added street stopped mid-block.
- **Left as specified:**
  - The 12%-gold SAVINGS pill looks greyish on navy.
  - The `g` descender is cut by the line, because the brief makes everything below the line part of the mask.
  - JetBrains Mono draws the true minus sign (`−`) almost like a hyphen, but the copy uses the correct character.
- The skill docs point to `review/REVIEW.md` before it exists; `npx givemotion review` creates it on first run.
