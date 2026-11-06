# Brief: The City Hive — Urban Beekeeping, Sketched

## Overview
A 23-second infographic drawn like a beekeeper's field notebook come to life. Ink lines sketch a rooftop hive over a layered city skyline. A single bee's flight path draws itself across the city to the flowers it feeds on, and four hand-lettered facts explain what one urban hive does. The camera drifts through separated depth planes, so the flat sketch reads as a paper diorama with real depth.

**Format:** 1920×1080, 30 fps, exactly 23 s (690 frames), no audio.
**Deliverable:** the finished video goes to `out/video.mp4`.

## Palette
| Hex | Role |
|---|---|
| `#F6EFDF` | Paper background (fills the whole frame at all times) |
| `#2B2A33` | Ink: all outlines, hatching and main type |
| `#E9A23B` | Honey amber: flight paths, honey, highlighted numbers, bee stripes |
| `#6E9F5B` | Leaf green: plants, flowers, foliage hatching |
| `#A9BCC8` | Haze blue: distant skyline plane and the foraging-radius circle |

No other colours. Use tints only by lowering the opacity of these five colours. Paper grain is a sparse speckle of tiny `#2B2A33` dots at 6% opacity.

## Typography
- **Caveat** (Bold for headlines, Regular for labels): all words.
- **Space Grotesk** (Bold): the large numerals only (`50,000`, `3 km`, `1/12 tsp`, `10–25 kg`).
- Headlines are 96–120 px, numerals 140–180 px and labels 40–48 px. Keep a 96 px safe margin on all sides.

## On-screen copy (exhaustive: nothing else may appear)
1. `The City Hive`
2. `Urban beekeeping, sketched`
3. `Rooftop`
4. `Up to` / `50,000` / `bees in one hive at summer peak`
5. `Balcony herbs`
6. `Street lindens`
7. `Park clover`
8. `Community garden`
9. `Foraging range: about` / `3 km`
10. `1/12 tsp` / `of honey from one bee's whole life`
11. `10–25 kg` / `of honey a year from one city hive`
12. `Cities can bloom for bees.`
13. `Plant something that flowers.`

Numbers never count up. They appear by writing on stroke by stroke, like the handwritten words.

## Visual language
- **Hand-drawn look:** every line has a slightly uneven ink stroke with tapered ends and a gentle wobble. Lines "boil": on a held shot, each line is redrawn with a tiny random offset every 3 frames (10 fps boil), while camera movement stays smooth at 30 fps. Shading is loose diagonal crosshatching. Fills are offset 4–6 px from their outlines, like a quick watercolour wash.
- **Self-drawing lines:** buildings, the hive, plants, paths and underlines all trace on along their stroke direction with an ease-out. Text writes on left to right, behind a reveal that follows the letterforms.
- **Depth and parallax:** the city is built on four flat planes spaced in depth:
  - **Far:** haze-blue skyline silhouettes
  - **Mid:** ink buildings with hatched windows
  - **Near:** the rooftop ledge, the hive and a potted plant
  - **Foreground:** two out-of-focus leaf sprigs at the frame edges, blurred about 8 px
  
  When the camera moves, the planes travel at 15%, 45%, 100% and 140% of the camera speed. The planes cast soft offset shadows (ink at 10%) so they read as stacked paper.
- **Bees:** a striped amber oval with an ink outline and two looping wing strokes. The wings flicker between two drawings every 2 frames.

## Beats

### Beat 1 — Title (0.0–4.0 s, frames 0–119)
- **Visible:** paper only. At 0.3 s, a single ink hexagon draws itself at centre (1.0 s). An amber wash fills it, offset from the outline.
- **Moves:** `The City Hive` writes on beneath it (1.2–2.4 s). `Urban beekeeping, sketched` follows in Caveat Regular (2.2–3.0 s), with a hand-drawn underline that draws left to right. The camera pushes in slowly (scale 100→106%).
- **Hand-over:** at 3.4 s, the title and subtitle slide down out of frame as the hexagon shrinks and flies up and to the right. It lands as the hexagonal entrance plate on the hive in Beat 2.

