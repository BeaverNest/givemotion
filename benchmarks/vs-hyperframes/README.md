# givemotion vs HyperFrames: same animation, same machine

Both tools render HTML in headless Chrome and encode with FFmpeg. To compare only the renderers, this benchmark uses **one GSAP timeline** in both (only the one line that hands the timeline to the renderer differs).

Content: 10 s, 1920×1080, 30 fps, 300 frames. Three drifting gradient blobs (so every frame changes), staggered title, growing bar chart, sliding cards.

## Result (October 2026)

Machine: cloud VM, 2 vCPU (Xeon 2.8 GHz), 7.8 GB RAM, **no GPU** (SwiftShader). Same Chromium 153 headless shell for both. FFmpeg 6.1.1. Wall-clock time of the whole command, average of 2 runs.

| Renderer & settings | Time | Speed |
|---|---|---|
| givemotion 0.1.0, defaults (CRF 18) | 22.6 s | 13.3 fps |
| givemotion 0.1.0, `--crf 16` | 22.2 s | 13.5 fps |
| HyperFrames 0.8.188, defaults (CRF 16, `--no-low-memory-mode`) | 40.0 s | 7.5 fps |
| HyperFrames 0.8.188, `--workers 2` | 36.8 s | 8.2 fps |
| HyperFrames 0.8.188, `--quality draft` | 29.4 s | 10.2 fps |

At the same encoder quality (CRF 16), givemotion was **1.66–1.8× faster** here. Output frames match visually.

Limits of this test: one small Linux VM without a GPU. HyperFrames has a GPU fast-capture path on macOS that this machine cannot use, and both tools scale with more cores. Please run it on your own machine:

```bash
cd benchmarks/vs-hyperframes
npm i gsap@3 hyperframes
python3 make.py
time npx givemotion render gm/index.html -o gm.mp4 --crf 16
time npx hyperframes render hf -o hf.mp4
```
