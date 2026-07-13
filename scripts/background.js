/**
 * Refactored & Deobfuscated Background Service Worker
 * Deskripsi: Mengelola Sesi Proxy, Proteksi WebRTC Leak, Penyamaran Geografi, dan Sesi Flash Login.
 */

// --- KONSTANTA & KONFIGURASI UTAMA ---
const _originalFetch = self.fetch;

// Endpoint API
const AUTH_BASE_URL = "https://api.pixel.domain/auth/"; // Representasi URL Domain berdasarkan pola string obfuscated
const VERIFY_TOKEN_URL = `${AUTH_BASE_URL}verify`;
const PIXEL_API_BASE = "https://api.pixel.domain/v1/";
const PIXEL_MAILS_API_BASE = "https://mails.pixel.domain/";
const PIXEL_IPLOOKUP_URL = "https://ip.pixel.domain/lookup";
const PIXEL_BINSITES_BASE = "https://bins.pixel.domain/";
const PIXEL_FEED_BASE = "https://feed.pixel.domain/feed.php";
const PIXEL_GENERATE_PROXY_URL = "https://proxy.pixel.domain/generate";

// Pengaturan Waktu & Aturan
const GENERATED_PROXY_TIMEOUT_MS = 90000; // 90 detik
const GENERATED_PROXY_MAX_RETRIES = 3;
const USER_AGENT_RULE_ID = 2;
const FINGERPRINT_USER_AGENT_RULE_ID = 3;
const VERSION_CHECK_INTERVAL_MS = 10800000; // 3 Jam

// Kunci Penyimpanan lokal (Storage Keys)
const USER_AGENT_STORAGE_KEY = "pixel_user_agent_value";
const USER_AGENT_ENABLED_KEY = "pixel_user_agent_enabled";
const USER_AGENT_BROWSER_KEY = "pixel_user_agent_browser";
const USER_AGENT_DEVICE_KEY = "pixel_user_agent_device";
const FINGERPRINT_SWITCH_ENABLED_KEY = "pixel_fingerprint_enabled";
const FINGERPRINT_SWITCH_SETTINGS_KEY = "pixel_fingerprint_settings";
const FINGERPRINT_PROFILE_MODE_KEY = "pixel_fingerprint_profile_mode";
const FINGERPRINT_ACTIVE_USER_AGENT_KEY = "pixel_fingerprint_active_ua";
const FINGERPRINT_LAST_PROFILE_KEY = "pixel_fingerprint_last_profile";
const VERSION_CHECK_CACHE_KEY = "pixel_version_cache";
const ERROR_LOGS_STORAGE_KEY = "pixel_error_logs";
const FLASH_LOGIN_STORAGE_KEY = "pixel_flash_login_data";
const FLASH_LOGIN_FREE_USAGE_KEY = "pixel_flash_login_free_usage";
const FLASH_LOGIN_FREE_LIMIT = 5;
const USER_PLAN_STORAGE_KEY = "pixel_user_plan";
const PROXY_SESSION_CONNECTED_AT_KEY = "pixel_proxy_connected_at";

// Peta Hubungan Kode Negara ke Kode Locale Bahasa
const COUNTRY_LOCALE_MAP = {
    US: "en-US", GB: "en-GB", AU: "en-AU", CA: "en-CA", NZ: "en-NZ", IE: "en-IE",
    IN: "en-IN", SG: "en-SG", PH: "en-PH", ZA: "en-ZA", NG: "en-NG", DE: "de-DE",
    AT: "de-AT", CH: "de-CH", FR: "fr-FR", BE: "nl-BE", NL: "nl-NL", ES: "es-ES",
    MX: "es-MX", AR: "es-AR", CL: "es-CL", CO: "es-CO", PE: "es-PE", IT: "it-IT",
    PT: "pt-PT", BR: "pt-BR", SE: "sv-SE", NO: "no-NO", DK: "da-DK", FI: "fi-FI",
    PL: "pl-PL", CZ: "cs-CZ", HU: "hu-HU", RO: "ro-RO", GR: "el-GR", TR: "tr-TR",
    RU: "ru-RU", UA: "uk-UA", IL: "he-IL", SA: "ar-SA", AE: "ar-AE", BD: "bn-BD",
    PK: "ur-PK", JP: "ja-JP", KR: "ko-KR", CN: "zh-CN", TW: "zh-TW", HK: "zh-HK",
    TH: "th-TH", VN: "vi-VN", ID: "id-ID", MY: "ms-MY"
};

