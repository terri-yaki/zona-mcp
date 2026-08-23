# Zona MCP

An [MCP](https://modelcontextprotocol.io) server that sends alerts to the
[Zona](https://gist.github.com/terri-yaki/b1cdbf91263f139f928de292f788d5bc)
inbox from an AI CLI. The source token is read locally and never printed.

## Tools

| Tool | Purpose |
| --- | --- |
| `zona_status` | Whether a token is configured. Never returns the token. |
| `zona_ping` | Short connectivity check. |
| `zona_notify` | Send an alert. Optional `category`, `severity`, and up to five PNG/JPEG/WebP images. |

## Requirements

- Node.js 20+ (`fetch`, `FormData`, and `crypto.randomUUID`).

## Install

```sh
cd mcp
npm ci
```

## Configuration

### Grok

```toml
[mcp_servers.zona]
command = "node"
args = ["/absolute/path/to/mcp/server.mjs"]
enabled = true
```

On Windows, set `MSYS = "noglob"` in `[mcp_servers.zona.env]` if you use MSYS.

### Claude / Cursor / other stdio hosts

```json
{
  "mcpServers": {
    "zona": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/server.mjs"]
    }
  }
}
```

Restart the CLI after changing MCP config.

## Token

In the Zona app, open **Sources**, create a source (or a new key), copy the
`zona_live_...` token once, and save it as a single line in:

```text
~/.zona/token
```

On Windows that is `%USERPROFILE%\.zona\token`. Treat it like a password. You
can also set `ZONA_SOURCE_TOKEN`.

## HTTP (no MCP)

```http
POST https://gerncrjtrdjtjvybvseb.supabase.co/functions/v1/notify
Authorization: Bearer zona_live_YOUR_SOURCE_TOKEN
Idempotency-Key: unique-event-id
Content-Type: application/json
```

```json
{
  "title": "Build complete",
  "body": "The release finished.",
  "category": "build",
  "severity": "medium"
}
```

Pictures use `multipart/form-data` and repeat the `attachment` part once per
file (max five). Full sender guide:
[Send alerts to Zona](https://gist.github.com/terri-yaki/b1cdbf91263f139f928de292f788d5bc).

## Agent skill

`SKILL.md` in this folder is the prompt for AI CLIs (`/zona`). Copy it into the
host's skills directory.

## License

[MIT](LICENSE)
