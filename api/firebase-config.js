// api/firebase-config.js
export default function handler(req, res) {
  // Solo permitir desde tu dominio
  const origin = req.headers.origin;
  const allowed = [
    'https://josegarcia1003.github.io',
    'https://nio-sports-pro.vercel.app',
    'http://localhost:5173', // Para desarrollo
  ];
  
  if (allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json');
  
  // Devolver config desde variables de entorno
  res.status(200).json({
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    databaseURL: process.env.FIREBASE_DATABASE_URL || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || ''
  });
}
