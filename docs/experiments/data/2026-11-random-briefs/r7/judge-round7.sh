#!/bin/bash
# Round 7 judging: per brief two sets (makers 1 and makers 2), six blind judges each.
H=/home/user/tools5/harness
for b in k l m k2 l2 m2; do rm -rf ../judging/$b; for t in givemotion remotion hyperframes; do bash $H/pack.sh ../$b/$t/out/video.mp4 ../judging/$b/packs/$t >/dev/null 2>&1 || echo "pack fail $b $t"; done; done
for b in k l m k2 l2 m2; do bash $H/run-judges.sh $b > /dev/null 2>&1 & done
wait
for b in k l m k2 l2 m2; do python3 $H/scores.py $b > /dev/null 2>&1; done
echo judged > $H/round7.judged
