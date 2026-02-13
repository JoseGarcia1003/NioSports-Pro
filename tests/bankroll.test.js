// tests/bankroll.test.js
import { describe, it, expect } from 'vitest';

// Copiar estas funciones de tu index.html a un módulo separado
// src/services/bankroll.js

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

export function calculateWinRate(picks) {
    if (!picks || picks.length === 0) return 0;
    
    const settledPicks = picks.filter(p => p.result === 'win' || p.result === 'loss');
    if (settledPicks.length === 0) return 0;
    
    const wins = settledPicks.filter(p => p.result === 'win').length;
    return (wins / settledPicks.length) * 100;
}

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

// Tests
describe('Bankroll Management', () => {
    describe('ROI Calculation', () => {
        it('calcula ROI correctamente para picks ganadores', () => {
            const picks = [
                { stake: 100, odds: 1.9, result: 'win' },
                { stake: 100, odds: 2.0, result: 'win' },
                { stake: 100, odds: 1.85, result: 'win' }
            ];
            
            const roi = calculateROI(picks);
            
            // (90 + 100 + 85) / 300 * 100 = 91.67%
            expect(roi).toBeCloseTo(91.67, 1);
        });
        
        it('calcula ROI correctamente para picks perdedores', () => {
            const picks = [
                { stake: 100, odds: 1.9, result: 'loss' },
                { stake: 100, odds: 2.0, result: 'loss' }
            ];
            
            const roi = calculateROI(picks);
            
            // (-100 + -100) / 200 * 100 = -100%
            expect(roi).toBe(-100);
        });
        
        it('calcula ROI correctamente para mix de wins/losses', () => {
            const picks = [
                { stake: 100, odds: 2.0, result: 'win' },  // +100
                { stake: 100, odds: 1.9, result: 'loss' }, // -100
                { stake: 100, odds: 1.85, result: 'win' }  // +85
            ];
            
            const roi = calculateROI(picks);
            
            // (100 - 100 + 85) / 300 * 100 = 28.33%
            expect(roi).toBeCloseTo(28.33, 1);
        });
        
        it('retorna 0 si no hay picks', () => {
            expect(calculateROI([])).toBe(0);
        });
        
        it('ignora picks pendientes', () => {
            const picks = [
                { stake: 100, odds: 2.0, result: 'win' },
                { stake: 100, odds: 1.9, result: 'pending' }
            ];
            
            const roi = calculateROI(picks);
            
            // Solo cuenta el win: 100/100 * 100 = 100%
            expect(roi).toBe(100);
        });
    });
    
    describe('Win Rate Calculation', () => {
        it('calcula win rate correctamente', () => {
            const picks = [
                { result: 'win' },
                { result: 'win' },
                { result: 'loss' },
                { result: 'win' }
            ];
            
            const winRate = calculateWinRate(picks);
            
            // 3/4 = 75%
            expect(winRate).toBe(75);
        });
        
        it('retorna 0 si no hay picks resueltos', () => {
            const picks = [
                { result: 'pending' },
                { result: 'pending' }
            ];
            
            expect(calculateWinRate(picks)).toBe(0);
        });
        
        it('ignora picks pendientes en cálculo', () => {
            const picks = [
                { result: 'win' },
                { result: 'pending' },
                { result: 'loss' }
            ];
            
            const winRate = calculateWinRate(picks);
            
            // 1/2 = 50%
            expect(winRate).toBe(50);
        });
    });
    
    describe('Profit/Loss Calculation', () => {
        it('calcula profit correctamente', () => {
            const picks = [
                { stake: 100, odds: 2.0, result: 'win' },
                { stake: 50, odds: 1.8, result: 'win' }
            ];
            
            const pl = calculateProfitLoss(picks);
            
            // (100 * 1) + (50 * 0.8) = 140
            expect(pl).toBe(140);
        });
        
        it('calcula loss correctamente', () => {
            const picks = [
                { stake: 100, odds: 2.0, result: 'loss' },
                { stake: 50, odds: 1.8, result: 'loss' }
            ];
            
            const pl = calculateProfitLoss(picks);
            
            expect(pl).toBe(-150);
        });
    });
    
    describe('Streak Calculation', () => {
        it('identifica racha ganadora actual', () => {
            const picks = [
                { result: 'win', date: '2024-02-10' },
                { result: 'win', date: '2024-02-09' },
                { result: 'win', date: '2024-02-08' },
                { result: 'loss', date: '2024-02-07' }
            ];
            
            const streak = calculateStreak(picks);
            
            expect(streak.current).toBe(3);
            expect(streak.type).toBe('wins');
        });
        
        it('identifica racha perdedora actual', () => {
            const picks = [
                { result: 'loss', date: '2024-02-10' },
                { result: 'loss', date: '2024-02-09' },
                { result: 'win', date: '2024-02-08' }
            ];
            
            const streak = calculateStreak(picks);
            
            expect(streak.current).toBe(2);
            expect(streak.type).toBe('losses');
        });
        
        it('calcula racha más larga de wins', () => {
            const picks = [
                { result: 'loss', date: '2024-02-10' },
                { result: 'win', date: '2024-02-09' },
                { result: 'win', date: '2024-02-08' },
                { result: 'win', date: '2024-02-07' },
                { result: 'win', date: '2024-02-06' },
                { result: 'loss', date: '2024-02-05' }
            ];
            
            const streak = calculateStreak(picks);
            
            expect(streak.longest.wins).toBe(4);
        });
    });
    
    describe('Kelly Criterion', () => {
        it('calcula stake size correcto con ventaja', () => {
            const bankroll = 1000;
            const odds = 2.0; // 100% profit si gana
            const winProb = 0.6; // 60% probabilidad
            
            const stake = kellyStakeSize(bankroll, odds, winProb);
            
            // Kelly = (1 * 0.6 - 0.4) / 1 = 0.2 (20% del bankroll)
            // Fractional Kelly (25%) = 5% del bankroll = 50
            expect(stake).toBeCloseTo(50, 0);
        });
        
        it('retorna 0 si no hay ventaja (EV negativo)', () => {
            const bankroll = 1000;
            const odds = 2.0;
            const winProb = 0.4; // 40% probabilidad (desfavorable)
            
            const stake = kellyStakeSize(bankroll, odds, winProb);
            
            expect(stake).toBe(0);
        });
        
        it('no excede 5% del bankroll (protección)', () => {
            const bankroll = 1000;
            const odds = 5.0; // Odds muy altas
            const winProb = 0.8; // Alta probabilidad
            
            const stake = kellyStakeSize(bankroll, odds, winProb);
            
            // Aunque Kelly sugiera más, cap en 5%
            expect(stake).toBeLessThanOrEqual(50);
        });
        
        it('lanza error si bankroll inválido', () => {
            expect(() => {
                kellyStakeSize(0, 2.0, 0.6);
            }).toThrow('Invalid bankroll');
        });
        
        it('lanza error si odds inválidas', () => {
            expect(() => {
                kellyStakeSize(1000, 0.5, 0.6);
            }).toThrow('Invalid odds');
        });
        
        it('lanza error si winProbability fuera de rango', () => {
            expect(() => {
                kellyStakeSize(1000, 2.0, 1.5);
            }).toThrow('Win probability must be between 0 and 1');
        });
    });
});
