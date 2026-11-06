#!/bin/bash
# Round 7 rerun (the first attempt was killed by a machine restart): same briefs, fresh projects, 18 makers.
set -u
H=/home/user/tools5/harness; R=/home/user/tools5
for id in k l m; do cp $R/brief-$id.md $R/brief-${id}2.md; done
for id in k l m k2 l2 m2; do bash $H/setup-round.sh $id > $H/setup-$id.log 2>&1; done
for id in k l m k2 l2 m2; do for t in givemotion remotion hyperframes; do bash $H/run-maker-open.sh $id $t & done; done
wait
echo makers-done > $H/round7.done
