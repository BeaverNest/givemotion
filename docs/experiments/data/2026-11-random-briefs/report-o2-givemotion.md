> Raw record: round 8, brief O2, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief O2, givemotion

t. The route un-draws, the title line draws across, and the gold pin glides to the end of the line.
- **Beat 5:** "Ledgerline" rises letter by letter from behind the line, then the tagline wipe with its hairline, AVAILABLE NOW from the centre, and one gold ring pulse. The last 1.5 s are perfectly still: the source frames from 22.5 to 24.0 s are pixel-identical.
- **Measured positions:** the credit baseline is at y=950, the balance's top-right corner at (1800, 90), and the title, tagline and AVAILABLE NOW baselines at y=616, 720 and 920.

**How I worked:** I followed the docs: a direction and shot list at the top of the HTML, then stills, `check`, `review` twice, and one independent critic sub-agent. I fixed what it found and left the claims that didn't hold up:
- **Fixed:** cues that looked late because of slow-starting eases, a 0.4 s gold flash, a sliver of the balance showing before its wipe-in, the river being off screen during beat 1, and the sliced "g".
- **Not changed:** the debit minus sign. The page does use the true "−"; JetBrains Mono just draws it the same as a hyphen, and the brief requires that font.

**Render command** (run from `/home/user/tools5/o2/givemotion`):
```
npx givemotion render video.html -o out/video.mp4 --quality high
```

**What got in the way**
- **The brief's street grid and waypoints don't line up.** With streets every 160/140 px, no grid placement passes through every waypoint. I put PAYDAY, RENT and SAVINGS on grid streets and added two short block-to-block alleys (x=1000 and y=300) so the route still follows streets.
- **Corner pins sit 7 px off the brief's coordinates.** The 24 px rounded corners never reach the exact RENT and GROCERIES corner points, so I placed those pins where the dot actually stops. Otherwise the dot left a coral sliver next to them.
- **Two title changes go slightly beyond the brief.** Keeping the "g" tail behind the line made the word read "Ledqerline". So after the letters land, the mask drops and the tail crosses in front of the line with a thin navy gap.
- **I added an element the brief didn't ask for.** The trailing route and pills kept passing behind the lower-left credits, so there is a soft background-colour scrim behind them from 2.3 to 14.4 s.
- **givemotion tilts the whole map.** It rotates any moving element that contains text by 0.042°, which made the long street lines stair-step. Setting `rotate: 0deg` on the map layer opts it out.
- **`check` can't see clip-path wipes.** I hide each element right after its wipe ends and marked the balance block `crop-ok`.
- **Remaining `check` warnings are deliberate.** They cover things the brief asks for: the empty first half-second, the 20 px balance label, the still ending, and street lines under the credits.
- **Labels can still touch the frame edge mid-move.** During the follow and the pull-back, pills slide in and out past the edge, for example at about 11.5 s and 14.5 s. They stay at least 100 px clear whenever the camera is holding.
