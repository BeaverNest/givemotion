// Public types of the givemotion API (`import { render, check, ... } from 'givemotion'`).
// The JS source uses these through JSDoc (`@param {import('./types/api.js').RenderOptions} [opts]`), and
// test/types/api.test-types.ts checks that the functions in src/ still match the declarations at the bottom.

/** A composition: an .html file, or a folder with index.html in it. Default: index.html. */
export type Input = string | undefined;

/** Options every command that opens a composition takes. */
export interface OpenOptions {
  /** Data for `{{data.…}}`, `data-bind` and `gm.data` (default: data.json next to the HTML, if any). */
  data?: Record<string, any> | null;
  /** Seed for Math.random and every seeded effect (default 1). */
  seed?: number;
  /** Override the composition's frames per second, width or height. */
  fps?: number;
  width?: number;
  height?: number;
  /** Render at n times the layout size: 2 gives 4K from a 1080p layout, "4/3" gives 1440p. */
  scale?: number | string;
  /** Path to a Chrome or chrome-headless-shell binary (default: the one `givemotion install` downloaded). */
  chrome?: string;
  /** How frames are taken from Chrome (default auto: beginFrame on Linux/Windows headless shell, else screenshots). */
  capture?: 'auto' | 'beginframe' | 'screenshot';
  /** Chrome's GL backend (default auto). */
  gl?: 'auto' | 'gpu' | 'swiftshader' | string;
  /** Keep transparency (no page background). */
  transparent?: boolean;
  /** How long one page call may take before it fails, in ms (default 60000). */
  timeoutMs?: number;
  /** Print Chrome's console to stderr. */
  verbose?: boolean;
  /** Called with each console message of the page. */
  onConsole?: (type: string, text: string) => void;
  /** Where log lines go (default stderr). */
  log?: (line: string) => void;
}

/** One timed element of a composition (a scene, a clip, an element with its own timing). */
export interface Clip {
  selector: string;
  start: number;
  end: number;
  /** A top-level scene (class "scene", or a child of a data-sequence). */
  scene: boolean;
}

export interface Transition { start: number; end: number; [key: string]: any }
export interface CameraShot { start: number; arrive: number; next: number | null; [key: string]: any }
export interface Media { kind: 'video' | 'audio'; src: string; start: number; end: number; [key: string]: any }

/** A problem found in a composition. */
export interface Issue {
  severity: 'error' | 'warning' | 'info';
  /** Stable code, documented in skills/givemotion/references/check-codes.md (e.g. "text-offscreen"). */
  code: string;
  message: string;
  /** CSS selector of the element, when there is one. */
  selector?: string | null;
  /** How to fix it. */
  fix?: string | null;
  /** First time (seconds) it was seen. */
  time?: number | null;
  /** Last time it was seen, when it lasts. */
  until?: number;
  /** Every stretch of time it was seen, as [from, to] in seconds. */
  ranges?: [number, number][];
  [key: string]: any;
}

/** An error the page threw or logged while it ran. */
export interface PageError { code: string; message: string; [key: string]: any }

/** The timeline of a composition, as the runtime sees it after loading. */
export interface CompositionInfo {
  width: number;
  height: number;
  fps: number;
  duration: number;
  frames: number;
  background: string;
  clips: Clip[];
  transitions: Transition[];
  cameraShots: CameraShot[];
  media: Media[];
  usesRAF: boolean;
  frameCallbacks: number;
  issues: Issue[];
}

/** The short summary of a composition that check and snapshot return. */
export interface InfoSummary {
  width: number;
  height: number;
  fps: number;
  duration: number;
  frames: number;
  /** How many timed elements. */
  clips: number;
  /** How many audio and video elements. */
  media: number;
}

export interface RenderProgress {
  phase: 'open' | 'frames' | 'encode' | 'done';
  done?: number;
  total?: number;
  fps?: number;
  eta?: number | null;
  frames?: number;
  reusedParts?: number;
  output?: string;
  seconds?: number;
}

