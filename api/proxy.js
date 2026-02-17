// api/proxy.js — NioSports SaaS Proxy (WAF-light + adaptive RL)
// - CORS dynamic allowlist (GitHub Pages + Vercel prod + previews)
// - Signed challenge token (anti-bot light, non-invasive)
// - Adaptive rate limiting: burst + sustained (IP + token + optional user)
// - Safe endpoint allowlist
// - CSP report endpoint support (POST /api/csp-report)

const API_BASE = "https://api.balldontlie.io/v1";

// Allow only these endpoint roots
const ALLOWED_ENDPOINTS = ["/players", "/season_averages", "/stats", "/games"];

// Allow Origins
const ALLOWED_ORIGINS = [
  "https://josegarcia1003.github.io",
  "https://nio-sports-pro.vercel.app",
];

// Allow Vercel preview origins
const VERCEL_PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

// -------------------- Adaptive Rate Limit (burst + sustained) --------------------
// Burst (spikes)
const BURST_CAPACITY = 25;
const BURST_REFILL_MS = 10_000;
const BURST_REFILL_TOKENS = 25;

// Sustained (longer)
const SUSTAINED_WINDOW_MS = 10 * 60_000; // 10 min
const SUSTAINED_MAX = 180;               // per 10 min

// Token/system limits
const WINDOW_MS = 60_000; // legacy per-minute window for compatibility
const LIMITS = {
  ipOnlyPerMin: 10, // no token
  ipPerMin: 60,     // with token
  tokenPerMin: 120, // with token
};

function now() {
  return Date.now();
}

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (!xf) return "unknown";
  return String(xf).split(",")[0].trim() || "unknown";
}

function routeWeight(endpointStr) {
  // Heavier endpoints cost more
  if (endpointStr.startsWith("/stats")) return 2;
  return 1;
}

// Very cheap sanity bot filter (no invasive fingerprinting)
function basicBotRisk(req) {
  const ua = String(req.headers["user-agent"] || "");
  const al = String(req.headers["accept-language"] || "");
  const acc = String(req.headers["accept"] || "");
  let score = 0;
  if (!ua || ua.length < 8) score += 2;
  if (!al) score += 1;
  if (!acc) score += 1;
  if (/curl|wget|python|httpclient|postman/i.test(ua)) score += 2;
  return score; // 0..?
}

// -------- In-memory stores (serverless best-effort) --------
function getStore() {
  if (!global.__NS_STORE__) {
    global.__NS_STORE__ = {
      ipHits: new Map(),       // ip -> [timestamps] (legacy/min)
      tokenHits: new Map(),    // tokenId -> [timestamps] (legacy/min)

      burst: new Map(),        // key -> { tokens, last }
      sustained: new Map(),    // key -> [timestamps]
      bans: new Map(),         // key -> untilMs
    };
  }
  return global.__NS_STORE__;
}

function prune(arr, t, windowMs) {
  const cutoff = t - windowMs;
  let i = 0;
  while (i < arr.length && arr[i] < cutoff) i++;
  if (i > 0) arr.splice(0, i);
  return arr;
}

function takeHit(map, key, t) {
  const arr = map.get(key) || [];
  prune(arr, t, WINDOW_MS);
  arr.push(t);
  map.set(key, arr);
  return arr.length;
}

function isBanned(store, key) {
  const until = store.bans.get(key);
  if (!until) return false;
  if (now() > until) {
    store.bans.delete(key);
    return false;
  }
  return true;
}

function ban(store, key, ms) {
  store.bans.set(key, now() + ms);
}

// Burst token bucket
function allowBurst(store, key, weight) {
  const t = now();
  const entry = store.burst.get(key) || { tokens: BURST_CAPACITY, last: t };

  const elapsed = t - entry.last;
  if (elapsed > 0) {
    const steps = Math.floor(elapsed / BURST_REFILL_MS);
    if (steps > 0) {
      entry.tokens = Math.min(BURST_CAPACITY, entry.tokens + steps * BURST_REFILL_TOKENS);
      entry.last += steps * BURST_REFILL_MS;
    }
  }

  if (entry.tokens >= weight) {
    entry.tokens -= weight;
    store.burst.set(key, entry);
    return true;
  }

  store.burst.set(key, entry);
  return false;
}

// Sustained sliding window
function allowSustained(store, key, weight) {
  const t = now();
  const arr = store.sustained.get(key) || [];
  prune(arr, t, SUSTAINED_WINDOW_MS);

  // push 'weight' times
  for (let i = 0; i < weight; i++) arr.push(t);

  store.sustained.set(key, arr);
  return arr.length <= SUSTAINED_MAX;
}

// -------------------- Token (HMAC) --------------------
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
  const bytes = new Uint8Array(sig);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlEncode(obj) {
  const json = JSON.stringify(obj);
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
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

// -------------------- Headers --------------------
function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return;

  const isAllowed = ALLOWED_ORIGINS.includes(origin) || VERCEL_PREVIEW_RE.test(origin);

  if (isAllowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-NS-Token, X-UID");
    res.setHeader("Access-Control-Max-Age", "600");
  }
}

