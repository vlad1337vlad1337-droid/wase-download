#!/bin/sh
# Remove converter leftovers while the API is stopped: Wase job containers,
# their labeled tmpfs volumes and job directories. Safe as systemd
# ExecStartPre (it runs before the broker starts any job) and for manual use.
# It only touches names matching server.mjs; other Docker workloads are ignored.
# Exit status: 0 when nothing remains, 1 when something could not be removed.
set -u
cd "$(dirname "$0")/.." || exit 1
job_root=${JOB_ROOT:-backend/.jobs}
# Four Docker calls at most, each bounded: 4 x 15 s stays inside systemd's
# default 90 s start timeout even when the daemon hangs.
wait_s=${CLEANUP_COMMAND_TIMEOUT:-15}
if [ -n "${DOCKER_CONTEXT:-}" ]; then set -- --context "$DOCKER_CONTEXT"; else set --; fi

if [ "${FORCE:-0}" != 1 ] && command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet wase-download-api 2>/dev/null; then
  echo "cleanup-stale-jobs: wase-download-api is running; stop it first (or FORCE=1)." >&2
  exit 2
fi

names() { grep -E '^/?wase-wase-job-[A-Za-z0-9]+-[0-9]+$' | sed 's#^/##'; }
# GNU timeout bounds a stalled daemon; without it the command still runs.
bounded() { if command -v timeout >/dev/null 2>&1; then timeout "$wait_s" "$@"; else "$@"; fi; }
status=0
listed=$(bounded docker "$@" ps -a --filter name=wase-wase-job- --format '{{.Names}}') || { echo "cleanup-stale-jobs: docker ps failed" >&2; status=1; }
containers=$(printf '%s\n' "$listed" | names)
if [ -n "$containers" ]; then
  # shellcheck disable=SC2086 # names are validated by names() and contain no spaces
  bounded docker "$@" rm -f $containers >/dev/null || { echo "cleanup-stale-jobs: could not remove container(s): $(echo $containers)" >&2; status=1; }
fi
listed=$(bounded docker "$@" volume ls -q --filter label=wase.download.job=true) || { echo "cleanup-stale-jobs: docker volume ls failed" >&2; status=1; }
volumes=$(printf '%s\n' "$listed" | names)
if [ -n "$volumes" ]; then
  # shellcheck disable=SC2086
  bounded docker "$@" volume rm $volumes >/dev/null || { echo "cleanup-stale-jobs: could not remove volume(s): $(echo $volumes)" >&2; status=1; }
fi
if [ -L "$job_root" ]; then
  echo "cleanup-stale-jobs: $job_root is a symlink; job directories not cleaned" >&2; status=1
elif [ -d "$job_root" ]; then
  find "$job_root" -mindepth 1 -maxdepth 1 -type d -name 'wase-job-*' -exec rm -rf {} + || status=1
fi
count() { printf '%s\n' $1 | grep -c . || true; }
echo "cleanup-stale-jobs: $(count "$containers") container(s), $(count "$volumes") volume(s) processed; status $status"
exit $status
