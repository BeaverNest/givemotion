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
| data/ | raw results tables from `round.js results`. |

Overall scores so far (blind Opus judges, 1-10): round 1 7.5 average, round 2 6.6, round-3 examples 7.9, hand-drawn
with the sketch tools 7.6 (beating the no-tools baseline in the same table, 6.7), round 8 (all briefs, 2 runs) 7.1. These are not strictly comparable
(different briefs and judges); compare ranks within one table.
