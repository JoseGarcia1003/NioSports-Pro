// ═══════════════════════════════════════════════════════════════
// NioSports Pro v4.0 - EVENTS MODULE
// Event handlers y funciones auxiliares
// ═══════════════════════════════════════════════════════════════

(function(window) {
    "use strict";
    const logger = window.NioLogger || console;

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

// ═══════════════════════════════════════════════════════════════
// 🎯 INICIALIZACIÓN PRINCIPAL (Fase 2 - Consolidado)
// Un solo punto de entrada para evitar race conditions
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
    logger.group('🚀 NioSports Pro v4.0 - Inicialización');
    
    try {
        // 1. Cargar VALUE_PICKS desde localStorage
        if (typeof loadValuePicksFromStorage === 'function') {
            loadValuePicksFromStorage();
            logger.log('✅ VALUE_PICKS cargados');
        }
        
        // 2. Cargar estadísticas desde API (no requiere auth)
        if (typeof loadTeamStatsFromAPI === 'function') {
            await loadTeamStatsFromAPI();
            logger.log('✅ Team Stats cargados');
        }
        
        // 3. Cargar AI Picks desde cache local
        if (typeof loadAIPicks === 'function') {
            loadAIPicks();
            logger.log('✅ AI Picks cargados');
        }
        
        // 4. Configurar formularios de autenticación
        setupAuthForms();
        
        logger.success('Datos públicos cargados. Esperando autenticación...');
        
    } catch (error) {
        logger.error('Error en inicialización:', error);
    }
    
    logger.groupEnd();
});

// ═══════════════════════════════════════════════════════════════
// 🔐 CONFIGURACIÓN DE FORMULARIOS DE AUTH (Fase 2 - Extraído)
// ═══════════════════════════════════════════════════════════════
function setupAuthForms() {
    logger.log('🎬 Configurando formularios de autenticación...');

    // ══════════ LOGIN FORM ══════════
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
        logger.log('✅ Login form configurado');
    }

    // ══════════ REGISTER FORM ══════════
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegisterSubmit);
        logger.log('✅ Register form configurado');
    }

    // ══════════ FORGOT PASSWORD FORM ══════════
    const forgotForm = document.getElementById('forgotPasswordForm');
    if (forgotForm) {
        forgotForm.addEventListener('submit', handleForgotSubmit);
        logger.log('✅ Forgot form configurado');
    }
    
    logger.log('✅ Formularios de auth configurados');
}

// ═══════════════════════════════════════════════════════════════
// 🔐 HANDLERS DE FORMULARIOS (Fase 2 - Con manejo de errores)
// ═══════════════════════════════════════════════════════════════
async function handleLoginSubmit(e) {
    e.preventDefault();
    
    const emailOrUsername = document.getElementById('loginEmailOrUsername')?.value?.trim();
    const password = document.getElementById('loginPassword')?.value;

    if (!emailOrUsername || !password) {
        showNotification('error', 'Error', 'Por favor completa todos los campos');
        if (typeof toastWarning === 'function') toastWarning('Completa todos los campos');
        return;
    }

    try {
        let email = emailOrUsername;

        // Si no contiene @, es un username
        if (!emailOrUsername.includes('@')) {
            logger.log('🔍 Buscando username...');
            const uid = await usernameIndexGetUid(emailOrUsername);

            if (uid) {
                const userRef = await database.ref(`users/${uid}/profile`).once('value');
                const userProfile = userRef.val();

                if (userProfile?.email) {
                    email = userProfile.email;
                } else {
                    throw new Error('Usuario no encontrado');
                }
            } else {
                throw new Error('Usuario no encontrado');
            }
        }

        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        await bindSession(userCredential.user);

        logger.success('Login exitoso:', userCredential.user.email);
        showNotification('success', '¡Bienvenido!', 'Sesión iniciada correctamente');
        if (typeof toastSuccess === 'function') toastSuccess('¡Login exitoso!');

    } catch (error) {
        logger.error('Error en login:', error);
        
        let errorMsg = 'Error al iniciar sesión';
        if (error.code === 'auth/user-not-found') errorMsg = 'Usuario no encontrado';
        else if (error.code === 'auth/wrong-password') errorMsg = 'Contraseña incorrecta';
        else if (error.code === 'auth/invalid-email') errorMsg = 'Email inválido';
        else if (error.code === 'auth/too-many-requests') errorMsg = 'Demasiados intentos. Espera un momento.';
        else if (error.message?.includes('Usuario no encontrado')) errorMsg = 'Usuario no existe';

        showNotification('error', 'Error de Login', errorMsg);
        if (typeof toastError === 'function') toastError(errorMsg);
    }
}

