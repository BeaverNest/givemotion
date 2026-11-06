#!/bin/bash
# usage: setup-round.sh <brief-id>   → /home/user/tools5/<id>/{givemotion,remotion,hyperframes}
set -eu
ID=$1; R=/home/user/tools5/$ID; HF=0.9.18; RM=4.0.541
mkdir -p $R/fonts && cp /home/user/givemotion/src/runtime/fonts/*.woff2 /home/user/givemotion/src/runtime/fonts/*-OFL.txt $R/fonts/
# givemotion: the packed engine at HEAD, installed like a user would, plus its skill pack
mkdir -p $R/givemotion && cd $R/givemotion && echo '{"name":"video","private":true,"type":"module"}' > package.json
npm i /home/user/tools5/givemotion.tgz --no-audit --no-fund >/dev/null 2>&1
mkdir -p skills && cp -r /home/user/givemotion/skills/givemotion skills/
# Remotion: a blank project from create-video, its official agent skills, and the preinstalled headless shell
mkdir -p $R/remotion && cd $R/remotion && npx -y create-video@$RM --yes --blank --no-tailwind . >/dev/null 2>&1 && npm i --no-audit --no-fund >/dev/null 2>&1
cat >> remotion.config.ts <<'EOC'

// Sandbox: remotion.media is not reachable from this machine, so use the
// preinstalled Chrome Headless Shell instead of downloading one.
Config.setBrowserExecutable(
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
);
EOC
cp -r /home/user/tools4/remotion-skills/skills skills
# HyperFrames: a blank project from init; its core skills (init puts them in the user's skill folder) moved into it
cd $R && HYPERFRAMES_NO_TELEMETRY=1 npx -y hyperframes@$HF init hyperframes --example blank --non-interactive >/dev/null 2>&1 || true
mkdir -p $R/hyperframes/skills
for s in hyperframes hyperframes-cli hyperframes-registry media-use; do [ -d ~/.claude/skills/$s ] && rm -rf $R/hyperframes/skills/$s && mv ~/.claude/skills/$s $R/hyperframes/skills/; done
mkdir -p $R/hyperframes/vendor/gsap && cp /home/user/tools5/gsap/*.min.js $R/hyperframes/vendor/gsap/
sed -i 's#https://cdn.jsdelivr.net/npm/gsap@[0-9.]*/dist/gsap.min.js#vendor/gsap/gsap.min.js#' $R/hyperframes/index.html
for t in givemotion remotion hyperframes; do cp -r $R/fonts $R/$t/; cp /home/user/tools5/brief-$ID.md $R/$t/brief.md; done
ls $R/*; ls $R/hyperframes/skills; grep -n "gsap" $R/hyperframes/index.html | head -2
