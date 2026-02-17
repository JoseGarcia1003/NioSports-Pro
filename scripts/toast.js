// scripts/toast.js — NioSports Pro Toast System (sin alerts feos)
// ───────────────────────────────────────────────────────────────
// ✔ UI profesional (no bloquea, no requiere "Aceptar")
// ✔ Seguro: sin onclick inline, sin inyección de <style> (CSP-friendly)
// ✔ Accesible: aria-live + role
// ───────────────────────────────────────────────────────────────

(() => {
  'use strict';

  const CONTAINER_ID = 'toast-container';

  function ensureContainer() {
    let el = document.getElementById(CONTAINER_ID);
    if (el) return el;

    el = document.createElement('div');
    el.id = CONTAINER_ID;
    el.className = 'toast-container';
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-relevant', 'additions text');
    document.body.appendChild(el);
    return el;
  }

  function normalizeType(type) {
    const t = String(type || 'info').toLowerCase();
    if (t === 'success' || t === 'error' || t === 'warning' || t === 'info') return t;
    return 'info';
  }

  const DEFAULT_ICONS = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  function removeToast(toast) {
    if (!toast || toast.dataset.removing === '1') return;
    toast.dataset.removing = '1';
    toast.classList.add('toast-exit');
    const ms = Number(toast.dataset.exitMs || '260');
    window.setTimeout(() => toast.remove(), ms);
  }

  /**
   * showToast(message, type, duration, options)
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {number} duration ms (0 = persistente)
   * @param {{ title?: string, icon?: string, persistent?: boolean, action?: { label: string, onClick: Function } }} options
   */
  function showToast(message, type = 'info', duration = 3200, options = {}) {
    const t = normalizeType(type);
    const container = ensureContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${t} toast-enter`;
    toast.setAttribute('role', t === 'error' ? 'alert' : 'status');

    // Icon
    const icon = document.createElement('div');
    icon.className = 'toast-icon';
    icon.textContent = options.icon || DEFAULT_ICONS[t] || DEFAULT_ICONS.info;

    // Content
    const content = document.createElement('div');
    content.className = 'toast-content';

    if (options.title) {
      const title = document.createElement('div');
      title.className = 'toast-title';
      title.textContent = String(options.title);
      content.appendChild(title);
    }

    const msg = document.createElement('div');
    msg.className = 'toast-message';
    msg.textContent = String(message);
    content.appendChild(msg);

    // Actions
    let actionBtn = null;
    if (options.action && typeof options.action.onClick === 'function') {
      actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = 'toast-action';
      actionBtn.textContent = String(options.action.label || 'Acción');
      actionBtn.addEventListener('click', (e) => {
        e.preventDefault();
        try { options.action.onClick(); } finally { removeToast(toast); }
      });
    }

    // Close
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-close';
    close.setAttribute('aria-label', 'Cerrar notificación');
    close.textContent = '×';
    close.addEventListener('click', () => removeToast(toast));

    toast.appendChild(icon);
    toast.appendChild(content);
    if (actionBtn) toast.appendChild(actionBtn);
    toast.appendChild(close);

    // Mount
    container.appendChild(toast);

    // Start enter animation
    requestAnimationFrame(() => toast.classList.remove('toast-enter'));

    // Auto-dismiss
    const persistent = Boolean(options.persistent) || duration === 0;
    if (!persistent) {
      window.setTimeout(() => removeToast(toast), Math.max(800, Number(duration) || 3200));
    }

    // Telemetry hook (si existe)
    try {
      if (window.trackAction) {
        window.trackAction('toast_shown', { type: t, message: String(message).slice(0, 80) });
      }
    } catch (_) {}

    return {
      element: toast,
      update(newMessage) {
        msg.textContent = String(newMessage);
      },
      success(successMessage) {
        toast.classList.remove('toast-info', 'toast-warning', 'toast-error');
        toast.classList.add('toast-success');
        icon.textContent = DEFAULT_ICONS.success;
        msg.textContent = String(successMessage || '¡Listo!');
        window.setTimeout(() => removeToast(toast), 1800);
      },
      error(errorMessage) {
        toast.classList.remove('toast-info', 'toast-warning', 'toast-success');
        toast.classList.add('toast-error');
        icon.textContent = DEFAULT_ICONS.error;
        msg.textContent = String(errorMessage || 'Ocurrió un error');
        window.setTimeout(() => removeToast(toast), 2600);
      },
      remove() {
        removeToast(toast);
      }
    };
  }

  // Expose API
  window.showToast = showToast;
  window.toastSuccess = (m, opts) => showToast(m, 'success', 3200, opts || {});
  window.toastError = (m, opts) => showToast(m, 'error', 4200, opts || {});
  window.toastWarning = (m, opts) => showToast(m, 'warning', 3800, opts || {});
  window.toastInfo = (m, opts) => showToast(m, 'info', 3200, opts || {});

  window.toastLoading = (message, opts = {}) => {
    return showToast(message || 'Procesando...', 'info', 0, { ...opts, icon: '⏳', persistent: true });
  };

  window.toastPromise = async (promise, messages = {}) => {
    const t = window.toastLoading(messages.loading || 'Procesando...');
    try {
      const res = await promise;
      t.success(messages.success || '¡Completado!');
      return res;
    } catch (err) {
      t.error(messages.error || (err?.message ? `Error: ${err.message}` : 'Error'));
      throw err;
    }
  };

  window.clearToasts = () => {
    const c = document.getElementById(CONTAINER_ID);
    if (!c) return;
    [...c.querySelectorAll('.toast')].forEach((t) => removeToast(t));
  };

  console.log('✅ Toast System listo');
})();
