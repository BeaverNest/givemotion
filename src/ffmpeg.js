// FFmpeg helpers: detection, encoder settings, segment writers, concat and audio mixing.
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir, release as osRelease } from 'node:os';
import { atExit } from './machine.js';

let cachedPath = null;
export function ffmpegPath() {
  if (cachedPath) return cachedPath;
  cachedPath = process.env.GIVEMOTION_FFMPEG || process.env.FFMPEG_PATH || 'ffmpeg';
  return cachedPath;
}
export function ffprobePath() {
  if (process.env.GIVEMOTION_FFPROBE || process.env.FFPROBE_PATH) return process.env.GIVEMOTION_FFPROBE || process.env.FFPROBE_PATH;
  const f = ffmpegPath();
  return f === 'ffmpeg' ? 'ffprobe' : f.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1');
}

export function ffmpegInfo() {
  const r = spawnSync(ffmpegPath(), ['-hide_banner', '-version'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  const version = (r.stdout.split('\n')[0] || '').replace(/^ffmpeg version\s*/, '').split(' ')[0];
  const enc = spawnSync(ffmpegPath(), ['-hide_banner', '-encoders'], { encoding: 'utf8' }).stdout || '';
  const has = (n) => new RegExp(`\\s${n}\\s`).test(enc);
  return {
    version,
    encoders: {
      libx264: has('libx264'), libx265: has('libx265'), h264_videotoolbox: has('h264_videotoolbox'), hevc_videotoolbox: has('hevc_videotoolbox'),
      h264_nvenc: has('h264_nvenc'), libvpx_vp9: has('libvpx-vp9'), prores_ks: has('prores_ks'), libopus: has('libopus'), aac: has('aac'), libsvtav1: has('libsvtav1'),
    },
  };
}

export function requireFfmpeg() {
  const info = ffmpegInfo();
  if (!info) throw new Error('ffmpeg was not found. Install it (macOS: `brew install ffmpeg`, Ubuntu: `sudo apt install ffmpeg`, Windows: `winget install ffmpeg`) or set GIVEMOTION_FFMPEG to its path.');
  return info;
}

export function probe(file) {
  const r = spawnSync(ffprobePath(), ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], { encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  try {
    const j = JSON.parse(r.stdout);
    const v = j.streams.find((s) => s.codec_type === 'video');
    return {
      duration: parseFloat(j.format.duration) || (v && parseFloat(v.duration)) || 0,
      hasAudio: j.streams.some((s) => s.codec_type === 'audio'),
      hasVideo: !!v,
      width: v ? v.width : 0, height: v ? v.height : 0,
    };
  } catch { return null; }
}

const QUALITY = {
  draft: { crf: 28, preset: 'ultrafast', vp9crf: 40, jpeg: 80 },
  standard: { crf: 18, preset: 'veryfast', vp9crf: 31, jpeg: 92 },
  high: { crf: 14, preset: 'medium', vp9crf: 24, jpeg: 97 },
  max: { crf: 10, preset: 'slow', vp9crf: 15, jpeg: 100 },
};
export function qualitySettings(q = 'standard') { return QUALITY[q] || QUALITY.standard; }

/**
 * Describe how frames are encoded for a given output format.
 * Returns { segExt, finalExt, vargs(fpsOut) , alpha, needsFinalTranscode }
 * @param {{ format: string, quality?: string, crf?: number, codec?: string, transparent?: boolean, info: any, hardware?: boolean | 'auto' }} o
 */
export function encoderPlan({ format, quality = 'standard', crf, codec, transparent, info, hardware }) {
  const q = qualitySettings(quality);
  // Chrome draws sRGB: BT.709 primaries and matrix, but the sRGB transfer curve. Tagging the video with BT.709's own
  // transfer made colour-managed players (QuickTime, browsers) show the dark tones 10+ levels off.
  const colorTags = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-color_range', 'tv'];
  // Frames arrive as sRGB images. Convert through RGB to BT.709 limited range (what players expect).
  // The accurate swscale flags cost ~3x encode time, so only the high/max presets use them.
  const precise = quality === 'high' || quality === 'max' ? ':flags=accurate_rnd+full_chroma_int' : '';
  // The tags are also set on the frames: a frame's own properties win over the encoder flags, and frames from a JPEG
  // pipe carry none (the video came out with no primaries and no transfer tag at all, unlike one made from PNG frames).
  // Software encoders get a fixed number of threads. Left to choose, x264 took 1.5 per core (67 threads in each ffmpeg
  // on 12 cores) for every part being encoded, while a render already runs one encoder per worker: no faster (8 workers:
  // 9.8 s either way), ~150 MB more per encoder. Fixed, not from the worker count: the thread count changes the bytes.
  const threads = ['-threads', '4'];
  const toYuv = (pix) => ['-vf', `format=rgb24,scale=out_color_matrix=bt709:out_range=tv${precise},format=${pix},setparams=colorspace=bt709:color_primaries=bt709:color_trc=iec61966-2-1:range=tv`];
  if (format === 'mp4' || format === 'mkv') {
    if (transparent) throw new Error('MP4 cannot hold transparency. Use --format mov (ProRes 4444) or --format webm (VP9 alpha).');
    const c = codec || 'h264';
    if (c === 'h265' || c === 'hevc') {
      if (hardware && info.encoders.hevc_videotoolbox) return { segExt: format, vf: toYuv('yuv420p'), vargs: ['-c:v', 'hevc_videotoolbox', '-q:v', String(Math.max(40, 80 - (crf ?? q.crf))), '-tag:v', 'hvc1', '-pix_fmt', 'yuv420p', ...colorTags] };
      if (!info.encoders.libx265) throw new Error('Your ffmpeg has no libx265 encoder. Use --codec h264.');
      return { segExt: format, vf: toYuv('yuv420p'), vargs: ['-c:v', 'libx265', '-preset', q.preset, '-crf', String((crf ?? q.crf) + 4), '-x265-params', 'pools=4', '-tag:v', 'hvc1', '-pix_fmt', 'yuv420p', ...colorTags] };
    }
    if (c === 'av1') {
      if (!info.encoders.libsvtav1) throw new Error('Your ffmpeg has no libsvtav1 encoder.');
      return { segExt: format, vf: toYuv('yuv420p'), vargs: ['-c:v', 'libsvtav1', '-preset', '8', '-crf', String((crf ?? q.crf) + 12), ...threads, '-pix_fmt', 'yuv420p', ...colorTags] };
    }
    if (hardware && info.encoders.h264_videotoolbox) return { segExt: format, vf: toYuv('yuv420p'), vargs: ['-c:v', 'h264_videotoolbox', '-q:v', String(Math.max(40, 85 - (crf ?? q.crf))), '-pix_fmt', 'yuv420p', ...colorTags] };
    if (hardware && info.encoders.h264_nvenc) return { segExt: format, vf: toYuv('yuv420p'), vargs: ['-c:v', 'h264_nvenc', '-preset', 'p5', '-cq', String(crf ?? q.crf + 2), '-pix_fmt', 'yuv420p', ...colorTags] };
    if (!info.encoders.libx264) throw new Error('Your ffmpeg has no libx264 encoder. Install a full ffmpeg build.');
    return { segExt: format, vf: toYuv('yuv420p'), vargs: ['-c:v', 'libx264', '-preset', q.preset, '-crf', String(crf ?? q.crf), ...threads, '-pix_fmt', 'yuv420p', '-profile:v', 'high', ...colorTags] };
  }
  if (format === 'webm') {
    if (!info.encoders.libvpx_vp9) throw new Error('Your ffmpeg has no libvpx-vp9 encoder.');
    const pix = transparent ? 'yuva420p' : 'yuv420p';
    return {
      segExt: 'webm', alpha: !!transparent,
      vf: transparent ? ['-vf', 'format=yuva420p'] : toYuv(pix),
      vargs: ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(crf ?? q.vp9crf), '-row-mt', '1', ...threads, '-deadline', 'good', '-cpu-used', quality === 'draft' ? '8' : '4', '-pix_fmt', pix, ...(transparent ? ['-auto-alt-ref', '0'] : colorTags)],
    };
  }
  if (format === 'mov') {
    if (!info.encoders.prores_ks) throw new Error('Your ffmpeg has no prores_ks encoder.');
    return transparent
      ? { segExt: 'mov', alpha: true, vf: ['-vf', 'format=yuva444p10le'], vargs: ['-c:v', 'prores_ks', '-profile:v', '4', ...threads, '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', '-vendor', 'apl0'] }
      : { segExt: 'mov', vf: toYuv('yuv422p10le'), vargs: ['-c:v', 'prores_ks', '-profile:v', '3', ...threads, '-pix_fmt', 'yuv422p10le', '-vendor', 'apl0', ...colorTags] };
  }
  if (format === 'gif') {
    // Segments are lossless; the GIF is made in one pass at the end for a shared palette.
    return { segExt: 'mkv', needsFinalTranscode: true, vf: [], vargs: ['-c:v', 'ffv1', '-level', '3', ...threads, '-pix_fmt', transparent ? 'bgra' : 'bgr0'] };
  }
  throw new Error(`Unknown format "${format}". Use mp4, webm, mov, gif, png (frames) or mkv.`);
}

/**
 * Open an ffmpeg process that reads images from stdin and writes a segment.
 * opts: { fps, inputCodec: 'mjpeg'|'png', out, plan, motionBlur: {samples}, width, height }
 */
export function openSegmentWriter({ fps, inputCodec, out, plan, motionBlur }) {
  const samples = motionBlur ? motionBlur.samples : 1;
  const inFps = fps * samples;
  const filters = [];
  if (samples > 1) filters.push(`tmix=frames=${samples}`, `select='eq(mod(n\\,${samples})\\,${samples - 1})'`, `setpts=N/(${fps}*TB)`);
  const vf = plan.vf || [];
  let vfStr = vf[1] || '';
  if (filters.length) vfStr = filters.join(',') + (vfStr ? ',' + vfStr : '');
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(inFps), '-c:v', inputCodec, '-i', '-',
    ...(vfStr ? ['-vf', vfStr] : []), '-r', String(fps), ...plan.vargs, '-an', out];
  const proc = spawn(ffmpegPath(), args, { stdio: ['pipe', 'ignore', 'pipe'] });
  // a render that is stopped does not leave its encoders finishing parts nobody will use
  const unhook = atExit(() => { try { proc.kill('SIGKILL'); } catch {} });
  let err = '';
  proc.stderr.on('data', (d) => { err += d; });
  const done = new Promise((resolve, reject) => {
    proc.on('exit', () => unhook());
    proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed (${code}): ${err.trim().split('\n').slice(-3).join(' ')}`))));
    proc.on('error', reject);
  });
  proc.stdin.on('error', () => {});
  // Frames are queued so capturing the next frame overlaps with encoding this one.
  // Back-pressure kicks in when ~16 MB are waiting (dozens of JPEG frames, a few 4K PNGs): a worker has up to three
  // encoders going, and a render up to 16 workers.
  const HIGH = 16 * 1024 * 1024;
  return {
    async write(buf) {
      proc.stdin.write(buf);
      if (proc.stdin.writableLength > HIGH) await new Promise((r) => proc.stdin.once('drain', r));
    },
    async end() { proc.stdin.end(); await done; },
    kill() { try { proc.kill('SIGKILL'); } catch {} },
    done,
  };
}

/** Length of the first complete JPEG (SOI..EOI) or PNG (signature..IEND) image at the start of buf, or 0 if incomplete. */
export function imageLength(buf, png) {
  if (png) {
    let off = 8;
    while (off + 12 <= buf.length) {
      const len = buf.readUInt32BE(off);
      const type = buf.toString('latin1', off + 4, off + 8);
      off += 12 + len;
      if (type === 'IEND') return off <= buf.length ? off : 0;
    }
    return 0;
  }
  let off = 2;
  while (off + 2 <= buf.length) {
    if (buf[off] !== 0xff) return 0; // not a marker where one must be: wait for more (never happens with ffmpeg output)
    const m = buf[off + 1];
    if (m === 0xd9) return off + 2;
    if (m === 0xff) { off++; continue; }
    if ((m >= 0xd0 && m <= 0xd7) || m === 0x01) { off += 2; continue; }
    if (off + 4 > buf.length) return 0;
    off += 2 + buf.readUInt16BE(off + 2);
    if (m === 0xda) {
      // entropy-coded data: the next 0xFF not followed by 0x00 or a restart marker is the next marker
      while (off + 1 < buf.length && !(buf[off] === 0xff && buf[off + 1] !== 0 && !(buf[off + 1] >= 0xd0 && buf[off + 1] <= 0xd7))) off++;
      if (off + 1 >= buf.length) return 0;
    }
  }
  return 0;
}

export function run(args, { quiet = true } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath(), ['-hide_banner', '-loglevel', quiet ? 'error' : 'info', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${err.trim().split('\n').slice(-4).join(' ')}`))));
    p.on('error', reject);
  });
}

