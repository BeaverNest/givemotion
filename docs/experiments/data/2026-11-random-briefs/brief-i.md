# Brief: "Low Moon": A Jazz Festival Kinetic Poem

## Overview
This is a 20-second wordless kinetic poem for the fictional **Low Moon Jazz Festival**. A city skyline is sketched in ink, then a hand-drawn festival app appears and a cursor plans someone's night. That plan becomes a brass walking route across a sketched riverside map. In the end the route turns into a musical staff, and the poem's last line swings on it like notes. The whole video is hand-drawn: wobbly ink lines, a gentle line "boil" and handwritten type. Clean UI type and a crisp cursor contrast with it, like a napkin sketch someone can actually use.

**Format:** 1920×1080, 30 fps, exactly 20.0 s (600 frames), no audio.
**Deliverable:** `out/video.mp4`

## Palette
| Role | Hex |
|---|---|
| Paper (background, beats 1–4) | `#F2E8D5` |
| Ink (all sketch lines, main type) | `#1C1A2E` |
| Brass (route, accents, check marks, moon in finale) | `#D9A441` |
| Club Red (pins, cursor click ripples, active states) | `#C8453A` |
| River Blue (river, secondary map strokes) | `#3E5C76` |
| Midnight (ink-flood background, beat 5) | `#14121F` |

No other colors. Tints are made only by lowering opacity.

## Typography
- **Caveat:** all poem lines and hand labels. Poem lines are 84–96 px and look written on.
- **Space Grotesk:** all UI copy and the end-card title. Weights: Medium and Bold. UI text is 26–40 px. The end title is 170 px Bold with +40 tracking.

## Visual language
- **Sketch look:** every drawn line has a slightly uneven 3–5 px stroke with rounded caps and small overshoots at the corners. Lines "boil": each stroke cycles through 3 slightly jittered versions (1–2 px displacement), changing every 3 frames (10 fps). Type does not boil.
- **Write-on:** sketch lines draw along their own path. Caveat words appear with a left-to-right reveal that follows the baseline, about 8 frames per word, as if a pen were writing.
- **Paper texture:** optional. A sparse field of 1 px Ink dots at 5% opacity, kept static.
- **Cursor:** a crisp, solid Ink arrow, 36 px tall, with a 2 px Paper outline. It is the only perfectly clean shape in the sketch world. Each click shows a Club Red ring that grows from 0 to 56 px across 10 frames while fading from 100% to 0%.
- **Motion feel:** relaxed ease-in-out on camera and layout. Poem words land with "swing" timing, alternating long and short gaps in a 2:1 ratio.

## On-screen copy (exhaustive; nothing else may appear)
**Poem (Caveat):**
1. the city clears its throat
2. you choose the night
3. the night chooses the song
4. follow the brass
5. across the river
6. until the streets swing

**App UI (Space Grotesk):**
- LOW MOON
- FRI · SAT · SUN
- 19:30 Harbour Stage, The Velvet Tides
- 21:00 Lantern Hall, Quartet No. 9
- 22:45 Bridge Yard, Juno & the Late Trains
- + Add / Added
- Plan my route

**Map:**
- Labels (Caveat): Harbour Stage · Lantern Hall · Bridge Yard · River Arden
- Pin numbers (Space Grotesk Bold): 1 · 2 · 3
- Times (Space Grotesk): 19:30 · 21:00 · 22:45
- Route chip (Space Grotesk): 1.8 km · 22 min on foot

**End card:**
- LOW MOON (Space Grotesk Bold)
- Jazz Festival (Caveat)
- 12–14 June · Riverside (Space Grotesk Medium)

## Beats

### Beat 1: The sketch wakes up (0.0–3.0 s, frames 0–89)
- **0.0–1.2 s:** On Paper, a single Ink line enters from the left edge at about two-thirds height. It draws one continuous skyline of rooftops, chimneys and a water tower across the frame.
- **1.2–1.6 s:** Without lifting the pen, the line loops up and draws a low crescent moon just above the rooftops, right of center.
- **1.0–2.6 s:** Below the skyline, poem line 1 *"the city clears its throat"* writes on word by word.
- **1.8–2.4 s:** Five small windows sketch into the buildings with a 3-frame stagger. One window, center-left, fills with a Brass hatch.
- **Handover (2.5–3.0 s):** The camera pushes into the Brass window. Its rectangle scales up and rounds its corners into a hand-drawn phone outline (match cut). The skyline and poem line slide out of frame as the camera moves in.

### Beat 2: Choosing the night (3.0–8.0 s, frames 90–239)
**Layout:** The sketched phone sits centered at x = 620, about 460×900 px, with an Ink outline. Inside, a wireframe-style app: header "LOW MOON", tabs "FRI · SAT · SUN" and three empty sketch rows. Poem lines appear in the right third, left-aligned at x = 1080.

