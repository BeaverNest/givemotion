# Random-brief round kit (2026-11-06)

How to run a fair comparison round of givemotion, Remotion and HyperFrames on briefs nobody tuned for. The results
of the first round run with it are in [../../2026-11-random-briefs.md](../../2026-11-random-briefs.md).

The scripts expect the round folder at `/home/user/tools5` (change `R` / the paths at the top to move it), with
`harness/` holding these files.

1. **Draw the assignments.** `python3 draw-briefs.py <seed> 2 > assignments.json`: genre, subject, three motion
   techniques, format (30% vertical) and length (15-25 s), from fixed lists. Keep the seed (`seed.txt`). Do not re-draw.
2. **Write the briefs blind.** A fresh headless session with no tools and no knowledge of the three tools gets
   `brief-writer.txt` filled with one assignment and writes `brief-<id>.md`. Do not edit the briefs.
3. **Set up the makers.** `setup-round.sh <id>` builds `<id>/{givemotion,remotion,hyperframes}`: each tool at its latest
   release, installed the way its docs say, with only its own agent docs, the brief and the fonts. (HyperFrames' `init`
   installs its skills into the user's skill folder, where every session would see them; the script moves them into the
   HyperFrames folder. The machine's network blocks jsdelivr and remotion.media: GSAP is vendored for HyperFrames and
   the preinstalled Chrome Headless Shell is set for Remotion.)
4. **Run the makers.** `run-maker.sh <id> <tool>`: a fresh headless Claude Code session (Opus 5.5, effort high) in its
   own folder, edits allowed only there, a shell allowlist, no web, no subagents, the same prompt for all
   (`prompt-common.txt` + `notes-<tool>.txt`). All six ran at the same time.
5. **Judge blind.** `pack.sh <video> judging/<id>/packs/<tool>` for each video (two contact sheets of 40 evenly spread
   frames, five 1-second motion strips at 10 fps around 10/30/50/70/90% of the video, four key frames), then
   `run-judges.sh <id>`: six fresh sessions that can only read their folder, each seeing the three videos as A, B and C
   in a different order (all six orders once). `scores.py <id>` → `judging/<id>/scores.json`.
6. **Process numbers.** `stats.py` → `stats.json` (tokens, cost, wall time, time waiting on tool calls, tool calls,
   images looked at, code lines, sandbox refusals) from each maker's transcript.
7. **Comparison video.** `compare-build.mjs` → `compare.html`, rendered with givemotion.

## Rounds 4-6 (added 2026-11-06)

- `r4/`, `r5/`, `r6/`: each round's assignments and seeds, judge keys (which letter was which tool for each judge) and
  scores. `r5/times-r5.txt` and `r6/` hold render times; `r6/` also has the open-tools harness used in round 6
  (`run-maker-open.sh`, `prompt-common-open.txt`, `run-round6-open.sh`).
- `brief-f.md` to `brief-j.md`: the briefs as written by the blind brief writer.
- `report-<brief>-<tool>.md` (E to J): the last part of each maker's final message.
- `stats.json` / `stats.py`: tokens, cost, minutes, tool calls, images viewed and lines of code for every maker, A to J.
- Versions: Remotion 4.0.541 (`create-video@4.0.541`), HyperFrames 0.9.18, givemotion 0.1.3 at the development branch,
  Claude Opus 5.5 at effort high.
