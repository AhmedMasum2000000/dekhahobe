// Node smoke test for the local adapter's business rules.
const store = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
const { localAdapter: api } = await import('../src/api/local/adapter');
const { readDb } = await import('../src/api/local/db');
const { DEMO_ATTENDEE_PHONE, DEMO_ORGANIZER_PHONE, DEMO_SCANNER_PIN } = await import('../src/api/local/seed');

let pass = 0;
const ok = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } pass++; console.log('ok -', m); };
const { normalizePhone } = await import('../src/lib/util');
const lastOtp = (p: string) => readDb().otps[normalizePhone(p)!]!.code;
async function login(phone: string) { await api.sendOtp(phone); return api.verifyOtp(phone, lastOtp(phone)); }
async function expectErr(p: Promise<unknown>, re: RegExp, m: string) { try { await p; ok(false, m); } catch (e: any) { ok(re.test(e.message), `${m} (${e.message})`); } }

const db0 = readDb();
console.log('seed:', db0.events.length, 'events', db0.tickets.length, 'tickets', db0.orders.length, 'orders', (JSON.stringify(db0).length / 1024).toFixed(0), 'KB');
ok(JSON.stringify(db0).length < 4_000_000, 'seed fits in localStorage');

// explore
const ex = await api.explore({});
ok(ex.featured.length > 3 && ex.trending.length > 15, 'explore returns featured + trending');
ok(ex.trending.filter((c) => c.event.seriesId).every((c, i, a) => a.findIndex((x) => x.event.seriesId === c.event.seriesId) === i), 'series collapsed');
const free = await api.explore({ price: 'free' });
ok(free.trending.every((c) => c.fromPrice === 0), 'price filter free');
const ctg = await api.explore({ city: 'Chattogram' });
ok(ctg.trending.every((c) => c.event.venue.city === 'Chattogram') && ctg.trending.length > 0, 'city filter');

// login + buy
const { user: nus } = await login(DEMO_ATTENDEE_PHONE);
ok(nus.username === 'nusrat', 'otp login demo attendee');
await expectErr(api.verifyOtp(DEMO_ATTENDEE_PHONE, '000000'), /code/, 'wrong otp rejected');
const neon = db0.events[0]!;
const ga = neon.ticketTypes[1]!;
const soldBefore = ga.sold;
const q = await api.quote(neon.id, [{ ticketTypeId: ga.id, qty: 2 }], 'MONSOON10');
ok(q.discount === Math.round(ga.price * 2 * 0.1) && !q.error, 'promo applies 10%');
const kb = readDb().kickbackLinks.find((l) => l.eventId === neon.id)!;
const order = await api.startCheckout({ eventId: neon.id, cart: [{ ticketTypeId: ga.id, qty: 2 }], promo: 'MONSOON10', kickback: kb.code, buyer: { name: 'Nusrat Jahan', phone: '01811000002' } });
ok(order.status === 'pending_payment' && readDb().events[0]!.ticketTypes[1]!.sold === soldBefore + 2, 'seats held during checkout');
const paid = await api.payOrder(order.id, 'bkash', 'TX1');
ok(paid.status === 'paid' && paid.kickbackCommission > 0, 'paid + kickback commission');
const tix = readDb().tickets.filter((t) => t.orderId === order.id);
ok(tix.length === 2, 'two tickets issued');

// hold expiry
const o2 = await api.startCheckout({ eventId: neon.id, cart: [{ ticketTypeId: ga.id, qty: 3 }], buyer: { name: 'N', phone: '01811000002' } });
const d = readDb(); d.orders.find((o) => o.id === o2.id)!.holdExpiresAt = new Date(Date.now() - 1000).toISOString();
await api.explore({});
ok(readDb().orders.find((o) => o.id === o2.id)!.status === 'expired' && readDb().events[0]!.ticketTypes[1]!.sold === soldBefore + 2, 'expired hold releases seats');
await expectErr(api.payOrder(o2.id, 'bkash', 'x'), /expired/, 'cannot pay expired order');

