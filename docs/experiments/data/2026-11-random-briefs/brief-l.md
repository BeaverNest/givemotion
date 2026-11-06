# Brief: ABYSSAL, "Light Ends. Life Doesn't."

**Format:** 1920×1080 · 30 fps · exactly 18.0 s (540 frames) · no audio
**Deliverable:** the finished video goes to `out/video.mp4`

## Concept
This is a logo sting for **ABYSSAL**, a fictional deep-ocean expedition series. The camera sinks through layered planes of the deep sea. A depth chart shows sunlight running out. Then the tagline goes from dark to glowing, the way deep-sea animals make their own light. A small anglerfish lure lights the way and turns into the logo mark. The tone is quiet, cinematic and confident. It should feel like a documentary title, not a cartoon.

## Palette
| Hex | Name | Role |
|---|---|---|
| `#020B1A` | Abyss Black | Main background and deepest layers |
| `#0B2A4A` | Midnight Blue | Top of the background gradient (opening only), far-plane silhouettes |
| `#1FE5C8` | Biolume Cyan | Glow points, chart bars, logo ring, lit tagline letters |
| `#FF5A7A` | Lure Coral | Anglerfish lure, a single accent per beat, the "0%" value |
| `#E8F1F7` | Foam White | Main type, marine snow |
| `#5C7A99` | Silt Grey | Secondary labels, gridlines, axis, unlit letters |

Use no other colours. Glows are soft radial falloffs of Biolume Cyan or Lure Coral fading to transparent.

## Fonts
- **Bebas Neue** for the tagline and the ABYSSAL wordmark.
- **Space Grotesk** (Medium for labels, Bold for numbers) for the depth counter, chart labels, values and descriptor.

## On-screen copy (complete list; nothing else may appear)
- Depth counter: whole numbers from **0** to **4,000**, each followed by **M** (e.g. "0 M", "1,000 M", "4,000 M"), with comma thousands separators
- **SUNLIGHT REMAINING**
- **SUNLIGHT ZONE** · **TWILIGHT ZONE** · **MIDNIGHT ZONE**
- **0–200 M** · **200–1,000 M** · **1,000–4,000 M**
- **100%** · **1%** · **0%** (while the bars animate, the values may count through whole percentages in between)
- **LIGHT ENDS.**
- **LIFE DOESN'T.**
- **ABYSSAL**
- **DEEP OCEAN EXPEDITIONS**

## Visual world (built from shapes, lines and type only)
- **Marine snow:** 1–3 px Foam White dots at 20–60% opacity. They drift upward relative to the camera to sell the descent.
- **Jellyfish:** a half-ellipse bell outlined in Biolume Cyan, with 4–6 sine-wave tentacle strokes that ripple. The bell pulses (scale 1.0 to 0.92 to 1.0, about a 1.2 s cycle).
- **Siphonophore:** a chain of 10–14 small cyan circles strung along a slowly swaying curve.
- **Lanternfish:** a small Midnight Blue ellipse with a fin triangle and a row of 5 cyan dots along its side.
- **Anglerfish:** a filled Abyss Black teardrop with a thin Silt Grey rim light, a row of small triangle teeth, and a curved stalk ending in a **Lure Coral** dot with a glow.
- **Depth layers (3D parallax):** five planes, each moving at its own speed: far 0.2×, back 0.45×, mid 0.7×, hero 1.0×, foreground 1.6×. Far planes are smaller, Midnight Blue, 30–50% opacity and softly blurred. The foreground plane is large, out of focus (heavy blur) and crosses the frame fast. Every beat keeps at least three planes moving.

## Beats

### Beat 1: The Descent (0.0–3.0 s)
- The background gradient runs from Midnight Blue at the top to Abyss Black, and darkens toward solid Abyss Black over the beat.
- The camera tilts down and pushes forward through all five planes:
  - Far: a lanternfish school drifts across.
  - Mid: a siphonophore sways.
  - Foreground: a large blurred jellyfish crosses left to right at 1.6×.
- A Space Grotesk Bold depth counter sits top-left at 64 px from the edges, in Foam White. It rolls from **0 M** to **4,000 M** with an ease-in (slow at first, then fast).
- Handover: at 2.6–3.0 s a thin Silt Grey vertical line draws down the left third of the frame. It becomes the chart axis, and the counter slides to sit at its base.

### Beat 2: The Animated Chart (3.0–7.0 s)
- Parallax keeps going behind the chart at 40% brightness.
- **Header:** "SUNLIGHT REMAINING" fades in above the axis, 28 px, Silt Grey, 0.2 em tracking.
- **Structure:** three zone rows stack down the axis, each with:
  - its zone name in Foam White, 34 px;
  - its depth range below in Silt Grey, 22 px;
  - a dashed Silt Grey gridline across the frame.
