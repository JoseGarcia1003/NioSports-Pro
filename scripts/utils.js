// ═══════════════════════════════════════════════════════════════
// NioSports Pro — scripts/utils.js
// Funciones utilitarias fundamentales del sistema
// ESTE ARCHIVO DEBE CARGARSE ANTES DE main.js
// ═══════════════════════════════════════════════════════════════

console.log('🔧 utils.js cargando...');

// ═══════════════════════════════════════════════════════════════
// PARSING SEGURO — Evita NaN y errores de conversión
// ═══════════════════════════════════════════════════════════════

/**
 * parseInt seguro — nunca retorna NaN
 * @param {*} value - Valor a parsear
 * @param {number} fallback - Valor por defecto si falla (default: 0)
 * @returns {number}
 */
function safeParseInt(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? fallback : parsed;
}

/**
 * parseFloat seguro — nunca retorna NaN
 * @param {*} value - Valor a parsear
 * @param {number} fallback - Valor por defecto si falla (default: 0)
 * @returns {number}
 */
function safeParseFloat(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? fallback : parsed;
}

// Exponer globalmente
window.safeParseInt = safeParseInt;
window.safeParseFloat = safeParseFloat;

// ═══════════════════════════════════════════════════════════════
// HELPERS DEL MODELO PREDICTIVO
// Usados por calculateAdvancedTrend() en main.js
// ═══════════════════════════════════════════════════════════════

/**
 * Multiplicador de período — convierte ajustes Full a Q1/Half
 * Basado en proporción temporal: Q1 = 1/4, Half = 1/2, Full = 1
 * @param {string} period - 'q1', 'half', o 'full'
 * @returns {number}
 */
function getPeriodMultiplier(period) {
    if (period === 'q1') return 0.25;
    if (period === 'half') return 0.50;
    return 1.0; // full
}

/**
 * Obtener valor por período desde un objeto de configuración
 * Acepta objetos con claves {q1, half, full} o {days3plus, days2} anidados
 * @param {string} period - 'q1', 'half', o 'full'
 * @param {Object|number} config - Objeto con valores por período
 * @returns {*}
 */
function getByPeriod(period, config) {
    if (config === null || config === undefined) return 0;
    if (typeof config === 'number') return config;

    // Si el objeto tiene claves directas q1/half/full
    if (config.q1 !== undefined || config.half !== undefined || config.full !== undefined) {
        if (period === 'q1') return config.q1 !== undefined ? config.q1 : 0;
        if (period === 'half') return config.half !== undefined ? config.half : 0;
        return config.full !== undefined ? config.full : 0;
    }

    // Si es un valor simple (ej: REST_BONUS.full = {days3plus: 1.5, days2: 0.5})
    // Retornar el objeto completo para que el caller extraiga lo que necesite
    return config;
}

// Exponer globalmente
window.getPeriodMultiplier = getPeriodMultiplier;
window.getByPeriod = getByPeriod;

// ═══════════════════════════════════════════════════════════════
// CACHE DE TENDENCIAS — Evita recalcular el modelo para el
// mismo matchup durante la misma sesión
// ═══════════════════════════════════════════════════════════════

const _trendCache = {};
const TREND_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Obtener tendencia cacheada
 * @param {string} localTeam
 * @param {string} awayTeam
 * @param {string} period
 * @returns {Object|null}
 */
function getCachedTrend(localTeam, awayTeam, period) {
    const key = `${localTeam}_${awayTeam}_${period}`;
    const cached = _trendCache[key];
    if (!cached) return null;
    if (Date.now() - cached.timestamp > TREND_CACHE_TTL) {
        delete _trendCache[key];
        return null;
    }
    return cached.data;
}

/**
 * Guardar tendencia en cache
 * @param {string} localTeam
 * @param {string} awayTeam
 * @param {string} period
 * @param {Object} data
 */
function setCachedTrend(localTeam, awayTeam, period, data) {
    const key = `${localTeam}_${awayTeam}_${period}`;
    _trendCache[key] = { data, timestamp: Date.now() };
}

/**
 * Limpiar cache de tendencias (útil cuando cambian factores contextuales)
 */
function clearTrendCache() {
    Object.keys(_trendCache).forEach(k => delete _trendCache[k]);
}

// Exponer globalmente
window.getCachedTrend = getCachedTrend;
window.setCachedTrend = setCachedTrend;
window.clearTrendCache = clearTrendCache;

// ═══════════════════════════════════════════════════════════════
// DEBOUNCED RENDER — Evita re-renders excesivos cuando el
// usuario cambia múltiples controles rápidamente
// ═══════════════════════════════════════════════════════════════

let _renderTimeout = null;

/**
 * Render con debounce de 150ms
 * Limpia el cache de tendencias antes de re-renderizar
 * para que los nuevos factores contextuales se apliquen
 */
