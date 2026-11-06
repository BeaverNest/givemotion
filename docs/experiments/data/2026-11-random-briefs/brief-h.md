# Brief: HADAL — "Make Your Own Light"

**Genre:** Product launch teaser
**Product (fictional):** HADAL, a field-guide app for identifying deep-sea creatures by depth and by how they make light.
**Format:** 1080×1920 vertical, 30 fps, exactly 18.0 s (540 frames), no audio
**Deliverable:** `out/video.mp4`

---

## Concept

The video sinks into the deep ocean. Kinetic type falls through the dark like a diver going down. The full stop in "HERE." turns into an anglerfish's glowing lure. The lure then shrinks to become the cursor in the app, and that one glowing dot runs through the whole film: punctuation, then lure, then cursor, then app icon. A depth counter in the top-right corner never leaves the screen. It reads 0000 M at the start and 4000 M at the end, so it measures both the descent and the running time.

---

## Palette

| Hex | Name | Role |
|---|---|---|
| `#030B1A` | Abyss | Background of every frame |
| `#0B2340` | Midwater | Phone screen fill, card fills, creature body fills, top of the background gradient in beat 1 |
| `#3DF5D0` | Biolume | Glow, creature line art, active UI states, letters that light up |
| `#FF5A7A` | Lure | The dot (lure, cursor, icon), primary button, "COMING 12.04" pill |
| `#E8F1F8` | Foam | Main type, teeth, marine-snow particles |
| `#5C7A99` | Silt | Secondary text, phone frame stroke, slider track, dividers |

Glows are radial fades from the element's own color to transparent. No other colors and no extra tints.

## Fonts

- **Bebas Neue** for all kinetic headlines and the HADAL wordmark.
- **JetBrains Mono** for the depth counter, all UI text and the tagline.

---

## On-screen copy (exhaustive; nothing else may appear)

- Kinetic lines: `IT'S` · `DARK` · `DOWN` · `HERE.` · `SO THEY` · `MAKE` · `THEIR OWN` · `LIGHT.`
- Depth counter: four digits followed by ` M`, showing whole numbers only, from `0000 M` to `4000 M`
- UI: `HADAL` · `DEPTH` · `200 M` · `1000 M` · `4000 M` · `ANGLERFISH` · `1000–4000 M` · `COMB JELLY` · `0–3000 M` · `VAMPIRE SQUID` · `600–1200 M` · `LIGHT SOURCE` · `LURE` · `LOG SIGHTING` · `SIGHTING LOGGED`
- End card: `HADAL` · `A field guide to the dark.` · `COMING 12.04`

---

## Recurring elements

- **Depth counter:** JetBrains Mono, 32 px, Silt. It sits top-right with 64 px margins in every frame except beats 3–4, where it moves into the app as the slider readout. The digits roll like an odometer, each digit sliding up and out.
- **Marine snow:** 40 Foam dots, 2–5 px, at 20–40 % opacity. They drift slowly upward to suggest descent and are present in every beat.
- **The Dot:** a Lure-colored circle with a soft glow. It is the same object throughout, and every handover keeps its screen position continuous.
- **Cursor:** the Dot at 18 px with a 44 px Lure ring around it. On a click the ring squeezes to 80 % for 3 frames, then sends out one ripple ring (44 → 120 px, fading out over 12 frames).

---

## Beats

### Beat 1 — Descent · 0.0–3.0 s
The background is a vertical gradient from Midwater at the top to Abyss at the bottom. Over the beat it darkens to flat Abyss. The counter rolls from `0000 M` to `0200 M`. Four words drop in one by one from above the frame, every 0.6 s: `IT'S`, `DARK`, `DOWN`, `HERE.`. They are Bebas Neue, 260 px, Foam, centered and stacked. Each word falls in stretched to 140 % height and lands at 100 % with one small overshoot. As each new word lands, the words above drift up 40 px and fade to 30 %, so the stack seems to sink past the viewer. At 2.4 s the full stop of `HERE.` changes from Foam to Lure and starts to glow. The letters around it fade to 0 over 0.4 s, leaving only the Dot.

**Handover (match cut):** the full stop becomes the anglerfish's lure, and it never moves on screen.

