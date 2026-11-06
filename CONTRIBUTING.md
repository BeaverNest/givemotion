# Contributing to givemotion

Thanks for helping. Issues and pull requests are welcome.

## Before you start

- **The code layout and the rules** are in [`AGENTS.md`](AGENTS.md) (written for AI agents and people alike).
- **Bigger changes:** open an issue first, so we can agree on the approach before you spend time on it.
  Changes that break existing compositions need a very good reason.
- **Write everything fresh.** Read the independence and clean-room policy below before your first change.
- **No new required npm dependencies.** givemotion runs on Node.js built-ins only.

## Setup

```bash
git clone https://github.com/givemotion/givemotion.git
cd givemotion
npx givemotion install   # or use your own Chrome
npm install              # dev tools only: TypeScript (type checking) and React (React compositions)
npm run typecheck        # fast: type-checks the JavaScript from its JSDoc
npm test                 # type check + all tests; needs Chrome and ffmpeg
```

## A good pull request

- `npm test` passes (it starts with `npm run typecheck`, which must report zero errors).
- New or changed functions have JSDoc types for their options and results; public API changes update
  `src/types/api.d.ts`.
- Rendering stays deterministic: 1 worker and N workers give byte-identical output.
- If you changed something visual (a block, the runtime, an example), run `node src/cli.js check <file>` and
  `node src/cli.js snapshot <file>` and look at the frames.
- New APIs, attributes and flags are documented in the skill pack (`skills/givemotion/`), because that is what
  AI agents read.
- One topic per pull request, with a short description of what changed and why.

## Independence and clean-room policy

givemotion is an independent project. Everything in it is written for it, and when it compares itself with other
tools it does so fairly and in the open.
This policy applies to everyone who contributes, people and AI agents alike, and to everything that lands in this
repository or its releases: code, comments, tests and fixtures, docs, examples, images and videos, file and branch
names, commit messages, issues and pull requests.

### 1. Our code is our own

- Write every line for givemotion. Do not copy, port, translate, paraphrase or "clean up" code from another project,
  whatever its license, unless it is a dependency allowed by section 2 and kept in its own clearly licensed file.
- **Clean room for comparable products.** Do not read the source code of other tools that turn code or web pages into
  video while you work on givemotion, and do not ask an AI agent to. Their public, user-facing material (product pages,
  user docs, changelogs, talks) may inform *what* a feature should do; *how* it works is designed here, from web
  standards and first principles, and the design reasoning is written in our own words.
- An AI agent's suggestion counts as your contribution: if it looks like it reproduces a known project's code, rewrite
  it from the problem, not from the suggestion.
- No other project's API, file layout, naming scheme or documentation text is reproduced as such. Following open
  standards (HTML, CSS, SVG, Web Animations) and widely used, openly licensed conventions (easing names, a tween call
  shape) is fine.

### 2. Dependencies, assets and licenses

- givemotion has no required runtime dependencies. Development tools and optional add-ons must be under a permissive
  license (MIT, BSD, ISC, Apache-2.0 or similar). No copyleft, source-available, non-commercial or paid licenses.
- Every bundled third-party file (fonts, data, media) has a compatible license, keeps its license file, and is listed
  in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Nothing is added without knowing where it came from.
- Examples and docs use media made for this project or media whose license allows it.

### 3. Comparing with other tools: fair, true and transparent

Comparing givemotion with other tools is welcome. Users deserve to know how it stacks up, and an honest comparison
is how we find our own weak spots. What makes a comparison acceptable is how it is done, not whether it names anyone:

- **True and current.** Every claim about another product is a fact we checked, with the date we checked it and the
  version it applies to, and a link to the public source (its docs, license, repository or registry page). Facts
  that change (versions, features, prices, license terms, star counts) are re-checked before each release or marked
  with their date.
- **Fair method, published.** A test that compares results uses the same brief, the same model and settings, the same
  machine and the same limits for every tool, with each tool used as an ordinary user would, through its own
  official, public docs and under its own license and terms. Briefs are chosen so nobody can tune for them (drawn at
  random, written blind), and judging is blind. The method, prompts, versions, dates, raw scores and the harness are
  published next to the result, so anyone can rerun it.
- **Losses as clearly as wins.** Report the full result, including where givemotion is behind, and the limits of the
  test (sample size, one machine, AI judges). No cherry-picking: every round that ran is reported, including failed
  runs. Say what is not equal and in whose favour.
- **Facts, not attacks.** Describe what a product does, measured; do not speculate about motives, mock, or use loaded
  words. Say what each tool is good at, including the reasons someone would pick it over givemotion.
- **Names, not brands.** Refer to other products by their plain names to identify them. Do not use their logos,
  visual identity or anything that suggests affiliation or endorsement, and say plainly that we are not affiliated.
  Their trademarks belong to their owners.
- **Licenses and terms.** Link to another product's license or terms and summarize them only in plain, attributed
  words ("our summary, not legal advice"); never tell readers what they may or may not do under someone else's terms.
- **Outputs, not code.** Videos made during a fair test (our briefs, rendered by each tool) may be published with each
  tool named on them. Code, docs or assets from another tool are never copied into this repository; a harness installs
  each tool from its public registry instead.
- **Where it lives.** Comparisons belong in the README's comparison sections, in `docs/experiments/` (the full
  research of each round) and in `benchmarks/`. Engine code, the skill pack, tests and examples describe givemotion on
  its own terms and do not mention other products.
- **Corrections.** If a fact about another tool is wrong or outdated, fix it promptly and note the correction in the
  same place.

### 4. Checking and fixing

- Reviewers check every pull request against this policy. `npm test` includes a backstop with two parts: other
  products named on a short list (kept as hashes in `test/policy/independence.mjs`) may only appear in the places
  listed above, and every file there that names one must carry a date and a version number. It catches slips; the
  policy above is the rule, the test is not a substitute for judgment.
- If something that breaks this policy slips into a branch, fix it in the next commit and, before it reaches a release
  or the default branch, rewrite that branch's history so it was never there. If it is already public, tell the
  maintainer.
- When unsure whether something fits, leave it out and ask in the pull request.

By contributing you agree that your contribution is licensed under the MIT license of this project, and that it
follows the policy above.
