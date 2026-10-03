# Self-hosted ConvertX integration

No external conversion API. The Node.js broker calls the converter modules in the pinned ConvertX Docker image, not its public web app.

```sh
docker build -t wase-converter:20261002 backend
node backend/server.mjs
```

On this Mac use `DOCKER_CONTEXT=colima-wase-download node backend/server.mjs`. Keep the Docker context explicit; the user's original default context was restored. Local preview forwards `/api` to loopback port 5189. Production nginx configuration includes the same proxy. Deploy backend files with the site repository; process cwd must be its root.

Each task has a random directory. Containers run with no network, read-only root, non-root UID, all capabilities dropped, 0.25 CPU, 768 MB, 128 processes, bounded writable tmpfs. Only the individual job directory is mounted. Files are deleted after success/error/cancellation; no persistent history or download identifiers. Outputs are returned in the original response. There is a 100 MB input limit, 200 MB output limit, 180 second job timeout and one active job with eight waiting slots. The container is removed on completion/cancellation. Global job admission and per-address rate limit are enforced. The public proxy must retain the body limit and timeout.

This broker needs Docker control. Deploy on a dedicated conversion host with no other sensitive Docker workloads. Do not expose the Docker socket or native ConvertX UI. The current nginx upstream remains loopback-only. The deploy directory contains a systemd unit for the dedicated wase-download user. Review Node path and working directory before installation. Graceful termination cancels and waits for cleanup of incomplete uploads, queued files and active containers; after a host crash, stale named containers/job directories require cleanup before restarting the public service.

Container and output-volume removal each have a three-second command deadline and are attempted once per worker. If removal cannot be confirmed, the API pauses conversion intake: new and already queued conversions receive 503, while read-only catalogue/MCP requests remain available. Only Docker's exact missing-container/missing-volume errors count as successful cleanup. A generic operator error is logged once; uploads and queue capacity are released without starting further workers. No automatic recovery or restart is attempted. Before restarting the API to resume intake, an operator must check Docker health and remove the remaining `wase-wase-job-*` containers, their labeled temporary volumes, and stale job directories. Do not resume solely because `/api/formats` still responds. Normal cleanup uses at most six seconds of command waiting, inside the service's 20-second stop budget; host filesystem stalls or a crashed process still require operational cleanup.

Catalogue entries come from installed ConvertX module declarations. Some formats/codecs are input-specific, some exports create multiple files, some engine paths may fail. We do not advertise guaranteed arbitrary conversions. Single-file exports return that file. Multiple-file/directory exports are packed as ZIP, excluding the input and rejecting symlinks. Aggregate output limit is 200 MB and 5000 files. Conversion options from users are not passed to command lines.

Verified smoke cases: PNG → vector SVG (VTracer), SVG → PNG (resvg), TXT → PDF (LibreOffice), WAV → MP3 (FFmpeg). Run automated server cases with the broker enabled.

License: AGPL-3.0 for the server integration; see LICENSE and the linked complete ConvertX source fork. Browser ImageTracer license remains separate.

`PUBLIC_ORIGINS=https://wase.download` must be set in production. The loopback development origins are only present in the default local configuration. The browser receives a deduplicated catalogue, not the full engine matrix.

Font conversion uses FontTools and FontForge. ZIP/TAR repacking rejects traversal, POSIX and Windows absolute/drive-relative paths, links and duplicates, and limits archive expansion; 7Z/RAR repacking is not implemented. Run `python3 tests/archive-security.py` and the server suite before changing archive support. Large requests stream to temporary disk instead of duplicating the input in RAM.

The mounted job root and input belong to the broker UID. The conversion engine changes permissions only on its own outputs, so different Linux service/container UIDs work correctly.

## Shared production budget

Install `deploy/wase-conversion.slice` together with the service. The API (15%) and every Docker job (25%, `--cgroup-parent=wase-conversion.slice`) share a hard **35% of one CPU** parent budget and 1300 MB memory ceiling. Nginx and VPN stream forwarding remain outside this slice. CPUWeight/IOWeight are low priority; the cap deliberately trades conversion speed for headroom. One active job and eight waiting slots prevent parallel CPU spikes. Check actual Docker CgroupParent and the parent cpu.max after provisioning; a service-only quota does not constrain detached containers.

`POST /api/mcp` is a stateless, read-only Streamable HTTP JSON-RPC endpoint with `list_formats` and `conversion_info`. It reports declared capabilities; it never uploads, fetches remote URLs or starts containers. Request size and rate are bounded. Official MCP SDK client compatibility is covered by `tests/discovery.test.mjs`.
