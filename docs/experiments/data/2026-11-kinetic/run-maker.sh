#!/bin/bash
# usage: run-maker.sh <tool>   (givemotion | remotion | hyperframes)
# Each maker is a fresh headless Claude Code session in its own folder. File edits are accepted inside
# the folder only; shell commands are limited to the allowlist below (others are refused and logged).
set -u
T=$1; DIR=/home/user/tools4/$T; H=/home/user/tools4/harness
case $T in givemotion) NAME=givemotion;; remotion) NAME=Remotion;; hyperframes) NAME=HyperFrames;; esac
NOTES=$(sed "s#{DIR}#$DIR#g" $H/notes-$T.txt)
PROMPT=$(sed -e "s#{TOOL}#$NAME#g" -e "s#{DIR}#$DIR#g" $H/prompt-common.txt)
PROMPT=${PROMPT//\{NOTES\}/$NOTES}
echo "$PROMPT" > $H/prompt-$T.final.txt
ALLOW=(Read Glob Grep Edit Write
  "Bash(npx:*)" "Bash(npm:*)" "Bash(node:*)" "Bash(ffmpeg:*)" "Bash(ffprobe:*)" "Bash(python3:*)"
  "Bash(ls:*)" "Bash(cat:*)" "Bash(head:*)" "Bash(tail:*)" "Bash(grep:*)" "Bash(find:*)" "Bash(wc:*)"
  "Bash(mkdir:*)" "Bash(cp:*)" "Bash(mv:*)" "Bash(rm:*)" "Bash(sed:*)" "Bash(echo:*)" "Bash(cd:*)"
  "Bash(pwd)" "Bash(du:*)" "Bash(file:*)" "Bash(sort:*)" "Bash(awk:*)" "Bash(test:*)" "Bash(date:*)")
cd $DIR
date +%s > $H/$T.start
claude -p "$PROMPT" --model claude-opus-5-5 --effort high \
  --permission-mode acceptEdits --allowedTools "${ALLOW[@]}" \
  --strict-mcp-config --setting-sources project,local \
  --disallowedTools WebFetch WebSearch Agent Task Workflow \
  --output-format stream-json --verbose > $H/$T.jsonl 2> $H/$T.stderr
echo $? > $H/$T.exit
date +%s > $H/$T.end
