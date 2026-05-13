export const authView = `
<section id="login-view" class="view" style="position:fixed; inset:0; z-index:2000; background:white;">
    <div class="max-w-sm w-full text-center px-8 h-full flex flex-col justify-center items-center pb-20">
        <!-- Minimalist Smart Note Icon (No BG) -->
        <div class="relative w-24 h-24 mx-auto mb-8 flex items-center justify-center">
            <!-- Doodle/Coretan Background -->
            <svg class="absolute inset-0 text-blue-500/20 scale-125" viewBox="0 0 100 100" fill="none" stroke="currentColor">
                <path d="M20 70 C 30 10, 70 90, 80 30" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M30 50 Q 50 20 70 50" stroke-width="2" stroke-dasharray="4 4"/>
            </svg>
            <!-- Premium Pencil Icon -->
            <svg width="52" height="52" fill="none" stroke="#1D1D1F" viewBox="0 0 24 24" class="z-10">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
            </svg>
        </div>
        
        <h1 class="text-4xl font-black text-[#1D1D1F] mb-3 tracking-tighter">Smart Note</h1>
        <p class="text-gray-400 text-lg mb-12 leading-tight">Your intelligent workspace for notes, tasks, and finances.</p>
        
        <div class="space-y-4 w-full">
            <button onclick="window.handleGoogleLogin()" class="w-full py-4 bg-[#1D1D1F] text-white rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-all">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.26 1.07-3.71 1.07-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.67-.35-1.39-.35-2.09s.13-1.42.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
            </button>
            
            <button onclick="window.skipLogin()" class="w-full py-4 bg-white text-[#1D1D1F] border border-gray-100 rounded-2xl font-bold active:scale-95 transition-all">
                Continue as Guest
            </button>
        </div>
        
        <!-- Updated Footer with Bottom Sheet Triggers -->
        <div class="absolute bottom-12 w-full left-0 px-8 text-center space-y-6">
            <p class="text-[11px] text-gray-400 leading-relaxed max-w-[280px] mx-auto">
                We don't store your data on our servers. All your entries are stored locally or in your Google Drive.
            </p>
            
            <div class="flex items-center justify-center gap-6">
                <button onclick="window.toggleAuthSheet('auth-terms-sheet')" class="text-[12px] font-bold text-blue-500 hover:underline">Terms</button>
                <div class="w-1 h-1 bg-gray-200 rounded-full"></div>
                <button onclick="window.toggleAuthSheet('auth-help-sheet')" class="text-[12px] font-bold text-blue-500 hover:underline">Help</button>
            </div>
        </div>
    </div>

        </div>
    </div>
</section>

`;
