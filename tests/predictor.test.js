// tests/predictor.test.js — Tests del motor predictivo NBA
// Run: npx vitest run tests/predictor.test.js

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ═══════════════════════════════════════════════════════════
// MOCK DATA — Datos de prueba realistas
// ═══════════════════════════════════════════════════════════

const mockPlayer = {
  id: 1,
  first_name: 'LeBron',
  last_name: 'James',
  position: 'F',
  team: { id: 13, full_name: 'Los Angeles Lakers', abbreviation: 'LAL' },
  stats: {
    pts: 25.4,
    reb: 7.2,
    ast: 7.8,
    stl: 1.3,
    blk: 0.6,
    fg_pct: 0.512,
    fg3_pct: 0.365,
    ft_pct: 0.756
  }
};

const mockGame = {
  id: 12345,
  date: '2025-02-12',
  home_team: { id: 13, name: 'Lakers', abbreviation: 'LAL' },
  visitor_team: { id: 2, name: 'Celtics', abbreviation: 'BOS' },
  home_team_score: 112,
  visitor_team_score: 108,
  status: 'Final'
};

const mockH2HHistory = [
  { date: '2025-01-15', home_score: 115, visitor_score: 110, winner: 'LAL' },
  { date: '2024-12-10', home_score: 108, visitor_score: 112, winner: 'BOS' },
  { date: '2024-11-05', home_score: 120, visitor_score: 105, winner: 'LAL' }
];

// ═══════════════════════════════════════════════════════════
// FUNCIONES A TESTEAR (extraídas del index.html)
// ═══════════════════════════════════════════════════════════

/**
 * Calcula ventaja de local
 */
function calcularVentajaLocal(isHome, teamStrength = 1.0) {
  if (!isHome) return 0;
  // Ventaja típica de local: 3-4 puntos
  const baseAdvantage = 3.5;
  return baseAdvantage * teamStrength;
}

/**
 * Calcula tendencia reciente (últimos 5 juegos)
 */
function calcularTendenciaReciente(games = []) {
  if (!games || games.length === 0) return 0;
  
  const recentGames = games.slice(0, 5);
  const wins = recentGames.filter(g => g.won).length;
  const winPct = wins / recentGames.length;
  
  // Hot team: >60% = boost positivo
  // Cold team: <40% = penalty negativo
  if (winPct >= 0.6) return 2.0;
  if (winPct <= 0.4) return -2.0;
  return 0;
}

/**
 * Calcula impacto de lesiones
 */
function calcularImpactoLesiones(injuries = []) {
  if (!injuries || injuries.length === 0) return 0;
  
  let penalty = 0;
  
  injuries.forEach(injury => {
    const ppg = injury.player?.stats?.pts || 0;
    
    if (ppg >= 25) penalty += 5;      // Superestrella
    else if (ppg >= 15) penalty += 3; // Starter clave
    else if (ppg >= 8) penalty += 1;  // Rotación
  });
  
  return -penalty; // Negativo porque perjudica
}

/**
 * Calcula factor Back-to-Back (fatiga)
 */
function calcularFactorB2B(lastGameDate, currentGameDate) {
  if (!lastGameDate || !currentGameDate) return 0;
  
  const last = new Date(lastGameDate);
  const current = new Date(currentGameDate);
  const diffDays = (current - last) / (1000 * 60 * 60 * 24);
  
  // B2B (1 día): -3 puntos
  if (diffDays <= 1) return -3;
  // 2 días: -1 punto
  if (diffDays <= 2) return -1;
  // 3+ días: sin efecto
  return 0;
}

/**
 * Analiza historial H2H
 */
function analizarH2H(h2hGames = [], teamId) {
  if (!h2hGames || h2hGames.length === 0) return { advantage: 0, confidence: 0 };
  
  const recentH2H = h2hGames.slice(0, 5); // Últimos 5 enfrentamientos
  const wins = recentH2H.filter(g => g.winner === teamId).length;
  const winRate = wins / recentH2H.length;
  
  let advantage = 0;
  let confidence = 0;
  
  // Dominancia clara
  if (winRate >= 0.8) {
    advantage = 3;
    confidence = 0.85;
  } else if (winRate >= 0.6) {
    advantage = 2;
    confidence = 0.7;
  } else if (winRate <= 0.2) {
    advantage = -3;
    confidence = 0.85;
  } else if (winRate <= 0.4) {
    advantage = -2;
    confidence = 0.7;
  } else {
    // Parejo
    advantage = 0;
    confidence = 0.5;
  }
  
  return { advantage, confidence };
}

/**
 * Predictor principal
 */
