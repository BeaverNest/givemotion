#!/bin/bash
T=/home/user/tools5/timing; R=/home/user/tools5
t() { local name=$1; shift; local s=$(date +%s.%N); "$@" > $T/$name.log 2>&1; local rc=$?; local e=$(date +%s.%N); echo "$name $(echo "$e - $s" | bc) rc=$rc" >> $T/times-r3.txt; }
: > $T/times-r3.txt
cd $R/c/hyperframes && t hf-warm npx --yes hyperframes@0.9.18 render --output $T/w.mp4 --fps 30 --quality delivery
cd $R/c/hyperframes && t c-hyperframes npx --yes hyperframes@0.9.18 render --output $T/c-hf.mp4 --fps 30 --quality delivery
cd $R/d/hyperframes && t d-hyperframes npx --yes hyperframes@0.9.18 render --quality delivery --fps 30 --output $T/d-hf.mp4
cd $R/c/remotion && t rm-warm npx remotion render CleanerWake $T/w.mp4 --muted --bundle-cache=false
cd $R/c/remotion && t c-remotion npx remotion render CleanerWake $T/c-rm.mp4 --muted --bundle-cache=false
cd $R/d/remotion && t d-remotion npx remotion render RoofcombManifesto $T/d-rm.mp4 --bundle-cache=false
cd $R/c/givemotion && t gm-warm npx givemotion render video.html -o $T/w.mp4 --no-cache
cd $R/c/givemotion && t c-givemotion npx givemotion render video.html -o $T/c-gm.mp4 --no-cache
cd $R/d/givemotion && t d-givemotion npx givemotion render video.html -o $T/d-gm.mp4 --quality high --no-cache
echo done >> $T/times-r3.txt
