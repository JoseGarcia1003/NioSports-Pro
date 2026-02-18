// scripts/picks-engine.js
// Motor de predicción NioSports Pro v2.0
// Conectado con nba-stats.json — Datos reales de TeamRankings.com
// ════════════════════════════════════════════════════════════════

console.log('🤖 Picks Engine v2.0 cargando...');

class PicksEngine {
  constructor() {
    this.apiClient = window.apiClient;
    this.currentSeason = 2024;
    this.teamStats = null;       // Datos de nba-stats.json
    this.leagueAverages = null;
    this.statsLoaded = false;

    // Pesos del modelo para cada mercado
    // Q1 Total — factores relevantes para el primer cuarto
    this.weights = {
      q1Offense: 0.30,     // Promedio de Q1 del equipo (home/away split)
      q1Defense: 0.30,     // Promedio de Q1 permitido al rival
      pace: 0.15,          // Ritmo combinado de ambos equipos
      homeAwayAdj: 0.10,   // Ajuste por local/visitante
      formAdj: 0.10,       // Ajuste por racha reciente (desde API)
      restAdj: 0.05        // Ajuste por días de descanso
    };

    // Mapa de nombres BallDontLie → nba-stats.json
    this.teamNameMap = {
      'Atlanta Hawks': 'Hawks',
      'Boston Celtics': 'Celtics',
      'Brooklyn Nets': 'Nets',
      'Charlotte Hornets': 'Hornets',
      'Chicago Bulls': 'Bulls',
      'Cleveland Cavaliers': 'Cavaliers',
      'Dallas Mavericks': 'Mavericks',
      'Denver Nuggets': 'Nuggets',
      'Detroit Pistons': 'Pistons',
      'Golden State Warriors': 'Warriors',
      'Houston Rockets': 'Rockets',
      'Indiana Pacers': 'Pacers',
      'Los Angeles Clippers': 'Clippers',
      'Los Angeles Lakers': 'Lakers',
      'Memphis Grizzlies': 'Grizzlies',
      'Miami Heat': 'Heat',
      'Milwaukee Bucks': 'Bucks',
      'Minnesota Timberwolves': 'Timberwolves',
      'New Orleans Pelicans': 'Pelicans',
      'New York Knicks': 'Knicks',
      'Oklahoma City Thunder': 'Thunder',
      'Orlando Magic': 'Magic',
      'Philadelphia 76ers': '76ers',
      'Phoenix Suns': 'Suns',
      'Portland Trail Blazers': 'Trail Blazers',
      'Sacramento Kings': 'Kings',
      'San Antonio Spurs': 'Spurs',
      'Toronto Raptors': 'Raptors',
      'Utah Jazz': 'Jazz',
      'Washington Wizards': 'Wizards'
    };
  }

  // ════════════════════════════════════════════════════════════════
  // CARGA DE ESTADÍSTICAS — nba-stats.json
  // ════════════════════════════════════════════════════════════════

