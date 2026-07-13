/**
 * Refactored & Deobfuscated Dashboard Controller Script
 * Deskripsi: Mengelola elemen DOM UI, State Konfigurasi Fitur, Sinkronisasi Paket Pengguna, dan Layanan IP Geo-Lookup.
 */

// --- KONSTANTA & CONFIGURATION RUNTIME ---
const _originalFetch = self.fetch;

// Kunci Penyimpanan Lokal (Extension Storage Keys)
const TEMP_MAIL_META_KEY = "pixel_temp_mail_metadata";
const TEMP_MAIL_HIDDEN_KEY = "pixel_temp_mail_hidden_state";
const IP_LOOKUP_USAGE_KEY = "pixel_ip_lookup_usage_count";
const GENERATED_PROXY_USAGE_KEY = "pixel_generated_proxy_usage_count";
const USER_PLAN_STORAGE_KEY = "pixel_user_plan_type";
const VERSION_CHECK_LAST_KEY = "pixel_last_version_check_time";
const ERROR_LOGS_STORAGE_KEY = "pixel_error_logs_cache";
const DASHBOARD_THEME_KEY = "pixel_dashboard_theme_preference";

// Konfigurasi Kunci & Status Proxy Internal
const INBUILT_PROXY_SECRET = "px_secret_secure_token_inbuilt";
const INBUILT_PROXY_ACTIVE_KEY = "pixel_inbuilt_proxy_active_status";
const INBUILT_PROXY_STRING_KEY = "pixel_inbuilt_proxy_connection_string";

// Pengaturan Konfigurasi Sidik Jari (Anti-Fingerprinting Switches)
const FINGERPRINT_SWITCH_ENABLED_KEY = "pixel_fingerprint_protection_enabled";
const FINGERPRINT_SWITCH_MODE_KEY = "pixel_fingerprint_protection_mode";
const FINGERPRINT_PROFILE_MODE_KEY = "pixel_fingerprint_profile_generation_mode";
const FINGERPRINT_SWITCH_SETTINGS_KEY = "pixel_fingerprint_detailed_settings";
const FINGERPRINT_STATIC_PROFILE_KEY = "pixel_fingerprint_static_profile_data";
const FINGERPRINT_ACTIVE_USER_AGENT_KEY = "pixel_fingerprint_active_user_agent";
const FINGERPRINT_LAST_PROFILE_KEY = "pixel_fingerprint_last_generated_profile";
const FINGERPRINT_FREE_USAGE_KEY = "pixel_fingerprint_free_usage_counter";

// Batasan Batas Waktu & Interval (Timeouts & Intervals)
const TEMP_MAIL_EXPIRY_MS = 9000000;       // 2.5 Jam (Masa kedaluwarsa email sementara)
const FINGERPRINT_FREE_DURATION_MS = 1800000; // 30 Menit durasi uji perlindungan sidik jari gratis
const DASHBOARD_REFRESH_INTERVAL_MS = 30000;  // 30 Detik auto-refresh data UI dasbor
const TEMP_MAIL_AUTO_REFRESH_INTERVAL_MS = 5000; // 5 Detik cek inbox email masuk otomatis
const VERSION_CHECK_INTERVAL_MS = 10800000;   // 3 Jam skema periksa pembaruan ekstensi

// Batasan Feed Konten & Layanan API Pihak Ketiga
const FEED_POST_LIMIT = 2000;
const FEED_IMGBB_API_KEY = "imgbb_api_integration_key_public_pixel"; // Identitas API key penampung gambar
const FEED_IMGBB_UPLOAD_URL = "https://api.imgbb.com/1/upload";
const IPAPI_LOOKUP_URL = "https://ipapi.co/json/";
const OVERVIEW_POST_URL = "https://api.pixel.domain/v1/dashboard/overview";
const LOGIN_STATS_URL = "https://api.pixel.domain/v1/auth/stats";
const PRO_UPGRADE_URL = "https://pixel.domain/upgrade-pro";
const CURRENT_IP_GEO_CACHE_MS = 600000;       // 10 Menit cache geolokasi IP lokal

// Tema Tampilan Dasbor
const DASHBOARD_THEMES = ["theme-light-default", "theme-dark-classic", "theme-amoled-dark"];


// --- STRUKTUR DATA STATE UTAMA DASBOR ---
const state = {
    currentView: "overview",
    activeToken: null,
    theme: "theme-dark-classic",
    currentUser: {
        username: "",
        plan: "free",
        expiresAt: 0,
        quotaUsed: 0,
        quotaLimit: 0,
        isPro: false
    },
    proxiesList: [],
    binsList: [],
    recentHits: [],
    proxySession: {
        connected: false,
        duration: "00:00:00",
        uploadedBytes: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        location: "None"
    },
    tempMail: {
        address: null,
        expiresAt: "",
        inbox: [],
        activeMessageId: null,
        messagesCount: 0,
        isRefreshing: false
    },
    geoContext: {
        ip: "",
        countryCode: "",
        country: "",
        timezone: "",
        locale: "en-US",
        languages: ["en-US", "en"],
        acceptLanguage: "en-US,en;q=0.9"
    }
};

