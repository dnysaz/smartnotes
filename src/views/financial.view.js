export const financialView = `
<!-- Financial View (iOS Multi-Row Sticky Header) -->
<section id="financial-view" class="view bg-[#F2F2F7] overflow-y-auto scroll-smooth">
    <!-- Sticky Header Wrapper -->
    <div class="sticky top-0 z-[150] bg-[#F2F2F7]/80 backdrop-blur-xl border-b border-transparent transition-all duration-300" id="fin-sticky-header">
        <!-- Row 1: Navigation -->
        <div class="md:px-40 px-6 h-20 flex items-end justify-between relative pb-4">
            <button class="back-btn text-blue-500 font-semibold text-lg flex items-center gap-2" data-target="home-view">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                Back
            </button>
            <!-- Absolutely Centered Title -->
            <span id="fin-record-title" class="absolute left-1/2 -translate-x-1/2 bottom-4 text-lg font-bold text-[#1D1D1F]">Financial</span>
            <div class="flex items-center gap-4">
                <button onclick="window.editFinancialRecord()" class="text-gray-400 p-1 hover:text-blue-500 transition-colors">
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
                <button onclick="toggleFinSearch()" class="text-gray-400 p-1 hover:text-blue-500 transition-colors">
                    <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </button>
            </div>
        </div>

        <!-- Row 2: Live Summary (Fades in on scroll) -->
        <div id="fin-sub-header" class="md:px-40 px-6 h-10 flex items-center justify-between transition-all duration-300 opacity-0 translate-y-2 pointer-events-none pb-2">
            <div class="flex flex-col">
                <span id="header-balance" class="text-[11px] font-extrabold text-[#1D1D1F] tabular-nums">Rp 0</span>
            </div>
            <div class="flex items-center gap-4">
                <div class="flex items-center gap-1">
                    <svg width="10" height="10" class="text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 10l7-7 7 7M12 3v18"></path></svg>
                    <span id="header-income" class="text-[9px] font-bold text-green-500 tabular-nums">0</span>
                </div>
                <div class="flex items-center gap-1">
                    <svg width="10" height="10" class="text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 14l-7 7-7-7M12 21V3"></path></svg>
                    <span id="header-expense" class="text-[9px] font-bold text-red-500 tabular-nums">0</span>
                </div>
            </div>
        </div>

        <!-- Row 3: Dynamic Search Bar (iOS System Style) -->
        <div id="fin-search-container" class="hidden md:px-40 px-6 pb-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div class="relative">
                <input type="text" id="fin-search-input" placeholder="Search" class="w-full bg-[#E3E3E8] border-none rounded-xl py-2.5 px-10 text-[17px] focus:ring-0 outline-none placeholder-gray-500">
                <svg width="18" height="18" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                <button onclick="toggleFinSearch()" class="absolute right-3 top-1/2 -translate-y-1/2 text-[17px] font-medium text-blue-500">Cancel</button>
            </div>
        </div>
    </div>

    <div class="flex flex-col md:px-40 px-6 pb-32 pt-2">
        <!-- Compact Summary Card -->
        <div id="fin-large-summary" class="bg-white rounded-[28px] p-6 border border-gray-100 mb-6 transition-all duration-500">
            <p id="fin-record-desc-display" class="text-[10px] text-gray-400 text-center mb-3 italic line-clamp-1 px-4"></p>
            <p class="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1 text-center">Net Balance</p>
            <h3 id="total-balance" class="text-3xl font-black text-[#1D1D1F] text-center mb-6 tabular-nums tracking-tighter">Rp 0</h3>
            <div class="flex justify-between border-t border-gray-50 pt-4">
                <div class="text-center flex-1">
                    <p class="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Income</p>
                    <p id="total-income" class="text-[13px] font-black text-green-500 tabular-nums">+Rp 0</p>
                </div>
                <div class="w-px bg-gray-50"></div>
                <div class="text-center flex-1">
                    <p class="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Expenses</p>
                    <p id="total-expense" class="text-[13px] font-black text-red-500 tabular-nums">-Rp 0</p>
                </div>
            </div>
        </div>

        <!-- History Header -->
        <div class="mb-4 flex justify-between items-center px-2">
            <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">History</span>
        </div>

        <!-- Transaction List -->
        <div id="financial-items" class="bg-white rounded-[24px] overflow-hidden border border-gray-100 divide-y divide-gray-50">
            <!-- Items will be injected here -->
        </div>
    </div>

    <!-- Modern Fintech Action Dock -->
    <div class="fixed bottom-8 left-1/2 -translate-x-1/2 z-[160] w-auto">
        <div class="flex items-center bg-white/90 backdrop-blur-2xl p-2 rounded-[32px] border border-white/50 gap-1">
            <!-- Download Button -->
            <button onclick="window.downloadFinancialPDF()" class="flex items-center gap-2 px-6 py-3.5 text-[#1D1D1F] hover:bg-gray-100 rounded-full transition-all active:scale-95 group">
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="text-gray-500 group-hover:text-blue-500 transition-colors"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                <span class="text-[13px] font-black tracking-tight">Report</span>
            </button>
            
            <!-- Separator -->
            <div class="w-px h-6 bg-gray-100"></div>

            <!-- Add Transaction Button -->
            <button onclick="window.openTransactionModal()" class="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all active:scale-95 group">
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="group-hover:scale-110 transition-all"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4"></path></svg>
                <span class="text-[13px] font-black tracking-tight">Add</span>
            </button>
        </div>
    </div>

    <!-- Add Transaction Bottom Sheet (iOS Style) -->
    <div id="fin-modal" class="hidden fixed inset-0 z-[500] backdrop-blur-sm bg-black/20 transition-all duration-300 opacity-0" onclick="window.closeModal('fin-modal')">
        <div id="fin-sheet" class="absolute bottom-0 left-1/2 -translate-x-1/2 w-full md:max-w-2xl bg-white rounded-t-[40px] p-8 pb-16 translate-y-full transition-transform duration-500 ease-out" onclick="event.stopPropagation()">
            <!-- Header -->
            <div class="flex items-center justify-between mb-8">
                <button onclick="window.closeModal('fin-modal')" class="text-blue-500 font-medium text-lg px-2">Cancel</button>
                <div class="w-12 h-1.5 bg-gray-100 rounded-full"></div>
                <button id="btn-delete-transaction" class="text-red-500 p-2 hover:bg-red-50 rounded-full transition-all hidden">
                    <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
                <div id="delete-spacer" class="w-10"></div> <!-- Spacer when delete hidden -->
            </div>

            <h3 class="text-2xl font-black text-[#1D1D1F] mb-1">Add Transaction</h3>
            <p class="text-gray-400 text-sm mb-8">Record your income or expense here.</p>
            
            <div class="space-y-4 mb-10">
                <div class="bg-[#F2F2F7] p-5 rounded-3xl">
                    <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Amount</label>
                    <input type="text" id="fin-amount" inputmode="numeric" placeholder="0" class="w-full bg-transparent border-none focus:ring-0 outline-none p-0 text-[#1D1D1F] text-2xl font-bold placeholder:text-gray-300 tabular-nums">
                </div>
                
                <div class="bg-[#F2F2F7] p-5 rounded-3xl">
                    <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Description</label>
                    <textarea id="fin-note" placeholder="What is this for?" class="w-full bg-transparent border-none focus:ring-0 outline-none p-0 text-[#1D1D1F] font-medium placeholder:text-gray-300 resize-none h-24"></textarea>
                </div>
            </div>

            <div class="flex items-center justify-center gap-12">
                <button id="btn-add-expense" class="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center active:scale-90 transition-all border border-red-100 group">
                    <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="group-hover:translate-y-1 transition-transform"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 14l-7 7-7-7M12 21V3"></path></svg>
                </button>

                <button id="btn-add-income" class="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center active:scale-90 transition-all border border-green-100 group">
                    <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24" class="group-hover:-translate-y-1 transition-transform"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 10l7-7 7 7M12 3v18"></path></svg>
                </button>
            </div>
        </div>
    </div>
</section>

<!-- New Financial Record Bottom Sheet (iOS Style) -->
<div id="modal-new-financial" class="hidden fixed inset-0 z-[500] backdrop-blur-sm bg-black/20 transition-all duration-300 opacity-0" onclick="closeModal('modal-new-financial')">
    <div id="new-financial-sheet" class="absolute bottom-0 left-1/2 -translate-x-1/2 w-full md:max-w-2xl bg-white rounded-t-[40px] p-8 pb-16 translate-y-full transition-transform duration-500 ease-out" onclick="event.stopPropagation()">
        <!-- Header with Buttons -->
        <div class="flex items-center justify-between mb-8">
            <button onclick="closeModal('modal-new-financial')" class="text-blue-500 font-medium text-lg px-2">Cancel</button>
            <div class="w-12 h-1.5 bg-gray-100 rounded-full"></div>
            <button onclick="saveFinancialRecord()" id="btn-save-financial-record" disabled class="text-gray-300 font-bold text-lg px-2 transition-colors duration-200">Done</button>
        </div>
        <h3 id="modal-financial-title" class="text-2xl font-black text-[#1D1D1F] mb-1">New Record</h3>
        <p class="text-gray-400 text-sm mb-8">Set a title for your new Cashed Book.</p>
        <div class="space-y-4">
            <div class="bg-[#F2F2F7] p-5 rounded-3xl">
                <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Record Name</label>
                <input type="text" id="financial-record-title" oninput="window.updateFinSaveBtnState()" placeholder="e.g., January 2026 Expense" class="w-full bg-transparent border-none focus:ring-0 outline-none p-0 text-[#1D1D1F] text-lg font-bold placeholder:text-gray-300">
            </div>
            <div class="bg-[#F2F2F7] p-5 rounded-3xl">
                <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Description</label>
                <textarea id="financial-record-desc" placeholder="Optional notes..." class="w-full bg-transparent border-none focus:ring-0 outline-none p-0 text-[#1D1D1F] font-medium placeholder:text-gray-300 resize-none h-24"></textarea>
            </div>
        </div>
    </div>
</div>
`;
