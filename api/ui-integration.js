// scripts/ui-integration.js
// Integración automática de engines con UI existente
// ════════════════════════════════════════════════════════════════
// Este archivo conecta api-client, picks-engine, h2h-engine y database-updater
// con la interfaz de usuario existente en index.html
// ════════════════════════════════════════════════════════════════

console.log('🔌 UI Integration v1.0 cargando...');

(function() {
  'use strict';

  // ════════════════════════════════════════════════════════════════
  // WAIT FOR ALL ENGINES TO BE READY
  // ════════════════════════════════════════════════════════════════

  function waitForEngines() {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (
          window.apiClient &&
          window.picksEngine &&
          window.h2hEngine &&
          window.databaseUpdater
        ) {
          clearInterval(checkInterval);
          console.log('[Integration] ✅ Todos los engines están listos');
          resolve();
        }
      }, 100);
      
      // Timeout después de 10 segundos
      setTimeout(() => {
        clearInterval(checkInterval);
        console.warn('[Integration] ⚠️ Timeout esperando engines');
        resolve();
      }, 10000);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // PICKS IA INTEGRATION
  // ════════════════════════════════════════════════════════════════

  window.loadPicksIA = async function() {
    console.log('[Integration] 🎯 Cargando Picks IA...');
    
    const container = document.getElementById('picks-ia-container') || 
                     document.querySelector('[data-view="picks"]') ||
                     document.querySelector('.picks-view');
    
    if (!container) {
      console.error('[Integration] ❌ No se encontró contenedor de Picks IA');
      return;
    }
    
    // Mostrar skeleton loading
    container.innerHTML = `
      <div class="picks-loading">
        <div class="loading-header">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
        </div>
        <div class="picks-skeleton">
          ${Array(3).fill('').map(() => `
            <div class="pick-card-skeleton">
              <div class="skeleton skeleton-text" style="width: 60%; height: 24px; margin-bottom: 16px;"></div>
              <div class="skeleton skeleton-text" style="width: 40%; height: 20px; margin-bottom: 12px;"></div>
              <div class="skeleton skeleton-text" style="width: 80%; height: 16px; margin-bottom: 8px;"></div>
              <div class="skeleton skeleton-text" style="width: 70%; height: 16px;"></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    try {
      // Generar picks usando el engine
      const picks = await window.picksEngine.generateTodayPicks();
      
      if (picks.length === 0) {
        container.innerHTML = `
          <div class="no-picks-container">
            <div class="no-picks-icon">📅</div>
            <h3>No hay picks disponibles para hoy</h3>
            <p>Los juegos de NBA se actualizan diariamente. Vuelve mañana para nuevos picks.</p>
            <button onclick="window.loadPicksIA()" class="btn-primary">
              🔄 Reintentar
            </button>
          </div>
        `;
        return;
      }
      
      // Renderizar picks
      container.innerHTML = `
        <div class="picks-header">
          <h2>🎯 Picks IA - ${picks.length} Recomendaciones</h2>
          <p class="picks-subtitle">Análisis avanzado con 47 factores contextuales</p>
        </div>
        
        <div class="picks-grid">
          ${picks.map(pick => `
            <div class="pick-card ${pick.recommendation.type}" data-pick-id="${pick.gameId}">
              <!-- Header -->
              <div class="pick-card-header">
                <div class="pick-teams">
                  <div class="team ${pick.pickTeam.id === pick.game.home_team.id ? 'home-team' : ''}">
                    <span class="team-name">${pick.pickTeam.full_name}</span>
                    ${pick.pickTeam.id === pick.game.home_team.id ? '<span class="home-badge">Local</span>' : ''}
                  </div>
                  <div class="vs-divider">VS</div>
                  <div class="team">
                    <span class="team-name">${pick.opponentTeam.full_name}</span>
                    ${pick.opponentTeam.id === pick.game.home_team.id ? '<span class="home-badge">Local</span>' : ''}
                  </div>
                </div>
                
                <div class="pick-confidence">
                  <div class="confidence-circle ${pick.recommendation.type}">
                    <span class="confidence-value">${pick.confidence}%</span>
                  </div>
                  <span class="confidence-label">${pick.recommendation.text}</span>
                </div>
              </div>
              
              <!-- Body -->
              <div class="pick-card-body">
                <div class="pick-explanation">
                  <i class="icon">💡</i>
                  <span>${pick.explanation}</span>
                </div>
                
                <!-- Betting Lines -->
                <div class="betting-lines">
                  <div class="betting-line">
                    <span class="line-label">Spread:</span>
                    <span class="line-value">${pick.spread}</span>
                  </div>
                  <div class="betting-line">
                    <span class="line-label">Moneyline:</span>
                    <span class="line-value">${pick.moneyline}</span>
                  </div>
                  <div class="betting-line">
                    <span class="line-label">O/U:</span>
                    <span class="line-value">${pick.overUnder}</span>
                  </div>
                </div>
                
                <!-- Factors -->
                <div class="pick-factors">
                  <div class="factor-label">Análisis de Factores:</div>
                  ${Object.entries(pick.factors).slice(0, 5).map(([key, value]) => `
                    <div class="factor-item">
                      <span class="factor-name">${key}</span>
                      <div class="factor-bar">
                        <div class="factor-fill ${value > 0.6 ? 'high' : value > 0.4 ? 'medium' : 'low'}" 
                             style="width: ${value * 100}%"></div>
                      </div>
                      <span class="factor-value">${Math.round(value * 100)}%</span>
                    </div>
                  `).join('')}
                </div>
                
                <!-- Reasoning -->
                ${pick.reasoning && pick.reasoning.length > 0 ? `
                  <div class="pick-reasoning">
                    <div class="reasoning-label">Razones Principales:</div>
                    <ul class="reasoning-list">
                      ${pick.reasoning.map(reason => `<li>${reason}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}
              </div>
              
              <!-- Footer -->
              <div class="pick-card-footer">
                <button onclick="window.addPickToTracking('${pick.gameId}', '${pick.pick}')" 
                        class="btn-secondary">
                  📊 Agregar a Tracking
                </button>
                <button onclick="window.showPickDetails('${pick.gameId}')" 
                        class="btn-outline">
                  📈 Ver Análisis Completo
                </button>
              </div>
            </div>
          `).join('')}
        </div>
        
        <div class="picks-footer">
          <p class="disclaimer">
            ⚠️ Disclaimer: Estas recomendaciones son generadas por IA con fines informativos. 
            Siempre haz tu propia investigación y apuesta responsablemente.
          </p>
          <button onclick="window.loadPicksIA()" class="btn-refresh">
            🔄 Actualizar Picks
          </button>
        </div>
      `;
      
      console.log('[Integration] ✅ Picks IA renderizados');
      
    } catch (error) {
      console.error('[Integration] ❌ Error cargando Picks IA:', error);
      
      container.innerHTML = `
        <div class="error-container">
          <div class="error-icon">❌</div>
          <h3>Error cargando picks</h3>
          <p>${error.message}</p>
          <button onclick="window.loadPicksIA()" class="btn-primary">
            🔄 Reintentar
          </button>
        </div>
      `;
      
      if (typeof window.toastError === 'function') {
        window.toastError('Error cargando picks. Reintentando...');
      }
    }
  };

  // ════════════════════════════════════════════════════════════════
  // H2H INTEGRATION
  // ════════════════════════════════════════════════════════════════

  window.initH2HSearch = function() {
    console.log('[Integration] ⚔️ Inicializando búsqueda H2H...');
    
    const searchInput1 = document.getElementById('h2h-search-1') || 
                         document.querySelector('[data-h2h="search-1"]');
    const searchInput2 = document.getElementById('h2h-search-2') || 
                         document.querySelector('[data-h2h="search-2"]');
    
    if (!searchInput1 || !searchInput2) {
      console.warn('[Integration] ⚠️ No se encontraron inputs de búsqueda H2H');
      return;
    }
    
    // Agregar event listeners para búsqueda en tiempo real
    let timeout1, timeout2;
    
    searchInput1.addEventListener('input', (e) => {
      clearTimeout(timeout1);
      timeout1 = setTimeout(() => {
        searchPlayers(e.target.value, 'results-1');
      }, 300);
    });
    
    searchInput2.addEventListener('input', (e) => {
      clearTimeout(timeout2);
      timeout2 = setTimeout(() => {
        searchPlayers(e.target.value, 'results-2');
      }, 300);
    });
    
    async function searchPlayers(query, resultsId) {
      if (!query || query.length < 2) return;
      
      const resultsContainer = document.getElementById(`h2h-${resultsId}`) ||
                              document.querySelector(`[data-h2h="${resultsId}"]`);
      
      if (!resultsContainer) return;
      
      try {
        const players = await window.databaseUpdater.searchPlayers(query, 10);
        
        resultsContainer.innerHTML = players.map(player => `
          <div class="player-result" onclick="window.selectPlayerForH2H(${player.id}, '${resultsId}')">
            <div class="player-info">
              <div class="player-name">${player.first_name} ${player.last_name}</div>
              <div class="player-team">${player.team?.full_name || 'Free Agent'}</div>
            </div>
            <div class="player-position">${player.position || 'N/A'}</div>
          </div>
        `).join('') || '<div class="no-results">No se encontraron jugadores</div>';
        
      } catch (error) {
        console.error('[Integration] ❌ Error buscando jugadores:', error);
      }
    }
    
    console.log('[Integration] ✅ Búsqueda H2H inicializada');
  };

  window.selectedPlayers = { player1: null, player2: null };

  window.selectPlayerForH2H = function(playerId, resultsId) {
    console.log('[Integration] 👤 Jugador seleccionado:', playerId);
    
    if (resultsId === 'results-1') {
      window.selectedPlayers.player1 = playerId;
    } else {
      window.selectedPlayers.player2 = playerId;
    }
    
    // Si ambos jugadores están seleccionados, ejecutar comparación
    if (window.selectedPlayers.player1 && window.selectedPlayers.player2) {
      window.comparePlayersH2H(window.selectedPlayers.player1, window.selectedPlayers.player2);
    }
  };

  window.comparePlayersH2H = async function(playerId1, playerId2) {
    console.log('[Integration] ⚔️ Comparando jugadores:', playerId1, 'vs', playerId2);
    
    const container = document.getElementById('h2h-comparison') ||
                     document.querySelector('[data-h2h="comparison"]') ||
                     document.querySelector('.h2h-results');
    
    if (!container) {
      console.error('[Integration] ❌ No se encontró contenedor de comparación H2H');
      return;
    }
    
    // Loading state
    container.innerHTML = '<div class="loading">⏳ Cargando comparación...</div>';
    
    try {
      const comparison = await window.h2hEngine.comparePlayers(playerId1, playerId2);
      
      // Renderizar comparación
      container.innerHTML = `
        <div class="h2h-comparison-view">
          <!-- Header con ganador -->
          <div class="h2h-header">
            <div class="player-card ${comparison.winner === 0 ? 'winner' : ''}">
              <div class="player-photo">👤</div>
              <h3>${comparison.players[0].name}</h3>
              <p class="player-team">${comparison.players[0].team}</p>
              <p class="player-position">${comparison.players[0].position}</p>
            </div>
            
            <div class="vs-section">
              <div class="vs-text">VS</div>
              ${comparison.winner === -1 ? 
                '<div class="tie-badge">Empate</div>' : 
                `<div class="winner-badge">
                  ${comparison.winner === 0 ? comparison.players[0].name : comparison.players[1].name} gana
                </div>`
              }
            </div>
            
            <div class="player-card ${comparison.winner === 1 ? 'winner' : ''}">
              <div class="player-photo">👤</div>
              <h3>${comparison.players[1].name}</h3>
              <p class="player-team">${comparison.players[1].team}</p>
              <p class="player-position">${comparison.players[1].position}</p>
            </div>
          </div>
          
          <!-- Summary -->
          <div class="h2h-summary">
            <p>${comparison.summary}</p>
          </div>
          
          <!-- Ratings -->
          <div class="h2h-ratings">
            <h4>Ratings Generales</h4>
            <div class="ratings-grid">
              <div class="rating-item">
                <div class="rating-label">Ofensiva</div>
                <div class="rating-bars">
                  <div class="rating-bar player-1">
                    <div class="bar-fill" style="width: ${comparison.ratings.offense[0]}%">
                      ${comparison.ratings.offense[0]}
                    </div>
                  </div>
                  <div class="rating-bar player-2">
                    <div class="bar-fill" style="width: ${comparison.ratings.offense[1]}%">
                      ${comparison.ratings.offense[1]}
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="rating-item">
                <div class="rating-label">Defensiva</div>
                <div class="rating-bars">
                  <div class="rating-bar player-1">
                    <div class="bar-fill" style="width: ${comparison.ratings.defense[0]}%">
                      ${comparison.ratings.defense[0]}
                    </div>
                  </div>
                  <div class="rating-bar player-2">
                    <div class="bar-fill" style="width: ${comparison.ratings.defense[1]}%">
                      ${comparison.ratings.defense[1]}
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="rating-item">
                <div class="rating-label">Eficiencia</div>
                <div class="rating-bars">
                  <div class="rating-bar player-1">
                    <div class="bar-fill" style="width: ${comparison.ratings.efficiency[0]}%">
                      ${comparison.ratings.efficiency[0]}
                    </div>
                  </div>
                  <div class="rating-bar player-2">
                    <div class="bar-fill" style="width: ${comparison.ratings.efficiency[1]}%">
                      ${comparison.ratings.efficiency[1]}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Métricas detalladas -->
          <div class="h2h-metrics">
            <h4>Comparación de Estadísticas</h4>
            <div class="metrics-table">
              ${Object.values(comparison.metrics).map(metric => `
                <div class="metric-row">
                  <div class="metric-value ${metric.winner === 0 ? 'winner' : ''} player-1">
                    ${metric.values[0]}
                  </div>
                  <div class="metric-label">${metric.label}</div>
                  <div class="metric-value ${metric.winner === 1 ? 'winner' : ''} player-2">
                    ${metric.values[1]}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          
          <!-- Ventajas -->
          <div class="h2h-advantages">
            <div class="advantages-column">
              <h4>Ventajas de ${comparison.players[0].name}</h4>
              <ul>
                ${comparison.advantages[0].slice(0, 5).map(adv => `
                  <li>${adv.category}: +${adv.difference} (${adv.percent}%)</li>
                `).join('')}
              </ul>
            </div>
            <div class="advantages-column">
              <h4>Ventajas de ${comparison.players[1].name}</h4>
              <ul>
                ${comparison.advantages[1].slice(0, 5).map(adv => `
                  <li>${adv.category}: +${adv.difference} (${adv.percent}%)</li>
                `).join('')}
              </ul>
            </div>
          </div>
          
          <div class="h2h-actions">
            <button onclick="window.initH2HSearch()" class="btn-primary">
              🔄 Nueva Comparación
            </button>
          </div>
        </div>
      `;
      
      console.log('[Integration] ✅ Comparación H2H renderizada');
      
      if (typeof window.toastSuccess === 'function') {
        window.toastSuccess('Comparación H2H completada');
      }
      
    } catch (error) {
      console.error('[Integration] ❌ Error en comparación H2H:', error);
      
      container.innerHTML = `
        <div class="error-container">
          <div class="error-icon">❌</div>
          <h3>Error en comparación</h3>
          <p>${error.message}</p>
          <button onclick="window.initH2HSearch()" class="btn-primary">
            🔄 Reintentar
          </button>
        </div>
      `;
      
      if (typeof window.toastError === 'function') {
        window.toastError('Error en comparación H2H');
      }
    }
  };

  // ════════════════════════════════════════════════════════════════
  // DATABASE SEARCH INTEGRATION
  // ════════════════════════════════════════════════════════════════

  window.initDatabaseSearch = function() {
    console.log('[Integration] 🔍 Inicializando búsqueda de base de datos...');
    
    const searchInput = document.getElementById('database-search') ||
                       document.querySelector('[data-database="search"]') ||
                       document.querySelector('.database-search-input');
    
    if (!searchInput) {
      console.warn('[Integration] ⚠️ No se encontró input de búsqueda de base de datos');
      return;
    }
    
    let searchTimeout;
    
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value;
      
      if (query.length < 2) {
        clearDatabaseResults();
        return;
      }
      
      searchTimeout = setTimeout(() => {
        searchDatabase(query);
      }, 300);
    });
    
    console.log('[Integration] ✅ Búsqueda de base de datos inicializada');
  };

  async function searchDatabase(query) {
    console.log('[Integration] 🔍 Buscando en base de datos:', query);
    
    const resultsContainer = document.getElementById('database-results') ||
                            document.querySelector('[data-database="results"]') ||
                            document.querySelector('.database-results');
    
    if (!resultsContainer) {
      console.warn('[Integration] ⚠️ No se encontró contenedor de resultados');
      return;
    }
    
    try {
      const players = await window.databaseUpdater.searchPlayers(query, 50);
      
      if (players.length === 0) {
        resultsContainer.innerHTML = `
          <div class="no-results">
            <p>No se encontraron jugadores para "${query}"</p>
          </div>
        `;
        return;
      }
      
      resultsContainer.innerHTML = `
        <div class="database-results-header">
          <h3>Resultados (${players.length})</h3>
        </div>
        <div class="players-grid">
          ${players.map(player => `
            <div class="player-card" onclick="window.showPlayerDetails(${player.id})">
              <div class="player-header">
                <div class="player-avatar">👤</div>
                <div class="player-info">
                  <h4>${player.first_name} ${player.last_name}</h4>
                  <p class="player-team">${player.team?.full_name || 'Free Agent'}</p>
                </div>
              </div>
              <div class="player-details">
                <div class="detail-item">
                  <span class="label">Posición:</span>
                  <span class="value">${player.position || 'N/A'}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Altura:</span>
                  <span class="value">${player.height_feet && player.height_inches ? `${player.height_feet}'${player.height_inches}"` : 'N/A'}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Peso:</span>
                  <span class="value">${player.weight_pounds ? `${player.weight_pounds} lbs` : 'N/A'}</span>
                </div>
              </div>
              <div class="player-actions">
                <button onclick="event.stopPropagation(); window.viewPlayerStats(${player.id})" class="btn-small">
                  📊 Ver Stats
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      
      console.log('[Integration] ✅ Resultados de búsqueda renderizados:', players.length);
      
    } catch (error) {
      console.error('[Integration] ❌ Error buscando en base de datos:', error);
      resultsContainer.innerHTML = `
        <div class="error-container">
          <p>Error en búsqueda: ${error.message}</p>
        </div>
      `;
    }
  }

  function clearDatabaseResults() {
    const resultsContainer = document.getElementById('database-results') ||
                            document.querySelector('[data-database="results"]');
    
    if (resultsContainer) {
      resultsContainer.innerHTML = '';
    }
  }

  window.showPlayerDetails = async function(playerId) {
    console.log('[Integration] 👤 Mostrando detalles del jugador:', playerId);
    
    // Implementar modal o vista de detalles
    if (typeof window.toastInfo === 'function') {
      window.toastInfo('Cargando detalles del jugador...');
    }
    
    try {
      const playerData = await window.apiClient.getPlayer(playerId);
      const statsData = await window.apiClient.getSeasonAverages(playerId);
      
      const player = playerData.data || playerData;
      const stats = (statsData.data && statsData.data[0]) || {};
      
      // Aquí deberías abrir un modal o cambiar de vista
      // Por ahora, solo mostramos la info en consola
      console.log('Player details:', player, stats);
      
      if (typeof window.toastSuccess === 'function') {
        window.toastSuccess(`Detalles de ${player.first_name} ${player.last_name} cargados`);
      }
      
    } catch (error) {
      console.error('[Integration] ❌ Error cargando detalles:', error);
      if (typeof window.toastError === 'function') {
        window.toastError('Error cargando detalles del jugador');
      }
    }
  };

  // ════════════════════════════════════════════════════════════════
  // AUTO-INIT ON PAGE LOAD
  // ════════════════════════════════════════════════════════════════

  async function autoInit() {
    console.log('[Integration] 🚀 Inicializando integraciones automáticas...');
    
    // Esperar a que todos los engines estén listos
    await waitForEngines();
    
    // Inicializar búsquedas
    window.initH2HSearch();
    window.initDatabaseSearch();
    
    // Si estamos en la vista de Picks IA, cargarlos automáticamente
    const currentView = document.querySelector('.view.active') || 
                       document.querySelector('[data-view].active');
    
    if (currentView && currentView.dataset.view === 'picks') {
      window.loadPicksIA();
    }
    
    console.log('[Integration] ✅ Integraciones inicializadas');
    
    if (typeof window.toastSuccess === 'function') {
      window.toastSuccess('Sistema completamente inicializado');
    }
  }

  // Ejecutar auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  console.log('✅ UI Integration v1.0 cargado');

})();
