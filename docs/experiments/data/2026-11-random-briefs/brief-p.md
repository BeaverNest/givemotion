# Brief: "Locked Tight" (a year in review for a password manager)

**Format:** 1080×1920 vertical · 30 fps · exactly 18.0 s (540 frames) · no audio
**Deliverable:** `out/video.mp4`

## Concept
This is the user's 2026 recap, told from inside their vault. The year's numbers start hidden behind password-mask dots (••••). Each one shows up the way a password does when you click "show": a clean wipe turns the dots into the real figure. A dark, softly glowing field of dots breathes behind everything, like a vault that's always on. The video moves from "saved" to "fixed" to "protected". It ends with the final zero closing into a padlock that clicks shut and throws out a burst of light.

## Palette
| Hex | Role |
|---|---|
| `#0A0E1F` | Base background (vault navy) |
| `#232A63` | Ambient glow blobs, inactive dot grid |
| `#3DF5B0` | Primary accent: mask dots, wipe bars, particles, "secure" states |
| `#FFB547` | Warning accent: only for the weak-password moment |
| `#EEF1FF` | Main type |
| `#8A93B8` | Secondary labels, small caps |

## Typography
- **Space Grotesk** (Bold for numbers, Medium for labels): all headline numbers and labels.
- **JetBrains Mono** (Regular, uppercase, letter-spacing +12%): the kicker line and the "21 hours" line only.

## On-screen copy (complete; nothing else may appear)
1. `YOUR YEAR IN THE VAULT`
2. `2026`
3. `1,284`
4. `passwords saved`
5. `3,917`
6. `logins autofilled`
7. `21 HOURS OF TYPING SKIPPED`
8. `37`
9. `weak passwords`
10. `fixed`
11. `0`
12. `breaches got through`
13. `Locked tight.`
14. `See you in 2027.`

Mask dots, the grid, particles and the padlock are drawn shapes, not type.

## Living ambient background (runs the full 18 s, never stops)
- **Dot grid:** 18 columns × 32 rows of 6 px circles in `#232A63`, 60 px apart. A slow diagonal wave of brightness travels from bottom-left to top-right on a 6 s loop. Each dot it passes rises from 25% to 70% opacity and scales 1.0 to 1.4, then settles back.
- **Glow blobs:** two large soft radial glows behind the grid, 900 px and 700 px, in `#232A63` at 60% fading to transparent. They drift in slow opposite ellipses (about 120 px travel, 12 s period). During each beat, the larger blob tints faintly toward that beat's accent (mint, or amber in Beat 4) at no more than 15% strength.
- **Parallax:** the grid drifts upward continuously at 8 px/s.

## Beats

### Beat 1: 0.0–3.0 s · The mask
- 0.0–0.4 s: the background fades up from pure `#0A0E1F`.
- 0.4–1.2 s: eight 28 px mint dots appear one at a time, 3 frames apart, in a centered row at y≈960, each with a small overshoot pop. It reads like a password being typed.
- 1.2 s: `YOUR YEAR IN THE VAULT` (mono, 34 px, `#8A93B8`) slides up 24 px into place at y≈780, clipped by a mask so it rises from an invisible line.
- 1.5–2.1 s: a 12 px vertical mint bar sweeps left to right across the dots (ease-in-out). Dots behind the bar vanish. A masked reveal uncovers `2026` behind it (Space Grotesk Bold, 300 px, `#EEF1FF`). The bar leaves a 3-frame mint afterglow at the right edge.
- 2.1–2.6 s: hold. `2026` breathes (scale 1.0 to 1.015).
- **Handoff, 2.6–3.0 s:** a full-width mint band (240 px tall) wipes upward from the bottom edge. Above the band, the screen is cleared down to the background, so the kicker and `2026` are erased as it passes. Beat 2's content is uncovered beneath it as it rises. The band exits off the top.

### Beat 2: 3.0–6.0 s · Saved
- Behind the band, a rounded-rectangle "vault card" outline (840×560 px, 2 px `#3DF5B0` at 60%, 40 px radius) draws its stroke clockwise in 0.5 s, centered at y≈900.
- Inside the card sits a row of mint mask dots. At 3.4 s a horizontal masked wipe swaps them for `1,284` (Bold, 220 px). The number counts up from 0 during the final 12 frames of the wipe.
- 3.7 s: `passwords saved` (Medium, 56 px, `#8A93B8`) rises out of a mask line below the number.
- **Particles:** from 3.4 to 5.2 s, about 40 small mint squares (6–10 px) stream in from the screen edges along gentle curves and get absorbed into the card. Each one makes the stroke flicker brighter for 2 frames.
- **Handoff, 5.6–6.0 s:** the card and its contents slide left 1080 px, masked by the card's own frame. A second card is already riding in from the right, so it reads as a carousel inside a window.

