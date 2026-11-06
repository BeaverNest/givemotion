// Public API
export { render, stills, openComposition, resolveInput } from './render.js';
export { check, snapshot, formatReport } from './check.js';
export { review } from './review.js';
export { startServer, expandIncludes, injectRuntime } from './server.js';
export { findChrome, installChrome, ensureChrome, FramePage } from './browser.js';
import { openComposition } from './render.js';

/**
 * Load a composition and return its timeline: size, fps, duration, clips, media, issues.
 * @param {import('./types/api.js').Input} input
 * @param {import('./types/api.js').OpenOptions} [opts]
 * @returns {Promise<import('./types/api.js').InspectResult>}
 */
export async function inspect(input, opts = {}) {
  const ctx = await openComposition(input, { ...opts, mode: 'render' });
  try {
    const info = ctx.info;
    return { ...info, file: ctx.file, pageErrors: ctx.page.errors };
  } finally {
    await ctx.page.close();
    await ctx.server.close();
  }
}

/**
 * Render one frame at time t (seconds) and return a PNG/JPEG Buffer.
 * @param {import('./types/api.js').Input} input
 * @param {number} [t]
 * @param {import('./types/api.js').StillOptions} [opts]
 * @returns {Promise<Buffer>}
 */
export async function still(input, t = 0, opts = {}) {
  const { stills } = await import('./render.js');
  const r = await stills(input, [t], opts);
  return r.buffers[0];
}
