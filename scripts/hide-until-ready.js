// scripts/hide-until-ready.js — NioSports Pro
// ════════════════════════════════════════════════════════════════
// PROPÓSITO: Ocultar todas las pantallas de auth y la app principal
// antes de que cualquier CSS o JS de la aplicación haya cargado,
// para evitar el "flash" de contenido sin autenticar.
//
// IMPORTANTE — POR QUÉ ESTE SCRIPT NO TIENE defer/async:
// Debe ejecutarse de forma SÍNCRONA, bloqueando el parser del HTML,
// justo en el momento en que el navegador lo encuentra. Si se cargara
// con defer o async, los elementos ya serían visibles por un instante
// antes de que el script los oculte — exactamente el problema que
// este archivo resuelve. Es una excepción deliberada y documentada
// a la regla general de "siempre usar defer".
//
// EXTRACCIÓN: este contenido era un bloque <script> inline en
// index.html (línea 2719). Se movió a fichero externo para poder
// eliminar 'unsafe-inline' de script-src en la CSP progresivamente.
// ════════════════════════════════════════════════════════════════
(function () {
    var authIds = ['loginScreen', 'registerScreen', 'forgotPasswordScreen'];
    var appIds  = ['mainApp', 'mainNav'];

    function hideAll() {
        authIds.concat(appIds).forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.style.cssText = 'display:none!important;';
        });
    }

    // Ocultar inmediatamente (el script bloquea el parser aquí)
    hideAll();

    // Segunda pasada en DOMContentLoaded por si algún elemento se
    // inserta después del script pero antes de que DOMContentLoaded dispare
    document.addEventListener('DOMContentLoaded', hideAll);

    // Guardia adicional para race conditions en navegadores lentos
    setTimeout(hideAll, 50);
    setTimeout(hideAll, 200);

    // Exponer función global para que auth.js / main.js pueda
    // mostrar solo el login screen cuando sea el momento correcto
    window.__forceShowLogin = function () {
        authIds.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) {
                el.style.cssText = (id === 'loginScreen')
                    ? 'display:flex!important;'
                    : 'display:none!important;';
            }
        });
    };
})();
