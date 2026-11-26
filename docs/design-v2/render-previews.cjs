/* Run from the project root: node docs/design-v2/render-previews.cjs */
const { chromium } = require('playwright');
const { existsSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(existsSync(chromium.executablePath()) ? {} : { channel: 'chrome' }) });
  const output = join(__dirname, 'previews');
  mkdirSync(output, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const entry = pathToFileURL(join(__dirname, 'index.html')).href;
  await page.goto(entry);
  await page.locator('#app .screen').waitFor();
  await page.screenshot({ path: join(output, '00-design-workbench.png'), fullPage: true });
  const boards = [
    ['01-shelf-all', 'shelf', 'default'], ['02-shelf-manga', 'shelf', 'manga'],
    ['03-novels-empty', 'novels', 'default'], ['04-novels-recommendations', 'novels', 'populated'],
    ['05-comics-empty', 'comics', 'default'], ['06-comics-recommendations', 'comics', 'populated'],
    ['07-search-history', 'search', 'idle'], ['08-search-results', 'search', 'results'],
    ['09-profile', 'profile', 'default'], ['10-sources', 'sources', 'default'],
    ['11-comic-detail', 'comic-detail', 'default'], ['12-comic-reader', 'comic-reader', 'default'],
  ];
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [name, screen, state] of boards) {
    await page.goto(`${entry}?embed=1&screen=${screen}&state=${state}`);
    await page.locator('#app > *').first().waitFor();
    await page.screenshot({ path: join(output, `${name}.png`) });
  }
  await page.setViewportSize({ width: 1600, height: 1800 });
  await page.goto(pathToFileURL(join(__dirname, 'overview.html')).href);
  await page.locator('.overview-frame img').last().waitFor();
  await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
  await page.screenshot({ path: join(output, '00-page-overview.png'), fullPage: true });
  await page.goto(entry);
  await page.locator('[data-go="novels"]').first().click();
  await page.locator('[data-search-entry="novels"]').click();
  if (await page.locator('#search-query').inputValue() !== '') throw new Error('New search did not clear the query.');
  if (!(await page.locator('[data-scope="novels"]').getAttribute('class')).includes('active')) throw new Error('Novel search scope was not selected.');
  await page.locator('#search-query').fill('万相之王');
  await page.waitForTimeout(400);
  await page.locator('[data-detail="novel"]').first().click();
  await page.locator('[data-back-detail]').click();
  if (await page.locator('#search-query').inputValue() !== '万相之王') throw new Error('Search query was lost after returning from detail.');
  await page.locator('[data-back]').click();
  if ((await page.locator('#app .page-head h1').textContent()) !== '小说') throw new Error('Search did not return to its origin.');
  await page.locator('[data-go="shelf"]').first().click();
  await page.locator('[data-view="carousel"]').click();
  if (!(await page.locator('[data-view="carousel"]').getAttribute('class')).includes('active')) throw new Error('Shelf carousel did not activate.');
  await page.locator('[data-view="list"]').click();
  if (!(await page.locator('[data-view="list"]').getAttribute('class')).includes('active')) throw new Error('Shelf list did not reactivate.');
  await page.locator('[data-search-entry="all"]').first().click();
  await page.locator('[data-source-picker]').click();
  await page.locator('[data-pick-source="1"]').click();
  if (!(await page.locator('[data-source-picker]').textContent()).includes('甲骨文小说')) throw new Error('Search source picker did not update.');
  await page.goto(`${entry}?embed=1&screen=search&state=results`);
  const fixedTop = await page.locator('.search-fixed').evaluate(element => element.getBoundingClientRect().top);
  await page.locator('.search-results').evaluate(element => { element.style.paddingBottom = '900px'; element.scrollTop = 400; });
  if (await page.locator('.search-fixed').evaluate(element => element.getBoundingClientRect().top) !== fixedTop) throw new Error('Search header moved with results.');
  for (const width of [320, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(entry);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (overflow > 1) throw new Error(`Workbench overflows by ${overflow}px at ${width}px.`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await browser.close();
  console.log(`Exported ${boards.length + 2} previews to docs/design-v2/previews/`);
})().catch(error => { console.error(error); process.exitCode = 1; });
