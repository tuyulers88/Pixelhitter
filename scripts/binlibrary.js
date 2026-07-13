/**
 * Refactored & Deobfuscated Bin Library Engine
 * Nama Modul: PixelBinLibrary
 * Deskripsi: Mengendalikan penyimpanan, penyusunan, komunikasi pos-mesej selamat, 
 * dan paparan UI bagi komponen "Data Bins".
 */

// Inisialisasi Objek Global jika belum wujud
window.PixelBinLibrary = window.PixelBinLibrary || {};

(function(scope) {
    // --- STATE RUNTIME INTERNAL ---
    let cachedBinsList = [];
    let activeUserReference = null;

    // --- UTILITY & JAMBATAN KOMUNIKASI SECURE ---

    /**
     * Menghantar mesej selamat ke konteks luaran/iframe menggunakan postMessage.
     * Menggunakan corak Request-Response dengan ID unik dan had masa (timeout).
     * @param {Object} messagePayload - Data mesej yang ingin dihantar.
     * @return {Promise<Object>} Respon daripada penerima mesej.
     */
    scope.sendSecureMessage = function(messagePayload) {
        return new Promise((resolve, reject) => {
            // Jana ID unik berasaskan rantaian aksara rawak base-36
            const messageId = Math.random().toString(36).substring(2, 10);

            // Fungsi pengendali apabila menerima mesej tindak balas
            const onMessageReceived = (event) => {
                if (event.data && event.data.responseId === messageId) {
                    // Buang listener selepas mesej berjaya dipadankan (clean up)
                    window.removeEventListener("message", onMessageReceived);
                    
                    if (event.data.error) {
                        reject(new Error(event.data.error));
                    } else {
                        resolve(event.data.payload);
                    }
                }
            };

            // Dengarkan event mesej masuk
            window.addEventListener("message", onMessageReceived);

            // Sediakan data struktur akhir bersama ID unik
            const finalPayload = {
                source: "pixel_bin_library_bridge",
                requestId: messageId,
                action: messagePayload.type,
                endpoint: messagePayload.endpoint,
                payload: messagePayload.payload || {}
            };

            // Hantar mesej ke tetingkap hos utama
            window.postMessage(finalPayload, "*");

            // Sediakan mekanisme Timeout sekiranya hos lambat merespon (30 saat)
            setTimeout(() => {
                window.removeEventListener("message", onMessageReceived);
                reject(new Error("Had masa komunikasi Secure Message Bridge (30s) telah tamat."));
            }, 30000);
        });
    };

    /**
     * Mengambil ID Pengguna daripada storan lokal untuk pengesahan sesi.
     * @return {string|null}
     */
    scope.getCurrentUserId = function() {
        try {
            const extensionMeta = window.pixelExtensionMetadata || {};
            return localStorage.getItem(extensionMeta.userIdKey || "pixel_user_id_fallback") || null;
        } catch (e) {
            return null;
        }
    };

    /**
     * Memformat objek tarikh menjadi format String masa boleh baca (Readable Timestamp).
     * @param {string|number} rawDate - Nilai tarikh mentah.
     * @return {string} Format masa "HH:MM am/pm".
     */
    scope.formatReadableTimestamp = function(rawDate) {
        const dateObj = new Date(rawDate);
        if (isNaN(dateObj.getTime())) return "00:00 am";

        const hours = dateObj.getHours();
        const minutes = String(dateObj.getMinutes()).padStart(2, "0");
        const ampm = hours >= 12 ? "pm" : "am";
        const formattedHours = hours % 12 || 12;

        return `${formattedHours}:${minutes}${ampm}`;
    };


    // --- PENGURUSAN DATA & LOGIK BISNES ---

    /**
     * Memproses pengambilan data Bin terbaharu daripada pelayan API melalui Secure Message Bridge.
     * @return {Promise<boolean>} Status kejayaan operasi.
     */
    scope.fetchBins = async function() {
        try {
            const userId = scope.getCurrentUserId();
            
            // Hantar request fetch data bins melalui pos mesej jambatan
            const response = await scope.sendSecureMessage({
                type: "BINS_FETCH_REQUEST",
                endpoint: "v1/bins/list",
                payload: { user_id: userId, _method: "GET" }
            });

            if (response && response.success && Array.isArray(response.data)) {
                cachedBinsList = response.data;
                return true;
            }
            return false;
        } catch (error) {
            console.error("Gagal memuat turun senarai bins:", error);
            return false;
        }
    };

    /**
     * Menyusun senarai dokumen bin berdasarkan susunan kronologi masa (Terbaharu di atas).
     * @return {Array<Object>} Senarai bin yang telah disusun.
     */
    scope.getSortedBins = function() {
        const binsCopy = [...cachedBinsList];
        return binsCopy.sort((binA, binB) => {
            const timeA = binA.updatedAt ? new Date(binA.updatedAt).getTime() : 0;
            const timeB = binB.updatedAt ? new Date(binB.updatedAt).getTime() : 0;
            return timeB - timeA; // Isih menurun (descending)
        });
    };


    // --- MANIPULASI DOM UI & RENDERING ---

    /**
     * Menjana struktur HTML template teks untuk satu elemen item Kad Bin.
     * @param {Object} binData - Objek maklumat bin tunggal.
     * @return {string} Rantaian kod HTML template.
     */
    scope.createBinHtmlTemplate = function(binData) {
        const title = binData.title || "Untitled Bin";
        const id = binData.id || "";
        const size = binData.sizeBytes || 0;
        const votesCount = binData.votes || 0;
        const timeString = scope.formatReadableTimestamp(binData.updatedAt);

        return `
            <div class="pixel-bin-card" data-bin-id="${id}">
                <div class="bin-card-header">
                    <span class="bin-card-title">${title}</span>
                    <span class="bin-card-time">${timeString}</span>
                </div>
                <div class="bin-card-body">
                    <span class="bin-metric-label">Saiz Data:</span> ${size} Bytes
                </div>
                <div class="bin-card-actions">
                    <button class="btn-bin-action-vote" data-action="vote" data-id="${id}">
                        Vote (<span class="vote-counter">${votesCount}</span>)
                    </button>
                    <button class="btn-bin-action-apply" data-action="apply" data-id="${id}">Gunakan</button>
                </div>
            </div>
        `;
    };

    /**
     * Memaparkan komponen kad biner ke dalam elemen wrapper UI dasbor secara dinamik.
     * @param {string} containerSelector - Selector CSS kontainer sasaran.
     */
    scope.renderBinsToUi = function(containerSelector = "#layout-view-container-bins") {
        const container = document.querySelector(containerSelector);
        if (!container) return;

        // Kosongkan kontainer jika tiada data dalam memori
        const sortedBins = scope.getSortedBins();
        if (sortedBins.length === 0) {
            container.innerHTML = '<div class="empty-state-alert">Tiada data "Bins" ditemui di dalam pustaka peranti anda.</div>';
            return;
        }

        // Petakan objek senarai bin ke bentuk susunan rantaian HTML template
        container.innerHTML = sortedBins.map(bin => scope.createBinHtmlTemplate(bin)).join("");

        // Pasang Event Listener klik pada butang aksi di dalam kad secara pukal
        container.querySelectorAll(".pixel-bin-card button").forEach(button => {
            button.addEventListener("click", async (event) => {
                event.preventDefault();
                const actionType = button.getAttribute("data-action");
                const binId = button.getAttribute("data-id");
                
                if (actionType === "vote") {
                    await scope.executeVoteAction(binId, button);
                } else if (actionType === "apply") {
                    console.log(`Mengaplikasikan Bin ID: ${binId} ke dalam borang autofill.`);
                    // Logika integrasi ke autofill engine dilakukan di sini
                }
            });
        });
    };

    /**
     * Melaksanakan aksi pengundian (voting) interaktif bagi menaikkan nilai bin tertentu.
     * @param {string} binId - ID unik bin sasaran.
     * @param {HTMLElement} buttonElement - Elemen butang klik rujukan UI.
     */
    scope.executeVoteAction = async function(binId, buttonElement) {
        try {
            const userId = scope.getCurrentUserId();
            const response = await scope.sendSecureMessage({
                type: "BIN_VOTE_SUBMIT",
                endpoint: "v1/bins/vote",
                payload: { id: binId, user_id: userId, _method: "POST" }
            });

            if (response && response.success) {
                // Kemas kini kaunter UI secara terus tanpa perlu refresh keseluruhan halaman
                const counterSpan = buttonElement.querySelector(".vote-counter");
                if (counterSpan && typeof response.newVoteCount !== "undefined") {
                    counterSpan.textContent = response.newVoteCount;
                }
                
                // Kemas kini juga nilai tersebut pada senarai memori lokal cache
                const targetBin = cachedBinsList.find(b => b.id === binId);
                if (targetBin) targetBin.votes = response.newVoteCount;
            }
        } catch (error) {
            console.error("Gagal menghantar undian untuk bin:", error);
        }
    };

    /**
     * Memadamkan atau membersihkan data antaramuka pada elemen wrapper bin.
     */
    scope.clearBinContainerUi = function(containerSelector = "#layout-view-container-bins") {
        const container = document.querySelector(containerSelector);
        if (container) {
            container.innerHTML = "";
        }
    };

    // Dedahkan fungsi luaran ke ruang lingkup namespace modul
    scope.bins = cachedBinsList;

})(window.PixelBinLibrary);
