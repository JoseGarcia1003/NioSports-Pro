// ═══════════════════════════════════════════════════════════════
// NioSports Pro v4.0 - MAIN BOOTSTRAP
// Punto de entrada principal - Carga módulos e inicializa app
// ═══════════════════════════════════════════════════════════════

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    // FIX CRÍTICO: Ocultar pantallas inmediatamente
    // ═══════════════════════════════════════════════════════════════
    (function hideAllScreens() {
        ['loginScreen', 'registerScreen', 'forgotPasswordScreen', 'mainApp', 'mainNav'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.cssText = 'display:none!important;';
        });
    })();

    // ═══════════════════════════════════════════════════════════════
    // ALERT OVERRIDE
    // ═══════════════════════════════════════════════════════════════
    window.alert = function(msg) {
        if (window.toastInfo) return window.toastInfo(String(msg));
        console.log('[alert]', msg);
    };

    // ═══════════════════════════════════════════════════════════════
    // INICIALIZACIÓN PRINCIPAL
    // ═══════════════════════════════════════════════════════════════
    document.addEventListener('DOMContentLoaded', async () => {
        const logger = window.NioLogger || console;
        logger.group('🚀 NioSports Pro v4.0');

        try {
            // 1. Cargar datos públicos
            if (typeof loadValuePicksFromStorage === 'function') {
                loadValuePicksFromStorage();
            }

            if (typeof loadTeamStatsFromAPI === 'function') {
                await loadTeamStatsFromAPI();
            }

            if (typeof loadAIPicks === 'function') {
                loadAIPicks();
            }

            // 2. Configurar formularios
            if (typeof setupAuthForms === 'function') {
                setupAuthForms();
            }

            // 3. Esperar Firebase
            if (typeof waitForFirebaseReady === 'function') {
                const firebaseOk = await waitForFirebaseReady();
                if (firebaseOk && typeof initAuthListeners === 'function') {
                    initAuthListeners();
                }
            }

            logger.success('App initialized');
        } catch (error) {
            logger.error('Init error:', error);
        }

        logger.groupEnd();
    });

})();
