/* Run from the project root: node docs/desgin/render-previews.cjs */
const { chromium } = require('playwright');
const { existsSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(existsSync(chromium.executablePath()) ? {} : { channel: 'chrome' }) });
  const output = join(__dirname, 'previews');
  mkdirSync(output, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1180 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const entry = pathToFileURL(join(__dirname, 'index.html')).href;
  await page.goto(entry);
  await page.locator('#app > .screen').waitFor();
  await page.screenshot({ path: join(output, '00-design-workbench.png'), fullPage: true });
  const screens = [
    ['01-shelf', 'shelf', 'default'], ['02-search', 'discover', 'default'],
    ['03-book-detail', 'detail', 'default'], ['04-reader', 'reader', 'default'],
    ['05-sources', 'sources', 'default'], ['06-import', 'import', 'default'],
    ['07-source-editor', 'edit', 'default'], ['08-profile', 'profile', 'default'],
    ['09-reader-settings', 'reader', 'settings'], ['10-reader-chapters', 'reader', 'chapters'],
    ['11-import-preview', 'import', 'preview'], ['12-shelf-empty', 'shelf', 'empty'],
    ['13-delete-confirmation', 'sources', 'delete'], ['14-shelf-list', 'shelf', 'list'],
  ];
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [name, screen, state] of screens) {
    await page.goto(`${entry}?embed=1&screen=${screen}&state=${state}`);
    await page.locator('#app > .screen, #app > .reader').first().waitFor();
    await page.screenshot({ path: join(output, `${name}.png`) });
  }
  await page.setViewportSize({ width: 1720, height: 2000 });
  await page.goto(pathToFileURL(join(__dirname, 'overview.html')).href);
  await Promise.all(page.frames().map(frame => frame.waitForLoadState('load')));
  if (errors.length) throw new Error(errors.join('\n'));
  await page.screenshot({ path: join(output, '00-page-overview.png'), fullPage: true });
  await browser.close();
  console.log(`Exported ${screens.length + 2} design previews to docs/desgin/previews/`);
})().catch(error => { console.error(error); process.exitCode = 1; });
