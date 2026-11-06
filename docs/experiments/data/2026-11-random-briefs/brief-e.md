# Brief: "Rivergate City Marathon: By the Numbers"

**Format:** 1920×1080, 30 fps, exactly 19.0 s (570 frames), no audio
**Deliverable:** the finished video goes to `out/video.mp4`
**Genre:** infographic. Five facts about a fictional city marathon. Each fact gets its own visual metaphor, and the shot moves through a layered, dimensional city.

---

## Concept

The camera starts on a city skyline at dusk, built from flat layers. It tilts down onto the marathon route, which lies on a 3D ground plane, then follows the race's data: distance, aid stations, runners and finish times. One orange dot, the "runner," ties the piece together. It draws the route, turns into water drops, breaks into a crowd of dots that become a bar chart, and finally becomes a finisher's medal. Every number appears through a mask or wipe. Nothing fades in.

---

## Palette

| Hex | Role |
|---|---|
| `#0E1B2C` | Background: night navy, used for the full frame in every beat |
| `#1F3A56` | Far and mid skyline layers, ground plane, grid lines, inactive dots |
| `#FF5A1F` | Signal orange: the runner dot, route line, key numbers, medal |
| `#4FB3FF` | River blue: water drops, aid-station markers, the river shape |
| `#F4EFE6` | Warm paper: all body type, labels, near skyline layer outlines |
| `#FFC94A` | Medal gold: used only for the medal rim and the "SUB 3:00" bar |

No other colors. Gradients are allowed only between two palette colors, and only on the skyline's sky band (`#0E1B2C` to `#1F3A56`, top to bottom).

## Typography

- **Bebas Neue:** all numbers and headlines. Numbers are set very large (hero numbers 300–420 px cap height). Tracking +2%.
- **Inter:** labels and secondary lines. Medium weight, 28–40 px, all caps, tracking +8%.
- Nothing smaller than 28 px. All type stays inside a 96 px safe margin.

---

## On-screen copy (exhaustive)

Only these strings may appear, exactly as written:

1. `RIVERGATE CITY MARATHON`
2. `2027 · BY THE NUMBERS`
3. `42.195`
4. `KM`
5. `ONE LOOP THROUGH 6 DISTRICTS`
6. `START`
7. `HALF`
8. `FINISH`
9. `18`
10. `AID STATIONS`
11. `120,000 CUPS OF WATER`
12. `31,000`
13. `RUNNERS`
14. `1 DOT = 310 RUNNERS`
15. `FINISH TIMES`
16. `SUB 3:00`
17. `3:00–4:00`
18. `4:00–5:00`
19. `5:00+`
20. `6%`
21. `34%`
22. `41%`
23. `19%`
24. `SUNDAY 11 APRIL 2027`
25. `SEE YOU AT THE START LINE`

Numbers do **not** count up or roll through intermediate values. Each one appears at its final value through a mask.

---

## Beats

### Beat 1: Skyline & title (0.0 – 3.5 s)
- **On screen:** a skyline made of flat rectangles and stepped towers in three depth layers. The far layer is `#1F3A56` at 60% opacity, the mid layer is solid `#1F3A56`, and the near layer has `#F4EFE6` 3 px outlines on navy. A thin `#4FB3FF` river band runs along the bottom. The orange runner dot (24 px) sits at the river's left edge.
- **Motion:** the camera dollies right and slightly forward. The layers move at clearly different speeds (far 0.2×, mid 0.5×, near 1×), which gives strong parallax. At 0.6 s, `RIVERGATE CITY MARATHON` (Bebas Neue, about 160 px) is revealed by a hard-edged horizontal wipe from left to right. The wipe edge is a 6 px orange bar that travels with it, then shrinks to nothing. At 1.4 s, `2027 · BY THE NUMBERS` (Inter) appears below through a mask that rises from the baseline.
- **Handover (3.0–3.5 s):** the title wipes out right to left. The camera tilts down about 60°, so the skyline layers fall away upward at their parallax speeds. The river band rotates into a flat ground plane, and that plane becomes the map in Beat 2.

### Beat 2: The distance (3.5 – 7.5 s)
- **On screen:** a perspective ground plane in `#1F3A56` with a faint grid that recedes toward a vanishing point. The route is one closed, irregular loop of rounded segments that crosses the river twice. Six district blocks are drawn as low extruded boxes with visible side faces at different depths.
- **Motion:** the runner dot travels the loop and leaves a 10 px `#FF5A1F` stroke behind it, so the route draws on over 2.5 s. `START`, `HALF` and `FINISH` labels pop up on small vertical stems as the dot passes each one. `START` and `FINISH` share the same point. The district boxes rise from the plane in sequence as the line reaches them, with a slight camera orbit of about 8°. At 4.6 s, the hero `42.195` appears upper right, screen-aligned rather than on the plane. A diagonal mask wipes it in at 15°, and `KM` follows with a short vertical wipe. `ONE LOOP THROUGH 6 DISTRICTS` is revealed underneath by a left-to-right mask.
- **Handover (7.0–7.5 s):** the type wipes off upward. The camera pushes in toward the first point along the route, and the orange dot stays large in frame.

