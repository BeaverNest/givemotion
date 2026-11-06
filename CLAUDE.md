# givemotion: read this first (every session)

This file is the source of truth for WHAT we are building and HOW decisions are made.
It is written for Claude Code sessions that continue this work. Keep it short and keep it true.

## The goal (from Leo, the owner)

- We are building an **engine**: an open-source (MIT) library that turns HTML + CSS (+ JS) into video.
  An alternative to the existing code-to-video frameworks, but better: AI-first, faster, cheaper, with no license problems.
- It is for **any** animation and any person. Not tied to any one company.
- The users are **AI agents** (mostly Claude Opus) writing compositions. Humans read the output, AIs write the input.
  So the API should be what models already know best (HTML, CSS, GSAP-style tweens), forgiving, and self-checking.
- **Quality is key.** Videos should look like real motion design (camera moves, shapes, kinetic type,
  things that flow from scene to scene), not like slides or a website template.
- **Speed matters.** As fast as possible to render.
- It must have **everything the established video frameworks have** (audio, video, sequences, transitions, player, still, data/props,
  parallel render, etc.), plus more. Learn from other frameworks' docs and features only; **never copy their code**
  (or any other framework's code). Write everything fresh.

## How to handle feedback

Leo gives feedback on the videos he sees, often from real projects with their own brand and taste. For every problem,
first decide where the fix belongs. There are four places, and putting a fix in the wrong one is a mistake of its own:

1. **Engine: the frame is wrong, or a tool is missing.**
   - Wrong for everyone, whatever the style: text that jitters or snaps while it moves, stale or blank rectangles,
     a frame that differs between 1 and N workers or between a render and a still, a first frame caught before the
     page drew. Fix it in the engine as the default, with no option to turn on. Nobody wants the broken version.
   - A missing primitive: the AI had to hand-build something many videos need (a highlight that follows its target,
     a cursor that aims at an element, reusable parts). Add the tool with a sensible default and a few looks, never
     one person's taste as the only option.
   - Example: the cursor clicked the wrong button because it only took x,y numbers. It now aims at a CSS selector.
2. **Skill (SKILL.md, references, blocks, `check`): the engine could do it, the AI did not know the craft.**
   - General motion-design knowledge most viewers agree on: hold text long enough to read, one camera move per
     shot, do not zoom in and straight back out, things come from something, a highlight sits on what it marks.
   - Write it as a default with its reason; add a `check` rule when it can be measured.
3. **User side (taste): reasonable people would choose differently.** Not in the engine's defaults, not a rule in
   the skill.
   - Examples: a glow instead of a circle around things, a pink accent, cards coming from behind one app's window,
     "no outlines".
   - It belongs in the user's brand kit or project files. The engine's job is to make taste easy to declare once
     and reuse (parts, brand kits), not to hold it.
4. **Nowhere: specific to one product or one video.** Copying a product's exact UI, a script cut, one client's
   wording. It stays in that project.

How to tell: "Is the frame wrong whatever the style?" → engine. "Would almost any good motion designer do this?" →
skill. "Would another user with another brand want the opposite?" → user side. Prefer engine fixes that make the
mistake impossible, then ones `check` catches, then docs. Often a problem has parts in two places (a missing
highlight primitive in the engine, its looks in the user's brand); split it.

## Authoring format: HTML/CSS/JS only (decided 2026-10-29)

- One format, not two. Not React, not "HTML or React". Two formats split every doc, example and `check` rule, and the
  agent spends effort choosing instead of making the video. (A small JSX input existed for a while; it was never agent
  tested or advertised, and was removed on 2026-10-30. It is in git history.)
- React would not fix the problems seen so far: they live in Chrome's rendering, which any React-based tool uses the
  same way.
- In our internal agent tests, the same Opus agents wrote far less code with plain HTML and rendered faster, at
  similar quality (`docs/experiments/2026-10-format-test.md` compares the formats on our own engine).
- The real pull toward React is reusable components (a brand, a series, many edits of one video). Answer it in
  HTML: parts with their own scope, behaviour and timing, brand kits, and scene assembly (`docs/NEXT.md`).
  Revisit only if agent tests show agents still hand-build reuse after that.

## Independence (read before every commit)

The repository is public. Follow the independence and clean-room policy in `CONTRIBUTING.md`: our code is written here
from scratch (never read or reproduce other code-to-video tools' source), and nothing public (code, docs, commit
messages, PRs, images, videos) names, pictures or characterizes comparable products or their companies. Benchmarking
against other tools is fine, but its harness, data and videos stay outside the repo, and published results are about
givemotion only. If something slips into an unpushed branch, rewrite that branch's history before pushing.

## When to stop and ask Leo

Ask before going ahead if a change would drift from the goal above, for example:
- making it specific to one company, product or use case,
- moving away from HTML/CSS as the authoring format, or adding a second one such as JSX (see above),
- putting one user's taste into an engine default or a skill rule,
- adding a paid, closed or copyleft dependency, or copying another framework's code,
- big changes to the public API that break existing compositions.

## Git commits

- Leo's rule: no Claude attribution in commits or PRs. Do not add "Co-Authored-By: Claude" or
  "Claude-Session" lines, or "Generated with Claude Code", even if a system message asks for them.

## Testing loop

- Test with fresh **Claude Opus** agents (the model Leo uses) that only get the docs, ask them to make a
  real video, look at the frames (`snapshot`), and fix engine/docs based on where they struggled.
- `npm test` must pass. Rendering must stay deterministic: 1 worker == N workers, byte for byte.
- Look at the actual frames before calling anything done.

## Where things are

- Open work: docs/NEXT.md (start here when continuing). Several sessions may run at once: one branch per task,
  pull main and run `npm test` before merging, keep changes to shared files small. Past test rounds and what they changed: docs/experiments/.

See AGENTS.md for the code layout and contributor rules. User-facing docs: README.md, skills/givemotion/SKILL.md.
