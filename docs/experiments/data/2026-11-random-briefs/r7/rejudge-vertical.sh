#!/bin/bash
# Re-judge the vertical briefs (H, M, M2): their packs had been squashed into landscape frames.
H=/home/user/tools5/harness; J=/home/user/tools5/judging
for b in h m m2; do
  mkdir -p $J/squashed && rm -rf $J/squashed/$b && mv $J/$b $J/squashed/$b
  for t in givemotion remotion hyperframes; do bash $H/pack.sh /home/user/tools5/$b/$t/out/video.mp4 $J/$b/packs/$t >/dev/null 2>&1 || echo "pack fail $b $t"; done
done
for b in h m m2; do bash $H/run-judges.sh $b > /dev/null 2>&1 & done
wait
for b in h m m2; do python3 $H/scores.py $b > /dev/null 2>&1; done
echo done > $H/rejudge.done
