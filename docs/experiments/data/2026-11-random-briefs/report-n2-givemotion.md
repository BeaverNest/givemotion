> Raw record: round 8, brief N2, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief N2, givemotion

eaves through the top while `EVERY DOOR.` slides in letter by letter with an elastic +80 → 0 letter spacing. Each glyph bursts into 4 doors (40 in all), which flip shut and fill teal, rippling out from the lock. The doors then collapse into one line at y=360.
- **Beat 4:** the password scrambles using only its own characters and locks left to right, each character with a squash pop. The characters collapse into 16 teal dots, which fly on curves into the keyhole while the lock pulses and squeezes its eyes shut. The shackle snaps shut (130/75 squash), then 2 amber rings and 60 teal particles burst out and hang. The lock blinks happily and shrinks into a 60 px icon.
- **Beat 5:** the particles stream into the title and the letter shapes show through where they land. At 19.8 s the title snaps solid (104% → 100%) and the icon beside the K squash-bounces. The tagline types out and its cursor goes. The final second is only a 2% push-in.

## How I checked it
I ran `check` and `review`, looked at extra stills, and had one independent critic review the frames. That review led to these fixes:
- the fallen letters no longer overlap each other
- the burst dots now sit behind the lock's face
- the turn and the upward glance are bigger, so they read
- the 11 s hand-over: `ONE KEY.` is gone before `EVERY DOOR.` arrives, and it no longer sits frozen
- the door grid now frames the lock instead of crowding the top edge
- the doors collapse into a clean line
- the title visibly forms from the particles before it snaps solid
- the tagline is centred under the word, and the push-in is a full 2%

The last check shows 0 errors. The 36 remaining warnings are deliberate or false alarms:
- the crack is meant to cross the letters
- the amber `KEY` is laid over the cream one
- the fallen letters' boxes overlap even where the glyphs don't
- the dot grid is reported as covering text, though it is drawn behind it
- `EVERY DOOR.` is held only about 0.6 s because the brief's own timing allows no more

## Render command
```
cd /home/user/tools5/n2/givemotion && npx givemotion render video.html -o out/video.mp4
```

## What got in the way
- **Tagline timing:** the brief can't be followed exactly here. Typing 30 characters at 1 frame each from 20.2 s ends at 21.2 s, which would put motion into the final second that must hold still. I start typing at 19.93 s, so it finishes and the cursor goes by about 20.93 s.
- **Two other judgement calls on wording:**
  - "a shadow drops in from the top of frame" became a floor shadow that grows as the lock falls toward it.
  - "aligned to the cap height" means the top of the 60 px icon lines up with the top of the capitals. Next to 300 px type the icon looks small, but that is the size the brief asks for.
- **Early layout guesses:** the first versions had the doors too close to the shackle, tracking overshoot that made `EVERY DOOR.` letters collide, and debris letters piled on each other. These only showed up once I looked at the rendered frames.