/**
 * Join segments and mix audio into the final file.
 * audio: [{file, start, end, from, rate, loop, volume, fadeIn, fadeOut}]
 */
function volumeExpr(keys, scale = 1) {
  // piecewise linear, as a flat sum (no deep nesting); commas escaped for the filter graph
  const f = (x) => (+x).toFixed(4);
  const parts = [];
  parts.push(`lt(t\\,${f(keys[0][0])})*${f(keys[0][1] * scale)}`);
  for (let i = 1; i < keys.length; i++) {
    const [a, va] = keys[i - 1], [b, vb] = keys[i];
    if (b <= a) continue;
    parts.push(`gte(t\\,${f(a)})*lt(t\\,${f(b)})*(${f(va * scale)}+(t-${f(a)})*${f(((vb - va) * scale) / (b - a))})`);
  }
  parts.push(`gte(t\\,${f(keys[keys.length - 1][0])})*${f(keys[keys.length - 1][1] * scale)}`);
  return `volume='${parts.join('+')}':eval=frame`;
}

/**
 * Two loud tracks (a voice and music) add up past full scale and would hard-clip (crackle). A peak limiter keeps the
 * sum under 0.966 and leaves everything quieter bit-exact. Its look-ahead delays the sound by 239 samples, so the
 * mix is padded by that much first and the delay is cut off after it: same length, same timing.
 */
