# Brief: "Borrowed Lightning"

**Genre:** Kinetic poem (no voice)
**Subject:** Electric ferries
**Format:** 1920×1080, 30 fps, exactly 17.0 s (510 frames), no audio
**Deliverable:** `out/video.mp4`

---

## Concept

A short poem about the quiet electric ferry, set in one harbor at blue hour. Each line is drawn: the waterline, the ferry, the charging cable, the wake and the route are all strokes that draw themselves on screen. The words move the way the poem reads. "No smoke" breaks into drifting particles, "no roar" shrinks into silence, and those same particles come back together as current flowing into the boat. The tone is calm and confident, with a little wonder. Think of a quiet engineering marvel, not an ad.

---

## Palette

| Role | Hex |
|---|---|
| Background: harbor night | `#0B1D2E` |
| Water, wake lines, secondary strokes | `#1F6F78` |
| Electric charge: cable pulses, sparks, highlight words | `#3FE0D0` |
| Primary type, ferry outline | `#F2EDE4` |
| Accent: harbor lights, charge-complete burst | `#FFB547` |

No other colors. Lower opacity of these five colors is allowed for reflections and fading particles.

## Fonts

- **Space Grotesk** (Medium 500 and Bold 700) for every poem line.
- **JetBrains Mono** (Regular 400) only for the two small technical labels.

---

## On-screen copy (complete; nothing else may appear)

Poem lines, all lowercase, in Space Grotesk:

1. the harbor wakes
2. no smoke
3. no roar
4. just current
5. plugged into the shore
6. we cross
7. on borrowed lightning
8. quiet water
9. carries us home

Labels, in uppercase JetBrains Mono at 22 px with letter-spacing +8%:

- SHORE POWER
- FULL

No numbers, percentages, place names, logos, credits or end titles.

---

## Recurring elements (all flat strokes and shapes)

- **Waterline:** one horizontal stroke at y = 760 px, 3 px wide, `#1F6F78`, spanning the full width.
- **Ferry:** a simple double-ended ferry profile, about 520 px long. It has a shallow hull, a long low cabin with a row of 8 rounded-rectangle windows and a small wheelhouse on top. It has no funnel. Drawn as a 4 px `#F2EDE4` outline with no fill, except the windows, which light up `#FFB547` later.
- **Pier and charging mast:** at the left edge, a short pier deck with a vertical mast and an arm, drawn as 4 px `#F2EDE4` lines.
- **Swell:** the ferry and the text that sits on the waterline bob on a gentle loop of ±4 px over a 2.4 s cycle, eased in and out. This keeps the frame breathing throughout.

---

## Beats (total 17.0 s)

### Beat 1: Waking (0.0 – 3.0 s)
- **0.0 – 0.8 s:** The frame is empty navy. The waterline draws itself from left to right with an ease-out curve. A small `#3FE0D0` dot rides its leading tip.
- **0.6 – 2.0 s:** The pier and mast draw at the left. Then the ferry outline draws in one continuous stroke: up the bow, along the cabin, over the wheelhouse and down the stern. It is moored at the pier, its hull centered at x ≈ 620.
- **1.4 – 3.0 s:** "the harbor wakes" (Space Grotesk Medium, 96 px, `#F2EDE4`) rises out of the water above the ferry at y ≈ 360. The letters stagger in 40 ms apart. Each one slides up 30 px from behind a mask at the waterline and settles with a slight overshoot.
- **Handover:** the line lifts 20 px and fades out over 0.3 s.

### Beat 2: Silence (3.0 – 6.5 s)
- **3.0 – 4.2 s:** "no smoke" (Bold, 140 px, `#F2EDE4`) slams in, centered, with a quick scale from 110% to 100%. After 0.5 s each letter breaks into 40–60 small circles (2–6 px, `#F2EDE4`). The circles drift up and sideways like smoke, then fade to nothing.
- **4.2 – 5.3 s:** "no roar" (Bold, 220 px) arrives loud: a hard scale-in and a ±6 px shake for 8 frames. Then it shrinks to 40 px and drops in opacity over 0.6 s, a word losing its voice. It vanishes into a single `#3FE0D0` point.
- **5.3 – 6.5 s:** That point pops into a small burst of about 80 cyan sparks. The sparks swarm left toward the mast and resolve into "just current" (Medium, 110 px, `#3FE0D0`), which assembles from the incoming particles letter by letter.
- **Handover:** the "just current" letters stream out as sparks into the mast's arm, which flashes once.

