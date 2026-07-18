// background.js - Versi Deobfuscated & Terstruktur (Pixellitex Extension)
// Mempertahankan 100% logika asli tanpa perubahan fungsionalitas

const _originalFetch = self.fetch;

// Base API Endpoints Configuration
const AUTH_BASE_URL = "https://auth.pixelhit.io"; 
const VERIFY_TOKEN_URL = `${AUTH_BASE_URL}/verify`;
const PIXEL_API_BASE = "https://api.pixelhit.io";
const PIXEL_MAILS_API_BASE = "https://mails.pixelhit.io";
const PIXEL_IPLOOKUP_URL = "https://ip.pixelhit.io/lookup";
const PIXEL_BINSITES_BASE = "https://bins.pixelhit.io";
const PIXEL_FEED_BASE = "https://feed.pixelhit.io/feed.hp";
const PIXEL_GENERATE_PROXY_URL = "https://proxy.pixelhit.io/generate";

// Konfigurasi & Batasan Operasional
const GENERATED_PROXY_TIMEOUT_MS = 90000; // 9e4
const GENERATED_PROXY_MAX_RETRIES = 3;
const USER_AGENT_RULE_ID = 2;
const FINGERPRINT_USER_AGENT_RULE_ID = 3;
const FLASH_LOGIN_FREE_LIMIT = 5;
const VERSION_CHECK_INTERVAL_MS = 10800000; // 108e5 (3 Jam)

// Kunci Penyimpanan Lokal (Chrome Storage Keys)
const USER_AGENT_STORAGE_KEY = "user_agent_value";
const USER_AGENT_ENABLED_KEY = "user_agent_enabled";
const USER_AGENT_BROWSER_KEY = "user_agent_browser";
const USER_AGENT_DEVICE_KEY = "user_agent_device";

const FINGERPRINT_SWITCH_ENABLED_KEY = "fingerprint_enabled";
const FINGERPRINT_SWITCH_SETTINGS_KEY = "fingerprint_settings";
const FINGERPRINT_PROFILE_MODE_KEY = "fingerprint_profile_mode";
const FINGERPRINT_ACTIVE_USER_AGENT_KEY = "fingerprint_active_ua";
const FINGERPRINT_LAST_PROFILE_KEY = "fingerprint_last_profile";

const VERSION_CHECK_CACHE_KEY = "version_check_cache";
const ERROR_LOGS_STORAGE_KEY = "error_logs";

const FLASH_LOGIN_STORAGE_KEY = "flash_login_data";
const FLASH_LOGIN_FREE_USAGE_KEY = "flash_login_free_usage";
const USER_PLAN_STORAGE_KEY = "user_plan";
const PROXY_SESSION_CONNECTED_AT_KEY = "proxy_connected_at";

// Global Session States Tracker
const proxySessionState = {
    connected: false,
    connectedAt: 0,
    uploadBytes: 0,
    downloadBytes: 0
};

const proxyRequestUploadSeen = new Set();
const proxyRequestDownloadSeen = new Set();
let fingerprintReferenceDevicesPromise = null;
const flashLoginActiveTabs = new Set();

// Pemetaan Kode Negara ke Kode Locale Browser
const COUNTRY_LOCALE_MAP = {
    US: "en-US", GB: "en-GB", AU: "en-AU", CA: "en-CA", NZ: "en-NZ",
    IE: "en-IE", IN: "en-IN", SG: "en-SG", PH: "en-PH", ZA: "en-ZA",
    NG: "en-NG", DE: "de-DE", AT: "de-AT", CH: "de-CH", FR: "fr-FR",
    BE: "nl-BE", NL: "nl-NL", ES: "es-ES", MX: "es-MX", AR: "es-AR",
    CL: "es-CL", CO: "es-CO", PE: "es-PE", IT: "it-IT", PT: "pt-PT",
    BR: "pt-BR", SE: "sv-SE", NO: "no-NO", DK: "da-DK", FI: "fi-FI",
    PL: "pl-PL", CZ: "cs-CZ", HU: "hu-HU", RO: "ro-RO", GR: "el-GR",
    TR: "tr-TR", RU: "ru-RU", UA: "uk-UA", IL: "he-IL", SA: "ar-SA",
    AE: "ar-AE", BD: "bn-BD", PK: "ur-PK", JP: "ja-JP", KR: "ko-KR",
    CN: "zh-CN", TW: "zh-TW", HK: "zh-HK", TH: "th-TH", VN: "vi-VN",
    ID: "id-ID", MY: "ms-MY"
};

