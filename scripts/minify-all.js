#!/usr/bin/env node

/**
 * Refactored & Deobfuscated Code Minifier Script
 * Deskripsi: Memindai semua file JS dalam proyek secara otomatis, mengeksekusi minifikasi
 * menggunakan library Terser dengan konfigurasi aman, dan menyimpan hasilnya ke folder 'dist'.
 */

const terser = require("terser");
const fs = require("fs");
const path = require("path");
const glob = require("glob");

// Konfigurasi Terser yang aman agar tidak merusak fungsionalitas kode utama
const SAFE_CONFIG = {
    compress: {
        passes: 2,
        unused: false,
        keep_fargs: true,
        reduce_vars: false,
        dead_code: true
    },
    mangle: {
        toplevel: false,
        keep_fnames: true
    },
    output: {
        comments: false
    }
};

/**
 * Memformat ukuran data biner (byte) menjadi format string yang mudah dibaca manusia (B, KB, MB).
 * @param {number} bytes - Ukuran file dalam bentuk byte.
 * @returns {string} String representasi ukuran file terformat.
 */
function formatBytes(bytes) {
    if (bytes === 0) {
        return "0 B";
    }
    const KILO = 1024;
    const SIZES = ["B", "KB", "MB"];
    const index = Math.floor(Math.log(bytes) / Math.log(KILO));
    
    return Math.round(bytes / Math.pow(KILO, index) * 100) / 100 + " " + SIZES[index];
}

/**
 * Mengompresi berkas JavaScript tunggal menggunakan library Terser Core.
 * @param {string} filePath - Path lokasi berkas JS asli.
 * @param {string} outputPath - Path tujuan penyimpanan berkas hasil minifikasi.
 * @returns {Promise<Object>} Status keberhasilan operasi beserta detail ukuran memori file.
 */
async function minifyFile(filePath, outputPath) {
    try {
        const fileContent = fs.readFileSync(filePath, "utf8");
        const originalSize = Buffer.byteLength(fileContent);
        
        // Menjalankan proses minifikasi Terser
        const minifiedResult = await terser.minify(fileContent, SAFE_CONFIG);
        if (minifiedResult.error) {
            throw minifiedResult.error;
        }

        const dirPath = path.dirname(outputPath);
        // Memastikan sub-folder tujuan sudah dibuat terlebih dahulu
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        // Menulis kode hasil kompresi ke file target di folder dist
        fs.writeFileSync(outputPath, minifiedResult.code, "utf8");

        const minifiedSize = Buffer.byteLength(minifiedResult.code);
        const reductionPercentage = (100 * (1 - minifiedSize / originalSize)).toFixed(2);

        console.log(`✓ ${path.basename(filePath)} → ${formatBytes(minifiedSize)} (${reductionPercentage}% ↓)`);

        return {
            success: true,
            originalSize: originalSize,
            minifiedSize: minifiedSize,
            reduction: reductionPercentage
        };
    } catch (error) {
        console.log(`✗ ${path.basename(filePath)} → ERROR: ${error.message}`);
        return { success: false };
    }
}

/**
 * Fungsi Utama (Orchestrator) untuk memanajemen siklus pemindaian dan pelaporan minifikasi file.
 */
async function main() {
    console.log("\n========================================");
    console.log("  Minifier for Obfuscated Code");
    console.log("========================================\n");

    // Membuat folder kontainer 'dist' di root direktori jika belum ada
    if (!fs.existsSync("dist")) {
        fs.mkdirSync("dist", { recursive: true });
        console.log("Created dist folder\n");
    }

    const pattern = "**/*.js";
    // Memindai berkas menggunakan aturan ignore yang ketat agar file internal proyek tidak ikut rusak
    const files = glob.sync(pattern, {
        ignore: [
            "node_modules/**",
            "dist/**",
            ".git/**",
            "package*.json"
        ]
    });

    if (files.length === 0) {
        console.log("No JavaScript files found!");
        return;
    }

    console.log(`Found ${files.length} JavaScript file(s)\n`);

    let totalOriginalSize = 0;
    let totalMinifiedSize = 0;
    let successCount = 0;

    // Memproses kompresi setiap berkas JavaScript yang ditemukan satu per satu
    for (const filePath of files) {
        const outputPath = path.join("dist", path.basename(filePath));
        const result = await minifyFile(filePath, outputPath);
        
        if (result.success) {
            totalOriginalSize += result.originalSize;
            totalMinifiedSize += result.minifiedSize;
            successCount++;
        }
    }

    // Menampilkan rangkuman statistik akhir agregat
    if (successCount > 0) {
        const totalReduction = (100 * (1 - totalMinifiedSize / totalOriginalSize)).toFixed(2);
        
        console.log("\n========================================");
        console.log(`Files minified: ${successCount}/${files.length}`);
        console.log(`Original total: ${formatBytes(totalOriginalSize)}`);
        console.log(`Minified total: ${formatBytes(totalMinifiedSize)}`);
        console.log(`Total reduction: ${totalReduction}%`);
        console.log("Output folder: dist\\");
        console.log("========================================\n");
    }
}

// Menjalankan fungsi utama program CLI dengan penanganan error bawaan
main().catch(console.error);
