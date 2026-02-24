// scripts/ui-integration.js
// UI Integration v2.1 — Conecta engines con la UI
// Compatible con picks-engine.js estructura TOTALES
// ════════════════════════════════════════════════════════════════

console.log('🔌 UI Integration v2.1 cargando...');

(function () {
  'use strict';

  // ── Esperar un engine específico ──────────────────────────────
  function waitForEngine(name, ms = 8000) {
    return new Promise(resolve => {
      if (window[name]) { resolve(true); return; }
      const t0 = Date.now();
      const iv = setInterval(() => {
        if (window[name]) { clearInterval(iv); resolve(true); }
        else if (Date.now() - t0 > ms) { clearInterval(iv); console.warn(`[Integration] timeout: ${name}`); resolve(false); }
      }, 80);
    });
  }

  // ── loadPicksIA — delega en initPicksIa ───────────────────────
  window.loadPicksIA = async function () {
    console.log('[Integration] loadPicksIA →');
    const container = document.getElementById('picks-ia-container');
    if (!container) { console.error('[Integration] #picks-ia-container no encontrado'); return; }

    if (typeof window.initPicksIa === 'function') {
      await window.initPicksIa(container);
      return;
    }

    // Fallback si picks-ia.js no cargó
    container.innerHTML = `
      <div style="text-align:center;padding:60px 20px;background:rgba(255,255,255,0.03);border-radius:20px;border:1px solid rgba(255,255,255,0.08)">
        <div style="font-size:48px;margin-bottom:14px">⚙️</div>
        <h3 style="color:#fbbf24;margin-bottom:10px">Componente no cargado</h3>
        <p style="color:rgba(255,255,255,0.5);margin-bottom:20px">Verifica que picks-ia.js está desplegado correctamente.</p>
        <button onclick="window.loadPicksIA()"
                style="background:#fbbf24;color:#000;border:none;padding:12px 26px;border-radius:12px;font-weight:800;cursor:pointer">
          🔄 Reintentar
        </button>
      </div>`;
  };

  // ── H2H search (players) ──────────────────────────────────────
  window.initH2HSearch = function () {
    const i1 = document.getElementById('h2h-search-1') || document.querySelector('[data-h2h="search-1"]');
    const i2 = document.getElementById('h2h-search-2') || document.querySelector('[data-h2h="search-2"]');
    if (!i1 || !i2) return;
    let t1, t2;
    i1.addEventListener('input', e => { clearTimeout(t1); t1 = setTimeout(() => _searchH2H(e.target.value, 'results-1'), 300); });
    i2.addEventListener('input', e => { clearTimeout(t2); t2 = setTimeout(() => _searchH2H(e.target.value, 'results-2'), 300); });
    console.log('[Integration] ✅ H2H search init');
  };

  async function _searchH2H(q, resultId) {
    if (!q || q.length < 2 || !window.databaseUpdater) return;
    const el = document.getElementById(`h2h-${resultId}`) || document.querySelector(`[data-h2h="${resultId}"]`);
    if (!el) return;
    try {
      const players = await window.databaseUpdater.searchPlayers(q, 10);
      el.innerHTML = players.map(p =>
        `<div class="player-result" onclick="window.selectPlayerForH2H(${p.id},'${resultId}')">
           <div class="player-name">${p.first_name} ${p.last_name}</div>
           <div class="player-team">${p.team?.full_name || 'Free Agent'}</div>
         </div>`
      ).join('') || '<div class="no-results">Sin resultados</div>';
    } catch (err) { console.error('[Integration] H2H error:', err); }
  }

  window.selectedPlayers = { player1: null, player2: null };
  window.selectPlayerForH2H = function (id, rid) {
    window.selectedPlayers[rid === 'results-1' ? 'player1' : 'player2'] = id;
    if (window.selectedPlayers.player1 && window.selectedPlayers.player2)
      window.comparePlayersH2H(window.selectedPlayers.player1, window.selectedPlayers.player2);
  };

  window.comparePlayersH2H = async function (id1, id2) {
    const el = document.getElementById('h2h-comparison') || document.querySelector('[data-h2h="comparison"]');
    if (!el) return;
    el.innerHTML = '<div class="loading">⏳ Cargando comparación...</div>';
    try {
      const cmp = await window.h2hEngine?.comparePlayers(id1, id2);
      el.innerHTML = cmp ? `<div class="h2h-result"><pre>${JSON.stringify(cmp,null,2)}</pre></div>`
                         : '<div class="error-container"><p>h2hEngine no disponible</p></div>';
    } catch (err) {
      el.innerHTML = `<div class="error-container"><p>${err.message}</p></div>`;
    }
  };

  // ── Database search ────────────────────────────────────────────
  window.initDatabaseSearch = function () {
    const inp = document.getElementById('database-search') || document.querySelector('[data-database="search"]');
    if (!inp) return;
    let t;
    inp.addEventListener('input', e => {
      clearTimeout(t);
      if (e.target.value.length >= 2) t = setTimeout(() => _searchDB(e.target.value), 300);
    });
    console.log('[Integration] ✅ DB search init');
  };

  async function _searchDB(q) {
    const el = document.getElementById('database-results') || document.querySelector('[data-database="results"]');
    if (!el || !window.databaseUpdater) return;
    try {
      const players = await window.databaseUpdater.searchPlayers(q, 50);
      el.innerHTML = players.length
        ? `<div class="players-grid">${players.map(p =>
            `<div class="player-card" onclick="window.showPlayerDetails(${p.id})">
               <h4>${p.first_name} ${p.last_name}</h4>
               <p>${p.team?.full_name || 'Free Agent'} · ${p.position || 'N/A'}</p>
             </div>`).join('')}</div>`
        : `<p class="no-results">Sin resultados para "${q}"</p>`;
    } catch (err) { el.innerHTML = `<p>Error: ${err.message}</p>`; }
  }

  window.showPlayerDetails = async function (id) {
    window.toastInfo?.('Cargando jugador...');
    try {
      if (!window.apiClient) throw new Error('apiClient no disponible');
      const data = await window.apiClient.getPlayer?.(id);
      console.log('Player:', data);
    } catch (err) { window.toastError?.(err.message); }
  };

  // ── Auto-init ──────────────────────────────────────────────────
  async function autoInit() {
    console.log('[Integration] 🚀 autoInit...');

    // Esperar picksEngine (crítico)
    await waitForEngine('picksEngine', 7000);

    window.initH2HSearch();
    window.initDatabaseSearch();

    // Si la vista activa es picks, cargar
    const active = document.querySelector('#view-picks.active');
    if (active) window.loadPicksIA();

    console.log('[Integration] ✅ Listo');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoInit);
  else autoInit();

  console.log('✅ UI Integration v2.1 cargado');
})();