function debouncedRender() {
    if (_renderTimeout) clearTimeout(_renderTimeout);
    _renderTimeout = setTimeout(() => {
        clearTrendCache(); // Los factores cambiaron, recalcular
        if (typeof render === 'function') {
            render();
        }
    }, 150);
}

// Exponer globalmente
window.debouncedRender = debouncedRender;

// ═══════════════════════════════════════════════════════════════
// LOGO SVG — Usado en múltiples vistas del sistema
// Ícono de balón de basquet con gradiente dorado
// ═══════════════════════════════════════════════════════════════

const LOGO_SVG = `<svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="logoGold" x1="0" y1="0" x2="44" y2="44">
      <stop offset="0%" stop-color="#FFD700"/>
      <stop offset="50%" stop-color="#FFE44D"/>
      <stop offset="100%" stop-color="#FFAA00"/>
    </linearGradient>
  </defs>
  <circle cx="22" cy="22" r="20" stroke="url(#logoGold)" stroke-width="2.5" fill="none"/>
  <path d="M22 2 C22 2, 22 42, 22 42" stroke="url(#logoGold)" stroke-width="1.5" opacity="0.6"/>
  <path d="M2 22 C2 22, 42 22, 42 22" stroke="url(#logoGold)" stroke-width="1.5" opacity="0.6"/>
  <path d="M6 8 C14 16, 30 16, 38 8" stroke="url(#logoGold)" stroke-width="1.5" fill="none" opacity="0.5"/>
  <path d="M6 36 C14 28, 30 28, 38 36" stroke="url(#logoGold)" stroke-width="1.5" fill="none" opacity="0.5"/>
  <text x="22" y="26" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="14" font-weight="900" fill="url(#logoGold)">N</text>
</svg>`;

// Exponer globalmente
window.LOGO_SVG = LOGO_SVG;

// ═══════════════════════════════════════════════════════════════
// BANKROLL CHART — Función que main.js llama al renderizar
// la vista de bankroll
// ═══════════════════════════════════════════════════════════════

let _bankrollChartInstance = null;

/**
 * Crear/actualizar gráfico de evolución del bankroll
 */
function createBankrollChart() {
    const canvas = document.getElementById('bankrollChart');
    if (!canvas) return;

    const history = (window.USER_BANKROLL && window.USER_BANKROLL.history) || [];
    if (history.length < 2) return;

    // Destruir chart anterior
    if (_bankrollChartInstance) {
        _bankrollChartInstance.destroy();
        _bankrollChartInstance = null;
    }

    // Si Chart.js no está cargado, salir silenciosamente
    if (typeof Chart === 'undefined') return;

    const labels = history.map((h, i) => {
        if (h.date) {
            return new Date(h.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        }
        return `#${i + 1}`;
    });

    const data = history.map(h => h.newBalance || h.amount || 0);
    const lastValue = data[data.length - 1] || 0;
    const firstValue = data[0] || 0;
    const isPositive = lastValue >= firstValue;

    _bankrollChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Bankroll ($)',
                data,
                borderColor: isPositive ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
                backgroundColor: isPositive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: {
                        color: 'rgba(255,255,255,0.7)',
                        callback: v => '$' + v
                    }
                },
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: 'rgba(255,255,255,0.7)' }
                }
            }
        }
    });
}

// Exponer globalmente
window.createBankrollChart = createBankrollChart;

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION QUEUE PROCESSOR
// Procesa notificaciones pendientes que se acumularon antes de
// que el sistema de notificaciones estuviese listo
// ═══════════════════════════════════════════════════════════════

function processNotificationQueue() {
    const queue = window._pendingNotifications || [];
    if (queue.length === 0) return;

    queue.forEach(n => {
        try {
            if (typeof window.showToast === 'function') {
                const typeMap = {
                    'success': 'success',
                    'error': 'error',
                    'warning': 'warning',
                    'info': 'info',
                    'value': 'info'
                };
                window.showToast(n.message || n.title, typeMap[n.type] || 'info', 3500, { title: n.title });
            }
        } catch (e) {
            console.log('[Notification]', n.type, n.title, n.message);
        }
    });

    // Limpiar cola
    window._pendingNotifications = [];
}

// Exponer globalmente
window.processNotificationQueue = processNotificationQueue;

// ═══════════════════════════════════════════════════════════════
// TEAM STATS GLOBAL — Asegurar que TEAM_STATS existe como
// objeto global antes de que main.js lo necesite
// ═══════════════════════════════════════════════════════════════

if (typeof window.TEAM_STATS === 'undefined') {
    window.TEAM_STATS = {};
}
// Alias para acceso directo sin window.
var TEAM_STATS = window.TEAM_STATS;

// Sincronizar cuando se carguen los datos
Object.defineProperty(window, '__TEAM_STATS_SYNC__', {
    set(val) {
        if (val && typeof val === 'object') {
            window.TEAM_STATS = val;
            TEAM_STATS = val;
        }
    },
    get() { return window.TEAM_STATS; }
});

console.log('✅ utils.js cargado — Funciones utilitarias listas');
