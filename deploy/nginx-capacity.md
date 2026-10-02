# Stream ingress connection capacity

Merge into the existing main nginx configuration, not a `http` server block:

```nginx
worker_processes auto;
worker_rlimit_nofile 16384;
events {
    worker_connections 8192;
}
```

Do not duplicate an existing events block. Keep the service hard LimitNOFILE at least 16384. Validate using nginx -t and gracefully reload. This two-stage stream deployment consumes multiple connection slots per client. A systemd file-descriptor ceiling alone does not increase worker_connections. Verify the new worker's actual /proc/PID/limits and errors; draining old workers retain their old limits until sessions end. Do not kill established VPN sessions just to remove old workers.
