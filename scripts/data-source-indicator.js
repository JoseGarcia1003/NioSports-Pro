// scripts/data-source-indicator.js
// Indicador visual de fuente de datos activa — NioSports Pro
// ════════════════════════════════════════════════════════════════
// Escucha el evento ns:data-source-changed que emite picks-engine.js
// y muestra/oculta un banner de advertencia cuando el sistema usa
// datos de estimación en lugar de datos reales de la API.
//
// DISEÑO: el banner aparece fijo debajo del navbar para que el usuario
// siempre sepa en qué modo está operando el motor de picks.
// ════════════════════════════════════════════════════════════════

(function initDataSourceIndicator() {

  // ── Mensajes por tipo de fuente ──────────────────────────────────
  const MESSAGES = {
    'demo-stats': {
      icon: '⚠️',
      title: 'Estadísticas de estimación activas',
      body: 'El archivo de estadísticas NBA no está disponible. Los picks se basan en promedios históricos, no en datos de la temporada actual.',
      level: 'warning'
    },
    'demo-games': {
      icon: '📋',
      title: 'Sin partidos reales hoy',
      body: 'La API no devolvió partidos para hoy. Se muestran análisis basados en matchups de ejemplo. Los picks NO reflejan la programación real del día.',
      level: 'warning'
    },
    'real-stats': {
      icon: '✅',
      title: 'Estadísticas reales activas',
      body: 'Cargadas estadísticas de la temporada actual.',
      level: 'success'
    },
    'real-games': {
      icon: '🏀',
      title: 'Partidos reales de hoy cargados',
      body: 'Datos en tiempo real activos.',
      level: 'success'
    }
  };

  // ── Crear el elemento del banner en el DOM ───────────────────────
  function createBanner() {
    if (document.getElementById('ns-demo-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'ns-demo-banner';
    banner.setAttribute('role', 'alert');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-atomic', 'true');

    // Aplicamos estilos directamente para no depender de un CSS externo
    Object.assign(banner.style, {
      position: 'fixed',
      top: '64px',           // Justo debajo del navbar (que tiene ~64px de alto)
      left: '0',
      right: '0',
      zIndex: '9990',
      display: 'none',       // Oculto por defecto
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      padding: '10px 20px',
      fontSize: '13px',
      fontFamily: 'inherit',
      lineHeight: '1.4',
      transition: 'all 0.3s ease',
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
    });

    banner.innerHTML = `
      <div id="ns-demo-banner-content" style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
        <span id="ns-demo-banner-icon" style="font-size:16px;flex-shrink:0;">⚠️</span>
        <div style="min-width:0;">
          <strong id="ns-demo-banner-title" style="display:block;margin-bottom:2px;"></strong>
          <span id="ns-demo-banner-body" style="opacity:0.9;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></span>
        </div>
      </div>
      <button id="ns-demo-banner-close"
        onclick="document.getElementById('ns-demo-banner').style.display='none'"
        style="flex-shrink:0;background:none;border:none;cursor:pointer;opacity:0.7;font-size:18px;padding:0 4px;color:inherit;"
        title="Cerrar aviso" aria-label="Cerrar aviso">×</button>
    `;

    // Insertar después del body start, antes del nav
    document.body.insertBefore(banner, document.body.firstChild);
  }

  // ── Mostrar el banner con el mensaje apropiado ───────────────────
  function showBanner(type) {
    const banner = document.getElementById('ns-demo-banner');
    if (!banner) return;

    const config = MESSAGES[type];
    if (!config) return;

    // Colores según el nivel del mensaje
    const isWarning = config.level === 'warning';
    const bgColor   = isWarning ? 'rgba(180, 83, 9, 0.95)'  : 'rgba(6, 78, 59, 0.90)';
    const border    = isWarning ? '1px solid rgba(251,191,36,0.6)' : '1px solid rgba(52,211,153,0.4)';
    const textColor = '#ffffff';

    Object.assign(banner.style, {
      background: bgColor,
      borderBottom: border,
      color: textColor,
      display: 'flex'
    });

    document.getElementById('ns-demo-banner-icon').textContent  = config.icon;
    document.getElementById('ns-demo-banner-title').textContent = config.title;
    document.getElementById('ns-demo-banner-body').textContent  = config.body;

    // Auto-ocultar mensajes de éxito después de 4 segundos
    if (!isWarning) {
      setTimeout(() => {
        if (banner) banner.style.display = 'none';
      }, 4000);
    }
  }

  // ── Escuchar el evento del motor de picks ────────────────────────
  // Este evento es emitido por picks-engine.js cada vez que cambia
  // la fuente de datos (real → demo o demo → real).
  window.addEventListener('ns:data-source-changed', function(e) {
    const { type, anyDemoActive } = e.detail || {};

    if (!type) return;

    // Si hay cualquier fuente demo activa, mostrar la advertencia más grave
    // (demo-stats > demo-games en severidad porque afecta más al modelo)
    const displayType = anyDemoActive
      ? (e.detail.usingDemoStats ? 'demo-stats' : 'demo-games')
      : type;

    showBanner(displayType);
  });

  // ── Inicializar el banner cuando el DOM esté listo ───────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createBanner);
  } else {
    createBanner();
  }

  // ── API pública: mostrar/ocultar manualmente desde cualquier módulo
  window.nsDataIndicator = {
    show: showBanner,
    hide: function() {
      const b = document.getElementById('ns-demo-banner');
      if (b) b.style.display = 'none';
    },
    isVisible: function() {
      const b = document.getElementById('ns-demo-banner');
      return b ? b.style.display !== 'none' : false;
    }
  };

  console.log('✅ Data Source Indicator cargado');
})();
