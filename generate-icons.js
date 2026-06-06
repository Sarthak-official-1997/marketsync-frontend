/**
 * Run this ONCE to generate all PWA icon sizes from your favicon.svg
 *
 * Install: npm install -g sharp-cli
 * Run:     node generate-icons.js
 *
 * OR use an online tool:
 * https://www.pwabuilder.com/imageGenerator
 * Upload your favicon.svg, download all sizes, put in public/icons/
 */

const sharp = require("sharp");
const fs    = require("fs");
const path  = require("path");

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const INPUT = path.join(__dirname, "public", "favicon.svg");
const OUTDIR = path.join(__dirname, "public", "icons");

if (!fs.existsSync(OUTDIR)) fs.mkdirSync(OUTDIR, { recursive: true });

async function generate() {
    for (const size of SIZES) {
        const out = path.join(OUTDIR, `icon-${size}.png`);
        await sharp(INPUT)
            .resize(size, size, { fit: "contain", background: "#0a0f1e" })
            .png()
            .toFile(out);
        console.log(`✓ icon-${size}.png`);
    }
    console.log("\nAll icons generated in public/icons/");
}

generate().catch(console.error);