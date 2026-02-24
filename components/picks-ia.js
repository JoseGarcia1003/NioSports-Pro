// components/picks-ia.js
// Componente Picks IA v3.0 — 100% Robusto
// ════════════════════════════════════════════════════════════════

console.log('📊 Picks IA Component v3.0 cargando...');

window.initPicksIa = async function (container) {
  if (!container) {
    console.error('[Picks IA] Contenedor no encontrado');
    return;
  }

  // ── Helpers seguros ────────────────────────────────────────
  function safe(val, fallback = '—') {
    if (val === undefined || val === null || val === '') return fallback;
    return val;
  }

  function safeTeamName(teamObj, fallback = 'Equipo') {
    if (!teamObj) return fallback;
    return teamObj.full_name || teamObj.name || teamObj.abbreviation || fallback;
  }

  function safeRecommendation(rec) {
    if (!rec || typeof rec !== 'object') {
      return { type: 'medium', text: 'Pick Analizado', units: 1 };
    }
    return {
      type: rec.type || 'medium',
      text: rec.text || 'Pick Analizado',
      units: rec.units || 1,
    };
  }

  function safeFactors(factors) {
    const defaults = {
      playerForm: 0.55, teamForm: 0.55, homeAdvantage: 0.60,
      restDays: 0.50, injuries: 0.65, h2hHistory: 0.55,
      pace: 0.60, defense: 0.60, offense: 0.65, momentum: 0.55,
    };
    if (!factors || typeof factors !== 'object') return defaults;
    const result = {};
    for (const [k, v] of Object.entries(factors)) {
      const num = parseFloat(v);
      result[k] = isNaN(num) ? 0.5 : Math.min(1, Math.max(0, num));
    }
    return Object.keys(result).length ? result : defaults;
  }

  function isHomeTeam(teamObj, game) {
    if (!teamObj || !game || !game.home_team) return false;
    return teamObj.id === game.home_team.id;
  }

  // ── Estados ────────────────────────────────────────────────
  function showLoading() {
    container.innerHTML = `
      <div class="pia-loading">
        <div class="pia-loading-header">
          <div class="pia-pulse-dot"></div>
          <span>Motor IA analizando 47 factores...</span>
        </div>
        <div class="pia-skeletons">
          ${Array(3).fill('').map(() => `
            <div class="pia-skel-card">
              <div class="pia-skel-row" style="width:65%;height:22px;"></div>
              <div class="pia-skel-row" style="width:40%;height:16px;margin-top:10px;"></div>
              <div class="pia-skel-row" style="width:90%;height:13px;margin-top:14px;"></div>
              <div class="pia-skel-row" style="width:75%;height:13px;margin-top:8px;"></div>
              <div class="pia-skel-row" style="width:80%;height:13px;margin-top:8px;"></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function showError(msg) {
    container.innerHTML = `
      <div class="pia-error">
        <div class="pia-error-icon">❌</div>
        <h3 class="pia-error-title">Error cargando picks</h3>
        <p class="pia-error-msg">${safe(msg, 'Error desconocido')}</p>
        <button class="pia-btn-retry" onclick="window.loadPicksIA()">
          🔄 Reintentar
        </button>
        <div class="pia-error-tips">
          <p>💡 Sugerencias:</p>
          <ul>
            <li>Verifica tu conexión a internet</li>
            <li>Recarga la página (Ctrl+R)</li>
          </ul>
        </div>
      </div>
    `;
  }

  function showEmpty() {
    const today = new Date().toLocaleDateString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    container.innerHTML = `
      <div class="pia-empty">
        <div class="pia-empty-icon">📅</div>
        <h3>No hay juegos programados para hoy</h3>
        <p class="pia-empty-date">${today}</p>
        <p>La NBA programa juegos de forma variable. Vuelve mañana para nuevos picks.</p>
        <button class="pia-btn-retry" onclick="window.loadPicksIA()">🔄 Actualizar</button>
      </div>
    `;
  }

  // ── Render de una pick card ────────────────────────────────
  function renderCard(pick) {
    // Sanitizar datos con defensas completas
    const rec         = safeRecommendation(pick.recommendation);
    const factors     = safeFactors(pick.factors);
    const pickTeam    = pick.pickTeam || { full_name: 'Equipo A', id: 0 };
    const oppTeam     = pick.opponentTeam || { full_name: 'Equipo B', id: 1 };
    const game        = pick.game || {};
    const confidence  = parseInt(pick.confidence) || 60;
    const gameId      = safe(pick.gameId, 'game-' + Math.random().toString(36).slice(2));
    const spread      = safe(pick.spread, 'N/D');
    const moneyline   = safe(pick.moneyline, 'N/D');
    const overUnder   = safe(pick.overUnder, 'N/D');
    const explanation = safe(pick.explanation, 'Análisis completado por el motor IA.');
    const reasoning   = Array.isArray(pick.reasoning) ? pick.reasoning : [];
    const isDemo      = pick.isDemo === true;

    const confColor   = confidence >= 78 ? '#10b981' : confidence >= 68 ? '#f59e0b' : '#ef4444';
    const confClass   = confidence >= 78 ? 'strong' : confidence >= 68 ? 'medium' : 'weak';
    const recEmoji    = rec.type === 'strong' ? '🔥' : rec.type === 'medium' ? '⚡' : '💡';

    const circumference = 2 * Math.PI * 30;
    const dashOffset    = circumference * (1 - confidence / 100);

    const topFactors = Object.entries(factors).slice(0, 6);

    return `
      <div class="pia-card ${confClass}" data-confidence="${confClass}" data-game-id="${gameId}">
        ${isDemo ? '<div class="pia-demo-badge">📊 Modo Demo</div>' : ''}

        <!-- HEADER -->
        <div class="pia-card-head">
          <div class="pia-matchup">
            <div class="pia-team pia-team-pick">
              <span class="pia-team-abbr">${pickTeam.abbreviation || pickTeam.full_name?.slice(0,3).toUpperCase() || 'AAA'}</span>
              <span class="pia-team-name">${safeTeamName(pickTeam)}</span>
              <span class="pia-loc-badge ${isHomeTeam(pickTeam, game) ? 'home' : 'away'}">
                ${isHomeTeam(pickTeam, game) ? '🏠 Local' : '✈️ Visitante'}
              </span>
            </div>

            <div class="pia-vs">VS</div>

            <div class="pia-team pia-team-opp">
              <span class="pia-team-abbr">${oppTeam.abbreviation || oppTeam.full_name?.slice(0,3).toUpperCase() || 'BBB'}</span>
              <span class="pia-team-name">${safeTeamName(oppTeam)}</span>
              <span class="pia-loc-badge ${isHomeTeam(oppTeam, game) ? 'home' : 'away'}">
                ${isHomeTeam(oppTeam, game) ? '🏠 Local' : '✈️ Visitante'}
              </span>
            </div>
          </div>

          <div class="pia-conf-ring">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="30" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="7"/>
              <circle cx="40" cy="40" r="30" fill="none"
                      stroke="${confColor}"
                      stroke-width="7"
                      stroke-linecap="round"
                      stroke-dasharray="${circumference}"
                      stroke-dashoffset="${dashOffset}"
                      transform="rotate(-90 40 40)"
                      style="transition: stroke-dashoffset 1s ease-out;"/>
            </svg>
            <div class="pia-conf-value">
              <span class="pia-conf-num">${confidence}</span>
              <span class="pia-conf-pct">%</span>
            </div>
          </div>
        </div>

        <!-- RECOMMENDATION BADGE -->
        <div class="pia-rec-badge ${confClass}">
          <span>${recEmoji} ${rec.text}</span>
          <span class="pia-rec-units">${rec.units} u.</span>
        </div>

        <!-- EXPLANATION -->
        <div class="pia-explanation">
          <span class="pia-exp-icon">💡</span>
          <p>${explanation}</p>
        </div>

        <!-- BETTING LINES -->
        <div class="pia-lines">
          <div class="pia-line">
            <span class="pia-line-label">Spread</span>
            <span class="pia-line-val">${spread}</span>
          </div>
          <div class="pia-line">
            <span class="pia-line-label">Moneyline</span>
            <span class="pia-line-val">${moneyline}</span>
          </div>
          <div class="pia-line">
            <span class="pia-line-label">O/U</span>
            <span class="pia-line-val">${overUnder}</span>
          </div>
        </div>

        <!-- FACTORS -->
        <div class="pia-factors">
          <h4 class="pia-factors-title">Factores Clave</h4>
          <div class="pia-factors-grid">
            ${topFactors.map(([key, val]) => {
              const pct = Math.round(val * 100);
              const cls = pct > 65 ? 'high' : pct > 45 ? 'mid' : 'low';
              return `
                <div class="pia-factor">
                  <div class="pia-factor-head">
                    <span class="pia-factor-name">${formatFactor(key)}</span>
                    <span class="pia-factor-pct ${cls}">${pct}%</span>
                  </div>
                  <div class="pia-factor-bar">
                    <div class="pia-factor-fill ${cls}" style="width:${pct}%"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- REASONING -->
        ${reasoning.length > 0 ? `
          <div class="pia-reasoning">
            <h4 class="pia-reasoning-title">📋 Razones Principales</h4>
            <ul class="pia-reasoning-list">
              ${reasoning.slice(0, 4).map(r => `<li>${safe(r)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <!-- FOOTER -->
        <div class="pia-card-foot">
          <button class="pia-btn-track" onclick="window.addPickToTracking('${gameId}', '${safeTeamName(pickTeam)}')">
            📊 Agregar a Tracking
          </button>
          <button class="pia-btn-details" onclick="window.showPickDetails('${gameId}')">
            📈 Detalles
          </button>
        </div>
      </div>
    `;
  }

  // ── Render principal ───────────────────────────────────────
  function renderPicks(picks) {
    const strong = picks.filter(p => (p.confidence || 0) >= 78);
    const medium = picks.filter(p => (p.confidence || 0) >= 68 && (p.confidence || 0) < 78);
    const weak   = picks.filter(p => (p.confidence || 0) < 68);

    const allStyles = `
      <style>
        /* ── PICKS IA STYLES v3.0 ─────────────────────────────── */
        .pia-wrapper { font-family: 'DM Sans', sans-serif; }

        /* Loading */
        .pia-loading { padding: 20px; }
        .pia-loading-header {
          display: flex; align-items: center; gap: 10px;
          color: rgba(255,255,255,0.6); font-size: 14px; margin-bottom: 24px;
        }
        .pia-pulse-dot {
          width: 10px; height: 10px; border-radius: 50%;
          background: #fbbf24; animation: piaPulse 1.4s ease-in-out infinite;
        }
        @keyframes piaPulse {
          0%,100% { opacity:1; transform: scale(1); }
          50% { opacity:0.4; transform: scale(0.7); }
        }
        .pia-skeletons { display: grid; gap: 16px; }
        .pia-skel-card {
          background: rgba(255,255,255,0.04); border-radius: 16px;
          padding: 24px; border: 1px solid rgba(255,255,255,0.07);
        }
        .pia-skel-row {
          background: linear-gradient(90deg,rgba(255,255,255,0.06) 25%,rgba(255,255,255,0.12) 50%,rgba(255,255,255,0.06) 75%);
          background-size: 400% 100%;
          border-radius: 8px; animation: piaShimmer 1.6s linear infinite;
        }
        @keyframes piaShimmer { 0%{background-position:200%} 100%{background-position:-200%} }

        /* Error / Empty */
        .pia-error, .pia-empty {
          text-align: center; padding: 60px 24px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
        }
        .pia-error-icon, .pia-empty-icon { font-size: 56px; margin-bottom: 16px; }
        .pia-error-title { color: #f87171; font-size: 22px; font-weight: 700; margin-bottom: 10px; }
        .pia-error-msg { color: rgba(255,255,255,0.55); margin-bottom: 24px; }
        .pia-empty-date { color: #fbbf24; margin-bottom: 12px; font-weight: 600; }
        .pia-error-tips { text-align: left; max-width: 280px; margin: 20px auto 0; color: rgba(255,255,255,0.5); font-size: 13px; }
        .pia-error-tips ul { margin-top: 8px; padding-left: 20px; }
        .pia-error-tips li { margin-bottom: 4px; }

        /* Buttons */
        .pia-btn-retry {
          background: #fbbf24; color: #000; border: none;
          padding: 12px 28px; border-radius: 12px;
          font-weight: 700; font-size: 14px; cursor: pointer;
          transition: all 0.2s;
        }
        .pia-btn-retry:hover { background: #f59e0b; transform: translateY(-1px); }

        /* Filtros */
        .pia-filters {
          display: flex; gap: 8px; flex-wrap: wrap;
          margin-bottom: 28px; padding-bottom: 20px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .pia-filter {
          padding: 8px 18px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.15);
          background: transparent; color: rgba(255,255,255,0.6);
          font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;
        }
        .pia-filter:hover { border-color: #fbbf24; color: #fbbf24; }
        .pia-filter.active {
          background: #fbbf24; color: #000;
          border-color: #fbbf24; box-shadow: 0 0 16px rgba(251,191,36,0.3);
        }

        /* Grid */
        .pia-grid { display: grid; gap: 20px; }
        @media (min-width: 800px) { .pia-grid { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 1200px) { .pia-grid { grid-template-columns: 1fr 1fr 1fr; } }

        /* Card */
        .pia-card {
          background: rgba(10,22,40,0.85);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px; padding: 22px;
          position: relative; overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
          text-align: left;
          animation: piaFadeIn 0.4s ease-out both;
        }
        @keyframes piaFadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .pia-card:hover { transform: translateY(-3px); box-shadow: 0 16px 40px rgba(0,0,0,0.5); }
        .pia-card::before {
          content:''; position:absolute; top:0; left:0; right:0; height:3px;
          border-radius:20px 20px 0 0;
        }
        .pia-card.strong::before { background: linear-gradient(90deg,#10b981,#34d399); box-shadow: 0 0 12px rgba(16,185,129,0.5); }
        .pia-card.medium::before { background: linear-gradient(90deg,#f59e0b,#fbbf24); box-shadow: 0 0 12px rgba(245,158,11,0.5); }
        .pia-card.weak::before   { background: linear-gradient(90deg,#ef4444,#f87171); }

        .pia-demo-badge {
          position: absolute; top: 14px; right: 14px;
          background: rgba(255,215,0,0.15); color: #fbbf24;
          font-size: 11px; font-weight: 700; padding: 4px 10px;
          border-radius: 20px; border: 1px solid rgba(255,215,0,0.3);
          letter-spacing: 0.5px;
        }

        /* Card head */
        .pia-card-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
        .pia-matchup { flex: 1; }
        .pia-team { margin-bottom: 10px; }
        .pia-team-pick { margin-bottom: 12px; }
        .pia-team-abbr {
          display: inline-block; min-width: 40px;
          font-size: 11px; font-weight: 800; letter-spacing: 1px;
          color: #fbbf24; font-family: 'JetBrains Mono', monospace;
          margin-right: 6px;
        }
        .pia-team-name { font-size: 15px; font-weight: 700; color: #e2e8f0; margin-right: 8px; }
        .pia-loc-badge {
          font-size: 11px; padding: 2px 8px; border-radius: 10px;
          font-weight: 600;
        }
        .pia-loc-badge.home { background: rgba(16,185,129,0.15); color: #10b981; }
        .pia-loc-badge.away { background: rgba(100,116,139,0.15); color: #94a3b8; }
        .pia-vs {
          font-size: 12px; font-weight: 800; letter-spacing: 2px;
          color: rgba(255,255,255,0.3); padding: 4px 0; margin: 4px 0;
        }

        /* Confidence ring */
        .pia-conf-ring { position: relative; width: 80px; height: 80px; flex-shrink: 0; }
        .pia-conf-value {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center; flex-direction: column;
        }
        .pia-conf-num { font-size: 22px; font-weight: 800; color: #fff; line-height: 1; }
        .pia-conf-pct { font-size: 11px; color: rgba(255,255,255,0.5); }

        /* Recommendation badge */
        .pia-rec-badge {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 16px; border-radius: 12px;
          font-size: 13px; font-weight: 700; margin-bottom: 14px;
        }
        .pia-rec-badge.strong { background: rgba(16,185,129,0.12); color: #10b981; border: 1px solid rgba(16,185,129,0.2); }
        .pia-rec-badge.medium { background: rgba(245,158,11,0.12); color: #f59e0b; border: 1px solid rgba(245,158,11,0.2); }
        .pia-rec-badge.weak   { background: rgba(239,68,68,0.10); color: #ef4444; border: 1px solid rgba(239,68,68,0.2); }
        .pia-rec-units { font-size: 12px; opacity: 0.8; font-weight: 600; }

        /* Explanation */
        .pia-explanation {
          display: flex; gap: 10px; align-items: flex-start;
          background: rgba(255,255,255,0.04); border-radius: 12px;
          padding: 12px 14px; margin-bottom: 14px;
        }
        .pia-exp-icon { flex-shrink: 0; }
        .pia-explanation p { font-size: 13px; color: rgba(255,255,255,0.65); line-height: 1.6; margin: 0; }

        /* Lines */
        .pia-lines { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
        .pia-line {
          flex: 1; min-width: 80px;
          background: rgba(255,255,255,0.04); border-radius: 10px;
          padding: 8px 10px; text-align: center;
          border: 1px solid rgba(255,255,255,0.07);
        }
        .pia-line-label { display: block; font-size: 10px; color: rgba(255,255,255,0.4); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .pia-line-val { font-size: 13px; font-weight: 700; color: #e2e8f0; font-family: 'JetBrains Mono', monospace; }

        /* Factors */
        .pia-factors { margin-bottom: 16px; }
        .pia-factors-title { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
        .pia-factors-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .pia-factor { }
        .pia-factor-head { display: flex; justify-content: space-between; margin-bottom: 4px; }
        .pia-factor-name { font-size: 11px; color: rgba(255,255,255,0.55); }
        .pia-factor-pct { font-size: 11px; font-weight: 700; }
        .pia-factor-pct.high { color: #10b981; }
        .pia-factor-pct.mid  { color: #f59e0b; }
        .pia-factor-pct.low  { color: #ef4444; }
        .pia-factor-bar { height: 4px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; }
        .pia-factor-fill { height: 100%; border-radius: 4px; transition: width 0.8s ease-out; }
        .pia-factor-fill.high { background: linear-gradient(90deg,#10b981,#34d399); }
        .pia-factor-fill.mid  { background: linear-gradient(90deg,#f59e0b,#fbbf24); }
        .pia-factor-fill.low  { background: linear-gradient(90deg,#ef4444,#f87171); }

        /* Reasoning */
        .pia-reasoning { margin-bottom: 16px; }
        .pia-reasoning-title { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
        .pia-reasoning-list { list-style: none; padding: 0; margin: 0; }
        .pia-reasoning-list li {
          font-size: 13px; color: rgba(255,255,255,0.65);
          padding: 6px 0 6px 20px; border-bottom: 1px solid rgba(255,255,255,0.04);
          position: relative; line-height: 1.5;
        }
        .pia-reasoning-list li::before { content: '›'; position: absolute; left: 6px; color: #fbbf24; font-weight: 800; }
        .pia-reasoning-list li:last-child { border-bottom: none; }

        /* Card footer */
        .pia-card-foot { display: flex; gap: 8px; margin-top: 4px; }
        .pia-btn-track, .pia-btn-details {
          flex: 1; padding: 10px; border-radius: 10px;
          font-size: 12px; font-weight: 700; cursor: pointer;
          transition: all 0.2s; border: none;
        }
        .pia-btn-track { background: rgba(251,191,36,0.15); color: #fbbf24; border: 1px solid rgba(251,191,36,0.2); }
        .pia-btn-track:hover { background: rgba(251,191,36,0.25); }
        .pia-btn-details { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.1); }
        .pia-btn-details:hover { background: rgba(255,255,255,0.1); }
        .pia-btn-track:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Disclaimer */
        .pia-disclaimer {
          display: flex; gap: 12px; align-items: flex-start;
          background: rgba(245,158,11,0.07); border: 1px solid rgba(245,158,11,0.15);
          border-radius: 14px; padding: 16px 18px; margin-top: 28px;
        }
        .pia-disclaimer p { font-size: 12px; color: rgba(255,255,255,0.5); line-height: 1.6; margin: 0; }
        .pia-disclaimer strong { color: rgba(255,255,255,0.7); }

        .pia-footer-stats {
          display: flex; justify-content: space-between; flex-wrap: wrap;
          gap: 12px; margin-top: 14px; padding-top: 14px;
          border-top: 1px solid rgba(255,255,255,0.07);
          font-size: 12px; color: rgba(255,255,255,0.4);
        }
      </style>
    `;

    container.innerHTML = allStyles + `
      <div class="pia-wrapper">
        <!-- Filtros -->
        <div class="pia-filters">
          <button class="pia-filter active" data-f="all" onclick="window.__piaFilter('all')">
            Todos (${picks.length})
          </button>
          <button class="pia-filter" data-f="strong" onclick="window.__piaFilter('strong')">
            🔥 Fuertes (${strong.length})
          </button>
          <button class="pia-filter" data-f="medium" onclick="window.__piaFilter('medium')">
            ⚡ Sólidos (${medium.length})
          </button>
          <button class="pia-filter" data-f="weak" onclick="window.__piaFilter('weak')">
            💡 Estándar (${weak.length})
          </button>
        </div>

        <!-- Grid de picks -->
        <div class="pia-grid" id="pia-grid">
          ${picks.map((p, i) => {
            const card = renderCard(p);
            return card.replace('animation: piaFadeIn', `animation-delay:${i * 0.08}s; animation: piaFadeIn`);
          }).join('')}
        </div>

        <!-- Disclaimer -->
        <div class="pia-disclaimer">
          <span>⚠️</span>
          <p><strong>Disclaimer:</strong> Estas recomendaciones son generadas por IA con fines informativos. Siempre realiza tu propia investigación y apuesta responsablemente. No garantizamos resultados.</p>
        </div>

        <div class="pia-footer-stats">
          <span>⏱ Actualizado: ${new Date().toLocaleTimeString('es-ES')}</span>
          <span>🧠 Motor: 47 factores contextuales</span>
          ${picks.some(p => p.isDemo) ? '<span>📊 Datos de demostración activos</span>' : '<span>📡 Datos en tiempo real</span>'}
        </div>
      </div>
    `;

    // Función de filtrado
    window.__piaFilter = function (filter) {
      const grid = document.getElementById('pia-grid');
      if (!grid) return;
      grid.querySelectorAll('.pia-card').forEach(card => {
        const c = card.dataset.confidence;
        const show = filter === 'all' || c === filter;
        card.style.display = show ? '' : 'none';
      });
      document.querySelectorAll('.pia-filter').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.f === filter);
      });
    };
  }

  // ── Factor name formatter ──────────────────────────────────
  const FACTOR_NAMES = {
    playerForm: 'Forma Jugadores', teamForm: 'Forma Equipo',
    homeAdvantage: 'Ventaja Local', restDays: 'Descanso',
    injuries: 'Lesiones', h2hHistory: 'H2H', pace: 'Ritmo',
    defense: 'Defensa', offense: 'Ofensiva', momentum: 'Momentum',
  };
  function formatFactor(key) {
    return FACTOR_NAMES[key] || key.replace(/([A-Z])/g, ' $1').trim();
  }

  // ── Tracking ───────────────────────────────────────────────
  window.addPickToTracking = async function (gameId, teamName) {
    if (!window.currentUser) {
      window.toastError && window.toastError('Debes iniciar sesión para usar tracking');
      return;
    }
    try {
      await window.firebase.database()
        .ref(`users/${window.currentUser.uid}/picks/${gameId}`)
        .set({ gameId, pick: teamName, timestamp: Date.now(), status: 'pending' });

      window.toastSuccess && window.toastSuccess(`Pick agregado: ${teamName}`);

      const btn = document.querySelector(`.pia-btn-track[onclick*="${gameId}"]`);
      if (btn) { btn.disabled = true; btn.innerHTML = '✅ Agregado'; }
    } catch (err) {
      console.error('[Picks IA] Tracking error:', err);
      window.toastError && window.toastError('Error agregando pick');
    }
  };

  window.showPickDetails = function (gameId) {
    window.toastInfo && window.toastInfo('Detalles completos próximamente...');
  };

  // ── Ejecución principal ────────────────────────────────────
  try {
    showLoading();

    if (!window.picksEngine) {
      console.error('[Picks IA] picksEngine no disponible');
      showError('Motor de picks no inicializado. Recarga la página.');
      return;
    }

    const picks = await window.picksEngine.generateTodayPicks();

    if (!Array.isArray(picks) || picks.length === 0) {
      showEmpty();
      return;
    }

    renderPicks(picks);
    window.toastSuccess && window.toastSuccess(`${picks.length} picks generados con IA`);

  } catch (err) {
    console.error('[Picks IA] Error fatal:', err);
    showError(err.message || 'Error desconocido al generar picks');
    window.toastError && window.toastError('Error generando picks');
  }
};

// Alias para compatibilidad
window.loadPicksIA = function () {
  const container = document.getElementById('picks-ia-container');
  if (container) window.initPicksIa(container);
};

console.log('✅ Picks IA Component v3.0 listo');
