// scripts/telemetry.js — Sentry Telemetry (Non-blocking initialization)
// ═══════════════════════════════════════════════════════════════════

// 🔵 Inicializar Telemetry sin bloquear otras ejecuciones
function initTelemetry() {
  // No esperar, ejecutar en background
  (async function() {
    try {
      // Validar que Sentry esté disponible
      if (!window.Sentry) {
        console.warn('⚠️ Sentry SDK no disponible');
        return;
      }

      // Evitar inicialización duplicada
      if (window.__NIOSPORTS_SENTRY_INIT__) {
        console.log('ℹ️ Sentry ya fue inicializado');
        return;
      }

      console.log('📊 Iniciando Sentry Telemetry...');
      window.__NIOSPORTS_SENTRY_INIT__ = true;

      // Obtener configuración (con timeout de 3 segundos)
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

        // Inicializar Sentry
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
          
          // Contexto custom antes de enviar eventos
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
            
            // Contexto de estado de la app
            window.Sentry.setContext("app_state", {
              current_view: window.currentView || 'unknown',
              last_action: window.lastUserAction || 'unknown',
            });
            
            return event;
          }
        });

        window.Sentry.setTag("app", "NioSports-Pro");
        console.log('✅ Sentry Telemetry inicializado correctamente');
        
      } catch (timeoutError) {
        console.warn('⚠️ Timeout obteniendo config de Sentry:', timeoutError.message);
      }
      
    } catch (error) {
      // La observabilidad NUNCA debe tumbar la aplicación
      console.error('❌ Error en telemetry:', error.message);
    }
  })(); // ← Se ejecuta en background sin bloquear
}

// 🟢 Llamar initTelemetry inmediatamente (no-blocking)
// Esto permite que Firebase se inicialice en paralelo
if (document.readyState === 'loading') {
  // Si el DOM aún está cargando, ejecutar cuando esté listo
  document.addEventListener('DOMContentLoaded', initTelemetry);
} else {
  // Si el DOM ya está listo, ejecutar inmediatamente
  initTelemetry();
}

console.log('📊 scripts/telemetry.js cargado');

// ═══════════════════════════════════════════════════════════════════
// 🆕 HELPER: Trackear acciones del usuario
// ═══════════════════════════════════════════════════════════════════

/**
 * Track user actions en Sentry (breadcrumbs)
 * @param {string} action - Nombre de la acción
 * @param {object} data - Datos adicionales
 */
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

/**
 * Trackear errores con contexto
 * @param {Error} error - El error
 * @param {object} context - Contexto adicional
 */
window.trackError = function(error, context = {}) {
  console.error('🔴 Error trackeado:', error);
  
  if (window.Sentry && window.__NIOSPORTS_SENTRY_INIT__) {
    window.Sentry.captureException(error, {
      tags: {
        ...context
      }
    });
  }
};
