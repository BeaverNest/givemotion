#!/bin/bash
# usage: pack.sh <video.mp4> <outdir>   — contact sheets, beat motion strips and key frames for the judges
set -eu
V=$1; O=$2; mkdir -p $O
F=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
LBL="drawtext=fontfile=$F:text='%{pts\:hms}':x=8:y=8:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4"
# two contact sheets: one frame every 0.5 s (0-9.5 s, 10-19.5 s), 5x4 tiles of 384x216
ffmpeg -v error -y -i $V -vf "fps=2,setpts=N/2/TB,scale=384:216,$LBL,tile=5x4:padding=6:color=gray" -frames:v 1 $O/sheet-1.png
ffmpeg -v error -y -ss 10 -i $V -vf "fps=2,setpts=(N/2+10)/TB,scale=384:216,$LBL,tile=5x4:padding=6:color=gray" -frames:v 1 $O/sheet-2.png
# motion strips: 1 s of each beat at 10 fps, 5x2 tiles of 576x324
i=1
for s in 1.2 4.5 8.0 12.5 15.5; do
  TMP=$(mktemp -d)
  for k in 0 1 2 3 4 5 6 7 8 9; do
    ts=$(awk "BEGIN{printf \"%.1f\", $s+$k/10}")
    ffmpeg -v error -y -ss $ts -i $V -frames:v 1 -vf "scale=576:324,drawtext=fontfile=$F:text='${ts}s':x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4" $TMP/f0$k.png
  done
  ffmpeg -v error -y -i $TMP/f%02d.png -vf "tile=5x2:padding=6:color=gray" -frames:v 1 $O/strip-beat$i.png
  rm -rf $TMP
  i=$((i+1))
done
# key frames at 1280x720
for s in 2.0 9.0 13.5 19.0; do
  ffmpeg -v error -y -ss $s -i $V -frames:v 1 -vf scale=1280:720 $O/key-${s}s.png
done
