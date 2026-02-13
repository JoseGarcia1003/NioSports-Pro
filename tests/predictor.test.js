// tests/predictor.test.js
import { describe, it, expect } from 'vitest';
import { 
    calculateTotalsPrediction, 
    calculatePropsPrediction,
    applyContextualFactors 
} from '../src/services/predictor.js';

describe('Motor Predictivo - Totals', () => {
    const leagueAverages = {
        pace: 100,
        ppg: 115
    };
    
    describe('Cálculos básicos', () => {
        it('predice OVER cuando proyección > línea', () => {
            const gameData = {
                homeTeam: 'Lakers',
                awayTeam: 'Celtics',
                line: 220.5,
                homeStats: {
                    pace: 102,
                    ppg: 118,
                    oppPpg: 110,
                    gamesPlayed: 20
                },
                awayStats: {
                    pace: 98,
                    ppg: 114,
                    oppPpg: 108,
                    gamesPlayed: 20
                },
                leagueAverages
            };
            
            const result = calculateTotalsPrediction(gameData);
            
            expect(result.pick).toBe('OVER');
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.confidence).toBeLessThanOrEqual(100);
            expect(result.projectedTotal).toBeGreaterThan(gameData.line);
        });
        
        it('predice UNDER cuando proyección < línea', () => {
            const gameData = {
                homeTeam: 'Pistons',
                awayTeam: 'Knicks',
                line: 225.5,
                homeStats: {
                    pace: 95,
                    ppg: 105,
                    oppPpg: 100,
                    gamesPlayed: 20
                },
                awayStats: {
                    pace: 94,
                    ppg: 108,
                    oppPpg: 102,
                    gamesPlayed: 20
                },
                leagueAverages
            };
            
            const result = calculateTotalsPrediction(gameData);
            
            expect(result.pick).toBe('UNDER');
            expect(result.projectedTotal).toBeLessThan(gameData.line);
        });
    });
    
    describe('Ajustes por pace', () => {
        it('aumenta proyección para equipos de pace alto', () => {
            const highPaceGame = {
                homeTeam: 'Warriors',
                awayTeam: 'Kings',
                line: 230,
                homeStats: {
                    pace: 110, // +10% vs liga
                    ppg: 120,
                    oppPpg: 115,
                    gamesPlayed: 20
                },
                awayStats: {
                    pace: 108,
                    ppg: 118,
                    oppPpg: 113,
                    gamesPlayed: 20
                },
                leagueAverages
            };
            
            const lowPaceGame = {
                ...highPaceGame,
                homeStats: { ...highPaceGame.homeStats, pace: 90 },
                awayStats: { ...highPaceGame.awayStats, pace: 92 }
            };
            
            const highResult = calculateTotalsPrediction(highPaceGame);
            const lowResult = calculateTotalsPrediction(lowPaceGame);
            
            expect(highResult.projectedTotal).toBeGreaterThan(lowResult.projectedTotal);
        });
    });
    
    describe('Home court advantage', () => {
        it('aplica bonus de local correctamente', () => {
            const gameData = {
                homeTeam: 'Lakers',
                awayTeam: 'Celtics',
                line: 220,
                homeStats: {
                    pace: 100,
                    ppg: 115,
                    oppPpg: 110,
                    gamesPlayed: 20
                },
                awayStats: {
                    pace: 100,
                    ppg: 115,
                    oppPpg: 110,
                    gamesPlayed: 20
                },
                leagueAverages
            };
            
            const result = calculateTotalsPrediction(gameData);
            
            // Home court bonus debe estar en factors
            expect(result.factors.homeCourtAdv).toBe(2.5);
        });
    });
    
    describe('Impacto de lesiones', () => {
        it('reduce proyección cuando hay lesionados', () => {
            const gameData = {
                homeTeam: 'Lakers',
                awayTeam: 'Celtics',
                line: 220,
                homeStats: {
                    pace: 100,
                    ppg: 115,
                    oppPpg: 110,
                    gamesPlayed: 20
                },
                awayStats: {
                    pace: 100,
                    ppg: 115,
                    oppPpg: 110,
                    gamesPlayed: 20
                },
                leagueAverages,
                injuries: []
            };
            
            const withoutInjuries = calculateTotalsPrediction(gameData);
            
            const withInjuries = calculateTotalsPrediction({
                ...gameData,
                injuries: [
                    { team: 'Lakers', player: 'LeBron James', ppgImpact: 28 },
                    { team: 'Celtics', player: 'Jayson Tatum', ppgImpact: 27 }
                ]
            });
            
            expect(withInjuries.projectedTotal).toBeLessThan(withoutInjuries.projectedTotal);
            expect(withInjuries.confidence).toBeLessThan(withoutInjuries.confidence);
        });
    });
    
    describe('Validaciones', () => {
        it('lanza error si faltan datos requeridos', () => {
            expect(() => {
                calculateTotalsPrediction({});
            }).toThrow('Missing required game data');
        });
        
        it('lanza error si faltan stats de equipos', () => {
            expect(() => {
                calculateTotalsPrediction({
                    homeTeam: 'Lakers',
                    awayTeam: 'Celtics',
                    line: 220
                });
            }).toThrow('Missing team stats');
        });
    });
    
    describe('Confidence calculation', () => {
        it('confianza nunca excede 95%', () => {
            const gameData = {
                homeTeam: 'Lakers',
                awayTeam: 'Celtics',
                line: 200, // Línea muy baja
                homeStats: {
                    pace: 110,
                    ppg: 130,
                    oppPpg: 110,
                    gamesPlayed: 50
                },
                awayStats: {
                    pace: 110,
                    ppg: 125,
                    oppPpg: 108,
                    gamesPlayed: 50
                },
                leagueAverages
            };
            
            const result = calculateTotalsPrediction(gameData);
            expect(result.confidence).toBeLessThanOrEqual(95);
        });
        
        it('reduce confianza si hay pocos juegos jugados', () => {
            const manyGames = {
                homeTeam: 'Lakers',
                awayTeam: 'Celtics',
                line: 220,
                homeStats: {
                    pace: 100,
                    ppg: 115,
                    oppPpg: 110,
                    gamesPlayed: 50
                },
                awayStats: {
                    pace: 100,
                    ppg: 115,
                    oppPpg: 110,
                    gamesPlayed: 50
                },
                leagueAverages
            };
            
            const fewGames = {
                ...manyGames,
                homeStats: { ...manyGames.homeStats, gamesPlayed: 5 }
            };
            
            const manyResult = calculateTotalsPrediction(manyGames);
            const fewResult = calculateTotalsPrediction(fewGames);
            
            expect(fewResult.confidence).toBeLessThan(manyResult.confidence);
        });
    });
});

