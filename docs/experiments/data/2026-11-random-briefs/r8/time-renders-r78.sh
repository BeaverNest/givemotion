#!/bin/bash
# Rounds 7-8 render times (set 1 of each brief): each final video re-rendered with its maker's own tool, one at a time, cache off.
T=/home/user/tools5/timing; R=/home/user/tools5
t() { local name=$1; shift; local s=$(date +%s.%N); "$@" > $T/$name.log 2>&1; local rc=$?; local e=$(date +%s.%N); echo "$name $(echo "$e - $s" | bc) rc=$rc" >> $T/times-r78.txt; }
: > $T/times-r78.txt
cd $R/k/hyperframes && HYPERFRAMES_NO_TELEMETRY=1 npx --yes hyperframes@0.9.18 render --quality delivery --fps 30 -o $T/warm-hf78.mp4 >/dev/null 2>&1
for id in k l m n o p; do cd $R/$id/hyperframes && t $id-hyperframes env HYPERFRAMES_NO_TELEMETRY=1 npx --yes hyperframes@0.9.18 render --quality delivery --fps 30 -o $T/$id-hf.mp4; done
declare -A C=([k]=WaterCycle [l]=Abyssal [m]=AddressOfEveryBook [n]=Keyward [o]=Ledgerline [p]=LockedTight)
for id in k l m n o p; do cd $R/$id/remotion && t $id-remotion npx remotion render ${C[$id]} $T/$id-rm.mp4 --muted --bundle-cache=false; done
for id in k l m n o p; do cd $R/$id/givemotion && t $id-givemotion npx givemotion render video.html -o $T/$id-gm.mp4 --no-cache; done
echo done >> $T/times-r78.txt
