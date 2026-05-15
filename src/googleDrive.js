import { env } from './env.js';

let tokenClient;
let gapiInited = false;
let gisInited = false;
let lastRefreshAttempt = 0;

// --- Sync queue & debounce ---
let syncTimer = null;
let syncInProgress = false;
let pendingSyncPayloads = {}; // keyed by filename

const SYNC_DEBOUNCE_MS = 1500; // Wait 1.5s after last edit before syncing

// Track if we have a working token session
let _tokenReady = false;
export function isTokenReady() { return _tokenReady; }

// File names for separate storage on Drive
export const DRIVE_FILES = {
    notes: 'smart_note_notes.json',
    todos: 'smart_note_todos.json',
    financial: 'smart_note_financial.json',
    financialData: 'smart_note_financial_data.json',
    trash: 'smart_note_trash.json',
};

export async function initDriveSync() {
    return new Promise((resolve) => {
        gapi.load('client', async () => {
            await gapi.client.init({
                apiKey: env.GOOGLE_API_KEY || undefined,
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            });
            gapiInited = true;
            checkAllInited(resolve);
        });

        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: env.GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/drive.file email',
            callback: '',
        });
        gisInited = true;
        checkAllInited(resolve);
    });
}

function checkAllInited(resolve) {
    if (gapiInited && gisInited) resolve(true);
}

async function getOrCreateAppFolder() {
    const folderName = 'smart-todo';
    const response = await gapi.client.drive.files.list({
        q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
    });
    const folders = response.result.files;
    if (folders.length > 0) return folders[0].id;

    const createResponse = await gapi.client.drive.files.create({
        resource: { name: folderName, mimeType: 'application/vnd.google-apps.folder' },
        fields: 'id',
    });
    return createResponse.result.id;
}

// ─── Auth ──────────────────────────────────────────────────────────────

/** Save token to localStorage to survive page reloads */
function cacheTokenLocally(token) {
    if (!token) {
        localStorage.removeItem('gapi_token');
        return;
    }
    localStorage.setItem('gapi_token', JSON.stringify(token));
}

/** Check if we have a valid (non-expired) token */
function hasValidToken() {
    try {
        let t = gapi.client.getToken();
        
        // If not in memory, try to restore from localStorage
        if (!t) {
            const cached = localStorage.getItem('gapi_token');
            if (cached) {
                t = JSON.parse(cached);
                gapi.client.setToken(t);
            }
        }

        if (!t || !t.access_token) return false;
        
        // If expires_at is set, check it; otherwise assume valid
        if (t.expires_at) {
            const isValid = t.expires_at - Date.now() > 60000; // >1min left
            if (!isValid) localStorage.removeItem('gapi_token');
            return isValid;
        }
        return true;
    } catch (e) {
        return false;
    }
}

/** User-initiated login — uses consent popup. Call ONLY from explicit user action. */
export function authenticateGoogle() {
    return new Promise((resolve, reject) => {
        tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) { reject(resp); return; }
            
            // Calculate exact expiry time
            if (resp.expires_in) {
                resp.expires_at = Date.now() + (resp.expires_in * 1000);
            }
            
            gapi.client.setToken(resp);
            cacheTokenLocally(resp); // Cache it!
            
            _tokenReady = true;
            lastRefreshAttempt = 0; // Reset cooldown on successful login
            console.log('[Drive] Token acquired via login');
            resolve(resp);
        };
        tokenClient.requestAccessToken({ prompt: 'consent' });
    });
}

/**
 * Silent refresh (prompt='' → iframe). Never shows popup.
 * Returns true if token is now valid, false if not.
 */
