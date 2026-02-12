// api/telemetry.js — Sentry tunnel (keeps CSP tight: connect-src 'self')
// Forwards Sentry envelopes to Sentry ingest endpoint.

const SENTRY_INGEST_ENVELOPE_URL =
  "https://o4510870707765248.ingest.us.sentry.io/api/4510870715760640/envelope/";

// Tiny in-memory rate limit to avoid abuse of the tunnel (best-effort in serverless).
const RL_WINDOW_MS = 60_000;
const RL_MAX_PER_IP = 120;

function getIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (!xf) return "unknown";
  return String(xf).split(",")[0].trim() || "unknown";
}

function rateLimitOk(ip) {
  if (!globalThis.__telemetryRL) globalThis.__telemetryRL = new Map();
  const now = Date.now();

  const entry = globalThis.__telemetryRL.get(ip) || { ts: now, n: 0 };
  if (now - entry.ts > RL_WINDOW_MS) {
    entry.ts = now;
    entry.n = 0;
  }
  entry.n += 1;
  globalThis.__telemetryRL.set(ip, entry);

  return entry.n <= RL_MAX_PER_IP;
}

export default async function handler(req, res) {
  // CORS: same-origin only (tunnel should be used by your site)
  const origin = req.headers.origin || "";
  const allow = [
    "https://nio-sports-pro.vercel.app",
    "https://nio-sports-pro-git-main-niosports-pros-projects.vercel.app",
    "https://josegarcia1003.github.io"
  ];
  if (allow.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Max-Age", "600");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = getIp(req);
  if (!rateLimitOk(ip)) {
    // Don't leak details; Sentry SDK will drop this.
    return res.status(429).end("rate_limited");
  }

  // Limit payload size (Sentry envelopes can be big; keep reasonable)
  const MAX_BYTES = 1_000_000; // 1MB
  try {
    const chunks = [];
    let size = 0;

    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BYTES) {
        return res.status(413).end("payload_too_large");
      }
      chunks.push(chunk);
    }

    const body = Buffer.concat(chunks);

    // Forward as-is. Keep Content-Type.
    const upstream = await fetch(SENTRY_INGEST_ENVELOPE_URL, {
      method: "POST",
      headers: {
        "Content-Type": req.headers["content-type"] || "text/plain;charset=UTF-8"
      },
      body
    });

    // Sentry is okay with 200 even if upstream fails; we keep app stable.
    // But we can pass through for debugging:
    res.status(upstream.ok ? 200 : 502).end("ok");
  } catch (e) {
    res.status(200).end("ok");
  }
}
