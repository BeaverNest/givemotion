# Brief: ROUNDTRIP: "Nothing wasted. Everything returned."

**Client:** ROUNDTRIP, a fictional city curbside recycling program
**Deliverable:** A 15-second logo sting with tagline. In one continuous move it goes from booking a pickup, to the program's impact, to the brand lockup.
**Format:** 1920×1080, 30 fps, exactly 15.0 s (450 frames), no audio
**Output:** `out/video.mp4`

---

## Concept

One action sets off the whole chain. A cursor books a recycling pickup, the confirm button's ripple opens into a counter showing how much the city has kept out of landfill, and that counter closes into a loop that becomes the logo. Each beat comes out of the one before it through a mask or wipe, with no hard cuts, so the video itself goes round in a loop like the program does.

---

## Palette

| Role | Hex |
|---|---|
| Background: deep forest | `#0F2A1F` |
| Secondary surfaces, card shadows, inactive chips | `#1E4A36` |
| Primary accent: fresh leaf green (fills, logo mark, wipes) | `#3DDC84` |
| Paper / UI card / main type | `#F4EFE3` |
| Highlight: amber (cursor click flash, counter unit, one tagline word) | `#FFB547` |
| Ink: text on cream, cursor outline | `#0A1A13` |

No other colors. Tints are allowed only as opacity changes of these six.

## Typography

- **Space Grotesk** (Medium 500 / Bold 700): wordmark, tagline, UI headings and button labels.
- **JetBrains Mono** (Regular 400 / Bold 700): all numbers, counters, small UI labels and the time stamp.

## On-screen copy (complete and exhaustive)

Only the following text may appear, exactly as written:

1. `Schedule a pickup`
2. `Choose materials`
3. `Paper`
4. `Plastic`
5. `Glass`
6. `Metal`
7. `0/4 selected` → counts to `4/4 selected`
8. `Schedule pickup`
9. `Booked · Thu 08:00`
10. `0` → counts to `12,480`
11. `kg`
12. `kept out of landfill this month`
13. `ROUNDTRIP`
14. `Nothing wasted. Everything returned.`

---

## Beats

### Beat 1: Opening wipe (0.0–2.0 s)
- The frame opens on flat `#F4EFE3`.
- **0.2 s:** A wide `#3DDC84` band, angled at 20°, sweeps left to right across the frame (0.7 s, ease-in-out). A second `#0F2A1F` band follows 4 frames behind it and leaves the deep-forest background in place: a two-layer masked wipe.
- **1.0 s:** A thin 2 px cream line draws horizontally from center out to 760 px wide. It then unfolds downward as a rectangular mask and reveals the UI card (760×540 px, 24 px corner radius, `#F4EFE3`, soft `#1E4A36` drop shadow), centered.
- **Handover:** The card's contents are already in place when the mask finishes at 2.0 s.

### Beat 2: UI mockup with cursor (2.0–6.5 s)
- **Card layout:**
  - Top left: `Schedule a pickup` (Space Grotesk Bold, 40 px, ink).
  - Below it: `Choose materials` (JetBrains Mono, 18 px, ink at 60%).
  - Top right: `0/4 selected` (JetBrains Mono, 18 px).
  - Middle: a 2×2 grid of pill chips, each 300×72 px and outlined in `#1E4A36`: `Paper`, `Plastic`, `Glass`, `Metal`.
  - Bottom: a full-width ink button labelled `Schedule pickup` in cream.
- **2.2 s:** A cursor arrow (cream fill, 2 px ink outline, 32 px tall) glides in from the bottom right on a gentle curved path with eased deceleration.
- **2.6–5.0 s:** The cursor clicks each chip in turn, about 0.55 s apart. Each click does three things:
  - The chip dips to 96% scale for 3 frames.
  - A `#3DDC84` fill wipes through the pill left to right inside its shape (8 frames).
  - A checkmark strokes on before the label.

  At each click the counter top right ticks up (`1/4`, `2/4`, `3/4`, `4/4 selected`). The new digit slides up into a masked slot while the old one slides out the top.
