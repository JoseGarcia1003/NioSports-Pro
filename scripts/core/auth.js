// ═══════════════════════════════════════════════════════════════
// NioSports Pro v4.0 - AUTH MODULE
// Gestión de autenticación y sesiones
// ═══════════════════════════════════════════════════════════════

(function(window) {
    'use strict';

    const logger = window.NioLogger || console;

    // ═══════════════════════════════════════════════════════════════
    // REFERENCIAS FIREBASE
    // ═══════════════════════════════════════════════════════════════
    let _auth = null;
    let _database = null;

    function getAuth() {
        return _auth || window.auth;
    }

    function getDatabase() {
        return _database || window.database;
    }

    // ═══════════════════════════════════════════════════════════════
    // UTILIDADES DE SESIÓN
    // ═══════════════════════════════════════════════════════════════
    function getOrCreateDeviceId() {
        const key = 'ns_device_id';
        let id = localStorage.getItem(key);
        if (!id) {
            id = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem(key, id);
        }
        return id;
    }

    function newSessionId() {
        return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // ═══════════════════════════════════════════════════════════════
    // VALIDACIÓN DE SESIÓN
    // ═══════════════════════════════════════════════════════════════
    async function validateCurrentSession(user) {
        try {
            await user.getIdToken(true);
            return true;
        } catch (e) {
            const code = String(e?.code || e?.name || '');
            const msg = String(e?.message || '');
            const offline = navigator?.onLine === false;
            const isNetwork = offline || /network-request-failed|timeout|Failed to fetch|NetworkError/i.test(code + ' ' + msg);
            
            if (isNetwork) {
                logger.warn('Token refresh falló por red/offline. Manteniendo sesión.');
                return true;
            }

            const mustLogout = /auth\/user-token-expired|auth\/id-token-expired|auth\/invalid-user-token|auth\/user-disabled/i.test(code);
            if (mustLogout) return false;

            logger.warn('Token refresh falló (no crítico). Manteniendo sesión.');
            return true;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // BINDING DE SESIÓN
    // ═══════════════════════════════════════════════════════════════
    async function bindSession(user) {
        const deviceId = getOrCreateDeviceId();
        const sessionId = newSessionId();
        localStorage.setItem('ns_session_id', sessionId);

        try {
            await getDatabase().ref(`users/${user.uid}/session`).update({
                currentSessionId: sessionId,
                deviceId,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (e) {
            // Fail silently - no bloqueamos login
        }

        return sessionId;
    }

    async function enforceSessionBinding(user) {
        const localSessionId = localStorage.getItem('ns_session_id');
        let remoteSessionId = null;

        try {
            const snap = await getDatabase().ref(`users/${user.uid}/session/currentSessionId`).once('value');
            remoteSessionId = snap.val();
        } catch (e) {
            return true; // Fail-open
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

    // ═══════════════════════════════════════════════════════════════
    // LOGOUT
    // ═══════════════════════════════════════════════════════════════
    async function safeHardLogout(message = 'Sesión cerrada por seguridad.') {
        try { await getAuth().signOut(); } catch {}
        try { localStorage.removeItem('ns_session_id'); } catch {}
        try { sessionStorage.clear(); } catch {}

        // Limpiar service worker cache
        try {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        } catch {}

        try {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
        } catch {}

        if (window.StateManager) {
            window.StateManager.reset();
        }

        if (typeof showNotification === 'function') {
            showNotification('info', 'Sesión cerrada', message);
        }

        setTimeout(() => {
            if (typeof showLogin === 'function') showLogin();
        }, 100);
    }

    async function logout() {
        const confirmLogout = await new Promise((resolve) => {
            if (window.NioModal?.confirm) {
                window.NioModal.confirm({
                    title: '¿Cerrar sesión?',
                    message: 'Se cerrará tu sesión actual',
                    confirmText: 'Cerrar sesión',
                    cancelText: 'Cancelar',
                    onConfirm: () => resolve(true),
                    onCancel: () => resolve(false)
                });
            } else {
                resolve(confirm('¿Cerrar sesión?'));
            }
        });

        if (confirmLogout) {
            await safeHardLogout('Has cerrado sesión correctamente.');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // INICIALIZAR AUTH LISTENER
    // ═══════════════════════════════════════════════════════════════
    function initAuthListeners() {
        if (window.__NS_AUTH_LISTENERS_READY__) return;
        window.__NS_AUTH_LISTENERS_READY__ = true;

        // Ocultar pantallas de auth
        ['loginScreen', 'registerScreen', 'forgotPasswordScreen'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.cssText = 'display:none!important;';
        });

        _auth = window.auth;
        _database = window.database;

        if (!getAuth() || !getDatabase()) {
            logger.error('Firebase no inicializado');
            return;
        }

        getAuth().onAuthStateChanged(async (user) => {
            if (user) {
                const okToken = await validateCurrentSession(user);
                if (!okToken) {
                    await safeHardLogout('Sesión corrupta. Inicia sesión nuevamente.');
                    return;
                }

                const okSession = await enforceSessionBinding(user);
                if (!okSession) return;

                // Actualizar estado
                window.currentUser = user;
                window.userId = user.uid;
                
                if (window.StateManager) {
                    window.StateManager.setUser(user);
                }

                // Heartbeat
                try {
                    getDatabase().ref(`users/${user.uid}/session`).update({
                        lastSeenAt: firebase.database.ServerValue.TIMESTAMP
                    });
                } catch {}

                if (typeof onUserLoggedIn === 'function') {
                    onUserLoggedIn(user);
                }
            } else {
                window.currentUser = null;
                window.userId = null;
                
                if (window.StateManager) {
                    window.StateManager.reset();
                }
                
                if (typeof showLogin === 'function') {
                    showLogin();
                }
            }
        });

        logger.success('Auth listeners initialized');
    }

    // ═══════════════════════════════════════════════════════════════
    // USERNAME INDEX
    // ═══════════════════════════════════════════════════════════════
    function normalizeUsername(u) {
        return (u || '').toLowerCase().trim();
    }

    async function usernameIndexGetUid(username) {
        const key = normalizeUsername(username);
        if (!key) return null;
        try {
            const snap = await getDatabase().ref(`usernamesIndex/${key}`).once('value');
            return snap.val();
        } catch {
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
        await getDatabase().ref(`usernamesByUid/${uid}`).set(username);
        await getDatabase().ref(`usernamesIndex/${key}`).set(uid);
    }

    // ═══════════════════════════════════════════════════════════════
    // EXPORTAR
    // ═══════════════════════════════════════════════════════════════
    window.NioAuth = {
        init: initAuthListeners,
        validateSession: validateCurrentSession,
        bindSession,
        enforceSessionBinding,
        logout,
        safeHardLogout,
        usernameIndexGetUid,
        usernameIndexIsTaken,
        usernameIndexReserve,
        normalizeUsername
    };

    // Alias globales para compatibilidad
    window.initAuthListeners = initAuthListeners;
    window.validateCurrentSession = validateCurrentSession;
    window.bindSession = bindSession;
    window.enforceSessionBinding = enforceSessionBinding;
    window.logout = logout;
    window.safeHardLogout = safeHardLogout;
    window.usernameIndexGetUid = usernameIndexGetUid;
    window.usernameIndexIsTaken = usernameIndexIsTaken;
    window.usernameIndexReserve = usernameIndexReserve;
    window.normalizeUsername = normalizeUsername;

    logger.success('Auth module loaded');

})(window);
