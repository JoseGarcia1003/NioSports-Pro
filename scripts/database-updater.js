// scripts/database-updater.js
// Sistema de base de datos local NBA — NioSports Pro v3.0
// ════════════════════════════════════════════════════════════════
// CAMBIOS v3.0:
//   - Eliminado módulo de jugadores/props (ya no se usa)
//   - Eliminado getAllPlayers() — causaba TypeError al arrancar
//   - autoUpdate() y updateDatabase() desactivados con gracia
//   - loadLocalDB() simplificado: solo carga nba-stats.json
//   - searchPlayers() conservado por compatibilidad (retorna [])
//   - Sin cambios en la API pública — no rompe código existente
// ════════════════════════════════════════════════════════════════

console.log('📊 Database Updater v3.0 cargando...');

class DatabaseUpdater {
  constructor() {
    this.apiClient = window.apiClient;
    this.localDB = null;
    this.teamStats = null;
    this.updating = false;
    this.lastUpdateCheck = 0;
    this.updateInterval = 24 * 60 * 60 * 1000; // 24 horas
  }

  // ════════════════════════════════════════════════════════════════
  // CARGA DE BASE DE DATOS LOCAL
  // ════════════════════════════════════════════════════════════════

  async loadLocalDB() {
    if (this.localDB) {
      return this.localDB;
    }

    try {
      console.log('[DB] 📂 Cargando nba-stats.json...');

      const res = await fetch('/data/nba-stats.json');

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} al cargar nba-stats.json`);
      }

      const data = await res.json();

      this.teamStats = data.teams || {};
      this.localDB = {
        players: [],           // vacío — módulo de jugadores eliminado
        teams: data.teams,
        leagueAverages: data.leagueAverages,
        source: data.source,
        season: data.season,
        last_updated: data.lastUpdated || new Date().toISOString(),
        version: '3.0'
      };

      const teamCount = Object.keys(this.teamStats).length;
      console.log(`[DB] ✅ nba-stats.json cargado: ${teamCount} equipos`);

      return this.localDB;

    } catch (error) {
      console.error('[DB] ❌ Error cargando nba-stats.json:', error);

      // Fallback seguro — no bloquea la app
      this.localDB = {
        players: [],
        teams: {},
        leagueAverages: { pace: 103.7, ppg: 115.7 },
        last_updated: null,
        version: '3.0'
      };

      return this.localDB;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ACTUALIZACIÓN — DESACTIVADA (módulo de jugadores eliminado)
  // ════════════════════════════════════════════════════════════════

  async updateDatabase() {
    console.log('[DB] ⚠️ updateDatabase() desactivado en v3.0 — usa nba-stats.json estático');
    return this.localDB;
  }

  async autoUpdate() {
    console.log('[DB] ✅ Auto-update desactivado — datos estáticos de nba-stats.json');
    return;
  }

  // ════════════════════════════════════════════════════════════════
  // BÚSQUEDA — conservado por compatibilidad con código existente
  // ════════════════════════════════════════════════════════════════

  async searchPlayers(query, limit = 20) {
    // Módulo de jugadores eliminado — retorna vacío sin romper nada
    console.warn('[DB] ⚠️ searchPlayers() desactivado en v3.0');
    return [];
  }

  getPlayerById(playerId) {
    return null;
  }

  getPlayersByTeam(teamName) {
    return [];
  }

  getPlayersByPosition(position) {
    return [];
  }

  // ════════════════════════════════════════════════════════════════
  // ESTADÍSTICAS DE EQUIPOS — nuevo en v3.0
  // ════════════════════════════════════════════════════════════════

  getTeamStats(teamName) {
    if (!this.teamStats) return null;
    return this.teamStats[teamName] || null;
  }

  getAllTeams() {
    if (!this.teamStats) return [];
    return Object.keys(this.teamStats).sort();
  }

  getLeagueAverages() {
    return this.localDB?.leagueAverages || { pace: 103.7, ppg: 115.7 };
  }

  // ════════════════════════════════════════════════════════════════
  // VERIFICACIÓN DE ACTUALIZACIÓN
  // ════════════════════════════════════════════════════════════════

  needsUpdate() {
    // Siempre false — datos estáticos, no requieren actualización automática
    return false;
  }

  getTimeSinceLastUpdate() {
    if (!this.localDB || !this.localDB.last_updated) {
      return 'Nunca';
    }

    const lastUpdate = new Date(this.localDB.last_updated);
    const now = new Date();
    const hoursSince = Math.floor((now - lastUpdate) / (1000 * 60 * 60));

    if (hoursSince < 1) return 'Hace menos de 1 hora';
    if (hoursSince === 1) return 'Hace 1 hora';
    if (hoursSince < 24) return `Hace ${hoursSince} horas`;

    const daysSince = Math.floor(hoursSince / 24);
    if (daysSince === 1) return 'Hace 1 día';
    return `Hace ${daysSince} días`;
  }

  // ════════════════════════════════════════════════════════════════
  // ESTADÍSTICAS GENERALES
  // ════════════════════════════════════════════════════════════════

  getStats() {
    const teamCount = this.teamStats ? Object.keys(this.teamStats).length : 0;

    return {
      totalPlayers: 0,                              // módulo eliminado
      totalTeams: teamCount,
      lastUpdated: this.getTimeSinceLastUpdate(),
      version: this.localDB?.version || '3.0',
      season: this.localDB?.season || 'N/A',
      source: this.localDB?.source || 'nba-stats.json'
    };
  }
}

// ════════════════════════════════════════════════════════════════
// INSTANCIA GLOBAL
// ════════════════════════════════════════════════════════════════

window.databaseUpdater = new DatabaseUpdater();

// Auto-inicializar al cargar página
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    await window.databaseUpdater.loadLocalDB();
    console.log('[DB] ✅ Database Updater v3.0 inicializado');
  });
} else {
  window.databaseUpdater.loadLocalDB()
    .then(() => {
      console.log('[DB] ✅ Database Updater v3.0 inicializado');
    })
    .catch(error => {
      console.error('[DB] ❌ Error inicializando:', error);
    });
}

console.log('✅ Database Updater v3.0 cargado');