// -------- CSP report receiver --------
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
    const report = body?.["csp-report"] || body?.["report"] || body || {};
    const violated = report["violated-directive"] || report["effective-directive"] || "unknown";
    const blocked = report["blocked-uri"] || report["blockedURL"] || report["blocked-url"] || "unknown";
    const doc = report["document-uri"] || report["documentURL"] || report["document-url"] || "unknown";
    console.log("[CSP]", { violated, blocked, doc });
    return res.status(204).end();
  }

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const store = getStore();
  const ip = getClientIp(req);
  const ua = String(req.headers["user-agent"] || "");
  const uid = String(req.headers["x-uid"] || "").trim(); // optional

  // Basic bot sanity check
  if (!ua || ua.length < 8) return res.status(403).json({ error: "Forbidden" });

  const secret = process.env.NS_PROXY_SECRET || "";
  if (!secret || secret.length < 32) {
    return res.status(500).json({ error: "Server not configured: NS_PROXY_SECRET missing/weak" });
  }

  // 1) Token init endpoint: /api/proxy?init=1
  if (req.query?.init === "1") {
    const t = now();
    const token = await makeToken(secret, {
      v: 1,
      jti: crypto.randomUUID(),
      ip,
      uaHash: (await hmacSHA256(secret, ua)).slice(0, 16),
      iat: t,
      exp: t + 10 * 60_000
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ token, expiresInMs: 10 * 60_000 });
  }

  // 2) Validate signed token
  const nsToken = req.headers["x-ns-token"];
  let tokenOk = false;
  let tokenJti = null;

  if (nsToken) {
    const v = await verifyToken(secret, nsToken);
    if (v.ok) {
      const p = v.payload || {};
      const t = now();
      const uaHash = (await hmacSHA256(secret, ua)).slice(0, 16);

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

  // 3) Build rate limit key (IP + token + optional user)
  const key = tokenOk
    ? (uid ? `ip:${ip}|uid:${uid}|tok:${tokenJti}` : `ip:${ip}|tok:${tokenJti}`)
    : (uid ? `ip:${ip}|uid:${uid}` : `ip:${ip}`);

  // 4) Adaptive RL (burst + sustained) with risk weight
  const endpointStr = String(req.query?.endpoint || "");
  const wRoute = endpointStr ? routeWeight(endpointStr) : 1;
  const risk = basicBotRisk(req);
  const weight = Math.min(5, wRoute + Math.min(risk, 3));

  if (isBanned(store, key)) {
    res.setHeader("Retry-After", "30");
    return res.status(429).json({ error: "Too many requests. Cooldown active." });
  }

  const okBurst = allowBurst(store, key, weight);
  const okSust = allowSustained(store, key, weight);

  if (!okBurst || !okSust) {
    ban(store, key, 30_000);
    res.setHeader("Retry-After", "30");
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  // 5) Legacy per-minute limits (kept for compatibility)
  const t = now();
  const ipCount = takeHit(store.ipHits, ip, t);

  if (!tokenOk && ipCount > LIMITS.ipOnlyPerMin) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({
      error: "Rate limit (no token). Call /api/proxy?init=1 and send X-NS-Token."
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

  // 6) Proxy call
  if (!endpointStr) return res.status(400).json({ error: "Missing endpoint parameter" });

  if (!ALLOWED_ENDPOINTS.some((a) => endpointStr.startsWith(a))) {
    return res.status(403).json({ error: "Endpoint not allowed" });
  }

  // Prevent SSRF tricks
  if (endpointStr.includes("http://") || endpointStr.includes("https://")) {
    return res.status(403).json({ error: "Invalid endpoint" });
  }

  try {
    const rawKey = String(process.env.BALLDONTLIE_API_KEY || "").trim();
    if (!rawKey) {
      return res.status(500).json({
        error: "Server not configured: BALLDONTLIE_API_KEY missing",
        hint: "Add BALLDONTLIE_API_KEY in Vercel project env vars (All Environments)."
      });
    }

    // balldontlie expects: Authorization: Bearer <key>
    const authHeader = /^bearer\s+/i.test(rawKey) ? rawKey : `Bearer ${rawKey}`;

    const upstream = await fetch(`${API_BASE}${endpointStr}`, {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        "User-Agent": "NioSports-Pro-Proxy/1.0"
      }
    });

    // Try JSON first; if it isn't JSON (HTML/text), return a clean error.
    const text = await upstream.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");

    if (data === null) {
      return res.status(upstream.status).json({
        error: "Upstream returned invalid JSON",
        upstreamStatus: upstream.status,
        // keep it short so we don't leak anything sensitive
        upstreamSnippet: String(text || "").slice(0, 200)
      });
    }

    return res.status(upstream.status).json(data);
  } catch {
    return res.status(502).json({ error: "Upstream API error" });
  }
}
