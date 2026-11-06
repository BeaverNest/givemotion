#!/bin/bash
# Round 8: three random briefs (n, o, p; p forced vertical) written blind; two makers per tool per brief.
# (set 1 in folders k, l, m; set 2 in k2, l2, m2, same brief). Every tool open to all makers.
set -u
H=/home/user/tools5/harness; R=/home/user/tools5
for id in n o p; do
  python3 - "$id" <<'PY'
import json,sys
id=sys.argv[1]; H='/home/user/tools5/harness'
a=[x for x in json.load(open(f'{H}/assignments-r8.json')) if x['id']==id][0]
t=open(f'{H}/brief-writer.txt').read()
for k in ['genre','subject','format']: t=t.replace('{'+k+'}',a[k])
t=t.replace('{techniques}','; '.join(a['techniques'])).replace('{seconds}',str(a['seconds'])).replace('{fonts}',', '.join(a['fonts']))
open(f'{H}/brief-writer-{id}.final.txt','w').write(t)
PY
  mkdir -p $R/briefwriter/$id && (cd $R/briefwriter/$id && claude -p "$(cat $H/brief-writer-$id.final.txt)" --model claude-opus-5-5 --effort high --strict-mcp-config --setting-sources project,local --disallowedTools Bash Edit Write WebFetch WebSearch Agent Task Workflow Read Glob Grep > $R/brief-$id.md 2>$R/briefwriter/$id.stderr) &
done
wait
for id in n o p; do cp $R/brief-$id.md $R/brief-${id}2.md; done
for id in n o p n2 o2 p2; do bash $H/setup-round.sh $id > $H/setup-$id.log 2>&1; done
for id in n o p n2 o2 p2; do for t in givemotion remotion hyperframes; do bash $H/run-maker-open.sh $id $t & done; done
wait
echo makers-done > /home/user/tools5/harness/round8.done
