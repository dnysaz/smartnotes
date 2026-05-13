export const homeView = `
<section id="home-view" class="view active !p-0">
    <div class="flex flex-col h-full overflow-y-auto no-scrollbar">
        <!-- Title & Actions (Will scroll away) -->
        <header class="md:px-40 px-6 pt-12 mb-6">
            <div class="flex justify-between items-center">
                <h2 class="text-3xl font-extrabold tracking-tight text-[#1D1D1F]">Smart Note</h2>

                <div class="flex gap-2">
                    <button id="btn-bulk-delete" class="hidden p-2.5 bg-red-50 text-red-500 rounded-full transition-all">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                    <div class="relative z-[200]">
                        <button id="btn-main-action" onclick="window.openModal('action-modal')" class="p-2 bg-white text-blue-500 rounded-full border border-gray-100 active:scale-90 transition-all flex items-center justify-center cursor-pointer">
                            <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        </button>
                    </div>
                    <button id="btn-trash" class="p-2 bg-white text-gray-400 rounded-full border border-gray-100 active:scale-90 transition-all relative">
                        <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        <div id="trash-badge" class="hidden absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white"></div>
                    </button>
                    <button id="btn-settings" class="p-2 bg-white text-gray-500 rounded-full border border-gray-100 active:scale-90 transition-all">
                        <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><circle cx="12" cy="12" r="3" stroke-width="2"></circle></svg>
                    </button>
                </div>
            </div>
        </header>

        <!-- Sticky Search Bar Wrapper -->
        <div class="sticky top-0 z-20 bg-[#F2F2F7] md:px-40 px-6 py-4 mb-6">
            <div class="relative md:max-w-sm">
                <div class="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <svg width="18" height="18" class="text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
                <input type="text" id="search-input" placeholder="Search entries..." class="w-full bg-white border border-gray-200 rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-blue-100 transition-all outline-none">
            </div>
        </div>

        <!-- Scrollable Content -->
        <div class="flex-1 md:px-40 px-6 pb-20">
            <div class="recent-section">
                <div class="flex justify-between items-center mb-6">
                    <div class="flex items-center gap-4">
                        <p class="text-sm font-bold text-gray-500 tracking-tight">Recents</p>
                        <div class="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/50">
                            <button id="view-grid" class="p-1 rounded-md transition-all">
                                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                            </button>
                            <button id="view-list" class="p-1 rounded-md transition-all">
                                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                            </button>
                        </div>
                    </div>
                    <button id="btn-toggle-select" class="text-sm font-semibold text-blue-500">Select</button>
                </div>
                <div id="recent-items" class="flex gap-6 overflow-x-auto pb-8 -mx-6 px-6 md:mx-0 md:px-0 md:flex-wrap md:overflow-visible no-scrollbar"></div>
            </div>
        </div>
    </div>

    <!-- Global-style Bottom Sheet for Actions -->
    <div id="action-modal" class="hidden fixed inset-0 z-[2100] bg-black/20 backdrop-blur-sm transition-all duration-300 opacity-0" onclick="window.closeModal('action-modal')">
        <div id="action-sheet" class="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white rounded-t-[40px] p-8 translate-y-full transition-transform duration-500 ease-out" onclick="event.stopPropagation()">
            <div class="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-8"></div>
            <h3 class="text-2xl font-black text-[#1D1D1F] mb-6 tracking-tighter px-2">Create New</h3>
            
            <div class="flex flex-col divide-y divide-gray-100">
                <button id="modal-note" class="flex items-center gap-5 py-5 active:bg-gray-50 transition-all text-left group px-2">
                    <div class="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </div>
                    <div>
                        <p class="font-bold text-[#1D1D1F]">Smart Note</p>
                        <p class="text-[13px] text-gray-400 font-medium">Capture ideas and links</p>
                    </div>
                </button>
                
                <button id="modal-todo" class="flex items-center gap-5 py-5 active:bg-gray-50 transition-all text-left group px-2">
                    <div class="w-12 h-12 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                    <div>
                        <p class="font-bold text-[#1D1D1F]">Todo List</p>
                        <p class="text-[13px] text-gray-400 font-medium">Tasks and checklists</p>
                    </div>
                </button>
 
                <button onclick="showFinancialRecordModal()" class="flex items-center gap-5 py-5 active:bg-gray-50 transition-all text-left group px-2">
                    <div class="w-12 h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                    </div>
                    <div>
                        <p class="font-bold text-[#1D1D1F]">Financial Book</p>
                        <p class="text-[13px] text-gray-400 font-medium">Budgets and expenses</p>
                    </div>
                </button>
 
                <button id="modal-scan" class="flex md:hidden items-center gap-5 py-5 active:bg-gray-50 transition-all text-left group px-2">
                    <div class="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 012 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    </div>
                    <div>
                        <p class="font-bold text-[#1D1D1F]">Smart Scan</p>
                        <p class="text-[13px] text-gray-400 font-medium">AI Camera Magic</p>
                    </div>
                </button>
            </div>
            
            <button onclick="window.closeModal('action-modal')" class="w-full py-4 bg-[#F2F2F7] text-[#1D1D1F] rounded-2xl font-bold active:scale-95 transition-all mt-6">Cancel</button>
        </div>
    </div>
</section>

<!-- Confirm Modal (shared/global) -->
<div id="confirm-modal" class="hidden fixed inset-0 z-[1000] flex items-center justify-center p-8 bg-black/30 backdrop-blur-md transition-all animate-in fade-in duration-300">
    <div class="w-full max-w-[270px] bg-white/95 backdrop-blur-xl rounded-[20px] overflow-hidden animate-in zoom-in-95 duration-300">
        <div class="p-6 text-center">
            <h3 class="text-[17px] font-bold text-[#1D1D1F] leading-tight mb-1">Confirm</h3>
            <p class="text-[13px] text-gray-500 leading-tight">Proceed with this action?</p>
        </div>
        <div class="flex flex-col border-t border-gray-100">
            <button id="confirm-delete-btn" class="w-full py-3.5 text-[17px] font-semibold active:bg-gray-100 transition-all border-b border-gray-100">Confirm</button>
            <button id="confirm-extra-btn" class="hidden w-full py-3.5 text-[17px] font-semibold active:bg-gray-100 transition-all border-b border-gray-100">Extra</button>
            <button id="cancel-delete-btn" class="w-full py-3.5 text-[17px] font-normal text-blue-500 active:bg-gray-100 transition-all">Cancel</button>
        </div>
    </div>
</div>
`;
