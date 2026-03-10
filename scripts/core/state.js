// ═══════════════════════════════════════════════════════════════
// NioSports Pro v4.0 - STATE MODULE
// Gestión centralizada del estado de la aplicación
// ═══════════════════════════════════════════════════════════════

(function(window) {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    // LOGGER PROFESIONAL
    // ═══════════════════════════════════════════════════════════════
    const isDev = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1' ||
                  window.location.search.includes('debug=true');
    
    const NioLogger = {
        log: function(...args) { if (isDev) console.log('%c[NIO]', 'color:#22d3ee;font-weight:bold', ...args); },
        info: function(...args) { if (isDev) console.info('%c[NIO]', 'color:#22d3ee', ...args); },
        success: function(...args) { if (isDev) console.log('%c[NIO] ✅', 'color:#10b981;font-weight:bold', ...args); },
        warn: function(...args) { console.warn('%c[NIO] ⚠️', 'color:#f59e0b', ...args); },
        error: function(...args) { console.error('%c[NIO] ❌', 'color:#ef4444', ...args); },
        debug: function(...args) { if (isDev) console.log('%c[NIO] 🔍', 'color:#a78bfa', ...args); },
        group: function(label) { if (isDev) console.group(label); },
        groupEnd: function() { if (isDev) console.groupEnd(); },
        isDev: isDev
    };

    // ═══════════════════════════════════════════════════════════════
    // ESTADO GLOBAL
    // ═══════════════════════════════════════════════════════════════
    const AppState = {
        // Usuario
        currentUser: null,
        userId: null,
        isAuthenticated: false,
        
        // Vista
        currentView: 'home',
        previousView: null,
        
        // Datos
        bankroll: { current: 0, initial: 0, history: [] },
        picks: {
            totales: {},
            ai: {},
            backtesting: {}
        },
        
        // AI Picks
        aiPicksToday: [],
        aiPicksCacheDate: null,
        
        // Team Stats
        teamStats: {},
        
        // H2H
        h2hDatabase: {},
        
        // Value Picks
        valuePicks: [],
        
        // Firebase
        isFirebaseReady: false,
        isFirebaseConnected: false,
        
        // UI
        isLoading: false,
        notifications: []
    };

    // ═══════════════════════════════════════════════════════════════
    // MÉTODOS DE ESTADO
    // ═══════════════════════════════════════════════════════════════
    const StateManager = {
        get: function(key) {
            return key ? AppState[key] : AppState;
        },
        
        set: function(key, value) {
            if (typeof key === 'object') {
                Object.assign(AppState, key);
            } else {
                AppState[key] = value;
            }
            this.sync();
        },
        
        setUser: function(user) {
            AppState.currentUser = user;
            AppState.userId = user ? user.uid : null;
            AppState.isAuthenticated = !!user;
            this.sync();
        },
        
        setView: function(view) {
            AppState.previousView = AppState.currentView;
            AppState.currentView = view;
            window.currentView = view;
        },
        
        setBankroll: function(data) {
            AppState.bankroll = data || { current: 0, initial: 0, history: [] };
            window.USER_BANKROLL = AppState.bankroll;
        },
        
        setPicks: function(type, data) {
            if (AppState.picks[type] !== undefined) {
                AppState.picks[type] = data || {};
            }
            // Sync con variables globales legacy
            if (type === 'totales') window.USER_PICKS_TOTALES = data || {};
            if (type === 'ai') window.USER_PICKS_AI = data || {};
            if (type === 'backtesting') window.USER_PICKS_BACKTESTING = data || {};
        },
        
        setTeamStats: function(data) {
            AppState.teamStats = data || {};
            window.TEAM_STATS = data || {};
        },
        
        setAIPicks: function(picks, date) {
            AppState.aiPicksToday = picks || [];
            AppState.aiPicksCacheDate = date || new Date().toDateString();
            window.AI_PICKS_TODAY = AppState.aiPicksToday;
        },
        
        // Sincronizar con variables globales legacy
        sync: function() {
            window.currentUser = AppState.currentUser;
            window.userId = AppState.userId;
            window.isAuthenticated = AppState.isAuthenticated;
            window.currentView = AppState.currentView;
        },
        
        reset: function() {
            AppState.currentUser = null;
            AppState.userId = null;
            AppState.isAuthenticated = false;
            AppState.picks = { totales: {}, ai: {}, backtesting: {} };
            AppState.bankroll = { current: 0, initial: 0, history: [] };
            this.sync();
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // VARIABLES GLOBALES LEGACY (Compatibilidad)
    // ═══════════════════════════════════════════════════════════════
    window.currentView = window.currentView || 'home';
    window.currentUser = null;
    window.userId = null;
    window.USER_BANKROLL = window.USER_BANKROLL || { current: 0, initial: 0, history: [] };
    window.USER_PICKS_TOTALES = window.USER_PICKS_TOTALES || {};
    window.USER_PICKS_AI = window.USER_PICKS_AI || {};
    window.USER_PICKS_BACKTESTING = window.USER_PICKS_BACKTESTING || {};
    window.TEAM_STATS = window.TEAM_STATS || {};
    window.AI_PICKS_TODAY = window.AI_PICKS_TODAY || [];
    window.PICKS_DATABASE = window.PICKS_DATABASE || {};
    window.H2H_DATABASE = window.H2H_DATABASE || {};
    window.VALUE_PICKS = window.VALUE_PICKS || [];
    window.TEAM_GAMES_CACHE = window.TEAM_GAMES_CACHE || {};

    // ═══════════════════════════════════════════════════════════════
    // EXPORTAR
    // ═══════════════════════════════════════════════════════════════
    window.NioLogger = NioLogger;
    window.logger = NioLogger;
    window.AppState = AppState;
    window.StateManager = StateManager;

    NioLogger.success('State module loaded');

})(window);
