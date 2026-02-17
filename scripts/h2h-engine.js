// scripts/h2h-engine.js
// Motor de comparación Head-to-Head de jugadores/equipos
// ════════════════════════════════════════════════════════════════

console.log('⚔️ H2H Engine v1.0 cargando...');

class H2HEngine {
  constructor() {
    this.apiClient = window.apiClient;
    this.currentSeason = 2024;
  }

  // ════════════════════════════════════════════════════════════════
  // COMPARACIÓN DE JUGADORES
  // ════════════════════════════════════════════════════════════════

  async comparePlayers(playerId1, playerId2) {
    try {
      console.log(`[H2H] ⚔️ Comparando jugadores ${playerId1} vs ${playerId2}`);
      
      // 1. Obtener datos de ambos jugadores en paralelo
      const [player1Data, player2Data, player1Stats, player2Stats] = await Promise.all([
        this.apiClient.getPlayer(playerId1),
        this.apiClient.getPlayer(playerId2),
        this.apiClient.getSeasonAverages(playerId1, this.currentSeason),
        this.apiClient.getSeasonAverages(playerId2, this.currentSeason)
      ]);
      
      // Extraer datos
      const player1 = player1Data.data || player1Data;
      const player2 = player2Data.data || player2Data;
      const stats1 = (player1Stats.data && player1Stats.data[0]) || {};
      const stats2 = (player2Stats.data && player2Stats.data[0]) || {};
      
      // 2. Comparar todas las métricas relevantes
      const comparison = {
        // Información de jugadores
        players: [
          {
            id: player1.id,
            name: `${player1.first_name} ${player1.last_name}`,
            team: player1.team?.full_name || 'Free Agent',
            position: player1.position || 'N/A',
            height: player1.height_feet && player1.height_inches 
              ? `${player1.height_feet}'${player1.height_inches}"`
              : 'N/A',
            weight: player1.weight_pounds ? `${player1.weight_pounds} lbs` : 'N/A'
          },
          {
            id: player2.id,
            name: `${player2.first_name} ${player2.last_name}`,
            team: player2.team?.full_name || 'Free Agent',
            position: player2.position || 'N/A',
            height: player2.height_feet && player2.height_inches 
              ? `${player2.height_feet}'${player2.height_inches}"`
              : 'N/A',
            weight: player2.weight_pounds ? `${player2.weight_pounds} lbs` : 'N/A'
          }
        ],
        
        // Stats brutos
        stats: [stats1, stats2],
        
        // Comparación métrica por métrica
        metrics: {
          gamesPlayed: this.compareMetric(stats1.games_played, stats2.games_played, 'Juegos Jugados', 0),
          points: this.compareMetric(stats1.pts, stats2.pts, 'Puntos', 1),
          rebounds: this.compareMetric(stats1.reb, stats2.reb, 'Rebotes', 1),
          assists: this.compareMetric(stats1.ast, stats2.ast, 'Asistencias', 1),
          steals: this.compareMetric(stats1.stl, stats2.stl, 'Robos', 2),
          blocks: this.compareMetric(stats1.blk, stats2.blk, 'Bloqueos', 2),
          turnovers: this.compareMetric(stats2.turnover, stats1.turnover, 'Pérdidas', 1, true), // Invertido
          fg_pct: this.compareMetric(stats1.fg_pct * 100, stats2.fg_pct * 100, 'FG%', 1),
          fg3_pct: this.compareMetric(stats1.fg3_pct * 100, stats2.fg3_pct * 100, '3P%', 1),
          ft_pct: this.compareMetric(stats1.ft_pct * 100, stats2.ft_pct * 100, 'FT%', 1),
          minutesPerGame: this.compareMetric(stats1.min, stats2.min, 'Minutos/Juego', 0)
        },
        
        // Análisis global
        winner: null,
        summary: '',
        advantages: [[], []], // Ventajas de cada jugador
        
        // Ratings
        ratings: {
          offense: [0, 0],
          defense: [0, 0],
          efficiency: [0, 0],
          overall: [0, 0]
        }
      };
      
      // 3. Calcular ratings
      comparison.ratings.offense = [
        this.calculateOffensiveRating(stats1),
        this.calculateOffensiveRating(stats2)
      ];
      
      comparison.ratings.defense = [
        this.calculateDefensiveRating(stats1),
        this.calculateDefensiveRating(stats2)
      ];
      
      comparison.ratings.efficiency = [
        this.calculateEfficiency(stats1),
        this.calculateEfficiency(stats2)
      ];
      
      comparison.ratings.overall = [
        (comparison.ratings.offense[0] + comparison.ratings.defense[0] + comparison.ratings.efficiency[0]) / 3,
        (comparison.ratings.offense[1] + comparison.ratings.defense[1] + comparison.ratings.efficiency[1]) / 3
      ];
      
      // 4. Determinar ganador general
      const scores = Object.values(comparison.metrics).map(m => m.winner);
      const player1Wins = scores.filter(w => w === 0).length;
      const player2Wins = scores.filter(w => w === 1).length;
      
      if (player1Wins > player2Wins) {
        comparison.winner = 0;
        comparison.summary = `${comparison.players[0].name} domina en ${player1Wins} de ${scores.length} categorías`;
      } else if (player2Wins > player1Wins) {
        comparison.winner = 1;
        comparison.summary = `${comparison.players[1].name} domina en ${player2Wins} de ${scores.length} categorías`;
      } else {
        comparison.winner = -1;
        comparison.summary = 'Ambos jugadores están muy equilibrados';
      }
      
      // 5. Identificar ventajas específicas
      comparison.advantages[0] = this.identifyAdvantages(comparison.metrics, 0);
      comparison.advantages[1] = this.identifyAdvantages(comparison.metrics, 1);
      
      console.log(`[H2H] ✅ Comparación completada: ${comparison.summary}`);
      
      return comparison;
      
    } catch (error) {
      console.error('[H2H] ❌ Error comparando jugadores:', error);
      
      if (typeof window.toastError === 'function') {
        window.toastError('Error cargando comparación H2H');
      }
      
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // COMPARACIÓN DE MÉTRICAS
  // ════════════════════════════════════════════════════════════════

  compareMetric(value1, value2, label, decimals = 1, inverted = false) {
    const v1 = parseFloat(value1) || 0;
    const v2 = parseFloat(value2) || 0;
    
    // Para métricas invertidas (ej: turnovers), menor es mejor
    const effectiveV1 = inverted ? -v1 : v1;
    const effectiveV2 = inverted ? -v2 : v2;
    
    const diff = Math.abs(v1 - v2);
    const diffPercent = v1 > 0 ? (diff / v1) * 100 : 0;
    
    return {
      label: label,
      values: [v1.toFixed(decimals), v2.toFixed(decimals)],
      winner: effectiveV1 > effectiveV2 ? 0 : (effectiveV2 > effectiveV1 ? 1 : -1),
      difference: diff.toFixed(decimals),
      differencePercent: diffPercent.toFixed(0),
      barWidth: [
        v1 > v2 ? 100 : (v1 / v2) * 100,
        v2 > v1 ? 100 : (v2 / v1) * 100
      ]
    };
  }

  // ════════════════════════════════════════════════════════════════
  // CÁLCULO DE RATINGS
  // ════════════════════════════════════════════════════════════════

  calculateOffensiveRating(stats) {
    if (!stats.pts) return 0;
    
    // Fórmula simplificada de rating ofensivo
    const pointsScore = Math.min(stats.pts / 30, 1) * 40; // Max 40 pts
    const assistsScore = Math.min(stats.ast / 10, 1) * 20; // Max 20 pts
    const fgPctScore = (stats.fg_pct || 0) * 25; // Max 25 pts
    const fg3PctScore = (stats.fg3_pct || 0) * 15; // Max 15 pts
    
    return Math.round(pointsScore + assistsScore + fgPctScore + fg3PctScore);
  }

  calculateDefensiveRating(stats) {
    if (!stats.reb) return 0;
    
    // Fórmula simplificada de rating defensivo
    const reboundsScore = Math.min(stats.reb / 12, 1) * 40; // Max 40 pts
    const stealsScore = Math.min(stats.stl / 2, 1) * 30; // Max 30 pts
    const blocksScore = Math.min(stats.blk / 2, 1) * 30; // Max 30 pts
    
    return Math.round(reboundsScore + stealsScore + blocksScore);
  }

  calculateEfficiency(stats) {
    if (!stats.pts) return 0;
    
    // PER simplificado (Player Efficiency Rating)
    const pts = stats.pts || 0;
    const reb = stats.reb || 0;
    const ast = stats.ast || 0;
    const stl = stats.stl || 0;
    const blk = stats.blk || 0;
    const to = stats.turnover || 0;
    const fga = stats.fga || 1;
    const fta = stats.fta || 1;
    
    const per = (pts + reb + ast + stl + blk - to - (fga - (stats.fgm || 0)) - (fta - (stats.ftm || 0))) / (stats.games_played || 1);
    
    // Normalizar a 0-100
    return Math.min(Math.round(per * 5), 100);
  }

  // ════════════════════════════════════════════════════════════════
  // ANÁLISIS DE VENTAJAS
  // ════════════════════════════════════════════════════════════════

  identifyAdvantages(metrics, playerIndex) {
    const advantages = [];
    
    Object.entries(metrics).forEach(([key, metric]) => {
      if (metric.winner === playerIndex) {
        const advantage = {
          category: metric.label,
          value: metric.values[playerIndex],
          difference: metric.difference,
          percent: metric.differencePercent
        };
        advantages.push(advantage);
      }
    });
    
    // Ordenar por diferencia porcentual
    advantages.sort((a, b) => parseFloat(b.percent) - parseFloat(a.percent));
    
    return advantages.slice(0, 5); // Top 5 ventajas
  }

  // ════════════════════════════════════════════════════════════════
  // BÚSQUEDA DE JUGADORES
  // ════════════════════════════════════════════════════════════════

  async searchPlayers(query) {
    try {
      if (!query || query.length < 2) {
        return [];
      }
      
      console.log(`[H2H] 🔍 Buscando jugadores: "${query}"`);
      
      const result = await this.apiClient.searchPlayers(query);
      
      if (!result || !result.data) {
        return [];
      }
      
      console.log(`[H2H] ✅ Encontrados ${result.data.length} jugadores`);
      
      return result.data;
      
    } catch (error) {
      console.error('[H2H] ❌ Error buscando jugadores:', error);
      return [];
    }
  }

  // ════════════════════════════════════════════════════════════════
  // COMPARACIÓN RÁPIDA (para preview)
  // ════════════════════════════════════════════════════════════════

  async quickCompare(playerId1, playerId2) {
    try {
      const [stats1, stats2] = await Promise.all([
        this.apiClient.getSeasonAverages(playerId1, this.currentSeason),
        this.apiClient.getSeasonAverages(playerId2, this.currentSeason)
      ]);
      
      const s1 = (stats1.data && stats1.data[0]) || {};
      const s2 = (stats2.data && stats2.data[0]) || {};
      
      return {
        ppg: [s1.pts || 0, s2.pts || 0],
        rpg: [s1.reb || 0, s2.reb || 0],
        apg: [s1.ast || 0, s2.ast || 0],
        fgPct: [(s1.fg_pct || 0) * 100, (s2.fg_pct || 0) * 100]
      };
      
    } catch (error) {
      console.error('[H2H] ❌ Error en quick compare:', error);
      return null;
    }
  }
}

// ════════════════════════════════════════════════════════════════
// INSTANCIA GLOBAL
// ════════════════════════════════════════════════════════════════

window.h2hEngine = new H2HEngine();

console.log('✅ H2H Engine v1.0 cargado');