const PEAK_LIMIT = 'apad=pad_len=240,alimiter=limit=0.966:attack=5:release=50:level=disabled,atrim=start_sample=239,asetpts=PTS-STARTPTS';

/** Build per-input audio filter chains. Inputs start at index `first`. */
function audioChains(audio, args, first) {
  const filters = [], labels = [];
  audio.forEach((a, i) => {
    const idx = i + first;
    if (a.loop) args.push('-stream_loop', '-1');
    if (a.from > 0) args.push('-ss', String(a.from));
    args.push('-i', a.file);
    const len = Math.max(0, a.end - a.start);
    const chain = [];
    if (a.rate && a.rate !== 1) {
      let r = a.rate;
      while (r > 2) { chain.push('atempo=2'); r /= 2; }
      while (r < 0.5) { chain.push('atempo=0.5'); r /= 0.5; }
      chain.push(`atempo=${r.toFixed(5)}`);
    }
    chain.push(`atrim=0:${len.toFixed(4)}`, 'asetpts=PTS-STARTPTS');
    if (a.volumeKeys && a.volumeKeys.length) chain.push(volumeExpr(a.volumeKeys, a.volume ?? 1));
    else if (a.volume != null && a.volume !== 1) chain.push(`volume=${a.volume}`);
    if (a.fadeIn > 0) chain.push(`afade=t=in:st=0:d=${a.fadeIn}`);
    if (a.fadeOut > 0) chain.push(`afade=t=out:st=${Math.max(0, len - a.fadeOut).toFixed(4)}:d=${a.fadeOut}`);
    chain.push('aresample=48000', 'aformat=channel_layouts=stereo');
    const ms = Math.round(a.start * 1000);
    if (ms > 0) chain.push(`adelay=${ms}:all=1`);
    filters.push(`[${idx}:a]${chain.join(',')}[a${i}]`);
    labels.push(`[a${i}]`);
  });
  return { filters, labels };
}

