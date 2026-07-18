/**
 * Pixellitex Autofill Engine - Content Script Component
 * Menangani injeksi data form aman pada iframe target pembayaran.
 */

const appliedWritesTracker = new Set();
let executionDebounceTimer = null;
let customAddressIndicatorEnabled = null;

// Konfigurasi Kunci Penyimpanan Lokal (Sesuai Manifest Shared Storage)
const SUCCESS_REDIRECT_FALLBACK_KEY = "success_redirect_fallback";
const FINGERPRINT_SWITCH_ENABLED_KEY = "fingerprint_enabled";
const FINGERPRINT_SWITCH_MODE_KEY = "fingerprint_mode";
const FINGERPRINT_PROFILE_MODE_KEY = "fingerprint_profile_mode";
const FINGERPRINT_SWITCH_SETTINGS_KEY = "fingerprint_settings";
const FINGERPRINT_STATIC_PROFILE_KEY = "fingerprint_static_profile";
const FINGERPRINT_ACTIVE_USER_AGENT_KEY = "fingerprint_active_ua";
const FINGERPRINT_FREE_USAGE_KEY = "fingerprint_free_usage";
const USER_PLAN_STORAGE_KEY = "user_plan";

/**
 * Mencatat elemen input yang sedang dimodifikasi oleh sistem otomatisasi.
 * Berguna untuk memutus loop rekursif yang dipicu oleh event handler bawaan situs.
 */
function markOwnWrite(elementsArray) {
    if (!Array.isArray(elementsArray)) return;
    
    elementsArray.forEach(element => {
        if (element) appliedWritesTracker.add(element);
    });

    if (executionDebounceTimer) {
        clearTimeout(executionDebounceTimer);
    }
    
    executionDebounceTimer = setTimeout(() => {
        appliedWritesTracker.clear();
    }, 2000);
}

/**
 * Mensimulasikan pengetikan karakter secara natural ke elemen input teks.
 * Memastikan State internal SPA (seperti React/Vue) menangkap perubahan nilai.
 */
function simulateTyping(element, value) {
    if (!element) return;

    element.focus();
    element.value = value;

    // Dispatch rangkaian event native agar validasi form bawaan web terpicu
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    element.blur();
}

/**
 * Mensimulasikan pemilihan nilai pada komponen drop-down HTML (<select>)
 */
function simulateSelect(element, value) {
    if (!element) return;

    element.value = value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.blur();
}

/**
 * Memvalidasi apakah halaman saat ini dimuat di dalam konteks ekosistem Stripe
 * yang terintegrasi pada portal pembayaran OpenAI / ChatGPT
 */
function isChatGptOpenAiStripeFrame() {
    try {
        const currentUrl = String(window.location.href || "").toLowerCase();
        const isStripeHost = window.location.hostname.includes("stripe.com") || window.location.hostname.includes("stripe.network");
        const isTargetReferrer = currentUrl.includes("openai.com") || currentUrl.includes("chatgpt.com");
        
        return isStripeHost && isTargetReferReferrer;
    } catch (e) {
        return false;
    }
}

/**
 * Mendeteksi jika form merupakan bagian dari input nomor atau otentikasi kartu
 */
function isChatGptOpenAiStripePaymentFrame() {
    if (!isChatGptOpenAiStripeFrame()) return false;
    const pageText = String(document.body.innerText || "").toLowerCase();
    return pageText.includes("card number") || pageText.includes("expiry") || pageText.includes("cvc");
}

/**
 * Mendeteksi jika form merupakan bagian dari input data alamat penagihan
 */
function isChatGptOpenAiStripeAddressFrame() {
    if (!isChatGptOpenAiStripeFrame()) return false;
    const pageText = String(document.body.innerText || "").toLowerCase();
    return pageText.includes("billing address") || pageText.includes("postal code") || pageText.includes("country");
}

/**
 * Eksekusi fallback pengisian form menggunakan Clipboard Event simulasi paste 
 * apabila mekanisme manipulasi nilai input diblokir oleh target element
 */
function simulateMaskedPaste(element, value) {
    if (!element) return Promise.resolve(false);

    element.focus();
    element.value = value;
    
    const pasteEvent = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer()
    });
    
    if (pasteEvent.clipboardData) {
        pasteEvent.clipboardData.setData("text/plain", value);
    }
    
    element.dispatchEvent(pasteEvent);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.blur();
    
    return Promise.resolve(true);
}

