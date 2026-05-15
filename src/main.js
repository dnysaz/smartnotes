import './style.css';
import { initFinancial } from './financial.js';
import { checkEnv } from './env.js';
import { initDriveSync, authenticateGoogle, syncToDrive, loadFromDrive, checkDriveForUpdates, trySilentRefresh, debouncedSyncToDrive, restoreSession, isTokenReady, createPublicShare, fetchPublicShare } from './googleDrive.js';

// --- View Templates ---
import { authView }      from './views/auth.view.js';
import { homeView }      from './views/home.view.js';
import { noteView }      from './views/note.view.js';
import { financialView } from './views/financial.view.js';
import { settingsView }  from './views/settings.view.js';

/**
 * Inject all view HTML into #app-views before any logic runs.
 */
function injectViews() {
    const container = document.getElementById('app-views');
    if (!container) { console.error('Missing #app-views'); return; }
    // Note: settingsView is now a function (state) => string
    container.innerHTML = authView + homeView + noteView + financialView + settingsView(state);
}


// Function to refresh dynamic views
window.refreshSettingsUI = () => {
    const settingsContainer = document.getElementById('settings-view');
    if (settingsContainer) {
        const isCurrentlyActive = settingsContainer.classList.contains('active');
        const newSettingsHTML = settingsView(state);
        settingsContainer.outerHTML = newSettingsHTML;
        
        // Important: If it was active, make the new one active too
        if (isCurrentlyActive) {
            const newContainer = document.getElementById('settings-view');
            if (newContainer) newContainer.classList.add('active');
        }
        
        setupSettingsListeners();
    }
};

function setupSettingsListeners() {
    const currencySelect = document.getElementById('currency-select');
    if (currencySelect) {
        currencySelect.value = window.appCurrency || 'Rp';
        currencySelect.addEventListener('change', (e) => {
            window.appCurrency = e.target.value;
            localStorage.setItem('app_currency', e.target.value);
            if (typeof renderFinancial === 'function') renderFinancial();
        });
    }

    // Re-bind back buttons in Settings
    const backBtn = document.querySelector('#settings-view .back-btn');
    if (backBtn) {
        backBtn.onclick = () => switchView(backBtn.dataset.target);
    }
}


// --- Data Management (Export/Import) ---
window.exportData = () => {
    const data = {
        notes: state.notes,
        todos: state.todos,
        financialRecords: state.financialRecords,
        trash: state.trash,
        exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart_note_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

window.importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (confirm('Import data? This will merge with your existing data.')) {
                if (data.notes) state.notes = [...data.notes, ...state.notes];
                if (data.todos) state.todos = [...data.todos, ...state.todos];
                if (data.financialRecords) state.financialRecords = [...data.financialRecords, ...state.financialRecords];
                if (data.trash) state.trash = [...data.trash, ...state.trash];
                saveData();
                location.reload(); // Refresh to show new data
            }
        } catch (err) {
            window.showToast('Invalid backup file.');
        }
    };
    reader.readAsText(file);
};

// --- Google Auth & Sync ---

// Initialize Google Drive Library with retry/check
const initGapiWithRetry = () => {
    if (typeof gapi !== 'undefined' && typeof google !== 'undefined') {
        initDriveSync().then(() => console.log('[Drive] Library Ready'));
    } else {
        console.log('[Drive] Waiting for Google libraries...');
        setTimeout(initGapiWithRetry, 500);
    }
};
initGapiWithRetry();

// Real-time sync polling (checks for Drive changes every 30s)
let driveLastModified = null;
let drivePollTimer = null;

// Shared function to pull cloud changes
async function pullCloudChanges() {
    if (!state.isLoggedIn) return false;
    try {
        const modifiedTime = await checkDriveForUpdates();
        if (modifiedTime && modifiedTime !== driveLastModified) {
            driveLastModified = modifiedTime;
            const cloudData = await loadFromDrive();
            if (cloudData) {
                mergeCloudData(cloudData);
                saveLocally();
                renderRecent();
                // Refresh financial view if open
                if (state.currentView === 'financial-view') {
                    initFinancial(state, switchView, saveData);
                }
                console.log('[Drive] Cross-device sync: merged changes');
                return true; // Data changed
            }
        }
    } catch (e) {
        console.warn('[Drive] Sync pull error (silent):', e.message);
    }
    return false;
}

function startDrivePolling() {
    stopDrivePolling();
    drivePollTimer = setInterval(async () => {
        const changed = await pullCloudChanges();
        if (changed) {
            window.showToast('📲 Data updated from another device');
        }
    }, 15000); // Check every 15s for responsive cross-device sync
}

function stopDrivePolling() {
    if (drivePollTimer) {
        clearInterval(drivePollTimer);
        drivePollTimer = null;
    }
}

// --- Sync on tab focus (user switches back to this tab) ---
document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && state.isLoggedIn) {
        console.log('[Drive] Tab visible — checking for updates...');
        const changed = await pullCloudChanges();
        if (changed) {
            window.showToast('📲 Data updated from another device');
        }
    }
});

// --- Sync when coming back online ---
window.addEventListener('online', async () => {
    if (state.isLoggedIn) {
        console.log('[Drive] Back online — syncing...');
        // Push local changes that may have been made offline
        const payload = {
            notes: state.notes,
            todos: state.todos,
            financialRecords: state.financialRecords,
            trash: state.trash,
            financial_records_data: JSON.parse(localStorage.getItem('financial_records_data')) || {}
        };
        const success = await syncToDrive(payload);
        if (success) window.showToast('✅ Back online — data synced');

        // Also pull any changes from cloud
        await pullCloudChanges();
    }
});

// --- State Management ---
let state;
try {
    state = {
        notes: JSON.parse(localStorage.getItem('notes')) || [],
        todos: JSON.parse(localStorage.getItem('todos')) || [],
        financialRecords: JSON.parse(localStorage.getItem('financialRecords')) || [],
        currentView: 'home-view',
        currentNoteId: null,
        currentTodoId: null,
        currentFinancialRecordId: null,
        isSelectionMode: false,
        selectedIds: new Set(),
        trash: JSON.parse(localStorage.getItem('trash')) || [],
        searchQuery: '',
        viewMode: localStorage.getItem('smartNoteViewMode') || 'grid', // 'grid' or 'list'
        isLoggedIn: localStorage.getItem('isLoggedIn') === 'true',
        hasSkippedLogin: localStorage.getItem('hasSkippedLogin') === 'true',
        userProfile: JSON.parse(localStorage.getItem('userProfile')) || null
    };
} catch (e) {
    console.error("State initialization failed:", e);
    state = { notes:[], todos:[], financialRecords:[], currentView:'home-view', trash:[], viewMode:'grid', isLoggedIn:false, hasSkippedLogin:false };
}

// Now that state is initialized, we can inject views
injectViews();
checkEnv();

// --- DOM Elements ---
const getViews = () => document.querySelectorAll('.view');
const noteEditor = document.getElementById('note-editor');
const todoTitleInput = document.getElementById('todo-title-input');
const todoItemsContainer = document.getElementById('todo-list-items');
const staticTodoAdd = document.getElementById('static-todo-add');
const recentItemsContainer = document.getElementById('recent-items');
const saveIndicators = document.querySelectorAll('.save-indicator');

// --- Global App Settings ---
window.appCurrency = localStorage.getItem('app_currency') || 'Rp';

// --- Global UI Utilities ---
window.showConfirm = ({ title, message, confirmText, extraText, cancelText, onConfirm, onExtra, onCancel, isDestructive = true, alertOnly = false }) => {
    const modal = document.getElementById('confirm-modal');
    const titleEl = modal.querySelector('h3');
    const msgEl = modal.querySelector('p');
    const confirmBtn = document.getElementById('confirm-delete-btn');
    const extraBtn = document.getElementById('confirm-extra-btn');
    const cancelBtn = document.getElementById('cancel-delete-btn');

    titleEl.textContent = title;
    msgEl.textContent = message;
    confirmBtn.textContent = confirmText || (alertOnly ? 'OK' : 'Confirm');
    cancelBtn.textContent = cancelText || 'Cancel';
    
    // Extra button handling
    if (extraText) {
        extraBtn.textContent = extraText;
        extraBtn.classList.remove('hidden');
    } else {
        extraBtn.classList.add('hidden');
    }

    // Hide cancel if alert only
    if (alertOnly) {
        cancelBtn.classList.add('hidden');
    } else {
        cancelBtn.classList.remove('hidden');
    }

    // Color coding
    if (isDestructive) {
        confirmBtn.classList.add('text-red-500');
        confirmBtn.classList.remove('text-blue-500');
    } else {
        confirmBtn.classList.remove('text-red-500');
        confirmBtn.classList.add('text-blue-500');
    }

    modal.classList.remove('hidden');

    // Handlers
    const handleConfirm = () => { if (onConfirm) onConfirm(); close(); };
    const handleExtra = () => { if (onExtra) onExtra(); close(); };
    const handleCancel = () => { if (onCancel) onCancel(); close(); };
    const close = () => {
        modal.classList.add('hidden');
        confirmBtn.removeEventListener('click', handleConfirm);
        extraBtn.removeEventListener('click', handleExtra);
        cancelBtn.removeEventListener('click', handleCancel);
        modal.removeEventListener('click', handleBackdrop);
    };
    const handleBackdrop = (e) => {
        if (e.target === modal) close();
    };

    confirmBtn.addEventListener('click', handleConfirm);
    extraBtn.addEventListener('click', handleExtra);
    cancelBtn.addEventListener('click', handleCancel);
    modal.addEventListener('click', handleBackdrop);
};

