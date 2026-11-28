// Renders the PNG icons from public/favicon.svg with Playwright's Chromium:
//   bun run icons
// - icon-192.png, icon-512.png: the logo with its rounded, transparent
//   corners, for the web app manifest (src/pages/[lang]/manifest.webmanifest.js)
// - icon-maskable-512.png: square and opaque, for platforms that crop icons to
//   their own shape; the bolt stays inside the safe zone
// - icon-1024.png: the logo for app listings (e.g. the GitHub App for sign-in)
// - apple-touch-icon.png: square and opaque; iOS rounds the corners itself and
//   would fill transparent ones with black
// - og-image.png: 1200×630, the logo and the name on the brand's background,
//   for link previews (Layout.astro's og:image)

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

  // The link preview: the logo and the name, centred on the light background.
  const preview = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await preview.setContent(`
    <body style="margin:0;width:1200px;height:630px;display:flex;align-items:center;
      justify-content:center;gap:48px;background:#f1f5f9;color:#0f172a;
      font:700 120px/1 system-ui,-apple-system,'Segoe UI',sans-serif;letter-spacing:-0.03em">
      ${render(220, true)}<span>EV Maps</span>
    </body>`);
  await preview.screenshot({ path: new URL("og-image.png", PUBLIC).pathname });
  await preview.close();
  console.log("public/og-image.png: 1200×630");
} finally {
  await browser.close();
}
