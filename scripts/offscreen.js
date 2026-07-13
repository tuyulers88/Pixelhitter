/**
 * Refactored & Deobfuscated Offscreen Document Engine
 * Nama Modul: PixelOffscreenWorker
 * Deskripsi: Menyediakan lingkungan DOM tersembunyi untuk menangani pemutaran audio,
 * sintesis frekuensi suara (Web Audio API), dan akses manipulasi Clipboard (Papan Klip).
 */

(function() {
    // Mencegah inisialisasi ganda pada runtime window offscreen dokumen
    if (window.__pixel_offscreen_worker_active__) return;
    window.__pixel_offscreen_worker_active__ = true;

    // --- INSTANCE RUNTIME AUDIO GLOBAL ---
    let backgroundMusicAudio = null;
    let customPreviewAudio = null;


    // ===================================================
    // --- SEKTOR 1: MESIN SINTESIS SUARA (WEB AUDIO) ---
    // ===================================================

    /**
     * Mensintesis rangkaian nada musik indah (Arpeggio) langsung lewat perangkat keras audio 
     * jika file media eksternal/lokal tidak tersedia (Programmatic Fallback Audio).
     */
    function playFallbackSound() {
        try {
            // Inisialisasi AudioContext lintas peramban (modern & legacy webkit)
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;

            const audioCtx = new AudioContextClass();
            const currentTime = audioCtx.currentTime;

            // Rangkaian fungsi pembentuk gelombang suara oscillator dinamis
            const triggerNote = (frequency, startTime, duration) => {
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();

                // Konfigurasi struktur node Web Audio
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);

                oscillator.type = "sine"; // Gelombang sinus murni lembut
                oscillator.frequency.value = frequency;

                // Mengatur kurva modulasi volume suara (Envelope Fade-out)
                gainNode.gain.setValueAtTime(0.3, startTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

                // Jalankan dan matikan osilator sesuai durasi milidetik
                oscillator.start(startTime);
                oscillator.stop(startTime + duration);
            };

            // Memainkan akord sukses C-Major Arpeggio (C5 -> E5 -> G5 -> C6)
            triggerNote(523.25, currentTime, 0.15);
            triggerNote(659.25, currentTime + 0.12, 0.15);
            triggerNote(783.99, currentTime + 0.24, 0.15);
            triggerNote(1046.50, currentTime + 0.36, 0.30);

        } catch (error) {
            console.error("Gagal mengeksekusi sintesis Web Audio API:", error);
        }
    }


    // ===================================================
    // --- SEKTOR 2: PENGENDALIAN AUDIO & AUDIO MEDIA ---
    // ===================================================

    /**
     * Memutar notifikasi audio sukses pemrosesan data.
     * @param {string} audioUrl - Path/URL lokal dari file audio target.
     */
    function playSuccessSound(audioUrl) {
        if (!audioUrl) {
            playFallbackSound();
            return;
        }

        try {
            const audioInstance = new Audio(audioUrl);
            audioInstance.volume = 0.5; // Batas volume aman standar ekstensinya

            audioInstance.play().catch((err) => {
                console.warn("Audio file gagal dimuat, mengalihkan ke sintesis Web Audio...");
                playFallbackSound(); // Fallback instan jika file rusak/tidak diizinkan autoplay
            });
        } catch (e) {
            playFallbackSound();
        }
    }

    /**
     * Memulai pemutaran musik latar belakang secara berulang (Looping Background Track).
     * @param {string} audioUrl - URL/Path target file audio.
     * @param {number} targetVolume - Kekuatan suara (default: 0.5).
     */
    function playBackgroundMusic(audioUrl, targetVolume = 0.5) {
        try {
            // Hentikan track lama jika sedang berjalan
            stopBackgroundMusic();

            backgroundMusicAudio = new Audio(audioUrl);
            backgroundMusicAudio.loop = true; // Setelan looping aktif bawaan asli
            backgroundMusicAudio.volume = targetVolume;

            backgroundMusicAudio.play().catch(e => {
                console.error("Gagal memutar musik latar belakang:", e);
            });
        } catch (error) {}
    }

    /**
     * Menghentikan total pemutaran musik latar belakang dan menghapus instansinya dari memori.
     */
    function stopBackgroundMusic() {
        try {
            if (backgroundMusicAudio) {
                backgroundMusicAudio.pause();
                backgroundMusicAudio.currentTime = 0;
                backgroundMusicAudio = null;
            }
        } catch (e) {}
    }

    /**
     * Memutar track pratinjau kustom sementara (Preview Audio).
     */
    function playCustomPreview(audioUrl) {
        try {
            stopCustomPreview();

            if (!audioUrl) return;

            customPreviewAudio = new Audio(audioUrl);
            customPreviewAudio.volume = 0.5;
            customPreviewAudio.play().catch(e => {
                // Sintesis nada tiruan jika preview kustom gagal dimuat
                playFallbackSound();
            });
        } catch (error) {
            playFallbackSound();
        }
    }

    /**
     * Menghentikan track pratinjau kustom sementara.
     */
    function stopCustomPreview() {
        try {
            if (customPreviewAudio) {
                customPreviewAudio.pause();
                customPreviewAudio.currentTime = 0;
                customPreviewAudio = null;
            }
        } catch (e) {}
    }


    // ===================================================
    // --- SEKTOR 3: MANIPULASI DOM & CLIPBOARD ---
    // ===================================================

    /**
     * Menyalin teks mentah yang dikirim dari background script ke clipboard sistem operasi.
     * @param {string} textToCopy - Teks target penyalinan.
     */
    async function copyToClipboard(textToCopy) {
        if (!textToCopy) return;
        try {
            // Menggunakan API Clipboard asinkron modern peramban
            await navigator.clipboard.writeText(textToCopy);
            console.log("Teks berhasil disalin ke clipboard via Offscreen Document.");
        } catch (error) {
            console.error("Gagal menyalin teks ke papan klip:", error);
        }
    }


    // ===================================================
    // --- REGISTRASI MESSAGING BRIDGE (ROUTER UTAMA) ---
    // ===================================================

    // Mendengarkan instruksi pesan yang dilemparkan oleh background.js/service worker
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message || typeof message !== "object") return false;

        const actionType = message.action || message.type;
        const payload = message.payload || {};

        switch (actionType) {
            case "PLAY_SUCCESS_SOUND":
                playSuccessSound(payload.url || message.url);
                sendResponse({ success: true });
                break;

            case "PLAY_BACKGROUND_MUSIC":
                playBackgroundMusic(payload.url || message.url, payload.volume || message.volume);
                sendResponse({ success: true });
                break;

            case "STOP_BACKGROUND_MUSIC":
                stopBackgroundMusic();
                sendResponse({ success: true });
                break;

            case "PLAY_CUSTOM_PREVIEW":
                playCustomPreview(payload.url || message.url);
                sendResponse({ success: true });
                break;

            case "STOP_CUSTOM_PREVIEW":
                stopCustomPreview();
                sendResponse({ success: true });
                break;

            case "COPY_TO_CLIPBOARD":
                copyToClipboard(payload.text || message.text);
                sendResponse({ success: true });
                break;

            default:
                // Mengembalikan respon false jika aksi tidak dikenal
                sendResponse({ success: false, error: "Aksi offscreen tidak dikenali." });
                break;
        }

        return true; // Menjaga channel komunikasi tetap terbuka untuk operasi asinkron
    });

    // --- INISIALISASI PEMUTAN KONTROL DOM LIFECYCLE ---
    document.addEventListener("DOMContentLoaded", () => {
        console.log("Pixel Offscreen Document Document Worker siap menerima instruksi.");
    });

})();
