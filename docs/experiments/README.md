# Experiments

Test rounds with fresh AI agents (docs only) and blind AI judges. How to run one: `bench/agents/README.md`.

| file | what |
|---|---|
| 2026-10-format-test.md | Round 1: HTML vs HTML + blocks vs React (12 agents, 8 judges). Decision: HTML stays the main format. |
| 2026-10-format-test-backlog.md | Engine fixes found in round 1. |
| 2026-10-round2.md | Round 2: same briefs again plus new ones; one run per brief was too noisy to compare. |
| 2026-10-round3.md | Round 3: remaking the weak examples; friction log → fixes. |
| 2026-10-t2-examples.md | Round-3 examples vs the ones they replaced: 7.9 vs 3.7, 9 of 9 judges picked the new ones. |
| 2026-10-t3-hand-drawn.md | Hand-drawn whiteboard brief: before/after sketch tools, and the same brief in another framework. |
| 2026-10-t7-speed.md | Where render time goes without a GPU (compositing), what did not help, a determinism fix. |
| 2026-10-r8.md | Round 8: all 9 briefs, 2 runs each, 2 judges each (7.1); friction logs → 20 engine/docs fixes. |
| 2026-10-analyze-accuracy.md | `analyze` scored on 13 videos with known scene changes (`bench/analyze/`): recall 66% → 95%, types 56% → 74% of found, 3x faster. |
| 2026-10-models-showcase.md | One hard brief made by Opus 5.5, Sonnet 5.5, Haiku 5.5 and Fable 5.1 (fresh, independent SDK sessions), shown in one 2x2 video. |
| 2026-11-efforts-showcase.md | One illustrated brief (a dog's walk) made with givemotion by Opus 5.5 at effort low, medium, high and xhigh (independent sessions), 8 blind judges, one 2x2 video: xhigh 8.0, medium 6.9, high 6.6, low 5.3; xhigh cost 3.5x medium. |
| 2026-11-tools-showcase.md | One hard brief made with givemotion, HyperFrames and Remotion by Opus 5.5 (effort medium, independent sessions, each with only its own docs), 6 blind judges, one 2x2 video. |
| 2026-11-kinetic-three-engines.md | "KINETIC" motion reel made with givemotion, Remotion 4.0.541 and HyperFrames 0.9.15 by Opus 5.5 (effort high), 6 blind judges (2026-11-05). |
| 2026-11-random-briefs.md | All random-brief rounds (2-8, sixteen briefs, twenty-two judged sets; drawn at random, written blind, 6 blind judges each), givemotion vs Remotion 4.0.541 vs HyperFrames 0.9.17/0.9.18, with versions, dates, raw data, corrections and what each round changed (2026-11-05/06). |
| 2026-11-rounds-7-8.md | Report on rounds 7 and 8: two makers per tool per brief, every tool open; round 7 a tie at the top, round 8 givemotion first (7.61 vs 6.94 vs 6.75, five of six sets), with judges' notes, process numbers, what changed and the caveats (2026-11-06). |
| data/ | raw results tables from `round.js results`. |

Overall scores so far (blind Opus judges, 1-10): round 1 7.5 average, round 2 6.6, round-3 examples 7.9, hand-drawn
with the sketch tools 7.6 (beating the no-tools baseline in the same table, 6.7), round 8 (all briefs, 2 runs) 7.1. These are not strictly comparable
(different briefs and judges); compare ranks within one table.
