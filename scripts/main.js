// ═══════════════════════════════════════════════════════════════
// NioSports Pro v3.0 - main.js
// Extraído y reorganizado desde index.html para modularidad y
// corrección de errores de inicialización.
// ═══════════════════════════════════════════════════════════════

// ── 0. ALERT OVERRIDE (lo antes posible, antes de cualquier librería) ──
window.alert = function (msg) {
    try {
        if (window.toastInfo) return window.toastInfo(String(msg), { title: 'Aviso' });
        if (window.showToast) return window.showToast(String(msg), 'info', 3500, { title: 'Aviso' });
    } catch (e) { }
    console.log('[alert]', msg);
};

// ── 1. SAFETY GUARDS (enterprise hardening - sin dependencias de DOM) ──
function fetchWithTimeout(resource, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(resource, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

// Evitar ReferenceErrors si otros módulos dependen de estas variables
window._pendingNotifications = window._pendingNotifications || [];
window.__niosports = window.__niosports || {};
let __picksLoadTimer = null;
let __h2hLoadTimer = null;

function __startLoadingGuard(kind = 'carga', ms = 12000) {
    return setTimeout(() => {
        try {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay && !overlay.classList.contains('hidden')) {
                hideLoading();
                showNotification(
                    `La ${kind} está tardando demasiado. Revisa tu conexión o recarga la página.`,
                    'warning'
                );
            }
        } catch (_) { }
    }, ms);
}

function __stopTimer(t) { try { if (t) clearTimeout(t); } catch (_) { } }

// ── LOADING OVERLAY ──────────────────────────────────────────────
function showLoading(msg) {
    try {
        const overlay = document.getElementById('loadingOverlay');
        if (!overlay) return;
        const txt = overlay.querySelector('.loading-text');
        if (txt && msg) txt.textContent = msg;
        overlay.classList.remove('hidden');
    } catch (e) { }
}

function hideLoading() {
    try {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.add('hidden');
    } catch (e) { }
}


// ═══════════════════════════════════════════════════════════════
// LOGGER CONDICIONAL (Solo en desarrollo)
// ═══════════════════════════════════════════════════════════════

const IS_PRODUCTION = window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1' &&
    window.location.hostname !== '';

const Logger = {
    log(...args) {
        if (!IS_PRODUCTION) {
            console.log('[LOG]', ...args);
        }
    },
    warn(...args) {
        if (!IS_PRODUCTION) {
            console.warn('[WARN]', ...args);
        }
    },
    error(...args) {
        // Errores siempre se registran (y van a Sentry)
        console.error('[ERROR]', ...args);
        if (window.Sentry) {
            window.Sentry.captureMessage(args.join(' '), 'error');
        }
    },
    info(...args) {
        if (!IS_PRODUCTION) {
            console.info('[INFO]', ...args);
        }
    }
};

// Aliases globales para compatibilidad entre scripts clásicos y módulos
window.Logger = Logger;
window.logger = Logger;

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE NOTIFICACIONES - Early Bootstrap
// ═══════════════════════════════════════════════════════════════
// (Versión temporal hasta que cargue el sistema completo)

let _pendingNotifications = [];
let currentUser = null;
let userId = null;

function showNotification(type, title, message) {
    // Si solo recibe 2 parámetros, ajustar
    if (arguments.length === 2) {
        message = title;
        title = type;
        type = 'info';
    }
    // Queue notifications hasta que el sistema principal cargue
    _pendingNotifications.push({ type, title, message });

    // Si el sistema completo ya está cargado, procesarlas
    if (typeof processNotificationQueue === 'function') {
        processNotificationQueue();
    }
}

// ═══════════════════════════════════════════════════════════════
// FIREBASE CONFIGURATION (Segura - desde endpoint)
// ═══════════════════════════════════════════════════════════════

// ── NOTA: Firebase es inicializado EXCLUSIVAMENTE por /scripts/firebase-init.js ──
// main.js usa window.database y window.auth una vez que firebase-init.js termina.
// Usamos getters para que siempre obtengan la referencia más reciente de window.
let _database = null;
let _auth = null;
Object.defineProperty(window, '__mainDb', { get: () => _database || window.database });
Object.defineProperty(window, '__mainAuth', { get: () => _auth || window.auth });

// Shims locales: cualquier `database.ref(...)` o `auth.xxx` en este archivo
// los resolvemos a través de los getters de window para evitar null errors.
// Se sincronizan explícitamente en bootstrapFirebaseBridge e initAuthListeners.
let database = new Proxy({}, {
    get(_, prop) {
        const db = _database || window.database;
        if (!db) { console.error('[main] database no disponible aún'); return () => { }; }
        const val = db[prop];
        return typeof val === 'function' ? val.bind(db) : val;
    }
});
let auth = new Proxy({}, {
    get(_, prop) {
        const a = _auth || window.auth;
        if (!a) { console.error('[main] auth no disponible aún'); return () => { }; }
        const val = a[prop];
        return typeof val === 'function' ? val.bind(a) : val;
    }
});

// Bridge: si scripts/firebase-init.js ya inicializó Firebase, sincronizamos referencias y listeners aquí.
(function bootstrapFirebaseBridge() {
    const once = () => {
        try {
            if (window.__FIREBASE_READY__ && window.database && window.auth) {
                // Sincronizar referencias locales usadas por el resto del monolito
                _database = window.database;
                _auth = window.auth;
                // Evitar doble init de listeners
                if (!window.__NS_AUTH_LISTENERS_READY__) {
                    initAuthListeners();
                }
                if (typeof attachFirebaseConnectionListener === 'function') {
                    attachFirebaseConnectionListener();
                }
                return true;
            }
        } catch { }
        return false;
    };

    if (once()) return;

    // Esperar a que firebase-init.js termine
    if (typeof window.waitForFirebaseReady === 'function') {
        window.waitForFirebaseReady().then(() => { once(); });
    } else {
        // fallback
        const iv = setInterval(() => { if (once()) clearInterval(iv); }, 150);
        setTimeout(() => clearInterval(iv), 12000);
    }
})();

// ═══════════════════════════════════════════════════════════════
// AUTH HARDENING + ANTI "SESIONES FANTASMAS" (added)
// ═════════════════════════════════════════════════════════════==

// 2) Validación de sesión (token refresh). Si falla, forzamos logout "duro".
async function validateCurrentSession(user) {
    try {
        // Forzamos refresh del token
        await user.getIdToken(true);
        return true;
    } catch (e) {
        // Si es un fallo de red / offline, NO cerramos sesión (evita logout al refrescar).
        const code = (e && (e.code || e.name)) ? String(e.code || e.name) : '';
        const msg = (e && e.message) ? String(e.message) : '';
        const offline = (typeof navigator !== 'undefined' && navigator && navigator.onLine === false);

        const isNetwork = offline || /network-request-failed|timeout|Failed to fetch|NetworkError/i.test(code + ' ' + msg);
        if (isNetwork) {
            Logger.warn('⚠️ Token refresh falló por red/offline. Manteniendo sesión.');
            return true;
        }

        // Errores que sí ameritan re-login
        const mustLogout = /auth\/user-token-expired|auth\/id-token-expired|auth\/invalid-user-token|auth\/user-disabled|auth\/invalid-credential/i.test(code);
        if (mustLogout) return false;

        // Por defecto: fail-open para evitar expulsar al usuario por errores intermitentes
        Logger.warn('⚠️ Token refresh falló (no crítico). Manteniendo sesión.', code);
        return true;
    }
}


// 3) Session binding (anti ghost sessions)
function getOrCreateDeviceId() {
    const key = 'ns_device_id';
    let id = localStorage.getItem(key);
    if (!id) {
        id = (crypto?.randomUUID?.() || ('dev_' + Math.random().toString(16).slice(2))) + '_' + Date.now();
        localStorage.setItem(key, id);
    }
    return id;
}

function newSessionId() {
    return crypto?.randomUUID?.() || ('sess_' + Math.random().toString(16).slice(2) + '_' + Date.now());
}

async function bindSession(user) {
    const deviceId = getOrCreateDeviceId();
    const sessionId = newSessionId();

    localStorage.setItem('ns_session_id', sessionId);

    try {
        await database.ref(`users/${user.uid}/session`).update({
            currentSessionId: sessionId,
            deviceId,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        });
    } catch (e) {

        // Aun si falla, seguimos (no bloquea login)
    }

    return sessionId;
}

async function enforceSessionBinding(user) {
    const localSessionId = localStorage.getItem('ns_session_id');
    let remoteSessionId = null;

    try {
        const snap = await database.ref(`users/${user.uid}/session/currentSessionId`).once('value');
        remoteSessionId = snap.val();
    } catch (e) {

        // Si no podemos leer, no bloqueamos el acceso (fail-open)
        return true;
    }

    if (!remoteSessionId) {
        await bindSession(user);
        return true;
    }

    if (!localSessionId) {
        localStorage.setItem('ns_session_id', remoteSessionId);
        return true;
    }

    if (localSessionId !== remoteSessionId) {

        localStorage.setItem('ns_session_id', remoteSessionId);
        return true;
    }

    return true;
}

// 4) Logout "duro": borra sesión, cache y service worker (arregla estados corruptos)
async function safeHardLogout(message = 'Sesión cerrada por seguridad.') {
    try { await auth.signOut(); } catch { }
    try { localStorage.removeItem('ns_session_id'); } catch { }
    try { sessionStorage.clear(); } catch { }

    // Cache Storage
    try {
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        }
    } catch { }

    // Service Worker
    try {
        if ('serviceWorker' in navigator && !location.search.includes('nosw=1')) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
        }
    } catch { }

    if (typeof showNotification === 'function') {
        showNotification('warning', 'Sesión', message);
    } else {
        window.toastInfo ? toastInfo(message, { title: 'Notificación' }) : console.log(message);
    }
}

// ═══════════════════════════════════════════════════════════════

// Auth code moved here

// ═══════════════════════════════════════════════════════════════
// AUTH LISTENERS - Inicializado después de Firebase
// ═══════════════════════════════════════════════════════════════

function initAuthListeners() {
    if (window.__NS_AUTH_LISTENERS_READY__) return;
    window.__NS_AUTH_LISTENERS_READY__ = true;
    // Sincronizar referencias locales desde window (asignadas por firebase-init.js)
    if (!_auth) _auth = window.auth;
    if (!_database) _database = window.database;
    if (!(_auth || window.auth) || !(_database || window.database)) {
        Logger.error('❌ FIREBASE NO INICIALIZADO CORRECTAMENTE');
        return;
    }

    // Observer de autenticación
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // 1) Token válido (evita sesiones corruptas)
            const okToken = await validateCurrentSession(user);
            if (!okToken) {
                await safeHardLogout('Tu sesión estaba corrupta. Inicia sesión otra vez.');
                return;
            }

            // 2) Anti "sesiones fantasmas" (cache/SW/deploys)
            const okSession = await enforceSessionBinding(user);
            if (!okSession) return;

            currentUser = user;
            userId = user.uid;

            // Heartbeat (no bloqueante)
            try {
                database.ref(`users/${user.uid}/session`).update({
                    lastSeenAt: firebase.database.ServerValue.TIMESTAMP
                });
            } catch { }

            onUserLoggedIn(user);
        } else {
            currentUser = null;
            userId = null;
            showLogin();
        }
    });
}

function showLogin() {
    const loginScreen = document.getElementById('loginScreen');
    const registerScreen = document.getElementById('registerScreen');
    const forgotScreen = document.getElementById('forgotPasswordScreen');
    const mainApp = document.getElementById('mainApp');
    const mainNav = document.getElementById('mainNav');

    if (loginScreen) loginScreen.style.display = 'flex';
    if (registerScreen) registerScreen.style.display = 'none';
    if (forgotScreen) forgotScreen.style.display = 'none';
    if (mainApp) mainApp.style.display = 'none';
    if (mainNav) mainNav.style.display = 'none';
}

function showRegister() {
    const loginScreen = document.getElementById('loginScreen');
    const registerScreen = document.getElementById('registerScreen');
    const forgotScreen = document.getElementById('forgotPasswordScreen');
    const mainApp = document.getElementById('mainApp');
    const mainNav = document.getElementById('mainNav');

    if (loginScreen) loginScreen.style.display = 'none';
    if (registerScreen) registerScreen.style.display = 'flex';
    if (forgotScreen) forgotScreen.style.display = 'none';
    if (mainApp) mainApp.style.display = 'none';
    if (mainNav) mainNav.style.display = 'none';
}

function showForgotPassword() {
    const loginScreen = document.getElementById('loginScreen');
    const registerScreen = document.getElementById('registerScreen');
    const forgotScreen = document.getElementById('forgotPasswordScreen');
    const mainApp = document.getElementById('mainApp');
    const mainNav = document.getElementById('mainNav');

    if (loginScreen) loginScreen.style.display = 'none';
    if (registerScreen) registerScreen.style.display = 'none';
    if (forgotScreen) forgotScreen.style.display = 'flex';
    if (mainApp) mainApp.style.display = 'none';
    if (mainNav) mainNav.style.display = 'none';
}

// Cuando el usuario se loguea exitosamente
function onUserLoggedIn(user) {
    // Cargar perfil del usuario
    database.ref(`users/${user.uid}/profile`).once('value').then((snapshot) => {
        const profile = snapshot.val();

        if (profile) {
            const username = profile.username || profile.displayName || 'Usuario';

            const navName = document.getElementById('userName');
            const navInitials = document.getElementById('userInitials');

            if (navName) navName.textContent = username;
            if (navInitials) navInitials.textContent = username.substring(0, 1).toUpperCase();
        }
    }).catch(err => {
        Logger.error('❌ Error cargando perfil:', err);
    });

    // Ocultar pantallas de auth y mostrar app
    const loginScreen = document.getElementById('loginScreen');
    const registerScreen = document.getElementById('registerScreen');
    const forgotScreen = document.getElementById('forgotPasswordScreen');
    const mainApp = document.getElementById('mainApp');
    const mainNav = document.getElementById('mainNav');

    if (loginScreen) loginScreen.style.display = 'none';
    if (registerScreen) registerScreen.style.display = 'none';
    if (forgotScreen) forgotScreen.style.display = 'none';
    if (mainApp) mainApp.style.display = 'block';
    if (mainNav) mainNav.style.display = 'flex';

    // Cargar datos del usuario
    loadUserData();

    // Cargar datos de Firebase que requieren autenticación
    if (typeof loadBankrollFromFirebase === 'function') loadBankrollFromFirebase();
    if (typeof loadPicksFromFirebase === 'function') loadPicksFromFirebase();

    // Renderizar vista inicial
    if (typeof render === 'function') {
        render();
    }

    // Show mobile bottom nav
    const mobileNav = document.getElementById('mobileBottomNav');
    if (mobileNav) mobileNav.style.display = '';
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) refreshBtn.style.display = '';
}

// Cargar datos del usuario
let USER_PICKS_TOTALES = {};
let USER_PICKS_AI = {};
let USER_PICKS_BACKTESTING = {};
function loadUserData() {
    if (!userId) {
        return;
    }

    database.ref(`users/${userId}/picks_totales`).on('value', (s) => {
        USER_PICKS_TOTALES = s.val() || {};
    });
    database.ref(`users/${userId}/picks_ai`).on('value', (s) => {
        USER_PICKS_AI = s.val() || {};
    });

    database.ref(`users/${userId}/picks_backtesting`).on('value', (s) => {
        USER_PICKS_BACKTESTING = s.val() || {};
    });

    database.ref(`users/${userId}/bankroll`).on('value', (s) => {
        USER_BANKROLL = s.val() || { current: 0, initial: 0, history: [] };
    });
}

// Logout
function logout() {
    // Modal pro (sin confirm del navegador)
    if (window.NioModal && typeof window.NioModal.confirm === 'function') {
        const email = (window.currentUser && window.currentUser.email) ? window.currentUser.email : '—';
        window.NioModal.confirm({
            title: 'Cerrar sesión',
            message: `Sesión activa: ${email}

¿Deseas cerrar sesión?`,
            okText: 'Cerrar sesión',
            cancelText: 'Cancelar'
        }).then((ok) => {
            if (!ok) return;
            doLogout();
        });
        return;
    }
    // Fallback (si por algo no cargó el modal)
    doLogout();

    function doLogout() {
        // Clean up Firebase listeners to prevent memory leaks
        if (userId) {
            try {
                database.ref(`users/${userId}/picks_totales`).off();
                database.ref(`users/${userId}/picks_ai`).off();
                database.ref(`users/${userId}/picks_backtesting`).off();
                database.ref(`users/${userId}/bankroll`).off();
                database.ref(`users/${userId}/h2h_games`).off();
                database.ref(`users/${userId}/picks`).off();
                database.ref(`users/${userId}/bankroll_data`).off();
            } catch (e) { /* silent */ }
        }
        auth.signOut().then(() => {
            showNotification('info', 'Sesión cerrada', 'Hasta pronto');
            // Hide mobile nav
            const mobileNav = document.getElementById('mobileBottomNav');
            if (mobileNav) mobileNav.style.display = 'none';
            const refreshBtn = document.getElementById('refreshBtn');
            if (refreshBtn) refreshBtn.style.display = 'none';
        }).catch(err => {
            Logger.error('Error al cerrar sesión:', err);
        });
    }
}

/* ══════════════════════════════════════════════════════════════════════
   NIOSPORTS PRO v4.0 - SISTEMA DE PREDICCIONES NBA
   ══════════════════════════════════════════════════════════════════════
   
   DESCRIPCIÓN:
   Sistema profesional de análisis y predicciones NBA con inteligencia
   artificial, multi-usuario, y módulos avanzados de tracking.
   
   MÓDULOS PRINCIPALES:
   
   1. SISTEMA DE AUTENTICACIÓN
      - Login con email o username
      - Registro con validación
      - Recuperación de contraseña por email
      - Multi-usuario con Firebase Auth
      - Separación total de datos por usuario
   
   2. HOME DASHBOARD
      - Vista personalizada con stats del usuario
      - Resumen de bankroll, picks activos, win rate
      - Acceso rápido a todos los módulos
      - Interfaz intuitiva y responsive
   
   3. CALCULADORA DE TOTALES
      - Predicción de puntos Q1, 1H, Full Game
      - 30 equipos NBA con stats completos
      - Ajuste automático por PACE
      - Comparación vs líneas de casas de apuestas
      - Guardado de picks con tracking

   
   5. AI PICKS AUTOMÁTICAS
      - Generación automática de picks con 75%+ probabilidad
      - Análisis de todos los matchups posibles (NxN)
      - Niveles de confianza: VERY HIGH, HIGH, GOOD
      - Cache diario automático
      - Sistema de tracking integrado
   
   6. MIS PICKS (UNIFICADO)
      - Vista consolidada de TODOS los picks
      - Filtros: Totales, Props, AI, Backtesting
      - Estados: Pendientes, Ganadas, Perdidas
      - Actualización de resultados en tiempo real
      - Historial completo con stats
   
   7. BANKROLL MANAGEMENT
      - Control profesional del capital
      - Bankroll actual, inicial, ganancia/pérdida
      - Botón "Actualizar Bankroll" para recargas
      - Historial detallado de movimientos
      - Cálculo automático de ROI
      - Gráficos de evolución
   
   8. BACKTESTING SYSTEM
      - Sistema de calibración del modelo
      - Comparación predicción vs resultado real
      - Métricas: Win Rate, ROI, Error del modelo
      - Curva de calibración por rangos de probabilidad
      - Stats por período (Q1, 1H, FULL)
   
   9. PROFILE & SETTINGS
      - Información del usuario
      - Configuración de preferencias
      - Gestión de cuenta
   
   ARQUITECTURA FIREBASE:
   
   users/
   ├── {userId}/
   │   ├── profile/
   │   │   ├── username
   │   │   ├── email
   │   │   ├── displayName
   │   │   └── createdAt
   │   ├── picks_totales/
   │   │   └── {pickId} → picks de calculadora
   │   ├── picks_ai/
   │   │   └── {pickId} → AI picks agregados
   │   ├── picks_backtesting/
   │   │   └── {pickId} → picks para calibración
   │   └── bankroll/
   │       ├── current
   │       ├── initial
   │       └── history[]
   
   usernames/
   └── {userId} → username (para login con username)
   
   TECNOLOGÍAS:
   - Frontend: HTML5, CSS3 (Tailwind), JavaScript ES6+
   - Backend: Firebase Realtime Database
   - Auth: Firebase Authentication
   - Librerías: Chart.js para gráficos
   - Design: Sistema de diseño custom con variables CSS
   
   CARACTERÍSTICAS:
   ✅ Responsive (Desktop, Tablet, Mobile)
   ✅ PWA Ready (manifest.json + Service Worker)
   ✅ Offline capable (Service Worker cache)
   ✅ Real-time sync con Firebase
   ✅ Multi-usuario seguro
   ✅ Validaciones completas
   ✅ Manejo de errores robusto
   ✅ Notificaciones toast
   ✅ Exportación a CSV
   ✅ Sistema de navegación fluido
   
   DESARROLLADO POR:
   NioSports Pro Team
   Versión: 4.0
   Última actualización: Febrero 2026
   
   ══════════════════════════════════════════════════════════════════════ */


// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// LANDING PAGE CONTROLLERS
// ═══════════════════════════════════════════════════════════

// Theme Toggle
function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    const btn = document.getElementById('themeToggle');
    btn.textContent = next === 'dark' ? '🌙' : '☀️';
}

(function () {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    setTimeout(() => {
        const btn = document.getElementById('themeToggle');
        if (btn) btn.textContent = saved === 'dark' ? '🌙' : '☀️';
    }, 100);
})();

// Scroll effect for nav
window.addEventListener('scroll', () => {
    const nav = document.getElementById('mainNav');
    if (window.scrollY > 40) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
});

// Counter animation for stats
function animateCounters() {
    const counters = document.querySelectorAll('.stat-number[data-count]');
    counters.forEach(el => {
        const target = parseInt(el.dataset.count);
        const suffix = el.dataset.suffix || '';
        const isPlus = target >= 100;
        let current = 0;
        const step = Math.max(1, Math.floor(target / 50));
        const timer = setInterval(() => {
            current += step;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            el.textContent = current + (isPlus && current === target ? '+' : '') + suffix;
        }, 30);
    });
}

// Observe stats section for counter trigger
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateCounters();
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.3 });

setTimeout(() => {
    const strip = document.querySelector('.stats-strip');
    if (strip) statsObserver.observe(strip);
}, 500);

// Feature card mouse tracking
document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', ((e.clientX - rect.left) / rect.width * 100) + '%');
        card.style.setProperty('--mouse-y', ((e.clientY - rect.top) / rect.height * 100) + '%');
    });
});

// View switching system
function switchView(view) {
    // Track user action
    if (window.trackAction) {
        window.trackAction('switch_view', { view });
    }
    window.currentView = view;

    // Hide all views
    document.querySelectorAll('.view-panel').forEach(v => v.classList.remove('active'));
    // Show target view
    const target = document.getElementById('view-' + view);
    if (target) target.classList.add('active');

    // Update nav links
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector('.nav-link[data-view="' + view + '"]');
    if (activeLink) activeLink.classList.add('active');

    // Close mobile nav
    document.querySelector('.nav-links')?.classList.remove('open');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Load content if needed
    if (view === 'totals') {
        // Re-render the app if navigating to totals
        const app = document.getElementById('app');
        window.currentView = 'totales';
        if (app && typeof renderTendencia === 'function') {
            app.innerHTML = renderTendencia();
        } else if (typeof render === 'function') {
            render();
        }
    }
    if (view === 'picks') {
        window.currentView = 'aipicks';
        const picksContainer = document.getElementById('view-picks');
        if (picksContainer && typeof renderAIPicks === 'function') {
            picksContainer.innerHTML = renderAIPicks();
        }
        if (typeof window.loadPicksIA === 'function') window.loadPicksIA();
    }
    if (view === 'stats') {
        if (typeof window.initTeamsView === 'function') window.initTeamsView();
    }
    if (view === 'bankroll') {
        if (typeof window.renderBankrollView === 'function') window.renderBankrollView();
    }
    if (view === 'tracking') {
        if (typeof window.renderTrackingView === 'function') window.renderTrackingView();
    }
}

function showAuth() {
    if (typeof currentUser !== 'undefined' && currentUser) {
        // User is logged in — show account options
        if (typeof logout === 'function') {
            logout(); // logout() ya muestra modal pro
        }
    } else {
        // User is not logged in — show login screen
        if (typeof showLogin === 'function') {
            showLogin();
        } else {
            const loginScreen = document.getElementById('loginScreen');
            if (loginScreen) loginScreen.style.display = 'flex';
        }
    }
}

// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════

// FIREBASE DATABASE FUNCTIONS
// ═══════════════════════════════════════════════════════════════
function updateFirebaseStatus(status) {
    const el = document.getElementById('firebaseStatus');
    if (status === 'connected') {
        el.textContent = '🟢 Firebase Conectado';
        el.className = 'firebase-status firebase-connected';
        firebaseConnected = true;
    } else if (status === 'disconnected') {
        el.textContent = '🔴 Sin Conexión';
        el.className = 'firebase-status firebase-disconnected';
        firebaseConnected = false;
    } else {
        el.textContent = '🔄 Conectando...';
        el.className = 'firebase-status firebase-loading';
    }
}

// Listener de conexión (defer hasta que Firebase esté listo)
function attachFirebaseConnectionListener() {
    try {
        const db = database || window.database;
        if (!db || typeof db.ref !== 'function') return;
        db.ref('.info/connected').on('value', (snap) => {
            updateFirebaseStatus(snap.val() ? 'connected' : 'disconnected');
        });
    } catch (e) {
        Logger.warn('⚠️ No se pudo adjuntar listener de conexión Firebase:', e?.message || e);
    }
}


// Cargar picks de Firebase
function loadPicksFromFirebase() {
    if (!userId) { logger.warn('⚠️ loadPicks: sin userId'); return; }
    showLoading('Cargando historial de picks...');
    __picksLoadTimer = __startLoadingGuard('carga del historial', 12000);
    database.ref(`users/${userId}/picks`).on('value', (snapshot) => {
        if (snapshot.exists()) {
            PICKS_DATABASE = snapshot.val();
        } else {
            PICKS_DATABASE = {};
        }
        __stopTimer(__picksLoadTimer);
        hideLoading();
        render();
        checkForValuePicks();
    }, (error) => {
        Logger.error('Error cargando picks:', error);
        __stopTimer(__picksLoadTimer);
        hideLoading();
        render();
    });
}

// Guardar H2H en Firebase
function saveH2HToFirebase() {
    if (!userId) { showNotification('❌ Debes iniciar sesión', 'error'); return; }
    showLoading('Guardando en Firebase...');
    database.ref(`users/${userId}/h2h_games`).set(H2H_DATABASE)
        .then(() => {

            hideLoading();
            showNotification('✅ Partido guardado correctamente', 'success');
        })
        .catch((error) => {
            Logger.error('Error guardando:', error);
            hideLoading();
            showNotification('❌ Error guardando: ' + error.message, 'warning');
        });
}

// Guardar picks en Firebase
function savePicksToFirebase() {
    if (!userId) return;
    database.ref(`users/${userId}/picks`).set(PICKS_DATABASE)

        .catch((error) => Logger.error('Error guardando picks:', error));
}

// ═══════════════════════════════════════════════════════════════
// FUNCIONES H2H DATABASE
// ═══════════════════════════════════════════════════════════════
function getH2HKey(t1, t2) { return [t1, t2].sort().join('_'); }

function addH2HGame(t1, t2, data) {
    const k = getH2HKey(t1, t2);
    if (!H2H_DATABASE[k]) H2H_DATABASE[k] = [];
    H2H_DATABASE[k].unshift(data);
    saveH2HToFirebase();
}

function deleteH2HGame(t1, t2, idx) {
    const k = getH2HKey(t1, t2);
    if (H2H_DATABASE[k]) {
        H2H_DATABASE[k].splice(idx, 1);
        if (H2H_DATABASE[k].length === 0) delete H2H_DATABASE[k];
        saveH2HToFirebase();
    }
}

function getH2HData(team1, team2) {
    const k = getH2HKey(team1, team2), games = H2H_DATABASE[k] || [];
    if (games.length === 0) return null;
    let t1W = 0, t2W = 0, t1Pts = 0, t2Pts = 0;
    const proc = games.slice(0, 10).map(g => {
        const isT1L = g.localTeam === team1;
        const t1Q1 = isT1L ? g.localQ1 : g.awayQ1, t1Q2 = isT1L ? g.localQ2 : g.awayQ2;
        const t1Q3 = isT1L ? g.localQ3 : g.awayQ3, t1Q4 = isT1L ? g.localQ4 : g.awayQ4;
        const t2Q1 = isT1L ? g.awayQ1 : g.localQ1, t2Q2 = isT1L ? g.awayQ2 : g.localQ2;
        const t2Q3 = isT1L ? g.awayQ3 : g.localQ3, t2Q4 = isT1L ? g.awayQ4 : g.localQ4;
        const t1OT = isT1L ? ((g.localOT1 || 0) + (g.localOT2 || 0) + (g.localOT3 || 0)) : ((g.awayOT1 || 0) + (g.awayOT2 || 0) + (g.awayOT3 || 0));
        const t2OT = isT1L ? ((g.awayOT1 || 0) + (g.awayOT2 || 0) + (g.awayOT3 || 0)) : ((g.localOT1 || 0) + (g.localOT2 || 0) + (g.localOT3 || 0));
        const t1T = t1Q1 + t1Q2 + t1Q3 + t1Q4 + t1OT, t2T = t2Q1 + t2Q2 + t2Q3 + t2Q4 + t2OT;
        t1Pts += t1T; t2Pts += t2T;
        if (t1T > t2T) t1W++; else t2W++;
        return { date: g.date, localTeam: g.localTeam, awayTeam: g.awayTeam, t1Q1, t1Q2, t1Q3, t1Q4, t2Q1, t2Q2, t2Q3, t2Q4, t1Half: t1Q1 + t1Q2, t2Half: t2Q1 + t2Q2, t1Total: t1T, t2Total: t2T, totalPts: t1T + t2T, winner: t1T > t2T ? team1 : team2, overtimes: g.overtimes || 0 };
    });
    const n = proc.length;
    return {
        team1, team2,
        record: { team1Wins: t1W, team2Wins: t2W },
        avgPts: { team1: n ? t1Pts / n : 0, team2: n ? t2Pts / n : 0 },
        avgQ1: { team1: n ? proc.reduce((s, g) => s + g.t1Q1, 0) / n : 0, team2: n ? proc.reduce((s, g) => s + g.t2Q1, 0) / n : 0 },
        avgHalf: { team1: n ? proc.reduce((s, g) => s + g.t1Half, 0) / n : 0, team2: n ? proc.reduce((s, g) => s + g.t2Half, 0) / n : 0 },
        games: proc,
        totalGames: games.length
    };
}

// ═══════════════════════════════════════════════════════════════
// PICKS TRACKING SYSTEM v2.0 - CON BACKTESTING
// ═══════════════════════════════════════════════════════════════
function addPick(pickData) {
    const pickId = Date.now().toString();

    // Obtener tendencia del modelo para backtesting
    let modelTrend = null;
    if (pickData.localTeam && pickData.awayTeam) {
        const advancedData = getAdvancedTrends(pickData.localTeam, pickData.awayTeam);
        if (advancedData) {
            if (pickData.period === '1Q') modelTrend = advancedData.q1;
            else if (pickData.period === '1H') modelTrend = advancedData.half;
            else if (pickData.period === 'FULL') modelTrend = advancedData.full;
        }
    }

    PICKS_DATABASE[pickId] = {
        ...pickData,
        id: pickId,
        createdAt: new Date().toISOString(),
        status: 'pending', // pending, win, loss, push
        modelTrend: modelTrend, // Guardar predicción del modelo
        actualTotal: null, // Se llena después con el resultado real
        vegasLine: pickData.vegasLine || null // Línea de Vegas para comparación
    };
    savePicksToFirebase();
    showNotification('📝 Pick registrado correctamente', 'success');
    render();
}

// Registrar resultado real del partido (para backtesting)
function registerActualResult(pickId) {
    const pick = PICKS_DATABASE[pickId];
    if (!pick) return;

    const actualTotal = prompt(`Ingresa el total REAL del ${pick.period}:\n(Tu predicción: ${pick.modelTrend || 'N/A'}, Línea: ${pick.line})`);
    if (actualTotal === null) return;

    const actual = parseFloat(actualTotal);
    if (isNaN(actual) || actual < 0) {
        showNotification('⚠️ Ingresa un número válido', 'warning');
        return;
    }

    PICKS_DATABASE[pickId].actualTotal = actual;

    // Determinar resultado automáticamente
    const line = parseFloat(pick.line);
    if (actual === line) {
        PICKS_DATABASE[pickId].status = 'push';
    } else if (pick.betType === 'OVER') {
        PICKS_DATABASE[pickId].status = actual > line ? 'win' : 'loss';
    } else {
        PICKS_DATABASE[pickId].status = actual < line ? 'win' : 'loss';
    }

    PICKS_DATABASE[pickId].resolvedAt = new Date().toISOString();

    // Calcular precisión del modelo
    const modelError = pick.modelTrend ? Math.abs(actual - pick.modelTrend) : null;
    PICKS_DATABASE[pickId].modelError = modelError;

    savePicksToFirebase();

    const status = PICKS_DATABASE[pickId].status;
    const emoji = status === 'win' ? '✅' : status === 'push' ? '↔️' : '❌';
    showNotification(`${emoji} Resultado registrado: ${actual} pts (${status.toUpperCase()})`, status === 'win' ? 'success' : 'info');
    render();
}

function updatePickResult(pickId, result) {
    if (PICKS_DATABASE[pickId]) {
        PICKS_DATABASE[pickId].status = result;
        PICKS_DATABASE[pickId].resolvedAt = new Date().toISOString();
        savePicksToFirebase();
        showNotification(result === 'win' ? '✅ ¡Pick ganado!' : result === 'push' ? '↔️ Push' : '❌ Pick perdido', result === 'win' ? 'success' : 'warning');
        render();
    }
}

function deletePick(pickId) {
    if (PICKS_DATABASE[pickId]) {
        delete PICKS_DATABASE[pickId];
        savePicksToFirebase();
        showNotification('🗑️ Pick eliminado', 'info');
        render();
    }
}

// ═══════════════════════════════════════════════════════════════
// BACKTESTING & CALIBRACIÓN
// ═══════════════════════════════════════════════════════════════

// Calcular estadísticas de precisión del modelo
function getBacktestStats() {
    const picks = Object.values(PICKS_DATABASE).filter(p => p.status !== 'pending' && p.modelTrend);

    if (picks.length === 0) return null;

    // Stats por período
    const byPeriod = {
        '1Q': { wins: 0, losses: 0, pushes: 0, totalError: 0, count: 0 },
        '1H': { wins: 0, losses: 0, pushes: 0, totalError: 0, count: 0 },
        'FULL': { wins: 0, losses: 0, pushes: 0, totalError: 0, count: 0 }
    };

    // Stats por rango de probabilidad (para calibración)
    const byProbRange = {
        '50-60': { predicted: 0, actual: 0, count: 0 },
        '60-70': { predicted: 0, actual: 0, count: 0 },
        '70-80': { predicted: 0, actual: 0, count: 0 },
        '80-90': { predicted: 0, actual: 0, count: 0 },
        '90-100': { predicted: 0, actual: 0, count: 0 }
    };

    let totalWins = 0, totalLosses = 0, totalPushes = 0;
    let totalModelError = 0, modelErrorCount = 0;
    let totalProfit = 0;

    picks.forEach(pick => {
        const period = pick.period;
        if (byPeriod[period]) {
            if (pick.status === 'win') { byPeriod[period].wins++; totalWins++; }
            else if (pick.status === 'loss') { byPeriod[period].losses++; totalLosses++; }
            else if (pick.status === 'push') { byPeriod[period].pushes++; totalPushes++; }

            if (pick.modelError !== null && pick.modelError !== undefined) {
                byPeriod[period].totalError += pick.modelError;
                byPeriod[period].count++;
                totalModelError += pick.modelError;
                modelErrorCount++;
            }
        }

        // Calibración por rango de probabilidad
        const prob = pick.probability;
        let range = null;
        if (prob >= 50 && prob < 60) range = '50-60';
        else if (prob >= 60 && prob < 70) range = '60-70';
        else if (prob >= 70 && prob < 80) range = '70-80';
        else if (prob >= 80 && prob < 90) range = '80-90';
        else if (prob >= 90) range = '90-100';

        if (range && byProbRange[range]) {
            byProbRange[range].predicted += prob;
            byProbRange[range].actual += (pick.status === 'win' ? 100 : 0);
            byProbRange[range].count++;
        }

        // Profit
        if (pick.odds) {
            if (pick.status === 'win') totalProfit += (pick.odds - 1);
            else if (pick.status === 'loss') totalProfit -= 1;
        }
    });

    // Calcular hit rates
    const totalDecided = totalWins + totalLosses;
    const overallHitRate = totalDecided > 0 ? (totalWins / totalDecided * 100) : 0;

    // Calcular calibración
    const calibrationData = Object.entries(byProbRange)
        .filter(([_, data]) => data.count >= 3) // Mínimo 3 picks por rango
        .map(([range, data]) => ({
            range,
            avgPredicted: data.predicted / data.count,
            actualHitRate: data.actual / data.count,
            count: data.count
        }));

    return {
        totalPicks: picks.length,
        totalWins,
        totalLosses,
        totalPushes,
        overallHitRate: overallHitRate.toFixed(1),
        avgModelError: modelErrorCount > 0 ? (totalModelError / modelErrorCount).toFixed(1) : null,
        totalProfit: totalProfit.toFixed(2),
        roi: totalDecided > 0 ? ((totalProfit / totalDecided) * 100).toFixed(1) : 0,
        byPeriod: Object.entries(byPeriod).map(([period, data]) => ({
            period,
            wins: data.wins,
            losses: data.losses,
            pushes: data.pushes,
            hitRate: (data.wins + data.losses) > 0 ? ((data.wins / (data.wins + data.losses)) * 100).toFixed(1) : '-',
            avgError: data.count > 0 ? (data.totalError / data.count).toFixed(1) : '-'
        })),
        calibration: calibrationData,
        isCalibrated: calibrationData.length >= 2
    };
}

