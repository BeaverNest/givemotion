> Raw record: round 7, brief M, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief M, remotion

all rebuilds around it at its exact starting position.
- **Beat 4:** a bottom-to-top wipe turns the wall into a floor plan while the spine shrinks into the dot. The Teal path draws with five turns and a "÷10" pops at each one; the three-line headline builds at the top.
- **Beat 5:** the dot stretches into a bar, which sweeps across and reveals the three lines with a 5-frame lag per line. It then swings round into the underline, and the last 36 frames are a still hold.

I checked the scene changes frame by frame (119→120, 254→255, 494→495, 629→630) and each one matches.

**Render command** (run from `/home/user/tools5/m/remotion`):
```
npx remotion render AddressOfEveryBook out/video.mp4 --muted
```

**Fixes I made after looking at frames**
- **Knockout text:** the letters first read badly because short spines left dark gaps. I made the wall denser and sat each line of type on a shelf, so the letters are filled solid.
- **Counter:** the unchanged "1 IN" was rolling along with the number and looked glitchy. Now only the number rolls and the prefix slides to stay centred.
- **OCTOPUSES:** a stray "S" was left inside the band as it narrowed. The name now sinks out first, and it is still readable for 20 frames.
- **Underline:** the bar rotating into the underline was striking through "WALK INTO." It now swings into the empty space on the right and slides in under the last line.

**Where I departed from the brief**
- **Outro size:** the brief asks for the outro type at about 190px, but "YOU CAN WALK INTO." is 1,173px wide at that size. I used 148px so it fits inside the 80px margins, which the brief lists as a Must.
- **Opening size:** "A MILLION / BOOKS." is 290px rather than about 250px, so it actually fills the width.
- **Stamp overshoot:** at 115% scale the opening stamp pokes past the side margins for about 4 frames. This conflict is built into the brief, and I kept the 115% it asks for.
- **Card width:** the card widens from 760px to 920px while the tracking opens up, because the spread-out digits don't fit a 760px card at 190px.
- **Typing time:** typing one character per frame takes 28 frames, longer than the brief's 0.6 s window, so it starts slightly early.
- **Wall rebuild:** in Beat 3 the rows are staggered 2 frames apart instead of 3, so the rebuild finishes by 16.5 s.
- **Dot position:** the coral dot sits in the aisle in front of the fifth shelving row rather than on it. A path that starts going up and makes five right-angle turns has to finish horizontally, so it can only end in an aisle.

**What got in the way**
- There's no preview to watch, so instead of the Remotion Studio preview the docs recommend, I checked my work by rendering stills and contact sheets with `npx remotion render --frames=...`.
- `tsc` reports errors only in the example files under `skills/`, which are missing map packages. My code in `src/` type-checks and passes ESLint.
- `remotion.config.ts` already showed as modified in git before I started; I didn't touch it.
