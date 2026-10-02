FROM ghcr.io/c4illin/convertx@sha256:8590a21a16adb8514a8be55b74ad0112bf58ba772328a53f7b40528fcf8fa013
USER root
RUN apt-get update && apt-get install -y --no-install-recommends python3-fonttools python3-brotli fontforge-nox && rm -rf /var/lib/apt/lists/*
USER 1000:1000
