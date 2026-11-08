# givemotion runtime in a container: Node + chrome-headless-shell + ffmpeg + fonts.
#
# The engine source is NOT baked in. The compose file mounts the fork at /work, so an edit on
# the host is what the next render uses — this image is the machine, not the code. That keeps
# `git diff` on the host meaningful and stops a container run from rendering yesterday's tree.
FROM node:22-bookworm-slim

# ffmpeg encodes; unzip unpacks the Chrome for Testing archive; the libs below are what
# chrome-headless-shell links against on bookworm. Fonts are not optional: the starter page and
# most blocks use emoji, and without a colour-emoji font a render silently produces tofu boxes
# that still exit 0.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg unzip ca-certificates \
      fonts-dejavu-core fonts-noto-color-emoji fonts-liberation \
      libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
      libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
      libcairo2 libasound2 libatspi2.0-0 libxshmfence1 libx11-xcb1 libexpat1 \
    && rm -rf /var/lib/apt/lists/*

# Chrome lives in the image, outside the cache mount the container gets at /cache, so a
# `docker volume rm` cannot leave the image without a browser.
ENV GIVEMOTION_CACHE=/opt/gm-cache
COPY src /opt/givemotion/src
COPY package.json /opt/givemotion/package.json
RUN node /opt/givemotion/src/cli.js install

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