// Exportar picks a CSV
function exportPicksToCSV() {
    const picks = Object.values(PICKS_DATABASE);
    if (picks.length === 0) {
        showNotification('⚠️ No hay picks para exportar', 'warning');
        return;
    }

    const headers = ['Fecha', 'Local', 'Visitante', 'Período', 'Tipo', 'Línea', 'Prob%', 'Cuota', 'EV%', 'Predicción', 'Resultado Real', 'Status', 'Profit'];

    const rows = picks.map(p => [
        new Date(p.createdAt).toLocaleDateString('es-ES'),
        p.localTeam || '',
        p.awayTeam || '',
        p.period || '',
        p.betType || '',
        p.line || '',
        p.probability || '',
        p.odds || '',
        p.ev || '',
        p.modelTrend || '',
        p.actualTotal || '',
        p.status || '',
        p.status === 'win' && p.odds ? (p.odds - 1).toFixed(2) : p.status === 'loss' ? '-1.00' : '0'
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `niosports_picks_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    showNotification('📥 CSV exportado correctamente', 'success');
}

// Agregar línea de cierre para CLV
function addClosingLine(pickId, originalLine) {
    const closingLine = prompt(`Línea de cierre para este pick:\n(Línea original: ${originalLine})`);
    if (closingLine === null) return;

    const closing = parseFloat(closingLine);
    if (isNaN(closing)) {
        showNotification('⚠️ Ingresa un número válido', 'warning');
        return;
    }

    if (PICKS_DATABASE[pickId]) {
        PICKS_DATABASE[pickId].closingLine = closing;
        savePicksToFirebase();

        const original = parseFloat(originalLine);
        const pick = PICKS_DATABASE[pickId];
        const clv = pick.betType === 'OVER'
            ? (closing - original).toFixed(1)
            : (original - closing).toFixed(1);

        const clvText = parseFloat(clv) >= 0 ? `+${clv}` : clv;
        showNotification(`🎯 CLV registrado: ${clvText} puntos`, parseFloat(clv) >= 0 ? 'success' : 'info');
        render();
    }
}

function getPicksStats() {
    const picks = Object.values(PICKS_DATABASE);
    const total = picks.length;
    const wins = picks.filter(p => p.status === 'win').length;
    const losses = picks.filter(p => p.status === 'loss').length;
    const pending = picks.filter(p => p.status === 'pending').length;
    const resolved = wins + losses;
    const winRate = resolved > 0 ? ((wins / resolved) * 100).toFixed(1) : 0;

    // Stats por tipo de apuesta
    const byType = {};
    picks.forEach(p => {
        const key = `${p.period}_${p.betType}`;
        if (!byType[key]) byType[key] = { wins: 0, losses: 0, total: 0, profit: 0 };
        byType[key].total++;
        if (p.status === 'win') {
            byType[key].wins++;
            byType[key].profit += p.odds ? (parseFloat(p.odds) - 1) : 0;
        }
        if (p.status === 'loss') {
            byType[key].losses++;
            byType[key].profit -= 1;
        }
    });

    // Stats por período (1Q, 1H, FULL)
    const byPeriod = { '1Q': { wins: 0, losses: 0, total: 0, profit: 0 }, '1H': { wins: 0, losses: 0, total: 0, profit: 0 }, 'FULL': { wins: 0, losses: 0, total: 0, profit: 0 } };
    picks.forEach(p => {
        if (byPeriod[p.period]) {
            byPeriod[p.period].total++;
            if (p.status === 'win') {
                byPeriod[p.period].wins++;
                byPeriod[p.period].profit += p.odds ? (parseFloat(p.odds) - 1) : 0;
            }
            if (p.status === 'loss') {
                byPeriod[p.period].losses++;
                byPeriod[p.period].profit -= 1;
            }
        }
    });

    // Stats por equipo
    const byTeam = {};
    picks.forEach(p => {
        [p.localTeam, p.awayTeam].forEach(team => {
            if (!byTeam[team]) byTeam[team] = { wins: 0, losses: 0, total: 0 };
            byTeam[team].total++;
            if (p.status === 'win') byTeam[team].wins++;
            if (p.status === 'loss') byTeam[team].losses++;
        });
    });

    // Profit/Loss calculation
    let profit = 0;
    let totalStaked = 0;
    picks.forEach(p => {
        if (p.status === 'win' && p.odds) {
            profit += (parseFloat(p.odds) - 1);
            totalStaked += 1;
        } else if (p.status === 'loss') {
            profit -= 1;
            totalStaked += 1;
        }
    });

    // ROI calculation
    const roi = totalStaked > 0 ? ((profit / totalStaked) * 100).toFixed(1) : 0;

    // Racha actual (streak)
    const sortedPicks = picks
        .filter(p => p.status !== 'pending')
        .sort((a, b) => new Date(b.resolvedAt || b.createdAt) - new Date(a.resolvedAt || a.createdAt));

    let streak = 0;
    let streakType = null;
    for (const pick of sortedPicks) {
        if (streakType === null) {
            streakType = pick.status;
            streak = 1;
        } else if (pick.status === streakType) {
            streak++;
        } else {
            break;
        }
    }

    // Mejor y peor racha histórica
    let currentStreak = 0;
    let currentType = null;
    let bestWinStreak = 0;
    let worstLossStreak = 0;

    const chronologicalPicks = [...sortedPicks].reverse();
    chronologicalPicks.forEach(p => {
        if (currentType === p.status) {
            currentStreak++;
        } else {
            currentType = p.status;
            currentStreak = 1;
        }
        if (p.status === 'win' && currentStreak > bestWinStreak) bestWinStreak = currentStreak;
        if (p.status === 'loss' && currentStreak > worstLossStreak) worstLossStreak = currentStreak;
    });

    return {
        total, wins, losses, pending, winRate, byType, byTeam, byPeriod,
        profit: profit.toFixed(2),
        roi,
        streak: { count: streak, type: streakType },
        bestWinStreak,
        worstLossStreak
    };
}

// ═══════════════════════════════════════════════════════════════
// BEST PICKS ALGORITHM v2.0 - CON MODELO AVANZADO
// ═══════════════════════════════════════════════════════════════
function getBestPicks() {
    const teams = getTeams();
    const bestPicks = [];

    // Analizar todos los matchups posibles
    teams.forEach(local => {
        teams.forEach(away => {
            if (local === away) return;

            const lD = TEAM_STATS[local];
            const vD = TEAM_STATS[away];

            if (!lD || !vD) return;

            // USAR MODELO AVANZADO v2.0
            const advancedData = getAdvancedTrends(local, away);

            const trends = advancedData ? {
                q1: advancedData.q1,
                half: advancedData.half,
                full: advancedData.full
            } : {
                q1: lD.q1Home + vD.q1Away,
                half: lD.halfHome + vD.halfAway,
                full: lD.fullHome + vD.fullAway
            };

            // H2H data
            const h2h = getH2HData(local, away);

            // Analizar cada período
            ['q1', 'half', 'full'].forEach(period => {
                const trend = trends[period];
                const periodLabel = period === 'q1' ? '1Q' : period === 'half' ? '1H' : 'FULL';

                // Líneas sugeridas basadas en tendencia
                const suggestedLine = Math.round(trend * 2) / 2;

                // Calcular probabilidad OVER con modelo avanzado
                const probOver = calcProb(trend.toString(), suggestedLine.toString(), 'OVER', {
                    combinedPace: advancedData ? advancedData.combinedPace : LEAGUE_AVG.pace
                });

                if (probOver && probOver >= 60) {
                    let confidence = probOver;
                    let reason = `Tendencia v2.0: ${trend.toFixed(1)}`;

                    // Agregar info del modelo
                    if (advancedData && advancedData.components[period]) {
                        const comp = advancedData.components[period];
                        if (comp.altitude) reason += ` | 🏔️ Altitud +${comp.altitude}`;
                        if (comp.earlySeason) reason += ` | ⚠️ Early Season`;
                    }

                    // Bonus por H2H
                    if (h2h && h2h.games.length >= 3) {
                        const h2hAvg = period === 'q1'
                            ? h2h.avgQ1.team1 + h2h.avgQ1.team2
                            : period === 'half'
                                ? h2h.avgHalf.team1 + h2h.avgHalf.team2
                                : h2h.avgPts.team1 + h2h.avgPts.team2;

                        if (h2hAvg > suggestedLine) {
                            confidence += 5;
                            reason += ` | H2H: ${h2hAvg.toFixed(1)}`;
                        }
                    }

                    // Reducir confianza si hay warnings
                    if (advancedData && advancedData.warnings.length > 0) {
                        confidence -= advancedData.warnings.length * 3;
                    }

                    bestPicks.push({
                        local,
                        away,
                        period: periodLabel,
                        betType: 'OVER',
                        line: suggestedLine,
                        trend: trend.toFixed(1),
                        confidence: Math.min(Math.max(confidence, 50), 95),
                        reason,
                        h2hGames: h2h ? h2h.games.length : 0,
                        modelVersion: '2.0'
                    });
                }
            });
        });
    });

    // Ordenar por confianza y retornar top 5
    return bestPicks.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

function checkForValuePicks() {
    if (!localTeam || !visitingTeam) return;

    const lD = TEAM_STATS[localTeam];
    const vD = TEAM_STATS[visitingTeam];

    if (!lD || !vD) return;

    // USAR MODELO AVANZADO v2.0
    const advancedData = getAdvancedTrends(localTeam, visitingTeam);

    const trends = advancedData ? {
        q1: advancedData.q1.toFixed(1),
        half: advancedData.half.toFixed(1),
        full: advancedData.full.toFixed(1)
    } : {
        // Fallback al método simple si falla
        q1: (lD.q1Home + vD.q1Away).toFixed(1),
        half: (lD.halfHome + vD.halfAway).toFixed(1),
        full: (lD.fullHome + vD.fullAway).toFixed(1)
    };

    // Mostrar warnings del modelo si existen
    if (advancedData && advancedData.warnings.length > 0) {

    }

    // Obtener odds actuales
    const oddsMap = {
        '1Q': oddsQ1,
        '1H': oddsHalf,
        'FULL': oddsFull
    };

    // Verificar si hay valores altos
    [
        { period: '1Q', trend: trends.q1, line: lineQ1, type: typeQ1 },
        { period: '1H', trend: trends.half, line: lineHalf, type: typeHalf },
        { period: 'FULL', trend: trends.full, line: lineFull, type: typeFull }
    ].forEach(({ period, trend, line, type }) => {
        if (line) {
            const prob = calcProb(trend, line, type);
            const odds = oddsMap[period];
            const ev = odds ? calcEV(prob, odds) : null;

            if (prob && prob >= 75) {
                showNotification(`🔥 VALOR ALTO en ${period}: ${prob}% ${type} ${line}`, 'value');

                // Guardar automáticamente en VALUE_PICKS
                addValuePick({
                    id: `${localTeam}-${visitingTeam}-${period}-${type}-${line}-${Date.now()}`,
                    local: localTeam,
                    away: visitingTeam,
                    period,
                    betType: type,
                    line: parseFloat(line),
                    trend: parseFloat(trend),
                    probability: prob,
                    odds: odds ? parseFloat(odds) : null,
                    ev: ev,
                    detectedAt: new Date().toISOString()
                });
            }
        }
    });
}

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE VALUE PICKS (Picks de Alto Valor Detectados)
// ═══════════════════════════════════════════════════════════════
function addValuePick(pick) {
    // Verificar si ya existe un pick similar (mismo matchup, periodo, tipo, línea)
    const exists = VALUE_PICKS.some(p =>
        p.local === pick.local &&
        p.away === pick.away &&
        p.period === pick.period &&
        p.betType === pick.betType &&
        p.line === pick.line
    );

    if (!exists) {
        VALUE_PICKS.unshift(pick); // Agregar al inicio
        // Mantener máximo 20 picks
        if (VALUE_PICKS.length > 20) {
            VALUE_PICKS = VALUE_PICKS.slice(0, 20);
        }
        saveValuePicksToStorage();
    }
}

function removeValuePick(pickId) {
    VALUE_PICKS = VALUE_PICKS.filter(p => p.id !== pickId);
    saveValuePicksToStorage();
    render();
    showNotification('🗑️ Pick descartado', 'info');
}

function registerFromValuePick(pickId) {
    const pick = VALUE_PICKS.find(p => p.id === pickId);
    if (!pick) return;

    let odds = pick.odds;

    // Si no hay cuota, pedirla
    if (!odds || odds <= 1) {
        const oddsInput = prompt(`Ingresa la cuota para ${pick.period} ${pick.betType} ${pick.line}:`);
        if (oddsInput === null) return;
        odds = parseFloat(oddsInput) || null;
        if (!odds || odds <= 1) {
            showNotification('⚠️ Cuota inválida', 'warning');
            return;
        }
    }

    const ev = calcEV(pick.probability, odds);

    addPick({
        localTeam: pick.local,
        awayTeam: pick.away,
        period: pick.period,
        betType: pick.betType,
        line: pick.line,
        probability: pick.probability,
        odds: odds,
        ev: ev
    });

    // Remover de VALUE_PICKS después de registrar
    removeValuePick(pickId);
    showNotification(`✅ Pick registrado: ${pick.period} ${pick.betType} ${pick.line}`, 'success');
}

function analyzeFromValuePick(pickId) {
    const pick = VALUE_PICKS.find(p => p.id === pickId);
    if (!pick) return;

    // Configurar el matchup
    localTeam = pick.local;
    visitingTeam = pick.away;

    // Configurar línea y tipo según el período
    if (pick.period === '1Q') {
        lineQ1 = pick.line.toString();
        typeQ1 = pick.betType;
        if (pick.odds) oddsQ1 = pick.odds.toString();
    } else if (pick.period === '1H') {
        lineHalf = pick.line.toString();
        typeHalf = pick.betType;
        if (pick.odds) oddsHalf = pick.odds.toString();
    } else if (pick.period === 'FULL') {
        lineFull = pick.line.toString();
        typeFull = pick.betType;
        if (pick.odds) oddsFull = pick.odds.toString();
    }

    navigateTo('tendencia');
}

function clearAllValuePicks() {
    const run = () => {

        VALUE_PICKS = [];
        saveValuePicksToStorage();
        render();
        showNotification('🗑️ Todos los picks eliminados', 'info');
    };

    if (window.NioModal && typeof window.NioModal.confirm === 'function') {
        window.NioModal.confirm({
            title: 'Confirmar',
            message: '¿Eliminar todos los picks de valor detectados?',
            okText: 'Aceptar',
            cancelText: 'Cancelar'
        }).then((ok) => {
            if (!ok) return;
            run();
        });
        return;
    }

    // Fallback si el modal no está disponible
    if (confirm('¿Eliminar todos los picks de valor detectados?')) run();
}
// Guardar VALUE_PICKS en localStorage
function saveValuePicksToStorage() {
    try {
        localStorage.setItem('niosports_value_picks', JSON.stringify(VALUE_PICKS));
    } catch (e) {
        logger.warn('No se pudo guardar VALUE_PICKS:', e);
    }
}

// Cargar VALUE_PICKS desde localStorage
function loadValuePicksFromStorage() {
    try {
        const saved = localStorage.getItem('niosports_value_picks');
        if (saved) {
            VALUE_PICKS = JSON.parse(saved);
            // Filtrar picks de más de 24 horas
            const now = new Date();
            VALUE_PICKS = VALUE_PICKS.filter(p => {
                const detected = new Date(p.detectedAt);
                const hoursDiff = (now - detected) / (1000 * 60 * 60);
                return hoursDiff < 24;
            });
            saveValuePicksToStorage();
        }
    } catch (e) {
        logger.warn('No se pudo cargar VALUE_PICKS:', e);
        VALUE_PICKS = [];
    }
}

// ═══════════════════════════════════════════════════════════════
// FUNCIONES UTILIDADES
// ═══════════════════════════════════════════════════════════════
function getTeams() { return Object.keys(TEAM_STATS).sort(); }

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE RANKINGS - Posición de cada equipo en PPG
// ═══════════════════════════════════════════════════════════════
// Calcular ranking de un equipo en una estadística específica
function getTeamRanking(teamName, stat) {
    const teams = Object.entries(TEAM_STATS);
    if (teams.length === 0) return null;

    // Ordenar equipos por la estadística (mayor a menor)
    const sorted = teams
        .filter(([name, data]) => data[stat] !== undefined)
        .sort((a, b) => b[1][stat] - a[1][stat]);

    // Encontrar posición del equipo (1-indexed)
    const index = sorted.findIndex(([name]) => name === teamName);
    return index >= 0 ? index + 1 : null;
}

// Obtener todos los rankings de un equipo
function getAllTeamRankings(teamName) {
    const stats = TEAM_STATS[teamName];
    if (!stats) return null;

    return {
        full: getTeamRanking(teamName, 'full'),
        fullHome: getTeamRanking(teamName, 'fullHome'),
        fullAway: getTeamRanking(teamName, 'fullAway'),
        half: getTeamRanking(teamName, 'half'),
        halfHome: getTeamRanking(teamName, 'halfHome'),
        halfAway: getTeamRanking(teamName, 'halfAway'),
        q1: getTeamRanking(teamName, 'q1'),
        q1Home: getTeamRanking(teamName, 'q1Home'),
        q1Away: getTeamRanking(teamName, 'q1Away'),
        // Nuevas stats
        pace: getTeamRanking(teamName, 'pace'),
        oppPpg: getTeamRanking(teamName, 'oppPpg')
    };
}

// Formatear ranking con color según posición
function formatRanking(rank, inverse = false) {
    if (!rank) return '';

    // Para stats defensivas, menor rank = mejor (inverse = true)
    let colorClass = '';
    if (inverse) {
        // Inverso: #1 = mejor defensa (permite menos puntos)
        if (rank <= 10) colorClass = 'text-green-400';
        else if (rank <= 20) colorClass = 'text-yellow-400';
        else colorClass = 'text-red-400';
    } else {
        // Normal: #1 = más puntos
        if (rank <= 10) colorClass = 'text-green-400';
        else if (rank <= 20) colorClass = 'text-yellow-400';
        else colorClass = 'text-red-400';
    }

    return `<span class="${colorClass} text-sm font-black">#${rank}</span>`;
}

// ═══════════════════════════════════════════════════════════════
// NIOSPORTS PRO v2.5 FINAL - MODELO PREDICTIVO AVANZADO
// ═══════════════════════════════════════════════════════════════
// Basado en investigación académica y mejores prácticas:
// - XGBoost/SHAP studies (PLOS ONE 2024)
// - Bayesian modeling (icSPORTS 2023)
// - FiveThirtyEight methodology
// - Walsh & Joshi calibration research (2024)
// Paper: "Random Walk Picture of Basketball Scoring"
// ═══════════════════════════════════════════════════════════════

// Promedios de liga para normalización (se actualizan desde API)
let LEAGUE_AVG = {
    pace: 100.0,    // Posesiones por juego promedio NBA
    ppg: 115.0,     // Puntos por juego promedio NBA
    q1: 29.0,       // Q1 promedio
    half: 57.0      // 1H promedio
};

// Desviaciones estándar BASE calibradas para TOTALES COMBINADOS
const NBA_STD_DEVS = {
    Q1: 8.0,    // 1er Cuarto: ~7-9 puntos SD
    HALF: 13.0, // 1era Mitad: ~12-14 puntos SD
    FULL: 18.5  // Partido Completo: ~17-20 puntos SD
};

// Home Court Advantage en puntos (promedio NBA actual ~2.5-3.0)
const HOME_COURT_ADVANTAGE = {
    full: 2.5,      // Ventaja de local en partido completo
    half: 1.25,     // Proporcionalmente en 1H
    q1: 0.6         // Proporcionalmente en Q1
};

// Equipos con ventaja de altitud significativa
const ALTITUDE_TEAMS = {
    'Nuggets': 2.5,  // Denver: 5,280 pies - mayor ventaja
    'Jazz': 1.0      // Utah: 4,226 pies - ventaja menor
};

// ═══════════════════════════════════════════════════════════════
// FACTORES DE AJUSTE DEL MODELO v2.5 FINAL
// ═══════════════════════════════════════════════════════════════

// Back-to-Back penalty (-1.25 pts)
const B2B_PENALTY = { full: -1.25, half: -0.6, q1: -0.3 };

// Rest Days bonus (+0.5 a +1.5 pts)
const REST_BONUS = {
    full: { days3plus: 1.5, days2: 0.5 },
    half: { days3plus: 0.75, days2: 0.25 },
    q1: { days3plus: 0.4, days2: 0.1 }
};

// Injury penalty (-3.5 pts por estrella)
const INJURY_PENALTY = { full: -3.5, half: -1.75, q1: -0.9 };

// Streak factor (±0.25 pts por partido, max ±5)
const STREAK_FACTOR = { full: 0.25, half: 0.12, q1: 0.06 };

// Travel/Timezone factor (viajes largos afectan rendimiento)
const TRAVEL_PENALTY = {
    crossCountry: { full: -1.0, half: -0.5, q1: -0.25 },  // Costa a Costa (3+ zonas)
    moderate: { full: -0.5, half: -0.25, q1: -0.1 }       // 1-2 zonas horarias
};

// Schedule density (fatiga acumulada)
const SCHEDULE_DENSITY_PENALTY = {
    // 4 juegos en 5 noches
    fourInFive: { full: -1.5, half: -0.75, q1: -0.4 },
    // 3 juegos en 4 noches
    threeInFour: { full: -0.75, half: -0.4, q1: -0.2 }
};

// Division rivalry bonus (partidos más intensos)
const DIVISION_RIVALRY_BONUS = { full: 2.0, half: 1.0, q1: 0.5 };

// Day of week factor (investigación: más puntos en ciertos días)
const DAY_OF_WEEK_FACTOR = {
    // Viernes/Sábado: equipos más motivados, más público
    friday: { full: 1.5, half: 0.75, q1: 0.4 },
    saturday: { full: 1.5, half: 0.75, q1: 0.4 },
    // Domingo: segundo de B2B frecuente, algo menos
    sunday: { full: 0.5, half: 0.25, q1: 0.1 },
    // Entre semana: normal
    weekday: { full: 0, half: 0, q1: 0 }
};

// Timezone mapping para equipos
const TEAM_TIMEZONE = {
    // Eastern (-5)
    "Celtics": -5, "Nets": -5, "Knicks": -5, "76ers": -5, "Raptors": -5,
    "Bulls": -6, "Cavaliers": -5, "Pistons": -5, "Pacers": -5, "Bucks": -6,
    "Hawks": -5, "Hornets": -5, "Heat": -5, "Magic": -5, "Wizards": -5,
    // Central (-6)
    "Mavericks": -6, "Rockets": -6, "Grizzlies": -6, "Pelicans": -6, "Spurs": -6,
    "Timberwolves": -6, "Thunder": -6,
    // Mountain (-7)
    "Nuggets": -7, "Jazz": -7, "Suns": -7,
    // Pacific (-8)
    "Lakers": -8, "Clippers": -8, "Warriors": -8, "Kings": -8, "Trail Blazers": -8
};

// Divisiones NBA para rivalry bonus
const NBA_DIVISIONS = {
    atlantic: ["Celtics", "Nets", "Knicks", "76ers", "Raptors"],
    central: ["Bulls", "Cavaliers", "Pistons", "Pacers", "Bucks"],
    southeast: ["Hawks", "Hornets", "Heat", "Magic", "Wizards"],
    northwest: ["Nuggets", "Timberwolves", "Thunder", "Trail Blazers", "Jazz"],
    pacific: ["Warriors", "Clippers", "Lakers", "Kings", "Suns"],
    southwest: ["Mavericks", "Rockets", "Grizzlies", "Pelicans", "Spurs"]
};

// Configuración del modelo avanzado
const MODEL_CONFIG = {
    weights: {
        offense: 0.40,      // PPG del equipo
        defense: 0.35,      // OppPPG del rival
        pace: 0.15,         // Ajuste por ritmo
        context: 0.10       // HCA, altitud
    },
    regression: {
        early: 0.70,        // <10 partidos
        mid: 0.85,          // 10-25 partidos
        late: 0.95          // 25+ partidos
    },
    thresholds: {
        highValue: 75,
        minConfidence: 55
    }
};

// Early Season Bias (58% UNDERs en primeras semanas)
const EARLY_SEASON_BIAS = {
    active: true,
    adjustment: -1.5,       // Puntos a restar
    weeksAffected: 2
};

// Obtener factor de regresión según momento de temporada
function getRegressionFactor() {
    const now = new Date();
    const seasonStart = new Date(now.getFullYear(), 9, 22);
    if (now < seasonStart) seasonStart.setFullYear(seasonStart.getFullYear() - 1);
    const weeksIntoSeason = Math.floor((now - seasonStart) / (7 * 24 * 60 * 60 * 1000));
    const estimatedGames = weeksIntoSeason * 3.5;

    if (estimatedGames < 10) return MODEL_CONFIG.regression.early;
    if (estimatedGames < 25) return MODEL_CONFIG.regression.mid;
    return MODEL_CONFIG.regression.late;
}

// Verificar si es early season
function isEarlySeason() {
    const now = new Date();
    const seasonStart = new Date(now.getFullYear(), 9, 22);
    if (now < seasonStart) seasonStart.setFullYear(seasonStart.getFullYear() - 1);
    const weeksIntoSeason = Math.floor((now - seasonStart) / (7 * 24 * 60 * 60 * 1000));
    return weeksIntoSeason < EARLY_SEASON_BIAS.weeksAffected;
}

// ═══════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES v2.5
// ═══════════════════════════════════════════════════════════════

// Detectar si dos equipos son de la misma división
function areDivisionRivals(team1, team2) {
    for (const division of Object.values(NBA_DIVISIONS)) {
        if (division.includes(team1) && division.includes(team2)) return true;
    }
    return false;
}

// Calcular diferencia de timezone entre equipos
function getTimezoneDiff(homeTeam, awayTeam) {
    const homeTZ = TEAM_TIMEZONE[homeTeam] || -6;
    const awayTZ = TEAM_TIMEZONE[awayTeam] || -6;
    return Math.abs(homeTZ - awayTZ);
}

// Auto-detectar travel penalty basado en equipos
function autoDetectTravel(homeTeam, awayTeam) {
    const tzDiff = getTimezoneDiff(homeTeam, awayTeam);
    if (tzDiff >= 3) return 'crossCountry';
    if (tzDiff >= 1) return 'moderate';
    return 'none';
}

// Auto-detectar rivalry
function autoDetectRivalry(team1, team2) {
    return areDivisionRivals(team1, team2);
}

// Obtener día de la semana actual
function getCurrentGameDay() {
    const day = new Date().getDay();
    if (day === 5) return 'friday';
    if (day === 6) return 'saturday';
    if (day === 0) return 'sunday';
    return 'weekday';
}

// ═══════════════════════════════════════════════════════════════
// AUTO-DETECCIÓN DE FACTORES CONTEXTUALES v2.5
// ═══════════════════════════════════════════════════════════════

// Mapeo de nombres de equipos para API (balldontlie usa nombres completos)
const TEAM_API_NAMES = {
    "Hawks": "Atlanta Hawks", "Celtics": "Boston Celtics", "Nets": "Brooklyn Nets",
    "Hornets": "Charlotte Hornets", "Bulls": "Chicago Bulls", "Cavaliers": "Cleveland Cavaliers",
    "Mavericks": "Dallas Mavericks", "Nuggets": "Denver Nuggets", "Pistons": "Detroit Pistons",
    "Warriors": "Golden State Warriors", "Rockets": "Houston Rockets", "Pacers": "Indiana Pacers",
    "Clippers": "Los Angeles Clippers", "Lakers": "Los Angeles Lakers", "Grizzlies": "Memphis Grizzlies",
    "Heat": "Miami Heat", "Bucks": "Milwaukee Bucks", "Timberwolves": "Minnesota Timberwolves",
    "Pelicans": "New Orleans Pelicans", "Knicks": "New York Knicks", "Thunder": "Oklahoma City Thunder",
    "Magic": "Orlando Magic", "76ers": "Philadelphia 76ers", "Suns": "Phoenix Suns",
    "Trail Blazers": "Portland Trail Blazers", "Kings": "Sacramento Kings", "Spurs": "San Antonio Spurs",
    "Raptors": "Toronto Raptors", "Jazz": "Utah Jazz", "Wizards": "Washington Wizards"
};

// IDs de equipos en ESPN API (gratuita)
const TEAM_ESPN_IDS = {
    "Hawks": 1, "Celtics": 2, "Nets": 17, "Hornets": 30, "Bulls": 4, "Cavaliers": 5,
    "Mavericks": 6, "Nuggets": 7, "Pistons": 8, "Warriors": 9, "Rockets": 10, "Pacers": 11,
    "Clippers": 12, "Lakers": 13, "Grizzlies": 29, "Heat": 14, "Bucks": 15, "Timberwolves": 16,
    "Pelicans": 3, "Knicks": 18, "Thunder": 25, "Magic": 19, "76ers": 20, "Suns": 21,
    "Trail Blazers": 22, "Kings": 23, "Spurs": 24, "Raptors": 28, "Jazz": 26, "Wizards": 27
};

// Obtener últimos partidos de un equipo desde ESPN API (GRATUITA)
async function fetchTeamRecentGames(teamName) {
    const teamId = TEAM_ESPN_IDS[teamName];
    if (!teamId) return null;

    // Verificar cache (1 hora)
    const cacheKey = `${teamName}_games`;
    if (TEAM_GAMES_CACHE[cacheKey] && Date.now() - TEAM_GAMES_CACHE[cacheKey].timestamp < 3600000) {
        return TEAM_GAMES_CACHE[cacheKey].data;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

        const response = await fetch(
            `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/schedule`,
            { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const events = data.events || [];

        // Filtrar solo partidos completados
        const completedGames = events.filter(e =>
            e.competitions && e.competitions[0] &&
            e.competitions[0].status && e.competitions[0].status.type &&
            e.competitions[0].status.type.completed
        );

        // Transformar al formato que necesitamos
        const games = completedGames.map(e => {
            const comp = e.competitions[0];
            const homeTeam = comp.competitors.find(c => c.homeAway === 'home');
            const awayTeam = comp.competitors.find(c => c.homeAway === 'away');
            if (!homeTeam || !awayTeam) return null;
            return {
                date: e.date,
                home_team: { name: homeTeam.team.shortDisplayName, full_name: homeTeam.team.displayName },
                visitor_team: { name: awayTeam.team.shortDisplayName, full_name: awayTeam.team.displayName },
                home_team_score: safeParseInt(homeTeam.score, 0),
                visitor_team_score: safeParseInt(awayTeam.score, 0),
                status: 'Final'
            };
        }).filter(g => g !== null);

        // Guardar en cache
        TEAM_GAMES_CACHE[cacheKey] = { data: games, timestamp: Date.now() };

        return games;
    } catch (error) {
        // Silencioso - auto-detección falla graciosamente
        return null;
    }
}

// Calcular racha de un equipo basado en últimos partidos
function calculateStreak(games, teamName) {
    if (!games || games.length === 0) return 0;

    // Ordenar por fecha descendente (más reciente primero)
    const sortedGames = [...games].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (sortedGames.length === 0) return 0;

    let streak = 0;
    let lastResult = null;

    for (const game of sortedGames.slice(0, 10)) {
        // Detectar si es home o away
        const isHome = game.home_team.full_name.includes(teamName) ||
            game.home_team.name === teamName ||
            TEAM_API_NAMES[teamName]?.includes(game.home_team.name);

        const teamScore = isHome ? game.home_team_score : game.visitor_team_score;
        const oppScore = isHome ? game.visitor_team_score : game.home_team_score;
        const won = teamScore > oppScore;

        if (lastResult === null) {
            lastResult = won;
            streak = won ? 1 : -1;
        } else if (won === lastResult) {
            streak += won ? 1 : -1;
        } else {
            break;
        }
    }

    return Math.max(-5, Math.min(5, streak));
}

// Calcular días de descanso desde último partido
function calculateRestDays(games, teamName) {
    if (!games || games.length === 0) return 1;

    // Ordenar por fecha descendente y obtener el más reciente
    const sortedGames = [...games].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (sortedGames.length === 0) return 1;

    const lastGame = sortedGames[0];
    const lastGameDate = new Date(lastGame.date);
    const today = new Date();

    // Normalizar a medianoche
    today.setHours(0, 0, 0, 0);
    lastGameDate.setHours(0, 0, 0, 0);

    const diffTime = today - lastGameDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(1, diffDays);
}

// Detectar B2B (jugó ayer)
function detectB2B(games, teamName) {
    const restDays = calculateRestDays(games, teamName);
    return restDays === 1;
}

// Calcular densidad de schedule (partidos en últimos días)
function calculateScheduleDensity(games, teamName) {
    if (!games || games.length === 0) return 'normal';

    const today = new Date();
    const fiveDaysAgo = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000);
    const fourDaysAgo = new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000);

    const completedGames = games.filter(g => g.status === 'Final');

    // Contar partidos en últimos 5 días
    const gamesInFive = completedGames.filter(g => {
        const gameDate = new Date(g.date);
        return gameDate >= fiveDaysAgo && gameDate <= today;
    }).length;

    // Contar partidos en últimos 4 días
    const gamesInFour = completedGames.filter(g => {
        const gameDate = new Date(g.date);
        return gameDate >= fourDaysAgo && gameDate <= today;
    }).length;

    if (gamesInFive >= 4) return '4in5';
    if (gamesInFour >= 3) return '3in4';
    return 'normal';
}

// Función principal de auto-detección
async function autoDetectContextualFactors(homeTeam, awayTeam) {
    if (!autoDetectEnabled || !homeTeam || !awayTeam) return;

    try {
        // 1. AUTO-DETECTAR DÍA DE LA SEMANA
        gameDay = getCurrentGameDay();

        // 2. AUTO-DETECTAR RIVALIDAD DE DIVISIÓN
        isDivisionRivalry = areDivisionRivals(homeTeam, awayTeam);

        // 3. AUTO-DETECTAR TRAVEL
        awayTravel = autoDetectTravel(homeTeam, awayTeam);

        // 4. OBTENER DATOS DE API PARA AMBOS EQUIPOS
        showNotification('🔄 Cargando datos contextuales...', 'info');

        const [homeGames, awayGames] = await Promise.all([
            fetchTeamRecentGames(homeTeam),
            fetchTeamRecentGames(awayTeam)
        ]);

        // 5. CALCULAR RACHAS
        if (homeGames) {
            localStreak = calculateStreak(homeGames, homeTeam);
        }
        if (awayGames) {
            awayStreak = calculateStreak(awayGames, awayTeam);
        }

        // 6. CALCULAR DÍAS DE DESCANSO
        if (homeGames) {
            localRestDays = calculateRestDays(homeGames, homeTeam);
            localB2B = localRestDays === 1;
        }
        if (awayGames) {
            awayRestDays = calculateRestDays(awayGames, awayTeam);
            awayB2B = awayRestDays === 1;
        }

        // 7. CALCULAR DENSIDAD DE SCHEDULE
        if (homeGames) {
            localScheduleDensity = calculateScheduleDensity(homeGames, homeTeam);
        }
        if (awayGames) {
            awayScheduleDensity = calculateScheduleDensity(awayGames, awayTeam);
        }

        showNotification('✅ Factores contextuales detectados automáticamente', 'success');

    } catch (error) {
        Logger.error('Error en auto-detección:', error);
        showNotification('⚠️ Auto-detección parcial - algunos datos manuales requeridos', 'warning');
    }
}

// Resetear factores a valores por defecto
function resetContextualFactors() {
    localB2B = false; awayB2B = false;
    localRestDays = 1; awayRestDays = 1;
    localInjury = false; awayInjury = false;
    localStreak = 0; awayStreak = 0;
    awayTravel = 'none';
    localScheduleDensity = 'normal'; awayScheduleDensity = 'normal';
    isDivisionRivalry = false;
    gameDay = 'weekday';
}

// SD dinámica ajustada por PACE
function getStdDevDynamic(trendValue, combinedPace = LEAGUE_AVG.pace) {
    let baseSD;
    if (trendValue < 70) baseSD = NBA_STD_DEVS.Q1;
    else if (trendValue < 160) baseSD = NBA_STD_DEVS.HALF;
    else baseSD = NBA_STD_DEVS.FULL;

    // Más PACE = más varianza
    const paceMultiplier = 1 + ((combinedPace - LEAGUE_AVG.pace) / LEAGUE_AVG.pace) * 0.5;
    return baseSD * Math.max(0.85, Math.min(1.15, paceMultiplier));
}

// Función legacy para compatibilidad
function getStdDev(trendValue) {
    return getStdDevDynamic(trendValue, LEAGUE_AVG.pace);
}

// ═══════════════════════════════════════════════════════════════
// CÁLCULO DE TENDENCIA AVANZADA v2.5 (Optimizado)
// ═══════════════════════════════════════════════════════════════
function calculateAdvancedTrend(localTeamName, awayTeamName, period = 'full') {
    // Verificar cache primero
    const cached = getCachedTrend(localTeamName, awayTeamName, period);
    if (cached) return cached;

    const local = TEAM_STATS[localTeamName];
    const away = TEAM_STATS[awayTeamName];

    if (!local || !away) return null;

    const warnings = [];
    const components = {};
    const mult = getPeriodMultiplier(period);

    // 1. COMPONENTE OFENSIVO (usando helper)
    const offenseDefaults = { q1: 29, half: 57, full: 115 };
    const defaultOff = getByPeriod(period, offenseDefaults);

    let offenseLocal, offenseAway;
    if (period === 'q1') {
        offenseLocal = local.q1Home || local.q1 || defaultOff;
        offenseAway = away.q1Away || away.q1 || defaultOff;
    } else if (period === 'half') {
        offenseLocal = local.halfHome || local.half || defaultOff;
        offenseAway = away.halfAway || away.half || defaultOff;
    } else {
        offenseLocal = local.fullHome || local.full || defaultOff;
        offenseAway = away.fullAway || away.full || defaultOff;
    }
    components.offense = offenseLocal + offenseAway;

    // 2. COMPONENTE DEFENSIVO
    let defenseLocal, defenseAway;
    if (period === 'q1') {
        defenseLocal = local.oppQ1 || (local.oppPpg ? local.oppPpg / 4 : 29);
        defenseAway = away.oppQ1 || (away.oppPpg ? away.oppPpg / 4 : 29);
    } else if (period === 'half') {
        defenseLocal = local.oppHalf || (local.oppPpg ? local.oppPpg / 2 : 57);
        defenseAway = away.oppHalf || (away.oppPpg ? away.oppPpg / 2 : 57);
    } else {
        defenseLocal = local.oppPpgHome || local.oppPpg || 115;
        defenseAway = away.oppPpgAway || away.oppPpg || 115;
    }
    components.defense = defenseLocal + defenseAway;

    // 3. AJUSTE POR PACE
    const localPace = local.pace || LEAGUE_AVG.pace;
    const awayPace = away.pace || LEAGUE_AVG.pace;
    const combinedPace = (localPace + awayPace) / 2;
    const paceAdjusted = (combinedPace - LEAGUE_AVG.pace) * 0.5 * mult;
    components.pace = paceAdjusted;
    components.combinedPace = combinedPace;

    // 4. AJUSTE CONTEXTUAL (HCA + Altitud) - Usando helper
    let contextAdjust = getByPeriod(period, HOME_COURT_ADVANTAGE);

    if (ALTITUDE_TEAMS[localTeamName]) {
        const altBonus = ALTITUDE_TEAMS[localTeamName] * mult;
        contextAdjust += altBonus;
        components.altitude = ALTITUDE_TEAMS[localTeamName];
    }
    components.context = contextAdjust;

    // 4.5 AJUSTE POR BACK-TO-BACK (B2B) - Optimizado
    let b2bAdjust = 0;
    const b2bPenalty = getByPeriod(period, B2B_PENALTY);
    if (localB2B) { b2bAdjust += b2bPenalty; warnings.push('⚠️ Local B2B'); }
    if (awayB2B) { b2bAdjust += b2bPenalty; warnings.push('⚠️ Visitante B2B'); }
    components.b2b = b2bAdjust;

    // 4.6 AJUSTE POR REST DAYS - Optimizado
    let restAdjust = 0;
    const restBonus = getByPeriod(period, REST_BONUS);
    if (localRestDays >= 3) restAdjust += restBonus.days3plus;
    else if (localRestDays === 2) restAdjust += restBonus.days2;
    if (awayRestDays >= 3) restAdjust += restBonus.days3plus;
    else if (awayRestDays === 2) restAdjust += restBonus.days2;
    components.rest = restAdjust;
    if (localRestDays >= 3) warnings.push(`✅ ${localTeamName} +${localRestDays}d`);
    if (awayRestDays >= 3) warnings.push(`✅ ${awayTeamName} +${awayRestDays}d`);

    // 4.7 AJUSTE POR INJURIES - Optimizado
    let injuryAdjust = 0;
    const injPenalty = getByPeriod(period, INJURY_PENALTY);
    if (localInjury) { injuryAdjust += injPenalty; warnings.push(`🏥 ${localTeamName}`); }
    if (awayInjury) { injuryAdjust += injPenalty; warnings.push(`🏥 ${awayTeamName}`); }
    components.injury = injuryAdjust;

    // 4.8 AJUSTE POR STREAKS - Optimizado
    const localStreakLimited = Math.max(-5, Math.min(5, localStreak));
    const awayStreakLimited = Math.max(-5, Math.min(5, awayStreak));
    const streakFactor = getByPeriod(period, STREAK_FACTOR);
    const streakAdjust = (localStreakLimited + awayStreakLimited) * streakFactor;
    components.streak = streakAdjust;
    if (localStreak >= 3) warnings.push(`🔥 ${localTeamName} +${localStreak}`);
    if (localStreak <= -3) warnings.push(`❄️ ${localTeamName} ${localStreak}`);
    if (awayStreak >= 3) warnings.push(`🔥 ${awayTeamName} +${awayStreak}`);
    if (awayStreak <= -3) warnings.push(`❄️ ${awayTeamName} ${awayStreak}`);

    // 4.9 AJUSTE POR TRAVEL - Optimizado
    let travelAdjust = 0;
    if (awayTravel === 'crossCountry') {
        travelAdjust = getByPeriod(period, TRAVEL_PENALTY.crossCountry);
        warnings.push(`✈️ ${awayTeamName} viaje largo`);
    } else if (awayTravel === 'moderate') {
        travelAdjust = getByPeriod(period, TRAVEL_PENALTY.moderate);
    }
    components.travel = travelAdjust;

    // 4.10 AJUSTE POR SCHEDULE DENSITY - Optimizado
    let scheduleAdjust = 0;
    const fourInFive = getByPeriod(period, SCHEDULE_DENSITY_PENALTY.fourInFive);
    const threeInFour = getByPeriod(period, SCHEDULE_DENSITY_PENALTY.threeInFour);

    if (localScheduleDensity === '4in5') { scheduleAdjust += fourInFive; warnings.push(`😰 ${localTeamName} 4-en-5`); }
    else if (localScheduleDensity === '3in4') { scheduleAdjust += threeInFour; }
    if (awayScheduleDensity === '4in5') { scheduleAdjust += fourInFive; warnings.push(`😰 ${awayTeamName} 4-en-5`); }
    else if (awayScheduleDensity === '3in4') { scheduleAdjust += threeInFour; }
    components.schedule = scheduleAdjust;

    // 4.11 AJUSTE POR DIVISION RIVALRY - Optimizado
    let divisionAdjust = 0;
    if (isDivisionRivalry) {
        divisionAdjust = getByPeriod(period, DIVISION_RIVALRY_BONUS);
        warnings.push(`⚔️ División`);
    }
    components.division = divisionAdjust;

    // 4.12 AJUSTE POR DÍA - Optimizado
    const dayFactor = DAY_OF_WEEK_FACTOR[gameDay] || DAY_OF_WEEK_FACTOR.weekday;
    const dayAdjust = getByPeriod(period, dayFactor);
    components.dayOfWeek = dayAdjust;
    if (gameDay === 'friday' || gameDay === 'saturday') warnings.push(`🎉 Fin de semana`);

    // 5. CÁLCULO FINAL
    const baseTotal = (components.offense * MODEL_CONFIG.weights.offense +
        components.defense * MODEL_CONFIG.weights.defense) /
        (MODEL_CONFIG.weights.offense + MODEL_CONFIG.weights.defense);

    let finalTrend = baseTotal + components.pace + components.context + b2bAdjust + restAdjust + injuryAdjust + streakAdjust + travelAdjust + scheduleAdjust + divisionAdjust + dayAdjust;

    // 6. EARLY SEASON BIAS - Optimizado
    if (EARLY_SEASON_BIAS.active && isEarlySeason()) {
        finalTrend += EARLY_SEASON_BIAS.adjustment * mult;
        warnings.push('⚠️ Early Season');
        components.earlySeason = true;
    }

    // 7. REGRESIÓN A LA MEDIA - Optimizado
    const regressionFactor = getRegressionFactor();
    const leagueAvgByPeriod = { q1: LEAGUE_AVG.q1 * 2, half: LEAGUE_AVG.half * 2, full: LEAGUE_AVG.ppg * 2 };
    const leagueAvg = getByPeriod(period, leagueAvgByPeriod);

    finalTrend = finalTrend * regressionFactor + leagueAvg * (1 - regressionFactor);
    components.regression = regressionFactor;

    // 8. CONFIANZA - Cálculo mejorado y más realista
    let confidence = 85; // Base 85%, no 100%

    // Bonus por datos completos
    if (local.oppPpg && away.oppPpg) confidence += 5; // Datos defensivos completos
    if (local.pace && away.pace) confidence += 5; // Datos PACE completos

    // Penalizaciones
    if (!local.oppPpg || !away.oppPpg) { confidence -= 10; warnings.push('⚠️ Sin datos defensivos'); }
    if (!local.pace || !away.pace) { confidence -= 8; warnings.push('⚠️ Sin datos PACE'); }
    if (components.earlySeason) { confidence -= 12; }
    if (regressionFactor < 0.85) { confidence -= 8; }

    // Penalizar diferencias extremas entre Home y Away (inconsistencia)
    const homeAwayDiff = Math.abs(offenseLocal - offenseAway);
    if (period === 'full' && homeAwayDiff > 10) {
        confidence -= 5;
        warnings.push('⚠️ Alta variabilidad Home/Away');
    }

    // Penalizar cuando la predicción está muy lejos del promedio de liga
    const deviationFromAvg = Math.abs(finalTrend - leagueAvg);
    if (period === 'full' && deviationFromAvg > 15) {
        confidence -= 5;
    }

    // Bonus por datos de splits específicos (Home/Away)
    if (local.fullHome && local.fullAway && away.fullHome && away.fullAway) {
        confidence += 3;
    }

    const result = {
        trend: safeParseFloat(finalTrend.toFixed(1)),
        components,
        confidence: Math.max(55, Math.min(95, confidence)),
        warnings,
        combinedPace
    };

    // Guardar en cache
    setCachedTrend(localTeamName, awayTeamName, period, result);

    return result;
}

// Obtener tendencias completas con modelo avanzado
function getAdvancedTrends(localTeamName, awayTeamName) {
    const q1 = calculateAdvancedTrend(localTeamName, awayTeamName, 'q1');
    const half = calculateAdvancedTrend(localTeamName, awayTeamName, 'half');
    const full = calculateAdvancedTrend(localTeamName, awayTeamName, 'full');

    if (!q1 || !half || !full) return null;

    return {
        q1: q1.trend, half: half.trend, full: full.trend,
        components: { q1: q1.components, half: half.components, full: full.components },
        confidence: Math.min(q1.confidence, half.confidence, full.confidence),
        warnings: [...new Set([...q1.warnings, ...half.warnings, ...full.warnings])],
        combinedPace: full.combinedPace,
        isEarlySeason: q1.components.earlySeason || false
    };
}

// Calcular probabilidad con calibración avanzada
function calcProb(trend, line, type, options = {}) {
    if (!trend || trend === '-' || !line) return null;

    const trendNum = parseFloat(trend);
    const lineNum = parseFloat(line);
    const diff = trendNum - lineNum;

    const combinedPace = options.combinedPace || LEAGUE_AVG.pace;
    const std = getStdDevDynamic(trendNum, combinedPace);
    const z = diff / std;

    // CDF normal (Abramowitz-Stegun)
    const cdf = x => {
        const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
        const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
        const sign = x < 0 ? -1 : 1;
        const absX = Math.abs(x);
        const t = 1.0 / (1.0 + p * absX);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);
        return 0.5 * (1.0 + sign * y);
    };

    let prob = type === 'OVER' ? cdf(z) : 1 - cdf(z);

    // Calibración con regresión dinámica
    const regressionFactor = getRegressionFactor();
    prob = prob * regressionFactor + 0.5 * (1 - regressionFactor);

    // Early season: más conservador
    if (isEarlySeason()) {
        prob = prob * 0.90 + 0.5 * 0.10;
    }

    prob = Math.max(0.05, Math.min(0.95, prob));
    return Math.round(prob * 100);
}

// Calcular Expected Value (EV) - LA MÉTRICA MÁS IMPORTANTE
function calcEV(prob, odds) {
    if (!prob || !odds) return null;
    const p = prob / 100;
    const oddsNum = parseFloat(odds);
    if (oddsNum <= 1) return null;

    // EV = (Prob × Ganancia) - (1-Prob × Pérdida)
    // Ganancia si ganas = (odds - 1) por unidad
    // Pérdida si pierdes = 1 unidad
    const ev = (p * (oddsNum - 1)) - ((1 - p) * 1);
    return (ev * 100).toFixed(1); // Retorna como porcentaje
}

// Calcular Edge (Ventaja sobre la casa)
function calcEdge(prob, odds) {
    if (!prob || !odds) return null;
    const oddsNum = parseFloat(odds);
    if (oddsNum <= 1) return null;

    // Probabilidad implícita de la casa (sin vig)
    const impliedProb = 1 / oddsNum;
    const ourProb = prob / 100;

    // Edge = Nuestra probabilidad - Probabilidad implícita
    const edge = (ourProb - impliedProb) * 100;
    return edge.toFixed(1);
}

// Calcular Cuota Justa (Fair Odds)
function calcFairOdds(prob) {
    if (!prob || prob <= 0 || prob >= 100) return null;
    // Cuota Justa = 1 / Probabilidad
    return (100 / prob).toFixed(2);
}

// Calcular Kelly Criterion (% óptimo de bankroll a apostar)
function calcKelly(prob, odds) {
    if (!prob || !odds) return null;
    const p = prob / 100;
    const oddsNum = parseFloat(odds);
    if (oddsNum <= 1) return null;

    // Kelly = (p × (odds - 1) - (1-p)) / (odds - 1)
    // Simplificado: Kelly = (p × odds - 1) / (odds - 1)
    const kelly = ((p * oddsNum) - 1) / (oddsNum - 1);

    // Kelly fraccionario (más conservador, usar 25% del Kelly completo)
    const fractionalKelly = kelly * 0.25;

    if (fractionalKelly <= 0) return 0;
    return (fractionalKelly * 100).toFixed(1);
}

// Análisis completo de una apuesta (incluye métricas de transparencia)
function analyzebet(trend, line, type, odds) {
    if (!trend || trend === '-' || !line) return null;

    const trendNum = parseFloat(trend);
    const lineNum = parseFloat(line);
    const diff = trendNum - lineNum;
    const std = getStdDev(trendNum);
    const zScore = diff / std;

    const prob = calcProb(trend, line, type);
    if (!prob) return null;

    const fairOdds = calcFairOdds(prob);
    const ev = odds ? calcEV(prob, odds) : null;
    const edge = odds ? calcEdge(prob, odds) : null;
    const kelly = odds ? calcKelly(prob, odds) : null;

    // Incluir métricas de transparencia
    return {
        prob,
        fairOdds,
        ev,
        edge,
        kelly,
        // Métricas adicionales para transparencia
        diff: diff.toFixed(1),
        std: std.toFixed(1),
        zScore: zScore.toFixed(2)
    };
}

// Color basado en EV (no solo probabilidad)
function evColor(ev, prob) {
    if (ev === null) {
        if (!prob) return 'bg-gray-600';
        if (prob >= 65) return 'bg-blue-600';
        if (prob >= 55) return 'bg-blue-500';
        if (prob >= 45) return 'bg-gray-500';
        return 'bg-gray-600';
    }

    const evNum = safeParseFloat(ev);
    if (evNum >= 15) return 'bg-gradient-to-r from-emerald-500 to-green-600';
    if (evNum >= 7) return 'bg-gradient-to-r from-green-500 to-emerald-600';
    if (evNum >= 3) return 'bg-gradient-to-r from-lime-500 to-green-500';
    if (evNum >= 0) return 'bg-gradient-to-r from-yellow-500 to-amber-500';
    return 'bg-gradient-to-r from-red-500 to-rose-600';
}

// Veredicto profesional basado en EV
function evVerdict(ev, prob, edge) {
    if (ev === null) {
        if (!prob) return { icon: '❓', text: 'Ingresa línea', class: 'text-gray-400' };
        if (prob >= 65) return { icon: '📊', text: 'PROB. ALTA', class: 'text-blue-400' };
        if (prob >= 55) return { icon: '📈', text: 'PROB. MEDIA', class: 'text-blue-300' };
        if (prob >= 45) return { icon: '⚖️', text: 'NEUTRAL', class: 'text-gray-300' };
        return { icon: '📉', text: 'PROB. BAJA', class: 'text-gray-400' };
    }

    const evNum = safeParseFloat(ev);

    if (evNum >= 15) return { icon: '🔥', text: 'ELITE VALUE', class: 'text-emerald-400', stars: '★★★★★' };
    if (evNum >= 10) return { icon: '💎', text: 'ALTO VALOR', class: 'text-green-400', stars: '★★★★☆' };
    if (evNum >= 7) return { icon: '✅', text: 'MUY BUENO', class: 'text-green-300', stars: '★★★★☆' };
    if (evNum >= 5) return { icon: '✅', text: 'BUEN VALOR', class: 'text-lime-400', stars: '★★★☆☆' };
    if (evNum >= 3) return { icon: '👍', text: 'VALOR', class: 'text-lime-300', stars: '★★★☆☆' };
    if (evNum >= 0) return { icon: '⚠️', text: 'MARGINAL', class: 'text-yellow-400', stars: '★★☆☆☆' };
    if (evNum >= -3) return { icon: '⛔', text: 'SIN VALOR', class: 'text-orange-400', stars: '★☆☆☆☆' };
    return { icon: '🚫', text: 'NO APOSTAR', class: 'text-red-400', stars: '☆☆☆☆☆' };
}

// ═══════════════════════════════════════════════════════════════
// MODELO DE MACHINE LEARNING v1.1
// Aprende de tu historial para mejorar predicciones
// ═══════════════════════════════════════════════════════════════
const ML_MODEL = {
    // Coeficientes del modelo (se actualizan con los datos)
    coefficients: {
        zScore: 0.3,      // Peso del Z-Score
        evWeight: 0.25,   // Peso del EV
        h2hWeight: 0.2,   // Peso del historial H2H
        periodBias: {     // Bias por período (se aprende)
            '1Q': 0,
            '1H': 0,
            'FULL': 0
        },
        typeBias: {       // Bias por tipo (se aprende)
            'OVER': 0,
            'UNDER': 0
        }
    },

    // Entrenar modelo con datos históricos
    train: function () {
        const picks = Object.values(PICKS_DATABASE).filter(p => p.status !== 'pending');
        if (picks.length < 10) return; // Necesitamos mínimo 10 picks

        // Calcular bias por período
        const periodStats = { '1Q': { wins: 0, total: 0 }, '1H': { wins: 0, total: 0 }, 'FULL': { wins: 0, total: 0 } };
        picks.forEach(p => {
            if (periodStats[p.period]) {
                periodStats[p.period].total++;
                if (p.status === 'win') periodStats[p.period].wins++;
            }
        });

        Object.keys(periodStats).forEach(period => {
            if (periodStats[period].total >= 5) {
                const winRate = periodStats[period].wins / periodStats[period].total;
                // Bias positivo si ganas más del 52.4% (breakeven), negativo si menos
                this.coefficients.periodBias[period] = (winRate - 0.524) * 0.1;
            }
        });

        // Calcular bias por tipo (Over/Under)
        const typeStats = { 'OVER': { wins: 0, total: 0 }, 'UNDER': { wins: 0, total: 0 } };
        picks.forEach(p => {
            if (typeStats[p.betType]) {
                typeStats[p.betType].total++;
                if (p.status === 'win') typeStats[p.betType].wins++;
            }
        });

        Object.keys(typeStats).forEach(type => {
            if (typeStats[type].total >= 5) {
                const winRate = typeStats[type].wins / typeStats[type].total;
                this.coefficients.typeBias[type] = (winRate - 0.524) * 0.1;
            }
        });

    },

    // Predecir ajuste de probabilidad
    predict: function (period, betType, baseProb, zScore, ev) {
        // Entrenar si no se ha hecho
        this.train();

        let adjustment = 0;

        // Aplicar bias de período aprendido
        adjustment += (this.coefficients.periodBias[period] || 0) * 100;

        // Aplicar bias de tipo aprendido
        adjustment += (this.coefficients.typeBias[betType] || 0) * 100;

        // Ajuste por Z-Score extremo
        if (Math.abs(zScore) > 2) {
            // Z-Scores muy altos suelen revertir a la media
            adjustment -= Math.sign(zScore) * 2;
        }

        // Ajuste por EV (si es muy alto, puede ser trampa)
        if (ev && parseFloat(ev) > 20) {
            adjustment -= 3; // Penalizar EV excesivamente alto
        }

        return Math.round(adjustment);
    },

    // Obtener score de confianza del modelo (0-100)
    getConfidence: function () {
        const picks = Object.values(PICKS_DATABASE).filter(p => p.status !== 'pending');
        if (picks.length < 10) return 0;
        if (picks.length < 20) return 30;
        if (picks.length < 50) return 60;
        return 80;
    }
};

// Aplicar modelo ML a la probabilidad base
function applyMLAdjustment(baseProb, period, betType, zScore, ev) {
    const adjustment = ML_MODEL.predict(period, betType, baseProb, zScore, ev);
    const mlProb = Math.max(5, Math.min(95, baseProb + adjustment));
    return {
        prob: mlProb,
        adjustment,
        confidence: ML_MODEL.getConfidence()
    };
}

// Recomendación de stake basada en Kelly
function stakeRec(kelly) {
    if (!kelly || kelly <= 0) return { text: 'No apostar', class: 'text-red-400' };
    const k = parseFloat(kelly);
    if (k >= 5) return { text: '3-5% bankroll', class: 'text-green-400' };
    if (k >= 3) return { text: '2-3% bankroll', class: 'text-lime-400' };
    if (k >= 1.5) return { text: '1-2% bankroll', class: 'text-yellow-400' };
    if (k >= 0.5) return { text: '0.5-1% bankroll', class: 'text-orange-400' };
    return { text: 'Mínimo', class: 'text-gray-400' };
}

function getScores() {
    return {
        lQ1: parseInt(ingestScores.localQ1) || 0, lQ2: parseInt(ingestScores.localQ2) || 0,
        lQ3: parseInt(ingestScores.localQ3) || 0, lQ4: parseInt(ingestScores.localQ4) || 0,
        aQ1: parseInt(ingestScores.awayQ1) || 0, aQ2: parseInt(ingestScores.awayQ2) || 0,
        aQ3: parseInt(ingestScores.awayQ3) || 0, aQ4: parseInt(ingestScores.awayQ4) || 0,
        lOT1: parseInt(ingestScores.localOT1) || 0, aOT1: parseInt(ingestScores.awayOT1) || 0,
        lOT2: parseInt(ingestScores.localOT2) || 0, aOT2: parseInt(ingestScores.awayOT2) || 0,
        lOT3: parseInt(ingestScores.localOT3) || 0, aOT3: parseInt(ingestScores.awayOT3) || 0
    };
}

function checkOT() {
    const s = getScores();
    const lReg = s.lQ1 + s.lQ2 + s.lQ3 + s.lQ4, aReg = s.aQ1 + s.aQ2 + s.aQ3 + s.aQ4;
    const filled = s.lQ1 > 0 && s.lQ2 > 0 && s.lQ3 > 0 && s.lQ4 > 0 && s.aQ1 > 0 && s.aQ2 > 0 && s.aQ3 > 0 && s.aQ4 > 0;
    const need1 = filled && lReg === aReg;
    const lA1 = lReg + s.lOT1, aA1 = aReg + s.aOT1;
    const need2 = need1 && s.lOT1 > 0 && s.aOT1 > 0 && lA1 === aA1;
    const lA2 = lA1 + s.lOT2, aA2 = aA1 + s.aOT2;
    const need3 = need2 && s.lOT2 > 0 && s.aOT2 > 0 && lA2 === aA2;
    return { needOT1: need1, needOT2: need2, needOT3: need3 };
}

// ═══════════════════════════════════════════════════════════════
// RENDER PRINCIPAL
// ═══════════════════════════════════════════════════════════════
function render() {
    const app = document.getElementById('app');
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
    attachEvents();

    // Inicializar gráficos si estamos en dashboard
    if (currentView === 'dashboard') {
        setTimeout(() => initDashboardCharts(), 100);
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
    const picks = Object.values(USER_PICKS_BACKTESTING);
    const resolved = picks.filter(p => p.status !== 'pending');
    const pending = picks.filter(p => p.status === 'pending');

    const wins = resolved.filter(p => p.status === 'win').length;
    const losses = resolved.filter(p => p.status === 'loss').length;
    const pushes = resolved.filter(p => p.status === 'push').length;
    const winRate = (wins + losses) > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0.0';

    return `
        <div class="max-w-6xl mx-auto px-4 py-8">
            <button onclick="navigateTo('home')" aria-label="Ir al inicio" class="flex items-center gap-2 text-gold hover:text-gold-vivid mb-6 transition-all">
                ← Volver al Home
            </button>
            
            <h1 class="text-4xl font-bold text-white mb-2" style="font-family: var(--font-display);">
                📊 Backtesting
            </h1>
            <p class="text-gray-400 mb-8">Sistema de calibración y validación del modelo</p>
            
            ${resolved.length > 0 ? `
                <!-- Stats -->
                <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    <div class="glass-card p-4 rounded-xl text-center">
                        <div class="text-3xl font-bold text-white">${resolved.length}</div>
                        <div class="text-xs text-gray-400">Total</div>
                    </div>
                    <div class="glass-card p-4 rounded-xl text-center">
                        <div class="text-3xl font-bold text-emerald">${wins}</div>
                        <div class="text-xs text-gray-400">Wins</div>
                    </div>
                    <div class="glass-card p-4 rounded-xl text-center">
                        <div class="text-3xl font-bold text-rose">${losses}</div>
                        <div class="text-xs text-gray-400">Losses</div>
                    </div>
                    <div class="glass-card p-4 rounded-xl text-center">
                        <div class="text-3xl font-bold text-gold">${winRate}%</div>
                        <div class="text-xs text-gray-400">Win Rate</div>
                    </div>
                    <div class="glass-card p-4 rounded-xl text-center">
                        <div class="text-3xl font-bold text-cyan">${pushes}</div>
                        <div class="text-xs text-gray-400">Pushes</div>
                    </div>
                </div>
            ` : ''}
            
            <!-- Lists -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Pending -->
                <div class="glass-card p-6 rounded-2xl">
                    <h3 class="text-xl font-bold text-white mb-4">⏳ Pendientes (${pending.length})</h3>
                    <div class="space-y-3 max-h-96 overflow-y-auto">
                        ${pending.length === 0 ? `
                            <div class="text-center py-8 text-gray-400">No hay picks pendientes</div>
                        ` : pending.map(p => `
                            <div class="bg-white/5 rounded-lg p-4">
                                <div class="font-medium text-white mb-2">
                                    ${p.local} vs ${p.away} • ${p.period}
                                </div>
                                <div class="text-sm text-gray-400 mb-3">
                                    ${p.betType} ${p.line} • Trend: ${p.trend}
                                </div>
                                <div class="flex gap-2">
                                    <input type="number" step="0.5" placeholder="Resultado" 
                                           class="input-field flex-1 !py-2 text-sm" id="bt_${p.id}">
                                    <button onclick="resolveBacktestPick('${p.id}')" 
                                            class="btn-secondary !py-2 !px-4">✓</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Resolved -->
                <div class="glass-card p-6 rounded-2xl">
                    <h3 class="text-xl font-bold text-white mb-4">✅ Resueltos (${resolved.length})</h3>
                    <div class="space-y-3 max-h-96 overflow-y-auto">
                        ${resolved.length === 0 ? `
                            <div class="text-center py-8 text-gray-400">No hay picks resueltos</div>
                        ` : resolved.slice(0, 10).map(p => `
                            <div class="bg-white/5 rounded-lg p-4">
                                <div class="flex items-center justify-between mb-2">
                                    <div class="font-medium text-white">
                                        ${p.local} vs ${p.away}
                                    </div>
                                    ${p.status === 'win' ? '<span class="win-badge">WIN</span>' :
            p.status === 'loss' ? '<span class="loss-badge">LOSS</span>' :
                '<span class="pending-badge">PUSH</span>'}
                                </div>
                                <div class="text-sm text-gray-400">
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
    const totalPicks = Object.keys({ ...USER_PICKS_TOTALES, ...USER_PICKS_AI }).length;
    const bankroll = USER_BANKROLL.current || 0;
    const initial = USER_BANKROLL.initial || 0;
    const profit = bankroll - initial;
    const profitPercent = initial > 0 ? ((profit / initial) * 100).toFixed(1) : '0.0';

    // Stats de picks
    const allPicks = [...Object.values(USER_PICKS_TOTALES), ...Object.values(USER_PICKS_AI), ...Object.values(USER_PICKS_BACKTESTING)];
    const resolved = allPicks.filter(p => p.status && p.status !== 'pending');
    const wins = resolved.filter(p => p.status === 'win').length;
    const losses = resolved.filter(p => p.status === 'loss').length;
    const winRate = (wins + losses) > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0.0';

    return `
        <div class="max-w-7xl mx-auto px-4 py-8">
            <!-- Welcome Header -->
            <div class="mb-8">
                <h1 class="text-4xl md:text-5xl font-bold text-white mb-2" style="font-family: var(--font-display);">
                    ¡Bienvenido de vuelta! 🏀
                </h1>
                <p class="text-gray-400 text-lg">
                    Tu centro de comando NBA profesional
                </p>
            </div>
            
            <!-- Stats Cards -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8 stats-grid-mobile">
                <div class="glass-card p-6 rounded-xl">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-gray-400 text-sm">Bankroll</span>
                        <span class="text-2xl">💰</span>
                    </div>
                    <div class="text-3xl font-bold text-gold">$${bankroll.toFixed(2)}</div>
                    <div class="text-sm ${profit >= 0 ? 'text-emerald' : 'text-rose'} mt-1">
                        ${profit >= 0 ? '+' : ''}$${profit.toFixed(2)} (${profitPercent}%)
                    </div>
                </div>
                
                <div class="glass-card p-6 rounded-xl">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-gray-400 text-sm">Picks Activos</span>
                        <span class="text-2xl">📊</span>
                    </div>
                    <div class="text-3xl font-bold text-white">${totalPicks}</div>
                    <div class="text-sm text-gray-400 mt-1">En seguimiento</div>
                </div>
                
                <div class="glass-card p-6 rounded-xl">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-gray-400 text-sm">Win Rate</span>
                        <span class="text-2xl">🎯</span>
                    </div>
                    <div class="text-3xl font-bold text-cyan">${winRate}%</div>
                    <div class="text-sm text-gray-400 mt-1">${wins}W - ${losses}L</div>
                </div>
                
                <div class="glass-card p-6 rounded-xl">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-gray-400 text-sm">Total Jugadas</span>
                        <span class="text-2xl">📈</span>
                    </div>
                    <div class="text-3xl font-bold text-violet">${resolved.length}</div>
                    <div class="text-sm text-gray-400 mt-1">Resueltas</div>
                </div>
            </div>
            
            <!-- Quick Access Modules -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <!-- Totales -->
                <button onclick="navigateTo('totales')" class="glass-card p-6 rounded-2xl hover:scale-[1.02] transition-all text-left bg-gradient-to-br from-amber-600/10 to-yellow-600/10 border border-yellow-500/20 hover:border-yellow-400/40" style="box-shadow: 0 0 20px rgba(255,215,0,0.03);">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h3 class="text-2xl font-bold text-white mb-2">📊 Calculadora de Totales</h3>
                            <p class="text-yellow-200/70">Sistema de predicción Q1, 1H y Full</p>
                        </div>
                        <div class="text-5xl opacity-50" style="color: #FFD700;">→</div>
                    </div>
                    <div class="text-sm text-yellow-400/60">Click para analizar partidos NBA</div>
                </button>
                
                <!-- AI Picks -->
                <button onclick="navigateTo('aipicks')" class="glass-card p-6 rounded-2xl hover:scale-[1.02] transition-all text-left bg-gradient-to-br from-purple-600/10 to-pink-600/10 border border-purple-500/20 hover:border-purple-400/40" style="box-shadow: 0 0 20px rgba(147,51,234,0.03);">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h3 class="text-2xl font-bold text-white mb-2">🤖 AI Picks Automáticas</h3>
                            <p class="text-purple-200/70">Picks generadas por inteligencia artificial</p>
                        </div>
                        <div class="text-5xl opacity-50" style="color: #a855f7;">→</div>
                    </div>
                    <div class="text-sm text-purple-400/60">${Object.keys(USER_PICKS_AI).length} picks activas • 75%+ probabilidad</div>
                </button>
                
                <!-- Mis Picks -->
                <button onclick="navigateTo('mispicks')" class="glass-card p-6 rounded-2xl hover:scale-[1.02] transition-all text-left bg-gradient-to-br from-cyan-600/10 to-blue-600/10 border border-cyan-500/20 hover:border-cyan-400/40" style="box-shadow: 0 0 20px rgba(6,182,212,0.03);">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h3 class="text-2xl font-bold text-white mb-2">📋 Mis Picks</h3>
                            <p class="text-cyan-200/70">Todas tus jugadas en un solo lugar</p>
                        </div>
                        <div class="text-5xl opacity-50" style="color: #22d3ee;">→</div>
                    </div>
                    <div class="text-sm text-cyan-400/60">${totalPicks} picks totales en seguimiento</div>
                </button>
            </div>
            
            <!-- Bankroll Section -->
            <div class="glass-card p-6 rounded-2xl mb-8">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-2xl font-bold text-white">💰 Gestión de Bankroll</h3>
                    <button onclick="navigateTo('bankroll')" class="btn-secondary">
                        Ver Detalles →
                    </button>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="bg-white/5 p-4 rounded-xl">
                        <div class="text-sm text-gray-400 mb-1">Bankroll Actual</div>
                        <div class="text-2xl font-bold text-gold">$${bankroll.toFixed(2)}</div>
                    </div>
                    <div class="bg-white/5 p-4 rounded-xl">
                        <div class="text-sm text-gray-400 mb-1">Bankroll Inicial</div>
                        <div class="text-2xl font-bold text-white">$${initial.toFixed(2)}</div>
                    </div>
                    <div class="bg-white/5 p-4 rounded-xl">
                        <div class="text-sm text-gray-400 mb-1">Ganancia/Pérdida</div>
                        <div class="text-2xl font-bold ${profit >= 0 ? 'text-emerald' : 'text-rose'}">
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

let selectedLocalTeam = '';
let selectedAwayTeam = '';

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

        picksHtml += `
            <div class="pick-card bg-white/5 rounded-xl p-3 md:p-4 mb-3 border ${pick.isCombo ? 'border-amber-500/50' : 'border-white/10'}">
                <!-- Header: Equipos + Status -->
                <div class="flex justify-between items-start mb-2">
                    <div class="flex-1 min-w-0 pr-2">
                        ${pick.isCombo ? '<span class="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full mb-1 inline-block font-bold">🔥 BET BUILDER</span>' : ''}
                        <p class="text-white font-bold text-sm md:text-base truncate">${pick.localTeam} vs ${pick.awayTeam}</p>
                        <p class="text-gray-200 text-xs md:text-sm font-semibold">${pick.isCombo ? pick.line : `${pick.period} ${pick.betType} ${pick.line}`}</p>
                    </div>
                    <span class="${statusClass} px-2 md:px-3 py-1 rounded-full text-white text-xs md:text-sm font-bold flex-shrink-0">${statusIcon}</span>
                </div>

                <!-- Stats Row: Fecha, Odds, Prob, EV, CLV - GRID para móviles -->
                <div class="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-3 text-xs md:text-sm mb-2">
                    <span class="text-gray-300 font-medium">📅 ${date}</span>
                    ${pick.odds ? `<span class="text-yellow-300 font-semibold">@${pick.odds}</span>` : ''}
                    <span class="text-purple-300 font-semibold">${pick.probability}% prob</span>
                    ${pick.ev ? `<span class="font-semibold ${parseFloat(pick.ev) >= 0 ? 'text-green-400' : 'text-red-400'}">EV: ${parseFloat(pick.ev) >= 0 ? '+' : ''}${pick.ev}%</span>` : ''}
                    ${clvDisplay}
                </div>

                <!-- Action Buttons -->
                <div class="flex justify-end gap-2 items-center border-t border-white/10 pt-2">
                    ${pick.status === 'pending' ? `
                        <button onclick="registerActualResult('${pick.id}')" class="text-amber-400 hover:text-amber-300 text-xs bg-amber-500/20 px-2 py-1 rounded" title="Registrar resultado real">📊 Resultado</button>
                        <button onclick="updatePickResult('${pick.id}', 'win')" class="text-green-400 hover:text-green-300 text-lg p-1" title="Marcar ganado">✓</button>
                        <button onclick="updatePickResult('${pick.id}', 'loss')" class="text-red-400 hover:text-red-300 text-lg p-1" title="Marcar perdido">✗</button>
                        <button onclick="updatePickResult('${pick.id}', 'push')" class="text-gray-400 hover:text-gray-300 text-sm p-1" title="Push">↔️</button>
                    ` : `
                        ${pick.actualTotal ? `<span class="text-xs text-cyan-400 mr-2">Real: ${pick.actualTotal} pts</span>` : ''}
                        ${pick.modelError !== null && pick.modelError !== undefined ? `<span class="text-xs text-gray-400">Error: ±${pick.modelError.toFixed(1)}</span>` : ''}
                    `}
                    ${!pick.isCombo && !pick.closingLine && pick.status !== 'pending' ? `<button onclick="addClosingLine('${pick.id}', '${pick.line}')" class="text-cyan-400 hover:text-cyan-300 text-xs bg-cyan-500/20 px-2 py-1 rounded" title="Agregar línea de cierre">+CLV</button>` : ''}
                    <button onclick="deletePick('${pick.id}')" class="text-gray-500 hover:text-red-400 text-lg p-1">🗑️</button>
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

            picksHtml += `
                <div class="value-pick bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl p-4 mb-3 border ${index === 0 ? 'border-yellow-500 border-2' : 'border-purple-500/30'}">
                    ${index === 0 ? '<div class="text-yellow-400 text-xs font-bold mb-2">🥇 PICK MÁS RECIENTE</div>' : ''}

                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <p class="text-white font-bold text-lg">${pick.local} vs ${pick.away}</p>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="bg-${periodColor}-500/30 text-${periodColor}-400 text-xs px-2 py-1 rounded font-bold">${pick.period}</span>
                                <span class="text-purple-300 font-semibold">${pick.betType} ${pick.line}</span>
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
                                <p class="text-white font-bold">${pick.trend}</p>
                            </div>
                            <div>
                                <p class="text-gray-400 text-xs">Línea</p>
                                <p class="text-white font-bold">${pick.line}</p>
                            </div>
                            <div>
                                <p class="text-gray-400 text-xs">EV</p>
                                <p class="font-bold ${evClass}">${pick.ev ? (parseFloat(pick.ev) >= 0 ? '+' : '') + pick.ev + '%' : '-'}</p>
                            </div>
                        </div>
                        <p class="text-gray-500 text-xs mt-2 text-center">⏱️ Detectado ${timeAgo}</p>
                    </div>

                    <div class="grid grid-cols-3 gap-2">
                        <button onclick="analyzeFromValuePick('${pick.id}')" class="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-bold">
                            📊 Analizar
                        </button>
                        <button onclick="registerFromValuePick('${pick.id}')" class="bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-bold">
                            ✅ Registrar
                        </button>
                        <button onclick="removeValuePick('${pick.id}')" class="bg-red-600/50 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-bold">
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
        showNotification('⚠️ Ingresa la cuota combinada del Bet Builder', 'warning');
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
        showNotification('⚠️ Selecciona al menos 2 picks para el Bet Builder', 'warning');
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
let teamChart = null;

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
        <div class="flex justify-between items-center bg-white/5 rounded-lg p-3 mb-2">
            <div>
                <span class="text-white font-bold">${t.team}</span>
                <span class="text-gray-400 text-xs ml-2">(${t.total} picks)</span>
            </div>
            <div class="flex items-center gap-4">
                <span class="text-sm ${parseFloat(t.winRate) >= 55 ? 'text-green-400' : parseFloat(t.winRate) >= 45 ? 'text-yellow-400' : 'text-red-400'}">${t.winRate}%</span>
                <span class="font-bold ${t.profit >= 0 ? 'text-green-400' : 'text-red-400'}">${t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}u</span>
            </div>
        </div>
    `).join('') : '<p class="text-gray-400 text-center py-4">Necesitas más picks para ver estadísticas por equipo</p>';

        return `
        <div class="p-3 md:p-4 max-w-4xl mx-auto">
            <button onclick="navigateTo('home')" aria-label="Ir al inicio" class="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg mb-4 text-sm md:text-base">← Volver</button>

            <div class="text-center mb-6">
                <div class="logo-container justify-center mb-2">
                    ${LOGO_SVG}
                    <h1 class="text-2xl md:text-3xl font-bold text-white font-orbitron">📉 DASHBOARD PRO</h1>
                </div>
                <p class="text-cyan-400 text-xs md:text-sm">Análisis avanzado de rendimiento</p>
            </div>

            <!-- RESUMEN RÁPIDO -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-6">
                <div class="bg-gradient-to-br from-green-500/20 to-emerald-600/20 rounded-xl p-3 md:p-4 text-center border border-green-500/30">
                    <p class="text-2xl md:text-3xl font-black text-green-400">${stats.winRate}%</p>
                    <p class="text-gray-300 text-xs font-semibold">Win Rate</p>
                </div>
                <div class="bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-xl p-3 md:p-4 text-center border border-cyan-500/30">
                    <p class="text-2xl md:text-3xl font-black ${parseFloat(stats.profit) >= 0 ? 'text-cyan-400' : 'text-red-400'}">${parseFloat(stats.profit) >= 0 ? '+' : ''}${stats.profit}u</p>
                    <p class="text-gray-300 text-xs font-semibold">Profit</p>
                </div>
                <div class="bg-gradient-to-br from-purple-500/20 to-pink-600/20 rounded-xl p-3 md:p-4 text-center border border-purple-500/30">
                    <p class="text-2xl md:text-3xl font-black ${parseFloat(stats.roi) >= 0 ? 'text-purple-400' : 'text-red-400'}">${parseFloat(stats.roi) >= 0 ? '+' : ''}${stats.roi}%</p>
                    <p class="text-gray-300 text-xs font-semibold">ROI</p>
                </div>
                <div class="bg-gradient-to-br from-yellow-500/20 to-orange-600/20 rounded-xl p-3 md:p-4 text-center border border-yellow-500/30">
                    <p class="text-2xl md:text-3xl font-black text-yellow-400">${picks.length}</p>
                    <p class="text-gray-300 text-xs font-semibold">Picks</p>
                </div>
            </div>

            <!-- GRÁFICO DE PROFIT ACUMULADO -->
            <div class="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl p-3 md:p-5 mb-6 border border-gray-700">
                <h3 class="text-base md:text-lg font-bold text-white mb-4">📈 Evolución de Profit</h3>
                <div style="height: 200px;" class="md:h-[250px]">
                    <canvas id="profitChart"></canvas>
                </div>
                ${picks.length < 3 ? '<p class="text-gray-400 text-center text-xs md:text-sm mt-2">Necesitas al menos 3 picks resueltos para ver el gráfico</p>' : ''}
            </div>

            <!-- CLV TRACKER -->
            <div class="bg-gradient-to-br from-indigo-600/20 to-purple-700/20 rounded-2xl p-3 md:p-5 mb-6 border border-indigo-500/50">
                <h3 class="text-base md:text-lg font-bold text-white mb-3">🎯 CLV Tracker (Closing Line Value)</h3>
                <p class="text-gray-300 text-xs md:text-sm mb-4">El CLV mide si apuestas antes de que la línea se mueva a tu favor. <strong class="text-yellow-400">CLV positivo = pensás como un sharp.</strong></p>

                <div class="grid grid-cols-2 gap-2 md:gap-4 mb-4">
                    <div class="bg-black/30 rounded-xl p-3 md:p-4 text-center">
                        <p class="text-xl md:text-2xl font-black ${parseFloat(avgCLV) >= 0 ? 'text-green-400' : 'text-red-400'}">${avgCLV > 0 ? '+' : ''}${avgCLV} pts</p>
                        <p class="text-gray-400 text-xs font-semibold">CLV Promedio</p>
                    </div>
                    <div class="bg-black/30 rounded-xl p-3 md:p-4 text-center">
                        <p class="text-xl md:text-2xl font-black text-cyan-400">${picksWithCLV.length}</p>
                        <p class="text-gray-400 text-xs font-semibold">Picks con CLV</p>
                    </div>
                </div>

                <div class="bg-yellow-500/10 rounded-lg p-3 border border-yellow-500/30">
                    <p class="text-yellow-400 text-xs">💡 <strong>Tip:</strong> En "Mis Picks" puedes agregar la línea de cierre a cada pick para calcular tu CLV.</p>
                </div>
            </div>

            <!-- RENDIMIENTO POR EQUIPO -->
            <div class="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl p-3 md:p-5 mb-6 border border-gray-700">
                <h3 class="text-base md:text-lg font-bold text-white mb-4">🏀 Rendimiento por Equipo</h3>
                ${teamStatsHtml}
            </div>

            <!-- ANÁLISIS POR PERÍODO -->
            <div class="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-2xl p-3 md:p-5 mb-6 border border-purple-500/50">
                <h3 class="text-base md:text-lg font-bold text-white mb-4">📊 Rendimiento por Período</h3>
                <div class="grid grid-cols-3 gap-2 md:gap-3">
                    ${['1Q', '1H', 'FULL'].map(p => {
            const data = quarterAnalysis[p];
            const total = data.wins + data.losses;
            const wr = total > 0 ? ((data.wins / total) * 100).toFixed(0) : '-';
            const wrNum = total > 0 ? (data.wins / total) * 100 : 0;
            const colors = { '1Q': 'yellow', '1H': 'pink', 'FULL': 'green' };
            const color = colors[p];
            return `
                            <div class="bg-${color}-500/10 rounded-xl p-3 md:p-4 text-center border border-${color}-500/30">
                                <p class="text-${color}-400 font-bold text-lg md:text-xl">${p}</p>
                                <p class="text-white font-bold text-sm md:text-base">${data.wins}W-${data.losses}L</p>
                                <p class="text-base md:text-lg font-black ${total > 0 && wrNum >= 50 ? 'text-green-400' : total > 0 ? 'text-red-400' : 'text-gray-500'}">${wr}%</p>
                                <p class="text-xs md:text-sm font-semibold ${data.profit >= 0 ? 'text-green-400' : 'text-red-400'}">${data.profit >= 0 ? '+' : ''}${data.profit.toFixed(2)}u</p>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>

            <!-- ANÁLISIS DE PATRONES PERSONALES -->
            <div class="bg-gradient-to-br from-emerald-600/20 to-teal-700/20 rounded-2xl p-3 md:p-5 mb-6 border border-emerald-500/50">
                <h3 class="text-base md:text-lg font-bold text-white mb-3">📊 Análisis de Patrones Personales</h3>
                <p class="text-gray-300 text-xs md:text-sm mb-4">Análisis de tus picks históricos para identificar tus fortalezas y áreas de mejora.</p>

                <div class="bg-black/30 rounded-xl p-3 md:p-4">
                    <div class="grid grid-cols-2 gap-3 md:gap-4 mb-4">
                        <div class="text-center">
                            <p class="text-emerald-400 font-bold text-sm md:text-lg">Lo que analizo:</p>
                            <ul class="text-gray-300 text-xs text-left mt-2 space-y-1">
                                <li>• Períodos más rentables</li>
                                <li>• OVER vs UNDER performance</li>
                                <li>• Equipos donde aciertas más</li>
                                <li>• Rachas y consistencia</li>
                                <li>• ROI por tipo de apuesta</li>
                            </ul>
                        </div>
                        <div class="text-center">
                            <p class="text-emerald-400 font-bold text-sm md:text-lg">Datos:</p>
                            <p class="text-3xl md:text-4xl mt-2 font-black text-white">${picks.length}</p>
                            <p class="text-gray-400 text-xs mt-1">picks analizados</p>
                        </div>
                    </div>
                    ${picks.length >= 10 ? `
                        <div class="bg-emerald-500/20 rounded-lg p-3 border border-emerald-500/30">
                            <p class="text-emerald-400 text-xs md:text-sm text-center">✅ Suficientes datos. Revisa las secciones anteriores para ver tus patrones.</p>
                        </div>
                    ` : `
                        <div class="bg-yellow-500/10 rounded-lg p-3 border border-yellow-500/30">
                            <p class="text-yellow-400 text-xs text-center">📊 Registra al menos 10 picks para obtener análisis más precisos.</p>
                        </div>
                    `}
                </div>
            </div>

            <!-- CRÉDITOS -->
            <div class="bg-white/5 rounded-xl p-4 text-center">
                <p class="text-gray-400 text-xs">NioSports Pro v2.0 - Modelo Predictivo Avanzado</p>
                <p class="text-gray-500 text-xs mt-1">Backtesting, B2B, PACE, Calibración, CLV Tracker</p>
            </div>

            <!-- BACKTESTING & CALIBRACIÓN -->
            ${(() => {
                const backtest = getBacktestStats();
                if (!backtest || backtest.totalPicks < 5) {
                    return `
                    <div class="bg-gradient-to-br from-amber-600/20 to-orange-700/20 rounded-2xl p-5 mt-6 border border-amber-500/50">
                        <h3 class="text-lg font-bold text-white mb-3">🔬 Backtesting & Calibración</h3>
                        <p class="text-amber-300 text-sm text-center py-6">
                            Necesitas al menos 5 picks con resultado registrado para ver el análisis de backtesting.<br>
                            <span class="text-xs text-gray-400 mt-2 block">Usa el botón "📊 Resultado" en cada pick para registrar el total real del partido.</span>
                        </p>
                    </div>`;
                }

                return `
                <div class="bg-gradient-to-br from-amber-600/20 to-orange-700/20 rounded-2xl p-5 mt-6 border border-amber-500/50">
                    <h3 class="text-lg font-bold text-white mb-4">🔬 Backtesting & Calibración del Modelo</h3>

                    <!-- Resumen de Precisión -->
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <div class="bg-white/10 rounded-xl p-3 text-center">
                            <p class="text-2xl font-black ${parseFloat(backtest.overallHitRate) >= 52.38 ? 'text-green-400' : 'text-red-400'}">${backtest.overallHitRate}%</p>
                            <p class="text-xs text-gray-300">Hit Rate Real</p>
                            <p class="text-xs ${parseFloat(backtest.overallHitRate) >= 52.38 ? 'text-green-500' : 'text-red-500'}">${parseFloat(backtest.overallHitRate) >= 52.38 ? '✓ Rentable' : '✗ < 52.38%'}</p>
                        </div>
                        <div class="bg-white/10 rounded-xl p-3 text-center">
                            <p class="text-2xl font-black text-cyan-400">${backtest.avgModelError || '-'}</p>
                            <p class="text-xs text-gray-300">Error Promedio</p>
                            <p class="text-xs text-gray-500">pts vs real</p>
                        </div>
                        <div class="bg-white/10 rounded-xl p-3 text-center">
                            <p class="text-2xl font-black ${parseFloat(backtest.roi) >= 0 ? 'text-green-400' : 'text-red-400'}">${backtest.roi}%</p>
                            <p class="text-xs text-gray-300">ROI</p>
                            <p class="text-xs text-gray-500">${backtest.totalPicks} picks</p>
                        </div>
                        <div class="bg-white/10 rounded-xl p-3 text-center">
                            <p class="text-2xl font-black text-yellow-400">${backtest.totalWins}/${backtest.totalWins + backtest.totalLosses}</p>
                            <p class="text-xs text-gray-300">Win/Total</p>
                            <p class="text-xs text-gray-500">${backtest.totalPushes} pushes</p>
                        </div>
                    </div>

                    <!-- Hit Rate por Período -->
                    <div class="bg-black/20 rounded-xl p-4 mb-4">
                        <h4 class="text-white font-bold mb-3">📊 Precisión por Período</h4>
                        <div class="grid grid-cols-3 gap-2">
                            ${backtest.byPeriod.filter(p => p.wins + p.losses > 0).map(p => `
                                <div class="bg-white/5 rounded-lg p-3 text-center">
                                    <p class="text-white font-bold">${p.period}</p>
                                    <p class="text-2xl font-black ${parseFloat(p.hitRate) >= 52.38 ? 'text-green-400' : parseFloat(p.hitRate) >= 45 ? 'text-yellow-400' : 'text-red-400'}">${p.hitRate}%</p>
                                    <p class="text-xs text-gray-400">${p.wins}W - ${p.losses}L</p>
                                    ${p.avgError !== '-' ? `<p class="text-xs text-cyan-400">±${p.avgError} pts error</p>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Gráfico de Calibración -->
                    ${backtest.calibration.length >= 2 ? `
                    <div class="bg-black/20 rounded-xl p-4 mb-4">
                        <h4 class="text-white font-bold mb-3">🎯 Calibración del Modelo</h4>
                        <p class="text-xs text-gray-400 mb-3">Cuando el modelo dice X%, ¿acierta X%? Una línea diagonal perfecta = modelo bien calibrado.</p>
                        <div class="space-y-2">
                            ${backtest.calibration.map(c => {
                    const diff = c.actualHitRate - c.avgPredicted;
                    const isCalibrated = Math.abs(diff) < 10;
                    return `
                                <div class="flex items-center gap-3">
                                    <span class="text-white text-sm w-16">${c.range}%</span>
                                    <div class="flex-1 bg-gray-700 rounded-full h-4 relative">
                                        <div class="absolute h-4 rounded-full ${isCalibrated ? 'bg-green-500' : diff > 0 ? 'bg-blue-500' : 'bg-red-500'}" style="width: ${Math.min(100, c.actualHitRate)}%"></div>
                                        <div class="absolute h-4 w-1 bg-yellow-400" style="left: ${c.avgPredicted}%"></div>
                                    </div>
                                    <span class="text-xs ${isCalibrated ? 'text-green-400' : diff > 0 ? 'text-blue-400' : 'text-red-400'} w-20 text-right">
                                        Real: ${c.actualHitRate.toFixed(0)}% (${c.count})
                                    </span>
                                </div>`;
                }).join('')}
                        </div>
                        <p class="text-xs text-gray-500 mt-2 text-center">🟡 = Predicción | Barra = Hit Rate Real | (n) = muestra</p>
                    </div>
                    ` : '<p class="text-gray-400 text-xs text-center mb-4">Necesitas más picks por rango de probabilidad para ver calibración</p>'}

                    <!-- Botón Exportar -->
                    <div class="flex justify-center">
                        <button onclick="exportPicksToCSV()" class="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                            📥 Exportar a CSV
                        </button>
                    </div>
                </div>`;
            })()}
        </div>
    `;
    } catch (error) {
        Logger.error('Error en renderDashboard:', error);
        return `
            <div class="p-4 max-w-4xl mx-auto">
                <button onclick="navigateTo('home')" aria-label="Ir al inicio" class="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg mb-4">← Volver</button>
                <div class="bg-red-500/20 border border-red-500 rounded-xl p-6 text-center">
                    <p class="text-red-400 text-xl mb-2">⚠️ Error al cargar Dashboard</p>
                    <p class="text-gray-300 text-sm">${error.message}</p>
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
    let win = 'Empate', wc = 'text-gray-400';
    if (lT > aT) { win = ingestLocalTeam; wc = 'text-cyan-400'; }
    else if (aT > lT) { win = away; wc = 'text-orange-400'; }

    return `
        <div class="border-t border-slate-600 pt-4 mt-4">
            <h3 class="text-white font-bold text-center mb-3">📊 TOTALES CALCULADOS</h3>
            <div id="totalsDisplay" class="grid grid-cols-3 gap-4">
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
    const allPicks = [
        ...Object.values(USER_PICKS_TOTALES).map(p => ({ ...p, type: 'Totales' })),
        ...Object.values(USER_PICKS_AI).map(p => ({ ...p, type: 'AI' })),
        ...Object.values(USER_PICKS_BACKTESTING).map(p => ({ ...p, type: 'Backtesting' }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const pending = allPicks.filter(p => p.status === 'pending');
    const resolved = allPicks.filter(p => p.status !== 'pending');

    return `
        <div class="max-w-6xl mx-auto px-4 py-8">
            <button onclick="navigateTo('home')" aria-label="Ir al inicio" class="flex items-center gap-2 text-gold hover:text-gold-vivid mb-6 transition-all">
                ← Volver al Home
            </button>
            
            <h1 class="text-4xl font-bold text-white mb-2" style="font-family: var(--font-display);">
                📋 Mis Picks
            </h1>
            <p class="text-gray-400 mb-8">Todas tus jugadas en un solo lugar</p>
            
            <!-- Tabs -->
            <div class="flex gap-4 mb-6 border-b border-white/10">
                <button onclick="filterMisPicks('all')" class="px-4 py-2 text-gold border-b-2 border-gold font-medium">
                    Todos (${allPicks.length})
                </button>
                <button onclick="filterMisPicks('pending')" class="px-4 py-2 text-gray-400 hover:text-white transition-all">
                    Pendientes (${pending.length})
                </button>
                <button onclick="filterMisPicks('resolved')" class="px-4 py-2 text-gray-400 hover:text-white transition-all">
                    Resueltos (${resolved.length})
                </button>
            </div>
            
            <!-- Picks List -->
            <div class="space-y-4" id="misPicksList">
                ${allPicks.length === 0 ? `
                    <div class="glass-card p-12 rounded-2xl text-center">
                        <div class="text-6xl mb-4">📊</div>
                        <h3 class="text-2xl font-bold text-white mb-2">No tienes picks aún</h3>
                        <p class="text-gray-400 mb-6">Empieza a usar el sistema para trackear tus jugadas</p>
                        <button onclick="navigateTo('totales')" class="btn-primary">
                            Crear mi primer pick
                        </button>
                    </div>
                ` : allPicks.map(pick => `
                    <div class="glass-card p-5 rounded-xl hover:scale-[1.01] transition-all">
                        <div class="flex items-center justify-between mb-3">
                            <div class="flex items-center gap-3">
                                <span class="badge ${pick.type === 'AI' ? 'badge-info' : pick.type === 'Totales' ? 'badge-warning' : 'badge-success'}">
                                    ${pick.type}
                                </span>
                                ${pick.status === 'pending' ?
            '<span class="pending-badge">Pendiente</span>' :
            pick.status === 'win' ?
                '<span class="win-badge">✅ WIN</span>' :
                pick.status === 'loss' ?
                    '<span class="loss-badge">❌ LOSS</span>' :
                    '<span class="pending-badge">↔️ PUSH</span>'
        }
                            </div>
                            <div class="text-sm text-gray-500">
                                ${new Date(pick.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="text-lg font-bold text-white">
                                ${pick.local || 'N/A'} vs ${pick.away || 'N/A'}
                            </div>
                            <div class="text-sm text-gray-400">
                                ${pick.period} • ${pick.betType} ${pick.line}
                                ${pick.prediction ? ` • Predicción: ${pick.prediction}` : ''}
                            </div>
                        </div>
                        
                        ${pick.status === 'pending' ? `
                            <div class="flex gap-2">
                                <input type="number" step="0.5" placeholder="Resultado real" class="input-field flex-1 !py-2 text-sm" id="result_${pick.id}">
                                <button onclick="updatePickStatus('${pick.id}', '${pick.type}')" class="btn-secondary !py-2 !px-4">
                                    Actualizar
                                </button>
                            </div>
                        ` : pick.actualResult ? `
                            <div class="bg-white/5 rounded-lg p-3 text-sm">
                                <span class="text-gray-400">Resultado Real:</span>
                                <span class="text-white font-bold ml-2">${pick.actualResult}</span>
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
        showNotification('⚠️ No hay conexión con Firebase', 'warning');
        return;
    }

    const di = document.getElementById('ingestDate');
    if (di) ingestDate = di.value;
    ['localQ1', 'localQ2', 'localQ3', 'localQ4', 'awayQ1', 'awayQ2', 'awayQ3', 'awayQ4', 'localOT1', 'awayOT1', 'localOT2', 'awayOT2', 'localOT3', 'awayOT3'].forEach(id => {
        const inp = document.getElementById(id);
        if (inp) ingestScores[id] = inp.value;
    });
    if (!ingestTeam1 || !ingestTeam2 || !ingestLocalTeam || !ingestDate) {
        showNotification('⚠️ Completa todos los campos', 'warning');
        return;
    }
    const s = getScores();
    const lT = s.lQ1 + s.lQ2 + s.lQ3 + s.lQ4 + s.lOT1 + s.lOT2 + s.lOT3;
    const aT = s.aQ1 + s.aQ2 + s.aQ3 + s.aQ4 + s.aOT1 + s.aOT2 + s.aOT3;
    if (lT === 0 || aT === 0) {
        showNotification('⚠️ Ingresa los puntos', 'warning');
        return;
    }
    if (lT === aT) {
        showNotification('⚠️ Empate. Ingresa Overtime', 'warning');
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
            const q1Pred = ((localStats.q1Home + awayStats.q1Away) / 2);
            const q1Line = Math.round(q1Pred * 2) / 2;
            const q1Diff = Math.abs(q1Pred - q1Line);
            const q1Prob = Math.min(95, 50 + (q1Diff * 30));

            if (q1Prob >= 75) {
                aiPicks.push({
                    id: `ai_q1_${local}_${away}_${Date.now()}_${Math.random().toString(36).substr(2, 5)} `,
                    local, away, period: 'Q1',
                    betType: q1Pred > q1Line ? 'OVER' : 'UNDER',
                    line: q1Line, trend: q1Pred.toFixed(1),
                    probability: Math.round(q1Prob),
                    confidence: q1Prob >= 85 ? 'VERY HIGH' : q1Prob >= 80 ? 'HIGH' : 'GOOD',
                    generatedAt: new Date().toISOString()
                });
            }

            // 1H
            const halfPred = ((localStats.halfHome + awayStats.halfAway) / 2);
            const halfLine = Math.round(halfPred * 2) / 2;
            const halfDiff = Math.abs(halfPred - halfLine);
            const halfProb = Math.min(95, 50 + (halfDiff * 30));

            if (halfProb >= 75) {
                aiPicks.push({
                    id: `ai_1h_${local}_${away}_${Date.now()}_${Math.random().toString(36).substr(2, 5)} `,
                    local, away, period: '1H',
                    betType: halfPred > halfLine ? 'OVER' : 'UNDER',
                    line: halfLine, trend: halfPred.toFixed(1),
                    probability: Math.round(halfProb),
                    confidence: halfProb >= 85 ? 'VERY HIGH' : halfProb >= 80 ? 'HIGH' : 'GOOD',
                    generatedAt: new Date().toISOString()
                });
            }

            // FULL
            const fullPred = ((localStats.fullHome + awayStats.fullAway) / 2);
            const fullLine = Math.round(fullPred * 2) / 2;
            const fullDiff = Math.abs(fullPred - fullLine);
            const fullProb = Math.min(95, 50 + (fullDiff * 30));

            if (fullProb >= 75) {
                aiPicks.push({
                    id: `ai_full_${local}_${away}_${Date.now()}_${Math.random().toString(36).substr(2, 5)} `,
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
    if (typeof render === 'function') render();
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
            let lastErr = null;
            for (const url of candidates) {
                try {
                    const res = await fetch(url, { cache: 'no-store' });
                    if (!res.ok) throw new Error(`HTTP ${res.status} `);
                    const data = await res.json();
                    const teams = data.teams || data;
                    if (!teams || typeof teams !== 'object') throw new Error('Formato inválido');
                    window.TEAM_STATS = teams;
                    return teams;
                } catch (e) {
                    lastErr = e;
                }
            }
            throw lastErr || new Error('No se pudo cargar TEAM_STATS');
        } catch (e) {
            console.error('❌ loadTeamStatsFromAPI error:', e);
            if (typeof window.toastError === 'function') window.toastError('No se pudieron cargar stats de equipos');
            return {};
        }
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    // Cargar VALUE_PICKS desde localStorage
    loadValuePicksFromStorage();
    // Primero cargar estadísticas desde API (no requiere auth)
    await loadTeamStatsFromAPI();
    // Cargar AI Picks desde cache local
    loadAIPicks();
    logger.log('✅ NioSports Pro v4.0 - Datos públicos cargados. Esperando autenticación...');
});



// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES ADICIONALES - NIOSPORTS PRO v4.0
// ═══════════════════════════════════════════════════════════

// Toggle dropdown de usuario
function toggleUserDropdown() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) dropdown.classList.toggle('active');
}

// Cerrar dropdown al hacer click fuera
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown && !dropdown.contains(e.target)) {
        dropdown.classList.remove('active');
    }
});

// Función para actualizar Bankroll (modal)
function showUpdateBankrollModal() {
    const modal = document.getElementById('updateBankrollModal');
    if (modal) modal.style.display = 'flex';
}

function closeUpdateBankrollModal() {
    const modal = document.getElementById('updateBankrollModal');
    if (modal) modal.style.display = 'none';
}

function updateBankroll() {
    const newAmountInput = document.getElementById('newBankrollAmount');
    const reasonSelect = document.getElementById('bankrollReason');

    if (!newAmountInput || !reasonSelect) return;

    const newAmount = parseFloat(newAmountInput.value);
    const reason = reasonSelect.value;

    if (isNaN(newAmount) || newAmount < 0) {
        showNotification('error', 'Error', 'Monto inválido');
        return;
    }

    const currentBankroll = USER_BANKROLL.current || 0;
    const difference = newAmount - currentBankroll;

    const newHistory = USER_BANKROLL.history || [];
    newHistory.push({
        amount: difference,
        reason: reason,
        date: new Date().toISOString(),
        previousBalance: currentBankroll,
        newBalance: newAmount
    });

    database.ref(`users / ${userId}/bankroll`).update({
        current: newAmount,
        initial: USER_BANKROLL.initial || newAmount,
        history: newHistory
    }).then(() => {
        showNotification('success', 'Bankroll Actualizado', `Nuevo saldo: $${newAmount.toFixed(2)}`);
        closeUpdateBankrollModal();
        render();
    }).catch(err => {
        Logger.error('Error:', err);
        showNotification('error', 'Error', 'No se pudo actualizar');
    });
}

// Función para exportar a CSV
function exportToCSV(data, filename) {
    if (!data || data.length === 0) {
        showNotification('warning', 'Sin datos', 'No hay datos para exportar');
        return;
    }

    try {
        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];

        data.forEach(row => {
            const values = headers.map(h => {
                const v = row[h];
                if (v === null || v === undefined) return '';
                const s = String(v);
                return (s.includes(',') || s.includes('"')) ? `"${s.replace(/"/g, '""')}"` : s;
            });
            csvRows.push(values.join(','));
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.setAttribute('href', URL.createObjectURL(blob));
        link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification('success', 'Exportado', 'CSV descargado exitosamente');
    } catch (error) {
        Logger.error('Error:', error);
        showNotification('error', 'Error', 'No se pudo exportar');
    }
}

// Función para actualizar status de pick
function updatePickStatus(pickId, type) {
    const inputId = `result_${pickId}`;
    const input = document.getElementById(inputId);
    if (!input) return;

    const result = parseFloat(input.value);
    if (isNaN(result)) {
        showNotification('error', 'Error', 'Ingresa un número válido');
        return;
    }

    const dbPath = type === 'Totales' ? 'picks_totales' :
        type === 'AI' ? 'picks_ai' :
            'picks_backtesting';

    database.ref(`users/${userId}/${dbPath}/${pickId}`).once('value').then(snapshot => {
        const pick = snapshot.val();
        if (!pick) return;

        const line = parseFloat(pick.line);
        let status = 'pending';

        if (result === line) {
            status = 'push';
        } else if (pick.betType === 'OVER') {
            status = result > line ? 'win' : 'loss';
        } else {
            status = result < line ? 'win' : 'loss';
        }

        database.ref(`users/${userId}/${dbPath}/${pickId}`).update({
            status: status,
            actualResult: result,
            resolvedAt: new Date().toISOString()
        }).then(() => {
            const emoji = status === 'win' ? '✅' : status === 'push' ? '↔️' : '❌';
            showNotification('success', `${emoji} ${status.toUpperCase()}`, '');
            render();
        }).catch(err => {
            Logger.error('Error:', err);
            showNotification('error', 'Error', 'No se pudo actualizar');
        });
    });
}

// [REMOVED] Duplicate resolveBacktestPick — using original at line ~4710

// Función para filtrar Mis Picks
function filterMisPicks(filter) {
    // Esta función se puede expandir para filtrar la vista
    logger.log('Filtro seleccionado:', filter);
    // Por ahora solo logueamos, pero se puede implementar filtrado real
}

// ═══════════════════════════════════════════════════════════════
// UTILIDADES GENERALES
// ═══════════════════════════════════════════════════════════

// Formatear fechas
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Formatear dinero
function formatMoney(amount) {
    if (amount === null || amount === undefined) return '$0.00';
    return `$${parseFloat(amount).toFixed(2)}`;
}

// Formatear porcentaje
function formatPercent(value) {
    if (value === null || value === undefined) return '0.0%';
    return `${parseFloat(value).toFixed(1)}%`;
}

// Copiar al portapapeles
function copyToClipboard(text) {
    if (!navigator.clipboard) {
        // Fallback para navegadores antiguos
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showNotification('success', 'Copiado', 'Texto copiado al portapapeles');
        } catch (err) {
            Logger.error('Error al copiar:', err);
            showNotification('error', 'Error', 'No se pudo copiar');
        }
        document.body.removeChild(textArea);
        return;
    }

    navigator.clipboard.writeText(text).then(() => {
        showNotification('success', 'Copiado', 'Texto copiado al portapapeles');
    }).catch(err => {
        Logger.error('Error al copiar:', err);
        showNotification('error', 'Error', 'No se pudo copiar');
    });
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function
function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}



// ═══════════════════════════════════════════════════════════════
// EVENT LISTENERS DE AUTENTICACIÓN - ULTRA DEBUG
// ═══════════════════════════════════════════════════════════

// Helpers para usernames (evita leer toda la colección /usernames)
const normalizeUsername = (u) => (u || '').trim().toLowerCase();

async function usernameIndexGetUid(username) {
    const key = normalizeUsername(username);
    if (!key) return null;
    try {
        const snap = await database.ref(`usernamesIndex/${key}`).once('value');
        return snap.exists() ? snap.val() : null;
    } catch (e) {
        Logger.error('❌ Error leyendo usernamesIndex:', e?.message || e);
        return null;
    }
}

async function usernameIndexIsTaken(username) {
    const uid = await usernameIndexGetUid(username);
    return !!uid;
}

async function usernameIndexReserve(uid, username) {
    const key = normalizeUsername(username);
    if (!uid || !key) throw new Error('UID/username inválido');
    // Escribe dos índices: uid->username y username->uid
    await database.ref(`usernamesByUid/${uid}`).set(username);
    await database.ref(`usernamesIndex/${key}`).set(uid);
}

document.addEventListener('DOMContentLoaded', () => {
    logger.log('🎬 DOM Cargado, configurando event listeners...');

    // ══════════ LOGIN FORM ══════════
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        logger.log('✅ Formulario de login encontrado');

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            logger.log('');
            logger.log('═══════════════════════════════════════════');
            logger.log('🔐 INTENTANDO LOGIN...');
            logger.log('═══════════════════════════════════════════');

            const emailOrUsername = document.getElementById('loginEmailOrUsername').value.trim();
            const password = document.getElementById('loginPassword').value;

            logger.log('📝 Datos ingresados:');
            logger.log('  - Email/Username:', emailOrUsername);
            logger.log('  - Password:', password ? '****** (' + password.length + ' caracteres)' : 'VACÍO');

            if (!emailOrUsername || !password) {
                Logger.error('❌ Campos vacíos');
                showNotification('error', 'Error', 'Por favor completa todos los campos');
                toastWarning('Completa todos los campos', { title: 'Validación' });
                return;
            }

            try {
                let email = emailOrUsername;

                // Si no contiene @, es un username, buscar el email
                if (!emailOrUsername.includes('@')) {
                    logger.log('🔍 Detectado username, buscando UID en índice...');
                    const uid = await usernameIndexGetUid(emailOrUsername);

                    if (uid) {
                        logger.log('✅ Username encontrado, UID:', uid);

                        const userRef = await database.ref(`users/${uid}/profile`).once('value');
                        const userProfile = userRef.val();

                        logger.log('👤 Perfil:', userProfile);

                        if (userProfile && userProfile.email) {
                            email = userProfile.email;
                            logger.log('✅ Email encontrado:', email);
                        } else {
                            throw new Error('Usuario no encontrado en la base de datos');
                        }
                    } else {
                        Logger.error('❌ Username no encontrado en índice');
                        throw new Error('Usuario no encontrado');
                    }
                }

                logger.log('🔐 Intentando autenticar con Firebase...');
                logger.log('  - Email:', email);

                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                await bindSession(userCredential.user);

                logger.log('✅✅✅ LOGIN EXITOSO ✅✅✅');
                logger.log('👤 Usuario:', userCredential.user.email);
                logger.log('🆔 UID:', userCredential.user.uid);

                showNotification('success', '¡Bienvenido!', 'Sesión iniciada correctamente');
                toastSuccess('¡Login exitoso!', { title: 'Bienvenido' });

            } catch (error) {
                Logger.error('═══════════════════════════════════════════');
                Logger.error('❌ ERROR EN LOGIN');
                Logger.error('═══════════════════════════════════════════');
                Logger.error('Código:', error.code);
                Logger.error('Mensaje:', error.message);
                Logger.error('Stack:', error.stack);
                Logger.error('═══════════════════════════════════════════');

                let errorMsg = 'Error al iniciar sesión';

                if (error.code === 'auth/user-not-found') {
                    errorMsg = 'Usuario no encontrado. Verifica tus credenciales.';
                } else if (error.code === 'auth/wrong-password') {
                    errorMsg = 'Contraseña incorrecta. Intenta nuevamente.';
                } else if (error.code === 'auth/invalid-email') {
                    errorMsg = 'Email inválido';
                } else if (error.code === 'auth/too-many-requests') {
                    errorMsg = 'Demasiados intentos. Espera un momento.';
                } else if (error.message.includes('Usuario no encontrado')) {
                    errorMsg = 'Usuario no existe. Verifica el username o email.';
                }

                showNotification('error', 'Error de Login', errorMsg);
                toastError(errorMsg, { title: 'Error' });
            }
        });
    } else {
        Logger.error('❌ Formulario de login NO encontrado');
    }

    // ══════════ REGISTER FORM ══════════
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        logger.log('✅ Formulario de registro encontrado');

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            logger.log('');
            logger.log('═══════════════════════════════════════════');
            logger.log('📝 INTENTANDO REGISTRO...');
            logger.log('═══════════════════════════════════════════');

            const username = document.getElementById('registerUsername').value.trim();
            const email = document.getElementById('registerEmail').value.trim();
            const password = document.getElementById('registerPassword').value;
            const passwordConfirm = document.getElementById('registerPasswordConfirm').value;

            logger.log('📝 Datos ingresados:');
            logger.log('  - Username:', username);
            logger.log('  - Email:', email);
            logger.log('  - Password:', password ? '****** (' + password.length + ' caracteres)' : 'VACÍO');
            logger.log('  - Confirmación:', passwordConfirm ? '****** (' + passwordConfirm.length + ' caracteres)' : 'VACÍO');

            // Validaciones
            if (!username || !email || !password || !passwordConfirm) {
                Logger.error('❌ Campos vacíos');
                showNotification('error', 'Error', 'Por favor completa todos los campos');
                toastWarning('Completa todos los campos', { title: 'Validación' });
                return;
            }

            if (password !== passwordConfirm) {
                Logger.error('❌ Contraseñas no coinciden');
                showNotification('error', 'Error', 'Las contraseñas no coinciden');
                toastError('Las contraseñas no coinciden', { title: 'Registro' });
                return;
            }

            if (password.length < 6) {
                Logger.error('❌ Contraseña muy corta');
                showNotification('error', 'Error', 'La contraseña debe tener mínimo 6 caracteres');
                toastError('La contraseña debe tener mínimo 6 caracteres', { title: 'Registro' });
                return;
            }

            if (username.length < 3) {
                Logger.error('❌ Username muy corto');
                showNotification('error', 'Error', 'El username debe tener mínimo 3 caracteres');
                toastError('El username debe tener mínimo 3 caracteres', { title: 'Registro' });
                return;
            }

            try {
                logger.log('🔍 Verificando si username ya existe...');

                const usernameExists = await usernameIndexIsTaken(username);

                if (usernameExists) {
                    Logger.error('❌ Username ya existe:', username);
                    showNotification('error', 'Username ocupado', 'Este username ya está en uso. Elige otro.');
                    toastError('Username ya existe. Elige otro.', { title: 'Registro' });
                    return;
                }

                logger.log('✅ Username disponible');
                logger.log('🔐 Creando cuenta en Firebase Auth...');

                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;

                logger.log('✅ Cuenta creada en Auth');
                logger.log('  - Email:', user.email);
                logger.log('  - UID:', user.uid);

                logger.log('💾 Guardando perfil en database...');

                await database.ref(`users/${user.uid}/profile`).set({
                    username: username,
                    email: email,
                    createdAt: new Date().toISOString(),
                    displayName: username
                });

                logger.log('✅ Perfil guardado');

                logger.log('💾 Registrando username...');

                await usernameIndexReserve(user.uid, username);

                logger.log('✅ Username registrado');

                logger.log('💾 Inicializando bankroll...');

                await database.ref(`users/${user.uid}/bankroll`).set({
                    current: 0,
                    initial: 0,
                    history: []
                });

                logger.log('✅ Bankroll inicializado');

                logger.log('');
                logger.log('═══════════════════════════════════════════');
                logger.log('✅✅✅ REGISTRO COMPLETADO ✅✅✅');
                logger.log('═══════════════════════════════════════════');
                logger.log('👤 Usuario:', username);
                logger.log('📧 Email:', email);
                logger.log('🆔 UID:', user.uid);
                logger.log('═══════════════════════════════════════════');

                showNotification('success', '¡Cuenta creada!', 'Bienvenido a NioSports Pro');
                toastSuccess('¡Cuenta creada! Bienvenido ' + username, { title: 'Registro' });

                // El onAuthStateChanged se encargará de mostrar la app

            } catch (error) {
                Logger.error('═══════════════════════════════════════════');
                Logger.error('❌ ERROR EN REGISTRO');
                Logger.error('═══════════════════════════════════════════');
                Logger.error('Código:', error.code);
                Logger.error('Mensaje:', error.message);
                Logger.error('Stack:', error.stack);
                Logger.error('═══════════════════════════════════════════');

                let errorMsg = 'Error al crear la cuenta';

                if (error.code === 'auth/email-already-in-use') {
                    errorMsg = 'Este email ya está registrado. Intenta hacer login.';
                } else if (error.code === 'auth/invalid-email') {
                    errorMsg = 'Email inválido';
                } else if (error.code === 'auth/weak-password') {
                    errorMsg = 'Contraseña muy débil';
                } else if (error.code === 'auth/network-request-failed') {
                    errorMsg = 'Error de conexión. Verifica tu internet.';
                }

                showNotification('error', 'Error de Registro', errorMsg);
                toastError(errorMsg, { title: 'Error' });
            }
        });
    } else {
        Logger.error('❌ Formulario de registro NO encontrado');
    }

    // ══════════ FORGOT PASSWORD FORM ══════════
    const forgotForm = document.getElementById('forgotPasswordForm');
    if (forgotForm) {
        logger.log('✅ Formulario de recuperación encontrado');

        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            logger.log('📧 Intentando recuperar contraseña...');

            const email = document.getElementById('forgotEmail').value.trim();

            logger.log('  - Email:', email);

            if (!email) {
                showNotification('error', 'Error', 'Ingresa tu email');
                toastWarning('Ingresa tu email', { title: 'Recuperación' });
                return;
            }

            try {
                await auth.sendPasswordResetEmail(email);
                logger.log('✅ Email de recuperación enviado');
                showNotification('success', 'Email enviado', 'Revisa tu bandeja de entrada');
                toastSuccess('Email de recuperación enviado. Revisa tu correo.', { title: 'Recuperación' });
                setTimeout(() => showLogin(), 2000);
            } catch (error) {
                Logger.error('❌ Error:', error);
                showNotification('error', 'Error', 'No se pudo enviar el email');
                toastError(error.message, { title: 'Error' });
            }
        });
    } else {
        Logger.error('❌ Formulario de recuperación NO encontrado');
    }

    logger.log('✅ Event listeners configurados correctamente');
});



// ═══════════════════════════════════════════════════════════════
// GOOGLE SIGN-IN
// ═══════════════════════════════════════════════════════════

async function loginWithGoogle() {
    logger.log('🔐 Iniciando login con Google...');

    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });

        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        await bindSession(user);

        logger.log('✅ Login con Google exitoso');
        logger.log('Usuario:', user.displayName, user.email);

        // Verificar si es primera vez
        const profileRef = database.ref(`users/${user.uid}/profile`);
        const snapshot = await profileRef.once('value');

        if (!snapshot.exists()) {
            logger.log('Primera vez con Google, creando perfil...');

            // Generar username único
            const baseUsername = user.displayName.replace(/\s+/g, '').toLowerCase();
            let username = baseUsername;
            let counter = 1;

            // Verificar que no exista (índice)
            while (await usernameIndexIsTaken(username)) {
                username = baseUsername + counter;
                counter++;
            }
            // Crear perfil
            await profileRef.set({
                username: username,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL || null,
                createdAt: new Date().toISOString(),
                provider: 'google'
            });

            await usernameIndexReserve(user.uid, username);
            await database.ref(`users/${user.uid}/bankroll`).set({
                current: 0, initial: 0, history: []
            });

            logger.log('✅ Perfil creado:', username);
        }

        showNotification('success', '¡Bienvenido!', 'Sesión iniciada con Google');

    } catch (error) {
        Logger.error('Error Google Sign-In:', error);
        let msg = 'Error al iniciar sesión con Google';
        if (error.code === 'auth/popup-blocked') msg = 'Popup bloqueado. Permite popups para este sitio.';
        if (error.code === 'auth/popup-closed-by-user') msg = 'Popup cerrado';
        if (error.code !== 'auth/popup-closed-by-user') {
            showNotification('error', 'Error', msg);
        }
    }
}