export function trySilentRefresh() {
    // If token is still fresh, skip
    if (hasValidToken()) {
        _tokenReady = true;
        return Promise.resolve(true);
    }

    // Cooldown: don't retry for 30 seconds after last attempt
    if (Date.now() - lastRefreshAttempt < 30000) return Promise.resolve(false);
    lastRefreshAttempt = Date.now();

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.warn('[Drive] Silent refresh timed out (Browser might block third-party cookies)');
            resolve(false);
        }, 8000); // 8s max wait

        tokenClient.callback = (resp) => {
            clearTimeout(timeout);
            if (resp.error) {
                console.warn('[Drive] Silent refresh error:', resp.error);
                _tokenReady = false;
                cacheTokenLocally(null);
                resolve(false);
                return;
            }
            
            if (resp.expires_in) {
                resp.expires_at = Date.now() + (resp.expires_in * 1000);
            }
            
            gapi.client.setToken(resp);
            cacheTokenLocally(resp); // Cache it!
            
            _tokenReady = true;
            console.log('[Drive] Silent refresh success — token valid');
            resolve(true);
        };
        try {
            tokenClient.requestAccessToken({ prompt: '' });
        } catch (e) {
            clearTimeout(timeout);
            console.warn('[Drive] Silent refresh exception:', e);
            resolve(false);
        }
    });
}

/**
 * Ensure we have a working token before any Drive operation.
 * Called once on app startup if user was previously logged in.
 * Returns true if we got a token, false if re-login needed.
 */
export async function restoreSession() {
    // hasValidToken() will automatically pull from localStorage if available
    if (hasValidToken()) {
        _tokenReady = true;
        console.log('[Drive] Session restored from local cache');
        return true;
    }
    
    console.log('[Drive] Cached token expired/missing, attempting silent refresh...');
    const result = await trySilentRefresh();
    if (result) {
        console.log('[Drive] Session restored via silent refresh');
    } else {
        console.warn('[Drive] Session restore failed — user needs to re-login');
    }
    return result;
}

// ─── Error helpers ─────────────────────────────────────────────────────

class DriveAuthError extends Error {
    constructor() { super('Drive auth failed'); this.name = 'DriveAuthError'; }
}

function is403or401(err) {
    const status = err?.status || err?.result?.error?.code;
    return status === 403 || status === 401;
}

/** For background operations — try silent refresh once on auth error, never popup */
async function withSilentRetry(fn) {
    // Pre-check: if no token at all, try refresh first
    if (!hasValidToken()) {
        const refreshed = await trySilentRefresh();
        if (!refreshed) throw new DriveAuthError();
    }
    try { return await fn(); }
    catch (err) {
        if (!is403or401(err)) throw err;
        // Token might have expired mid-request, try one more refresh
        const refreshed = await trySilentRefresh();
        if (refreshed) {
            try { return await fn(); }
            catch (e) { throw new DriveAuthError(); }
        }
        throw new DriveAuthError();
    }
}

// ─── Single file sync helpers ──────────────────────────────────────────

async function uploadFile(folderId, fileName, data) {
    const fileContent = JSON.stringify(data);
    const metadata = { name: fileName, mimeType: 'application/json', parents: [folderId] };

    const response = await gapi.client.drive.files.list({
        q: `name = '${fileName}' and '${folderId}' in parents and trashed = false`,
        fields: 'files(id, name)',
    });
    const files = response.result.files;

    if (files.length > 0) {
        const fileId = files[0].id;
        await gapi.client.request({
            path: `/upload/drive/v3/files/${fileId}`,
            method: 'PATCH', params: { uploadType: 'media' }, body: fileContent,
        });
        // Clean up duplicates
        for (let i = 1; i < files.length; i++) {
            try { await gapi.client.drive.files.delete({ fileId: files[i].id }); } catch (e) { /* ignore */ }
        }
    } else {
        await gapi.client.request({
            path: '/upload/drive/v3/files',
            method: 'POST', params: { uploadType: 'multipart' },
            body: `--foo\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--foo\r\nContent-Type: application/json\r\n\r\n${fileContent}\r\n--foo--`,
            headers: { 'Content-Type': 'multipart/related; boundary=foo' }
        });
    }
}

async function downloadFile(folderId, fileName) {
    const response = await gapi.client.drive.files.list({
        q: `name = '${fileName}' and '${folderId}' in parents and trashed = false`,
        fields: 'files(id, name)',
    });
    const files = response.result.files;
    if (files.length === 0) return null;

    const file = await gapi.client.drive.files.get({ fileId: files[0].id, alt: 'media' });
    return typeof file.result === 'string' ? JSON.parse(file.result) : file.result;
}

// ─── Exported API ──────────────────────────────────────────────────────

/**
 * Sync all data to Drive as separate files.
 * Called from debounced saveData(). Never triggers popups.
 */
