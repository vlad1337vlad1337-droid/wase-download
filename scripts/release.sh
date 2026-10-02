#!/bin/sh
set -eu
# Run on the intended web host after transferring a verified dist/ directory.
# Does not modify SSH, firewall or public listeners.
artifact_dir=${1:?Usage: release.sh /path/to/dist}
release_name=$(date -u +%Y%m%dT%H%M%SZ)
release_base=/var/www/wase-download
release_dir="$release_base/releases/$release_name"
test -f "$artifact_dir/en/index.html"
test -f "$artifact_dir/ru/index.html"
test -f "$artifact_dir/zh/index.html"
test -f "$artifact_dir/sitemap.xml"
mkdir -p "$release_dir"
cp -R "$artifact_dir/." "$release_dir/"
# Retain previous hashed assets so tabs opened before a release can start workers.
if [ -d "$release_base/current/assets" ]; then
    cp -Rn "$release_base/current/assets/." "$release_dir/assets/"
fi
find "$release_dir" -type d -exec chmod 755 {} +
find "$release_dir" -type f -exec chmod 644 {} +
ln -s "$release_dir" "$release_base/current.next"
mv -Tf "$release_base/current.next" "$release_base/current"
printf 'Installed release: %s\n' "$release_dir"
