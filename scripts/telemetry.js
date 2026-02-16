// scripts/telemetry.js — Non-blocking Sentry initialization (safe across SDK versions)
console.log('📊 Sentry Telemetry cargando...');

(function initTelemetry() {
  // No bloquear el render
  Promise.resolve().then(async () => {
    try {
      if (!window.Sentry) {
        console.warn('⚠️ Sentry SDK no disponible');
        return;
      }

      if (window.__NIOSPORTS_SENTRY_INIT__) {
        console.log('ℹ️ Sentry ya fue inicializado');
        return;
      }

      window.__NIOSPORTS_SENTRY_INIT__ = true;

      // Timeout de 3 segundos para no bloquear
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      let resp;
      try {
        resp = await fetch("/api/public-config?ts=" + Date.now(), {
          cache: "no-store",
          signal: controller.signal
        });
      } catch (e) {
        clearTimeout(timeoutId);
        console.warn('⚠️ Timeout o error obteniendo config de Sentry:', e?.message || e);
        return;
      }
      clearTimeout(timeoutId);

      if (!resp.ok) {
        console.warn('⚠️ No se pudo obtener config de Sentry (HTTP ' + resp.status + ')');
        return;
      }

      const cfg = await resp.json().catch(() => null);
      if (!cfg || !cfg.sentryDsn) {
        console.warn('⚠️ No hay sentryDsn en config');
        return;
      }

      // Integrations: BrowserTracing cambia entre versiones; hacerlo opcional y a prueba de fallos
      const integrations = [];
      try {
        const BT = window.Sentry?.BrowserTracing;
        // Algunas builds lo exponen como función/clase, otras no.
        if (typeof BT === "function") {
          integrations.push(new BT({
            tracePropagationTargets: [/^\//, "https://api.balldontlie.io"],
          }));
        } else {
          // Si no existe, no hacemos tracing (mejor 0 errores que tracing roto)
          console.warn('ℹ️ BrowserTracing no disponible; se omite performance tracing.');
        }
      } catch (e) {
        console.warn('ℹ️ BrowserTracing no pudo inicializarse; se omite tracing.', e?.message || e);
      }

      // Evitar romper si el SDK no acepta "tunnel" o campos extra (pero generalmente sí)
      try {
        window.Sentry.init({
          dsn: cfg.sentryDsn,
          tunnel: "/api/telemetry",
          environment: cfg.environment || "production",
          release: cfg.release || "niosports@unknown",
          integrations,
          tracesSampleRate: Number.isFinite(cfg.tracesSampleRate) ? cfg.tracesSampleRate : 0.15,
          sendDefaultPii: false,
          denyUrls: [/extensions\//i, /^chrome:\/\//i, /^moz-extension:\/\//i],
          beforeSend(event) {
            try {
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

              window.Sentry.setContext("app_state", {
                current_view: window.currentView || 'unknown',
                last_action: window.lastUserAction || 'unknown',
              });
            } catch (_) {
              // Nunca romper el envío
            }
            return event;
          }
        });

        window.Sentry.setTag("app", "NioSports-Pro");
        console.log('✅ Sentry inicializado correctamente');
      } catch (e) {
        // Si init falla por diferencias de SDK, desactivamos de forma segura
        console.warn('⚠️ Sentry.init falló; se desactiva telemetry para evitar errores:', e?.message || e);
        window.__NIOSPORTS_SENTRY_INIT__ = false;
      }

    } catch (error) {
      console.error('❌ Error en telemetry:', error?.message || error);
      window.__NIOSPORTS_SENTRY_INIT__ = false;
    }
  });
})();

// Helper para trackear acciones
window.trackAction = function(action, data = {}) {
  window.lastUserAction = action;

  if (window.Sentry && window.__NIOSPORTS_SENTRY_INIT__) {
    try {
      window.Sentry.addBreadcrumb({
        category: 'user-action',
        message: action,
        level: 'info',
        data,
        timestamp: Date.now()
      });
    } catch (_) {}
  }
};

// Helper para trackear errores
window.trackError = function(error, context = {}) {
  console.error('🔴 Error trackeado:', error);

  if (window.Sentry && window.__NIOSPORTS_SENTRY_INIT__) {
    try {
      window.Sentry.captureException(error, { tags: context });
    } catch (_) {}
  }
};

console.log('📊 Sentry Telemetry cargado');
