# Brief: "The Water Cycle" — Launch Teaser

## Concept
A sleek product-launch teaser for something that has been running for 4 billion years. The water cycle is presented as a hero product being launched, in the style of a tech keynote: dark stage, glowing accent lines, confident type. A single water droplet with a personality is the "product" and leads us through the four stages. It squashes, stretches and splits apart, and comes back together at the end. Lines draw themselves to sketch the sun, the vapour, the cloud, the rain and the river. Each stage name arrives as kinetic type that moves the way its stage does. The final line has a dry wink: the most refillable product ever made.

## Format
- 1920×1080, 30 fps, exactly 18.0 s (540 frames), no audio
- Flat background throughout. Keep a 96 px safe margin on all sides for all type.
- Output: **out/video.mp4**

## Palette
| Hex | Role |
|---|---|
| `#0A1A33` | Background (deep night navy), the full frame for the whole video |
| `#3FD0F0` | The droplet, rain and river: the hero colour |
| `#1F6FB2` | Secondary strokes: vapour trails, the horizon line, the cycle loop at rest, step numbers |
| `#F2F7FA` | Primary type and the cloud outline |
| `#FFB547` | Sun accent. Used only for the sun and the full stop at the end of "Evaporate." |

No gradients, no glows beyond what is listed, no other colours.

## Typography
- **Space Grotesk Bold** for every headline and stage word. Tracking −2%. Headlines 160 px, stage words 140 px.
- **JetBrains Mono Regular** for small labels: "Introducing", the step numbers and the closing line. 32 px, tracking +8%, uppercase.

## On-screen copy (complete list; nothing else may appear)
- INTRODUCING
- 01 · 02 · 03 · 04 (step numbers, each shown on its own)
- Evaporate.
- Condense.
- Precipitate.
- Collect.
- The Water Cycle
- Infinitely refillable.
- AVAILABLE EVERYWHERE. SINCE FOREVER.

## The droplet character
A classic teardrop shape, about 140 px tall, filled `#3FD0F0`, with two small `#0A1A33` dot eyes. It has no mouth and no limbs. It moves on squash and stretch alone:
- Impacts: up to 135% width / 70% height
- Fast vertical travel: up to 75% width / 130% height
- Volume always looks preserved
- Every landing settles with 2 overshoot bounces that get smaller
- It blinks exactly twice in the whole video: at 2.2 s and at 17.0 s

## Beats

**1 — The Reveal (0.0–3.0 s · frames 0–90)**
The screen is empty navy. A thin `#1F6FB2` horizon line draws itself from the centre outwards to both edges, 1920 px wide, at y = 760, 4 px stroke, over 0.6 s with ease-out. The droplet falls from above the frame, stretched to 130% height, and hits the line at 1.0 s. It squashes hard to 135/70, rebounds, overshoots twice and settles. The settle takes 0.5 s. At 1.5 s "INTRODUCING" types in letter by letter in mono above the droplet, 0.04 s per character, with a block cursor that blinks once and is removed. The droplet blinks at 2.2 s. At 2.7 s "INTRODUCING" wipes out to the right.
*Handover:* a small sun circle starts drawing its outline in the top-right corner.

**2 — 01 Evaporate (3.0–7.0 s · frames 90–210)**
The sun's outline draws in clockwise: a 180 px circle with a 6 px `#FFB547` stroke. Eight short rays then draw outwards one after another in a fast stagger. "01" fades in at the top left. The droplet stretches upwards, slowly at first, then snaps up to 75/130, lifts off the line and splits into three thin wavy `#1F6FB2` vapour paths. The paths draw themselves upwards with an S-curve, 6 px stroke with round caps, the outer two staggered by 0.15 s. "Evaporate." rises from below the horizon letter by letter. Each letter stretches upwards as it travels and squashes slightly as it lands on its baseline, with a 0.03 s stagger. The full stop lands last and in sun orange.
*Handover:* the tips of the three vapour paths keep climbing and bend towards a shared point at upper centre, while "Evaporate." and "01" fade down and up out of frame.

