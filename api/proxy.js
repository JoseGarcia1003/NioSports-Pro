// api/proxy.js — NioSports SaaS Proxy (WAF-light)
// - CORS dynamic allowlist (GitHub Pages + Vercel prod + previews)
// - Signed challenge token (anti-bot light, non-invasive)
// - Rate limiting per IP + per token
// - Safe endpoint allowlist
// - CSP report endpoint support (POST /api/csp-report)

const API_BASE = "https://api.balldontlie.io/v1";
const WINDOW_MS = 60_000;

// Limits
const LIMITS = {
  // Sin token (más estricto): evita bots básicos
  ipOnlyPerMin: 10,

  // Con token válido
  ipPerMin: 60,
  tokenPerMin: 120,
};

// Allow only these endpoint roots
const ALLOWED_ENDPOINTS = ["/players", "/season_averages", "/stats", "/games"];

// Allow Origins
const ALLOWED_ORIGINS = [
  "https://josegarcia1003.github.io",
  "https://nio-sports-pro.vercel.app",
];

// Allow Vercel preview origins (niosports-pros-projects.vercel.app, etc.)
const VERCEL_PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (!xf) return "unknown";
  // x-forwarded-for can contain multiple ips
  return String(xf).split(",")[0].trim() || "unknown";
}

function now() {
  return Date.now();
}

// -------- In-memory stores (serverless best-effort) --------
function getStore() {
  if (!global.__NS_STORE__) {
    global.__NS_STORE__ = {
      ipHits: new Map(), // ip -> [timestamps]
      tokenHits: new Map(), // tokenId -> [timestamps]
    };
  }
  return global.__NS_STORE__;
}

function prune(arr, t) {
  // keep only last WINDOW_MS
  const cutoff = t - WINDOW_MS;
  let i = 0;
  while (i < arr.length && arr[i] < cutoff) i++;
  if (i > 0) arr.splice(0, i);
  return arr;
}

function takeHit(map, key, t) {
  const arr = map.get(key) || [];
  prune(arr, t);
  arr.push(t);
  map.set(key, arr);
  return arr.length;
}

async function hmacSHA256(secret, payload) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  // base64url
  const bytes = new Uint8Array(sig);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  const b64 = btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return b64;
}

function b64urlEncode(obj) {
  const json = JSON.stringify(obj);
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return b64;
}

function b64urlDecode(str) {
  const s = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const json = decodeURIComponent(escape(atob(s)));
  return JSON.parse(json);
}

async function makeToken(secret, data) {
  const header = b64urlEncode({ alg: "HS256", typ: "NSJWT" });
  const payload = b64urlEncode(data);
  const toSign = `${header}.${payload}`;
  const sig = await hmacSHA256(secret, toSign);
  return `${toSign}.${sig}`;
}

async function verifyToken(secret, token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return { ok: false };
  const [h, p, sig] = parts;
  const toSign = `${h}.${p}`;
  const expected = await hmacSHA256(secret, toSign);
  if (sig !== expected) return { ok: false };
  const payload = b64urlDecode(p);
  return { ok: true, payload };
}

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return;

  const isAllowed =
    ALLOWED_ORIGINS.includes(origin) || VERCEL_PREVIEW_RE.test(origin);

  if (isAllowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-NS-Token");
    res.setHeader("Access-Control-Max-Age", "600");
  }
}

// -------- CSP report receiver (optional but useful) --------
async function readJsonBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

export default async function handler(req, res) {
  setSecurityHeaders(res);
  setCors(req, res);

  if (req.method === "OPTIONS") return res.status(204).end();

  // CSP report endpoint
  if (req.method === "POST" && req.url?.startsWith("/api/csp-report")) {
    const body = await readJsonBody(req);

    // Robust parsing (avoid your "slice of undefined")
    const report = body?.["csp-report"] || body?.["report"] || body || {};
    const violated = report["violated-directive"] || report["effective-directive"] || "unknown";
    const blocked = report["blocked-uri"] || report["blockedURL"] || report["blocked-url"] || "unknown";
    const doc = report["document-uri"] || report["documentURL"] || report["document-url"] || "unknown";

    // Log minimal (no personal data)
    console.log("[CSP]", { violated, blocked, doc });

    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip = getClientIp(req);
  const ua = String(req.headers["user-agent"] || "");

  // Very cheap sanity bot filter (no invasive fingerprinting)
  if (!ua || ua.length < 8) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const secret = process.env.NS_PROXY_SECRET || "";
  if (!secret || secret.length < 32) {
    // Fail closed for enterprise mode
    return res.status(500).json({
      error: "Server not configured: NS_PROXY_SECRET missing/weak",
    });
  }

  // 1) Token init endpoint: /api/proxy?init=1
  if (req.query?.init === "1") {
    const t = now();
    const token = await makeToken(secret, {
      v: 1,
      // token id (used for rate limiting)
      jti: crypto.randomUUID(),
      ip,
      uaHash: await hmacSHA256(secret, ua).then((x) => x.slice(0, 16)),
      iat: t,
      exp: t + 10 * 60_000, // 10 min
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ token, expiresInMs: 10 * 60_000 });
  }

  // 2) Validate signed token (recommended for all data calls)
  const nsToken = req.headers["x-ns-token"];
  let tokenOk = false;
  let tokenJti = null;

  if (nsToken) {
    const v = await verifyToken(secret, nsToken);
    if (v.ok) {
      const p = v.payload || {};
      const t = now();
      const uaHash = await hmacSHA256(secret, ua).then((x) => x.slice(0, 16));

      // Validate exp + bind token loosely to IP + UA hash (light binding)
      if (
        typeof p.exp === "number" &&
        t <= p.exp &&
        p.ip === ip &&
        p.uaHash === uaHash &&
        typeof p.jti === "string"
      ) {
        tokenOk = true;
        tokenJti = p.jti;
      }
    }
  }

  // 3) Rate limiting
  const store = getStore();
  const t = now();

  // Always rate limit by IP
  const ipCount = takeHit(store.ipHits, ip, t);

  if (!tokenOk && ipCount > LIMITS.ipOnlyPerMin) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({
      error: "Rate limit (no token). Call /api/proxy?init=1 and send X-NS-Token.",
    });
  }

  if (tokenOk) {
    if (ipCount > LIMITS.ipPerMin) {
      res.setHeader("Retry-After", "60");
      return res.status(429).json({ error: "Rate limit (ip)." });
    }

    const tokenCount = takeHit(store.tokenHits, tokenJti, t);
    if (tokenCount > LIMITS.tokenPerMin) {
      res.setHeader("Retry-After", "60");
      return res.status(429).json({ error: "Rate limit (token)." });
    }
  }

  // 4) Proxy call
  const endpoint = req.query?.endpoint;
  if (!endpoint) return res.status(400).json({ error: "Missing endpoint parameter" });

  const endpointStr = String(endpoint);

  if (!ALLOWED_ENDPOINTS.some((a) => endpointStr.startsWith(a))) {
    return res.status(403).json({ error: "Endpoint not allowed" });
  }

  // Prevent obvious SSRF tricks
  if (endpointStr.includes("http://") || endpointStr.includes("https://")) {
    return res.status(403).json({ error: "Invalid endpoint" });
  }

  try {
    const upstream = await fetch(`${API_BASE}${endpointStr}`, {
      headers: {
        Authorization: process.env.BALLDONTLIE_API_KEY,
      },
    });

    const data = await upstream.json().catch(() => null);

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
    return res.status(upstream.status).json(data ?? { error: "Upstream returned invalid JSON" });
  } catch (e) {
    return res.status(502).json({ error: "Upstream API error" });
  }
}
