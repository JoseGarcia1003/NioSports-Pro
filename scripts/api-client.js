// scripts/api-client.js
// Cliente profesional para consumir BallDontLie API vía proxy seguro
// ════════════════════════════════════════════════════════════════

console.log('🏀 API Client v1.0 cargando...');

class BallDontLieClient {
  constructor() {
    this.proxy = `${window.location.origin}/api/proxy`;
    this.token = null;
    this.tokenExpiry = 0;
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutos
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 segundo
  }

  // ════════════════════════════════════════════════════════════════
  // TOKEN MANAGEMENT
  // ════════════════════════════════════════════════════════════════

  async ensureToken() {
    if (this.token && Date.now() < this.tokenExpiry) {
      return; // Token válido
    }

    try {
      console.log('[API] 🔐 Obteniendo nuevo token del proxy...');
      const res = await fetch(`${this.proxy}?init=1`);
      
      if (!res.ok) {
        throw new Error(`Token fetch failed: ${res.status}`);
      }

      const data = await res.json();
      this.token = data.token;
      this.tokenExpiry = Date.now() + data.expiresInMs - 60000; // 1 min buffer
      console.log('[API] ✅ Token obtenido, expira en', Math.round(data.expiresInMs / 1000), 'segundos');
    } catch (error) {
      console.error('[API] ❌ Error obteniendo token:', error);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // REQUEST WITH RETRY & CACHE
  // ════════════════════════════════════════════════════════════════

  async request(endpoint, cacheKey = null, attempt = 1) {
    // Check cache first
    if (cacheKey && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() < cached.expiry) {
        console.log('[API] 💾 Cache hit:', cacheKey);
        return cached.data;
      }
      this.cache.delete(cacheKey);
    }

    await this.ensureToken();

    try {
      console.log(`[API] 📡 Request (attempt ${attempt}):`, endpoint);
      
      const res = await fetch(
        `${this.proxy}?endpoint=${encodeURIComponent(endpoint)}`,
        {
          headers: {
            'X-NS-Token': this.token,
            'X-UID': window.currentUser?.uid || '',
            'User-Agent': navigator.userAgent
          }
        }
      );

      if (!res.ok) {
        if (res.status === 429 && attempt < this.retryAttempts) {
          // Rate limited, retry with backoff
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          console.warn(`[API] ⏳ Rate limited, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.request(endpoint, cacheKey, attempt + 1);
        }
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();

      // Cache successful result
      if (cacheKey) {
        this.cache.set(cacheKey, {
          data,
          expiry: Date.now() + this.cacheTTL
        });
        console.log('[API] 💾 Cached:', cacheKey);
      }

      console.log('[API] ✅ Success:', endpoint);
      return data;

    } catch (error) {
      console.error('[API] ❌ Request failed:', endpoint, error);
      
      // Retry on network errors
      if (attempt < this.retryAttempts && error.message.includes('fetch')) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        console.log(`[API] 🔄 Network error, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request(endpoint, cacheKey, attempt + 1);
      }
      
      // Show user-friendly error
      if (typeof window.toastError === 'function') {
        window.toastError('Error cargando datos. Reintentando...');
      }
      
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // GAMES API
  // ════════════════════════════════════════════════════════════════

  async getGamesByDate(date) {
    // date format: YYYY-MM-DD
    const endpoint = `/games?dates[]=${date}`;
    const cacheKey = `games_${date}`;
    return await this.request(endpoint, cacheKey);
  }

  async getTodayGames() {
    const today = new Date().toISOString().split('T')[0];
    return await this.getGamesByDate(today);
  }

  async getGame(gameId) {
    const endpoint = `/games/${gameId}`;
    const cacheKey = `game_${gameId}`;
    return await this.request(endpoint, cacheKey);
  }

  async getTeamGames(teamId, startDate, endDate) {
    const endpoint = `/games?team_ids[]=${teamId}&start_date=${startDate}&end_date=${endDate}`;
    const cacheKey = `team_games_${teamId}_${startDate}_${endDate}`;
    return await this.request(endpoint, cacheKey);
  }

  // ════════════════════════════════════════════════════════════════
  // STATS API
  // ════════════════════════════════════════════════════════════════

  // ════════════════════════════════════════════════════════════════
  // CACHE MANAGEMENT
  // ════════════════════════════════════════════════════════════════

  clearCache() {
    this.cache.clear();
    console.log('[API] 🗑️ Cache limpiado');
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      totalSize: JSON.stringify(Array.from(this.cache.values())).length
    };
  }

  // ════════════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════════════

  isRateLimited() {
    return this.tokenExpiry - Date.now() < 0;
  }

  getTokenTimeRemaining() {
    return Math.max(0, this.tokenExpiry - Date.now());
  }
}

// ════════════════════════════════════════════════════════════════
// INSTANCIA GLOBAL
// ════════════════════════════════════════════════════════════════

window.apiClient = new BallDontLieClient();

// Auto-inicializar token al cargar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await window.apiClient.ensureToken();
      console.log('[API] ✅ Cliente inicializado y listo');
      
      // Notificar éxito
      if (typeof window.toastSuccess === 'function') {
        window.toastSuccess('Sistema NBA conectado');
      }
    } catch (error) {
      console.error('[API] ❌ Error inicializando cliente:', error);
      
      if (typeof window.toastError === 'function') {
        window.toastError('Error conectando a sistema NBA');
      }
    }
  });
} else {
  window.apiClient.ensureToken()
    .then(() => {
      console.log('[API] ✅ Cliente inicializado y listo');
      if (typeof window.toastSuccess === 'function') {
        window.toastSuccess('Sistema NBA conectado');
      }
    })
    .catch(error => {
      console.error('[API] ❌ Error inicializando:', error);
      if (typeof window.toastError === 'function') {
        window.toastError('Error conectando a sistema NBA');
      }
    });
}

console.log('✅ API Client v1.0 cargado');
