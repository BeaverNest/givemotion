// Minimal Chrome DevTools Protocol client over --remote-debugging-pipe. No dependencies.
import { spawn } from 'node:child_process';
import { atExit } from './machine.js';

/**
 * @param {string} executable
 * @param {string[]} args
 * @param {{ env?: NodeJS.ProcessEnv }} [opts]
 */
export function launchChrome(executable, args, { env } = {}) {
  const proc = spawn(executable, ['--remote-debugging-pipe', ...args], {
    stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'],
    env: env || process.env,
    detached: process.platform !== 'win32',
  });
  // Chrome runs in its own process group, which a Ctrl+C in the terminal does not reach: if this process ends before
  // closing it, end it too (its helper processes with it)
  const unhook = atExit(() => { try { process.platform === 'win32' ? proc.kill('SIGKILL') : process.kill(-proc.pid, 'SIGKILL'); } catch {} });
  const writer = /** @type {import('node:stream').Writable} */ (proc.stdio[3]);
  const reader = proc.stdio[4];
  let nextId = 0;
  const pending = new Map();
  const listeners = new Map(); // `${sessionId}|${method}` -> Set<fn>
  const anyListeners = new Set();
  let closed = false;
  let stderr = '';
  proc.stderr.on('data', (d) => { stderr += d; if (stderr.length > 20000) stderr = stderr.slice(-10000); });
  const exited = new Promise((resolve) => proc.on('exit', (code, sig) => { closed = true; unhook(); for (const p of pending.values()) p.reject(new Error(`Chrome exited (${code ?? sig}). ${lastLines(stderr)}`)); pending.clear(); resolve(); }));
  proc.on('error', (e) => { closed = true; for (const p of pending.values()) p.reject(e); pending.clear(); });
  writer.on('error', () => {});

  let chunks = [];
  reader.on('data', (chunk) => {
    let start = 0;
    for (;;) {
      const end = chunk.indexOf(0, start);
      if (end === -1) break;
      chunks.push(chunk.subarray(start, end));
      const text = chunks.length === 1 ? chunks[0].toString('utf8') : Buffer.concat(chunks).toString('utf8');
      chunks = [];
      start = end + 1;
      let msg;
      try { msg = JSON.parse(text); } catch { continue; }
      dispatch(msg);
    }
    if (start < chunk.length) chunks.push(chunk.subarray(start));
  });

  function dispatch(msg) {
    if (msg.id != null) {
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.error) p.reject(Object.assign(new Error(`${p.method}: ${msg.error.message}${msg.error.data ? ' ' + msg.error.data : ''}`), { cdp: msg.error }));
      else p.resolve(msg.result);
      return;
    }
    const key = `${msg.sessionId || ''}|${msg.method}`;
    const set = listeners.get(key);
    if (set) for (const fn of [...set]) fn(msg.params, msg);
    for (const fn of anyListeners) fn(msg);
  }

  function send(method, params = {}, sessionId) {
    if (closed) return Promise.reject(new Error('Chrome is closed. ' + lastLines(stderr)));
    const id = ++nextId;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, method });
      writer.write(JSON.stringify(msg) + '\0');
    });
  }
  function on(method, fn, sessionId) {
    const key = `${sessionId || ''}|${method}`;
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(fn);
    return () => listeners.get(key).delete(fn);
  }
  function once(method, sessionId, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
      const off = on(method, (p) => { off(); clearTimeout(t); resolve(p); }, sessionId);
      const t = setTimeout(() => { off(); reject(new Error(`Timed out waiting for ${method}`)); }, timeoutMs);
    });
  }
  async function close() {
    if (closed) return;
    try { await Promise.race([send('Browser.close'), new Promise((r) => setTimeout(r, 1500))]); } catch {}
    if (!closed) { try { process.platform === 'win32' ? proc.kill() : process.kill(-proc.pid, 'SIGKILL'); } catch { try { proc.kill('SIGKILL'); } catch {} } }
    await Promise.race([exited, new Promise((r) => setTimeout(r, 2000))]);
  }
  return { proc, send, on, once, onAny: (fn) => anyListeners.add(fn), close, get closed() { return closed; }, stderr: () => stderr, exited };
}

function lastLines(s) {
  const lines = String(s || '').trim().split('\n').filter((l) => !/^\s*$/.test(l));
  return lines.slice(-4).join('\n');
}
