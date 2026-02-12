// api/telemetry.js
// Túnel local para Sentry (Browser SDK -> /api/telemetry -> Sentry ingest)
// Ventaja: tu CSP NO necesita permitir *.ingest.sentry.io en connect-src.

function parseDsn(dsn) {
  // DSN típico: https://PUBLIC_KEY@o123456.ingest.sentry.io/7890123
  try {
    const u = new URL(dsn);
    const publicKey = u.username; // antes del '@'
    const host = u.host;          // o123456.ingest.sentry.io
    const projectId = u.pathname.replace("/", "");
    if (!publicKey || !host || !projectId) return null;

    return {
      publicKey,
      host,
      projectId,
      envelopeUrl: `https://${host}/api/${projectId}/envelope/`,
    };
  } catch (_) {
    return null;
  }
}

export default async function handler(req, res) {
  // CORS (same-origin normalmente). Lo dejamos abierto por si algún día usas subdominios.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Sentry-Auth");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const dsn = process.env.SENTRY_DSN || process.env.SENTRY_DSN_PUBLIC;
  const parsed = dsn ? parseDsn(dsn) : null;
  if (!parsed) {
    return res.status(500).send("Sentry DSN not configured");
  }

  // Leer body raw
  const chunks = [];
  try {
    for await (const chunk of req) chunks.push(chunk);
  } catch (_) {
    return res.status(400).send("Invalid body");
  }
  const body = Buffer.concat(chunks);

  // Reenviar a Sentry
  try {
    const sentryResp = await fetch(parsed.envelopeUrl, {
      method: "POST",
      headers: {
        "Content-Type": req.headers["content-type"] || "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_key=${parsed.publicKey}, sentry_version=7`,
      },
      body,
    });

    res.status(sentryResp.status).send(await sentryResp.text());
  } catch (_) {
    // fail-open: devolvemos 200 para que el front no se quede reintentando
    res.status(200).send("");
  }
}
