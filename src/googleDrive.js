import { env } from './env.js';

let tokenClient;
let gapiInited = false;
let gisInited = false;
let lastRefreshAttempt = 0;

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

async function getOrCreateAppFolder() {
    const folderName = 'Smart Note Workspace';
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

function checkAllInited(resolve) {
    if (gapiInited && gisInited) resolve(true);
}

/** User-initiated login — always uses consent popup */
export function authenticateGoogle() {
    return new Promise((resolve, reject) => {
        tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) { reject(resp); return; }
            gapi.client.setToken(resp);
            resolve(resp);
        };
        tokenClient.requestAccessToken({ prompt: 'consent' });
    });
}

// --- Auth helpers ---

function tokenFresh() {
    const t = gapi.client.getToken();
    return t && t.expires_at && t.expires_at - Date.now() > 300000; // >5min
}

/** Silent refresh (prompt=none → iframe). Works in Safari, fails silently in PWA. */
export function trySilentRefresh() {
    // Cooldown: don't retry for 5 minutes after last attempt
    if (Date.now() - lastRefreshAttempt < 300000) return Promise.resolve(false);
    lastRefreshAttempt = Date.now();

    return new Promise((resolve) => {
        tokenClient.callback = (resp) => {
            if (resp.error) { resolve(false); return; }
            gapi.client.setToken(resp);
            resolve(true);
        };
        tokenClient.requestAccessToken({ prompt: '' });
    });
}

// --- 403 wrappers ---

class DriveAuthError extends Error {
    constructor() { super('Drive auth failed'); this.name = 'DriveAuthError'; }
}

function is403(err) {
    return err && (err.status === 403 || (err.result?.error?.code === 403));
}

/** Background ops (polling, load) — silent skip on 403 */
async function skipOn403(fn) {
    try { return await fn(); }
    catch (err) { if (is403(err)) throw new DriveAuthError(); throw err; }
}

/** User data sync — try silent refresh on 403 before giving up */
async function withTokenRefresh(fn) {
    try { return await fn(); }
    catch (err) {
        if (!is403(err)) throw err;
        const refreshed = await trySilentRefresh();
        if (refreshed) return await fn();
        throw new DriveAuthError();
    }
}

// --- Exported API ---

export async function syncToDrive(data) {
    try {
        return await withTokenRefresh(async () => {
            const folderId = await getOrCreateAppFolder();
            const fileName = 'smart_note_backup.json';

            const payload = {
                notes: data.notes || [],
                todos: data.todos || [],
                financialRecords: data.financialRecords || [],
                financial_records_data: data.financial_records_data || {},
                trash: data.trash || [],
                exportDate: new Date().toISOString()
            };
            const trashedIds = new Set((data.trash || []).map(t => t.id));
            if (trashedIds.size > 0) {
                payload.notes = payload.notes.filter(n => !trashedIds.has(n.id));
                payload.todos = payload.todos.filter(t => !trashedIds.has(t.id));
            }

            const response = await gapi.client.drive.files.list({
                q: `name = '${fileName}' and '${folderId}' in parents and trashed = false`,
                fields: 'files(id, name)',
            });

            const files = response.result.files;
            const fileContent = JSON.stringify(payload);
            const metadata = { name: fileName, mimeType: 'application/json', parents: [folderId] };

            if (files.length > 0) {
                const fileId = files[0].id;
                await gapi.client.request({
                    path: `/upload/drive/v3/files/${fileId}`,
                    method: 'PATCH', params: { uploadType: 'media' }, body: fileContent,
                });
                for (let i = 1; i < files.length; i++)
                    await gapi.client.drive.files.delete({ fileId: files[i].id });
            } else {
                await gapi.client.request({
                    path: '/upload/drive/v3/files',
                    method: 'POST', params: { uploadType: 'multipart' },
                    body: `--foo\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--foo\r\nContent-Type: application/json\r\n\r\n${fileContent}\r\n--foo--`,
                    headers: { 'Content-Type': 'multipart/related; boundary=foo' }
                });
            }
            return true;
        });
    } catch (err) {
        if (err instanceof DriveAuthError) return false;
        console.error('[Drive] Sync Error:', err);
        return false;
    }
}

export async function loadFromDrive() {
    try {
        return await skipOn403(async () => {
            const folderId = await getOrCreateAppFolder();
            const response = await gapi.client.drive.files.list({
                q: `name = 'smart_note_backup.json' and '${folderId}' in parents and trashed = false`,
                fields: 'files(id, name)',
            });
            const files = response.result.files;
            if (files.length === 0) return null;
            const file = await gapi.client.drive.files.get({ fileId: files[0].id, alt: 'media' });
            return typeof file.result === 'string' ? JSON.parse(file.result) : file.result;
        });
    } catch (err) {
        if (err instanceof DriveAuthError) return null;
        console.error('[Drive] Load Error:', err);
        return null;
    }
}

export async function checkDriveForUpdates() {
    try {
        return await skipOn403(async () => {
            const folderId = await getOrCreateAppFolder();
            const response = await gapi.client.drive.files.list({
                q: `name = 'smart_note_backup.json' and '${folderId}' in parents and trashed = false`,
                fields: 'files(id, name, modifiedTime)',
            });
            const files = response.result.files;
            if (files.length === 0) return null;
            return files[0].modifiedTime || null;
        });
    } catch (err) {
        if (err instanceof DriveAuthError) return null;
        console.error('[Drive] Check update error:', err);
        return null;
    }
}
