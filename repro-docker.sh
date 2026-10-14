#!/bin/sh
# Runs `pnpm repro` in the official images of the last good and the first bad Node.
# Needs docker (or podman aliased as docker). Builds inside each container.
set -e
for version in 26.11.1 26.12.0; do
  echo "===== node:$version-slim"
  docker run --rm -v "$PWD":/src:ro "node:$version-slim" sh -c '
    cp -r /src /app && cd /app && rm -rf node_modules dist .astro
    npm install -g corepack@latest >/dev/null 2>&1 && corepack enable
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm install --frozen-lockfile >/dev/null
    pnpm build >/dev/null
    pnpm repro
  '
done
