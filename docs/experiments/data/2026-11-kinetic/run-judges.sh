#!/bin/bash
# usage: run-judges.sh   — six blind judges, every order of the three videos once
set -u
R=/home/user/tools4; H=$R/harness; J=$R/judging
PERMS=("givemotion remotion hyperframes" "givemotion hyperframes remotion" "remotion givemotion hyperframes"
       "remotion hyperframes givemotion" "hyperframes givemotion remotion" "hyperframes remotion givemotion")
mkdir -p $J
: > $J/key.txt
for j in 1 2 3 4 5 6; do
  D=$J/judge-$j; rm -rf $D; mkdir -p $D; cp $R/brief.md $D/
  set -- ${PERMS[$((j-1))]}
  for L in A B C; do cp -r $J/packs/$1 $D/$L; echo "judge-$j $L $1" >> $J/key.txt; shift; done
  P=$(sed "s#{DIR}#$D#g" $H/judge-prompt.txt)
  ( cd $D && claude -p "$P" --model claude-opus-5-5 --effort high \
      --permission-mode default --allowedTools Read Glob \
      --disallowedTools Bash Edit Write WebFetch WebSearch Agent Task Workflow \
      --strict-mcp-config --setting-sources project,local \
      --output-format stream-json --verbose > $J/judge-$j.jsonl 2> $J/judge-$j.stderr ) &
done
wait