/**
 * Koordinator pengisian field otomatis pada elemen form yang terdeteksi
 */
async function handleChatGptOpenAiStripeFrameFill(profileData, selectors) {
    if (!isChatGptOpenAiStripeFrame()) return false;

    try {
        const targetSelectors = (selectors && typeof selectors === "object") ? selectors : {};
        const cardNumber = String(profileData.cardNumber || "").trim();
        const cardExpiry = String(profileData.cardExpiry || "").trim();
        const cardCvc = String(profileData.cardCvc || "").trim();
        let actionExecuted = false;

        // Blok 1: Iframe Form Data Kartu Kredit/Debit
        if (isChatGptOpenAiStripePaymentFrame()) {
            const inputCard = document.querySelector(targetSelectors.cardNumberSelector || "input[name='cardnumber']");
            const inputExpiry = document.querySelector(targetSelectors.cardExpirySelector || "input[name='exp-date']");
            const inputCvc = document.querySelector(targetSelectors.cardCvcSelector || "input[name='cvc']");

            if (inputCard && cardNumber) {
                markOwnWrite([inputCard]);
                simulateTyping(inputCard, cardNumber);
                actionExecuted = true;
            }
            if (inputExpiry && cardExpiry) {
                markOwnWrite([inputExpiry]);
                simulateTyping(inputExpiry, cardExpiry);
                actionExecuted = true;
            }
            if (inputCvc && cardCvc) {
                markOwnWrite([inputCvc]);
                simulateTyping(inputCvc, cardCvc);
                actionExecuted = true;
            }

            // Kirim pesan sinkronisasi ke Parent Window/Top Frame
            if (actionExecuted && window.parent && window.parent !== window) {
                window.parent.postMessage({
                    type: "PIXEL_STRIPE_FILL_SUCCESS",
                    frameType: "payment",
                    status: "completed"
                }, "*");
            }
            return actionExecuted;
        }

        // Blok 2: Iframe Form Billing Address
        if (isChatGptOpenAiStripeAddressFrame()) {
            const nameValue = String(profileData.billingName || "").trim();
            const countryValue = String(profileData.billingCountry || "US").trim().toUpperCase();
            const postalValue = String(profileData.billingPostalCode || "").trim();

            const inputName = document.querySelector(targetSelectors.billingNameSelector || "input[name='name']");
            const selectCountry = document.querySelector(targetSelectors.billingCountrySelector || "select[name='country']");
            const inputPostal = document.querySelector(targetSelectors.billingPostalSelector || "input[name='postalCode']");

            if (inputName && nameValue) {
                markOwnWrite([inputName]);
                simulateTyping(inputName, nameValue);
                actionExecuted = true;
            }
            if (selectCountry && countryValue) {
                markOwnWrite([selectCountry]);
                simulateSelect(selectCountry, countryValue);
                actionExecuted = true;
            }
            
            // Memberikan jeda waktu (delay) asinkron untuk transisi DOM jika struktur form berubah sesuai kode negara
            await new Promise(resolve => setTimeout(resolve, 200));

            if (inputPostal && postalValue) {
                markOwnWrite([inputPostal]);
                simulateTyping(inputPostal, postalValue);
                actionExecuted = true;
            }

            if (actionExecuted && window.parent && window.parent !== window) {
                window.parent.postMessage({
                    type: "PIXEL_STRIPE_FILL_SUCCESS",
                    frameType: "address",
                    status: "completed"
                }, "*");
            }
            return actionExecuted;
        }

    } catch (err) {
        if (typeof chrome !== "undefined" && chrome.runtime?.id) {
            chrome.runtime.sendMessage({
                action: "LOG_BACKGROUND_ERROR",
                error: err.message || String(err),
                context: "stripe_content_script_execution"
            });
        }
    }
    return false;
}

// --- Manajemen Event & Pesan Masuk Extension API ---
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message && message.action === "TRIGGER_STRIPE_AUTOFILL") {
            handleChatGptOpenAiStripeFrameFill(message.payload, message.selectors)
                .then(status => sendResponse({ success: status }))
                .catch(e => sendResponse({ success: false, error: e.message }));
            return true; // Menginstruksikan Chrome Runtime menjaga channel asinkron tetap aktif
        }
    });
}
