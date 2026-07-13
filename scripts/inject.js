/**
 * Refactored & Deobfuscated Core Injected Spoofing Engine
 * Nama Modul: PixelFingerprintInjector
 * Deskripsi: Disuntikkan langsung ke window context halaman web untuk memodifikasi
 * API browser bawaan (Canvas, WebGL, Audio, Intl, Navigator) guna mencegah pelacakan sidik jari.
 */

(function() {
    // Mencegah penyuntikan ganda jika skrip tidak sengaja terpanggil dua kali
    if (window.__pixel_fingerprint_injector_active__) return;
    window.__pixel_fingerprint_injector_active__ = true;

    // --- STATE & CACHE ORIGINAL API ---
    // Menyimpan fungsi asli bawaan browser sebelum dimodifikasi (Hooking Protection)
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
    const originalGetChannelData = AudioBuffer.prototype.getChannelData;
    const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
    const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;

    // Configuration Placeholder (Menerima parameter dinamis dari content.js bridge)
    let currentProfile = null;
    let activeSettings = {
        userAgent: true, canvas: true, audio: true, webgl: true,
        webgpu: true, voice: true, plugins: true, fonts: true,
        screen: true, timezone: true
    };

    // --- UTILITY: GENERATOR NOISE (ANTI-FINGERPRINT) ---

    /**
     * Membuat nilai noise deterministik mikro berdasarkan seed sesi agar manipulasi piksel
     * terlihat konsisten di mata pelacak namun berbeda antar sesi/perangkat.
     */
    function getDeterministicNoise(seed, factor = 0.0001) {
        const x = Math.sin(seed) * 10000;
        return (x - Math.floor(x)) * factor;
    }


    // ===============================================
    // --- SEKTOR HOOKING 1: NAVIGATOR & USER AGENT ---
    // ===============================================
    function applyNavigatorHooks(profile) {
        if (!activeSettings.userAgent || !profile) return;

        try {
            // 1. Modifikasi Properti String Navigator Standar
            Object.defineProperty(Navigator.prototype, "userAgent", {
                get: () => profile.userAgent || navigator.userAgent,
                configurable: true
            });
            Object.defineProperty(Navigator.prototype, "platform", {
                get: () => profile.platform || navigator.platform,
                configurable: true
            });
            Object.defineProperty(Navigator.prototype, "appVersion", {
                get: () => profile.appVersion || navigator.appVersion,
                configurable: true
            });
            Object.defineProperty(Navigator.prototype, "languages", {
                get: () => profile.languages || navigator.languages,
                configurable: true
            });

            // 2. Modifikasi Properti Hardware & Spesifikasi Perangkat
            if (profile.hardwareConcurrency) {
                Object.defineProperty(Navigator.prototype, "hardwareConcurrency", {
                    get: () => parseInt(profile.hardwareConcurrency),
                    configurable: true
                });
            }
            if (profile.deviceMemory) {
                Object.defineProperty(Navigator.prototype, "deviceMemory", {
                    get: () => parseFloat(profile.deviceMemory),
                    configurable: true
                });
            }

            // 3. Emulasi Objek navigator.userAgentData (Client Hints Modern Bypass)
            if (navigator.userAgentData && profile.userAgentDataMetadata) {
                const mockUaData = profile.userAgentDataMetadata;
                
                const MockUserAgentData = function() {};
                MockUserAgentData.prototype = Object.create(navigator.userAgentData.__proto__);
                
                Object.defineProperty(MockUserAgentData.prototype, "brands", {
                    get: () => mockUaData.brands, configurable: true
                });
                Object.defineProperty(MockUserAgentData.prototype, "mobile", {
                    get: () => mockUaData.mobile, configurable: true
                });
                Object.defineProperty(MockUserAgentData.prototype, "platform", {
                    get: () => mockUaData.platform, configurable: true
                });
                
                MockUserAgentData.prototype.getHighEntropyValues = function(hints) {
                    return new Promise((resolve) => {
                        const result = {};
                        hints.forEach(hint => {
                            result[hint] = mockUaData[hint] || navigator.userAgentData[hint];
                        });
                        // Selalu sertakan platform dan versi dasar
                        result.platform = mockUaData.platform;
                        result.platformVersion = mockUaData.platformVersion || "10.0.0";
                        resolve(result);
                    });
                };

                Object.defineProperty(navigator, "userAgentData", {
                    get: () => new MockUserAgentData(),
                    configurable: true
                });
            }
        } catch (e) {
            console.error("Gagal menerapkan Navigator hooks:", e);
        }
    }


    // ===============================================
    // --- SEKTOR HOOKING 2: CANVAS MANIPULATION ---
    // ===============================================
    function applyCanvasHooks(seedValue) {
        if (!activeSettings.canvas) return;

        try {
            // Modifikasi pembacaan data biner gambar kanvas (Canvas Pixel Spoofer)
            CanvasRenderingContext2D.prototype.getImageData = function(x, y, width, height) {
                const imageData = originalGetImageData.apply(this, arguments);
                const pixels = imageData.data;
                const noise = Math.floor(getDeterministicNoise(seedValue, 3)); // Noise sangat kecil pada piksel akhir

                // Menyisipkan noise mikro pada channel warna RGBA tanpa merusak visual mata manusia
                for (let i = 0; i < pixels.length; i += 4) {
                    pixels[i] = Math.min(255, Math.max(0, pixels[i] + (noise % 2)));     // R
                    pixels[i+1] = Math.min(255, Math.max(0, pixels[i+1] + (noise % 2))); // G
                    pixels[i+2] = Math.min(255, Math.max(0, pixels[i+2] + (noise % 2))); // B
                }
                return imageData;
            };

            // Mengamankan konversi kanvas ke format string Base64 / Blob Data
            HTMLCanvasElement.prototype.toDataURL = function() {
                const ctx = this.getContext("2d");
                if (ctx instanceof CanvasRenderingContext2D) {
                    // Pemicu pemicu manipulasi piksel sebelum render string dilakukan
                    ctx.getImageData(0, 0, 1, 1);
                }
                return originalToDataURL.apply(this, arguments);
            };
        } catch (e) {
            console.error("Gagal menerapkan Canvas protection hooks:", e);
        }
    }


    // ===============================================
    // --- SEKTOR HOOKING 3: WEBGL GRAPHICS CARD ---
    // ===============================================
    function applyWebGLHooks(profile) {
        if (!activeSettings.webgl || !profile || !profile.webgl) return;

        try {
            const webglMeta = profile.webgl;

            // Intersepsi pembacaan informasi Vendor dan Renderer Kartu Grafis (GPU)
            WebGLRenderingContext.prototype.getParameter = function(parameterId) {
                // UNMASKED_VENDOR_WEBGL (0x9245)
                if (parameterId === 0x9245 && webglMeta.vendor) {
                    return webglMeta.vendor;
                }
                // UNMASKED_RENDERER_WEBGL (0x9246)
                if (parameterId === 0x9246 && webglMeta.renderer) {
                    return webglMeta.renderer;
                }
                // Vendor & Renderer standar (0x1F00, 0x1F01)
                if (parameterId === 0x1F00 && webglMeta.vendor) return webglMeta.vendor;
                if (parameterId === 0x1F01 && webglMeta.renderer) return webglMeta.renderer;

                return originalGetParameter.apply(this, arguments);
            };

            // Menyinkronkan fungsi pada WebGL2 jika browser mendukungnya
            if (window.WebGL2RenderingContext) {
                WebGL2RenderingContext.prototype.getParameter = WebGLRenderingContext.prototype.getParameter;
            }
        } catch (e) {
            console.error("Gagal menerapkan WebGL hooks:", e);
        }
    }


    // ===============================================
    // --- SEKTOR HOOKING 4: AUDIO CONTEXT PRIVACY ---
    // ===============================================
    function applyAudioHooks(seedValue) {
        if (!activeSettings.audio) return;

        try {
            // Memanipulasi keluaran data biner gelombang audio untuk mengecoh algoritma pelacak audio
            AudioBuffer.prototype.getChannelData = function(channelIndex) {
                const channelData = originalGetChannelData.apply(this, arguments);
                const noiseFactor = getDeterministicNoise(seedValue, 0.0000001); // Noise mikro skala nano

                for (let i = 0; i < channelData.length; i++) {
                    channelData[i] += noiseFactor;
                }
                return channelData;
            };
        } catch (e) {
            console.error("Gagal menerapkan Audio hooks:", e);
        }
    }


    // ===============================================
    // --- SEKTOR HOOKING 5: GEOGRAPHY & TIMEZONE ---
    // ===============================================
    function applyGeographicHooks(profile) {
        if (!activeSettings.timezone || !profile || !profile.timezone) return;

        try {
            const targetTimezone = profile.timezone;

            // 1. Modifikasi Intl Resolved Options (Bypass Deteksi Zona Waktu Lokal Halaman)
            Intl.DateTimeFormat.prototype.resolvedOptions = function() {
                const options = originalResolvedOptions.apply(this, arguments);
                options.timeZone = targetTimezone; // Dipaksa mengikuti lokasi IP Proxy aktif
                if (profile.locale) {
                    options.locale = profile.locale;
                }
                return options;
            };

            // 2. Modifikasi Pergeseran Menit Waktu GTM (Date Offset)
            // Menggunakan pemetaan zona waktu tiruan untuk mendapatkan nilai menit offset yang tepat
            Date.prototype.getTimezoneOffset = function() {
                // Estimasi offset berdasarkan profil lokasi geografi (contoh default untuk penyelarasan)
                if (targetTimezone.includes("America")) return 300; // EST Fallback
                if (targetTimezone.includes("Europe")) return -60;  // CET Fallback
                if (targetTimezone.includes("Asia/Jakarta")) return -420; // GMT+7
                return originalGetTimezoneOffset.apply(this, arguments);
            };
        } catch (e) {
            console.error("Gagal menerapkan Geographic hooks:", e);
        }
    }


    // ===============================================
    // --- REGISTRASI INISIALISASI DAN BRIDGE LISTENER ---
    // ===============================================
    
    /**
     * Memproses data profil akhir yang diterima dari content script untuk menjalankan seluruh sektor hook.
     */
    function initializeFingerprintSpoofing(payload) {
        if (!payload) return;

        currentProfile = payload.profile || {};
        activeSettings = payload.settings || activeSettings;
        const seedValue = payload.seed || Math.floor(Math.random() * 100000);

        // Eksekusi seluruh tumpukan pemalsuan sidik jari secara beruntun
        applyNavigatorHooks(currentProfile);
        applyCanvasHooks(seedValue);
        applyWebGLHooks(currentProfile);
        applyAudioHooks(seedValue);
        applyGeographicHooks(currentProfile);

        console.log("Sistem Pengaman Sidik Jari Pixel berhasil aktif di Window utama.");
    }

    // Mendengarkan jembatan postMessage internal dari content.js
    window.addEventListener("message", function(event) {
        if (event.data && event.data.source === "pixel_content_core_bridge" && event.data.action === "ACTIVATE_PROTECTION") {
            initializeFingerprintSpoofing(event.data.payload);
        }
    });

})();
