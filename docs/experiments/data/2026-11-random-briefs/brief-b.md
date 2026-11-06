# Brief: "Know Where It Goes": Pocketfold Title Sequence

## Overview
This is a 15-second opening title sequence for **Pocketfold**, a fictional budgeting app. The idea is simple: every coin follows a path. One amber coin falls into a dark, slowly shifting space. Its path splits into four budget streams, each ending at a category that fills up. The streams then fold back into the app's pocket-shaped mark, which releases a burst of coins as the title lands. It should feel calm and in control, with one moment of celebration. Think of a prestige TV title sequence, not an ad.

## Format
- 1920×1080, 30 fps, exactly 15.0 s (450 frames), no audio
- Deliverable: **out/video.mp4**
- Keep all type and key shapes inside a 120 px safe margin on every edge

## Palette
| Hex | Role |
|---|---|
| `#0E1A2B` | Base background (deep ink) |
| `#183A52` | Ambient background glows and drifting forms |
| `#3DDC97` | Path lines, the pocket mark and the underline (mint, for "money under control") |
| `#FFB547` | Coins, particles and the burst (warm amber) |
| `#F4F1EA` | All type, plus the faint background dot grid at 6% opacity |

No other colors. Tints come only from changing the opacity of these five.

## Fonts
- **Bebas Neue** for the main title only
- **Space Grotesk** (Medium and Bold) for everything else, including amounts. Numerals must be tabular so the counters don't jitter.

## On-screen copy (exhaustive)
Nothing else may appear on screen.
1. `Every coin takes a path.`
2. `RENT`, `GROCERIES`, `FUN`, `SAVINGS`
3. `$1,240`, `$380`, `$150`, `$600`. While counting up, the numerals in between ($0 up to each final value) may appear.
4. `POCKETFOLD`
5. `Know where it goes.`
6. `Available now`

## Living ambient background (runs the full 15 s)
- Two large soft radial glows (`#183A52`, about 900 px and 700 px across, heavily feathered) drift slowly over the `#0E1A2B` base in lazy figure-eight paths. Each takes about 12 s per loop.
- A faint dot grid sits over the glows: `#F4F1EA` at 6%, 48 px spacing, 3 px dots. A slow diagonal wave moves through it, swelling each dot to 4.5 px and 12% opacity as it passes. One wave crosses the frame every 5 s.
- The background must never freeze, not even during the final hold.

## Beats

### Beat 1: The First Coin (0.0–2.5 s · frames 0–75)
- We open on the ambient background alone.
- At 0.3 s a single amber coin falls from the top-center into frame and settles at 960, 300. The coin is a 28 px circle with a 4 px inner ring, and it lands with a soft overshoot bounce.
- The impact sends out a small ring pulse: one amber circle stroke that expands to 120 px and fades out.
- A mint line (6 px stroke, round caps) draws itself straight down from the coin to 960, 560. A subtle bright tip leads the draw.
- `Every coin takes a path.` appears word by word under the line. Space Grotesk Medium, 52 px, `#F4F1EA`, centered at y 640. Each word rises 16 px and fades in, 4 frames apart.
- **Handover:** the sentence fades out over 0.4 s. The line's tip reaches its endpoint and splits into four.

### Beat 2: The Budget Delta (2.5–6.0 s · frames 75–180)
- From the split point, four mint paths draw themselves outward. They are smooth S-curves, like a river delta or a transit map, ending at four nodes spread evenly across y 820 (x 360, 760, 1160, 1560). The draws are staggered by 5 frames, and each takes 1.2 s with an ease-in-out.
- Amber coin particles stream from the top coin along each path: 8–12 per path, 10–14 px, spaced unevenly and moving at slightly different speeds, so the flow reads as alive rather than mechanical.
- When a path finishes, its node pops in. The node is a 22 px mint ring that scales from 0 with a small overshoot. A label in Space Grotesk Bold, 26 px, uppercase, +12% tracking, sits 40 px below it: `RENT`, `GROCERIES`, `FUN`, `SAVINGS`.
- Above each node, an amount counts up from $0 in Space Grotesk Medium, 40 px: `$1,240`, `$380`, `$150`, `$600`. The counts take 1.0 s with an ease-out. Each node pulses once as its count lands.
- **Handover:** the labels and amounts fade out over 0.3 s, and the four paths begin to pull back inward.

### Beat 3: The Fold (6.0–9.0 s · frames 180–270)
- The four paths reverse. Their outer ends retract toward the center while the lines bend smoothly into new curves, with coins still flowing along them.
- The paths meet at center and redraw as **the Pocketfold mark**. The mark is one continuous 8 px mint stroke, about 260 px wide, centered at 960, 470. Its shape is a rounded pocket outline (a U with 60 px corner radii) plus a diagonal fold flap across the top that tucks into the right side.
- The stroke draws on along the mark's path over 1.6 s. Everything is linework, with no fills.
- As it draws, the coins on screen are drawn in toward the mark and spiral inside it, shrinking as they go.
- Toward the end of the beat the mark tightens: it scales from 1.0 to 0.94 over 0.4 s, holding its breath before the release.
- **Handover:** the last coin disappears into the pocket, followed by a 2-frame stillness.

### Beat 4: The Burst & Title (9.0–11.5 s · frames 270–345)
- The mark snaps back to 1.0 and releases a **radial burst** of 80–120 amber particles: a mix of circles and small coin rings, 6–18 px. They fly outward with varied speed and spin, slow down under drag, and drift gently upward like embers. About a quarter of them stay on screen as slow-floating dust through to the end.
- A single mint shockwave ring expands from the mark to 700 px and fades out.
- `POCKETFOLD` lands below the mark at y 700. It is Bebas Neue, 220 px, +6% tracking, `#F4F1EA`. Each letter rises out of a mask line from below, staggered 2 frames from the center outward, and settles with a small overshoot.
- **Handover:** the burst settles and the title holds steady.

### Beat 5: Tagline & Resolve (11.5–15.0 s · frames 345–450)
- `Know where it goes.` fades up below the title at y 830. Space Grotesk Medium, 44 px.
- A mint underline (4 px) draws itself left to right beneath the tagline over 0.8 s. It traces a gentle wave rather than a straight rule, as a callback to the paths.
- At 13.0 s, `Available now` fades in at y 960. Space Grotesk Medium, 26 px, uppercase, +14% tracking, 70% opacity.
- From 14.0 to 15.0 s the composition holds. Only the ambient background, the dust particles and a slow 4 s brightness "breath" on the mark keep moving. There is no fade to black.

**Timing check:** 2.5 + 3.5 + 3.0 + 2.5 + 3.5 = **15.0 s**

## Must
- Show all three required techniques clearly: lines that draw themselves (Beats 1–3 and 5), particles and bursts (Beats 2 and 4), and a living background that moves for the whole 15 s.
- Use only the five listed hex colors and only the two listed fonts.
- Show only the copy listed above, spelled and punctuated exactly as written.
- Ease every move (no linear motion except particle drift) and let one motion lead into the next, with no hard cuts.
- Keep the composition centered and symmetrical.
- Export at 1920×1080, 30 fps, exactly 450 frames, silent, to **out/video.mp4**.

## Must not
- No photos, footage, stock imagery, icons from icon sets, real brand logos, or app-store badges.
- No phone mockups or UI screenshots.
- No audio, voice-over or music.
- No extra words, numbers, legal text or URLs.
- No gradients other than the soft background glows. No drop shadows on type.
- No frantic camera shake, glitch effects or strobing.
- Don't let the background become static at any point.