function predictGame(homeTeam, awayTeam, options = {}) {
  const {
    h2hHistory = [],
    homeInjuries = [],
    awayInjuries = [],
    homeLastGameDate = null,
    awayLastGameDate = null,
    gameDate = new Date().toISOString()
  } = options;
  
  // 1. Ventaja de local
  const homeAdvantage = calcularVentajaLocal(true, homeTeam.strength || 1.0);
  
  // 2. Tendencia reciente
  const homeTrend = calcularTendenciaReciente(homeTeam.recentGames);
  const awayTrend = calcularTendenciaReciente(awayTeam.recentGames);
  
  // 3. Lesiones
  const homeInjuryImpact = calcularImpactoLesiones(homeInjuries);
  const awayInjuryImpact = calcularImpactoLesiones(awayInjuries);
  
  // 4. Back-to-Back
  const homeB2B = calcularFactorB2B(homeLastGameDate, gameDate);
  const awayB2B = calcularFactorB2B(awayLastGameDate, gameDate);
  
  // 5. H2H
  const h2h = analizarH2H(h2hHistory, homeTeam.id);
  
  // Cálculo final
  const homeScore = 
    (homeTeam.avgPts || 110) +
    homeAdvantage +
    homeTrend +
    homeInjuryImpact +
    homeB2B +
    h2h.advantage;
  
  const awayScore = 
    (awayTeam.avgPts || 110) +
    awayTrend +
    awayInjuryImpact +
    awayB2B -
    h2h.advantage;
  
  const spread = homeScore - awayScore;
  const confidence = Math.min(
    0.5 + (Math.abs(spread) / 20) + (h2h.confidence * 0.3),
    0.95
  );
  
  return {
    homeScore: Math.round(homeScore),
    awayScore: Math.round(awayScore),
    spread: Math.round(spread * 10) / 10,
    predictedWinner: spread > 0 ? homeTeam.id : awayTeam.id,
    confidence: Math.round(confidence * 100) / 100
  };
}

// ═══════════════════════════════════════════════════════════
// TEST SUITES
// ═══════════════════════════════════════════════════════════

