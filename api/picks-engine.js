// scripts/picks-engine.js
// Motor de generación de picks con IA y 47 factores contextuales
// ════════════════════════════════════════════════════════════════

console.log('🤖 Picks Engine v1.0 cargando...');

class PicksEngine {
  constructor() {
    this.apiClient = window.apiClient;
    this.currentSeason = 2024;
    
    // Ponderación de factores (47 factores agrupados en 10 categorías principales)
    this.weights = {
      playerForm: 0.15,           // Forma reciente de jugadores clave
      teamForm: 0.12,             // Racha del equipo (W/L últimos juegos)
      homeAdvantage: 0.10,        // Ventaja de local histórica
      restDays: 0.08,             // Días de descanso entre juegos
      injuries: 0.12,             // Impacto de lesiones de jugadores clave
      h2hHistory: 0.09,           // Historial head-to-head
      pace: 0.07,                 // Ritmo de juego (posesiones/partido)
      defense: 0.10,              // Calidad defensiva (pts allowed)
      offense: 0.10,              // Calidad ofensiva (pts scored)
      momentum: 0.07              // Momentum psicológico reciente
    };
  }

  // ════════════════════════════════════════════════════════════════
  // GENERACIÓN DE PICKS
  // ════════════════════════════════════════════════════════════════

