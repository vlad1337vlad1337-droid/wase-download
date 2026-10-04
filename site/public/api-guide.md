# Wase Download: API and agent guide

Wase Download is a self-hosted file converter. It requires no account or third-party conversion API key. Public conversion instructions are static localized HTML and are readable without executing the app. File conversion is a separate operation that uploads a file when the user chooses server processing.

## Capabilities and evidence

The deployed build declares **885 input identifiers**, **517 output identifiers** and **143995 directional combinations** after filtering devices, pseudo-formats and ordinary still-image-to-video synthesis. Targets depend on the input; formats are not an all-to-all matrix.

**3058 published directions** have representative-fixture validation and successful HTTP conversion evidence. This is not a guarantee for every file, codec, font, document feature, animation or visual result. The full published list is [verified-conversions.json](https://wase.download/verified-conversions.json). Its evidence is historical representative testing, not a live health check of every pair.

- [Static catalogue](https://wase.download/formats.json): public declarations from this build.
- [Runtime catalogue](https://wase.download/api/formats): declarations reported by the running broker.
- [Human format directory](https://wase.download/en/formats/): tested conversion pages and the declared catalogue.
- [Audit source](https://github.com/vlad1337vlad1337-droid/wase-download/tree/master/deploy/seo): receipts, fixture coverage and known gaps.

Both catalogues use `inputs`, `groups`, `categories` and `limits`. To obtain a source's targets, read `groups[inputs[source]]`. An unknown source has no group. Identifiers are exact lower-case strings: for example `jpg`, `jpeg` and `tar.gz` are catalogue keys, not MIME types. JPG/JPEG may have different declared target lists; select a key actually present in the catalogue instead of assuming universal aliases. Neither MIME sniffing nor a filename extension proves a file is valid.

## Read-only MCP discovery

Endpoint: **https://wase.download/api/mcp**. It is stateless Streamable HTTP using JSON-RPC 2.0 and JSON responses. There are exactly two public tools: `list_formats` and `conversion_info`. They read metadata only. They do not accept file bytes or file URLs, start conversion jobs, run commands, create download links, or expose user files.

Use the official MCP client to initialize and negotiate a supported protocol version. The implementation supports `2025-06-18`, `2025-03-26` and `2024-11-05`; these examples use `2025-06-18`. It does not open an SSE stream: GET returns 405. POST notifications without an id return 202 with no body. No persistent session id is required.

Initialize:

```sh
curl --fail --max-time 15 'https://wase.download/api/mcp' \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json, text/event-stream' \
  --header 'MCP-Protocol-Version: 2025-06-18' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"wase-discovery-example","version":"1.0.0"}}}'
```

Send the initialized notification after the initialization response, then discover tools:

```sh
curl --fail --max-time 15 'https://wase.download/api/mcp' \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json, text/event-stream' \
  --header 'MCP-Protocol-Version: 2025-06-18' \
  --data '{"jsonrpc":"2.0","method":"notifications/initialized"}'
curl --fail --max-time 15 'https://wase.download/api/mcp' \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json, text/event-stream' \
  --header 'MCP-Protocol-Version: 2025-06-18' \
  --data '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

Find declared inputs in the image category:

```sh
curl --fail --max-time 15 'https://wase.download/api/mcp' \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json, text/event-stream' \
  --header 'MCP-Protocol-Version: 2025-06-18' \
  --data '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_formats","arguments":{"category":"image","limit":20}}}'
```

`list_formats` accepts optional `category`, `query`, `offset` and `limit`. Categories are `image`, `vector`, `document`, `ebook`, `audio`, `archive`, `video`, `presentation`, `font` and `cad`. Default limit is 40, maximum 100; query/category strings are at most 32 characters. `nextOffset` is null on the last page. The result's `formats[].outputs` is a declared output count, not a tested count.

Check PNG to SVG, or omit `to` to list a source's declared outputs:

```sh
curl --fail --max-time 15 'https://wase.download/api/mcp' \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json, text/event-stream' \
  --header 'MCP-Protocol-Version: 2025-06-18' \
  --data '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"conversion_info","arguments":{"from":"png","to":"svg"}}}'
```

Read `result.structuredContent` directly. It is also serialized in `result.content[0].text`. A pair result contains `declared: true` or `false`; that field does not mean a representative or arbitrary file was tested. Unknown sources and unsupported pairs return `declared: false`, not an instruction to upload anyway. A JSON-RPC `error` can be returned with HTTP 200; inspect both the HTTP status and the JSON body.

MCP requests are limited to 16 KiB with bounded body read time, per-client/global request rates and connection occupancy. Unknown tools/arguments and JSON-RPC batches are rejected. Unapproved browser Origin values receive 403. Rate limiting returns 429 and `Retry-After: 60`. Discovery is public, but clients should reuse metadata and avoid repeated polling.

## Explicit file conversion over HTTP

The MCP tools cannot convert. The separate HTTP upload operation is:

```text
POST https://wase.download/api/convert?from=png&to=svg
Content-Type: application/octet-stream
Body: one file's original binary bytes
```

Use this operation only when the user has chosen the file and authorized uploading it for conversion. No remote URL fetching is implemented. There is no multipart form, remote-file URL parameter, API token requirement or separate polling/download endpoint. Browser cross-origin requests are restricted by Origin checks.

Example with a user-selected local file, after checking the pair:

```sh
curl --fail --max-time 210 \
  --request POST 'https://wase.download/api/convert?from=png&to=svg' \
  --header 'Content-Type: application/octet-stream' \
  --data-binary '@input.png' \
  --dump-header response.headers \
  --output result.bin
```

Verify curl succeeded and the response is HTTP 200 before treating the output as a converted file. Read `Content-Disposition` for the result filename. A single result normally uses `application/octet-stream`, even when its extension is SVG, PNG, PDF or another type. Multi-file exports return a ZIP with `application/zip`; do not assume the requested target guarantees the response is a single file or infer the result solely from Content-Type. Validate a downloaded file before opening it in another tool. Conversion credit identifies Wase Download and does not transfer ownership of the input.

The server limit is **100 MiB per input file** and **200 MiB aggregate output**, with one active conversion and at most eight waiting jobs on the current deployment. The app permits **20 files per UI batch**, processed one by one; a single HTTP upload request still contains one file. The total server request deadline is 180 seconds, so resource-limited large files may fail or disconnect rather than complete immediately. Do not repeatedly retry an expensive failed conversion.

The optional browser-only image fallback is a separate narrower path: 20 MiB per file, 16 megapixels and an 8192-pixel edge, with bounded tracing resolution. It is not a general API for documents, archives, video or CAD. It processes supported images on the visitor's device. Browser and server results or available targets may differ. Photos traced to SVG are approximations, not lossless vector images.

### Error handling

- **400**: the `from`/`to` pair is absent from the public runtime catalogue.
- **403**: an unapproved Origin header was supplied.
- **413**: the request exceeds the input limit.
- **422**: the supplied file could not be converted/validated, or no engine produced a safe valid output. Try a valid smaller file or another declared output; do not claim success.
- **429**: rate, occupancy or waiting-queue limit. Honor `Retry-After` (currently 60 seconds) and avoid parallel retries.
- **404**: unknown API path/method outside the supported discovery route.
- **405/415 on MCP**: method or request Content-Type is unsupported.
- **500 or interrupted connection**: unexpected failure, cancellation or a deadline; no result is guaranteed. Do not present partial bytes as a completed conversion.

## File privacy and retention

Temporary server inputs and outputs are deleted after success, cancellation or error cleanup. There is no public user-file URL, persistent history or resumable download id; the converted output is returned in the original response. Conversion containers have networking disabled and bounded CPU/memory. Browsing documentation or calling MCP discovery does not upload files. Browser-only image processing remains local. A client that uploads through the HTTP API is using server processing, not local processing. See the [privacy policy](https://wase.download/en/privacy/) for the site and optional analytics.

## Discovery and indexing

Localized HTML, normal internal links, canonical URLs, reciprocal language alternatives and [Sitemap](https://wase.download/sitemap.xml) are the normal web-discovery surface. The [llms.txt index](https://wase.download/llms.txt) and this plain-text guide are optional aids for agents. The llms.txt format is a community proposal; it is not a universal crawler protocol, provider registration, ranking signal or promise of indexing/citation. Different search and AI providers choose what to crawl, index or cite.

## Standards and source

- [MCP transport specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [MCP tools specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [llms.txt proposal](https://llmstxt.org/)
- [Project source and licenses](https://github.com/vlad1337vlad1337-droid/wase-download)
