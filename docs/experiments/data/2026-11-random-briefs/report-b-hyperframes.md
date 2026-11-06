> Raw record: round 2, brief B, 2026-11-06. Versions: givemotion 0.1.3 (development branch), Remotion 4.0.541, HyperFrames 0.9.17; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

The Pocketfold title sequence is rendered to `out/video.mp4`. ffprobe shows 1920×1080, h264, 30 fps, exactly 450 frames, 15.000 s, and one video stream with no audio. I checked frames decoded from the MP4 itself, and they match what I reviewed in the snapshots.

## What I built
- **`index.html`** mounts two scenes that both run 0–15 s:
  - **`compositions/ambient.html`**: the deep-ink background with two #183A52 glows drifting in mirrored 12 s figure-eights. Over them is the 48 px dot grid at 6%, with an eased diagonal wave crossing every 5 s that swells dots to 4.5 px and 12%. It keeps moving through the final hold.
  - **`compositions/title.html`**: everything else, as one continuous shot. Lines and coins are drawn from the timeline's clock with seeded randomness, so every frame is repeatable. All text, the counters and the POCKETFOLD letters are GSAP tweens on HTML elements, so the copy stays editable.
- **Beats as built:**
  - **Beat 1:** the coin drops with a squash and soft rebound, sends out a 120 px impact ring, and a mint line draws down with a bright tip. The sentence comes in word by word, 4 frames apart.
  - **Beat 2:** four S-curves draw out with a 5-frame stagger and 9–10 coins stream along each. Nodes pop in, labels sit 40 px below, amounts count up over 1.0 s in tabular figures, and each node pulses when its count lands.
  - **Beat 3:** the paths curl back into the split point. The mark draws outward from its bottom centre, so the paths visibly become the pocket. Coins are pulled in and spiral inside, the last coin slips in through the flap's slot, the mark tightens to 0.94, and frames 268–269 are still.
  - **Beat 4:** at frame 270 the mark snaps back and releases 104 particles (discs and spinning coin rings) with drag and an upward drift. A quarter stay on as dust. A mint shockwave expands to 700 px, and POCKETFOLD rises letter by letter from the centre out.
  - **Beat 5:** the tagline fades up, a wavy underline draws in 0.8 s, "Available now" fades in at 13 s, and the mark breathes on a 4 s cycle. There is no fade to black.
- Only the five brief colours, the two brief fonts and the listed copy appear.
- `SPEC.md` records the timings and `REVIEW.md` has the review notes.

## Render command
```
npx --yes hyperframes@0.9.17 render --quality delivery --fps 30 -o out/video.mp4
```
It took about 40 s. Before rendering I ran `npx --yes hyperframes@0.9.17 check`: 0 errors.

## What got in the way
- **First render had a bug on two frames.** The log showed a canvas error ("negative radius") where a burst particle shrank below 2 px, so those frames lost part of their particles. I clamped the radius, checked again and rendered again with no errors. The file in `out/` is the clean one.
- **Brief vs the tool's guidelines:**
  - The brief's 26 px labels and "Available now" are below the check's 28 px minimum.
  - "Available now" is on screen about 1.7 s, short of the 2 s the check wants for a closing line.
  - I kept both as the brief specifies; they are the two warnings left.
- **"Available now" placement:** I placed it with its bottom edge on y 960 (centred at about y 947), not centred exactly on y 960. Centring it there would push half the text into the 120 px safe margin.
- **Amounts sitting on their paths:** the paths arrive at the nodes vertically, so each amount would sit on top of its line. The line now breaks behind each number while it is showing, like a label on a transit map.
- **Setup friction:**
  - Nothing is installed inside the folder (the CLI runs from the npx cache), so I couldn't read the runtime source. I wrote a small test composition to confirm that drawing driven by the timeline updates correctly on every seek, then deleted it.
  - Some shell commands needed approval, so I copied files one at a time.
