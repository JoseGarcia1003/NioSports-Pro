// api/proxy.js — Deploy to Vercel to hide API key
// Usage: /api/proxy?endpoint=/players?search=LeBron

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'https://josegarcia1003.github.io');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Max-Age', '3600');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { endpoint } = req.query;
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint parameter' });

    // Validate endpoint to prevent abuse
    const allowed = ['/players', '/season_averages', '/stats', '/games'];
    if (!allowed.some(a => endpoint.startsWith(a))) {
        return res.status(403).json({ error: 'Endpoint not allowed' });
    }

    // Rate limiting (simple in-memory — resets on cold start)
    const ip = req.headers['x-forwarded-for'] || 'unknown';
    if (!global._rateLimit) global._rateLimit = {};
    const now = Date.now();
    const window = 60000; // 1 minute
    if (!global._rateLimit[ip]) global._rateLimit[ip] = [];
    global._rateLimit[ip] = global._rateLimit[ip].filter(t => now - t < window);
    if (global._rateLimit[ip].length >= 30) {
        return res.status(429).json({ error: 'Rate limit exceeded. Try again in 1 minute.' });
    }
    global._rateLimit[ip].push(now);

    try {
        const response = await fetch(`https://api.balldontlie.io/v1${endpoint}`, {
            headers: { 'Authorization': process.env.BALLDONTLIE_API_KEY }
        });
        const data = await response.json();
        
        // Cache for 5 minutes
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
        return res.status(response.status).json(data);
    } catch (error) {
        return res.status(502).json({ error: 'Upstream API error' });
    }
}