export interface RenderOptions extends OpenOptions {
  /** Output file; the format comes from the extension (.mp4 .webm .mov .gif .mp3 .wav, or a folder for PNG frames). Default out.mp4. */
  output?: string;
  /** Force a format instead of reading the extension. */
  format?: 'mp4' | 'webm' | 'mov' | 'mkv' | 'gif' | 'png';
  quality?: 'draft' | 'standard' | 'high' | 'max';
  /** Encoder quality override (lower is better). */
  crf?: number;
  /** Video codec for MP4 (default h264). */
  codec?: 'h264' | 'h265' | 'hevc' | 'av1';
  /** Use the GPU video encoder (NVENC/VideoToolbox). Default: on for a Mac once it encodes reproducibly. */
  hardware?: boolean | 'auto';
  /** Lossless PNG capture even at lower qualities. */
  lossless?: boolean;
  /** Parallel browsers (default: from CPU count and memory). */
  workers?: number;
  /** Only part of the video: "0-90" (frames) or "2s-5s". */
  frames?: string;
  /** Re-render this part ("4s-7s") even if it looks unchanged; keep the rest. */
  redo?: string;
  /** false: do not keep or reuse parts (by default only changed parts are rendered again). */
  cache?: boolean;
  /** Keep the parts in <cacheDir>/<output name>/ instead of .gm-parts/ next to the output. */
  cacheDir?: string;
  /** Name of the parts' folder, instead of the output's file name: renders to render-v1.mov, render-v2.mov, … share the parts. */
  cacheKey?: string;
  /** Do not reuse a captured frame for frames that look unchanged. */
  noReuse?: boolean;
  /** No audio track. */
  muted?: boolean;
  /** "auto" (default in natural motion: a smear on what moves fast), "off", or sub-frames per frame (e.g. 8). */
  motionBlur?: 'off' | 'auto' | number | string;
  /** Motion blur shutter, 0-1 (default 0.5). */
  shutter?: number;
  /** Render even if the composition has errors. */
  force?: boolean;
  /** No log lines. */
  quiet?: boolean;
  /** Where temporary files go (default the OS temp folder). */
  tmpdir?: string;
  onProgress?: (progress: RenderProgress) => void;
}

/** What render returns for a video, GIF or PNG frames. */
export interface VideoRenderResult {
  output: string;
  format: string;
  width: number;
  height: number;
  fps: number;
  frames: number;
  duration: number;
  /** Wall time of the render. */
  seconds: number;
  renderFps: number;
  /** Frames that looked the same as the one before and were not captured again. */
  reusedFrames: number;
  workers: number;
  capture: string;
  encoder: string;
  motionBlur: { mode: string; frames?: number; blurred?: number; elements?: number; samples?: number };
  /** The parts cache: how many 1-2 s parts were reused and how many rendered. null when the cache is off. */
  parts: { total: number; reused: number; rendered: number; folder: string; late: number; lateOff: any } | null;
  bytes: number | null;
  warnings: Issue[];
  pageErrors: PageError[];
}

/** What render returns when the output is only the soundtrack (.mp3, .wav, ...). */
export interface AudioRenderResult {
  output: string;
  format: string;
  duration: number;
  seconds: number;
  bytes: number;
  warnings: Issue[];
  pageErrors: PageError[];
}

export type RenderResult = VideoRenderResult | AudioRenderResult;

export interface CheckOptions extends OpenOptions {
  /** Check one moment only (seconds): fast, after a fix. */
  at?: number | string;
  /** Check part of the video (seconds). */
  from?: number | string;
  to?: number | string;
  /** Fewer samples: quicker, may miss short problems. */
  fast?: boolean;
  /** Samples for the contrast check. */
  contrastSamples?: number;
  /** Where an app covers vertical video: "shorts" | "reels" | "tiktok", or "top,right,bottom,left" in px. */
  safeZone?: string;
  /** false: skip the pacing checks (still stretches, dead end card, ...). */
  pacing?: boolean;
  /** false: skip the motion checks and the motion strip. */
  motion?: boolean;
  /**
   * Browsers for the pass over the video (default: what the computer can spare, shared with other givemotion
   * processes, up to 8; a long video only). The report is the same for any number; 1 = one browser.
   */
  workers?: number;
}

/** Motion strip data: how much of the picture changes, one value per `every` seconds from `from`. */
export interface MotionStrip { every: number; from: number; values: number[] }

export interface CheckReport {
  /** No errors (warnings and notes are allowed). */
  ok: boolean;
  errors: number;
  warnings: number;
  notes: number;
  issues: Issue[];
  info: InfoSummary;
  motion: MotionStrip | null;
  /** `gm.log()` lines from the page, grouped. */
  logs: { time: number; until: number; count: number; msg: string }[];
}

export interface SnapshotOptions extends OpenOptions {
  /** Folder to write to (default snapshots/ next to the HTML). */
  output?: string;
  /** Exact moments instead of automatic ones: "1,2.5,4" (seconds, or frames like "45f"). */
  times?: string;
  /** One frame every N seconds ("0.5", or "1f" for every frame). */
  every?: string | number;
  /** Only this part. */
  from?: string | number;
  to?: string | number;
  /** Start, middle and end of every scene transition. */
  transitions?: boolean;
  /** Max automatic moments (default 12). */
  max?: number;
  /** Only write sheet.png. */
  sheetOnly?: boolean;
  /** Columns in the sheet. */
  cols?: number;
  /** Draw thirds, the center and the safe zone over the pictures. */
  grid?: boolean;
  safeZone?: string;
  onProgress?: (done: number, total: number) => void;
}

