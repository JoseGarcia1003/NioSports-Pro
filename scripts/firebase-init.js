// scripts/firebase-init.js — Firebase Initialization Module
// ═════════════════════════════════════════════════════════════════

console.log('🔥 firebase-init.js cargando...');
// Singleton guard: evita doble ejecución si el script se carga 2+ veces
if (window.__NS_FIREBASE_INIT_PROMISE__) {
  console.log('ℹ️ Firebase init ya en progreso/terminado (singleton)');
} else {
  window.__NS_FIREBASE_INIT_PROMISE__ = null; // se asigna más abajo
}


// ═════════════════════════════════════════════════════════════════
// ESPERAR A QUE FIREBASE SDK ESTÉ DISPONIBLE
// ═════════════════════════════════════════════════════════════════

/**
 * Esperar a que Firebase SDK se cargue
 * @param {number} maxAttempts - Intentos máximos (50 = ~5 segundos)
 * @returns {Promise}
 */
function waitForFirebase(maxAttempts = 50) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const checkInterval = setInterval(() => {
      attempts++;
      
      // Verificar que firebase, firebase.app, initializeApp existan
      if (typeof firebase !== 'undefined' && 
          firebase.app && 
          typeof firebase.initializeApp === 'function') {
        
        clearInterval(checkInterval);
        console.log('✅ Firebase SDK detectado (intento ' + attempts + ')');
        resolve();
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        const err = new Error('Firebase SDK timeout después de ' + (attempts * 100) + 'ms');
        console.error('❌ ' + err.message);
        reject(err);
      }
    }, 100); // Revisar cada 100ms
  });
}

// ═════════════════════════════════════════════════════════════════
// OBTENER CONFIGURACIÓN FIREBASE DESDE API SEGURO
// ═════════════════════════════════════════════════════════════════

/**
 * Obtener credenciales Firebase desde endpoint seguro
 * @returns {Promise<Object>} Firebase config
 */
async function getFirebaseConfig() {
  const response = await fetch('/api/firebase-config');
  if (!response.ok) {
    throw new Error('No se pudo obtener Firebase config (HTTP ' + response.status + ')');
  }
  return await response.json();
}

// ═════════════════════════════════════════════════════════════════
// INICIALIZAR FIREBASE
// ═════════════════════════════════════════════════════════════════

/**
 * Inicializar Firebase y configurar listeners
 * @returns {Promise<boolean>} true si éxito, false si error
 */
async function initFirebase() {
  console.log('🚀 Iniciando Firebase...');
  
  try {
    // Paso 1: Esperar a que Firebase SDK esté disponible
    console.log('⏳ Esperando Firebase SDK...');
    await waitForFirebase();
    
    // Paso 2: Evitar inicialización duplicada
    if (firebase.apps && firebase.apps.length > 0) {
      console.log('ℹ️ Firebase ya fue inicializado');
      window.database = firebase.database();
      window.auth = firebase.auth();
      try { window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch {}
      setupAuthListener();
      setupConnectionListener();

      // Marcar listo también en este camino (evita timeouts y dobles bridges)
      window.__FIREBASE_READY__ = true;
      try { window.dispatchEvent(new CustomEvent('ns:firebase-ready')); } catch {}
      console.log('✅ Firebase listo (re-uso de instancia existente)');
      return true;
    }
    
    // Paso 3: Obtener configuración desde API
    console.log('🔐 Obteniendo configuración Firebase...');
    const firebaseConfig = await getFirebaseConfig();
    console.log('✅ Configuración obtenida');
    
    // Paso 4: Inicializar la aplicación Firebase
    console.log('🔧 Inicializando Firebase App...');
    firebase.initializeApp(firebaseConfig);
    console.log('✅ Firebase App inicializado');
    
    // Paso 5: Obtener referencias globales
    window.database = firebase.database();
    window.auth = firebase.auth();
    console.log('✅ Database y Auth referencias obtenidas');

    // Persistencia LOCAL (evita que se cierre sesión al refrescar)
    try {
      window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    } catch (e) {
      console.warn('⚠️ No se pudo fijar persistencia LOCAL:', e?.message || e);
    }
    
    // Paso 6: Configurar listeners
    setupAuthListener();
    setupConnectionListener();
    
    // Paso 7: Actualizar estado global
    window.__FIREBASE_READY__ = true;
    try { window.dispatchEvent(new CustomEvent('ns:firebase-ready')); } catch {}
    console.log('✅ Firebase completamente inicializado');
    
    return true;
    
  } catch (error) {
    console.error('❌ Error inicializando Firebase:', error.message);
    window.__FIREBASE_ERROR__ = error;
    
    // Notificar al usuario si está disponible showNotification
    if (typeof showNotification === 'function') {
      showNotification('Error', 'No se pudo conectar a Firebase: ' + error.message, 'error');
    }
    
    // Trackear el error con Sentry si está disponible
    if (window.trackError) {
      window.trackError(error, { module: 'firebase-init' });
    }
    
    return false;
  }
}

// ═════════════════════════════════════════════════════════════════
// LISTENER DE AUTENTICACIÓN
// ═════════════════════════════════════════════════════════════════

/**
 * Monitorear cambios de autenticación
 */
function setupAuthListener() {
  if (window.__NS_FIREBASE_AUTH_LISTENER__) return;
  window.__NS_FIREBASE_AUTH_LISTENER__ = true;
  if (!window.auth) {
    console.warn('⚠️ Auth no disponible');
    return;
  }
  
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      console.log('👤 Usuario autenticado:', user.email);
      window.currentUser = user;
      window.isAuthenticated = true;
      
      // Actualizar estado visual
      document.body.classList.add('authenticated');
      document.body.classList.remove('unauthenticated');
      
      // Trackear login
      if (window.trackAction) {
        window.trackAction('user_login', { email: user.email });
      }
      
    } else {
      console.log('🔓 Sin usuario autenticado');
      window.currentUser = null;
      window.isAuthenticated = false;
      
      // Actualizar estado visual
      document.body.classList.remove('authenticated');
      document.body.classList.add('unauthenticated');
    }
  });
}

