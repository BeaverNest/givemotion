# Working on givemotion (for AI agents and contributors)

- Using givemotion to make a video? Read `skills/givemotion/SKILL.md` instead (and the `references/` files it points to).
- Before fixing a problem someone saw in a video, decide where the fix belongs: engine, skill, the user's own brand and
  taste, or nowhere. The rules are in `CLAUDE.md` ("How to handle feedback"). The authoring format is HTML/CSS/JS only (no JSX).
- Zero runtime dependencies. Node 20+ built-ins only. Keep it that way.
- Plain JavaScript, type-checked from JSDoc: no build step, the files run (and the runtime is injected into Chrome) as
  they are. `npm run typecheck` (`tsc -p .`, also the first step of `npm test`) must stay at zero errors. TypeScript
  and `@types/node` are dev dependencies only.
  - Public API types: `src/types/api.d.ts` (shipped; `package.json` `types`). Change it together with the function;
    `test/types/api.test-types.ts` fails when `src/api.js` and the declarations drift apart.
  - Inside `src/`, refer to those types in JSDoc: `@param {import('./types/api.js').RenderOptions} [opts]`. Type new
    functions' options and return values; that is the context the next agent reads.
  - Fix type errors with JSDoc types or casts (`/** @type {any} */ (x)`), never `@ts-ignore`/`@ts-nocheck`. A cast must
    not change behaviour; if the checker found a real bug, fix the bug.
  - `typings/env.d.ts` (not shipped) declares what the browser runtime adds to the DOM: `__gm*` state on elements,
    `window.gm`, and `gm` inside functions that run in the page.
- Layout:
  - `src/runtime/runtime.js` — injected into every page: virtual clock, clips/sequences, seeking animations, enter/exit, split/count/type, media, `window.gm`.
  - `src/runtime/preset.css` — injected first; easings, keyframes, `.scene`, built-in font faces.
  - `src/runtime/motion.js` — timeline, camera, paths, shapes, morph, burst. `src/runtime/sketch.js` — `data-sketch`, `gm.sketch`, `gm.connect`, `gm.rect`, `data-anchor` (labels that follow their shapes), travel along a connect arrow. `src/runtime/chart.js` — `gm.chart.line` (live line charts: head, callouts pinned to points, rescaling axis). `src/runtime/fonts/` — bundled OFL fonts (Inter, JetBrains Mono, Playfair Display, Space Grotesk, Bebas Neue, Caveat; list them in `THIRD_PARTY_NOTICES.md` when adding one).
  - `src/server.js` — local server: runtime injection, `<gm-include>`, `{{data.*}}`, video frame extraction.
  - `src/browser.js`, `src/cdp.js` — Chrome discovery/install, CDP over a pipe, beginFrame/screenshot capture.
  - `src/render.js`, `src/ffmpeg.js` — workers, fixed 1-2 s parts kept in `.gm-parts/` with fingerprints (only changed parts re-render), encoding, concat, audio mix.
  - `src/analyze.js` — `givemotion analyze`: shots, transitions, camera, pacing, palette, sheets of any video file.
  - `src/check.js` — checker + snapshot contact sheets. `src/studio/` — preview UI.
  - `blocks/` — copyable HTML blocks (header comment = docs). `examples/`, `templates/`.
  - `skills/givemotion/` — the agent skill pack (see below). `.claude-plugin/` — Claude Code plugin and marketplace manifests (the repo root is the plugin; its skill is `skills/givemotion`).
- The skill pack (`skills/givemotion/`):
  - `SKILL.md` is the core that stays in the agent's context: keep it under ~18 KB, with the loop, the composition format, the timing model and the quality rules in its first ~5k tokens (Claude Code keeps only that much of a skill after compaction). Everything else goes in `references/<topic>.md` (one purpose line, a contents list if over 100 lines) and gets a row in the "What to read" table. `givemotion skill` copies the whole folder, and the project `AGENTS.md` section is generated from that table.
  - Every API, attribute and flag must be documented somewhere in the pack, and only APIs that exist in `src/` and `blocks/`.
  - `metadata.version` in SKILL.md and `version` in `.claude-plugin/plugin.json` must equal `package.json` (a unit test checks it); `givemotion doctor` and `check` warn when an installed pack differs from the engine.
- Agent test rounds (fresh agents make videos from the docs, blind judges score them): the harness in `bench/agents/` is kept outside the repo (ignored). Results: `docs/experiments/`. The quality knowledge from those rounds lives in `skills/givemotion/references/techniques/` (one recipe per technique, verified by rendering), `references/motion-design.md` and `references/genres/`: update them when a round teaches something new.
- Tests: `npm test` (needs Chrome + ffmpeg for the e2e part). Determinism matters: any change to the runtime must keep `1 worker == N workers` byte-identical.
- Before changing a block or example: `node src/cli.js check <file>` and `node src/cli.js snapshot <file>` and look at the sheet.
- Independence and clean room (full policy in `CONTRIBUTING.md`): write every line fresh; never read the source code of other code-to-video tools or reproduce their code, APIs or docs; public material (code, docs, commit messages, PRs, media) describes givemotion on its own terms and never names, pictures or characterizes comparable products or their companies; benchmarks against other tools, their data and any video made with them stay outside this repository. `npm test` has a backstop for slips.
- The local server (`src/server.js`) only serves loopback Host headers, never hidden files, and sends no CORS headers: keep it that way (the root is often a project folder with `.env` in it). JSON put inside an inline `<script>` goes through `scriptJSON`.
