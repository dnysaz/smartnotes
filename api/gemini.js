/**
 * Vercel Serverless Function — Gemini API Proxy
 * ─────────────────────────────────────────────
 * This runs on Vercel's servers, NOT in the browser.
 * GEMINI_API_KEY (without VITE_ prefix) is stored securely
 * in Vercel Environment Variables and never exposed to clients.
 *
 * Endpoint: POST /api/gemini
 * Body: { prompt: string, model?: string }
 */

export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // CORS — allow your Vercel domain + localhost for development
    const allowedOrigins = [
        'http://localhost:5174',
        'http://localhost:5173',
        'http://127.0.0.1:5174',
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
        process.env.ALLOWED_ORIGIN || null,
    ].filter(Boolean);

    const origin = req.headers.origin || '';
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { prompt, model = 'gemini-1.5-flash' } = req.body || {};

    if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt in request body.' });
    }

    // API key is SAFE here — server-side only, never reaches the browser
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
        console.error('[/api/gemini] GEMINI_API_KEY is not set in Vercel env vars.');
        return res.status(500).json({ error: 'Server configuration error.' });
    }

    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

    // Build parts: always include text, optionally include image
    const parts = [{ text: prompt }];
    if (req.body.imageBase64) {
        parts.push({ inline_data: { mime_type: 'image/jpeg', data: req.body.imageBase64 } });
    }

    try {
        const geminiRes = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts }]
            }),
        });

        if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            console.error('[/api/gemini] Gemini API error:', errText);
            return res.status(geminiRes.status).json({ error: 'Gemini API error.' });
        }

        const data = await geminiRes.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return res.status(200).json({ text });

    } catch (err) {
        console.error('[/api/gemini] Network error:', err);
        return res.status(500).json({ error: 'Failed to reach Gemini API.' });
    }
}
