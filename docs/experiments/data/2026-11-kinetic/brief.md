# Brief: "KINETIC", a 20-second motion reel

A short, continuous motion-design piece that shows what good motion looks like: shape morphs, a path that draws
itself, kinetic type, depth and a camera, a 3D wave, counters, and a shared-element hand-over into the end title.
It should feel like one camera moving through one world, not a set of slides.

## Format

- 1920x1080, 30 fps, exactly 20.0 seconds, MP4 (H.264). No audio.
- Deliver the finished video at `out/video.mp4`.

## Palette (no other hues; tints, shades and opacity of these are fine)

- Ground: near-black `#0B0D17`
- Ink: cream `#F2EDE4`
- Accent 1: violet `#7B5CFF`
- Accent 2: lime `#C6F432`

## Type

- Display: **Space Grotesk** (bold), for the three words and the title.
- Labels: **Inter**, small and letter-spaced.
- Both are in `fonts/` as local files (with their OFL licences). Use them; do not load fonts from the internet.

## Beats

1. **0-3 s, the spark.** On the near-black ground a small violet dot pops in (overshoot, then settle) and pulses
   once like a heartbeat. It then morphs into a rounded square, then a triangle, then back into a circle. These are
   true shape morphs (the outline changes), not crossfades, and the shape turns a little with each change. Each new
   shape lands with a short elastic settle.
2. **3-7 s, the path.** The circle shoots off along a long curved path, and the path draws itself behind it as a
   lime line: the circle is the head of the line. The camera follows the circle. Simple geometric shapes at three
   depths (near, mid, far) drift past at different speeds (parallax). The moving circle leaves a short motion trail.
3. **7-11 s, the words.** The line leads into three words, one after another, each centred when it is read:
   `SHAPE`, `MOVE`, `FLOW` (Space Grotesk bold, at least 220 px tall). Each word comes in with a different text
   technique (for example letters rising one by one with blur, a mask or clip reveal, letters that scatter and
   reassemble; your choice). No hard cuts between words: each word hands over to the next through motion. Each word
   is fully readable for at least 0.8 s.
4. **11-15 s, the system.** The camera pulls back and tilts into a 3D perspective view: the words were sitting on
   one card of a 6 x 4 grid of cards floating in space. A wave ripples through the grid from the centre outwards
   (each card lifts and turns, staggered by distance). Three cards show numbers that count up, each with a small
   letter-spaced Inter label under it: `60` `FPS`, `120` `SHAPES`, `1` `TIMELINE`.
5. **15-20 s, the title.** One card flies forward out of the grid toward the camera and grows until it fills the
   frame, becoming the background of the end title (a shared-element transition, not a cut or a fade). On it the
   title `KINETIC` lands with energy and settles, with the three shapes from beat 1 (circle, rounded square,
   triangle) taking part in its arrival, and the tagline `every frame, on purpose` (Inter, letter-spaced) under it.
   Hold the finished title for at least 2 s, with slight ambient motion so it is not frozen.

## Must

- Everything eases or follows physics (no linear starts and stops; a constant drift is fine).
- One continuous piece: every beat flows into the next through motion. Real depth in beats 2 and 4.
- All text is fully inside the frame and readable when it is meant to be read.
- Exact copy: `SHAPE`, `MOVE`, `FLOW`, `60`, `FPS`, `120`, `SHAPES`, `1`, `TIMELINE`, `KINETIC`,
  `every frame, on purpose`. No other words on screen.

## Must not

- Hard cuts, slide-deck fades, website or slide layouts.
- Emoji, images, clip art or icons from a library: draw everything yourself.
- Any hue outside the palette, any font other than the two above.
