// ═══════════════════════════════════════════════════════════════
// NioSports Pro v4.0 - UI MODULE
// Gestión de pantallas, navegación y componentes UI
// ═══════════════════════════════════════════════════════════════

(function(window) {
    'use strict';

    const logger = window.NioLogger || console;

    // ═══════════════════════════════════════════════════════════════
    // LOADING OVERLAY
    // ═══════════════════════════════════════════════════════════════
    function showLoading(msg) {
        try {
            const overlay = document.getElementById('loadingOverlay');
            if (!overlay) return;
            const txt = overlay.querySelector('.loading-text');
            if (txt && msg) txt.textContent = msg;
            overlay.classList.remove('hidden');
        } catch (e) {}
    }

    function hideLoading() {
        try {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) overlay.classList.add('hidden');
        } catch (e) {}
    }

    // ═══════════════════════════════════════════════════════════════
    // PANTALLAS DE AUTH
    // ═══════════════════════════════════════════════════════════════
    function showLogin() {
        const loginScreen = document.getElementById('loginScreen');
        const registerScreen = document.getElementById('registerScreen');
        const forgotScreen = document.getElementById('forgotPasswordScreen');
        const mainApp = document.getElementById('mainApp');
        const mainNav = document.getElementById('mainNav');

        if (mainApp) mainApp.style.cssText = 'display: none !important;';
        if (mainNav) mainNav.style.cssText = 'display: none !important;';
        if (loginScreen) loginScreen.style.cssText = 'display: flex !important;';
        if (registerScreen) registerScreen.style.cssText = 'display: none !important;';
        if (forgotScreen) forgotScreen.style.cssText = 'display: none !important;';

        hideLoading();
        logger.log('🔐 showLogin');
    }

    function showRegister() {
        const loginScreen = document.getElementById('loginScreen');
        const registerScreen = document.getElementById('registerScreen');
        const forgotScreen = document.getElementById('forgotPasswordScreen');
        const mainApp = document.getElementById('mainApp');
        const mainNav = document.getElementById('mainNav');

        if (mainApp) mainApp.style.cssText = 'display: none !important;';
        if (mainNav) mainNav.style.cssText = 'display: none !important;';
        if (loginScreen) loginScreen.style.cssText = 'display: none !important;';
        if (registerScreen) registerScreen.style.cssText = 'display: flex !important;';
        if (forgotScreen) forgotScreen.style.cssText = 'display: none !important;';

        hideLoading();
    }

    function showForgotPassword() {
        const loginScreen = document.getElementById('loginScreen');
        const registerScreen = document.getElementById('registerScreen');
        const forgotScreen = document.getElementById('forgotPasswordScreen');
        const mainApp = document.getElementById('mainApp');
        const mainNav = document.getElementById('mainNav');

        if (mainApp) mainApp.style.cssText = 'display: none !important;';
        if (mainNav) mainNav.style.cssText = 'display: none !important;';
        if (loginScreen) loginScreen.style.cssText = 'display: none !important;';
        if (registerScreen) registerScreen.style.cssText = 'display: none !important;';
        if (forgotScreen) forgotScreen.style.cssText = 'display: flex !important;';

        hideLoading();
    }

    function showApp() {
        const loginScreen = document.getElementById('loginScreen');
        const registerScreen = document.getElementById('registerScreen');
        const forgotScreen = document.getElementById('forgotPasswordScreen');
        const mainApp = document.getElementById('mainApp');
        const mainNav = document.getElementById('mainNav');
        const mobileNav = document.getElementById('mobileBottomNav');

        if (loginScreen) loginScreen.style.cssText = 'display: none !important;';
        if (registerScreen) registerScreen.style.cssText = 'display: none !important;';
        if (forgotScreen) forgotScreen.style.cssText = 'display: none !important;';
        if (mainApp) mainApp.style.cssText = 'display: block !important; padding-top: 80px;';
        if (mainNav) mainNav.style.cssText = 'display: flex !important;';
        if (mobileNav) mobileNav.style.display = '';

        hideLoading();
    }

    // ═══════════════════════════════════════════════════════════════
    // ON USER LOGGED IN
    // ═══════════════════════════════════════════════════════════════
    function onUserLoggedIn(user) {
        logger.success('Usuario autenticado:', user.email);

        // Cargar perfil
        const db = window.database;
        if (db) {
            db.ref(`users/${user.uid}/profile`).once('value').then((snapshot) => {
                const profile = snapshot.val();
                if (profile) {
                    const username = profile.username || profile.displayName || 'Usuario';
                    const navName = document.getElementById('userName');
                    const navInitials = document.getElementById('userInitials');
                    if (navName) navName.textContent = username;
                    if (navInitials) navInitials.textContent = username.substring(0, 1).toUpperCase();
                }
            }).catch(err => logger.error('Error cargando perfil:', err));
        }

        // Mostrar app
        showApp();

        // Cargar datos
        if (typeof loadUserData === 'function') loadUserData();
        if (typeof loadBankrollFromFirebase === 'function') loadBankrollFromFirebase();
        if (typeof loadPicksFromFirebase === 'function') loadPicksFromFirebase();

        // Renderizar
        if (typeof render === 'function') {
            setTimeout(() => render(), 100);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // NOTIFICACIONES
    // ═══════════════════════════════════════════════════════════════
    function showNotification(type, title, message) {
        // Intentar usar toast system primero
        if (type === 'success' && typeof toastSuccess === 'function') {
            toastSuccess(message, { title });
            return;
        }
        if (type === 'error' && typeof toastError === 'function') {
            toastError(message, { title });
            return;
        }
        if (type === 'warning' && typeof toastWarning === 'function') {
            toastWarning(message, { title });
            return;
        }
        if (typeof toastInfo === 'function') {
            toastInfo(message, { title });
            return;
        }

        // Fallback a notificación custom
        const container = document.getElementById('notificationContainer') || createNotificationContainer();
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</div>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;
        container.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }

    function createNotificationContainer() {
        const container = document.createElement('div');
        container.id = 'notificationContainer';
        container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;';
        document.body.appendChild(container);
        return container;
    }

    // ═══════════════════════════════════════════════════════════════
    // NAVEGACIÓN
    // ═══════════════════════════════════════════════════════════════
    function switchView(view) {
        if (!window.currentUser) {
            showLogin();
            return;
        }

        window.currentView = view;
        if (window.StateManager) {
            window.StateManager.setView(view);
        }

        // Actualizar nav activo
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.view === view) {
                link.classList.add('active');
            }
        });

        if (typeof render === 'function') {
            render();
        }

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function navigateTo(view) {
        switchView(view);
    }

    // ═══════════════════════════════════════════════════════════════
    // DROPDOWNS
    // ═══════════════════════════════════════════════════════════════
    function toggleUserDropdown() {
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) dropdown.classList.toggle('active');
    }

    // Cerrar al click fuera
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('userDropdown');
        if (dropdown && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    // ═══════════════════════════════════════════════════════════════
    // MODALES
    // ═══════════════════════════════════════════════════════════════
    function showUpdateBankrollModal() {
        const modal = document.getElementById('updateBankrollModal');
        if (modal) modal.style.display = 'flex';
    }

    function closeUpdateBankrollModal() {
        const modal = document.getElementById('updateBankrollModal');
        if (modal) modal.style.display = 'none';
    }

    // ═══════════════════════════════════════════════════════════════
    // EXPORTAR
    // ═══════════════════════════════════════════════════════════════
    window.NioUI = {
        showLoading,
        hideLoading,
        showLogin,
        showRegister,
        showForgotPassword,
        showApp,
        showNotification,
        switchView,
        navigateTo,
        toggleUserDropdown,
        showUpdateBankrollModal,
        closeUpdateBankrollModal
    };

    // Alias globales
    window.showLoading = showLoading;
    window.hideLoading = hideLoading;
    window.showLogin = showLogin;
    window.showRegister = showRegister;
    window.showForgotPassword = showForgotPassword;
    window.onUserLoggedIn = onUserLoggedIn;
    window.showNotification = showNotification;
    window.switchView = switchView;
    window.navigateTo = navigateTo;
    window.toggleUserDropdown = toggleUserDropdown;
    window.showUpdateBankrollModal = showUpdateBankrollModal;
    window.closeUpdateBankrollModal = closeUpdateBankrollModal;

    logger.success('UI module loaded');

})(window);
