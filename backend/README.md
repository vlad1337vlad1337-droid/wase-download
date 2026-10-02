# Self-hosted ConvertX integration

No external conversion API. The Node.js broker calls the converter modules in the pinned ConvertX Docker image, not its public web app.

```sh
docker pull ghcr.io/c4illin/convertx@sha256:8590a21a16adb8514a8be55b74ad0112bf58ba772328a53f7b40528fcf8fa013
node backend/server.mjs
```

On this Mac use `DOCKER_CONTEXT=colima-wase-download node backend/server.mjs`. Keep the Docker context explicit; the user's original default context was restored. Local preview forwards `/api` to loopback port 5189. Production nginx configuration includes the same proxy. Deploy backend files with the site repository; process cwd must be its root.

Each task has a random directory. Containers run with no network, read-only root, non-root UID, all capabilities dropped, 1 CPU, 768 MB, 128 processes, bounded writable tmpfs. Only the individual job directory is mounted. Files are deleted after success/error/cancellation; no persistent history or download identifiers. Outputs are returned in the original response. There is a 20 MB input limit, 40 MB output limit, 60 second job timeout and two concurrent jobs. The container is removed on completion/cancellation. Global job admission and per-address rate limit are enforced. The public proxy must retain the body limit and timeout.

This broker needs Docker control. Deploy on a dedicated conversion host with no other sensitive Docker workloads. Do not expose the Docker socket or native ConvertX UI. The current nginx upstream remains loopback-only. The deploy directory contains a systemd unit for the dedicated wase-download user. Review Node path and working directory before installation. Graceful termination removes active containers and job files; after a host crash, stale named containers/job directories require cleanup before restarting the public service.

Catalogue entries come from installed ConvertX module declarations. Some formats/codecs are input-specific, some exports create multiple files, some engine paths may fail. We do not advertise guaranteed arbitrary conversions. Single-file exports return that file. Multiple-file/directory exports are packed as ZIP, excluding the input and rejecting symlinks. Aggregate output limit is 40 MB and 5000 files. Conversion options from users are not passed to command lines.

Verified smoke cases: PNG → vector SVG (VTracer), SVG → PNG (resvg), TXT → PDF (LibreOffice), WAV → MP3 (FFmpeg). Run automated server cases with the broker enabled.

License: AGPL-3.0 for the server integration; see LICENSE and the linked complete ConvertX source fork. Browser ImageTracer license remains separate.

`PUBLIC_ORIGINS=https://wase.download` must be set in production. The loopback development origins are only present in the default local configuration. The browser receives a deduplicated catalogue, not the full engine matrix.
