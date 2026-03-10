// ═══════════════════════════════════════════════════════════════
// NioSports Pro v4.0 - DATA SERVICE MODULE
// Gestión de datos: picks, bankroll, team stats
// ═══════════════════════════════════════════════════════════════

(function(window) {
    'use strict';

    const logger = window.NioLogger || console;

    function getDatabase() {
        return window.database;
    }

    function getUserId() {
        return window.userId;
    }

    // ═══════════════════════════════════════════════════════════════
    // CARGAR DATOS DE USUARIO
    // ═══════════════════════════════════════════════════════════════
    function loadUserData() {
        const userId = getUserId();
        if (!userId) {
            logger.warn('loadUserData: sin userId');
            return;
        }

        const db = getDatabase();
        if (!db) return;

        try {
            // Picks Totales
            db.ref(`users/${userId}/picks_totales`).on('value', (s) => {
                const data = s.val() || {};
                window.USER_PICKS_TOTALES = data;
                if (window.StateManager) window.StateManager.setPicks('totales', data);
            });

            // Picks AI
            db.ref(`users/${userId}/picks_ai`).on('value', (s) => {
                const data = s.val() || {};
                window.USER_PICKS_AI = data;
                if (window.StateManager) window.StateManager.setPicks('ai', data);
            });

            // Picks Backtesting
            db.ref(`users/${userId}/picks_backtesting`).on('value', (s) => {
                const data = s.val() || {};
                window.USER_PICKS_BACKTESTING = data;
                if (window.StateManager) window.StateManager.setPicks('backtesting', data);
            });

            // Bankroll
            db.ref(`users/${userId}/bankroll`).on('value', (s) => {
                const data = s.val() || { current: 0, initial: 0, history: [] };
                window.USER_BANKROLL = data;
                if (window.StateManager) window.StateManager.setBankroll(data);
            });

            logger.success('User data listeners attached');
        } catch (error) {
            logger.error('Error en loadUserData:', error);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // TEAM STATS (API)
    // ═══════════════════════════════════════════════════════════════
    async function loadTeamStatsFromAPI() {
        try {
            if (window.TEAM_STATS && Object.keys(window.TEAM_STATS).length > 0) {
                return window.TEAM_STATS;
            }

            const candidates = [
                '/data/nba-stats.json',
                '/data/nba-stats/nba-stats.json',
                '/data/nba-stats/teams.json'
            ];

            for (const url of candidates) {
                try {
                    const res = await fetch(url, { cache: 'no-store' });
                    if (!res.ok) continue;
                    const data = await res.json();
                    const teams = data.teams || data;
                    if (teams && typeof teams === 'object') {
                        window.TEAM_STATS = teams;
                        if (window.StateManager) window.StateManager.setTeamStats(teams);
                        logger.success('Team stats loaded:', Object.keys(teams).length, 'teams');
                        return teams;
                    }
                } catch (e) {
                    continue;
                }
            }

            throw new Error('No se pudo cargar TEAM_STATS');
        } catch (e) {
            logger.error('loadTeamStatsFromAPI error:', e);
            return {};
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // AI PICKS
    // ═══════════════════════════════════════════════════════════════
    function loadAIPicks() {
        const today = new Date().toDateString();
        const cached = localStorage.getItem('ai_picks_cache');

        if (cached) {
            try {
                const data = JSON.parse(cached);
                if (data.date === today && data.picks?.length > 0) {
                    window.AI_PICKS_TODAY = data.picks;
                    if (window.StateManager) window.StateManager.setAIPicks(data.picks, today);
                    logger.log('AI Picks loaded from cache:', data.picks.length);
                    return;
                }
            } catch (e) {
                logger.warn('Error reading AI Picks cache:', e);
            }
        }

        // Generar si hay stats
        if (window.TEAM_STATS && Object.keys(window.TEAM_STATS).length > 0) {
            generateAIPicks();
        }
    }

    function generateAIPicks() {
        logger.log('🤖 Generating AI Picks...');

        const teams = Object.keys(window.TEAM_STATS || {}).sort();
        if (teams.length === 0) return;

        const aiPicks = [];
        const today = new Date().toDateString();

        for (let i = 0; i < teams.length; i++) {
            for (let j = i + 1; j < teams.length; j++) {
                const local = teams[i];
                const away = teams[j];
                const localStats = window.TEAM_STATS[local];
                const awayStats = window.TEAM_STATS[away];

                if (!localStats || !awayStats) continue;

                // Q1
                const q1Pred = (localStats.q1Home || 0) + (awayStats.q1Away || 0);
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
                const halfPred = (localStats.halfHome || 0) + (awayStats.halfAway || 0);
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
                const fullPred = (localStats.fullHome || 0) + (awayStats.fullAway || 0);
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
        window.AI_PICKS_TODAY = aiPicks.slice(0, 30);

        localStorage.setItem('ai_picks_cache', JSON.stringify({
            picks: window.AI_PICKS_TODAY,
            date: today,
            generatedAt: new Date().toISOString()
        }));

        if (window.StateManager) {
            window.StateManager.setAIPicks(window.AI_PICKS_TODAY, today);
        }

        logger.success('AI Picks generated:', window.AI_PICKS_TODAY.length);

        // Render si hay usuario
        if (window.currentUser && typeof render === 'function') {
            render();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // VALUE PICKS (localStorage)
    // ═══════════════════════════════════════════════════════════════
    function loadValuePicksFromStorage() {
        try {
            const saved = localStorage.getItem('nio_value_picks');
            if (saved) {
                window.VALUE_PICKS = JSON.parse(saved);
            }
        } catch (e) {
            window.VALUE_PICKS = [];
        }
    }

    function saveValuePicksToStorage() {
        try {
            localStorage.setItem('nio_value_picks', JSON.stringify(window.VALUE_PICKS || []));
        } catch (e) {}
    }

    // ═══════════════════════════════════════════════════════════════
    // BANKROLL
    // ═══════════════════════════════════════════════════════════════
    async function updateBankroll(newAmount, reason) {
        const userId = getUserId();
        const db = getDatabase();
        if (!userId || !db) return false;

        const currentBankroll = window.USER_BANKROLL?.current || 0;
        const difference = newAmount - currentBankroll;

        const newHistory = [...(window.USER_BANKROLL?.history || [])];
        newHistory.push({
            amount: difference,
            reason: reason,
            date: new Date().toISOString(),
            previousBalance: currentBankroll,
            newBalance: newAmount
        });

        try {
            await db.ref(`users/${userId}/bankroll`).update({
                current: newAmount,
                initial: window.USER_BANKROLL?.initial || newAmount,
                history: newHistory
            });
            
            if (typeof showNotification === 'function') {
                showNotification('success', 'Bankroll Actualizado', `Nuevo saldo: $${newAmount.toFixed(2)}`);
            }
            return true;
        } catch (err) {
            logger.error('Error updating bankroll:', err);
            return false;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // H2H DATABASE
    // ═══════════════════════════════════════════════════════════════
    function getH2HKey(t1, t2) {
        return [t1, t2].sort().join('_');
    }

    function addH2HGame(t1, t2, data) {
        const key = getH2HKey(t1, t2);
        if (!window.H2H_DATABASE[key]) window.H2H_DATABASE[key] = [];
        window.H2H_DATABASE[key].push(data);
        saveH2HToFirebase();
    }

    function deleteH2HGame(t1, t2, idx) {
        const key = getH2HKey(t1, t2);
        if (window.H2H_DATABASE[key]) {
            window.H2H_DATABASE[key].splice(idx, 1);
            if (window.H2H_DATABASE[key].length === 0) {
                delete window.H2H_DATABASE[key];
            }
            saveH2HToFirebase();
        }
    }

    function saveH2HToFirebase() {
        const userId = getUserId();
        const db = getDatabase();
        if (!userId || !db) return;
        
        db.ref(`users/${userId}/h2h_games`).set(window.H2H_DATABASE).catch(e => {
            logger.error('Error saving H2H:', e);
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // EXPORTAR
    // ═══════════════════════════════════════════════════════════════
    window.NioData = {
        loadUserData,
        loadTeamStatsFromAPI,
        loadAIPicks,
        generateAIPicks,
        loadValuePicksFromStorage,
        saveValuePicksToStorage,
        updateBankroll,
        getH2HKey,
        addH2HGame,
        deleteH2HGame,
        saveH2HToFirebase
    };

    // Alias globales
    window.loadUserData = loadUserData;
    window.loadTeamStatsFromAPI = loadTeamStatsFromAPI;
    window.loadAIPicks = loadAIPicks;
    window.generateAIPicks = generateAIPicks;
    window.loadValuePicksFromStorage = loadValuePicksFromStorage;
    window.saveValuePicksToStorage = saveValuePicksToStorage;
    window.updateBankroll = updateBankroll;
    window.getH2HKey = getH2HKey;
    window.addH2HGame = addH2HGame;
    window.deleteH2HGame = deleteH2HGame;
    window.saveH2HToFirebase = saveH2HToFirebase;

    logger.success('Data service module loaded');

})(window);
