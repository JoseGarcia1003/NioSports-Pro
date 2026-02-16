// scripts/lazy-loader.js - Lazy Loading System
// ═══════════════════════════════════════════════════════════════
// CARGA DIFERIDA DE COMPONENTES PESADOS
// ═══════════════════════════════════════════════════════════════

console.log('🚀 Lazy Loader inicializando...');

// ═══════════════════════════════════════════════════════════════
// INTERSECTION OBSERVER (Lazy load cuando sea visible)
// ═══════════════════════════════════════════════════════════════

const lazyObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const element = entry.target;
      const componentName = element.dataset.lazyComponent;
      
      if (componentName && !element.dataset.loaded) {
        loadComponent(componentName, element);
        lazyObserver.unobserve(element);
      }
    }
  });
}, {
  root: null,
  rootMargin: '50px', // Cargar 50px antes de que sea visible
  threshold: 0.01
});

// ═══════════════════════════════════════════════════════════════
// COMPONENTES LAZY-LOADABLES
// ═══════════════════════════════════════════════════════════════

const LAZY_COMPONENTS = {
  'picks-ia': {
    script: '/components/picks-ia.js',
    styles: '/components/picks-ia.css',
    skeleton: 'picks-skeleton'
  },
  'database': {
    script: '/components/database.js',
    styles: '/components/database.css',
    skeleton: 'database-skeleton'
  },
  'tracking': {
    script: '/components/tracking.js',
    styles: '/components/tracking.css',
    skeleton: 'tracking-skeleton'
  },
  'totals': {
    script: '/components/totals.js',
    styles: '/components/totals.css',
    skeleton: 'totals-skeleton'
  },
  'props': {
    script: '/components/props.js',
    styles: '/components/props.css',
    skeleton: 'props-skeleton'
  }
};

// ═══════════════════════════════════════════════════════════════
// CARGAR COMPONENTE DINÁMICAMENTE
// ═══════════════════════════════════════════════════════════════

async function loadComponent(componentName, element) {
  const config = LAZY_COMPONENTS[componentName];
  
  if (!config) {
    console.error('[LazyLoader] Componente no encontrado:', componentName);
    return;
  }
  
  console.log('[LazyLoader] Cargando componente:', componentName);
  element.dataset.loading = 'true';
  
  try {
    // Paso 1: Cargar estilos (no bloqueante)
    if (config.styles) {
      loadStyles(config.styles);
    }
    
    // Paso 2: Cargar script
    if (config.script) {
      await loadScript(config.script);
    }
    
    // Paso 3: Inicializar componente si tiene función init
    const initFunctionName = `init${capitalize(componentName)}`;
    if (typeof window[initFunctionName] === 'function') {
      await window[initFunctionName](element);
    }
    
    // Paso 4: Marcar como cargado
    element.dataset.loaded = 'true';
    element.dataset.loading = 'false';
    
    // Paso 5: Ocultar skeleton
    const skeleton = element.querySelector(`.${config.skeleton}`);
    if (skeleton) {
      skeleton.style.opacity = '0';
      setTimeout(() => skeleton.remove(), 300);
    }
    
    console.log('[LazyLoader] ✅ Componente cargado:', componentName);
    
    // Trackear carga
    if (window.trackAction) {
      window.trackAction('component_loaded', { component: componentName });
    }
    
  } catch (error) {
    console.error('[LazyLoader] Error cargando componente:', componentName, error);
    element.dataset.loading = 'false';
    element.dataset.error = 'true';
    
    // Mostrar error al usuario
    element.innerHTML = `
      <div class="component-error">
        <p>⚠️ Error cargando ${componentName}</p>
        <button onclick="retryLoadComponent('${componentName}', this.parentElement.parentElement)">
          Reintentar
        </button>
      </div>
    `;
    
    if (window.trackError) {
      window.trackError(error, { component: componentName });
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// CARGAR SCRIPT DINÁMICAMENTE
// ═══════════════════════════════════════════════════════════════

function loadScript(src) {
  return new Promise((resolve, reject) => {
    // Verificar si ya está cargado
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    
    script.onload = () => {
      console.log('[LazyLoader] Script cargado:', src);
      resolve();
    };
    
    script.onerror = () => {
      reject(new Error(`Failed to load script: ${src}`));
    };
    
    document.head.appendChild(script);
  });
}

// ═══════════════════════════════════════════════════════════════
// CARGAR ESTILOS DINÁMICAMENTE
// ═══════════════════════════════════════════════════════════════

function loadStyles(href) {
  // Verificar si ya está cargado
  const existing = document.querySelector(`link[href="${href}"]`);
  if (existing) return;
  
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  
  link.onload = () => {
    console.log('[LazyLoader] Estilos cargados:', href);
  };
  
  link.onerror = () => {
    console.error('[LazyLoader] Error cargando estilos:', href);
  };
  
  document.head.appendChild(link);
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

// ═══════════════════════════════════════════════════════════════
// RETRY LOAD (llamado desde botón de error)
// ═══════════════════════════════════════════════════════════════

window.retryLoadComponent = function(componentName, element) {
  element.dataset.error = 'false';
  element.innerHTML = '<div class="loading">Cargando...</div>';
  loadComponent(componentName, element);
};

// ═══════════════════════════════════════════════════════════════
// AUTO-DETECTAR LAZY COMPONENTS EN DOM
// ═══════════════════════════════════════════════════════════════

function initLazyComponents() {
  const lazyElements = document.querySelectorAll('[data-lazy-component]');
  
  console.log('[LazyLoader] Detectados', lazyElements.length, 'componentes lazy');
  
  lazyElements.forEach((element) => {
    lazyObserver.observe(element);
  });
}

// ═══════════════════════════════════════════════════════════════
// PREFETCH DE COMPONENTES (cuando hay idle time)
// ═══════════════════════════════════════════════════════════════

function prefetchComponents() {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      // Prefetch componentes críticos
      const criticalComponents = ['picks-ia', 'tracking'];
      
      criticalComponents.forEach((componentName) => {
        const config = LAZY_COMPONENTS[componentName];
        if (config && config.script) {
          const link = document.createElement('link');
          link.rel = 'prefetch';
          link.href = config.script;
          document.head.appendChild(link);
          
          console.log('[LazyLoader] Prefetching:', componentName);
        }
      });
    }, { timeout: 2000 });
  }
}

// ═══════════════════════════════════════════════════════════════
// INIT AL CARGAR
// ═══════════════════════════════════════════════════════════════

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initLazyComponents();
    prefetchComponents();
  });
} else {
  initLazyComponents();
  prefetchComponents();
}

// Exponer globalmente para uso manual
window.loadComponent = loadComponent;
window.lazyObserver = lazyObserver;

console.log('✅ Lazy Loader listo');