- **5.3 s:** The cursor moves to the button and clicks it. The button dips to 96%, a small amber flash ring pulses at the cursor tip, and the label swaps through a vertical masked roll to `Booked · Thu 08:00`.
- **Handover (5.9–6.5 s):** A `#3DDC84` circle grows from the click point and fills the whole frame (ease-in, 0.6 s). The card and cursor disappear under it.

### Beat 3: Impact counter (6.5–10.0 s)
- **6.5 s:** Inside the green field, a `#0F2A1F` circle opens from center as a circular mask and returns the deep-forest background. The green stays as a 6 px ring that settles at 620 px diameter, centered.
- **Counter:** Inside the ring, a large counter in JetBrains Mono Bold, 180 px, cream, runs from `0` to `12,480` over 2.2 s (6.7–8.9 s) with ease-out.
  - Odometer style: each digit rolls vertically inside its own masked slot.
  - Digits settle right to left, the rightmost first, the leftmost last.
  - The comma pops in once the value passes 999.
- **Unit and label:** `kg` in amber (JetBrains Mono, 56 px) sits baseline-aligned to the right of the digits. Below the digits, `kept out of landfill this month` (JetBrains Mono, 24 px, cream at 70%) types on character by character from 7.4 to 8.6 s.
- **While counting:** The green ring fills clockwise as a progress arc and reaches a full loop exactly when the counter lands. The finished value holds until 9.4 s.
- **Handover (9.4–10.0 s):** The label and digits wipe out downward through a horizontal mask. The ring shrinks to 160 px diameter and moves to its logo position, 340 px left of center.

### Beat 4: Logo build (10.0–12.5 s)
- **Mark:** The ring splits into two semicircular arcs, each 14 px stroke in `#3DDC84`, with a small triangular arrowhead drawing onto the leading end of each arc. The two arrows chase each other and rotate 180° together (0.8 s, ease-in-out), then settle as the ROUNDTRIP loop mark.
- **10.9 s:** `ROUNDTRIP` (Space Grotesk Bold, 120 px, cream, letter-spacing +2%) appears by sliding right out from behind the mark. A vertical mask edge locked to the mark's right side keeps the letters hidden until they clear it (0.7 s, ease-out).
- **11.8–12.5 s:** A single 4 px `#3DDC84` underline draws left to right beneath the wordmark, 30 px below the baseline.

### Beat 5: Tagline and hold (12.5–15.0 s)
- **12.5 s:** The underline becomes the bottom edge of a mask for the tagline: `Nothing wasted. Everything returned.` in Space Grotesk Medium, 44 px, cream. It reveals word by word, each word rising 24 px from beneath the line, staggered 4 frames apart. `returned.` is set in `#FFB547`.
- **13.4 s:** The underline retracts from both ends toward center and vanishes. The loop mark turns a further 360° once, slowly, with ease-in-out, and comes to rest.
- **13.8–15.0 s:** Full lockup holds still. The frame is fully settled, with no motion in the last 0.5 s.

**Timing check:** 2.0 + 4.5 + 3.5 + 2.5 + 2.5 = **15.0 s**

---

## Must
- Run exactly 15.0 s at 30 fps, 1920×1080, with no audio, rendered to `out/video.mp4`.
- Make every beat change through a mask, wipe or reveal. No hard cuts and no plain cross-fades.
- Use per-digit masked rolls for both counters (`0/4 → 4/4`, `0 → 12,480`), not plain number swaps.
- Keep the cursor visible and reading as real interaction: eased paths, a press-dip on every click, and an amber flash on the final click.
- Build everything from flat shapes, strokes and the two named fonts.
- Keep the final lockup (mark, wordmark, tagline) centered as a group, legible, and completely still for the last 0.5 s.
- Keep all text inside a 96 px safe margin.

## Must not
- No text other than the 14 listed copy items, including no URLs, legal lines or placeholder text.
- No photos, footage, textures, stock icons, real brand logos or the universal recycling symbol. The loop mark must be the original two-arrow design described above.
- No colors outside the six-hex palette, and no gradients except opacity changes of palette colors.
- No fonts other than Space Grotesk and JetBrains Mono.
- No bouncy or elastic overshoot beyond 4%, no 3D camera moves, no blur-heavy effects.
- No motion in the final 0.5 s.