export async function mixAudio({ audio, out, format, duration }) {
  const args = [];
  const { filters, labels } = audioChains(audio, args, 0);
  const bed = audio.length;
  args.push('-f', 'lavfi', '-t', duration.toFixed(4), '-i', 'anullsrc=r=48000:cl=stereo');
  filters.push(`[${bed}:a]asetpts=PTS-STARTPTS[bed]`);
  filters.push(`[bed]${labels.join('')}amix=inputs=${labels.length + 1}:normalize=0:duration=first:dropout_transition=0,${PEAK_LIMIT},atrim=0:${duration.toFixed(4)}[aout]`);
  args.push('-filter_complex', filters.join(';'), '-map', '[aout]');
  const codec = { mp3: ['-c:a', 'libmp3lame', '-q:a', '2'], wav: ['-c:a', 'pcm_s16le'], m4a: ['-c:a', 'aac', '-b:a', '192k'], ogg: ['-c:a', 'libopus', '-b:a', '160k'], flac: ['-c:a', 'flac'] }[format] || [];
  args.push(...codec, out);
  return run(args);
}

export async function finalize({ segments, listFile, out, format, duration, audio = [], fps, plan, transparent }) {
  writeFileSync(listFile, segments.map((s) => `file '${s.replace(/'/g, "'\\''")}'`).join('\n'));
  const args = ['-f', 'concat', '-safe', '0', '-i', listFile];
  const { filters, labels } = audioChains(audio, args, 1);
  if (format === 'gif') {
    const gifArgs = [...args, '-filter_complex', `[0:v]split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=full${transparent ? ':reserve_transparent=1' : ''}[p];[s1][p]paletteuse=dither=sierra2_4a${transparent ? ':alpha_threshold=128' : ''}`, '-loop', '0', out];
    return run(gifArgs);
  }
  if (labels.length) {
    // A silent bed as long as the video keeps the mix aligned to t=0 and the right length.
    const bed = audio.length + 1;
    args.push('-f', 'lavfi', '-t', duration.toFixed(4), '-i', 'anullsrc=r=48000:cl=stereo');
    filters.push(`[${bed}:a]asetpts=PTS-STARTPTS[bed]`);
    filters.push(`[bed]${labels.join('')}amix=inputs=${labels.length + 1}:normalize=0:duration=first:dropout_transition=0,${PEAK_LIMIT},atrim=0:${duration.toFixed(4)}[aout]`);
    args.push('-filter_complex', filters.join(';'), '-map', '0:v', '-map', '[aout]');
    args.push('-c:v', 'copy');
    if (format === 'webm') args.push('-c:a', 'libopus', '-b:a', '160k');
    else if (format === 'mov') args.push('-c:a', 'pcm_s16le');
    else args.push('-c:a', 'aac', '-b:a', '192k');
  } else {
    args.push('-map', '0:v', '-c:v', 'copy');
  }
  if (format === 'mp4' || format === 'mov') args.push('-movflags', '+faststart');
  args.push(out);
  return run(args);
}

