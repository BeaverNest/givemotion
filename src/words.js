// `givemotion words`: the voice-over's words with the times they are said and the exact token to write for each
// (@say, @say#2, …), so an agent never counts occurrences by hand. The same transcript formats as <html data-words>.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';

/**
 * A word-timed transcript in any of the accepted shapes ([{word, start, end}], {words: […]}, Whisper-style
 * {segments: [{words}]}) → [{word, start, end}], or null when it is none of them.
 * @param {any} j
 * @returns {{ word: string, start: number, end: number }[] | null}
 */
export function wordList(j) {
  const list = Array.isArray(j) ? j : j && Array.isArray(j.words) ? j.words : j && Array.isArray(j.segments) ? j.segments.flatMap((/** @type {any} */ x) => x.words || []) : null;
  if (!list) return null;
  return list.map((/** @type {any} */ w) => ({ word: String(w.word ?? w.text ?? ''), start: +w.start, end: +(w.end ?? w.start) })).filter((/** @type {{word: string, start: number}} */ w) => w.word && isFinite(w.start));
}

/** How a time names a word: lower case, no accents, letters, digits and inner apostrophes only (the runtime's rule). */
export const normWord = (/** @type {string} */ w) => String(w).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}']+/gu, '').replace(/^'+|'+$/g, '');

/**
 * Read the transcript of a page (its <html data-words="…">) or a transcript file.
 * @param {string} input  a .html page or a .json transcript
 * @returns {{ file: string, words: { word: string, start: number, end: number }[] }}
 */
export function loadWords(input) {
  let file = resolve(input);
  if (!existsSync(file)) throw new Error(`Not found: ${file}`);
  if (/\.html?$/i.test(file)) {
    const m = /<html\b[^>]*\bdata-words\s*=\s*["']([^"']+)["']/i.exec(readFileSync(file, 'utf8'));
    if (!m) throw new Error(`${input} has no <html data-words="voice.json">: name its word-timed transcript there, or pass the .json file.`);
    file = resolve(dirname(file), m[1]);
    if (!existsSync(file)) throw new Error(`data-words: ${m[1]} was not found next to ${input}.`);
  }
  let j;
  try { j = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { throw new Error(`${file} is not valid JSON (${/** @type {Error} */ (e).message}).`); }
  const words = wordList(j);
  if (!words) throw new Error(`${file} is not a list of {word, start, end}.`);
  return { file, words };
}

/**
 * Every word in the order it is said, with the token that names that very occurrence.
 * @param {{ word: string, start: number, end: number }[]} words
 * @returns {{ word: string, n: string, start: number, end: number, token: string, k: number }[]}
 */
export function wordTokens(words) {
  /** @type {Map<string, number>} */
  const seen = new Map();
  const out = [];
  for (const w of words) {
    const n = normWord(w.word);
    if (!n) continue;
    const k = (seen.get(n) || 0) + 1;
    seen.set(n, k);
    out.push({ word: w.word, n, start: w.start, end: w.end, token: '@' + n + (k > 1 ? '#' + k : ''), k });
  }
  return out;
}

/**
 * The text report: one line per word (in the order first said) with every time it is said and its token, or with
 * `near`, the words said around that moment in time order.
 * @param {{ file: string, words: { word: string, start: number, end: number }[] }} t
 * @param {{ near?: number, span?: number }} [opts]
 */
export function formatWords(t, opts = {}) {
  const toks = wordTokens(t.words);
  const rel = relative(process.cwd(), t.file), name = rel && !rel.startsWith('..') ? rel : t.file;
  const f2 = (/** @type {number} */ x) => x.toFixed(2);
  if (opts.near != null) {
    const span = opts.span ?? 5;
    const list = toks.filter((w) => Math.abs(w.start - opts.near) <= span);
    if (!list.length) return `No word is said within ${span} s of ${opts.near} s (the transcript runs ${f2(toks[0]?.start ?? 0)}–${f2(toks[toks.length - 1]?.end ?? 0)} s).`;
    const wd = Math.max(...list.map((w) => w.word.length));
    return [`Words said ${f2(Math.max(0, opts.near - span))}–${f2(opts.near + span)} s (${name}):`, ...list.map((w) => `  ${f2(w.start).padStart(7)}  ${w.word.padEnd(wd)}  ${w.token}`)].join('\n');
  }
  /** @type {Map<string, typeof toks>} */
  const by = new Map();
  for (const w of toks) { if (!by.has(w.n)) by.set(w.n, []); /** @type {typeof toks} */ (by.get(w.n)).push(w); }
  const wd = Math.min(18, Math.max(...[...by.keys()].map((k) => k.length)));
  const lines = [...by].map(([n, occ]) => `  ${n.padEnd(wd)}  ${occ.map((w) => `${f2(w.start).padStart(7)} ${w.token}`).join('  ')}`);
  return [`${toks.length} words, ${by.size} different, ${f2(toks[0]?.start ?? 0)}–${f2(toks[toks.length - 1]?.end ?? 0)} s (${name}). Write the token after a time to name that very moment;`,
    'a phrase joins words with _ (@spring_pricing), and .end, +0.3 or -0.2 follow any token (@say#2.end, @say#2-0.2).', ...lines].join('\n');
}
