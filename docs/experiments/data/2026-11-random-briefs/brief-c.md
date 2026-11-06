# Brief: "Cleaner Wake", Brindle Bay Ferries' 2026 in review

**Genre:** Year-in-review
**Subject:** Electric ferries. The client is Brindle Bay Ferries, a fictional harbour operator that finished its first full year with an all-electric fleet.
**Format:** 1920×1080, 30 fps, exactly 15.0 s (450 frames), no audio
**Deliverable:** `out/video.mp4`

---

## Concept

The whole year is told as one continuous line. A single charge-lime point draws the harbour, runs the ferry routes, fills a battery and plots the year's energy curve. At the end it signs off. Every scene hands over to the next through a shared element (a match cut), so there are no hard cuts. Under everything, the water never stops moving.

## Palette

| Role | Hex |
|---|---|
| Background: deep night water | `#0B1E2D` |
| Ambient wave lines and land masses | `#173A52` |
| Routes, chart line and secondary accents: harbour teal | `#1FB5A8` |
| Charge accent (the travelling point, battery fill, key numbers): electric lime | `#D7F25C` |
| All type and the ferry glyph: foam white | `#EEF4F2` |

No other colours. Tints are allowed only as opacity of these five.

## Typography

- **Space Grotesk** (Medium 500 and Bold 700) for headlines and big numbers. Numbers use tabular figures.
- **JetBrains Mono** (Regular 400) for small labels and the month axis, set in all caps with +8% tracking.

## Exact on-screen copy

Only these words, numbers and symbols may appear:

1. `BRINDLE BAY FERRIES`
2. `2026 IN REVIEW`
3. `NORTH QUAY` · `MILL POINT` · `ASHER ISLAND` · `OLD DOCKS`
4. `41,600` · `CROSSINGS`
5. `6 FERRIES. 0 DIESEL.`
6. `CHARGED AT THE DOCK IN 7 MIN`
7. `J F M A M J J A S O N D`
8. `12.4 GWh` · `SHORE POWER`
9. `8,300 t CO₂ AVOIDED`
10. `Same water. Cleaner wake.`
11. `SEE YOU IN 2027`

## Living ambient background (runs 0–15 s, never pauses)

- **Wave lines:** nine horizontal wave contour lines in `#173A52`, 2 px stroke, spaced evenly across the frame. Each line is a gentle sine wave with an amplitude of 6–14 px and a wavelength of 600–900 px. Its phase drifts sideways at its own speed, between 8 and 22 px/s, with alternate lines drifting in opposite directions.
- **Breathing glow:** a very soft radial glow of `#1FB5A8` at 6% opacity, about 1100 px across. It drifts slowly from the lower left to the upper right over the full 15 s and breathes in scale (±4%) on a 5 s cycle.
- **Parallax:** when the camera pushes in or out (beats 3 and 5), the waves move with 0.3× parallax so the background feels deep rather than pasted on.

## Beats

### Beat 1: The first line (0.0–2.5 s, frames 0–74)
- **0.0–0.3 s:** the screen shows only the moving waves.
- **0.3 s:** a lime point (14 px) pops in at frame centre with a small overshoot.
- **From 0.6 s:** the point races left and right, drawing a 2 px foam-white horizon line edge to edge. The draw-on has an ease-out and lasts 0.6 s.
- **Title:** `BRINDLE BAY FERRIES` (Space Grotesk Bold, 72 px) rises 24 px above the line and fades up. `2026 IN REVIEW` (JetBrains Mono, 28 px, lime) types on below the line, letter by letter, from 1.2 s to 1.8 s.
- **Handover (2.1–2.5 s):** the type drops out downward with a 30 px slide and fade. The horizon line bends and breaks into the coastline of the harbour map: the straight line morphs into a coastline outline. This is the first match cut.

### Beat 2: The routes (2.5–6.0 s, frames 75–179)
- **Map:** a simple, flat-shaded harbour map. There are two land masses and one island in `#173A52`, outlined in 2 px foam white. The four terminals are white rings, 18 px across, labelled in JetBrains Mono at 22 px: `NORTH QUAY`, `MILL POINT`, `ASHER ISLAND`, `OLD DOCKS`.
- **Routes:** three curved routes in teal draw themselves as 4 px strokes with round caps, one after another (offset 0.35 s, each draw 0.9 s, with an ease-in-out). A small ferry glyph (a rounded hull and cabin in foam white) rides the leading tip of each route as it draws. A lime spark ring pulses once at each terminal when a route arrives.
- **Counter:** in the top-right corner, `41,600` counts up from 0 in Space Grotesk Bold at 120 px in lime, with the label `CROSSINGS` in Mono below it. The count runs from 3.0 s to 5.4 s and settles on the final number with an ease-out.
- **Handover (5.6–6.0 s):** the camera pushes hard into the ferry on the ASHER ISLAND route. The small glyph scales up to become the big hull of Beat 3, staying the same shape throughout. This is the second match cut.

