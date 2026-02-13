// src/services/bankroll.js
// Funciones de manejo de bankroll y cálculos financieros

/**
 * Calcula el ROI (Return on Investment) de un conjunto de picks
 * @param {Array} picks - Array de picks con stake, odds, result
 * @returns {number} ROI en porcentaje
 */
export function calculateROI(picks) {
    if (!picks || picks.length === 0) return 0;
    
    const totalStaked = picks.reduce((sum, p) => sum + (p.stake || 0), 0);
    const totalProfit = picks.reduce((sum, p) => {
        if (p.result === 'win') {
            return sum + ((p.stake || 0) * ((p.odds || 0) - 1));
        } else if (p.result === 'loss') {
            return sum - (p.stake || 0);
        }
        return sum;
    }, 0);
    
    if (totalStaked === 0) return 0;
    return (totalProfit / totalStaked) * 100;
}

/**
 * Calcula el Win Rate (porcentaje de aciertos)
 * @param {Array} picks - Array de picks
 * @returns {number} Win rate en porcentaje
 */
export function calculateWinRate(picks) {
    if (!picks || picks.length === 0) return 0;
    
    const settledPicks = picks.filter(p => p.result === 'win' || p.result === 'loss');
    if (settledPicks.length === 0) return 0;
    
    const wins = settledPicks.filter(p => p.result === 'win').length;
    return (wins / settledPicks.length) * 100;
}

/**
 * Calcula el Profit/Loss total
 * @param {Array} picks - Array de picks
 * @returns {number} Profit/Loss total
 */
export function calculateProfitLoss(picks) {
    if (!picks || picks.length === 0) return 0;
    
    return picks.reduce((sum, p) => {
        if (p.result === 'win') {
            return sum + ((p.stake || 0) * ((p.odds || 0) - 1));
        } else if (p.result === 'loss') {
            return sum - (p.stake || 0);
        }
        return sum;
    }, 0);
}

/**
 * Calcula rachas actuales y más largas
 * @param {Array} picks - Array de picks ordenados por fecha
 * @returns {Object} { current, type, longest: { wins, losses } }
 */
export function calculateStreak(picks) {
    if (!picks || picks.length === 0) {
        return { current: 0, type: 'none', longest: { wins: 0, losses: 0 } };
    }
    
    // Ordenar por fecha (más reciente primero)
    const sorted = [...picks]
        .filter(p => p.result === 'win' || p.result === 'loss')
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (sorted.length === 0) {
        return { current: 0, type: 'none', longest: { wins: 0, losses: 0 } };
    }
    
    // Current streak
    let current = 1;
    const firstResult = sorted[0].result;
    
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].result === firstResult) {
            current++;
        } else {
            break;
        }
    }
    
    // Longest streaks
    let longestWins = 0;
    let longestLosses = 0;
    let tempWins = 0;
    let tempLosses = 0;
    
    sorted.reverse().forEach(pick => {
        if (pick.result === 'win') {
            tempWins++;
            tempLosses = 0;
            longestWins = Math.max(longestWins, tempWins);
        } else {
            tempLosses++;
            tempWins = 0;
            longestLosses = Math.max(longestLosses, tempLosses);
        }
    });
    
    return {
        current,
        type: firstResult === 'win' ? 'wins' : 'losses',
        longest: {
            wins: longestWins,
            losses: longestLosses
        }
    };
}

/**
 * Calcula el tamaño óptimo de apuesta usando Kelly Criterion
 * @param {number} bankroll - Bankroll actual
 * @param {number} odds - Cuota decimal
 * @param {number} winProbability - Probabilidad de ganar (0-1)
 * @returns {number} Stake sugerido
 */
export function kellyStakeSize(bankroll, odds, winProbability) {
    // Kelly Criterion: f = (bp - q) / b
    // f = fracción del bankroll a apostar
    // b = odds decimales - 1
    // p = probabilidad de ganar (0-1)
    // q = probabilidad de perder (1-p)
    
    if (!bankroll || bankroll <= 0) throw new Error('Invalid bankroll');
    if (!odds || odds < 1.01) throw new Error('Invalid odds');
    if (!winProbability || winProbability <= 0 || winProbability >= 1) {
        throw new Error('Win probability must be between 0 and 1');
    }
    
    const b = odds - 1;
    const p = winProbability;
    const q = 1 - p;
    
    const kellyFraction = (b * p - q) / b;
    
    // No apostar si Kelly es negativo (EV negativo)
    if (kellyFraction <= 0) return 0;
    
    // Aplicar "fractional Kelly" (25% para ser conservador)
    const fractionalKelly = kellyFraction * 0.25;
    
    // Stake sugerido
    const stake = bankroll * fractionalKelly;
    
    // Cap máximo: 5% del bankroll
    const maxStake = bankroll * 0.05;
    
    return Math.min(stake, maxStake);
}

/**
 * Calcula estadísticas agregadas del bankroll
 * @param {Array} picks - Array de picks
 * @param {Object} bankroll - { initial, current }
 * @returns {Object} Stats completas
 */
export function calculateBankrollStats(picks, bankroll) {
    return {
        roi: calculateROI(picks),
        winRate: calculateWinRate(picks),
        profitLoss: calculateProfitLoss(picks),
        streak: calculateStreak(picks),
        totalPicks: picks.length,
        settledPicks: picks.filter(p => p.result === 'win' || p.result === 'loss').length,
        pendingPicks: picks.filter(p => p.result === 'pending').length,
        growthPercentage: bankroll.initial > 0 
            ? ((bankroll.current - bankroll.initial) / bankroll.initial) * 100 
            : 0
    };
}
