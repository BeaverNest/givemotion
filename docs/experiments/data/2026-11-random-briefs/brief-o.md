# Brief: Ledgerline, "Every Dollar Has a Route" title sequence

**Format:** 1920×1080, 30 fps, exactly 24.0 s (720 frames), no audio
**Deliverable:** out/video.mp4

## Concept
Ledgerline is a budgeting app. This video is its opening title sequence, styled like the credits of a heist film set on a city map. A paycheck travels across a quiet night-time street grid as a single glowing route line. It stops at each expense like a getaway car making its drops, and a running balance ticks down in the corner. Each spending category gets an on-screen credit as if it were a cast member. At the end the map falls away and the route straightens into the line the app's name sits on. The tone is confident and a little witty. The look is precise and calm, with nothing cartoonish.

## Palette
| Hex | Role |
|---|---|
| `#0F1B2D` | Background, a deep ink navy that fills every frame |
| `#23344D` | Map street grid and block outlines (a river shape may use it at 60% opacity) |
| `#3DDC97` | The route line, its leading dot, and the PAYDAY pin |
| `#FF6B4A` | Expense pins and the brief flash on debit figures |
| `#F5C451` | SAVINGS pin, its flash, and the final accent dot |
| `#F4EFE6` | All typography (secondary text at 70% opacity) |

No other colors. Only opacity variants of these colors are allowed.

## Typography
- **Space Grotesk** (Regular, Bold): credit names, the title and the tagline.
- **JetBrains Mono** (Regular, Medium): figures, pin labels, credit prefixes and small caps text.

## On-screen copy (complete and exact; nothing else may appear)
- `PAYDAY` · `+$3,200`
- `BALANCE` · `LEFT TO SPEND`
- `$3,200` · `$1,950` · `$1,540` · `$1,444` · `$844`
- `RENT` · `−$1,250`
- `GROCERIES` · `−$410`
- `TRANSIT` · `−$96`
- `SAVINGS` · `+$600`
- `starring` · `YOUR PAYCHECK`
- `featuring` · `RENT, GROCERIES & TRANSIT`
- `and introducing` · `SAVINGS`
- `Ledgerline`
- `Every dollar has a route.`
- `AVAILABLE NOW`

Figures change only by masked rolls from one listed value to the next. Never show intermediate count-up numbers.

## Recurring elements
- **The map:** a 1920×1080 street grid in full-frame coordinates. Vertical streets sit every 160 px and horizontal streets every 140 px, all 2 px `#23344D`. Two diagonal avenues are 3 px, and one gently winding river is a 40 px band at 60% opacity. During the route (beats 1–3) the map is viewed at 180% scale. The view follows the route's leading dot with a soft 0.3 s lag and keeps the dot near screen x≈1100.
- **The route:** a 10 px `#3DDC97` stroke with round caps and 24 px rounded corners, following streets. A 20 px solid leading dot rides its tip with a faint 40 px glow at 25% opacity. Waypoints in map coordinates: PAYDAY (240, 800) → east to RENT (720, 800) → north to (720, 520) → east to GROCERIES (1000, 520) → north to (1000, 300) → east to TRANSIT (1320, 300). From there one smooth arc runs to SAVINGS (1680, 560). That arc is the only curve.
- **Pins:** expense pins are 18 px circles. Each pops in at scale 0 → 1.15 → 1 over 0.35 s and sends out one ring pulse that grows from 18 px to 60 px and fades out. Next to each pin, a label pill (a rounded rectangle at 12% opacity of the pin color) is revealed by a mask that wipes outward from the pin over 0.3 s. Inside the pill are the category name in JetBrains Mono Medium 22 px with 0.12 em tracking, and the amount under it.
- **Balance (screen-fixed, top right, right edge x=1800, top y=90):** label in JetBrains Mono 20 px at 70% opacity, figure in JetBrains Mono Medium 64 px. Each change is a slot roll: the old figure slides up out of a tight rectangular mask and the new one slides up in from below, over 0.35 s. On debits the figure flashes `#FF6B4A` for 0.2 s, then settles to `#F4EFE6`.
- **Credits (screen-fixed, lower left, x=120, name baseline y=950):** the prefix sits on its own line in JetBrains Mono 24 px lowercase at 70% opacity, with the name in Space Grotesk Bold 60 px below it. A credit enters with a left-to-right mask wipe over 0.5 s, with a 2 px `#3DDC97` hairline leading the wipe edge. It exits with a left-to-right wipe-off over 0.4 s.

## Beats

