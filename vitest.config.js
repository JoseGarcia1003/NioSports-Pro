export default {
  build: {
    sourcemap: true, // ← Añadir esto
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/database'],
          'vendor': ['chart.js']
        }
      }
    }
  }
}