// --- Global Toggle Functions ---
window.toggleMainDropdown = (e) => {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('desktop-dropdown');
    const modal = document.getElementById('action-modal');
    
    if (window.innerWidth >= 768) {
        dropdown?.classList.toggle('dropdown-active');
    } else {
        modal?.classList.remove('hidden');
    }
};

function closeAllMenus() {
    document.getElementById('desktop-dropdown')?.classList.remove('dropdown-active');
    document.getElementById('action-modal')?.classList.add('hidden');
    document.getElementById('confirm-modal')?.classList.add('hidden');
    document.getElementById('fin-modal')?.classList.add('hidden');
    document.getElementById('modal-new-financial')?.classList.add('hidden');
}
window.closeAllMenus = closeAllMenus;

// Add backdrop click listeners to all modals
document.addEventListener('click', (e) => {
    const modals = ['confirm-modal', 'action-modal', 'fin-modal', 'modal-new-financial'];
    if (modals.includes(e.target.id)) {
        e.target.classList.add('hidden');
        // Clean up confirm-modal listeners if hidden via backdrop
        if (e.target.id === 'confirm-modal') {
            document.getElementById('confirm-delete-btn')?.replaceWith(document.getElementById('confirm-delete-btn').cloneNode(true));
            document.getElementById('cancel-delete-btn')?.replaceWith(document.getElementById('cancel-delete-btn').cloneNode(true));
            document.getElementById('confirm-extra-btn')?.replaceWith(document.getElementById('confirm-extra-btn').cloneNode(true));
        }
    }
});

// --- Financial Record Creation ---
window.updateFinSaveBtnState = () => {
    const title = document.getElementById('financial-record-title').value.trim();
    const btn = document.getElementById('btn-save-financial-record');
    if (title.length > 0) {
        btn.disabled = false;
        btn.classList.remove('text-gray-300');
        btn.classList.add('text-blue-600');
    } else {
        btn.disabled = true;
        btn.classList.add('text-gray-300');
        btn.classList.remove('text-blue-600');
    }
};

window.formatCurrency = (amount) => {
    const currency = localStorage.getItem('app_currency') || 'Rp';
    return `${currency} ${Math.abs(amount).toLocaleString('id-ID')}`;
};

window.downloadFinancialPDF = () => {
    const record = state.financialRecords.find(r => r.id === state.currentFinancialRecordId);
    if (!record) return;

    const allFinancialData = JSON.parse(localStorage.getItem('financial_records_data')) || {};
    const transactions = allFinancialData[record.id] || [];

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // --- Styles ---
    const primaryColor = [37, 99, 235]; // blue-600
    const textColor = [29, 29, 31];
    const grayColor = [142, 142, 147];
    const incomeColor = [52, 199, 89]; // green
    const expenseColor = [255, 59, 48]; // red

    // --- Header & Branding ---
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(255, 255, 255);
    doc.text("Smart Note", 14, 25);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Financial Intelligence Report", 14, 32);

    // --- Document Title & Date ---
    doc.setFontSize(18);
    doc.setTextColor(...textColor);
    doc.setFont("helvetica", "bold");
    doc.text(record.title || "Untitled Record", 14, 55);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...grayColor);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString()}`, 14, 62);

    // --- Calculations ---
    const income = transactions.filter(t => t.type === 'income').reduce((a, b) => a + Number(b.amount), 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((a, b) => a + Number(b.amount), 0);
    const balance = income - expense;

    // --- Summary Cards Layout ---
    // Income Card
    doc.setFillColor(240, 253, 244); // light green bg
    doc.roundedRect(14, 75, 58, 25, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setTextColor(...incomeColor);
    doc.text("TOTAL INCOME", 19, 82);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(window.formatCurrency(income), 19, 92);

    // Expense Card
    doc.setFillColor(254, 242, 242); // light red bg
    doc.roundedRect(76, 75, 58, 25, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setTextColor(...expenseColor);
    doc.text("TOTAL EXPENSES", 81, 82);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(window.formatCurrency(expense), 81, 92);

    // Balance Card
    doc.setFillColor(239, 246, 255); // light blue bg
    doc.roundedRect(138, 75, 58, 25, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setTextColor(...primaryColor);
    doc.text("NET BALANCE", 143, 82);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(window.formatCurrency(balance), 143, 92);

    // --- Table ---
    const tableData = transactions.sort((a, b) => b.timestamp - a.timestamp).map(t => [
        new Date(t.timestamp).toLocaleDateString('en-GB'),
        t.note || "General Transaction",
        t.type === 'income' ? `+ ${window.formatCurrency(t.amount)}` : "-",
        t.type === 'expense' ? `- ${window.formatCurrency(t.amount)}` : "-"
    ]);

    doc.autoTable({
        startY: 110,
        head: [['Date', 'Description', 'Income', 'Expense']],
        body: tableData,
        theme: 'grid',
        headStyles: { 
            fillColor: primaryColor, 
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { cellWidth: 30, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { halign: 'right', textColor: incomeColor },
            3: { halign: 'right', textColor: expenseColor }
        },
        styles: { 
            fontSize: 9,
            cellPadding: 4,
            lineColor: [240, 240, 240]
        },
        alternateRowStyles: {
            fillColor: [252, 252, 252]
        }
    });

    // --- Footer ---
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(...grayColor);
        doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' });
        doc.text("Produced by Smart Note AI Workspace", 14, 285);
    }

    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
};

window.saveFinancialRecord = () => {
    const title = document.getElementById('financial-record-title').value.trim();
    const desc = document.getElementById('financial-record-desc').value.trim();
    
    if (!title) return;

    if (state.isEditingRecord) {
        const record = state.financialRecords.find(r => r.id === state.currentFinancialRecordId);
        if (record) {
            record.title = title;
            record.description = desc;
        }
    } else {
        const newRecord = {
            id: 'fin_' + Date.now(),
            type: 'financial',
            title: title,
            description: desc,
            timestamp: Date.now(),
            pinned: false
        };
        state.financialRecords.unshift(newRecord);
    }

    saveData();
    closeModal('modal-new-financial');
    renderRecent();
    
    // Refresh financial view if we are in it
    if (state.currentView === 'financial-view') {
        initFinancial(state, switchView, saveData);
    }
};

function switchView(viewId) {
    const currentViews = getViews();
    currentViews.forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.add('active');
        state.currentView = viewId;
    } else {
        console.error("View not found:", viewId);
        return;
    }
    
    // Auto-scroll to top
    target.scrollTop = 0;
    
    // Special handling for specific views
    if (viewId === 'home-view') {
        renderRecent();
    }
    if (viewId === 'financial-view') {
        initFinancial(state, switchView, saveData);
    }
    if (viewId === 'settings-view') {
        refreshSettingsUI();
    }
};

// View Toggles
document.querySelectorAll('.view-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
        state.viewMode = btn.dataset.mode;
        localStorage.setItem('smartNoteViewMode', state.viewMode);
        renderRecent();
    });
});

// --- Persistence ---
function saveLocally() {
    const notesToSave = state.notes.filter(n => n.content.trim().length > 0 || n.id === state.currentNoteId);
    const todosToSave = state.todos.filter(t => {
        const hasContent = t.title.trim().length > 0 || t.items.some(item => item.text.trim().length > 0);
        return hasContent || t.id === state.currentTodoId;
    });
    localStorage.setItem('notes', JSON.stringify(notesToSave));
    localStorage.setItem('todos', JSON.stringify(todosToSave));
    localStorage.setItem('financialRecords', JSON.stringify(state.financialRecords));
    localStorage.setItem('trash', JSON.stringify(state.trash));
    updateTrashBadge();
    showSavedStatus();
}

function saveData() {
    // Only filter for storage, don't modify state.notes/todos in-place
    // so we don't lose the reference to the item currently being edited
    const notesToSave = state.notes.filter(n => n.content.trim().length > 0 || n.id === state.currentNoteId);
    const todosToSave = state.todos.filter(t => {
        const hasContent = t.title.trim().length > 0 || t.items.some(item => item.text.trim().length > 0);
        return hasContent || t.id === state.currentTodoId;
    });

    localStorage.setItem('notes', JSON.stringify(notesToSave));
    localStorage.setItem('todos', JSON.stringify(todosToSave));
    localStorage.setItem('financialRecords', JSON.stringify(state.financialRecords));
    localStorage.setItem('trash', JSON.stringify(state.trash));
    updateTrashBadge();
    showSavedStatus();

    // Auto-Sync to Google Drive if logged in — DEBOUNCED, no popup
    if (state.isLoggedIn) {
        const syncPayload = {
            notes: notesToSave,
            todos: todosToSave,
            financialRecords: state.financialRecords,
            trash: state.trash,
            financial_records_data: JSON.parse(localStorage.getItem('financial_records_data')) || {}
        };
        debouncedSyncToDrive(syncPayload);
    }
}

function updateTrashBadge() {
    const badge = document.getElementById('trash-badge');
    if (state.trash.length > 0) {
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function showSavedStatus() {
    saveIndicators.forEach(el => {
        el.textContent = 'Auto-saved';
        el.style.opacity = '1';
        setTimeout(() => {
            el.style.opacity = '0.5';
        }, 2000);
    });
}

// --- Note Logic ---
function createNewNote() {
    const newNote = {
        id: Date.now().toString(),
        content: '',
        type: 'note',
        timestamp: new Date().toISOString()
    };
    state.notes.unshift(newNote);
    state.currentNoteId = newNote.id;
    
    // Clear both layers
    noteEditor.value = '';
    updateNoteHighlight();
    
    switchView('note-view');
    
    // Auto-focus the editor so you can type immediately
    setTimeout(() => noteEditor.focus(), 300);
    
    saveData();
}

const noteHighlight = document.getElementById('note-highlight');

function linkify(text) {
    if (!text) return '';
    // Escape HTML but keep line breaks
    const div = document.createElement('div');
    div.textContent = text;
    let escapedText = div.innerHTML;
    
    // Improved Regex to catch domains
    const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\b[A-Z0-9.-]+\.(?:com|org|net|id|io|co|me|ai|app|dev|info|biz|gov|edu|uk|us|ca|au|jp|fr|de|br|ru|ch|it|nl|se|no|es|be|at|dk|fi|pt|gr|cz|pl|hu|ro|tr|sg|hk|tw|kr|vn|ph|th|my|in|ae|sa|za|mx|ar|cl|pe|co|uy|py|ec|ve|bo|gt|sv|hn|ni|cr|pa|cu|do|ht|pr|jm|tt|bs|bb|bz|gd|kn|lc|vc|dm|ag|ms|tc|vg|vi|ky|bm|ai|as|gu|mp|vi|wf|yt)\b)/gi;
    
    return escapedText.replace(urlPattern, (url) => {
        let href = url;
        if (!href.match(/^https?:\/\//i) && !href.includes('@')) {
            href = 'https://' + href;
        }
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-500 underline decoration-2 underline-offset-4 hover:text-blue-600 transition-all">${url}</a>`;
    });
}