// Expose Google login handler to inline onclick attributes (global scope)
window.loginWithGoogle = loginWithGoogle;



// ═══════════════════════════════════════════════════════════════

// Keyboard shortcuts for power users
document.addEventListener('keydown', function (e) {
    // Only when no input is focused
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT' || document.activeElement.tagName === 'TEXTAREA') return;

    if (e.key === 'h' || e.key === 'H') { if (typeof navigateTo === 'function') navigateTo('home'); }
    else if (e.key === 't' || e.key === 'T') { if (typeof navigateTo === 'function') navigateTo('totales'); }
    else if (e.key === 'b' || e.key === 'B') { if (typeof navigateTo === 'function') navigateTo('bankroll'); }
    else if (e.key === 'r' || e.key === 'R') { if (typeof refreshData === 'function') refreshData(); }
});
// MOBILE BOTTOM NAV + REFRESH
// ═══════════════════════════════════════════════════════════════
function mobileNav(view) {
    // Map mobile nav items to actual views
    const viewMap = {
        'home': 'home',
        'totales': 'totales',
        'bankroll': 'bankroll',
        'mispicks': 'mispicks'
    };

    const target = viewMap[view] || view;

    // Check if we're in the landing page system or app system
    if (typeof navigateTo === 'function' && typeof currentView !== 'undefined') {
        navigateTo(target);
    } else if (typeof switchView === 'function') {
        switchView(target === 'totales' ? 'totals' : target);
    }

    // Update active state
    updateMobileNav(view);
}

