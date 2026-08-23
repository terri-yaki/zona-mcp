#!/usr/bin/env node
/**
 * Zona MCP — stdio server for sending inbox notifications.
 * Reads the source token from %USERPROFILE%\.zona\token (or ZONA_SOURCE_TOKEN).
 * Never writes the token to stdout, stderr, or tool results.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DEFAULT_URL =
  "https://gerncrjtrdjtjvybvseb.supabase.co/functions/v1/notify";
const TOKEN_PATH = join(homedir(), ".zona", "token");

function sanitizeError(message) {
  return String(message ?? "request failed")
    .replace(/zona_live_[A-Za-z0-9_-]+/g, "zona_live_[redacted]")
    .replaceAll(homedir(), "~");
}

async function loadToken() {
  const fromEnv = process.env.ZONA_SOURCE_TOKEN?.trim();
  if (fromEnv) {
    if (!fromEnv.startsWith("zona_live_")) {
      throw new Error("ZONA_SOURCE_TOKEN is not a Zona source token.");
    }
    return fromEnv;
  }
  const raw = await readFile(TOKEN_PATH, "utf8");
  const token = raw.trim();
  if (!token.startsWith("zona_live_")) {
    throw new Error("Zona token file is missing or not a source token.");
  }
  return token;
}

async function notify({
  title,
  body,
  category,
  severity,
  idempotencyKey,
  attachments,
  data,
}) {
  const token = await loadToken();
  const url = process.env.ZONA_NOTIFY_URL?.trim() || DEFAULT_URL;
  const key = idempotencyKey?.trim() || `mcp-${crypto.randomUUID()}`;
  const files = (attachments ?? []).filter(Boolean).slice(0, 5);

  const headers = {
    authorization: `Bearer ${token}`,
    "idempotency-key": key,
  };

  let payload;
  if (files.length > 0) {
    const form = new FormData();
    form.set("title", title);
    form.set("body", body);
    if (category) form.set("category", category);
    if (severity) form.set("severity", severity);
    form.set(
      "data",
      JSON.stringify(data && typeof data === "object" ? data : { sender: "zona-mcp" }),
    );
    for (const filePath of files) {
      const bytes = await readFile(filePath);
      form.append("attachment", new File([bytes], basename(filePath)));
    }
    payload = form;
  } else {
    headers["content-type"] = "application/json";
    payload = JSON.stringify({
      title,
      body,
      ...(category ? { category } : {}),
      ...(severity ? { severity } : {}),
      data: data && typeof data === "object" ? data : { sender: "zona-mcp" },
    });
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: payload,
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, result };
}

const server = new McpServer({
  name: "zona",
  version: "1.0.0",
});

server.registerTool(
  "zona_status",
  {
    title: "Zona MCP status",
    description:
      "Check that the local Zona source-token file exists. Never returns the token.",
  },
  async () => {
    let tokenFile = false;
    try {
      await loadToken();
      tokenFile = true;
    } catch {
      tokenFile = false;
    }
    const text = JSON.stringify(
      {
        tokenFile,
        tokenPath: TOKEN_PATH,
        notifyUrl: process.env.ZONA_NOTIFY_URL?.trim() || DEFAULT_URL,
        hint: tokenFile
          ? "Ready to send. Use zona_notify or zona_ping."
          : "Create a source in the Zona app, then write the zona_live_ token to the token file (one line, no quotes).",
      },
      null,
      2,
    );
    return { content: [{ type: "text", text }] };
  },
);

server.registerTool(
  "zona_notify",
  {
    title: "Send a Zona notification",
    description:
      "Send an inbox notification to the owner's Zona app. Title 1-120 chars, body 1-2000. Optional category, severity (low|medium|high|critical), up to five PNG/JPEG/WebP attachment paths, and an idempotency key. Do not put secrets in title, body, or data.",
    inputSchema: {
      title: z.string().min(1).max(120),
      body: z.string().min(1).max(2000),
      category: z.string().min(1).max(80).optional(),
      severity: z.enum(["low", "medium", "high", "critical"]).optional(),
      idempotencyKey: z.string().min(1).max(128).optional(),
      attachments: z.array(z.string()).max(5).optional(),
    },
  },
  async ({ title, body, category, severity, idempotencyKey, attachments }) => {
    try {
      const { ok, status, result } = await notify({
        title,
        body,
        category,
        severity,
        idempotencyKey,
        attachments,
      });
      const summary = {
        ok,
        status,
        notificationId: result.notificationId ?? null,
        sourceName: result.sourceName ?? null,
        idempotentReplay: result.idempotentReplay ?? null,
        attachmentAccepted: result.attachmentAccepted ?? null,
        pushAttempted: result.pushAttempted ?? null,
        pushAccepted: result.pushAccepted ?? null,
        error: result.error ?? null,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
        isError: !ok,
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: sanitizeError(err.message) }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  "zona_ping",
  {
    title: "Ping Zona",
    description:
      "Send a short test notification to confirm the local token and /notify path work.",
    inputSchema: {
      title: z.string().min(1).max(120).optional(),
      body: z.string().min(1).max(2000).optional(),
    },
  },
  async ({ title, body }) => {
    try {
      const { ok, status, result } = await notify({
        title: title || `Zona ping ${new Date().toISOString().slice(11, 19)}`,
        body: body || "MCP ping from this machine.",
        category: "demo",
      });
      const summary = {
        ok,
        status,
        notificationId: result.notificationId ?? null,
        sourceName: result.sourceName ?? null,
        idempotentReplay: result.idempotentReplay ?? null,
        pushAccepted: result.pushAccepted ?? null,
        error: result.error ?? null,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
        isError: !ok,
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: sanitizeError(err.message) }],
        isError: true,
      };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