- **3.3 s:** The cursor enters from the bottom-right and glides to the SAT tab with an ease-out.
- **4.0 s:** The cursor clicks SAT and the red ripple fires. A Brass underline swipes in under SAT in 6 frames. The three schedule rows cascade in with a 4-frame stagger, each sliding up 20 px. At the same moment, *"you choose the night"* writes on at right.
- **5.0 s, 5.6 s, 6.2 s:** The cursor clicks "+ Add" on rows 1, 2 and 3 in turn. Each button flips to "Added", and a Brass check mark draws on beside it in 6 frames.
- **6.0 s:** *"the night chooses the song"* writes on under the first poem line.
- **6.8 s:** The cursor moves to the bottom button "Plan my route". On the click, the button presses down 4 px (scale 0.96, 3 frames) and then releases.
- **Handover (7.3–8.0 s):** The phone screen's contents wipe away top-to-bottom to reveal map strokes underneath. The phone outline scales to 2.2× past the frame edges over 20 frames, so the map fills the frame. The poem lines fade out over 10 frames.

### Beat 3: The route (8.0–13.0 s, frames 240–389)
**The map (full frame):**
- River Arden is a double wobbly River Blue line running diagonally from the upper-left to the lower-right, with short hatch strokes inside.
- About eight loose Ink street lines and one sketched bridge.
- The map labels are written in Caveat at 40 px.

**Action:**
- **8.0–8.6 s:** Three Club Red pins numbered 1, 2 and 3 drop in with a small bounce (overshoot 8 px, settle in 6 frames) at Harbour Stage, Lantern Hall and Bridge Yard.
- **8.4 s:** The route chip "1.8 km · 22 min on foot" slides in at the top-left: a sketched rounded rectangle with Space Grotesk text.
- **8.8–12.4 s:** A dashed Brass route line, 6 px, draws along the streets from pin 1 to 2 to 3. A solid Brass dot leads it. The camera follows the dot with a gentle 140 px pan. As the line reaches each pin, that pin pulses once (scale 1.15) and its time writes on beside it: 19:30, 21:00, 22:45.
- **9.0 s:** *"follow the brass"* writes on, following the curve just above the route line.
- **10.8 s:** As the route crosses the bridge, *"across the river"* writes on below the bridge.
- **Handover (12.4–13.0 s):** All map strokes, labels and the chip fade to 15% opacity. The Brass route line stays at full strength.

### Beat 4: The streets swing (13.0–17.0 s, frames 390–509)
- **13.0–14.0 s:** The route line pulls itself straight into a horizontal line across the frame. It then splits into five parallel lines, 22 px apart: a hand-drawn musical staff centered vertically. The three pins slide onto the staff and become filled Club Red note heads, each with a sketched Ink stem.
- **14.0–15.6 s:** *"until the streets swing"* lands word by word on the staff in swing timing (gaps of 10, 5, 10 frames). Each word sits at a different staff height, like a rising phrase. Each word drops 30 px into place with a small bounce, and on each landing one note head bobs.
- **Handover (15.8–17.0 s):** Starting from the last note head, a Midnight ink flood with a wobbly, boiling edge spreads outward and covers the frame. The staff and words are swallowed as it passes.

### Beat 5: End card (17.0–20.0 s, frames 510–599)
- **17.0–17.6 s:** On Midnight, the crescent moon from beat 1 redraws in Brass at the upper-right, sitting low, in one stroke.
- **17.3–18.2 s:** "LOW MOON" rises 24 px and fades in, letters staggered by 2 frames, in Paper-colored Space Grotesk Bold at 170 px, centered. "Jazz Festival" writes on beneath it in Brass Caveat at 96 px.
- **18.4 s:** "12–14 June · Riverside" fades in below in Paper Space Grotesk Medium at 36 px.
- **18.4–20.0 s:** Six tiny hand-drawn Brass stars appear around the moon and boil.
- **19.0–20.0 s:** Hold. Only the line boil moves; nothing else.

## Must
- Total exactly 600 frames at 30 fps, 1920×1080, with no audio track. Export to `out/video.mp4`.
- Use only the copy listed above, word for word, including the en dash in "12–14", the "·" separators, the comma after each stage name and the lowercase poem lines.
- Show all three techniques clearly: the cursor clicking through the app (beat 2), the route drawing across the map (beat 3), and line boil and write-on throughout.
- Make the transitions continuous: window to phone, phone to map, route to staff, ink flood to end card. No hard cuts.
- Keep all type inside a 96 px safe margin.

## Must not
- No photos, footage, stock images, icons from real products, or real brand logos. Draw everything from lines, shapes and type.
- No colors outside the palette, and no gradients except opacity fades.
- No fonts other than Caveat and Space Grotesk.
- No voice, music or captions describing sound.
- No camera shake, lens flares, or 3D extrusion on type.
- No text other than the listed copy, so no watermarks, credits or URLs.
