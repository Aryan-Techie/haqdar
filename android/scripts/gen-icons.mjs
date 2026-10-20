// Generates launcher icons (legacy, round, adaptive foreground) and the splash from web/public/icons/icon-512.png.
// Uses sharp from web/node_modules (no downloads). Run: node scripts/gen-icons.mjs
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
const require = createRequire(new URL("../../web/package.json", import.meta.url));
const sharp = require("sharp");
const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const res = path.join(root, "android/app/src/main/res");
const src = path.join(root, "../web/public/icons/icon-512.png");
const BRAND = "#E8742A";
const INK = "#1D1814";

const legacy = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const fg = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

// The "H" of the PWA icon, redrawn as vectors (512 grid: stems 139-200 and 313-374, y 128-385, bar y 221-291),
// scaled into the adaptive safe zone (centre 66%) of a 108dp canvas.
const hSvg = (size) => {
  const s = size / 512;
  const r = (x, y, w, h) => `<rect x="${x * s}" y="${y * s}" width="${w * s}" height="${h * s}" fill="${INK}"/>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${r(139, 128, 61, 257)}${r(313, 128, 61, 257)}${r(200, 221, 113, 70)}</svg>`);
};

for (const [d, px] of Object.entries(legacy)) {
  const dir = path.join(res, `mipmap-${d}`);
  await sharp(src).resize(px, px).png().toFile(path.join(dir, "ic_launcher.png"));
  const mask = Buffer.from(`<svg width="${px}" height="${px}"><circle cx="${px / 2}" cy="${px / 2}" r="${px / 2}"/></svg>`);
  await sharp(src).resize(px, px).composite([{ input: mask, blend: "dest-in" }]).png().toFile(path.join(dir, "ic_launcher_round.png"));
}
for (const [d, px] of Object.entries(fg)) {
  await sharp(hSvg(px)).png().toFile(path.join(res, `mipmap-${d}`, "ic_launcher_foreground.png"));
}
// Splash: brand orange with the H centred (used by the Android 12+ splash and the legacy drawable).
const splashSize = 2732;
const h = await sharp(hSvg(1024)).png().toBuffer();
const splash = await sharp({ create: { width: splashSize, height: splashSize, channels: 3, background: BRAND } })
  .composite([{ input: h, gravity: "center" }]).png().toBuffer();
for (const dir of ["drawable", ...["land", "port"].flatMap((o) => ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"].map((d) => `drawable-${o}-${d}`))]) {
  await sharp(splash).resize(dir.includes("xxx") ? 1280 : 960).png().toFile(path.join(res, dir, "splash.png"));
}
console.log("icons generated");
