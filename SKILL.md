---
name: zona
description: >
  Send inbox notifications through Zona and operate the Zona MCP.
  Use when the user wants a Zona ping, phone alert, /notify send, agent
  notification, source token, attachments on a Zona send, or runs /zona.
---

# Zona

Zona is a private notification inbox. Agents send an HTTPS request with a
source token. Keep copy short and never include secrets.

## Secrets

- Token file: `~/.zona/token` (one `zona_live_...` line). Windows:
  `%USERPROFILE%\.zona\token`.
- Optional override: env `ZONA_SOURCE_TOKEN`.
- Never print, log, commit, or put the token in URLs, README, or tool args.
- If the file is missing or `/notify` returns `INVALID_TOKEN`, ask the owner to
  create a new source key in the app and replace the file. Do not search the
  workspace for tokens.

## Prefer the MCP

When the `zona` MCP server is connected, use its tools instead of curling:

| Tool | When |
| --- | --- |
| `zona_status` | Check a token is configured (it does not return the token). |
| `zona_notify` | Real send: title, body, optional category, severity, up to five image paths. |
| `zona_ping` | Connectivity check. |

Call the host's MCP tool with the `zona__…` qualified name it exposes. Do not
invent a token argument.

## Direct HTTP (MCP unavailable)

```
POST https://gerncrjtrdjtjvybvseb.supabase.co/functions/v1/notify
Authorization: Bearer <token from the file, never logged>
Idempotency-Key: <required unique key>
```

JSON body: `title` (1–120), `body` (1–2000), optional `category` (≤80),
`severity` (`low|medium|high|critical`), `data` object ≤4 KiB.

Images: `multipart/form-data`, repeat the `attachment` part once per PNG/JPEG/WebP
file, max five.

Quiet hours still save the alert in the inbox; only the phone banner is skipped.

## When to send

Send after a user-asked Zona alert or a completed long job the owner asked to
be notified about. Keep copy short and non-secret.