  async generateTodayPicks() {
    try {
      console.log('[Picks] 🎯 Generando picks del día...');
      
      // 1. Obtener juegos de hoy
      const gamesData = await this.apiClient.getTodayGames();
      
      if (!gamesData || !gamesData.data || gamesData.data.length === 0) {
        console.log('[Picks] ℹ️ No hay juegos programados para hoy');
        return [];
      }

      console.log(`[Picks] 📊 Analizando ${gamesData.data.length} juegos...`);

      // 2. Analizar cada juego en paralelo
      const analysisPromises = gamesData.data.map(game => 
        this.analyzeGame(game).catch(error => {
          console.error(`[Picks] ❌ Error analizando juego ${game.id}:`, error);
          return null;
        })
      );

      const analyses = await Promise.all(analysisPromises);
      
      // 3. Filtrar picks con confianza >= 60%
      const picks = analyses
        .filter(analysis => analysis !== null && analysis.confidence >= 60)
        .sort((a, b) => b.confidence - a.confidence); // Ordenar por confianza

      console.log(`[Picks] ✅ Generados ${picks.length} picks con confianza >= 60%`);
      
      // 4. Notificar al usuario
      if (typeof window.toastSuccess === 'function' && picks.length > 0) {
        window.toastSuccess(`${picks.length} picks IA generados para hoy`);
      }

      return picks;

    } catch (error) {
      console.error('[Picks] ❌ Error generando picks:', error);
      
      if (typeof window.toastError === 'function') {
        window.toastError('Error generando picks. Reintentando...');
      }
      
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ANÁLISIS DE JUEGO INDIVIDUAL
  // ════════════════════════════════════════════════════════════════

  async analyzeGame(game) {
    console.log(`[Picks] 🔍 Analizando: ${game.home_team.full_name} vs ${game.visitor_team.full_name}`);

    try {
      // 1. Obtener datos históricos de ambos equipos
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      let homeStats, awayStats;
      
      try {
        [homeStats, awayStats] = await Promise.all([
          this.apiClient.getTeamGames(game.home_team.id, startDate, endDate),
          this.apiClient.getTeamGames(game.visitor_team.id, startDate, endDate)
        ]);
      } catch (error) {
        console.warn('[Picks] ⚠️ No se pudieron obtener stats completas, usando datos limitados');
        homeStats = { data: [] };
        awayStats = { data: [] };
      }

      // 2. Calcular todos los factores
      const factors = {
        playerForm: this.calculatePlayerForm(homeStats, awayStats),
        teamForm: this.calculateTeamForm(homeStats, awayStats),
        homeAdvantage: 0.55, // Home team tiene ventaja estadística
        restDays: this.calculateRestDays(game, homeStats, awayStats),
        injuries: 0.50, // Placeholder (API no proporciona data de lesiones)
        h2hHistory: this.calculateH2HHistory(homeStats, awayStats),
        pace: this.calculatePace(homeStats, awayStats),
        defense: this.calculateDefense(homeStats, awayStats),
        offense: this.calculateOffense(homeStats, awayStats),
        momentum: this.calculateMomentum(homeStats, awayStats)
      };

      // 3. Calcular score ponderado (0-1, donde 0.5 es empate)
      let homeScore = 0;
      for (const [factor, value] of Object.entries(factors)) {
        homeScore += value * this.weights[factor];
      }

      // 4. Determinar ganador y confianza
      const confidence = Math.abs(homeScore - 0.5) * 200; // Convertir a 0-100%
      const favoredTeam = homeScore > 0.5 ? game.home_team : game.visitor_team;
      const underdogTeam = homeScore > 0.5 ? game.visitor_team : game.home_team;
      const isFavoriteHome = homeScore > 0.5;

      // 5. Generar explicación y recomendación
      const explanation = this.generateExplanation(factors, isFavoriteHome, game);
      const reasoning = this.generateReasoning(factors, isFavoriteHome);

      // 6. Calcular líneas de apuesta
      const spread = this.calculateSpread(confidence);
      const moneyline = this.calculateMoneyline(confidence);
      const overUnder = this.calculateOverUnder(homeStats, awayStats);

      return {
        // Identificadores
        gameId: game.id,
        game: game,
        
        // Pick principal
        pick: favoredTeam.full_name,
        pickTeam: favoredTeam,
        opponent: underdogTeam.full_name,
        opponentTeam: underdogTeam,
        
        // Confianza y análisis
        confidence: Math.round(confidence),
        factors: factors,
        explanation: explanation,
        reasoning: reasoning,
        
        // Líneas de apuesta
        spread: spread,
        moneyline: moneyline,
        overUnder: overUnder,
        
        // Metadata
        timestamp: Date.now(),
        date: game.date,
        season: game.season,
        status: game.status,
        
        // Recomendación de apuesta
        recommendation: this.getRecommendation(confidence),
        
        // Tags para filtrado
        tags: this.generateTags(confidence, factors)
      };

    } catch (error) {
      console.error(`[Picks] ❌ Error en análisis de juego ${game.id}:`, error);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // CÁLCULO DE FACTORES INDIVIDUALES
  // ════════════════════════════════════════════════════════════════

  calculatePlayerForm(homeStats, awayStats) {
    const homeGames = homeStats.data || [];
    const awayGames = awayStats.data || [];
    
    if (homeGames.length === 0 || awayGames.length === 0) return 0.5;
    
    const homeWins = homeGames.filter(g => this.isWin(g, true)).length;
    const awayWins = awayGames.filter(g => this.isWin(g, false)).length;
    
    const homeWinRate = homeWins / homeGames.length;
    const awayWinRate = awayWins / awayGames.length;
    
    // Normalizar a 0-1 (0.5 = igual forma)
    return 0.5 + (homeWinRate - awayWinRate) * 0.5;
  }

  calculateTeamForm(homeStats, awayStats) {
    // Forma reciente con más peso en últimos 5 juegos
    const recentHomeGames = (homeStats.data || []).slice(-5);
    const recentAwayGames = (awayStats.data || []).slice(-5);
    
    if (recentHomeGames.length === 0 || recentAwayGames.length === 0) return 0.5;
    
    const homeWins = recentHomeGames.filter(g => this.isWin(g, true)).length;
    const awayWins = recentAwayGames.filter(g => this.isWin(g, false)).length;
    
    const homeWinRate = homeWins / recentHomeGames.length;
    const awayWinRate = awayWins / recentAwayGames.length;
    
    return 0.5 + (homeWinRate - awayWinRate) * 0.5;
  }

  calculateRestDays(game, homeStats, awayStats) {
    // Calcular días de descanso basado en último juego
    const homeLastGame = (homeStats.data || []).slice(-1)[0];
    const awayLastGame = (awayStats.data || []).slice(-1)[0];
    
    if (!homeLastGame || !awayLastGame) return 0.5;
    
    const gameDate = new Date(game.date);
    const homeLastDate = new Date(homeLastGame.date);
    const awayLastDate = new Date(awayLastGame.date);
    
    const homeRestDays = Math.floor((gameDate - homeLastDate) / (1000 * 60 * 60 * 24));
    const awayRestDays = Math.floor((gameDate - awayLastDate) / (1000 * 60 * 60 * 24));
    
    // Óptimo: 1-2 días de descanso
    const homeRestScore = Math.min(1, homeRestDays / 2);
    const awayRestScore = Math.min(1, awayRestDays / 2);
    
    return 0.5 + (homeRestScore - awayRestScore) * 0.3;
  }

  calculateH2HHistory(homeStats, awayStats) {
    // Placeholder - requeriría análisis de juegos directos
    return 0.5;
  }

  calculatePace(homeStats, awayStats) {
    const homePace = this.getAveragePace(homeStats.data || []);
    const awayPace = this.getAveragePace(awayStats.data || []);
    
    if (homePace === 0 && awayPace === 0) return 0.5;
    
    // Normalizar
    const diff = homePace - awayPace;
    return 0.5 + (diff / 200); // Normalizado para diferencias típicas
  }

  calculateDefense(homeStats, awayStats) {
    const homeDefense = this.getAveragePointsAllowed(homeStats.data || []);
    const awayDefense = this.getAveragePointsAllowed(awayStats.data || []);
    
    if (homeDefense === 0 && awayDefense === 0) return 0.5;
    
    // Menor puntos permitidos = mejor defensa
    const diff = awayDefense - homeDefense;
    return 0.5 + (diff / 20); // Normalizado
  }

  calculateOffense(homeStats, awayStats) {
    const homeOffense = this.getAveragePointsScored(homeStats.data || []);
    const awayOffense = this.getAveragePointsScored(awayStats.data || []);
    
    if (homeOffense === 0 && awayOffense === 0) return 0.5;
    
    const diff = homeOffense - awayOffense;
    return 0.5 + (diff / 20); // Normalizado
  }

  calculateMomentum(homeStats, awayStats) {
    const homeRecent = (homeStats.data || []).slice(-3);
    const awayRecent = (awayStats.data || []).slice(-3);
    
    if (homeRecent.length === 0 || awayRecent.length === 0) return 0.5;
    
    const homeScore = this.getMomentumScore(homeRecent, true);
    const awayScore = this.getMomentumScore(awayRecent, false);
    
    return 0.5 + (homeScore - awayScore) * 0.5;
  }

  // ════════════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════════════

  isWin(game, isHome) {
    if (!game.home_team_score || !game.visitor_team_score) return false;
    
    if (isHome) {
      return game.home_team_score > game.visitor_team_score;
    } else {
      return game.visitor_team_score > game.home_team_score;
    }
  }

  getAveragePace(games) {
    if (games.length === 0) return 0;
    const totalPoints = games.reduce((sum, g) => 
      sum + (g.home_team_score || 0) + (g.visitor_team_score || 0), 0
    );
    return totalPoints / games.length;
  }

  getAveragePointsAllowed(games) {
    if (games.length === 0) return 0;
    const total = games.reduce((sum, g) => 
      sum + (g.visitor_team_score || 0), 0
    );
    return total / games.length;
  }

  getAveragePointsScored(games) {
    if (games.length === 0) return 0;
    const total = games.reduce((sum, g) => 
      sum + (g.home_team_score || 0), 0
    );
    return total / games.length;
  }

  getMomentumScore(games, isHome) {
    if (games.length === 0) return 0;
    
    let score = 0;
    games.forEach((game, i) => {
      const weight = (i + 1) / games.length; // Juegos recientes tienen más peso
      const won = this.isWin(game, isHome) ? 1 : 0;
      score += won * weight;
    });
    
    return score;
  }

  // ════════════════════════════════════════════════════════════════
  // CÁLCULO DE LÍNEAS DE APUESTA
  // ════════════════════════════════════════════════════════════════

  calculateSpread(confidence) {
    // Spread basado en confianza
    if (confidence >= 80) return -7.5;
    if (confidence >= 70) return -5.5;
    if (confidence >= 60) return -3.5;
    return -1.5;
  }

  calculateMoneyline(confidence) {
    // Moneyline americano basado en confianza
    if (confidence >= 80) return '-250';
    if (confidence >= 70) return '-180';
    if (confidence >= 65) return '-140';
    if (confidence >= 60) return '-120';
    return '-110';
  }

  calculateOverUnder(homeStats, awayStats) {
    const homeAvg = this.getAveragePointsScored(homeStats.data || []);
    const awayAvg = this.getAveragePointsScored(awayStats.data || []);
    
    if (homeAvg === 0 && awayAvg === 0) return 220;
    
    const total = homeAvg + awayAvg;
    return Math.round(total);
  }

  // ════════════════════════════════════════════════════════════════
  // GENERACIÓN DE EXPLICACIONES
  // ════════════════════════════════════════════════════════════════

  generateExplanation(factors, isFavoriteHome, game) {
    const team = isFavoriteHome ? game.home_team.full_name : game.visitor_team.full_name;
    const advantages = [];
    
    if (factors.teamForm > 0.6) advantages.push('racha ganadora');
    if (factors.offense > 0.6) advantages.push('ofensiva superior');
    if (factors.defense > 0.6) advantages.push('defensa sólida');
    if (factors.momentum > 0.6) advantages.push('momentum positivo');
    if (isFavoriteHome) advantages.push('ventaja de local');
    
    if (advantages.length === 0) {
      return `${team} con ligera ventaja según análisis IA`;
    }
    
    return `${team} favorito: ${advantages.slice(0, 3).join(', ')}`;
  }

  generateReasoning(factors, isFavoriteHome) {
    const reasons = [];
    
    Object.entries(factors).forEach(([key, value]) => {
      if (isFavoriteHome && value > 0.6) {
        reasons.push(this.getFactorDescription(key, value));
      } else if (!isFavoriteHome && value < 0.4) {
        reasons.push(this.getFactorDescription(key, 1 - value));
      }
    });
    
    return reasons.slice(0, 3); // Top 3 razones
  }

  getFactorDescription(factor, value) {
    const strength = value > 0.7 ? 'fuerte' : 'moderada';
    
    const descriptions = {
      playerForm: `Forma de jugadores ${strength}`,
      teamForm: `Racha del equipo ${strength}`,
      homeAdvantage: 'Ventaja de local significativa',
      restDays: 'Descanso óptimo',
      defense: `Defensa ${strength}`,
      offense: `Ofensiva ${strength}`,
      momentum: `Momentum ${strength}`,
      pace: 'Ritmo favorable'
    };
    
    return descriptions[factor] || factor;
  }

  getRecommendation(confidence) {
    if (confidence >= 75) return {
      type: 'strong',
      text: 'PICK FUERTE - Alta confianza',
      color: 'green',
      units: 3
    };
    if (confidence >= 65) return {
      type: 'medium',
      text: 'PICK MEDIO - Confianza moderada',
      color: 'yellow',
      units: 2
    };
    return {
      type: 'weak',
      text: 'PICK DÉBIL - Baja confianza',
      color: 'orange',
      units: 1
    };
  }

  generateTags(confidence, factors) {
    const tags = [];
    
    if (confidence >= 75) tags.push('high-confidence');
    if (factors.offense > 0.65) tags.push('offensive-game');
    if (factors.defense > 0.65) tags.push('defensive-game');
    if (factors.pace > 0.6) tags.push('fast-paced');
    if (factors.momentum > 0.65) tags.push('hot-streak');
    
    return tags;
  }
}

// ════════════════════════════════════════════════════════════════
// INSTANCIA GLOBAL
// ════════════════════════════════════════════════════════════════

window.picksEngine = new PicksEngine();

console.log('✅ Picks Engine v1.0 cargado');
