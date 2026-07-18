/**
 * Pixellitex Dashboard Controller
 * Mengelola antarmuka pengguna (UI), state manajemen, serta koordinasi modul
 * proxy, anti-fingerprinting, temp-mail, dan feed komunitas ekstensi.
 */

// --- Konfigurasi Konstanta Global & API Endpoints ---
const TEMP_MAIL_META_KEY = "temp_mail_meta";
const TEMP_MAIL_HIDDEN_KEY = "temp_mail_hidden";
const TEMP_MAIL_EXPIRY_MS = 9000000; // 2.5 Jam
const IP_LOOKUP_USAGE_KEY = "ip_lookup_usage";
const GENERATED_PROXY_USAGE_KEY = "generated_proxy_usage";
const INBUILT_PROXY_SECRET = "pxl_inbuilt_secure_srv_auth_token";
const INBUILT_PROXY_ACTIVE_KEY = "inbuilt_proxy_active";
const INBUILT_PROXY_STRING_KEY = "inbuilt_proxy_string";

const FINGERPRINT_SWITCH_ENABLED_KEY = "fingerprint_enabled";
const FINGERPRINT_SWITCH_MODE_KEY = "fingerprint_mode";
const FINGERPRINT_PROFILE_MODE_KEY = "fingerprint_profile_mode";
const FINGERPRINT_SWITCH_SETTINGS_KEY = "fingerprint_settings";
const FINGERPRINT_STATIC_PROFILE_KEY = "fingerprint_static_profile";
const FINGERPRINT_ACTIVE_USER_AGENT_KEY = "fingerprint_active_ua";
const FINGERPRINT_LAST_PROFILE_KEY = "fingerprint_last_profile";
const FINGERPRINT_FREE_USAGE_KEY = "fingerprint_free_usage";
const FINGERPRINT_FREE_DURATION_MS = 1800000; // 30 Menit

const USER_PLAN_STORAGE_KEY = "user_plan";
const DASHBOARD_REFRESH_INTERVAL_MS = 30000; // 30 Detik
const TEMP_MAIL_AUTO_REFRESH_INTERVAL_MS = 5000; // 5 Detik
const VERSION_CHECK_INTERVAL_MS = 10800000; // 3 Jam
const VERSION_CHECK_LAST_KEY = "version_check_last";
const ERROR_LOGS_STORAGE_KEY = "error_logs";
const DASHBOARD_THEME_KEY = "dashboard_theme";

const FEED_POST_LIMIT = 2000;
const FEED_IMGBB_API_KEY = "imgbb_client_upload_public_key_token";
const FEED_IMGBB_UPLOAD_URL = "https://api.imgbb.com/1/upload";
const OVERVIEW_POST_URL = "https://api.pixelhit.io/posts";
const LOGIN_STATS_URL = "https://api.pixelhit.io/user/stats";
const PRO_UPGRADE_URL = "https://pixelhit.io/dashboard/upgrade";

const DASHBOARD_THEMES = ["theme-light", "theme-dark", "theme-amoled"];

// --- Global Application State Container ---
const state = {
    user: null,
    plan: "free",
    limits: { proxies: 5, bins: 15 },
    proxies: [],
    bins: [],
    hits: [],
    inbuiltProxyActive: false,
    generatedProxies: [],
    activeView: "overview",
    tempMail: {
        activeEmail: null,
        meta: "",
        messages: [],
        rawHtml: "",
        rawText: "",
        urls: [],
        loading: false
    },
    fingerprint: {
        enabled: false,
        mode: "browser",
        profileMode: "rotating",
        settings: {},
        staticProfile: null,
        activeUa: "",
        freeUsage: null
    },
    errorLogs: [],
    theme: "theme-dark",
    currentIpGeo: {
        ip: "",
        countryCode: "",
        country: "",
        timezone: "",
        locale: "en-US",
        languages: ["en-US", "en"],
        acceptLanguage: "en-US,en;q=0.9"
    }
};

const PLAN_LIMITS = {
    free: { proxies: 5, bins: 15 },
    premium: { proxies: 25, bins: 100 }
};

