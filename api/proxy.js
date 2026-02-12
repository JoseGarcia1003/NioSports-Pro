// api/proxy.js — Enterprise proxy for BallDontLie (Vercel Serverless)
// Usage: /api/proxy?endpoint=/players?search=LeBron
//
// Goals:
// - Hide API key (server-side only)
// - Strict allowlist for endpoints
// - Smart-ish rate limiting (best-effort on serverless)
// - Anti-abuse: origin checks + input validation
//
// NOTE: In-memory rate limiting resets on cold starts and is per-instance.
// For true enterprise rate limiting, plug in a shared store (e.g., Vercel KV / Redis).

const ALLOWED_ORIGINS = new Set([
  'https://nio-sports-pro.vercel.app',
  // Your project's "git-main" preview domain (keep if you still use it):
  'https://nio-sports-pro-git-main-niosports-pros-projects.vercel.app',
  // Preview deployment domain:
  'https://nio-sports-fuiqpd7p6-niosports-pros-projects.vercel.app',
  // GitHub Pages (if you still serve there):
  'https://josegarcia1003.github.io'
]);

const ALLOWED_PREFIXES = ['/players', '/season_averages', '/stats', '/games'];

// Rate limit settings
const WINDOW_MS = 60_000;      // 1 minute
const LIMIT_OK_ORIGIN = 60;    // per minute per IP when origin is trusted
const LIMIT_NO_ORIGIN = 10;    // per minute per IP when origin is missing/unknown

/**
 * Extrae la IP real del cliente desde headers de Vercel
 */
function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  const vff = req.headers['x-vercel-forwarded-for'];
  if (typeof vff === 'string' && vff.length > 0) return vff.trim();
  return 'unknown';
}

/**
 * Valida que el endpoint solicitado esté en la whitelist y no contenga ataques
 */
function isAllowedEndpoint(endpoint) {
  if (typeof endpoint !== 'string') return false;
  if (!endpoint.startsWith('/')) return false;
  if (endpoint.length > 400) return false; // prevent huge abuse payloads
  if (endpoint.includes('..')) return false;
  if (endpoint.includes('://')) return false;
  return ALLOWED_PREFIXES.some(p => endpoint.startsWith(p));
}

/**
 * Verifica si el origen de la petición está permitido (CORS)
 */
function pickAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && ALLOWED_ORIGINS.has(origin)) return origin;

  // Fallback: allow based on Referer host if Origin is missing (some browsers in some cases)
  const ref = req.headers.referer;
  if (typeof ref === 'string') {
    try {
      const u = new URL(ref);
      const o = `${u.protocol}//${u.host}`;
      if (ALLOWED_ORIGINS.has(o)) return o;
    } catch (_) {}
  }
  return null;
}

/**
 * Rate limiter en memoria (se resetea en cold starts)
 * Lanza error si se excede el límite
 */
function rateLimitOrThrow(req, res, key, limit) {
  if (!globalThis.__NS_RL__) globalThis.__NS_RL__ = new Map();
  const now = Date.now();

  const entry = globalThis.__NS_RL__.get(key) || [];
  const fresh = entry.filter(ts => now - ts < WINDOW_MS);
  if (fresh.length >= limit) {
    res.setHeader('Retry-After', '60');
    throw Object.assign(new Error('RATE_LIMIT'), { status: 429 });
  }
  fresh.push(now);
  globalThis.__NS_RL__.set(key, fresh);
}

/**
 * Handler principal del proxy
 */
export default async function handler(req, res) {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    const allowedOrigin = pickAllowedOrigin(req);
    if (allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '3600');
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Configurar CORS headers
  const allowedOrigin = pickAllowedOrigin(req);
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  } else {
    // If you want to be ultra strict, change this to: return 403.
    // For now we keep it "enterprise-safe": allow but heavily rate-limit.
    res.setHeader('Access-Control-Allow-Origin', 'null');
  }

  const ip = getClientIp(req);

  // Basic bot/abuse heuristics
  const ua = String(req.headers['user-agent'] || '');
  if (ua.length < 8) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Validate endpoint
  const endpoint = req.query?.endpoint;
  if (!endpoint) return res.status(400).json({ error: 'Missing endpoint parameter' });
  if (!isAllowedEndpoint(endpoint)) return res.status(403).json({ error: 'Endpoint not allowed' });

  // Smart-ish rate limit
  try {
    const key = `${ip}:${allowedOrigin || 'no-origin'}`;
    rateLimitOrThrow(req, res, key, allowedOrigin ? LIMIT_OK_ORIGIN : LIMIT_NO_ORIGIN);
  } catch (e) {
    const status = e.status || 429;
    return res.status(status).json({ error: 'Rate limit exceeded. Try again soon.' });
  }

  // Upstream call a BallDontLie API
  const apiKey = process.env.BALLDONTLIE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server misconfigured: missing API key' });

  const upstreamUrl = `https://api.balldontlie.io/v1${endpoint}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { 'Authorization': apiKey }
    });

    // Pass-through status
    const text = await upstream.text();

    // Cache safe GET responses at edge/CDN
    // NOTE: BallDontLie data can change; tune as you prefer.
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');

    // Preserve JSON
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(upstream.status).send(text);
  } catch (err) {
    return res.status(502).json({ error: 'Upstream API error' });
  }
}