/**
 * Should this render use the GPU video encoder? `hardware: true/false` decides; left unset ("auto") it is used on macOS
 * (VideoToolbox) for H.264/HEVC MP4 and MKV, unless the output is transparent or --quality max. Returns true, false or
 * 'auto' (use it if encoderIsReproducible() says so).
 * @param {{ hardware?: boolean | 'auto', format: string, transparent?: boolean, quality?: string, codec?: string, info: any, platform?: NodeJS.Platform }} o
 * @returns {boolean | 'auto'}
 */
export function wantsHardware({ hardware, format, transparent, quality, codec, info, platform = process.platform }) {
  if (hardware === true || hardware === false) return hardware;
  if (platform !== 'darwin' || transparent || quality === 'max' || !info || !(format === 'mp4' || format === 'mkv')) return false;
  const c = codec || 'h264';
  const enc = c === 'h264' ? 'h264_videotoolbox' : c === 'h265' || c === 'hevc' ? 'hevc_videotoolbox' : null;
  return enc && info.encoders[enc] ? 'auto' : false;
}

/**
 * Does this encoder give the same bytes for the same frames on this machine? Renders must be reproducible (and a
 * re-render patches parts into an earlier video byte for byte), so a hardware encoder is only used after it encodes a
 * short test clip twice, in two processes, identically. The answer is kept per ffmpeg version, OS release and settings.
 * @param {{ segExt: string, vf: string[], vargs: string[] }} plan
 * @param {{ version: string }} info
 * @param {{ cacheFile?: string, tmp?: string }} [opts]
 * @returns {boolean}
 */
export function encoderIsReproducible(plan, info, { cacheFile, tmp } = {}) {
  const key = [info.version, process.platform, osRelease(), plan.vargs.join(' ')].join('|');
  let cache = {};
  try { if (cacheFile) cache = JSON.parse(readFileSync(cacheFile, 'utf8')); } catch {}
  if (key in cache) return cache[key];
  const dir = mkdtempSync(join(tmp || tmpdir(), 'gm-hwcheck-'));
  let ok = false;
  try {
    const enc = (out) => spawnSync(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=2',
      ...plan.vf, ...plan.vargs, '-an', '-y', out], { encoding: 'utf8', timeout: 60000 });
    const a = join(dir, 'a.' + plan.segExt), b = join(dir, 'b.' + plan.segExt);
    const ra = enc(a), rb = enc(b);
    ok = ra.status === 0 && rb.status === 0 && existsSync(a) && existsSync(b) && statSync(a).size > 0 && readFileSync(a).equals(readFileSync(b));
  } catch { ok = false; } finally { rmSync(dir, { recursive: true, force: true }); }
  cache[key] = ok;
  try { if (cacheFile) { mkdirSync(dirname(cacheFile), { recursive: true }); writeFileSync(cacheFile, JSON.stringify(cache, null, 1)); } } catch {}
  return ok;
}
