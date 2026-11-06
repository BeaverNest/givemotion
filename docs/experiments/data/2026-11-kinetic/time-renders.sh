#!/bin/bash
# Re-render each final video with the maker's own command, one at a time; wall time of the timed pass.
T=/home/user/tools4/timing; R=/home/user/tools4
t() { local name=$1; shift; local s=$(date +%s.%N); "$@" > $T/$name.log 2>&1; local e=$(date +%s.%N); echo "$name $(echo "$e - $s" | bc)" >> $T/times.txt; }
: > $T/times.txt
cd $R/hyperframes
t hf-warm npx --yes hyperframes@0.9.15 render --quality delivery --fps 30 -o $T/hf-warm.mp4
t hyperframes npx --yes hyperframes@0.9.15 render --quality delivery --fps 30 -o $T/hf.mp4
cd $R/remotion
t rm-warm npx remotion render Kinetic $T/rm-warm.mp4 --codec=h264 --pixel-format=yuv420p --log=error --bundle-cache=false
t remotion npx remotion render Kinetic $T/rm.mp4 --codec=h264 --pixel-format=yuv420p --log=error --bundle-cache=false
cd $R/givemotion
t givemotion npx givemotion render video.html -o $T/gm.mp4 --no-cache
echo done >> $T/times.txt