describe('Motor Predictivo - Props', () => {
    describe('Cálculos básicos', () => {
        it('predice OVER para jugador en racha', () => {
            const propData = {
                player: 'LeBron James',
                stat: 'pts',
                line: 25.5,
                opponent: 'Celtics',
                playerStats: {
                    pts: 27.5,
                    gamesPlayed: 30,
                    last5: [
                        { pts: 32 },
                        { pts: 28 },
                        { pts: 31 },
                        { pts: 29 },
                        { pts: 30 }
                    ]
                },
                homeAway: 'home'
            };
            
            const result = calculatePropsPrediction(propData);
            
            expect(result.pick).toBe('OVER');
            expect(result.projection).toBeGreaterThan(propData.line);
            expect(result.confidence).toBeGreaterThan(50);
        });
        
        it('predice UNDER para jugador en mala racha', () => {
            const propData = {
                player: 'Player X',
                stat: 'pts',
                line: 20.5,
                opponent: 'Lakers',
                playerStats: {
                    pts: 22,
                    gamesPlayed: 30,
                    last5: [
                        { pts: 15 },
                        { pts: 18 },
                        { pts: 16 },
                        { pts: 17 },
                        { pts: 14 }
                    ]
                },
                homeAway: 'away'
            };
            
            const result = calculatePropsPrediction(propData);
            
            expect(result.pick).toBe('UNDER');
        });
    });
    
    describe('Home/Away splits', () => {
        it('aumenta proyección si juega en casa y tiene buenos números home', () => {
            const propData = {
                player: 'Player X',
                stat: 'pts',
                line: 25,
                opponent: 'Celtics',
                playerStats: {
                    pts: 24,
                    homeAvg: { pts: 28 },
                    awayAvg: { pts: 20 },
                    gamesPlayed: 30
                },
                homeAway: 'home'
            };
            
            const result = calculatePropsPrediction(propData);
            
            expect(result.projection).toBeGreaterThan(propData.playerStats.pts);
            expect(result.factors.locationAdj).toBeGreaterThan(0);
        });
    });
    
    describe('Vs opponent history', () => {
        it('ajusta según historial vs equipo específico', () => {
            const propData = {
                player: 'Player X',
                stat: 'pts',
                line: 22,
                opponent: 'Celtics',
                playerStats: {
                    pts: 22,
                    gamesPlayed: 30
                },
                vsTeamHistory: [
                    { pts: 35 },
                    { pts: 32 },
                    { pts: 30 }
                ],
                homeAway: 'home'
            };
            
            const result = calculatePropsPrediction(propData);
            
            expect(result.factors.vsOpponent).toBeGreaterThan(0);
            expect(result.pick).toBe('OVER');
        });
    });
    
    describe('Validaciones', () => {
        it('lanza error si faltan datos requeridos', () => {
            expect(() => {
                calculatePropsPrediction({});
            }).toThrow('Missing required prop data');
        });
    });
});

describe('Factores Contextuales', () => {
    it('reduce confianza en back-to-back games', () => {
        const basePrediction = {
            pick: 'OVER',
            confidence: 80,
            projectedTotal: 225
        };
        
        const adjusted = applyContextualFactors(basePrediction, {
            backToBack: true
        });
        
        expect(adjusted.confidence).toBeLessThan(basePrediction.confidence);
    });
    
    it('aumenta confianza con ventaja de descanso', () => {
        const basePrediction = {
            pick: 'OVER',
            confidence: 70
        };
        
        const adjusted = applyContextualFactors(basePrediction, {
            restAdvantage: true,
            homeRest: 3,
            awayRest: 0
        });
        
        expect(adjusted.confidence).toBeGreaterThan(basePrediction.confidence);
    });
    
    it('reduce confianza en rivalries', () => {
        const basePrediction = {
            pick: 'UNDER',
            confidence: 75
        };
        
        const adjusted = applyContextualFactors(basePrediction, {
            isRivalry: true
        });
        
        expect(adjusted.confidence).toBeLessThan(basePrediction.confidence);
    });
    
    it('confidence nunca sale del rango 10-95', () => {
        const basePrediction = {
            pick: 'OVER',
            confidence: 5 // Muy baja
        };
        
        const adjusted = applyContextualFactors(basePrediction, {
            backToBack: true,
            isRivalry: true
        });
        
        expect(adjusted.confidence).toBeGreaterThanOrEqual(10);
        expect(adjusted.confidence).toBeLessThanOrEqual(95);
    });
});