### Beat 2 — The rooftop hive (4.0–9.0 s, frames 120–269)
- **Visible:** the four depth planes. The far skyline draws in first (4.0–4.8 s), then the mid buildings (4.4–5.4 s), then the near rooftop ledge and a stacked two-box hive (4.8–6.0 s). The hexagon plate snaps into place on the hive front. `Rooftop` writes on beside the hive, with a curved arrow drawing toward it.
- **Moves:** the camera trucks left to right throughout, about 220 px on the near plane, which shows the full parallax separation. At 6.2 s, about a dozen bees spill from the hive entrance on short looping trails. `Up to` and `50,000` write on top-left (6.4–7.4 s), with the numeral in amber Space Grotesk. `bees in one hive at summer peak` follows (7.2–8.0 s).
- **Hand-over:** at 8.4 s, one bee breaks away from the group and the camera tilts up and pulls back to follow it.

### Beat 3 — The flight map (9.0–15.0 s, frames 270–449)
- **Visible:** the camera keeps pulling back and tilts down until the city reads as an angled map. The planes keep their depth, but each plane is now tilted about 35° so the city looks like a tabletop diorama. The hive is a small marked point near centre.
- **Moves:**
  - The lead bee flies a dashed amber path that draws itself behind it, ending in four destinations in sequence (about 1.2 s each).
  - Each destination is a sketched plant that grows in green line art as the path arrives, and its label writes on beside it: `Balcony herbs` (window box), `Street lindens` (row of three trees), `Park clover` (clover patch), `Community garden` (raised beds).
  - At 13.6 s, a haze-blue circle draws itself clockwise around all four destinations, centred on the hive. `Foraging range: about` and `3 km` write on along the circle's edge.
- **Hand-over:** at 14.6 s, all the paths fade to 30% opacity and the camera rushes in toward the hive marker. The planes split apart in depth as it passes through them.

### Beat 4 — The honey (15.0–19.0 s, frames 450–569)
- **Visible:** a clean paper close-up in two columns. On the left, a hand-drawn teaspoon draws itself with a single amber drop inside it. `1/12 tsp` and `of honey from one bee's whole life` write on below it (15.3–16.6 s). On the right, an ink honey jar draws itself, then amber fills it from the bottom in a wobbly-edged wash (16.4–17.8 s). `10–25 kg` and `of honey a year from one city hive` write on below it (16.8–18.2 s).
- **Moves:** the spoon sits on the near plane and the jar on the mid plane. A slow 60 px camera drift separates them in depth. The small amber drop in the spoon visibly falls and joins the jar's fill at 17.0 s.
- **Hand-over:** at 18.5 s, the jar's outline stroke unwinds and redraws as a hexagon, matching the opening frame.

### Beat 5 — Closing (19.0–23.0 s, frames 570–689)
- **Visible:** the camera pulls back to show the hexagon centred over the diorama city from Beat 3. All four flight paths come back to full amber and loop back to the hive, so they read as petals around it.
- **Moves:** `Cities can bloom for bees.` writes on above (19.6–20.8 s). `Plant something that flowers.` writes on below in Caveat Regular (20.8–21.8 s). Small green flower doodles pop along each path, staggered every 2 frames. The camera holds with a gentle 2% push-in, and the line boil continues.
- **End:** from 22.4 to 23.0 s, everything except the paper fades out together, and the final frame is clean paper.

## Must
- Total exactly 23.0 s and 690 frames, at 1920×1080 and 30 fps, with no audio.
- Use only the five palette colours, the two named fonts and the exact copy listed above.
- Keep the visible 10 fps line boil on every held moment, while the camera moves at a smooth 30 fps.
- Show at least four depth planes with clearly different parallax speeds in Beats 2, 3 and 5.
- Draw on every line, word and numeral. Nothing pops in fully formed, except the small flower doodles in Beat 5.
- Keep all text inside the 96 px safe margin, and give every on-screen fact at least 1.5 s of fully readable hold.
- Render the finished video to `out/video.mp4`.

## Must not
- No photos, footage, stock imagery, textures from images, real logos, real maps or real city landmarks.
- No extra words, numbers, captions, credits or watermarks beyond the copy list.
- No count-up numerals and no typewriter-style text.
- No clean, perfect vector strokes: lines must look hand-drawn throughout.
- No cartoon faces on bees, and no stingers or menacing imagery.
- No hard cuts between beats: each beat flows out of the one before it.
