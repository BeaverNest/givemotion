#!/bin/bash
# Round 6 (open tools): brief j written blind; h and i were written earlier and never built. Set up, then 9 makers.
set -u
H=/home/user/tools5/harness; R=/home/user/tools5
python3 - <<'PY'
import json
H='/home/user/tools5/harness'
a=json.load(open(f'{H}/assignments-r6j.json'))[0]
t=open(f'{H}/brief-writer.txt').read()
for k in ['genre','subject','format']: t=t.replace('{'+k+'}',a[k])
t=t.replace('{techniques}','; '.join(a['techniques'])).replace('{seconds}',str(a['seconds'])).replace('{fonts}',', '.join(a['fonts']))
open(f'{H}/brief-writer-j.final.txt','w').write(t)
PY
mkdir -p $R/briefwriter/j && (cd $R/briefwriter/j && claude -p "$(cat $H/brief-writer-j.final.txt)" --model claude-opus-5-5 --effort high --strict-mcp-config --setting-sources project,local --disallowedTools Bash Edit Write WebFetch WebSearch Agent Task Workflow Read Glob Grep > $R/brief-j.md 2>$R/briefwriter/j.stderr)
for id in h i j; do bash $H/setup-round.sh $id > $H/setup-$id.log 2>&1; done
for id in h i j; do for t in givemotion remotion hyperframes; do bash $H/run-maker-open.sh $id $t & done; done
wait
echo makers-done
