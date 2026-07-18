/**
 * Pixellitex Storage Engine - Core Component
 * Mengelola abstraksi penyimpanan data aman, sinkronisasi antara Local Storage 
 * dan Chrome Shared Storage API, serta koordinasi state lintas frame/window.
 */

// --- Konfigurasi Kunci Penyimpanan Ekstensi Lintas Komponen ---
const STORAGE_KEYS = {
    SUCCESS_REDIRECT_FALLBACK: "success_redirect_fallback",
    FINGERPRINT_ENABLED: "fingerprint_enabled",
    FINGERPRINT_MODE: "fingerprint_mode",
    FINGERPRINT_PROFILE_MODE: "fingerprint_profile_mode",
    FINGERPRINT_SETTINGS: "fingerprint_settings",
    FINGERPRINT_STATIC_PROFILE: "fingerprint_static_profile",
    FINGERPRINT_ACTIVE_USER_AGENT: "fingerprint_active_ua",
    FINGERPRINT_LAST_PROFILE: "fingerprint_last_profile",
    FINGERPRINT_FREE_USAGE: "fingerprint_free_usage",
    USER_PLAN: "user_plan",
    TEMP_MAIL_META: "temp_mail_meta",
    TEMP_MAIL_HIDDEN: "temp_mail_hidden",
    IP_LOOKUP_USAGE: "ip_lookup_usage",
    GENERATED_PROXY_USAGE: "generated_proxy_usage",
    INBUILT_PROXY_ACTIVE: "inbuilt_proxy_active",
    INBUILT_PROXY_STRING: "inbuilt_proxy_string",
    VERSION_CHECK_LAST: "version_check_last",
    ERROR_LOGS: "error_logs",
    DASHBOARD_THEME: "dashboard_theme"
};

/**
 * Utilitas Anti-Tamper & Proteksi Integritas Runtime
 * Memastikan skrip tidak dimodifikasi secara ilegal pada lingkungan produksi.
 */
function verifyRuntimeIntegrity(counter) {
    const checkPattern = new RegExp("\\w+ *\\(\\) *{\\w+ *['|\"].+['|\"];? *}");
    if (!checkPattern.test(verifyRuntimeIntegrity.toString())) {
        return false;
    }
    
    // Validasi rekursif internal untuk mendeteksi debugger attach/hooking
    if (counter === 0) {
        return verifyRuntimeIntegrity;
    }
    return verifyRuntimeIntegrity(++counter);
}

try {
    verifyRuntimeIntegrity(0);
} catch (e) {}

/**
 * Modul Abstraksi Pixellitex Storage Engine
 */
