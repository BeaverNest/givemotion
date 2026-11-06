# KINETIC round kit (2026-11-05)

Run on 2026-11-05 with givemotion 0.1.3 (development branch), Remotion 4.0.541 and HyperFrames 0.9.15; makers and judges Claude Opus 5.5 at effort high.

Everything needed to run the round in [../../2026-11-kinetic-three-engines.md](../../2026-11-kinetic-three-engines.md) again.
The scripts expect the round folder at `/home/user/tools4` (change `R` at the top of each to move it) with one folder per
maker (`givemotion/`, `remotion/`, `hyperframes/`) set up as the write-up describes, each holding `brief.md` and `fonts/`.

| file | what |
|---|---|
| `brief.md` | the tool-neutral brief every maker got |
| `prompt-common.txt`, `notes-*.txt` | the maker prompt and the few lines about each tool in its folder |
| `run-maker.sh <tool>` | one maker: a fresh headless Claude Code session, edits inside its folder, a shell allowlist |
| `stats.py` | tokens, cost, time, tool calls, images looked at, code lines from each maker's transcript → `stats.json` |
| `pack.sh <video> <dir>` | what the judges see: two contact sheets, a motion strip per beat, four key frames |
| `judge-prompt.txt`, `run-judges.sh` | six blind judges, every order of the three videos once |
| `scores.py` | the judges' JSON → `judges/scores.json` (means, ranks, notes); `judges/key.txt` maps letters to tools |
| `time-renders.sh` | each final video rendered again with its maker's own command, one at a time |
| `compare-build.mjs`, `compare-notes.json`, `render-times.json` | the comparison video (`compare.html`, rendered with givemotion) |
| `report-*.md` | each maker's final report |