### Beat 3: Aid stations (7.5 – 11.5 s)
- **On screen:** a close, low-angle view along the route line as it recedes into depth. Eighteen small markers line the route at even intervals and shrink with perspective.
- **Motion (shape morphing):** the orange runner dot morphs into a `#4FB3FF` water drop: the circle stretches upward into a pointed teardrop, and the color shifts during the morph. The drop then "drips" onto the first marker and starts a chain reaction. Each of the 18 markers morphs from a flat circle into a drop in turn, from near to far, staggered 2 frames apart, so the wave runs back into depth. At 8.6 s, `18` is revealed in orange by a circular iris mask that grows from the nearest drop. `AID STATIONS` slides in through a rectangular mask beside it. At 9.6 s, `120,000 CUPS OF WATER` appears through a horizontal wipe whose leading edge is a wavy line, like a water surface.
- **Handover (11.0–11.5 s):** the camera rises to a straight-on frontal view. All 18 drops morph back into circles, and the circles multiply into the dot grid of Beat 4.

### Beat 4: Runners & finish times (11.5 – 15.5 s)
- **On screen:** a 10×10 grid of 100 dots, centered left. The skyline layers sit faintly at the top edge, still drifting with slight parallax to keep the depth.
- **Motion:** the dots resolve into the grid with a diagonal stagger, all in `#1F3A56`. Then a diagonal wipe sweeps across and turns them `#F4EFE6`. `31,000` (orange) and `RUNNERS` are revealed at right by a vertical mask from the top. `1 DOT = 310 RUNNERS` appears as a small Inter caption through a left-to-right wipe. At 13.0 s, `FINISH TIMES` replaces that block in a single wipe. The dots then regroup into four colored clusters: 6 gold, 34 orange, 41 blue and 19 paper. Each cluster **morphs** into a solid horizontal bar with rounded ends, and the bar lengths match the dot counts exactly. The labels `SUB 3:00`, `3:00–4:00`, `4:00–5:00` and `5:00+` appear left of the bars. `6%`, `34%`, `41%` and `19%` are revealed at the bar ends by a mask that travels with each bar as it grows.
- **Handover (15.0–15.5 s):** the labels wipe out. The four bars curl and morph together into one ring centered in frame.

### Beat 5: The medal (15.5 – 19.0 s)
- **On screen:** the ring settles into a medal: an orange disc with a `#FFC94A` rim and a two-strap V-shaped ribbon in orange and navy-blue above it. The medal sits in 3D space with the three skyline layers behind it.
- **Motion:** the medal does a slow 3D half-turn of about 25° on its vertical axis, so it catches the depth. The skyline layers behind it parallax in the opposite direction. At 16.2 s, `SUNDAY 11 APRIL 2027` is revealed below by a split-from-center horizontal wipe. At 16.9 s, `SEE YOU AT THE START LINE` (Inter) follows through a rising mask. From 17.6 s the medal shrinks back into the 24 px orange runner dot, which closes the loop of the piece.
- **End (17.8–19.0 s):** a clean hold. The runner dot, both lines of type and the skyline stay settled with no motion, so the video ends on a stable frame for the full final 1.2 s.

Beat durations are 3.5 + 4.0 + 4.0 + 4.0 + 3.5, which adds up to **19.0 s**.

---

## Must
- Show real 3D depth in at least three beats: layered parallax skyline, perspective ground plane with extruded blocks, and the medal's 3D turn.
- Reveal every piece of text through a mask or wipe, with no plain fades. Use at least four distinct mask shapes: linear, diagonal, iris and wavy edge.
- Show at least four clear shape morphs: dot → drop, drop → dot grid, dot clusters → bars, bars → ring/medal.
- Use the single orange runner dot as the continuous thread from the first frame to the last.
- Make bar lengths and dot counts match the stated percentages exactly.
- Use only the six palette colors and the two named fonts.
- Hit 570 frames exactly at 1920×1080, 30 fps, with no audio track. Export to `out/video.mp4`.

## Must not
- Use photos, footage, textures, stock icons, real maps, real city names or any real brand or event logos.
- Show any text outside the copy list. That includes counting-up digits, watermarks, credits and timecodes.
- Use audio, voiceover or music.
- Cut hard between beats. Every handover comes from camera movement, a morph or a wipe.
- Let type cross the 96 px safe margin or drop below 28 px.
- Add motion blur heavy enough to make numbers unreadable. Every hero number must sit fully legible for at least 1 s.
