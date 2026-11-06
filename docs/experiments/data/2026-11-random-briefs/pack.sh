#!/bin/bash
# usage: pack.sh <video.mp4> <outdir> — what the judges see, for any length: two contact sheets (40 frames evenly
# spread), five 1-second motion strips at 10 fps (around 10/30/50/70/90% of the video), four larger key frames
set -eu
V=$1; O=$2; mkdir -p $O
F=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $V)
frame() { # time label width height out
  ffmpeg -v error -y -ss $1 -i $V -frames:v 1 -vf "scale=$3:$4:force_original_aspect_ratio=decrease,pad=$3:$4:(ow-iw)/2:(oh-ih)/2:color=0x202020,drawtext=fontfile=$F:text='$2':x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4" $5
}
TMP=$(mktemp -d)
for s in 1 2; do
  for k in $(seq 0 19); do
    t=$(awk "BEGIN{printf \"%.2f\", ($((s-1))*20+$k+0.5)*$D/40}")
    frame $t "${t}s" 384 216 $TMP/s$(printf %02d $k).png
  done
  ffmpeg -v error -y -i $TMP/s%02d.png -vf "tile=5x4:padding=6:color=gray" -frames:v 1 $O/sheet-$s.png
  rm -f $TMP/s*.png
done
i=1
for p in 0.1 0.3 0.5 0.7 0.9; do
  st=$(awk "BEGIN{v=$p*$D-0.5; if(v<0)v=0; if(v>$D-1)v=$D-1; printf \"%.1f\", v}")
  for k in 0 1 2 3 4 5 6 7 8 9; do t=$(awk "BEGIN{printf \"%.1f\", $st+$k/10}"); frame $t "${t}s" 576 324 $TMP/f0$k.png; done
  ffmpeg -v error -y -i $TMP/f%02d.png -vf "tile=5x2:padding=6:color=gray" -frames:v 1 $O/strip-$i.png
  rm -f $TMP/f*.png; i=$((i+1))
done
for p in 0.15 0.4 0.65 0.95; do t=$(awk "BEGIN{printf \"%.1f\", $p*$D}"); frame $t "${t}s" 1280 720 $O/key-$(printf %04.1f $t)s.png; done
rm -rf $TMP
