// Backstop for the independence policy (CONTRIBUTING.md, "Independence and clean-room policy").
// Comparable products may be named only where comparisons live (COMPARISON_PLACES), and every Markdown file there
// that names one must carry a date and a version number (comparisons are dated and versioned). The list of names is
// kept as salted SHA-256 hashes. It catches slips; the policy, not this list, is the rule.
//   node test/policy/independence.mjs                  tracked text files
//   node test/policy/independence.mjs --hash word      print the hash to add a name to the list
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SALT = 'givemotion-independence:';
export const HASHES = new Set(`a8349b673292fa5736abf057d9cc2ed778087bdbe09acece8d6c25007bf750e6 612891c31e7e76660ad2a7ae6da4b55a0e61c4fb082159d6dbe0197c72c6ddba 4061b7a8d8db64530bceca246fe30ceaf39f8b42202aca884160ba6c6181ee5f `.trim().split(/\s+/));
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const hash = (w) => createHash('sha256').update(SALT + w).digest('hex');
/** Where comparisons live: the README (its comparison sections), the research of each round, the benchmarks. */
export const COMPARISON_PLACES = [/^README\.md$/, /^docs\/experiments\//, /^benchmarks\//, /^\.gitignore$/];
const DATED = /\b20\d\d-\d\d-\d\d\b|\b(January|February|March|April|May|June|July|August|September|October|November|December) 20\d\d\b/;
const VERSIONED = /\b\d+\.\d+\.\d+\b/;
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|mp4|webm|mov|mp3|wav|m4a|ogg|woff2?|ttf|otf|pdf|zip|gz|tgz)$/i;

/** Words (letters and digits) in a text that are on the list, with their line numbers. */
export function scanText(text) {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    for (const m of line.toLowerCase().matchAll(/[a-z0-9]+/g)) if (m[0].length >= 4 && HASHES.has(hash(m[0]))) hits.push({ line: i + 1, at: m.index });
  });
  return hits;
}

/** Problems: a listed product named outside COMPARISON_PLACES, or a comparison page without a date or a version. */
export function scanRepo(root = ROOT) {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const out = [];
  for (const f of files) {
    const allowed = COMPARISON_PLACES.some((re) => re.test(f));
    if (!allowed && scanText(f).length) out.push({ file: f, line: 0, why: 'path' });
    if (BINARY.test(f)) continue;
    let text;
    try { if (statSync(join(root, f)).size > 4e6) continue; text = readFileSync(join(root, f), 'utf8'); } catch { continue; }
    const hits = scanText(text);
    if (!hits.length) continue;
    if (!allowed) for (const h of hits) out.push({ file: f, line: h.line, why: 'outside' });
    else if (/\.md$/i.test(f) && !(DATED.test(text) && VERSIONED.test(text))) out.push({ file: f, line: hits[0].line, why: 'undated' });
  }
  return out;
}

/** Commit messages in a git range (e.g. origin/main..HEAD) that name a listed product. */
export function scanCommits(range, root = ROOT) {
  const log = execFileSync('git', ['log', '--format=%H%x00%B%x01', range], { cwd: root, encoding: 'utf8' });
  return log.split('\x01').map((e) => e.trim()).filter(Boolean).map((e) => e.split('\0')).filter(([, msg]) => scanText(msg || '').length).map(([sha]) => sha.slice(0, 10));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  if (a[0] === '--hash') { console.log(hash(String(a[1] || '').toLowerCase())); process.exit(0); }
  const files = scanRepo();
  const ci = a.indexOf('--commits'), commits = ci >= 0 ? scanCommits(a[ci + 1]) : [];
  const say = { path: 'its path names a comparable product outside the comparison places', outside: 'names a comparable product outside the comparison places', undated: 'compares with another product but carries no date or no version number' };
  for (const h of files) console.log(`${h.file}${h.line ? ':' + h.line : ''}: ${say[h.why]} (see CONTRIBUTING.md)`);
  for (const c of commits) console.log(`commit ${c}: its message names a comparable product (see CONTRIBUTING.md)`);
  if (files.length || commits.length) process.exit(1);
  console.log('independence check: ok');
}
