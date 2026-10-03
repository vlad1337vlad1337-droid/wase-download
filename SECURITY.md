# Security and availability

The public HTTP upload API is intentionally unauthenticated. MCP exposes only
`list_formats` and `conversion_info`; it cannot execute commands, fetch remote
URLs, upload files, or start conversions. Origin validation is a browser abuse
control, not authentication.

## Resource boundaries

- Nginx limits API request frequency and concurrent requests before forwarding
  to the loopback-only broker. These rules do not apply to VPN stream routing.
- Conversion admission is limited to 20 requests per IP per minute, 120 globally,
  two outstanding requests per IP and nine globally. One converter runs at once.
- An upload must finish before it acquires the converter slot. Uploads have a
  100 MiB cap and a 90-second deadline. The complete job, including queueing and
  download, has a 180-second deadline.
- MCP accepts at most 16 KiB JSON with a five-second read deadline, 90 requests
  per IP per minute and 600 globally. IDs and tool arguments are validated.
- Conversion containers run as a non-root user, without networking or Linux
  capabilities, with a read-only root filesystem, no-new-privileges, CPU/memory
  and process limits. The upload is mounted read-only; output lives in a
  temporary Docker volume limited to 256 MiB and 10,000 inodes.
- Result size, file count, directory depth and paths are bounded. Symlinks and
  special output files are rejected. ZIP generation and downloads use streams.
- Temporary containers, volumes and files are removed after normal completion,
  cancellation or failure. Administrators must check for leftovers after a
  broker or host crash.

## Boundaries that remain

Rate limits cannot guarantee availability against a distributed attack. The
finite queue can still fill. Link saturation and TLS/SYN floods happen before
HTTP protections; they require upstream anti-DDoS protection.

The website and VPN share a host and public IP. The broker also currently has
access to a rootful Docker daemon. Container isolation restricts uploaded-file
processing, but a compromise of the broker itself would have a larger impact.
A dedicated worker or rootless execution architecture is the next containment
step. Do not describe the current deployment as fully isolated from VPN or
immune to DDoS.

The npm audit does not cover OS packages, the container image, Node runtime,
kernel vulnerabilities or arbitrary exploit chains. Keep those components
patched separately and retain the supplied third-party license notices.

## Verification

The dated controls, limits, production conversion receipts and remaining risks
are recorded in [the security audit](deploy/api-security-audit-2026-10-03.json).
Run the unit checks from the GitHub workflow before deployment. For local
admission/cancellation checks, start a separate broker on port 5190, then run
`node scripts/audit-api-security.mjs`; the script rejects non-loopback targets.
Never run incomplete-upload or flood tests against the public production API.

References: [OWASP DoS guidance](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html),
[NGINX resource limits](https://docs.nginx.com/nginx/admin-guide/security-controls/controlling-access-proxied-http),
[Docker security](https://docs.docker.com/engine/security/).
