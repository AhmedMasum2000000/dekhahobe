// End-to-end flows for B-POP TAGS, run against a live build:
//   npm run build && npm run preview   (in one terminal)
//   npm run e2e                         (in another)
// Env: BASE (default http://localhost:4173), SHOTS (screenshot folder, optional)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = (process.env.BASE ?? 'http://localhost:4173').replace(/\/$/, '') + '/#';
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
let passed = 0;
const ok = (cond, msg) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  passed++;
  console.log(`ok - ${msg}`);
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/favicon|fonts\.g/.test(m.text()) && errors.push(m.text()));

const go = async (path) => {
  await page.goto(BASE + path);
  await page.waitForLoadState('networkidle');
};
const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png` });
const tid = (id) => page.getByTestId(id);

async function lastSmsCode(re = /(\d{6})/) {
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="sms-toast"]').length > 0);
  const texts = await tid('sms-toast').allInnerTexts();
  const m = texts.reverse().map((t) => t.match(re)).find(Boolean);
  if (!m) throw new Error('no code in SMS');
  return m[1];
}

async function dismissToasts() {
  await page.evaluate(() => document.querySelectorAll('[data-testid="sms-toast"],[data-testid="toast"]').forEach((el) => el.click()));
}

async function logout() {
  await page.evaluate(() => localStorage.setItem('bpop:session', JSON.stringify({ userId: null, scannerOrgId: null })));
  await page.reload();
  await page.waitForLoadState('networkidle');
}

async function login(phone, name) {
  await logout();
  await go('/login');
  await tid('phone-input').fill(phone);
  await tid('send-code').click();
  const code = await lastSmsCode(/(\d{6}) is your B-POP TAGS/);
  for (let i = 0; i < 6; i++) await tid(`otp-${i}`).fill(code[i]);
  if (name) {
    await tid('profile-name').waitFor();
    await tid('profile-name').fill(name);
    await tid('profile-save').click();
  }
  await page.waitForURL((u) => !u.hash.startsWith('#/login'));
  await dismissToasts();
}

async function payWallet(method) {
  await tid(`pay-${method}`).click();
  await tid('gw-continue').click();
  const code = await lastSmsCode(/verification code is (\d{6})/);
  await tid('gw-otp').fill(code);
  await tid('gw-otp-submit').click();
  await tid('gw-pin').fill('12345');
  await tid('gw-pay').click();
  await tid('order-headline').waitFor();
}

async function payCard() {
  await tid('pay-card').click();
  await tid('card-number').fill('4242 4242 4242 4242');
  await tid('card-exp').fill('12/30');
  await tid('card-cvc').fill('123');
  await tid('gw-continue').click();
  const code = await lastSmsCode(/verification code is (\d{6})/);
  await tid('gw-otp').fill(code);
  await tid('gw-otp-submit').click();
  await tid('order-headline').waitFor();
}

const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('bpop:db')));

try {
  // fresh demo data
  await go('/');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await page.waitForLoadState('networkidle');
  ok(await page.getByTestId('hero-title').isVisible(), 'home renders');
  await shot('01-home');

  // ---- A. OTP login
  await login('01811000002');
  ok(page.url().includes('#/explore'), 'OTP login as demo attendee lands on explore');

  // ---- B. Explore filters
  await tid('filter-location').selectOption('Chattogram');
  await page.waitForTimeout(400);
  const ctgCards = await tid('event-card').allInnerTexts();
  ok(ctgCards.length > 0 && ctgCards.every((t) => /Chattogram|Patenga|GEC/.test(t)), `location filter shows only Chattogram (${ctgCards.length})`);
  await tid('filter-location').selectOption('All');
  await tid('filter-price').selectOption('free');
  await page.waitForTimeout(400);
  const freeCards = await tid('event-card').allInnerTexts();
  ok(freeCards.length > 0 && freeCards.every((t) => /\bFree\b/.test(t)), `price filter "Free" (${freeCards.length})`);
  await shot('02-explore-filtered');

  // ---- C. Buy 2 GA with bKash + promo
  await go('/e/neon-monsoon-warehouse-rave');
  ok((await tid('event-title').innerText()).includes('NEON MONSOON'), 'event page opens');
  await tid('buy-cta').click();
  const ga = tid('tier').filter({ hasText: 'General Admission' });
  await ga.getByLabel('Increase').click();
  await ga.getByLabel('Increase').click();
  await page.getByText('Have a promo code?').click();
  await tid('promo-input').fill('MONSOON10');
  await page.waitForFunction(() => document.body.innerText.includes('Promo MONSOON10'));
  ok(true, 'promo MONSOON10 applied in ticket sheet');
  await shot('03-ticket-sheet');
  await tid('checkout-btn').click();
  await tid('continue-payment').click();
  await tid('hold-timer').waitFor();
  ok(/1[45]:\d\d/.test(await tid('hold-timer').innerText()), 'checkout shows 15-minute hold timer');
  await shot('04-checkout');
  await payWallet('bkash');
  ok((await tid('order-headline').innerText()).includes('going'), 'bKash payment → order confirmed');
  await shot('05-order-complete');
  const orderId = page.url().split('/orders/')[1];
  let d = await db();
  const myTickets = d.tickets.filter((t) => t.orderId === orderId);
  ok(myTickets.length === 2, 'two tickets issued');
  await go(`/tickets/${myTickets[0].id}`);
  const qrBefore = await page.locator('img[data-qr]').getAttribute('data-qr');
  ok(qrBefore.startsWith('BPOP:'), 'full-screen QR shows');
  await shot('06-ticket-qr');

  // ---- C2. hold expiry releases seats
  await go('/e/neon-monsoon-warehouse-rave');
  await tid('buy-cta').click();
  await tid('tier').filter({ hasText: 'General Admission' }).getByLabel('Increase').click();
  await tid('checkout-btn').click();
  await tid('continue-payment').click();
  await tid('hold-timer').waitFor();
  d = await db();
  const gaTier = d.events.find((e) => e.slug === 'neon-monsoon-warehouse-rave').ticketTypes.find((t) => t.name === 'General Admission');
  const held = d.orders.find((o) => o.status === 'pending_payment');
  await page.evaluate((id) => { const x = JSON.parse(localStorage.getItem('bpop:db')); x.orders.find((o) => o.id === id).holdExpiresAt = new Date(Date.now() - 1000).toISOString(); localStorage.setItem('bpop:db', JSON.stringify(x)); }, held.id);
  await go('/explore');
  await page.reload();
  await page.waitForLoadState('networkidle');
  d = await db();
  ok(d.orders.find((o) => o.id === held.id).status === 'expired' && d.events.find((e) => e.slug === 'neon-monsoon-warehouse-rave').ticketTypes.find((t) => t.name === 'General Admission').sold === gaTier.sold - 1, 'expired hold releases the seat');

  // ---- I. chat syncs across two tabs
  await go('/e/neon-monsoon-warehouse-rave');
  const tab2 = await ctx.newPage();
  await tab2.goto(BASE + '/e/neon-monsoon-warehouse-rave');
  await tab2.waitForLoadState('networkidle');
  await tid('chat-input').fill('See you at the front! (e2e)');
  await tid('chat-input').press('Enter');
  await tab2.waitForFunction(() => document.querySelector('[data-testid="chat-list"]')?.textContent?.includes('See you at the front! (e2e)'), null, { timeout: 5000 });
  ok(true, 'chat message appears live in a second tab');
  await tab2.close();

  // ---- H1. Kickback link
  await tid('kickback-banner').getByRole('button').click();
  const link = await tid('kickback-link').innerText();
  const refCode = link.split('ref=')[1];
  ok(!!refCode, `kickback link created (${refCode})`);

  // ---- D. Transfer ticket
  await go(`/tickets/${myTickets[0].id}`);
  await tid('transfer-btn').click();
  await tid('transfer-phone').fill('01911222333');
  await tid('confirm-transfer').click();
  await page.getByText('Transfer pending').first().waitFor();
  ok(true, 'transfer sent, ticket pending');
  await login('01911222333', 'Tanvir Hossain');
  await go('/tickets?tab=transfers');
  await tid('accept-transfer').click();
  await page.waitForTimeout(400);
  await go(`/tickets/${myTickets[0].id}`);
  const qrAfter = await page.locator('img[data-qr]').getAttribute('data-qr');
  ok(qrAfter !== qrBefore, 'recipient has the ticket with a new QR');

  // ---- E. Door check-in with scanner PIN
  await logout();
  await go('/scanner');
  await tid('scanner-pin-input').fill('482913');
  await tid('scanner-pin-submit').click();
  await tid('scanner-event').filter({ hasText: 'NEON MONSOON: Warehouse Rave' }).click();
  const scan = async (payload) => {
    await tid('manual-code').fill(payload);
    await tid('manual-check').click();
    await page.waitForTimeout(350);
    return tid('scan-result').getAttribute('data-status');
  };
  ok((await scan(qrBefore)) === 'cancelled', 'sender’s old QR scans as Canceled');
  ok((await scan(qrAfter)) === 'ok', 'new QR scans OK');
  await shot('07-scanner-ok');
  ok((await scan(qrAfter)) === 'already', 'second scan → already scanned');
  ok((await scan('ZZZZ-ZZZZ')) === 'invalid', 'unknown code → invalid');

  // ---- H2. buy through kickback link
  await login('01611222333', 'Mim Akter');
  await go(`/e/neon-monsoon-warehouse-rave?ref=${refCode}`);
  await tid('buy-cta').click();
  await tid('tier').filter({ hasText: 'General Admission' }).getByLabel('Increase').click();
  await tid('checkout-btn').click();
  await tid('continue-payment').click();
  await payWallet('nagad');
  ok(true, 'friend buys through kickback link with Nagad');
  await login('01811000002');
  await go('/kickbacks');
  await page.waitForFunction(() => /৳/.test(document.querySelector('[data-testid="kickback-total"]')?.textContent ?? ''));
  const earned = await tid('kickback-total').innerText();
  ok(/৳[1-9]/.test(earned), `promoter earnings updated (${earned})`);

  // ---- F. Waitlist → organizer releases → claim
  await login('01511000111', 'Ehsan Karim');
  const d2 = await db();
  const openMic = d2.events.filter((e) => e.title.startsWith('Laugh Lab Live') && new Date(e.startsAt) > new Date()).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  await go(`/e/${openMic.slug}`);
  await tid('buy-cta').click();
  await tid('join-waitlist').click();
  await tid('confirm-waitlist').click();
  await page.waitForTimeout(400);
  await go('/tickets?tab=waitlist');
  await tid('waitlist-entry').first().waitFor({ timeout: 5000 });
  ok((await tid('waitlist-entry').count()) === 1, 'joined the waitlist for a sold-out tier');

  await login('01711000001');
  await go('/dashboard');
  await tid('org-switcher').click();
  await page.getByRole('button', { name: 'Laugh Lab BD' }).click();
  await go(`/dashboard/events/${openMic.id}/tickets`);
  await tid('tier-row').filter({ hasText: 'Front Row' }).click();
  await page.getByRole('tab', { name: 'Waitlist' }).click();
  const inc = page.getByRole('dialog').getByLabel('Increase');
  while (await inc.isEnabled()) await inc.click();
  await tid('release-now').click();
  await page.getByText(/Offered \d+ ticket/).waitFor();
  ok(true, 'organizer released tickets to the waitlist');
  await shot('08-dashboard-waitlist');

  await login('01511000111');
  await go('/tickets?tab=waitlist');
  await page.getByRole('link', { name: 'Claim' }).click();
  await tid('claim-offer').click();
  await tid('continue-payment').click();
  await payCard();
  d = await db();
  const claimed = d.orders.find((o) => o.userId === d.users.find((u) => u.phone === '+8801511000111').id && o.source === 'waitlist');
  ok(claimed?.status === 'paid', 'waitlist offer claimed and paid by card');

  // ---- G. Create & publish an event
  await login('01711000001');
  await go('/create');
  await tid('ev-title').fill('E2E Test Night');
  await tid('next-step').click();
  await tid('ev-venue').fill('The Loft, Banani 11');
  for (let i = 0; i < 4; i++) await tid('next-step').click();
  await tid('publish').click();
  await tid('manage-title').waitFor();
  ok((await tid('manage-title').innerText()) === 'E2E Test Night', 'event created and published');
  await shot('09-manage');
  await go('/explore');
  await tid('search').fill('E2E Test Night');
  await page.waitForTimeout(500);
  ok((await tid('event-card').count()) === 1, 'new event appears in Explore search');

  // ---- mobile screenshots
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [n, p] of [['m-home', '/'], ['m-explore', '/explore'], ['m-event', '/e/neon-monsoon-warehouse-rave'], ['m-tickets', '/tickets'], ['m-dashboard', '/dashboard']]) {
    await go(p);
    await page.waitForTimeout(500);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    ok(sw <= 391, `${n}: no horizontal scroll at 390px`);
    await shot(n);
  }

  // ---- H. Phone tap-through: every page renders without a refresh, with no SVG filters
  await go('/');
  const filters = () => page.evaluate(() => document.querySelectorAll('[filter]').length);
  const homeFilters = await filters();
  const filled = () => page.evaluate(() => (document.getElementById('root')?.children.length ?? 0) > 0 && (document.querySelector('main')?.innerText.trim().length ?? 0) > 0);
  const tabs = page.locator('nav[aria-label="App tabs"]');
  let exploreFilters = -1;
  const blank = [];
  for (const [label, act] of [
    ['Explore tab', () => tabs.getByText('Explore', { exact: true }).click()],
    ['event card', () => tid('event-card').first().click()],
    ['organizer', () => page.locator('main a[href*="#/g/"]').first().click()],
    ['back', () => page.goBack()],
    ['Tickets tab', () => tabs.getByText('Tickets', { exact: true }).click()],
    ['Activity tab', () => tabs.getByText('Activity', { exact: true }).click()],
    ['logo', () => page.locator('header a[aria-label="B-POP TAGS home"]').click()],
  ]) {
    await act();
    await page.waitForTimeout(700);
    if (label === 'Explore tab') exploreFilters = await filters();
    if (!(await filled())) blank.push(label);
  }
  ok(blank.length === 0, `tap-through: every page renders without a refresh${blank.length ? ` (blank after: ${blank.join(', ')})` : ''}`);
  ok(homeFilters === 0 && exploreFilters === 0, `posters render without SVG filters (home ${homeFilters}, explore ${exploreFilters})`);

  ok(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);

  // ---- I. A code file from an older deploy is gone: the app reloads itself instead of going white
  const p2 = await ctx.newPage();
  await p2.setViewportSize({ width: 390, height: 844 });
  let failFirst = true;
  await p2.route(/assets\/EventEditor-[^/]*\.js$/, (r) => {
    if (failFirst) {
      failFirst = false;
      return r.fulfill({ status: 404, body: 'Not Found' });
    }
    return r.continue();
  });
  await p2.goto(BASE + '/');
  await p2.waitForLoadState('networkidle');
  await p2.locator('nav[aria-label="App tabs"]').getByText('Create', { exact: true }).click();
  const recovered = await p2.getByTestId('ev-title').waitFor({ timeout: 15000 }).then(() => true, () => false);
  ok(recovered && !failFirst, 'missing code file after a deploy → app reloads itself and the page renders');
  await p2.close();

  // ---- J. A cached page asks for a main code file that's gone: loading screen, then self-recovery
  const p3 = await ctx.newPage();
  let missMain = true;
  await p3.route(/assets\/index-[^/]*\.js$/, async (r) => {
    if (missMain) {
      missMain = false;
      await new Promise((res) => setTimeout(res, 600));
      return r.fulfill({ status: 404, body: 'Not Found' });
    }
    return r.continue();
  });
  await p3.goto(BASE + '/', { waitUntil: 'commit' });
  const bootShown = await p3.locator('#boot').getByText('Loading B-POP TAGS').waitFor({ timeout: 5000 }).then(() => true, () => false);
  ok(bootShown, 'while code loads the page shows a loading screen, not solid white');
  const healed = await p3.getByTestId('hero-title').waitFor({ timeout: 15000 }).then(() => true, () => false);
  ok(healed && !missMain, 'missing main code file → page fetches a fresh copy and renders');
  await p3.close();

  // ---- K. Hosts that wrap scrollTo/focus/scrollIntoView and return a value (the claude.ai viewer
  // does) must not crash page changes: effects never return what those calls return
  const p4 = await ctx.newPage();
  await p4.setViewportSize({ width: 390, height: 844 });
  await p4.addInitScript(() => {
    const wrap = (obj, name) => {
      const orig = obj[name];
      obj[name] = function (...a) {
        orig.apply(this, a);
        return Promise.resolve();
      };
    };
    wrap(window, 'scrollTo');
    wrap(HTMLElement.prototype, 'focus');
    wrap(Element.prototype, 'scrollIntoView');
  });
  const p4Errors = [];
  p4.on('pageerror', (e) => p4Errors.push(e.message));
  await p4.goto(BASE + '/');
  await p4.waitForLoadState('networkidle');
  const tabs4 = p4.locator('nav[aria-label="App tabs"]');
  const snags = [];
  for (const [label, act] of [
    ['Explore', () => tabs4.getByText('Explore', { exact: true }).click()],
    ['event', () => p4.getByTestId('event-card').first().click()],
    ['organizer', () => p4.locator('main a[href*="#/g/"]').first().click()],
    ['Tickets', () => tabs4.getByText('Tickets', { exact: true }).click()],
    ['Activity', () => tabs4.getByText('Activity', { exact: true }).click()],
    ['home', () => p4.locator('header a[aria-label="B-POP TAGS home"]').click()],
  ]) {
    await act();
    await p4.waitForTimeout(600);
    if (await p4.getByTestId('page-error').count()) snags.push(label);
  }
  ok(snags.length === 0 && p4Errors.length === 0, `wrapped scrollTo/focus host: every page change works${snags.length ? ` (error page after: ${snags.join(', ')})` : ''}${p4Errors.length ? ` errors: ${p4Errors.join(' | ')}` : ''}`);
  await p4.close();
  console.log(`\n${passed} checks passed`);
} catch (e) {
  console.error(e.message);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/failure.png`, fullPage: true });
  console.error('page errors:', errors);
  process.exitCode = 1;
} finally {
  await browser.close();
}
