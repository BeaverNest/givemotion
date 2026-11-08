#!/bin/sh
# Container entry: point givemotion at the Chrome inside the image, then run the CLI from the
# mounted tree (/work). Everything after the image name is passed through, so
#   docker compose run --rm givemotion render index.html -o out/v.mp4
# behaves like `node src/cli.js render index.html -o out/v.mp4` on the host.
set -e

if [ -z "${GIVEMOTION_CHROME:-}" ]; then
    # The download path carries the Chrome version, so it is resolved instead of hard-coded.
    for p in $(find /opt/gm-cache/chrome-headless-shell -name 'chrome-headless-shell' -type f 2>/dev/null); do
        GIVEMOTION_CHROME="$p"
        export GIVEMOTION_CHROME
        break
    done
fi
if [ -z "${GIVEMOTION_CHROME:-}" ]; then
    echo "gm: no chrome-headless-shell in the image (rebuild it: docker compose build)" >&2
    exit 1
fi

# Docker gives a container 64 MB of /dev/shm by default and Chrome dies mid-capture without
# more; compose sets shm_size, this only warns if someone ran the image with plain `docker run`.
if [ -r /dev/shm ]; then
    shm_kb=$(df -k /dev/shm 2>/dev/null | awk 'NR==2 {print $2}')
    [ "${shm_kb:-0}" -lt 262144 ] && echo "gm: /dev/shm is ${shm_kb}KB — run with --shm-size=1g or frames may fail" >&2
fi

exec node /work/src/cli.js "$@"
