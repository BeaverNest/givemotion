#!/bin/bash
# Measure one render: wall time, peak CPU%, and total CPU-seconds from the container's cgroup.
# Usage: measure_render.sh <workers> <cpus> <tag>
set -u
W=$1; C=$2; TAG=$3
OUT=/home/beavernest/scratch/gm-demo/out/measure-$TAG.mp4
rm -rf /home/beavernest/scratch/gm-demo/out/.gm-parts
NAME=gmmeas-$TAG
docker rm -f "$NAME" >/dev/null 2>&1

START=$(date +%s%N)
docker run -d --name "$NAME" \
  -v /home/beavernest/scratch/givemotion:/work \
  -v docker_gm-cache:/cache \
  -v /home/beavernest/scratch/gm-demo:/videos \
  -e GIVEMOTION_CACHE=/cache -e GIVEMOTION_NO_SANDBOX=1 \
  -e GM_WORKERS="$W" -e GM_NICE=10 \
  --cpus "$C" --memory 4g --shm-size 1g --init \
  givemotion:local render /videos/demo/index.html -o "/videos/out/measure-$TAG.mp4" >/dev/null

CID=$(docker inspect -f '{{.Id}}' "$NAME")
CG="/sys/fs/cgroup/system.slice/docker-$CID.scope/cpu.stat"
# the cgroup file is root-only; sudo is passwordless on this host
read_cpu_usec() { sudo -n cat "$CG" 2>/dev/null | awk '/usage_usec/ {print $2}'; }

PEAK=0
LAST_USEC=0
while [ "$(docker inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null)" = "true" ]; do
  # the cgroup is removed the moment the container exits, so the total is sampled while it runs
  U=$(sudo -n cat "$CG" 2>/dev/null | awk '/usage_usec/ {print $2}')
  [ -n "$U" ] && LAST_USEC=$U
  V=$(docker stats --no-stream --format '{{.CPUPerc}}' "$NAME" 2>/dev/null | tr -d '%')
  [ -n "$V" ] && awk -v a="$V" -v b="$PEAK" 'BEGIN{exit !(a>b)}' && PEAK=$V
  sleep 0.4
done
END=$(date +%s%N)

USEC=$LAST_USEC
LOG=$(docker logs "$NAME" 2>&1 | grep -E 'done in|worker' | tail -2)
docker rm "$NAME" >/dev/null 2>&1
WALL=$(( (END-START)/1000000 ))
printf 'tag=%s workers=%s cpus=%s wall=%sms peak_cpu=%s%% cpu_seconds=%s\n' \
  "$TAG" "$W" "$C" "$WALL" "${PEAK%.*}" "$(awk -v u="${USEC:-0}" 'BEGIN{printf "%.1f", u/1e6}')"
echo "  $LOG"
md5sum "$OUT" 2>/dev/null | awk '{print "  md5 " $1}'
