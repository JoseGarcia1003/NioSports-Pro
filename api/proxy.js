export default async function handler(req, res) {
  // --- CORS (allowlist) ---
  const allowedOrigins = new Set([
    "https://josegarcia1003.github.io",
    "https://nio-sports-pro.vercel.app"
  ]);

  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "3600");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const endpoint = typeof req.query.endpoint === "string" ? req.query.endpoint : "";
  if (!endpoint) return res.status(400).json({ error: "Missing endpoint parameter" });

  // --- Validate endpoint ---
  if (!endpoint.startsWith("/")) return res.status(400).json({ error: "Invalid endpoint" });
  if (endpoint.includes("..")) return res.status(400).json({ error: "Invalid endpoint" });

  const allowed = [
    /^\/players(\?|$)/,
    /^\/season_averages(\?|$)/,
    /^\/stats(\?|$)/,
    /^\/games(\?|$)/
  ];
  if (!allowed.some((re) => re.test(endpoint))) {
    return res.status(403).json({ error: "Endpoint not allowed" });
  }

  // --- Rate limiting (best-effort) ---
  const xff = req.headers["x-forwarded-for"];
  const ip = (typeof xff === "string" && xff.split(",")[0].trim()) || "unknown";

  if (!global._rateLimit) global._rateLimit = {};
  const now = Date.now();
  const WINDOW_MS = 60_000;
  const LIMIT = 30;

  if (!global._rateLimit[ip]) global._rateLimit[ip] = [];
  global._rateLimit[ip] = global._rateLimit[ip].filter((t) => now - t < WINDOW_MS);

  if (global._rateLimit[ip].length >= LIMIT) {
    return res.status(429).json({ error: "Rate limit exceeded. Try again in 1 minute." });
  }
  global._rateLimit[ip].push(now);

  try {
    const upstream = await fetch(`https://api.balldontlie.io/v1${endpoint}`, {
      headers: { Authorization: process.env.BALLDONTLIE_API_KEY }
    });

    const contentType = upstream.headers.get("content-type") || "";
    const text = await upstream.text();

    // Cache only successful responses
    if (upstream.ok) {
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    } else {
      res.setHeader("Cache-Control", "no-store");
    }

    if (contentType.includes("application/json")) {
      try {
        return res.status(upstream.status).json(JSON.parse(text));
      } catch {
        return res.status(502).json({ error: "Invalid JSON from upstream" });
      }
    }

    // Fallback: return text
    return res.status(upstream.status).send(text);
  } catch {
    return res.status(502).json({ error: "Upstream API error" });
  }
}