function updateNoteHighlight() {
    // Add a trailing space to handle the trailing newline issue in textareas
    noteHighlight.innerHTML = linkify(noteEditor.value) + (noteEditor.value.endsWith('\n') ? ' ' : '');
}

function loadNote(id) {
    const note = state.notes.find(n => n.id === id);
    if (note) {
        state.currentNoteId = id;
        noteEditor.value = note.content;
        updateNoteHighlight();
        switchView('note-view');
    }
}

// Sync Scrolling
noteEditor.addEventListener('scroll', () => {
    noteHighlight.scrollTop = noteEditor.scrollTop;
});

// Click to Edit / Blur to View Links
noteHighlight.addEventListener('click', () => {
    noteEditor.focus();
});

noteEditor.addEventListener('focus', () => {
    noteEditor.style.zIndex = "2";
    noteHighlight.style.zIndex = "1";
    noteHighlight.style.pointerEvents = "none";
});

noteEditor.addEventListener('blur', () => {
    noteEditor.style.zIndex = "1";
    noteHighlight.style.zIndex = "2";
    noteHighlight.style.pointerEvents = "auto";
});

noteEditor.addEventListener('input', (e) => {
    const note = state.notes.find(n => n.id === state.currentNoteId);
    if (note) {
        note.content = e.target.value;
        note.timestamp = new Date().toISOString();
        saveData();
        updateNoteHighlight();
    }
});

// --- Todo Logic ---
function createNewTodo() {
    const id = Date.now().toString();
    const newTodo = {
        id,
        title: '',
        items: [], // Start empty, user will use static input
        timestamp: new Date().toISOString(),
        pinned: false
    };
    state.todos.unshift(newTodo);
    state.currentTodoId = id;
    renderTodoView();
    switchView('todo-view');
    // Focus the static add input
    const staticInput = document.getElementById('static-todo-add');
    if (staticInput) {
        staticInput.focus();
    }
    saveData();
}

function loadTodo(id) {
    const todo = state.todos.find(t => t.id === id);
    if (todo) {
        state.currentTodoId = id;
        renderTodoView();
        switchView('todo-view');
    }
}

function renderTodoView() {
    const todo = state.todos.find(t => t.id === state.currentTodoId);
    if (!todo) return;

    todoTitleInput.value = todo.title;
    todoItemsContainer.innerHTML = '';
    
    todo.items.forEach((item, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'flex items-start justify-between p-4 bg-[#F5F5F7] rounded-xl mb-2 transition-all duration-200';
        const showActions = item.text.trim().length > 0;
        
        itemEl.innerHTML = `
            <textarea class="todo-text-input bg-transparent border-none outline-none flex-1 text-base resize-none ${item.done ? 'line-through text-gray-400' : 'text-[#1D1D1F]'}" 
                      data-index="${index}" rows="1" placeholder="Add a task...">${item.text}</textarea>
            <div class="flex items-center gap-4 ml-4 mt-1 ${showActions ? '' : 'invisible pointer-events-none'}">
                <input type="checkbox" ${item.done ? 'checked' : ''} data-index="${index}" class="todo-checkbox w-6 h-6 rounded-full border-gray-300 text-blue-500 focus:ring-0">
                <button class="delete-btn text-gray-400 hover:text-red-500 transition-colors" data-index="${index}">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
        `;
        
        const textarea = itemEl.querySelector('textarea');
        
        // Auto-resize textarea
        const adjustHeight = () => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        };
        textarea.addEventListener('input', (e) => {
            item.text = e.target.value;
            adjustHeight();
            
            // Toggle actions visibility live
            const actionContainer = itemEl.querySelector('.flex.items-center.gap-4.ml-4.mt-1');
            if (item.text.trim().length > 0) {
                actionContainer.classList.remove('invisible', 'pointer-events-none');
            } else {
                actionContainer.classList.add('invisible', 'pointer-events-none');
            }
            
            todo.timestamp = new Date().toISOString();
            saveData();
        });
        setTimeout(adjustHeight, 0);

        // Keyboard support: Enter for new list item directly below current one
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                addTodoItem(index); // Pass current index to insert below
            } else if (e.key === 'Backspace' && item.text === '') {
                // Backspace on empty item deletes it
                e.preventDefault();
                todo.items.splice(index, 1);
                todo.timestamp = new Date().toISOString();
                renderTodoView();
                // Focus previous item if exists, otherwise focus static input
                const inputs = todoItemsContainer.querySelectorAll('.todo-text-input');
                if (index > 0 && inputs[index - 1]) {
                    inputs[index - 1].focus();
                } else {
                    const staticInput = document.getElementById('static-todo-add');
                    if (staticInput) staticInput.focus();
                }
                saveData();
            }
        });

        const checkbox = itemEl.querySelector('.todo-checkbox');
        checkbox.addEventListener('change', (e) => {
            item.done = e.target.checked;
            todo.timestamp = new Date().toISOString();
            renderTodoView();
            saveData();
        });

        const deleteBtn = itemEl.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => {
            todo.items.splice(index, 1);
            todo.timestamp = new Date().toISOString();
            renderTodoView();
            saveData();
        });

        todoItemsContainer.appendChild(itemEl);
    });
}

todoTitleInput.addEventListener('blur', (e) => {
    const todo = state.todos.find(t => t.id === state.currentTodoId);
    if (todo) {
        todo.title = e.target.value;
        todo.timestamp = new Date().toISOString();
        saveData();
    }
});

if (staticTodoAdd) {
    staticTodoAdd.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const text = e.target.value.trim();
            if (text) {
                const todo = state.todos.find(t => t.id === state.currentTodoId);
                if (todo) {
                    todo.items.unshift({ text, done: false });
                    todo.timestamp = new Date().toISOString();
                    renderTodoView();
                    e.target.value = '';
                    e.target.focus();
                    saveData();
                }
            }
        }
    });
}



function addTodoItem(insertIndex = -1) {
    const todo = state.todos.find(t => t.id === state.currentTodoId);
    if (todo) {
        // If an index is provided, insert below it. Otherwise insert at top.
        const newIndex = insertIndex >= 0 ? insertIndex + 1 : 0;
        todo.items.splice(newIndex, 0, { text: '', done: false });
        todo.timestamp = new Date().toISOString();
        
        renderTodoView();
        
        // Focus the newly created textarea immediately (synchronously for mobile keyboard)
        const inputs = todoItemsContainer.querySelectorAll('.todo-text-input');
        if (inputs[newIndex]) {
            inputs[newIndex].focus();
        }
        
        saveData();
    }
}

