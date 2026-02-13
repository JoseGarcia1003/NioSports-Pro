// tests/bankroll.test.js
import { describe, it, expect } from 'vitest';
import {
    calculateROI,
    calculateWinRate,
    calculateProfitLoss,
    calculateStreak,
    kellyStakeSize
} from '../src/services/bankroll.js';

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
