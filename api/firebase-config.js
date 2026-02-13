// api/firebase-config.js — Endpoint seguro para Firebase config
// Sirve la configuración desde variables de entorno

export default async function handler(req, res) {
  // Solo GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validar que tenemos las variables de entorno
  const config = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
  };

  // Verificar que todas las variables existen
  const missing = Object.entries(config)
    .filter(([key, val]) => !val)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.error('Missing Firebase env vars:', missing);
    return res.status(500).json({ 
      error: 'Server misconfigured',
      missing 
    });
  }

  // Cache por 1 hora (config no cambia frecuentemente)
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res.setHeader('Content-Type', 'application/json');

  // CORS para tu dominio
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://nio-sports-pro.vercel.app',
    'https://josegarcia1003.github.io'
  ];
  
  if (origin && allowedOrigins.some(allowed => origin.includes(allowed))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  return res.status(200).json(config);
}
