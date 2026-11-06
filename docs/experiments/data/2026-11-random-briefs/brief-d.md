# Brief: "Every Roof Is a Field" — ROOFCOMB Manifesto

## Overview
An 18-second brand manifesto for **ROOFCOMB**, a fictional urban beekeeping collective. The film argues one idea: the city is habitat, not wasteland. A single honeycomb cell is the shared element throughout. It becomes a city of lit windows, the skyline becomes a bar chart of the collective's growth, and a bee's flight path draws the final mark. Bold kinetic type carries the voice, and transitions are hard match cuts with no fades between ideas. The mood is warm, confident and civic, like a protest poster with honey poured on it.

- **Format:** 1920×1080, 30 fps, exactly 18.0 s (540 frames), no audio
- **Delivery:** the finished video goes to `out/video.mp4`

## Palette
| Hex | Role |
|---|---|
| `#1B1A17` | Asphalt: background for the whole video |
| `#F2A900` | Honey: hero color for hexagons, chart bars, key words |
| `#F6EAD2` | Wax: primary type, outlines, bee body stripes |
| `#B5482F` | Brick: building silhouettes, one accent word |
| `#6E8F4E` | Leaf: rooftop flowers and the final-year bar highlight |
| `#8C8A84` | Concrete: chart axis, gridlines, year labels, small captions |

## Fonts
- **Bebas Neue:** all manifesto lines and the wordmark
- **JetBrains Mono:** chart title, years, values and the tagline

## On-screen copy (exhaustive: nothing else may appear)
1. THE CITY IS NOT A DESERT.
2. EVERY ROOF IS A FIELD.
3. ROOFTOP HIVES WE TEND
4. 2021 · 2022 · 2023 · 2024 · 2025 · 2026
5. 3 · 9 · 17 · 26 · 41 · 58
6. EVERY HIVE IS A NEIGHBOR.
7. ROOFCOMB
8. We keep bees where you live.

Counter digits may roll through intermediate numbers on the way to each final value. No other words, numbers, symbols or watermarks may appear.

## Beats

### Beat 1 · 0.0–3.5 s: "The city is not a desert."
The screen opens on asphalt. At frame 0, one flat-top hexagon, 220 px wide, draws its Wax outline clockwise at center over 12 frames, then floods with Honey from the bottom up, like filling a cell. The kinetic type lands around it in Bebas Neue at 200 px, Wax, one word at a time and staggered 4 frames apart: THE / CITY / IS / NOT. Each word rises 60 px out of a mask with a sharp ease-out and a slight overshoot. "NOT" lands in Brick and kicks with a 3-frame scale punch from 1.0 to 1.12 to 1.0. At 2.3 s, "A DESERT." drops in on a second line. A Honey strike-through then draws across "DESERT." left to right in 8 frames. At 2.9 s all words shear out to the left. The hexagon tessellates outward into a 9×5 honeycomb in a ripple from the center, with 2-frame offsets per ring, and about one cell in three fills Honey.

**Handover:** the honeycomb holds for a moment, full-frame.

### Beat 2 · 3.5–7.0 s: "Every roof is a field." (match cut #1)
This is the match cut. Each filled hexagon squashes over 10 frames into a rectangular lit window at the same screen position, and the empty cells become dark wall. The grid splits into six Brick building silhouettes of varied heights standing on a Concrete ground line, so the honeycomb has become a skyline at night. On each rooftop a small Honey hexagon hive pops on with a 2-frame stagger, and clusters of Leaf circles (flowers) bloom on the roofs in scale-from-zero bursts. The type "EVERY ROOF IS A FIELD." types across the top third in Bebas Neue at 150 px. Each word slams down from above with a 3-frame squash on impact, and "FIELD." is set in Leaf.

**Handover:** the windows switch off row by row from the top, leaving six solid Brick shapes.

### Beat 3 · 7.0–11.5 s: the animated chart (match cut #2)
In the second match cut the skyline becomes the chart. Over 15 frames the six buildings narrow to equal widths of 140 px with even gaps, sink to a shared baseline, and recolor from Brick to Honey. Their roof hives slide off and become small Wax tick marks. The ground line turns into the chart's x-axis in Concrete, and three faint Concrete gridlines fade up. The chart title "ROOFTOP HIVES WE TEND" types in at the top left in JetBrains Mono at 36 px, Wax, at 2 characters per frame.

The bars then grow to their data heights in sequence, 6 frames apart, with an ease-out-back, scaled so that 58 equals 600 px. Each bar's value counts up above it in JetBrains Mono at 44 px, Wax: 3, 9, 17, 26, 41, 58. The years sit under each bar in JetBrains Mono at 28 px, Concrete. The 2026 bar lands last, turns Leaf, and its "58" pulses once.

**Handover:** the top of the 2026 bar holds still while everything else dims to 20%.

### Beat 4 · 11.5–15.0 s: "Every hive is a neighbor." (match cut #3)
The video pushes in fast on the top edge of the 2026 bar. Its corners fold inward over 8 frames into a single Honey hexagon (the same cell as in Beat 1) while the chart falls out of frame. A bee lifts off from the hexagon. It is built from simple shapes: a Honey oval body with two Wax stripes, two translucent Wax ellipse wings flapping on a 2-frame cycle, and a dotted Wax trail behind it. It loops in a figure-eight across the frame. The type "EVERY HIVE IS A NEIGHBOR." follows the bee's path, letters unfurling along the curve and then straightening into a centered line in Bebas Neue at 160 px. "NEIGHBOR." is set in Honey.

**Handover:** the type collapses into a single horizontal line that becomes the bee's trail.

### Beat 5 · 15.0–18.0 s: sign-off
The bee flies one last route, and its dotted trail turns solid and traces a flat-top hexagon outline, 180 px, at center-left. The hexagon fills Honey from the bottom, the way the first frame did. "ROOFCOMB" stamps in to the right in Bebas Neue at 180 px, Wax, letter by letter with a 2-frame stagger, each letter rising out of a mask. Below it, "We keep bees where you live." types in JetBrains Mono at 36 px, Concrete, with a blinking Honey cursor that stops after 2 blinks. The bee settles on the hexagon's top edge, and its wings slow to stillness. The final 20 frames (17.33–18.0 s) hold the end card with no motion.

## Must
- Total runtime of exactly 540 frames at 30 fps, 1920×1080, rendered to `out/video.mp4`.
- Keep the hexagon as one continuous visual thread. Each match cut has to read as the same object transforming in place, never a fade or a hard swap.
- Bar heights stay exactly proportional to the data (3, 9, 17, 26, 41, 58), on a zero baseline.
- Keep all type inside 120 px horizontal and 90 px vertical safe margins.
- Every move uses a deliberate ease. Kinetic type gets a snappy ease-out with small overshoot, and transforms get a smooth in-out.
- Use only the six palette colors (opacity variations of them are allowed).

## Must not
- No words, numbers or symbols beyond the copy list, including no credits, URLs or social handles.
- No photos, footage, stock imagery, textures from images, or real brand logos. Everything is built from shapes, lines and type.
- No crossfades or dissolves between beats.
- No cartoon faces on the bee, no 3D, no lens flares or glow effects.
- No additional fonts and no font substitutions.
- No audio track.