### Beat 2 — The Lure · 3.0–6.5 s
An anglerfish draws itself on around the Dot. Its stalk is a curved Biolume line that grows out of the Dot, then the body outline draws on in Biolume (Midwater fill, 3 px stroke). Then a crescent jaw appears with seven Foam triangle teeth. The counter rolls to `1000 M`. Kinetic type builds in the lower third, Bebas Neue, 200 px: `SO THEY` slides in from the left, `MAKE` drops in from above, and `THEIR OWN` slides in from the right. Then `LIGHT.` arrives as dark Midwater letters. Each time the lure pulses (3 pulses, 0.3 s apart), one more letter of `LIGHT.` turns Biolume with its own glow, left to right. At 6.0 s the view pushes in on the lure. The fish and the type scale past the frame edges and fade, while the Dot shrinks from 60 px to 18 px and a 44 px ring draws around it.

**Handover (shared element):** the lure becomes the cursor.

### Beat 3 — Browse by Depth · 6.5–10.0 s
A phone frame (840×1700, 80 px corner radius, 2 px Silt stroke, Midwater screen) draws itself in around the cursor, outline first, then the screen fills in. The counter glides out of the corner into the app as the readout on a vertical depth slider on the left of the screen, labeled `DEPTH`, `200 M`, `1000 M`, `4000 M`. The header says `HADAL`. Three creature cards are stacked down the screen, each with a Biolume line icon, a name and a depth range: `ANGLERFISH 1000–4000 M`, `COMB JELLY 0–3000 M`, `VAMPIRE SQUID 600–1200 M`. The cursor moves to the slider handle along an eased curve, clicks, and drags it down from `200 M` to `1000 M`. The readout rolls to match. As the handle passes each card's range, that card's icon lights up in Biolume while the others drop to Silt. When the handle stops at `1000 M`, the ANGLERFISH card gets a 2 px Biolume border.

### Beat 4 — Open & Log · 10.0–13.5 s
The cursor clicks the ANGLERFISH card. Shared-element transition: the small icon grows and moves into a hero illustration that fills the top half of the screen. It is the same anglerfish from beat 2, redrawn in UI style. The other cards fall out of the screen with a stagger. A detail panel slides up beneath the illustration: `LIGHT SOURCE` in Silt, `LURE` in Biolume, `1000–4000 M` in Foam. The cursor moves down and clicks the Lure-colored `LOG SIGHTING` button, which presses down 4 px and sends out a ripple. A toast that says `SIGHTING LOGGED` springs up from the bottom with a Biolume check mark that draws itself on.

**Handover (match cut):** the cursor moves onto the lure in the hero illustration, so the two Dots overlap and become one.

### Beat 5 — Back to the Dark · 13.5–15.5 s
The cursor ring fades out. The whole phone, frame and screen, sinks downward with a stagger: the frame first, then the panels, then the illustration's line art. Every part fades as it falls. Only the Dot is left, back at its beat-2 size and position. The counter is back in its corner and rolls on toward `3000 M`. The Dot pulses once and draws a Lure-outlined rounded-square app icon around itself (220×220 px, radius 52 px). The icon settles in the upper middle of the frame.

### Beat 6 — End Card · 15.5–18.0 s
`HADAL` appears below the icon in Bebas Neue, 220 px, Foam. Its letters rise from below one at a time, 2 frames apart, starting with letter spacing at +40 % and closing in to +8 %. At 16.2 s, `A field guide to the dark.` types itself out in JetBrains Mono, 40 px, Silt, at 2 characters per frame, with a Biolume block caret that disappears when the line is done. At 16.8 s, a Lure-outlined pill reading `COMING 12.04` (JetBrains Mono 36 px, Foam) scales in from 90 % to 100 %. The counter finishes rolling to `4000 M` at 17.0 s. Everything holds still from 17.0 to 18.0 s except the marine snow and one slow glow pulse on the Dot.

**Timing check:** 3.0 + 3.5 + 3.5 + 3.5 + 2.0 + 2.5 = 18.0 s

---

## Must
- Keep the Dot continuous on screen through every handover. Each match cut has to read as one object changing role.
- Keep the depth counter visible in every frame, either in the corner or as the slider readout, and only ever increasing.
- Ease every move; no linear motion except the marine snow.
- Keep all text inside a 64 px safe margin, and keep UI text at 28 px or larger so it reads on a phone.
- Draw every element from shapes, lines and type in the six listed colors.
- Render 1080×1920, 30 fps, exactly 540 frames, silent, to `out/video.mp4`.

## Must not
- Use photos, footage, textures, stock illustrations, real logos or real app interfaces.
- Show any word, number or symbol not in the copy list. That includes placeholder text, status-bar clocks and battery icons.
- Use hard cuts to black or crossfades between beats; every handover is a match cut or a shared-element move.
- Add audio, voice-over or music cues.
- Use a third font or any color outside the palette.
- Make the creatures cute or cartoonish. They are elegant line drawings, eerie but beautiful.
