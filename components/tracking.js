// components/tracking.js
// Componente Tracking COMPLETAMENTE FUNCIONAL
// Integración con Firebase Realtime Database + Cálculo de ROI
// ════════════════════════════════════════════════════════════════

console.log('📈 Tracking Component v2.0 cargando...');

window.initTracking = async function(container) {
  if (!container) {
    console.error('[Tracking] Contenedor no encontrado');
    return;
  }

  console.log('[Tracking] 🚀 Inicializando componente...');

  let picksListener = null;

  // ════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ════════════════════════════════════════════════════════════════

  function showLoading() {
    container.innerHTML = `
      <div class="tracking-loading-state">
        <div class="tracking-header">
          <div class="tracking-icon">📊</div>
          <div>
            <h2 class="tracking-title">Tracking de Picks</h2>
            <p class="tracking-subtitle">Cargando tus picks...</p>
          </div>
        </div>
        <div class="tracking-skeleton">
          ${Array(3).fill('').map(() => `
            <div class="tracking-card-skeleton">
              <div class="skeleton skeleton-text" style="width: 60%; height: 20px; margin-bottom: 12px;"></div>
              <div class="skeleton skeleton-text" style="width: 40%; height: 16px; margin-bottom: 8px;"></div>
              <div class="skeleton skeleton-text" style="width: 80%; height: 14px;"></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ════════════════════════════════════════════════════════════════
  // ERROR STATE
  // ════════════════════════════════════════════════════════════════

  function showError(message) {
    container.innerHTML = `
      <div class="tracking-error-state">
        <div class="error-icon">⚠️</div>
        <h3 class="error-title">Error</h3>
        <p class="error-message">${message}</p>
        <button onclick="window.initTracking(document.getElementById('tracking-container'))" 
                class="btn-retry">
          🔄 Reintentar
        </button>
      </div>
    `;
  }

  // ════════════════════════════════════════════════════════════════
  // EMPTY STATE (Sin picks trackeados)
  // ════════════════════════════════════════════════════════════════

  function showEmpty() {
    container.innerHTML = `
      <div class="tracking-empty-state">
        <div class="empty-icon">📊</div>
        <h3 class="empty-title">Aún no tienes picks trackeados</h3>
        <p class="empty-message">
          Agrega picks desde la sección "Picks IA" para comenzar a trackear tu rendimiento.
        </p>
        <div class="empty-features">
          <div class="feature-item">
            <span class="feature-icon">✅</span>
            <span>ROI en tiempo real</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">📈</span>
            <span>Historial completo</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">🎯</span>
            <span>Análisis de rendimiento</span>
          </div>
        </div>
        <button onclick="switchView('picks')" class="btn-primary">
          🎯 Ir a Picks IA
        </button>
      </div>
    `;
  }

  // ════════════════════════════════════════════════════════════════
  // RENDER TRACKING
  // ════════════════════════════════════════════════════════════════

  function renderTracking(picks) {
    const picksList = Object.values(picks);
    
    // Calcular estadísticas
    const stats = calculateStats(picksList);
    const pending = picksList.filter(p => p.status === 'pending');
    const completed = picksList.filter(p => p.status === 'win' || p.status === 'loss');
    const wins = picksList.filter(p => p.status === 'win');
    const losses = picksList.filter(p => p.status === 'loss');

    container.innerHTML = `
      <div class="tracking-success-state">
        <!-- Header -->
        <div class="tracking-header">
          <div class="tracking-header-content">
            <div class="tracking-icon">📊</div>
            <div>
              <h2 class="tracking-title">Tracking de Picks</h2>
              <p class="tracking-subtitle">
                ${pending.length} pendientes • 
                ${completed.length} completados
              </p>
            </div>
          </div>
          <button onclick="window.initTracking(document.getElementById('tracking-container'))" 
                  class="btn-refresh">
            🔄 Actualizar
          </button>
        </div>

        <!-- Stats Cards -->
        <div class="stats-grid">
          <div class="stat-card roi ${stats.roi >= 0 ? 'positive' : 'negative'}">
            <div class="stat-icon">${stats.roi >= 0 ? '📈' : '📉'}</div>
            <div class="stat-content">
              <div class="stat-label">ROI</div>
              <div class="stat-value">${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}%</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">🎯</div>
            <div class="stat-content">
              <div class="stat-label">Win Rate</div>
              <div class="stat-value">${stats.winRate.toFixed(1)}%</div>
              <div class="stat-detail">${wins.length}W - ${losses.length}L</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">💰</div>
            <div class="stat-content">
              <div class="stat-label">Profit/Loss</div>
              <div class="stat-value ${stats.profitLoss >= 0 ? 'text-green' : 'text-red'}">
                ${stats.profitLoss >= 0 ? '+' : ''}${stats.profitLoss.toFixed(2)}u
              </div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">📊</div>
            <div class="stat-content">
              <div class="stat-label">Total Picks</div>
              <div class="stat-value">${picksList.length}</div>
              <div class="stat-detail">${completed.length} finalizados</div>
            </div>
          </div>
        </div>

        <!-- Filters -->
        <div class="tracking-filters">
          <button class="filter-btn active" data-filter="all" onclick="filterTracking('all')">
            Todos (${picksList.length})
          </button>
          <button class="filter-btn" data-filter="pending" onclick="filterTracking('pending')">
            Pendientes (${pending.length})
          </button>
          <button class="filter-btn" data-filter="win" onclick="filterTracking('win')">
            Ganados (${wins.length})
          </button>
          <button class="filter-btn" data-filter="loss" onclick="filterTracking('loss')">
            Perdidos (${losses.length})
          </button>
        </div>

        <!-- Picks List -->
        <div class="tracking-list" id="tracking-list">
          ${picksList
            .sort((a, b) => b.timestamp - a.timestamp)
            .map(pick => renderPickItem(pick))
            .join('')}
        </div>

        <!-- Footer Info -->
        <div class="tracking-footer">
          <div class="footer-info">
            <span class="info-icon">💡</span>
            <p>Los picks se actualizan automáticamente cuando los juegos finalizan.</p>
          </div>
          <button onclick="clearAllPicks()" class="btn-danger-outline">
            🗑️ Limpiar Historial
          </button>
        </div>
      </div>
    `;
  }

  function renderPickItem(pick) {
    const statusIcon = {
      pending: '⏳',
      win: '✅',
      loss: '❌'
    };

    const statusClass = {
      pending: 'status-pending',
      win: 'status-win',
      loss: 'status-loss'
    };

    const statusText = {
      pending: 'Pendiente',
      win: 'Ganado',
      loss: 'Perdido'
    };

    const date = new Date(pick.timestamp).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <div class="tracking-item ${statusClass[pick.status]}" 
           data-status="${pick.status}"
           data-pick-id="${pick.gameId}">
        <div class="tracking-item-header">
          <div class="tracking-item-info">
            <div class="pick-badge ${statusClass[pick.status]}">
              <span class="badge-icon">${statusIcon[pick.status]}</span>
              <span class="badge-text">${statusText[pick.status]}</span>
            </div>
            <h4 class="pick-team">${pick.pick}</h4>
            <p class="pick-date">${date}</p>
          </div>
          
          ${pick.confidence ? `
            <div class="confidence-mini">
              <span class="confidence-label">Confianza</span>
              <span class="confidence-value">${pick.confidence}%</span>
            </div>
          ` : ''}
        </div>

        <div class="tracking-item-body">
          ${pick.odds ? `
            <div class="pick-detail">
              <span class="detail-label">Cuota:</span>
              <span class="detail-value">${pick.odds}</span>
            </div>
          ` : ''}
          
          ${pick.units ? `
            <div class="pick-detail">
              <span class="detail-label">Unidades:</span>
              <span class="detail-value">${pick.units}u</span>
            </div>
          ` : ''}

          ${pick.result ? `
            <div class="pick-detail">
              <span class="detail-label">Resultado:</span>
              <span class="detail-value">${pick.result.homeScore} - ${pick.result.awayScore}</span>
            </div>
          ` : ''}

          ${pick.profit !== undefined ? `
            <div class="pick-profit ${pick.profit >= 0 ? 'profit-positive' : 'profit-negative'}">
              <span class="profit-label">P/L:</span>
              <span class="profit-value">
                ${pick.profit >= 0 ? '+' : ''}${pick.profit.toFixed(2)}u
              </span>
            </div>
          ` : ''}
        </div>

        <div class="tracking-item-actions">
          ${pick.status === 'pending' ? `
            <button onclick="updatePickStatus('${pick.gameId}', 'win')" 
                    class="btn-small btn-success"
                    title="Marcar como ganado">
              ✅ Ganado
            </button>
            <button onclick="updatePickStatus('${pick.gameId}', 'loss')" 
                    class="btn-small btn-danger"
                    title="Marcar como perdido">
              ❌ Perdido
            </button>
          ` : ''}
          <button onclick="removePick('${pick.gameId}')" 
                  class="btn-small btn-outline"
                  title="Eliminar pick">
            🗑️
          </button>
        </div>
      </div>
    `;
  }

  // ════════════════════════════════════════════════════════════════
  // STATS CALCULATION
  // ════════════════════════════════════════════════════════════════

  function calculateStats(picks) {
    const completed = picks.filter(p => p.status === 'win' || p.status === 'loss');
    const wins = picks.filter(p => p.status === 'win');
    const losses = picks.filter(p => p.status === 'loss');

    const totalProfit = picks.reduce((sum, p) => sum + (p.profit || 0), 0);
    const totalStaked = picks.reduce((sum, p) => sum + (p.units || 1), 0);

    return {
      winRate: completed.length > 0 ? (wins.length / completed.length) * 100 : 0,
      roi: totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0,
      profitLoss: totalProfit,
      totalPicks: picks.length,
      wins: wins.length,
      losses: losses.length,
      pending: picks.filter(p => p.status === 'pending').length
    };
  }

  // ════════════════════════════════════════════════════════════════
  // FIREBASE OPERATIONS
  // ════════════════════════════════════════════════════════════════

  window.updatePickStatus = async function(gameId, status) {
    if (!window.firebase || !window.currentUser) return;

    try {
      const pickRef = window.firebase.database()
        .ref(`users/${window.currentUser.uid}/picks/${gameId}`);
      
      const snapshot = await pickRef.once('value');
      const pick = snapshot.val();

      if (!pick) {
        console.error('[Tracking] Pick no encontrado');
        return;
      }

      // Calcular profit/loss
      let profit = 0;
      if (status === 'win') {
        profit = (pick.units || 1) * ((pick.odds || 2.0) - 1);
      } else if (status === 'loss') {
        profit = -(pick.units || 1);
      }

      await pickRef.update({
        status: status,
        profit: profit,
        updatedAt: Date.now()
      });

      if (typeof window.toastSuccess === 'function') {
        window.toastSuccess(
          status === 'win' ? 
          `¡Pick ganado! +${profit.toFixed(2)}u` : 
          `Pick perdido. ${profit.toFixed(2)}u`
        );
      }

    } catch (error) {
      console.error('[Tracking] Error actualizando pick:', error);
      if (typeof window.toastError === 'function') {
        window.toastError('Error actualizando pick');
      }
    }
  };

  window.removePick = async function(gameId) {
    if (!window.firebase || !window.currentUser) return;

    if (!confirm('¿Eliminar este pick del tracking?')) return;

    try {
      await window.firebase.database()
        .ref(`users/${window.currentUser.uid}/picks/${gameId}`)
        .remove();

      if (typeof window.toastSuccess === 'function') {
        window.toastSuccess('Pick eliminado');
      }

    } catch (error) {
      console.error('[Tracking] Error eliminando pick:', error);
      if (typeof window.toastError === 'function') {
        window.toastError('Error eliminando pick');
      }
    }
  };

  window.clearAllPicks = async function() {
    if (!window.firebase || !window.currentUser) return;

    if (!confirm('¿Eliminar TODO el historial de picks? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await window.firebase.database()
        .ref(`users/${window.currentUser.uid}/picks`)
        .remove();

      if (typeof window.toastSuccess === 'function') {
        window.toastSuccess('Historial limpiado');
      }

    } catch (error) {
      console.error('[Tracking] Error limpiando historial:', error);
      if (typeof window.toastError === 'function') {
        window.toastError('Error limpiando historial');
      }
    }
  };

  // ════════════════════════════════════════════════════════════════
  // FILTERING
  // ════════════════════════════════════════════════════════════════

  window.filterTracking = function(filter) {
    const list = document.getElementById('tracking-list');
    if (!list) return;

    const items = list.querySelectorAll('.tracking-item');
    const buttons = document.querySelectorAll('.tracking-filters .filter-btn');

    // Update active button
    buttons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    // Filter items
    items.forEach(item => {
      const status = item.dataset.status;
      const show = filter === 'all' || status === filter;
      item.style.display = show ? 'block' : 'none';
    });
  };

  // ════════════════════════════════════════════════════════════════
  // MAIN EXECUTION
  // ════════════════════════════════════════════════════════════════

  try {
    // Verificar autenticación
    if (!window.firebase) {
      showError('Firebase no está inicializado. Recarga la página.');
      return;
    }

    if (!window.currentUser) {
      container.innerHTML = `
        <div class="tracking-login-required">
          <div class="login-icon">🔒</div>
          <h3 class="login-title">Inicia sesión para usar Tracking</h3>
          <p class="login-message">
            El tracking de picks requiere una cuenta para guardar tu progreso.
          </p>
          <button onclick="window.showLoginModal && window.showLoginModal()" 
                  class="btn-primary">
            🔑 Iniciar Sesión
          </button>
        </div>
      `;
      return;
    }

    // Mostrar loading
    showLoading();

    // Listener en tiempo real para los picks del usuario
    const picksRef = window.firebase.database()
      .ref(`users/${window.currentUser.uid}/picks`);

    picksListener = picksRef.on('value', (snapshot) => {
      const picks = snapshot.val();

      if (!picks || Object.keys(picks).length === 0) {
        showEmpty();
      } else {
        renderTracking(picks);
      }
    }, (error) => {
      console.error('[Tracking] Error en listener:', error);
      showError('Error cargando picks. Verifica tu conexión.');
    });

    console.log('[Tracking] ✅ Listener de Firebase activado');

  } catch (error) {
    console.error('[Tracking] ❌ Error fatal:', error);
    showError(error.message || 'Error desconocido');
  }

  // Cleanup function (llamar cuando se cambie de vista)
  return function cleanup() {
    if (picksListener && window.firebase && window.currentUser) {
      window.firebase.database()
        .ref(`users/${window.currentUser.uid}/picks`)
        .off('value', picksListener);
      console.log('[Tracking] 🧹 Listener desactivado');
    }
  };
};

console.log('✅ Tracking Component v2.0 listo');
