export const settingsView = (state) => `
<section id="settings-view" class="view bg-[#F2F2F7] h-full overflow-y-auto no-scrollbar pb-32 pt-12">
    <div class="px-6 space-y-8">
        <header class="flex justify-between items-center px-2">
            <button class="back-btn text-blue-500 font-semibold text-lg flex items-center gap-2" data-target="home-view">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                Back
            </button>
        </header>
        <div class="flex items-center justify-between px-2">
            <h2 class="text-3xl font-black text-[#1D1D1F] tracking-tighter">Settings</h2>
            <div class="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-100">
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
            </div>
        </div>

        <div class="space-y-1">
            <!-- Appearance Group -->
            <div class="mb-8">
                <p class="text-xs font-bold text-gray-500 px-4 mb-3 uppercase tracking-wider">Appearance</p>
                <div class="bg-white rounded-3xl overflow-hidden border border-gray-100 divide-y divide-gray-50">
                    <div class="flex items-center justify-between p-5">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center">
                                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                            </div>
                            <div>
                                <p class="font-bold text-[#1D1D1F]">Currency</p>
                                <p class="text-xs text-gray-400">Current: ${window.appCurrency || 'Rp'}</p>
                            </div>
                        </div>
                        <select id="currency-select" class="bg-transparent text-blue-500 font-bold text-sm outline-none">
                            <option value="Rp" ${window.appCurrency === 'Rp' ? 'selected' : ''}>IDR (Rp)</option>
                            <option value="$" ${window.appCurrency === '$' ? 'selected' : ''}>USD ($)</option>
                            <option value="€" ${window.appCurrency === '€' ? 'selected' : ''}>EUR (€)</option>
                            <option value="¥" ${window.appCurrency === '¥' ? 'selected' : ''}>JPY (¥)</option>
                            <option value="£" ${window.appCurrency === '£' ? 'selected' : ''}>GBP (£)</option>
                            <option value="S$" ${window.appCurrency === 'S$' ? 'selected' : ''}>SGD (S$)</option>
                            <option value="RM" ${window.appCurrency === 'RM' ? 'selected' : ''}>MYR (RM)</option>
                            <option value="₩" ${window.appCurrency === '₩' ? 'selected' : ''}>KRW (₩)</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Cloud Sync Section -->
            <div class="mb-8">
                <p class="text-xs font-bold text-gray-500 px-4 mb-3 uppercase tracking-wider">Cloud Services</p>
                <div class="bg-white rounded-3xl overflow-hidden border border-gray-100 divide-y divide-gray-50">
                    <div class="flex items-center justify-between p-5">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
                                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path></svg>
                            </div>
                            <div>
                                <p class="font-bold text-[#1D1D1F]">Google Drive Sync</p>
                                <p class="text-xs text-gray-400">
                                    ${state.isLoggedIn ? 'Connected as ' + (state.userProfile?.email || 'User') : 'Not Connected'}
                                </p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full ${state.isLoggedIn ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}"></span>
                            <span class="text-[10px] font-bold ${state.isLoggedIn ? 'text-green-500' : 'text-gray-400'} uppercase">
                                ${state.isLoggedIn ? 'Active' : 'Offline'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Data Management Section -->
            <div class="mb-8">
                <p class="text-xs font-bold text-gray-500 px-4 mb-3 uppercase tracking-wider">Data Management</p>
                <div class="bg-white rounded-3xl overflow-hidden border border-gray-100 divide-y divide-gray-50">
                    <button onclick="window.exportData()" class="w-full flex items-center justify-between p-5 active:bg-gray-50 transition-all text-left">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center">
                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            </div>
                            <div>
                                <p class="font-bold text-[#1D1D1F]">Export Data</p>
                                <p class="text-xs text-gray-400">Download .json backup</p>
                            </div>
                        </div>
                        <svg width="16" height="16" class="text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>
                    <button onclick="document.getElementById('import-input').click()" class="w-full flex items-center justify-between p-5 active:bg-gray-50 transition-all text-left">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 bg-green-50 text-green-500 rounded-xl flex items-center justify-center">
                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                            </div>
                            <div>
                                <p class="font-bold text-[#1D1D1F]">Import Data</p>
                                <p class="text-xs text-gray-400">Restore from backup</p>
                            </div>
                        </div>
                        <input type="file" id="import-input" class="hidden" accept=".json" onchange="window.importData(event)">
                        <svg width="16" height="16" class="text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>
                </div>
            </div>

            <!-- Legal Section -->
            <div class="mb-8">
                <p class="text-xs font-bold text-gray-500 px-4 mb-3 uppercase tracking-wider">Legal & Help</p>
                <div class="bg-white rounded-3xl overflow-hidden border border-gray-100 divide-y divide-gray-50">
                    <button onclick="window.toggleAuthSheet('auth-terms-sheet')" class="w-full flex items-center justify-between p-5 active:bg-gray-50 transition-all text-left">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 bg-gray-50 text-gray-400 rounded-xl flex items-center justify-center">
                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            </div>
                            <p class="font-bold text-[#1D1D1F]">Terms and Conditions</p>
                        </div>
                        <svg width="16" height="16" class="text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>
                    <button onclick="window.toggleAuthSheet('auth-help-sheet')" class="w-full flex items-center justify-between p-5 active:bg-gray-50 transition-all text-left">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 bg-gray-50 text-gray-400 rounded-xl flex items-center justify-center">
                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </div>
                            <p class="font-bold text-[#1D1D1F]">Help & Support</p>
                        </div>
                        <svg width="16" height="16" class="text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>
                </div>
            </div>

            <!-- Account Section -->
            <div class="pb-10">
                <p class="text-xs font-bold text-gray-500 px-4 mb-3 uppercase tracking-wider">Account</p>
                <div class="bg-white rounded-3xl overflow-hidden border border-gray-100">
                    <button id="btn-signout" onclick="window.handleSignOut()" class="w-full flex items-center justify-center p-5 active:bg-red-50 transition-all text-red-500 font-bold">
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    </div>
</section>
`;
