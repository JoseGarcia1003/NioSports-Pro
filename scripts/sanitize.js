// scripts/sanitize.js
// Capa de sanitización centralizada — NioSports Pro
// ════════════════════════════════════════════════════════════════
// PROPÓSITO: Prevenir ataques XSS en todos los lugares donde datos
// de usuario o de fuentes externas se interpolan en innerHTML.
//
// USO en cualquier módulo:
//   window.nsSafe(str)          → sanitiza HTML, devuelve texto plano
//   window.nsSafeHtml(str)      → sanitiza HTML pero preserva tags seguros
//   window.nsSafeNumber(val)    → convierte a número seguro o devuelve ''
//
// REGLA: toda variable que venga de Firebase, del usuario, o de una
// API externa y que vaya dentro de un template literal con innerHTML
// DEBE pasar por nsSafe() o nsSafeNumber() antes de interpolarse.
// ════════════════════════════════════════════════════════════════

(function initSanitize() {

  // ── Verificar que DOMPurify cargó correctamente ──────────────────
  // DOMPurify se carga vía CDN antes de este script.
  // Si no está disponible (fallo de red), usamos un fallback básico
  // que escapa los caracteres HTML más peligrosos.
  const hasDOMPurify = typeof DOMPurify !== 'undefined';

  if (!hasDOMPurify) {
    console.warn('[Sanitize] DOMPurify no disponible — usando fallback de escape básico');
  } else {
    console.log('[Sanitize] ✅ DOMPurify cargado correctamente');
  }

  // ── Fallback manual si DOMPurify no cargó ───────────────────────
  // Escapa los 5 caracteres que permiten inyección HTML/JS.
  // No es tan robusto como DOMPurify pero previene los ataques más comunes.
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  // ════════════════════════════════════════════════════════════════
  // window.nsSafe(str)
  // ════════════════════════════════════════════════════════════════
  // Uso principal: sanitizar strings de usuario que van en innerHTML.
  // Elimina TODOS los tags HTML — devuelve texto plano puro.
  // Ideal para: nombres de equipos ingresados por usuario, notas,
  // etiquetas, cualquier texto libre que no debe contener HTML.
  // ════════════════════════════════════════════════════════════════
  window.nsSafe = function(str) {
    if (str === null || str === undefined) return '';
    const s = String(str);
    if (!s.trim()) return '';

    if (hasDOMPurify) {
      // ALLOWED_TAGS: [] significa "sin tags HTML permitidos"
      // el texto se devuelve con los caracteres especiales escapados
      return DOMPurify.sanitize(s, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    }
    return escapeHtml(s);
  };

  // ════════════════════════════════════════════════════════════════
  // window.nsSafeHtml(str)
  // ════════════════════════════════════════════════════════════════
  // Para casos donde el contenido SÍ puede tener formato básico
  // (negritas, cursivas) pero NO debe tener scripts ni iframes.
  // Usar con cuidado — solo para contenido que genuinamente
  // necesita renderizar HTML (como descripciones de picks formateadas).
  // ════════════════════════════════════════════════════════════════
  window.nsSafeHtml = function(str) {
    if (str === null || str === undefined) return '';
    const s = String(str);
    if (!s.trim()) return '';

    if (hasDOMPurify) {
      return DOMPurify.sanitize(s, {
        ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'span', 'br'],
        ALLOWED_ATTR: ['class']
      });
    }
    return escapeHtml(s);
  };

  // ════════════════════════════════════════════════════════════════
  // window.nsSafeNumber(val, fallback)
  // ════════════════════════════════════════════════════════════════
  // Para campos numéricos (líneas de apuesta, odds, EV).
  // Si el valor no es un número válido, devuelve el fallback.
  // Previene que un string malicioso como "1.5<script>" sea
  // interpolado en el HTML incluso en campos numéricos.
  // ════════════════════════════════════════════════════════════════
  window.nsSafeNumber = function(val, fallback = '') {
    if (val === null || val === undefined || val === '') return fallback;
    const n = parseFloat(val);
    return isNaN(n) ? fallback : n;
  };

  // ════════════════════════════════════════════════════════════════
  // window.nsSafeId(str)
  // ════════════════════════════════════════════════════════════════
  // Para IDs de Firebase que se usan en atributos onclick como:
  //   onclick="deletePick('${pick.id}')"
  // Un ID malicioso podría inyectar JS dentro del atributo onclick.
  // Este helper permite solo caracteres alfanuméricos y guiones.
  // ════════════════════════════════════════════════════════════════
  window.nsSafeId = function(str) {
    if (str === null || str === undefined) return '';
    // Solo permite letras, números, guiones y guiones bajos
    return String(str).replace(/[^a-zA-Z0-9\-_]/g, '');
  };

  console.log('✅ Sanitize helpers cargados — nsSafe, nsSafeHtml, nsSafeNumber, nsSafeId');
})();
