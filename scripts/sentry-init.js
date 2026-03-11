// scripts/sentry-init.js
// Inicialización de Sentry para NioSports Pro
// ════════════════════════════════════════════════════════════════
// Este archivo reemplaza sentry.config.js (que era para webpack,
// incompatible con este proyecto que no usa webpack).
//
// INSTRUCCIONES DE ACTIVACIÓN:
// 1. Reemplaza YOUR_SENTRY_DSN con tu DSN real de sentry.io
// 2. En index.html, añade ANTES de cualquier otro <script>:
//    <script src="https://browser.sentry-cdn.com/7.119.0/bundle.min.js"
//            crossorigin="anonymous"></script>
//    <script src="/scripts/sentry-init.js"></script>
// ════════════════════════════════════════════════════════════════

(function initSentry() {
  // ── Verificar que el SDK de Sentry se cargó correctamente ───────
  if (typeof Sentry === 'undefined') {
    console.warn('[Sentry] SDK no disponible — comprueba que el CDN cargó antes de este script');
    return;
  }

  // ── Detectar entorno ─────────────────────────────────────────────
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const environment = isLocalhost ? 'development' : 'production';

  // ── No inicializar en desarrollo a menos que se fuerce ──────────
  // Para depurar Sentry en local, añade ?sentry=1 a la URL
  const forceSentry = new URLSearchParams(window.location.search).get('sentry') === '1';
  if (isLocalhost && !forceSentry) {
    console.log('[Sentry] Desactivado en localhost. Usa ?sentry=1 para forzar.');
    return;
  }

  // ── Configuración principal ──────────────────────────────────────
  Sentry.init({
    // ⚠️ IMPORTANTE: reemplaza con tu DSN real de sentry.io
    // Lo encuentras en: sentry.io → Settings → Projects → [tu proyecto] → Client Keys
    dsn: 'https://99b12c1dacf18f5416aecbf452d4ac6a@o4510870707765248.ingest.us.sentry.io/4510870715760640',

    environment,

    // Versión del release — se actualiza manualmente o via CI
    release: 'niosports@3.0.0',

    // ── Muestreo de errores ─────────────────────────────────────────
    // 1.0 = capturar el 100% de los errores (recomendado al inicio)
    // Reducir a 0.5 una vez que el volumen de errores sea alto
    sampleRate: 1.0,

    // ── Muestreo de trazas de performance ────────────────────────
    // 0.1 = capturar el 10% de las transacciones de navegación
    tracesSampleRate: 0.1,

    // ── Contexto adicional para cada evento ─────────────────────
    initialScope: scope => {
      // Añadir contexto básico del dispositivo del usuario
      scope.setTag('platform', 'pwa');
      scope.setTag('app_version', '3.0.0');
      return scope;
    },

    // ── Filtros: ignorar errores que no son nuestros ────────────
    ignoreErrors: [
      // Errores comunes de extensiones de navegador
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Errores de red esperados (usuario desconectado, etc.)
      'NetworkError',
      'Failed to fetch',
      // Scripts de terceros
      /^Script error\.$/,
    ],

    // ── Antes de enviar: añadir contexto de usuario ─────────────
    beforeSend(event, hint) {
      // Añadir información del usuario si está autenticado
      if (window.currentUser) {
        event.user = {
          id: window.currentUser.uid,
          // No incluir email por privacidad — solo el uid es suficiente
        };
      }

      // Añadir contexto de la vista activa si está disponible
      const activeView = document.querySelector('[data-view]')?.dataset?.view || 'unknown';
      event.tags = { ...event.tags, active_view: activeView };

      return event;
    }
  });

  // ── Escuchar errores de Promise no manejados ─────────────────────
  // Firebase y otras librerías async pueden lanzar promesas rechazadas
  // que no llegan a window.onerror. Sentry las captura automáticamente,
  // pero dejamos un log local para claridad en consola.
  window.addEventListener('unhandledrejection', event => {
    console.error('[Sentry] Promesa no manejada capturada:', event.reason);
    // Sentry la intercepta automáticamente — no hace falta llamar captureException aquí
  });

  console.log(`[Sentry] ✅ Inicializado — entorno: ${environment}, release: niosports@3.0.0`);
})();

// ════════════════════════════════════════════════════════════════
// HELPER GLOBAL: window.nsReportError
// ════════════════════════════════════════════════════════════════
// Úsalo en cualquier catch block para reportar errores con contexto:
//   window.nsReportError(error, { module: 'picks-engine', gameId: '123' });
// ════════════════════════════════════════════════════════════════

window.nsReportError = function(error, extraContext = {}) {
  console.error('[Error]', error, extraContext);

  if (typeof Sentry === 'undefined') return;

  Sentry.withScope(scope => {
    // Añadir contexto extra que ayuda a reproducir el bug
    Object.entries(extraContext).forEach(([key, value]) => {
      scope.setExtra(key, value);
    });

    // Añadir el uid del usuario autenticado si existe
    if (window.currentUser?.uid) {
      scope.setUser({ id: window.currentUser.uid });
    }

    Sentry.captureException(error);
  });
};
