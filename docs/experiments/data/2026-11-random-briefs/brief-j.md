# Brief: RETURN ROUTE: "Nothing Is Thrown Away"

**Genre:** Brand manifesto
**Subject:** Return Route, a fictional city curbside recycling program
**Format:** 1920×1080, 30 fps, exactly 19.0 s (570 frames), no audio track
**Deliverable:** `out/video.mp4`

---

## Concept

One amber dot carries the whole film. It starts as the cap of a bottle. Then it becomes the lid of a bin, then a map pin, then the moving point of a collection route. That route closes into a loop, and the loop becomes a new bottle and then the "O" in the program's name. The message is that what you put out comes back to you, and the dot carries it without any extra words. The background drifts and breathes for all 19 seconds and never stops, so the program feels like a system that is always running.

---

## Palette

| Hex | Name | Role |
|---|---|---|
| `#0F2E2F` | Deep Harbor | Full-frame background base |
| `#1D4A4B` | Tide | Ambient contour lines, map city blocks, river band |
| `#F3ECDD` | Paper | All headline type, bottle outline (beat 1), map street lines, pin labels |
| `#F4A23C` | Amber | The shared element: cap, lid, pin, route line, travelling dot |
| `#6BD69A` | Regrowth | The returned bottle (beat 4), the final "O" ring, tagline |

No other colors. Lower opacity is allowed only where noted.

## Fonts

- **Bebas Neue** for all headlines and the wordmark.
- **Inter** (Medium 500 and SemiBold 600) for map labels, the descriptor and the tagline. Always uppercase, with +8% tracking.

---

## On-screen copy (complete and exhaustive)

These are the only words that may appear on screen:

1. `NOTHING IS THROWN AWAY.`
2. `IT IS SENT SOMEWHERE.`
3. `YOUR CURB`
4. `SORT`
5. `REMAKE`
6. `EVERY STREET. EVERY WEEK.`
7. `AND IT COMES BACK.`
8. `RETURN ROUTE`
9. `A CITY RECYCLING PROGRAM`
10. `RINSE IT. SORT IT. SET IT OUT.`

---

## Living ambient background (runs 0.0–19.0 s, under everything)

- **Base:** a Deep Harbor field with a very soft radial lift of Tide at 12% opacity. The lift's center drifts slowly from the upper left to the lower right across the full 19 s.
- **Contour lines:** 7 horizontal wavy Tide lines, 2 px, at 60% opacity, spread evenly down the frame. Each one undulates on its own slow wave (period 6–9 s, amplitude 18–30 px) and drifts right at about 12 px/s. They look like topography, or water seen from above.
- **Flecks:** 40 Paper dots, 3–5 px, at 15% opacity. They rise slowly at 8–20 px/s with a slight sideways sway and wrap seamlessly from the top back to the bottom.
- The background never cuts, fades to black or freezes, including during the final hold.

---

## Beats

### Beat 1: The Bottle (0.0–3.5 s, frames 0–104)
- The background is already moving at frame 0. The first 6 frames fade up from Deep Harbor.
- **0.2–1.4 s:** A bottle outline in Paper, 6 px stroke with rounded caps, 520 px tall, draws itself on centered at x = 620. It starts at the base and travels up both sides to the neck, with an ease-in-out.
- **1.4 s:** An Amber filled circle, 40 px across, pops onto the bottle mouth with an overshoot (to 115%, settling to 100% over 8 frames). **This is the shared element.**
- **1.6–2.4 s:** `NOTHING IS THROWN AWAY.` sets on the right half in Bebas Neue at 150 px, in three lines: NOTHING / IS THROWN / AWAY. It is left-aligned at x = 1000. The lines rise 40 px and fade in, staggered 5 frames apart.
- **2.9–3.5 s (handover):** The text fades out. The bottle outline un-draws back toward the cap, from the base upward. The Amber dot stays and is the only thing left. It glides to the frame center (960, 540) and grows to 140 px. **Match cut:** cap becomes lid.

### Beat 2: The Bin Lid → The Pin (3.5–7.0 s, frames 105–209)
- **3.5–4.3 s:** The 140 px Amber circle is now a bin lid seen from above. A Paper ring (4 px, 220 px across) draws around it clockwise. Inside the gap between them, three short Paper arcs with arrowheads chase each other around once.
- **4.0–5.0 s:** `IT IS SENT SOMEWHERE.` appears above the lid in two lines (IT IS SENT / SOMEWHERE.) in Bebas Neue at 120 px, centered. Each line is revealed by a mask wiping up from below.
- **5.6–7.0 s (handover):** The text and ring fade out. The Amber circle shrinks to 32 px, and a teardrop point grows beneath it so it becomes a **map pin**. At the same time the camera pulls back in one continuous move (scale 3.0 → 1.0). Map streets appear around the pin as the camera pulls out. **Shared element:** lid becomes pin, and it never leaves the screen.

