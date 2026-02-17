// scripts/database-updater.js
// Sistema de actualización automática de base de datos NBA
// ════════════════════════════════════════════════════════════════

console.log('📊 Database Updater v1.0 cargando...');

class DatabaseUpdater {
  constructor() {
    this.apiClient = window.apiClient;
    this.localDB = null;
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
      console.log('[DB] 📂 Cargando base de datos local...');
      
      // Intentar cargar de localStorage primero (más reciente)
      const storedDB = localStorage.getItem('nba_players_db');
      
      if (storedDB) {
        try {
          this.localDB = JSON.parse(storedDB);
          console.log('[DB] ✅ Base de datos cargada desde localStorage:', this.localDB.players?.length, 'jugadores');
          return this.localDB;
        } catch (parseError) {
          console.warn('[DB] ⚠️ Error parseando localStorage, cargando desde archivo...');
        }
      }
      
      // Cargar desde archivo JSON
      const res = await fetch('/nba_players_database.json');
      this.localDB = await res.json();
      
      console.log('[DB] ✅ Base de datos cargada desde archivo:', this.localDB.players?.length, 'jugadores');
      
      // Guardar en localStorage para próximas veces
      try {
        localStorage.setItem('nba_players_db', JSON.stringify(this.localDB));
      } catch (storageError) {
        console.warn('[DB] ⚠️ No se pudo guardar en localStorage (probablemente lleno)');
      }
      
      return this.localDB;
      
    } catch (error) {
      console.error('[DB] ❌ Error cargando base de datos:', error);
      
      // Fallback: base de datos vacía
      this.localDB = {
        players: [],
        last_updated: null,
        version: '1.0'
      };
      
      return this.localDB;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ACTUALIZACIÓN DE BASE DE DATOS
  // ════════════════════════════════════════════════════════════════

  async updateDatabase() {
    if (this.updating) {
      console.log('[DB] ⏳ Actualización ya en progreso...');
      return this.localDB;
    }
    
    this.updating = true;
    
    try {
      console.log('[DB] 🔄 Iniciando actualización de base de datos...');
      
      if (typeof window.toastInfo === 'function') {
        window.toastInfo('Actualizando base de datos NBA...');
      }
      
      const allPlayers = [];
      let page = 1;
      let hasMore = true;
      const maxPages = 15; // ~1500 jugadores
      
      // Obtener todos los jugadores paginado
      while (hasMore && page <= maxPages) {
        try {
          console.log(`[DB] 📄 Obteniendo página ${page}/${maxPages}...`);
          
          const res = await this.apiClient.getAllPlayers(page, 100);
          
          if (res.data && res.data.length > 0) {
            allPlayers.push(...res.data);
            
            // Verificar si hay más páginas
            hasMore = res.meta?.next_page != null;
            page++;
            
            // Rate limiting: esperar entre requests
            if (hasMore) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } else {
            hasMore = false;
          }
          
        } catch (pageError) {
          console.error(`[DB] ❌ Error obteniendo página ${page}:`, pageError);
          hasMore = false; // Detener en caso de error
        }
      }
      
      console.log(`[DB] ✅ Obtenidos ${allPlayers.length} jugadores`);
      
      // Crear nueva base de datos
      const newDB = {
        players: allPlayers,
        last_updated: new Date().toISOString(),
        version: '2.0',
        total_players: allPlayers.length
      };
      
      // Guardar en localStorage
      try {
        localStorage.setItem('nba_players_db', JSON.stringify(newDB));
        console.log('[DB] 💾 Base de datos guardada en localStorage');
      } catch (storageError) {
        console.warn('[DB] ⚠️ No se pudo guardar en localStorage:', storageError.message);
        
        // Intentar comprimir (guardar solo campos esenciales)
        try {
          const compressedDB = {
            ...newDB,
            players: newDB.players.map(p => ({
              id: p.id,
              first_name: p.first_name,
              last_name: p.last_name,
              position: p.position,
              team: p.team
            }))
          };
          localStorage.setItem('nba_players_db', JSON.stringify(compressedDB));
          console.log('[DB] 💾 Base de datos comprimida guardada');
        } catch (compressError) {
          console.error('[DB] ❌ No se pudo guardar ni comprimida:', compressError);
        }
      }
      
      this.localDB = newDB;
      this.lastUpdateCheck = Date.now();
      
      if (typeof window.toastSuccess === 'function') {
        window.toastSuccess(`Base de datos actualizada: ${allPlayers.length} jugadores`);
      }
      
      return newDB;
      
    } catch (error) {
      console.error('[DB] ❌ Error actualizando base de datos:', error);
      
      if (typeof window.toastError === 'function') {
        window.toastError('Error actualizando base de datos');
      }
      
      throw error;
      
    } finally {
      this.updating = false;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // BÚSQUEDA EN BASE DE DATOS LOCAL
  // ════════════════════════════════════════════════════════════════

  async searchPlayers(query, limit = 20) {
    if (!this.localDB) {
      await this.loadLocalDB();
    }
    
    if (!this.localDB || !this.localDB.players) {
      return [];
    }
    
    const q = query.toLowerCase().trim();
    
    if (q.length < 2) {
      return [];
    }
    
    const results = this.localDB.players.filter(player => {
      const fullName = `${player.first_name} ${player.last_name}`.toLowerCase();
      const firstName = player.first_name.toLowerCase();
      const lastName = player.last_name.toLowerCase();
      const team = player.team?.full_name?.toLowerCase() || '';
      
      return fullName.includes(q) || 
             firstName.includes(q) ||
             lastName.includes(q) ||
             team.includes(q);
    });
    
    return results.slice(0, limit);
  }

  // Buscar por ID
  getPlayerById(playerId) {
    if (!this.localDB || !this.localDB.players) {
      return null;
    }
    
    return this.localDB.players.find(p => p.id === playerId);
  }

  // Buscar por equipo
  getPlayersByTeam(teamName) {
    if (!this.localDB || !this.localDB.players) {
      return [];
    }
    
    const team = teamName.toLowerCase();
    
    return this.localDB.players.filter(p => 
      p.team?.full_name?.toLowerCase().includes(team) ||
      p.team?.name?.toLowerCase().includes(team)
    );
  }

  // Buscar por posición
  getPlayersByPosition(position) {
    if (!this.localDB || !this.localDB.players) {
      return [];
    }
    
    return this.localDB.players.filter(p => 
      p.position?.toLowerCase() === position.toLowerCase()
    );
  }

  // ════════════════════════════════════════════════════════════════
  // VERIFICACIÓN DE ACTUALIZACIÓN
  // ════════════════════════════════════════════════════════════════

  needsUpdate() {
    if (!this.localDB || !this.localDB.last_updated) {
      return true;
    }
    
    const lastUpdate = new Date(this.localDB.last_updated);
    const now = new Date();
    const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
    
    return hoursSinceUpdate >= 24; // Actualizar cada 24 horas
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
  // ESTADÍSTICAS
  // ════════════════════════════════════════════════════════════════

  getStats() {
    if (!this.localDB) {
      return {
        totalPlayers: 0,
        lastUpdated: 'Nunca',
        version: 'N/A',
        teamsCount: 0
      };
    }
    
    const teams = new Set(
      this.localDB.players
        .map(p => p.team?.full_name)
        .filter(Boolean)
    );
    
    return {
      totalPlayers: this.localDB.players?.length || 0,
      lastUpdated: this.getTimeSinceLastUpdate(),
      version: this.localDB.version || 'N/A',
      teamsCount: teams.size
    };
  }

  // ════════════════════════════════════════════════════════════════
  // AUTO-UPDATE EN BACKGROUND
  // ════════════════════════════════════════════════════════════════

  async autoUpdate() {
    // Verificar si necesita actualización
    if (!this.needsUpdate()) {
      console.log('[DB] ✅ Base de datos está actualizada');
      return;
    }
    
    console.log('[DB] ⏰ Base de datos desactualizada, programando actualización...');
    
    // Actualizar en background después de 5 segundos (no bloquear carga)
    setTimeout(() => {
      this.updateDatabase().catch(error => {
        console.error('[DB] ❌ Error en auto-update:', error);
      });
    }, 5000);
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
    window.databaseUpdater.autoUpdate();
    console.log('[DB] ✅ Database Updater inicializado');
  });
} else {
  window.databaseUpdater.loadLocalDB()
    .then(() => {
      window.databaseUpdater.autoUpdate();
      console.log('[DB] ✅ Database Updater inicializado');
    })
    .catch(error => {
      console.error('[DB] ❌ Error inicializando:', error);
    });
}

console.log('✅ Database Updater v1.0 cargado');
