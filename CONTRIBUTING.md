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

givemotion is an independent project. Everything in it is written for it, and it describes itself on its own terms.
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

### 3. How we talk about other products

- Public material describes givemotion by what it does, measured on givemotion. It does not name, picture, link to
  or characterize comparable products or the companies behind them: no comparison tables, no "alternative to",
  no "faster than", no screenshots or renders made with them, and no statements about their licenses, prices,
  terms or quality.
- Naming software is fine where it is a plain technical fact needed to use givemotion: the platforms and tools it runs
  on or works with (browsers, Node.js, ffmpeg, operating systems, AI coding assistants), and open standards.
- If you need to refer to the field, say "other code-to-video tools", and only to explain a design choice of ours.

### 4. Benchmarks and experiments

- Testing givemotion against other tools is useful and allowed, as long as each tool is used the way an ordinary user
  would, under its own license and terms. Those runs, their harness, raw data, prompts and any video made with another
  tool stay outside this repository.
- What we publish from such work is about givemotion: our own numbers, what we learned about our engine and docs, and
  what we changed. Other tools appear, if at all, as unnamed reference points without versions, links or identifying
  detail.

### 5. Checking and fixing

- Reviewers check every pull request against this policy. `npm test` includes a backstop that fails when tracked text
  names a product on a short, privately maintained list (it stores hashes, not names). It catches slips, not intent:
  the policy above is the rule, the test is not a substitute for judgment.
- If something slips into a branch, remove it in the next commit and, before it reaches a release or the default
  branch, rewrite that branch's history so it was never there. If it is already public, tell the maintainer.
- When unsure whether something fits, leave it out and ask in the pull request.

By contributing you agree that your contribution is licensed under the MIT license of this project, and that it
follows the policy above.
