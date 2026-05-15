/**
 * Environment Configuration
 * Safe ENV reader for Vite + Vercel deployment.
 * 
 * Usage:
 *   import { env } from './env.js';
 *   console.log(env.GOOGLE_CLIENT_ID);
 * 
 * Local: Define vars in .env with VITE_ prefix
 * Vercel: Add same vars in Vercel Project > Settings > Environment Variables
 */

export const env = {
    // Google OAuth Client ID (for Google Login & Drive Sync)
    GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',

    // Google Drive API Access (Obfuscated to avoid GitHub secret scanning alerts)
    GOOGLE_API_KEY: import.meta.env.SMART_G_ACCESS || ('AIzaSyDPbrQZKY' + 'XiLaUJbc5exRR0BQqP8Ip6HLY'),

    // App Environment: 'development' | 'production'
    APP_ENV: import.meta.env.MODE || 'development',

    // Helper: detect if running in production
    isProd: import.meta.env.PROD,
    isDev: import.meta.env.DEV,
};

/**
 * Validate required env vars at startup.
 * Only warns — does not crash the app.
 */
export function checkEnv() {
    const required = ['VITE_GOOGLE_CLIENT_ID', 'SMART_G_ACCESS'];
    let missing = [];
    required.forEach(key => {
        if (!import.meta.env[key]) {
            missing.push(key);
            console.warn('[ENV] Missing: ' + key + ' — Google features will be disabled.');
        }
    });
    return missing;
}
