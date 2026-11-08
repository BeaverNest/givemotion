# givemotion runtime in a container: Node + chrome-headless-shell + ffmpeg + fonts.
#
# The engine source is NOT baked in. The compose file mounts the fork at /work, so an edit on
# the host is what the next render uses — this image is the machine, not the code. That keeps
# `git diff` on the host meaningful and stops a container run from rendering yesterday's tree.
FROM node:22-bookworm-slim

# ffmpeg encodes; unzip unpacks the Chrome for Testing archive; git is not used by the renderer
# but `npm test` shells out to `git ls-files` for the independence policy scan, and it dies with
# ENOENT — reported as a failing assertion, not a missing binary — when git is absent.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg unzip ca-certificates git \
      fonts-dejavu-core fonts-dejavu-extra fonts-noto-color-emoji fonts-liberation \
      fonts-noto-core fonts-freefont-ttf fonts-symbola \
      libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
      libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
      libcairo2 libasound2 libatspi2.0-0 libxshmfence1 libx11-xcb1 libexpat1 \
    && rm -rf /var/lib/apt/lists/*
# The libs above are what chrome-headless-shell links against on bookworm. The fonts are not
# optional: the starter page and most blocks use emoji, and without a colour-emoji font a render
# silently produces tofu boxes that still exit 0.

# Chrome lives in the image, outside the cache mount the container gets at /cache, so a
# `docker volume rm` cannot leave the image without a browser.
ENV GIVEMOTION_CACHE=/opt/gm-cache
COPY src /opt/givemotion/src
COPY package.json /opt/givemotion/package.json
RUN node /opt/givemotion/src/cli.js install
# A stable path for the browser, so GIVEMOTION_CHROME is correct for every entry point — the
# test suite and `doctor` both call findChrome() directly, and a bare `sh -c 'npm test'` (which
# overrides the entrypoint) would otherwise fall back to CACHE_DIR, find nothing at /cache, and
# skip 119 e2e tests with "needs Chrome and ffmpeg" instead of failing.
RUN set -eu; p=$(find /opt/gm-cache/chrome-headless-shell -name 'chrome-headless-shell' -type f | head -1); \
    [ -n "$p" ] || { echo "chrome install produced no binary" >&2; exit 1; }; \
    ln -sf "$p" /usr/local/bin/chrome-headless-shell
ENV GIVEMOTION_CHROME=/usr/local/bin/chrome-headless-shell

# Same uid/gid as the host user: a bind-mounted render must not come back owned by root.
RUN groupadd -g 1000 gm 2>/dev/null || true \
    && useradd -u 1000 -g 1000 -m -s /bin/bash gm 2>/dev/null || true \
    && mkdir -p /cache /work /videos && chown -R 1000:1000 /cache /work /videos /opt/gm-cache

COPY docker/entrypoint.sh /usr/local/bin/gm
RUN chmod 0755 /usr/local/bin/gm

USER 1000:1000
WORKDIR /work
ENV GIVEMOTION_NO_SANDBOX=1
ENTRYPOINT ["/usr/local/bin/gm"]
CMD ["doctor"]
