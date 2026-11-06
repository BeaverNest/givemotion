# Brief: "The Address of Every Book"

**Genre:** Science explainer
**Subject:** A public library and how its classification system finds one book among a million
**Format:** 1080×1920 (vertical), 30 fps, exactly 25.0 s (750 frames), no audio
**Deliverable:** `out/video.mp4`

---

## Concept

A library works like a search engine made of shelves. Each digit of a book's call number splits the collection into ten and keeps one part, so five digits narrow the search to 1 in 100,000. One coral book spine is the shared element that carries the whole video. It slides off a wall of books, grows into its own call-number label, collapses into a sorting band, shrinks back into a spine, and ends as a dot on a floor plan. The viewer follows that one shape from start to finish.

Everything is drawn with flat rectangles, lines and type. There are no gradients, textures or illustrations beyond simple geometry.

---

## Palette

| Hex | Role |
|---|---|
| `#10192B` | Ink: main background, type on light fields |
| `#F3EBDD` | Paper: main type, call-number label card, shelf lines |
| `#FF6B4A` | Coral: the hero spine/shared element, selected bands, key words |
| `#3A4A63` | Slate: ordinary spines, inactive bands, floor-plan shelving |
| `#2A9D8F` | Teal: accent spines (about 10% of the wall), walking-path line |
| `#E9C46A` | Mustard: the "1 IN …" counter and the "÷10" flashes only |

Palette colors may be used at reduced opacity. No other colors are allowed.

## Fonts

- **Bebas Neue** for all headlines, kinetic words and category names.
- **JetBrains Mono** for the call number, band digits, counters and small labels.

---

## On-screen copy (complete; nothing else may appear)

- A MILLION
- BOOKS.
- YOU NEED
- ONE.
- EVERY BOOK HAS AN ADDRESS
- 594.56
- DEWEY DECIMAL CLASSIFICATION
- Band digits: 0 1 2 3 4 5 6 7 8 9
- SCIENCE
- ANIMALS
- MOLLUSKS
- CEPHALOPODS
- OCTOPUSES
- 1 IN 10
- 1 IN 100
- 1 IN 1,000
- 1 IN 10,000
- 1 IN 100,000
- EACH DIGIT CUTS THE SEARCH BY 10
- ÷10
- 590–599
- A LIBRARY IS
- A SEARCH ENGINE
- YOU CAN WALK INTO.

---

## Beats

### Beat 1: The wall (0.0–4.0 s)
- **0.0–1.2 s:** A wall of book spines builds on Ink. Five shelf rows (Paper lines, 4 px) hold spines 28–64 px wide at varied heights. Most spines are Slate, about 10% are Teal, and exactly one is Coral, in the middle row just right of center. Each row rises into place from below its shelf line through a mask, staggered 3 frames per row, with an ease-out.
- **1.2–2.2 s, kinetic type:** "A MILLION" and "BOOKS." stamp in as two stacked lines, Bebas Neue at about 250 px, filling the width inside 80 px side margins. The letters are cut out of a solid Ink panel, so the spine wall shows through them (masked reveal). Each line scales from 115% to 100% with a 2-frame overshoot, 6 frames apart.
- **2.2–3.2 s:** A horizontal wipe moving downward swaps the lines for "YOU NEED" in solid Paper and "ONE." in solid Coral.
- **3.2–4.0 s:** The text wipes off upward. Every spine dims to 30% except the Coral one, which slides 40 px forward off its shelf and scales to 108%.
- **Handover (match cut):** the camera pushes into the Coral spine. Its small Paper label grows until it becomes the label card of Beat 2, and the spine's Coral body becomes the full-frame background.

### Beat 2: The address (4.0–8.5 s)
- Full Coral background. A Paper label card (about 760×420 px, 24 px radius) sits at center with "594.56" in JetBrains Mono Bold, Ink, about 190 px.
- **4.3–6.0 s, kinetic type:** "EVERY BOOK HAS AN ADDRESS" builds above the card in Ink Bebas Neue, one word per line. Words slide in alternately from left and right, 4 frames apart, and each snaps to a hard left edge.
- **6.0–6.6 s:** "DEWEY DECIMAL CLASSIFICATION" types on below the card, JetBrains Mono at 34 px in Ink, one character per frame.
- **6.6–7.6 s:** The tracking on "594.56" widens so each digit sits apart, a cue that it is about to be read one digit at a time.
- **7.6–8.5 s, shared-element handover:** the headline and small label wipe out to the left. The number "594.56" lifts off the card, shrinks to about 110 px, turns Paper, and docks at the top of the frame. At the same time the Coral field squeezes vertically into a single horizontal band, band "5" of the next beat. Nine Slate bands wipe open above and below it.