// ═════════════════════════════════════════════════════════════════
// LISTENER DE CONEXIÓN A DATABASE
// ═════════════════════════════════════════════════════════════════

/**
 * Monitorear conexión a Firebase Realtime Database
 */
function setupConnectionListener() {
  if (window.__NS_FIREBASE_CONN_LISTENER__) return;
  window.__NS_FIREBASE_CONN_LISTENER__ = true;
  if (!window.database) {
    console.warn('⚠️ Database no disponible');
    return;
  }
  
  firebase.database().ref('.info/connected').on('value', (snapshot) => {
    const connected = snapshot.val();
    const statusEl = document.querySelector('.firebase-status');
    
    if (connected) {
      console.log('✅ Conectado a Firebase Realtime Database');
      window.isFirebaseConnected = true;
      
      if (statusEl) {
        statusEl.textContent = '● Conectado a Firebase';
        statusEl.className = 'firebase-status firebase-connected';
        statusEl.title = 'Conexión activa con Firebase Realtime Database';
      }
      
      // Trackear reconexión
      if (window.trackAction && window.__FIREBASE_WAS_DISCONNECTED__) {
        window.trackAction('firebase_reconnected');
        window.__FIREBASE_WAS_DISCONNECTED__ = false;
      }
      
    } else {
      console.warn('⚠️ Desconectado de Firebase Realtime Database');
      window.isFirebaseConnected = false;
      window.__FIREBASE_WAS_DISCONNECTED__ = true;
      
      if (statusEl) {
        statusEl.textContent = '● Desconectado';
        statusEl.className = 'firebase-status firebase-disconnected';
        statusEl.title = 'Sin conexión a Firebase';
      }
    }
  }, (error) => {
    console.error('❌ Error monitoreando conexión Firebase:', error.message);
  });
}

// ═════════════════════════════════════════════════════════════════
// EJECUTAR CUANDO EL DOM ESTÉ LISTO (SINGLETON)
// ═════════════════════════════════════════════════════════════════

// Creamos una única promesa global para que el resto del sistema pueda esperar.
function __nsStartFirebaseInitOnce() {
  if (window.__NS_FIREBASE_INIT_PROMISE__) return window.__NS_FIREBASE_INIT_PROMISE__;
  window.__NS_FIREBASE_INIT_PROMISE__ = (async () => {
    const ok = await initFirebase();
    return ok;
  })();
  return window.__NS_FIREBASE_INIT_PROMISE__;
}

if (document.readyState === 'loading') {
  console.log('⏳ Esperando DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOMContentLoaded disparado');
    __nsStartFirebaseInitOnce();
  }, { once: true });
} else {
  console.log('✅ DOM ya está listo, inicializando Firebase inmediatamente');
  __nsStartFirebaseInitOnce();
}

console.log('🔥 scripts/firebase-init.js cargado');


// ═════════════════════════════════════════════════════════════════
// HELPERS GLOBALES
// ═════════════════════════════════════════════════════════════════

/**
 * Esperar a que Firebase esté listo
 * @returns {Promise}
 */
window.waitForFirebaseReady = function() {
  // Si ya está listo, resolvemos inmediatamente
  if (window.__FIREBASE_READY__) return Promise.resolve(true);

  // Si existe la promesa global de init, esperamos por ella
  if (window.__NS_FIREBASE_INIT_PROMISE__ && typeof window.__NS_FIREBASE_INIT_PROMISE__.then === 'function') {
    return window.__NS_FIREBASE_INIT_PROMISE__.then(() => true).catch(() => false);
  }

  // Fallback: polling corto (sin warnings ruidosos)
  return new Promise((resolve) => {
    const iv = setInterval(() => {
      if (window.__FIREBASE_READY__) {
        clearInterval(iv);
        resolve(true);
      }
    }, 100);

    // Timeout "silencioso" de 12s: resolvemos false pero sin spamear consola
    setTimeout(() => {
      clearInterval(iv);
      resolve(false);
    }, 12000);
  });
};

/**
 * Leer datos desde Firebase Realtime Database
 * @param {string} path - Ruta en la database (ej: 'users/uid123')
 * @returns {Promise}
 */
window.firebaseRead = async function(path) {
  if (!window.__FIREBASE_READY__) {
    await window.waitForFirebaseReady();
  }
  
  try {
    const snapshot = await window.database.ref(path).once('value');
    return snapshot.val();
  } catch (error) {
    console.error('❌ Error leyendo ' + path + ':', error.message);
    if (window.trackError) {
      window.trackError(error, { module: 'firebaseRead', path });
    }
    throw error;
  }
};

/**
 * Escribir datos en Firebase Realtime Database
 * @param {string} path - Ruta en la database
 * @param {*} data - Datos a escribir
 * @returns {Promise}
 */
window.firebaseWrite = async function(path, data) {
  if (!window.__FIREBASE_READY__) {
    await window.waitForFirebaseReady();
  }
  
  try {
    await window.database.ref(path).set(data);
    console.log('✅ Datos escritos en ' + path);
    return true;
  } catch (error) {
    console.error('❌ Error escribiendo en ' + path + ':', error.message);
    if (window.trackError) {
      window.trackError(error, { module: 'firebaseWrite', path });
    }
    throw error;
  }
};
