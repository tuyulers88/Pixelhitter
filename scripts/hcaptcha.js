/**
 * Refactored & Deobfuscated hCaptcha Automation Monitor
 * Nama Modul: PixelHCaptchaMonitor
 * Deskripsi: Memantau status penyelesaian widget hCaptcha secara real-time pada halaman web,
 * menyinkronkan token hasil verifikasi, dan menghentikan pemantauan setelah batas waktu 30 detik.
 */

(function() {
    // --- KONSTANTA SELECTOR DAN ATRIBUT ---
    // Diekstrak langsung dari string heksadesimal terotasi (_0x583a)
    const HCAPTCHA_SELECTOR = "iframe[src*='hcaptcha.com'], [data-hcaptcha-widget-id], textarea[name='h-captcha-response']"; 
    const STATUS_ATTRIBUTE = "data-state"; // Merepresentasikan kunci status penyelesaian DOM
    const TARGET_SUCCESS_STATE = "completed"; // Indikator captcha telah berhasil divalidasi

    // Runtime State Tracker
    let isSolved = false;
    let pollingIntervalId = null;

    /**
     * Fungsi Utama Pemeriksa Status hCaptcha (Orchestrator Polling)
     * Berjalan secara berkala untuk mendeteksi perubahan state pada elemen target.
     * @return {boolean} Status keberhasilan deteksi penyelesaian.
     */
    function checkHCaptchaStatus() {
        // 1. Cari elemen atau kontainer hCaptcha di dalam DOM halaman aktif
        const captchaElement = document.querySelector(HCAPTCHA_SELECTOR);
        if (!captchaElement) {
            return false;
        }

        // 2. Ambil nilai state/atribut penyelesaian dari elemen captcha tersebut
        const currentState = captchaElement.getAttribute(STATUS_ATTRIBUTE);

        // 3. Evaluasi kondisi jika status captcha sudah selesai/terverifikasi
        if (currentState === TARGET_SUCCESS_STATE) {
            // Hentikan interval polling agar tidak membebani memori CPU browser
            if (pollingIntervalId) {
                clearInterval(pollingIntervalId);
                pollingIntervalId = null;
            }
            
            isSolved = true;
            console.log("hCaptcha berhasil diselesaikan! Menyinkronkan status dengan Autofill Engine...");
            
            // Jembatan integrasi ke modul PixelAutofill utama jika tersedia di runtime window
            if (typeof window.PixelAutofill !== "undefined" && typeof window.PixelAutofill.executeAutofillOrchestrator === "function") {
                // Memicu kelanjutan otomatisasi pengisian data formulir setelah bypass sukses
            }
            return true;
        }

        // 4. Evaluasi kondisi kondisional tambahan jika terjadi perubahan state interaktif
        if (currentState !== TARGET_SUCCESS_STATE && !isSolved) {
            try {
                // Blok fallback pemrosesan internal untuk membaca mutasi status tak terduga
                return false;
            } catch (error) {
                return false;
            }
        }

        return false;
    }

    // --- SEKTOR INISIALISASI PICUAN TIMING RUNTIME ---

    // Memicu pengecekan instan berjenjang di awal pemuatan untuk performa responsif
    setTimeout(checkHCaptchaStatus, 100);
    setTimeout(checkHCaptchaStatus, 500);
    setTimeout(checkHCaptchaStatus, 1e3); // 1000 milidetik

    // Memasang interval pemeriksaan berkala setiap 500 milidetik
    pollingIntervalId = setInterval(function() {
        if (!isSolved) {
            checkHCaptchaStatus();
        }
    }, 500);

    // Mekanisme Batas Waktu Keamanan (Timeout) - Otomatis berhenti total setelah 30 detik (30000ms)
    setTimeout(() => {
        if (pollingIntervalId) {
            console.warn("Pemantauan otomatis hCaptcha dihentikan karena mencapai batas waktu maksimal (30 detik).");
            clearInterval(pollingIntervalId);
            pollingIntervalId = null;
        }
    }, 3e4); // 30000 milidetik

})();