// State Runtime untuk Sesi Proxy Tracker
const proxySessionState = {
    connected: false,
    connectedAt: 0,
    uploadBytes: 0,
    downloadBytes: 0
};

const proxyRequestUploadSeen = new Set();
const proxyRequestDownloadSeen = new Set();
const flashLoginActiveTabs = new Set();
let fingerprintReferenceDevicesPromise = null;


// ==========================================
// --- MANAJEMEN FINGERPRINT & LINGKUNGAN ---
// ==========================================

/**
 * Mendapatkan locale bahasa berdasarkan kode negara (ISO 2-letter).
 */
function resolveLocaleFromCountryCode(countryCode = "") {
    const code = String(countryCode || "").toUpperCase().trim();
    return COUNTRY_LOCALE_MAP[code] || "en-US";
}

/**
 * Menyusun daftar bahasa prioritas berdasarkan locale utama.
 */
function buildLanguagesFromLocale(locale = "") {
    const currentLocale = String(locale || "").trim() || "en-US";
    const primaryLang = currentLocale.split("-")[0] || "en";
    const languages = [currentLocale];

    if (primaryLang !== "en" && !languages.includes(primaryLang)) {
        languages.push(primaryLang);
    }
    if (!languages.includes("en")) {
        languages.push("en");
    }
    return languages;
}

/**
 * Membuat format isi header HTTP 'Accept-Language' dengan pembobotan nilai kualitas (q).
 */
function buildAcceptLanguageHeader(locale = "", customLanguages = []) {
    const targetLanguages = (Array.isArray(customLanguages) && customLanguages.length) 
        ? customLanguages 
        : buildLanguagesFromLocale(locale);

    return targetLanguages
        .filter(Boolean)
        .map((lang, index) => {
            if (index === 0) return lang;
            const qValue = Math.max(0.1, 1 - 0.1 * index).toFixed(1);
            return `${lang};q=${qValue}`;
        })
        .join(",");
}

/**
 * Membentuk objek konteks Geografis untuk penyamaran sidik jari browser.
 */
function buildFingerprintGeoContext(geoData = {}) {
    const ip = String(geoData.ip || "").trim();
    const info = geoData.geo || geoData;
    const countryCode = String(info.countryCode || "").toUpperCase().trim();
    const locale = resolveLocaleFromCountryCode(countryCode);
    const languages = buildLanguagesFromLocale(locale);
    const acceptLanguage = buildAcceptLanguageHeader(locale, languages);

    return {
        success: !!ip,
        ip: ip,
        countryCode: countryCode,
        country: String(info.country || "").trim(),
        timezone: String(info.timezone || "").trim(),
        locale: locale,
        languages: languages,
        acceptLanguage: acceptLanguage
    };
}

/**
 * Memastikan data context header fingerprint memiliki struktur bahasa yang valid.
 */
function normalizeFingerprintHeaderContext(context = {}) {
    const ctx = (context && typeof context === "object") ? context : {};
    const locale = String(ctx.locale || "").trim();
    const languages = Array.isArray(ctx.languages)
        ? ctx.languages.map(l => String(l || "").trim()).filter(Boolean)
        : [];
    const acceptLanguage = String(ctx.acceptLanguage || "").trim() || buildAcceptLanguageHeader(locale, languages);

    return { locale, languages, acceptLanguage };
}

/**
 * Membaca berkas referensi perangkat JSON lokal untuk emulasi sidik jari perangkat.
 */
async function loadFingerprintReferenceDevices() {
    if (fingerprintReferenceDevicesPromise) return fingerprintReferenceDevicesPromise;

    fingerprintReferenceDevicesPromise = (async () => {
        try {
            const response = await fetch(chrome.runtime.getURL("data/devices.json"));
            return response.ok ? await response.json() : {};
        } catch (error) {
            return {};
        }
    })();

    return fingerprintReferenceDevicesPromise;
}


// ===================================
// --- SISTEM DIAGNOSTIK & LOGGING ---
// ===================================

