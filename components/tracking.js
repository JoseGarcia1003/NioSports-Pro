// components/tracking.js — Stub funcional (evita 404 y errores)
// Reemplaza este archivo con tu módulo real cuando esté listo.

window.initTracking = async function(container){
  try {
    if (!container) return;
    container.innerHTML = `
      <div class="p-6 rounded-2xl bg-slate-900/60 border border-yellow-500/20">
        <h2 class="text-2xl font-bold text-yellow-300">Tracking</h2>
        <p class="mt-2 text-slate-200">Módulo en carga / mantenimiento.</p>
        <p class="mt-1 text-slate-400 text-sm">Archivo encontrado correctamente (no más 404).</p>
      </div>
    `;
  } catch (e) {
    console.warn('[tracking] init falló:', e?.message || e);
  }
};
