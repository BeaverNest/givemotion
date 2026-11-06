# Builds the same GSAP animation as a givemotion and a HyperFrames composition.
# GSAP is not bundled: run `npm i gsap@3` here first (see README.md).
import os, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
gsap = os.path.join(HERE, 'node_modules', 'gsap', 'dist', 'gsap.min.js')
import sys
sys.path.insert(0, os.path.dirname(HERE))
from scene import body, css, tl
for d in ('gm', 'hf'):
    os.makedirs(os.path.join(HERE, d), exist_ok=True)
    shutil.copy(gsap, os.path.join(HERE, d, 'gsap.min.js'))
open(os.path.join(HERE, 'gm', 'index.html'), 'w').write(f'''<!doctype html><html data-width="1920" data-height="1080" data-fps="30" data-duration="10"><head><meta charset="utf-8"><script src="gsap.min.js"></script><style>{css}</style></head><body>{body}<script>{tl}
gm.onFrame(t => tl.seek(t));</script></body></html>''')
open(os.path.join(HERE, 'hf', 'index.html'), 'w').write(f'''<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=1920, height=1080"><script src="gsap.min.js"></script><style>{css}
#root{{position:absolute;inset:0}}</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-duration="10" data-width="1920" data-height="1080">
<div class="clip" data-start="0" data-duration="10" data-track-index="0" style="position:absolute;inset:0">{body}</div></div>
<script>{tl}
window.__timelines = window.__timelines || {{}}; window.__timelines["main"] = tl; tl.seek(0);</script></body></html>''')
print('wrote gm/index.html and hf/index.html')