/**
 * Menghapus data sensitif seperti link URL, IP Address, dan Hostname dari pesan error log.
 */
function sanitizeErrorLogText(text) {
    let log = String(text || "").trim();
    if (!log) return "";

    log = log.replace(/https?:\/\/[^\s]+/gi, "[URL]");
    log = log.replace(/\b(?:[a-z]+:\/\/)?(?:[^@\s/:]+:[^@\s/:]+@)?(?:\d{1,3}\.){3}\d{1,3}:\d{2,5}(?::[^\s]+)?/gi, "[IP_ADDR]");
    log = log.replace(/\b(?:[a-z]+:\/\/)?(?:[^@\s/:]+:[^@\s/:]+@)?[a-z0-9.-]+\.[a-z]{2,}:\d{2,5}(?::[^\s]+)?/gi, "[HOST]");
    return log;
}

/**
 * Mencatat error ke dalam storage lokal ekstensi dengan batasan maksimum 50 baris terakhir.
 */
async function appendBackgroundErrorLog(errorText, source = "background") {
    try {
        const message = sanitizeErrorLogText(errorText);
        if (!message) return;

        const storage = await chrome.storage.local.get([ERROR_LOGS_STORAGE_KEY]);
        const currentLogs = Array.isArray(storage[ERROR_LOGS_STORAGE_KEY]) ? storage[ERROR_LOGS_STORAGE_KEY] : [];

        const newLogEntry = {
            id: `${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
            at: new Date().toISOString(),
            source: source,
            message: message
        };

        const mergedLogs = [newLogEntry, ...currentLogs].slice(0, 50);
        await chrome.storage.local.set({ [ERROR_LOGS_STORAGE_KEY]: mergedLogs });
    } catch (e) {}
}


// ======================================
// --- PERLINDUNGAN PRIVASI & MONITOR ---
// ======================================

/**
 * Mengaktifkan/menonaktifkan pencegahan kebocoran IP asli lewat WebRTC (STUN Leak Protection).
 */
async function setStunLeakProtection(enabled) {
    if (!chrome.privacy?.network?.webRTCIPHandlingPolicy) return;

    const policy = {
        value: enabled ? "disable_non_proxied_udp" : "default"
    };
    await chrome.privacy.network.webRTCIPHandlingPolicy.set(policy);
}

function resetProxySessionState() {
    proxySessionState.connected = false;
    proxySessionState.connectedAt = 0;
    proxySessionState.uploadBytes = 0;
    proxySessionState.downloadBytes = 0;
    proxyRequestUploadSeen.clear();
    proxyRequestDownloadSeen.clear();
}

function startProxySessionState() {
    proxySessionState.connected = true;
    proxySessionState.connectedAt = Date.now();
    proxySessionState.uploadBytes = 0;
    proxySessionState.downloadBytes = 0;
    proxyRequestUploadSeen.clear();
    proxyRequestDownloadSeen.clear();
}


// ===================================
// --- ANALISIS BANDWIDTH HEADER HTTP ---
// ===================================

/**
 * Membaca nilai ukuran bytes spesifik dari header tertentu (misal: Content-Length).
 */
function readHeaderBytes(headers, headerName) {
    const target = (headers || []).find(h => String(h?.name || "").toLowerCase() === String(headerName || "").toLowerCase());
    const val = Number(target?.value || 0);
    return (Number.isInteger(val) && val > 0) ? val : 0;
}

/**
 * Memperkirakan ukuran data biner dalam format bytes dari seluruh komponen header HTTP.
 */
function estimateHeadersSize(headers = []) {
    return (headers || []).reduce((totalSize, currentHeader) => {
        const nameStr = String(currentHeader?.name || "");
        const valueStr = String(currentHeader?.value || "");
        return totalSize + nameStr.length + valueStr.length + 4; // Ditambah overhead penyekat ": " dan "\r\n"
    }, 2); // Overhead akhir baris header "\r\n"
}

function estimateRequestBytes(request) {
    const url = String(request?.url || "");
    const method = String(request?.method || "GET");
    const headersSize = estimateHeadersSize(request?.requestHeaders || []);
    const bodySize = readHeaderBytes(request?.requestHeaders || [], "content-length");

    const calculatedLineSize = method.length + url.length + headersSize + 16; // 16 bytes estimasi overhead protokol HTTP line
    return Math.max(calculatedLineSize + bodySize, 1);
}

function estimateResponseBytes(response) {
    const headersSize = estimateHeadersSize(response?.responseHeaders || []);
    const bodySize = readHeaderBytes(response?.responseHeaders || [], "content-length");
    return Math.max(headersSize + bodySize + 16, 1);
}


// ====================================
// --- SINKRONISASI STATUS PROXY API ---
// ====================================

/**
 * Menghitung durasi koneksi dan total penggunaan lalu lintas data byte proxy ekstensi.
 */
async function getProxySessionStatus() {
    const storage = await chrome.storage.local.get(["proxy_state_key", PROXY_SESSION_CONNECTED_AT_KEY]);
    
    // Asumsi getProxyState() didefinisikan di modul eksternal script ekstensi ini
    const proxyState = await getProxyState().catch(() => ({ success: false, enabled: false, proxyString: "" }));
    const activeConfig = storage?.proxy_config || {};
    
    const isProxyActive = proxyState && proxyState.success === true && proxyState.enabled === true;
    const initialConnectedTime = Number(proxySessionState.connectedAt || storage?.[PROXY_SESSION_CONNECTED_AT_KEY] || 0);

    if (isProxyActive && !proxySessionState.connected) {
        proxySessionState.connected = true;
        proxySessionState.connectedAt = initialConnectedTime || Date.now();
    }

    if (!isProxyActive && proxySessionState.connected) {
        resetProxySessionState();
    }

    const currentUploaded = proxySessionState.uploadBytes || 0;
    const currentDownloaded = proxySessionState.downloadBytes || 0;

    return {
        success: true,
        connected: isProxyActive,
        connectedAt: isProxyActive ? (proxySessionState.connectedAt || initialConnectedTime || Date.now()) : 0,
        uploadBytes: currentUploaded,
        downloadBytes: currentDownloaded,
        totalBytes: currentUploaded + currentDownloaded,
        durationMs: isProxyActive ? Math.max(Date.now() - Number(proxySessionState.connectedAt || initialConnectedTime), 0) : 0,
        location: String(activeConfig.name || activeConfig.countryCode || "Unknown").toUpperCase()
    };
}

/**
 * Menyelaraskan pengaturan privasi WebRTC Leak berdasarkan kondisi state aktivasi proxy terbaru.
 */
async function syncProxyPrivacyFromStorage() {
    try {
        const state = await getProxyState().catch(() => ({ success: false, enabled: false }));
        if (state && state.success === true && state.enabled === true) {
            await setStunLeakProtection(true);
            if (!proxySessionState.connected) {
                startProxySessionState();
            }
        } else {
            resetProxySessionState();
            await setStunLeakProtection(false);
        }
    } catch (e) {}
}


// ==========================================
// --- INTEGRASI STRUKTUR FITUR FLASH LOGIN --
// ==========================================

function normalizeFlashLoginHost(host = "") {
    return String(host || "").toLowerCase().trim().replace(/^\.+/, "");
}

function sanitizeFlashLoginCookie(cookie = {}) {
    return {
        name: String(cookie.name || ""),
        value: String(cookie.value || ""),
        domain: String(cookie.domain || ""),
        path: String(cookie.path || "/"),
        secure: cookie.secure === true,
        httpOnly: cookie.httpOnly === true,
        sameSite: cookie.sameSite || "Lax",
        expirationDate: Number(cookie.expirationDate || 0)
    };
}

async function getFlashLoginPayload() {
    const storage = await chrome.storage.local.get([FLASH_LOGIN_STORAGE_KEY]);
    const payload = storage?.[FLASH_LOGIN_STORAGE_KEY];
    return (payload && typeof payload === "object") ? payload : null;
}

async function clearFlashLoginPayload() {
    await chrome.storage.local.remove([FLASH_LOGIN_STORAGE_KEY]);
}

/**
 * Menghitung kuota sisa penggunaan gratis fitur Flash Login.
 */
async function getFlashLoginUsageInfo() {
    const storage = await chrome.storage.local.get([USER_PLAN_STORAGE_KEY, FLASH_LOGIN_FREE_USAGE_KEY]);
    const plan = String(storage?.[USER_PLAN_STORAGE_KEY] || "free").toLowerCase().trim();
    const usedCount = Math.max(0, Number(storage?.[FLASH_LOGIN_FREE_USAGE_KEY] || 0));
    const isPremiumUser = plan === "premium" || plan === "pro";

    return {
        plan: plan,
        used: usedCount,
        limit: FLASH_LOGIN_FREE_LIMIT,
        remaining: isPremiumUser ? null : Math.max(FLASH_LOGIN_FREE_LIMIT - usedCount, 0)
    };
}

async function assertFlashLoginAllowed() {
    const info = await getFlashLoginUsageInfo();
    if (info.plan === "free" && info.used >= FLASH_LOGIN_FREE_LIMIT) {
        throw new Error("Batas maksimum penggunaan Flash Login paket gratis telah tercapai.");
    }
    return info;
}

async function incrementFlashLoginUsage() {
    const info = await getFlashLoginUsageInfo();
    if (info.plan !== "free") return info;

    const newUsedCount = Math.min(info.used + 1, FLASH_LOGIN_FREE_LIMIT);
    await chrome.storage.local.set({ [FLASH_LOGIN_FREE_USAGE_KEY]: newUsedCount });

    return {
        ...info,
        used: newUsedCount,
        remaining: Math.max(FLASH_LOGIN_FREE_LIMIT - newUsedCount, 0)
    };
}

/**
 * Mendapatkan ID tempat kuki tersimpan (Cookie Store ID) yang terikat pada tab tertentu.
 */
async function getCookieStoreIdForTab(tabId) {
    try {
        if (!chrome.cookies?.getAllCookieStores) return "";
        const stores = await chrome.cookies.getAllCookieStores() || [];
        const targetStore = stores.find(store => Array.isArray(store.tabIds) && store.tabIds.includes(tabId));
        return String(targetStore?.id || "").trim();
    } catch (e) {
        return "";
    }
}

function buildFlashLoginCookieUrl(cookie, payload) {
    const cleanDomain = normalizeFlashLoginHost(String(cookie.domain || "").replace(/^\./, "")) || normalizeFlashLoginHost(payload?.host || "");
    const protocolPrefix = cookie.secure ? "https://" : "http://";
    const path = String(cookie.path || "/").startsWith("/") ? String(cookie.path || "/") : `/${cookie.path}`;
    return protocolPrefix + cleanDomain + path;
}

async function doesFlashLoginTabMatch(url = "", payload = null) {
    if (!payload) return false;
    try {
        const parsedUrl = new URL(url);
        const currentUrlHost = normalizeFlashLoginHost(parsedUrl.hostname);
        const payloadHost = normalizeFlashLoginHost(payload.host);

        if (!currentUrlHost || !payloadHost) return false;
        return currentUrlHost === payloadHost || currentUrlHost.endsWith(`.${payloadHost}`) || payloadHost.endsWith(`.${currentUrlHost}`);
    } catch (e) {
        return false;
    }
}

/**
 * Mengambil kuki saat ini dari tab aktif dan menyimpannya sebagai payload sesi Flash Login.
 */
async function saveFlashLoginFromTab(tabId) {
    await assertFlashLoginAllowed();
    const tab = await chrome.tabs.get(tabId);
    const targetUrl = String(tab?.url || "").trim();

    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
        throw new Error("URL Tab tidak valid untuk merekam Flash Login.");
    }

    const parsedUrl = new URL(targetUrl);
    const fetchedCookies = await chrome.cookies.getAll({ domain: parsedUrl.hostname });

    if (!Array.isArray(fetchedCookies) || !fetchedCookies.length) {
        throw new Error("Tidak ada kuki yang ditemukan untuk disimpan pada domain ini.");
    }

    const flashLoginPayload = {
        host: normalizeFlashLoginHost(parsedUrl.hostname),
        origin: parsedUrl.origin,
        scheme: parsedUrl.protocol.replace(":", ""),
        savedAt: Date.now(),
        count: fetchedCookies.length,
        cookies: fetchedCookies.map(cookie => sanitizeFlashLoginCookie(cookie)).filter(c => c.name)
    };

    await chrome.storage.local.set({ [FLASH_LOGIN_STORAGE_KEY]: flashLoginPayload });
    return flashLoginPayload;
}
