import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    {
      name: 'gemini-proxy',
      configureServer(server) {
        server.middlewares.use('/api/gemini', async (req, res) => {
          // Only allow POST
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: 'Method Not Allowed' }));
            return;
          }

          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', async () => {
            try {
              const { prompt, model = 'gemini-2.5-flash', imageBase64 } = JSON.parse(body);
              if (!prompt) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Missing prompt' }));
                return;
              }

              const API_KEY = process.env.GEMINI_API_KEY;
              if (!API_KEY) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'GEMINI_API_KEY not set. Run: export GEMINI_API_KEY=your_key_here' }));
                return;
              }

              const parts = [{ text: prompt }];
              if (imageBase64) {
                parts.push({ inline_data: { mime_type: 'image/jpeg', data: imageBase64 } });
              }

              const geminiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${API_KEY}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ contents: [{ parts }] }),
                }
              );

              const data = await geminiRes.json();
              const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ text }));
            } catch (err) {
              console.error('[dev-proxy] Gemini error:', err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Internal server error' }));
            }
          });
        });
      },
    },
  ],
});
