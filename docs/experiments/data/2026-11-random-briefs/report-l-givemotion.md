> Raw record: round 7, brief L, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief L, givemotion

yers are smaller, dimmer and slightly blurred; the front layer is large and heavily blurred. The creatures (lanternfish, jellyfish with a 1.2 s pulse and rippling tentacles, a siphonophore) and the marine snow are all computed from the time, so every render is identical. The depth counter counts 0 M to 4,000 M with an ease-in, then rides down as the axis line draws.
- **The chart (3–7 s):** tilted 8°, bars on a true scale (100% = 1,000 px, 1% = a 6 px sliver, 0% with a coral glow pulse), overshoot of 2.5%. Then the camera pushes into the empty Midnight row and the chart blows past the lens.
- **The tagline (7–11 s):** "LIGHT ENDS." goes dark letter by letter, 60 ms apart. For "LIFE DOESN'T.", 12–18 glow points per letter swim in along curves and land on the letter's actual shape, which then lights with a soft bloom. The apostrophe lights last, in coral. A blurred foreground jellyfish crosses the line, then the letters break up and rise like snow.
- **The logo (11–18 s):** the coral apostrophe becomes the lure, which draws the stalk, which flows into a ring drawn clockwise. A faint anglerfish ghost shows inside the ring for about 1 s. ABYSSAL slides out from behind the ring, each letter rising from depth 50 ms apart. Three creatures circle and slow down, the lure pulses at 16.0 s and 17.2 s, and the last frame is the clean lockup with no fade.

## Render command
```
npx givemotion render video.html -o out/video.mp4 --quality high
```
Run from `/home/user/tools5/l/givemotion`; it took about 2.3 minutes at 4 fps on this 4-core machine.

## What got in the way
- **The brief contradicts itself on the counter.** It asks for 64 px from the edges, but also says all type must stay inside a 5% title-safe margin, which is 96 px from the left on a 1920 px frame. I kept the Must: the counter sits 96 px from the left and 64 px from the top. The critic flagged this as a miss; moving it to 64 px would break the title-safe rule instead.
- **Blur grew with the creatures' size.** A CSS blur scales along with the element, so the big foreground jellyfish came out as smudges. I now divide the blur by each creature's scale so every layer gets the blur it is meant to have.
- **The letters piled up.** Flying each ABYSSAL letter out from the ring's centre made them overlap mid-flight. The word now slides out as one strip, masked behind the ring.
- **`check` still lists 5 warnings, all expected:**
  - Two "short hold" warnings: the brief times both tagline lines this tightly.
  - Two "stray mark" warnings: background creatures passing behind type.
  - One "no data-expect" warning: I didn't add the optional timing tags.
- **Small sizes and banding:** the brief's 20 px descriptor and 30 px end tagline are small for a sting. The opening blue-to-black gradient shows slight banding, which is normal for 8-bit video; I didn't add grain to hide it because the brief bans textures.
- A test render I started before the last round of fixes was stopped and replaced by the final render.