// --- Home Recent List ---
function renderRecent() {
    const filteredNotes = state.notes.filter(n => n.content.trim().length > 0);
    const filteredTodos = state.todos.filter(t => t.title.trim().length > 0 || t.items.some(item => item.text.trim().length > 0));

    const query = state.searchQuery.toLowerCase();
    
    let all = [
        ...filteredNotes.map(n => ({...n, type: 'note'})),
        ...filteredTodos.map(t => ({...t, type: 'todo'})),
        ...state.financialRecords.map(f => ({...f, type: 'financial'}))
    ];

    // Live Search Filtering
    if (query) {
        all = all.filter(item => {
            const content = (item.content || '').toLowerCase();
            const title = (item.title || '').toLowerCase();
            // Also search within todo items
            const itemsText = item.items ? item.items.map(i => i.text.toLowerCase()).join(' ') : '';
            
            return content.includes(query) || title.includes(query) || itemsText.includes(query);
        });
    }

    all = all.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.timestamp) - new Date(a.timestamp);
    });

    recentItemsContainer.innerHTML = '';
    recentItemsContainer.className = "flex flex-col gap-10 pb-20";
    
    if (all.length === 0) {
        const isSearch = query.length > 0;
        recentItemsContainer.innerHTML = `
            <div class="py-20 flex flex-col items-center justify-center text-center opacity-30">
                <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    ${isSearch 
                        ? '<svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>'
                        : '<svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>'
                    }
                </div>
                <p class="text-sm font-bold uppercase tracking-widest">${isSearch ? 'No Results Found' : 'No Activity Yet'}</p>
                <p class="text-[10px] mt-1">${isSearch ? `Keyword "${query}" not found` : 'Tap + to start organizing'}</p>
            </div>
        `;
        return;
    }

    // Grouping by Month
    const groups = {};
    all.forEach(item => {
        const date = new Date(item.timestamp);
        const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        if (!groups[monthYear]) groups[monthYear] = [];
        groups[monthYear].push(item);
    });

    Object.keys(groups).forEach(monthYear => {
        const monthSection = document.createElement('div');
        const isList = state.viewMode === 'list';
        
        monthSection.innerHTML = `
            <h4 class="text-xl font-bold text-[#1D1D1F] mb-6">${monthYear}</h4>
            <div class="${isList ? 'flex flex-col gap-3' : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4'} group-container"></div>
        `;
        
        const grid = monthSection.querySelector('.group-container');
        groups[monthYear].forEach(item => {
            const div = document.createElement('div');
            const isNote = item.type === 'note';
            const isTodo = item.type === 'todo';
            const isFinancial = item.type === 'financial';
            const isSelected = state.selectedIds.has(item.id);
            const isList = state.viewMode === 'list';
            const dateObj = new Date(item.timestamp);
            const shortDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            let titleText = '';
            if (isNote) {
                titleText = item.content.trim().split('\n')[0] || `Note - ${shortDate}`;
            } else if (isTodo) {
                titleText = item.title.trim() || `Todo - ${shortDate}`;
            } else {
                titleText = item.title || `Financial - ${shortDate}`;
            }

            if (isList) {
                // List View Card (Compact Row)
                div.className = `flex items-center gap-4 bg-white p-3 rounded-2xl cursor-pointer active:scale-[0.98] transition-all border-2 ${isSelected ? 'border-blue-500 bg-blue-50/30' : 'border-gray-100'} hover:border-blue-100 relative`;
                div.innerHTML = `
                    <div class="w-10 h-10 ${isNote ? 'bg-blue-50 text-blue-500' : isTodo ? 'bg-green-50 text-green-500' : 'bg-purple-50 text-purple-500'} rounded-xl flex items-center justify-center flex-shrink-0">
                        ${isNote 
                            ? '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>'
                            : isTodo 
                                ? '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
                                : '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>'
                        }
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="font-bold text-sm text-[#1D1D1F] truncate">${titleText}</p>
                        <p class="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider font-bold">${isNote ? 'Note' : isTodo ? 'List' : 'Financial'} • ${shortDate}</p>
                    </div>
                    <div class="flex items-center gap-1">
                        <button class="pin-btn p-2 transition-all ${item.pinned ? 'text-blue-500' : 'text-gray-200 hover:text-gray-400'}" data-id="${item.id}" data-type="${item.type}">
                            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" /></svg>
                        </button>
                        <button class="single-delete-btn p-2 text-gray-200 hover:text-red-500 transition-all" data-id="${item.id}" data-type="${item.type}">
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                `;
            } else {
                // Grid View Card (Current)
                div.className = `paper-card w-full h-48 bg-white p-5 rounded-3xl flex flex-col justify-between cursor-pointer active:scale-95 transition-all relative border-2 ${isSelected ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-50/20' : 'border-gray-100'} hover:border-blue-100 ${item.pinned && !isSelected ? 'border-blue-100 bg-blue-50/5' : ''}`;
                div.innerHTML = `
                    <div class="hover-action flex gap-2">
                        <button class="pin-btn p-1.5 bg-white rounded-full transition-all ${item.pinned ? 'text-blue-500 border border-blue-100' : 'text-gray-300 border border-gray-100'}" data-id="${item.id}" data-type="${item.type}">
                            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" /></svg>
                        </button>
                        <button class="single-delete-btn p-1.5 bg-red-50 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all border border-red-100" data-id="${item.id}" data-type="${item.type}">
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>

                    <div class="h-full flex flex-col justify-between">
                        <div>
                            <div class="flex items-center gap-2 mb-3">
                                <div class="${isNote ? 'text-blue-500' : isTodo ? 'text-green-500' : 'text-purple-500'}">
                                     ${isNote 
                                        ? `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>`
                                        : isTodo 
                                            ? `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
                                            : `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`}
                                </div>
                                <span class="text-[9px] font-bold text-gray-400 capitalize tracking-widest">${item.type}</span>
                            </div>
                            <p class="text-[13px] font-semibold text-gray-800 leading-tight line-clamp-4">${titleText}</p>
                        </div>
                        <div class="text-[8px] text-gray-400 font-bold tracking-widest uppercase">${shortDate}</div>
                    </div>
                `;
            }

            div.onclick = (e) => {
                if (e.target.closest('.single-delete-btn') || e.target.closest('.pin-btn')) return;

                if (state.isSelectionMode) {
                    toggleSelectItem(item.id);
                } else {
                    if (isNote) loadNote(item.id);
                    else if (isTodo) loadTodo(item.id);
                    else if (isFinancial) {
                        state.currentFinancialRecordId = item.id;
                        switchView('financial-view');
                    }
                }
            };

            div.querySelector('.single-delete-btn').onclick = (e) => {
                e.stopPropagation();
                deleteItem(item.id, item.type);
            };

            div.querySelector('.pin-btn').onclick = (e) => {
                e.stopPropagation();
                togglePin(item.id, item.type);
            };

            // No need for onchange on a div-based checkbox
                    // Handled by card onclick
            grid.appendChild(div);
        });
        
        recentItemsContainer.appendChild(monthSection);
    });
}

function togglePin(id, type) {
    if (type === 'note') {
        const item = state.notes.find(n => n.id === id);
        if (item) item.pinned = !item.pinned;
    } else if (type === 'todo') {
        const item = state.todos.find(t => t.id === id);
        if (item) item.pinned = !item.pinned;
    } else if (type === 'financial') {
        const item = state.financialRecords.find(f => f.id === id);
        if (item) item.pinned = !item.pinned;
    }
    saveData();
    renderRecent();
}

function toggleSelectItem(id) {
    if (state.selectedIds.has(id)) {
        state.selectedIds.delete(id);
    } else {
        state.selectedIds.add(id);
    }
    updateBulkDeleteUI();
    renderRecent();
}

function updateBulkDeleteUI() {
    const btn = document.getElementById('btn-bulk-delete');
    if (state.selectedIds.size > 0) {
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }
}

function deleteItem(id, type) {
    let itemToDelete;
    if (type === 'note') {
        itemToDelete = state.notes.find(n => n.id === id);
        state.notes = state.notes.filter(n => n.id !== id);
    } else if (type === 'todo') {
        itemToDelete = state.todos.find(t => t.id === id);
        state.todos = state.todos.filter(t => t.id !== id);
    } else if (type === 'financial') {
        itemToDelete = state.financialRecords.find(f => f.id === id);
        state.financialRecords = state.financialRecords.filter(f => f.id !== id);
    }
    
    if (itemToDelete) {
        itemToDelete.deletedAt = new Date().toISOString();
        itemToDelete.type = type; // Ensure type is stored
        state.trash.unshift(itemToDelete);
    }
    
    saveData();
    renderRecent();
}

function bulkDelete() {
    if (state.selectedIds.size === 0) return;
    
    const notesToMove = state.notes.filter(n => state.selectedIds.has(n.id)).map(n => ({...n, type: 'note', deletedAt: new Date().toISOString()}));
    const todosToMove = state.todos.filter(t => state.selectedIds.has(t.id)).map(t => ({...t, type: 'todo', deletedAt: new Date().toISOString()}));
    
    state.trash = [...notesToMove, ...todosToMove, ...state.trash];
    
    state.notes = state.notes.filter(n => !state.selectedIds.has(n.id));
    state.todos = state.todos.filter(t => !state.selectedIds.has(t.id));
    
    state.selectedIds.clear();
    state.isSelectionMode = false;
    document.getElementById('btn-toggle-select').textContent = 'Select';
    updateBulkDeleteUI();
    saveData();
    renderRecent();
}

// --- Trash Bin Logic ---
function renderTrash() {
    const container = document.getElementById('trash-items');
    container.innerHTML = '';
    const isList = state.viewMode === 'list';
    
    // Update container layout
    if (isList) {
        container.className = "flex flex-col gap-3";
    } else {
        container.className = "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4";
    }
    
    if (state.trash.length === 0) {
        container.innerHTML = `<div class="col-span-full py-20 text-center opacity-30 text-sm font-bold uppercase tracking-widest">Trash is empty</div>`;
        return;
    }
    
    state.trash.forEach(item => {
        const div = document.createElement('div');
        const isNote = item.type === 'note';
        const titleText = isNote 
            ? (item.content.trim().split('\n')[0] || 'Deleted Note') 
            : (item.title.trim() || 'Deleted List');
        const shortDate = new Date(item.deletedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        if (isList) {
            // List View for Trash
            div.className = "flex items-center gap-4 bg-white p-3 rounded-2xl border border-transparent hover:border-blue-100 transition-all";
            div.innerHTML = `
                <div class="w-10 h-10 ${isNote ? 'bg-blue-50 text-blue-500' : 'bg-green-50 text-green-500'} rounded-xl flex items-center justify-center flex-shrink-0 opacity-50">
                    ${isNote 
                        ? '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>'
                        : '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
                    }
                </div>
                <div class="flex-1 min-w-0">
                    <p class="font-bold text-sm text-gray-400 truncate strike-through">${titleText}</p>
                    <p class="text-[9px] text-gray-300 font-bold uppercase tracking-widest">Deleted ${shortDate}</p>
                </div>
                <div class="flex items-center gap-1">
                    <button class="restore-btn p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-all" title="Restore">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                    </button>
                    <button class="perm-delete-btn p-2 text-red-400 hover:text-red-600 transition-all" title="Delete Forever">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            `;
        } else {
            // Grid View for Trash
            div.className = "paper-card w-full h-48 border-gray-100 opacity-80 bg-white p-5 rounded-3xl flex flex-col justify-between relative border border-transparent";
            div.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="p-2 ${isNote ? 'bg-blue-50 text-blue-500' : 'bg-green-50 text-green-500'} rounded-2xl opacity-50">
                        ${isNote 
                            ? '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>'
                            : '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
                        }
                    </div>
                    <div class="flex gap-1">
                        <button class="restore-btn p-1.5 bg-blue-50 text-blue-500 rounded-full hover:bg-blue-500 hover:text-white transition-all" title="Restore">
                             <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                        </button>
                        <button class="perm-delete-btn p-1.5 bg-red-50 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all" title="Delete Forever">
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </div>
                <div>
                    <h4 class="font-bold text-gray-400 line-clamp-2 mb-1 strike-through">${titleText}</h4>
                    <p class="text-[8px] text-gray-300 font-bold uppercase tracking-widest">Deleted ${shortDate}</p>
                </div>
            `;
        }
        
        div.querySelector('.restore-btn').onclick = () => restoreItem(item.id);
        div.querySelector('.perm-delete-btn').onclick = () => {
            window.showConfirm({
                title: 'Delete Permanently?',
                message: 'This item will be gone forever.',
                confirmText: 'Delete',
                onConfirm: () => {
                    state.trash = state.trash.filter(i => i.id !== item.id);
                    saveData();
                    renderTrash();
                }
            });
        };
        
        container.appendChild(div);
    });
}

