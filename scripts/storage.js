/**
 * Refactored & Deobfuscated Storage Management Script
 * Nama Modul: PixelStorageEngine
 * Deskripsi: Menyediakan lapisan abstraksi penyimpanan (Chrome Storage & LocalStorage Fallback)
 * serta mengonsolidasikan seluruh kunci (keys) manifes ekstensi agar terpadu.
 */

(function() {
    // Mencegah inisialisasi ganda pada runtime window context yang sama
    if (window.__pixel_storage_engine_active__) return;
    window.__pixel_storage_engine_active__ = true;

    // --- SEKTOR 1: MANIFES METADATA KUNCI (KEYS MANIFEST) ---
    // Di-ekstrak langsung dari hasil dekripsi kamus string terenkripsi array _0x33a3
    const metadataManifest = {
        proxyEnabledKey: "pixel_proxy_active_status",
        proxyStringKey: "pixel_proxy_connection_string",
        proxyConfigKey: "pixel_proxy_geoloc_cache",
        userIdKey: "pixel_user_id",
        userPlanKey: "pixel_user_plan_type",
        errorLogsKey: "pixel_error_logs_cache",
        flashLoginDataKey: "pixel_flash_login_data",
        flashLoginFreeUsageKey: "pixel_flash_login_free_usage",
        tempMailMetaKey: "pixel_temp_mail_metadata",
        tempMailHiddenKey: "pixel_temp_mail_hidden_state",
        ipLookupUsageKey: "pixel_ip_lookup_usage_count",
        generatedProxyUsageKey: "pixel_generated_proxy_usage_count",
        versionCheckLastKey: "pixel_last_version_check_time",
        dashboardThemeKey: "pixel_dashboard_theme_preference",
        fingerprintEnabledKey: "pixel_fingerprint_protection_enabled",
        fingerprintSettingsKey: "pixel_fingerprint_detailed_settings",
        fingerprintProfileModeKey: "pixel_fingerprint_profile_generation_mode",
        fingerprintActiveUaKey: "pixel_fingerprint_active_user_agent",
        fingerprintLastProfileKey: "pixel_fingerprint_last_generated_profile"
    };

    // Ekspor metadata manifest ke window global agar bisa dibaca secara sinkron oleh proxyhandler.js dan binlibrary.js
    window.pixelExtensionMetadata = metadataManifest;


    // ===================================================
    // --- SEKTOR 2: UTILITY WRAPPER PENYIMPANAN ---------
    // ===================================================
    
    const storageWrapper = {
        /**
         * Memeriksa ketersediaan API Chrome Extension Storage Runtime.
         * @return {boolean} True jika berjalan di background/content script resmi ekstensi.
         */
        isChromeStorageAvailable: function() {
            return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
        },

        /**
         * Mengambil data berdasarkan kunci tertentu secara asinkron (Promise).
         * @param {string|Array<string>|Object} keys - Kunci target pembacaan data.
         * @return {Promise<Object>} Objek data keluaran.
         */
        get: function(keys) {
            return new Promise((resolve) => {
                if (storageWrapper.isChromeStorageAvailable()) {
                    chrome.storage.local.get(keys, (result) => {
                        resolve(result || {});
                    });
                } else {
                    // Fallback aman menggunakan LocalStorage bawaan window DOM context jika API Chrome tidak siap
                    const fallbackResult = {};
                    if (Array.isArray(keys)) {
                        keys.forEach(key => {
                            const val = localStorage.getItem(key);
                            try {
                                fallbackResult[key] = val ? JSON.parse(val) : undefined;
                            } catch (e) {
                                fallbackResult[key] = val;
                            }
                        });
                    } else if (typeof keys === "string") {
                        const val = localStorage.getItem(keys);
                        try {
                            fallbackResult[keys] = val ? JSON.parse(val) : undefined;
                        } catch (e) {
                            fallbackResult[keys] = val;
                        }
                    } else {
                        // Jika parameter berupa objek default fallback nilai bawaan
                        Object.keys(keys || {}).forEach(key => {
                            const val = localStorage.getItem(key);
                            if (val !== null) {
                                try {
                                    fallbackResult[key] = JSON.parse(val);
                                } catch (e) {
                                    fallbackResult[key] = val;
                                }
                            } else {
                                fallbackResult[key] = keys[key];
                            }
                        });
                    }
                    resolve(fallbackResult);
                }
            });
        },

        /**
         * Menyimpan pasangan kunci dan nilai ke media penyimpanan lokal secara aman.
         * @param {Object} dataObj - Objek data yang akan di-commit/simpan.
         * @return {Promise<boolean>} Status kejayaan/keberhasilan penulisan data.
         */
        set: function(dataObj) {
            return new Promise((resolve) => {
                if (!dataObj || typeof dataObj !== "object") {
                    resolve(false);
                    return;
                }

                if (storageWrapper.isChromeStorageAvailable()) {
                    chrome.storage.local.set(dataObj, () => {
                        resolve(true);
                    });
                } else {
                    // Sinkronisasi data ke LocalStorage jika di-inject di halaman web umum halaman checkout
                    Object.keys(dataObj).forEach(key => {
                        const targetValue = dataObj[key];
                        const serializedValue = typeof targetValue === "object" ? JSON.stringify(targetValue) : String(targetValue);
                        localStorage.setItem(key, serializedValue);
                    });
                    resolve(true);
                }
            });
        },

        /**
         * Menghapus baris data berdasarkan satu atau beberapa kunci khusus.
         * @param {string|Array<string>} keys - Target kunci pembersihan.
         * @return {Promise<boolean>}
         */
        remove: function(keys) {
            return new Promise((resolve) => {
                if (storageWrapper.isChromeStorageAvailable()) {
                    chrome.storage.local.remove(keys, () => {
                        resolve(true);
                    });
                } else {
                    if (Array.isArray(keys)) {
                        keys.forEach(key => localStorage.removeItem(key));
                    } else {
                        localStorage.removeItem(keys);
                    }
                    resolve(true);
                }
            });
        },

        /**
         * Membersihkan seluruh data storan lokal milik ekstensi (Total Reset).
         * @return {Promise<boolean>}
         */
        clear: function() {
            return new Promise((resolve) => {
                if (storageWrapper.isChromeStorageAvailable()) {
                    chrome.storage.local.clear(() => {
                        resolve(true);
                    });
                } else {
                    localStorage.clear();
                    resolve(true);
                }
            });
        }
    };

    // --- EVENT LISTENER & SINKRONISASI UPDATE STATE BRIDGE ---
    /**
     * Otomatis memantau sinyal perubahan data dari skrip lain via postMessage untuk menyelaraskan cache internal.
     */
    if (typeof window.addEventListener !== "undefined") {
        window.addEventListener("message", function(event) {
            if (event.data && event.data.source === "pixel_storage_bridge_update" && event.data.action === "FORCE_SYNC") {
                const incomingPayload = event.data.payload || {};
                storageWrapper.set(incomingPayload);
            }
        });
    }

    // Ekspor namespace mesin penyimpanan terpadu ke window peramban klien agar bisa dipanggil secara global
    window.PixelStorage = storageWrapper;

})();
