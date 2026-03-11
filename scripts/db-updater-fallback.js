// scripts/db-updater-fallback.js — NioSports Pro
// ════════════════════════════════════════════════════════════════
// PROPÓSITO: Garantizar que window.DatabaseUpdater siempre existe,
// incluso si /scripts/database-updater.js no cargó correctamente
// (por un error 404, fallo de caché, o bloqueo de red).
//
// Sin este fallback, cualquier llamada a window.DatabaseUpdater.updateDatabase()
// lanzaría "TypeError: Cannot read properties of undefined" y rompería
// la inicialización de la app en silent. Con el fallback, el error
// es explícito y Sentry lo puede capturar correctamente.
//
// EXTRACCIÓN: era un bloque <script> inline en index.html (línea 75-87).
// Se movió a fichero externo para poder eliminar 'unsafe-inline'
// de script-src en la CSP progresivamente.
// ════════════════════════════════════════════════════════════════
(function () {
    if (!window.DatabaseUpdater) {
        window.DatabaseUpdater = {
            async updateDatabase() {
                const err = new Error('DatabaseUpdater not ready — /scripts/database-updater.js no cargó');
                // Reportar a Sentry si está disponible
                if (typeof window.nsReportError === 'function') {
                    window.nsReportError(err, { context: 'db-updater-fallback' });
                }
                throw err;
            }
        };
        // Flag para que otros módulos sepan que están en modo fallback
        window.__ns_dbUpdaterFallback = true;
        console.warn('[NioSports] DatabaseUpdater en modo fallback — database-updater.js no cargó');
    }
})();