export async function syncToDrive(data) {
    // Don't even try if we know we have no token
    if (!_tokenReady) {
        console.warn('[Drive] Sync skipped — no valid token. User needs to re-login.');
        return false;
    }

    if (syncInProgress) {
        // Store payload for later — will be picked up after current sync finishes
        pendingSyncPayloads = data;
        return true; // Don't block caller
    }

    syncInProgress = true;
    try {
        return await withSilentRetry(async () => {
            const folderId = await getOrCreateAppFolder();

            // Filter trashed IDs from active lists
            const trashedIds = new Set((data.trash || []).map(t => t.id));

            const notesClean = (data.notes || []).filter(n => !trashedIds.has(n.id));
            const todosClean = (data.todos || []).filter(t => !trashedIds.has(t.id));

            // Upload all files in parallel for speed
            await Promise.all([
                uploadFile(folderId, DRIVE_FILES.notes, notesClean),
                uploadFile(folderId, DRIVE_FILES.todos, todosClean),
                uploadFile(folderId, DRIVE_FILES.financial, data.financialRecords || []),
                uploadFile(folderId, DRIVE_FILES.financialData, data.financial_records_data || {}),
                uploadFile(folderId, DRIVE_FILES.trash, data.trash || []),
            ]);

            console.log('[Drive] ✅ All 5 files synced to Drive');
            return true;
        });
    } catch (err) {
        if (err instanceof DriveAuthError) {
            console.warn('[Drive] Auth expired during sync — marking token as invalid');
            _tokenReady = false;
            return false;
        }
        console.error('[Drive] Sync Error:', err);
        return false;
    } finally {
        syncInProgress = false;

        // Process pending payloads if any
        if (pendingSyncPayloads && Object.keys(pendingSyncPayloads).length > 0) {
            const pending = pendingSyncPayloads;
            pendingSyncPayloads = {};
            // Schedule a quick follow-up sync
            setTimeout(() => syncToDrive(pending), 500);
        }
    }
}

/**
 * Load all data from Drive (separate files). Returns merged object.
 */
export async function loadFromDrive() {
    if (!_tokenReady) {
        console.warn('[Drive] Load skipped — no valid token');
        return null;
    }

    try {
        return await withSilentRetry(async () => {
            const folderId = await getOrCreateAppFolder();

            // Try loading separate files in parallel
            const [notes, todos, financial, financialData, trash] = await Promise.all([
                downloadFile(folderId, DRIVE_FILES.notes).catch(() => null),
                downloadFile(folderId, DRIVE_FILES.todos).catch(() => null),
                downloadFile(folderId, DRIVE_FILES.financial).catch(() => null),
                downloadFile(folderId, DRIVE_FILES.financialData).catch(() => null),
                downloadFile(folderId, DRIVE_FILES.trash).catch(() => null),
            ]);

            // If separate files exist, use them
            if (notes || todos || financial) {
                console.log('[Drive] Loaded from separate files');
                return {
                    notes: notes || [],
                    todos: todos || [],
                    financialRecords: financial || [],
                    financial_records_data: financialData || {},
                    trash: trash || [],
                };
            }

            // Fallback: try legacy single-file format
            const legacyData = await downloadFile(folderId, 'smart_note_backup.json').catch(() => null);
            if (legacyData) {
                console.log('[Drive] Migrating from legacy single-file backup...');
                return {
                    notes: legacyData.notes || [],
                    todos: legacyData.todos || [],
                    financialRecords: legacyData.financialRecords || [],
                    financial_records_data: legacyData.financial_records_data || {},
                    trash: legacyData.trash || [],
                };
            }

            return null;
        });
    } catch (err) {
        if (err instanceof DriveAuthError) {
            _tokenReady = false;
            return null;
        }
        console.error('[Drive] Load Error:', err);
        return null;
    }
}

/**
 * Check if any Drive file was modified (for polling).
 * Returns latest modifiedTime string or null.
 */