**Beat 1, 0.0–4.0 s: The city draws itself**
The frame opens on solid `#0F1B2D`. Starting at 0.2 s, the street grid draws itself outward from the PAYDAY area: each line strokes on over 0.8 s with ease-out, staggered 0.06 s apart. The avenues follow, then the river traces in over 1.2 s. At 2.0 s the green PAYDAY pin pops in and its pill wipes out showing `PAYDAY` / `+$3,200`. At 2.3 s the balance block wipes in at top right reading `BALANCE` / `$3,200`. At 2.6 s the credit `starring` / `YOUR PAYCHECK` wipes in. The leading dot is already pulsing at PAYDAY, ready to leave.

**Beat 2, 4.0–9.0 s: First drops**
At 4.0 s the route starts drawing east and the view tracks with it. At 5.0 s the "starring" credit wipes off. At 5.4 s the line reaches RENT: the coral pin pops, the pill shows `RENT` / `−$1,250`, and at 5.6 s the balance rolls to `$1,950`. The route turns north with a rounded corner, then east. At 6.2 s the credit `featuring` / `RENT, GROCERIES & TRANSIT` wipes in. At 7.6 s the line reaches GROCERIES: the pill shows `GROCERIES` / `−$410`, and at 7.8 s the balance rolls to `$1,540`. The line keeps moving north toward the next street.

**Beat 3, 9.0–14.0 s: The payoff stop**
At 9.8 s the route reaches TRANSIT: the pill shows `TRANSIT` / `−$96`, and at 10.0 s the balance rolls to `$1,444`. At 10.6 s the "featuring" credit wipes off. The route then leaves the grid logic and sweeps through its single smooth arc toward the lower right, easing out as it lands. At 12.0 s the larger 28 px gold SAVINGS pin pops in with a gold ring pulse, and its pill shows `SAVINGS` / `+$600`. At 12.2 s two things roll at once: the balance label rolls from `BALANCE` to `LEFT TO SPEND`, and the figure rolls to `$844` with a 0.2 s gold flash. At 12.4 s the credit `and introducing` / `SAVINGS` wipes in. It wipes off at 13.6 s.

**Beat 4, 14.0–18.0 s: Pull back, strip down**
At 14.0 s the view eases out from 180% to 100% over 1.5 s, showing the whole route at once as one continuous green line across the city. The balance block wipes off to the right at 14.4 s. At 15.5 s the map un-draws, reversing beat 1 with a 0.05 s stagger over 1.0 s: the grid, avenues and river retract, the pins shrink to 0 (except the gold one), and the pills wipe back into their pins. That leaves the green route alone on navy, with the gold dot at SAVINGS. At 16.5 s the route un-draws from its PAYDAY end toward SAVINGS over 0.6 s. At 17.0 s a fresh horizontal 6 px green line draws itself left to right across screen center at y=640, from x=360 to x=1560 over 1.0 s with ease-in-out. At the same time the gold dot glides along a gentle curve to rest at the line's right end (1580, 640).

**Beat 5, 18.0–24.0 s: Title**
At 18.0 s `Ledgerline` (Space Grotesk Bold, 168 px, `#F4EFE6`, centered, baseline at y=616) rises letter by letter from behind the green line. The mask is the area above the line, so the letters seem to come up out of it. Each letter takes 0.6 s with ease-out and no overshoot, staggered 0.04 s apart. At 19.4 s `Every dollar has a route.` (Space Grotesk Regular, 44 px, 70% opacity, centered, baseline y=720) is revealed by a left-to-right mask wipe over 0.8 s. A 1 px green hairline draws itself in sync beneath the tagline and then fades out. At 20.8 s `AVAILABLE NOW` (JetBrains Mono Medium, 24 px, 0.2 em tracking, centered, baseline y=920) wipes in from the center outward over 0.4 s. At 22.0 s the gold dot gives one soft ring pulse. From 22.5 s to 24.0 s the frame holds perfectly still on the finished title card.

## Must
- Total runtime exactly 24.0 s at 30 fps, 1920×1080, no audio, rendered to out/video.mp4.
- Show all three techniques clearly: the route traveling across the map (beats 2–3), lines drawing and un-drawing themselves (grid, route, title line, tagline hairline), and masked reveals and wipes (credits, pill labels, balance slot rolls, letters rising from behind the line, tagline and sign-off).
- Keep the balance figures arithmetically consistent with the pin amounts, as listed.
- Use only the six palette colors, the two named fonts, and the exact copy above.
- Ease every move; nothing starts or stops linearly except the constant-speed middle of each route leg.
- Keep text at least 100 px from frame edges, and keep credits and balance clear of the route's leading dot.

## Must not
- No photos, footage, textures, icons from icon sets, real brand logos, or real city maps or street names.
- No words, numbers or symbols beyond the listed copy, including no running count-up digits.
- No 3D, lens flares, particle effects, camera shake or glitch effects.
- No mention or depiction of phones, app screens or interface mockups.
- No cut to black or hard cuts; every beat hands over to the next within one continuous video.
- No movement in the final 1.5 s hold.
