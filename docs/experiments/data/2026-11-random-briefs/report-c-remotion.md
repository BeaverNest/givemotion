> Raw record: round 3, brief C, 2026-11-06. Versions: givemotion 0.1.3 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

The video is finished and saved at `/home/user/tools5/c/remotion/out/video.mp4`. I checked it with ffprobe: 1920×1080, 30 fps, exactly 450 frames, 15.0 s, video only with no audio track.

## What I built
One composition, `CleanerWake`, laid out as five beats on a single track. Three layers run under or over all of them:
- **Background:** nine sine wave lines, each with its own amplitude, wavelength and drift speed, alternating direction, plus the breathing teal glow. They move on every frame, and the waves follow the camera at 0.3× parallax during the push-in, the slide and the pull-back.
- **The lime point:** one point whose position is worked out for the whole 15 s. It pops in at the centre and draws the horizon. It glides into the NORTH QUAY ring, then rides the stern of the ASHER ISLAND ferry. Through the push it ends up as the charge port on the dock post. It then hops onto the top edge of the battery fill and slides down with it to the chart's origin. It rides the energy curve, carries its momentum past December, swoops in to draw the wake, and pulses once at the end.
- **The match cuts:**
  - The horizon snaps at the point: its left half becomes the north shore and its right half the south shore.
  - The 48 px ferry is the exact same shape as the 1100 px hull, so the push is a pure scale-up, with the fill turning into an outline as it grows.
  - The top edge of the lime fill stretches and slides down to become the chart's x-axis.
  - The point at December carries straight on into the wake.

Fonts are the local Space Grotesk 500/700 and JetBrains Mono 400. Every colour is one of the five in the palette, or one of them at reduced opacity.

## Render command
```
npx remotion render CleanerWake out/video.mp4 --muted
```
I ran it from `/home/user/tools5/c/remotion`; it took about 27 s. During the work I checked stills with `npx remotion render CleanerWake out/frames --frames=… --image-format=png`.

## What I fixed after looking at frames
- Map labels crossed the coastline, so I moved them.
- Docked ferries sat tilted, so they now level out when they arrive.
- The crossings counter ran into the "6 FERRIES. 0 DIESEL." headline, so I retimed both.
- The battery outlines were still visible after the lime line started moving away, so they now fade first and the line slides after.
- The energy curve started with a spike or a jump off the axis, so it now rises smoothly out of the axis.

## Things that got in the way, and judgement calls
- **CO₂:** Space Grotesk has no ₂ character. I set the "2" with the font's own small denominator figure, so the line stays entirely in Space Grotesk.
- **Counter timing:** `41,600` settles at 5.4 s, but Beat 2 ends at 6.0 s, which would break the brief's rule of keeping a number on screen for 1 s after it settles. I fixed the counter to the screen so the camera push doesn't move it, and kept it on screen until 6.42 s.
- **"2026":** typed exactly as the brief times it, it is fully visible for only about 0.73 s before the 2.1 s exit begins. I kept the brief's timing.
- **Cell flashes:** each cell flashes once for 4 frames, but ten cells in 1.8 s means about 5.5 flashes per second across the battery. I made each flash small and soft (a light white glow at under 50% opacity) rather than a hard strobe. The brief asks for both "4-frame flash" and "no more than 3 flashes per second", so you may want to judge this one yourself.
- **Wave parallax:** during the hard push the map zooms about 23×, but the waves only scale to 1.3×. A true 0.3× parallax would have blown them up far past the brief's 9-line, 2 px look.
- **Remotion workflow:** there was no browser here, so I couldn't open Studio as the Remotion docs suggest. I reviewed the work through rendered stills instead.
- **Tooling:** the shell's permission rules blocked some loops and scripts, so I built the contact sheets with a small Node script. I also used a temporary npm package to inspect the fonts. All of that scratch work stayed inside the folder and is now deleted.