**3 — 02 Condense (7.0–10.5 s · frames 210–315)**
Where the vapour paths meet, they curl into a single continuous `#F2F7FA` stroke. The stroke draws a cartoon cloud outline of five bumps, about 520 px wide, in one unbroken pass of about 1.2 s. As the cloud closes, the vapour paths retract and erase upwards into it. "02" appears. "Condense." enters at full width with +60% tracking, then tightens to −2% in a 0.5 s squeeze. As the letters lock together they squash horizontally to 92% and spring back, with a single shared overshoot. The cloud "breathes" twice, scaling to 104% and back.
*Handover:* the cloud squashes down to 88% height, like a sponge being pressed.

**4 — 03 Precipitate (10.5–13.5 s · frames 315–405)**
The cloud springs back up, and five droplets drop out of its underside in a staggered rhythm, about 0.12 s apart. They are mini versions of the hero, 60 px, with no eyes. As each falls it stretches, and a 3 px `#3FD0F0` rain streak draws itself behind it. When a drop hits the horizon line it squashes flat and its streak erases from the top. "03" appears. "Precipitate." falls in letter by letter from the top of the frame in a random order. Each letter stretches on the way down and squashes on impact with one bounce, so the word assembles like rain landing. The fifth and last droplet to fall is the hero, eyes and all.
*Handover:* the four small drops slide sideways along the horizon and merge into the hero, which swells briefly with each merge.

**5 — 04 Collect (13.5–16.0 s · frames 405–480)**
From the hero droplet, a meandering `#3FD0F0` river path draws itself left to right along the horizon. It is an 8 px stroke that grows to 14 px as it flows. It ends in three gentle wave curves at the right edge that stand for the sea. The droplet rides the line as it draws, squashing slightly at each bend. "04" appears. "Collect." travels along the river path: each letter follows the curve, then the letters straighten into a level word at the end. At 15.0 s every element left on screen fades to 30% opacity: the sun, the cloud and the river. Over them, a large `#1F6FB2` circular arrow, 700 px diameter and 6 px stroke, draws itself through all of them in one clockwise loop, so the four stages read as one connected cycle. The arrowhead pops on with a squash.
*Handover:* the loop is complete and pulses once, then everything except the loop and the droplet clears.

**6 — The Lockup (16.0–18.0 s · frames 480–540)**
The droplet jumps into the centre of the loop with a stretch, and lands with a squash on an invisible baseline. "The Water Cycle" slams in word by word, each scaling from 120% to 100% with a short squash on arrival, 0.12 s apart. It sits in `#F2F7FA`, 160 px, centred below the droplet. "Infinitely refillable." slides up beneath it at 56 px in Space Grotesk Bold. "AVAILABLE EVERYWHERE. SINCE FOREVER." types on in mono at the bottom of the safe area. The droplet blinks at 17.0 s. Hold the finished lockup, completely still, from 17.4 s to 18.0 s.

## Must
- Total exactly 18.0 s / 540 frames at 30 fps, 1920×1080, saved to **out/video.mp4**
- Use visible, physically convincing squash and stretch on every droplet impact and launch, with the volume preserved
- Every line in the piece (horizon, sun, vapour, cloud, rain, river, cycle loop) appears by drawing itself along its path. Nothing pops in fully formed.
- Each stage word moves the way its stage does: rises, squeezes, falls, flows
- Use only the listed hex colours, fonts and copy
- Use round stroke caps and joins on all lines
- Keep a consistent easing language: ease-out on entries and a spring overshoot on landings

## Must not
- No photos, footage, textures, stock images, gradients or real brand marks
- No words, numbers or symbols beyond the copy list, including no dates, no URLs and no "coming soon"
- No mouth, limbs or extra features on the droplet
- No hard cuts between beats. Every beat hands over through motion.
- No camera shake, no blur-heavy transitions and no 3D
- No audio track