// --- Inisialisasi Elemen Antarmuka (DOM Selector Mapping) ---
const el = {
    outdatedWrap: document.querySelector(".outdated-wrap"),
    loginWrap: document.querySelector(".login-wrap"),
    app: document.querySelector("#app"),
    sidebar: document.querySelector(".sidebar"),
    loginBtn: document.querySelector(".login-btn"),
    loginStatus: document.querySelector(".login-status"),
    loginCommunityUsers: document.querySelector(".community-users"),
    loginCommunityHits: document.querySelector(".community-hits"),
    status: document.querySelector(".status"),
    forceOpenBtn: document.querySelector(".force-open-btn"),
    overviewForceOpenBtn: document.querySelector(".overview-force-open-btn"),
    userAgentSwitchBtn: document.querySelector(".ua-switch-btn"),
    userAgentSwitchLabel: document.querySelector(".ua-switch-label"),
    fingerprintSwitchBtn: document.querySelector(".fp-switch-btn"),
    fingerprintSwitchLabel: document.querySelector(".fp-switch-label"),
    addProxyBtn: document.querySelector(".add-proxy-btn"),
    addBinBtn: document.querySelector(".add-bin-btn"),
    logoutBtn: document.querySelector(".logout-btn"),
    burnHistoryBtn: document.querySelector(".burn-history-btn"),
    proxyMasterToggle: document.querySelector(".proxy-master-toggle"),
    proxyMasterLabel: document.querySelector(".proxy-master-label"),
    viewTitle: document.querySelector(".view-title"),
    viewSubtitle: document.querySelector(".view-subtitle"),
    dashboardTop: document.querySelector(".dashboard-top"),
    themeStatus: document.querySelector(".theme-status"),
    overviewPostCard: document.querySelector(".overview-post-card"),
    overviewPostTitle: document.querySelector(".overview-post-title"),
    overviewPostBody: document.querySelector(".overview-post-body"),
    overviewPostLink: document.querySelector(".overview-post-link"),
    overviewPostLinkLabel: document.querySelector(".overview-post-link-label"),
    userShort: document.querySelector(".user-short"),
    proBadge: document.querySelector(".pro-badge"),
    statProxies: document.querySelector(".stat-proxies"),
    statBins: document.querySelector(".stat-bins"),
    statHits: document.querySelector(".stat-hits"),
    statActiveProxies: document.querySelector(".stat-active-proxies"),
    statHitLimit: document.querySelector(".stat-hit-limit"),
    statHitLimitNote: document.querySelector(".stat-hit-limit-note"),
    statGlobalHits: document.querySelector(".stat-global-hits"),
    currentIpValue: document.querySelector(".current-ip-value"),
    toggleIpRevealBtn: document.querySelector(".toggle-ip-reveal-btn"),
    toggleIpRevealLabel: document.querySelector(".toggle-ip-reveal-label"),
    checkCurrentIpBtn: document.querySelector(".check-current-ip-btn"),
    currentIpStatus: document.querySelector(".current-ip-status"),
    currentIpLookupResult: document.querySelector(".current-ip-lookup-result"),
    ipLookupQuota: document.querySelector(".ip-lookup-quota"),
    currentIpGeoLabel: document.querySelector(".current-ip-geo-label"),
    ipLookupProviderScamalytics: document.querySelector(".provider-scamalytics"),
    ipLookupProviderIpapi: document.querySelector(".provider-ipapi"),
    proxySessionStateBadge: document.querySelector(".proxy-session-state-badge"),
    proxySessionStatus: document.querySelector(".proxy-session-status"),
    proxySessionUpload: document.querySelector(".proxy-session-upload"),
    proxySessionDownload: document.querySelector(".proxy-session-download"),
    proxySessionTotal: document.querySelector(".proxy-session-total"),
    proxySessionDuration: document.querySelector(".proxy-session-duration"),
    proxySessionLocation: document.querySelector(".proxy-session-location"),
    recentHitsWrap: document.querySelector(".recent-hits-wrap"),
    quickBinInput: document.querySelector(".quick-bin-input"),
    quickBinSaveBtn: document.querySelector(".quick-bin-save-btn"),
    quickBinUseBtn: document.querySelector(".quick-bin-use-btn"),
    cloudBinSelect: document.querySelector(".cloud-bin-select"),
    cloudBinUseBtn: document.querySelector(".cloud-bin-use-btn"),
    proxyBulkInput: document.querySelector(".proxy-bulk-input"),
    proxyBulkTestBtn: document.querySelector(".proxy-bulk-test-btn"),
    proxyBulkSaveBtn: document.querySelector(".proxy-bulk-save-btn"),
    proxyBulkStatus: document.querySelector(".proxy-bulk-status"),
    proxyQuickList: document.querySelector(".proxy-quick-list"),
    connectInbuiltProxyBtn: document.querySelector(".connect-inbuilt-proxy-btn"),
    proxiesWrap: document.querySelector(".proxies-wrap"),
    binsWrap: document.querySelector(".bins-wrap"),
    hitsWrap: document.querySelector(".hits-wrap"),
    profileWrap: document.querySelector(".profile-wrap"),
    tokenWrap: document.querySelector(".token-wrap"),
    tempMailGenerateBtn: document.querySelector(".temp-mail-generate-btn"),
    tempMailUsageRefreshBtn: document.querySelector(".temp-mail-usage-refresh-btn"),
    tempMailUsageStatus: document.querySelector(".temp-mail-usage-status"),
    tempMailUsageSummary: document.querySelector(".temp-mail-usage-summary"),
    tempMailList: document.querySelector(".temp-mail-list"),
    tempMailEmailInput: document.querySelector(".temp-mail-email-input"),
    tempMailMessagesRefreshBtn: document.querySelector(".temp-mail-messages-refresh-btn"),
    tempMailMessagesStatus: document.querySelector(".temp-mail-messages-status"),
    tempMailMessagesWrap: document.querySelector(".temp-mail-messages-wrap"),
    tempMailCopyBtn: document.querySelector(".temp-mail-copy-btn"),
    tempMailViewHtmlBtn: document.querySelector(".temp-mail-view-html-btn"),
    tempMailReadStatus: document.querySelector(".temp-mail-read-status"),
    tempMailReaderEmpty: document.querySelector(".temp-mail-reader-empty"),
    tempMailText: document.querySelector(".temp-mail-text"),
    tempMailUrlList: document.querySelector(".temp-mail-url-list"),
    communityLockedWrap: document.querySelector(".community-locked-wrap"),
    communityPremiumWrap: document.querySelector(".community-premium-wrap"),
    communityUpgradeBtn: document.querySelector(".community-upgrade-btn"),
    communityRefreshBtn: document.querySelector(".community-refresh-btn"),
    communityBinsStatus: document.querySelector(".community-bins-status"),
    communityBinsFeed: document.querySelector(".community-bins-feed"),
    communityProxyStatus: document.querySelector(".community-proxy-status"),
    communityProxyFeed: document.querySelector(".community-proxy-feed"),
    feedComposerAvatar: document.querySelector(".feed-composer-avatar"),
    feedComposerName: document.querySelector(".feed-composer-name"),
    feedStatus: document.querySelector(".feed-status"),
    feedComposerText: document.querySelector(".feed-composer-text"),
    feedComposerImage: document.querySelector(".feed-composer-image"),
    feedComposerImageName: document.querySelector(".feed-composer-image-name"),
    feedImagePreview: document.querySelector(".feed-image-preview"),
    feedComposerMeta: document.querySelector(".feed-composer-meta"),
    feedRefreshBtn: document.querySelector(".feed-refresh-btn"),
    feedSubmitBtn: document.querySelector(".feed-submit-btn"),
    feedList: document.querySelector(".feed-list"),
    generateProxyLockedWrap: document.querySelector(".generate-proxy-locked-wrap"),
    generateProxyPremiumWrap: document.querySelector(".generate-proxy-premium-wrap"),
    generateProxyUpgradeBtn: document.querySelector(".generate-proxy-upgrade-btn"),
    generateProxyBtn: document.querySelector(".generate-proxy-btn"),
    generateProxyDownloadBtn: document.querySelector(".generate-proxy-download-btn"),
    generateProxyStatus: document.querySelector(".generate-proxy-status"),
    generateProxyQuota: document.querySelector(".generate-proxy-quota"),
    generateProxyModal: document.querySelector(".generate-proxy-modal"),
    generateProxyIpInput: document.querySelector(".generate-proxy-ip-input"),
    generateProxyModalStatus: document.querySelector(".generate-proxy-modal-status"),
    generateProxyModalMyIp: document.querySelector(".generate-proxy-modal-my-ip"),
    generateProxyModalCancel: document.querySelector(".generate-proxy-modal-cancel"),
    generateProxyModalConfirm: document.querySelector(".generate-proxy-modal-confirm"),
    userAgentModal: document.querySelector(".user-agent-modal"),
    userAgentBrowserSelect: document.querySelector(".ua-browser-select"),
    userAgentDeviceSelect: document.querySelector(".ua-device-select"),
    userAgentPreview: document.querySelector(".ua-preview"),
    userAgentStatus: document.querySelector(".ua-status"),
    userAgentGenerateBtn: document.querySelector(".ua-generate-btn"),
    userAgentResetBtn: document.querySelector(".ua-reset-btn"),
    userAgentModalCancel: document.querySelector(".ua-modal-cancel"),
    userAgentApplyBtn: document.querySelector(".ua-apply-btn"),
    fingerprintModal: document.querySelector(".fingerprint-modal"),
    fingerprintModeCheckout: document.querySelector(".fp-mode-checkout"),
    fingerprintModeBrowser: document.querySelector(".fp-mode-browser"),
    fingerprintProfileModeRotating: document.querySelector(".fp-profile-mode-rotating"),
    fingerprintProfileModeStatic: document.querySelector(".fp-profile-mode-static"),
    fingerprintUserAgentPreviewWrap: document.querySelector(".fp-ua-preview-wrap"),
    fingerprintUserAgentPreview: document.querySelector(".fp-ua-preview"),
    fingerprintConfigPreviewWrap: document.querySelector(".fp-config-preview-wrap"),
    fingerprintConfigPreview: document.querySelector(".fp-config-preview"),
    fingerprintStatus: document.querySelector(".fp-status"),
    fingerprintModalCancel: document.querySelector(".fp-modal-cancel"),
    fingerprintToggleOffBtn: document.querySelector(".fp-toggle-off-btn"),
    fingerprintToggleOnBtn: document.querySelector(".fp-toggle-on-btn"),
    infoModal: document.querySelector(".info-modal"),
    infoModalTitle: document.querySelector(".info-modal-title"),
    infoModalText: document.querySelector(".info-modal-text"),
    infoModalOk: document.querySelector(".info-modal-ok"),
    imageViewerModal: document.querySelector(".image-viewer-modal"),
    imageViewerImg: document.querySelector(".image-viewer-img"),
    imageViewerClose: document.querySelector(".image-viewer-close"),
    proxyConnectModal: document.querySelector(".proxy-connect-modal"),
    proxyConnectModalTitle: document.querySelector(".proxy-connect-modal-title"),
    proxyConnectModalText: document.querySelector(".proxy-connect-modal-text"),
    proxyConnectModalSubtext: document.querySelector(".proxy-connect-modal-subtext"),
    fingerprintLoadingModal: document.querySelector(".fp-loading-modal"),
    fingerprintLoadingModalTitle: document.querySelector(".fp-loading-modal-title"),
    fingerprintLoadingModalText: document.querySelector(".fp-loading-modal-text"),
    fingerprintLoadingModalSubtext: document.querySelector(".fp-loading-modal-subtext"),
    proxyModal: document.querySelector(".proxy-modal"),
    proxyId: document.querySelector(".proxy-id"),
    proxyLabel: document.querySelector(".proxy-label"),
    proxyAddress: document.querySelector(".proxy-address"),
    proxyType: document.querySelector(".proxy-type"),
    proxyModalTitle: document.querySelector(".proxy-modal-title"),
    proxyCancel: document.querySelector(".proxy-cancel"),
    proxySave: document.querySelector(".proxy-save"),
    binModal: document.querySelector(".bin-modal"),
    binId: document.querySelector(".bin-id"),
    binValue: document.querySelector(".bin-value"),
    binLabel: document.querySelector(".bin-label"),
    binExtra: document.querySelector(".bin-extra"),
    binModalTitle: document.querySelector(".bin-modal-title"),
    binCancel: document.querySelector(".bin-cancel"),
    binSave: document.querySelector(".bin-save"),
    tosModal: document.querySelector(".tos-modal"),
    tosAgreeCheck: document.querySelector(".tos-agree-check"),
    tosReject: document.querySelector(".tos-reject"),
    tosAccept: document.querySelector(".tos-accept"),
    burnModal: document.querySelector(".burn-modal"),
    burnConfirmCheck: document.querySelector(".burn-confirm-check"),
    burnConfirmCheck2: document.querySelector(".burn-confirm-check-2"),
    burnCancel: document.querySelector(".burn-cancel"),
    burnProceed: document.querySelector(".burn-proceed"),
    forceOpenModal: document.querySelector(".force-open-modal"),
    forceOpenStatus: document.querySelector(".force-open-status"),
    forceOpenTabList: document.querySelector(".force-open-tab-list"),
    forceOpenCancel: document.querySelector(".force-open-cancel"),
    forceOpenConfirm: document.querySelector(".force-open-confirm"),
    flashLoginBtn: document.querySelector(".flash-login-btn"),
    flashLoginClearBtn: document.querySelector(".flash-login-clear-btn"),
    flashLoginInfo: document.querySelector(".flash-login-info"),
    flashLoginModal: document.querySelector(".flash-login-modal"),
    flashLoginStatus: document.querySelector(".flash-login-status"),
    flashLoginTabList: document.querySelector(".flash-login-tab-list"),
    flashLoginCancel: document.querySelector(".flash-login-cancel"),
    flashLoginConfirm: document.querySelector(".flash-login-confirm"),
    proxyFraudModal: document.querySelector(".proxy-fraud-modal"),
    proxyFraudStatus: document.querySelector(".proxy-fraud-status"),
    proxyFraudResult: document.querySelector(".proxy-fraud-result"),
    proxyFraudClose: document.querySelector(".proxy-fraud-close"),
    appBarToggle: document.querySelector(".app-bar-toggle"),
    upgradeBtn: document.querySelector(".upgrade-btn"),
    upgradeNavBtn: document.querySelector(".upgrade-nav-btn"),
    upgradeCurrentPlanBtn: document.querySelector(".upgrade-current-plan-btn"),
    upgradeCardLink: document.querySelector(".upgrade-card-link"),
    upgradeSixMonthLink: document.querySelector(".upgrade-6month-link"),
    upgradePlanPrice: document.querySelector(".upgrade-plan-price"),
    upgradeCallout: document.querySelector(".upgrade-callout"),
    upgradeFooterNote: document.querySelector(".upgrade-footer-note"),
    navButtons: Array.from(document.querySelectorAll(".nav-btn")),
    mobileAllSectionsBtn: document.querySelector(".mobile-all-sections-btn"),
    views: Array.from(document.querySelectorAll(".view")),
    overviewSwitchButtons: Array.from(document.querySelectorAll(".overview-switch-btn")),
    overviewSections: Array.from(document.querySelectorAll(".overview-section")),
    countrySearch: document.querySelector(".country-search"),
    countryResults: document.querySelector(".country-results"),
    countryCurrent: document.querySelector(".country-current"),
    countryCurrentText: document.querySelector(".country-current-text"),
    countrySave: document.querySelector(".country-save"),
    countryStatus: document.querySelector(".country-status"),
    checkoutSettingsBtn: document.querySelector(".checkout-settings-btn"),
    checkoutNameInput: document.querySelector(".checkout-name-input"),
    checkoutEmailInput: document.querySelector(".checkout-email-input"),
    customAddressToggle: document.querySelector(".custom-address-toggle"),
    customAddressBadge: document.querySelector(".custom-address-badge"),
    customAddressFields: document.querySelector(".custom-address-fields"),
    customAddressLine1Input: document.querySelector(".custom-address-line1-input"),
    customAddressCityInput: document.querySelector(".custom-address-city-input"),
    customAddressStateInput: document.querySelector(".custom-address-state-input"),
    customAddressPostcodeInput: document.querySelector(".custom-address-postcode-input"),
    formFillingStyleSelect: document.querySelector(".form-filling-style-select")
};

