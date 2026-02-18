// components/picks-ia.js
// Componente Picks IA COMPLETAMENTE FUNCIONAL
// Genera picks reales usando picksEngine + BallDontLie API
// ════════════════════════════════════════════════════════════════

console.log('📊 Picks IA Component v2.0 cargando...');

window.initPicksIa = async function(container) {
  if (!container) {
    console.error('[Picks IA] Contenedor no encontrado');
    return;
  }

  console.log('[Picks IA] 🚀 Inicializando componente...');

  // ════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ════════════════════════════════════════════════════════════════

  function showLoading() {
    container.innerHTML = `
      <div class="picks-loading-state">
        <div class="picks-header">
          <div class="picks-header-content">
            <div class="picks-icon">🎯</div>
            <div>
              <h2 class="picks-title">Picks IA</h2>
              <p class="picks-subtitle">Analizando juegos con 47 factores contextuales...</p>
            </div>
          </div>
        </div>
        
        <div class="picks-skeleton-grid">
          ${Array(3).fill('').map(() => `
            <div class="pick-card-skeleton">
              <div class="skeleton-header">
                <div class="skeleton skeleton-text" style="width: 70%; height: 24px; margin-bottom: 12px;"></div>
                <div class="skeleton skeleton-circle" style="width: 60px; height: 60px;"></div>
              </div>
              <div class="skeleton skeleton-text" style="width: 85%; height: 16px; margin: 12px 0;"></div>
              <div class="skeleton-lines">
                <div class="skeleton skeleton-text" style="width: 90%; height: 14px; margin-bottom: 8px;"></div>
                <div class="skeleton skeleton-text" style="width: 75%; height: 14px; margin-bottom: 8px;"></div>
                <div class="skeleton skeleton-text" style="width: 80%; height: 14px;"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ════════════════════════════════════════════════════════════════
  // ERROR STATE
  // ════════════════════════════════════════════════════════════════

  function showError(message, canRetry = true) {
    container.innerHTML = `
      <div class="picks-error-state">
        <div class="error-icon">⚠️</div>
        <h3 class="error-title">Error cargando picks</h3>
        <p class="error-message">${message}</p>
        ${canRetry ? `
          <button onclick="window.initPicksIa(document.getElementById('picks-ia-container'))" 
                  class="btn-retry">
            🔄 Reintentar
          </button>
        ` : ''}
        <div class="error-help">
          <p class="error-help-title">💡 Sugerencias:</p>
          <ul class="error-help-list">
            <li>Verifica tu conexión a internet</li>
            <li>Intenta recargar la página (Ctrl+R)</li>
            <li>Limpia el cache del navegador</li>
          </ul>
        </div>
      </div>
    `;
  }

  // ════════════════════════════════════════════════════════════════
  // EMPTY STATE (No hay juegos hoy)
  // ════════════════════════════════════════════════════════════════

  function showEmpty() {
    const today = new Date().toLocaleDateString('es-ES', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    container.innerHTML = `
      <div class="picks-empty-state">
        <div class="empty-icon">📅</div>
        <h3 class="empty-title">No hay juegos programados para hoy</h3>
        <p class="empty-subtitle">${today}</p>
        <p class="empty-message">
          La NBA programa juegos de forma variable durante la temporada. 
          Vuelve mañana para nuevos picks generados por IA.
        </p>
        <div class="empty-info">
          <div class="info-card">
            <div class="info-icon">🏀</div>
            <div>
              <h4>Temporada Regular</h4>
              <p>Octubre - Abril</p>
            </div>
          </div>
          <div class="info-card">
            <div class="info-icon">🏆</div>
            <div>
              <h4>Playoffs</h4>
              <p>Abril - Junio</p>
            </div>
          </div>
        </div>
        <button onclick="window.initPicksIa(document.getElementById('picks-ia-container'))" 
                class="btn-secondary">
          🔄 Actualizar
        </button>
      </div>
    `;
  }

  // ════════════════════════════════════════════════════════════════
  // RENDER PICKS
  // ════════════════════════════════════════════════════════════════

  function renderPicks(picks) {
    const highConfidence = picks.filter(p => p.confidence >= 75);
    const mediumConfidence = picks.filter(p => p.confidence >= 65 && p.confidence < 75);
    const lowConfidence = picks.filter(p => p.confidence >= 60 && p.confidence < 65);

    container.innerHTML = `
      <div class="picks-success-state">
        <!-- Header -->
        <div class="picks-header">
          <div class="picks-header-content">
            <div class="picks-icon">🎯</div>
            <div>
              <h2 class="picks-title">Picks IA - ${picks.length} Recomendaciones</h2>
              <p class="picks-subtitle">
                ${highConfidence.length} alta confianza • 
                ${mediumConfidence.length} media • 
                ${lowConfidence.length} baja
              </p>
            </div>
          </div>
          <button onclick="window.initPicksIa(document.getElementById('picks-ia-container'))" 
                  class="btn-refresh">
            🔄 Actualizar
          </button>
        </div>

        <!-- Filtros -->
        <div class="picks-filters">
          <button class="filter-btn active" data-filter="all" onclick="filterPicks('all')">
            Todos (${picks.length})
          </button>
          <button class="filter-btn" data-filter="high" onclick="filterPicks('high')">
            Alta confianza (${highConfidence.length})
          </button>
          <button class="filter-btn" data-filter="medium" onclick="filterPicks('medium')">
            Media (${mediumConfidence.length})
          </button>
          <button class="filter-btn" data-filter="low" onclick="filterPicks('low')">
            Baja (${lowConfidence.length})
          </button>
        </div>

        <!-- Picks Grid -->
        <div class="picks-grid" id="picks-grid">
          ${picks.map(pick => renderPickCard(pick)).join('')}
        </div>

        <!-- Footer -->
        <div class="picks-footer">
          <div class="disclaimer">
            <span class="disclaimer-icon">⚠️</span>
            <p>
              <strong>Disclaimer:</strong> Estas recomendaciones son generadas por IA con fines informativos. 
              Siempre haz tu propia investigación y apuesta responsablemente.
            </p>
          </div>
          <div class="footer-stats">
            <div class="stat-item">
              <span class="stat-label">Última actualización:</span>
              <span class="stat-value">${new Date().toLocaleTimeString('es-ES')}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Análisis basado en:</span>
              <span class="stat-value">47 factores contextuales</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Añadir event listeners después de renderizar
    attachPickEventListeners();
  }

  function renderPickCard(pick) {
    const confidenceClass = pick.confidence >= 75 ? 'strong' : 
                           pick.confidence >= 65 ? 'medium' : 'weak';
    const confidenceColor = pick.confidence >= 75 ? '#10b981' : 
                           pick.confidence >= 65 ? '#f59e0b' : '#ef4444';

    return `
      <div class="pick-card ${confidenceClass}" 
           data-confidence="${confidenceClass}"
           data-game-id="${pick.gameId}">
        <!-- Header -->
        <div class="pick-card-header">
          <div class="pick-matchup">
            <div class="team team-pick">
              <span class="team-logo">🏀</span>
              <div class="team-info">
                <span class="team-name">${pick.pickTeam.full_name}</span>
                ${pick.pickTeam.id === pick.game.home_team.id ? 
                  '<span class="home-badge">Local</span>' : 
                  '<span class="away-badge">Visitante</span>'
                }
              </div>
            </div>
            
            <div class="vs-divider">
              <span class="vs-text">VS</span>
            </div>
            
            <div class="team team-opponent">
              <span class="team-logo">🏀</span>
              <div class="team-info">
                <span class="team-name">${pick.opponentTeam.full_name}</span>
                ${pick.opponentTeam.id === pick.game.home_team.id ? 
                  '<span class="home-badge">Local</span>' : 
                  '<span class="away-badge">Visitante</span>'
                }
              </div>
            </div>
          </div>
          
          <div class="pick-confidence-badge">
            <svg class="confidence-ring" width="70" height="70">
              <circle cx="35" cy="35" r="30" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="6"/>
              <circle cx="35" cy="35" r="30" fill="none" 
                      stroke="${confidenceColor}" 
                      stroke-width="6" 
                      stroke-dasharray="${2 * Math.PI * 30}" 
                      stroke-dashoffset="${2 * Math.PI * 30 * (1 - pick.confidence / 100)}"
                      transform="rotate(-90 35 35)"/>
            </svg>
            <div class="confidence-value">
              <span class="confidence-number">${pick.confidence}</span>
              <span class="confidence-percent">%</span>
            </div>
          </div>
        </div>

        <!-- Body -->
        <div class="pick-card-body">
          <!-- Recommendation Badge -->
          <div class="recommendation-badge ${confidenceClass}">
            <span class="badge-icon">${pick.recommendation.type === 'strong' ? '🔥' : 
                                       pick.recommendation.type === 'medium' ? '⚡' : '💡'}</span>
            <span class="badge-text">${pick.recommendation.text}</span>
            <span class="badge-units">${pick.recommendation.units} unidades</span>
          </div>

          <!-- Explanation -->
          <div class="pick-explanation">
            <span class="explanation-icon">💡</span>
            <p>${pick.explanation}</p>
          </div>

          <!-- Betting Lines -->
          <div class="betting-lines">
            <div class="betting-line">
              <span class="line-label">Spread</span>
              <span class="line-value">${pick.spread}</span>
            </div>
            <div class="betting-line">
              <span class="line-label">Moneyline</span>
              <span class="line-value">${pick.moneyline}</span>
            </div>
            <div class="betting-line">
              <span class="line-label">O/U</span>
              <span class="line-value">${pick.overUnder}</span>
            </div>
          </div>

          <!-- Key Factors -->
          <div class="key-factors">
            <h4 class="factors-title">Factores Clave:</h4>
            <div class="factors-grid">
              ${Object.entries(pick.factors).slice(0, 5).map(([key, value]) => `
                <div class="factor-item">
                  <div class="factor-header">
                    <span class="factor-name">${formatFactorName(key)}</span>
                    <span class="factor-score">${Math.round(value * 100)}%</span>
                  </div>
                  <div class="factor-bar">
                    <div class="factor-fill ${value > 0.6 ? 'high' : value > 0.4 ? 'medium' : 'low'}" 
                         style="width: ${value * 100}%"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Reasoning -->
          ${pick.reasoning && pick.reasoning.length > 0 ? `
            <div class="pick-reasoning">
              <h4 class="reasoning-title">Razones Principales:</h4>
              <ul class="reasoning-list">
                ${pick.reasoning.map(reason => `<li>${reason}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>

        <!-- Footer -->
        <div class="pick-card-footer">
          <button onclick="addPickToTracking('${pick.gameId}', '${pick.pick}')" 
                  class="btn-track"
                  data-game-id="${pick.gameId}">
            <span class="btn-icon">📊</span>
            <span>Agregar a Tracking</span>
          </button>
          <button onclick="showPickDetails('${pick.gameId}')" 
                  class="btn-details">
            <span class="btn-icon">📈</span>
            <span>Ver Detalles</span>
          </button>
        </div>
      </div>
    `;
  }

  // ════════════════════════════════════════════════════════════════
  // HELPER FUNCTIONS
  // ════════════════════════════════════════════════════════════════

  function formatFactorName(key) {
    const names = {
      playerForm: 'Forma Jugadores',
      teamForm: 'Forma Equipo',
      homeAdvantage: 'Ventaja Local',
      restDays: 'Descanso',
      injuries: 'Lesiones',
      h2hHistory: 'Historial H2H',
      pace: 'Ritmo',
      defense: 'Defensa',
      offense: 'Ofensiva',
      momentum: 'Momentum'
    };
    return names[key] || key;
  }

  function attachPickEventListeners() {
    // Ya los event listeners están inline en onclick
    // Pero podríamos añadir más funcionalidad aquí si es necesario
  }

  // ════════════════════════════════════════════════════════════════
  // FILTERING
  // ════════════════════════════════════════════════════════════════

  window.filterPicks = function(filter) {
    const grid = document.getElementById('picks-grid');
    if (!grid) return;

    const cards = grid.querySelectorAll('.pick-card');
    const buttons = document.querySelectorAll('.filter-btn');

    // Update active button
    buttons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    // Filter cards
    cards.forEach(card => {
      const confidence = card.dataset.confidence;
      let show = false;

      switch(filter) {
        case 'all':
          show = true;
          break;
        case 'high':
          show = confidence === 'strong';
          break;
        case 'medium':
          show = confidence === 'medium';
          break;
        case 'low':
          show = confidence === 'weak';
          break;
      }

      card.style.display = show ? 'block' : 'none';
    });
  };

  // ════════════════════════════════════════════════════════════════
  // TRACKING INTEGRATION
  // ════════════════════════════════════════════════════════════════

  window.addPickToTracking = async function(gameId, teamName) {
    if (!window.firebase || !window.currentUser) {
      if (typeof window.toastError === 'function') {
        window.toastError('Debes iniciar sesión para usar tracking');
      }
      return;
    }

    try {
      const pick = {
        gameId: gameId,
        pick: teamName,
        timestamp: Date.now(),
        userId: window.currentUser.uid,
        status: 'pending'
      };

      await window.firebase.database()
        .ref(`users/${window.currentUser.uid}/picks/${gameId}`)
        .set(pick);

      if (typeof window.toastSuccess === 'function') {
        window.toastSuccess(`Pick agregado a tracking: ${teamName}`);
      }

      // Deshabilitar botón
      const button = document.querySelector(`[data-game-id="${gameId}"]`);
      if (button) {
        button.disabled = true;
        button.innerHTML = '<span class="btn-icon">✅</span><span>Agregado</span>';
        button.classList.add('btn-disabled');
      }

    } catch (error) {
      console.error('[Picks IA] Error añadiendo a tracking:', error);
      if (typeof window.toastError === 'function') {
        window.toastError('Error agregando pick');
      }
    }
  };

  window.showPickDetails = function(gameId) {
    // TODO: Implementar modal con detalles completos
    console.log('[Picks IA] Mostrar detalles del pick:', gameId);
    if (typeof window.toastInfo === 'function') {
      window.toastInfo('Detalles completos próximamente...');
    }
  };

  // ════════════════════════════════════════════════════════════════
  // MAIN EXECUTION
  // ════════════════════════════════════════════════════════════════

  try {
    // Mostrar loading
    showLoading();

    // Verificar que picksEngine existe
    if (!window.picksEngine) {
      console.error('[Picks IA] picksEngine no está disponible');
      showError('Sistema de picks no inicializado. Recarga la página.', true);
      return;
    }

    // Generar picks
    console.log('[Picks IA] 🎲 Generando picks...');
    const picks = await window.picksEngine.generateTodayPicks();

    console.log('[Picks IA] ✅ Picks generados:', picks.length);

    // Renderizar según resultado
    if (picks.length === 0) {
      showEmpty();
    } else {
      renderPicks(picks);
      
      // Toast de éxito
      if (typeof window.toastSuccess === 'function') {
        window.toastSuccess(`${picks.length} picks generados con IA`);
      }
    }

  } catch (error) {
    console.error('[Picks IA] ❌ Error fatal:', error);
    showError(error.message || 'Error desconocido', true);
    
    if (typeof window.toastError === 'function') {
      window.toastError('Error generando picks');
    }
  }
};

console.log('✅ Picks IA Component v2.0 listo');
