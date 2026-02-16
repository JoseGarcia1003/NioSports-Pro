// scripts/telemetry.js — Non-blocking Sentry initialization
console.log('📊 Sentry Telemetry cargando...');

// No esperar, ejecutar en background
(async function initTelemetry() {
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

    try {
      const resp = await fetch("/api/public-config?ts=" + Date.now(), { 
        cache: "no-store",
        signal: controller.signal 
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        console.warn('⚠️ No se pudo obtener config de Sentry (HTTP ' + resp.status + ')');
        return;
      }

      const cfg = await resp.json();
      if (!cfg || !cfg.sentryDsn) {
        console.warn('⚠️ No hay sentryDsn en config');
        return;
      }

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
        
        beforeSend(event, hint) {
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
          
          return event;
        }
      });

      window.Sentry.setTag("app", "NioSports-Pro");
      console.log('✅ Sentry inicializado correctamente');
      
    } catch (timeoutError) {
      console.warn('⚠️ Timeout o error obteniendo config de Sentry:', timeoutError.message);
    }
    
  } catch (error) {
    console.error('❌ Error en telemetry:', error.message);
  }
})();

// Helper para trackear acciones
window.trackAction = function(action, data = {}) {
  window.lastUserAction = action;
  
  if (window.Sentry && window.__NIOSPORTS_SENTRY_INIT__) {
    window.Sentry.addBreadcrumb({
      category: 'user-action',
      message: action,
      level: 'info',
      data,
      timestamp: Date.now()
    });
  }
};

// Helper para trackear errores
window.trackError = function(error, context = {}) {
  console.error('🔴 Error trackeado:', error);
  
  if (window.Sentry && window.__NIOSPORTS_SENTRY_INIT__) {
    window.Sentry.captureException(error, {
      tags: context
    });
  }
};

console.log('📊 Sentry Telemetry cargado');
