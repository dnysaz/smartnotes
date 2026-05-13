# Laporan Audit Kode — Smart Note

> Tanggal: 13 Mei 2026

---

## 🔴 Security Issues

### S-1: Gemini API Key Bocor ke Client-side (KRITIS)
- **Lokasi:** `.env:20`, `src/main.js:1266`
- **Deskripsi:** `VITE_GEMINI_API_KEY=AIzaSyAG-p1nmHc7b3U-GKNLBdP1eCOJmlSZWRo` menggunakan prefix `VITE_`, yang menyebabkan Vite meng-inline key ini ke dalam bundle JavaScript. Padahal file `.env` sendiri sudah memberi peringatan _"BERBAYAR — JANGAN pakai VITE_ prefix!"_.
- **Dampak:** Siapa pun yang membuka DevTools dapat melihat API key berbayar ini. Riskan disalahgunakan orang lain (`API key abuse`).
- **Rekomendasi:** Hapus `VITE_GEMINI_API_KEY` dari `.env`. Gunakan hanya di Vercel Environment Variables (server-side) tanpa prefix `VITE_`. Untuk development, gunakan proxy atau fallback terbatas.

### S-2: Google OAuth Client ID dan DRIVE_SECRET di `.env`
- **Lokasi:** `.env:14,23`
- **Deskripsi:** `VITE_GOOGLE_CLIENT_ID` dan `DRIVE_SECRET` tersimpan di file `.env`. Meskipun `DRIVE_SECRET` tidak bocor ke client (tanpa prefix VITE_), `VITE_GOOGLE_CLIENT_ID` akan terekspos. Google OAuth Client ID sebenarnya publik, tapi jika tidak dibatasi HTTP Referrer, bisa dipakai oleh pihak lain.
- **Rekomendasi:** Pastikan di Google Cloud Console, OAuth Client ID dibatasi dengan Authorized JavaScript Origins dan Authorized Redirect URIs yang spesifik.

---

## 🔴 Bugs Fungsional

### B-1: Duplicate Function Definitions — Override Tidak Disengaja
- **Lokasi:** `src/main.js:114` dan `:1753` (`handleGoogleLogin`), `:1456` dan `:1594` (`handleMenuShare`), `:444` dan `:1375` (`editFinancialRecord`), `:292` dan `:1390` (`showFinancialRecordModal`), `:230` dan `:1359` (`closeModal`), `:261` dan `:1400` (`closeAllMenus`)
- **Deskripsi:** 6 pasang fungsi didefinisikan dua kali. Definisi kedua menimpa yang pertama. Definisi pertama menjadi dead code, menyebabkan kebingungan saat debugging.
- **Rekomendasi:** Hapus semua definisi duplikat, pertahankan yang lebih lengkap.

### B-2: Share & Download Todo Gunakan `completed` Bukan `done`
- **Lokasi:** `src/main.js:1470,1506,1608`
- **Deskripsi:** Saat membagikan (share) atau mendownload todo, kode menggunakan properti `i.completed` untuk mengecek status checklist:
  ```js
  todo.items.map(i => `${i.completed ? '[x]' : '[ ]'} ${i.text}`)
  ```
  Namun model data menggunakan `done` (lihat `createNewTodo()` baris 668 dan `renderTodoView()` baris 748).
- **Dampak:** Semua item todo akan selalu tampil sebagai `[ ]` (belum selesai) saat di-share/di-download, meskipun sudah dicentang.
- **Rekomendasi:** Ganti semua `i.completed` menjadi `i.done`.

### B-3: `window.closeActionModal` Tidak Pernah Didefinisikan
- **Lokasi:** `src/views/home.view.js:62`
- **Deskripsi:** Modal action sheet memanggil `window.closeActionModal()` saat backdrop diklik, tapi fungsi tersebut tidak pernah didefinisikan di `main.js`.
- **Dampak:** Klik backdrop action modal akan throw error `window.closeActionModal is not a function`.
- **Rekomendasi:** Ganti dengan `window.closeModal('action-modal')` atau `closeAllMenus()`.

### B-4: AI Scan Note Tidak Memperbarui Highlight
- **Lokasi:** `src/main.js:1319-1324`
- **Deskripsi:** Setelah AI scan selesai, hasil note diisi ke editor (`noteEditor.value = note.content`) tapi `updateNoteHighlight()` tidak dipanggil. Akibatnya link/highlight tidak muncul hingga user mengetik sesuatu.
- **Rekomendasi:** Tambahkan `updateNoteHighlight()` setelah mengisi `noteEditor.value`.

### B-5: Event Listener Leak di `showConfirm`
- **Lokasi:** `src/main.js:270-275` (backdrop click handler), `:162-215` (`showConfirm`)
- **Deskripsi:** Saat modal confirm dibuka, event listener baru ditambahkan ke tombol-tombolnya. Jika user menutup modal dengan mengklik backdrop (bukan tombol), listener tidak pernah dibersihkan karena fungsi `close()` tidak dipanggil.
- **Dampak:** Setiap kali modal dibuka-tutup via backdrop, listener baru menumpuk. Potensi memory leak dan eksekusi ganda.
- **Rekomendasi:** Di backdrop handler, panggil fungsi cleanup yang tepat, atau gunakan event delegation dengan sekali bind.

