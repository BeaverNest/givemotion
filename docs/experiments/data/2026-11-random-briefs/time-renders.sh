#!/bin/bash
# Re-render each final video with its maker's own command, one at a time; one untimed warm-up per tool first.
T=/home/user/tools5/timing; R=/home/user/tools5
t() { local name=$1; shift; local s=$(date +%s.%N); "$@" > $T/$name.log 2>&1; local rc=$?; local e=$(date +%s.%N); echo "$name $(echo "$e - $s" | bc) rc=$rc" >> $T/times.txt; }
: > $T/times.txt
cd $R/b/hyperframes && t hf-warm npx --yes hyperframes@0.9.17 render --quality delivery --fps 30 -o $T/warm-hf.mp4
for id in a b; do cd $R/$id/hyperframes && t $id-hyperframes npx --yes hyperframes@0.9.17 render --quality delivery --fps 30 -o $T/$id-hf.mp4; done
cd $R/b/remotion && t rm-warm npx remotion render Pocketfold $T/warm-rm.mp4 --muted --bundle-cache=false
cd $R/a/remotion && t a-remotion npx remotion render CityHive $T/a-rm.mp4 --muted --bundle-cache=false
cd $R/b/remotion && t b-remotion npx remotion render Pocketfold $T/b-rm.mp4 --muted --bundle-cache=false
# givemotion: the frozen engine the makers used (a needed --workers 1: its 4-worker render failed), then today's engine
cd $R/b/givemotion && t gm-warm npx givemotion render video.html -o $T/warm-gm.mp4 --no-cache
cd $R/a/givemotion && t a-givemotion npx givemotion render video.html -o $T/a-gm.mp4 --no-cache --workers 1
cd $R/b/givemotion && t b-givemotion npx givemotion render video.html -o $T/b-gm.mp4 --no-cache
cd $R/a/givemotion && t a-givemotion-now node /home/user/givemotion/src/cli.js render video.html -o $T/a-gm-now.mp4 --no-cache
cd $R/b/givemotion && t b-givemotion-now node /home/user/givemotion/src/cli.js render video.html -o $T/b-gm-now.mp4 --no-cache
echo done >> $T/times.txt