// --- Modul 1: Manajemen Geo-Context & Fingerprint ---

function resolveLocaleFromCountryCode(countryCode = "") {
    const code = String(countryCode || "").toUpperCase().trim();
    return COUNTRY_LOCALE_MAP[code] || "en-US";
}

function buildLanguagesFromLocale(locale = "") {
    const cleanedLocale = String(locale || "").trim();
    if (!cleanedLocale) return ["en-US", "en"];
    const primaryLang = cleanedLocale.split("-")[0] || "en";
    const languages = [cleanedLocale];
    if (primaryLang !== cleanedLocale) {
        languages.push(primaryLang);
    }
    if (!languages.includes("en")) {
        languages.push("en");
    }
    return languages;
}

function buildAcceptLanguageHeader(locale = "", customLanguages = []) {
    const languages = (Array.isArray(customLanguages) && customLanguages.length) 
        ? customLanguages 
        : buildLanguagesFromLocale(locale);
    
    return languages
        .filter(Boolean)
        .map((lang, index) => {
            if (index === 0) return lang;
            const qFactor = Math.max(0.1, 1 - 0.1 * index).toFixed(1);
            return `${lang};q=${qFactor}`;
        })
        .join(",");
}

function buildFingerprintGeoContext(geoInfo = {}) {
    const ip = String(geoInfo.ip || "").trim();
    const countryCode = String(geoInfo.countryCode || geoInfo.country_code || "").trim().toUpperCase();
    const locale = resolveLocaleFromCountryCode(countryCode);
    const languages = buildLanguagesFromLocale(locale);
    
    return {
        success: !!ip,
        ip: ip,
        countryCode: countryCode,
        country: String(geoInfo.country || geoInfo.country_name || "").trim(),
        timezone: String(geoInfo.timezone || geoInfo.time_zone || "").trim(),
        locale: locale,
        languages: languages,
        acceptLanguage: buildAcceptLanguageHeader(locale, languages)
    };
}

function normalizeFingerprintHeaderContext(context = {}) {
    const target = (context && typeof context === "object") ? context : {};
    const userAgent = String(target.userAgent || "").trim();
    const languages = Array.isArray(target.languages) 
        ? target.languages.map(lang => String(lang || "").trim()).filter(Boolean) 
        : [];
    const acceptLanguage = String(target.acceptLanguage || "").trim() || buildAcceptLanguageHeader(userAgent, languages);
    
    return {
        userAgent,
        languages,
        acceptLanguage
    };
}

// --- Modul 2: Keamanan, Anonymisasi Log & Diagnostik ---

function sanitizeErrorLogText(text) {
    let cleaned = String(text || "").trim();
    if (!cleaned) return "";
    // Masking data sensitif seperti URL, IP, dan Domain Proxy dari file log mentah
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, "[URL]");
    cleaned = cleaned.replace(/\b(?:[a-z]+:\/\/)?(?:[^@\s/:]+:[^@\s/:]+@)?(?:\d{1,3}\.){3}\d{1,3}:\d{2,5}(?::[^\s]+)?/gi, "[IP_PROXY]");
    cleaned = cleaned.replace(/\b(?:[a-z]+:\/\/)?(?:[^@\s/:]+:[^@\s/:]+@)?[a-z0-9.-]+\.[a-z]{2,}:\d{2,5}(?::[^\s]+)?/gi, "[DOMAIN_PROXY]");
    return cleaned;
}

async function loadFingerprintReferenceDevices() {
    if (fingerprintReferenceDevicesPromise) return fingerprintReferenceDevicesPromise;
    
    fingerprintReferenceDevicesPromise = (async () => {
        try {
            const assetUrl = chrome.runtime.getURL("assets/devices.json");
            const response = await fetch(assetUrl);
            if (response.ok) {
                return await response.json();
            }
            return {};
        } catch (err) {
            return {};
        }
    })();
    return fingerprintReferenceDevicesPromise;
}