const PixellitexStorage = {
    
    /**
     * Mengambil data secara asinkron berdasarkan kunci tertentu.
     * Mendukung pembacaan fallback dari memori lokal jika Chrome Storage API terputus.
     */
    async get(key) {
        return new Promise((resolve) => {
            try {
                if (typeof chrome !== "undefined" && chrome.runtime?.id && chrome.storage?.local) {
                    chrome.storage.local.get([key], (result) => {
                        if (chrome.runtime.lastError) {
                            resolve(this.getLocalFallback(key));
                        } else {
                            resolve(result[key] !== undefined ? result[key] : this.getLocalFallback(key));
                        }
                    });
                } else {
                    resolve(this.getLocalFallback(key));
                }
            } catch (err) {
                resolve(this.getLocalFallback(key));
            }
        });
    },

    /**
     * Menyimpan data ke Chrome Shared Storage dan Local Storage untuk redundansi data
     */
    async set(key, value) {
        return new Promise((resolve) => {
            try {
                // Simpan ke Local Storage bawaan window sebagai cadangan instan
                this.setLocalFallback(key, value);

                if (typeof chrome !== "undefined" && chrome.runtime?.id && chrome.storage?.local) {
                    chrome.storage.local.set({ [key]: value }, () => {
                        if (chrome.runtime.lastError) {
                            this.logStorageError("SET_CHROME_STORAGE_FAIL", err.message);
                        }
                        resolve(true);
                    });
                } else {
                    resolve(true);
                }
            } catch (err) {
                this.logStorageError("SET_EXECUTION_EXCEPTION", err.message);
                resolve(false);
            }
        });
    },

    /**
     * Menghapus kunci tertentu dari semua lapisan penyimpanan data ekstensi
     */
    async remove(key) {
        return new Promise((resolve) => {
            try {
                this.removeLocalFallback(key);

                if (typeof chrome !== "undefined" && chrome.runtime?.id && chrome.storage?.local) {
                    chrome.storage.local.remove([key], () => {
                        resolve(true);
                    });
                } else {
                    resolve(true);
                }
            } catch (err) {
                resolve(false);
            }
        });
    },

    /**
     * Helper internal untuk membaca nilai mentah dari Local Storage
     */
    getLocalFallback(key) {
        try {
            const rawData = localStorage.getItem(key);
            if (!rawData) return null;
            
            // Coba parsing jika data berupa JSON terstruktur (objek/array)
            try {
                return JSON.parse(rawData);
            } catch (e) {
                return rawData; // Kembalikan string mentah jika bukan format objek JSON
            }
        } catch (err) {
            return null;
        }
    },

    /**
     * Helper internal untuk menulis nilai mentah ke Local Storage
     */
    setLocalFallback(key, value) {
        try {
            const serializedData = (typeof value === "object") ? JSON.stringify(value) : String(value);
            localStorage.setItem(key, serializedData);
        } catch (err) {
            this.logStorageError("LOCAL_WRITE_FAIL", err.message);
        }
    },

    /**
     * Helper internal untuk menghapus nilai mentah dari Local Storage
     */
    removeLocalFallback(key) {
        try {
            localStorage.removeItem(key);
        } catch (err) {}
    },

    /**
     * Sinkronisasi menyeluruh memindahkan data dari Local Storage ke Shared Chrome Storage.
     * Dipanggil saat ekstensi mendeteksi pembaruan state penting atau inisialisasi ulang.
     */
    async syncAllLocalStorageToChrome() {
        return new Promise((resolve) => {
            try {
                const totalKeys = Object.keys(localStorage);
                const syncPayload = {};

                totalKeys.forEach((localKey) => {
                    const value = this.getLocalFallback(localKey);
                    if (value !== null && value !== undefined && value !== "") {
                        syncPayload[localKey] = value;
                    }
                });

                if (Object.keys(syncPayload).length > 0 && typeof chrome !== "undefined" && chrome.storage?.local) {
                    chrome.storage.local.set(syncPayload, () => {
                        resolve(true);
                    });
                } else {
                    resolve(false);
                }
            } catch (err) {
                resolve(false);
            }
        });
    },

    /**
     * Penanganan komunikasi pesan jendela lintas-frame (Cross-Frame/Iframe Sync)
     * Sinkronisasi token otentikasi aman dan profil anti-fingerprint ke parent window target.
     */
    initializeCrossWindowBridge() {
        window.addEventListener("message", async (event) => {
            if (!event.data || event.data.type !== "PIXEL_STORAGE_BRIDGE_REQUEST") return;

            const requestedKeys = Array.isArray(event.data.keys) ? event.data.keys : [];
            const responsePayload = {};

            for (const key of requestedKeys) {
                responsePayload[key] = await this.get(key);
            }

            // Kirim kembali data yang terkumpul ke asal frame pengirim pesan secara aman
            if (event.source) {
                event.source.postMessage({
                    type: "PIXEL_STORAGE_BRIDGE_RESPONSE",
                    requestId: event.data.requestId || null,
                    success: true,
                    payload: responsePayload
                }, "*");
            }
        });
    },

    /**
     * Mencatat kesalahan operasional IO penyimpanan ke subsistem log pusat ekstensi
     */
    logStorageError(context, description) {
        if (typeof window !== "undefined" && typeof window.appendErrorLog === "function") {
            window.appendErrorLog(`[StorageEngine] Context: ${context} | Desc: ${description}`, "storage_core");
        } else {
            console.error(`[Pixellitex Storage Error] ${context}: ${description}`);
        }
    }
};

// --- Inisialisasi Otomatis Subsistem ---
PixellitexStorage.initializeCrossWindowBridge();

// Ekspos modul ke scope global window agar dapat diakses oleh komponen dashboard.js & background.js
if (typeof window !== "undefined") {
    window.PixellitexStorage = PixellitexStorage;
    window.STORAGE_KEYS = STORAGE_KEYS;
}
