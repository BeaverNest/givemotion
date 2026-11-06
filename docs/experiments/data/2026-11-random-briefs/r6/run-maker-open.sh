#!/bin/bash
# usage: run-maker.sh <brief-id> <tool>   (givemotion | remotion | hyperframes)
# Each maker is a fresh headless Claude Code session in its own folder. File edits are accepted inside
# the folder only; shell commands are limited to the allowlist below (others are refused and logged).
set -u
ID=$1; T=$2; DIR=/home/user/tools5/$ID/$T; H=/home/user/tools5/harness; L=$ID-$T
case $T in givemotion) NAME=givemotion;; remotion) NAME=Remotion;; hyperframes) NAME=HyperFrames;; esac
NOTES=$(sed "s#{DIR}#$DIR#g" $H/notes-$T.txt)
PROMPT=$(sed -e "s#{TOOL}#$NAME#g" -e "s#{DIR}#$DIR#g" $H/prompt-common-open.txt)
PROMPT=${PROMPT//\{NOTES\}/$NOTES}
echo "$PROMPT" > $H/prompt-$L.final.txt
ALLOW=(Read Glob Grep Edit Write Bash WebSearch WebFetch Agent Task TodoWrite NotebookEdit
  "Bash(npx:*)" "Bash(npm:*)" "Bash(node:*)" "Bash(ffmpeg:*)" "Bash(ffprobe:*)" "Bash(python3:*)"
  "Bash(ls:*)" "Bash(cat:*)" "Bash(head:*)" "Bash(tail:*)" "Bash(grep:*)" "Bash(find:*)" "Bash(wc:*)"
  "Bash(mkdir:*)" "Bash(cp:*)" "Bash(mv:*)" "Bash(rm:*)" "Bash(sed:*)" "Bash(echo:*)" "Bash(cd:*)"
  "Bash(pwd)" "Bash(du:*)" "Bash(file:*)" "Bash(sort:*)" "Bash(awk:*)" "Bash(test:*)" "Bash(date:*)")
cd $DIR
date +%s > $H/$L.start
claude -p "$PROMPT" --model claude-opus-5-5 --effort high \
  --permission-mode acceptEdits --allowedTools "${ALLOW[@]}" \
  --strict-mcp-config --setting-sources project,local \
  \
  --output-format stream-json --verbose > $H/$L.jsonl 2> $H/$L.stderr
echo $? > $H/$L.exit
date +%s > $H/$L.end