function restoreItem(id) {
    const item = state.trash.find(i => i.id === id);
    if (!item) return;
    
    state.trash = state.trash.filter(i => i.id !== id);
    delete item.deletedAt;
    
    if (item.type === 'note') state.notes.unshift(item);
    else state.todos.unshift(item);
    
    saveData();
    renderTrash();
    renderRecent();
}

function emptyTrash() {
    if (state.trash.length === 0) return;
    
    window.showConfirm({
        title: 'Empty Trash?',
        message: 'All items will be permanently deleted. This cannot be undone.',
        confirmText: 'Empty All',
        onConfirm: () => {
            state.trash = [];
            saveData();
            renderTrash();
        }
    });
}

document.getElementById('btn-empty-trash').onclick = emptyTrash;
document.getElementById('btn-settings').onclick = () => {
    switchView('settings-view');
};

document.getElementById('btn-trash').onclick = () => {
    renderTrash();
    switchView('trash-view');
};

// --- Search Logic ---
document.getElementById('search-input').addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderRecent();
});

// --- Camera / Scan Logic ---
let stream = null;
const video = document.getElementById('camera-preview');
const captureBtn = document.getElementById('capture-btn');

async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        window.showConfirm({
            title: "Camera Error",
            message: "Your browser does not support camera access or is not using HTTPS.",
            alertOnly: true
        });
        return;
    }

    // Switch to scan-view FIRST so the video element is visible in DOM
    switchView('scan-view');

    const videoEl = document.getElementById('camera-preview');
    const constraints = [
        { video: { facingMode: 'environment' }, audio: false },
        { video: { facingMode: 'user' }, audio: false },
        { video: true, audio: false }
    ];

    let lastError = null;

    for (const config of constraints) {
        try {
            stream = await navigator.mediaDevices.getUserMedia(config);
            if (stream) break;
        } catch (err) {
            lastError = err;
            console.warn('Constraint failed:', config, err);
        }
    }

    if (!stream) {
        // Check if running in iOS PWA standalone mode
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                       (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isStandalone = window.navigator.standalone === true;
        const msg = isIOS && isStandalone
            ? "iOS standalone mode has limited camera support. Open in Safari instead."
            : "Gagal mengakses kamera: " + (lastError ? lastError.message : "No device found");

        window.showConfirm({ title: "Access Failed", message: msg, alertOnly: true });
        return;
    }

    videoEl.srcObject = stream;
    try { await videoEl.play(); } catch (e) { /* iOS silent autoplay fallback */ }

    // Show "ready" indicator, update to "processing" on capture
    const scanStatus = document.getElementById('scan-status');
    if (scanStatus) {
        scanStatus.textContent = 'Camera ready — tap to capture';
        scanStatus.classList.remove('hidden');
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        if (video) video.srcObject = null;
    }
    const scanStatus = document.getElementById('scan-status');
    if (scanStatus) scanStatus.classList.add('hidden');
}

