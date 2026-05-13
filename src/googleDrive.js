/**
 * Smart Note — Google Drive Sync Engine
 * Uses Google Identity Services (GIS) and GAPI Client.
 */
import { env } from './env.js';

let tokenClient;
let gapiInited = false;
let gisInited = false;

/**
 * Initialize GAPI Client
 */
export async function initDriveSync() {
    return new Promise((resolve) => {
        // Load GAPI
        gapi.load('client', async () => {
            await gapi.client.init({
                apiKey: env.GOOGLE_API_KEY,
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            });
            gapiInited = true;
            checkAllInited(resolve);
        });

        // Load GIS
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: env.GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/drive.file', // Visible files scope
            callback: '', // defined at request time
        });
        gisInited = true;
        checkAllInited(resolve);
    });
}

/**
 * Get or Create the App Folder in Root
 */
async function getOrCreateAppFolder() {
    const folderName = 'Smart Note Workspace';
    
    // Search for folder
    const response = await gapi.client.drive.files.list({
        q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
    });

    const folders = response.result.files;
    if (folders.length > 0) {
        return folders[0].id;
    }

    // Create if not found
    const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
    };

    const createResponse = await gapi.client.drive.files.create({
        resource: folderMetadata,
        fields: 'id',
    });

    return createResponse.result.id;
}

function checkAllInited(resolve) {
    if (gapiInited && gisInited) resolve(true);
}

/**
 * Real Google Login
 */
export function authenticateGoogle() {
    return new Promise((resolve, reject) => {
        tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) {
                reject(resp);
                return;
            }
            // Success! Token is automatically handled by gapi.client
            resolve(resp);
        };

        if (gapi.client.getToken() === null) {
            // Prompt for consent
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            // Re-use token
            tokenClient.requestAccessToken({ prompt: '' });
        }
    });
}

/**
 * Sync Data to Google Drive (Visible Folder)
 */
export async function syncToDrive(data) {
    try {
        const folderId = await getOrCreateAppFolder();
        const fileName = 'smart_note_backup.json';
        
        // Build payload termasuk financial_records_data
        const payload = {
            notes: data.notes || [],
            todos: data.todos || [],
            financialRecords: data.financialRecords || [],
            financial_records_data: data.financial_records_data || {},
            trash: data.trash || [],
            exportDate: new Date().toISOString()
        };

        // 1. Check if file exists in the specific folder
        const response = await gapi.client.drive.files.list({
            q: `name = '${fileName}' and '${folderId}' in parents and trashed = false`,
            fields: 'files(id, name)',
        });

        const files = response.result.files;
        const fileContent = JSON.stringify(payload);
        const metadata = {
            name: fileName,
            mimeType: 'application/json',
            parents: [folderId],
        };

        if (files.length > 0) {
            // 1. Update the first file
            const fileId = files[0].id;
            await gapi.client.request({
                path: `/upload/drive/v3/files/${fileId}`,
                method: 'PATCH',
                params: { uploadType: 'media' },
                body: fileContent,
            });
            console.log('[Drive] Sync: Update success in Workspace folder');

            // 2. Clean up duplicates (delete all other files with the same name)
            if (files.length > 1) {
                console.log(`[Drive] Sync: Cleaning up ${files.length - 1} duplicates...`);
                for (let i = 1; i < files.length; i++) {
                    await gapi.client.drive.files.delete({
                        fileId: files[i].id,
                    });
                }
                console.log('[Drive] Sync: Duplicate cleanup complete');
            }
        } else {
            // Create new file
            await gapi.client.request({
                path: '/upload/drive/v3/files',
                method: 'POST',
                params: { uploadType: 'multipart' },
                body: `--foo\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--foo\r\nContent-Type: application/json\r\n\r\n${fileContent}\r\n--foo--`,
                headers: { 'Content-Type': 'multipart/related; boundary=foo' }
            });
            console.log('[Drive] Sync: Created new file in Workspace folder');
        }
        return true;
    } catch (err) {
        console.error('[Drive] Sync Error:', err);
        return false;
    }
}

/**
 * Load Data from Google Drive
 */
export async function loadFromDrive() {
    try {
        const folderId = await getOrCreateAppFolder();
        const response = await gapi.client.drive.files.list({
            q: `name = 'smart_note_backup.json' and '${folderId}' in parents and trashed = false`,
            fields: 'files(id, name)',
        });

        const files = response.result.files;
        if (files.length === 0) return null;

        const fileId = files[0].id;
        const file = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });
        
        return typeof file.result === 'string' ? JSON.parse(file.result) : file.result;
    } catch (err) {
        console.error('[Drive] Load Error:', err);
        return null;
    }
}
