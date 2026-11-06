> Raw record: round 8, brief O, 2026-11-06. Versions: givemotion 0.1.4 (development branch), Remotion 4.0.541, HyperFrames 0.9.18; maker Claude Opus 5.5 at effort high. Text as the maker wrote it.

# Maker report: brief O, remotion

he brief. Remotion stills confirm the final 1.5 s hold is pixel-identical.

## What I built
- **Structure:** a `Ledgerline` composition in `src/`.
  - The map is one SVG (street grid, two avenues, river, route, leading dot, pins, pills) with a camera transform: 180% zoom, following the dot with a 0.3 s lag.
  - The balance block, the credits and the title card sit on top as screen-fixed text, laid out so the baselines land on the brief's coordinates.
- **Route:** I calculate its geometry myself (24 px rounded corners plus the single curve), so the drawn line and the leading dot always match. Each leg eases in, runs at constant speed, then eases out.
- **Reveals:** grid lines draw outward from PAYDAY and retract back toward it. The balance changes are slot rolls, with the coral or gold flash layered on top so no colours outside the palette appear. Credits wipe in with a green hairline on the edge, and the title letters rise from behind the green line.
- **Fonts:** Space Grotesk and JetBrains Mono, loaded from `fonts/` with `@remotion/fonts`.

## Render command
```
npx remotion render Ledgerline out/video.mp4
```
(run from /home/user/tools5/o/remotion, takes about 45 s)

## What got in the way and how I resolved it
- **The waypoints don't fit the street grid.** 240/720/1680 are on the 160 px rhythm, but 1000 and 1320 aren't, and y=300 isn't on the 140 px rhythm. I moved the nearest regular street onto each street the route uses, so the route always runs on a real street and the grid keeps its rhythm everywhere else.
- **Credit collisions.** With the dot held at one screen height, the route already travelled ran behind the "featuring" credit for about a second at the GROCERIES and TRANSIT stops. The brief only fixes the dot's x (≈1100), so I made its vertical screen position change over time, and moved several pills to the side away from the credits.
  - Now nothing overlaps a credit while the route is stopped. During the climbs, the old route line still slides behind the "featuring" credit for about 0.3 s. That can't be avoided with this timing: the route climbs about 900 screen px while that credit is up.
- **Minus sign.** The copy uses the true minus (−). JetBrains Mono draws it with the same glyph as a hyphen, so it looks like "-$410" on screen. The character is correct.
- **Interpretations:**
  - Pins sit on the middle of each rounded corner, so the line passes through their centres.
  - Pills scale with the map (22 px text appears about 40 px at 180% zoom).
  - The "g" in Ledgerline stays clipped where it meets the line, as the "area above the line" mask implies.
  - The balance label is slightly letter-spaced. The brief gives its size but not its spacing.
- **Workflow:** the docs centre on a live Studio preview for a person to watch. There was no one to watch, so I briefly confirmed Studio loads and did all checking from rendered frames. The project type-check still fails, but only on example files inside `skills/`. ESLint on `src/` is clean.