async function callGeminiAI(base64Image) {
    const prompt = `Analyze this image.
    1. If the text is continuous paragraph, narrative, or long form text without numbered/bulleted items → return as note.
    2. If the text contains list items (numbered, bulleted, or short separate lines that look like a checklist/shopping list/todo) → return as todo.
    3. Return strictly JSON only:
    For a list: { "type": "todo", "title": "Scanned List", "items": ["item1", "item2"] }
    For a note: { "type": "note", "content": "extracted text here" }
    Return ONLY the JSON string, no markdown formatting.`;

    // Proxy endpoint — same path works in dev (Vite plugin) and prod (Vercel serverless)
    // API key stays server-side, never reaches browser
    const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, imageBase64: base64Image.split(',')[1] })
    });
    if (!res.ok) {
        const errBody = await res.text();
        throw new Error('Gemini API error (' + res.status + '): ' + errBody.slice(0, 200));
    }
    const data = await res.json();
    let resultText = data.text;

    try {
        const cleanedText = resultText.replace(/```json|```JSON|```/gi, '').trim();
        return JSON.parse(cleanedText);
    } catch (err) {
        console.error("AI Parse Error:", err);
        throw new Error('AI gagal memproses gambar. Silakan coba lagi.');
    }
}

captureBtn.addEventListener('click', async () => {
    const canvas = document.getElementById('camera-canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = canvas.toDataURL('image/jpeg');
    
    document.getElementById('scan-status').textContent = 'AI is processing image ...';
    captureBtn.disabled = true;
    captureBtn.style.opacity = '0.5';

    try {
        const result = await callGeminiAI(imageData);

        // If AI returned as todo but items look like continuous text → force to note
        if (result.type === 'todo' && result.items) {
            const allText = result.items.join(' ');
            const hasNumbers = /\d/.test(allText);
            const avgLength = allText.length / result.items.length;
            if (!hasNumbers && avgLength > 60) {
                result.type = 'note';
                result.content = allText;
            }
        }

        if (result.type === 'todo') {
            const id = Date.now().toString();
            const scannedItems = (result.items || []).map(text => ({ text, done: false }));
            const newTodo = {
                id,
                title: result.title || 'AI Scanned List',
                items: scannedItems,
                timestamp: new Date().toISOString(),
                pinned: false
            };
            state.todos.unshift(newTodo);
            state.currentTodoId = id;
            renderTodoView();
            switchView('todo-view');
            setTimeout(() => {
                const staticInput = document.getElementById('static-todo-add');
                if (staticInput) staticInput.focus();
            }, 200);
        } else {
            createNewNote();
            const note = state.notes.find(n => n.id === state.currentNoteId);
            note.content = result.content || "";
            noteEditor.value = note.content;
            updateNoteHighlight();
        }
        
        saveData();
        stopCamera();
    } catch (err) {
        console.error('[Scan] Error:', err);
        window.showConfirm({
            title: "Processing Error",
            message: "Failed to process image: " + err.message,
            alertOnly: true
        });
    } finally {
        captureBtn.disabled = false;
        captureBtn.style.opacity = '1';
        const scanStatus = document.getElementById('scan-status');
        if (scanStatus) {
            scanStatus.textContent = '';
            scanStatus.classList.add('hidden');
        }
    }
});

// --- Event Listeners ---
// --- Global Action Modal Logic (Bottom Sheet Style) ---
window.openModal = (id) => {
    const modal = document.getElementById(id);
    if (!modal) return;
    
    const sheet = modal.querySelector('[id$="-sheet"]');
    modal.classList.remove('hidden');
    
    setTimeout(() => {
        modal.classList.add('opacity-100');
        modal.classList.remove('opacity-0');
        if (sheet) {
            sheet.classList.remove('translate-y-full');
            sheet.classList.add('translate-y-0');
        }
    }, 10);
};

window.closeModal = (id) => {
    const modal = document.getElementById(id);
    if (!modal) return;
    
    const sheet = modal.querySelector('[id$="-sheet"]');
    if (sheet) {
        sheet.classList.add('translate-y-full');
        sheet.classList.remove('translate-y-0');
    }
    modal.classList.remove('opacity-100');
    modal.classList.add('opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
};

window.editFinancialRecord = () => {
    const record = state.financialRecords.find(r => r.id === state.currentFinancialRecordId);
    if (!record) return;
    
    state.isEditingRecord = true;
    closeAllMenus();
    const titleEl = document.getElementById('modal-financial-title');
    if (titleEl) titleEl.textContent = "Edit Record";
    
    document.getElementById('financial-record-title').value = record.title;
    document.getElementById('financial-record-desc').value = record.description || '';
    window.updateFinSaveBtnState();
    window.openModal('modal-new-financial');
};

window.showFinancialRecordModal = () => {
    state.isEditingRecord = false;
    const titleEl = document.getElementById('modal-financial-title');
    if (titleEl) titleEl.textContent = "New Record";
    
    document.getElementById('financial-record-title').value = '';
    document.getElementById('financial-record-desc').value = '';
    window.updateFinSaveBtnState();
    window.openModal('modal-new-financial');
};


document.getElementById('btn-main-action')?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.openModal('action-modal');
});

const modalClose = document.getElementById('modal-close');
if (modalClose) modalClose.onclick = closeAllMenus;


// Mobile Modal Triggers
document.getElementById('modal-note')?.addEventListener('click', () => { closeAllMenus(); createNewNote(); });
document.getElementById('modal-todo')?.addEventListener('click', () => { closeAllMenus(); createNewTodo(); });
document.getElementById('modal-financial')?.addEventListener('click', () => { closeAllMenus(); switchView('financial-view'); });
document.getElementById('modal-scan')?.addEventListener('click', () => { closeAllMenus(); startCamera(); });

// Desktop Dropdown Triggers
document.querySelectorAll('.modal-note-trigger').forEach(el => el.onclick = () => { closeAllMenus(); createNewNote(); });
document.querySelectorAll('.modal-todo-trigger').forEach(el => el.onclick = () => { closeAllMenus(); createNewTodo(); });
document.getElementById('trigger-financial')?.addEventListener('click', (e) => {
    e.stopPropagation();
    showFinancialRecordModal();
});

// --- Note/Todo Menu Logic ---
window.openNoteMenu = () => {
    const modal = document.getElementById('note-menu-modal');
    const sheet = document.getElementById('note-menu-sheet');
    if (!modal || !sheet) return;

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.add('opacity-100');
        modal.classList.remove('opacity-0');
        sheet.classList.remove('translate-y-full');
        sheet.classList.add('translate-y-0');
    }, 10);
};

window.closeNoteMenu = () => {
    const modal = document.getElementById('note-menu-modal');
    const sheet = document.getElementById('note-menu-sheet');
    if (!modal || !sheet) return;

    sheet.classList.add('translate-y-full');
    sheet.classList.remove('translate-y-0');
    modal.classList.remove('opacity-100');
    modal.classList.add('opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
};

window.handleMenuDownload = () => {
    let content = "";
    let filename = "export.txt";

    if (state.currentView === 'note-view') {
        const note = state.notes.find(n => n.id === state.currentNoteId);
        if (note) {
            content = note.content;
            filename = `note_${new Date().toISOString().slice(0,10)}.txt`;
        }
    } else if (state.currentView === 'todo-view') {
        const todo = state.todos.find(t => t.id === state.currentTodoId);
        if (todo) {
            content = `${todo.title}\n\n` + todo.items.map(i => `${i.done ? '[x]' : '[ ]'} ${i.text}`).join('\n');
            filename = `todo_${new Date().toISOString().slice(0,10)}.txt`;
        }
    }

    if (!content) return;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    window.closeNoteMenu();
};

window.handleMenuDelete = () => {
    window.showConfirm({
        title: "Delete item?",
        message: "Are you sure you want to move this to trash?",
        confirmText: "Delete",
        isDestructive: true,
        onConfirm: () => {
            if (state.currentView === 'note-view') {
                state.notes = state.notes.filter(n => n.id !== state.currentNoteId);
            } else if (state.currentView === 'todo-view') {
                state.todos = state.todos.filter(t => t.id !== state.currentTodoId);
            }
            saveData();
            window.closeNoteMenu();
            switchView('home-view');
        }
    });
};

// Close menus on click outside
window.addEventListener('click', (e) => {
    if (!e.target.closest('.relative') && !e.target.closest('#action-modal') && !e.target.closest('#note-menu-modal')) {
        closeAllMenus();
    }
});

// Initialize Modules
initFinancial(state, switchView, saveData);

document.getElementById('btn-toggle-select').addEventListener('click', () => {
    state.isSelectionMode = !state.isSelectionMode;
    if (!state.isSelectionMode) {
        state.selectedIds.clear();
        updateBulkDeleteUI();
    }
    document.getElementById('btn-toggle-select').textContent = state.isSelectionMode ? 'Cancel' : 'Select';
    renderRecent();
});

document.getElementById('btn-bulk-delete').addEventListener('click', bulkDelete);

document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Stop camera if we are in scan-view
        stopCamera();

        // Clean up empty entries from state only when leaving the view
        state.notes = state.notes.filter(n => n.content.trim().length > 0);
        state.todos = state.todos.filter(t => {
            return t.title.trim().length > 0 || t.items.some(item => item.text.trim().length > 0);
        });
        
        state.currentNoteId = null;
        state.currentTodoId = null;
        
        saveData(); 
        switchView(btn.dataset.target);
    });
});




window.closeQR = () => {
    const modal = document.getElementById('qr-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.getElementById('qrcode-container').innerHTML = '';
    }
};

window.handleMenuShare = async () => {
    if (!state.isLoggedIn) {
        window.showToast('Please login to Google Drive to use sharing.');
        return;
    }

    let content = "";
    let title = "";
    let contentType = 'note';

    if (state.currentView === 'note-view') {
        const note = state.notes.find(n => n.id === state.currentNoteId);
        if (note) {
            title = "Shared Note";
            content = note.content;
            contentType = 'note';
        }
    } else if (state.currentView === 'todo-view') {
        const todo = state.todos.find(t => t.id === state.currentTodoId);
        if (todo) {
            title = todo.title || "Shared Todo";
            content = JSON.stringify(todo.items);
            contentType = 'todo';
        }
    }

    if (!content) return;

    try {
        window.showToast('Generating share link...');
        const shareData = { t: title, c: content, d: new Date().toLocaleDateString(), ty: contentType };
        
        // Create public share file on Drive
        const fileId = await createPublicShare(shareData);
        const shareUrl = `${window.location.origin}/#share=${fileId}`;

        // Show QR Modal
        const qrModal = document.getElementById('qr-modal');
        const qrContainer = document.getElementById('qrcode-container');
        const qrLinkText = document.getElementById('qr-link-text');
        
        if (qrModal && qrContainer) {
            qrModal.classList.remove('hidden');
            qrLinkText.textContent = shareUrl;
            qrContainer.innerHTML = '';
            new QRCode(qrContainer, {
                text: shareUrl,
                width: 256,
                height: 256,
                colorDark: "#1D1D1F",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }

        await navigator.clipboard.writeText(shareUrl);
        window.closeNoteMenu();
        window.showToast('Link copied to clipboard!');
    } catch (err) {
        console.error("Share failed:", err);
        window.showToast('Failed to generate share link.');
    }
};

async function renderShareMode() {
    const hash = window.location.hash;
    if (hash.startsWith('#share=')) {
        const shareId = hash.replace('#share=', '');
        
        const shareTitle = document.getElementById('share-title');

        // Check if API key is missing
        if (!env.GOOGLE_API_KEY) {
            console.error("[Drive] Cannot fetch share: VITE_GOOGLE_API_KEY is missing in build.");
            if (shareTitle) shareTitle.textContent = "Configuration Missing";
            const contentContainer = document.getElementById('share-content');
            if (contentContainer) {
                contentContainer.innerHTML = `
                    <div class="p-6 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm">
                        <p class="font-bold mb-2">API Configuration Missing</p>
                        <p>VITE_APP_G_KEY is not defined in the environment variables. Please check your Vercel settings and redeploy.</p>
                    </div>
                `;
            }
            return false;
        }

        // Show loading state in title
        if (shareTitle) shareTitle.textContent = "Loading shared content...";

        // Hide main app
        const app = document.getElementById('app');
        if (app) app.classList.add('hidden');
        const shareView = document.getElementById('share-public-view');
        if (shareView) shareView.classList.remove('hidden');

        try {
            let decodedData = null;

            // Try to fetch from Drive first (new system uses Drive fileId)
            // Drive fileIds are usually ~33-44 chars. Legacy encoded JSON is much longer.
            if (shareId.length < 100) {
                decodedData = await fetchPublicShare(shareId);
            }

            // Fallback for old Base64 links
            if (!decodedData) {
                try {
                    decodedData = JSON.parse(decodeURIComponent(atob(shareId).split('').map((c) => {
                        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                    }).join('')));
                } catch (e) {
                    // Not a valid legacy share link
                }
            }

            if (!decodedData) {
                if (shareTitle) shareTitle.textContent = "Shared content not found";
                return false;
            }

            // Render content
            if (shareTitle) shareTitle.textContent = decodedData.t || "Shared Content";
            
            const contentContainer = document.getElementById('share-content');
            contentContainer.innerHTML = ''; // clear previous
            
            let isTodo = decodedData.ty === 'todo';
            let items = [];
            
            if (isTodo) {
                try {
                    items = typeof decodedData.c === 'string' ? JSON.parse(decodedData.c) : decodedData.c;
                } catch(e) {
                    isTodo = false;
                }
            }
            
            if (isTodo && Array.isArray(items)) {
                // Render interactive (but read-only) todo list
                contentContainer.className = 'mt-4 flex flex-col gap-3 flex-1'; // apply some nice spacing
                items.forEach(item => {
                    const div = document.createElement('div');
                    div.className = "flex items-start gap-4 p-4 bg-[#F5F5F7] rounded-2xl";
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.checked = item.done;
                    checkbox.disabled = true;
                    checkbox.className = "mt-0.5 w-6 h-6 rounded-full border-gray-300 text-blue-500 bg-white focus:ring-0 cursor-default opacity-100";
                    
                    const span = document.createElement('span');
                    span.className = `text-lg flex-1 leading-relaxed ${item.done ? 'line-through text-gray-400' : 'text-[#1D1D1F]'}`;
                    span.textContent = item.text;
                    
                    div.appendChild(checkbox);
                    div.appendChild(span);
                    contentContainer.appendChild(div);
                });
            } else {
                // Render standard note
                contentContainer.className = 'text-lg text-gray-700 leading-relaxed whitespace-pre-wrap border-t border-gray-100 pt-6 flex-1';
                contentContainer.textContent = decodedData.c || "";
            }
            return true;
        } catch (err) {
            console.error("Invalid share link:", err);
            if (shareTitle) shareTitle.textContent = "Error loading content";
            return false;
        }
    }
    return false;
}

// Listen for hash changes (e.g. scanning a new QR while app is open)
window.addEventListener('hashchange', async () => {
    if (window.location.hash.startsWith('#share=')) {
        await renderShareMode();
    } else if (window.location.hash === '') {
        // Go back to app if share cleared
        location.reload();
    }
});

// --- View Mode Toggles ---
document.getElementById('view-grid')?.addEventListener('click', () => {
    state.viewMode = 'grid';
    localStorage.setItem('smartNoteViewMode', 'grid');
    updateViewToggleUI();
    renderRecent();
});

document.getElementById('view-list')?.addEventListener('click', () => {
    state.viewMode = 'list';
    localStorage.setItem('smartNoteViewMode', 'list');
    updateViewToggleUI();
    renderRecent();
});

function updateViewToggleUI() {
    const gridBtn = document.getElementById('view-grid');
    const listBtn = document.getElementById('view-list');
    if (!gridBtn || !listBtn) return;
    
    if (state.viewMode === 'grid') {
        gridBtn.className = "view-toggle-btn px-4 py-1.5 rounded-lg text-xs font-bold transition-all bg-white text-blue-500";
        listBtn.className = "view-toggle-btn px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-gray-400";
    } else {
        gridBtn.className = "view-toggle-btn px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-gray-400";
        listBtn.className = "view-toggle-btn px-4 py-1.5 rounded-lg text-xs font-bold transition-all bg-white text-blue-500";
    }
}
updateViewToggleUI();

window.initApp = async () => {
    console.log("initApp running...");
    
    // 1. Check if we are in share mode first
    if (await renderShareMode()) {
        console.log("Share mode active, skipping main app init");
        return;
    }

    const loginView = document.getElementById('login-view');
    const homeView = document.getElementById('home-view');
    const app = document.getElementById('app');

    // Reset views
    const currentViews = getViews();
    currentViews.forEach(v => v.classList.remove('active'));

    if (state.isLoggedIn || state.hasSkippedLogin) {
        console.log("App state: Logged in or skipped");
        homeView.classList.add('active');
        state.currentView = 'home-view';
        renderRecent();

        // Auto-restore Google session for logged-in users
        if (state.isLoggedIn) {
            // Wait for gapi to fully initialize, then restore token
            const tryRestore = async () => {
                // Wait until gapi libraries are loaded
                const waitForGapi = () => new Promise((resolve) => {
                    const check = () => {
                        if (typeof gapi !== 'undefined' && typeof google !== 'undefined') {
                            resolve();
                        } else {
                            setTimeout(check, 300);
                        }
                    };
                    check();
                });

                await waitForGapi();
                // Make sure Drive client is initialized
                await initDriveSync();
                console.log('[Drive] Libraries ready, restoring session...');

                const restored = await restoreSession();
                if (restored) {
                    console.log('[Drive] ✅ Session restored — starting sync');
                    driveLastModified = null; // Force first pull
                    startDrivePolling();
                    // Immediate first pull
                    await pullCloudChanges();
                } else {
                    console.warn('[Drive] ⚠️ Session restore failed — sync paused');
                    window.showToast('Cloud sync paused — tap Sync in Settings to reconnect');
                    // Update settings UI to show disconnected state
                    refreshSettingsUI();
                }
            };
            tryRestore();
        }
    } else {
        console.log("App state: Showing login");
        loginView.classList.add('active');
        state.currentView = 'login-view';
    }
    
    // Force visibility
    app.style.opacity = '1';
    console.log("App revealed");
};

function mergeCloudData(cloud) {
    // Helper: merge array by ID, keep newer timestamp
    const mergeArray = (local, remote) => {
        const map = new Map();
        local.forEach(item => map.set(item.id, item));
        remote.forEach(item => {
            const existing = map.get(item.id);
            if (!existing || new Date(item.timestamp) > new Date(existing.timestamp)) {
                map.set(item.id, item);
            }
        });
        return Array.from(map.values());
    };

    if (cloud.notes) state.notes = mergeArray(state.notes, cloud.notes);
    if (cloud.todos) state.todos = mergeArray(state.todos, cloud.todos);
    if (cloud.financialRecords) state.financialRecords = mergeArray(state.financialRecords, cloud.financialRecords);
    
    // Prevent locally trashed items from being resurrected by old cloud data (Race condition fix)
    const localTrashedIds = new Set(state.trash.map(t => t.id));
    state.notes = state.notes.filter(n => !localTrashedIds.has(n.id));
    state.todos = state.todos.filter(t => !localTrashedIds.has(t.id));
    state.financialRecords = state.financialRecords.filter(f => !localTrashedIds.has(f.id));

    if (cloud.trash) {
        // Items deleted on another device → remove from active lists
        const cloudTrashedIds = new Set(cloud.trash.map(t => t.id));
        state.notes = state.notes.filter(n => !cloudTrashedIds.has(n.id));
        state.todos = state.todos.filter(t => !cloudTrashedIds.has(t.id));
        state.financialRecords = state.financialRecords.filter(f => !cloudTrashedIds.has(f.id));

        // If an item is NOT in cloud.trash, it might have been permanently deleted / emptied on another device.
        // We remove it from local trash, UNLESS it was just deleted locally (newer than the last cloud state).
        const cloudTime = driveLastModified ? new Date(driveLastModified).getTime() : 0;
        const cloudTrashMap = new Map(cloud.trash.map(t => [t.id, t]));
        
        state.trash = state.trash.filter(item => {
            if (cloudTrashMap.has(item.id)) return true; // Still in cloud
            const deletedAt = item.deletedAt ? new Date(item.deletedAt).getTime() : 0;
            // If deleted locally very recently, keep it (hasn't synced yet)
            if (deletedAt >= cloudTime - 60000) return true;
            // Otherwise, it was emptied from the cloud
            return false;
        });

        state.trash = mergeArray(state.trash, cloud.trash);
    }

    // Merge financial_records_data (nested object)
    if (cloud.financial_records_data) {
        const localFin = JSON.parse(localStorage.getItem('financial_records_data')) || {};
        Object.keys(cloud.financial_records_data).forEach(recordId => {
            const cloudTx = cloud.financial_records_data[recordId] || [];
            const localTx = localFin[recordId] || [];
            const txMap = new Map();
            localTx.forEach(tx => txMap.set(tx.id, tx));
            cloudTx.forEach(tx => {
                const existing = txMap.get(tx.id);
                if (!existing || tx.timestamp > existing.timestamp) {
                    txMap.set(tx.id, tx);
                }
            });
            localFin[recordId] = Array.from(txMap.values());
        });
        localStorage.setItem('financial_records_data', JSON.stringify(localFin));
    }
}

window.showToast = (message, duration = 3000) => {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toast-message');
    if (!toast || !msgEl) return;

    // Strip emojis and trim
    const textWithoutEmojis = message.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();

    msgEl.textContent = textWithoutEmojis;
    toast.classList.remove('hidden');
    
    // Slight delay to allow display:block to apply before animating opacity
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
    });

    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
        toast.style.opacity = '0';
        // Wait for transition to finish before hiding completely
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, duration);
};

