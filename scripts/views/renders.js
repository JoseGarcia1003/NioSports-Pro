// ═══════════════════════════════════════════════════════════════
// NioSports Pro v4.0 - VIEWS MODULE
// Todas las funciones de renderizado de vistas
// ═══════════════════════════════════════════════════════════════

(function(window) {
    "use strict";
    const logger = window.NioLogger || console;

function render() {
    // 🛡️ INICIO DEL ESCUDO DE SEGURIDAD 🛡️
    let activeView = window.currentView || currentView || 'home';

    // Limpieza de huérfanos: Si quedó un rastro de 'props' en la caché, redirigir al inicio
    if (activeView === 'props') {
        activeView = 'home';
        window.currentView = 'home';
        currentView = 'home';
    }

    // Sincronizamos la variable global con la vista validada
    currentView = activeView;
    // 🛡️ FIN DEL ESCUDO DE SEGURIDAD 🛡️

    const app = document.getElementById('app');
    if (!app) {
        console.error('[render] Elemento #app no encontrado');
        return;
    }
    
    try {
        // Rutas de la aplicación con manejo de errores
        if (currentView === 'home') app.innerHTML = renderHome();
        else if (currentView === 'aipicks') app.innerHTML = renderAIPicks();
        else if (currentView === 'backtesting') app.innerHTML = renderBacktesting();
        else if (currentView === 'tendencia' || currentView === 'totales') app.innerHTML = renderTendencia();
        else if (currentView === 'ingesta') app.innerHTML = renderIngesta();
        else if (currentView === 'picks') app.innerHTML = renderPicks();
        else if (currentView === 'mispicks') app.innerHTML = renderMisPicks();
        else if (currentView === 'bestPicks') app.innerHTML = renderBestPicks();
        else if (currentView === 'dashboard') app.innerHTML = renderDashboard();
        else if (currentView === 'bankroll') {
            app.innerHTML = renderBankrollView();
            setTimeout(() => createBankrollChart(), 100);
        }
        else {
            // Fallback para vistas desconocidas
            app.innerHTML = renderHome();
        }
        
        attachEvents();

        // Inicializar gráficos si estamos en dashboard
        if (currentView === 'dashboard') {
            setTimeout(() => initDashboardCharts(), 100);
        }
    } catch (error) {
        console.error('[render] Error renderizando vista:', error);
        app.innerHTML = `
            <div class="nio-section" style="max-width: 600px; text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 24px;">⚠️</div>
                <h2 style="color: #fff; font-size: 24px; margin-bottom: 12px;">Error de Carga</h2>
                <p style="color: rgba(255,255,255,0.6); margin-bottom: 24px;">Hubo un problema al cargar la vista. Por favor recarga la página.</p>
                <button onclick="location.reload()" class="nio-btn nio-btn-gold" style="padding: 12px 32px;">
                    Recargar Página
                </button>
            </div>
        `;
    }
}

// ═══════════════════════════════════════════════════════════════════
// 🎨 RENDERS DE NUEVAS VISTAS
// ═══════════════════════════════════════════════════════════════════

function renderAIPicks() {
    return `
        <div class="max-w-7xl mx-auto px-4 py-8">
            <div class="flex items-center justify-between mb-8">
                <div>
                    <h1 class="text-4xl font-bold text-white mb-2" style="font-family: var(--font-display);">
                        🤖 AI Picks del Día
                    </h1>
                    <p class="text-gray-400">Mejores oportunidades detectadas automáticamente por el módulo IA</p>
                </div>
                <div class="flex gap-3">
                    <button onclick="window.loadPicksIA()" class="btn-secondary">
                        🔄 Regenerar
                    </button>
                </div>
            </div>
            <div id="picks-ia-container">
                <div class="flex items-center justify-center p-12 text-gray-500">
                    <div class="spinner mr-3"></div> Cargando módulo de Inteligencia Artificial...
                </div>
            </div>
        </div>
    `;
}

function addAIPickToTracking(pickId) {
    const pick = AI_PICKS_TODAY.find(p => p.id === pickId);
    if (!pick) return;

    const userPickId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    database.ref(`users/${userId}/picks_ai/${userPickId}`).set({
        ...pick,
        id: userPickId,
        status: 'pending',
        addedAt: new Date().toISOString()
    }).then(() => {
        showNotification('success', 'Pick Agregado', 'Añadido a tus picks');
    });
}

// ═══════════════════════════════════════════════════════════════════
// MÓDULO: BANKROLL
// ═══════════════════════════════════════════════════════════════════

function renderBacktesting() {
    // Guard clause para datos de usuario
    const backtestData = (typeof USER_PICKS_BACKTESTING !== 'undefined') ? USER_PICKS_BACKTESTING : {};
    const picks = Object.values(backtestData);
    const resolved = picks.filter(p => p.status !== 'pending');
    const pending = picks.filter(p => p.status === 'pending');

    const wins = resolved.filter(p => p.status === 'win').length;
    const losses = resolved.filter(p => p.status === 'loss').length;
    const pushes = resolved.filter(p => p.status === 'push').length;
    const winRate = (wins + losses) > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0.0';

    return `
        <div class="nio-section">
            <button onclick="navigateTo('home')" aria-label="Ir al inicio" class="nio-back">
                ← Volver al Home
            </button>
            
            <div class="nio-header">
                <div class="nio-header-icon">📊</div>
                <div class="nio-header-content">
                    <h1 class="nio-header-title">Backtesting</h1>
                    <p class="nio-header-subtitle">Sistema de calibración y validación del modelo</p>
                </div>
            </div>
            
            ${resolved.length > 0 ? `
                <!-- Stats -->
                <div class="nio-grid nio-grid-4 nio-stagger" style="margin-bottom: 32px; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));">
                    <div class="nio-stat">
                        <span class="nio-stat-icon">📋</span>
                        <div class="nio-stat-value" style="color: #fff;">${resolved.length}</div>
                        <div class="nio-stat-label">Total</div>
                    </div>
                    <div class="nio-stat">
                        <span class="nio-stat-icon">✅</span>
                        <div class="nio-stat-value text-emerald">${wins}</div>
                        <div class="nio-stat-label">Wins</div>
                    </div>
                    <div class="nio-stat">
                        <span class="nio-stat-icon">❌</span>
                        <div class="nio-stat-value text-rose">${losses}</div>
                        <div class="nio-stat-label">Losses</div>
                    </div>
                    <div class="nio-stat">
                        <span class="nio-stat-icon">🎯</span>
                        <div class="nio-stat-value text-gold">${winRate}%</div>
                        <div class="nio-stat-label">Win Rate</div>
                    </div>
                    <div class="nio-stat">
                        <span class="nio-stat-icon">↔️</span>
                        <div class="nio-stat-value text-cyan">${pushes}</div>
                        <div class="nio-stat-label">Pushes</div>
                    </div>
                </div>
            ` : ''}
            
            <!-- Lists -->
            <div class="nio-grid nio-grid-2">
                <!-- Pending -->
                <div class="nio-card">
                    <h3 style="font-family: var(--font-display); font-size: 20px; font-weight: 800; color: #fff; margin-bottom: 20px;">⏳ Pendientes (${pending.length})</h3>
                    <div style="display: flex; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto;">
                        ${pending.length === 0 ? `
                            <div class="nio-empty" style="padding: 32px 0;">
                                <span class="nio-empty-icon" style="font-size: 40px;">📭</span>
                                <p class="nio-empty-desc">No hay picks pendientes</p>
                            </div>
                        ` : pending.map(p => `
                            <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 16px; border: 1px solid rgba(255,255,255,0.05);">
                                <div style="font-weight: 700; color: #fff; margin-bottom: 8px;">
                                    ${p.local} vs ${p.away} <span class="nio-chip">${p.period}</span>
                                </div>
                                <div style="font-size: 13px; color: rgba(255,255,255,0.45); margin-bottom: 12px;">
                                    ${p.betType} ${p.line} • Trend: ${p.trend}
                                </div>
                                <div style="display: flex; gap: 8px;">
                                    <input type="number" step="0.5" placeholder="Resultado" 
                                           class="input-field" style="flex: 1; padding: 8px 12px; font-size: 14px;" id="bt_${p.id}">
                                    <button onclick="resolveBacktestPick('${p.id}')" 
                                            class="nio-btn nio-btn-gold nio-btn-sm">✓</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Resolved -->
                <div class="nio-card">
                    <h3 style="font-family: var(--font-display); font-size: 20px; font-weight: 800; color: #fff; margin-bottom: 20px;">✅ Resueltos (${resolved.length})</h3>
                    <div style="display: flex; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto;">
                        ${resolved.length === 0 ? `
                            <div class="nio-empty" style="padding: 32px 0;">
                                <span class="nio-empty-icon" style="font-size: 40px;">📊</span>
                                <p class="nio-empty-desc">No hay picks resueltos</p>
                            </div>
                        ` : resolved.slice(0, 10).map(p => `
                            <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 16px; border: 1px solid rgba(255,255,255,0.05);">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                                    <div style="font-weight: 700; color: #fff;">
                                        ${p.local} vs ${p.away}
                                    </div>
                                    ${p.status === 'win' ? '<span class="win-badge">WIN</span>' :
            p.status === 'loss' ? '<span class="loss-badge">LOSS</span>' :
                '<span class="push-badge">PUSH</span>'}
                                </div>
                                <div style="font-size: 13px; color: rgba(255,255,255,0.45);">
                                    ${p.betType} ${p.line} • Real: ${p.actualResult}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function resolveBacktestPick(pickId) {
    const input = document.getElementById(`bt_${pickId}`);
    if (!input) return;

    const result = parseFloat(input.value);
    if (isNaN(result)) {
        showNotification('error', 'Error', 'Resultado inválido');
        return;
    }

    database.ref(`users/${userId}/picks_backtesting/${pickId}`).once('value').then(snapshot => {
        const pick = snapshot.val();
        if (!pick) return;

        const line = parseFloat(pick.line);
        let status = 'pending';

        if (result === line) status = 'push';
        else if (pick.betType === 'OVER') status = result > line ? 'win' : 'loss';
        else status = result < line ? 'win' : 'loss';

        database.ref(`users/${userId}/picks_backtesting/${pickId}`).update({
            status, actualResult: result, resolvedAt: new Date().toISOString()
        }).then(() => {
            showNotification('success', 'Actualizado', status.toUpperCase());
            render();
        });
    });
}

// ═══════════════════════════════════════════════════════════════════
// MÓDULO: PROFILE
// ═══════════════════════════════════════════════════════════════════

function renderHome() {
    // 🛡️ GUARD CLAUSE: Prevenir errores si no hay usuario autenticado
    if (!currentUser || !userId) {
        return `
            <div class="nio-section" style="max-width: 600px; text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 24px;">🔐</div>
                <h2 style="color: #fff; font-size: 24px; margin-bottom: 12px;">Sesión Requerida</h2>
                <p style="color: rgba(255,255,255,0.6); margin-bottom: 24px;">Inicia sesión para acceder a tu centro de comando NBA</p>
                <button onclick="showLogin()" class="nio-btn nio-btn-gold" style="padding: 12px 32px;">
                    Iniciar Sesión
                </button>
            </div>
        `;
    }

    // 🛡️ Asegurar que las variables existan con valores por defecto
    const picksTotal = (typeof USER_PICKS_TOTALES !== 'undefined') ? USER_PICKS_TOTALES : {};
    const picksAI = (typeof USER_PICKS_AI !== 'undefined') ? USER_PICKS_AI : {};
    const picksBacktest = (typeof USER_PICKS_BACKTESTING !== 'undefined') ? USER_PICKS_BACKTESTING : {};
    
    const totalPicks = Object.keys({ ...picksTotal, ...picksAI }).length;
    const bankroll = (USER_BANKROLL && USER_BANKROLL.current) || 0;
    const initial = (USER_BANKROLL && USER_BANKROLL.initial) || 0;
    const profit = bankroll - initial;
    const profitPercent = initial > 0 ? ((profit / initial) * 100).toFixed(1) : '0.0';

    // Stats de picks
    const allPicks = [...Object.values(picksTotal), ...Object.values(picksAI), ...Object.values(picksBacktest)];
    const resolved = allPicks.filter(p => p.status && p.status !== 'pending');
    const wins = resolved.filter(p => p.status === 'win').length;
    const losses = resolved.filter(p => p.status === 'loss').length;
    const winRate = (wins + losses) > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0.0';

    return `
        <div class="nio-section" style="max-width: 1280px;">
            <!-- Welcome Header -->
            <div class="nio-header" style="margin-bottom: 36px;">
                <div class="nio-header-icon" style="font-size: 52px;">🏀</div>
                <div class="nio-header-content">
                    <h1 class="nio-header-title" style="font-size: clamp(28px, 5vw, 44px);">¡Bienvenido de vuelta!</h1>
                    <p class="nio-header-subtitle" style="font-size: 16px; margin-top: 6px;">Tu centro de comando NBA profesional</p>
                </div>
            </div>
            
            <!-- Stats Cards -->
            <div class="nio-grid nio-grid-4 nio-stagger stats-grid-mobile" style="margin-bottom: 36px;">
                <div class="nio-stat">
                    <span class="nio-stat-icon">💰</span>
                    <div class="nio-stat-value text-gold">$${bankroll.toFixed(2)}</div>
                    <div class="nio-stat-label">Bankroll</div>
                    <div style="font-size: 13px; margin-top: 6px;" class="${profit >= 0 ? 'text-emerald' : 'text-rose'}">
                        ${profit >= 0 ? '+' : ''}$${profit.toFixed(2)} (${profitPercent}%)
                    </div>
                </div>
                
                <div class="nio-stat">
                    <span class="nio-stat-icon">📊</span>
                    <div class="nio-stat-value" style="color: #fff;">${totalPicks}</div>
                    <div class="nio-stat-label">Picks Activos</div>
                    <div style="font-size: 12px; margin-top: 6px; color: rgba(255,255,255,0.35);">En seguimiento</div>
                </div>
                
                <div class="nio-stat">
                    <span class="nio-stat-icon">🎯</span>
                    <div class="nio-stat-value text-cyan">${winRate}%</div>
                    <div class="nio-stat-label">Win Rate</div>
                    <div style="font-size: 12px; margin-top: 6px; color: rgba(255,255,255,0.35);">${wins}W - ${losses}L</div>
                </div>
                
                <div class="nio-stat">
                    <span class="nio-stat-icon">📈</span>
                    <div class="nio-stat-value text-violet">${resolved.length}</div>
                    <div class="nio-stat-label">Total Jugadas</div>
                    <div style="font-size: 12px; margin-top: 6px; color: rgba(255,255,255,0.35);">Resueltas</div>
                </div>
            </div>
            
            <!-- Quick Access Modules -->
            <div class="nio-grid nio-grid-2 nio-stagger" style="margin-bottom: 36px;">
                <!-- Totales -->
                <button onclick="navigateTo('totales')" class="nio-feature-card" style="--glow-color: rgba(255, 215, 0, 0.08); border-color: rgba(255, 215, 0, 0.12);">
                    <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px;">
                        <div>
                            <h3 style="font-family: var(--font-display); font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 8px;">📊 Calculadora de Totales</h3>
                            <p style="font-size: 14px; color: rgba(255, 215, 0, 0.6);">Sistema de predicción Q1, 1H y Full</p>
                        </div>
                        <span style="font-size: 36px; color: rgba(255, 215, 0, 0.25);">→</span>
                    </div>
                    <div class="nio-chip" style="border-color: rgba(255, 215, 0, 0.15); color: rgba(255, 215, 0, 0.5);">Click para analizar partidos NBA</div>
                </button>
                
                <!-- AI Picks -->
                <button onclick="navigateTo('aipicks')" class="nio-feature-card" style="--glow-color: rgba(167, 139, 250, 0.08); border-color: rgba(167, 139, 250, 0.12);">
                    <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px;">
                        <div>
                            <h3 style="font-family: var(--font-display); font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 8px;">🤖 AI Picks Automáticas</h3>
                            <p style="font-size: 14px; color: rgba(167, 139, 250, 0.6);">Picks generadas por inteligencia artificial</p>
                        </div>
                        <span style="font-size: 36px; color: rgba(167, 139, 250, 0.25);">→</span>
                    </div>
                    <div class="nio-chip" style="border-color: rgba(167, 139, 250, 0.15); color: rgba(167, 139, 250, 0.5);">${Object.keys(USER_PICKS_AI).length} picks activas • 75%+ probabilidad</div>
                </button>
                
                <!-- Mis Picks -->
                <button onclick="navigateTo('mispicks')" class="nio-feature-card" style="--glow-color: rgba(34, 211, 238, 0.08); border-color: rgba(34, 211, 238, 0.12);">
                    <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px;">
                        <div>
                            <h3 style="font-family: var(--font-display); font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 8px;">📋 Mis Picks</h3>
                            <p style="font-size: 14px; color: rgba(34, 211, 238, 0.6);">Todas tus jugadas en un solo lugar</p>
                        </div>
                        <span style="font-size: 36px; color: rgba(34, 211, 238, 0.25);">→</span>
                    </div>
                    <div class="nio-chip" style="border-color: rgba(34, 211, 238, 0.15); color: rgba(34, 211, 238, 0.5);">${totalPicks} picks totales en seguimiento</div>
                </button>
                
                <!-- Dashboard -->
                <button onclick="navigateTo('dashboard')" class="nio-feature-card" style="--glow-color: rgba(52, 211, 153, 0.08); border-color: rgba(52, 211, 153, 0.12);">
                    <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px;">
                        <div>
                            <h3 style="font-family: var(--font-display); font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 8px;">📉 Dashboard Pro</h3>
                            <p style="font-size: 14px; color: rgba(52, 211, 153, 0.6);">Analytics avanzado de rendimiento</p>
                        </div>
                        <span style="font-size: 36px; color: rgba(52, 211, 153, 0.25);">→</span>
                    </div>
                    <div class="nio-chip" style="border-color: rgba(52, 211, 153, 0.15); color: rgba(52, 211, 153, 0.5);">Gráficos, ROI y métricas por equipo</div>
                </button>
            </div>
            
            <!-- Bankroll Section -->
            <div class="nio-card" style="animation-delay: 0.3s;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
                    <h3 style="font-family: var(--font-display); font-size: 22px; font-weight: 800; color: #fff;">💰 Gestión de Bankroll</h3>
                    <button onclick="navigateTo('bankroll')" class="nio-btn nio-btn-ghost nio-btn-sm">
                        Ver Detalles →
                    </button>
                </div>
                
                <div class="nio-grid" style="grid-template-columns: repeat(3, 1fr);">
                    <div style="background: rgba(255,255,255,0.03); padding: 18px; border-radius: var(--r-sm); border: 1px solid rgba(255,255,255,0.05);">
                        <div style="font-size: 12px; color: rgba(255,255,255,0.45); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Bankroll Actual</div>
                        <div style="font-size: 24px; font-weight: 800; font-family: var(--font-mono);" class="text-gold">$${bankroll.toFixed(2)}</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.03); padding: 18px; border-radius: var(--r-sm); border: 1px solid rgba(255,255,255,0.05);">
                        <div style="font-size: 12px; color: rgba(255,255,255,0.45); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Bankroll Inicial</div>
                        <div style="font-size: 24px; font-weight: 800; font-family: var(--font-mono); color: #fff;">$${initial.toFixed(2)}</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.03); padding: 18px; border-radius: var(--r-sm); border: 1px solid rgba(255,255,255,0.05);">
                        <div style="font-size: 12px; color: rgba(255,255,255,0.45); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Ganancia/Pérdida</div>
                        <div style="font-size: 24px; font-weight: 800; font-family: var(--font-mono);" class="${profit >= 0 ? 'text-emerald' : 'text-rose'}">
                            ${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════════
// MÓDULO: TOTALES (Calculadora Reconstruida)
// ═══════════════════════════════════════════════════════════════════



function renderTendencia() {
    const teams = getTeams();
    const lD = localTeam ? TEAM_STATS[localTeam] : null;
    const vD = visitingTeam ? TEAM_STATS[visitingTeam] : null;

    // Calcular rankings
    const lR = localTeam ? getAllTeamRankings(localTeam) : null;
    const vR = visitingTeam ? getAllTeamRankings(visitingTeam) : null;

    let trends = { q1: '-', half: '-', full: '-' };
    // USAR MODELO AVANZADO v2.0
    let advancedData = null;
    if (lD && vD) {
        advancedData = getAdvancedTrends(localTeam, visitingTeam);

        if (advancedData) {
            trends = {
                q1: advancedData.q1.toFixed(1),
                half: advancedData.half.toFixed(1),
                full: advancedData.full.toFixed(1)
            };
        } else {
            // Fallback al método simple
            trends = {
                q1: (lD.q1Home + vD.q1Away).toFixed(1),
                half: (lD.halfHome + vD.halfAway).toFixed(1),
                full: (lD.fullHome + vD.fullAway).toFixed(1)
            };
        }
    }

    // Calcular probabilidades con PACE si está disponible
    const probOptions = advancedData ? { combinedPace: advancedData.combinedPace } : {};
    const pQ1 = calcProb(trends.q1, lineQ1, typeQ1, probOptions);
    const pHalf = calcProb(trends.half, lineHalf, typeHalf, probOptions);
    const pFull = calcProb(trends.full, lineFull, typeFull, probOptions);

    let opts = '<option value="">Seleccionar...</option>';
    teams.forEach(t => { opts += `<option value="${t}">${t}</option>`; });

    let html = `
        <div class="p-3 md:p-4 max-w-4xl mx-auto">
            <button onclick="navigateTo('home')" aria-label="Ir al inicio" class="flex items-center gap-2 text-yellow-400 hover:text-yellow-300 px-4 py-2 rounded-lg mb-4 text-sm md:text-base font-semibold transition-all" style="background: rgba(255,215,0,0.1); border: 1px solid rgba(255,215,0,0.3);">← Volver al Inicio</button>
            <div class="text-center mb-6">
                <div class="flex items-center justify-center gap-3 mb-2">
                    ${LOGO_SVG}
                    <div>
                        <h1 class="text-2xl md:text-3xl font-bold text-white font-display tracking-wide">ANÁLISIS DE PARTIDO</h1>
                        <div class="flex items-center gap-3 justify-center mt-1">
                            <p class="text-yellow-400 text-sm font-semibold">🏀 Tendencia + H2H + Factores Contextuales</p>
                            <span class="last-updated"><span class="pulse-dot"></span> <span id="lastUpdated">${new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span></span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-6">
                <div class="p-3 md:p-4 rounded-xl border border-blue-500/30" style="background: linear-gradient(135deg, #1b3a5f 0%, #0d1b2a 100%);">
                    <h2 class="text-base md:text-lg font-bold text-blue-400 mb-2 text-center">🏠 EQUIPO LOCAL</h2>
                    <select id="localSelect" class="select-premium w-full">
                        ${opts.replace(`value="${localTeam}"`, `value="${localTeam}" selected`)}
                    </select>
                    ${lD && lR ? `
                        <div class="mt-3 rounded-lg p-2 md:p-3" style="background: rgba(0,0,0,0.3);">
                            <div class="text-blue-300 text-xs md:text-sm text-center mb-2 font-semibold">📊 Temporada 2025-26</div>
                            <div class="grid grid-cols-3 gap-1 text-center text-xs md:text-sm mb-2">
                                <div class="text-white">1Q: ${lD.q1} ${formatRanking(lR.q1)}</div>
                                <div class="text-white">1H: ${lD.half} ${formatRanking(lR.half)}</div>
                                <div class="text-white">Full: ${lD.full} ${formatRanking(lR.full)}</div>
                            </div>
                            <div class="text-yellow-400 text-xs md:text-sm text-center font-bold border-t border-white/20 pt-2">
                                <span class="block mb-1">🏠 HOME</span>
                                <div class="grid grid-cols-3 gap-1">
                                    <div>1Q: ${lD.q1Home} ${formatRanking(lR.q1Home)}</div>
                                    <div>1H: ${lD.halfHome} ${formatRanking(lR.halfHome)}</div>
                                    <div>Full: ${lD.fullHome} ${formatRanking(lR.fullHome)}</div>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="p-3 md:p-4 rounded-xl border border-orange-500/30" style="background: linear-gradient(135deg, #4a2c2a 0%, #0d1b2a 100%);">
                    <h2 class="text-base md:text-lg font-bold text-orange-400 mb-2 text-center">✈️ EQUIPO VISITANTE</h2>
                    <select id="visitingSelect" class="select-premium w-full">
                        ${opts.replace(`value="${visitingTeam}"`, `value="${visitingTeam}" selected`)}
                    </select>
                    ${vD && vR ? `
                        <div class="mt-3 rounded-lg p-2 md:p-3" style="background: rgba(0,0,0,0.3);">
                            <div class="text-orange-300 text-xs md:text-sm text-center mb-2 font-semibold">📊 Temporada 2025-26</div>
                            <div class="grid grid-cols-3 gap-1 text-center text-xs md:text-sm mb-2">
                                <div class="text-white">1Q: ${vD.q1} ${formatRanking(vR.q1)}</div>
                                <div class="text-white">1H: ${vD.half} ${formatRanking(vR.half)}</div>
                                <div class="text-white">Full: ${vD.full} ${formatRanking(vR.full)}</div>
                            </div>
                            <div class="text-yellow-400 text-xs md:text-sm text-center font-bold border-t border-white/20 pt-2">
                                <span class="block mb-1">✈️ AWAY</span>
                                <div class="grid grid-cols-3 gap-1">
                                    <div>1Q: ${vD.q1Away} ${formatRanking(vR.q1Away)}</div>
                                    <div>1H: ${vD.halfAway} ${formatRanking(vR.halfAway)}</div>
                                    <div>Full: ${vD.fullAway} ${formatRanking(vR.fullAway)}</div>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
    `;

    if (localTeam && visitingTeam) {
        // Calcular líneas sugeridas (redondeadas a .5)
        const suggestedQ1 = (Math.round(parseFloat(trends.q1) * 2) / 2).toFixed(1);
        const suggestedHalf = (Math.round(parseFloat(trends.half) * 2) / 2).toFixed(1);
        const suggestedFull = (Math.round(parseFloat(trends.full) * 2) / 2).toFixed(1);

        html += `
            <div class="rounded-2xl p-3 md:p-5 shadow-xl mb-6 border border-yellow-500/30" style="background: linear-gradient(135deg, #1b263b 0%, #0d1b2a 100%);">
                <h2 class="text-lg md:text-xl font-bold text-yellow-400 mb-1 text-center font-display tracking-wide">📈 PREDICCIÓN DEL MODELO v2.5</h2>
                <p class="text-center text-gray-400 text-xs md:text-sm mb-2">${localTeam} (HOME) vs ${visitingTeam} (AWAY)</p>

                ${advancedData ? `
                    <!-- Badges de factores activos -->
                    <div class="flex flex-wrap justify-center gap-2 mb-2">
                        ${advancedData.combinedPace ? `<span class="badge-neon badge-neon-blue" title="Ritmo combinado">⚡ ${advancedData.combinedPace.toFixed(1)}</span>` : ''}
                        ${advancedData.components?.full?.altitude ? `<span class="badge-neon badge-neon-yellow">🏔️ +${advancedData.components.full.altitude}</span>` : ''}
                        ${localB2B ? `<span class="badge-neon badge-neon-pink">🔴 ${localTeam} B2B</span>` : ''}
                        ${awayB2B ? `<span class="badge-neon badge-neon-pink">🔴 ${visitingTeam} B2B</span>` : ''}
                        ${localInjury ? `<span class="badge-neon badge-neon-pink">🏥 ${localTeam}</span>` : ''}
                        ${awayInjury ? `<span class="badge-neon badge-neon-pink">🏥 ${visitingTeam}</span>` : ''}
                        ${localRestDays >= 3 ? `<span class="badge-neon badge-neon-green">💪 ${localTeam} +${localRestDays}d</span>` : ''}
                        ${awayRestDays >= 3 ? `<span class="badge-neon badge-neon-green">💪 ${visitingTeam} +${awayRestDays}d</span>` : ''}
                        ${localStreak >= 3 ? `<span class="badge-neon badge-neon-green">🔥 ${localTeam} +${localStreak}</span>` : ''}
                        ${localStreak <= -3 ? `<span class="badge-neon badge-neon-pink">❄️ ${localTeam} ${localStreak}</span>` : ''}
                        ${awayStreak >= 3 ? `<span class="badge-neon badge-neon-green">🔥 ${visitingTeam} +${awayStreak}</span>` : ''}
                        ${awayStreak <= -3 ? `<span class="badge-neon badge-neon-pink">❄️ ${visitingTeam} ${awayStreak}</span>` : ''}
                        ${awayTravel === 'crossCountry' ? `<span class="badge-neon badge-neon-blue">✈️ Costa-Costa</span>` : ''}
                        ${isDivisionRivalry ? `<span class="badge-neon badge-neon-yellow">⚔️ División</span>` : ''}
                        ${gameDay === 'friday' || gameDay === 'saturday' ? `<span class="badge-neon badge-neon-green">🎉 Fin de semana</span>` : ''}
                        <span class="badge-neon ${advancedData.confidence >= 85 ? 'badge-neon-green' : advancedData.confidence >= 75 ? 'badge-neon-yellow' : 'badge-neon-pink'}">🎯 ${advancedData.confidence}%</span>
                    </div>

                    <!-- PANEL DE AJUSTES CONTEXTUALES v2.5 -->
                    <details class="mb-3">
                        <summary class="text-sm text-cyan-400 cursor-pointer hover:text-cyan-300 font-semibold text-center">⚙️ Ajustes Contextuales (8 factores - ${autoDetectEnabled ? '🤖 AUTO' : '✋ MANUAL'})</summary>
                        <div class="mt-3 bg-white/5 rounded-xl p-4 space-y-4">

                            <!-- Toggle Auto-Detección + Botón Refresh -->
                            <div class="flex items-center justify-between bg-cyan-500/10 rounded-lg p-3 border border-cyan-500/30">
                                <div class="flex items-center gap-3">
                                    <label class="flex items-center gap-2 text-xs text-cyan-400 cursor-pointer">
                                        <input type="checkbox" ${autoDetectEnabled ? 'checked' : ''} onchange="autoDetectEnabled = this.checked; debouncedRender();" class="w-4 h-4 accent-cyan-500">
                                        <span class="font-bold">🤖 Auto-Detección</span>
                                    </label>
                                    <span class="text-xs text-gray-400">(B2B, Descanso, Rachas, Viaje, División, Día)</span>
                                </div>
                                <button onclick="autoDetectContextualFactors('${localTeam}', '${visitingTeam}').then(() => render())"
                                    class="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-xs px-3 py-1 rounded-lg font-bold transition-all">
                                    🔄 Actualizar
                                </button>
                            </div>

                            ${autoDetectEnabled ? `
                            <div class="bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-center">
                                <p class="text-xs text-green-400">✅ Datos obtenidos automáticamente desde API. Solo <strong>Lesiones</strong> requiere input manual.</p>
                            </div>
                            ` : ''}

                            <!-- Fila 1: B2B -->
                            <div class="grid grid-cols-2 gap-4">
                                <div class="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                                    <p class="text-xs text-red-400 font-bold mb-2 text-center">🔴 Back-to-Back (B2B)</p>
                                    <div class="space-y-2">
                                        <label class="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                                            <input type="checkbox" ${localB2B ? 'checked' : ''} onchange="localB2B = this.checked; debouncedRender();" class="w-4 h-4 accent-red-500">
                                            <span>🏠 ${localTeam || 'Local'} jugó ayer</span>
                                        </label>
                                        <label class="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                                            <input type="checkbox" ${awayB2B ? 'checked' : ''} onchange="awayB2B = this.checked; debouncedRender();" class="w-4 h-4 accent-red-500">
                                            <span>✈️ ${visitingTeam || 'Visitante'} jugó ayer</span>
                                        </label>
                                    </div>
                                    <p class="text-xs text-gray-500 mt-2 text-center">-1.25 pts por equipo</p>
                                </div>

                                <!-- Injuries -->
                                <div class="bg-pink-500/10 rounded-lg p-3 border border-pink-500/20">
                                    <p class="text-xs text-pink-400 font-bold mb-2 text-center">🏥 Estrella Lesionada</p>
                                    <div class="space-y-2">
                                        <label class="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                                            <input type="checkbox" ${localInjury ? 'checked' : ''} onchange="localInjury = this.checked; debouncedRender();" class="w-4 h-4 accent-pink-500">
                                            <span>🏠 ${localTeam || 'Local'} sin estrella</span>
                                        </label>
                                        <label class="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                                            <input type="checkbox" ${awayInjury ? 'checked' : ''} onchange="awayInjury = this.checked; debouncedRender();" class="w-4 h-4 accent-pink-500">
                                            <span>✈️ ${visitingTeam || 'Visitante'} sin estrella</span>
                                        </label>
                                    </div>
                                    <p class="text-xs text-gray-500 mt-2 text-center">-3.5 pts por equipo</p>
                                </div>
                            </div>

                            <!-- Fila 2: Rest Days -->
                            <div class="grid grid-cols-2 gap-4">
                                <div class="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
                                    <p class="text-xs text-green-400 font-bold mb-2 text-center">💪 Días de Descanso</p>
                                    <div class="space-y-2">
                                        <div class="flex items-center justify-between">
                                            <span class="text-xs text-gray-300">🏠 ${localTeam || 'Local'}:</span>
                                            <select onchange="localRestDays = safeParseInt(this.value, 1); debouncedRender();" class="bg-white/10 text-white text-xs rounded px-2 py-1 border border-white/20">
                                                <option value="1" ${localRestDays === 1 ? 'selected' : ''}>1 día (normal)</option>
                                                <option value="2" ${localRestDays === 2 ? 'selected' : ''}>2 días (+0.5)</option>
                                                <option value="3" ${localRestDays === 3 ? 'selected' : ''}>3+ días (+1.5)</option>
                                                <option value="4" ${localRestDays === 4 ? 'selected' : ''}>4+ días (+1.5)</option>
                                            </select>
                                        </div>
                                        <div class="flex items-center justify-between">
                                            <span class="text-xs text-gray-300">✈️ ${visitingTeam || 'Visitante'}:</span>
                                            <select onchange="awayRestDays = safeParseInt(this.value, 1); debouncedRender();" class="bg-white/10 text-white text-xs rounded px-2 py-1 border border-white/20">
                                                <option value="1" ${awayRestDays === 1 ? 'selected' : ''}>1 día (normal)</option>
                                                <option value="2" ${awayRestDays === 2 ? 'selected' : ''}>2 días (+0.5)</option>
                                                <option value="3" ${awayRestDays === 3 ? 'selected' : ''}>3+ días (+1.5)</option>
                                                <option value="4" ${awayRestDays === 4 ? 'selected' : ''}>4+ días (+1.5)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <!-- Streaks -->
                                <div class="bg-orange-500/10 rounded-lg p-3 border border-orange-500/20">
                                    <p class="text-xs text-orange-400 font-bold mb-2 text-center">🔥 Rachas (últimos 5)</p>
                                    <div class="space-y-2">
                                        <div class="flex items-center justify-between">
                                            <span class="text-xs text-gray-300">🏠 ${localTeam || 'Local'}:</span>
                                            <select onchange="localStreak = safeParseInt(this.value, 0); debouncedRender();" class="bg-white/10 text-white text-xs rounded px-2 py-1 border border-white/20">
                                                <option value="-5" ${localStreak === -5 ? 'selected' : ''}>-5 (muy fría)</option>
                                                <option value="-4" ${localStreak === -4 ? 'selected' : ''}>-4</option>
                                                <option value="-3" ${localStreak === -3 ? 'selected' : ''}>-3</option>
                                                <option value="-2" ${localStreak === -2 ? 'selected' : ''}>-2</option>
                                                <option value="-1" ${localStreak === -1 ? 'selected' : ''}>-1</option>
                                                <option value="0" ${localStreak === 0 ? 'selected' : ''}>0 (neutral)</option>
                                                <option value="1" ${localStreak === 1 ? 'selected' : ''}>+1</option>
                                                <option value="2" ${localStreak === 2 ? 'selected' : ''}>+2</option>
                                                <option value="3" ${localStreak === 3 ? 'selected' : ''}>+3</option>
                                                <option value="4" ${localStreak === 4 ? 'selected' : ''}>+4</option>
                                                <option value="5" ${localStreak === 5 ? 'selected' : ''}>+5 (muy caliente)</option>
                                            </select>
                                        </div>
                                        <div class="flex items-center justify-between">
                                            <span class="text-xs text-gray-300">✈️ ${visitingTeam || 'Visitante'}:</span>
                                            <select onchange="awayStreak = safeParseInt(this.value, 0); debouncedRender();" class="bg-white/10 text-white text-xs rounded px-2 py-1 border border-white/20">
                                                <option value="-5" ${awayStreak === -5 ? 'selected' : ''}>-5 (muy fría)</option>
                                                <option value="-4" ${awayStreak === -4 ? 'selected' : ''}>-4</option>
                                                <option value="-3" ${awayStreak === -3 ? 'selected' : ''}>-3</option>
                                                <option value="-2" ${awayStreak === -2 ? 'selected' : ''}>-2</option>
                                                <option value="-1" ${awayStreak === -1 ? 'selected' : ''}>-1</option>
                                                <option value="0" ${awayStreak === 0 ? 'selected' : ''}>0 (neutral)</option>
                                                <option value="1" ${awayStreak === 1 ? 'selected' : ''}>+1</option>
                                                <option value="2" ${awayStreak === 2 ? 'selected' : ''}>+2</option>
                                                <option value="3" ${awayStreak === 3 ? 'selected' : ''}>+3</option>
                                                <option value="4" ${awayStreak === 4 ? 'selected' : ''}>+4</option>
                                                <option value="5" ${awayStreak === 5 ? 'selected' : ''}>+5 (muy caliente)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <p class="text-xs text-gray-500 mt-2 text-center">±0.25 pts por partido</p>
                                </div>
                            </div>

                            <!-- Fila 3: Travel, Schedule Density -->
                            <div class="grid grid-cols-2 gap-4">
                                <div class="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
                                    <p class="text-xs text-blue-400 font-bold mb-2 text-center">✈️ Viaje Visitante</p>
                                    <select onchange="awayTravel = this.value; debouncedRender();" class="w-full bg-white/10 text-white text-xs rounded px-2 py-1 border border-white/20">
                                        <option value="none" ${awayTravel === 'none' ? 'selected' : ''}>Normal (misma zona)</option>
                                        <option value="moderate" ${awayTravel === 'moderate' ? 'selected' : ''}>Moderado 1-2 zonas (-0.5)</option>
                                        <option value="crossCountry" ${awayTravel === 'crossCountry' ? 'selected' : ''}>Costa a Costa 3+ (-1.0)</option>
                                    </select>
                                    <p class="text-xs text-gray-500 mt-2 text-center">Fatiga por viaje largo</p>
                                </div>

                                <div class="bg-purple-500/10 rounded-lg p-3 border border-purple-500/20">
                                    <p class="text-xs text-purple-400 font-bold mb-2 text-center">📅 Densidad Schedule</p>
                                    <div class="space-y-2">
                                        <div class="flex items-center justify-between">
                                            <span class="text-xs text-gray-300">🏠:</span>
                                            <select onchange="localScheduleDensity = this.value; debouncedRender();" class="bg-white/10 text-white text-xs rounded px-2 py-1 border border-white/20">
                                                <option value="normal" ${localScheduleDensity === 'normal' ? 'selected' : ''}>Normal</option>
                                                <option value="3in4" ${localScheduleDensity === '3in4' ? 'selected' : ''}>3 en 4 días (-0.75)</option>
                                                <option value="4in5" ${localScheduleDensity === '4in5' ? 'selected' : ''}>4 en 5 días (-1.5)</option>
                                            </select>
                                        </div>
                                        <div class="flex items-center justify-between">
                                            <span class="text-xs text-gray-300">✈️:</span>
                                            <select onchange="awayScheduleDensity = this.value; debouncedRender();" class="bg-white/10 text-white text-xs rounded px-2 py-1 border border-white/20">
                                                <option value="normal" ${awayScheduleDensity === 'normal' ? 'selected' : ''}>Normal</option>
                                                <option value="3in4" ${awayScheduleDensity === '3in4' ? 'selected' : ''}>3 en 4 días (-0.75)</option>
                                                <option value="4in5" ${awayScheduleDensity === '4in5' ? 'selected' : ''}>4 en 5 días (-1.5)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Fila 4: Division Rivalry, Day of Week -->
                            <div class="grid grid-cols-2 gap-4">
                                <div class="bg-yellow-500/10 rounded-lg p-3 border border-yellow-500/20">
                                    <p class="text-xs text-yellow-400 font-bold mb-2 text-center">⚔️ Rivalidad División</p>
                                    <label class="flex items-center justify-center gap-2 text-xs text-gray-300 cursor-pointer">
                                        <input type="checkbox" ${isDivisionRivalry ? 'checked' : ''} onchange="isDivisionRivalry = this.checked; debouncedRender();" class="w-4 h-4 accent-yellow-500">
                                        <span>Misma división (+2.0 pts)</span>
                                    </label>
                                    <p class="text-xs text-gray-500 mt-2 text-center">Partidos más intensos</p>
                                </div>

                                <div class="bg-cyan-500/10 rounded-lg p-3 border border-cyan-500/20">
                                    <p class="text-xs text-cyan-400 font-bold mb-2 text-center">📆 Día de Juego</p>
                                    <select onchange="gameDay = this.value; debouncedRender();" class="w-full bg-white/10 text-white text-xs rounded px-2 py-1 border border-white/20">
                                        <option value="weekday" ${gameDay === 'weekday' ? 'selected' : ''}>Lun-Jue (normal)</option>
                                        <option value="friday" ${gameDay === 'friday' ? 'selected' : ''}>Viernes (+1.5)</option>
                                        <option value="saturday" ${gameDay === 'saturday' ? 'selected' : ''}>Sábado (+1.5)</option>
                                        <option value="sunday" ${gameDay === 'sunday' ? 'selected' : ''}>Domingo (+0.5)</option>
                                    </select>
                                    <p class="text-xs text-gray-500 mt-2 text-center">Más puntos fines de semana</p>
                                </div>
                            </div>

                            <!-- Resumen de ajustes activos -->
                            <div class="bg-white/5 rounded-lg p-2 text-center">
                                <p class="text-xs text-gray-400">
                                    <strong class="text-white">Ajustes activos:</strong>
                                    ${localB2B || awayB2B ? `B2B: ${((localB2B ? -1.25 : 0) + (awayB2B ? -1.25 : 0)).toFixed(2)} | ` : ''}
                                    ${localInjury || awayInjury ? `Lesiones: ${((localInjury ? -3.5 : 0) + (awayInjury ? -3.5 : 0)).toFixed(1)} | ` : ''}
                                    ${localRestDays >= 2 || awayRestDays >= 2 ? `Descanso: +${((localRestDays >= 3 ? 1.5 : localRestDays === 2 ? 0.5 : 0) + (awayRestDays >= 3 ? 1.5 : awayRestDays === 2 ? 0.5 : 0)).toFixed(1)} | ` : ''}
                                    ${localStreak !== 0 || awayStreak !== 0 ? `Rachas: ${((localStreak + awayStreak) * 0.25).toFixed(2)} | ` : ''}
                                    ${awayTravel !== 'none' ? `Travel: ${awayTravel === 'crossCountry' ? '-1.0' : '-0.5'} | ` : ''}
                                    ${localScheduleDensity !== 'normal' || awayScheduleDensity !== 'normal' ? `Schedule: ${((localScheduleDensity === '4in5' ? -1.5 : localScheduleDensity === '3in4' ? -0.75 : 0) + (awayScheduleDensity === '4in5' ? -1.5 : awayScheduleDensity === '3in4' ? -0.75 : 0)).toFixed(2)} | ` : ''}
                                    ${isDivisionRivalry ? `División: +2.0 | ` : ''}
                                    ${gameDay !== 'weekday' ? `Día: +${gameDay === 'sunday' ? '0.5' : '1.5'}` : ''}
                                </p>
                            </div>
                        </div>
                    </details>

                    <!-- Mini-guía de interpretación -->
                    <div class="flex flex-wrap justify-center gap-3 text-xs text-gray-400 mb-3">
                        ${advancedData.components?.full?.pace !== undefined ? `<span class="${(advancedData.components.full.pace || 0) > 0.3 ? 'text-green-400' : (advancedData.components.full.pace || 0) < -0.3 ? 'text-red-400' : 'text-gray-400'}">
                            ${(advancedData.components.full.pace || 0) > 0.3 ? '↑ Ritmo rápido (+pts)' : (advancedData.components.full.pace || 0) < -0.3 ? '↓ Ritmo lento (-pts)' : '→ Ritmo promedio'}
                        </span>` : ''}
                        <span class="${advancedData.confidence >= 85 ? 'text-green-400' : advancedData.confidence >= 75 ? 'text-yellow-400' : 'text-red-400'}">
                            ${advancedData.confidence >= 85 ? '✓ Alta fiabilidad' : advancedData.confidence >= 75 ? '~ Fiabilidad moderada' : '⚠ Usar con cautela'}
                        </span>
                    </div>

                    ${advancedData.warnings.length > 0 ? `
                        <div class="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-2 mb-3 text-xs text-yellow-400 text-center">
                            ${advancedData.warnings.join(' | ')}
                        </div>
                    ` : ''}
                ` : ''}

                <div class="grid grid-cols-3 gap-2 md:gap-4">
                    <div class="trend-card bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl p-3 md:p-4 text-center">
                        <p class="text-xs md:text-sm font-bold text-white/90">1Q</p>
                        <p class="text-2xl md:text-4xl font-black text-white number-glow">${trends.q1}</p>
                        <p class="text-xs text-white/70 mt-1">Línea: ${suggestedQ1}</p>
                    </div>
                    <div class="trend-card bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl p-3 md:p-4 text-center">
                        <p class="text-xs md:text-sm font-bold text-white/90">1H</p>
                        <p class="text-2xl md:text-4xl font-black text-white number-glow">${trends.half}</p>
                        <p class="text-xs text-white/70 mt-1">Línea: ${suggestedHalf}</p>
                    </div>
                    <div class="trend-card bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-3 md:p-4 text-center">
                        <p class="text-xs md:text-sm font-bold text-white/90">FULL</p>
                        <p class="text-2xl md:text-4xl font-black text-white number-glow">${trends.full}</p>
                        <p class="text-xs text-white/70 mt-1">Línea: ${suggestedFull}</p>
                    </div>
                </div>

                ${advancedData ? `
                    <!-- Desglose del modelo con explicaciones -->
                    <details class="mt-3">
                        <summary class="text-xs text-gray-400 cursor-pointer hover:text-white font-semibold">🔬 Ver desglose del cálculo (clic para entender cada número)</summary>
                        <div class="mt-2 bg-white/5 rounded-lg p-3 text-xs">
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                <div class="text-center bg-white/10 p-2 rounded-lg">
                                    <div class="font-bold text-white">Ofensivo</div>
                                    <div class="text-green-400 text-lg font-bold">${advancedData.components?.full?.offense?.toFixed(1) || '-'}</div>
                                    <div class="text-gray-400 text-xs mt-1">PPG combinado</div>
                                </div>
                                <div class="text-center bg-white/10 p-2 rounded-lg">
                                    <div class="font-bold text-white">Defensivo</div>
                                    <div class="text-red-400 text-lg font-bold">${advancedData.components?.full?.defense?.toFixed(1) || '-'}</div>
                                    <div class="text-gray-400 text-xs mt-1">Pts permitidos</div>
                                </div>
                                <div class="text-center bg-white/10 p-2 rounded-lg">
                                    <div class="font-bold text-white">PACE adj.</div>
                                    <div class="text-blue-400 text-lg font-bold">${advancedData.components?.full?.pace?.toFixed(2) || '0'}</div>
                                    <div class="text-gray-400 text-xs mt-1">${(advancedData.components?.full?.pace || 0) > 0.3 ? '↑ Rápido (+pts)' :
                    (advancedData.components?.full?.pace || 0) < -0.3 ? '↓ Lento (-pts)' :
                        '→ Normal'
                }</div>
                                </div>
                                <div class="text-center bg-white/10 p-2 rounded-lg">
                                    <div class="font-bold text-white">Contexto</div>
                                    <div class="text-purple-400 text-lg font-bold">+${advancedData.components?.full?.context?.toFixed(1) || '2.5'}</div>
                                    <div class="text-gray-400 text-xs mt-1">HCA${advancedData.components?.full?.altitude ? ' + Alt' : ''}</div>
                                </div>
                            </div>

                            ${(localB2B || awayB2B) ? `
                            <!-- B2B Adjustment -->
                            <div class="bg-red-500/20 border border-red-500/30 rounded-lg p-2 mb-3">
                                <div class="flex items-center justify-center gap-2 text-red-400 text-sm font-bold">
                                    <span>😴 B2B Penalty:</span>
                                    <span class="text-lg">${advancedData.components?.full?.b2b?.toFixed(2) || '-2.50'} pts</span>
                                </div>
                            </div>
                            ` : ''}

                            ${(localRestDays >= 2 || awayRestDays >= 2) ? `
                            <!-- Rest Days Bonus -->
                            <div class="bg-green-500/20 border border-green-500/30 rounded-lg p-2 mb-3">
                                <div class="flex items-center justify-center gap-2 text-green-400 text-sm font-bold">
                                    <span>💪 Rest Bonus:</span>
                                    <span class="text-lg">+${advancedData.components?.full?.rest?.toFixed(2) || '0'} pts</span>
                                </div>
                            </div>
                            ` : ''}

                            ${(localInjury || awayInjury) ? `
                            <!-- Injury Penalty -->
                            <div class="bg-pink-500/20 border border-pink-500/30 rounded-lg p-2 mb-3">
                                <div class="flex items-center justify-center gap-2 text-pink-400 text-sm font-bold">
                                    <span>🏥 Injury Penalty:</span>
                                    <span class="text-lg">${advancedData.components?.full?.injury?.toFixed(2) || '-3.50'} pts</span>
                                </div>
                            </div>
                            ` : ''}

                            ${(localStreak !== 0 || awayStreak !== 0) ? `
                            <!-- Streak Factor -->
                            <div class="bg-orange-500/20 border border-orange-500/30 rounded-lg p-2 mb-3">
                                <div class="flex items-center justify-center gap-2 text-orange-400 text-sm font-bold">
                                    <span>🔥 Streak Factor:</span>
                                    <span class="text-lg">${advancedData.components?.full?.streak >= 0 ? '+' : ''}${advancedData.components?.full?.streak?.toFixed(2) || '0'} pts</span>
                                </div>
                            </div>
                            ` : ''}

                            <!-- Explicación de cada componente -->
                            <div class="bg-blue-500/10 rounded-lg p-3 text-xs text-gray-300 space-y-2">
                                <p><strong class="text-green-400">🏀 Ofensivo:</strong> Suma de puntos que anota ${localTeam} en casa + ${visitingTeam} de visita.</p>
                                <p><strong class="text-red-400">🛡️ Defensivo:</strong> Suma de puntos que PERMITE cada defensa.</p>
                                <p><strong class="text-blue-400">⚡ PACE:</strong> Ajuste por ritmo de juego combinado.</p>
                                <p><strong class="text-purple-400">🏠 Contexto:</strong> HCA +2.5 pts${advancedData.components?.full?.altitude ? ' + altitud' : ''}.</p>
                                ${(localB2B || awayB2B) ? `<p><strong class="text-red-400">😴 B2B:</strong> -1.25 pts por equipo que jugó ayer.</p>` : ''}
                                ${(localRestDays >= 2 || awayRestDays >= 2) ? `<p><strong class="text-green-400">💪 Descanso:</strong> +0.5/+1.5 pts por 2/3+ días de descanso.</p>` : ''}
                                ${(localInjury || awayInjury) ? `<p><strong class="text-pink-400">🏥 Lesiones:</strong> -3.5 pts por estrella ausente.</p>` : ''}
                                ${(localStreak !== 0 || awayStreak !== 0) ? `<p><strong class="text-orange-400">🔥 Rachas:</strong> ±0.25 pts por partido de racha (máx ±5).</p>` : ''}
                            </div>

                            <!-- Fórmula simplificada -->
                            <div class="mt-2 bg-white/5 rounded-lg p-2 text-center text-xs text-gray-400">
                                <strong>Fórmula:</strong> Base + PACE + Contexto${(localB2B || awayB2B) ? ' + B2B' : ''}${(localRestDays >= 2 || awayRestDays >= 2) ? ' + Rest' : ''}${(localInjury || awayInjury) ? ' + Injury' : ''}${(localStreak !== 0 || awayStreak !== 0) ? ' + Streak' : ''} + Regresión
                            </div>
                        </div>
                    </details>
                ` : ''}
            </div>
            ${renderH2HSection()}
            <div class="glass rounded-2xl p-3 md:p-5 shadow-xl mt-6 border border-white/10">
                <h2 class="text-lg md:text-xl font-bold text-white mb-4 text-center">🎯 CALCULADORA PRO - Expected Value</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                    ${renderCalc('Q1', '1Q', trends.q1, pQ1, typeQ1, lineQ1, oddsQ1)}
                    ${renderCalc('Half', '1H', trends.half, pHalf, typeHalf, lineHalf, oddsHalf)}
                    ${renderCalc('Full', 'FULL', trends.full, pFull, typeFull, lineFull, oddsFull)}
                </div>

                <!-- Leyenda EV -->
                <div class="mt-4 bg-white/5 rounded-xl p-4 border border-white/10">
                    <details class="text-white">
                        <summary class="font-bold cursor-pointer text-sm">📖 ¿Cómo interpretar? (clic para expandir)</summary>
                        <div class="mt-3 text-xs space-y-2 text-gray-300">
                            <p><strong class="text-white">📊 Prob. Ganar:</strong> Probabilidad estadística de que el pick gane</p>
                            <p><strong class="text-white">💰 Cuota Justa:</strong> La cuota mínima que deberías aceptar. Si la casa ofrece más = valor</p>
                            <p><strong class="text-white">📈 Expected Value (EV):</strong> Ganancia esperada por cada $100 apostados. EV +5% = ganas $5 por cada $100 a largo plazo</p>
                            <p><strong class="text-white">⚡ Edge:</strong> Tu ventaja sobre la casa. Edge +10% = 10% más probabilidad de lo que la casa cree</p>
                            <div class="mt-2 pt-2 border-t border-white/20">
                                <p class="text-yellow-300 font-bold">🎯 REGLA DE ORO:</p>
                                <p>• EV ≥ +3% = ✅ APOSTAR</p>
                                <p>• EV ≥ +7% = 💎 ALTO VALOR</p>
                                <p>• EV ≥ +15% = 🔥 ELITE (raro)</p>
                                <p>• EV < 0% = ❌ NO APOSTAR</p>
                            </div>
                        </div>
                    </details>
                </div>

                <!-- Explicación del Modelo Estadístico v2.5 -->
                <div class="mt-3 bg-white/5 rounded-xl p-4 border border-white/10">
                    <details class="text-white">
                        <summary class="font-bold cursor-pointer text-sm">🔬 Modelo Estadístico v2.5 (clic para ver)</summary>
                        <div class="mt-3 text-xs space-y-2 text-gray-300">
                            <p class="text-cyan-300 font-bold">📚 Basado en: XGBoost/SHAP (PLOS ONE 2024), Bayesian Models (icSPORTS 2023), FiveThirtyEight</p>

                            <div class="mt-2 bg-black/30 rounded-lg p-3">
                                <p class="text-yellow-300 font-bold mb-2">🧠 Componentes del Modelo v2.0:</p>
                                <p>• <strong class="text-green-400">Ofensivo (40%):</strong> PPG Home/Away del equipo</p>
                                <p>• <strong class="text-red-400">Defensivo (35%):</strong> Puntos que PERMITE cada defensa</p>
                                <p>• <strong class="text-blue-400">PACE (15%):</strong> Ajuste por ritmo de juego</p>
                                <p>• <strong class="text-purple-400">Contexto (10%):</strong> HCA (+2.5), Altitud Denver (+2.5)</p>
                            </div>

                            <div class="mt-2 bg-black/30 rounded-lg p-3">
                                <p class="text-yellow-300 font-bold mb-2">📊 Desviación Estándar Dinámica:</p>
                                <p>• <strong class="text-orange-400">1Q:</strong> ±8 pts (ajustado por PACE)</p>
                                <p>• <strong class="text-pink-400">1H:</strong> ±13 pts (ajustado por PACE)</p>
                                <p>• <strong class="text-green-400">FULL:</strong> ±18.5 pts (ajustado por PACE)</p>
                                <p class="text-gray-400 mt-1">Más PACE = más varianza en resultados</p>
                            </div>

                            <div class="mt-2 bg-black/30 rounded-lg p-3">
                                <p class="text-lime-300 font-bold mb-2">🔄 Calibración Inteligente:</p>
                                <p>• <strong class="text-white">Early Season (&lt;10 juegos):</strong> Regresión 30% hacia media</p>
                                <p>• <strong class="text-white">Mid Season (10-25 juegos):</strong> Regresión 15%</p>
                                <p>• <strong class="text-white">Late Season (25+ juegos):</strong> Regresión 5%</p>
                                <p class="text-yellow-300 mt-1">⚠️ Early Season: 58% histórico de UNDERs</p>
                            </div>

                            <div class="mt-2 pt-2 border-t border-white/20">
                                <p class="text-lime-300 font-bold">🎯 Precisión Esperada:</p>
                                <p>• Win Rate objetivo: <strong class="text-white">55-57%</strong> (vs 52.4% break-even)</p>
                                <p>• ROI objetivo: <strong class="text-white">3-8%</strong> a largo plazo</p>
                            </div>
                        </div>
                    </details>
                </div>
            </div>

            <!-- BET BUILDER - PICKS COMBINADOS -->
            ${(() => {
                const hasQ1 = lineQ1 && pQ1;
                const hasHalf = lineHalf && pHalf;
                const hasFull = lineFull && pFull;
                const validPicks = [hasQ1, hasHalf, hasFull].filter(Boolean).length;

                if (validPicks >= 2) {
                    return `
                    <div class="bg-gradient-to-br from-amber-600 to-orange-700 rounded-2xl p-5 shadow-xl">
                        <h3 class="text-lg font-bold text-white mb-4 text-center">🔥 BET BUILDER - Combo</h3>
                        <p class="text-white/70 text-xs text-center mb-4">Selecciona los picks para tu combinada</p>

                        <div class="grid grid-cols-3 gap-2 mb-4">
                            ${hasQ1 ? `
                                <label class="flex items-center gap-2 bg-white/20 p-3 rounded-lg cursor-pointer hover:bg-white/30">
                                    <input type="checkbox" id="combo_q1" class="w-5 h-5 accent-green-500" checked>
                                    <div class="text-white text-sm">
                                        <div class="font-bold">1Q ${typeQ1}</div>
                                        <div class="text-xs opacity-80">${lineQ1} (${pQ1}%)</div>
                                    </div>
                                </label>
                            ` : '<div></div>'}
                            ${hasHalf ? `
                                <label class="flex items-center gap-2 bg-white/20 p-3 rounded-lg cursor-pointer hover:bg-white/30">
                                    <input type="checkbox" id="combo_half" class="w-5 h-5 accent-green-500" checked>
                                    <div class="text-white text-sm">
                                        <div class="font-bold">1H ${typeHalf}</div>
                                        <div class="text-xs opacity-80">${lineHalf} (${pHalf}%)</div>
                                    </div>
                                </label>
                            ` : '<div></div>'}
                            ${hasFull ? `
                                <label class="flex items-center gap-2 bg-white/20 p-3 rounded-lg cursor-pointer hover:bg-white/30">
                                    <input type="checkbox" id="combo_full" class="w-5 h-5 accent-green-500" checked>
                                    <div class="text-white text-sm">
                                        <div class="font-bold">FULL ${typeFull}</div>
                                        <div class="text-xs opacity-80">${lineFull} (${pFull}%)</div>
                                    </div>
                                </label>
                            ` : '<div></div>'}
                        </div>

                        <div class="bg-black/20 rounded-xl p-4 mb-4">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-white/80 text-sm">Cuota Combinada:</span>
                                <input type="number" step="0.01" id="combo_odds" placeholder="ej: 2.05"
                                    class="w-24 p-2 rounded-lg text-center font-bold bg-white/10 text-white border border-white/20">
                            </div>
                            <p class="text-white/60 text-xs">Ingresa la cuota total del Bet Builder de tu casa de apuestas</p>
                        </div>

                        <button onclick="registerBetBuilder()"
                            class="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3 rounded-xl font-bold text-lg shadow-lg transition-all">
                            🎯 Registrar Bet Builder
                        </button>
                    </div>
                    `;
                }
                return '';
            })()}

            <!-- BOTÓN REGISTRAR PICK INDIVIDUAL -->
            <div class="bg-gradient-to-br from-pink-600 to-rose-700 rounded-2xl p-5 shadow-xl mt-6">
                <h3 class="text-lg font-bold text-white mb-4 text-center">📝 Registrar Pick</h3>
                <div class="grid grid-cols-3 gap-3">
                    ${lineQ1 && pQ1 ? (() => {
                const evQ1 = oddsQ1 ? calcEV(pQ1, oddsQ1) : null;
                const verdictQ1 = evVerdict(evQ1, pQ1, null);
                return `
                        <button onclick="registerPick('1Q', '${typeQ1}', '${lineQ1}', ${pQ1}, '${oddsQ1 || ''}')"
                            class="bg-white/20 hover:bg-white/30 text-white p-3 rounded-lg text-sm ${evQ1 && parseFloat(evQ1) >= 3 ? 'ring-2 ring-green-400' : ''}">
                            <div class="font-bold">1Q ${typeQ1}</div>
                            <div class="text-xs">${lineQ1} (${pQ1}%)</div>
                            ${evQ1 ? `<div class="text-xs mt-1 ${parseFloat(evQ1) >= 0 ? 'text-green-300' : 'text-red-300'}">EV: ${parseFloat(evQ1) >= 0 ? '+' : ''}${evQ1}%</div>` : ''}
                        </button>`;
            })() : '<div></div>'}
                    ${lineHalf && pHalf ? (() => {
                const evHalf = oddsHalf ? calcEV(pHalf, oddsHalf) : null;
                const verdictHalf = evVerdict(evHalf, pHalf, null);
                return `
                        <button onclick="registerPick('1H', '${typeHalf}', '${lineHalf}', ${pHalf}, '${oddsHalf || ''}')"
                            class="bg-white/20 hover:bg-white/30 text-white p-3 rounded-lg text-sm ${evHalf && parseFloat(evHalf) >= 3 ? 'ring-2 ring-green-400' : ''}">
                            <div class="font-bold">1H ${typeHalf}</div>
                            <div class="text-xs">${lineHalf} (${pHalf}%)</div>
                            ${evHalf ? `<div class="text-xs mt-1 ${parseFloat(evHalf) >= 0 ? 'text-green-300' : 'text-red-300'}">EV: ${parseFloat(evHalf) >= 0 ? '+' : ''}${evHalf}%</div>` : ''}
                        </button>`;
            })() : '<div></div>'}
                    ${lineFull && pFull ? (() => {
                const evFull = oddsFull ? calcEV(pFull, oddsFull) : null;
                const verdictFull = evVerdict(evFull, pFull, null);
                return `
                        <button onclick="registerPick('FULL', '${typeFull}', '${lineFull}', ${pFull}, '${oddsFull || ''}')"
                            class="bg-white/20 hover:bg-white/30 text-white p-3 rounded-lg text-sm ${evFull && parseFloat(evFull) >= 3 ? 'ring-2 ring-green-400' : ''}">
                            <div class="font-bold">FULL ${typeFull}</div>
                            <div class="text-xs">${lineFull} (${pFull}%)</div>
                            ${evFull ? `<div class="text-xs mt-1 ${parseFloat(evFull) >= 0 ? 'text-green-300' : 'text-red-300'}">EV: ${parseFloat(evFull) >= 0 ? '+' : ''}${evFull}%</div>` : ''}
                        </button>`;
            })() : '<div></div>'}
                </div>
            </div>
        `;
    } else {
        html += `<div class="glass rounded-xl p-10 text-center"><p class="text-white font-bold text-xl">👆 Selecciona dos equipos</p></div>`;
    }

    html += '</div>';
    return html;
}

function renderH2HSection() {
    const h2h = getH2HData(localTeam, visitingTeam);
    if (!h2h) {
        return `
            <div class="h2h-card rounded-2xl p-5 shadow-2xl mt-6 border border-yellow-500/30">
                <div class="text-center py-6">
                    <div class="text-5xl mb-4">📝</div>
                    <p class="text-yellow-400 font-bold">No hay datos H2H para ${localTeam} vs ${visitingTeam}</p>
                    <button onclick="goToIngestWithTeams()" class="mt-4 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg">➕ Agregar Partidos</button>
                </div>
            </div>
        `;
    }

    const t1W = h2h.record.team1Wins, t2W = h2h.record.team2Wins;
    let gh = h2h.games.map((g, i) => `
        <div class="grid grid-cols-5 gap-2 text-sm py-2 ${i % 2 === 0 ? 'bg-white/5' : ''} rounded">
            <span class="text-gray-300 text-xs">${g.date}${g.overtimes > 0 ? ` <span class="text-yellow-400">(${g.overtimes}OT)</span>` : ''}</span>
            <span class="text-center text-yellow-400 font-bold">${g.t1Q1 + g.t2Q1}</span>
            <span class="text-center text-pink-400 font-bold">${g.t1Half + g.t2Half}</span>
            <span class="text-center text-green-400 font-bold">${g.totalPts}</span>
            <span class="text-center font-bold ${g.winner === localTeam ? 'text-cyan-400' : 'text-orange-400'}">${g.winner}</span>
        </div>
    `).join('');

    return `
        <div class="h2h-card rounded-2xl p-5 shadow-2xl slide-in border border-purple-500/30 mt-6">
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-xl font-bold text-white">⚔️ H2H - Últimos ${h2h.games.length} Partidos</h2>
                <span class="text-xs px-3 py-1 rounded bg-green-500/20 text-green-300">☁️ Firebase</span>
            </div>

            <div class="grid grid-cols-3 gap-3 mb-5">
                <div class="bg-white/10 rounded-xl p-4 text-center ${t1W > t2W ? 'border-2 border-green-500/50' : ''}">
                    <p class="text-white font-bold text-sm">${localTeam}</p>
                    <p class="text-4xl font-black ${t1W > t2W ? 'text-green-400' : 'text-white'}">${t1W}</p>
                </div>
                <div class="bg-white/5 rounded-xl p-4 text-center flex flex-col justify-center">
                    <p class="text-yellow-400 font-bold">VS</p>
                    <p class="text-gray-300">${t1W}-${t2W}</p>
                </div>
                <div class="bg-white/10 rounded-xl p-4 text-center ${t2W > t1W ? 'border-2 border-green-500/50' : ''}">
                    <p class="text-white font-bold text-sm">${visitingTeam}</p>
                    <p class="text-4xl font-black ${t2W > t1W ? 'text-green-400' : 'text-white'}">${t2W}</p>
                </div>
            </div>

            <div class="bg-purple-900/50 rounded-xl p-4 mb-5">
                <h3 class="text-white font-bold text-center mb-3">📊 PROMEDIOS H2H</h3>
                <div class="grid grid-cols-3 gap-2 text-center text-sm">
                    <div class="bg-white/5 rounded-lg p-2">
                        <p class="text-gray-400 text-xs">1er Cuarto</p>
                        <p class="text-yellow-400 font-bold">${(h2h.avgQ1.team1 + h2h.avgQ1.team2).toFixed(1)}</p>
                    </div>
                    <div class="bg-white/5 rounded-lg p-2">
                        <p class="text-gray-400 text-xs">1er Tiempo</p>
                        <p class="text-pink-400 font-bold">${(h2h.avgHalf.team1 + h2h.avgHalf.team2).toFixed(1)}</p>
                    </div>
                    <div class="bg-white/5 rounded-lg p-2">
                        <p class="text-gray-400 text-xs">Full Game</p>
                        <p class="text-green-400 font-bold">${(h2h.avgPts.team1 + h2h.avgPts.team2).toFixed(1)}</p>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4 text-center mt-3">
                    <p class="text-cyan-400 font-bold">${localTeam}: ${h2h.avgPts.team1.toFixed(1)} PPG</p>
                    <p class="text-orange-400 font-bold">${visitingTeam}: ${h2h.avgPts.team2.toFixed(1)} PPG</p>
                </div>
            </div>

            <div class="bg-black/30 rounded-xl p-4">
                <h3 class="text-white font-bold text-sm mb-3">📋 HISTORIAL</h3>
                <div class="space-y-1 max-h-64 overflow-y-auto">
                    <div class="grid grid-cols-5 gap-2 text-xs text-gray-500 font-bold pb-2 border-b border-white/10">
                        <span>FECHA</span><span class="text-center">1Q</span><span class="text-center">1H</span><span class="text-center">FULL</span><span class="text-center">GANÓ</span>
                    </div>
                    ${gh}
                </div>
            </div>

            <button onclick="goToIngestWithTeams()" class="w-full mt-4 bg-purple-600/50 hover:bg-purple-600 text-white py-2 rounded-lg text-sm">➕ Agregar más partidos</button>
        </div>
    `;
}

function renderCalc(id, label, trend, prob, type, line, odds) {
    const analysis = analyzebet(trend, line, type, odds);
    const verdict = analysis ? evVerdict(analysis.ev, analysis.prob, analysis.edge) : evVerdict(null, prob, null);
    const stake = analysis && analysis.kelly ? stakeRec(analysis.kelly) : null;

    let resultsHtml = '';
    if (analysis && analysis.prob) {
        const hasOdds = odds && parseFloat(odds) > 1;
        const diffNum = parseFloat(analysis.diff);
        const zNum = parseFloat(analysis.zScore);

        resultsHtml = `
            <div class="mt-3 space-y-2">
                <!-- Métricas de Transparencia -->
                <div class="bg-slate-800/80 rounded-lg px-3 py-2 border border-white/10">
                    <div class="flex justify-between items-center text-xs">
                        <span class="text-gray-400">Diferencia</span>
                        <span class="font-bold ${diffNum >= 0 ? 'text-green-400' : 'text-red-400'}">${diffNum >= 0 ? '+' : ''}${analysis.diff} pts</span>
                    </div>
                    <div class="flex justify-between items-center text-xs mt-1">
                        <span class="text-gray-400">SD (±variación)</span>
                        <span class="font-bold text-cyan-400">±${analysis.std} pts</span>
                    </div>
                    <div class="flex justify-between items-center text-xs mt-1">
                        <span class="text-gray-400">Z-Score</span>
                        <span class="font-bold ${zNum >= 1.5 ? 'text-green-400' : zNum >= 0.5 ? 'text-yellow-400' : 'text-red-400'}">${zNum >= 0 ? '+' : ''}${analysis.zScore}</span>
                    </div>
                </div>

                <!-- Probabilidad -->
                <div class="flex justify-between items-center bg-white/10 rounded-lg px-3 py-2">
                    <span class="text-xs text-gray-400">Prob. Ganar</span>
                    <span class="font-black text-lg ${analysis.prob >= 55 ? 'text-green-400' : analysis.prob >= 45 ? 'text-yellow-400' : 'text-red-400'}">${analysis.prob}%</span>
                </div>

                <!-- Cuota Justa -->
                <div class="flex justify-between items-center bg-white/5 rounded-lg px-3 py-1">
                    <span class="text-xs text-gray-400">Cuota Justa</span>
                    <span class="font-bold text-sm text-white">${analysis.fairOdds}</span>
                </div>

                ${hasOdds ? `
                    <!-- EV% -->
                    <div class="flex justify-between items-center ${parseFloat(analysis.ev) >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'} rounded-lg px-3 py-2">
                        <span class="text-xs ${parseFloat(analysis.ev) >= 0 ? 'text-green-400' : 'text-red-400'}">Expected Value</span>
                        <span class="font-black text-lg ${parseFloat(analysis.ev) >= 0 ? 'text-green-400' : 'text-red-400'}">${parseFloat(analysis.ev) >= 0 ? '+' : ''}${analysis.ev}%</span>
                    </div>

                    <!-- Edge -->
                    <div class="flex justify-between items-center bg-white/5 rounded-lg px-3 py-1">
                        <span class="text-xs text-gray-400">Edge vs Casa</span>
                        <span class="font-bold text-sm ${parseFloat(analysis.edge) >= 0 ? 'text-green-400' : 'text-red-400'}">${parseFloat(analysis.edge) >= 0 ? '+' : ''}${analysis.edge}%</span>
                    </div>
                ` : `
                    <div class="bg-blue-500/20 rounded-lg px-3 py-2 text-center">
                        <span class="text-xs text-blue-400">⬇️ Ingresa la cuota para ver EV</span>
                    </div>
                `}

                <!-- Veredicto -->
                <div class="${evColor(hasOdds ? analysis.ev : null, analysis.prob)} rounded-xl p-3 text-center shadow-lg">
                    <p class="text-2xl">${verdict.icon}</p>
                    <p class="text-white font-black text-sm">${verdict.text}</p>
                    ${verdict.stars ? `<p class="text-yellow-300 text-xs">${verdict.stars}</p>` : ''}
                </div>

                ${hasOdds && stake ? `
                    <div class="text-center">
                        <span class="text-xs ${stake.class}">💰 ${stake.text}</span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    return `
        <div class="bg-slate-800/60 rounded-xl p-3 border border-white/10 backdrop-blur-sm">
            <p class="text-sm font-black text-center text-white mb-1">${label}: <span class="text-cyan-400">${trend}</span></p>

            <!-- Selector Over/Under -->
            <div class="flex gap-1 my-2">
                <button onclick="setType('${id}','OVER')" class="flex-1 py-2 text-xs rounded-lg font-bold transition-all ${type === 'OVER' ? 'bg-green-600 text-white shadow-md' : 'bg-white/10 hover:bg-white/20 text-white'}">OVER</button>
                <button onclick="setType('${id}','UNDER')" class="flex-1 py-2 text-xs rounded-lg font-bold transition-all ${type === 'UNDER' ? 'bg-red-600 text-white shadow-md' : 'bg-white/10 hover:bg-white/20 text-white'}">UNDER</button>
            </div>

            <!-- Input Línea -->
            <div class="mb-2">
                <label class="text-xs text-gray-400 block mb-1">📏 Línea</label>
                <input type="number" step="0.5" value="${line}" placeholder="ej: ${label === '1Q' ? '53.5' : label === '1H' ? '104.5' : '221.5'}"
                    class="w-full p-2 border border-cyan-500/30 rounded-lg text-center text-sm font-bold bg-cyan-500/10 text-white focus:border-cyan-500 focus:outline-none placeholder-gray-500"
                    onchange="updateLine('${id}',this.value)">
            </div>

            <!-- Input Cuota -->
            <div class="mb-2">
                <label class="text-xs text-gray-400 block mb-1">💰 Cuota (decimal)</label>
                <input type="number" step="0.01" value="${odds || ''}" placeholder="ej: 1.85"
                    class="w-full p-2 border border-yellow-500/30 rounded-lg text-center text-sm font-bold bg-yellow-500/10 text-white focus:border-yellow-500 focus:outline-none placeholder-gray-500"
                    onchange="updateOdds('${id}',this.value)">
            </div>

            ${resultsHtml}
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// PICKS VIEW
// ═══════════════════════════════════════════════════════════════
function renderPicks() {
    const stats = getPicksStats();
    const picks = Object.values(PICKS_DATABASE).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Stats por tipo
    let typeStatsHtml = '';
    Object.entries(stats.byType).forEach(([key, data]) => {
        const [period, betType] = key.split('_');
        const winRate = data.wins + data.losses > 0 ? ((data.wins / (data.wins + data.losses)) * 100).toFixed(0) : 0;
        typeStatsHtml += `
            <div class="bg-white/5 rounded-lg p-2 text-center">
                <p class="text-xs text-gray-300 font-semibold">${period} ${betType}</p>
                <p class="text-base md:text-lg font-bold ${winRate >= 55 ? 'text-green-400' : winRate >= 45 ? 'text-yellow-400' : 'text-red-400'}">${winRate}%</p>
                <p class="text-xs text-gray-400 font-medium">${data.wins}W-${data.losses}L</p>
            </div>
        `;
    });

    // Picks list - MEJORADO PARA MÓVILES
    let picksHtml = picks.length === 0 ? '<p class="text-center text-gray-400 py-10">No hay picks registrados aún</p>' : '';
    picks.forEach(pick => {
        const statusClass = pick.status === 'win' ? 'win-badge' : pick.status === 'loss' ? 'loss-badge' : 'pending-badge';
        const statusIcon = pick.status === 'win' ? '✅' : pick.status === 'loss' ? '❌' : '⏳';
        const date = new Date(pick.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });

        // Calcular CLV si tenemos línea de cierre
        let clvDisplay = '';
        if (pick.closingLine && pick.line && !pick.isCombo) {
            const clv = pick.betType === 'OVER'
                ? (parseFloat(pick.closingLine) - parseFloat(pick.line)).toFixed(1)
                : (parseFloat(pick.line) - parseFloat(pick.closingLine)).toFixed(1);
            const clvClass = parseFloat(clv) >= 0 ? 'text-green-400' : 'text-red-400';
            clvDisplay = `<span class="font-semibold ${clvClass} text-xs">CLV: ${parseFloat(clv) >= 0 ? '+' : ''}${clv}</span>`;
        }

        // ── Sanitizar todos los campos de usuario antes de interpolar en HTML ──
        // nsSafe() elimina cualquier HTML/JS malicioso. nsSafeId() restringe
        // los IDs usados en atributos onclick a solo caracteres alfanuméricos.
        const safeLocalTeam  = typeof nsSafe === 'function' ? nsSafe(pick.localTeam)  : (pick.localTeam  || '');
        const safeAwayTeam   = typeof nsSafe === 'function' ? nsSafe(pick.awayTeam)   : (pick.awayTeam   || '');
        const safeLine       = typeof nsSafeNumber === 'function' ? nsSafeNumber(pick.line, pick.line) : (pick.line || '');
        const safeOdds       = typeof nsSafeNumber === 'function' ? nsSafeNumber(pick.odds, pick.odds) : (pick.odds || '');
        const safeEv         = typeof nsSafeNumber === 'function' ? nsSafeNumber(pick.ev, pick.ev)     : (pick.ev   || '');
        const safeId         = typeof nsSafeId === 'function' ? nsSafeId(pick.id) : (pick.id || '');
        const safePeriod     = typeof nsSafe === 'function' ? nsSafe(pick.period)   : (pick.period   || '');
        const safeBetType    = typeof nsSafe === 'function' ? nsSafe(pick.betType)  : (pick.betType  || '');
        const safeActualTotal = pick.actualTotal ? (typeof nsSafeNumber === 'function' ? nsSafeNumber(pick.actualTotal, '') : pick.actualTotal) : '';

        picksHtml += `
            <div class="pick-card bg-white/5 rounded-xl p-3 md:p-4 mb-3 border ${pick.isCombo ? 'border-amber-500/50' : 'border-white/10'}">
                <!-- Header: Equipos + Status -->
                <div class="flex justify-between items-start mb-2">
                    <div class="flex-1 min-w-0 pr-2">
                        ${pick.isCombo ? '<span class="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full mb-1 inline-block font-bold">🔥 BET BUILDER</span>' : ''}
                        <p class="text-white font-bold text-sm md:text-base truncate">${safeLocalTeam} vs ${safeAwayTeam}</p>
                        <p class="text-gray-200 text-xs md:text-sm font-semibold">${pick.isCombo ? safeLine : `${safePeriod} ${safeBetType} ${safeLine}`}</p>
                    </div>
                    <span class="${statusClass} px-2 md:px-3 py-1 rounded-full text-white text-xs md:text-sm font-bold flex-shrink-0">${statusIcon}</span>
                </div>

                <!-- Stats Row: Fecha, Odds, Prob, EV, CLV - GRID para móviles -->
                <div class="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-3 text-xs md:text-sm mb-2">
                    <span class="text-gray-300 font-medium">📅 ${date}</span>
                    ${safeOdds ? `<span class="text-yellow-300 font-semibold">@${safeOdds}</span>` : ''}
                    <span class="text-purple-300 font-semibold">${pick.probability}% prob</span>
                    ${safeEv !== '' ? `<span class="font-semibold ${parseFloat(safeEv) >= 0 ? 'text-green-400' : 'text-red-400'}">EV: ${parseFloat(safeEv) >= 0 ? '+' : ''}${safeEv}%</span>` : ''}
                    ${clvDisplay}
                </div>

                <!-- Action Buttons -->
                <div class="flex justify-end gap-2 items-center border-t border-white/10 pt-2">
                    ${pick.status === 'pending' ? `
                        <button onclick="registerActualResult('${safeId}')" class="text-amber-400 hover:text-amber-300 text-xs bg-amber-500/20 px-2 py-1 rounded" title="Registrar resultado real">📊 Resultado</button>
                        <button onclick="updatePickResult('${safeId}', 'win')" class="text-green-400 hover:text-green-300 text-lg p-1" title="Marcar ganado">✓</button>
                        <button onclick="updatePickResult('${safeId}', 'loss')" class="text-red-400 hover:text-red-300 text-lg p-1" title="Marcar perdido">✗</button>
                        <button onclick="updatePickResult('${safeId}', 'push')" class="text-gray-400 hover:text-gray-300 text-sm p-1" title="Push">↔️</button>
                    ` : `
                        ${safeActualTotal ? `<span class="text-xs text-cyan-400 mr-2">Real: ${safeActualTotal} pts</span>` : ''}
                        ${pick.modelError !== null && pick.modelError !== undefined ? `<span class="text-xs text-gray-400">Error: ±${pick.modelError.toFixed(1)}</span>` : ''}
                    `}
                    ${!pick.isCombo && !pick.closingLine && pick.status !== 'pending' ? `<button onclick="addClosingLine('${safeId}', '${safeLine}')" class="text-cyan-400 hover:text-cyan-300 text-xs bg-cyan-500/20 px-2 py-1 rounded" title="Agregar línea de cierre">+CLV</button>` : ''}
                    <button onclick="deletePick('${safeId}')" class="text-gray-500 hover:text-red-400 text-lg p-1">🗑️</button>
                </div>
            </div>
        `;
    });

    return `
        <div class="p-3 md:p-4 max-w-4xl mx-auto">
            <button onclick="navigateTo('home')" aria-label="Ir al inicio" class="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg mb-4 text-sm md:text-base">← Volver</button>

            <div class="text-center mb-6">
                <div class="logo-container justify-center mb-2">
                    ${LOGO_SVG}
                    <h1 class="text-2xl md:text-3xl font-bold text-white font-orbitron">MIS PICKS</h1>
                </div>
            </div>

            <!-- RESUMEN PRINCIPAL -->
            <div class="bg-gradient-to-br from-purple-600/30 to-pink-600/30 rounded-2xl p-4 md:p-5 mb-6 border border-purple-500/50">
                <!-- Fila 1: Efectividad, Ganados, Perdidos -->
                <div class="grid grid-cols-3 gap-2 md:gap-3 text-center mb-4">
                    <div class="bg-white/10 rounded-xl p-3 md:p-4">
                        <p class="text-3xl md:text-5xl font-black ${parseFloat(stats.winRate) >= 55 ? 'text-green-400' : parseFloat(stats.winRate) >= 45 ? 'text-yellow-400' : 'text-red-400'}">${stats.winRate}%</p>
                        <p class="text-gray-300 text-xs md:text-sm font-semibold">Efectividad</p>
                    </div>
                    <div class="bg-white/10 rounded-xl p-3 md:p-4">
                        <p class="text-3xl md:text-5xl font-black text-green-400">${stats.wins}<span class="text-sm md:text-lg text-gray-400">/${stats.wins + stats.losses}</span></p>
                        <p class="text-gray-300 text-xs md:text-sm font-semibold">Ganados</p>
                    </div>
                    <div class="bg-white/10 rounded-xl p-3 md:p-4">
                        <p class="text-3xl md:text-5xl font-black text-red-400">${stats.losses}<span class="text-sm md:text-lg text-gray-400">/${stats.wins + stats.losses}</span></p>
                        <p class="text-gray-300 text-xs md:text-sm font-semibold">Perdidos</p>
                    </div>
                </div>

                <!-- Fila 2: Profit, ROI, Racha, Pendientes - RESPONSIVO -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 text-center mb-4">
                    <div class="bg-black/20 rounded-xl p-2 md:p-3">
                        <p class="text-xl md:text-2xl font-black ${parseFloat(stats.profit) >= 0 ? 'text-green-400' : 'text-red-400'}">${parseFloat(stats.profit) > 0 ? '+' : ''}${stats.profit}u</p>
                        <p class="text-gray-300 text-xs font-semibold">${parseFloat(stats.profit) >= 0 ? '📈' : '📉'} Profit</p>
                    </div>
                    <div class="bg-black/20 rounded-xl p-2 md:p-3">
                        <p class="text-xl md:text-2xl font-black ${parseFloat(stats.roi) >= 0 ? 'text-cyan-400' : 'text-red-400'}">${parseFloat(stats.roi) > 0 ? '+' : ''}${stats.roi}%</p>
                        <p class="text-gray-300 text-xs font-semibold">💰 ROI</p>
                    </div>
                    <div class="bg-black/20 rounded-xl p-2 md:p-3">
                        ${stats.streak.count > 0 ? `
                            <p class="text-xl md:text-2xl font-black ${stats.streak.type === 'win' ? 'text-green-400' : 'text-red-400'}">${stats.streak.count}${stats.streak.type === 'win' ? 'W' : 'L'}</p>
                            <p class="text-gray-300 text-xs font-semibold">${stats.streak.type === 'win' ? '🔥' : '❄️'} Racha</p>
                        ` : `
                            <p class="text-xl md:text-2xl font-black text-gray-500">-</p>
                            <p class="text-gray-300 text-xs font-semibold">🎯 Racha</p>
                        `}
                    </div>
                    <div class="bg-black/20 rounded-xl p-2 md:p-3">
                        <p class="text-xl md:text-2xl font-black text-yellow-400">${stats.pending}</p>
                        <p class="text-gray-300 text-xs font-semibold">⏳ Pendientes</p>
                    </div>
                </div>

                <!-- Rachas históricas -->
                ${stats.bestWinStreak > 0 || stats.worstLossStreak > 0 ? `
                <div class="grid grid-cols-2 gap-2 md:gap-3 text-center mb-4">
                    <div class="bg-green-500/10 rounded-lg p-2 border border-green-500/20">
                        <span class="text-green-400 text-xs md:text-sm font-semibold">🏆 Mejor: <strong>${stats.bestWinStreak}W</strong></span>
                    </div>
                    <div class="bg-red-500/10 rounded-lg p-2 border border-red-500/20">
                        <span class="text-red-400 text-xs md:text-sm font-semibold">💀 Peor: <strong>${stats.worstLossStreak}L</strong></span>
                    </div>
                </div>
                ` : ''}

                <!-- Desglose por período -->
                <div class="border-t border-white/10 pt-4">
                    <h4 class="text-xs md:text-sm font-bold text-gray-300 mb-3">📊 Rendimiento por Período</h4>
                    <div class="grid grid-cols-3 gap-2 md:gap-3">
                        <div class="bg-yellow-500/10 rounded-xl p-2 md:p-3 text-center border border-yellow-500/20">
                            <p class="text-yellow-400 font-bold text-base md:text-lg">1Q</p>
                            <p class="text-white font-bold text-xs md:text-sm">${stats.byPeriod['1Q'].wins}W-${stats.byPeriod['1Q'].losses}L</p>
                            <p class="text-xs md:text-sm font-semibold ${stats.byPeriod['1Q'].wins + stats.byPeriod['1Q'].losses > 0 ? (stats.byPeriod['1Q'].wins / (stats.byPeriod['1Q'].wins + stats.byPeriod['1Q'].losses) * 100 >= 50 ? 'text-green-400' : 'text-red-400') : 'text-gray-400'}">${stats.byPeriod['1Q'].wins + stats.byPeriod['1Q'].losses > 0 ? ((stats.byPeriod['1Q'].wins / (stats.byPeriod['1Q'].wins + stats.byPeriod['1Q'].losses)) * 100).toFixed(0) : 0}%</p>
                            <p class="text-xs font-semibold ${stats.byPeriod['1Q'].profit >= 0 ? 'text-green-400' : 'text-red-400'} mt-1">${stats.byPeriod['1Q'].profit >= 0 ? '+' : ''}${stats.byPeriod['1Q'].profit.toFixed(2)}u</p>
                        </div>
                        <div class="bg-pink-500/10 rounded-xl p-2 md:p-3 text-center border border-pink-500/20">
                            <p class="text-pink-400 font-bold text-base md:text-lg">1H</p>
                            <p class="text-white font-bold text-xs md:text-sm">${stats.byPeriod['1H'].wins}W-${stats.byPeriod['1H'].losses}L</p>
                            <p class="text-xs md:text-sm font-semibold ${stats.byPeriod['1H'].wins + stats.byPeriod['1H'].losses > 0 ? (stats.byPeriod['1H'].wins / (stats.byPeriod['1H'].wins + stats.byPeriod['1H'].losses) * 100 >= 50 ? 'text-green-400' : 'text-red-400') : 'text-gray-400'}">${stats.byPeriod['1H'].wins + stats.byPeriod['1H'].losses > 0 ? ((stats.byPeriod['1H'].wins / (stats.byPeriod['1H'].wins + stats.byPeriod['1H'].losses)) * 100).toFixed(0) : 0}%</p>
                            <p class="text-xs font-semibold ${stats.byPeriod['1H'].profit >= 0 ? 'text-green-400' : 'text-red-400'} mt-1">${stats.byPeriod['1H'].profit >= 0 ? '+' : ''}${stats.byPeriod['1H'].profit.toFixed(2)}u</p>
                        </div>
                        <div class="bg-green-500/10 rounded-xl p-2 md:p-3 text-center border border-green-500/20">
                            <p class="text-green-400 font-bold text-base md:text-lg">FULL</p>
                            <p class="text-white font-bold text-xs md:text-sm">${stats.byPeriod['FULL'].wins}W-${stats.byPeriod['FULL'].losses}L</p>
                            <p class="text-xs md:text-sm font-semibold ${stats.byPeriod['FULL'].wins + stats.byPeriod['FULL'].losses > 0 ? (stats.byPeriod['FULL'].wins / (stats.byPeriod['FULL'].wins + stats.byPeriod['FULL'].losses) * 100 >= 50 ? 'text-green-400' : 'text-red-400') : 'text-gray-400'}">${stats.byPeriod['FULL'].wins + stats.byPeriod['FULL'].losses > 0 ? ((stats.byPeriod['FULL'].wins / (stats.byPeriod['FULL'].wins + stats.byPeriod['FULL'].losses)) * 100).toFixed(0) : 0}%</p>
                            <p class="text-xs font-semibold ${stats.byPeriod['FULL'].profit >= 0 ? 'text-green-400' : 'text-red-400'} mt-1">${stats.byPeriod['FULL'].profit >= 0 ? '+' : ''}${stats.byPeriod['FULL'].profit.toFixed(2)}u</p>
                        </div>
                    </div>
                </div>

                ${typeStatsHtml ? `
                <div class="border-t border-white/10 pt-4 mt-4">
                    <h4 class="text-xs md:text-sm font-bold text-gray-300 mb-3">🎯 Por Tipo (Over/Under)</h4>
                    <div class="grid grid-cols-3 md:grid-cols-6 gap-2">
                        ${typeStatsHtml}
                    </div>
                </div>
                ` : ''}
            </div>

            <!-- LISTA DE PICKS -->
            <div class="glass rounded-xl p-3 md:p-4">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-base md:text-lg font-bold text-white">📋 Historial de Picks</h3>
                    <span class="text-xs md:text-sm text-gray-400">${stats.total} total</span>
                </div>
                <div class="max-h-96 overflow-y-auto">
                    ${picksHtml}
                </div>
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// BEST PICKS VIEW - Muestra picks de alto valor detectados
// ═══════════════════════════════════════════════════════════════
function renderBestPicks() {
    // Cargar VALUE_PICKS desde localStorage si no están cargados
    if (VALUE_PICKS.length === 0) {
        loadValuePicksFromStorage();
    }

    let picksHtml = '';

    if (VALUE_PICKS.length === 0) {
        picksHtml = `
            <div class="text-center py-10">
                <div class="text-6xl mb-4">🔍</div>
                <p class="text-gray-400 text-lg mb-2">No hay picks de valor detectados</p>
                <p class="text-gray-500 text-sm">Los picks aparecerán automáticamente cuando analices matchups en la calculadora y se detecte valor alto (75%+)</p>
                <button onclick="navigateTo('tendencia')" class="mt-4 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-bold">
                    📈 Ir a analizar matchups
                </button>
            </div>
        `;
    } else {
        VALUE_PICKS.forEach((pick, index) => {
            const timeAgo = getTimeAgo(pick.detectedAt);
            const evClass = pick.ev && parseFloat(pick.ev) >= 10 ? 'text-green-400' : pick.ev && parseFloat(pick.ev) >= 0 ? 'text-lime-400' : 'text-yellow-400';
            const periodColor = pick.period === '1Q' ? 'yellow' : pick.period === '1H' ? 'pink' : 'green';

            // Sanitizar campos que vienen de datos externos o del usuario
            const safeLocal  = typeof nsSafe === 'function' ? nsSafe(pick.local)   : (pick.local  || '');
            const safeAway   = typeof nsSafe === 'function' ? nsSafe(pick.away)    : (pick.away   || '');
            const safePeriod = typeof nsSafe === 'function' ? nsSafe(pick.period)  : (pick.period || '');
            const safeBetType= typeof nsSafe === 'function' ? nsSafe(pick.betType) : (pick.betType|| '');
            const safeTrend  = typeof nsSafe === 'function' ? nsSafe(pick.trend)   : (pick.trend  || '');
            const safeLine   = typeof nsSafeNumber === 'function' ? nsSafeNumber(pick.line, pick.line) : (pick.line || '');
            const safeEv     = typeof nsSafeNumber === 'function' ? nsSafeNumber(pick.ev,   pick.ev)   : (pick.ev   || '');
            const safeId     = typeof nsSafeId === 'function' ? nsSafeId(pick.id) : (pick.id || '');

            picksHtml += `
                <div class="value-pick bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl p-4 mb-3 border ${index === 0 ? 'border-yellow-500 border-2' : 'border-purple-500/30'}">
                    ${index === 0 ? '<div class="text-yellow-400 text-xs font-bold mb-2">🥇 PICK MÁS RECIENTE</div>' : ''}

                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <p class="text-white font-bold text-lg">${safeLocal} vs ${safeAway}</p>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="bg-${periodColor}-500/30 text-${periodColor}-400 text-xs px-2 py-1 rounded font-bold">${safePeriod}</span>
                                <span class="text-purple-300 font-semibold">${safeBetType} ${safeLine}</span>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="text-3xl font-black ${pick.probability >= 75 ? 'text-green-400' : 'text-yellow-400'}">${pick.probability}%</p>
                            <p class="text-xs text-gray-400 font-medium">probabilidad</p>
                        </div>
                    </div>

                    <div class="bg-black/20 rounded-lg p-3 mb-3">
                        <div class="grid grid-cols-3 gap-2 text-center text-sm">
                            <div>
                                <p class="text-gray-400 text-xs">Tendencia</p>
                                <p class="text-white font-bold">${safeTrend}</p>
                            </div>
                            <div>
                                <p class="text-gray-400 text-xs">Línea</p>
                                <p class="text-white font-bold">${safeLine}</p>
                            </div>
                            <div>
                                <p class="text-gray-400 text-xs">EV</p>
                                <p class="font-bold ${evClass}">${safeEv !== '' ? (parseFloat(safeEv) >= 0 ? '+' : '') + safeEv + '%' : '-'}</p>
                            </div>
                        </div>
                        <p class="text-gray-500 text-xs mt-2 text-center">⏱️ Detectado ${timeAgo}</p>
                    </div>

                    <div class="grid grid-cols-3 gap-2">
                        <button onclick="analyzeFromValuePick('${safeId}')" class="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-bold">
                            📊 Analizar
                        </button>
                        <button onclick="registerFromValuePick('${safeId}')" class="bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-bold">
                            ✅ Registrar
                        </button>
                        <button onclick="removeValuePick('${safeId}')" class="bg-red-600/50 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-bold">
                            🗑️ Descartar
                        </button>
                    </div>
                </div>
            `;
        });
    }

    return `
        <div class="p-4 max-w-4xl mx-auto">
            <button onclick="navigateTo('home')" aria-label="Ir al inicio" class="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg mb-4">← Volver</button>

            <div class="text-center mb-6">
                <div class="logo-container justify-center mb-2">
                    ${LOGO_SVG}
                    <h1 class="text-3xl font-bold text-white font-orbitron">🔥 VALOR DETECTADO</h1>
                </div>
                <p class="text-gray-400 text-sm">Picks de alto valor detectados automáticamente</p>
                ${VALUE_PICKS.length > 0 ? `<p class="text-purple-400 text-sm mt-1">${VALUE_PICKS.length} pick${VALUE_PICKS.length > 1 ? 's' : ''} guardado${VALUE_PICKS.length > 1 ? 's' : ''}</p>` : ''}
            </div>

            ${VALUE_PICKS.length > 1 ? `
                <div class="flex justify-end mb-4">
                    <button onclick="clearAllValuePicks()" class="text-red-400 hover:text-red-300 text-sm flex items-center gap-1">
                        🗑️ Limpiar todo
                    </button>
                </div>
            ` : ''}

            <div class="glass rounded-xl p-4">
                ${picksHtml}
            </div>

            <div class="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                <p class="text-blue-400 text-sm">💡 <strong>Tip:</strong> Los picks se guardan automáticamente cuando la calculadora detecta probabilidad ≥70%. Se eliminan después de 24 horas.</p>
            </div>

            <div class="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                <p class="text-yellow-400 text-sm">⚠️ <strong>Disclaimer:</strong> Estas sugerencias son basadas en análisis estadístico. Siempre haz tu propia investigación y apuesta responsablemente.</p>
            </div>
        </div>
    `;
}

// Función auxiliar para calcular tiempo transcurrido
function getTimeAgo(dateString) {
    const now = new Date();
    const detected = new Date(dateString);
    const diffMs = now - detected;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return 'hace un momento';
    if (diffMins < 60) return `hace ${diffMins} min`;
    if (diffHours < 24) return `hace ${diffHours}h`;
    return 'hace más de 24h';
}

function selectBestPick(local, away) {
    localTeam = local;
    visitingTeam = away;
    navigateTo('tendencia');
}

function registerPick(period, betType, line, probability, oddsFromForm) {
    let odds = oddsFromForm ? parseFloat(oddsFromForm) : null;

    // Si no hay cuota del formulario, pedirla
    if (!odds || odds <= 1) {
        const oddsInput = prompt('Ingresa la cuota (ej: 1.85):');
        if (oddsInput === null) return;
        odds = parseFloat(oddsInput) || null;
    }

    // Calcular EV para guardar
    const ev = odds ? calcEV(probability, odds) : null;

    addPick({
        localTeam,
        awayTeam: visitingTeam,
        period,
        betType,
        line,
        probability,
        odds,
        ev // Guardar EV para análisis posterior
    });
}

// Registrar Bet Builder (picks combinados)
function registerBetBuilder() {
    const comboOdds = document.getElementById('combo_odds')?.value;
    if (!comboOdds || parseFloat(comboOdds) <= 1) {
        showNotification('warning', 'Error', 'Ingresa la cuota combinada del Bet Builder');
        return;
    }

    const odds = parseFloat(comboOdds);
    const legs = []; // Patas del bet builder
    let combinedProb = 1; // Probabilidad combinada (multiplicar)

    // Verificar cuáles están seleccionados
    const q1Checked = document.getElementById('combo_q1')?.checked;
    const halfChecked = document.getElementById('combo_half')?.checked;
    const fullChecked = document.getElementById('combo_full')?.checked;

    // Agregar Q1 si está seleccionado
    if (q1Checked && lineQ1) {
        const prob = calcProb(
            (TEAM_STATS[localTeam]?.q1Home || 0) + (TEAM_STATS[visitingTeam]?.q1Away || 0),
            lineQ1, typeQ1
        );
        if (prob) {
            legs.push({ period: '1Q', betType: typeQ1, line: lineQ1, probability: prob });
            combinedProb *= (prob / 100);
        }
    }

    // Agregar 1H si está seleccionado
    if (halfChecked && lineHalf) {
        const prob = calcProb(
            (TEAM_STATS[localTeam]?.halfHome || 0) + (TEAM_STATS[visitingTeam]?.halfAway || 0),
            lineHalf, typeHalf
        );
        if (prob) {
            legs.push({ period: '1H', betType: typeHalf, line: lineHalf, probability: prob });
            combinedProb *= (prob / 100);
        }
    }

    // Agregar FULL si está seleccionado
    if (fullChecked && lineFull) {
        const prob = calcProb(
            (TEAM_STATS[localTeam]?.fullHome || 0) + (TEAM_STATS[visitingTeam]?.fullAway || 0),
            lineFull, typeFull
        );
        if (prob) {
            legs.push({ period: 'FULL', betType: typeFull, line: lineFull, probability: prob });
            combinedProb *= (prob / 100);
        }
    }

    if (legs.length < 2) {
        showNotification('warning', 'Error', 'Selecciona al menos 2 picks para el Bet Builder');
        return;
    }

    // Calcular probabilidad combinada y EV
    const combinedProbPercent = Math.round(combinedProb * 100);
    const ev = calcEV(combinedProbPercent, odds);

    // Crear descripción del combo
    const comboDesc = legs.map(l => `${l.period} ${l.betType} ${l.line}`).join(' + ');

    addPick({
        localTeam,
        awayTeam: visitingTeam,
        period: 'COMBO',
        betType: 'BET BUILDER',
        line: comboDesc,
        probability: combinedProbPercent,
        odds,
        ev,
        legs, // Guardar detalles de cada pata
        isCombo: true
    });

    showNotification(`🔥 Bet Builder registrado: ${legs.length} picks combinados`, 'success');
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD PRO - GRÁFICOS Y ANÁLISIS AVANZADO
// ═══════════════════════════════════════════════════════════════
let profitChart = null;

function renderDashboard() {
    try {
        const stats = getPicksStats();
        const picks = Object.values(PICKS_DATABASE).filter(p => p.status !== 'pending').sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        // Calcular profit acumulado para el gráfico
        let profitAcum = 0;
        const profitData = picks.map(pick => {
            if (pick.status === 'win') {
                profitAcum += (pick.odds - 1);
            } else if (pick.status === 'loss') {
                profitAcum -= 1;
            }
            return {
                date: new Date(pick.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
                profit: parseFloat(profitAcum.toFixed(2)),
                status: pick.status
            };
        });

        // Calcular rendimiento por equipo
        const teamStats = {};
        picks.forEach(pick => {
            const teams = [pick.localTeam, pick.awayTeam];
            teams.forEach(team => {
                if (!team) return;
                if (!teamStats[team]) teamStats[team] = { wins: 0, losses: 0, profit: 0 };
                if (pick.status === 'win') {
                    teamStats[team].wins++;
                    teamStats[team].profit += (pick.odds - 1);
                } else if (pick.status === 'loss') {
                    teamStats[team].losses++;
                    teamStats[team].profit -= 1;
                }
            });
        });

        // Top 5 equipos más rentables
        const topTeams = Object.entries(teamStats)
            .map(([team, data]) => ({
                team,
                ...data,
                winRate: data.wins + data.losses > 0 ? ((data.wins / (data.wins + data.losses)) * 100).toFixed(0) : 0,
                total: data.wins + data.losses
            }))
            .filter(t => t.total >= 2)
            .sort((a, b) => b.profit - a.profit)
            .slice(0, 8);

        // CLV Stats (si tenemos datos)
        const picksWithCLV = Object.values(PICKS_DATABASE).filter(p => p.closingLine && p.line);
        let avgCLV = 0;
        if (picksWithCLV.length > 0) {
            const totalCLV = picksWithCLV.reduce((sum, p) => {
                const clv = parseFloat(p.line) - parseFloat(p.closingLine);
                return sum + (p.betType === 'OVER' ? clv : -clv);
            }, 0);
            avgCLV = (totalCLV / picksWithCLV.length).toFixed(2);
        }

        // Análisis por cuartos extendido (Q2, Q3, Q4)
        const quarterAnalysis = {
            '1Q': { wins: 0, losses: 0, profit: 0 },
            '2Q': { wins: 0, losses: 0, profit: 0 },
            '3Q': { wins: 0, losses: 0, profit: 0 },
            '4Q': { wins: 0, losses: 0, profit: 0 },
            '1H': { wins: 0, losses: 0, profit: 0 },
            '2H': { wins: 0, losses: 0, profit: 0 },
            'FULL': { wins: 0, losses: 0, profit: 0 }
        };

        picks.forEach(pick => {
            const period = pick.period;
            if (quarterAnalysis[period]) {
                if (pick.status === 'win') {
                    quarterAnalysis[period].wins++;
                    quarterAnalysis[period].profit += (pick.odds - 1);
                } else {
                    quarterAnalysis[period].losses++;
                    quarterAnalysis[period].profit -= 1;
                }
            }
        });

        const teamStatsHtml = topTeams.length > 0 ? topTeams.map(t => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); border-radius: 10px; padding: 12px 14px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.05);">
            <div>
                <span style="font-weight: 800; color: #fff;">${t.team}</span>
                <span style="color: rgba(255,255,255,0.35); font-size: 12px; margin-left: 8px;">(${t.total} picks)</span>
            </div>
            <div style="display: flex; align-items: center; gap: 16px;">
                <span style="font-size: 13px; font-weight: 700; color: ${parseFloat(t.winRate) >= 55 ? 'var(--emerald)' : parseFloat(t.winRate) >= 45 ? 'var(--amber)' : 'var(--rose)'};">${t.winRate}%</span>
                <span style="font-weight: 800; font-family: var(--font-mono); color: ${t.profit >= 0 ? 'var(--emerald)' : 'var(--rose)'};">${t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}u</span>
            </div>
        </div>
    `).join('') : '<p style="color: rgba(255,255,255,0.4); text-align: center; padding: 16px 0;">Necesitas más picks para ver estadísticas por equipo</p>';

        return `
        <div class="nio-section">
            <button onclick="navigateTo('home')" aria-label="Ir al inicio" class="nio-back">← Volver</button>

            <div class="nio-header">
                <div class="nio-header-icon">📉</div>
                <div class="nio-header-content">
                    <h1 class="nio-header-title">Dashboard Pro</h1>
                    <p class="nio-header-subtitle">Análisis avanzado de rendimiento</p>
                </div>
            </div>

            <!-- RESUMEN RÁPIDO -->
            <div class="nio-grid nio-grid-4 nio-stagger" style="margin-bottom: 28px;">
                <div class="nio-stat" style="border-color: rgba(52, 211, 153, 0.15);">
                    <span class="nio-stat-icon">🎯</span>
                    <div class="nio-stat-value text-emerald">${stats.winRate}%</div>
                    <div class="nio-stat-label">Win Rate</div>
                </div>
                <div class="nio-stat" style="border-color: rgba(34, 211, 238, 0.15);">
                    <span class="nio-stat-icon">💰</span>
                    <div class="nio-stat-value" style="color: ${parseFloat(stats.profit) >= 0 ? 'var(--cyan)' : 'var(--rose)'};">${parseFloat(stats.profit) >= 0 ? '+' : ''}${stats.profit}u</div>
                    <div class="nio-stat-label">Profit</div>
                </div>
                <div class="nio-stat" style="border-color: rgba(167, 139, 250, 0.15);">
                    <span class="nio-stat-icon">📊</span>
                    <div class="nio-stat-value" style="color: ${parseFloat(stats.roi) >= 0 ? 'var(--violet)' : 'var(--rose)'};">${parseFloat(stats.roi) >= 0 ? '+' : ''}${stats.roi}%</div>
                    <div class="nio-stat-label">ROI</div>
                </div>
                <div class="nio-stat" style="border-color: rgba(255, 215, 0, 0.15);">
                    <span class="nio-stat-icon">📋</span>
                    <div class="nio-stat-value text-gold">${picks.length}</div>
                    <div class="nio-stat-label">Picks</div>
                </div>
            </div>

            <!-- GRÁFICO DE PROFIT ACUMULADO -->
            <div class="nio-card" style="margin-bottom: 24px;">
                <h3 style="font-family: var(--font-display); font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 16px;">📈 Evolución de Profit</h3>
                <div style="height: 220px;">
                    <canvas id="profitChart"></canvas>
                </div>
                ${picks.length < 3 ? '<p style="color: rgba(255,255,255,0.4); text-align: center; font-size: 13px; margin-top: 8px;">Necesitas al menos 3 picks resueltos para ver el gráfico</p>' : ''}
            </div>

            <!-- CLV TRACKER -->
            <div class="nio-card" style="margin-bottom: 24px; border-color: rgba(167, 139, 250, 0.12);">
                <h3 style="font-family: var(--font-display); font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 8px;">🎯 CLV Tracker</h3>
                <p style="font-size: 13px; color: rgba(255,255,255,0.45); margin-bottom: 16px;">Closing Line Value — <strong style="color: var(--gold);">CLV positivo = pensás como un sharp.</strong></p>

                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px;">
                    <div class="nio-stat" style="padding: 14px;">
                        <div class="nio-stat-value" style="font-size: 22px; color: ${parseFloat(avgCLV) >= 0 ? 'var(--emerald)' : 'var(--rose)'};">${avgCLV > 0 ? '+' : ''}${avgCLV} pts</div>
                        <div class="nio-stat-label">CLV Promedio</div>
                    </div>
                    <div class="nio-stat" style="padding: 14px;">
                        <div class="nio-stat-value text-cyan" style="font-size: 22px;">${picksWithCLV.length}</div>
                        <div class="nio-stat-label">Picks con CLV</div>
                    </div>
                </div>

                <div style="background: rgba(255, 215, 0, 0.04); border-radius: 10px; padding: 12px 14px; border: 1px solid rgba(255, 215, 0, 0.1);">
                    <p style="color: var(--gold); font-size: 12px;">💡 <strong>Tip:</strong> En "Mis Picks" puedes agregar la línea de cierre a cada pick para calcular tu CLV.</p>
                </div>
            </div>

            <!-- RENDIMIENTO POR EQUIPO -->
            <div class="nio-card" style="margin-bottom: 24px;">
                <h3 style="font-family: var(--font-display); font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 16px;">🏀 Rendimiento por Equipo</h3>
                ${teamStatsHtml}
            </div>

            <!-- ANÁLISIS POR PERÍODO -->
            <div class="nio-card" style="margin-bottom: 24px; border-color: rgba(167, 139, 250, 0.12);">
                <h3 style="font-family: var(--font-display); font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 16px;">📊 Rendimiento por Período</h3>
                <div class="nio-grid" style="grid-template-columns: repeat(3, 1fr); gap: 12px;">
                    ${['1Q', '1H', 'FULL'].map(p => {
            const data = quarterAnalysis[p];
            const total = data.wins + data.losses;
            const wr = total > 0 ? ((data.wins / total) * 100).toFixed(0) : '-';
            const wrNum = total > 0 ? (data.wins / total) * 100 : 0;
            return `
                            <div class="nio-stat" style="border-color: rgba(255, 215, 0, 0.1);">
                                <div style="font-family: var(--font-display); font-weight: 800; font-size: 18px; color: var(--gold); margin-bottom: 4px;">${p}</div>
                                <div style="font-size: 13px; font-weight: 700; color: #fff;">${data.wins}W-${data.losses}L</div>
                                <div class="nio-stat-value" style="font-size: 22px; color: ${total > 0 && wrNum >= 50 ? 'var(--emerald)' : total > 0 ? 'var(--rose)' : 'rgba(255,255,255,0.3)'};">${wr}%</div>
                                <div style="font-size: 12px; font-weight: 700; font-family: var(--font-mono); color: ${data.profit >= 0 ? 'var(--emerald)' : 'var(--rose)'};">${data.profit >= 0 ? '+' : ''}${data.profit.toFixed(2)}u</div>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>

            <!-- ANÁLISIS DE PATRONES PERSONALES -->
            <div class="nio-card" style="margin-bottom: 24px; border-color: rgba(52, 211, 153, 0.12);">
                <h3 style="font-family: var(--font-display); font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 8px;">📊 Análisis de Patrones</h3>
                <p style="font-size: 13px; color: rgba(255,255,255,0.45); margin-bottom: 16px;">Análisis de tus picks históricos para identificar tus fortalezas y áreas de mejora.</p>

                <div style="background: rgba(255,255,255,0.02); border-radius: 12px; padding: 16px; border: 1px solid rgba(255,255,255,0.04);">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 16px;">
                        <div>
                            <p style="color: var(--emerald); font-weight: 800; font-size: 14px; margin-bottom: 8px;">Lo que analizo:</p>
                            <ul style="color: rgba(255,255,255,0.6); font-size: 12px; list-style: none; padding: 0; line-height: 1.8;">
                                <li>• Períodos más rentables</li>
                                <li>• OVER vs UNDER performance</li>
                                <li>• Equipos donde aciertas más</li>
                                <li>• Rachas y consistencia</li>
                                <li>• ROI por tipo de apuesta</li>
                            </ul>
                        </div>
                        <div style="text-align: center;">
                            <p style="color: var(--emerald); font-weight: 800; font-size: 14px; margin-bottom: 8px;">Datos:</p>
                            <div style="font-size: 40px; font-weight: 800; font-family: var(--font-mono); color: #fff;">${picks.length}</div>
                            <div style="font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 4px;">picks analizados</div>
                        </div>
                    </div>
                    ${picks.length >= 10 ? `
                        <div style="background: rgba(52, 211, 153, 0.08); border-radius: 10px; padding: 10px 14px; border: 1px solid rgba(52, 211, 153, 0.15);">
                            <p style="color: var(--emerald); font-size: 12px; text-align: center;">✅ Suficientes datos. Revisa las secciones anteriores para ver tus patrones.</p>
                        </div>
                    ` : `
                        <div style="background: rgba(255, 215, 0, 0.04); border-radius: 10px; padding: 10px 14px; border: 1px solid rgba(255, 215, 0, 0.1);">
                            <p style="color: var(--gold); font-size: 12px; text-align: center;">📊 Registra al menos 10 picks para obtener análisis más precisos.</p>
                        </div>
                    `}
                </div>
            </div>

            <!-- CRÉDITOS -->
            <div style="background: rgba(255,255,255,0.02); border-radius: 12px; padding: 16px; text-align: center; border: 1px solid rgba(255,255,255,0.04);">
                <p style="color: rgba(255,255,255,0.35); font-size: 12px;">NioSports Pro v2.0 - Modelo Predictivo Avanzado</p>
                <p style="color: rgba(255,255,255,0.2); font-size: 11px; margin-top: 4px;">Backtesting, B2B, PACE, Calibración, CLV Tracker</p>
            </div>

            <!-- BACKTESTING & CALIBRACIÓN -->
            ${(() => {
                const backtest = getBacktestStats();
                if (!backtest || backtest.totalPicks < 5) {
                    return `
                    <div class="nio-card" style="margin-top: 24px; border-color: rgba(255, 215, 0, 0.12);">
                        <h3 style="font-family: var(--font-display); font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 12px;">🔬 Backtesting & Calibración</h3>
                        <p style="color: var(--amber); font-size: 14px; text-align: center; padding: 24px 0;">
                            Necesitas al menos 5 picks con resultado registrado para ver el análisis de backtesting.<br>
                            <span style="font-size: 12px; color: rgba(255,255,255,0.35); margin-top: 8px; display: block;">Usa el botón "📊 Resultado" en cada pick para registrar el total real del partido.</span>
                        </p>
                    </div>`;
                }

                return `
                <div class="nio-card" style="margin-top: 24px; border-color: rgba(255, 215, 0, 0.12);">
                    <h3 style="font-family: var(--font-display); font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 16px;">🔬 Backtesting & Calibración del Modelo</h3>

                    <!-- Resumen de Precisión -->
                    <div class="nio-grid nio-grid-4 nio-stagger" style="margin-bottom: 16px;">
                        <div class="nio-stat" style="padding: 14px;">
                            <div class="nio-stat-value" style="font-size: 22px; color: ${parseFloat(backtest.overallHitRate) >= 52.38 ? 'var(--emerald)' : 'var(--rose)'};">${backtest.overallHitRate}%</div>
                            <div class="nio-stat-label">Hit Rate Real</div>
                            <div style="font-size: 11px; color: ${parseFloat(backtest.overallHitRate) >= 52.38 ? 'var(--emerald)' : 'var(--rose)'}; margin-top: 2px;">${parseFloat(backtest.overallHitRate) >= 52.38 ? '✓ Rentable' : '✗ < 52.38%'}</div>
                        </div>
                        <div class="nio-stat" style="padding: 14px;">
                            <div class="nio-stat-value text-cyan" style="font-size: 22px;">${backtest.avgModelError || '-'}</div>
                            <div class="nio-stat-label">Error Promedio</div>
                            <div style="font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 2px;">pts vs real</div>
                        </div>
                        <div class="nio-stat" style="padding: 14px;">
                            <div class="nio-stat-value" style="font-size: 22px; color: ${parseFloat(backtest.roi) >= 0 ? 'var(--emerald)' : 'var(--rose)'};">${backtest.roi}%</div>
                            <div class="nio-stat-label">ROI</div>
                            <div style="font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 2px;">${backtest.totalPicks} picks</div>
                        </div>
                        <div class="nio-stat" style="padding: 14px;">
                            <div class="nio-stat-value text-gold" style="font-size: 22px;">${backtest.totalWins}/${backtest.totalWins + backtest.totalLosses}</div>
                            <div class="nio-stat-label">Win/Total</div>
                            <div style="font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 2px;">${backtest.totalPushes} pushes</div>
                        </div>
                    </div>

                    <!-- Hit Rate por Período -->
                    <div style="background: rgba(255,255,255,0.02); border-radius: 12px; padding: 16px; margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.04);">
                        <h4 style="font-weight: 800; color: #fff; margin-bottom: 12px; font-size: 15px;">📊 Precisión por Período</h4>
                        <div class="nio-grid" style="grid-template-columns: repeat(3, 1fr); gap: 10px;">
                            ${backtest.byPeriod.filter(p => p.wins + p.losses > 0).map(p => `
                                <div class="nio-stat" style="padding: 12px;">
                                    <div style="font-weight: 800; color: #fff; font-size: 14px;">${p.period}</div>
                                    <div class="nio-stat-value" style="font-size: 22px; color: ${parseFloat(p.hitRate) >= 52.38 ? 'var(--emerald)' : parseFloat(p.hitRate) >= 45 ? 'var(--amber)' : 'var(--rose)'};">${p.hitRate}%</div>
                                    <div style="font-size: 11px; color: rgba(255,255,255,0.4);">${p.wins}W - ${p.losses}L</div>
                                    ${p.avgError !== '-' ? `<div style="font-size: 11px; color: var(--cyan);">±${p.avgError} pts error</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Gráfico de Calibración -->
                    ${backtest.calibration.length >= 2 ? `
                    <div style="background: rgba(255,255,255,0.02); border-radius: 12px; padding: 16px; margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.04);">
                        <h4 style="font-weight: 800; color: #fff; margin-bottom: 12px; font-size: 15px;">🎯 Calibración del Modelo</h4>
                        <p style="font-size: 12px; color: rgba(255,255,255,0.35); margin-bottom: 12px;">Cuando el modelo dice X%, ¿acierta X%? Una línea diagonal perfecta = modelo bien calibrado.</p>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${backtest.calibration.map(c => {
                    const diff = c.actualHitRate - c.avgPredicted;
                    const isCalibrated = Math.abs(diff) < 10;
                    return `
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <span style="color: #fff; font-size: 13px; width: 48px; font-family: var(--font-mono);">${c.range}%</span>
                                    <div style="flex: 1; background: rgba(255,255,255,0.06); border-radius: 50px; height: 16px; position: relative; overflow: hidden;">
                                        <div style="position: absolute; height: 16px; border-radius: 50px; background: ${isCalibrated ? 'var(--emerald)' : diff > 0 ? 'var(--cyan)' : 'var(--rose)'}; width: ${Math.min(100, c.actualHitRate)}%;"></div>
                                        <div style="position: absolute; height: 16px; width: 2px; background: var(--gold); left: ${c.avgPredicted}%;"></div>
                                    </div>
                                    <span style="font-size: 11px; color: ${isCalibrated ? 'var(--emerald)' : diff > 0 ? 'var(--cyan)' : 'var(--rose)'}; width: 80px; text-align: right; font-family: var(--font-mono);">
                                        Real: ${c.actualHitRate.toFixed(0)}% (${c.count})
                                    </span>
                                </div>`;
                }).join('')}
                        </div>
                        <p style="font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 8px; text-align: center;">🟡 = Predicción | Barra = Hit Rate Real | (n) = muestra</p>
                    </div>
                    ` : '<p style="color: rgba(255,255,255,0.4); font-size: 12px; text-align: center; margin-bottom: 16px;">Necesitas más picks por rango de probabilidad para ver calibración</p>'}

                    <!-- Botón Exportar -->
                    <div style="display: flex; justify-content: center;">
                        <button onclick="exportPicksToCSV()" class="nio-btn nio-btn-success">
                            📥 Exportar a CSV
                        </button>
                    </div>
                </div>`;
            })()}
        </div>
    `;
    } catch (error) {
        logger.error('Error en renderDashboard:', error);
        return `
            <div class="nio-section">
                <button onclick="navigateTo('home')" aria-label="Ir al inicio" class="nio-back">← Volver</button>
                <div class="nio-card" style="text-align: center; border-color: rgba(244, 63, 94, 0.2);">
                    <span style="font-size: 48px; display: block; margin-bottom: 16px;">⚠️</span>
                    <p style="color: var(--rose); font-size: 18px; font-weight: 800; margin-bottom: 8px;">Error al cargar Dashboard</p>
                    <p style="color: rgba(255,255,255,0.5); font-size: 14px;">${error.message}</p>
                </div>
            </div>
        `;
    }
}

// Inicializar gráficos del Dashboard
function initDashboardCharts() {
    const picks = Object.values(PICKS_DATABASE).filter(p => p.status !== 'pending').sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    if (picks.length < 3) return;

    // Calcular datos para el gráfico
    let profitAcum = 0;
    const labels = [];
    const data = [];
    const colors = [];

    picks.forEach((pick, i) => {
        if (pick.status === 'win') {
            profitAcum += (pick.odds - 1);
            colors.push('rgba(34, 197, 94, 0.8)');
        } else if (pick.status === 'loss') {
            profitAcum -= 1;
            colors.push('rgba(239, 68, 68, 0.8)');
        }
        labels.push(`#${i + 1}`);
        data.push(parseFloat(profitAcum.toFixed(2)));
    });

    // Crear gráfico de línea
    const ctx = document.getElementById('profitChart');
    if (!ctx) return;

    // Destruir gráfico anterior si existe
    if (profitChart) {
        profitChart.destroy();
    }

    profitChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Profit Acumulado (u)',
                data: data,
                borderColor: profitAcum >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
                backgroundColor: profitAcum >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                fill: true,
                tension: 0.3,
                pointBackgroundColor: colors,
                pointBorderColor: colors,
                pointRadius: 5,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `Profit: ${context.raw >= 0 ? '+' : ''}${context.raw}u`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        callback: function (value) {
                            return value + 'u';
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                }
            }
        }
    });
}

// ═══════════════════════════════════════════════════════════════
// INGESTA VIEW
// ═══════════════════════════════════════════════════════════════
function renderIngesta() {
    const teams = getTeams();
    const existH2H = ingestTeam1 && ingestTeam2 ? getH2HData(ingestTeam1, ingestTeam2) : null;

    let o1 = '<option value="">Seleccionar...</option>';
    let o2 = '<option value="">Seleccionar...</option>';
    teams.forEach(t => {
        o1 += `<option value="${t}"${t === ingestTeam1 ? ' selected' : ''}>${t}</option>`;
        if (t !== ingestTeam1) o2 += `<option value="${t}"${t === ingestTeam2 ? ' selected' : ''}>${t}</option>`;
    });

    let html = `
        <div class="p-4 max-w-4xl mx-auto">
            <button onclick="navigateTo('home')" aria-label="Ir al inicio" class="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg mb-4">← Volver</button>
            <div class="text-center mb-6">
                <div class="logo-container justify-center mb-2">
                    ${LOGO_SVG}
                    <h1 class="text-3xl font-bold text-white font-orbitron">INGESTA H2H</h1>
                </div>
                <p class="text-green-400 text-sm mt-2">☁️ Los datos se guardan en Firebase automáticamente</p>
            </div>

            <div class="glass rounded-xl p-5 mb-6">
                <h2 class="text-lg font-bold text-white mb-4">1️⃣ Seleccionar Equipos</h2>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="text-gray-400 text-sm mb-1 block">Equipo 1</label>
                        <select id="ingestTeam1" class="w-full p-3 font-bold rounded-lg text-white bg-white/10 border border-white/20">${o1}</select>
                    </div>
                    <div>
                        <label class="text-gray-400 text-sm mb-1 block">Equipo 2</label>
                        <select id="ingestTeam2" class="w-full p-3 font-bold rounded-lg text-white bg-white/10 border border-white/20">${o2}</select>
                    </div>
                </div>
            </div>
    `;

    if (ingestTeam1 && ingestTeam2) {
        html += `
            <div class="glass rounded-xl p-5 mb-6">
                <h2 class="text-lg font-bold text-white mb-4">2️⃣ Fecha y Localía</h2>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="text-gray-400 text-sm mb-1 block">Fecha del Partido</label>
                        <input type="date" id="ingestDate" value="${ingestDate}" class="w-full p-3 font-bold rounded-lg text-white bg-white/10 border border-white/20">
                    </div>
                    <div>
                        <label class="text-gray-400 text-sm mb-1 block">¿Quién es LOCAL? 🏠</label>
                        <select id="ingestLocal" class="w-full p-3 font-bold rounded-lg text-white bg-white/10 border border-white/20">
                            <option value="">Seleccionar...</option>
                            <option value="${ingestTeam1}"${ingestLocalTeam === ingestTeam1 ? ' selected' : ''}>${ingestTeam1}</option>
                            <option value="${ingestTeam2}"${ingestLocalTeam === ingestTeam2 ? ' selected' : ''}>${ingestTeam2}</option>
                        </select>
                    </div>
                </div>
            </div>
        `;

        if (ingestLocalTeam && ingestDate) {
            html += `
                <div class="bg-slate-800 rounded-2xl p-5 mb-6 border border-slate-600">
                    <h2 class="text-lg font-bold text-white mb-4 text-center">3️⃣ Puntos por Cuarto</h2>
                    <div class="score-grid">${renderScoreInputs()}</div>
                    ${renderTotals()}
                </div>
                <button onclick="saveGame()" class="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-4 rounded-xl text-xl hover:scale-[1.02] transition mb-6">💾 GUARDAR EN FIREBASE</button>
            `;
        }

        if (existH2H) {
            let gh = existH2H.games.map((g, i) => `
                <div class="bg-slate-800/50 rounded-lg p-3 flex justify-between items-center">
                    <div>
                        <p class="text-gray-400 text-xs">${g.date}${g.overtimes > 0 ? ` <span class="text-yellow-400">(${g.overtimes}OT)</span>` : ''}</p>
                        <p class="text-white font-bold">${g.localTeam} ${g.t1Total}-${g.t2Total} ${g.awayTeam}</p>
                        <p class="text-gray-500 text-xs">1H: ${g.t1Half}-${g.t2Half} | Total: ${g.totalPts}</p>
                    </div>
                    <button onclick="deleteGame('${ingestTeam1}','${ingestTeam2}',${i})" class="text-red-400 hover:text-red-300 text-xl">🗑️</button>
                </div>
            `).join('');

            html += `
                <div class="glass rounded-xl p-5">
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-lg font-bold text-white">📋 Historial ${ingestTeam1} vs ${ingestTeam2}</h2>
                        <span class="text-sm text-purple-400">${existH2H.totalGames} partidos</span>
                    </div>
                    <div class="bg-purple-900/30 rounded-lg p-3 mb-4">
                        <div class="grid grid-cols-3 gap-2 text-center text-sm">
                            <div><p class="text-gray-400">Prom 1Q</p><p class="text-white font-bold">${(existH2H.avgQ1.team1 + existH2H.avgQ1.team2).toFixed(1)}</p></div>
                            <div><p class="text-gray-400">Prom 1H</p><p class="text-white font-bold">${(existH2H.avgHalf.team1 + existH2H.avgHalf.team2).toFixed(1)}</p></div>
                            <div><p class="text-gray-400">Prom Full</p><p class="text-white font-bold">${(existH2H.avgPts.team1 + existH2H.avgPts.team2).toFixed(1)}</p></div>
                        </div>
                    </div>
                    <div class="space-y-2 max-h-64 overflow-y-auto">${gh}</div>
                </div>
            `;
        } else if (ingestTeam1 && ingestTeam2) {
            html += `<div class="glass rounded-xl p-5 text-center"><p class="text-gray-400">No hay partidos registrados</p></div>`;
        }
    }

    html += '</div>';
    return html;
}

function renderScoreInputs() {
    const away = ingestLocalTeam === ingestTeam1 ? ingestTeam2 : ingestTeam1;
    const ot = checkOT();
    let cols = 5;
    if (ot.needOT1) cols++;
    if (ot.needOT2) cols++;
    if (ot.needOT3) cols++;

    const gs = `display:grid;grid-template-columns:80px repeat(${cols - 1},minmax(50px,1fr));gap:0.4rem;`;

    let h = `<div style="${gs}" class="mb-3 text-center items-center">
        <div class="text-gray-500 text-xs font-bold">EQUIPO</div>
        <div class="text-gray-400 text-xs font-bold">1° C</div>
        <div class="text-gray-400 text-xs font-bold">2° C</div>
        <div class="text-gray-400 text-xs font-bold">3° C</div>
        <div class="text-gray-400 text-xs font-bold">4° C</div>`;
    if (ot.needOT1) h += `<div class="text-yellow-400 text-xs font-bold animate-pulse">OT1</div>`;
    if (ot.needOT2) h += `<div class="text-orange-400 text-xs font-bold animate-pulse">OT2</div>`;
    if (ot.needOT3) h += `<div class="text-red-400 text-xs font-bold animate-pulse">OT3</div>`;
    h += '</div>';

    let lr = `<div style="${gs}" class="mb-3 items-center">
        <div class="text-cyan-400 font-bold text-xs truncate">🏠 ${ingestLocalTeam}</div>
        <input type="number" id="localQ1" value="${ingestScores.localQ1}" placeholder="0" class="score-input p-2 rounded-lg text-white text-center text-lg font-bold w-full" oninput="updateScore('localQ1',this.value)">
        <input type="number" id="localQ2" value="${ingestScores.localQ2}" placeholder="0" class="score-input p-2 rounded-lg text-white text-center text-lg font-bold w-full" oninput="updateScore('localQ2',this.value)">
        <input type="number" id="localQ3" value="${ingestScores.localQ3}" placeholder="0" class="score-input p-2 rounded-lg text-white text-center text-lg font-bold w-full" oninput="updateScore('localQ3',this.value)">
        <input type="number" id="localQ4" value="${ingestScores.localQ4}" placeholder="0" class="score-input p-2 rounded-lg text-white text-center text-lg font-bold w-full" oninput="updateScore('localQ4',this.value)">`;
    if (ot.needOT1) lr += `<input type="number" id="localOT1" value="${ingestScores.localOT1}" placeholder="0" class="score-input ot-input p-2 rounded-lg text-yellow-400 text-center text-lg font-bold w-full" oninput="updateScore('localOT1',this.value)">`;
    if (ot.needOT2) lr += `<input type="number" id="localOT2" value="${ingestScores.localOT2}" placeholder="0" class="score-input p-2 rounded-lg text-orange-400 text-center text-lg font-bold border-orange-500 w-full" oninput="updateScore('localOT2',this.value)">`;
    if (ot.needOT3) lr += `<input type="number" id="localOT3" value="${ingestScores.localOT3}" placeholder="0" class="score-input p-2 rounded-lg text-red-400 text-center text-lg font-bold border-red-500 w-full" oninput="updateScore('localOT3',this.value)">`;
    lr += '</div>';

    let ar = `<div style="${gs}" class="mb-4 items-center">
        <div class="text-orange-400 font-bold text-xs truncate">✈️ ${away}</div>
        <input type="number" id="awayQ1" value="${ingestScores.awayQ1}" placeholder="0" class="score-input p-2 rounded-lg text-white text-center text-lg font-bold w-full" oninput="updateScore('awayQ1',this.value)">
        <input type="number" id="awayQ2" value="${ingestScores.awayQ2}" placeholder="0" class="score-input p-2 rounded-lg text-white text-center text-lg font-bold w-full" oninput="updateScore('awayQ2',this.value)">
        <input type="number" id="awayQ3" value="${ingestScores.awayQ3}" placeholder="0" class="score-input p-2 rounded-lg text-white text-center text-lg font-bold w-full" oninput="updateScore('awayQ3',this.value)">
        <input type="number" id="awayQ4" value="${ingestScores.awayQ4}" placeholder="0" class="score-input p-2 rounded-lg text-white text-center text-lg font-bold w-full" oninput="updateScore('awayQ4',this.value)">`;
    if (ot.needOT1) ar += `<input type="number" id="awayOT1" value="${ingestScores.awayOT1}" placeholder="0" class="score-input ot-input p-2 rounded-lg text-yellow-400 text-center text-lg font-bold w-full" oninput="updateScore('awayOT1',this.value)">`;
    if (ot.needOT2) ar += `<input type="number" id="awayOT2" value="${ingestScores.awayOT2}" placeholder="0" class="score-input p-2 rounded-lg text-orange-400 text-center text-lg font-bold border-orange-500 w-full" oninput="updateScore('awayOT2',this.value)">`;
    if (ot.needOT3) ar += `<input type="number" id="awayOT3" value="${ingestScores.awayOT3}" placeholder="0" class="score-input p-2 rounded-lg text-red-400 text-center text-lg font-bold border-red-500 w-full" oninput="updateScore('awayOT3',this.value)">`;
    ar += '</div>';

    let warn = '';
    if (ot.needOT1) warn = '<div class="text-yellow-400 text-center text-sm mb-3 animate-pulse">⚠️ EMPATE DETECTADO - Ingresa puntos del Overtime</div>';

    return h + lr + ar + warn;
}

function renderTotals() {
    const s = getScores();
    const away = ingestLocalTeam === ingestTeam1 ? ingestTeam2 : ingestTeam1;
    const lH = s.lQ1 + s.lQ2, aH = s.aQ1 + s.aQ2;
    const lT = s.lQ1 + s.lQ2 + s.lQ3 + s.lQ4 + s.lOT1 + s.lOT2 + s.lOT3;
    const aT = s.aQ1 + s.aQ2 + s.aQ3 + s.aQ4 + s.aOT1 + s.aOT2 + s.aOT3;
    const hadOT = s.lOT1 > 0 || s.aOT1 > 0;
    let win = 'Empate', wc = 'color: rgba(255,255,255,0.5)';
    if (lT > aT) { win = ingestLocalTeam; wc = 'color: var(--cyan)'; }
    else if (aT > lT) { win = away; wc = 'color: var(--amber)'; }

    return `
        <div class="nio-divider"></div>
        <h3 style="font-family: var(--font-display); font-size: 18px; font-weight: 800; color: #fff; text-align: center; margin-bottom: 16px;">📊 TOTALES CALCULADOS</h3>
        <div id="totalsDisplay" class="nio-scoreboard">
            <div class="nio-score-cell" style="border-color: rgba(255, 215, 0, 0.15);">
                <div class="nio-score-label">1er Tiempo</div>
                <div class="nio-score-team" style="color: var(--cyan);">${ingestLocalTeam}: ${lH}</div>
                <div class="nio-score-team" style="color: var(--amber);">${away}: ${aH}</div>
                <div class="nio-score-total text-gold">${lH + aH}</div>
            </div>
            <div class="nio-score-cell" style="border-color: rgba(167, 139, 250, 0.15);">
                <div class="nio-score-label">Full${hadOT ? ' + OT' : ''}</div>
                <div class="nio-score-team" style="color: var(--cyan);">${ingestLocalTeam}: ${lT}</div>
                <div class="nio-score-team" style="color: var(--amber);">${away}: ${aT}</div>
                <div class="nio-score-total text-violet">${lT + aT}</div>
            </div>
            <div class="nio-score-cell ${hadOT ? 'nio-ot-glow' : ''}" style="border-color: rgba(52, 211, 153, 0.15);">
                <div class="nio-score-label">Ganador</div>
                ${hadOT ? '<span class="nio-badge nio-badge-warning" style="margin-bottom: 8px; font-size: 10px;">⏱️ OT</span>' : ''}
                <div style="font-size: 24px; font-weight: 800; font-family: var(--font-display); ${wc};">${win}</div>
                <div style="font-size: 16px; font-weight: 800; font-family: var(--font-mono); color: #fff; margin-top: 4px;">${lT}−${aT}</div>
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// NAVEGACIÓN Y EVENTOS
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// MÓDULO: MIS PICKS (Unificado v4.0)
// ═══════════════════════════════════════════════════════════════════
function renderMisPicks() {
    // Guard clauses para datos de usuario
    const picksTotal = (typeof USER_PICKS_TOTALES !== 'undefined') ? USER_PICKS_TOTALES : {};
    const picksAI = (typeof USER_PICKS_AI !== 'undefined') ? USER_PICKS_AI : {};
    const picksBacktest = (typeof USER_PICKS_BACKTESTING !== 'undefined') ? USER_PICKS_BACKTESTING : {};
    
    const allPicks = [
        ...Object.values(picksTotal).map(p => ({ ...p, type: 'Totales' })),
        ...Object.values(picksAI).map(p => ({ ...p, type: 'AI' })),
        ...Object.values(picksBacktest).map(p => ({ ...p, type: 'Backtesting' }))
    ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const pending = allPicks.filter(p => p.status === 'pending');
    const resolved = allPicks.filter(p => p.status !== 'pending');

    return `
        <div class="nio-section">
            <button onclick="navigateTo('home')" aria-label="Ir al inicio" class="nio-back">
                ← Volver al Home
            </button>
            
            <div class="nio-header">
                <div class="nio-header-icon">📋</div>
                <div class="nio-header-content">
                    <h1 class="nio-header-title">Mis Picks</h1>
                    <p class="nio-header-subtitle">Todas tus jugadas en un solo lugar</p>
                </div>
            </div>
            
            <!-- Filter Tabs -->
            <div class="nio-tabs">
                <button onclick="filterMisPicks('all')" class="nio-tab active" id="tab-all">
                    📋 Todos (${allPicks.length})
                </button>
                <button onclick="filterMisPicks('pending')" class="nio-tab" id="tab-pending">
                    ⏳ Pendientes (${pending.length})
                </button>
                <button onclick="filterMisPicks('resolved')" class="nio-tab" id="tab-resolved">
                    ✅ Resueltos (${resolved.length})
                </button>
            </div>
            
            <!-- Picks List -->
            <div style="display: flex; flex-direction: column; gap: 16px;" id="misPicksList">
                ${allPicks.length === 0 ? `
                    <div class="nio-card" style="padding: 48px 24px; text-align: center;">
                        <span class="nio-empty-icon">📊</span>
                        <h3 class="nio-empty-title">No tienes picks aún</h3>
                        <p class="nio-empty-desc" style="margin-bottom: 24px;">Empieza a usar el sistema para trackear tus jugadas</p>
                        <button onclick="navigateTo('totales')" class="nio-btn nio-btn-gold">
                            Crear mi primer pick
                        </button>
                    </div>
                ` : allPicks.map(pick => `
                    <div class="nio-card" style="padding: 20px; transition: all 0.3s ease;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span class="nio-badge ${pick.type === 'AI' ? 'nio-badge-info' : pick.type === 'Totales' ? 'nio-badge-warning' : 'nio-badge-success'}">
                                    ${pick.type}
                                </span>
                                ${pick.status === 'pending' ?
            '<span class="nio-badge nio-badge-warning"><span class="nio-badge-dot"></span> Pendiente</span>' :
            pick.status === 'win' ?
                '<span class="nio-badge nio-badge-success">✅ WIN</span>' :
                pick.status === 'loss' ?
                    '<span class="nio-badge nio-badge-danger">❌ LOSS</span>' :
                    '<span class="nio-badge nio-badge-info">↔️ PUSH</span>'
        }
                            </div>
                            <div style="font-size: 12px; color: rgba(255,255,255,0.35);">
                                ${new Date(pick.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 12px;">
                            <div style="font-size: 17px; font-weight: 800; color: #fff; font-family: var(--font-display);">
                                ${pick.local || 'N/A'} vs ${pick.away || 'N/A'}
                            </div>
                            <div style="font-size: 13px; color: rgba(255,255,255,0.45); margin-top: 4px;">
                                <span class="nio-chip">${pick.period}</span>
                                <span style="margin-left: 6px;">${pick.betType} ${pick.line}</span>
                                ${pick.prediction ? `<span style="margin-left: 6px;">• Predicción: <strong style="color: var(--gold);">${pick.prediction}</strong></span>` : ''}
                            </div>
                        </div>
                        
                        ${pick.status === 'pending' ? `
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <input type="number" step="0.5" placeholder="Resultado real" class="input-field" style="flex: 1; padding: 8px 12px; font-size: 14px;" id="result_${pick.id}">
                                <button onclick="updatePickStatus('${pick.id}', '${pick.type}')" class="nio-btn nio-btn-gold nio-btn-sm">
                                    Actualizar
                                </button>
                            </div>
                        ` : pick.actualResult ? `
                            <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 10px 14px; border: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between;">
                                <span style="font-size: 13px; color: rgba(255,255,255,0.45);">Resultado Real:</span>
                                <span style="font-size: 15px; font-weight: 800; color: #fff; font-family: var(--font-mono);">${pick.actualResult}</span>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function navigateTo(v) {
    currentView = v;
    if (v === 'home') {
        localTeam = visitingTeam = '';
        lineQ1 = lineHalf = lineFull = '';
    }
    if (v === 'ingesta' && !ingestTeam1) {
        ingestTeam1 = ingestTeam2 = ingestLocalTeam = ingestDate = '';
        ingestScores = { localQ1: '', localQ2: '', localQ3: '', localQ4: '', awayQ1: '', awayQ2: '', awayQ3: '', awayQ4: '', localOT1: '', awayOT1: '', localOT2: '', awayOT2: '', localOT3: '', awayOT3: '' };
    }
    render();

    // Sync mobile bottom nav
    if (typeof updateMobileNav === 'function') {
        const navMap = { 'home': 'home', 'totales': 'totales', 'tendencia': 'totales', 'bankroll': 'bankroll', 'mispicks': 'mispicks', 'picks': 'mispicks' };
        updateMobileNav(navMap[v] || 'home');
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToIngestWithTeams() {
    ingestTeam1 = localTeam;
    ingestTeam2 = visitingTeam;
    ingestLocalTeam = ingestDate = '';
    ingestScores = { localQ1: '', localQ2: '', localQ3: '', localQ4: '', awayQ1: '', awayQ2: '', awayQ3: '', awayQ4: '', localOT1: '', awayOT1: '', localOT2: '', awayOT2: '', localOT3: '', awayOT3: '' };
    navigateTo('ingesta');
}

function updateScore(field, value) {
    ingestScores[field] = value;
    const ot = checkOT();
    const ot1E = document.getElementById('localOT1');
    const ot2E = document.getElementById('localOT2');
    if ((ot.needOT1 && !ot1E) || (!ot.needOT1 && ot1E) || (ot.needOT2 && !ot2E) || (!ot.needOT2 && ot2E && ot.needOT1)) {
        const scrollY = window.scrollY;
        render();
        window.scrollTo(0, scrollY);
        return;
    }
    const td = document.getElementById('totalsDisplay');
    if (td) {
        const s = getScores();
        const away = ingestLocalTeam === ingestTeam1 ? ingestTeam2 : ingestTeam1;
        const lH = s.lQ1 + s.lQ2, aH = s.aQ1 + s.aQ2;
        const lT = s.lQ1 + s.lQ2 + s.lQ3 + s.lQ4 + s.lOT1 + s.lOT2 + s.lOT3;
        const aT = s.aQ1 + s.aQ2 + s.aQ3 + s.aQ4 + s.aOT1 + s.aOT2 + s.aOT3;
        const hadOT = s.lOT1 > 0 || s.aOT1 > 0;
        let win = 'Empate', wc = 'text-gray-400';
        if (lT > aT) { win = ingestLocalTeam; wc = 'text-cyan-400'; }
        else if (aT > lT) { win = away; wc = 'text-orange-400'; }
        td.innerHTML = `
            <div class="bg-yellow-500/20 rounded-lg p-3 text-center">
                <p class="text-gray-400 text-xs">1er Tiempo</p>
                <p class="text-cyan-400 font-bold">${ingestLocalTeam}: ${lH}</p>
                <p class="text-orange-400 font-bold">${away}: ${aH}</p>
                <p class="text-yellow-400 font-black text-xl mt-1">Total: ${lH + aH}</p>
            </div>
            <div class="bg-purple-500/20 rounded-lg p-3 text-center">
                <p class="text-gray-400 text-xs">Tiempo Completo${hadOT ? ' + OT' : ''}</p>
                <p class="text-cyan-400 font-bold">${ingestLocalTeam}: ${lT}</p>
                <p class="text-orange-400 font-bold">${away}: ${aT}</p>
                <p class="text-purple-400 font-black text-xl mt-1">Total: ${lT + aT}</p>
            </div>
            <div class="bg-green-500/20 rounded-lg p-3 text-center">
                <p class="text-gray-400 text-xs">Ganador${hadOT ? ' (OT)' : ''}</p>
                <p class="text-3xl font-black ${wc}">${win}</p>
                <p class="text-white font-bold">${lT}-${aT}</p>
            </div>
        `;
    }
}

function saveGame() {
    if (!firebaseConnected) {
        showNotification('warning', 'Sin conexión', 'No hay conexión con Firebase');
        return;
    }

    const di = document.getElementById('ingestDate');
    if (di) ingestDate = di.value;
    ['localQ1', 'localQ2', 'localQ3', 'localQ4', 'awayQ1', 'awayQ2', 'awayQ3', 'awayQ4', 'localOT1', 'awayOT1', 'localOT2', 'awayOT2', 'localOT3', 'awayOT3'].forEach(id => {
        const inp = document.getElementById(id);
        if (inp) ingestScores[id] = inp.value;
    });
    if (!ingestTeam1 || !ingestTeam2 || !ingestLocalTeam || !ingestDate) {
        showNotification('warning', 'Error', 'Completa todos los campos');
        return;
    }
    const s = getScores();
    const lT = s.lQ1 + s.lQ2 + s.lQ3 + s.lQ4 + s.lOT1 + s.lOT2 + s.lOT3;
    const aT = s.aQ1 + s.aQ2 + s.aQ3 + s.aQ4 + s.aOT1 + s.aOT2 + s.aOT3;
    if (lT === 0 || aT === 0) {
        showNotification('warning', 'Error', 'Ingresa los puntos');
        return;
    }
    if (lT === aT) {
        showNotification('warning', 'Empate', 'Empate. Ingresa Overtime');
        return;
    }
    const away = ingestLocalTeam === ingestTeam1 ? ingestTeam2 : ingestTeam1;
    const [y, m, d] = ingestDate.split('-');
    const ms = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const df = ms[parseInt(m) - 1] + ' ' + parseInt(d) + ', ' + y;
    let ots = 0;
    if (s.lOT1 > 0 || s.aOT1 > 0) ots = 1;
    if (s.lOT2 > 0 || s.aOT2 > 0) ots = 2;
    if (s.lOT3 > 0 || s.aOT3 > 0) ots = 3;

    addH2HGame(ingestTeam1, ingestTeam2, {
        date: df,
        localTeam: ingestLocalTeam,
        awayTeam: away,
        localQ1: s.lQ1, localQ2: s.lQ2, localQ3: s.lQ3, localQ4: s.lQ4,
        awayQ1: s.aQ1, awayQ2: s.aQ2, awayQ3: s.aQ3, awayQ4: s.aQ4,
        localOT1: s.lOT1, awayOT1: s.aOT1,
        localOT2: s.lOT2, awayOT2: s.aOT2,
        localOT3: s.lOT3, awayOT3: s.aOT3,
        overtimes: ots
    });

    ingestScores = { localQ1: '', localQ2: '', localQ3: '', localQ4: '', awayQ1: '', awayQ2: '', awayQ3: '', awayQ4: '', localOT1: '', awayOT1: '', localOT2: '', awayOT2: '', localOT3: '', awayOT3: '' };
    ingestDate = '';
    ingestLocalTeam = '';
    render();
}

function deleteGame(t1, t2, i) {
    const run = () => {

        deleteH2HGame(t1, t2, i);
    };

    if (window.NioModal && typeof window.NioModal.confirm === 'function') {
        window.NioModal.confirm({
            title: 'Confirmar',
            message: '¿Eliminar este partido de Firebase?',
            okText: 'Aceptar',
            cancelText: 'Cancelar'
        }).then((ok) => {
            if (!ok) return;
            run();
        });
        return;
    }

    // Fallback si el modal no está disponible
    if (confirm('¿Eliminar este partido de Firebase?')) run();
}
function attachEvents() {
    document.getElementById('localSelect')?.addEventListener('change', async e => {
        localTeam = e.target.value;
        resetContextualFactors(); // Reset antes de auto-detectar
        if (localTeam && visitingTeam) {
            await autoDetectContextualFactors(localTeam, visitingTeam);
        }
        render();
        setTimeout(checkForValuePicks, 100);
    });
    document.getElementById('visitingSelect')?.addEventListener('change', async e => {
        visitingTeam = e.target.value;
        resetContextualFactors(); // Reset antes de auto-detectar
        if (localTeam && visitingTeam) {
            await autoDetectContextualFactors(localTeam, visitingTeam);
        }
        render();
        setTimeout(checkForValuePicks, 100);
    });
    document.getElementById('ingestTeam1')?.addEventListener('change', e => { ingestTeam1 = e.target.value; ingestLocalTeam = ''; render(); });
    document.getElementById('ingestTeam2')?.addEventListener('change', e => { ingestTeam2 = e.target.value; ingestLocalTeam = ''; render(); });
    document.getElementById('ingestDate')?.addEventListener('change', e => { ingestDate = e.target.value; });
    document.getElementById('ingestLocal')?.addEventListener('change', e => { ingestLocalTeam = e.target.value; render(); });
}

function setType(p, v) {
    if (p === 'Q1') typeQ1 = v;
    if (p === 'Half') typeHalf = v;
    if (p === 'Full') typeFull = v;
    render();
    setTimeout(checkForValuePicks, 100);
}

function updateLine(p, v) {
    if (p === 'Q1') lineQ1 = v;
    if (p === 'Half') lineHalf = v;
    if (p === 'Full') lineFull = v;
    render();
    setTimeout(checkForValuePicks, 100);
}

function updateOdds(p, v) {
    if (p === 'Q1') oddsQ1 = v;
    if (p === 'Half') oddsHalf = v;
    if (p === 'Full') oddsFull = v;
    render();
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZAR
// ═══════════════════════════════════════════════════════════════

let AI_PICKS_TODAY = [];
let AI_PICKS_CACHE_DATE = null;

function generateAIPicks() {
    logger.log('🤖 Generando AI Picks...');
    showNotification('info', 'AI Picks', 'Analizando todos los matchups posibles...');

    const teams = getTeams();
    const aiPicks = [];
    const today = new Date().toDateString();

    for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
            const local = teams[i];
            const away = teams[j];

            const localStats = TEAM_STATS[local];
            const awayStats = TEAM_STATS[away];

            if (!localStats || !awayStats) continue;

            // Q1
            const q1Pred = localStats.q1Home + awayStats.q1Away;
            const q1Line = Math.round(q1Pred * 2) / 2;
            const q1Diff = Math.abs(q1Pred - q1Line);
            const q1Prob = Math.min(95, 50 + (q1Diff * 30));

            if (q1Prob >= 75) {
                aiPicks.push({
                    id: `ai_q1_${local}_${away}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    local, away, period: 'Q1',
                    betType: q1Pred > q1Line ? 'OVER' : 'UNDER',
                    line: q1Line, trend: q1Pred.toFixed(1),
                    probability: Math.round(q1Prob),
                    confidence: q1Prob >= 85 ? 'VERY HIGH' : q1Prob >= 80 ? 'HIGH' : 'GOOD',
                    generatedAt: new Date().toISOString()
                });
            }

            // 1H
            const halfPred = localStats.halfHome + awayStats.halfAway;
            const halfLine = Math.round(halfPred * 2) / 2;
            const halfDiff = Math.abs(halfPred - halfLine);
            const halfProb = Math.min(95, 50 + (halfDiff * 30));

            if (halfProb >= 75) {
                aiPicks.push({
                    id: `ai_1h_${local}_${away}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    local, away, period: '1H',
                    betType: halfPred > halfLine ? 'OVER' : 'UNDER',
                    line: halfLine, trend: halfPred.toFixed(1),
                    probability: Math.round(halfProb),
                    confidence: halfProb >= 85 ? 'VERY HIGH' : halfProb >= 80 ? 'HIGH' : 'GOOD',
                    generatedAt: new Date().toISOString()
                });
            }

            // FULL
            const fullPred = localStats.fullHome + awayStats.fullAway;
            const fullLine = Math.round(fullPred * 2) / 2;
            const fullDiff = Math.abs(fullPred - fullLine);
            const fullProb = Math.min(95, 50 + (fullDiff * 30));

            if (fullProb >= 75) {
                aiPicks.push({
                    id: `ai_full_${local}_${away}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    local, away, period: 'FULL',
                    betType: fullPred > fullLine ? 'OVER' : 'UNDER',
                    line: fullLine, trend: fullPred.toFixed(1),
                    probability: Math.round(fullProb),
                    confidence: fullProb >= 85 ? 'VERY HIGH' : fullProb >= 80 ? 'HIGH' : 'GOOD',
                    generatedAt: new Date().toISOString()
                });
            }
        }
    }

    aiPicks.sort((a, b) => b.probability - a.probability);
    AI_PICKS_TODAY = aiPicks.slice(0, 30);
    AI_PICKS_CACHE_DATE = today;

    localStorage.setItem('ai_picks_cache', JSON.stringify({
        picks: AI_PICKS_TODAY,
        date: today,
        generatedAt: new Date().toISOString()
    }));

    showNotification('success', '¡Listo!', `${AI_PICKS_TODAY.length} AI Picks generados`);
    
    // Solo renderizar si hay usuario autenticado y la app está visible
    if (typeof render === 'function' && currentUser && userId) {
        render();
    }
}

function loadAIPicks() {
    const today = new Date().toDateString();
    const cached = localStorage.getItem('ai_picks_cache');

    if (cached) {
        try {
            const data = JSON.parse(cached);
            if (data.date === today && data.picks && data.picks.length > 0) {
                AI_PICKS_TODAY = data.picks;
                AI_PICKS_CACHE_DATE = data.date;
                logger.log(`✅ AI Picks cargados del cache: ${AI_PICKS_TODAY.length} picks`);
                return;
            }
        } catch (e) {
            logger.warn('⚠️ Error leyendo cache de AI Picks:', e);
        }
    }

    // Si no hay cache válido, generar cuando las stats estén listas
    if (typeof TEAM_STATS !== 'undefined' && Object.keys(TEAM_STATS).length > 0) {
        generateAIPicks();
    } else {
        logger.log('⏳ AI Picks: esperando a que se carguen las stats...');
    }
}

// ═══════════════════════════════════════════════════════════════
// TEAM STATS LOADER (failsafe) — carga data/nba-stats.json
// Soluciona pantallas vacías cuando TEAM_STATS no está disponible.
// ═══════════════════════════════════════════════════════════════
if (typeof window.loadTeamStatsFromAPI !== 'function') {
    window.loadTeamStatsFromAPI = async function loadTeamStatsFromAPI() {
        try {
            if (typeof window.TEAM_STATS !== 'undefined' && window.TEAM_STATS && Object.keys(window.TEAM_STATS).length > 0) {
                return window.TEAM_STATS;
            }
            const candidates = [
                '/data/nba-stats.json',
                '/data/nba-stats/nba-stats.json',
                '/data/nba-stats/teams.json'
            ];
            for (const url of candidates) {
                try {
                    const r = await fetch(url);
                    if (!r.ok) continue;
                    const data = await r.json();
                    if (data && data.teams) {
                        window.TEAM_STATS = data.teams;
                        return window.TEAM_STATS;
                    }
                } catch (_) { /* intentar siguiente candidato */ }
            }
            return window.TEAM_STATS || {};
        } catch (err) {
            console.warn('[renders] loadTeamStatsFromAPI error:', err);
            return window.TEAM_STATS || {};
        }
    };
}

    // Exportar funciones
    window.render = render;
    window.renderHome = renderHome;
    window.renderAIPicks = renderAIPicks;
    window.renderBacktesting = renderBacktesting;
    window.renderTendencia = renderTendencia;
    window.renderPicks = renderPicks;
    window.renderMisPicks = renderMisPicks;
    window.renderBestPicks = renderBestPicks;
    window.renderDashboard = renderDashboard;
    window.renderIngesta = renderIngesta;
    window.renderBankrollView = typeof renderBankrollView === "function" ? renderBankrollView : function(){ return ""; };
    
    logger.success("Views module loaded");

})(window);