async function handleRegisterSubmit(e) {
    e.preventDefault();

    const email = document.getElementById('registerEmail')?.value?.trim();
    const username = document.getElementById('registerUsername')?.value?.trim();
    const password = document.getElementById('registerPassword')?.value;
    const confirmPassword = document.getElementById('registerConfirmPassword')?.value;

    // Validaciones
    if (!email || !username || !password || !confirmPassword) {
        showNotification('error', 'Error', 'Completa todos los campos');
        return;
    }

    if (password !== confirmPassword) {
        showNotification('error', 'Error', 'Las contraseñas no coinciden');
        return;
    }

    if (password.length < 6) {
        showNotification('error', 'Error', 'La contraseña debe tener al menos 6 caracteres');
        return;
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        showNotification('error', 'Error', 'Username inválido (3-20 caracteres, solo letras, números y _)');
        return;
    }

    try {
        // Verificar si username ya existe
        const existingUid = await usernameIndexGetUid(username);
        if (existingUid) {
            showNotification('error', 'Error', 'Ese nombre de usuario ya está en uso');
            return;
        }

        // Crear usuario
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Guardar perfil
        await database.ref(`users/${user.uid}/profile`).set({
            email: email,
            username: username,
            displayName: username,
            createdAt: new Date().toISOString()
        });

        // Reservar username
        await usernameIndexReserve(user.uid, username);

        // Inicializar bankroll
        await database.ref(`users/${user.uid}/bankroll`).set({
            current: 1000,
            initial: 1000,
            history: []
        });

        await bindSession(user);

        logger.success('Registro exitoso:', email);
        showNotification('success', '¡Cuenta creada!', 'Bienvenido a NioSports Pro');
        if (typeof toastSuccess === 'function') toastSuccess('¡Registro exitoso!');

    } catch (error) {
        logger.error('Error en registro:', error);

        let errorMsg = 'Error al crear cuenta';
        if (error.code === 'auth/email-already-in-use') errorMsg = 'Ese email ya está registrado';
        else if (error.code === 'auth/invalid-email') errorMsg = 'Email inválido';
        else if (error.code === 'auth/weak-password') errorMsg = 'Contraseña muy débil';

        showNotification('error', 'Error de Registro', errorMsg);
        if (typeof toastError === 'function') toastError(errorMsg);
    }
}

async function handleForgotSubmit(e) {
    e.preventDefault();

    const email = document.getElementById('forgotEmail')?.value?.trim();

    if (!email) {
        showNotification('error', 'Error', 'Ingresa tu email');
        return;
    }

    try {
        await auth.sendPasswordResetEmail(email);
        logger.success('Email de recuperación enviado');
        showNotification('success', 'Email enviado', 'Revisa tu bandeja de entrada');
        if (typeof toastSuccess === 'function') toastSuccess('Email enviado');
        setTimeout(() => showLogin(), 2000);
        
    } catch (error) {
        logger.error('Error recuperando contraseña:', error);
        showNotification('error', 'Error', 'No se pudo enviar el email');
        if (typeof toastError === 'function') toastError(error.message);
    }
}



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

    database.ref(`users/${userId}/bankroll`).update({
        current: newAmount,
        initial: USER_BANKROLL.initial || newAmount,
        history: newHistory
    }).then(() => {
        showNotification('success', 'Bankroll Actualizado', `Nuevo saldo: $${newAmount.toFixed(2)}`);
        closeUpdateBankrollModal();
        render();
    }).catch(err => {
        logger.error('Error:', err);
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
        logger.error('Error:', error);
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
            logger.error('Error:', err);
            showNotification('error', 'Error', 'No se pudo actualizar');
        });
    });
}

// [REMOVED] Duplicate resolveBacktestPick — using original at line ~4710

// Función para filtrar Mis Picks
function filterMisPicks(filter) {
    const list = document.getElementById('misPicksList');
    if (!list) return;

    // Update active tab styles
    const tabs = list.parentElement.querySelectorAll('.flex.gap-4.mb-6 button');
    tabs.forEach(btn => {
        btn.classList.remove('text-gold', 'border-b-2', 'border-gold');
        btn.classList.add('text-gray-400');
    });
    const activeTab = [...tabs].find(btn => btn.textContent.toLowerCase().includes(
        filter === 'all' ? 'todos' : filter === 'pending' ? 'pendiente' : 'resuelto'
    ));
    if (activeTab) {
        activeTab.classList.add('text-gold', 'border-b-2', 'border-gold');
        activeTab.classList.remove('text-gray-400');
    }

    // Show/hide picks based on filter
    const cards = list.querySelectorAll('.glass-card');
    cards.forEach(card => {
        const hasPending = card.querySelector('.pending-badge');
        const isResolved = card.querySelector('.win-badge') || card.querySelector('.loss-badge');

        if (filter === 'all') {
            card.style.display = '';
        } else if (filter === 'pending') {
            card.style.display = hasPending ? '' : 'none';
        } else if (filter === 'resolved') {
            card.style.display = isResolved ? '' : 'none';
        }
    });
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
            logger.error('Error al copiar:', err);
            showNotification('error', 'Error', 'No se pudo copiar');
        }
        document.body.removeChild(textArea);
        return;
    }

    navigator.clipboard.writeText(text).then(() => {
        showNotification('success', 'Copiado', 'Texto copiado al portapapeles');
    }).catch(err => {
        logger.error('Error al copiar:', err);
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
        logger.error('❌ Error leyendo usernamesIndex:', e?.message || e);
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
        logger.error('Error Google Sign-In:', error);
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

    showNotification('success', 'Actualizado', 'Datos actualizados correctamente');
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
            .then(reg => logger.log('SW registered:', reg.scope))
            .catch(err => logger.warn('SW failed:', err));
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

    logger.success("Events module loaded");
})(window);
