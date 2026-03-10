// ═══════════════════════════════════════════════════════════════
// NioSports Pro v4.0 - FORMS MODULE
// Handlers de formularios de autenticación
// ═══════════════════════════════════════════════════════════════

(function(window) {
    'use strict';

    const logger = window.NioLogger || console;

    // ═══════════════════════════════════════════════════════════════
    // LOGIN HANDLER
    // ═══════════════════════════════════════════════════════════════
    async function handleLoginSubmit(e) {
        e.preventDefault();
        
        const emailOrUsername = document.getElementById('loginEmailOrUsername')?.value?.trim();
        const password = document.getElementById('loginPassword')?.value;

        if (!emailOrUsername || !password) {
            showNotification('error', 'Error', 'Por favor completa todos los campos');
            return;
        }

        try {
            let email = emailOrUsername;

            // Si no contiene @, es un username
            if (!emailOrUsername.includes('@')) {
                const uid = await window.usernameIndexGetUid(emailOrUsername);
                if (uid) {
                    const userRef = await window.database.ref(`users/${uid}/profile`).once('value');
                    const profile = userRef.val();
                    if (profile?.email) {
                        email = profile.email;
                    } else {
                        throw new Error('Usuario no encontrado');
                    }
                } else {
                    throw new Error('Usuario no encontrado');
                }
            }

            const userCredential = await window.auth.signInWithEmailAndPassword(email, password);
            await window.bindSession(userCredential.user);

            logger.success('Login exitoso:', userCredential.user.email);
            showNotification('success', '¡Bienvenido!', 'Sesión iniciada');

        } catch (error) {
            logger.error('Login error:', error);
            
            let errorMsg = 'Error al iniciar sesión';
            const code = error.code || '';
            if (code === 'auth/user-not-found') errorMsg = 'Usuario no encontrado';
            else if (code === 'auth/wrong-password') errorMsg = 'Contraseña incorrecta';
            else if (code === 'auth/invalid-email') errorMsg = 'Email inválido';
            else if (code === 'auth/too-many-requests') errorMsg = 'Demasiados intentos';
            else if (error.message?.includes('no encontrado')) errorMsg = 'Usuario no existe';

            showNotification('error', 'Error', errorMsg);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // REGISTER HANDLER
    // ═══════════════════════════════════════════════════════════════
    async function handleRegisterSubmit(e) {
        e.preventDefault();

        const email = document.getElementById('registerEmail')?.value?.trim();
        const username = document.getElementById('registerUsername')?.value?.trim();
        const password = document.getElementById('registerPassword')?.value;
        const confirmPassword = document.getElementById('registerPasswordConfirm')?.value;

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
            showNotification('error', 'Error', 'Contraseña mínimo 6 caracteres');
            return;
        }

        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            showNotification('error', 'Error', 'Username inválido (3-20 chars, letras/números/_)');
            return;
        }

        try {
            // Verificar username
            const exists = await window.usernameIndexIsTaken(username);
            if (exists) {
                showNotification('error', 'Error', 'Username ya en uso');
                return;
            }

            // Crear usuario
            const userCredential = await window.auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Guardar perfil
            await window.database.ref(`users/${user.uid}/profile`).set({
                email, username,
                displayName: username,
                createdAt: new Date().toISOString()
            });

            // Reservar username
            await window.usernameIndexReserve(user.uid, username);

            // Inicializar bankroll
            await window.database.ref(`users/${user.uid}/bankroll`).set({
                current: 1000, initial: 1000, history: []
            });

            await window.bindSession(user);

            logger.success('Registro exitoso:', email);
            showNotification('success', '¡Cuenta creada!', 'Bienvenido');

        } catch (error) {
            logger.error('Register error:', error);

            let errorMsg = 'Error al crear cuenta';
            const code = error.code || '';
            if (code === 'auth/email-already-in-use') errorMsg = 'Email ya registrado';
            else if (code === 'auth/invalid-email') errorMsg = 'Email inválido';
            else if (code === 'auth/weak-password') errorMsg = 'Contraseña muy débil';

            showNotification('error', 'Error', errorMsg);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // FORGOT PASSWORD HANDLER
    // ═══════════════════════════════════════════════════════════════
    async function handleForgotSubmit(e) {
        e.preventDefault();

        const email = document.getElementById('forgotEmail')?.value?.trim();

        if (!email) {
            showNotification('error', 'Error', 'Ingresa tu email');
            return;
        }

        try {
            await window.auth.sendPasswordResetEmail(email);
            logger.success('Password reset email sent');
            showNotification('success', 'Email enviado', 'Revisa tu correo');
            setTimeout(() => showLogin(), 2000);
        } catch (error) {
            logger.error('Forgot password error:', error);
            showNotification('error', 'Error', 'No se pudo enviar el email');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // SETUP FORMS
    // ═══════════════════════════════════════════════════════════════
    function setupAuthForms() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const forgotForm = document.getElementById('forgotPasswordForm');

        if (loginForm) {
            loginForm.addEventListener('submit', handleLoginSubmit);
            logger.log('✅ Login form ready');
        }

        if (registerForm) {
            registerForm.addEventListener('submit', handleRegisterSubmit);
            logger.log('✅ Register form ready');
        }

        if (forgotForm) {
            forgotForm.addEventListener('submit', handleForgotSubmit);
            logger.log('✅ Forgot form ready');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // GOOGLE SIGN-IN
    // ═══════════════════════════════════════════════════════════════
    async function signInWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            
            const result = await window.auth.signInWithPopup(provider);
            const user = result.user;

            // Verificar si es nuevo usuario
            const profileSnap = await window.database.ref(`users/${user.uid}/profile`).once('value');
            if (!profileSnap.exists()) {
                const username = (user.displayName || 'user').replace(/\s+/g, '').toLowerCase().slice(0, 15) + '_' + Date.now().toString(36).slice(-4);
                
                await window.database.ref(`users/${user.uid}/profile`).set({
                    email: user.email,
                    username: username,
                    displayName: user.displayName || username,
                    photoURL: user.photoURL || null,
                    createdAt: new Date().toISOString(),
                    authProvider: 'google'
                });

                await window.database.ref(`users/${user.uid}/bankroll`).set({
                    current: 1000, initial: 1000, history: []
                });

                try {
                    await window.usernameIndexReserve(user.uid, username);
                } catch {}
            }

            await window.bindSession(user);
            logger.success('Google sign-in successful');
            showNotification('success', '¡Bienvenido!', 'Sesión con Google');

        } catch (error) {
            if (error.code !== 'auth/popup-closed-by-user') {
                logger.error('Google sign-in error:', error);
                showNotification('error', 'Error', 'No se pudo iniciar con Google');
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // EXPORTAR
    // ═══════════════════════════════════════════════════════════════
    window.NioForms = {
        handleLoginSubmit,
        handleRegisterSubmit,
        handleForgotSubmit,
        setupAuthForms,
        signInWithGoogle
    };

    // Alias globales
    window.handleLoginSubmit = handleLoginSubmit;
    window.handleRegisterSubmit = handleRegisterSubmit;
    window.handleForgotSubmit = handleForgotSubmit;
    window.setupAuthForms = setupAuthForms;
    window.signInWithGoogle = signInWithGoogle;

    logger.success('Forms module loaded');

})(window);
