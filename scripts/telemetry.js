// scripts/telemetry.js
// NioSports — Observabilidad (Sentry) con túnel local (/api/telemetry)
// - No requiere abrir connect-src a Sentry en tu CSP (solo 'self').
// - Si falta config, NO rompe la app.

(async function initTelemetry() {
  try {
    if (!window.Sentry) return;

    // Evita doble init
    if (window.__NIOSPORTS_SENTRY_INIT__) return;
    window.__NIOSPORTS_SENTRY_INIT__ = true;

    const resp = await fetch("/api/public-config?ts=" + Date.now(), { cache: "no-store" });
    if (!resp.ok) return;

    const cfg = await resp.json();
    if (!cfg || !cfg.sentryDsn) return;

    window.Sentry.init({
      dsn: cfg.sentryDsn,
      tunnel: "/api/telemetry",
      environment: cfg.environment || "production",
      release: cfg.release || "niosports@unknown",

      integrations: [
        new window.Sentry.BrowserTracing({
          tracePropagationTargets: [/^\//, "https://api.balldontlie.io"],
        }),
      ],

      tracesSampleRate: Number.isFinite(cfg.tracesSampleRate) ? cfg.tracesSampleRate : 0.15,
      sendDefaultPii: false,

      denyUrls: [/extensions\//i, /^chrome:\/\//i, /^moz-extension:\/\//i],
    });

    window.Sentry.setTag("app", "NioSports-Pro");
  } catch (_) {
    // observabilidad nunca debe tumbar tu app
  }
})();
