// src/services/predictor.js
// Motor Predictivo - Funciones puras para testing

/**
 * Calcula predicción para totals (OVER/UNDER)
 * @param {Object} gameData - Datos del partido
 * @returns {Object} { pick: 'OVER'|'UNDER', confidence: 0-100, factors: {...} }
 */
export function calculateTotalsPrediction(gameData) {
    const {
        homeTeam,
        awayTeam,
        line,
        homeStats,
        awayStats,
        leagueAverages,
        injuries = [],
        h2hHistory = []
    } = gameData;
    
    // Validación
    if (!homeTeam || !awayTeam || !line) {
        throw new Error('Missing required game data');
    }
    
    if (!homeStats || !awayStats) {
        throw new Error('Missing team stats');
    }
    
    // Factor 1: Pace-adjusted scoring
    const homePaceAdj = (homeStats.pace / leagueAverages.pace) * homeStats.ppg;
    const awayPaceAdj = (awayStats.pace / leagueAverages.pace) * awayStats.ppg;
    const projectedTotal = homePaceAdj + awayPaceAdj;
    
    // Factor 2: Home court advantage (+2.5 puntos promedio)
    const homeCourtBonus = 2.5;
    const adjustedTotal = projectedTotal + homeCourtBonus;
    
    // Factor 3: Defensive adjustments
    const homeDefAdj = (leagueAverages.ppg - homeStats.oppPpg) * 0.5;
    const awayDefAdj = (leagueAverages.ppg - awayStats.oppPpg) * 0.5;
    const finalProjection = adjustedTotal + homeDefAdj + awayDefAdj;
    
    // Factor 4: Recent form (últimos 5 juegos)
    let recentFormAdj = 0;
    if (homeStats.last5Avg && awayStats.last5Avg) {
        const homeFormDiff = homeStats.last5Avg - homeStats.ppg;
        const awayFormDiff = awayStats.last5Avg - awayStats.ppg;
        recentFormAdj = (homeFormDiff + awayFormDiff) * 0.3; // 30% weight
    }
    
    const finalTotal = finalProjection + recentFormAdj;
    
    // Factor 5: Injuries impact
    let injuryImpact = 0;
    injuries.forEach(injury => {
        if (injury.team === homeTeam) {
            injuryImpact -= injury.ppgImpact || 0;
        } else if (injury.team === awayTeam) {
            injuryImpact -= injury.ppgImpact || 0;
        }
    });
    
    const adjustedForInjuries = finalTotal + injuryImpact;
    
    // Decisión: OVER o UNDER
    const difference = adjustedForInjuries - line;
    const pick = difference > 0 ? 'OVER' : 'UNDER';
    
    // Confidence: basado en la diferencia vs la línea
    const diffPercentage = Math.abs(difference / line) * 100;
    let confidence = Math.min(95, 50 + diffPercentage * 2);
    
    // Ajustar confianza por sample size
    if (!homeStats.gamesPlayed || homeStats.gamesPlayed < 10) {
        confidence *= 0.8; // Reducir 20% si hay pocos juegos
    }
    
    return {
        pick,
        confidence: Math.round(confidence),
        projectedTotal: Math.round(adjustedForInjuries * 10) / 10,
        line,
        difference: Math.round(difference * 10) / 10,
        factors: {
            paceAdjusted: Math.round(projectedTotal * 10) / 10,
            homeCourtAdv: homeCourtBonus,
            defensiveAdj: Math.round((homeDefAdj + awayDefAdj) * 10) / 10,
            recentForm: Math.round(recentFormAdj * 10) / 10,
            injuries: Math.round(injuryImpact * 10) / 10
        }
    };
}

/**
 * Calcula predicción para props de jugador
 */
export function calculatePropsPrediction(propData) {
    const {
        player,
        stat, // 'pts', 'ast', 'reb', etc.
        line,
        opponent,
        playerStats,
        vsTeamHistory = [],
        homeAway = 'home'
    } = propData;
    
    // Validación
    if (!player || !stat || !line || !playerStats) {
        throw new Error('Missing required prop data');
    }
    
    const seasonAvg = playerStats[stat] || 0;
    
    // Factor 1: Home vs Away splits
    let locationAdj = 0;
    if (homeAway === 'home' && playerStats.homeAvg) {
        locationAdj = playerStats.homeAvg[stat] - seasonAvg;
    } else if (homeAway === 'away' && playerStats.awayAvg) {
        locationAdj = playerStats.awayAvg[stat] - seasonAvg;
    }
    
    // Factor 2: Vs opponent history
    let vsOpponentAdj = 0;
    if (vsTeamHistory.length > 0) {
        const avgVsTeam = vsTeamHistory.reduce((sum, game) => sum + (game[stat] || 0), 0) / vsTeamHistory.length;
        vsOpponentAdj = avgVsTeam - seasonAvg;
    }
    
    // Factor 3: Recent form (últimos 5)
    let recentFormAdj = 0;
    if (playerStats.last5) {
        const last5Avg = playerStats.last5.reduce((sum, game) => sum + (game[stat] || 0), 0) / playerStats.last5.length;
        recentFormAdj = (last5Avg - seasonAvg) * 0.4; // 40% weight
    }
    
    // Factor 4: Consistency score
    let consistencyBonus = 0;
    if (playerStats.consistency && playerStats.consistency[stat]) {
        const consistencyScore = playerStats.consistency[stat];
        // Si es muy consistente (>70), aumentar confianza
        if (consistencyScore > 70) {
            consistencyBonus = 0.2; // 20% boost
        }
    }
    
    const projection = seasonAvg + locationAdj + vsOpponentAdj + recentFormAdj;
    const difference = projection - line;
    const pick = difference > 0 ? 'OVER' : 'UNDER';
    
    // Confidence
    const diffPercentage = Math.abs(difference / line) * 100;
    let confidence = Math.min(95, 45 + diffPercentage * 2.5);
    confidence += consistencyBonus * confidence; // Apply consistency bonus
    
    return {
        pick,
        confidence: Math.round(confidence),
        projection: Math.round(projection * 10) / 10,
        line,
        difference: Math.round(difference * 10) / 10,
        factors: {
            seasonAvg: Math.round(seasonAvg * 10) / 10,
            locationAdj: Math.round(locationAdj * 10) / 10,
            vsOpponent: Math.round(vsOpponentAdj * 10) / 10,
            recentForm: Math.round(recentFormAdj * 10) / 10
        }
    };
}

/**
 * Aplica factores contextuales generales
 */
export function applyContextualFactors(basePrediction, context) {
    let adjusted = { ...basePrediction };
    
    // Back to back games (reduce confianza 15%)
    if (context.backToBack) {
        adjusted.confidence *= 0.85;
    }
    
    // Rest days advantage
    if (context.restAdvantage) {
        const restDiff = context.homeRest - context.awayRest;
        if (Math.abs(restDiff) >= 2) {
            adjusted.confidence *= 1.05; // +5% si hay ventaja clara de descanso
        }
    }
    
    // Rivalries (históricamente más volátiles)
    if (context.isRivalry) {
        adjusted.confidence *= 0.92; // -8% confianza en rivalries
    }
    
    return {
        ...adjusted,
        confidence: Math.min(95, Math.max(10, Math.round(adjusted.confidence)))
    };
}