export async function checkDriveForUpdates() {
    if (!_tokenReady) return null;

    try {
        return await withSilentRetry(async () => {
            const folderId = await getOrCreateAppFolder();
            // Check all files in folder
            const response = await gapi.client.drive.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                fields: 'files(id, name, modifiedTime)',
                orderBy: 'modifiedTime desc',
                pageSize: 1,
            });
            const files = response.result.files;
            if (files.length === 0) return null;
            return files[0].modifiedTime || null;
        });
    } catch (err) {
        if (err instanceof DriveAuthError) {
            _tokenReady = false;
            return null;
        }
        console.error('[Drive] Check update error:', err);
        return null;
    }
}

/**
 * Debounced sync — call this from saveData() instead of direct syncToDrive().
 * Waits for edits to stop before actually syncing.
 */
export function debouncedSyncToDrive(data) {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
        syncToDrive(data).then(success => {
            if (success) console.log('[Drive] Debounced sync success');
        });
    }, SYNC_DEBOUNCE_MS);
}

/**
 * Creates a public file in the app folder for sharing.
 * Returns the Google Drive fileId.
 */
export async function createPublicShare(shareData) {
    if (!_tokenReady) throw new Error("Not logged in");
    
    return await withSilentRetry(async () => {
        const folderId = await getOrCreateAppFolder();
        
        const metadata = {
            name: `share_${Date.now()}.json`,
            mimeType: 'application/json',
            parents: [folderId]
        };
        const fileContent = JSON.stringify(shareData);

        // 2. Create the file (metadata only)
        const createRes = await gapi.client.drive.files.create({
            resource: metadata,
            fields: 'id'
        });
        const fileId = createRes.result.id;

        // 3. Upload content (media)
        await gapi.client.request({
            path: `/upload/drive/v3/files/${fileId}`,
            method: 'PATCH',
            params: { uploadType: 'media' },
            body: fileContent
        });

        // 4. Make it collaborative (anyone with link can write)
        try {
            await gapi.client.drive.permissions.create({
                fileId: fileId,
                resource: {
                    type: 'anyone',
                    role: 'writer'
                }
            });
            console.log('[Drive] Created public share with writer perms:', fileId);
        } catch (pErr) {
            console.error('[Drive] FAILED to set public writer permissions. Organization might block public sharing.', pErr);
            // Try fallback to 'reader'
            try {
                await gapi.client.drive.permissions.create({
                    fileId: fileId,
                    resource: { type: 'anyone', role: 'reader' }
                });
                console.warn('[Drive] Fallback to public reader successful');
            } catch (pErr2) {
                console.error('[Drive] Public reader fallback also failed');
            }
        }

        return fileId;
    });
}

/**
 * Fetches a public shared file using only the API key (no login required).
 * Uses direct fetch for maximum reliability with public files.
 */
export async function fetchPublicShare(fileId) {
    if (!fileId) return null;
    
    // Attempt multiple times in case of propagation delay
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            // Use explicit GAPI client method which is most reliable
            const response = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media',
                supportsAllDrives: true
            });
            
            if (response && response.result) {
                const data = response.result;
                return typeof data === 'string' ? JSON.parse(data) : data;
            }
        } catch (e) {
            console.error(`[Drive] Fetch attempt ${attempt} failed`, e.result || e);
            
            // If it's a 404, maybe it's still propagating, wait a bit
            if (attempt < 2) {
                await new Promise(r => setTimeout(r, 1500));
                continue;
            }
        }
    }

    // Final debug attempt: just get metadata
    try {
        const meta = await gapi.client.drive.files.get({
            fileId: fileId,
            fields: 'id, name, permissions',
            supportsAllDrives: true
        });
        console.log("[Drive] Metadata found but content failed:", meta.result);
    } catch (mErr) {
        console.error("[Drive] Metadata check also failed", mErr.result || mErr);
    }

    return null;
}
/**
 * Updates a shared file (used by collaborators who adopted the file).
 */
export async function updatePublicShare(fileId, shareData) {
    try {
        const fileContent = JSON.stringify(shareData);
        await gapi.client.request({
            path: `/upload/drive/v3/files/${fileId}`,
            method: 'PATCH',
            params: { uploadType: 'media' },
            body: fileContent
        });
        console.log('[Drive] Updated public share:', fileId);
        return true;
    } catch (e) {
        console.error("[Drive] Failed to update public share", e);
        return false;
    }
}