### Beat 3: The Route (7.0–12.0 s, frames 210–359)
- **The map:** a stylized city in flat shapes.
  - Paper street lines (2 px, 35% opacity) on a loose grid, with 2–3 diagonal avenues.
  - Tide city blocks with 6 px rounded corners.
  - One wide Tide river band curving from the top left to the bottom right, with 2 street bridges crossing it.
- **Pins:** three in total.
  - The first pin from beat 2 sits on the left third and is labelled `YOUR CURB`.
  - Two more pins pop in (overshoot) as the route reaches them: `SORT` in the upper middle and `REMAKE` on the right.
  - Labels are in Inter SemiBold, 28 px, Paper, sitting 20 px above each pin on a Deep Harbor rounded pill at 80% opacity.
- **The route:** an Amber line, 8 px with rounded joins, draws along the streets with right-angle turns and crosses one bridge.
  - A 20 px Amber dot leads the line, with a soft glow (Amber at 30% opacity, 40 px blur).
  - Timing: reaches SORT at 8.8 s and REMAKE at 10.6 s, with ease-in-out on each leg.
- **Camera:** a slow pan that follows the dot (about 180 px of horizontal travel), plus a gentle zoom from 1.00 to 1.06 over the beat.
- **Copy:** `EVERY STREET. EVERY WEEK.` in Bebas Neue at 96 px, Paper, anchored bottom-left inside a 96 px safe margin. It types on word by word from 9.2 s.
- **11.2–12.0 s (handover):** The route leaves REMAKE and heads back toward YOUR CURB.

### Beat 4: The Loop → The New Bottle (12.0–15.5 s, frames 360–464)
- **12.0–12.8 s:** The route reaches YOUR CURB and closes into a full loop. The leading dot pulses once.
- **12.8–13.6 s:** Everything else on the map fades out together: streets, blocks, river, labels, pins and the beat 3 copy. Only the closed Amber loop remains, with the background still moving underneath.
- **13.6–14.6 s (match cut):** The loop's corners round off and the shape **morphs into a bottle outline**. It takes exactly the same size and position as the bottle in beat 1 (520 px tall, x = 620). During the morph the stroke color shifts from Amber to Regrowth. The leading dot settles on the mouth as the Amber cap. The opening shot is now repeated, reborn.
- **14.0–15.0 s:** `AND IT COMES BACK.` sets on the right in the same layout as beat 1, in three lines (AND IT / COMES / BACK.), with the same animation.
- **15.0–15.5 s (handover):** The text fades. The Regrowth bottle compresses into a 150 px Regrowth ring (8 px stroke) while gliding to the position of the "O" in the coming wordmark. The Amber cap rides along on the ring.

### Beat 5: The Lockup (15.5–19.0 s, frames 465–569)
- **15.5–16.3 s:** `RETURN ROUTE` builds in Bebas Neue at 220 px, Paper, centered optically at y = 500. The "O" in ROUTE is the Regrowth ring from beat 4, matched to the cap height. The letters reveal outward from the ring with a 2-frame stagger.
- The Amber dot orbits the ring once, slowly, from 15.8 s to 19.0 s, so the frame is never fully still.
- **16.4 s:** `A CITY RECYCLING PROGRAM` fades up in Inter Medium at 30 px, Paper at 70%, centered 40 px below the wordmark.
- **17.0–17.9 s:** `RINSE IT. SORT IT. SET IT OUT.` in Inter SemiBold at 34 px, Regrowth, centered at y = 760. It appears in three phrases, 8 frames apart.
- **17.9–19.0 s:** Hold on the full lockup. The background and orbiting dot keep moving. No fade to black.

**Timing check:** 3.5 + 3.5 + 5.0 + 3.5 + 3.5 = **19.0 s**

---

## Must
- Keep the Amber dot visible continuously from 1.4 s to 19.0 s. It is the shared element through every transition: cap → lid → pin → route dot → cap → orbit.
- Keep the ambient background moving for all 570 frames.
- Draw the map route so it visibly follows the street lines and closes into a loop.
- Use the same bottle size and position in beats 1 and 4 so the match cut is exact.
- Keep all type inside a 96 px safe margin.
- Use only the palette, the two fonts and the listed copy.
- Export H.264, 1920×1080, 30 fps, 570 frames, no audio track, to `out/video.mp4`.

## Must not
- No photos, footage, textures from images, stock graphics, icons from packs or real brand logos.
- No hard cuts and no fades to black anywhere.
- No words beyond the copy list. That includes street names, numbers, dates and watermarks.
- No colors outside the palette. No gradients except the specified radial lift and dot glow.
- No 3D, lens flares or glitch effects.
- No audio of any kind.