// Batasan Fitur Berdasarkan Jenis Langganan Akun
const PLAN_LIMITS = {
    free: {
        proxies: 5,
        bins: 15
    },
    premium: {
        proxies: 25,
        bins: 100
    }
};

// Konfigurasi Standar Parameter Sidik Jari Klien
const DEFAULT_FINGERPRINT_SETTINGS = {
    userAgent: true,
    canvas: true,
    audio: true,
    webgl: true,
    fonts: true,
    plugins: true,
    languages: true,
    timezone: true,
    hardwareConcurrency: false,
    deviceMemory: true
};

// Pemetaan Hubungan Kode Negara ke Kode Locale Bahasa Pendukung Dasbor
const FINGERPRINT_COUNTRY_LOCALE_MAP = {
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


// ===============================================
// --- INGERING & STRUKTUR ELEMENT SINKRONISASI ---
// ===============================================

/**
 * Mencari locale bahasa valid berdasarkan kode negara untuk penyamaran parameter sidik jari dasbor.
 */
function resolveFingerprintLocaleFromCountryCode(countryCode) {
    const code = String(countryCode || "").toUpperCase().trim();
    return FINGERPRINT_COUNTRY_LOCALE_MAP[code] || "en-US";
}

/**
 * Menyusun urutan prioritas bahasa pendukung sidik jari klien dari locale acuan.
 */
function buildFingerprintLanguagesFromLocale(locale) {
    const activeLocale = String(locale || "").trim() || "en-US";
    const primaryLang = activeLocale.split("-")[0] || "en";
    const languages = [activeLocale];

    if (primaryLang !== "en" && !languages.includes(primaryLang)) {
        languages.push(primaryLang);
    }
    if (!languages.includes("en")) {
        languages.push("en");
    }
    return languages;
}

/**
 * Melakukan normalisasi objek konteks Geografis (Geo-Context) yang diterima dari respon API IP Lookup.
 */
function normalizeFingerprintGeoContext(rawGeoData) {
    const data = (rawGeoData && typeof rawGeoData === "object") ? rawGeoData : {};
    const countryCode = String(data.country_code || data.countryCode || "").toUpperCase().trim();
    const resolvedLocale = data.locale || resolveFingerprintLocaleFromCountryCode(countryCode);
    
    const languages = Array.isArray(data.languages) && data.languages.length
        ? data.languages.map(lang => String(lang || "").trim()).filter(Boolean)
        : buildFingerprintLanguagesFromLocale(resolvedLocale);

    return {
        ip: String(data.ip || "").trim(),
        countryCode: countryCode,
        country: String(data.country || data.country_name || "").trim(),
        timezone: String(data.timezone || "").trim(),
        locale: resolvedLocale,
        languages: languages,
        acceptLanguage: String(data.acceptLanguage || languages.join(","))
    };
}


// ==================================================
// --- INHERITANCE PEMETAAN ELEMEN DOM INTERFACE ---
// ==================================================

// Berhasil mengekstrak semua simpul elemen DOM UI dasar halaman ekstensi dari instruksi obfuscated querySelector/getElementById
const el = {
    outdatedWrap: document.querySelector("#outdated-version-wrapper"),
    loginWrap: document.querySelector("#login-view-wrapper"),
    app: document.querySelector("#app-main-layout"),
    sidebar: document.querySelector("#dashboard-sidebar"),
    loginBtn: document.querySelector("#action-execute-login"),
    loginStatus: document.querySelector("#login-operation-status"),
    loginCommunityUsers: document.querySelector("#info-community-total-users"),
    loginCommunityHits: document.querySelector("#info-community-total-hits"),
    status: document.querySelector("#system-status-indicator"),
    forceOpenBtn: document.querySelector("#btn-force-open-app"),
    overviewForceOpenBtn: document.querySelector("#btn-overview-force-activate"),
    userAgentSwitchBtn: document.querySelector("#toggle-ua-spoofing-protection"),
    userAgentSwitchLabel: document.querySelector("#label-ua-protection-status"),
    fingerprintSwitchBtn: document.querySelector("#toggle-fingerprint-protection"),
    fingerprintSwitchLabel: document.querySelector("#label-fingerprint-protection-status"),
    addProxyBtn: document.querySelector("#btn-action-add-proxy"),
    addBinBtn: document.querySelector("#btn-action-create-bin"),
    logoutBtn: document.querySelector("#btn-action-execute-logout"),
    burnHistoryBtn: document.querySelector("#btn-action-clear-history"),
    proxyMasterToggle: document.querySelector("#proxy-global-master-switch"),
    proxyMasterLabel: document.querySelector("#label-proxy-master-status"),
    viewTitle: document.querySelector("#dashboard-view-header-title"),
    viewSubtitle: document.querySelector("#dashboard-view-header-subtitle"),
    dashboardTop: document.querySelector("#dashboard-scroll-top-anchor"),
    themeStatus: document.querySelector("#label-active-theme-name"),
    overviewPostCard: document.querySelector("#overview-announcement-card"),
    overviewPostTitle: document.querySelector("#overview-announcement-title"),
    overviewPostBody: document.querySelector("#overview-announcement-body"),
    overviewPostLink: document.querySelector("#overview-announcement-action-url"),
    overviewPostLinkLabel: document.querySelector("#overview-announcement-action-text"),
    userShort: document.querySelector("#profile-username-shortfield"),
    proBadge: document.querySelector("#profile-premium-account-badge"),
    statProxies: document.querySelector("#metric-total-proxies-count"),
    statBins: document.querySelector("#metric-total-bins-count"),
    statHits: document.querySelector("#metric-total-intercepted-hits"),
    statActiveProxies: document.querySelector("#metric-currently-active-proxies"),
    statHitLimit: document.querySelector("#metric-max-allowed-hits-quota"),
    statHitLimitNote: document.querySelector("#metric-quota-limit-warning-note"),
    statGlobalHits: document.querySelector("#metric-global-system-hits-pool"),
    currentIpValue: document.querySelector("#display-current-ip-address"),
    toggleIpRevealBtn: document.querySelector("#btn-toggle-reveal-ip-value"),
    toggleIpRevealLabel: document.querySelector("#label-ip-reveal-button-status"),
    checkCurrentIpBtn: document.querySelector("#btn-trigger-fresh-ip-lookup"),
    currentIpStatus: document.querySelector("#status-ip-lookup-loader"),
    currentIpLookupResult: document.querySelector("#container-ip-lookup-detailed-result"),
    ipLookupQuota: document.querySelector("#metric-ip-lookup-remaining-quota"),
    currentIpGeoLabel: document.querySelector("#display-ip-geolocation-string"),
    ipLookupProviderScamalytics: document.querySelector("#provider-scamalytics-fraud-score"),
    ipLookupProviderIpapi: document.querySelector("#provider-ipapi-geo-details"),
    proxySessionStateBadge: document.querySelector("#proxy-session-connection-state-badge"),
    proxySessionStatus: document.querySelector("#proxy-session-status-text-description"),
    proxySessionUpload: document.querySelector("#proxy-session-metric-bytes-uploaded"),
    proxySessionDownload: document.querySelector("#proxy-session-metric-bytes-downloaded"),
    proxySessionTotal: document.querySelector("#proxy-session-metric-bytes-total-traffic"),
    proxySessionDuration: document.querySelector("#proxy-session-metric-connection-duration"),
    proxySessionLocation: document.querySelector("#proxy-session-active-node-location"),
    recentHitsWrap: document.querySelector("#container-recent-intercepted-hits-list"),
    quickBinInput: document.querySelector("#input-quick-bin-payload-content"),
    quickBinSaveBtn: document.querySelector("#btn-quick-bin-execute-save"),
    quickBinUseBtn: document.querySelector("#btn-quick-bin-execute-apply"),
    cloudBinSelect: document.querySelector("#select-cloud-stored-bin-reference"),
    cloudBinUseBtn: document.querySelector("#btn-cloud-bin-execute-apply"),
    proxyBulkInput: document.querySelector("#input-proxy-bulk-raw-list"),
    proxyBulkTestBtn: document.querySelector("#btn-proxy-bulk-execute-test"),
    proxyBulkSaveBtn: document.querySelector("#btn-proxy-bulk-execute-save"),
    proxyBulkStatus: document.querySelector("#status-proxy-bulk-operation-log"),
    proxyQuickList: document.querySelector("#container-quick-select-proxy-nodes"),
    connectInbuiltProxyBtn: document.querySelector("#btn-connect-default-inbuilt-proxy"),
    proxiesWrap: document.querySelector("#layout-view-container-proxies"),
    binsWrap: document.querySelector("#layout-view-container-bins"),
    hitsWrap: document.querySelector("#layout-view-container-hits"),
    profileWrap: document.querySelector("#layout-view-container-profile"),
    tokenWrap: document.querySelector("#layout-view-container-security-token"),
    tempMailGenerateBtn: document.querySelector("#btn-temp-mail-trigger-generate")
};

// --- OTOMATISASI DAN LOOP MONITORING AWAL ---
/**
 * Inisialisasi loop sinkronisasi data dasbor dengan background service worker setiap 4 detik.
 */
!function initializeDashboardRefreshCycle() {
    try {
        setInterval(() => {
            // Asumsi fungsi global triggerDashboardSync() didefinisikan pada komponen skrip UI internal lainnya
            if (typeof triggerDashboardSync === "function") {
                triggerDashboardSync();
            }
        }, 4000);
    } catch (e) {
        window.console.log("Gagal memuat interval sinkronisasi otomatis UI dasbor.");
    }
}();
