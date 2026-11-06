# Brief: KEYWARD — "One Key" Title Sequence

## Concept
This is the opening title sequence for **KEYWARD**, a fictional password manager. A weak password cracks and falls apart. A round amber padlock with a face bounces in and gathers up the pieces. Bold kinetic type explains the idea. A strong generated password scrambles into place, gets masked into dots and is fed into the lock's keyhole. The lock snaps shut with a burst, and the burst particles come together into the title. The tone is playful and confident, like a heist-movie opening drawn in flat shapes.

## Format
- 1920×1080, 30 fps, exactly 22.0 s (660 frames), no audio
- Deliver to **out/video.mp4**

## Palette
| Hex | Role |
|---|---|
| `#0E1325` | Background (midnight navy), padlock eyes and keyhole |
| `#F4F1EA` | Main type, padlock shackle, cursor |
| `#FFB930` | Padlock body, highlight words, burst rings |
| `#2EE6C5` | "Secured" state: mask dots, particles, final title |
| `#FF5A5F` | "Weak" state: the bad password only |
| `#2A3352` | Secondary: floor line, door outlines, faint grid |

## Fonts
- **Bebas Neue**: all headline kinetic type and the title
- **JetBrains Mono**: passwords, mask dots, tagline

## On-screen copy (exhaustive; nothing else may appear)
1. `password123`
2. `ONE KEY.`
3. `EVERY DOOR.`
4. `x7#Rq!vL9@mZ2$wK`
5. `••••••••••••••••` (16 mask dots, one for each character above)
6. `KEYWARD`
7. `REMEMBER ONE. FORGET THE REST.`

During scramble effects, the only glyphs allowed are characters taken from line 4.

## Beats

### Beat 1: The Weak Link (0.0–4.0 s, frames 0–119)
- **Screen:** navy background. A faint `#2A3352` floor line runs across the full width at y = 860.
- **0.0–0.5 s:** a cream block cursor (JetBrains Mono, 96 px) blinks twice at center.
- **0.5–2.3 s:** `password123` types out in coral at 96 px, one character every 5 frames, with the cursor moving ahead of it.
- **2.3–2.8 s:** the word shivers with ±3 px jitter. A thin cream crack line zigzags through it, left to right, in 6 frames.
- **2.8–4.0 s:** the cursor disappears. All 11 letters come loose and fall under gravity, staggered by 2 frames. Each letter lands on the floor line with squash and stretch:
  - stretch to 80% wide / 125% tall while falling
  - squash to 130% wide / 70% tall on impact
  - one smaller rebound, then settle
- **Handover:** the letters end up scattered and tilted along the floor. A shadow drops in from the top of frame.

### Beat 2: Enter the Keeper (4.0–9.0 s, frames 120–269)
**The padlock character**
- Body: `#FFB930` rounded rectangle, 220×180 px, 40 px corner radius.
- Shackle: a cream arc with a 26 px stroke, drawn open (left leg lifted).
- Face: two navy dot eyes (18 px). The navy keyhole acts as the mouth.

**Action**
- **4.0–4.6 s:** the lock drops from above frame onto the floor at x = 300. On impact it squashes hard (140% wide / 60% tall), stretches to 85% / 120% on the rebound, and settles over 8 frames of overshoot. The shackle lags one beat behind the body and wobbles.
- **4.6–5.0 s:** the lock blinks: eyes scale to 10% height and back, over 4 frames.
- **5.0–8.4 s:** the lock makes three hops to the right. Each hop takes about 1.1 s:
  - anticipation squash
  - stretched take-off
  - arc through the air
  - squashed landing

  Each landing lands on a cluster of fallen coral letters and turns it into a burst of 12–16 small coral circles. Mid-air, the circles change color to teal and drift upward, fading out.
- **8.4–9.0 s:** the lock lands at center and turns to face the camera (a quick horizontal squash stands in for the turn). It looks up.

**Handover:** the lock's upward glance leads the eye to where the type is about to slam in.