### Beat 3: Ten, then ten, then ten (8.5–16.5 s)
- **Layout:**
  - The docked "594.56" sits at the top, about 140 px from the edge.
  - Below it is a stack of ten full-width horizontal bands, about 130 px each with 6 px gaps. Each band has its digit 0–9 at the left in JetBrains Mono, Paper at 60%.
  - The counter sits in Mustard JetBrains Mono at about 80 px, bottom center, 200 px from the bottom edge.
- **How each level works:**
  - The chosen digit in the docked number turns Coral, and the matching band turns Coral.
  - The category name rises inside that band through the band's own mask, Bebas Neue at about 110 px in Ink.
  - The counter rolls to its new value, with digits scrolling vertically and the old value masked out above.
  - The chosen band then wipes outward vertically to fill the whole stack area, pushing the other bands out of frame. Nine new divider lines draw across it from left to right, staggered 2 frames apart, re-splitting it into ten.
- **Levels:**
  - **8.5–9.5 s:** digit 5, SCIENCE, counter 1 IN 10
  - **9.5–11.0 s:** digit 9, ANIMALS, counter 1 IN 100
  - **11.0–12.5 s:** digit 4, MOLLUSKS, counter 1 IN 1,000
  - **12.5–14.5 s:** the decimal point pulses once (scales to 140% and back over 8 frames), then digit 5, CEPHALOPODS, counter 1 IN 10,000
  - **14.5–16.5 s:** digit 6, OCTOPUSES, counter 1 IN 100,000. The band holds this time and does not re-split.
- **Handover (match cut):** the OCTOPUSES band narrows horizontally into a tall vertical Coral spine. The shelf wall from Beat 1 rebuilds around it in the same frame position, so the spine lands exactly where it started.

### Beat 4: The walk (16.5–21.0 s)
- **16.5–17.3 s:** A vertical wipe, bottom to top, turns the front-on wall into a top-down floor plan.
  - Six long Slate rectangles are the shelving rows.
  - The Coral spine becomes a Coral dot (32 px) in the fifth row.
  - A small "590–599" label in JetBrains Mono (Paper, 28 px) sits on that row's end.
- **17.3–20.2 s:** A Teal path line (8 px, square caps) draws from an entrance notch at the bottom center to the dot, making five right-angle turns. At each turn a Mustard "÷10" pops in at about 70 px and pops out over 10 frames.
- **Kinetic type, same window:** "EACH DIGIT CUTS THE SEARCH BY 10" builds at the top in Paper Bebas Neue as three stacked lines. Each word snaps in from 20 px below with a hard ease-out, 4 frames apart, and "10" is Coral.
- **20.2–21.0 s:** The headline, the path and the plan dim to 20%. The Coral dot stays at full strength and drifts to the center.

### Beat 5: The line (21.0–25.0 s)
- **21.0–21.6 s:** The Coral dot stretches into a vertical Coral bar, 40 px wide and as tall as the text block, at the left edge of the text area. The floor plan wipes out completely to Ink.
- **21.6–23.4 s, masked reveal:** the bar sweeps left to right across the frame, revealing three lines of Paper Bebas Neue (about 190 px) as it passes: "A LIBRARY IS", "A SEARCH ENGINE", "YOU CAN WALK INTO." Each line's reveal is delayed 5 frames from the one above, so the edge reads as a slanted wipe. "SEARCH ENGINE" is Coral.
- **23.4–23.8 s:** The bar rotates 90° and settles as a 12 px Coral underline beneath the last line, like a bookmark ribbon.
- **23.8–25.0 s:** A completely still hold on the final frame.

**Timing check:** 4.0 + 4.5 + 8.0 + 4.5 + 4.0 = 25.0 s.

---

## Must
- Use one continuous Coral shared element: spine → label field → band → spine → dot → bar. Each handover is a frame-accurate match cut with no hard cut and no fade to black.
- Show masked reveals in at least four places: knockout type over the spine wall, band-internal word rises, vertical wipes between scenes, and the bar-sweep reveal in the outro.
- Animate the kinetic typography in time with the structure on screen: words stamp, slide and roll in step with bands and turns, never on generic fades.
- Make every category name and counter readable for at least 0.6 s.
- Keep all copy inside an 80 px side margin, 140 px top margin and 200 px bottom margin.
- Use only the palette hex values, the two named fonts, and the exact copy listed above.
- Export exactly 750 frames at 30 fps, 1080×1920, to `out/video.mp4`.

## Must not
- No photos, footage, stock imagery, textures, gradients or drop-shadow blur. Flat shapes, lines and type only.
- No real library names, real brand logos, publisher marks or recognizable book covers.
- No words, numbers or symbols beyond the copy list. No placeholder or lorem text on spines.
- No audio track.
- No 3D camera moves or perspective tilts. Every move is 2D scale, position, rotation and mask.
- No easing that bounces more than once, and nothing that strobes or flashes faster than 4 frames.