### Beat 3: Charging (6.5 – 10.0 s)
- **6.5 – 7.5 s:** A charging cable draws itself as a smooth curve from the mast arm to the ferry's bow, 5 px wide, `#3FE0D0`. "SHORE POWER" types on beside the mast, one character every 2 frames.
- **7.3 – 9.3 s:** Bright pulses (short cyan dashes with a soft glow) travel along the cable into the ferry, about 3 per second and speeding up. With each pulse a cabin window lights `#FFB547`, from bow to stern, until all 8 are lit. Meanwhile "plugged into the shore" (Medium, 84 px, `#F2EDE4`) sets in word by word. Each word drops 24 px onto a shared baseline at y ≈ 300.
- **9.3 – 10.0 s:** Charge complete. "FULL" replaces "SHORE POWER" with a 4-frame flicker. A radial burst of about 120 particles, mixing `#FFB547` and `#3FE0D0`, fires from the plug point. Then the cable retracts back along its own path to the mast.
- **Handover:** the poem line slides out to the left as the ferry starts to move to the right.

### Beat 4: The Crossing (10.0 – 13.5 s)
- **10.0 – 11.0 s:** The ferry glides from x ≈ 620 to x ≈ 1300 with an ease-in-out move, and the pier slides off the left edge. Three wake arcs (`#1F6F78`, 3 px) draw themselves outward from the stern and fade at their tails. "we cross" (Bold, 120 px, `#F2EDE4`) tracks across the top. Its letter-spacing opens from −2% to +12%, as if the words were moving too.
- **11.0 – 13.5 s:** A dotted route line (dashes of 6 px with 10 px gaps, `#3FE0D0`) draws itself in an arc above the ferry toward the right edge, where a second pier begins to draw. "on borrowed lightning" sets in at y ≈ 280, Medium, 96 px. On the word "lightning" a 3-segment zigzag stroke in `#3FE0D0` strikes through the letters in 6 frames. The word turns `#3FE0D0` and throws a small burst of about 30 sparks.
- **Handover:** the route line finishes exactly at the far pier as the text fades out over 0.3 s.

### Beat 5: Homecoming (13.5 – 17.0 s)
- **13.5 – 14.8 s:** The ferry eases to a stop at the far pier. "quiet water" (Medium, 104 px, `#F2EDE4`) settles onto the waterline from above. A mirrored copy appears below the waterline at 25% opacity, rippling horizontally by ±3 px.
- **14.8 – 16.0 s:** "quiet water" dissolves upward into soft `#FFB547` particles. They drift to random points along the horizon and settle as about 14 small, slowly twinkling harbor lights. "carries us home" (Bold, 112 px, `#F2EDE4`) assembles in their place. On the word "home", the window glow pulses once.
- **16.0 – 17.0 s:** Hold the final frame. The wake, the route and the ferry outline un-draw in reverse along their own paths over 0.7 s. Only the waterline, the harbor lights and "carries us home" remain. The last 6 frames hold still. There is no fade to black.

**Timing check:** 3.0 + 3.5 + 3.5 + 3.5 + 3.5 = **17.0 s**

---

## Must
- Every structural element (waterline, ferry, pier, mast, cable, wake, route, zigzag) appears by drawing itself along its path, not by fading in.
- Particles visibly turn words into energy: the smoke dissolve, the spark reassembly, the charge-complete burst and the harbor lights.
- Use only the five palette colors and the two named fonts.
- Show only the exact copy listed above, all lowercase except the two mono labels.
- Keep all type at least 80 px inside every frame edge. Each poem line stays readable for at least 1.0 s at full opacity.
- Use eased motion throughout, with no linear moves except the travel of the particle drift and the cable pulses.
- Run exactly 510 frames at 1920×1080, 30 fps, with no audio track, exported to `out/video.mp4`.

## Must not
- No photos, footage, textures, stock imagery, 3D renders or gradients beyond soft glows.
- No real ferry operators, brands, logos, ship names, routes or place names.
- No funnels, smoke stacks or exhaust on the ferry.
- No voice-over, music, sound effects or subtitles beyond the poem lines.
- No numbers, percentage counters, charts or extra labels.
- No hard cuts. Every beat hands over through motion.
- No more than one poem line on screen at a time, except the brief reflection of "quiet water".