function updateMobileNav(active) {
    const nav = document.getElementById('mobileBottomNav');
    if (!nav) return;
    nav.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeItem = document.getElementById('mnav-' + active);
    if (activeItem) activeItem.classList.add('active');
}

// Keep mobile nav in sync with currentView
const _origNavigateTo = typeof navigateTo === 'function' ? navigateTo : null;

function refreshData() {
    const btn = document.getElementById('refreshBtn');
    if (btn) {
        btn.classList.add('spinning');
        setTimeout(() => btn.classList.remove('spinning'), 800);
    }

    // Reload data from Firebase
    if (typeof loadBankrollFromFirebase === 'function') loadBankrollFromFirebase();
    if (typeof loadPicksFromFirebase === 'function') loadPicksFromFirebase();

    // Update timestamp
    updateLastUpdated();

    showNotification('✅ Datos actualizados', 'success');
}

function updateLastUpdated() {
    const el = document.getElementById('lastUpdated');
    if (el) {
        const now = new Date();
        el.textContent = now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    }
}

// Close mobile nav when clicking outside
document.addEventListener('click', function (e) {
    const navLinks = document.querySelector('.nav-links.open');
    const toggle = document.querySelector('.nav-mobile-toggle');
    if (navLinks && !navLinks.contains(e.target) && !toggle.contains(e.target)) {
        navLinks.classList.remove('open');
    }
});


