/**
 * Generate Circadia24 product lockups + PWA icons (mark + simple app name).
 * Usage: node scripts/generate-circadia-brand-assets.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const source = path.join(__dirname, "circadia24-logo-source.png");
const commandRoot = path.resolve(root, "..", "circadia-command");

const BG = "#0A1118";
const TEXT = "#E2E8F0";

const PRODUCTS = [
  { id: "helper", label: "Helper", outDir: "app-next" },
  { id: "ewd", label: "EWD", outDir: "app-next" },
  { id: "enterprise", label: "Enterprise", outDir: "app-next" },
  { id: "command", label: "Command", outDir: "command" },
];

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function squareMark(size) {
  return sharp(source)
    .resize(size, size, { fit: "contain", background: BG })
    .png()
    .toBuffer();
}

async function fullLockup(label, markSize = 420, canvasW = 720, canvasH = 560) {
  const mark = await squareMark(markSize);
  const textSvg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${BG}"/>
  <text x="50%" y="${markSize + 88}" text-anchor="middle"
    font-family="Segoe UI, Helvetica Neue, Arial, sans-serif"
    font-size="56" font-weight="600" fill="${TEXT}">${label}</text>
</svg>`);
  return sharp(textSvg)
    .composite([{ input: mark, top: 36, left: Math.round((canvasW - markSize) / 2) }])
    .png()
    .toBuffer();
}

/** Home-screen / splash icon: mark + short name, square. */
async function pwaIcon(label, size) {
  const markSize = Math.round(size * 0.58);
  const markTop = Math.round(size * 0.1);
  const mark = await squareMark(markSize);
  const fontSize = Math.max(18, Math.round(size * 0.09));
  const textY = Math.round(markTop + markSize + fontSize * 1.35);
  const textSvg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" rx="${Math.round(size * 0.12)}" fill="${BG}"/>
  <text x="50%" y="${textY}" text-anchor="middle"
    font-family="Segoe UI, Helvetica Neue, Arial, sans-serif"
    font-size="${fontSize}" font-weight="600" fill="${TEXT}">${label}</text>
</svg>`);
  return sharp(textSvg)
    .composite([
      {
        input: mark,
        top: markTop,
        left: Math.round((size - markSize) / 2),
      },
    ])
    .png()
    .toBuffer();
}

async function write(file, buf) {
  ensureDir(path.dirname(file));
  await fs.promises.writeFile(file, buf);
  console.log("wrote", path.relative(root, file));
}

async function main() {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing source logo at ${source}`);
  }

  const brandingNext = path.join(root, "public", "branding");
  const iconsNext = path.join(root, "public", "icons");
  ensureDir(brandingNext);
  ensureDir(iconsNext);

  // Shared icon mark (no wordmark) for chrome
  await write(path.join(brandingNext, "circadia24-icon.png"), await squareMark(512));

  for (const p of PRODUCTS.filter((x) => x.outDir === "app-next")) {
    const full = await fullLockup(p.label);
    await write(path.join(brandingNext, `circadia24-${p.id}-full.png`), full);
    await write(path.join(iconsNext, `icon-${p.id}-192.png`), await pwaIcon(p.label, 192));
    await write(path.join(iconsNext, `icon-${p.id}-512.png`), await pwaIcon(p.label, 512));
    await write(path.join(iconsNext, `icon-${p.id}-512-maskable.png`), await pwaIcon(p.label, 512));
  }

  // Default full lockup = Helper (legacy surface splash)
  await write(path.join(brandingNext, "circadia24-full.png"), await fullLockup("Helper"));

  // Command app
  const brandingCmd = path.join(commandRoot, "public", "branding");
  const iconsCmd = path.join(commandRoot, "public", "icons");
  ensureDir(brandingCmd);
  ensureDir(iconsCmd);
  await write(path.join(brandingCmd, "circadia24-icon.png"), await squareMark(512));
  await write(path.join(brandingCmd, "circadia24-full.png"), await fullLockup("Command"));
  await write(path.join(brandingCmd, "circadia24-command-dark-icon.png"), await squareMark(512));
  await write(path.join(brandingCmd, "circadia24-command-dark-full.png"), await fullLockup("Command"));
  await write(path.join(brandingCmd, "circadia24-command-full.png"), await fullLockup("Command"));
  await write(path.join(iconsCmd, "command-icon-192.png"), await pwaIcon("Command", 192));
  await write(path.join(iconsCmd, "command-icon-512.png"), await pwaIcon("Command", 512));
  await write(path.join(iconsCmd, "command-icon-512-maskable.png"), await pwaIcon("Command", 512));

  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
