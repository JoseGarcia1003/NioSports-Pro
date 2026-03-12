// api/proxy.js — NioSports SaaS Proxy v2 (Upstash Redis rate limiting)
// ════════════════════════════════════════════════════════════════
// @vercel/kv fue deprecado por Vercel — migrado a @upstash/redis,
// que es el proveedor oficial recomendado desde Vercel Marketplace.
// La API es compatible: get/set/incr/incrby/expire tienen la misma firma.
//
// VARIABLES DE ENTORNO requeridas (auto-inyectadas al conectar Upstash):
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
//
// FALLBACK: si no están configuradas (dev local), usa Maps en memoria.
// ════════════════════════════════════════════════════════════════

import { Redis } from "@upstash/redis";

// Cliente Redis — inicialización lazy (solo si las vars están presentes)
let _redis = null;
function getRedis() {
  if (_redis) return _redis;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    _redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis; // null en dev local → usa fallback en memoria
}

// ── Configuración ─────────────────────────────────────────────────
const API_BASE          = "https://api.balldontlie.io/v1";
const ALLOWED_ENDPOINTS = ["/players", "/season_averages", "/stats", "/games"];
const ALLOWED_ORIGINS   = [
  "https://josegarcia1003.github.io",
  "https://nio-sports-pro.vercel.app",
];
const VERCEL_PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

const BURST_CAPACITY      = 25;
const BURST_REFILL_MS     = 10_000;
const BURST_REFILL_TOKENS = 25;
const SUSTAINED_WINDOW_MS = 10 * 60_000;
const SUSTAINED_MAX       = 180;
const WINDOW_MS           = 60_000;
const LIMITS = { ipOnlyPerMin: 10, ipPerMin: 60, tokenPerMin: 120 };
const BAN_TTL_S   = 30;
const BURST_TTL_S = 300;

// ── Fallback en memoria (dev local sin Redis) ─────────────────────
function getMemStore() {
  if (!global.__NS_MEM_STORE__) {
    global.__NS_MEM_STORE__ = {
      burst: new Map(), sustained: new Map(),
      bans:  new Map(), ipHits:    new Map(), tokenHits: new Map(),
    };
  }
  return global.__NS_MEM_STORE__;
}

// ════════════════════════════════════════════════════════════════
// CAPA DE RATE LIMITING
// Cada función intenta Redis primero. Si getRedis() devuelve null,
// cae al store en memoria — comportamiento transparente para el handler.
// ════════════════════════════════════════════════════════════════

async function isBanned(key) {
  const r = getRedis();
  if (r) return !!(await r.get(`ban:${key}`));
  const store = getMemStore();
  const until = store.bans.get(key);
  if (!until) return false;
  if (Date.now() > until) { store.bans.delete(key); return false; }
  return true;
}

async function banKey(key) {
  const r = getRedis();
  if (r) { await r.set(`ban:${key}`, 1, { ex: BAN_TTL_S }); return; }
  getMemStore().bans.set(key, Date.now() + BAN_TTL_S * 1000);
}

async function allowBurst(key, weight) {
  const r = getRedis();
  if (r) {
    const storeKey = `burst:${key}`;
    const t = Date.now();
    let entry = await r.get(storeKey);
    if (!entry) entry = { tokens: BURST_CAPACITY, last: t };
    const steps = Math.floor((t - entry.last) / BURST_REFILL_MS);
    if (steps > 0) {
      entry.tokens = Math.min(BURST_CAPACITY, entry.tokens + steps * BURST_REFILL_TOKENS);
      entry.last  += steps * BURST_REFILL_MS;
    }
    const allowed = entry.tokens >= weight;
    if (allowed) entry.tokens -= weight;
    await r.set(storeKey, entry, { ex: BURST_TTL_S });
    return allowed;
  }
  // Fallback memoria
  const store = getMemStore();
  const t     = Date.now();
  const entry = store.burst.get(key) || { tokens: BURST_CAPACITY, last: t };
  const steps = Math.floor((t - entry.last) / BURST_REFILL_MS);
  if (steps > 0) {
    entry.tokens = Math.min(BURST_CAPACITY, entry.tokens + steps * BURST_REFILL_TOKENS);
    entry.last  += steps * BURST_REFILL_MS;
  }
  const allowed = entry.tokens >= weight;
  if (allowed) entry.tokens -= weight;
  store.burst.set(key, entry);
  return allowed;
}