window.showLoading = () => {
    document.getElementById('sync-loader').classList.remove('hidden');
};
window.hideLoading = () => {
    document.getElementById('sync-loader').classList.add('hidden');
};

window.handleDriveSync = (() => {
    return async () => {
        if (!state.isLoggedIn) {
            // Guest mode or not logged in → login first, then sync
            await window.handleGoogleLogin();
            refreshSettingsUI();
            return;
        }

        // Already logged in — check if we have a working token
        const syncStatus = document.getElementById('sync-status-text');
        const syncLabel = document.getElementById('sync-label');
        if (syncStatus) syncStatus.classList.remove('hidden');

        const payload = buildSyncPayload();
        let success = false;

        if (!isTokenReady()) {
            // Token expired/missing — re-auth (user-initiated, popup OK)
            if (syncLabel) syncLabel.textContent = 'Reconnecting...';
            try {
                await authenticateGoogle();
                success = await syncToDrive(payload);
                // Restart polling after successful re-auth
                if (success) {
                    driveLastModified = null;
                    startDrivePolling();
                }
            } catch (e) {
                console.warn('[Drive] Re-auth cancelled');
            }
        } else {
            if (syncLabel) syncLabel.textContent = 'Syncing...';
            success = await syncToDrive(payload);
        }

        if (syncStatus) syncStatus.classList.add('hidden');
        if (success) {
            if (syncLabel) syncLabel.textContent = 'Synced';
            window.showToast('✅ Sync complete');
        } else {
            if (syncLabel) syncLabel.textContent = 'Tap to reconnect';
            window.showToast('Sync failed — try again');
        }
    };
})();

