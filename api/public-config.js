// api/public-config.js
// Expone SOLO config "pública" (no secretos) para el front.
// Sirve para inicializar Sentry sin hardcodear en index.html.

export default function handler(req, res) {
  try {
    const environment = process.env.VERCEL_ENV || process.env.NODE_ENV || "production";

    // Recomendado: SENTRY_DSN_PUBLIC en Vercel (Project -> Settings -> Env Vars)
    const sentryDsn = process.env.SENTRY_DSN_PUBLIC || process.env.SENTRY_DSN || "";

    // Release útil para depurar
    const release =
      process.env.NIOSPORTS_RELEASE ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.GIT_COMMIT_SHA ||
      "";

    // Sampling (0.0 - 1.0)
    const raw = process.env.SENTRY_TRACES_SAMPLE_RATE || "";
    const tracesSampleRate = (() => {
      const n = Number(raw);
      return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0.15;
    })();

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.status(200).send(
      JSON.stringify({
        sentryDsn,
        environment,
        release,
        tracesSampleRate,
      })
    );
  } catch (_) {
    res.status(200).json({});
  }
}
