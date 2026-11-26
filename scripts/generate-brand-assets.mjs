import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { BRAND_BACKGROUND, logoSvg } from '../src/branding/logo.ts';

// Render the same vector used by BrandLogo; no separate hand-edited PNG artwork.
const output = new URL('../assets/images/', import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL('logo.svg', output), logoSvg());
const browser = await chromium.launch({ headless: true, ...(process.env.NOVAL_CHROME_CHANNEL ? { channel: process.env.NOVAL_CHROME_CHANNEL } : {}) });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const assets = [
    ['icon.png', 1024, logoSvg(), false],
    ['icon-dark.png', 1024, logoSvg().replace(BRAND_BACKGROUND, '#141B19'), false],
    ['favicon.png', 64, logoSvg(), false],
    ['splash-icon.png', 1024, logoSvg().replace('<rect width=', '<rect rx="28" width='), true],
    ['android-icon-foreground.png', 1024, logoSvg({ background: false, adaptive: true }), true],
    ['android-icon-monochrome.png', 1024, logoSvg({ background: false, monochrome: true, adaptive: true }), true],
    ['android-icon-background.png', 1024, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="${BRAND_BACKGROUND}"/></svg>`, false],
  ];
  for (const [filename, size, svg, transparent] of assets) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><style>html,body{margin:0;width:100%;height:100%;background:transparent}svg{width:100%;height:100%;display:block}</style><body>${svg}</body></html>`);
    await page.screenshot({ path: fileURLToPath(new URL(filename, output)), omitBackground: transparent });
    console.log(`Generated ${filename} (${size} × ${size})`);
  }
} finally {
  await browser.close();
}
