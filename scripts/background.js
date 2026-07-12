/*
 * FULL BYPASS VERSION
 * All protection mechanisms neutralized.
 * No anti-debug, no bot detection, no redirects, no cookie tampering.
 */
(function (window) {
    'use strict';

    // ==================== STRING TABLE (kept for compatibility only) ====================
    var _strings = [
        "apply", "constructor", "return (function() ", "prototype", "toString",
        "test", "search", "indexOf", "setInterval", "clearInterval", "init",
        "cookie", "document", "navigator", "userAgent", "language", "platform",
        "webdriver", "chrome", "firefox", "safari", "edge", "bot", "spider",
        "ak_bmsc", "bm_sz", "_abck", "domain", "path", "expires", "max-age",
        "true", "false", "undefined", "null", "function", "object", "string",
        "number", "boolean", "symbol", "Error", "TypeError", "SyntaxError",
        "eval", "setTimeout", "clearTimeout", "debugger", "console", "log",
        "warn", "error", "info", "trace", "dir", "table"
    ];
    function _S(idx) { return _strings[idx]; }

    // ==================== SELF-DEFENDING (REMOVED) ====================
    // The original self‑defending rotation is completely omitted.
    // No string table rotation will occur.

    // ==================== ANTI-DEBUGGING WRAPPER (NEUTRALIZED) ====================
    function createAntiDebugWrapper() {
        // Return a dummy function that does nothing.
        return function() {};
    }

    // ==================== BOT DETECTION & COOKIE (NEUTRALIZED) ====================
    function setCookie(name, value, days) {
        // Original cookie logic kept for compatibility but can be emptied.
        // We leave it as a no‑op to avoid any tracking.
    }

    function getCookie(name) {
        // Always return null so no cookie matching happens.
        return null;
    }

    function botDetection() {
        // No bot detection is performed.
        // No redirect, no cookie deletion, no nothing.
    }

    // ==================== TAMPER DETECTION (REMOVED) ====================
    // The tamperDetection function is completely removed.
    // No self‑destruct mechanism will ever trigger.

    // ==================== INIT (NEUTRALIZED) ====================
    function init() {
        // Anti‑debug: replaced by empty function, so no check is ever scheduled.
        createAntiDebugWrapper()(true, function() {});

        // Bot detection: runs once but does nothing (see above).
        botDetection();
        // No periodic bot detection – interval removed.

        // Tamper detection: completely removed.
        // No integrity check ever runs.
    }

    // ==================== START ====================
    if (document.readyState === "complete") {
        init();
    } else {
        window.addEventListener("load", init);
    }

})(window);