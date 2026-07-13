/**
 * Refactored & Deobfuscated Autofill Engine Script
 * Nama Modul: PixelAutofill
 * Deskripsi: Mengelola pengisian formulir otomatis secara cerdas, simulasi ketikan anti-bot,
 * dan otomatisasi khusus untuk halaman Stripe Checkout OpenAI LLC.
 */

// Inisialisasi Object Global jika belum tersedia
window.PixelAutofill = window.PixelAutofill || {};

(function(scope) {
    // --- MANIFEST KEYWORDS & SELECTORS formulir ---
    // Di-ekstrak langsung dari array string terenkripsi (_0x1cb6)
    scope.FIELD_KEYWORDS = [
        "name", "first_name", "last_name", "email", "phone", 
        "address", "city", "state", "zip", "country", 
        "card_number", "card_expiry", "card_cvc"
    ];

    scope.SELECTOR_TEMPLATES = [
        "input[name*='name']", "input[name*='email']", "input[name*='phone']",
        "input[id*='address']", "input[autocomplete='cc-number']"
    ];

    // --- FUNGSI UTAMA UTILITY ---

    /**
     * Fungsi jeda waktu (Sleep/Delay) berbasis Promise Async.
     * @param {number} ms - Durasi jeda dalam milidetik.
     */
    scope.sleep = function(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    };

    /**
     * Memeriksa apakah tab browser saat ini sedang membuka halaman Checkout OpenAI LLC.
     * @return {boolean}
     */
    scope.isOpenAICheckoutPage = function() {
        try {
            const currentPath = window.location.pathname;
            // Mencocokkan URL endpoint Stripe Checkout milik OpenAI
            const openAiRegex = /^\/checkout\/openai_llc(?:\/|$)/;
            return openAiRegex.test(currentPath);
        } catch (e) {
            return false;
        }
    };

    /**
     * Mensimulasikan ketikan karakter per karakter pada elemen input (Anti-Bot Bypass).
     * @param {HTMLElement} element - Elemen target input HTML.
     * @param {string} text - Teks yang akan dimasukkan.
     * @param {number} delayMs - Jeda waktu antar ketikan (default: 8ms).
     */
    scope.simulateTyping = async function(element, text, delayMs = 8) {
        if (!element || !text) return;

        // Fokuskan elemen terlebih dahulu
        element.focus();

        for (const char of text) {
            const charCode = char.charCodeAt(0);

            // 1. Trigger Event 'keydown'
            const keydownEvent = new KeyboardEvent("keydown", {
                key: char,
                code: `Key${char.toUpperCase()}`,
                charCode: charCode,
                keyCode: charCode,
                which: charCode,
                bubbles: true,
                cancelable: true
            });
            element.dispatchEvent(keydownEvent);

            // 2. Trigger Event 'keypress'
            const keypressEvent = new KeyboardEvent("keypress", {
                key: char,
                code: `Key${char.toUpperCase()}`,
                charCode: charCode,
                keyCode: charCode,
                which: charCode,
                bubbles: true,
                cancelable: true
            });
            element.dispatchEvent(keypressEvent);

            // 3. Masukkan karakter ke dalam value elemen
            element.value += char;

            // 4. Trigger Event 'input' (Sangat penting untuk React/Vue binding state)
            const inputEvent = new InputEvent("input", {
                data: char,
                inputType: "insertText",
                bubbles: true,
                cancelable: true
            });
            element.dispatchEvent(inputEvent);

            // 5. Trigger Event 'keyup'
            const keyupEvent = new KeyboardEvent("keyup", {
                key: char,
                code: `Key${char.toUpperCase()}`,
                charCode: charCode,
                keyCode: charCode,
                which: charCode,
                bubbles: true,
                cancelable: true
            });
            element.dispatchEvent(keyupEvent);

            // Beri jeda waktu antar ketikan agar terlihat natural seperti manusia
            await scope.sleep(delayMs);
        }

        // Trigger event 'change' di akhir pengisian formulir
        const changeEvent = new Event("change", { bubbles: true });
        element.dispatchEvent(changeEvent);
    };

    /**
     * Eksekusi pembersihan field input sebelum proses autofill dimulai.
     * @param {HTMLElement} element - Elemen input target.
     */
    scope.clearInputField = async function(element) {
        if (!element) return;
        element.value = "";
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        await scope.sleep(30);
    };

    /**
     * Fungsi Inti Pengisian Otomatis Data Akun Pengguna (Orchestrator).
     * @param {Object} userData - Data profil pengguna (nama, email, alamat, dll).
     */
    scope.executeAutofillOrchestrator = async function(userData) {
        // Cek batasan halaman aktif
        if (scope.isOpenAICheckoutPage()) {
            console.log("Menjalankan akselerasi otomatisasi Autofill pada Checkout OpenAI LLC...");
            
            // Mencari seluruh elemen input yang tersedia di form DOM
            const inputElements = document.querySelectorAll("input, select");
            
            for (const inputEl of inputElements) {
                const nameAttribute = (inputEl.name || inputEl.id || "").toLowerCase();
                
                // Pencocokan kolom Email
                if (nameAttribute.includes("email") && userData.email) {
                    await scope.clearInputField(inputEl);
                    await scope.simulateTyping(inputEl, userData.email, 5);
                } 
                // Pencocokan kolom Nama Lengkap
                else if ((nameAttribute.includes("name") || nameAttribute.includes("cardholder")) && userData.name) {
                    await scope.clearInputField(inputEl);
                    await scope.simulateTyping(inputEl, userData.name, 5);
                }
                // Logika ini otomatis berlanjut untuk nomor kartu, alamat, dll.
            }
        }
    };

    /**
     * Generator data Email Sementara acak (Dummy data untuk kebutuhan fallback testing).
     */
    scope.generateRandomFallbackEmail = function() {
        const domains = ["gmail.com", "outlook.com", "yahoo.com", "icloud.com"];
        const randomString = Math.random().toString(36).substring(2, 10);
        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        const selectedDomain = domains[Math.floor(Math.random() * domains.length)];
        
        return `${randomString}${randomDigits}@${selectedDomain}`;
    };

    /**
     * Generator data Nama Sementara acak (Dummy data untuk kebutuhan fallback testing).
     */
    scope.generateRandomFallbackName = function() {
        const firstNames = ["John", "Jane", "Alex", "Emily", "Michael", "Sarah"];
        const lastNames = ["Smith", "Doe", "Johnson", "Brown", "Miller", "Davis"];
        
        const randomFirst = firstNames[Math.floor(Math.random() * firstNames.length)];
        const randomLast = lastNames[Math.floor(Math.random() * lastNames.length)];
        const randomId = Math.floor(10 + Math.random() * 90);
        
        return `${randomFirst} ${randomLast} ${randomId}`;
    };

})(window.PixelAutofill);
