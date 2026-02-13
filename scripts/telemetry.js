// scripts/telemetry.js
(async function initTelemetry() {
  try {
    if (!window.Sentry) return;
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
      
      // 🆕 Antes de enviar evento, añadir contexto custom
      beforeSend(event, hint) {
        // Añadir info del usuario si está logueado
        if (window.currentUser) {
          window.Sentry.setUser({
            id: window.currentUser.uid,
            email: window.currentUser.email,
          });
          
          window.Sentry.setContext("user_profile", {
            plan: window.userPlan || 'free',
            bankroll: window.userBankroll?.current || 0,
            totalPicks: window.userStats?.totalPicks || 0,
          });
        }
        
        // Añadir info de la vista actual
        window.Sentry.setContext("app_state", {
          current_view: window.currentView || 'unknown',
          last_action: window.lastUserAction || 'unknown',
        });
        
        return event;
      }
    });

    window.Sentry.setTag("app", "NioSports-Pro");
    
  } catch (_) {
    // observabilidad nunca debe tumbar tu app
  }
})();

// 🆕 Helper para trackear acciones del usuario
window.trackAction = function(action, data = {}) {
  window.lastUserAction = action;
  
  if (window.Sentry) {
    window.Sentry.addBreadcrumb({
      category: 'user-action',
      message: action,
      level: 'info',
      data
    });
  }
};