describe('Motor Predictivo NBA', () => {
  
  describe('calcularVentajaLocal', () => {
    it('da 3.5 puntos de ventaja al equipo local', () => {
      expect(calcularVentajaLocal(true)).toBe(3.5);
    });
    
    it('da 0 puntos al equipo visitante', () => {
      expect(calcularVentajaLocal(false)).toBe(0);
    });
    
    it('ajusta ventaja según fuerza del equipo', () => {
      expect(calcularVentajaLocal(true, 1.2)).toBe(4.2);
      expect(calcularVentajaLocal(true, 0.8)).toBe(2.8);
    });
  });
  
  describe('calcularTendenciaReciente', () => {
    it('da boost de +2 a equipos hot (>60% victorias)', () => {
      const hotGames = [
        { won: true }, { won: true }, { won: true }, { won: false }, { won: true }
      ];
      expect(calcularTendenciaReciente(hotGames)).toBe(2.0);
    });
    
    it('da penalti de -2 a equipos cold (<40% victorias)', () => {
      const coldGames = [
        { won: false }, { won: false }, { won: true }, { won: false }, { won: false }
      ];
      expect(calcularTendenciaReciente(coldGames)).toBe(-2.0);
    });
    
    it('da 0 a equipos con récord promedio', () => {
      const avgGames = [
        { won: true }, { won: false }, { won: true }, { won: false }, { won: true }
      ];
      expect(calcularTendenciaReciente(avgGames)).toBe(0);
    });
    
    it('retorna 0 si no hay juegos', () => {
      expect(calcularTendenciaReciente([])).toBe(0);
      expect(calcularTendenciaReciente(null)).toBe(0);
    });
  });
  
  describe('calcularImpactoLesiones', () => {
    it('penaliza -5 por superestrella lesionada (25+ PPG)', () => {
      const injuries = [{ player: { stats: { pts: 28.5 } } }];
      expect(calcularImpactoLesiones(injuries)).toBe(-5);
    });
    
    it('penaliza -3 por starter clave lesionado (15-24 PPG)', () => {
      const injuries = [{ player: { stats: { pts: 18.2 } } }];
      expect(calcularImpactoLesiones(injuries)).toBe(-3);
    });
    
    it('penaliza -1 por jugador de rotación (8-14 PPG)', () => {
      const injuries = [{ player: { stats: { pts: 10.5 } } }];
      expect(calcularImpactoLesiones(injuries)).toBe(-1);
    });
    
    it('acumula penalties por múltiples lesiones', () => {
      const injuries = [
        { player: { stats: { pts: 28 } } },
        { player: { stats: { pts: 16 } } },
        { player: { stats: { pts: 9 } } }
      ];
      expect(calcularImpactoLesiones(injuries)).toBe(-9); // -5 -3 -1
    });
    
    it('retorna 0 si no hay lesiones', () => {
      expect(calcularImpactoLesiones([])).toBe(0);
      expect(calcularImpactoLesiones(null)).toBe(0);
    });
  });
  
  describe('calcularFactorB2B', () => {
    it('penaliza -3 en back-to-back (1 día)', () => {
      const result = calcularFactorB2B('2025-02-11', '2025-02-12');
      expect(result).toBe(-3);
    });
    
    it('penaliza -1 con 2 días de descanso', () => {
      const result = calcularFactorB2B('2025-02-10', '2025-02-12');
      expect(result).toBe(-1);
    });
    
    it('no penaliza con 3+ días de descanso', () => {
      const result = calcularFactorB2B('2025-02-09', '2025-02-12');
      expect(result).toBe(0);
    });
    
    it('retorna 0 si no hay fechas', () => {
      expect(calcularFactorB2B(null, '2025-02-12')).toBe(0);
      expect(calcularFactorB2B('2025-02-11', null)).toBe(0);
    });
  });
  
  describe('analizarH2H', () => {
    it('detecta dominancia clara (80%+ victorias)', () => {
      const h2h = [
        { winner: 'LAL' },
        { winner: 'LAL' },
        { winner: 'LAL' },
        { winner: 'LAL' },
        { winner: 'BOS' }
      ];
      const result = analizarH2H(h2h, 'LAL');
      expect(result.advantage).toBe(3);
      expect(result.confidence).toBe(0.85);
    });
    
    it('detecta ventaja moderada (60-79%)', () => {
      const h2h = [
        { winner: 'LAL' },
        { winner: 'LAL' },
        { winner: 'LAL' },
        { winner: 'BOS' },
        { winner: 'BOS' }
      ];
      const result = analizarH2H(h2h, 'LAL');
      expect(result.advantage).toBe(2);
      expect(result.confidence).toBe(0.7);
    });
    
    it('detecta historial parejo (40-60%)', () => {
      const h2h = [
        { winner: 'LAL' },
        { winner: 'BOS' },
        { winner: 'LAL' },
        { winner: 'BOS' },
        { winner: 'LAL' }
      ];
      const result = analizarH2H(h2h, 'LAL');
      expect(result.advantage).toBe(0);
      expect(result.confidence).toBe(0.5);
    });
    
    it('retorna neutral si no hay historial', () => {
      const result = analizarH2H([], 'LAL');
      expect(result.advantage).toBe(0);
      expect(result.confidence).toBe(0);
    });
  });
  
  describe('predictGame - Predictor completo', () => {
    it('predice correctamente un partido equilibrado', () => {
      const home = { id: 'LAL', avgPts: 112, recentGames: [] };
      const away = { id: 'BOS', avgPts: 110, recentGames: [] };
      
      const result = predictGame(home, away);
      
      expect(result.homeScore).toBeGreaterThan(result.awayScore); // Ventaja local
      expect(result.spread).toBeGreaterThan(0);
      expect(result.predictedWinner).toBe('LAL');
      expect(result.confidence).toBeGreaterThan(0.5);
    });
    
    it('incorpora lesiones en la predicción', () => {
      const home = { id: 'LAL', avgPts: 112 };
      const away = { id: 'BOS', avgPts: 110 };
      const homeInjuries = [{ player: { stats: { pts: 28 } } }]; // -5 puntos
      
      const result = predictGame(home, away, { homeInjuries });
      
      // Home debería tener menos puntos por lesión
      expect(result.homeScore).toBeLessThan(112);
    });
    
    it('incorpora back-to-back en la predicción', () => {
      const home = { id: 'LAL', avgPts: 112 };
      const away = { id: 'BOS', avgPts: 110 };
      
      const result = predictGame(home, away, {
        homeLastGameDate: '2025-02-11',
        gameDate: '2025-02-12' // B2B
      });
      
      // Home debería tener -3 puntos por B2B
      expect(result.homeScore).toBeLessThan(112);
    });
    
    it('incorpora historial H2H en la predicción', () => {
      const home = { id: 'LAL', avgPts: 110 };
      const away = { id: 'BOS', avgPts: 110 };
      const h2hHistory = [
        { winner: 'LAL' }, { winner: 'LAL' }, { winner: 'LAL' }, 
        { winner: 'LAL' }, { winner: 'BOS' }
      ]; // LAL domina 80%
      
      const result = predictGame(home, away, { h2hHistory });
      
      expect(result.confidence).toBeGreaterThan(0.7); // Alta confianza
      expect(result.spread).toBeGreaterThan(5); // Spread amplio
    });
    
    it('aumenta confianza con spread grande', () => {
      const home = { id: 'LAL', avgPts: 120, strength: 1.2 };
      const away = { id: 'BOS', avgPts: 100 };
      
      const result = predictGame(home, away);
      
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });
});