- **Bars:** horizontal bars in Biolume Cyan, on a linear scale where 100% = 1,000 px. Each bar shows the light at the top of its zone. The bars grow one after another, 0.4 s apart, with an overshoot of no more than 3%:
  - Sunlight Zone sweeps out to full width, its value counting to **100%**.
  - Twilight Zone reaches only a 6 px sliver, labelled **1%**.
  - Midnight Zone stays empty. Its **0%** value fades in with a Lure Coral glow pulse.
- **Depth:** the chart sits on the hero plane with a slight 3D tilt (about 8° rotation on the Y axis), so creatures pass both in front of it and behind it.
- Handover: at 6.4–7.0 s the camera pushes forward into the empty Midnight Zone row. The chart scales past the lens and blurs out in the foreground.

### Beat 3: Kinetic Tagline (7.0–11.0 s)
- **"LIGHT ENDS."** (7.0–8.6 s): appears centred in Bebas Neue at 220 px, Foam White. Each letter then goes dark one at a time, left to right, 60 ms apart:
  - colour shifts to Silt Grey, then down to 15% opacity;
  - the letter sinks 40 px and recedes in depth (scale 1.0 to 0.8).
- **"LIFE DOESN'T."** (8.6–10.6 s): 12–20 cyan glow points per letter swim in from the parallax layers along curved paths. Each cluster gathers into its letter and lights up with a short bloom. The letters build left to right at 220 px.
  - The apostrophe lights last, in Lure Coral.
- A foreground jellyfish drifts across the line at 1.6×. Its blurred bell briefly covers the letters, which shows the type sits inside the 3D space.
- Handover: at 10.6–11.0 s the letters break back into glow points that drift upward like marine snow. Only the coral apostrophe's light remains and slides toward frame centre.

### Beat 4: Logo Build (11.0–15.0 s)
- **The lure becomes the mark:**
  - The coral point becomes the anglerfish lure. A thin curved stalk draws up and out of it (stroke reveal, 0.6 s).
  - The stalk carries on into a Biolume Cyan ring, 240 px across with a 10 px stroke, drawn clockwise over 0.8 s. It is open at the top right, where the lure hangs.
  - Inside the ring, a faint anglerfish silhouette with a grey rim light appears for 1 s, then dissolves, leaving the clean mark.
- **Wordmark:** "ABYSSAL" appears right of the mark in Bebas Neue at 180 px, Foam White, 0.12 em tracking. Each letter slides out from behind the ring along the depth axis, from behind the mark plane to flat, 50 ms apart.
- **Creatures:** three creatures (a lanternfish, a jellyfish and the siphonophore) circle the lockup slowly on the far, back and foreground planes, which keeps the 3D depth going.

### Beat 5: Lockup and Hold (15.0–18.0 s)
- **Layout:**
  - The lockup is centred, with the mark on the left and ABYSSAL on the right.
  - Below it, a hairline 1 px Silt Grey rule draws out from the centre.
  - Under the rule, "LIGHT ENDS. LIFE DOESN'T." sets in Space Grotesk Medium at 30 px, 0.25 em tracking. "LIGHT ENDS." is in Silt Grey and "LIFE DOESN'T." is in Biolume Cyan.
  - Above the lockup, "DEEP OCEAN EXPEDITIONS" sits at 20 px in Silt Grey.
- **Motion during the hold:**
  - The lure pulses once at 16.0 s, then gives a smaller pulse at 17.2 s.
  - Marine snow keeps drifting, and the circling creatures slow to almost a stop.
- **Final frame (18.0 s):** a clean, fully legible lockup. No fade to black.

## Must
- Total runtime of exactly 18.0 s at 30 fps, 1920×1080, with no audio track.
- Five parallax planes with clearly different speeds, sizes, opacities and amounts of blur.
- Chart values must be correct and readable: 100% / 1% / 0% on a true linear scale.
- Every letter of the tagline animates on its own in Beat 3.
- The Lure Coral point stays continuous from Beat 3 through the logo, as one unbroken thread of light.
- Keep all type inside a 5% title-safe margin.
- Export to `out/video.mp4`.

## Must not
- No photos, footage, textures, stock imagery, real brand logos, voice or music.
- No copy beyond the list above: no watermarks, credits or placeholder text.
- No colours outside the six-colour palette.
- No cartoon faces, eyes with highlights or cute creatures. Silhouettes stay graphic and restrained.
- No hard cuts. Every beat hands over through motion.
- No camera shake, lens-flare clichés, or flashes brighter than a soft bloom.
