// Backstop for the independence policy (CONTRIBUTING.md, "Independence and clean-room policy").
// Public material must not name comparable products or their companies. The list of names is kept as salted
// SHA-256 hashes, so this file does not publish it. It catches slips; the policy, not this list, is the rule.
//   node test/policy/independence.mjs              tracked text files
//   node test/policy/independence.mjs --commits A..B   also the commit messages in a range (before a push)
//   node test/policy/independence.mjs --hash word   print the hash to add a name to the list
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SALT = 'givemotion-independence:';
export const HASHES = new Set(`a8349b673292fa5736abf057d9cc2ed778087bdbe09acece8d6c25007bf750e6 612891c31e7e76660ad2a7ae6da4b55a0e61c4fb082159d6dbe0197c72c6ddba 4061b7a8d8db64530bceca246fe30ceaf39f8b42202aca884160ba6c6181ee5f `.trim().split(/\s+/));
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const hash = (w) => createHash('sha256').update(SALT + w).digest('hex');
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|mp4|webm|mov|mp3|wav|m4a|ogg|woff2?|ttf|otf|pdf|zip|gz|tgz)$/i;

/** Words (letters and digits) in a text that are on the list, with their line numbers. */
export function scanText(text) {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    for (const m of line.toLowerCase().matchAll(/[a-z0-9]+/g)) if (m[0].length >= 4 && HASHES.has(hash(m[0]))) hits.push({ line: i + 1, at: m.index });
  });
  return hits;
}

/** Tracked text files whose content or path names a listed product. */
export function scanRepo(root = ROOT) {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const out = [];
  for (const f of files) {
    if (scanText(f).length) out.push({ file: f, line: 0 });
    if (BINARY.test(f)) continue;
    let text;
    try { if (statSync(join(root, f)).size > 4e6) continue; text = readFileSync(join(root, f), 'utf8'); } catch { continue; }
    for (const h of scanText(text)) out.push({ file: f, line: h.line });
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
  for (const h of files) console.log(`${h.file}${h.line ? ':' + h.line : ' (path)'}: names a comparable product (see CONTRIBUTING.md)`);
  for (const c of commits) console.log(`commit ${c}: its message names a comparable product (see CONTRIBUTING.md)`);
  if (files.length || commits.length) process.exit(1);
  console.log('independence check: ok');
}