// rsvp once
const loop = readDb().events.find((e) => e.rsvpOnly && e.title.includes('Lake Loop') && new Date(e.startsAt) > new Date())!;
const already = readDb().tickets.some((t) => t.eventId === loop.id && t.ownerId === nus.id);
if (already) await expectErr(api.startCheckout({ eventId: loop.id, cart: [{ ticketTypeId: loop.ticketTypes[0]!.id, qty: 1 }], buyer: { name: 'N', phone: '01811000002' } }), /already RSVP/, 'one RSVP per account');

// transfer
await api.startTransfer([tix[0]!.id], '01911222333');
const oldNonce = tix[0]!.qrNonce;
await expectErr(api.startTransfer([tix[0]!.id], '01911222333'), /pending/, 'double transfer blocked');
const { user: friend } = await login('01911222333');
const inc = await api.incomingTransfers();
ok(inc.length === 1, 'recipient sees transfer');
await api.acceptTransfer(tix[0]!.id);
ok(readDb().tickets.find((t) => t.id === tix[0]!.id)!.ownerId === friend.id, 'transfer accepted');

// door scan with scanner pin
await api.logout();
await api.scannerLogin(DEMO_SCANNER_PIN);
const r1 = await api.scanTicket(neon.id, `BPOP:${tix[0]!.id}:${oldNonce}`, 'door');
ok(r1.status === 'cancelled', 'old QR after transfer → cancelled');
const t0 = readDb().tickets.find((t) => t.id === tix[0]!.id)!;
const r2 = await api.scanTicket(neon.id, `BPOP:${t0.id}:${t0.qrNonce}`, 'door');
ok(r2.status === 'ok', 'new QR → ok');
const r3 = await api.scanTicket(neon.id, `BPOP:${t0.id}:${t0.qrNonce}`, 'door');
ok(r3.status === 'already', 'second scan → already');
const r4 = await api.scanTicket(neon.id, tix[1]!.code, 'door');
ok(r4.status === 'ok', 'manual code entry → ok');
const other = readDb().events[5]!;
const r5 = await api.scanTicket(neon.id, `BPOP:${readDb().tickets.find((t) => t.eventId === other.id)!.id}:00000000-0000-4000-8000-000000000000`, 'door');
ok(r5.status === 'wrong_event' || r5.status === 'invalid', 'other event ticket rejected');

// waitlist
const { user: w1 } = await login('01511000111');
const tea = readDb().events.find((e) => e.title.startsWith('Malnicherra'))!;
const teaTier = tea.ticketTypes[0]!;
ok(teaTier.sold >= (teaTier.quantity ?? 0), 'tea walk sold out');
await expectErr(api.joinWaitlist(tea.id, teaTier.id, 3), /up to 2/, 'waitlist max per user');
const entry = await api.joinWaitlist(tea.id, teaTier.id, 1);
ok(entry.status === 'waiting', 'joined waitlist');
await api.logout();
await login(DEMO_ORGANIZER_PHONE);
await expectErr(api.releaseToWaitlist(tea.id, teaTier.id, 1), /permission/, 'only managers of that org release');
await api.logout();
// owner of tea trails org
const teaOwner = readDb().orgs.find((o) => o.id === tea.orgId)!.team[0]!.userId;
const ownerPhone = readDb().users.find((u) => u.id === teaOwner)!.phone;
await login(ownerPhone);
const waitingBefore = readDb().waitlist.filter((w) => w.ticketTypeId === teaTier.id && w.status === 'waiting').length;
const released = await api.releaseToWaitlist(tea.id, teaTier.id, 50);
ok(released <= 50 && released > 0, `released ${released} (capped at demand)`);
const offers = readDb().waitlist.filter((w) => w.ticketTypeId === teaTier.id && w.status === 'offered');
ok(offers.length === waitingBefore, 'everyone waiting got an offer');
// expire one offer → next in line
const myOffer = readDb().waitlist.find((w) => w.id === entry.id)!;
ok(myOffer.status === 'offered', 'my entry offered');
await api.logout();
await login('01511000111');
const wq = await api.startCheckout({ eventId: tea.id, cart: [{ ticketTypeId: teaTier.id, qty: 1 }], waitlistEntryId: entry.id, buyer: { name: 'W One', phone: '01511000111' } });
await api.payOrder(wq.id, 'nagad', 'x');
ok(readDb().waitlist.find((w) => w.id === entry.id)!.status === 'claimed', 'waitlist claim purchase');
ok(readDb().orders.find((o) => o.id === wq.id)!.source === 'waitlist', 'order marked via waitlist');