async function allowSustained(key, weight) {
  const r = getRedis();
  if (r) {
    const winIdx   = Math.floor(Date.now() / SUSTAINED_WINDOW_MS);
    const storeKey = `sust:${key}:${winIdx}`;
    const count    = await r.incrby(storeKey, weight);
    if (count === weight) await r.expire(storeKey, Math.ceil(SUSTAINED_WINDOW_MS / 1000) * 2);
    return count <= SUSTAINED_MAX;
  }
  // Fallback memoria
  const store  = getMemStore();
  const t      = Date.now();
  const arr    = store.sustained.get(key) || [];
  const cutoff = t - SUSTAINED_WINDOW_MS;
  let i = 0;
  while (i < arr.length && arr[i] < cutoff) i++;
  if (i > 0) arr.splice(0, i);
  for (let j = 0; j < weight; j++) arr.push(t);
  store.sustained.set(key, arr);
  return arr.length <= SUSTAINED_MAX;
}

async function takeHit(prefix, key) {
  const r = getRedis();
  if (r) {
    const minIdx   = Math.floor(Date.now() / WINDOW_MS);
    const storeKey = `${prefix}:min:${key}:${minIdx}`;
    const count    = await r.incr(storeKey);
    if (count === 1) await r.expire(storeKey, 120);
    return count;
  }
  // Fallback memoria
  const store  = getMemStore();
  const map    = prefix === 'ip' ? store.ipHits : store.tokenHits;
  const t      = Date.now();
  const arr    = map.get(key) || [];
  const cutoff = t - WINDOW_MS;
  let i = 0;
  while (i < arr.length && arr[i] < cutoff) i++;
  if (i > 0) arr.splice(0, i);
  arr.push(t); map.set(key, arr);
  return arr.length;
}

// ════════════════════════════════════════════════════════════════
// HMAC / Token (sin cambios)
// ════════════════════════════════════════════════════════════════
async function hmacSHA256(secret, payload) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const bytes = new Uint8Array(sig); let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64urlEncode(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64urlDecode(str) {
  const s = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  return JSON.parse(decodeURIComponent(escape(atob(s))));
}
async function makeToken(secret, data) {
  const h = b64urlEncode({ alg: "HS256", typ: "NSJWT" });
  const p = b64urlEncode(data);
  return `${h}.${p}.${await hmacSHA256(secret, `${h}.${p}`)}`;
}
async function verifyToken(secret, token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return { ok: false };
  const [h, p, sig] = parts;
  if (sig !== await hmacSHA256(secret, `${h}.${p}`)) return { ok: false };
  return { ok: true, payload: b64urlDecode(p) };
}

// ── Headers / CORS ────────────────────────────────────────────────
function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (!xf) return "unknown";
  return String(xf).split(",")[0].trim() || "unknown";
}
function routeWeight(ep) { return ep.startsWith("/stats") ? 2 : 1; }
function basicBotRisk(req) {
  const ua = String(req.headers["user-agent"]      || "");
  const al = String(req.headers["accept-language"] || "");
  const ac = String(req.headers["accept"]          || "");
  let s = 0;
  if (!ua || ua.length < 8)                             s += 2;
  if (!al)                                              s += 1;
  if (!ac)                                              s += 1;
  if (/curl|wget|python|httpclient|postman/i.test(ua)) s += 2;
  return s;
}
function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
}
function setCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return;
  if (ALLOWED_ORIGINS.includes(origin) || VERCEL_PREVIEW_RE.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin",  origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-NS-Token, X-UID");
    res.setHeader("Access-Control-Max-Age",       "600");
  }
}
async function readJsonBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return { raw }; }
}