let autoRefreshTimer = null;
let autoRefreshInFlight = false;
let proxySessionTicker = null;
let fingerprintCountdownTimer = null;
let fingerprintDisableInFlight = false;
let tempMailAutoRefreshTimer = null;
let tempMailAutoRefreshInFlight = false;
let currentIpGeoRefreshInFlight = false;
let currentView = "overview";

let countrySelection = { countryCode: "US", countryName: null };
let customAddressSelection = { enabled: false, line1: "", city: "", state: "", postcode: "" };

// --- Modul 1: Fungsi Utilitas & Penformatan Data ---

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatBytes(bytes) {
    const value = Math.max(Number(bytes || 0), 0);
    if (value < 1024) return value + " B";
    if (value < 1048576) return (value / 1024).toFixed(1) + " KB";
    if (value < 1073741824) return (value / 1048576).toFixed(2) + " MB";
    return (value / 1073741824).toFixed(2) + " GB";
}

function formatDurationShort(ms) {
    const totalSeconds = Math.max(Math.floor(Number(ms || 0) / 1000), 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return seconds + "s";
}

function sanitizeLogText(text) {
    let clean = String(text || "").trim();
    if (!clean) return "";
    clean = clean.replace(/https?:\/\/[^\s]+/gi, "[URL]");
    clean = clean.replace(/\b(?:[a-z]+:\/\/)?(?:[^@\s/:]+:[^@\s/:]+@)?(?:\d{1,3}\.){3}\d{1,3}:\d{2,5}(?::[^\s]+)?/gi, "[PROXY_IP]");
    clean = clean.replace(/\b(?:[a-z]+:\/\/)?(?:[^@\s/:]+:[^@\s/:]+@)?[a-z0-9.-]+\.[a-z]{2,}:\d{2,5}(?::[^\s]+)?/gi, "[PROXY_DOMAIN]");
    return clean;
}

async function saveErrorLogs() {
    const cleanLogs = Array.isArray(state.errorLogs) ? state.errorLogs.slice(0, 50) : [];
    try {
        const payload = {};
        payload[ERROR_LOGS_STORAGE_KEY] = cleanLogs;
        await chrome.storage.local.set(payload);
    } catch (e) {}
}

async function loadErrorLogs() {
    try {
        const storage = await chrome.storage.local.get([ERROR_LOGS_STORAGE_KEY]);
        state.errorLogs = Array.isArray(storage[ERROR_LOGS_STORAGE_KEY]) ? storage[ERROR_LOGS_STORAGE_KEY] : [];
    } catch (e) {}
}

function appendErrorLog(message, source = "dashboard") {
    const sanitized = sanitizeLogText(message);
    if (!sanitized) return;

    const newLog = {
        id: Date.now() + "_" + Math.random().toString(36).substring(2, 10),
        at: new Date().toISOString(),
        source: String(source || "dashboard"),
        message: sanitized
    };

    state.errorLogs = [newLog, ...(Array.isArray(state.errorLogs) ? state.errorLogs : [])].slice(0, 50);
    saveErrorLogs();
}

function logProxyError(message) {
    appendErrorLog(message, "proxy_core");
}

function escapeHtml(text) {
    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDate(dateString) {
    if (!dateString) return "-";
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) return dateString;
    return parsed.toLocaleString();
}

function parseApiDateTime(dateValue) {
    if (typeof dateValue === "number" && Number.isInteger(dateValue)) {
        const dateObj = new Date(dateValue * 1000);
        return Number.isNaN(dateObj.getTime()) ? null : dateObj;
    }
    const cleanStr = String(dateValue || "").trim();
    if (!cleanStr) return null;
    const isoStr = cleanStr.replace(" ", "T");
    const parsedDate = new Date(isoStr);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function shortToken(token) {
    if (!token) return "-";
    if (token.length < 14) return token;
    return token.substring(0, 6) + "..." + token.substring(token.length - 4);
}

// --- Modul 2: Geo-Context & Localization Resolver ---

function resolveFingerprintLocaleFromCountryCode(countryCode) {
    const code = String(countryCode || "").trim().toUpperCase();
    return FINGERPRINT_COUNTRY_LOCALE_MAP[code] || "en-US";
}

function buildFingerprintLanguagesFromLocale(locale) {
    const cleanLocale = String(locale || "").trim();
    const primaryLang = cleanLocale.split("-")[0] || "en";
    const languages = [cleanLocale];

    if (!languages.includes(primaryLang)) {
        languages.push(primaryLang);
    }
    if (!languages.includes("en")) {
        languages.push("en");
    }
    return languages;
}

function normalizeFingerprintGeoContext(geoInfo) {
    const baseObj = geoInfo && typeof geoInfo === "object" ? geoInfo : {};
    const countryCode = String(baseObj.countryCode || baseObj.country_code || "").trim().toUpperCase();
    const locale = baseObj.locale || resolveFingerprintLocaleFromCountryCode(countryCode);
    const languages = Array.isArray(baseObj.languages) && baseObj.languages.length 
        ? baseObj.languages.map(l => String(l || "").trim()).filter(Boolean)
        : buildFingerprintLanguagesFromLocale(locale);

    return {
        ip: String(baseObj.ip || "").trim(),
        countryCode: countryCode,
        country: String(baseObj.country || baseObj.country_name || "").trim(),
        timezone: String(baseObj.timezone || baseObj.time_zone || "").trim(),
        locale: locale,
        languages: languages,
        acceptLanguage: String(baseObj.acceptLanguage || baseObj.accept_language || "").trim() || languages.join(",")
    };
}

function normalizeFingerprintMode(value) {
    const clean = String(value || "").trim().toLowerCase();
    return ["checkout", "browser"].includes(clean) ? clean : "browser";
}

function normalizeFingerprintProfileMode(value) {
    const clean = String(value || "").trim().toLowerCase();
    return ["static", "rotating"].includes(clean) ? clean : "rotating";
}

function normalizeFingerprintSettings(settingsObj) {
    const target = settingsObj && typeof settingsObj === "object" ? settingsObj : {};
    return {
        userAgent: target.userAgent !== false,
        canvas: target.canvas !== false,
        audio: target.audio !== false,
        webgl: target.webgl !== false,
        webgpu: target.webgpu !== false,
        voice: target.voice !== false,
        plugins: target.plugins !== false,
        fonts: target.fonts !== false,
        screen: target.screen !== false,
        timezone: target.timezone !== false
    };
}

function isFingerprintFreeUsageToday(usageObj) {
    return !!(usageObj && String(usageObj.day || "").trim() === getLocalDayKey());
}

function getFingerprintFreeRemainingMs() {
    if (state.plan !== "free") return Number.MAX_SAFE_INTEGER;
    const usage = normalizeFingerprintFreeUsage(state.fingerprint.freeUsage);
    if (!usage || !isFingerprintFreeUsageToday(usage)) return 0;
    
    const elapsed = Date.now() - new Date(usage.usedAt).getTime();
    return Math.max(FINGERPRINT_FREE_DURATION_MS - elapsed, 0);
}

// --- Modul 3: UI Rendering Engines & State Sync ---

function setStatus(text, type = "") {
    if (!el.status) return;
    el.status.innerText = text;
    el.status.className = "status " + type;
    el.status.classList.toggle("hidden", !text);
}

function setLoginStatus(text, type = "") {
    if (!el.loginStatus) return;
    el.loginStatus.innerText = text;
    el.loginStatus.className = "login-status " + type;
}

function renderFingerprintUserAgentPreview() {
    const isEnabled = state.fingerprint.enabled === true;
    const settings = normalizeFingerprintSettings(state.fingerprint.settings);
    const activeUa = String(state.fingerprint.activeUa || "").trim();

    if (el.fingerprintUserAgentPreviewWrap) {
        el.fingerprintUserAgentPreviewWrap.classList.toggle("hidden", !(isEnabled && settings.userAgent && activeUa));
    }
    if (el.fingerprintUserAgentPreview) {
        el.fingerprintUserAgentPreview.innerText = isEnabled && settings.userAgent ? activeUa : "";
    }
}

function formatFingerprintConfigPreview(config) {
    if (!config || typeof config !== "object") return "";
    const cleanConfig = {
        hardwareConcurrency: config.hardwareConcurrency || "",
        deviceMemory: config.deviceMemory || "",
        maxTouchPoints: config.maxTouchPoints || 0,
        devicePixelRatio: config.devicePixelRatio || "",
        platform: config.platform || "",
        vendor: config.vendor || "",
        publicIp: config.publicIp || "",
        screen: config.screen || {},
        canvas: config.features?.canvas || null,
        audio: config.features?.audio || null,
        webgl: config.features?.webgl || null,
        voices: config.features?.voices ? { count: config.features.voices.length || 0 } : null,
        plugins: config.features?.plugins ? { count: config.features.plugins.length || 0 } : null,
        fonts: config.features?.fonts ? { count: config.features.fonts.length || 0 } : null,
        localization: config.localization || null
    };
    return JSON.stringify(cleanConfig, null, 2);
}

function renderFingerprintConfigPreview() {
    const isEnabled = state.fingerprint.enabled === true;
    const previewText = formatFingerprintConfigPreview(state.fingerprint.lastProfile);

    if (el.fingerprintConfigPreviewWrap) {
        el.fingerprintConfigPreviewWrap.classList.toggle("hidden", !isEnabled);
    }
    if (el.fingerprintConfigPreview) {
        el.fingerprintConfigPreview.innerText = isEnabled ? previewText : "";
    }
}

function getFingerprintOnMessage(activeUa, remainingMs, options = {}) {
    const mode = normalizeFingerprintMode(activeUa);
    const template = options.activated 
        ? `Anti-Fingerprint Engine Active (${mode.toUpperCase()} mode). Profile Protection system initialized.` 
        : `Fingerprint parameters simulated under ${getFingerprintModeTarget(mode)} specification.`;

    if (state.plan === "free" && Number.isInteger(remainingMs) && remainingMs > 0) {
        return template + ` Protection session expires in: ${formatFingerprintCountdown(remainingMs)}.`;
    }
    return template;
}

function getFingerprintModeTarget(mode) {
    return normalizeFingerprintMode(mode) === "checkout" ? "High-Trust E-Commerce Variant" : "Standard Anti-Bot Evasion Profile";
}

function formatFingerprintCountdown(ms) {
    const totalSeconds = Math.max(Math.floor(Number(ms || 0) / 1000), 0);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}

function renderFingerprintControl() {
    const isEnabled = state.fingerprint.enabled === true;
    const remainingMs = getFingerprintFreeRemainingMs();
    const hasQuota = state.plan !== "free" || remainingMs > 0 || !isFingerprintFreeUsageToday(state.fingerprint.freeUsage);

    if (el.fingerprintSwitchBtn) {
        el.fingerprintSwitchBtn.checked = isEnabled;
        el.fingerprintSwitchBtn.disabled = !hasQuota && !isEnabled;
    }

    if (el.fingerprintStatus) {
        if (isEnabled) {
            el.fingerprintStatus.innerText = getFingerprintOnMessage(state.fingerprint.mode, remainingMs, { activated: true });
            el.fingerprintStatus.className = "fp-status success";
        } else {
            el.fingerprintStatus.innerText = hasQuota 
                ? "Protection Engine Suspended. Ready to launch secure session sandbox."
                : "Daily free trial period exhausted. Premium license required to extend rotation windows.";
            el.fingerprintStatus.className = hasQuota ? "fp-status generic" : "fp-status warning";
        }
    }

    if (el.fingerprintToggleOnBtn && el.fingerprintToggleOffBtn) {
        el.fingerprintToggleOnBtn.classList.toggle("hidden", isEnabled);
        el.fingerprintToggleOffBtn.classList.toggle("hidden", !isEnabled);
        el.fingerprintToggleOnBtn.disabled = !hasQuota;
    }

    renderFingerprintUserAgentPreview();
    renderFingerprintConfigPreview();
}

// --- Modul 4: Core Engine Data Management & Messaging Hub ---

async function loadDashboardFingerprintReferenceData() {
    if (dashboardFingerprintReferenceDataPromise) return dashboardFingerprintReferenceDataPromise;

    dashboardFingerprintReferenceDataPromise = (async () => {
        try {
            const assetUrl = chrome.runtime.getURL("assets/devices.json");
            const response = await fetch(assetUrl);
            if (response.ok) {
                return await response.json();
            }
            return {};
        } catch (e) {
            return {};
        }
    })();
    return dashboardFingerprintReferenceDataPromise;
}

function pickFingerprintPreviewValue(array, fallback = null) {
    const cleanArr = Array.isArray(array) ? array.filter(v => v != null) : [];
    if (!cleanArr.length) return fallback;
    return cleanArr[Math.floor(Math.random() * cleanArr.length)];
}

function resolveFingerprintPreviewSharedCapacity() {
    const cores = Math.max(1, Math.min(16, Number(navigator.hardwareConcurrency || 0)));
    const ram = Math.max(1, Math.min(16, Number(navigator.deviceMemory || 0)));
    const selected = Math.max(1, Math.min(4, cores || ram || 4));
    
    const minVal = Math.max(1, Math.floor(selected / 2));
    const maxVal = selected + 2;
    const pool = [];

    for (let i = minVal; i <= maxVal; i++) {
        pool.push(i);
    }
    return pickFingerprintPreviewValue(pool, selected);
}

function buildFingerprintPreviewProfile(settings, referenceData, customUa = "", geoContext = {}) {
    const resolvedCapacity = resolveFingerprintPreviewSharedCapacity();
    const isMobileUa = /android|iphone|ipad|ipod|mobile/i.test(customUa || navigator.userAgent || "");
    const viewWidth = Math.max(window.screen?.width || 0, 1024);
    const viewHeight = Math.max(window.screen?.height || 0, 768);

    const profile = {
        enabled: true,
        hardwareConcurrency: resolvedCapacity,
        deviceMemory: resolvedCapacity,
        maxTouchPoints: isMobileUa ? pickFingerprintPreviewValue([5, 10], 5) : 0,
        devicePixelRatio: settings.screen ? Number(pickFingerprintPreviewValue(isMobileUa ? [2, 2.5, 3] : [1, 1.25, 1.5, 2], 1).toFixed(2)) : Number(window.devicePixelRatio || 1),
        platform: String(navigator.platform || "").toLowerCase(),
        vendor: String(navigator.vendor || "").toLowerCase(),
        publicIp: String(geoContext.ip || "").trim(),
        screen: {
            width: Number(viewWidth),
            height: Number(viewHeight),
            availWidth: Number(window.screen?.availWidth || viewWidth),
            availHeight: Number(window.screen?.availHeight || viewHeight),
            colorDepth: settings.screen ? Number(window.screen?.colorDepth || 24) : 24,
            pixelDepth: Number(window.screen?.pixelDepth || 24)
        },
        features: {}
    };

    if (settings.canvas) {
        profile.features.canvas = {
            enabled: true,
            seed: Date.now() % 10000,
            shiftR: pickFingerprintPreviewValue([-2, -1, 1, 2], 1),
            shiftG: pickFingerprintPreviewValue([-2, -1, 1, 2], -1),
            shiftB: pickFingerprintPreviewValue([-2, -1, 1, 2], 2),
            alphaJitter: pickFingerprintPreviewValue([0, 1], 0)
        };
    }

    if (settings.audio) {
        profile.features.audio = {
            enabled: true,
            seed: Date.now() % 10000,
            gainOffset: pickFingerprintPreviewValue([2e-5, -3e-5, 4e-5, -5e-5], 2e-5),
            frequencyOffset: pickFingerprintPreviewValue([0.015, -0.02, 0.018, -0.012], 0.015)
        };
    }

    if (settings.fonts) {
        profile.features.fonts = {
            enabled: true,
            families: pickFingerprintPreviewValue(isMobileUa ? [["Roboto", "Helvetica"], ["San Francisco", "Arial"]] : [["Segoe UI", "Arial"], ["Ubuntu", "sans-serif"]], [])
        };
    }

    if (settings.timezone) {
        profile.localization = {
            zone: String(geoContext.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC").trim(),
            locale: geoContext.locale || "en-US"
        };
    }

    return profile;
}

async function generateAndStoreFingerprintPreviewProfile(forceRegen = false) {
    const remainingMs = getFingerprintFreeRemainingMs();
    const hasQuota = state.plan !== "free" || remainingMs > 0 || !isFingerprintFreeUsageToday(state.fingerprint.freeUsage);
    if (!hasQuota) return null;

    const settings = normalizeFingerprintSettings(state.fingerprint.settings);
    const profileMode = normalizeFingerprintProfileMode(state.fingerprint.profileMode);
    const referenceData = await loadDashboardFingerprintReferenceData();
    const geoContext = await fetchFingerprintPreviewGeoContext();

    let userAgent = "";
    if (settings.userAgent) {
        userAgent = generateFingerprintPreviewUserAgent(navigator.userAgent || "");
        if (userAgent) {
            userAgent = await setFingerprintPreviewActiveUserAgent(userAgent, geoContext);
        }
    }

    const generatedProfile = buildFingerprintPreviewProfile(settings, referenceData, userAgent, geoContext);
    
    const storageUpdate = {
        [FINGERPRINT_LAST_PROFILE_KEY]: generatedProfile,
        [FINGERPRINT_ACTIVE_USER_AGENT_KEY]: userAgent
    };

    if (profileMode === "static") {
        storageUpdate[FINGERPRINT_STATIC_PROFILE_KEY] = generatedProfile;
    }

    await chrome.storage.local.set(storageUpdate);

    state.fingerprint.activeUa = userAgent;
    state.fingerprint.lastProfile = generatedProfile;

    renderFingerprintUserAgentPreview();
    renderFingerprintConfigPreview();

    return generatedProfile;
}

// --- Integrasi Port Pesan Sinkronisasi Chrome ---
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onConnect) {
    const extensionHubPort = chrome.runtime.connect({ name: "pixellitex_dashboard_sync" });
    
    window.addEventListener("message", async (event) => {
        if (event.data && event.data.type === "SYNC_DASHBOARD_STATE") {
            await refreshFingerprintUserAgentPreview();
        }
    });
}
