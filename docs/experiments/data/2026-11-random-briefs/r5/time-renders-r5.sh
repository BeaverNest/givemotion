#!/bin/bash
# Round 5 render times: each final video re-rendered with its maker's own tool, one at a time, cache off.
T=/home/user/tools5/timing; R=/home/user/tools5
t() { local name=$1; shift; local s=$(date +%s.%N); "$@" > $T/$name.log 2>&1; local rc=$?; local e=$(date +%s.%N); echo "$name $(echo "$e - $s" | bc) rc=$rc" >> $T/times-r5.txt; }
: > $T/times-r5.txt
cd $R/e/hyperframes && HYPERFRAMES_NO_TELEMETRY=1 npx --yes hyperframes@0.9.18 render --quality delivery --fps 30 -o $T/warm-hf5.mp4 >/dev/null 2>&1
for id in e g; do cd $R/$id/hyperframes && t $id-hyperframes env HYPERFRAMES_NO_TELEMETRY=1 npx --yes hyperframes@0.9.18 render --quality delivery --fps 30 -o $T/$id-hf.mp4; done
cd $R/e/remotion && t e-remotion npx remotion render RivergateMarathon $T/e-rm.mp4 --muted --bundle-cache=false
cd $R/g/remotion && t g-remotion npx remotion render BorrowedLightning $T/g-rm.mp4 --muted --bundle-cache=false
for id in e g; do cd $R/$id/givemotion && t $id-givemotion npx givemotion render video.html -o $T/$id-gm.mp4 --no-cache; done
echo done >> $T/times-r5.txt
