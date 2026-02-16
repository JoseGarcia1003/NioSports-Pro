// scripts/toast.js - Toast Notification System
// ═══════════════════════════════════════════════════════════════
// NOTIFICACIONES PROFESIONALES (NO MÁS ALERTS FEOS)
// ═══════════════════════════════════════════════════════════════

console.log('🍞 Toast System cargando...');

// ═══════════════════════════════════════════════════════════════
// CREAR CONTENEDOR DE TOASTS
// ═══════════════════════════════════════════════════════════════

function createToastContainer() {
  if (document.getElementById('toast-container')) return;
  
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'toast-container';
  document.body.appendChild(container);
}

// ═══════════════════════════════════════════════════════════════
// MOSTRAR TOAST
// ═══════════════════════════════════════════════════════════════

/**
 * Mostrar toast notification
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo: success, error, warning, info
 * @param {number} duration - Duración en ms (default: 3000)
 * @param {object} options - Opciones adicionales
 */
window.showToast = function(message, type = 'info', duration = 3000, options = {}) {
  createToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type} toast-enter`;
  
  // Icono según tipo
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  const icon = options.icon || icons[type] || 'ℹ️';
  
  // HTML del toast
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-content">
      ${options.title ? `<div class="toast-title">${options.title}</div>` : ''}
      <div class="toast-message">${message}</div>
    </div>
    ${options.action ? `<button class="toast-action" onclick="${options.action.onClick}">${options.action.label}</button>` : ''}
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;
  
  // Añadir al contenedor
  const container = document.getElementById('toast-container');
  container.appendChild(toast);
  
  // Animación de entrada
  setTimeout(() => toast.classList.remove('toast-enter'), 10);
  
  // Auto-remove después de duration (si no es persistente)
  if (!options.persistent) {
    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
  
  // Trackear toast
  if (window.trackAction) {
    window.trackAction('toast_shown', { type, message: message.substring(0, 50) });
  }
  
  return toast;
};

// ═══════════════════════════════════════════════════════════════
// SHORTCUTS CONVENIENTES
// ═══════════════════════════════════════════════════════════════

window.toastSuccess = (message, options) => showToast(message, 'success', 3000, options);
window.toastError = (message, options) => showToast(message, 'error', 4000, options);
window.toastWarning = (message, options) => showToast(message, 'warning', 3500, options);
window.toastInfo = (message, options) => showToast(message, 'info', 3000, options);

// ═══════════════════════════════════════════════════════════════
// TOAST DE CARGA (para operaciones async)
// ═══════════════════════════════════════════════════════════════

/**
 * Toast de loading que se puede actualizar
 * @param {string} message - Mensaje inicial
 * @returns {object} - Objeto con métodos update() y success()
 */
window.toastLoading = function(message) {
  const toast = showToast(message, 'info', 0, {
    icon: '⏳',
    persistent: true
  });
  
  return {
    update: (newMessage) => {
      const messageEl = toast.querySelector('.toast-message');
      if (messageEl) messageEl.textContent = newMessage;
    },
    success: (successMessage) => {
      toast.classList.remove('toast-info');
      toast.classList.add('toast-success');
      const iconEl = toast.querySelector('.toast-icon');
      const messageEl = toast.querySelector('.toast-message');
      if (iconEl) iconEl.textContent = '✅';
      if (messageEl) messageEl.textContent = successMessage;
      setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
      }, 2000);
    },
    error: (errorMessage) => {
      toast.classList.remove('toast-info');
      toast.classList.add('toast-error');
      const iconEl = toast.querySelector('.toast-icon');
      const messageEl = toast.querySelector('.toast-message');
      if (iconEl) iconEl.textContent = '❌';
      if (messageEl) messageEl.textContent = errorMessage;
      setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    },
    remove: () => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }
  };
};

// ═══════════════════════════════════════════════════════════════
// TOAST PROMISE (para async/await)
// ═══════════════════════════════════════════════════════════════

/**
 * Toast que se actualiza basado en una Promise
 * @param {Promise} promise - Promise a ejecutar
 * @param {object} messages - { loading, success, error }
 */
window.toastPromise = async function(promise, messages) {
  const loading = toastLoading(messages.loading || 'Procesando...');
  
  try {
    const result = await promise;
    loading.success(messages.success || '¡Completado!');
    return result;
  } catch (error) {
    loading.error(messages.error || 'Error: ' + error.message);
    throw error;
  }
};

// ═══════════════════════════════════════════════════════════════
// LIMPIAR TODOS LOS TOASTS
// ═══════════════════════════════════════════════════════════════

window.clearToasts = function() {
  const container = document.getElementById('toast-container');
  if (container) {
    const toasts = container.querySelectorAll('.toast');
    toasts.forEach(toast => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// ESTILOS INLINE (se inyectan automáticamente)
// ═══════════════════════════════════════════════════════════════

const toastStyles = `
  <style id="toast-styles">
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      max-width: 400px;
      pointer-events: none;
    }
    
    .toast {
      background: rgba(26, 35, 50, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      pointer-events: all;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      min-width: 300px;
    }
    
    .toast-enter {
      opacity: 0;
      transform: translateX(100px);
    }
    
    .toast-exit {
      opacity: 0;
      transform: translateX(100px);
    }
    
    .toast-icon {
      font-size: 24px;
      flex-shrink: 0;
    }
    
    .toast-content {
      flex: 1;
      min-width: 0;
    }
    
    .toast-title {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 4px;
      color: #fff;
    }
    
    .toast-message {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.9);
      line-height: 1.4;
    }
    
    .toast-action {
      background: rgba(251, 191, 36, 0.2);
      border: 1px solid #fbbf24;
      color: #fbbf24;
      padding: 6px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    
    .toast-action:hover {
      background: rgba(251, 191, 36, 0.3);
      transform: translateY(-1px);
    }
    
    .toast-close {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.6);
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }
    
    .toast-close:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    
    /* Tipos de toast */
    .toast-success {
      border-left: 4px solid #10b981;
    }
    
    .toast-error {
      border-left: 4px solid #ef4444;
    }
    
    .toast-warning {
      border-left: 4px solid #f59e0b;
    }
    
    .toast-info {
      border-left: 4px solid #3b82f6;
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      .toast-container {
        top: auto;
        bottom: 20px;
        right: 16px;
        left: 16px;
        max-width: none;
      }
      
      .toast {
        min-width: 0;
      }
      
      .toast-enter, .toast-exit {
        transform: translateY(100px);
      }
    }
  </style>
`;

// Inyectar estilos si no existen
if (!document.getElementById('toast-styles')) {
  document.head.insertAdjacentHTML('beforeend', toastStyles);
}

console.log('✅ Toast System listo');
