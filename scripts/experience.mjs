// Run against `npm run build && npm run preview` with CHROMIUM_PATH set if needed.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const BASE = (process.env.BASE ?? 'http://127.0.0.1:4173').replace(/\/$/, '');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
let count = 0;
const check = (condition, message) => { assert.ok(condition, message); count++; console.log(`ok - ${message}`); };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const failures = [];
  const outside = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('requestfailed', (request) => failures.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('request', (request) => { if (new URL(request.url()).origin !== new URL(BASE).origin) outside.push(request.url()); });
  await page.goto(BASE);
  await page.getByTestId('hero-title').waitFor();
  await page.evaluate(() => document.fonts.ready);
  check((await page.title()).includes('Events in Bangladesh'), 'homepage has a descriptive search title');
  check(await page.locator('link[rel="canonical"]').getAttribute('href') === 'https://ahmedmasum2000000.github.io/dekhahobe/', 'canonical points to the published homepage');
  const graph = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())['@graph'];
  check(graph.some((node) => node['@type'] === 'Organization' && node.parentOrganization?.name === 'Bpop Tags'), 'structured data retains the parent brand');
  check(await page.evaluate(() => document.fonts.check('16px Anton') && document.fonts.check('16px "Inter Variable"')), 'display and interface fonts are available');
  check((await page.getByTestId('scene-link').count()) === 5, 'five scene discovery paths are present');
  await page.getByTestId('hero-explore').click();
  await page.getByTestId('event-card').first().waitFor();
  check(page.url().includes('#/explore'), 'primary hero CTA opens event discovery');
  await page.goto(`${BASE}/#/`);
  await page.getByTestId('scene-link').filter({ hasText: 'A good laugh' }).click();
  await page.getByTestId('event-card').first().waitFor();
  check(page.url().includes('category=Comedy'), 'scene choice opens the matching category filter');
  check((await page.getByRole('button', { name: 'Comedy', exact: true }).getAttribute('class')).includes('chip-on'), 'category filter is visibly selected');
  await page.goto(`${BASE}/#/e/neon-monsoon-warehouse-rave`);
  await page.getByTestId('event-title').waitFor();
  check((await page.title()).includes('NEON MONSOON'), 'event title updates from loaded event data');
  check(await page.locator('meta[name="robots"]').getAttribute('content') === 'noindex,follow', 'fictional demo events do not request indexing');
  await page.goto(`${BASE}/#/`);
  const history = page.getByTestId('recently-viewed');
  await history.scrollIntoViewIfNeeded();
  await history.getByRole('link').first().waitFor();
  check((await history.innerText()).includes('NEON MONSOON'), 'viewed event appears back on the homepage');
  await page.reload();
  await history.getByRole('link').first().waitFor();
  check((await history.getByRole('link').count()) === 1, 'recent history persists without duplicate entries');
  await page.getByRole('button', { name: 'Pause animations', exact: true }).filter({ visible: true }).first().click();
  check(await page.locator('html').getAttribute('data-motion') === 'paused', 'motion can be paused');
  check(await page.locator('.hero-artwork').evaluate((element) => getComputedStyle(element).animationName) === 'none', 'pause stops the artwork animation');
  check(await page.locator('[data-reveal]').evaluateAll((elements) => elements.every((element) => getComputedStyle(element).opacity === '1')), 'pause never leaves reveal content hidden');
  await page.reload();
  await page.getByTestId('hero-title').waitFor();
  check(await page.locator('html').getAttribute('data-motion') === 'paused', 'motion preference survives reload');
  await page.getByRole('button', { name: 'Enable animations', exact: true }).filter({ visible: true }).first().click();
  check(await page.locator('html').getAttribute('data-motion') === 'full', 'motion can be resumed');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.documentElement.dataset.motion === 'paused');
  check(await page.getByTestId('motion-toggle').filter({ visible: true }).first().isDisabled(), 'device reduced-motion preference takes precedence');
  check(await page.locator('.hero-artwork').evaluate((element) => getComputedStyle(element).animationName) === 'none', 'reduced motion disables decorative animation');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await skip.focus();
  await page.keyboard.press('Enter');
  check(await page.evaluate(() => document.activeElement?.id === 'main-content'), 'keyboard skip link focuses main content without changing routes');
  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${scheme} homepage fits ${width}px`);
    }
  }
  check(await page.locator('footer').getByText('A concern of Bpop Tags', { exact: true }).count() === 1, 'footer retains the required parent-brand credit');
  check(outside.length === 0, 'initial discovery experience loads without third-party requests');
  check(failures.length === 0, `no browser errors or failed asset requests (${failures.join('; ')})`);
  const plain = await browser.newContext({ javaScriptEnabled: false });
  const plainPage = await plain.newPage();
  await plainPage.goto(BASE);
  check(await plainPage.getByRole('heading', { name: 'Dekha Hobe — events and culture in Bangladesh' }).isVisible(), 'readable homepage information is available without JavaScript');
  await plain.close();
  await context.close();
  console.log(`\n${count} experience checks passed`);
} finally {
  await browser.close();
}
