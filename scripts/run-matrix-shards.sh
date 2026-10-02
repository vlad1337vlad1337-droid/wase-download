#!/bin/sh
set -eu
for shard in 0 1 2 3; do
 docker --context colima-wase-download run --rm --name "wase-matrix-$shard" --network none --read-only --cap-drop ALL --security-opt no-new-privileges --user 1000:1000 --cpus 0.8 --memory 768m --pids-limit 128 -e MATRIX_PLAN=/plan.json -e HOME=/home/convertx -e XDG_CONFIG_HOME=/tmp/config -e XDG_CACHE_HOME=/tmp/cache --tmpfs /tmp:rw,size=128m --tmpfs /job:rw,size=32m,mode=1777 --tmpfs /home/convertx:rw,size=64m,mode=1777 -v "$PWD/backend/engine.mjs:/engine.mjs:ro" -v "$PWD/backend/extra.py:/extra.py:ro" -v "$PWD/backend/output-validation.py:/output-validation.py:ro" -v "$PWD/scripts/run-matrix-tests.py:/audit.py:ro" -v "$PWD/../work/conversion-corpus/files:/corpus:ro" -v "$PWD/../work/conversion-corpus/shard-$shard/plan.json:/plan.json:ro" -v "$PWD/../work/conversion-corpus/shard-$shard/report:/report:rw" --entrypoint python3 wase-converter:20261002 /audit.py > "/tmp/wase-matrix-shard-$shard.log" 2>&1 &
done
wait