### Beat 3: 6.0–9.5 s · Autofilled
- The new card settles at 6.2 s with a soft overshoot. Its mask dots wipe right to left, the opposite direction to Beat 2, revealing `3,917` (Bold, 220 px, counting up). Then `logins autofilled` rises in below it.
- 7.4 s: below the card, a thin mint line (600 px) draws outward from the center. `21 HOURS OF TYPING SKIPPED` (mono, 32 px, `#EEF1FF`) is revealed letter by letter behind a moving mask edge that follows the line.
- **Particles:** each time the counter crosses a thousand (1,000, 2,000, 3,000), a tight 12-particle mint spark pops from the number's top edge.
- **Handoff, 9.1–9.5 s:** a diagonal masked wipe (angled 20°, `#FFB547` leading edge) sweeps top-left to bottom-right. Everything clears, and the larger glow blob warms toward amber.

### Beat 4: 9.5–13.5 s · Fixed
- 9.7 s: `37` (Bold, 340 px) appears in `#FFB547`, revealed upward by a mask. `weak passwords` (Medium, 56 px, `#FFB547` at 80%) sits beneath it. The `37` shows a subtle 2 px horizontal jitter, held for 1 s.
- 11.0 s: **burst.** The `37` breaks into about 120 amber particles (small squares and short line shards). They fly outward radially with gravity-free drag and spin.
- 11.4–12.2 s: the particles turn from amber to mint while still in flight, then curve back and reassemble into `37`, now `#3DF5B0`. Dot-grid dots near the center briefly pulse mint.
- 12.0–12.6 s: a mint vertical bar wipes across `weak passwords`. It gets erased by the bar, and the bar uncovers `fixed` (Bold, 96 px, `#3DF5B0`) in its place.
- **Handoff, 13.1–13.5 s:** the mint `37` and `fixed` close shut toward the horizontal centerline, like a vault door meeting in the middle, and are gone. The glow returns fully to indigo.

### Beat 5: 13.5–18.0 s · Locked tight
- 13.6 s: `0` (Bold, 400 px, `#3DF5B0`) opens out from the centerline, the reverse of Beat 4's close. `breaches got through` (Medium, 56 px, `#8A93B8`) rises from a mask below it.
- 14.8–15.6 s: the label wipes away. The `0` shrinks to 45% and moves up to y≈820. A rounded padlock body (300×240 px, 6 px mint stroke) draws itself around the lower half of the `0`. A shackle arc draws above it, starting raised 40 px.
- 15.7 s: **click.** The shackle snaps down 40 px in 4 frames with a 2-frame squash. On contact, about 80 mint particles explode radially, along with one thin expanding shockwave ring (stroke from 4 px to 0 as it reaches 1200 px). Every dot on the grid flashes to 90% opacity in a ripple spreading out from the lock.
- 16.2 s: `Locked tight.` (Bold, 96 px, `#EEF1FF`) is revealed left to right by a mint wipe bar at y≈1240.
- 16.7 s: `See you in 2027.` (Medium, 52 px, `#8A93B8`) rises from a mask line at y≈1340.
- 16.9–18.0 s: hold. The particles drift and fade, the padlock glows softly, and the ambient background keeps breathing through the very last frame. No fade to black.

**Beat total: 3.0 + 3.0 + 3.5 + 4.0 + 4.5 = 18.0 s**

## Must
- Keep all type inside a safe area of 96 px left/right and 180 px top/bottom.
- Make every number's first appearance a masked wipe from mask dots or a mask line. Never a plain fade.
- Use at least three distinct wipe directions across the piece: up, horizontal both ways, and diagonal.
- Keep the ambient grid and glows moving continuously from frame 0 to frame 539.
- Use amber only in Beat 4 (plus the Beat 3 handoff edge). Every other accent is mint.
- Ease all motion (no linear moves, except the steady grid drift).
- Make text readable on a phone: each label holds fully on screen for at least 1.0 s.
- Render to `out/video.mp4` at 1080×1920, 30 fps, 540 frames.

## Must not
- Show any copy beyond the 14 lines listed, including no brand name, URL, date stamp or watermark.
- Use photos, footage, stock imagery, icons from real products, real company logos or any recognizable brand marks.
- Include audio of any kind.
- Use colors outside the palette or fonts other than Space Grotesk and JetBrains Mono.
- Let particles cover a number while it is being read.
- Cut hard between beats. Every handoff is a designed wipe, slide or close.
- End on black or a static frame. The background must still be alive at 18.0 s.
