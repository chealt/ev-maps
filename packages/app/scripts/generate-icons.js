// Renders the PNG icons from public/favicon.svg with Playwright's Chromium:
//   bun run icons
// - icon-192.png, icon-512.png: the logo with its rounded, transparent
//   corners, for the web app manifest (src/pages/[lang]/manifest.webmanifest.js)
// - icon-maskable-512.png: square and opaque, for platforms that crop icons to
//   their own shape; the bolt stays inside the safe zone
// - icon-1024.png: the logo for app listings (e.g. the GitHub App for sign-in)
// - apple-touch-icon.png: square and opaque; iOS rounds the corners itself and
//   would fill transparent ones with black

import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const PUBLIC = new URL("../public/", import.meta.url);
const ICONS = [
  { file: "icon-192.png", size: 192, rounded: true },
  { file: "icon-512.png", size: 512, rounded: true },
  { file: "icon-maskable-512.png", size: 512, rounded: false },
  { file: "icon-1024.png", size: 1024, rounded: true },
  { file: "apple-touch-icon.png", size: 180, rounded: false },
];

const svg = await readFile(new URL("favicon.svg", PUBLIC), "utf8");

const render = (size, rounded) => {
  const sized = svg.replace("<svg ", `<svg width="${size}" height="${size}" `);
  return rounded ? sized : sized.replace(/ rx="[^"]*"/, "");
};

const browser = await chromium.launch();
try {
  for (const { file, size, rounded } of ICONS) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<body style="margin:0">${render(size, rounded)}</body>`);
    await page.screenshot({
      path: new URL(file, PUBLIC).pathname,
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    });
    await page.close();
    console.log(`public/${file}: ${size}×${size}`);
  }
} finally {
  await browser.close();
}
