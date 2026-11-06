#!/bin/bash
# Round 8 judging: per brief two sets (makers 1 and makers 2), six blind judges each.
H=/home/user/tools5/harness
for b in n o p n2 o2 p2; do rm -rf ../judging/$b; for t in givemotion remotion hyperframes; do bash $H/pack.sh ../$b/$t/out/video.mp4 ../judging/$b/packs/$t >/dev/null 2>&1 || echo "pack fail $b $t"; done; done
for b in n o p n2 o2 p2; do bash $H/run-judges.sh $b > /dev/null 2>&1 & done
wait
for b in n o p n2 o2 p2; do python3 $H/scores.py $b > /dev/null 2>&1; done
echo judged > $H/round8.judged
