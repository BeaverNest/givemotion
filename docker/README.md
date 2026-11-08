# givemotion in a container

The image is the **machine** (Node 22, chrome-headless-shell 157, ffmpeg 5.1, DejaVu +
Noto colour emoji). The engine is the **host checkout**, bind-mounted at `/work`, so an edit in
`src/` is what the next render uses — no rebuild, no stale copy.

## Build and check

```bash
cd /home/beavernest/scratch/givemotion
docker compose -f docker/compose.yaml build
docker compose -f docker/compose.yaml run --rm givemotion doctor
```

`doctor` prints the resolved browser, ffmpeg encoder list and cache path. If the browser line
is missing, the image was built without network access and `install` never ran.

## Render a project

Projects live outside the repo and are mounted at `/videos`
(`GM_PROJECTS` overrides the default `../../gm-demo`):

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
- `cpus: "15"` on a 16-core host — a render saturates every core it is given.
- Colour emoji font — without it, emoji render as tofu boxes and the render still exits 0.

## Determinism

Two runs of the same project inside the container are byte-identical (verified md5). A run on
the host is **not** byte-identical to a run in the container: the image pins Chrome for Testing
157 and Debian ffmpeg 5.1, while the host has its own Chrome and ffmpeg 9. Pick one lane per
project and stay in it if you need reproducible hashes.
