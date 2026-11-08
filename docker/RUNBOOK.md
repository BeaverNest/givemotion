# RUNBOOK — givemotion on M80Q

Whoever owns this app later: everything you need is here. No knowledge of the fork's internals is
required to render a video.

## Where things are

| what | path |
|---|---|
| the engine (fork of `givemotion/givemotion`) | `/home/beavernest/givemotion` |
| your video projects | `/home/beavernest/givemotion-projects` |
| the command you type | `/home/beavernest/.local/bin/givemotion` (on `PATH`) |
| the container image | `givemotion:local` (built from `docker/Dockerfile`) |
| render cache | docker volume `givemotion-cache` |

The engine is bind-mounted into the container, not copied: an edit to `src/` on the host is what
the next render uses. The image only provides the machine (Node 22, chrome-headless-shell 157,
ffmpeg 5.1, 320 fonts).

## Everyday use

```bash
cd /home/beavernest/givemotion-projects
givemotion init my-video                       # starter page + agent skill pack
cd my-video
givemotion render index.html -o out/v1.mp4     # 1080p, ~10 s per 10 s of video
givemotion inspect index.html                  # dimensions, clips, problems, as JSON
givemotion doctor                              # is Chrome/ffmpeg/cache healthy
```

Render **to the same output name** while iterating: parts are cached in `out/.gm-parts`, so an
unchanged page re-renders in about half a second instead of ten.

## Resource limits (why a render does not lock the machine)

Two browsers, four of sixteen cores, `nice 10`, 4 GB memory ceiling. Measured on the starter page
(1080p, 10 s): 12-14 s wall, ~390% CPU peak, ~34 CPU-seconds. Raising to six browsers on fifteen
cores gives 8-10 s but **more total CPU** (52 CPU-seconds) and changes the output bytes.

Environment overrides, when the machine is otherwise idle: `GM_WORKERS=6 GM_CPUS=12 GM_NICE=0`.

## Two known limits — do not mistake them for breakage

1. **Chrome runs without its sandbox** (`GIVEMOTION_NO_SANDBOX=1`) because Docker here cannot give
   it a user namespace. Render pages you trust. Do not turn this into a service that accepts
   HTML from the internet without adding a sandbox or a queue.
2. **The test suite is 146/148 in the container.** `shared computer …` fails on a fast host (the
   rebalancing ticker fires once a second and the render outruns it), and `check: missing-glyph`
   reports a different character than the host because the font set differs. Both are environment
   facts; neither means the renderer is broken.

## Health checks

```bash
givemotion doctor                      # inside the container: node, chrome, ffmpeg, cache
docker images givemotion:local         # image present?
docker volume ls | grep givemotion     # cache present?
du -sh /home/beavernest/givemotion-projects/*/out
```

If `givemotion` says the image is missing, build it once:
`docker compose -f /home/beavernest/givemotion/docker/compose.yaml build` (needs network; it
downloads Chrome for Testing).

## Changing the engine

```bash
cd /home/beavernest/givemotion
git fetch upstream && git rev-list --left-right --count HEAD...upstream/main   # upstream moves daily
```

Rebase rather than merge, and note that `npm test` includes a policy check that fails if a tracked
file names a comparable product outside the comparison places (`test/policy/independence.mjs`).
Changes that affect frame timing or the encoder plan change the output bytes — say so in the commit.