export interface SnapshotResult {
  /** The contact sheet image. */
  sheet: string;
  /** One PNG per moment (empty with sheetOnly). */
  files: string[];
  times: number[];
  info: InfoSummary;
  errors: PageError[];
  /** Composition errors and page errors together. */
  problems: (Issue | PageError)[];
}

export interface StillOptions extends OpenOptions {
  format?: 'png' | 'jpeg';
}

export interface InspectResult extends CompositionInfo {
  file: string;
  pageErrors: PageError[];
}

export interface ChromeInfo { path: string; kind: string }

export interface Server {
  port: number;
  origin: string;
  /** URL of a file under the server root. */
  url(path: string): string;
  close(): Promise<void>;
}

export interface ServerOptions {
  /** Folder to serve (the project root). */
  root: string;
  maxW?: number;
  maxH?: number;
  /** Serve the preview studio too (givemotion dev). */
  studio?: boolean;
  inlineConfig?: Record<string, any>;
  port?: number;
  host?: string;
  data?: Record<string, any> | null;
}

/** A headless Chrome page that renders a composition frame by frame. */
export declare class FramePage {
  constructor(opts: { chrome: ChromeInfo; width: number; height: number; scale?: number; capture?: string; gl?: string; transparent?: boolean; timeoutMs?: number; verbose?: boolean; onConsole?: (type: string, text: string) => void });
  opts: Record<string, any>;
  mode: string;
  errors: PageError[];
  start(): Promise<void>;
  open(url: string, config: Record<string, any>): Promise<CompositionInfo>;
  evaluate(expression: string, opts?: { timeoutMs?: number }): Promise<any>;
  setViewport(width: number, height: number): Promise<void>;
  seek(t: number): Promise<any>;
  capture(format?: 'png' | 'jpeg', quality?: number): Promise<Buffer>;
  /** Drop what Chrome kept from earlier paints, so the next capture draws everything fresh. */
  /** Drop the paint state of earlier frames (only: just the layers holding animated text). True if anything was reset. */
  resetPaint(only?: boolean): Promise<boolean>;
  close(): Promise<void>;
}

/** An open composition: a Chrome page and the local server behind it. Close both when done. */
export interface Composition {
  page: FramePage;
  info: CompositionInfo;
  server: Server;
  chrome: ChromeInfo;
  url: string;
  config: Record<string, any>;
  file: string;
  root: string;
  rel: string;
}

/** Render a composition to a video, a GIF, PNG frames or just its soundtrack. */
export declare function render(input: Input, opts?: RenderOptions): Promise<RenderResult>;
/** Render frames at the given times (seconds) and return them as image Buffers. */
export declare function stills(input: Input, times: number[], opts?: StillOptions): Promise<{ buffers: Buffer[]; info: CompositionInfo; errors: PageError[] }>;
/** Render one frame at time t (seconds) and return a PNG (or JPEG) Buffer. */
export declare function still(input: Input, t?: number, opts?: StillOptions): Promise<Buffer>;
/** Find problems: cut-off, covered, unreadable text, broken files, script errors, pacing. */
export declare function check(input: Input, opts?: CheckOptions): Promise<CheckReport>;
/** Render the key moments into PNGs and one contact sheet. */
export declare function snapshot(input: Input, opts?: SnapshotOptions): Promise<SnapshotResult>;
/** The check report as the text the CLI prints. */
export declare function formatReport(report: CheckReport, opts?: { file?: string }): string;
/** Load a composition and return its timeline: size, fps, duration, clips, media, issues. */
export declare function inspect(input: Input, opts?: OpenOptions): Promise<InspectResult>;
/** Open a composition in Chrome (what render, still, check and snapshot use). */
export declare function openComposition(input: Input, opts?: OpenOptions & { mode?: string }): Promise<Composition>;
/** Find the composition file and the project root it is served from. */
export declare function resolveInput(input: Input): { file: string; root: string; rel: string };
export declare function startServer(opts: ServerOptions): Promise<Server>;
/** Expand <gm-include> elements in an HTML string. */
export declare function expandIncludes(html: string, fileDir: string, rootDir: string, depth?: number, seen?: string[]): string;
/** Add the runtime to a composition's HTML. */
export declare function injectRuntime(html: string, opts?: { inlineConfig?: Record<string, any> }): string;
export declare function findChrome(explicit?: string): ChromeInfo | null;
export declare function installChrome(opts?: { log?: (line: string) => void }): Promise<ChromeInfo>;
export declare function ensureChrome(opts?: { chrome?: string; install?: boolean; log?: (line: string) => void }): Promise<ChromeInfo>;