### Beat 3: The battery (6.0–9.0 s, frames 180–269)
- **Hull:** the large ferry hull sits centred, about 1100 px wide, drawn as a foam-white line, on a single teal waterline. Its interior shows a battery bank of 10 rounded cells, outlined in teal.
- **Charging:** a thin lime charging cable draws itself down from the top edge of the frame to a dock post. The cells then fill with lime one by one, left to right, from 6.4 s to 8.2 s, each with a 4-frame flash.
- **Copy:** `6 FERRIES. 0 DIESEL.` (Space Grotesk Bold, 84 px) slides up above the hull. `CHARGED AT THE DOCK IN 7 MIN` (Mono, 26 px) appears below the waterline at 7.2 s.
- **Handover (8.6–9.0 s):** the hull outline, cells and text fade out. Only the top edge of the lime fill stays, as a straight lime line. The camera slides it down to become the baseline of the chart in Beat 4. This is the third match cut.

### Beat 4: The year in energy (9.0–12.0 s, frames 270–359)
- **Axis and curve:** the lime line becomes the x-axis, and the month labels `J F M A M J J A S O N D` appear beneath it, one after another. The year's energy curve rises out of the axis and draws itself left to right as a 4 px teal line, with a lime point riding its tip. It runs from 9.3 s to 11.2 s.
- **Shape of the curve:** a small winter dip, a high summer peak, and December ending highest.
- **Fill:** a soft teal fill at 15% opacity grows under the curve as it draws.
- **Copy:** `12.4 GWh` (Space Grotesk Bold, 120 px, foam white) with `SHORE POWER` (Mono) appears upper left at 9.8 s. `8,300 t CO₂ AVOIDED` (Space Grotesk Medium, 56 px, lime) appears at 10.6 s.
- **Handover (11.6–12.0 s):** everything else fades out. The lime point at December stays and keeps the energy of its last movement. This is the fourth match cut, back to the opening point.

### Beat 5: The sign-off (12.0–15.0 s, frames 360–449)
- **Last line:** the lime point glides to frame centre and draws one last line, a long, gently curving wake behind a small ferry glyph. The wake draws from right to left across the frame from 12.2 s to 13.4 s. The camera pulls back slowly, 6% over the beat.
- **Copy:** `Same water. Cleaner wake.` (Space Grotesk Medium, 80 px, foam white) fades up word by word above the wake. `SEE YOU IN 2027` (Mono, 28 px, lime) follows below it at 13.6 s.
- **Hold:** the frame holds from 14.0 s to 15.0 s. The waves keep drifting and the lime point pulses softly once. The last frame is a clean, still-looking end card with the waves moving behind it.

**Total: 2.5 + 3.5 + 3.0 + 3.0 + 3.0 = 15.0 s**

---

## Must
- Keep one lime point or line visible and continuous across every handover, so the video reads as one unbroken line.
- Show at least four visible self-drawing lines: the horizon, the routes, the charging cable plus chart curve, and the wake.
- Make all four transitions true shared-element match cuts. There must be no hard cuts, dips to black or crossfades between unrelated elements.
- Keep the ambient waves and glow moving on every frame from 0 to 450.
- Use easing on every move, with no linear motion except the wave drift. Keep all text inside 96 px safe margins.
- Keep every number on screen for at least 1.0 s after it settles, so it can be read.
- Render to exactly 450 frames at 1920×1080, 30 fps, saved as `out/video.mp4`.

## Must not
- No photos, footage, stock imagery, textures, real maps, real operator names or real brand logos.
- No text beyond the exact copy list above. That includes no captions, credits, watermarks or extra units.
- No colours outside the five-colour palette, and no fonts other than Space Grotesk and JetBrains Mono.
- No audio track.
- No 3D renders, lens flares, glitch effects or fast flashing. The only flash is the 4-frame cell flash, and nothing should flash more than 3 times per second.
- No frame where the background is completely still.