/** Build sync payload from current state + localStorage */
function buildSyncPayload() {
    return {
        notes: state.notes,
        todos: state.todos,
        financialRecords: state.financialRecords,
        trash: state.trash,
        financial_records_data: JSON.parse(localStorage.getItem('financial_records_data')) || {}
    };
}

window.handleGoogleLogin = async () => {
    window.showLoading();

    // Capture current local data BEFORE login (important for guest→login flow)
    const localDataBeforeLogin = {
        notes: [...state.notes],
        todos: [...state.todos],
        financialRecords: [...state.financialRecords],
        trash: [...state.trash],
        financial_records_data: JSON.parse(localStorage.getItem('financial_records_data')) || {}
    };
    const hadLocalData = localDataBeforeLogin.notes.length > 0 ||
                         localDataBeforeLogin.todos.length > 0 ||
                         localDataBeforeLogin.financialRecords.length > 0;

    try {
        const resp = await authenticateGoogle();
        console.log('[Drive] Login Success:', resp);

        // Update state
        state.isLoggedIn = true;
        state.hasSkippedLogin = false;

        // Extract email from Google id_token
        let userEmail = 'Google User';
        try {
            if (resp && resp.id_token) {
                const payload = JSON.parse(atob(resp.id_token.split('.')[1]));
                userEmail = payload.email || userEmail;
            }
        } catch (e) { /* ignore */ }

        state.userProfile = {
            name: "Smart Note User",
            email: userEmail
        };
        
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('hasSkippedLogin', 'false');
        localStorage.setItem('userProfile', JSON.stringify(state.userProfile));

        // Two-way sync: merge cloud → local, then push local → cloud
        const cloudData = await loadFromDrive();
        if (cloudData) {
            console.log('[Drive] Found existing backup, merging with local...');
            mergeCloudData(cloudData);
        }

        // If user had local data (guest mode data), make sure it gets pushed to Drive
        if (hadLocalData) {
            // Re-merge local data that existed before login
            mergeCloudData(localDataBeforeLogin);
            console.log('[Drive] Guest data merged — pushing to cloud...');
        }

        // Save locally first (instant), then push to Drive immediately (not debounced)
        saveLocally();
        const syncPayload = buildSyncPayload();
        const syncSuccess = await syncToDrive(syncPayload);
        if (syncSuccess) {
            console.log('[Drive] Initial sync after login complete');
            window.showToast('Data synced to Google Drive');
        }

        // Start real-time polling
        driveLastModified = new Date().toISOString();
        startDrivePolling();

        refreshSettingsUI();
        switchView('home-view');
    } catch (err) {
        console.error('[Drive] Login failed:', err);
        window.showToast('Google Login failed. Please check your internet or Google Cloud configuration.');
    } finally {
        window.hideLoading();
    }
};

function clearAllLocalData() {
    // Reset State
    state.notes = [];
    state.todos = [];
    state.financialRecords = [];
    state.trash = [];
    state.userProfile = null;

    // Clear Storage
    localStorage.removeItem('notes');
    localStorage.removeItem('todos');
    localStorage.removeItem('financialRecords');
    localStorage.removeItem('financial_records_data');
    localStorage.removeItem('trash');
    localStorage.removeItem('userProfile');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('hasSkippedLogin');
    localStorage.removeItem('gapi_token');
}

window.skipLogin = () => {
    // Clear everything for a fresh guest session
    clearAllLocalData();
    state.hasSkippedLogin = true;
    state.isLoggedIn = false;
    localStorage.setItem('hasSkippedLogin', 'true');
    localStorage.setItem('isLoggedIn', 'false');
    
    // Refresh UI to empty state
    renderRecent();
    switchView('home-view');
};

window.handleSignOut = () => {
    const isGuest = !state.isLoggedIn && state.hasSkippedLogin;
    window.showConfirm({
        title: "Sign Out",
        message: isGuest
            ? "You are in guest mode — all local data will be permanently deleted. Sign out?"
            : "Data on this device will be cleared, but your cloud backup remains safe.",
        confirmText: "Sign Out",
        isDestructive: true,
        onConfirm: () => {
            stopDrivePolling();
            clearAllLocalData();
            state.isLoggedIn = false;
            state.hasSkippedLogin = false;
            
            // Revoke token if possible so next login is fresh
            try {
                const token = gapi.client.getToken();
                if (token) {
                    google.accounts.oauth2.revoke(token.access_token);
                    gapi.client.setToken(null);
                }
            } catch (e) { /* ignore */ }

            // Go back to login view
            switchView('login-view');
            
            // Close settings if open
            const settingsView = document.getElementById('settings-view');
            if (settingsView) settingsView.classList.remove('active');
        }
    });
};

window.toggleAuthSheet = (sheetId) => {
    const overlay = document.getElementById('auth-sheets-overlay');
    const sheet = document.getElementById(sheetId);
    
    if (!overlay || !sheet) return;

    // Show overlay
    overlay.classList.remove('hidden');
    setTimeout(() => {
        overlay.classList.add('opacity-100');
        overlay.classList.remove('opacity-0');
        
        // Slide up the specific sheet
        sheet.classList.remove('translate-y-full');
        sheet.classList.add('translate-y-0');
    }, 10);
};

window.closeAllAuthSheets = () => {
    const overlay = document.getElementById('auth-sheets-overlay');
    const sheets = document.querySelectorAll('#auth-sheets-overlay > div');
    
    if (!overlay) return;

    // Slide down all sheets
    sheets.forEach(sheet => {
        sheet.classList.add('translate-y-full');
        sheet.classList.remove('translate-y-0');
    });

    // Hide overlay after animation
    overlay.classList.add('opacity-0');
    overlay.classList.remove('opacity-100');
    
    setTimeout(() => {
        overlay.classList.add('hidden');
    }, 500);
};

// --- Mobile Zoom Prevention (Hard Lock) ---
document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
});

let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, false);

// --- Initialization: Hide Splash Screen ---
window.addEventListener('load', () => {
    // Unregister existing SW in development
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            for (let registration of registrations) {
                registration.unregister();
                console.log('Old Service Worker removed for development mode.');
            }
        });
    }

    const splash = document.getElementById('splash-screen');
    if (splash) splash.style.display = 'none';
    window.initApp();
});