// ════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ════════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  setSecurityHeaders(res);
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  // CSP report endpoint
  if (req.method === "POST" && req.url?.startsWith("/api/csp-report")) {
    const body = await readJsonBody(req);
    const r    = body?.["csp-report"] || body?.["report"] || body || {};
    console.log("[CSP]", {
      violated: r["violated-directive"] || r["effective-directive"] || "unknown",
      blocked:  r["blocked-uri"]  || r["blockedURL"]  || "unknown",
      doc:      r["document-uri"] || r["documentURL"] || "unknown",
    });
    return res.status(204).end();
  }

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const ip  = getClientIp(req);
  const ua  = String(req.headers["user-agent"] || "");
  const uid = String(req.headers["x-uid"] || "").trim();

  if (!ua || ua.length < 8) return res.status(403).json({ error: "Forbidden" });

  const secret = process.env.NS_PROXY_SECRET || "";
  if (!secret || secret.length < 32)
    return res.status(500).json({ error: "Server not configured: NS_PROXY_SECRET missing/weak" });

  // Token init
  if (req.query?.init === "1") {
    const t = Date.now();
    const token = await makeToken(secret, {
      v: 1, jti: crypto.randomUUID(), ip,
      uaHash: (await hmacSHA256(secret, ua)).slice(0, 16),
      iat: t, exp: t + 10 * 60_000
    });
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ token, expiresInMs: 10 * 60_000 });
  }

  // Validar token HMAC
  const nsToken = req.headers["x-ns-token"];
  let tokenOk = false, tokenJti = null;
  if (nsToken) {
    const v = await verifyToken(secret, nsToken);
    if (v.ok) {
      const p      = v.payload || {};
      const uaHash = (await hmacSHA256(secret, ua)).slice(0, 16);
      if (typeof p.exp === "number" && Date.now() <= p.exp &&
          p.ip === ip && p.uaHash === uaHash && typeof p.jti === "string") {
        tokenOk = true; tokenJti = p.jti;
      }
    }
  }

  // Clave compuesta de rate limit
  const rlKey = tokenOk
    ? (uid ? `ip:${ip}|uid:${uid}|tok:${tokenJti}` : `ip:${ip}|tok:${tokenJti}`)
    : (uid ? `ip:${ip}|uid:${uid}` : `ip:${ip}`);

  const endpointStr = String(req.query?.endpoint || "");
  const weight      = Math.min(5, routeWeight(endpointStr) + Math.min(basicBotRisk(req), 3));

  if (await isBanned(rlKey)) {
    res.setHeader("Retry-After", String(BAN_TTL_S));
    return res.status(429).json({ error: "Too many requests. Cooldown active." });
  }

  const [okBurst, okSust] = await Promise.all([
    allowBurst(rlKey, weight),
    allowSustained(rlKey, weight),
  ]);
  if (!okBurst || !okSust) {
    await banKey(rlKey);
    res.setHeader("Retry-After", String(BAN_TTL_S));
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  const ipCount = await takeHit('ip', ip);
  if (!tokenOk && ipCount > LIMITS.ipOnlyPerMin) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Rate limit (no token). Call /api/proxy?init=1." });
  }
  if (tokenOk) {
    if (ipCount > LIMITS.ipPerMin) {
      res.setHeader("Retry-After", "60");
      return res.status(429).json({ error: "Rate limit (ip)." });
    }
    const tokenCount = await takeHit('tok', tokenJti);
    if (tokenCount > LIMITS.tokenPerMin) {
      res.setHeader("Retry-After", "60");
      return res.status(429).json({ error: "Rate limit (token)." });
    }
  }

  if (!endpointStr) return res.status(400).json({ error: "Missing endpoint parameter" });
  if (!ALLOWED_ENDPOINTS.some((a) => endpointStr.startsWith(a)))
    return res.status(403).json({ error: "Endpoint not allowed" });
  if (endpointStr.includes("http://") || endpointStr.includes("https://"))
    return res.status(403).json({ error: "Invalid endpoint" });

  try {
    const rawKey = String(process.env.BALLDONTLIE_API_KEY || "").trim();
    if (!rawKey)
      return res.status(500).json({
        error: "Server not configured: BALLDONTLIE_API_KEY missing",
        hint:  "Add BALLDONTLIE_API_KEY in Vercel project env vars."
      });

    const authHeader = /^bearer\s+/i.test(rawKey) ? rawKey : `Bearer ${rawKey}`;
    const upstream   = await fetch(`${API_BASE}${endpointStr}`, {
      headers: { Authorization: authHeader, Accept: "application/json", "User-Agent": "NioSports-Pro-Proxy/2.1" }
    });

    const text = await upstream.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
    if (data === null)
      return res.status(upstream.status).json({
        error:           "Upstream returned invalid JSON",
        upstreamStatus:  upstream.status,
        upstreamSnippet: String(text || "").slice(0, 200)
      });

    return res.status(upstream.status).json(data);
  } catch {
    return res.status(502).json({ error: "Upstream API error" });
  }
}
