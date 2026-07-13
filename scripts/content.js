/**
 * Refactored & Deobfuscated Content Script Engine
 * Nama Modul: PixelContentScript
 * Deskripsi: Mengelola penyuntikan proteksi privasi sidik jari runtime klien,
 * emulasi navigator.userAgentData, dan otomasi intersepsi Stripe Elements OpenAI.
 */

(function() {
    // --- KONSTANTA & CACHE KUNCI PENYIMPANAN ---
    const FINGERPRINT_SWITCH_ENABLED_KEY = "pixel_fingerprint_protection_enabled";
    const FINGERPRINT_SWITCH_MODE_KEY = "pixel_fingerprint_protection_mode";
    const FINGERPRINT_PROFILE_MODE_KEY = "pixel_fingerprint_profile_generation_mode";
    const FINGERPRINT_SWITCH_SETTINGS_KEY = "pixel_fingerprint_detailed_settings";
    const FINGERPRINT_STATIC_PROFILE_KEY = "pixel_fingerprint_static_profile_data";
    const FINGERPRINT_ACTIVE_USER_AGENT_KEY = "pixel_fingerprint_active_user_agent";
    const FINGERPRINT_LAST_PROFILE_KEY = "pixel_fingerprint_last_generated_profile";
    const FINGERPRINT_FREE_USAGE_KEY = "pixel_fingerprint_free_usage_counter";
    const USER_PLAN_STORAGE_KEY = "pixel_user_plan_type";
    const TEMP_MAIL_META_KEY = "pixel_temp_mail_metadata";
    const SUCCESS_REDIRECT_FALLBACK_KEY = "pixel_success_redirect_fallback_token";

    // Konfigurasi Standar Perlindungan Runtime
    const DEFAULT_FINGERPRINT_SETTINGS = {
        userAgent: true, canvas: true, audio: true, webgl: true,
        webgpu: true, voice: true, plugins: true, fonts: true,
        screen: true, timezone: true
    };

    // Peta Hubungan Kode Negara ke Locale Bahasa
    const FINGERPRINT_COUNTRY_LOCALE_MAP = {
        US: "en-US", GB: "en-GB", AU: "en-AU", CA: "en-CA", NZ: "en-NZ", IE: "en-IE",
        IN: "en-IN", SG: "en-SG", PH: "en-PH", ZA: "en-ZA", NG: "en-NG", DE: "de-DE",
        FR: "fr-FR", BE: "nl-BE", NL: "nl-NL", ES: "es-ES", MX: "es-MX", IT: "it-IT",
        BR: "pt-BR", JP: "ja-JP", KR: "ko-KR", CN: "zh-CN", ID: "id-ID", MY: "ms-MY"
    };

    // --- SEKTOR RESOLUSI PARAMETER SIDIK JARI ---

    /**
     * Mendapatkan kode locale bahasa berdasarkan kode ISO negara.
     */
    function resolveFingerprintLocaleFromCountryCode(countryCode) {
        const code = String(countryCode || "").toUpperCase().trim();
        return FINGERPRINT_COUNTRY_LOCALE_MAP[code] || "en-US";
    }

    /**
     * Menyusun daftar susunan bahasa berdasarkan acuan locale dasar.
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
     * Menyusun header HTTP 'Accept-Language' buatan lengkap dengan pembobotan nilai kualitas (q).
     */
    function buildFingerprintAcceptLanguage(locale, customLanguages) {
        const targets = Array.isArray(customLanguages) && customLanguages.length
            ? customLanguages
            : buildFingerprintLanguagesFromLocale(locale);

        return targets
            .filter(Boolean)
            .map((lang, index) => {
                if (index === 0) return lang;
                const qValue = Math.max(0.1, 1 - 0.1 * index).toFixed(1);
                return `${lang};q=${qValue}`;
            })
            .join(",");
    }

    /**
     * Normalisasi payload objek Geografis untuk sinkronisasi runtime content.
     */
    function normalizeFingerprintGeoContext(rawGeo) {
        const data = (rawGeo && typeof rawGeo === "object") ? rawGeo : {};
        const countryCode = String(data.countryCode || data.country_code || "").toUpperCase().trim();
        const locale = data.locale || resolveFingerprintLocaleFromCountryCode(countryCode);
        const languages = Array.isArray(data.languages) && data.languages.length 
            ? data.languages.map(l => String(l || "").trim()).filter(Boolean)
            : buildFingerprintLanguagesFromLocale(locale);

        return {
            ip: String(data.ip || "").trim(),
            countryCode: countryCode,
            country: String(data.country || "").trim(),
            timezone: String(data.timezone || "").trim(),
            locale: locale,
            languages: languages,
            acceptLanguage: data.acceptLanguage || buildFingerprintAcceptLanguage(locale, languages)
        };
    }

    /**
     * Membuat penanda string tanggal lokal format "YYYY-MM-DD" untuk pembatasan kuota harian.
     */
    function getLocalDayKey() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const date = String(now.getDate()).padStart(2, "0");
        return `${year}-${month}-${date}`;
    }


    // --- SEKTOR METADATA USER-AGENT & EMULASI CLIENT HINTS ---

    /**
     * Menambahkan stempel build acak natural di akhir UA string agar tidak terdeteksi sebagai tanda statis.
     */
    function generateFingerprintUserAgent(baseUa = "") {
        const targetUa = String(baseUa || navigator.userAgent || "").trim();
        if (!targetUa) return "";

        const randomBuildStamp = String(Math.floor(Math.random() * 90000) + 10000);
        if (/\s\d{4,6}$/.test(targetUa)) {
            return targetUa.replace(/\s\d{4,6}$/, " " + randomBuildStamp);
        }
        return targetUa + " " + randomBuildStamp;
    }

    /**
     * Mengekstrak data versi murni mesin peramban dengan membuang prefix Mozilla.
     */
    function deriveAppVersionFromUserAgent(ua = "") {
        const cleanUa = String(ua || "").trim();
        return cleanUa ? cleanUa.replace(/^Mozilla\//i, "") : "";
    }

    /**
     * Membentuk struktur tiruan presisi tinggi untuk objek modern `navigator.userAgentData` (Client Hints).
     */
    function buildUserAgentMetadata(ua = "", platform = "", isMobile = false) {
        const cleanUa = String(ua || "");
        const cleanPlatform = String(platform || "");
        
        const chromeMatch = cleanUa.match(/Chrome\/(\d+)(?:\.(\d+)\.(\d+)\.(\d+))?/i);
        const edgeMatch = cleanUa.match(/Edg\/(\d+)/i);
        const firefoxMatch = cleanUa.match(/Firefox\/(\d+)/i);
        
        const majorVersion = edgeMatch ? edgeMatch[1] : (chromeMatch ? chromeMatch[1] : (firefoxMatch ? firefoxMatch[1] : "120"));
        const fullVersionString = chromeMatch ? chromeMatch[0].split("/")[1] : majorVersion + ".0.0.0";

        const platformName = /win/i.test(cleanPlatform) ? "Windows" : (/mac/i.test(cleanPlatform) ? "macOS" : "Linux");

        return {
            mobile: isMobile === true,
            platform: platformName,
            brands: [
                { brand: "Not_A Brand", version: "8" },
                { brand: "Chromium", version: majorVersion },
                { brand: "Google Chrome", version: majorVersion }
            ],
            fullVersion: fullVersionString,
            platformVersion: "10.0.0"
        };
    }


    // --- MODUL SUNTIKAN CONTEXT INJECTION BRIDGING ---

    /**
     * Memeriksa apakah frame saat ini adalah area pembayaran Stripe Checkout milik OpenAI LLC / ChatGPT.
     */
    function isChatGptOpenAiStripeFrame() {
        try {
            const path = window.location.pathname;
            const host = window.location.hostname;
            return host.includes("stripe.com") && path.includes("openai_llc");
        } catch (e) {
            return false;
        }
    }

    /**
     * Menyuntikkan script proteksi ekstensi ke dalam struktur DOM halaman web target sebelum dimuat.
     */
    function injectScript(scriptFileName = "inject.js") {
        try {
            if (document.getElementById("pixel-protection-core-bridge")) return;

            const scriptElement = document.createElement("script");
            scriptElement.id = "pixel-protection-core-bridge";
            
            // Mengambil path URL runtime internal dari ekstensi browser
            scriptElement.src = chrome.runtime.getURL(scriptFileName);
            
            scriptElement.onload = function() {
                // Hapus node elemen setelah eksekusi berhasil untuk merapikan DOM halaman
                this.remove();
            };

            scriptElement.onerror = function() {
                console.warn("Gagal menginisialisasi modul pengaman sidik jari Pixel.");
            };

            // Masukkan secara paksa di simpul teratas dokumen HTML
            (document.head || document.documentElement).appendChild(scriptElement);
        } catch (error) {
            // Mekanisme fallback jika runtime extension sempat terputus/disconnected
            try {
                window.postMessage({ source: "pixel_script_injection_fallback", action: "TRIGGER_RETRY" }, "*");
            } catch (e) {}
        }
    }


    // --- ORCHESTRATOR SINKRONISASI MUTATION OBSERVER ---

    /**
     * Memeriksa kondisi elemen form halaman dan menjalankan otomatisasi intersepsi Stripe OpenAI.
     */
    function checkAndInject() {
        const isStripeFrame = isChatGptOpenAiStripeFrame();
        const hasPaymentInputs = document.querySelector("input[name='cardnumber']") || document.querySelector("#card-element");

        if (isStripeFrame || hasPaymentInputs) {
            // Jalankan penyuntikan taktik akselerasi autofill formulir pembayaran
            injectScript("inject_autofill_bridge.js");
            
            // Mengamati perubahan elemen DOM dinamis (Stripe late-loading elements)
            const domObserver = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.addedNodes.length) {
                        const targetCardNode = document.querySelector("input[autocomplete='cc-number']");
                        if (targetCardNode) {
                            console.log("Mendeteksi kontainer Kartu Kredit Stripe OpenAI. Mengisi data...");
                            domObserver.disconnect();
                        }
                    }
                }
            });

            domObserver.observe(document.body || document.documentElement, {
                childList: true,
                subtree: true
            });
        }
    }

    // --- INISIALISASI PEMICU OPERASIONAL AWAL ---
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", checkAndInject);
    } else {
        checkAndInject();
    }

})();