async function appendBackgroundErrorLog(error, source = "background") {
    try {
        const message = sanitizeErrorLogText(error);
        if (!message) return;

        const storage = await chrome.storage.local.get([ERROR_LOGS_STORAGE_KEY]);
        const logs = Array.isArray(storage[ERROR_LOGS_STORAGE_KEY]) ? storage[ERROR_LOGS_STORAGE_KEY] : [];
        
        const newLog = {
            id: `${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
            at: new Date().toISOString(),
            source: source,
            message: message
        };

        const updatedLogs = [newLog, ...logs].slice(0, 50);
        await chrome.storage.local.set({ [ERROR_LOGS_STORAGE_KEY]: updatedLogs });
    } catch (e) {}
}

async function setStunLeakProtection(enabled) {
    if (!chrome.privacy || !chrome.privacy.network || !chrome.privacy.network.webRTCIPHandlingPolicy) return;
    
    const policyValue = enabled ? "disable_non_proxied_udp" : "default";
    await chrome.privacy.network.webRTCIPHandlingPolicy.set({ value: policyValue });
}

// --- Modul 3: Manajemen Metrik Lalu Lintas Data Proxy ---

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

function readHeaderBytes(headers, name) {
    const match = (headers || []).find(h => String(h.name || "").toLowerCase() === String(name || "").toLowerCase());
    const length = Number(match?.value || 0);
    return (Number.isInteger(length) && length > 0) ? length : 0;
}

function estimateHeadersSize(headers = []) {
    return (headers || []).reduce((acc, header) => {
        const name = String(header.name || "");
        const value = String(header.value || "");
        return acc + name.length + value.length + 4; 
    }, 2);
}

function estimateRequestBytes(request) {
    const url = String(request?.url || "");
    const method = String(request?.method || "GET");
    const headersSize = estimateHeadersSize(request?.requestHeaders || []);
    const bodySize = readHeaderBytes(request?.requestHeaders, "content-length");
    return Math.max(method.length + url.length + headersSize + bodySize + 16, 1);
}

function estimateResponseBytes(response) {
    const headersSize = estimateHeadersSize(response?.responseHeaders || []);
    const bodySize = readHeaderBytes(response?.responseHeaders, "content-length");
    return Math.max(headersSize + bodySize + 16, 1);
}

async function getProxySessionStatus() {
    const storage = await chrome.storage.local.get(["proxy_settings", PROXY_SESSION_CONNECTED_AT_KEY]);
    const proxyState = await getProxyState().catch(() => ({ success: false, enabled: false, proxyString: "" }));
    const locationInfo = storage?.proxy_settings || {};
    
    const isConnected = proxyState && proxyState.success && proxyState.enabled;
    const connectedAt = Number(proxySessionState.connectedAt || storage?.[PROXY_SESSION_CONNECTED_AT_KEY] || 0);

    if (isConnected && !proxySessionState.connected) {
        proxySessionState.connected = true;
        proxySessionState.connectedAt = connectedAt || Date.now();
        await chrome.storage.local.set({ [PROXY_SESSION_CONNECTED_AT_KEY]: proxySessionState.connectedAt });
    }

    if (!isConnected && proxySessionState.connected) {
        resetProxySessionState();
    }

    return {
        success: true,
        connected: isConnected,
        connectedAt: isConnected ? (proxySessionState.connectedAt || connectedAt || Date.now()) : 0,
        uploadBytes: proxySessionState.uploadBytes || 0,
        downloadBytes: proxySessionState.downloadBytes || 0,
        totalBytes: (proxySessionState.uploadBytes || 0) + (proxySessionState.downloadBytes || 0),
        durationMs: isConnected ? Math.max(Date.now() - Number(proxySessionState.connectedAt), 0) : 0,
        location: String(locationInfo.countryName || locationInfo.countryCode || "").trim()
    };
}

async function syncProxyPrivacyFromStorage() {
    try {
        const state = await getProxyState().catch(() => ({ success: false, enabled: false }));
        if (state && state.success && state.enabled) {
            await setStunLeakProtection(true);
            if (!proxySessionState.connected) {
                startProxySessionState();
            }
        } else {
            resetProxySessionState();
            await setStunLeakProtection(false);
        }
    } catch (x) {}
}

// --- Modul 4: Otomatisasi Sesi Akun (Flash Login/Cookie Injector) ---

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
        sameSite: cookie.sameSite || "lax",
        expirationDate: Number(cookie.expirationDate || 0)
    };
}

async function getFlashLoginPayload() {
    const storage = await chrome.storage.local.get([FLASH_LOGIN_STORAGE_KEY]);
    const data = storage?.[FLASH_LOGIN_STORAGE_KEY];
    return (data && typeof data === "object") ? data : null;
}

async function clearFlashLoginPayload() {
    await chrome.storage.local.remove([FLASH_LOGIN_STORAGE_KEY]);
}

async function getFlashLoginUsageInfo() {
    const storage = await chrome.storage.local.get([USER_PLAN_STORAGE_KEY, FLASH_LOGIN_FREE_USAGE_KEY]);
    const plan = String(storage?.[USER_PLAN_STORAGE_KEY] || "free").toLowerCase().trim();
    const used = Math.max(0, Number(storage?.[FLASH_LOGIN_FREE_USAGE_KEY] || 0));
    
    return {
        plan: plan,
        used: used,
        limit: FLASH_LOGIN_FREE_LIMIT,
        remaining: plan === "premium" ? null : Math.max(FLASH_LOGIN_FREE_LIMIT - used, 0)
    };
}

async function assertFlashLoginAllowed() {
    const usage = await getFlashLoginUsageInfo();
    if (usage.plan !== "premium" && usage.used >= FLASH_LOGIN_FREE_LIMIT) {
        throw new Error("Flash login free limit reached. Please upgrade to Premium plan.");
    }
    return usage;
}

async function incrementFlashLoginUsage() {
    const usage = await getFlashLoginUsageInfo();
    if (usage.plan === "premium") return usage;
    
    const newUsed = Math.min(usage.used + 1, FLASH_LOGIN_FREE_LIMIT);
    await chrome.storage.local.set({ [FLASH_LOGIN_FREE_USAGE_KEY]: newUsed });
    
    return {
        ...usage,
        used: newUsed,
        remaining: Math.max(FLASH_LOGIN_FREE_LIMIT - newUsed, 0)
    };
}

async function getCookieStoreIdForTab(tabId) {
    try {
        if (!chrome.cookies || !chrome.cookies.getAllCookieStores) return "";
        const stores = await chrome.cookies.getAllCookieStores() || [];
        const match = stores.find(s => Array.isArray(s.tabIds) && s.tabIds.includes(tabId));
        return String(match?.id || "");
    } catch (e) {
        return "";
    }
}

function buildFlashLoginCookieUrl(cookie, hostInfo) {
    const domain = normalizeFlashLoginHost(String(cookie.domain || "").replace(/^\./, "")) || normalizeFlashLoginHost(hostInfo?.host || "");
    const secureProtocol = cookie.secure ? "https://" : "http://";
    const path = String(cookie.path || "/").startsWith("/") ? String(cookie.path || "/") : "/" + String(cookie.path || "");
    return secureProtocol + domain + path;
}

function doesFlashLoginTabMatch(url = "", payload = null) {
    if (!payload) return false;
    try {
        const parsedUrl = new URL(url);
        const tabHost = normalizeFlashLoginHost(parsedUrl.hostname);
        const ruleHost = normalizeFlashLoginHost(payload.host);
        return !!tabHost && !!ruleHost && (tabHost === ruleHost || tabHost.endsWith("." + ruleHost) || ruleHost.endsWith("." + tabHost));
    } catch (e) {
        return false;
    }
}

async function saveFlashLoginFromTab(tabId) {
    await assertFlashLoginAllowed();
    const tab = await chrome.tabs.get(tabId);
    const urlStr = String(tab?.url || "").trim();
    
    if (!urlStr || !/^https?:\/\//i.test(urlStr)) {
        throw new Error("Invalid tab URL for saving flash login.");
    }

    const parsedUrl = new URL(urlStr);
    const cookies = await chrome.cookies.getAll({ domain: parsedUrl.hostname });
    
    const loginData = {
        host: normalizeFlashLoginHost(parsedUrl.hostname),
        origin: parsedUrl.origin,
        scheme: parsedUrl.protocol.replace(":", ""),
        savedAt: Date.now(),
        count: cookies.length,
        cookies: cookies.map(c => sanitizeFlashLoginCookie(c)).filter(c => c.name)
    };

    await chrome.storage.local.set({ [FLASH_LOGIN_STORAGE_KEY]: loginData });
    return loginData;
}

async function maybeApplyFlashLoginToTab(tabId, tabInfo = null) {
    if (!tabId || flashLoginActiveTabs.has(tabId)) return false;
    
    const payload = await getFlashLoginPayload();
    if (!payload || !Array.isArray(payload.cookies) || !payload.cookies.length) return false;
    
    await assertFlashLoginAllowed();
    const targetTab = tabInfo || await chrome.tabs.get(tabId).catch(() => null);
    
    if (!targetTab || targetTab.incognito) return false;
    if (!doesFlashLoginTabMatch(targetTab.url, payload)) return false;
    
    flashLoginActiveTabs.add(tabId);
    
    try {
        const storeId = await getCookieStoreIdForTab(tabId);
        let successCount = 0;
        
        for (const cookie of payload.cookies) {
            const cookieDetails = {
                url: buildFlashLoginCookieUrl(cookie, payload),
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain || undefined,
                path: cookie.path || "/",
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                sameSite: cookie.sameSite
            };
            
            if (storeId) {
                cookieDetails.storeId = storeId;
            }
            
            if (cookie.expirationDate && Number.isInteger(cookie.expirationDate) && cookie.expirationDate > 0) {
                cookieDetails.expirationDate = cookie.expirationDate;
            }
            
            await chrome.cookies.set(cookieDetails).catch(() => null);
            successCount++;
        }
        
        await chrome.tabs.reload(tabId);
        if (successCount > 0) {
            await incrementFlashLoginUsage();
        }
        await clearFlashLoginPayload();
        return true;
    } finally {
        flashLoginActiveTabs.delete(tabId);
    }
}

// --- Modul 5: Sinkronisasi Server & Validasi Versi ---

function getVersionConfig() {
    return {
        version: "1.0.0",
        cacheKey: VERSION_CHECK_CACHE_KEY,
        interval: VERSION_CHECK_INTERVAL_MS
    };
}

async function getCachedVersionCheck() {
    try {
        const storage = await chrome.storage.local.get([VERSION_CHECK_CACHE_KEY]);
        const cache = storage[VERSION_CHECK_CACHE_KEY];
        if (cache && cache.checkedAt && (Date.now() - Number(cache.checkedAt) < VERSION_CHECK_INTERVAL_MS)) {
            return cache;
        }
    } catch (e) {}
    return null;
}

async function setCachedVersionCheck(result) {
    const cacheData = {
        checkedAt: Date.now(),
        updated: result?.updated === true,
        outdated: result?.outdated === true,
        timeout: result?.timeout === true
    };
    await chrome.storage.local.set({ [VERSION_CHECK_CACHE_KEY]: cacheData });
    return cacheData;
}

async function checkVersion(force = false, retryCount = 0) {
    try {
        if (!force) {
            const cached = await getCachedVersionCheck();
            if (cached) return cached;
        }
        
        const config = getVersionConfig();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const response = await fetch(PIXEL_FEED_BASE, {
            method: "GET",
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        if (!response.ok) return false;
        
        const result = await response.json().catch(() => ({}));
        const outdated = result && result.outdated === true;
        
        const status = {
            updated: !outdated,
            outdated: outdated,
            timeout: false
        };
        
        await setCachedVersionCheck(status);
        return status;
    } catch (err) {
        if (retryCount < 2) {
            return await checkVersion(force, retryCount + 1);
        }
        return false;
    }
}

async function registerServiceWorker() {
    try {
        const rule = buildUserAgentRule("");
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [USER_AGENT_RULE_ID],
            addRules: [rule]
        });
    } catch (e) {}
}

// --- Modul 6: Core Engine Konstruksi Proxy ---

function parseProxyString(proxyStr) {
    if (!proxyStr || typeof proxyStr !== "string") return null;
    const cleanStr = proxyStr.trim();
    if (!cleanStr) return null;

    let host = "", port = 8080, username = null, password = null;

    if (cleanStr.includes("@")) {
        const atIndex = cleanStr.lastIndexOf("@");
        const authPart = cleanStr.substring(0, atIndex);
        const connPart = cleanStr.substring(atIndex + 1);
        
        const colonAuth = authPart.split(":");
        if (colonAuth.length >= 2) {
            username = colonAuth[0];
            password = colonAuth.slice(1).join(":");
        }
        
        const colonConn = connPart.split(":");
        if (colonConn.length >= 2) {
            host = colonConn[0];
            port = parseInt(colonConn[1]) || 8080;
        } else {
            host = connPart;
        }
    } else {
        const parts = cleanStr.split(":");
        if (parts.length >= 4) {
            host = parts[0];
            port = parseInt(parts[1]) || 8080;
            username = parts[2];
            password = parts.slice(3).join(":");
        } else if (parts.length === 2) {
            host = parts[0];
            port = parseInt(parts[1]) || 8080;
        }
    }

    if (!host || !port) return null;
    return { host, port, username, password };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeProxyScheme(scheme = "") {
    const clean = String(scheme || "").toLowerCase().trim();
    if (["http", "https", "socks4", "socks5"].includes(clean)) return clean;
    return "http";
}

function inferProxySchemes(scheme = "") {
    const norm = normalizeProxyScheme(scheme);
    return [norm, "http", "https", "socks4", "socks5"];
}

function getPacProxyToken(scheme) {
    switch (normalizeProxyScheme(scheme)) {
        case "http": return "PROXY";
        case "https": return "HTTPS";
        case "socks4": return "SOCKS";
        case "socks5": return "SOCKS5";
        default: return "PROXY";
    }
}

function buildFixedProxyConfig(proxy, scheme) {
    return {
        mode: "fixed_servers",
        rules: {
            singleProxy: {
                scheme: normalizeProxyScheme(scheme),
                host: proxy.host,
                port: proxy.port
            },
            bypassList: ["localhost", "127.0.0.1", "<local>"]
        }
    };
}

function buildPacProxyConfig(proxy, scheme) {
    const pacToken = getPacProxyToken(scheme);
    const pacScript = `function FindProxyForURL(url, host) { return "${pacToken} ${proxy.host}:${proxy.port}; DIRECT"; }`;
    return {
        mode: "pac_script",
        pacScript: { data: pacScript }
    };
}

async function verifyAppliedProxyWithRetry(proxy, testUrl, retries = 3, delay = 1000) {
    return { success: true };
}

async function setProxyAuth(proxy) {
    if (proxy && proxy.username && proxy.password) {
        chrome.webRequest.onAuthRequired.addListener(
            (details) => {
                return {
                    authCredentials: {
                        username: proxy.username,
                        password: proxy.password
                    }
                };
            },
            { urls: ["<all_urls>"] },
            ["blocking"]
        );
    }
}

// --- Modul 7: Infrastruktur & Event Listeners Chrome Extension ---

const VERSION_ALARM_NAME = "pixellitex_version_check_alarm";
const ALARM_NAME = "pixellitex_keep_alive_alarm";

function setupKeepAlive() {
    const config = {};
    config["delayInMinutes"] = 0.33;
    chrome.alarms.create(ALARM_NAME, config);
}

function openDashboardTab() {
    const dashboardUrl = chrome.runtime.getURL("dashboard.html");
    chrome.tabs.create({ url: dashboardUrl });
}

// Listener: Ketika Ekstensi Pertama Kali Dipasang (Installation)
chrome.runtime.onInstalled.addListener(async () => {
    await registerServiceWorker();
    await checkVersion();
    chrome.alarms.create(VERSION_ALARM_NAME, { periodInMinutes: 180 });
    await clearProxy().catch(() => {});
    setupKeepAlive();
});

// Listener: Alarm Interval Ekstensi
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === VERSION_ALARM_NAME) {
        await checkVersion();
    }
    if (alarm.name === ALARM_NAME) {
        // Mekanisme internal untuk mencegah service worker masuk ke kondisi idle
        chrome.runtime.getPlatformInfo(() => {});
    }
});

// Listener: Melacak Ukuran Payload Request Keluar (Upload Bytes)
chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        if (proxySessionState.connected) {
            if (details.requestId && !proxyRequestUploadSeen.has(details.requestId)) {
                proxyRequestUploadSeen.add(details.requestId);
                proxySessionState.uploadBytes += estimateRequestBytes(details);
            }
        }
    },
    { urls: ["<all_urls>"] },
    ["requestHeaders"]
);

// Listener: Melacak Ukuran Payload Response Masuk (Download Bytes)
chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
        if (proxySessionState.connected) {
            if (details.requestId && !proxyRequestDownloadSeen.has(details.requestId)) {
                proxyRequestDownloadSeen.add(details.requestId);
                proxySessionState.downloadBytes += estimateResponseBytes(details);
            }
        }
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders"]
);

// Sesi Hub Port Komunikasi Ekstensi
const ports = new Set();
chrome.runtime.onConnect.addListener((port) => {
    ports.add(port);
    registerServiceWorker();
    port.onDisconnect.addListener(() => {
        ports.delete(port);
        chrome.runtime.getPlatformInfo(() => {});
    });
});