  async loadTeamStats() {
    if (this.statsLoaded) return;

    try {
      console.log('[Picks] 📊 Cargando nba-stats.json...');
      const res = await fetch('/data/nba-stats.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      this.teamStats = data.teams;
      this.leagueAverages = data.leagueAverages;
      this.statsLoaded = true;

      const teamCount = Object.keys(this.teamStats).length;
      console.log(`[Picks] ✅ Stats cargadas: ${teamCount} equipos, fuente: ${data.source}`);
    } catch (error) {
      console.error('[Picks] ❌ Error cargando nba-stats.json:', error);
      this.teamStats = {};
      this.leagueAverages = { pace: 103.7, ppg: 115.7 };
    }
  }

  getTeamStats(fullName) {
    const shortName = this.teamNameMap[fullName] || fullName;
    return this.teamStats?.[shortName] || null;
  }

  // ════════════════════════════════════════════════════════════════
  // GENERACIÓN DE PICKS DEL DÍA
  // ════════════════════════════════════════════════════════════════

  async generateTodayPicks() {
    try {
      await this.loadTeamStats();

      console.log('[Picks] 🎯 Generando picks del día...');
      const gamesData = await this.apiClient.getTodayGames();

      if (!gamesData?.data?.length) {
        console.log('[Picks] ℹ️ No hay juegos hoy');
        return [];
      }

      console.log(`[Picks] 📊 Analizando ${gamesData.data.length} juegos...`);

      const analysisPromises = gamesData.data.map(game =>
        this.analyzeGame(game).catch(err => {
          console.error(`[Picks] ❌ Error juego ${game.id}:`, err);
          return null;
        })
      );

      const analyses = await Promise.all(analysisPromises);
      const picks = analyses
        .filter(a => a !== null && a.bestPick.confidence >= 55)
        .sort((a, b) => b.bestPick.confidence - a.bestPick.confidence);

      console.log(`[Picks] ✅ ${picks.length} picks con confianza ≥ 55%`);

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
  // ANÁLISIS DE JUEGO — 3 MERCADOS
  // ════════════════════════════════════════════════════════════════

  async analyzeGame(game) {
    const homeFullName = game.home_team.full_name;
    const awayFullName = game.visitor_team.full_name;

    console.log(`[Picks] 🔍 ${awayFullName} @ ${homeFullName}`);

    // Stats reales de nba-stats.json
    const homeData = this.getTeamStats(homeFullName);
    const awayData = this.getTeamStats(awayFullName);

    // Stats dinámicas de los últimos 30 días (BallDontLie)
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let homeRecent = { data: [] };
    let awayRecent = { data: [] };

    try {
      [homeRecent, awayRecent] = await Promise.all([
        this.apiClient.getTeamGames(game.home_team.id, startDate, endDate),
        this.apiClient.getTeamGames(game.visitor_team.id, startDate, endDate)
      ]);
    } catch {
      console.warn('[Picks] ⚠️ Sin datos recientes de API, usando solo nba-stats.json');
    }

    // Factores dinámicos (basados en juegos recientes)
    const formAdj  = this.calcFormAdjustment(homeRecent.data, awayRecent.data);
    const restAdj  = this.calcRestAdjustment(game, homeRecent.data, awayRecent.data);

    // Los 3 mercados
    const q1Pick   = this.predictQ1Total(homeData, awayData, formAdj, restAdj);
    const halfPick = this.predictHalfTotal(homeData, awayData, formAdj, restAdj);
    const fullPick = this.predictFullTotal(homeData, awayData, formAdj, restAdj);

    // El mejor pick del juego (mayor confianza)
    const allPicks = [q1Pick, halfPick, fullPick];
    const bestPick = allPicks.reduce((best, p) => p.confidence > best.confidence ? p : best);

    return {
      gameId: game.id,
      game,
      homeTeam: homeFullName,
      awayTeam: awayFullName,
      hasRealData: !!(homeData && awayData),

      // Los 3 mercados analizados
      markets: { q1: q1Pick, half: halfPick, full: fullPick },

      // El pick de mayor confianza para mostrar en el dashboard
      bestPick,

      // Info de contexto
      homeStats: homeData,
      awayStats: awayData,
      formAdj,
      restAdj,
      timestamp: Date.now(),
      date: game.date,
      status: game.status
    };
  }

  // ════════════════════════════════════════════════════════════════
  // PREDICCIÓN Q1 TOTAL (MERCADO PRINCIPAL)
  // ════════════════════════════════════════════════════════════════

  predictQ1Total(homeData, awayData, formAdj, restAdj) {
    if (!homeData || !awayData) {
      return this.fallbackPick('Q1', 'Sin datos reales disponibles');
    }

    // Puntos esperados del equipo local en Q1
    // Usamos el split home porque juega de local
    const homeQ1Scored   = homeData.q1Home;     // cuánto anota el local en Q1 en casa
    const homeQ1Allowed  = homeData.oppQ1;       // cuánto permite el local en Q1

    // Puntos esperados del visitante en Q1
    // Usamos split away porque juega de visitante
    const awayQ1Scored   = awayData.q1Away;     // cuánto anota el visitante en Q1 fuera
    const awayQ1Allowed  = awayData.oppQ1;       // cuánto permite el visitante en Q1

    // Total esperado: promedio entre lo que anota cada uno vs lo que permite el rival
    const homeExpected = (homeQ1Scored + awayQ1Allowed) / 2;
    const awayExpected = (awayQ1Scored + homeQ1Allowed) / 2;

    let projectedTotal = homeExpected + awayExpected;

    // Ajuste de pace: si ambos equipos son rápidos, sube el total
    const combinedPace = (homeData.pace + awayData.pace) / 2;
    const leaguePace   = this.leagueAverages?.pace || 103.7;
    const paceMultiplier = 1 + (combinedPace - leaguePace) / leaguePace * 0.5;
    projectedTotal *= paceMultiplier;

    // Ajuste forma reciente y descanso (pequeños ajustes ±3%)
    projectedTotal *= (1 + formAdj * 0.03 + restAdj * 0.02);

    // Línea de mercado sugerida (redondear a .5)
    const line = Math.round(projectedTotal * 2) / 2;

    // Confianza basada en:
    // 1. Qué tan extremas son las estadísticas vs la media
    // 2. Divergencia entre ofensas y defensas
    const confidence = this.calcQ1Confidence(homeData, awayData, projectedTotal);

    // Recomendación: Over o Under
    const leagueQ1Avg = 28.5; // promedio NBA Q1 ~28-29 pts por equipo
    const leagueQ1Total = leagueQ1Avg * 2; // ~57 pts totales en Q1
    const direction = projectedTotal > leagueQ1Total ? 'OVER' : 'UNDER';

    return {
      market: 'Q1',
      marketLabel: '1er Cuarto',
      projectedTotal: parseFloat(projectedTotal.toFixed(1)),
      line,
      direction,
      confidence: Math.min(85, Math.max(50, Math.round(confidence))),
      homeExpected: parseFloat(homeExpected.toFixed(1)),
      awayExpected: parseFloat(awayExpected.toFixed(1)),
      factors: {
        homeQ1Scored, homeQ1Allowed,
        awayQ1Scored, awayQ1Allowed,
        combinedPace: parseFloat(combinedPace.toFixed(1)),
        paceVsLeague: parseFloat((combinedPace - leaguePace).toFixed(1))
      },
      reasoning: this.buildQ1Reasoning(homeData, awayData, direction, projectedTotal)
    };
  }

  // ════════════════════════════════════════════════════════════════
  // PREDICCIÓN PRIMERA MITAD
  // ════════════════════════════════════════════════════════════════

  predictHalfTotal(homeData, awayData, formAdj, restAdj) {
    if (!homeData || !awayData) {
      return this.fallbackPick('1H', 'Sin datos reales disponibles');
    }

    const homeHalfScored  = homeData.halfHome;
    const homeHalfAllowed = homeData.oppHalf;
    const awayHalfScored  = awayData.halfAway;
    const awayHalfAllowed = awayData.oppHalf;

    const homeExpected = (homeHalfScored + awayHalfAllowed) / 2;
    const awayExpected = (awayHalfScored + homeHalfAllowed) / 2;
    let projectedTotal = homeExpected + awayExpected;

    const combinedPace = (homeData.pace + awayData.pace) / 2;
    const leaguePace   = this.leagueAverages?.pace || 103.7;
    const paceMultiplier = 1 + (combinedPace - leaguePace) / leaguePace * 0.4;
    projectedTotal *= paceMultiplier;
    projectedTotal *= (1 + formAdj * 0.03 + restAdj * 0.02);

    const line = Math.round(projectedTotal * 2) / 2;
    const leagueHalfTotal = 115; // ~57.5 por equipo en primera mitad
    const direction = projectedTotal > leagueHalfTotal ? 'OVER' : 'UNDER';
    const confidence = this.calcHalfConfidence(homeData, awayData, projectedTotal);

    return {
      market: '1H',
      marketLabel: 'Primera Mitad',
      projectedTotal: parseFloat(projectedTotal.toFixed(1)),
      line,
      direction,
      confidence: Math.min(85, Math.max(50, Math.round(confidence))),
      homeExpected: parseFloat(homeExpected.toFixed(1)),
      awayExpected: parseFloat(awayExpected.toFixed(1)),
      factors: {
        homeHalfScored, homeHalfAllowed,
        awayHalfScored, awayHalfAllowed,
        combinedPace: parseFloat(combinedPace.toFixed(1))
      },
      reasoning: this.buildHalfReasoning(homeData, awayData, direction, projectedTotal)
    };
  }

  // ════════════════════════════════════════════════════════════════
  // PREDICCIÓN TIEMPO COMPLETO
  // ════════════════════════════════════════════════════════════════

  predictFullTotal(homeData, awayData, formAdj, restAdj) {
    if (!homeData || !awayData) {
      return this.fallbackPick('Full', 'Sin datos reales disponibles');
    }

    const homeFullScored  = homeData.fullHome;
    const homeFullAllowed = homeData.oppPpgHome;
    const awayFullScored  = awayData.fullAway;
    const awayFullAllowed = awayData.oppPpgAway;

    const homeExpected = (homeFullScored + awayFullAllowed) / 2;
    const awayExpected = (awayFullScored + homeFullAllowed) / 2;
    let projectedTotal = homeExpected + awayExpected;

    const combinedPace = (homeData.pace + awayData.pace) / 2;
    const leaguePace   = this.leagueAverages?.pace || 103.7;
    const paceMultiplier = 1 + (combinedPace - leaguePace) / leaguePace * 0.35;
    projectedTotal *= paceMultiplier;
    projectedTotal *= (1 + formAdj * 0.04 + restAdj * 0.03);

    const line = Math.round(projectedTotal * 2) / 2;
    const leagueAvgTotal = this.leagueAverages?.ppg * 2 || 231.4;
    const direction = projectedTotal > leagueAvgTotal ? 'OVER' : 'UNDER';
    const confidence = this.calcFullConfidence(homeData, awayData, projectedTotal);

    return {
      market: 'Full',
      marketLabel: 'Tiempo Completo',
      projectedTotal: parseFloat(projectedTotal.toFixed(1)),
      line,
      direction,
      confidence: Math.min(85, Math.max(50, Math.round(confidence))),
      homeExpected: parseFloat(homeExpected.toFixed(1)),
      awayExpected: parseFloat(awayExpected.toFixed(1)),
      factors: {
        homeFullScored, homeFullAllowed,
        awayFullScored, awayFullAllowed,
        combinedPace: parseFloat(combinedPace.toFixed(1))
      },
      reasoning: this.buildFullReasoning(homeData, awayData, direction, projectedTotal)
    };
  }

  // ════════════════════════════════════════════════════════════════
  // CÁLCULO DE CONFIANZA
  // ════════════════════════════════════════════════════════════════

  calcQ1Confidence(homeData, awayData, projected) {
    let confidence = 60; // Base

    // Señal ofensiva vs defensiva clara → más confianza
    const offSignal = Math.abs(homeData.q1Home - awayData.q1Away);
    const defSignal = Math.abs(homeData.oppQ1 - awayData.oppQ1);

    confidence += Math.min(10, offSignal * 1.5);  // hasta +10
    confidence += Math.min(8,  defSignal * 1.2);  // hasta +8

    // Pace extremo (ambos rápidos o ambos lentos) → señal más clara
    const combinedPace = (homeData.pace + awayData.pace) / 2;
    if (combinedPace > 106 || combinedPace < 101) confidence += 5;

    // Rankings consistentes entre sí → más confianza
    const rankQ1Diff = Math.abs(homeData.q1HomeRank - awayData.q1AwayRank);
    if (rankQ1Diff > 15) confidence += 5;  // Equipos muy distintos
    if (rankQ1Diff < 5) confidence -= 3;   // Equipos muy parecidos

    return confidence;
  }

  calcHalfConfidence(homeData, awayData, projected) {
    let confidence = 60;

    const offSignal = Math.abs(homeData.halfHome - awayData.halfAway);
    const defSignal = Math.abs(homeData.oppHalf - awayData.oppHalf);

    confidence += Math.min(10, offSignal * 0.8);
    confidence += Math.min(8,  defSignal * 1.0);

    const combinedPace = (homeData.pace + awayData.pace) / 2;
    if (combinedPace > 106 || combinedPace < 101) confidence += 4;

    return confidence;
  }

  calcFullConfidence(homeData, awayData, projected) {
    let confidence = 60;

    const offSignal = Math.abs(homeData.fullHome - awayData.fullAway);
    const defSignal = Math.abs(homeData.oppPpgHome - awayData.oppPpgAway);

    confidence += Math.min(10, offSignal * 0.5);
    confidence += Math.min(8,  defSignal * 0.7);

    const combinedPace = (homeData.pace + awayData.pace) / 2;
    if (combinedPace > 106 || combinedPace < 101) confidence += 4;

    const rankDiff = Math.abs(homeData.fullRank - awayData.fullRank);
    if (rankDiff > 15) confidence += 4;

    return confidence;
  }

  // ════════════════════════════════════════════════════════════════
  // AJUSTES DINÁMICOS (desde API BallDontLie)
  // ════════════════════════════════════════════════════════════════

  calcFormAdjustment(homeGames, awayGames) {
    // Racha reciente (últimos 5 juegos): si el local está en mejor forma → +
    // Retorna un valor entre -1 y 1
    if (!homeGames.length && !awayGames.length) return 0;

    const homeRecent = homeGames.slice(-5);
    const awayRecent = awayGames.slice(-5);

    const homeWins = homeRecent.filter(g => this.isWin(g, true)).length;
    const awayWins = awayRecent.filter(g => this.isWin(g, false)).length;

    const homeRate = homeRecent.length > 0 ? homeWins / homeRecent.length : 0.5;
    const awayRate = awayRecent.length > 0 ? awayWins / awayRecent.length : 0.5;

    return homeRate - awayRate; // -1 a +1
  }

  calcRestAdjustment(game, homeGames, awayGames) {
    const homeLastGame = homeGames.slice(-1)[0];
    const awayLastGame = awayGames.slice(-1)[0];

    if (!homeLastGame || !awayLastGame) return 0;

    const gameDate     = new Date(game.date);
    const homeRest     = Math.floor((gameDate - new Date(homeLastGame.date)) / 86400000);
    const awayRest     = Math.floor((gameDate - new Date(awayLastGame.date)) / 86400000);

    // Más descanso = ligera ventaja (back-to-back penaliza)
    const homeScore = homeRest >= 2 ? 1 : homeRest === 1 ? 0 : -1;
    const awayScore = awayRest >= 2 ? 1 : awayRest === 1 ? 0 : -1;

    return (homeScore - awayScore) / 2; // -1 a +1
  }

  isWin(game, isHome) {
    if (!game.home_team_score || !game.visitor_team_score) return false;
    return isHome
      ? game.home_team_score > game.visitor_team_score
      : game.visitor_team_score > game.home_team_score;
  }

  // ════════════════════════════════════════════════════════════════
  // GENERACIÓN DE RAZONAMIENTOS
  // ════════════════════════════════════════════════════════════════

  buildQ1Reasoning(homeData, awayData, direction, projected) {
    const reasons = [];

    if (direction === 'OVER') {
      if (homeData.q1Home > 30) reasons.push(`${this.getShortName(homeData)} anota ${homeData.q1Home} pts en Q1 de local (top ofensivo)`);
      if (awayData.q1Away > 30) reasons.push(`${this.getShortName(awayData)} anota ${awayData.q1Away} pts en Q1 de visitante`);
      if (homeData.oppQ1 > 29) reasons.push(`${this.getShortName(homeData)} permite ${homeData.oppQ1} pts en Q1 (defensa débil)`);
      if (awayData.oppQ1 > 29) reasons.push(`${this.getShortName(awayData)} permite ${awayData.oppQ1} pts en Q1`);
    } else {
      if (homeData.q1Home < 29) reasons.push(`${this.getShortName(homeData)} anota solo ${homeData.q1Home} pts en Q1 de local`);
      if (awayData.q1Away < 28) reasons.push(`${this.getShortName(awayData)} anota solo ${awayData.q1Away} pts en Q1 de visitante`);
      if (homeData.oppQ1 < 27.5) reasons.push(`${this.getShortName(homeData)} tiene élite defensiva en Q1 (permite ${homeData.oppQ1})`);
      if (awayData.oppQ1 < 27.5) reasons.push(`${this.getShortName(awayData)} defiende bien el Q1 (permite ${awayData.oppQ1})`);
    }

    const combinedPace = (homeData.pace + awayData.pace) / 2;
    if (combinedPace > 106) reasons.push(`Ritmo elevado de juego (${combinedPace.toFixed(1)} poss/game)`);
    if (combinedPace < 101) reasons.push(`Juego lento (${combinedPace.toFixed(1)} poss/game) presiona el Under`);

    return reasons.slice(0, 3);
  }

  buildHalfReasoning(homeData, awayData, direction, projected) {
    const reasons = [];

    if (direction === 'OVER') {
      if (homeData.halfHome > 61) reasons.push(`${this.getShortName(homeData)} promedia ${homeData.halfHome} en 1H de local`);
      if (awayData.halfAway > 59) reasons.push(`${this.getShortName(awayData)} promedia ${awayData.halfAway} en 1H de visitante`);
      if (homeData.oppHalf > 59) reasons.push(`${this.getShortName(homeData)} permite ${homeData.oppHalf} pts en 1H`);
    } else {
      if (homeData.halfHome < 58) reasons.push(`${this.getShortName(homeData)} anota poco en 1H de local (${homeData.halfHome})`);
      if (homeData.oppHalf < 55) reasons.push(`${this.getShortName(homeData)} élite defensivo en 1H (permite ${homeData.oppHalf})`);
      if (awayData.halfAway < 56) reasons.push(`${this.getShortName(awayData)} bajo rendimiento ofensivo de visitante`);
    }

    return reasons.slice(0, 3);
  }

  buildFullReasoning(homeData, awayData, direction, projected) {
    const reasons = [];

    if (direction === 'OVER') {
      if (homeData.fullHome > 119) reasons.push(`${this.getShortName(homeData)} ofensiva explosiva de local (${homeData.fullHome} PPG)`);
      if (awayData.fullAway > 116) reasons.push(`${this.getShortName(awayData)} se mantiene ofensivo de visitante`);
      if (homeData.oppPpgHome > 118) reasons.push(`${this.getShortName(homeData)} permite muchos puntos (${homeData.oppPpgHome})`);
    } else {
      if (homeData.oppPpgHome < 110) reasons.push(`${this.getShortName(homeData)} defensa élite (permite ${homeData.oppPpgHome} PPG)`);
      if (awayData.fullAway < 112) reasons.push(`${this.getShortName(awayData)} ofensa limitada fuera de casa`);
      if ((homeData.pace + awayData.pace) / 2 < 101) reasons.push('Ambos equipos juegan a ritmo lento');
    }

    return reasons.slice(0, 3);
  }

  getShortName(teamData) {
    // Buscar el nombre corto en el mapa inverso
    if (!teamData) return 'Equipo';
    const entry = Object.entries(this.teamStats || {}).find(([k, v]) => v === teamData);
    return entry ? entry[0] : 'Equipo';
  }

  // ════════════════════════════════════════════════════════════════
  // ANÁLISIS MANUAL — Para el formulario de predicción manual
  // ════════════════════════════════════════════════════════════════

  async analyzeMatchup(homeTeamName, awayTeamName) {
    await this.loadTeamStats();

    // Acepta tanto nombre completo como nombre corto
    const homeKey = this.teamNameMap[homeTeamName] || homeTeamName;
    const awayKey = this.teamNameMap[awayTeamName] || awayTeamName;

    const homeData = this.teamStats?.[homeKey];
    const awayData = this.teamStats?.[awayKey];

    if (!homeData || !awayData) {
      console.warn(`[Picks] ⚠️ No stats para: ${homeKey} vs ${awayKey}`);
      return null;
    }

    const q1Pick   = this.predictQ1Total(homeData, awayData, 0, 0);
    const halfPick = this.predictHalfTotal(homeData, awayData, 0, 0);
    const fullPick = this.predictFullTotal(homeData, awayData, 0, 0);

    return {
      homeTeam: homeKey,
      awayTeam: awayKey,
      homeStats: homeData,
      awayStats: awayData,
      markets: { q1: q1Pick, half: halfPick, full: fullPick },
      hasRealData: true,
      timestamp: Date.now()
    };
  }

  // ════════════════════════════════════════════════════════════════
  // FALLBACK
  // ════════════════════════════════════════════════════════════════

  fallbackPick(market, reason) {
    return {
      market,
      marketLabel: market === 'Q1' ? '1er Cuarto' : market === '1H' ? 'Primera Mitad' : 'Tiempo Completo',
      projectedTotal: null,
      line: null,
      direction: null,
      confidence: 0,
      homeExpected: null,
      awayExpected: null,
      factors: {},
      reasoning: [reason]
    };
  }

  // ════════════════════════════════════════════════════════════════
  // UTILIDADES PÚBLICAS
  // ════════════════════════════════════════════════════════════════

  getAvailableTeams() {
    return Object.keys(this.teamStats || {}).sort();
  }

  getTeamProfile(teamName) {
    const data = this.teamStats?.[teamName];
    if (!data) return null;

    return {
      name: teamName,
      offense: { full: data.full, q1: data.q1, half: data.half },
      defense: { full: data.oppPpg, q1: data.oppQ1, half: data.oppHalf },
      pace: data.pace,
      homeAdvantage: data.q1Home - data.q1Away,   // Diferencia local vs visitante en Q1
      ranks: {
        fullRank: data.fullRank,
        q1Rank: data.q1Rank,
        defRank: data.oppPpgRank,
        paceRank: data.paceRank
      }
    };
  }

  getRecommendation(confidence) {
    if (confidence >= 75) return { type: 'strong', text: 'PICK FUERTE', color: 'green', units: 3 };
    if (confidence >= 65) return { type: 'medium', text: 'PICK MEDIO',  color: 'yellow', units: 2 };
    return                       { type: 'value',  text: 'PICK VALUE',  color: 'orange', units: 1 };
  }
}

// ════════════════════════════════════════════════════════════════
// INSTANCIA GLOBAL
// ════════════════════════════════════════════════════════════════

window.picksEngine = new PicksEngine();

// Pre-cargar stats al iniciar
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await window.picksEngine.loadTeamStats();
    console.log('[Picks] ✅ Motor listo — nba-stats.json precargado');
  } catch (e) {
    console.warn('[Picks] ⚠️ Stats no disponibles al inicio, se cargarán bajo demanda');
  }
});

console.log('✅ Picks Engine v2.0 cargado — Motor conectado con datos reales');
