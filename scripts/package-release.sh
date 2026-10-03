#!/bin/sh
set -eu
revision=$(git rev-parse --short HEAD)
out=${1:-/tmp}
mkdir -p "$out"
# Exclude macOS extended attributes and AppleDouble files from Linux artifacts.
COPYFILE_DISABLE=1 tar --no-xattrs -czf "$out/wase-download-$revision-dist.tgz" -C dist .
COPYFILE_DISABLE=1 tar --no-xattrs -czf "$out/wase-download-$revision-backend.tgz" backend/server.mjs backend/discovery.mjs backend/request-guard.mjs backend/output-stream.mjs backend/extra.py backend/engine.mjs backend/engine-order.mjs backend/output-validation.py backend/conversion-policy.mjs backend/output-brand.mjs scripts/release.sh
