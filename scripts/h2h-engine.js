// ═══════════════════════════════════════════════════════════════
// NioSports Pro — scripts/h2h-engine.js
// Motor de comparación Head-to-Head (H2H)
// La lógica principal de H2H está en main.js (getH2HData, addH2HGame, etc.)
// Este archivo provee funciones complementarias de análisis H2H
// ═══════════════════════════════════════════════════════════════

console.log('⚔️ H2H Engine v1.0 cargando...');

/**
 * Analizar tendencias H2H entre dos equipos
 * Calcula promedios de totales combinados por período
 * @param {string} team1
 * @param {string} team2
 * @returns {Object|null} Tendencias H2H o null si no hay datos
 */
window.getH2HTrends = function(team1, team2) {
    // Delegar a la función principal en main.js
    if (typeof getH2HData === 'function') {
        const h2h = getH2HData(team1, team2);
        if (!h2h || !h2h.games || h2h.games.length === 0) return null;

        const games = h2h.games;
        const n = games.length;

        // Promedios de totales combinados (lo que nos interesa para OVER/UNDER)
        const avgTotalQ1 = games.reduce((s, g) => s + (g.t1Q1 + g.t2Q1), 0) / n;
        const avgTotalHalf = games.reduce((s, g) => s + (g.t1Half + g.t2Half), 0) / n;
        const avgTotalFull = games.reduce((s, g) => s + g.totalPts, 0) / n;

        // Tendencia últimos 3 vs últimos 10 (¿subiendo o bajando?)
        const recent3 = games.slice(0, Math.min(3, n));
        const avgRecent3 = recent3.reduce((s, g) => s + g.totalPts, 0) / recent3.length;

        const trend = avgRecent3 > avgTotalFull ? 'rising' : avgRecent3 < avgTotalFull ? 'falling' : 'stable';

        // Porcentaje de OVERs histórico a una línea dada
        function overRate(line, periodGetter) {
            const overs = games.filter(g => periodGetter(g) > line).length;
            return Math.round((overs / n) * 100);
        }

        return {
            totalGames: n,
            avgQ1: avgTotalQ1,
            avgHalf: avgTotalHalf,
            avgFull: avgTotalFull,
            trend,
            avgRecent3Full: avgRecent3,
            overRate, // Función: overRate(220.5, g => g.totalPts) → % de OVERs
            record: h2h.record,
            team1Ppg: h2h.avgPts.team1,
            team2Ppg: h2h.avgPts.team2
        };
    }
    return null;
};

/**
 * Obtener puntuación de confianza del H2H
 * Más partidos = más confianza, con diminishing returns
 * @param {number} gamesCount - Cantidad de partidos H2H
 * @returns {number} 0-100 score de confianza
 */
window.getH2HConfidence = function(gamesCount) {
    if (gamesCount === 0) return 0;
    if (gamesCount <= 2) return 20;
    if (gamesCount <= 4) return 40;
    if (gamesCount <= 6) return 60;
    if (gamesCount <= 8) return 75;
    return Math.min(90, 75 + (gamesCount - 8) * 2);
};

console.log('✅ H2H Engine v1.0 cargado');