### B-6: Service Worker Caching Rusak
- **Lokasi:** `public/sw.js`
- **Deskripsi:** Tiga masalah:
  1. `CACHE_NAME = 'pocket-ai-v3'` — nama lama, bukan "Smart Note"
  2. `ASSETS` mencantumkan `/pocket_ai_icon.png` — file tidak ada (seharusnya `smart_note_icon.png`)
  3. `ASSETS` mencantumkan `/src/main.js` dan `/src/style.css` — setelah di-build oleh Vite, file-file ini tidak ada di root, melainkan di `dist/assets/`
- **Dampak:** Service Worker gagal meng-cache file-file penting. Cache-only fallback mungkin gagal saat offline.
- **Rekomendasi:** Perbaiki nama cache, dan gunakan strategi caching yang sesuai untuk Vite build output.

### B-7: `switchView` Bisa Throw Error Jika View Tidak Ditemukan
- **Lokasi:** `src/main.js:502`
- **Deskripsi:** Setelah mengecek `target` null (line 498), kode tetap menjalankan `document.getElementById(viewId).scrollTop = 0` di line 502. Jika view tidak ditemukan, ekspresi ini throw `TypeError`.
- **Rekomendasi:** Pindahkan line 502 ke dalam blok `if (target)`.

### B-8: Duplikasi State `financial_records_data` Bisa Overwrite Data
- **Lokasi:** `src/financial.js:16-17,53`
- **Deskripsi:** `initFinancial()` membaca semua data financial records dari localStorage, lalu memodifikasi satu record, lalu menyimpan seluruh object. Jika ada perubahan pada record lain (dari tab lain, dll), data tersebut akan tertimpa dengan snapshot yang diambil di awal.
- **Dampak:** Potensi kehilangan data financial jika ada concurrent access.
- **Rekomendasi:** Baca-tulis per record secara spesifik, atau gunakan pendekatan merge.

### B-9: Format Angka Financial Tidak Mendukung Desimal
- **Lokasi:** `src/financial.js:200-207,212`
- **Deskripsi:** Input amount menggunakan `toLocaleString('id-ID')` yang memformat angka dengan titik sebagai pemisah ribuan dan koma sebagai desimal. Namun parsing hanya menghapus titik (`.`), tidak menangani koma (`,`).
- **Dampak:** Jika user memasukkan nilai desimal (misal `1000,50`), akan diubah menjadi `100050`. Data corruption.
- **Rekomendasi:** Gunakan integer-based currency (simpan dalam sen/rupiah terkecil) atau tangani desimal dengan benar.

---

## 🟡 Code Quality Issues

### Q-1: Inline Event Handlers di HTML (`onclick`, `oninput`)
- **Lokasi:** Semua file di `src/views/*.view.js`
- **Deskripsi:** Menggunakan atribut HTML inline seperti `onclick="window.handleMenuShare()"`, `oninput="window.updateFinSaveBtnState()"`. Ini membuat global namespace penuh dengan fungsi `window.*`, menyulitkan testing dan maintenance.
- **Rekomendasi:** Migrasi ke `addEventListener` di `main.js` secara terpusat.

### Q-2: Hardcoded Color/Class di JavaScript
- **Lokasi:** `src/main.js:700-935` (renderRecent, renderTrash, renderTodoView)
- **Deskripsi:** Class Tailwind lengkap di-hardcode di dalam string template JavaScript. Sangat sulit di-maintain dan rawan typo.
- **Rekomendasi:** Gunakan utility functions untuk class composition, atau pertimbangkan framework component.

### Q-3: Pin Icon Warna Tidak Konsisten
- **Lokasi:** `src/main.js:897` (list view) vs `:910` (grid view)
- **Deskripsi:** Di list view pin aktif berwarna `text-orange-400`, di grid view `text-blue-500`. Tidak konsisten secara visual.
- **Rekomendasi:** Gunakan warna yang konsisten.

### Q-4: Dead Code — File `src/counter.js`
- **Lokasi:** `src/counter.js`
- **Deskripsi:** File sisa dari template Vite, tidak pernah diimpor.
- **Rekomendasi:** Hapus file.

---

## 🟡 Info Lain

| Item | Detail |
|------|--------|
| **Penyimpanan** | Semua data di localStorage. Tidak ada backup otomatis selain Google Drive sync (opsional). Risiko kehilangan data jika localStorage dibersihkan. |
| **Google API Key** | `VITE_GOOGLE_API_KEY` kosong di `.env`. Pastikan diisi jika ingin Google Drive sync berfungsi. |
| **Redirect URI** | `GOOGLE_REDIRECT=http://localhost:5174/google-login` — hanya untuk localhost, perlu disesuaikan untuk production. |
| **Zoom Prevention** | `touchstart` dan `gesturestart` di-prevent (line 1883-1889). Ini mencegah pinch-to-zoom di mobile, termasuk zoom yang mungkin diinginkan user. |
| **Double-tap Prevention** | `touchend` double-tap dalam 300ms di-prevent (line 1891-1898). Ini mencegah zoom, tapi juga mencegah interaksi double-tap yang sah. |

---

## Ringkasan Prioritas

| Prioritas | Item | Dampak |
|-----------|------|--------|
| 🔴 Critical | S-1 (Gemini Key leak) | Penyalahgunaan API key berbayar |
| 🔴 Critical | B-2 (completed vs done) | Fitur share/download todo rusak |
| 🔴 High | B-3 (closeActionModal) | Error saat tutup modal |
| 🔴 High | B-6 (SW broken) | Offline mode tidak bekerja |
| 🟡 Medium | B-4 (highlight not updated) | Visual bug setelah AI scan |
| 🟡 Medium | B-5 (listener leak) | Potensi memory leak |
| 🟡 Medium | B-8 (financial overwrite) | Potensi kehilangan data financial |
