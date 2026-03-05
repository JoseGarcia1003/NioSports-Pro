// components/picks-ia.js
// Sistema de Picks TOTALES NBA — NioSports Pro v3.0
// Diseñado para la estructura REAL de picks-engine.js
// Mercados: Q1 | Primera Mitad | Tiempo Completo
// ════════════════════════════════════════════════════════════════

console.log('🎯 Picks IA Totales v3.0 cargando...');

window.initPicksIa = async function (container) {
  if (!container) { console.error('[Picks IA] Contenedor no encontrado'); return; }

  // ── HELPERS ────────────────────────────────────────────────────
  const safe   = (v, fb = '—') => (v === undefined || v === null || v === '') ? fb : v;
  const safeNum = (v, fb = 0) => { const n = parseFloat(v); return isNaN(n) ? fb : n; };
  const fmt1   = (v) => safeNum(v).toFixed(1);

  // ── LOADING ────────────────────────────────────────────────────
  function showLoading() {
    container.innerHTML = `
      <div class="pts-loading">
        <div class="pts-loading-bar"><div class="pts-loading-fill"></div></div>
        <div class="pts-loading-label"><span class="pts-dot"></span>Analizando juegos con datos reales de TeamRankings.com...</div>
        <div class="pts-skel-grid">
          ${[0,1,2].map(() => `
            <div class="pts-skel-card">
              <div class="pts-skel-row" style="width:55%;height:18px;margin-bottom:8px"></div>
              <div class="pts-skel-row" style="width:35%;height:13px;margin-bottom:18px"></div>
              <div style="display:flex;gap:8px;margin-bottom:16px">
                <div class="pts-skel-row" style="width:22%;height:28px;margin:0"></div>
                <div class="pts-skel-row" style="width:22%;height:28px;margin:0"></div>
                <div class="pts-skel-row" style="width:22%;height:28px;margin:0"></div>
              </div>
              <div class="pts-skel-row" style="width:90%;height:58px;margin-bottom:14px"></div>
              <div class="pts-skel-row" style="width:80%;height:11px;margin-bottom:7px"></div>
              <div class="pts-skel-row" style="width:65%;height:11px;margin-bottom:7px"></div>
              <div class="pts-skel-row" style="width:73%;height:11px"></div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  function showError(msg) {
    container.innerHTML = `
      <div class="pts-state-box pts-error-box">
        <div class="pts-state-icon">❌</div>
        <h3 class="pts-state-title">Error cargando análisis</h3>
        <p class="pts-state-msg">${safe(msg, 'Error desconocido')}</p>
        <button class="pts-btn-primary" onclick="window.loadPicksIA()">🔄 Reintentar</button>
        <p class="pts-tips">💡 Verifica tu conexión · Recarga (Ctrl+R)</p>
      </div>`;
  }

  function showEmpty() {
    const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    container.innerHTML = `
      <div class="pts-state-box">
        <div class="pts-state-icon">📅</div>
        <h3 class="pts-state-title">No hay juegos programados hoy</h3>
        <p class="pts-state-date">${today}</p>
        <p class="pts-state-msg">La NBA programa juegos de forma variable. Vuelve mañana para nuevos análisis.</p>
        <button class="pts-btn-primary" onclick="window.loadPicksIA()">🔄 Actualizar</button>
      </div>`;
  }

  // ── RENDER PRINCIPAL ───────────────────────────────────────────
  function renderPicks(picks) {
    const highConf = picks.filter(p => safeNum(p.bestPick?.confidence) >= 75).length;
    const midConf  = picks.filter(p => { const c = safeNum(p.bestPick?.confidence); return c >= 65 && c < 75; }).length;
    const hasReal  = picks.filter(p => p.hasRealData).length;

    container.innerHTML = buildStyles() + `
      <div class="pts-wrapper">

        <!-- Context bar -->
        <div class="pts-context-bar">
          <div class="pts-ctx-left">
            <span class="pts-live-dot"></span>
            <span class="pts-ctx-label">ANÁLISIS EN TIEMPO REAL · TeamRankings.com</span>
          </div>
          <div class="pts-ctx-stats">
            <span><b>${picks.length}</b> juegos</span>
            <span class="pts-sep">·</span>
            <span class="pts-green"><b>${highConf}</b> alta confianza</span>
            <span class="pts-sep">·</span>
            <span class="pts-yellow"><b>${midConf}</b> media</span>
            <span class="pts-sep">·</span>
            <span class="pts-muted"><b>${hasReal}</b> con datos reales</span>
          </div>
        </div>

        <!-- Filtros mercado -->
        <div class="pts-market-filter">
          <button class="pts-mf active" data-m="best" onclick="window.__ptsFilter('best')">🏆 Mejor Pick</button>
          <button class="pts-mf" data-m="q1"   onclick="window.__ptsFilter('q1')">1️⃣ 1er Cuarto</button>
          <button class="pts-mf" data-m="half" onclick="window.__ptsFilter('half')">½ Primera Mitad</button>
          <button class="pts-mf" data-m="full" onclick="window.__ptsFilter('full')">🏀 Tiempo Completo</button>
        </div>

        <!-- Filtro confianza -->
        <div class="pts-conf-filter">
          <span class="pts-cf-lbl">Confianza mínima:</span>
          <button class="pts-cf active" data-min="0"  onclick="window.__ptsConfFilter(0)">Todos</button>
          <button class="pts-cf" data-min="65" onclick="window.__ptsConfFilter(65)">≥ 65%</button>
          <button class="pts-cf" data-min="70" onclick="window.__ptsConfFilter(70)">≥ 70%</button>
          <button class="pts-cf" data-min="75" onclick="window.__ptsConfFilter(75)">≥ 75%</button>
        </div>

        <!-- Grid -->
        <div class="pts-grid" id="pts-grid">
          ${picks.map((p, i) => buildCard(p, i)).join('')}
        </div>

        <!-- Disclaimer -->
        <div class="pts-disclaimer">
          <span>⚠️</span>
          <div>
            <p><b>Disclaimer:</b> Análisis generado con datos reales de TeamRankings.com + BallDontLie API. Los mercados de totales implican variabilidad inherente. Gestiona tu bankroll responsablemente.</p>
            <div class="pts-disc-meta">
              <span>⏱ ${new Date().toLocaleTimeString('es-ES')}</span>
              <span>·</span><span>📊 Fuente: TeamRankings.com</span>
              <span>·</span><span>🧠 3 mercados analizados por juego</span>
            </div>
          </div>
        </div>
      </div>`;

    window.__ptsCurrentMarket = 'best';
    window.__ptsCurrentMin    = 0;
    applyFilters();
  }

  // ── CARD ───────────────────────────────────────────────────────
  function buildCard(pick, idx) {
    const homeTeam = safe(pick.homeTeam, 'Local');
    const awayTeam = safe(pick.awayTeam, 'Visitante');
    const gameId   = safe(String(pick.gameId), `g-${idx}`);
    const dateStr  = pick.date
      ? new Date(pick.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
      : 'Hoy';
    const statusTxt = pick.status === 'Final' ? '✅ Finalizado' : '🟡 Programado';
    const conf      = safeNum(pick.bestPick?.confidence, 0);
    const cls       = conf >= 75 ? 'high' : conf >= 65 ? 'mid' : 'low';

    return `
      <div class="pts-card ${cls}"
           data-game-id="${gameId}"
           data-best-conf="${conf}"
           data-has-data="${pick.hasRealData ? 'true' : 'false'}"
           style="animation-delay:${idx * 0.07}s">

        ${!pick.hasRealData ? '<div class="pts-no-data-badge">⚠️ Sin datos reales</div>' : ''}

        <!-- HEADER -->
        <div class="pts-card-head">
          <div class="pts-teams">
            <div class="pts-team-away">
              <span class="pts-tname">${awayTeam}</span>
              <span class="pts-trole">✈ Visitante</span>
            </div>
            <div class="pts-at">@</div>
            <div class="pts-team-home">
              <span class="pts-tname">${homeTeam}</span>
              <span class="pts-trole">🏠 Local</span>
            </div>
          </div>
          <div class="pts-meta">${dateStr} · ${statusTxt}</div>
        </div>

        <!-- TABS -->
        <div class="pts-tabs" id="tabs-${gameId}">
          <button class="pts-tab active" data-tab="best" onclick="window.__switchTab('${gameId}','best')">🏆 Mejor</button>
          <button class="pts-tab" data-tab="q1"   onclick="window.__switchTab('${gameId}','q1')">Q1</button>
          <button class="pts-tab" data-tab="half" onclick="window.__switchTab('${gameId}','half')">1H</button>
          <button class="pts-tab" data-tab="full" onclick="window.__switchTab('${gameId}','full')">Full</button>
        </div>

        <!-- PANELS -->
        <div id="panels-${gameId}">
          ${buildPanel('best', pick.bestPick || {}, pick)}
          ${buildPanel('q1',   pick.markets?.q1   || {}, pick)}
          ${buildPanel('half', pick.markets?.half || {}, pick)}
          ${buildPanel('full', pick.markets?.full || {}, pick)}
        </div>

        <!-- STATS COMPARATIVA (togglable) -->
        ${pick.hasRealData ? buildStatsTable(pick) : ''}

        <!-- FOOTER -->
        <div class="pts-foot">
          <button class="pts-btn-track" data-tid="${gameId}"
                  onclick="window.addPickToTracking('${gameId}','${homeTeam}','${awayTeam}','${safe(pick.bestPick?.market,'?')}','${safe(pick.bestPick?.direction,'?')}')">
            📊 Trackear Pick
          </button>
          <button class="pts-btn-info" onclick="window.__ptsToggleStats('${gameId}')">
            📈 Comparar Stats
          </button>
        </div>
      </div>`;
  }

  // ── PANEL DE MERCADO ───────────────────────────────────────────
  function buildPanel(key, mkt, pick) {
    const isActive = key === 'best';
    const dir      = safe(mkt.direction, null);
    if (!dir) return `<div class="pts-panel${isActive ? ' active' : ''}" data-panel="${key}"><p class="pts-panel-empty">Sin datos para este mercado</p></div>`;

    const proj     = safeNum(mkt.projectedTotal, 0);
    const line     = safeNum(mkt.line, proj);
    const conf     = safeNum(mkt.confidence, 0);
    const label    = safe(mkt.marketLabel, key.toUpperCase());
    const diff     = proj - line;
    const isOver   = dir === 'OVER';
    const confCls  = conf >= 75 ? 'high' : conf >= 65 ? 'mid' : 'low';
    const confClr  = conf >= 75 ? '#10b981' : conf >= 65 ? '#f59e0b' : '#818cf8';
    const circum   = 2 * Math.PI * 26;
    const dashOff  = circum * (1 - conf / 100);
    const reasoning = Array.isArray(mkt.reasoning) ? mkt.reasoning : [];
    const factors   = mkt.factors || {};

    const homeShort = (pick.homeTeam || '').split(' ').slice(-1)[0];
    const awayShort = (pick.awayTeam || '').split(' ').slice(-1)[0];

    return `
      <div class="pts-panel${isActive ? ' active' : ''}" data-panel="${key}">

        <!-- Dirección + Confianza -->
        <div class="pts-ptop">
          <div class="pts-pleft">
            <span class="pts-mkt-badge">${label}</span>
            <div class="pts-dir ${isOver ? 'over' : 'under'}">
              <span class="pts-dir-arrow">${isOver ? '▲' : '▼'}</span>
              <span class="pts-dir-word">${dir}</span>
            </div>
            <span class="pts-dir-sub">Total proyectado</span>
          </div>
          <div class="pts-cring">
            <svg width="60" height="60" viewBox="0 0 60 60">
              <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="6"/>
              <circle cx="30" cy="30" r="26" fill="none"
                stroke="${confClr}" stroke-width="6" stroke-linecap="round"
                stroke-dasharray="${circum}" stroke-dashoffset="${dashOff}"
                transform="rotate(-90 30 30)"
                style="transition:stroke-dashoffset 1.2s cubic-bezier(.16,1,.3,1)"/>
            </svg>
            <div class="pts-cval"><span class="pts-cnum">${conf}</span><span class="pts-cpct">%</span></div>
          </div>
        </div>

        <!-- Totales -->
        <div class="pts-totals">
          <div class="pts-tbox">
            <span class="pts-tlbl">Proyección</span>
            <span class="pts-tnum">${fmt1(proj)}</span>
          </div>
          <div class="pts-tbox ${confCls}">
            <span class="pts-tlbl">Línea sugerida</span>
            <span class="pts-tnum">${fmt1(line)}</span>
          </div>
          <div class="pts-tbox">
            <span class="pts-tlbl">Diferencia</span>
            <span class="pts-tnum ${diff >= 0 ? 'pos' : 'neg'}">${diff >= 0 ? '+' : ''}${Math.abs(diff).toFixed(1)}</span>
          </div>
        </div>

        <!-- Barras de equipo -->
        ${mkt.homeExpected && mkt.awayExpected ? `
          <div class="pts-tproj">
            <div class="pts-tprow">
              <span class="pts-tpname">${homeShort}</span>
              <div class="pts-tpbar-wrap"><div class="pts-tpbar home" style="width:${Math.min(100,(safeNum(mkt.homeExpected)/Math.max(proj,1))*100)}%"></div></div>
              <span class="pts-tpval">${fmt1(mkt.homeExpected)}</span>
            </div>
            <div class="pts-tprow">
              <span class="pts-tpname">${awayShort}</span>
              <div class="pts-tpbar-wrap"><div class="pts-tpbar away" style="width:${Math.min(100,(safeNum(mkt.awayExpected)/Math.max(proj,1))*100)}%"></div></div>
              <span class="pts-tpval">${fmt1(mkt.awayExpected)}</span>
            </div>
          </div>
        ` : ''}

        <!-- Factores -->
        ${buildFactors(factors)}

        <!-- Reasoning -->
        ${reasoning.length ? `
          <div class="pts-rsn">
            <span class="pts-rsn-lbl">📋 Análisis del motor</span>
            <ul>${reasoning.map(r => `<li>${safe(r)}</li>`).join('')}</ul>
          </div>
        ` : ''}
      </div>`;
  }

  // ── FACTORES ──────────────────────────────────────────────────
  const FACTOR_META = {
    homeQ1Scored:    { lbl: 'Local anota Q1',      ref: 29.0, allowedType: false },
    homeQ1Allowed:   { lbl: 'Local permite Q1',    ref: 29.0, allowedType: true  },
    awayQ1Scored:    { lbl: 'Visit. anota Q1',     ref: 28.0, allowedType: false },
    awayQ1Allowed:   { lbl: 'Visit. permite Q1',   ref: 29.0, allowedType: true  },
    homeHalfScored:  { lbl: 'Local anota 1H',      ref: 59.0, allowedType: false },
    homeHalfAllowed: { lbl: 'Local permite 1H',    ref: 58.0, allowedType: true  },
    awayHalfScored:  { lbl: 'Visit. anota 1H',     ref: 57.0, allowedType: false },
    awayHalfAllowed: { lbl: 'Visit. permite 1H',   ref: 58.0, allowedType: true  },
    homeFullScored:  { lbl: 'Local anota TC',      ref: 115.0, allowedType: false },
    homeFullAllowed: { lbl: 'Local permite TC',    ref: 115.0, allowedType: true  },
    awayFullScored:  { lbl: 'Visit. anota TC',     ref: 113.0, allowedType: false },
    awayFullAllowed: { lbl: 'Visit. permite TC',   ref: 115.0, allowedType: true  },
    combinedPace:    { lbl: 'Ritmo combinado',     ref: 103.7, allowedType: false },
    paceVsLeague:    { lbl: 'Ritmo vs liga',       ref: 0,     allowedType: false },
  };

  function buildFactors(factors) {
    const entries = Object.entries(factors).filter(([k]) => FACTOR_META[k]);
    if (!entries.length) return '';

    return `
      <div class="pts-factors">
        <span class="pts-flbl-hdr">Factores del análisis</span>
        ${entries.map(([k, v]) => {
          const m    = FACTOR_META[k];
          const num  = safeNum(v, 0);
          const ref  = m.ref;
          const pct  = k === 'paceVsLeague'
            ? Math.min(100, Math.max(0, 50 + num * 10))
            : Math.min(100, Math.max(0, (num / (ref * 1.3)) * 100));
          const hi   = num >= ref;
          return `
            <div class="pts-frow">
              <span class="pts-flbl">${m.lbl}</span>
              <div class="pts-fbar"><div class="pts-ffill ${hi ? 'hi' : 'lo'}" style="width:${pct}%"></div></div>
              <span class="pts-fval">${fmt1(num)}</span>
            </div>`;
        }).join('')}
      </div>`;
  }

  // ── STATS TABLE ────────────────────────────────────────────────
  function buildStatsTable(pick) {
    const h = pick.homeStats || {};
    const a = pick.awayStats || {};
    const hn = (pick.homeTeam || '').split(' ').slice(-1)[0];
    const an = (pick.awayTeam || '').split(' ').slice(-1)[0];
    const rows = [
      { lbl:'Q1 (local/visit.)',     hv:h.q1Home,   av:a.q1Away,   hr:h.q1HomeRank,   ar:a.q1AwayRank,   hi:true  },
      { lbl:'Permite Q1',            hv:h.oppQ1,    av:a.oppQ1,    hr:h.oppQ1Rank,    ar:a.oppQ1Rank,    hi:false },
      { lbl:'1H (local/visit.)',     hv:h.halfHome, av:a.halfAway, hr:h.halfHomeRank, ar:a.halfAwayRank, hi:true  },
      { lbl:'PPG Tiempo completo',   hv:h.full,     av:a.full,     hr:h.fullRank,     ar:a.fullRank,     hi:true  },
      { lbl:'DEF — PPG permitido',   hv:h.oppPpg,   av:a.oppPpg,   hr:h.oppPpgRank,   ar:a.oppPpgRank,   hi:false },
      { lbl:'Ritmo (poss/game)',     hv:h.pace,     av:a.pace,     hr:h.paceRank,     ar:a.paceRank,     hi:true  },
    ];

    return `
      <div class="pts-stbl" id="stats-${pick.gameId}" style="display:none">
        <div class="pts-stbl-head">
          <span>${an}</span><span>Estadística</span><span>${hn}</span>
        </div>
        ${rows.map(r => {
          const hNum = safeNum(r.hv, 0), aNum = safeNum(r.av, 0);
          const hW   = r.hi ? hNum >= aNum : hNum <= aNum;
          return `
            <div class="pts-stbl-row">
              <span class="${hW ? '' : 'win'}">${fmt1(aNum)} <sub>#${r.ar||'?'}</sub></span>
              <span class="lbl">${r.lbl}</span>
              <span class="${hW ? 'win' : ''}">${fmt1(hNum)} <sub>#${r.hr||'?'}</sub></span>
            </div>`;
        }).join('')}
      </div>`;
  }

  // ── CONTROLES ─────────────────────────────────────────────────
  window.__switchTab = function (gid, tab) {
    document.getElementById(`tabs-${gid}`)?.querySelectorAll('.pts-tab')
      .forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById(`panels-${gid}`)?.querySelectorAll('.pts-panel')
      .forEach(p => p.classList.toggle('active', p.dataset.panel === tab));
  };

  window.__ptsToggleStats = function (gid) {
    const el = document.getElementById(`stats-${gid}`);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
  };

  window.__ptsFilter = function (m) {
    window.__ptsCurrentMarket = m;
    applyFilters();
    document.querySelectorAll('.pts-mf').forEach(b => b.classList.toggle('active', b.dataset.m === m));
  };

  window.__ptsConfFilter = function (min) {
    window.__ptsCurrentMin = min;
    applyFilters();
    document.querySelectorAll('.pts-cf').forEach(b => b.classList.toggle('active', parseInt(b.dataset.min) === min));
  };

  function applyFilters() {
    const market = window.__ptsCurrentMarket || 'best';
    const minC   = window.__ptsCurrentMin   || 0;
    document.getElementById('pts-grid')?.querySelectorAll('.pts-card').forEach(card => {
      const conf = parseInt(card.dataset.bestConf) || 0;
      const show = conf >= minC;
      card.style.display = show ? '' : 'none';
      if (show) window.__switchTab(card.dataset.gameId, market === 'best' ? 'best' : market);
    });
  }

  // ── TRACKING ──────────────────────────────────────────────────
  window.addPickToTracking = async function (gameId, home, away, market, dir) {
    if (!window.currentUser) {
      window.toastError?.('Inicia sesión para trackear picks');
      return;
    }
    try {
      await window.database
        .ref(`users/${window.currentUser.uid}/picks/${gameId}`)
        .set({ gameId, homeTeam: home, awayTeam: away, market, direction: dir, timestamp: Date.now(), status: 'pending' });
      window.toastSuccess?.(`✅ Trackeado: ${dir} ${market} — ${home} vs ${away}`);
      const btn = document.querySelector(`.pts-btn-track[data-tid="${gameId}"]`);
      if (btn) { btn.disabled = true; btn.textContent = '✅ Trackeado'; }
    } catch (err) {
      console.error('[Picks IA] Tracking error:', err);
      window.toastError?.('Error al trackear pick');
    }
  };

  // ── ESTILOS ────────────────────────────────────────────────────
  function buildStyles() {
    return `<style>
/* ═══════════════════════════════════════════════════════
   NIOSPORTS PICKS IA TOTALES v3.0
   ═══════════════════════════════════════════════════════ */

/* Loading */
.pts-loading { padding:8px 0 }
.pts-loading-bar { height:3px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;margin-bottom:14px }
.pts-loading-fill { height:100%;width:35%;background:linear-gradient(90deg,#fbbf24,#f59e0b);animation:ptsScan 1.8s ease-in-out infinite }
@keyframes ptsScan { 0%{transform:translateX(-200%)} 100%{transform:translateX(500%)} }
.pts-loading-label { display:flex;align-items:center;gap:8px;color:rgba(255,255,255,0.45);font-size:13px;margin-bottom:20px }
.pts-dot { width:8px;height:8px;border-radius:50%;background:#fbbf24;flex-shrink:0;animation:ptsPulse 1.2s ease-in-out infinite }
@keyframes ptsPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.3;transform:scale(0.55)} }
.pts-skel-grid { display:grid;gap:16px }
@media(min-width:900px){.pts-skel-grid{grid-template-columns:1fr 1fr}}
.pts-skel-card { background:rgba(255,255,255,0.03);border-radius:18px;padding:20px;border:1px solid rgba(255,255,255,0.06) }
.pts-skel-row { background:linear-gradient(90deg,rgba(255,255,255,0.05) 25%,rgba(255,255,255,0.1) 50%,rgba(255,255,255,0.05) 75%);background-size:400%;border-radius:7px;animation:ptsShim 1.8s linear infinite;margin-bottom:0 }
@keyframes ptsShim { 0%{background-position:200%} 100%{background-position:-200%} }

/* State boxes */
.pts-state-box { text-align:center;padding:60px 24px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:22px }
.pts-error-box { border-color:rgba(239,68,68,0.2);background:rgba(239,68,68,0.04) }
.pts-state-icon { font-size:52px;margin-bottom:14px }
.pts-state-title { font-size:21px;font-weight:800;color:#e2e8f0;margin-bottom:10px }
.pts-state-date { color:#fbbf24;font-weight:700;margin-bottom:8px }
.pts-state-msg { color:rgba(255,255,255,0.45);font-size:14px;line-height:1.7;margin-bottom:22px }
.pts-btn-primary { background:#fbbf24;color:#000;border:none;padding:12px 30px;border-radius:13px;font-weight:800;font-size:14px;cursor:pointer;transition:all .2s }
.pts-btn-primary:hover { background:#f59e0b;transform:translateY(-2px) }
.pts-tips { margin-top:16px;color:rgba(255,255,255,0.3);font-size:12px }

/* Wrapper */
.pts-wrapper { font-family:'DM Sans',sans-serif }

/* Context bar */
.pts-context-bar { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding-bottom:18px;border-bottom:1px solid rgba(255,255,255,0.07);margin-bottom:20px }
.pts-ctx-left { display:flex;align-items:center;gap:8px }
.pts-live-dot { width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 8px rgba(16,185,129,0.7);animation:ptsPulse 2s infinite }
.pts-ctx-label { font-size:10px;font-weight:800;letter-spacing:1.8px;color:rgba(255,255,255,0.35);text-transform:uppercase }
.pts-ctx-stats { display:flex;align-items:center;gap:7px;font-size:12px;color:rgba(255,255,255,0.4) }
.pts-ctx-stats b { color:#e2e8f0 }
.pts-green b { color:#10b981 }
.pts-yellow b { color:#f59e0b }
.pts-muted  b { color:rgba(255,255,255,0.35) }
.pts-sep { opacity:.3 }

/* Market filter */
.pts-market-filter { display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px }
.pts-mf { padding:9px 18px;border-radius:20px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:rgba(255,255,255,0.5);font-size:13px;font-weight:700;cursor:pointer;transition:all .2s }
.pts-mf:hover { border-color:rgba(251,191,36,0.5);color:#fbbf24 }
.pts-mf.active { background:rgba(251,191,36,0.14);border-color:#fbbf24;color:#fbbf24;box-shadow:0 0 14px rgba(251,191,36,0.18) }

/* Confidence filter */
.pts-conf-filter { display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:26px }
.pts-cf-lbl { font-size:11px;color:rgba(255,255,255,0.3);font-weight:600 }
.pts-cf { padding:5px 13px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:rgba(255,255,255,0.35);font-size:12px;font-weight:700;cursor:pointer;transition:all .2s }
.pts-cf.active { background:rgba(255,255,255,0.09);border-color:rgba(255,255,255,0.28);color:#e2e8f0 }

/* Grid */
.pts-grid { display:grid;gap:20px }
@media(min-width:860px){ .pts-grid{grid-template-columns:1fr 1fr} }
@media(min-width:1280px){ .pts-grid{grid-template-columns:1fr 1fr 1fr} }

/* Card */
.pts-card {
  background:rgba(7,17,33,0.92);
  border:1px solid rgba(255,255,255,0.07);
  border-radius:22px;overflow:hidden;
  position:relative;
  transition:transform .25s,box-shadow .25s;
  animation:ptsFadeUp .45s ease-out both;
}
@keyframes ptsFadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
.pts-card:hover { transform:translateY(-4px);box-shadow:0 22px 55px rgba(0,0,0,.6) }
.pts-card::before { content:'';position:absolute;top:0;left:0;right:0;height:3px }
.pts-card.high::before { background:linear-gradient(90deg,#10b981,#34d399);box-shadow:0 0 10px rgba(16,185,129,.55) }
.pts-card.mid::before  { background:linear-gradient(90deg,#f59e0b,#fbbf24);box-shadow:0 0 10px rgba(245,158,11,.45) }
.pts-card.low::before  { background:linear-gradient(90deg,#6366f1,#818cf8) }
.pts-no-data-badge { position:absolute;top:13px;right:13px;background:rgba(245,158,11,.13);border:1px solid rgba(245,158,11,.3);color:#f59e0b;font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px }

/* Card head */
.pts-card-head { padding:18px 18px 0 }
.pts-teams { display:flex;align-items:center;gap:6px;margin-bottom:5px }
.pts-team-away,.pts-team-home { flex:1 }
.pts-tname { display:block;font-size:14px;font-weight:800;color:#f1f5f9;line-height:1.2 }
.pts-trole { display:block;font-size:10px;color:rgba(255,255,255,0.28);font-weight:600;margin-top:2px }
.pts-team-home .pts-tname { text-align:right }
.pts-team-home .pts-trole { text-align:right }
.pts-at { font-size:12px;font-weight:900;color:rgba(255,255,255,0.2);padding:0 4px;flex-shrink:0 }
.pts-meta { font-size:11px;color:rgba(255,255,255,0.28);padding:5px 0 14px;border-bottom:1px solid rgba(255,255,255,0.06) }

/* Tabs */
.pts-tabs { display:flex;padding:10px 14px 0;gap:2px;border-bottom:1px solid rgba(255,255,255,0.06) }
.pts-tab { flex:1;padding:8px 4px;border:none;background:transparent;color:rgba(255,255,255,0.3);font-size:11px;font-weight:800;cursor:pointer;border-bottom:2px solid transparent;transition:all .2s;letter-spacing:.3px }
.pts-tab:hover { color:rgba(255,255,255,0.65) }
.pts-tab.active { color:#fbbf24;border-bottom-color:#fbbf24 }

/* Panels */
.pts-panel { display:none;padding:16px 18px }
.pts-panel.active { display:block }
.pts-panel-empty { text-align:center;padding:28px;color:rgba(255,255,255,0.28);font-size:13px }

/* Panel top */
.pts-ptop { display:flex;align-items:flex-start;gap:10px;margin-bottom:14px }
.pts-pleft { flex:1 }
.pts-mkt-badge { display:inline-block;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:9px;padding:4px 9px;font-size:10px;font-weight:800;color:rgba(255,255,255,0.5);letter-spacing:.5px;margin-bottom:6px }
.pts-dir { display:flex;align-items:baseline;gap:2px;line-height:1 }
.pts-dir-arrow { font-size:18px }
.pts-dir-word { font-size:26px;font-weight:900;letter-spacing:.5px }
.pts-dir.over .pts-dir-arrow,.pts-dir.over .pts-dir-word { color:#10b981 }
.pts-dir.under .pts-dir-arrow,.pts-dir.under .pts-dir-word { color:#818cf8 }
.pts-dir-sub { display:block;font-size:9px;color:rgba(255,255,255,0.28);text-transform:uppercase;letter-spacing:.5px;margin-top:3px }
.pts-cring { position:relative;width:60px;height:60px;flex-shrink:0 }
.pts-cval { position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center }
.pts-cnum { font-size:17px;font-weight:900;color:#fff;line-height:1 }
.pts-cpct { font-size:10px;color:rgba(255,255,255,0.35) }

/* Totals */
.pts-totals { display:flex;gap:7px;margin-bottom:13px }
.pts-tbox { flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:10px 6px;text-align:center }
.pts-tbox.high { border-color:rgba(16,185,129,.3);background:rgba(16,185,129,.06) }
.pts-tbox.mid  { border-color:rgba(245,158,11,.3);background:rgba(245,158,11,.06) }
.pts-tbox.low  { border-color:rgba(129,140,248,.3);background:rgba(129,140,248,.06) }
.pts-tlbl { display:block;font-size:9px;color:rgba(255,255,255,0.33);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px }
.pts-tnum { font-size:17px;font-weight:800;color:#f1f5f9;font-family:'JetBrains Mono',monospace }
.pts-tnum.pos { color:#10b981 }
.pts-tnum.neg { color:#818cf8 }

/* Team projection */
.pts-tproj { margin-bottom:13px;display:flex;flex-direction:column;gap:7px }
.pts-tprow { display:flex;align-items:center;gap:7px }
.pts-tpname { font-size:11px;font-weight:700;color:rgba(255,255,255,0.42);width:48px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap }
.pts-tpbar-wrap { flex:1;height:5px;background:rgba(255,255,255,0.07);border-radius:5px;overflow:hidden }
.pts-tpbar { height:100%;border-radius:5px;transition:width 1.1s cubic-bezier(.16,1,.3,1) }
.pts-tpbar.home { background:linear-gradient(90deg,#fbbf24,#f59e0b) }
.pts-tpbar.away { background:linear-gradient(90deg,#818cf8,#6366f1) }
.pts-tpval { font-size:11px;font-weight:700;color:#e2e8f0;font-family:'JetBrains Mono',monospace;width:30px;text-align:right }

/* Factors */
.pts-factors { margin-bottom:13px }
.pts-flbl-hdr { font-size:9px;font-weight:800;letter-spacing:1.2px;color:rgba(255,255,255,0.28);text-transform:uppercase;display:block;margin-bottom:8px }
.pts-frow { display:flex;align-items:center;gap:7px;margin-bottom:5px }
.pts-flbl { font-size:11px;color:rgba(255,255,255,0.4);width:110px;flex-shrink:0 }
.pts-fbar { flex:1;height:4px;background:rgba(255,255,255,0.07);border-radius:4px;overflow:hidden }
.pts-ffill { height:100%;border-radius:4px;transition:width 1s cubic-bezier(.16,1,.3,1) }
.pts-ffill.hi { background:linear-gradient(90deg,#10b981,#34d399) }
.pts-ffill.lo { background:linear-gradient(90deg,#818cf8,#6366f1) }
.pts-fval { font-size:11px;font-weight:700;color:#e2e8f0;font-family:'JetBrains Mono',monospace;min-width:34px;text-align:right }

/* Reasoning */
.pts-rsn { background:rgba(255,255,255,0.03);border-radius:11px;padding:11px;margin-bottom:4px }
.pts-rsn-lbl { font-size:9px;font-weight:800;letter-spacing:1px;color:rgba(255,255,255,0.28);text-transform:uppercase;display:block;margin-bottom:7px }
.pts-rsn ul { list-style:none;margin:0;padding:0 }
.pts-rsn li { font-size:12px;color:rgba(255,255,255,0.55);padding:5px 0 5px 15px;position:relative;line-height:1.5;border-bottom:1px solid rgba(255,255,255,0.04) }
.pts-rsn li:last-child { border-bottom:none }
.pts-rsn li::before { content:'›';position:absolute;left:3px;color:#fbbf24;font-weight:900 }

/* Stats table */
.pts-stbl { border-top:1px solid rgba(255,255,255,0.06);padding:14px 18px }
.pts-stbl-head,.pts-stbl-row { display:grid;grid-template-columns:1fr 1.3fr 1fr;gap:8px;text-align:center;padding:5px 0 }
.pts-stbl-head { font-size:11px;font-weight:800;color:rgba(255,255,255,0.4) }
.pts-stbl-row { font-size:12px;font-weight:700;color:rgba(255,255,255,0.45);border-bottom:1px solid rgba(255,255,255,0.04) }
.pts-stbl-row:last-child { border-bottom:none }
.pts-stbl-row .lbl { font-size:11px;color:rgba(255,255,255,0.28);font-weight:400 }
.pts-stbl-row .win { color:#fbbf24 }
.pts-stbl-row sub { font-size:9px;color:rgba(255,255,255,0.25) }

/* Footer */
.pts-foot { display:flex;gap:7px;padding:0 18px 16px }
.pts-btn-track,.pts-btn-info { flex:1;padding:10px 8px;border-radius:11px;border:none;font-size:12px;font-weight:700;cursor:pointer;transition:all .2s }
.pts-btn-track { background:rgba(251,191,36,.11);color:#fbbf24;border:1px solid rgba(251,191,36,.2) }
.pts-btn-track:hover { background:rgba(251,191,36,.22) }
.pts-btn-track:disabled { opacity:.55;cursor:not-allowed }
.pts-btn-info { background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.55);border:1px solid rgba(255,255,255,0.09) }
.pts-btn-info:hover { background:rgba(255,255,255,0.1) }

/* Disclaimer */
.pts-disclaimer { display:flex;gap:13px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.14);border-radius:16px;padding:16px 18px;margin-top:30px;align-items:flex-start;font-size:20px;flex-shrink:0 }
.pts-disclaimer>div { flex:1 }
.pts-disclaimer p { font-size:12px;color:rgba(255,255,255,0.4);line-height:1.7;margin:0 0 7px }
.pts-disclaimer b { color:rgba(255,255,255,0.6) }
.pts-disc-meta { display:flex;gap:8px;flex-wrap:wrap;font-size:11px;color:rgba(255,255,255,0.28) }

@media(max-width:600px){
  .pts-totals { flex-direction:column }
  .pts-ptop { flex-wrap:wrap }
  .pts-context-bar { flex-direction:column;align-items:flex-start }
}
</style>`;
  }

  // ── MAIN ───────────────────────────────────────────────────────
  try {
    showLoading();

    if (!window.picksEngine) {
      showError('Motor de análisis no inicializado. Recarga la página.');
      return;
    }

    const picks = await window.picksEngine.generateTodayPicks();

    if (!Array.isArray(picks) || !picks.length) { showEmpty(); return; }

    const valid = picks.filter(p => p && p.bestPick && p.homeTeam && p.awayTeam);
    if (!valid.length) { showEmpty(); return; }

    renderPicks(valid);
    window.toastSuccess?.(`${valid.length} juegos analizados — Q1, 1H y Full`);

  } catch (err) {
    console.error('[Picks IA] Error:', err);
    showError(err.message || 'Error generando análisis');
    window.toastError?.('Error en motor de análisis');
  }
};

// Alias de compatibilidad
window.loadPicksIA = () => {
  const c = document.getElementById('picks-ia-container');
  if (c) window.initPicksIa(c);
};

console.log('✅ Picks IA Totales v3.0 listo');