### Beat 3: One Key. Every Door. (9.0–14.0 s, frames 270–419)
**`ONE KEY.`** (Bebas Neue, 260 px, cream)
- Slams down word by word above the lock. Each word drops in from above, overshoots its baseline by 30 px, then settles.
- The lock gives a small squash each time a word lands, as if it felt the hit.
- `KEY` turns amber.

**`EVERY DOOR.`** (200 px)
- **11.0 s:** `ONE KEY.` scales up and slides out of frame to the top. `EVERY DOOR.` slides in from the right, one letter at a time, with an elastic tracking squeeze: letter spacing starts at +80 and snaps to 0.
- **12.0–13.4 s:** the letters of `EVERY DOOR.` break apart into a grid of 40 small `#2A3352` door outlines (60×90 px rounded rectangles) that fan out across the frame.
- Each door swings shut with a horizontal scale flip, rippling outward from the lock. As each door closes it fills with teal.

**Handover (13.4–14.0 s):** the door grid collapses into a single horizontal line at y = 360, the baseline for the next beat.

### Beat 4: Lock It (14.0–18.5 s, frames 420–554)
- **14.0–15.4 s:** `x7#Rq!vL9@mZ2$wK` resolves on the baseline (JetBrains Mono, 88 px, cream) as a slot-machine scramble. Each character cycles through glyphs from the same string, then locks into place from left to right, staggered by 2 frames. Each locked character gives a small vertical squash pop.
- **15.4–16.4 s:** from left to right, each character collapses into a teal `•` mask dot, keeping its position. The result is `••••••••••••••••`.
- **16.4–17.3 s:** the 16 dots peel off one by one and fly in curved paths into the padlock's keyhole. The lock's body pulses slightly larger with each dot it takes in. Its eyes squeeze shut.
- **17.3–17.6 s:** the shackle snaps closed with a fast drop. The body squashes to 130% / 75%, then springs back.
- **17.6–18.5 s:** a burst comes out of the lock:
  - 2 expanding amber rings with a 6 px stroke that thins to 0
  - 60 teal particles thrown out radially with randomized speed and slight drag, ending up hanging in a loose cloud around the lock

**Handover:** the lock gives a happy blink and shrinks into a small 60 px icon. The particle cloud stays hanging in the air.

### Beat 5: Title (18.5–22.0 s, frames 555–659)
- **18.5–19.8 s:** the hanging particles stream inward and come together into the letterforms of `KEYWARD` (Bebas Neue, 300 px, teal) at center.
- **19.8 s:** the letterforms snap solid with a 4-frame scale overshoot (104%, then 100%). The small padlock icon sits immediately to the left of the K, aligned to the cap height, and gives one final squash-bounce.
- **20.2–21.0 s:** `REMEMBER ONE. FORGET THE REST.` types out below the title (JetBrains Mono, 40 px, cream, 1 frame per character), with a cursor that blinks and then disappears.
- **21.0–22.0 s:** hold the final frame. The only motion allowed is a slow 2% push-in on the whole composition.

**Timing check:** 4.0 + 5.0 + 5.0 + 4.5 + 3.5 = **22.0 s**

## Must
- Be exactly 660 frames at 30 fps, 1920×1080, silent, delivered to **out/video.mp4**.
- Give the padlock clear squash and stretch on every landing, hop and snap, with its volume roughly preserved.
- Have at least three distinct particle moments: the coral-to-teal letter pops, the 60-particle lock burst, and the particles coming together into the title.
- Make every piece of type move with intent: slam, overshoot, tracking squeeze, scramble, collapse.
- Keep coral only for the weak password and its debris.
- Keep all critical type inside a 96 px title-safe margin.
- Keep the final title frame clean and legible for its full last second.

## Must not
- Show any copy not listed above. That includes scramble glyphs from outside `x7#Rq!vL9@mZ2$wK`.
- Use photos, footage, textures, stock images, real brand logos or recognizable product UI.
- Use colors outside the palette, gradients that add new hues, or glow effects that shift hue.
- Include audio, voice or music.
- Cut hard between beats: every beat hands over through motion.
- Leave the screen empty or static for more than 0.5 s before the final hold.
