/**
 * Refactored & Deobfuscated Proxy Connection Manager Engine
 * Nama Modul: PixelProxyHandler
 * Deskripsi: Mengelola konfigurasi jaringan proxy, parsing kredensial, 
 * penyimpanan preferensi lokal, dan sinkronisasi state jaringan via postMessage.
 */

// Inisialisasi Objek Global Handler jika belum wujud di runtime window
window.PixelProxyHandler = window.PixelProxyHandler || {};

(function() {
    // Menghindari duplikasi inisialisasi pada window context yang sama
    if (window.__pixel_proxy_handler_active__) return;
    window.__pixel_proxy_handler_active__ = true;

    // --- STATE RUNTIME INTERNAL ---
    let isProxyEnabled = false;
    let rawProxyString = "";
    
    // Objek penampung detail metadata geografis IP Proxy aktif
    let proxyIpInfo = {
        ip: "",
        countryCode: "",
        country: "",
        timezone: "",
        locale: "en-US",
        languages: ["en-US", "en"],
        acceptLanguage: "en-US,en;q=0.9"
    };

    // Objek referensi metadata kunci ekstensi (diambil dari konfigurasi global)
    const extMeta = window.pixelExtensionMetadata || {
        proxyEnabledKey: "pixel_proxy_active_status",
        proxyStringKey: "pixel_proxy_connection_string",
        proxyConfigKey: "pixel_proxy_geoloc_cache"
    };


    // ===================================================
    // --- SEKTOR 1: PARSING & STRUKTUR DATA PROXY -----
    // ===================================================

    /**
     * Membedah string kredensial proxy mentah menjadi objek komponen jaringan terpisah.
     * Mendukung format host:port:user:pass atau ip:port:user:pass (Anti-Bot natural formatting).
     * @param {string} rawStr - Teks proxy mentah.
     * @return {Object|null} Objek komponen proxy yang berhasil diekstrak atau null jika tidak valid.
     */
    function parseProxyString(rawStr) {
        if (!rawStr || typeof rawStr !== "string") return null;

        const cleanStr = rawStr.trim();
        const proxyDetails = {
            host: null,
            port: null,
            username: null,
            password: null
        };

        try {
            // Evaluasi skema parsing jika teks berisi karakter pemisah '@' (format user:pass@host:port)
            if (cleanStr.includes("@")) {
                const atSplit = cleanStr.split("@");
                const credentials = atSplit[0].split(":");
                const networkAddress = atSplit[1].split(":");

                if (credentials.length >= 2 && networkAddress.length >= 2) {
                    proxyDetails.host = networkAddress[0];
                    proxyDetails.port = parseInt(networkAddress[1]);
                    proxyDetails.username = credentials[0];
                    proxyDetails.password = credentials.slice(1).join(":");
                }
            } else {
                // Skema standar industri: host:port:username:password atau format biner gabungan segmen
                const colonSplit = cleanStr.split(":");
                
                if (colonSplit.length === 4) {
                    // Deteksi jika segmen pertama berupa alamat IP standar atau nama domain hos
                    if (colonSplit[0].includes(".") || /^\d+$/ .test(colonSplit[0])) {
                        proxyDetails.host = colonSplit[0];
                        proxyDetails.port = parseInt(colonSplit[1]);
                        proxyDetails.username = colonSplit[2];
                        proxyDetails.password = colonSplit[3];
                    } else {
                        // Mekanisme rotasi penulisan jika posisi user:pass diletakkan di bagian depan
                        proxyDetails.username = colonSplit[0];
                        proxyDetails.password = colonSplit[1];
                        proxyDetails.host = colonSplit[2];
                        proxyDetails.port = parseInt(colonSplit[3]);
                    }
                } else if (colonSplit.length === 2) {
                    // Penanganan proxy publik tanpa proteksi sandi (Open Proxy)
                    proxyDetails.host = colonSplit[0];
                    proxyDetails.port = parseInt(colonSplit[1]);
                }
            }
        } catch (error) {
            console.error("Format string proxy tidak valid untuk diurai:", error);
            return null;
        }

        // Validasi akhir untuk memastikan parameter utama (host & port) berhasil diisi dengan benar
        return (proxyDetails.host && proxyDetails.port && !isNaN(proxyDetails.port)) ? proxyDetails.node : proxyDetails;
    }

    /**
     * Membentuk format string kredensial proxy terpadu dari objek profil data.
     * @param {Object} proxyObj - Objek kredensial rujukan.
     * @return {string} Hasil string gabungan berformat terstandarisasi.
     */
    function buildProxyString(proxyObj) {
        if (!proxyObj || typeof proxyObj !== "object") return "";
        
        let mergedString = `${proxyObj.host}:${proxyObj.port}`;
        if (proxyObj.username && proxyObj.password) {
            mergedString = `${proxyObj.username}:${proxyObj.password}@${mergedString}`;
        }
        return mergedString;
    }


    // ===================================================
    // --- SEKTOR 2: MANAJEMEN STORAN LOCAL STORAGE ----
    // ===================================================

    /**
     * Memuat preferensi pengaturan proxy terakhir yang tersimpan di dalam LocalStorage peranti.
     */
    function loadSettingsFromStorage() {
        try {
            const savedEnabledState = localStorage.getItem(extMeta.proxyEnabledKey);
            isProxyEnabled = (savedEnabledState === "true");

            rawProxyString = localStorage.getItem(extMeta.proxyStringKey) || "";

            const savedGeoCache = localStorage.getItem(extMeta.proxyConfigKey);
            if (savedGeoCache) {
                proxyIpInfo = JSON.parse(savedGeoCache);
            }
        } catch (error) {
            console.warn("Gagal membaca cache data preferensi proxy dari local storage.");
        }
    }

    /**
     * Menyimpan status operasional jaringan proxy terbaru ke dalam media penyimpanan lokal.
     * Menghilangkan struktur switch-case flattened obfuscator agar eksekusi baris berjalan linear cepat.
     */
    function saveSettingsToStorage() {
        try {
            // 1. Simpan preferensi sakelar status aktif proxy
            localStorage.setItem(extMeta.proxyEnabledKey, isProxyEnabled ? "true" : "false");

            // 2. Simpan rantaian kredensial string proxy mentah
            localStorage.setItem(extMeta.proxyStringKey, rawProxyString);

            // 3. Amankan data cache objek geolokasi IP dalam bentuk skema representasi teks JSON
            localStorage.setItem(extMeta.proxyConfigKey, JSON.stringify(proxyIpInfo));

            // 4. Siapkan struktur pesan payload sinkronisasi untuk disebarkan (Broadcast State Change)
            const internalStatePayload = {
                type: "PROXY_STATE_CHANGED_NOTIFICATION",
                requestId: `px_msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                action: "SYNC_STATE",
                data: {
                    enabled: isProxyEnabled,
                    string: rawProxyString,
                    info: proxyIpInfo
                }
            };

            // Kirim notifikasi global broadcast ke lapisan window context eksternal
            window.postMessage(internalStatePayload, "*");

        } catch (e) {
            console.error("Gagal menyinkronkan perubahan state proxy ke dalam storan lokal peranti.");
        }
    }


    // ===================================================
    // --- SEKTOR 3: ORCHESTRATOR OPERASIONAL PROXY -----
    // ===================================================

    /**
     * Mengonfigurasi dan mengaktifkan jalur proxy baru berdasarkan profil kredensial yang dimasukkan.
     * @param {string} targetProxyString - String koneksi proxy kustom.
     * @return {Promise<boolean>} Status keberhasilan alokasi jaringan proxy.
     */
    async function setProxyConnection(targetProxyString) {
        if (!targetProxyString || typeof targetProxyString !== "string") return false;

        const parsedConfig = parseProxyString(targetProxyString);
        if (!parsedConfig) {
            console.error("Koneksi ditolak: Gagal mengekstrak hos alamat dari string proxy.");
            return false;
        }

        // Perbarui runtime state dalam memori
        isProxyEnabled = true;
        rawProxyString = targetProxyString;

        // Menyusun fallback dummy data geolokasi dasar sebelum modul API background memperbarui nilainya
        proxyIpInfo.ip = parsedConfig.host;
        proxyIpInfo.countryCode = "PENDING";
        proxyIpInfo.country = "Locating Node...";

        // Tulis perubahan ke storage lokal & kirimkan sinyal pos-mesej sinkronisasi
        saveSettingsToStorage();
        return true;
    }

    /**
     * Memutus total koneksi jaringan proxy aktif dan mengembalikan konfigurasi internet klien ke mode normal (Direct).
     */
    function clearProxyConnection() {
        // Reset state variabel global dalam runtime
        isProxyEnabled = false;
        rawProxyString = "";
        
        proxyIpInfo = {
            ip: "", countryCode: "", country: "", timezone: "",
            locale: "en-US", languages: ["en-US", "en"], acceptLanguage: "en-US,en;q=0.9"
        };

        // Rekam pencabutan hak akses jaringan ini ke storan fisik komputer
        saveSettingsToStorage();
        console.log("Koneksi Proxy dinonaktifkan. Jaringan internet dikembalikan ke mode Direct.");
    }

    /**
     * Menginisialisasi sistem pemicu awal modul saat ekstensi browser pertama kali dimuat (Constructor Boot).
     */
    function initProxyHandler() {
        loadSettingsFromStorage();
        console.log("Modul PixelProxyHandler berhasil dimuat. Status Aktif Saat Ini:", isProxyEnabled);
    }


    // ===================================================
    // --- REGISTRASI PROPERTY DAN INTERFACE GLOBAL -----
    // ===================================================

    // Menyusun skema struktur API eksternal yang bersih (Getters & Setters Interface)
    const proxyInterface = {
        get enabled() { return isProxyEnabled; },
        set enabled(val) { 
            isProxyEnabled = val; 
            saveSettingsToStorage();
        },
        
        get string() { return rawProxyString; },
        set string(val) { 
            rawProxyString = val; 
            saveSettingsToStorage();
        },
        
        get info() { return proxyIpInfo; },
        set info(val) { 
            proxyIpInfo = val; 
            saveSettingsToStorage();
        },

        // Pemuatan rujukan metode fungsional eksternal
        setProxy: setProxyConnection,
        clearProxy: clearProxyConnection,
        parseString: parseProxyString,
        buildString: buildProxyString,
        loadSettings: loadSettingsFromStorage,
        saveSettings: saveSettingsToStorage,
        init: initProxyHandler
    };

    // Jalankan pemuatan otomatis awal saat file selesai dievaluasi browser
    initProxyHandler();

    // Daftarkan namespace modul ke lingkup objek global window peranti
    window.PixelProxyHandler = proxyInterface;

})();
