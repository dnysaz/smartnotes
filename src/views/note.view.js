export const noteView = `
<!-- Note View -->
<section id="note-view" class="view">
    <div class="flex flex-col h-full md:px-40 px-6 py-12">
        <header class="flex justify-between items-center mb-8">
            <button class="back-btn text-blue-500 font-semibold text-lg flex items-center gap-2" data-target="home-view">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                Back
            </button>
            <div class="flex items-center gap-4">
                <button onclick="window.openNoteMenu()" class="text-[#1D1D1F] p-2 hover:bg-gray-100 rounded-full transition-all">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"></path></svg>
                </button>
            </div>
        </header>

        <!-- Dual Mode Note Content -->
        <div id="note-content-wrapper" class="flex-1 relative group">
            <!-- Magic Overlay Editor -->
            <div id="note-container" class="flex-1 relative w-full h-full">
                <!-- Highlight Layer (Behind) -->
                <div id="note-highlight" class="absolute inset-0 w-full h-full break-words whitespace-pre-wrap pointer-events-none text-[#1D1D1F] overflow-y-auto no-scrollbar"></div>
                <!-- Input Layer (Front - Transparent Text) -->
                <textarea id="note-editor" class="absolute inset-0 w-full h-full bg-transparent border-none outline-none text-transparent caret-[#1D1D1F] resize-none overflow-y-auto no-scrollbar" placeholder="Start writing..."></textarea>
            </div>
        </div>
    </div>
</section>

<!-- Todo View -->
<section id="todo-view" class="view">
    <div class="flex flex-col h-full md:px-40 px-6 py-12">
        <header class="flex justify-between items-center mb-8">
            <button class="back-btn text-blue-500 font-semibold text-lg flex items-center gap-2" data-target="home-view">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                Back
            </button>
            <div class="flex items-center gap-4">
                <button onclick="window.openNoteMenu()" class="text-[#1D1D1F] p-2 hover:bg-gray-100 rounded-full transition-all">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"></path></svg>
                </button>
            </div>
        </header>
        <div class="mb-6">
            <input type="text" id="todo-title-input" class="text-2xl font-bold bg-transparent border-none outline-none w-full placeholder-gray-200" placeholder="Untitled List">
        </div>
        <div id="todo-list-items" class="flex-1 overflow-y-auto no-scrollbar space-y-1 pb-20"></div>
    </div>
    </div>
</section>

<!-- Scan View -->
<section id="scan-view" class="view !p-0">
    <nav class="absolute top-0 left-0 right-0 z-10 p-6 flex items-center bg-white/80 backdrop-blur-md">
        <button class="back-btn text-gray-500 font-semibold text-lg flex items-center gap-2" data-target="home-view">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
            Cancel
        </button>
    </nav>
    <div class="relative h-full w-full bg-black flex items-center justify-center">
        <video id="camera-preview" autoplay playsinline class="h-full w-full object-cover"></video>
        <canvas id="camera-canvas" style="display:none;"></canvas>
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div class="w-72 h-96 border-2 border-white/30 rounded-3xl"></div>
        </div>
        <div id="scan-status" class="absolute bottom-36 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md text-white text-base font-medium px-6 py-3 rounded-full whitespace-nowrap hidden"></div>
        <button id="capture-btn" class="absolute bottom-10 w-20 h-20 rounded-full border-4 border-white/50 bg-white flex items-center justify-center"></button>
    </div>
</section>

<!-- Trash View -->
<section id="trash-view" class="view">
    <div class="flex flex-col h-full md:px-40 px-6 py-12">
        <header class="flex justify-between items-center mb-8">
            <button class="back-btn text-blue-500 font-semibold text-lg flex items-center gap-2" data-target="home-view">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                Back
            </button>
            <h2 class="text-lg font-bold text-[#1D1D1F]">Recently Deleted</h2>
            <button id="btn-empty-trash" class="text-sm font-semibold text-red-500">Empty</button>
        </header>
        <div id="trash-items" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 pb-20 overflow-y-auto no-scrollbar"></div>
    </div>
</section>

<!-- Note/Todo Context Menu Bottom Sheet -->
<div id="note-menu-modal" class="hidden fixed inset-0 z-[2100] bg-black/20 backdrop-blur-sm transition-all duration-300 opacity-0" onclick="window.closeNoteMenu()">
    <div id="note-menu-sheet" class="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white rounded-t-[40px] p-8 translate-y-full transition-transform duration-500 ease-out" onclick="event.stopPropagation()">
        <div class="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-8"></div>
        
        <div class="flex flex-col divide-y divide-gray-100">
            <button onclick="window.handleMenuShare()" class="flex items-center gap-5 py-5 active:bg-gray-50 transition-all text-left group px-2">
                <div class="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                </div>
                <div>
                    <p class="font-bold text-[#1D1D1F]">Share</p>
                    <p class="text-[13px] text-gray-400 font-medium">Send to other apps</p>
                </div>
            </button>
            
            <button onclick="window.handleMenuDownload()" class="flex items-center gap-5 py-5 active:bg-gray-50 transition-all text-left group px-2">
                <div class="w-12 h-12 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                </div>
                <div>
                    <p class="font-bold text-[#1D1D1F]">Download</p>
                    <p class="text-[13px] text-gray-400 font-medium">Save as file</p>
                </div>
            </button>
        </div>
        
        <button onclick="window.closeNoteMenu()" class="w-full py-4 bg-[#F2F2F7] text-[#1D1D1F] rounded-2xl font-bold active:scale-95 transition-all mt-6">Cancel</button>
    </div>
</div>
`;
