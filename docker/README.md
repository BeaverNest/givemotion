# givemotion in a container

The image is the **machine** (Node 22, chrome-headless-shell 157, ffmpeg 5.1, DejaVu +
Noto colour emoji). The engine is the **host checkout**, bind-mounted at `/work`, so an edit in
`src/` is what the next render uses — no rebuild, no stale copy.

## Build and check

```bash
cd /home/beavernest/givemotion
docker compose -f docker/compose.yaml build
docker compose -f docker/compose.yaml run --rm givemotion doctor
```

`doctor` prints the resolved browser, ffmpeg encoder list and cache path. If the browser line
is missing, the image was built without network access and `install` never ran.

## Render a project

Projects live outside the repo and are mounted at `/videos`
(`GM_PROJECTS` overrides the default `/home/beavernest/givemotion-projects`):

```bash
docker compose -f docker/compose.yaml run --rm givemotion \
    render /videos/demo/index.html -o /videos/out/video.mp4
```

Output is owned by uid 1000 (the `gm` user in the image), so a bind-mounted render is not
root-owned on the host.

## Run the test suite inside the container

```bash
docker compose -f docker/compose.yaml run --rm --entrypoint sh givemotion -c 'npm test'
```

`node_modules/` comes from the host checkout, which is x86-64 Linux here — the same platform as
the image, so `tsc` and the tests run unchanged.

Baseline in this image: **146 of 148 pass, 0 skipped**. Two tests disagree with the host, and
both are environment facts rather than engine breakage:

1. `shared computer: … gives workers back when one starts` — fails on the host too. The
   rebalancing ticker fires once a second; on 16 cores the render runs out of parts first.
2. `check: missing-glyph …` — reports `→` where the host reports `₂`. Which character is
   detected as drawn-from-a-fallback depends on the installed font stack (host has 550 faces,
   the image 320), so this heuristic is not portable. If a project's typography matters, compare
   that project's renders between host and container rather than trusting this warning alone.

## Why the flags in the image exist

- `GIVEMOTION_NO_SANDBOX=1` — Docker without `SYS_ADMIN` cannot give Chrome a user namespace
  for its sandbox. This is a real downgrade: render pages you trust.
- `shm_size: 1gb` — the 64 MB default is where Chrome dies mid-capture with no useful message.
- `cpus: "4"` and `mem_limit: 4g` — a render saturates every core it is given; the ceiling keeps
  twelve cores free for the agent, the gateway and the kanban, and stops a runaway page from
  pushing the host into swap.
- Colour emoji font — without it, emoji render as tofu boxes and the render still exits 0.

## Cost, measured on the starter page (1920x1080, 10 s, 300 frames)

| setting | wall | peak CPU | CPU-seconds | output |
|---|---|---|---|---|
| 2 workers, 4 cores, nice 10 (default) | 12-14 s | ~390% | 30-37 | identical to a 1-worker render |
| 6 workers, 15 cores, nice 0 | 8-10 s | ~1400% | 52-55 | differs from the 2-worker render |

More browsers is **not** just faster spread over more cores: total CPU work goes *up* (52 vs 34
CPU-seconds) because each browser pays its own startup and compositing. Quiet mode is cheaper in
energy and leaves twelve cores free; it costs three or four seconds of wall clock.

Two things that cut the bill without touching the engine:

- **Re-render with the same output name.** Parts are cached in `.gm-parts` next to the output, so
  an unchanged page re-renders in **0.5 s** instead of 11.6 s. This is the biggest win for
  iterate-on-a-slide work.
- **`-o` to a different name defeats that cache.** Every new output name is a cold render.

## Determinism

Two runs of the same project inside the container are byte-identical (verified md5). A run on
the host is **not** byte-identical to a run in the container: the image pins Chrome for Testing
157 and Debian ffmpeg 5.1, while the host has its own Chrome and ffmpeg 9. Pick one lane per
project and stay in it if you need reproducible hashes.

**Worker count is part of that lane, and the engine's own "any number of workers gives the same
bytes" claim does not hold on the starter page.** Measured on the same container:

| workers | md5 of the output |
|---|---|
| 1, 2, 3 | `9259d0b7…` (identical) |
| 4 | `5ab12299…` |
| 5, 6 | `c5e787b3…` |

Frames 90-119 differ between 3 and 4 workers, and 60-119 between 3 and 6 — a few hundred pixels
by up to 33/255 on a moving element, not a visible break, but not byte-identical either. The
default of 2 workers sits in the group that matches a single-worker render, so quiet mode is
also the reproducible mode. Do not assume that holds for every page: the repo's determinism tests
cover its own test pages, and this starter page uses `requestAnimationFrame`.