// ── Service Worker Registration ──
// firebase-init.js gestiona la inicialización de Firebase.
// main.js solo registra el SW.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => Logger.log('SW registered:', reg.scope))
            .catch(err => Logger.warn('SW failed:', err));
    });
}

// ═══════════════════════════════════════════════════════════════
// STATS/TEAMS VIEW MODULO
// ═══════════════════════════════════════════════════════════════
window.initTeamsView = function () {
    const container = document.getElementById('view-stats');
    if (!container) return;

    if (!window.TEAM_STATS || Object.keys(window.TEAM_STATS).length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 40px; padding-top: 100px;">
            <div class="spinner" style="margin: 0 auto 20px;"></div>
            <h2 style="color: var(--gold); font-family: var(--font-display);">Cargando estadísticas de equipos...</h2>
        </div>`;
        if (typeof window.loadTeamStatsFromAPI === 'function') {
            window.loadTeamStatsFromAPI().then(() => initTeamsView()).catch(e => {
                container.innerHTML = `<div style="text-align:center; padding: 40px; padding-top: 100px;">
                    <h2 style="color: #ef4444; font-family: var(--font-display);">Error al cargar estadísticas.</h2>
                </div>`;
            });
        }
        return;
    }

    const teams = Object.keys(window.TEAM_STATS).sort();

    let html = `
        <div style="max-width:1200px;margin:0 auto;padding:40px 32px; animation: slideUp 0.5s ease forwards;">
            <div style="text-align:center; margin-bottom: 40px;">
                <div style="font-family:var(--font-mono);font-size:11px;color:var(--gold);letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">
                    ESTADÍSTICAS OFICIALES
                </div>
                <h1 style="font-family:var(--font-display);font-size:clamp(32px,5vw,48px);font-weight:800;margin-bottom:16px;">
                    🏀 Análisis de Equipos
                </h1>
                <p style="color:rgba(255,255,255,0.55);font-size:16px;line-height:1.7;max-width:600px;margin: 0 auto;">
                    Métricas promedio detalladas de todos los equipos de la NBA utilizadas por el motor predictivo.
                </p>
            </div>
            
            <div style="overflow-x: auto; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); backdrop-filter: blur(10px);">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 1px solid rgba(200, 160, 80, 0.2); color: var(--gold); font-family: var(--font-display); font-size: 14px; text-transform: uppercase;">
                            <th style="padding: 20px 24px;">Equipo</th>
                            <th style="padding: 20px 24px;">PPG (Full)</th>
                            <th style="padding: 20px 24px;">PPG (Home)</th>
                            <th style="padding: 20px 24px;">PPG (Away)</th>
                            <th style="padding: 20px 24px;">Pace</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    teams.forEach(team => {
        const stats = window.TEAM_STATS[team];
        const ppg = stats.full ? stats.full.toFixed(1) : '-';
        const ppgHome = stats.fullHome ? stats.fullHome.toFixed(1) : '-';
        const ppgAway = stats.fullAway ? stats.fullAway.toFixed(1) : '-';
        const pace = stats.pace ? stats.pace.toFixed(1) : '-';

        html += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                <td style="padding: 16px 24px; font-weight: 600; color: white;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <img src="https://a.espncdn.com/i/teamlogos/nba/500/${team.substring(0, 3).toLowerCase()}.png" alt="${team}" style="width: 32px; height: 32px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));" onerror="this.src='https://ui-avatars.com/api/?name=${team}&background=random&color=fff&size=32'">
                        ${team}
                    </div>
                </td>
                <td style="padding: 16px 24px; color: rgba(255,255,255,0.8);">${ppg}</td>
                <td style="padding: 16px 24px; color: rgba(255,255,255,0.8);">${ppgHome}</td>
                <td style="padding: 16px 24px; color: rgba(255,255,255,0.8);">${ppgAway}</td>
                <td style="padding: 16px 24px; color: rgba(255,255,255,0.8); font-family: var(--font-mono);">${pace}</td>
            </tr>
        `;
    });

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    container.innerHTML = html;
};