// approval
const runway = readDb().events.find((e) => e.title.startsWith('RUNWAY'))!;
const front = runway.ticketTypes[1]!;
const ao = await api.startCheckout({ eventId: runway.id, cart: [{ ticketTypeId: front.id, qty: 1 }], buyer: { name: 'W One', phone: '01511000111' } });
const ap = await api.payOrder(ao.id, 'card', 'x');
ok(ap.status === 'pending_approval' && !readDb().tickets.some((t) => t.orderId === ao.id), 'approval: no tickets yet');
const pq = await api.quote(runway.id, [{ ticketTypeId: runway.ticketTypes[2]!.id, qty: 1 }]);
ok(/password/.test(pq.error ?? ''), 'password tier blocked without password');
const pq2 = await api.quote(runway.id, [{ ticketTypeId: runway.ticketTypes[2]!.id, qty: 1 }], undefined, 'PRESS2026');
ok(!pq2.error, 'password tier ok with password');
const purb = readDb().events.find((e) => e.title.startsWith('Purbachal'))!;
const hq = await api.quote(purb.id, [{ ticketTypeId: purb.ticketTypes.find((t) => t.hidden)!.id, qty: 1 }]);
ok(/online/.test(hq.error ?? ''), 'hidden tier not sold online');
const ids = await api.unlockTickets(runway.id, 'PRESS2026');
ok(ids.length === 1, 'password unlock');

// in person only
const cox = readDb().events.find((e) => e.title.startsWith("Cox's Wave Fest 2026"))!;
const gate = cox.ticketTypes.find((t) => t.inPersonOnly)!;
const gq = await api.quote(cox.id, [{ ticketTypeId: gate.id, qty: 1 }]);
ok(/door/.test(gq.error ?? ''), 'in-person-only blocked online');

// organizer stats & payouts
await api.logout();
await login(DEMO_ORGANIZER_PHONE);
const orgs = await api.myOrgs();
ok(orgs.length === 2, 'demo organizer has 2 orgs');
const st = await api.orgStats(orgs[0]!.org.id);
ok(st.revenue > 0 && st.balance > 0, `org stats revenue ${st.revenue} balance ${st.balance}`);
const po = await api.requestPayout(orgs[0]!.org.id, 1000, true);
ok(po.fee === 15 && po.status === 'paid', 'instant payout with 1.5% fee');
const ans = await api.askAi(orgs[0]!.org.id, 'which event performed best?');
ok(/top event/.test(ans), 'ask ai');
const ev = await api.createEvent(orgs[0]!.org.id, { title: 'Test Night', status: 'published' });
ok(ev.slug === 'test-night', 'create event');
const blast = await api.sendSmsBlast(orgs[0]!.org.id, { audience: 'followers', body: 'Hello!' });
ok(blast.recipients > 0, `sms blast to ${blast.recipients}`);
const comps = await api.sendComps(neon.id, { phone: '01612345678', name: 'VIP Guest', ticketTypeId: neon.ticketTypes[2]!.id, qty: 2 });
ok(comps.length === 2 && comps.every((c) => c.isComp), 'comps issued');
const door = await api.doorSale(cox.id, { ticketTypeId: gate.id, qty: 1, method: 'cash', name: 'Walk In' }).catch((e) => e);
ok(door instanceof Error && /permission/.test(door.message), 'door sale needs org role');
const refundTarget = readDb().orders.find((o) => o.eventId === neon.id && o.status === 'paid' && o.total > 0 && o.source === 'online')!;
await api.refundOrder(refundTarget.id);
ok(readDb().orders.find((o) => o.id === refundTarget.id)!.status === 'refunded', 'refund order');
await expectErr(api.updateEvent(neon.id, { kickbackOffers: [...neon.kickbackOffers, { ...neon.kickbackOffers[0]!, id: 'x2' }] }), /one public/, 'one public kickback offer');
console.log(`\n${pass} checks passed`);
process.exit(0);
