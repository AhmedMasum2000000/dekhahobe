// LocalAdapter — implements ApiClient entirely in the browser.
// Every business rule here mirrors docs/REA-teardown.md §4.
import type {
  ApiClient,
  BpopEvent,
  CartLine,
  CheckoutQuote,
  EventCard,
  EventStats,
  ExploreFilters,
  ID,
  KickbackLink,
  KickbackOffer,
  Order,
  OrderItem,
  Organization,
  OrgStats,
  ScanResult,
  TeamRole,
  Ticket,
  TicketType,
  TicketView,
  User,
} from '../types';
import { readDb, readSession, registerSeed, resetDb, writeDb, writeSession, type DB } from './db';
import { buildSeed } from './seed';
import { dayKey, displayPrice, normalizePhone, nonce, serviceFee, shortCode, sleep, slugify, tk, uid } from '../../lib/util';

registerSeed(buildSeed);

export class ApiError extends Error {}
const fail = (msg: string): never => {
  throw new ApiError(msg);
};

const HOLD_MINUTES = 15;
const OTP_MINUTES = 5;
const now = () => Date.now();
const nowIso = () => new Date().toISOString();
const latency = () => sleep(40 + Math.random() * 90);

// ---------------------------------------------------------------- core access

function tx<T>(fn: (db: DB) => T): T {
  // work on a copy so a call that fails half-way never leaves partial changes behind
  const draft = structuredClone(readDb());
  housekeeping(draft);
  const out = fn(draft);
  writeDb(draft);
  return out;
}

function view<T>(fn: (db: DB) => T): T {
  const db = readDb();
  if (housekeeping(db)) writeDb(db);
  return fn(db);
}

function meOpt(db: DB): User | null {
  const { userId } = readSession();
  return userId ? db.users.find((u) => u.id === userId) ?? null : null;
}
function me(db: DB): User {
  return meOpt(db) ?? fail('Please log in to continue.');
}

const findEvent = (db: DB, id: ID) => db.events.find((e) => e.id === id) ?? fail('Event not found.');
const findOrg = (db: DB, id: ID) => db.orgs.find((o) => o.id === id) ?? fail('Organization not found.');
const findTier = (ev: BpopEvent, id: ID) => ev.ticketTypes.find((t) => t.id === id) ?? fail('Ticket type not found.');
const userById = (db: DB, id: ID) => db.users.find((u) => u.id === id);
const userByPhone = (db: DB, phone: string) => db.users.find((u) => u.phone === phone);

function roleFor(db: DB, orgId: ID): TeamRole | 'scanner' | null {
  const u = meOpt(db);
  const org = db.orgs.find((o) => o.id === orgId);
  if (!org) return null;
  const m = u ? org.team.find((t) => t.userId === u.id) : undefined;
  if (m) return m.role;
  if (readSession().scannerOrgId === orgId) return 'scanner';
  return null;
}
function requireRole(db: DB, orgId: ID, allowed: (TeamRole | 'scanner')[]) {
  const r = roleFor(db, orgId);
  if (!r || !allowed.includes(r)) fail('You don’t have permission to do that.');
  return r!;
}
const MANAGERS: TeamRole[] = ['owner', 'admin'];
const ORG_PROFILE_FIELDS = ['name', 'slug', 'bio', 'city', 'instagram', 'website', 'contactEmail', 'avatarUrl', 'bannerSeed'] as const;

/** Uploaded images are stored as data URLs; only accept real image types. */
function safeImage(url: string) {
  if (!/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(url)) fail('Upload a PNG, JPG, GIF or WebP image.');
  if (url.length > 1_400_000) fail('That image is too large — choose one under 1 MB.');
}
const DOOR: (TeamRole | 'scanner')[] = ['owner', 'admin', 'doorperson', 'scanner'];

// ---------------------------------------------------------------- inventory

const ended = (ev: BpopEvent) => new Date(ev.endsAt).getTime() < now();
const remaining = (tt: TicketType) => (tt.quantity === null ? Infinity : tt.quantity - tt.sold - tt.heldForWaitlist);
const soldOut = (tt: TicketType) => tt.markedSoldOut || remaining(tt) <= 0;

function hasWaiting(db: DB, ttId: ID) {
  return db.waitlist.some((w) => w.ticketTypeId === ttId && w.status === 'waiting');
}

function notify(db: DB, userId: ID, n: Omit<DB['notifications'][number], 'id' | 'userId' | 'read' | 'createdAt'>) {
  db.notifications.push({ id: uid('nt'), userId, read: false, createdAt: nowIso(), ...n });
}

function sms(db: DB, to: string, body: string, opts: { otp?: boolean } = {}) {
  if (!to) return;
  const item = { id: uid('sms'), to, body, createdAt: nowIso() };
  db.outbox.push(item);
  if (db.outbox.length > 300) db.outbox.splice(0, db.outbox.length - 300);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bpop:sms', { detail: { ...item, otp: !!opts.otp } }));
}

/** Offer seats held for the waitlist to the next people in line; release leftovers publicly. */
function processWaitlist(db: DB, ev: BpopEvent, tt: TicketType) {
  if (ended(ev) || tt.heldForWaitlist <= 0) return;
  const entries = db.waitlist.filter((w) => w.ticketTypeId === tt.id);
  const offered = entries.filter((w) => w.status === 'offered').reduce((a, w) => a + w.qty, 0);
  let free = tt.heldForWaitlist - offered;
  const waiting = entries.filter((w) => w.status === 'waiting').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const w of waiting) {
    if (free <= 0) break;
    const q = Math.min(w.qty, free);
    w.qty = q;
    w.status = 'offered';
    w.offerExpiresAt = new Date(now() + tt.waitlistResponseMins * 60e3).toISOString();
    free -= q;
    const u = userById(db, w.userId);
    notify(db, w.userId, { kind: 'waitlist', title: 'A ticket opened up for you 🎟️', body: `${q} × ${tt.name} for ${ev.title}. Claim within ${tt.waitlistResponseMins} min.`, link: `/e/${ev.slug}?offer=${w.id}` });
    if (u) sms(db, u.phone, `Dekha Hobe: ${q} ticket(s) for ${ev.title} are yours if you claim within ${tt.waitlistResponseMins} min.`);
  }
  if (free > 0 && !entries.some((w) => w.status === 'waiting')) tt.heldForWaitlist -= free; // nobody left in line
}

/** Seats come back (refund, cancel, expiry). Waitlist gets first dibs. */
function releaseSeats(db: DB, ev: BpopEvent, tt: TicketType, qty: number) {
  tt.sold = Math.max(0, tt.sold - qty);
  if (tt.waitlistEnabled && hasWaiting(db, tt.id) && !ended(ev)) {
    tt.heldForWaitlist += qty;
    processWaitlist(db, ev, tt);
  }
}

function releaseOrder(db: DB, order: Order) {
  const ev = db.events.find((e) => e.id === order.eventId);
  if (!ev) return;
  for (const it of order.items) {
    const tt = ev.ticketTypes.find((t) => t.id === it.ticketTypeId);
    if (!tt) continue;
    if (order.source === 'waitlist') {
      // the seats go back to the waitlist pool and the offer moves on
      tt.sold = Math.max(0, tt.sold - it.qty);
      tt.heldForWaitlist += it.qty;
      const entry = db.waitlist.find((w) => w.orderId === order.id);
      if (entry) entry.status = 'expired';
      processWaitlist(db, ev, tt);
    } else {
      releaseSeats(db, ev, tt, it.qty);
    }
  }
}

/** Expire holds and waitlist offers, settle payouts. Returns true when anything changed. */
function housekeeping(db: DB): boolean {
  let changed = false;
  const t = now();
  for (const o of db.orders) {
    if (o.status === 'pending_payment' && o.holdExpiresAt && new Date(o.holdExpiresAt).getTime() < t) {
      o.status = 'expired';
      releaseOrder(db, o);
      changed = true;
    }
  }
  const touched = new Set<string>();
  for (const w of db.waitlist) {
    if (w.status === 'offered' && w.offerExpiresAt && new Date(w.offerExpiresAt).getTime() < t) {
      w.status = 'expired';
      touched.add(w.ticketTypeId);
      notify(db, w.userId, { kind: 'waitlist', title: 'Your waitlist offer expired', body: 'The ticket was offered to the next person in line.', link: '/tickets' });
      changed = true;
    }
  }
  if (touched.size) {
    for (const ev of db.events) for (const tt of ev.ticketTypes) if (touched.has(tt.id)) processWaitlist(db, ev, tt);
  }
  for (const p of db.payouts) {
    if (p.status === 'processing' && t - new Date(p.createdAt).getTime() > 90e3) {
      p.status = 'paid';
      changed = true;
    }
  }
  return changed;
}

// ---------------------------------------------------------------- read models

const liveTickets = (db: DB, eventId: ID) => db.tickets.filter((t) => t.eventId === eventId && (t.status === 'valid' || t.status === 'checked_in'));

function fromPrice(ev: BpopEvent): number | null {
  const visible = ev.ticketTypes.filter((t) => !t.hidden && !t.password);
  if (!visible.length) return null;
  const pool = visible.filter((t) => !soldOut(t));
  const prices = (pool.length ? pool : visible).map((t) => displayPrice(t.price));
  return Math.min(...prices);
}

function toCard(db: DB, ev: BpopEvent): EventCard {
  const org = db.orgs.find((o) => o.id === ev.orgId)!;
  const live = liveTickets(db, ev.id);
  const seen = new Set<string>();
  const preview: EventCard['goingPreview'] = [];
  for (const t of live) {
    if (seen.has(t.ownerId)) continue;
    seen.add(t.ownerId);
    const u = userById(db, t.ownerId);
    if (u && !u.privateProfile) preview.push({ id: u.id, name: u.name, avatarHue: u.avatarHue, avatarUrl: u.avatarUrl });
    if (preview.length >= 6) break;
  }
  const moreDates = !!ev.seriesId && db.events.some((e) => e.id !== ev.id && e.seriesId === ev.seriesId && e.status === 'published' && !ended(e));
  return { event: ev, org, fromPrice: fromPrice(ev), goingCount: live.length, goingPreview: preview, moreDates };
}

const isListed = (ev: BpopEvent) => ev.status === 'published' && ev.visibility === 'public' && !ended(ev);

function dhakaParts(d: Date) {
  const [m, day, y] = dayKey(d).split('/').map(Number) as [number, number, number];
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', weekday: 'short' }).format(d);
  return { y, m, day, wd };
}

function matchesDate(ev: BpopEvent, f: ExploreFilters['date']): boolean {
  if (!f || f === 'any') return true;
  const s = new Date(ev.startsAt);
  const days = (s.getTime() - now()) / 86400e3;
  const today = dayKey(new Date());
  if (f === 'today') return dayKey(s) === today || (s.getTime() < now() && !ended(ev));
  if (f === 'tomorrow') return dayKey(s) === dayKey(new Date(now() + 86400e3));
  if (f === 'weekend') {
    // Bangladesh weekend is Friday + Saturday
    const { wd } = dhakaParts(s);
    return (wd === 'Fri' || wd === 'Sat') && days < 7;
  }
  if (f === 'week') return days < 7;
  if (f === 'month') return days < 31;
  return true;
}

function matchesPrice(card: EventCard, f: ExploreFilters['price']): boolean {
  if (!f || f === 'any') return true;
  const p = card.fromPrice;
  if (p === null) return false;
  if (f === 'free') return p === 0;
  if (f === 'under500') return p < 500;
  if (f === 'under1500') return p < 1500;
  return p >= 1500;
}

/** Only the next date of each series appears in feeds ("More dates" badge). */
function collapseSeries(evs: BpopEvent[]): BpopEvent[] {
  const seen = new Set<string>();
  return [...evs]
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .filter((e) => {
      if (!e.seriesId) return true;
      if (seen.has(e.seriesId)) return false;
      seen.add(e.seriesId);
      return true;
    });
}

function trendScore(db: DB, ev: BpopEvent) {
  const sold = liveTickets(db, ev.id).length;
  const days = Math.max(0.5, (new Date(ev.startsAt).getTime() - now()) / 86400e3);
  return (ev.pageViews + sold * 6) / Math.pow(days + 2, 0.6) + (ev.sponsored ? 1e6 : 0);
}

// ---------------------------------------------------------------- pricing

function kickbackCommission(offer: KickbackOffer, order: Pick<Order, 'items' | 'subtotal' | 'discount' | 'total'>): number {
  if (order.total <= 0) return 0;
  // free tickets never earn commission, and promo discounts shrink the base
  const eligible = order.items.filter((i) => i.unitPrice > 0 && (!offer.ticketTypeIds || offer.ticketTypeIds.includes(i.ticketTypeId)));
  const qty = eligible.reduce((a, i) => a + i.qty, 0);
  if (!qty) return 0;
  const gross = eligible.reduce((a, i) => a + i.unitPrice * i.qty, 0);
  const base = order.subtotal > 0 ? gross - (order.discount * gross) / order.subtotal : 0;
  const raw = offer.kind === 'percent' ? Math.round((base * offer.value) / 100) : offer.per === 'ticket' ? offer.value * qty : offer.value;
  return Math.max(0, Math.min(raw, order.subtotal - order.discount));
}

function buildQuote(db: DB, ev: BpopEvent, cart: CartLine[], promoCode: string | undefined, user: User | null, waitlistEntryId?: ID, password?: string): CheckoutQuote {
  const empty: CheckoutQuote = { items: [], subtotal: 0, fees: 0, discount: 0, total: 0 };
  if (ev.status === 'draft') return { ...empty, error: 'This is a draft event.' };
  if (ev.status === 'cancelled') return { ...empty, error: 'This event was cancelled.' };
  if (ended(ev)) return { ...empty, error: 'This event has ended.' };
  if (cart.some((l) => !Number.isInteger(l.qty) || l.qty < 0)) return { ...empty, error: 'Invalid ticket quantity.' };
  const merged = new Map<ID, number>();
  for (const l of cart) if (l.qty > 0) merged.set(l.ticketTypeId, (merged.get(l.ticketTypeId) ?? 0) + l.qty);
  const lines = [...merged].map(([ticketTypeId, qty]) => ({ ticketTypeId, qty }));
  if (!lines.length) return { ...empty, error: 'Select at least one ticket.' };

  const entry = waitlistEntryId ? db.waitlist.find((w) => w.id === waitlistEntryId) : undefined;
  if (waitlistEntryId) {
    if (!entry || entry.status !== 'offered' || (user && entry.userId !== user.id)) return { ...empty, error: 'This waitlist offer is no longer available.' };
    if (lines.length !== 1 || lines[0]!.ticketTypeId !== entry.ticketTypeId || lines[0]!.qty > entry.qty) return { ...empty, error: `Your offer covers ${entry.qty} ticket(s) of one type.` };
  }

  const items: OrderItem[] = [];
  for (const l of lines) {
    const tt = ev.ticketTypes.find((t) => t.id === l.ticketTypeId);
    if (!tt) return { ...empty, error: 'Ticket type not found.' };
    if (tt.inPersonOnly) return { ...empty, error: `${tt.name} is only sold at the door.` };
    if (tt.hidden) return { ...empty, error: `${tt.name} isn’t available online.` };
    if (tt.password && tt.password !== password?.trim()) return { ...empty, error: `${tt.name} is password protected.` };
    if (tt.salesStart && new Date(tt.salesStart).getTime() > now()) return { ...empty, error: `Sales for ${tt.name} haven’t started yet.` };
    if (tt.salesEnd && new Date(tt.salesEnd).getTime() < now()) return { ...empty, error: `Sales have ended for ${tt.name}.` };
    if (!entry) {
      if (tt.markedSoldOut || remaining(tt) <= 0) return { ...empty, error: `${tt.name} is sold out.` };
      if (remaining(tt) < l.qty) return { ...empty, error: `Only ${remaining(tt)} ${tt.name} left.` };
    }
    if (l.qty < tt.minPerOrder) return { ...empty, error: `Minimum ${tt.minPerOrder} × ${tt.name} per order.` };
    if (tt.maxPerOrder !== null && l.qty > tt.maxPerOrder) return { ...empty, error: `Maximum ${tt.maxPerOrder} × ${tt.name} per order.` };
    items.push({ ticketTypeId: tt.id, name: tt.name, qty: l.qty, unitPrice: tt.price, unitFee: serviceFee(tt.price) });
  }

  if (ev.rsvpOnly) {
    const qty = items.reduce((a, i) => a + i.qty, 0);
    if (qty > 1) return { ...empty, error: 'Each account can RSVP once.' };
    if (user && liveTickets(db, ev.id).some((t) => t.ownerId === user.id)) return { ...empty, error: 'You’ve already RSVP’d to this event.' };
  }

  const subtotal = items.reduce((a, i) => a + i.unitPrice * i.qty, 0);
  const fees = items.reduce((a, i) => a + i.unitFee * i.qty, 0);
  let discount = 0;
  let promo;
  if (promoCode?.trim()) {
    promo = ev.promoCodes.find((p) => p.code.toLowerCase() === promoCode.trim().toLowerCase());
    if (!promo || !promo.active) return { items, subtotal, fees, discount: 0, total: subtotal + fees, error: 'That promo code isn’t valid.' };
    const code = promo.code;
    const reserved = db.orders.filter((o) => o.eventId === ev.id && o.promoCode === code && (o.status === 'pending_payment' || o.status === 'pending_approval')).length;
    if (promo.limit !== null && promo.uses + reserved >= promo.limit) return { items, subtotal, fees, discount: 0, total: subtotal + fees, error: 'That promo code has reached its limit.' };
    const eligible = items.filter((i) => !promo!.ticketTypeIds || promo!.ticketTypeIds.includes(i.ticketTypeId)).reduce((a, i) => a + i.unitPrice * i.qty, 0);
    if (!eligible) return { items, subtotal, fees, discount: 0, total: subtotal + fees, error: 'That promo code doesn’t apply to these tickets.' };
    discount = promo.kind === 'percent' ? Math.round((eligible * promo.value) / 100) : Math.min(promo.value, eligible);
  }
  return { items, subtotal, fees, discount, total: Math.max(0, subtotal + fees - discount), promo };
}

function issueTickets(db: DB, order: Order, opts: { comp?: boolean; checkedIn?: boolean } = {}): Ticket[] {
  const out: Ticket[] = [];
  for (const it of order.items) {
    for (let i = 0; i < it.qty; i++) {
      const t: Ticket = {
        id: uid('tk'),
        code: shortCode(),
        orderId: order.id,
        eventId: order.eventId,
        ticketTypeId: it.ticketTypeId,
        ownerId: order.userId,
        qrNonce: nonce(),
        status: opts.checkedIn ? 'checked_in' : 'valid',
        checkedInAt: opts.checkedIn ? nowIso() : undefined,
        checkedInBy: opts.checkedIn ? 'Door sale' : undefined,
        isComp: !!opts.comp,
        revokedNonces: [],
        revokedCodes: [],
        originOrderId: order.id,
        createdAt: nowIso(),
      };
      db.tickets.push(t);
      out.push(t);
    }
  }
  return out;
}

function finalizeOrder(db: DB, order: Order) {
  const ev = findEvent(db, order.eventId);
  order.status = 'paid';
  order.paidAt = nowIso();
  order.holdExpiresAt = undefined;
  if (order.promoCode) {
    const p = ev.promoCodes.find((x) => x.code === order.promoCode);
    if (p) p.uses += 1;
  }
  if (order.kickbackCode) {
    const link = db.kickbackLinks.find((k) => k.code === order.kickbackCode);
    const offer = link && ev.kickbackOffers.find((o) => o.id === link.offerId && o.enabled);
    if (link && offer && link.userId !== order.userId) {
      order.kickbackCommission = kickbackCommission(offer, order);
      if (order.kickbackCommission > 0) notify(db, link.userId, { kind: 'kickback', title: `You earned ${tk(order.kickbackCommission)} 💸`, body: `Someone bought tickets to ${ev.title} with your link.`, link: '/kickbacks' });
    }
  }
  const entry = db.waitlist.find((w) => w.orderId === order.id);
  if (entry) entry.status = 'claimed';
  const tickets = issueTickets(db, order);
  const qty = tickets.length;
  notify(db, order.userId, { kind: 'order', title: `You’re going to ${ev.title} 🎉`, body: `${qty} ticket${qty > 1 ? 's' : ''} added to My tickets.`, link: `/orders/${order.id}` });
  sms(db, order.buyer.phone, `Dekha Hobe: you're going to ${ev.title}! Order ${order.number}. Your QR tickets are in the app.`);
}

function nextOrderNumber(db: DB) {
  const max = db.orders.reduce((m, o) => Math.max(m, Number(o.number.slice(3)) || 0), 41000);
  return `BP-${max + 1}`;
}

function ensureUserForPhone(db: DB, phone: string, name?: string): User {
  const p = normalizePhone(phone) ?? fail('Enter a valid Bangladeshi mobile number.');
  const existing = userByPhone(db, p);
  if (existing) return existing;
  const u: User = {
    id: uid('u'),
    name: name?.trim() || 'Guest',
    username: `guest${Math.floor(Math.random() * 1e6)}`,
    phone: p,
    avatarHue: Math.floor(Math.random() * 360),
    city: 'Dhaka',
    following: [],
    friends: [],
    saved: [],
    blocked: [],
    smsOptIn: false,
    privateProfile: false,
    createdAt: nowIso(),
  };
  db.users.push(u);
  return u;
}

function ticketView(db: DB, t: Ticket): TicketView | null {
  const event = db.events.find((e) => e.id === t.eventId);
  const order = db.orders.find((o) => o.id === t.orderId);
  if (!event || !order) return null;
  const org = db.orgs.find((o) => o.id === event.orgId)!;
  const ticketType = event.ticketTypes.find((x) => x.id === t.ticketTypeId)!;
  return { ticket: t, event, org, ticketType, order };
}

const orderNet = (o: Order) => o.subtotal - o.discount - o.kickbackCommission - (o.refundedNet ?? 0);
/** Door sales are collected by the organizer directly, so they never enter the payout balance. */
const settlesToBalance = (o: Order) => o.source !== 'door';

const isLive = (t: Ticket) => t.status === 'valid' || t.status === 'checked_in';
/** Tickets the buyer of this order still holds. */
const heldTickets = (db: DB, o: Order) => db.tickets.filter((t) => t.orderId === o.id && isLive(t));
/** Tickets sold in this order that now belong to someone else (non-refundable). */
const transferredAway = (db: DB, o: Order) => db.tickets.filter((t) => t.originOrderId === o.id && t.orderId !== o.id && isLive(t));

/** Refund `count` tickets of an order; `active` is how many of its tickets were still live before. Returns the amount refunded. */
function refundTickets(o: Order, count: number, active: number): number {
  const qty = Math.max(1, o.items.reduce((a, i) => a + i.qty, 0));
  const amount = Math.round((o.total / qty) * count);
  o.refundedAmount = (o.refundedAmount ?? 0) + amount;
  o.refundedNet = (o.refundedNet ?? 0) + Math.round(((o.subtotal - o.discount) / qty) * count);
  o.kickbackCommission = active > 0 ? Math.max(0, Math.round(o.kickbackCommission * (1 - count / active))) : 0;
  return amount;
}

function seriesFor(orders: Order[], days = 30) {
  const map = new Map<string, { revenue: number; tickets: number }>();
  for (let i = days - 1; i >= 0; i--) map.set(dayKey(new Date(now() - i * 86400e3)), { revenue: 0, tickets: 0 });
  for (const o of orders) {
    const k = dayKey(o.paidAt ?? o.createdAt);
    const slot = map.get(k);
    if (slot) {
      slot.revenue += orderNet(o);
      slot.tickets += o.items.reduce((a, i) => a + i.qty, 0);
    }
  }
  return [...map.entries()].map(([k, v]) => {
    const [m, d] = k.split('/');
    return { date: `${m}/${d}`, ...v };
  });
}

function computeEventStats(db: DB, ev: BpopEvent): EventStats {
  const orders = db.orders.filter((o) => o.eventId === ev.id);
  const paid = orders.filter((o) => o.status === 'paid');
  const live = liveTickets(db, ev.id);
  const byType = ev.ticketTypes.map((tt) => {
    const sold = live.filter((t) => t.ticketTypeId === tt.id).length;
    const revenue = paid.reduce((a, o) => a + o.items.filter((i) => i.ticketTypeId === tt.id).reduce((b, i) => b + i.unitPrice * i.qty, 0), 0);
    return { ticketType: tt, sold, revenue };
  });
  const capacity = ev.ticketTypes.some((t) => t.quantity === null) ? null : ev.ticketTypes.reduce((a, t) => a + (t.quantity ?? 0), 0);
  return {
    revenue: paid.reduce((a, o) => a + orderNet(o), 0),
    gross: paid.reduce((a, o) => a + o.total, 0),
    fees: paid.reduce((a, o) => a + o.fees, 0),
    ticketsSold: live.length,
    capacity,
    checkedIn: live.filter((t) => t.status === 'checked_in').length,
    pageViews: ev.pageViews,
    conversion: ev.pageViews ? paid.filter((o) => o.source === 'online').length / ev.pageViews : 0,
    orders: paid.length,
    pendingApprovals: orders.filter((o) => o.status === 'pending_approval').length,
    waitlist: db.waitlist.filter((w) => w.eventId === ev.id && w.status === 'waiting').reduce((a, w) => a + w.qty, 0),
    byType,
    series: seriesFor(paid),
  };
}

function uniqueSlug(db: DB, base: string, ignoreId?: ID) {
  const root = slugify(base) || 'event';
  let s = root;
  let n = 2;
  while (db.events.some((e) => e.slug === s && e.id !== ignoreId)) s = `${root}-${n++}`;
  return s;
}

function newTier(partial: Partial<TicketType>, order: number): TicketType {
  return {
    id: uid('tt'),
    name: 'General Admission',
    price: 0,
    quantity: 100,
    sold: 0,
    minPerOrder: 1,
    maxPerOrder: 10,
    hidden: false,
    inPersonOnly: false,
    allowTransfers: true,
    markedSoldOut: false,
    requireApproval: false,
    waitlistEnabled: false,
    waitlistResponseMins: 30,
    waitlistMaxPerUser: null,
    heldForWaitlist: 0,
    order,
    ...partial,
  };
}

// ---------------------------------------------------------------- the adapter

export const localAdapter: ApiClient = {
  // ---------------- auth
  async sendOtp(phone) {
    await latency();
    return tx((db) => {
      const p = normalizePhone(phone) ?? fail('Enter a valid Bangladeshi mobile number (e.g. 01711-000000).');
      const code = String(Math.floor(100000 + Math.random() * 900000));
      db.otps[p] = { code, expiresAt: new Date(now() + OTP_MINUTES * 60e3).toISOString() };
      sms(db, p, `${code} is your Dekha Hobe verification code. It expires in ${OTP_MINUTES} minutes.`, { otp: true });
      return { sent: true as const };
    });
  },
  async verifyOtp(phone, code) {
    await latency();
    return tx((db) => {
      const p = normalizePhone(phone) ?? fail('Enter a valid Bangladeshi mobile number.');
      const otp = db.otps[p];
      if (!otp || otp.code !== code.trim()) fail('That code isn’t right. Check the SMS and try again.');
      if (new Date(otp!.expiresAt).getTime() < now()) fail('That code has expired. Request a new one.');
      delete db.otps[p];
      let user = userByPhone(db, p);
      let isNew = false;
      if (!user) {
        user = ensureUserForPhone(db, p, '');
        user.name = '';
        user.smsOptIn = true;
        isNew = true;
      } else if (!user.name || user.name === 'Guest') {
        isNew = true;
      }
      // pending transfers to this number now belong to this account
      for (const t of db.tickets) if (t.transfer && t.transfer.toPhone === p) t.transfer.toUserId = user.id;
      writeSession({ userId: user.id, scannerOrgId: null });
      return { user, isNew };
    });
  },
  async socialLogin(provider) {
    await latency();
    return tx((db) => {
      const email = `demo.${provider}@example.com`;
      let user = db.users.find((u) => u.email === email);
      let isNew = false;
      if (!user) {
        user = ensureUserForPhone(db, provider === 'google' ? '01300000001' : '01300000002', '');
        user.name = '';
        user.email = email;
        user.smsOptIn = true;
        isNew = true;
      } else if (!user.name) isNew = true;
      writeSession({ userId: user.id, scannerOrgId: null });
      return { user, isNew };
    });
  },
  async currentUser() {
    return view((db) => meOpt(db));
  },
  async updateProfile(patch) {
    await latency();
    return tx((db) => {
      const u = me(db);
      if (patch.username !== undefined) {
        const un = patch.username.trim().toLowerCase();
        if (!/^[a-z0-9_.]{3,20}$/.test(un)) fail('Usernames are 3–20 characters: letters, numbers, dots and underscores.');
        if (db.users.some((x) => x.username === un && x.id !== u.id)) fail('That username is taken.');
        patch.username = un;
      }
      if (patch.name !== undefined && !patch.name.trim()) fail('Please enter your name.');
      if (patch.avatarUrl) safeImage(patch.avatarUrl);
      Object.assign(u, patch);
      return u;
    });
  },
  async logout() {
    writeSession({ userId: null, scannerOrgId: null });
  },
  async deleteAccount() {
    await latency();
    tx((db) => {
      const u = me(db);
      u.name = 'Deleted user';
      u.username = `deleted${u.id.slice(-6)}`;
      u.phone = '';
      u.email = undefined;
      u.privateProfile = true;
      u.smsOptIn = false;
    });
    writeSession({ userId: null });
  },

  // ---------------- discovery
  async explore(f) {
    await latency();
    return view((db) => {
      const q = f.q?.trim().toLowerCase();
      const listed = db.events.filter(isListed);
      const filtered = listed.filter((ev) => {
        if (f.city && f.city !== 'All' && ev.venue.city !== f.city) return false;
        if (f.category && f.category !== 'All' && ev.category !== f.category) return false;
        if (!matchesDate(ev, f.date)) return false;
        if (q) {
          const org = db.orgs.find((o) => o.id === ev.orgId)!;
          const hay = [ev.title, ev.tagline, ev.venue.name, ev.venue.address, org.name, ev.category, ...ev.lineup.map((l) => l.name)].join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      const cards = collapseSeries(filtered).map((e) => toCard(db, e)).filter((c) => matchesPrice(c, f.price));
      const featured = cards.filter((c) => c.event.featured).sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt));
      const trending = [...cards].sort((a, b) => trendScore(db, b.event) - trendScore(db, a.event));
      return { featured, trending };
    });
  },
  async homeFeed() {
    await latency();
    return view((db) => {
      const listed = collapseSeries(db.events.filter(isListed));
      const featuredEv = listed.filter((e) => e.featured).sort((a, b) => trendScore(db, b) - trendScore(db, a))[0];
      const org = db.orgs[0]!;
      const spotlightEv = listed.find((e) => e.orgId === org.id);
      const radar = listed.filter((e) => e.id !== featuredEv?.id).sort((a, b) => trendScore(db, b) - trendScore(db, a)).slice(0, 8);
      const recap = db.events
        .filter((e) => e.status === 'published' && e.visibility === 'public' && ended(e))
        .sort((a, b) => b.endsAt.localeCompare(a.endsAt))
        .slice(0, 6);
      const art = listed.filter((e) => e.category === 'Arts & Fashion').slice(0, 3);
      return {
        featured: featuredEv ? toCard(db, featuredEv) : null,
        posters: listed.slice(0, 24),
        spotlight: spotlightEv ? { org, event: spotlightEv } : null,
        orgs: db.orgs,
        radar: radar.map((e) => toCard(db, e)),
        recap: recap.map((e) => toCard(db, e)),
        art: art.map((e) => toCard(db, e)),
      };
    });
  },
  async getEventBySlug(slug) {
    await latency();
    return view((db) => {
      const ev = db.events.find((e) => e.slug === slug);
      if (!ev) return null;
      if (ev.status === 'draft' && !roleFor(db, ev.orgId)) return null;
      const u = meOpt(db);
      const series = ev.seriesId ? db.events.filter((e) => e.seriesId === ev.seriesId && e.status === 'published').sort((a, b) => a.startsAt.localeCompare(b.startsAt)) : [];
      const holders = [...new Set(liveTickets(db, ev.id).map((t) => t.ownerId))].map((id) => userById(db, id)).filter((x): x is User => !!x && !x.privateProfile && x.name !== 'Guest');
      const friendsGoing = u ? holders.filter((h) => u.friends.includes(h.id)) : [];
      const guests = holders.filter((h) => !u?.blocked.includes(h.id)).slice(0, 60);
      return { card: toCard(db, ev), series, friendsGoing, guests };
    });
  },
  async getSeries(seriesId) {
    await latency();
    return view((db) => db.events.filter((e) => e.seriesId === seriesId && e.status === 'published').sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((e) => toCard(db, e)));
  },
  async getOrg(slug) {
    await latency();
    return view((db) => {
      const org = db.orgs.find((o) => o.slug === slug);
      if (!org) return null;
      const evs = db.events.filter((e) => e.orgId === org.id && e.status === 'published' && e.visibility === 'public');
      const upcoming = evs.filter((e) => !ended(e)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((e) => toCard(db, e));
      const past = evs.filter(ended).sort((a, b) => b.startsAt.localeCompare(a.startsAt)).map((e) => toCard(db, e));
      const attendees = new Set(db.tickets.filter((t) => evs.some((e) => e.id === t.eventId) && t.status !== 'cancelled' && t.status !== 'refunded').map((t) => t.ownerId)).size;
      const followers = db.users.filter((u) => u.following.includes(org.id)).length;
      return { org, upcoming, past, stats: { events: evs.length, attendees, followers } };
    });
  },
  async getUserProfile(username) {
    await latency();
    return view((db) => {
      const user = db.users.find((u) => u.username === username);
      if (!user) return null;
      const viewer = meOpt(db);
      if (user.privateProfile && viewer?.id !== user.id) return { user, going: [] };
      const evIds = new Set(db.tickets.filter((t) => t.ownerId === user.id && (t.status === 'valid' || t.status === 'checked_in')).map((t) => t.eventId));
      const going = db.events.filter((e) => evIds.has(e.id) && isListed(e)).map((e) => toCard(db, e));
      return { user, going };
    });
  },
  async platformStats() {
    await latency();
    return view((db) => {
      const live = db.tickets.filter((t) => t.status === 'valid' || t.status === 'checked_in');
      return {
        tickets: live.length,
        revenue: db.orders.filter((o) => o.status === 'paid').reduce((a, o) => a + orderNet(o), 0),
        organizers: db.orgs.length,
        events: db.events.filter((e) => e.status === 'published').length,
        orgs: db.orgs.map((org) => {
          const evs = db.events.filter((e) => e.orgId === org.id && e.status === 'published');
          const ids = new Set(evs.map((e) => e.id));
          return { org, events: evs.length, attendees: new Set(live.filter((t) => ids.has(t.eventId)).map((t) => t.ownerId)).size, cover: evs[0] };
        }),
      };
    });
  },
  async trackVisit(eventId, ref) {
    tx((db) => {
      const ev = db.events.find((e) => e.id === eventId);
      if (!ev) return;
      ev.pageViews += 1;
      if (ref?.kickback) {
        const l = db.kickbackLinks.find((k) => k.code === ref.kickback && k.eventId === eventId);
        if (l) l.visits += 1;
      }
      if (ref?.tracking) {
        const t = ev.trackingLinks.find((k) => k.slug === ref.tracking);
        if (t) t.visits += 1;
      }
    });
  },

  // ---------------- social
  async toggleFollowOrg(orgId) {
    await latency();
    return tx((db) => {
      const u = me(db);
      const i = u.following.indexOf(orgId);
      if (i >= 0) u.following.splice(i, 1);
      else u.following.push(orgId);
      return i < 0;
    });
  },
  async toggleFollowUser(userId) {
    await latency();
    return tx((db) => {
      const u = me(db);
      if (u.id === userId) fail('You can’t follow yourself.');
      const i = u.friends.indexOf(userId);
      if (i >= 0) u.friends.splice(i, 1);
      else u.friends.push(userId);
      return i < 0;
    });
  },
  async toggleSave(eventId) {
    await latency();
    return tx((db) => {
      const u = me(db);
      const i = u.saved.indexOf(eventId);
      if (i >= 0) u.saved.splice(i, 1);
      else u.saved.push(eventId);
      return i < 0;
    });
  },
  async blockUser(userId, block) {
    await latency();
    tx((db) => {
      const u = me(db);
      u.blocked = u.blocked.filter((x) => x !== userId);
      if (block) {
        u.blocked.push(userId);
        u.friends = u.friends.filter((x) => x !== userId);
      }
    });
  },
  async blockedUsers() {
    return view((db) => {
      const u = me(db);
      return db.users.filter((x) => u.blocked.includes(x.id));
    });
  },
  async savedEvents() {
    await latency();
    return view((db) => {
      const u = me(db);
      return db.events.filter((e) => u.saved.includes(e.id)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((e) => toCard(db, e));
    });
  },
  async canChat(eventId) {
    return view((db) => {
      const u = meOpt(db);
      if (!u) return false;
      const ev = db.events.find((e) => e.id === eventId);
      if (!ev?.chatEnabled) return false;
      return liveTickets(db, eventId).some((t) => t.ownerId === u.id) || !!roleFor(db, ev.orgId);
    });
  },
  async listMessages(eventId) {
    return view((db) => {
      const u = meOpt(db);
      return db.messages
        .filter((m) => m.eventId === eventId && !u?.blocked.includes(m.userId))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((m) => ({ ...m, user: userById(db, m.userId)! }))
        .filter((m) => m.user);
    });
  },
  async sendMessage(eventId, body) {
    await latency();
    return tx((db) => {
      const u = me(db);
      const ev = findEvent(db, eventId);
      if (!ev.chatEnabled) fail('Chat is turned off for this event.');
      if (!liveTickets(db, eventId).some((t) => t.ownerId === u.id) && !roleFor(db, ev.orgId)) fail('Only ticket holders can chat.');
      const text = body.trim().slice(0, 1000);
      if (!text) fail('Write a message first.');
      const m = { id: uid('msg'), eventId, userId: u.id, body: text, createdAt: nowIso() };
      db.messages.push(m);
      return m;
    });
  },

  // ---------------- checkout
  async unlockTickets(eventId, password) {
    await latency();
    return view((db) => {
      const ev = findEvent(db, eventId);
      const ids = ev.ticketTypes.filter((t) => t.password && t.password === password.trim()).map((t) => t.id);
      if (!ids.length) fail('Incorrect password.');
      return ids;
    });
  },
  async quote(eventId, cart, promo, password, waitlistEntryId) {
    return view((db) => buildQuote(db, findEvent(db, eventId), cart, promo, meOpt(db), waitlistEntryId, password));
  },
  async startCheckout(input) {
    await latency();
    return tx((db) => {
      const u = me(db);
      const ev = findEvent(db, input.eventId);
      const q = buildQuote(db, ev, input.cart, input.promo, u, input.waitlistEntryId, input.password);
      if (q.error) fail(q.error);
      const buyerPhone = normalizePhone(input.buyer.phone) ?? fail('Enter a valid mobile number for your tickets.');
      if (!input.buyer.name.trim()) fail('Enter the name for your tickets.');
      const needsApproval = q.items.some((i) => findTier(ev, i.ticketTypeId).requireApproval);
      const entry = input.waitlistEntryId ? db.waitlist.find((w) => w.id === input.waitlistEntryId) : undefined;

      // reserve seats
      for (const it of q.items) {
        const tt = findTier(ev, it.ticketTypeId);
        if (entry) tt.heldForWaitlist = Math.max(0, tt.heldForWaitlist - it.qty);
        tt.sold += it.qty;
      }

      let kickbackCode: string | undefined;
      if (input.kickback) {
        const link = db.kickbackLinks.find((k) => k.code === input.kickback && k.eventId === ev.id);
        if (link && link.userId !== u.id && ev.kickbackOffers.some((o) => o.id === link.offerId && o.enabled)) kickbackCode = link.code;
      }
      const tl = input.tracking ? ev.trackingLinks.find((t) => t.slug === input.tracking) : undefined;

      const order: Order = {
        id: uid('ord'),
        number: nextOrderNumber(db),
        eventId: ev.id,
        userId: u.id,
        buyer: { name: input.buyer.name.trim(), phone: buyerPhone, email: input.buyer.email?.trim() || undefined },
        items: q.items,
        subtotal: q.subtotal,
        fees: q.fees,
        discount: q.discount,
        total: q.total,
        promoCode: q.promo?.code,
        kickbackCode,
        kickbackCommission: 0,
        trackingSlug: tl?.slug,
        hostUserId: tl?.kind === 'host' ? tl.hostUserId : undefined,
        status: 'pending_payment',
        source: entry ? 'waitlist' : 'online',
        createdAt: nowIso(),
      };
      if (entry) {
        entry.status = 'claimed';
        entry.orderId = order.id;
      }
      db.orders.push(order);

      if (q.total === 0) {
        order.paymentMethod = 'free';
        if (needsApproval) order.status = 'pending_approval';
        else finalizeOrder(db, order);
      } else {
        order.holdExpiresAt = new Date(now() + HOLD_MINUTES * 60e3).toISOString();
      }
      return order;
    });
  },
  async payOrder(orderId, method, ref) {
    await sleep(500);
    return tx((db) => {
      const u = me(db);
      const o = db.orders.find((x) => x.id === orderId && x.userId === u.id) ?? fail('Order not found.');
      if (o.status === 'expired') fail('Your 15-minute hold expired and the tickets were released. Please start again.');
      if (o.status !== 'pending_payment') fail('This order has already been processed.');
      const ev = findEvent(db, o.eventId);
      if (o.promoCode && !ev.promoCodes.some((p) => p.code === o.promoCode && p.active)) fail('That promo code was turned off. Please start checkout again.');
      o.paymentMethod = method;
      o.paymentRef = ref;
      const needsApproval = o.items.some((i) => findTier(ev, i.ticketTypeId).requireApproval);
      if (needsApproval) {
        o.status = 'pending_approval';
        o.holdExpiresAt = undefined;
        notify(db, o.userId, { kind: 'order', title: 'Request sent to the organizer', body: `${ev.title}: you’ll be charged and get your tickets once approved.`, link: `/orders/${o.id}` });
      } else {
        finalizeOrder(db, o);
      }
      return o;
    });
  },
  async cancelPendingOrder(orderId) {
    await latency();
    tx((db) => {
      const u = me(db);
      const o = db.orders.find((x) => x.id === orderId && x.userId === u.id);
      if (!o || o.status !== 'pending_payment') return;
      o.status = 'cancelled';
      releaseOrder(db, o);
    });
  },
  async getOrder(orderId) {
    await latency();
    return view((db) => {
      const order = db.orders.find((o) => o.id === orderId);
      if (!order) return null;
      const u = meOpt(db);
      const event = db.events.find((e) => e.id === order.eventId)!;
      if (order.userId !== u?.id && !roleFor(db, event.orgId)) return null;
      const org = db.orgs.find((o) => o.id === event.orgId)!;
      return { order, event, org, tickets: db.tickets.filter((t) => t.orderId === order.id) };
    });
  },

  // ---------------- attendee tickets
  async myTickets() {
    await latency();
    return view((db) => {
      const u = me(db);
      return db.tickets
        .filter((t) => t.ownerId === u.id && t.status !== 'refunded')
        .map((t) => ticketView(db, t))
        .filter((x): x is TicketView => !!x)
        .sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt));
    });
  },
  async myOrders() {
    await latency();
    return view((db) => {
      const u = me(db);
      return db.orders
        .filter((o) => o.userId === u.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((order) => ({ order, event: db.events.find((e) => e.id === order.eventId)! }))
        .filter((x) => x.event);
    });
  },
  async getTicket(ticketId) {
    return view((db) => {
      const u = me(db);
      const t = db.tickets.find((x) => x.id === ticketId && x.ownerId === u.id);
      return t ? ticketView(db, t) : null;
    });
  },
  async startTransfer(ticketIds, toPhone) {
    await latency();
    tx((db) => {
      const u = me(db);
      const p = normalizePhone(toPhone) ?? fail('Enter a valid Bangladeshi mobile number.');
      if (p === u.phone) fail('You can’t transfer tickets to yourself.');
      if (!ticketIds.length) fail('Select at least one ticket.');
      const recipient = userByPhone(db, p);
      for (const id of ticketIds) {
        const t = db.tickets.find((x) => x.id === id && x.ownerId === u.id) ?? fail('Ticket not found.');
        const ev = findEvent(db, t.eventId);
        const tt = findTier(ev, t.ticketTypeId);
        if (t.isComp) fail('Complimentary tickets can’t be transferred.');
        if (!tt.allowTransfers) fail(`Transfers are turned off for ${tt.name}.`);
        if (t.status !== 'valid') fail('Only unused tickets can be transferred.');
        if (t.transfer) fail('This ticket already has a pending transfer.');
        if (ended(ev)) fail('This event has ended.');
        t.transfer = { toPhone: p, toUserId: recipient?.id, createdAt: nowIso() };
      }
      const ev = findEvent(db, db.tickets.find((x) => x.id === ticketIds[0])!.eventId);
      if (recipient) notify(db, recipient.id, { kind: 'transfer', title: `${u.name} sent you ${ticketIds.length} ticket${ticketIds.length > 1 ? 's' : ''}`, body: `${ev.title} — accept to add them to your tickets.`, link: '/tickets?tab=transfers' });
      sms(db, p, `Dekha Hobe: ${u.name} sent you ${ticketIds.length} ticket(s) to ${ev.title}. Log in with this number to accept.`);
    });
  },
  async cancelTransfer(ticketId) {
    await latency();
    tx((db) => {
      const u = me(db);
      const t = db.tickets.find((x) => x.id === ticketId && x.ownerId === u.id) ?? fail('Ticket not found.');
      if (!t.transfer) fail('No pending transfer on this ticket.');
      t.transfer = undefined;
    });
  },
  async incomingTransfers() {
    await latency();
    return view((db) => {
      const u = me(db);
      return db.tickets
        .filter((t) => t.transfer && (t.transfer.toUserId === u.id || t.transfer.toPhone === u.phone) && t.status === 'valid')
        .map((t) => ticketView(db, t))
        .filter((x): x is TicketView => !!x);
    });
  },
  async acceptTransfer(ticketId) {
    await latency();
    tx((db) => {
      const u = me(db);
      const t = db.tickets.find((x) => x.id === ticketId) ?? fail('Transfer not found.');
      if (!t.transfer || (t.transfer.toUserId !== u.id && t.transfer.toPhone !== u.phone)) fail('This transfer isn’t for you.');
      if (t.status !== 'valid') fail('This ticket is no longer valid.');
      const ev = findEvent(db, t.eventId);
      const tt = findTier(ev, t.ticketTypeId);
      const sender = userById(db, t.ownerId);
      const order: Order = {
        id: uid('ord'),
        number: nextOrderNumber(db),
        eventId: ev.id,
        userId: u.id,
        buyer: { name: u.name, phone: u.phone },
        items: [{ ticketTypeId: tt.id, name: tt.name, qty: 1, unitPrice: 0, unitFee: 0 }],
        subtotal: 0,
        fees: 0,
        discount: 0,
        total: 0,
        kickbackCommission: 0,
        status: 'paid',
        paymentMethod: 'free',
        source: 'transfer',
        createdAt: nowIso(),
        paidAt: nowIso(),
      };
      db.orders.push(order);
      t.originOrderId ??= t.orderId;
      t.revokedNonces.push(t.qrNonce); // the sender's QR now scans as "Canceled"
      t.revokedCodes = [...(t.revokedCodes ?? []), t.code]; // ...and so does the printed code
      t.qrNonce = nonce();
      t.code = shortCode();
      t.ownerId = u.id;
      t.orderId = order.id;
      t.transfer = undefined;
      if (sender) notify(db, sender.id, { kind: 'transfer', title: 'Transfer accepted', body: `${u.name} accepted your ${tt.name} ticket for ${ev.title}.`, link: '/tickets' });
    });
  },
  async declineTransfer(ticketId) {
    await latency();
    tx((db) => {
      const u = me(db);
      const t = db.tickets.find((x) => x.id === ticketId) ?? fail('Transfer not found.');
      if (!t.transfer || (t.transfer.toUserId !== u.id && t.transfer.toPhone !== u.phone)) fail('This transfer isn’t for you.');
      t.transfer = undefined;
      notify(db, t.ownerId, { kind: 'transfer', title: 'Transfer declined', body: `${u.name} declined your ticket transfer.`, link: '/tickets' });
    });
  },
  async requestRefund(orderId) {
    await latency();
    tx((db) => {
      const u = me(db);
      const o = db.orders.find((x) => x.id === orderId && x.userId === u.id) ?? fail('Order not found.');
      if (o.source === 'transfer') fail('Transferred tickets are non-refundable.');
      if (o.status !== 'paid') fail('Only paid orders can be refunded.');
      if (o.total === 0) fail('Free orders don’t need a refund — just cancel your RSVP.');
      if (!heldTickets(db, o).length) fail('Transferred tickets are non-refundable.');
      o.refundRequested = true;
      const ev = findEvent(db, o.eventId);
      const org = findOrg(db, ev.orgId);
      for (const m of org.team.filter((t) => MANAGERS.includes(t.role))) notify(db, m.userId, { kind: 'order', title: 'Refund requested', body: `${o.buyer.name} requested a refund for ${o.number} (${ev.title}).`, link: `/dashboard/events/${ev.id}/orders` });
    });
  },
  async returnToWaitlist(ticketId) {
    await latency();
    tx((db) => {
      const u = me(db);
      const t = db.tickets.find((x) => x.id === ticketId && x.ownerId === u.id) ?? fail('Ticket not found.');
      const ev = findEvent(db, t.eventId);
      const tt = findTier(ev, t.ticketTypeId);
      if (t.isComp) fail('Complimentary tickets can’t be returned.');
      if (t.status !== 'valid' || t.transfer) fail('Only unused tickets can be returned.');
      if (!tt.waitlistEnabled) fail('This ticket type doesn’t have a waitlist.');
      const order = db.orders.find((o) => o.id === t.orderId) ?? fail('Order not found.');
      if (order.source === 'transfer') fail('Transferred tickets are non-refundable, so they can’t be returned.');
      if (order.source === 'comp') fail('Complimentary tickets can’t be returned.');
      if (!hasWaiting(db, tt.id)) fail('Nobody is on the waitlist right now — try again later.');
      if (ended(ev)) fail('This event has ended.');
      const active = heldTickets(db, order).length + transferredAway(db, order).length;
      t.status = 'refunded';
      t.returnedToWaitlist = true;
      t.transfer = undefined;
      const amount = order.status === 'paid' && order.total > 0 ? refundTickets(order, 1, active) : 0;
      if (order.status === 'paid' && !heldTickets(db, order).length && !transferredAway(db, order).length) order.status = 'refunded';
      releaseSeats(db, ev, tt, 1);
      notify(db, u.id, { kind: 'order', title: 'Ticket returned to the waitlist', body: amount > 0 ? `${tk(amount)} for your ${tt.name} ticket is on its way back to your ${order.paymentMethod}.` : `Your ${tt.name} ticket was released to the waitlist.`, link: '/tickets' });
    });
  },
  async joinWaitlist(eventId, ticketTypeId, qty) {
    await latency();
    return tx((db) => {
      const u = me(db);
      const ev = findEvent(db, eventId);
      const tt = findTier(ev, ticketTypeId);
      if (ev.status !== 'published') fail('This is a draft event.');
      if (ended(ev)) fail('This event has ended.');
      if (!tt.waitlistEnabled) fail('This ticket type doesn’t have a waitlist.');
      if (tt.markedSoldOut || !soldOut(tt)) fail('Tickets are still available — grab one now.');
      if (tt.waitlistMaxPerUser !== null && qty > tt.waitlistMaxPerUser) fail(`You can request up to ${tt.waitlistMaxPerUser} ticket(s).`);
      if (qty < 1) fail('Choose how many tickets you want.');
      if (db.waitlist.some((w) => w.ticketTypeId === tt.id && w.userId === u.id && (w.status === 'waiting' || w.status === 'offered'))) fail('You’re already on this waitlist.');
      const entry = { id: uid('wl'), eventId, ticketTypeId, userId: u.id, qty, status: 'waiting' as const, createdAt: nowIso() };
      db.waitlist.push(entry);
      processWaitlist(db, ev, tt);
      return db.waitlist.find((w) => w.id === entry.id)!;
    });
  },
  async leaveWaitlist(entryId) {
    await latency();
    tx((db) => {
      const u = me(db);
      const w = db.waitlist.find((x) => x.id === entryId && x.userId === u.id) ?? fail('Not found.');
      const wasOffered = w.status === 'offered';
      w.status = 'left';
      if (wasOffered) {
        const ev = findEvent(db, w.eventId);
        processWaitlist(db, ev, findTier(ev, w.ticketTypeId));
      }
    });
  },
  async myWaitlist() {
    await latency();
    return view((db) => {
      const u = me(db);
      return db.waitlist
        .filter((w) => w.userId === u.id && (w.status === 'waiting' || w.status === 'offered'))
        .map((w) => {
          const event = db.events.find((e) => e.id === w.eventId)!;
          return { ...w, event, ticketType: event.ticketTypes.find((t) => t.id === w.ticketTypeId)! };
        });
    });
  },
  async myKickbacks() {
    await latency();
    return view((db) => {
      const u = me(db);
      const links = db.kickbackLinks
        .filter((l) => l.userId === u.id)
        .map((l) => {
          const event = db.events.find((e) => e.id === l.eventId)!;
          const offer = event.kickbackOffers.find((o) => o.id === l.offerId)!;
          const orders = db.orders.filter((o) => o.kickbackCode === l.code && o.status === 'paid');
          return { ...l, event, offer, orders: orders.length, earned: orders.reduce((a, o) => a + o.kickbackCommission, 0) };
        })
        .filter((l) => l.event && l.offer);
      return { links, total: links.reduce((a, l) => a + l.earned, 0) };
    });
  },
  async getOrCreateKickbackLink(eventId) {
    await latency();
    return tx((db) => {
      const u = me(db);
      const ev = findEvent(db, eventId);
      const enabled = ev.kickbackOffers.filter((o) => o.enabled);
      // an invited affiliate earns their private rate; everyone else gets the public offer
      const offer = enabled.find((o) => !o.isPublic && o.affiliateIds.includes(u.id)) ?? enabled.find((o) => o.isPublic);
      if (!offer) return null;
      const existing = db.kickbackLinks.find((l) => l.eventId === eventId && l.userId === u.id && l.offerId === offer.id);
      if (existing) return existing;
      let code = '';
      do code = `${(u.username || 'DEKHA').replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase()}${Math.floor(10 + Math.random() * 89)}`;
      while (db.kickbackLinks.some((l) => l.code === code));
      const link: KickbackLink = { code, eventId, offerId: offer.id, userId: u.id, visits: 0, createdAt: nowIso() };
      db.kickbackLinks.push(link);
      return link;
    });
  },
  async notifications() {
    return view((db) => {
      const u = meOpt(db);
      if (!u) return [];
      return db.notifications.filter((n) => n.userId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  },
  async markNotificationsRead() {
    tx((db) => {
      const u = meOpt(db);
      if (u) for (const n of db.notifications) if (n.userId === u.id) n.read = true;
    });
  },
  async smsOutbox() {
    return view((db) => [...db.outbox].reverse());
  },

  // ---------------- organizer
  async myOrgs() {
    await latency();
    return view((db) => {
      const u = meOpt(db);
      if (!u) return [];
      return db.orgs.flatMap((org) => {
        const m = org.team.find((t) => t.userId === u.id);
        return m ? [{ org, role: m.role }] : [];
      });
    });
  },
  async createOrg(input) {
    await latency();
    return tx((db) => {
      const u = me(db);
      if (!input.name.trim()) fail('Give your organization a name.');
      let slug = slugify(input.name) || 'org';
      let n = 2;
      while (db.orgs.some((o) => o.slug === slug)) slug = `${slugify(input.name)}-${n++}`;
      const org: Organization = {
        id: uid('org'),
        slug,
        name: input.name.trim(),
        bio: input.bio?.trim() ?? '',
        city: input.city,
        instagram: input.instagram?.replace(/^@/, ''),
        avatarHue: Math.floor(Math.random() * 360),
        bannerSeed: Math.floor(Math.random() * 1000),
        verified: false,
        team: [{ userId: u.id, role: 'owner', addedAt: nowIso() }],
        scannerPins: [],
        payoutMethods: [],
        createdAt: nowIso(),
      };
      db.orgs.push(org);
      return org;
    });
  },
  async updateOrg(orgId, patch) {
    await latency();
    return tx((db) => {
      const role = requireRole(db, orgId, MANAGERS);
      const org = findOrg(db, orgId);
      const next: Partial<Organization> = {};
      for (const k of ORG_PROFILE_FIELDS) if (k in patch) (next as Record<string, unknown>)[k] = patch[k];
      if ('payoutMethods' in patch) {
        if (role !== 'owner') fail('Only an owner can change payout accounts.');
        next.payoutMethods = patch.payoutMethods;
      }
      if (next.name !== undefined && !next.name.trim()) fail('Give your organization a name.');
      if (next.website && !/^https?:\/\/\S+$/i.test(next.website)) fail('Website must start with http:// or https://');
      if (next.instagram !== undefined) next.instagram = next.instagram?.replace(/^@/, '').replace(/[^A-Za-z0-9._]/g, '') || undefined;
      if (next.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.contactEmail)) fail('Enter a valid contact email.');
      if (next.avatarUrl) safeImage(next.avatarUrl);
      if (next.slug !== undefined && next.slug !== org.slug) {
        const s = slugify(next.slug ?? '');
        if (!s || db.orgs.some((o) => o.slug === s && o.id !== orgId)) fail('That URL is taken.');
        next.slug = s;
      }
      Object.assign(org, next);
      return org;
    });
  },
  async orgEvents(orgId) {
    await latency();
    return view((db) => {
      requireRole(db, orgId, ['owner', 'admin', 'host', 'doorperson', 'scanner']);
      return db.events
        .filter((e) => e.orgId === orgId)
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
        .map((event) => ({ event, stats: computeEventStats(db, event) }));
    });
  },
  async orgStats(orgId) {
    await latency();
    return view((db): OrgStats => {
      requireRole(db, orgId, ['owner', 'admin', 'host']);
      const evs = db.events.filter((e) => e.orgId === orgId);
      const ids = new Set(evs.map((e) => e.id));
      const orders = db.orders.filter((o) => ids.has(o.eventId));
      const paid = orders.filter((o) => o.status === 'paid');
      const revenue = paid.reduce((a, o) => a + orderNet(o), 0);
      const payable = paid.filter(settlesToBalance).reduce((a, o) => a + orderNet(o), 0);
      const paidOut = db.payouts.filter((p) => p.orgId === orgId).reduce((a, p) => a + p.amount + p.fee, 0);
      const tickets = db.tickets.filter((t) => ids.has(t.eventId) && (t.status === 'valid' || t.status === 'checked_in'));
      const pageViews = evs.reduce((a, e) => a + e.pageViews, 0);
      return {
        revenue,
        ticketsSold: tickets.length,
        orders: paid.length,
        pageViews,
        conversion: pageViews ? paid.filter((o) => o.source === 'online').length / pageViews : 0,
        attendees: new Set(tickets.map((t) => t.ownerId)).size,
        followers: db.users.filter((u) => u.following.includes(orgId)).length,
        balance: Math.max(0, payable - paidOut),
        doorCollected: paid.filter((o) => !settlesToBalance(o)).reduce((a, o) => a + o.total, 0),
        pendingBalance: orders.filter((o) => o.status === 'pending_approval').reduce((a, o) => a + orderNet(o), 0),
        series: seriesFor(paid),
        topEvents: evs
          .map((event) => {
            const p = paid.filter((o) => o.eventId === event.id);
            return { event, revenue: p.reduce((a, o) => a + orderNet(o), 0), tickets: tickets.filter((t) => t.eventId === event.id).length };
          })
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5),
      };
    });
  },
  async createEvent(orgId, input) {
    await latency();
    return tx((db) => {
      requireRole(db, orgId, MANAGERS);
      if (input.poster?.imageUrl) safeImage(input.poster.imageUrl);
      const title = input.title?.trim() || 'Untitled event';
      const start = input.startsAt ?? new Date(now() + 7 * 86400e3).toISOString();
      const ev: BpopEvent = {
        id: uid('ev'),
        slug: uniqueSlug(db, input.slug || title),
        orgId,
        title,
        tagline: input.tagline,
        description: input.description ?? '',
        category: input.category ?? 'Nightlife',
        venue: input.venue ?? { name: 'Venue TBA', address: 'Dhaka', city: 'Dhaka', lat: 23.78, lng: 90.4 },
        startsAt: start,
        endsAt: input.endsAt ?? new Date(new Date(start).getTime() + 4 * 3600e3).toISOString(),
        poster: input.poster ?? { seed: Math.floor(Math.random() * 1e4), style: 'gradient', hues: [300, 20] },
        lineup: input.lineup ?? [],
        status: input.status ?? 'draft',
        visibility: input.visibility ?? 'public',
        rsvpOnly: input.rsvpOnly ?? false,
        ageLimit: input.ageLimit,
        featured: false,
        pageViews: 0,
        ticketTypes: (input.ticketTypes ?? [newTier({}, 0)]).map((t, i) => newTier({ ...t, id: t.id ?? uid('tt'), sold: 0, heldForWaitlist: 0 }, i)),
        ticketGroups: input.ticketGroups ?? [],
        promoCodes: [],
        kickbackOffers: [],
        trackingLinks: [],
        guestList: [],
        showGuestlist: input.showGuestlist ?? true,
        chatEnabled: input.chatEnabled ?? true,
        createdAt: nowIso(),
      };
      if (new Date(ev.endsAt) <= new Date(ev.startsAt)) fail('The event must end after it starts.');
      db.events.push(ev);
      // followers hear about newly published events
      if (ev.status === 'published') {
        const org = findOrg(db, orgId);
        for (const f of db.users.filter((u) => u.following.includes(orgId))) notify(db, f.id, { kind: 'follow', title: `${org.name} posted a new event`, body: ev.title, link: `/e/${ev.slug}` });
      }
      return ev;
    });
  },
  async updateEvent(eventId, patch) {
    await latency();
    return tx((db) => {
      const ev = findEvent(db, eventId);
      for (const k of ['id', 'orgId', 'featured', 'sponsored', 'pageViews', 'createdAt', 'seriesId'] as const) delete patch[k];
      if (patch.poster?.imageUrl) safeImage(patch.poster.imageUrl);
      const keys = Object.keys(patch);
      const doorOnly = keys.length > 0 && keys.every((k) => k === 'guestList');
      requireRole(db, ev.orgId, doorOnly ? DOOR : MANAGERS);
      const wasDraft = ev.status === 'draft';
      if (patch.slug !== undefined) patch.slug = uniqueSlug(db, patch.slug, ev.id);
      if (patch.ticketTypes) {
        // keep live counters authoritative; never let the editor overwrite them
        patch.ticketTypes = patch.ticketTypes.map((t, i) => {
          const prev = ev.ticketTypes.find((x) => x.id === t.id);
          const merged = newTier({ ...t, sold: prev?.sold ?? 0, heldForWaitlist: prev?.heldForWaitlist ?? 0 }, i);
          if (merged.quantity !== null && merged.quantity < 1) fail('Ticket quantity must be at least 1 (leave blank for unlimited).');
          if (merged.quantity !== null && merged.quantity < merged.sold) fail(`${merged.name}: quantity can’t be lower than the ${merged.sold} already sold.`);
          if (merged.password) merged.hidden = false; // password ⇒ hide is implied
          if (merged.markedSoldOut) merged.waitlistEnabled = false; // "Mark as sold out" disables the waitlist
          return merged;
        });
        for (const prev of ev.ticketTypes) if (prev.sold > 0 && !patch.ticketTypes.some((t) => t.id === prev.id)) fail(`${prev.name} has sales and can’t be deleted — hide it instead.`);
      }
      if (patch.kickbackOffers) {
        if (patch.kickbackOffers.filter((o) => o.isPublic && o.enabled).length > 1) fail('Only one public Kickback offer can be active per event. Disable the current one first.');
      }
      Object.assign(ev, patch);
      if (new Date(ev.endsAt) <= new Date(ev.startsAt)) fail('The event must end after it starts.');
      for (const tt of ev.ticketTypes) processWaitlist(db, ev, tt);
      if (wasDraft && ev.status === 'published') {
        const org = findOrg(db, ev.orgId);
        for (const f of db.users.filter((u) => u.following.includes(ev.orgId))) notify(db, f.id, { kind: 'follow', title: `${org.name} posted a new event`, body: ev.title, link: `/e/${ev.slug}` });
      }
      return ev;
    });
  },
  async duplicateEvent(eventId) {
    await latency();
    return tx((db) => {
      const src = findEvent(db, eventId);
      requireRole(db, src.orgId, MANAGERS);
      const shift = 7 * 86400e3;
      const ev: BpopEvent = {
        ...structuredClone(src),
        id: uid('ev'),
        slug: uniqueSlug(db, `${src.title} copy`),
        title: `${src.title} (copy)`,
        status: 'draft',
        featured: false,
        pageViews: 0,
        startsAt: new Date(Math.max(new Date(src.startsAt).getTime(), now()) + shift).toISOString(),
        endsAt: new Date(Math.max(new Date(src.endsAt).getTime(), now() + (new Date(src.endsAt).getTime() - new Date(src.startsAt).getTime())) + shift).toISOString(),
        guestList: [],
        createdAt: nowIso(),
      };
      const tierIds = new Map<ID, ID>();
      ev.ticketTypes = ev.ticketTypes.map((t) => {
        const id = uid('tt');
        tierIds.set(t.id, id);
        return { ...t, id, sold: 0, heldForWaitlist: 0, markedSoldOut: false };
      });
      const remap = (ids: ID[] | null) => (ids === null ? null : ids.map((x) => tierIds.get(x)).filter((x): x is ID => !!x));
      ev.promoCodes = ev.promoCodes.map((p) => ({ ...p, id: uid('pc'), uses: 0, ticketTypeIds: remap(p.ticketTypeIds) }));
      ev.kickbackOffers = ev.kickbackOffers.map((o) => ({ ...o, id: uid('kb'), ticketTypeIds: remap(o.ticketTypeIds) }));
      ev.trackingLinks = ev.trackingLinks.map((t) => ({ ...t, id: uid('tl'), visits: 0 }));
      db.events.push(ev);
      return ev;
    });
  },
  async cancelEvent(eventId) {
    await latency();
    tx((db) => {
      const ev = findEvent(db, eventId);
      requireRole(db, ev.orgId, MANAGERS);
      ev.status = 'cancelled';
      for (const o of db.orders.filter((x) => x.eventId === ev.id)) {
        if (o.status === 'paid' || o.status === 'pending_approval') {
          const due = o.total - (o.refundedAmount ?? 0);
          o.status = 'refunded';
          o.refundedAmount = o.total;
          notify(db, o.userId, { kind: 'order', title: `${ev.title} was cancelled`, body: due > 0 ? `Your ${tk(due)} will be refunded to your ${o.paymentMethod}.` : 'Your RSVP was cancelled.', link: `/orders/${o.id}` });
        } else if (o.status === 'pending_payment') o.status = 'cancelled';
      }
      for (const t of db.tickets.filter((x) => x.eventId === ev.id)) if (t.status === 'valid') {
        t.status = 'refunded';
        t.transfer = undefined;
      }
      for (const w of db.waitlist.filter((x) => x.eventId === ev.id)) if (w.status === 'waiting' || w.status === 'offered') w.status = 'expired';
    });
  },
  async deleteDraft(eventId) {
    await latency();
    tx((db) => {
      const ev = findEvent(db, eventId);
      requireRole(db, ev.orgId, MANAGERS);
      if (ev.status !== 'draft') fail('Only drafts can be deleted. Cancel published events instead.');
      if (db.orders.some((o) => o.eventId === ev.id)) fail('This draft has orders and can’t be deleted.');
      db.events = db.events.filter((e) => e.id !== ev.id);
    });
  },
  async eventById(eventId) {
    return view((db) => {
      const ev = db.events.find((e) => e.id === eventId);
      if (!ev || !roleFor(db, ev.orgId)) return null;
      return ev;
    });
  },
  async eventStats(eventId) {
    await latency();
    return view((db) => {
      const ev = findEvent(db, eventId);
      requireRole(db, ev.orgId, ['owner', 'admin', 'host', 'doorperson', 'scanner']);
      return computeEventStats(db, ev);
    });
  },
  async eventOrders(eventId) {
    await latency();
    return view((db) => {
      const ev = findEvent(db, eventId);
      requireRole(db, ev.orgId, ['owner', 'admin', 'host']);
      return db.orders.filter((o) => o.eventId === eventId && o.status !== 'expired' && o.status !== 'cancelled').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  },
  async eventAttendees(eventId) {
    await latency();
    return view((db) => {
      const ev = findEvent(db, eventId);
      requireRole(db, ev.orgId, ['owner', 'admin', 'host', 'doorperson', 'scanner']);
      return db.tickets
        .filter((t) => t.eventId === eventId && t.status !== 'refunded')
        .map((ticket) => {
          const order = db.orders.find((o) => o.id === ticket.orderId)!;
          return { ticket, user: userById(db, ticket.ownerId)!, ticketType: ev.ticketTypes.find((x) => x.id === ticket.ticketTypeId)!, order, viaWaitlist: order?.source === 'waitlist' };
        })
        .filter((r) => r.user && r.order && r.ticketType)
        .sort((a, b) => a.user.name.localeCompare(b.user.name));
    });
  },
  async approveOrder(orderId, approve) {
    await latency();
    tx((db) => {
      const o = db.orders.find((x) => x.id === orderId) ?? fail('Order not found.');
      const ev = findEvent(db, o.eventId);
      requireRole(db, ev.orgId, MANAGERS);
      if (o.status !== 'pending_approval') fail('This order isn’t waiting for approval.');
      if (approve) finalizeOrder(db, o);
      else {
        o.status = 'declined';
        releaseOrder(db, o);
        notify(db, o.userId, { kind: 'order', title: 'Request not approved', body: `The organizer of ${ev.title} couldn’t approve your request. You haven’t been charged.`, link: `/e/${ev.slug}` });
      }
    });
  },
  async refundOrder(orderId) {
    await latency();
    tx((db) => {
      const o = db.orders.find((x) => x.id === orderId) ?? fail('Order not found.');
      const ev = findEvent(db, o.eventId);
      requireRole(db, ev.orgId, MANAGERS);
      if (o.status !== 'paid') fail('Only paid orders can be refunded.');
      const held = heldTickets(db, o);
      const away = transferredAway(db, o);
      if (!held.length) fail(away.length ? 'Every ticket in this order was transferred — transferred tickets are non-refundable.' : 'This order has no tickets left to refund.');
      const amount = refundTickets(o, held.length, held.length + away.length);
      o.refundRequested = false;
      if (!away.length) o.status = 'refunded';
      for (const t of held) {
        const wasValid = t.status === 'valid';
        t.status = 'refunded';
        t.transfer = undefined;
        if (wasValid) releaseSeats(db, ev, findTier(ev, t.ticketTypeId), 1);
      }
      const note = away.length ? ` ${away.length} transferred ticket${away.length > 1 ? 's were' : ' was'} not refunded.` : '';
      notify(db, o.userId, { kind: 'order', title: 'Refund issued', body: amount > 0 ? `${tk(amount)} for ${ev.title} is on its way back to your ${o.paymentMethod}.${note}` : `Your RSVP to ${ev.title} was cancelled.`, link: `/orders/${o.id}` });
    });
  },
  async sendComps(eventId, input) {
    await latency();
    return tx((db) => {
      const ev = findEvent(db, eventId);
      requireRole(db, ev.orgId, MANAGERS);
      const tt = findTier(ev, input.ticketTypeId);
      if (!Number.isInteger(input.qty) || input.qty < 1 || input.qty > 50) fail('Send between 1 and 50 complimentary tickets.');
      const user = ensureUserForPhone(db, input.phone, input.name);
      tt.sold += input.qty;
      const order: Order = {
        id: uid('ord'),
        number: nextOrderNumber(db),
        eventId,
        userId: user.id,
        buyer: { name: input.name?.trim() || user.name, phone: user.phone },
        items: [{ ticketTypeId: tt.id, name: tt.name, qty: input.qty, unitPrice: 0, unitFee: 0 }],
        subtotal: 0,
        fees: 0,
        discount: 0,
        total: 0,
        kickbackCommission: 0,
        status: 'paid',
        paymentMethod: 'comp',
        source: 'comp',
        createdAt: nowIso(),
        paidAt: nowIso(),
      };
      db.orders.push(order);
      const tickets = issueTickets(db, order, { comp: true });
      notify(db, user.id, { kind: 'order', title: `You’ve been comped to ${ev.title} 🎁`, body: `${input.qty} × ${tt.name} — no action needed.`, link: '/tickets' });
      sms(db, user.phone, `Dekha Hobe: you've received ${input.qty} complimentary ticket(s) to ${ev.title}. They're in your account.`);
      return tickets;
    });
  },
  async cancelComp(ticketId) {
    await latency();
    tx((db) => {
      const t = db.tickets.find((x) => x.id === ticketId) ?? fail('Ticket not found.');
      const ev = findEvent(db, t.eventId);
      requireRole(db, ev.orgId, MANAGERS);
      if (!t.isComp) fail('Only complimentary tickets can be cancelled here.');
      if (t.status === 'cancelled') return;
      const wasValid = t.status === 'valid';
      t.status = 'cancelled';
      if (wasValid) releaseSeats(db, ev, findTier(ev, t.ticketTypeId), 1);
    });
  },
  async doorSale(eventId, input) {
    await latency();
    return tx((db) => {
      const ev = findEvent(db, eventId);
      requireRole(db, ev.orgId, DOOR);
      const tt = findTier(ev, input.ticketTypeId);
      if (ev.status !== 'published') fail('Publish the event before selling at the door.');
      if (!Number.isInteger(input.qty) || input.qty < 1) fail('Choose a quantity.');
      if (remaining(tt) < input.qty) fail(remaining(tt) <= 0 ? `${tt.name} is sold out.` : `Only ${remaining(tt)} left.`);
      if (!input.name.trim()) fail('Enter the guest’s name.');
      const user = input.phone ? ensureUserForPhone(db, input.phone, input.name) : ensureUserForPhone(db, `017${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`, input.name);
      tt.sold += input.qty;
      const order: Order = {
        id: uid('ord'),
        number: nextOrderNumber(db),
        eventId,
        userId: user.id,
        buyer: { name: input.name.trim(), phone: user.phone },
        items: [{ ticketTypeId: tt.id, name: tt.name, qty: input.qty, unitPrice: tt.price, unitFee: 0 }],
        subtotal: tt.price * input.qty,
        fees: 0,
        discount: 0,
        total: tt.price * input.qty,
        kickbackCommission: 0,
        status: 'paid',
        paymentMethod: input.method,
        paymentRef: input.method === 'cash' ? 'CASH' : `BK${Math.floor(Math.random() * 1e9)}`,
        source: 'door',
        createdAt: nowIso(),
        paidAt: nowIso(),
      };
      db.orders.push(order);
      return issueTickets(db, order, { checkedIn: true });
    });
  },
  async scanTicket(eventId, payload, scannedBy): Promise<ScanResult> {
    await latency();
    return tx((db): ScanResult => {
      const ev = findEvent(db, eventId);
      requireRole(db, ev.orgId, DOOR);
      const raw = payload.trim();
      let ticket: Ticket | undefined;
      let presentedNonce: string | undefined;
      const m = raw.match(/^BPOP:([^:]+):([0-9a-f-]{36})$/i);
      if (m) {
        ticket = db.tickets.find((t) => t.id === m[1]);
        presentedNonce = m[2];
      } else {
        const codeIn = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
        ticket = db.tickets.find((t) => t.code.replace('-', '') === codeIn);
        if (!ticket) {
          const old = db.tickets.find((t) => t.revokedCodes?.some((c) => c.replace('-', '') === codeIn));
          if (old) return old.eventId === eventId ? { status: 'cancelled', ticket: old } : { status: 'wrong_event' };
        }
      }
      if (!ticket) return { status: 'invalid' };
      if (ticket.eventId !== eventId) return { status: 'wrong_event' };
      if (presentedNonce && ticket.revokedNonces.includes(presentedNonce)) return { status: 'cancelled', ticket };
      if (presentedNonce && presentedNonce !== ticket.qrNonce) return { status: 'invalid' };
      if (ticket.status === 'cancelled' || ticket.status === 'refunded') return { status: 'cancelled', ticket };
      const holder = userById(db, ticket.ownerId)!;
      const ticketType = findTier(ev, ticket.ticketTypeId);
      if (ticket.status === 'checked_in') return { status: 'already', ticket, holder, ticketType };
      ticket.status = 'checked_in';
      ticket.checkedInAt = nowIso();
      ticket.checkedInBy = scannedBy;
      ticket.transfer = undefined;
      return { status: 'ok', ticket, holder, ticketType };
    });
  },
  async undoCheckIn(ticketId) {
    await latency();
    tx((db) => {
      const t = db.tickets.find((x) => x.id === ticketId) ?? fail('Ticket not found.');
      requireRole(db, findEvent(db, t.eventId).orgId, DOOR);
      if (t.status === 'checked_in') {
        t.status = 'valid';
        t.checkedInAt = undefined;
        t.checkedInBy = undefined;
      }
    });
  },
  async waitlistFor(eventId) {
    await latency();
    return view((db) => {
      const ev = findEvent(db, eventId);
      requireRole(db, ev.orgId, ['owner', 'admin', 'host']);
      return db.waitlist
        .filter((w) => w.eventId === eventId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((w) => ({ ...w, user: userById(db, w.userId)! }))
        .filter((w) => w.user);
    });
  },
  async releaseToWaitlist(eventId, ticketTypeId, qty) {
    await latency();
    return tx((db) => {
      const ev = findEvent(db, eventId);
      requireRole(db, ev.orgId, MANAGERS);
      const tt = findTier(ev, ticketTypeId);
      if (!tt.waitlistEnabled) fail('Turn on the waitlist for this ticket type first.');
      if (qty < 1) fail('Release at least one ticket.');
      const demand = db.waitlist.filter((w) => w.ticketTypeId === tt.id && w.status === 'waiting').reduce((a, w) => a + w.qty, 0);
      const n = Math.min(qty, demand); // unmatched tickets are not released publicly
      if (!n) fail('Nobody is waiting for this ticket type.');
      if (tt.quantity !== null) tt.quantity += n;
      tt.heldForWaitlist += n;
      processWaitlist(db, ev, tt);
      return n;
    });
  },
  async kickbackLedger(eventId) {
    await latency();
    return view((db) => {
      const ev = findEvent(db, eventId);
      requireRole(db, ev.orgId, ['owner', 'admin', 'host']);
      const links = db.kickbackLinks
        .filter((l) => l.eventId === eventId)
        .map((l) => {
          const orders = db.orders.filter((o) => o.kickbackCode === l.code && o.status === 'paid');
          return {
            ...l,
            user: userById(db, l.userId)!,
            orders: orders.length,
            tickets: orders.reduce((a, o) => a + o.items.reduce((b, i) => b + i.qty, 0), 0),
            gmv: orders.reduce((a, o) => a + o.total, 0),
            commission: orders.reduce((a, o) => a + o.kickbackCommission, 0),
          };
        })
        .filter((l) => l.user)
        .sort((a, b) => b.gmv - a.gmv);
      return { links };
    });
  },
  async trackingStats(eventId) {
    await latency();
    return view((db) => {
      const ev = findEvent(db, eventId);
      requireRole(db, ev.orgId, ['owner', 'admin', 'host']);
      return ev.trackingLinks.map((link) => {
        const orders = db.orders.filter((o) => o.eventId === eventId && o.trackingSlug === link.slug && o.status === 'paid');
        return { link, orders: orders.length, tickets: orders.reduce((a, o) => a + o.items.reduce((b, i) => b + i.qty, 0), 0), revenue: orders.reduce((a, o) => a + orderNet(o), 0) };
      });
    });
  },
  async addAffiliate(eventId, offerId, phone) {
    await latency();
    tx((db) => {
      const ev = findEvent(db, eventId);
      requireRole(db, ev.orgId, MANAGERS);
      const offer = ev.kickbackOffers.find((o) => o.id === offerId) ?? fail('Offer not found.');
      if (offer.isPublic) fail('Public offers are open to anyone — affiliates are only for private offers.');
      const u = ensureUserForPhone(db, phone);
      if (!offer.affiliateIds.includes(u.id)) offer.affiliateIds.push(u.id);
      notify(db, u.id, { kind: 'kickback', title: 'You’re invited to earn Kickbacks', body: `Share ${ev.title} and earn ${offer.kind === 'percent' ? `${offer.value}%` : tk(offer.value)} per ${offer.per}.`, link: `/e/${ev.slug}` });
      sms(db, u.phone, `Dekha Hobe: you've been invited to promote ${ev.title} and earn Kickbacks.`);
    });
  },
  async smsAudienceSize(orgId, audience, eventId) {
    return view((db) => {
      requireRole(db, orgId, MANAGERS);
      return audienceFor(db, orgId, audience, eventId).length;
    });
  },
  async sendSmsBlast(orgId, input) {
    await latency();
    return tx((db) => {
      requireRole(db, orgId, MANAGERS);
      const body = input.body.trim();
      if (!body) fail('Write your message first.');
      if (body.length > 320) fail('SMS blasts can be up to 320 characters.');
      if (input.audience === 'event_attendees' && !input.eventId) fail('Choose an event.');
      const org = findOrg(db, orgId);
      const recipients = audienceFor(db, orgId, input.audience, input.eventId);
      for (const u of recipients) {
        sms(db, u.phone, `${org.name}: ${body} Reply STOP to opt out.`);
        notify(db, u.id, { kind: 'sms', title: org.name, body, link: `/g/${org.slug}` });
      }
      const blast = { id: uid('sms'), orgId, eventId: input.eventId, audience: input.audience, body, recipients: recipients.length, createdAt: nowIso() };
      db.smsBlasts.push(blast);
      return blast;
    });
  },
  async smsBlasts(orgId) {
    return view((db) => {
      requireRole(db, orgId, MANAGERS);
      return db.smsBlasts.filter((b) => b.orgId === orgId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  },
  async payouts(orgId) {
    await latency();
    return view((db) => {
      requireRole(db, orgId, MANAGERS);
      return db.payouts.filter((p) => p.orgId === orgId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  },
  async requestPayout(orgId, amount, instant) {
    await sleep(400);
    return tx((db) => {
      requireRole(db, orgId, ['owner']);
      const org = findOrg(db, orgId);
      const method = org.payoutMethods.find((m) => m.primary) ?? org.payoutMethods[0] ?? fail('Add a bKash, Nagad or bank account first.');
      const evIds = new Set(db.events.filter((e) => e.orgId === orgId).map((e) => e.id));
      const revenue = db.orders.filter((o) => evIds.has(o.eventId) && o.status === 'paid' && settlesToBalance(o)).reduce((a, o) => a + orderNet(o), 0);
      const paidOut = db.payouts.filter((p) => p.orgId === orgId).reduce((a, p) => a + p.amount + p.fee, 0);
      const balance = revenue - paidOut;
      const fee = instant ? Math.max(10, Math.round(amount * 0.015)) : 0;
      if (amount < 100) fail('The minimum payout is ৳100.');
      if (amount + fee > balance) fail(`You can withdraw up to ${tk(Math.max(0, balance - (instant ? Math.max(10, Math.round(balance * 0.015)) : 0)))}.`);
      const p = { id: uid('po'), orgId, amount: Math.round(amount), fee, instant, methodLabel: method.label, status: instant ? ('paid' as const) : ('processing' as const), createdAt: nowIso() };
      db.payouts.push(p);
      return p;
    });
  },
  async addTeamMember(orgId, phone, role) {
    await latency();
    tx((db) => {
      const actor = requireRole(db, orgId, MANAGERS);
      const org = findOrg(db, orgId);
      const u = ensureUserForPhone(db, phone);
      const existing = org.team.find((t) => t.userId === u.id);
      if ((role === 'owner' || existing?.role === 'owner') && actor !== 'owner') fail('Only an owner can add or change owners.');
      if (existing?.role === 'owner' && role !== 'owner' && org.team.filter((t) => t.role === 'owner').length === 1) fail('An organization needs at least one owner.');
      if (existing) existing.role = role;
      else org.team.push({ userId: u.id, role, addedAt: nowIso() });
      if (role === 'host') {
        for (const ev of db.events.filter((e) => e.orgId === orgId && !ended(e))) {
          if (!ev.trackingLinks.some((t) => t.hostUserId === u.id)) ev.trackingLinks.push({ id: uid('tl'), slug: `host-${u.username}`, kind: 'host', hostUserId: u.id, visits: 0, createdAt: nowIso() });
        }
      }
      notify(db, u.id, { kind: 'system', title: `You were added to ${org.name}`, body: `Role: ${role}.`, link: '/dashboard' });
    });
  },
  async removeTeamMember(orgId, userId) {
    await latency();
    tx((db) => {
      const actor = requireRole(db, orgId, MANAGERS);
      const org = findOrg(db, orgId);
      const target = org.team.find((t) => t.userId === userId);
      if (!target) return;
      if (target.role === 'owner' && actor !== 'owner') fail('Only an owner can remove an owner.');
      if (target.role === 'owner' && org.team.filter((t) => t.role === 'owner').length === 1) fail('An organization needs at least one owner.');
      org.team = org.team.filter((t) => t.userId !== userId);
    });
  },
  async createScannerPin(orgId, label) {
    await latency();
    return tx((db) => {
      requireRole(db, orgId, MANAGERS);
      const org = findOrg(db, orgId);
      let pin = '';
      do pin = String(Math.floor(100000 + Math.random() * 900000));
      while (db.orgs.some((o) => o.scannerPins.some((p) => p.pin === pin)));
      const p = { pin, secret: shortCode(6).toLowerCase(), label: label.trim() || 'Door', createdAt: nowIso() };
      org.scannerPins.push(p);
      return p;
    });
  },
  async deleteScannerPin(orgId, pin) {
    await latency();
    tx((db) => {
      requireRole(db, orgId, MANAGERS);
      const org = findOrg(db, orgId);
      org.scannerPins = org.scannerPins.filter((p) => p.pin !== pin);
    });
    const s = readSession();
    if (s.scannerOrgId === orgId && !readDb().orgs.find((o) => o.id === orgId)?.scannerPins.length) writeSession({ ...s, scannerOrgId: null });
  },
  async scannerLogin(pin) {
    await latency();
    return view((db) => {
      const org = db.orgs.find((o) => o.scannerPins.some((p) => p.pin === pin.trim())) ?? fail('That scanner PIN isn’t valid.');
      writeSession({ ...readSession(), scannerOrgId: org.id });
      const events = db.events.filter((e) => e.orgId === org.id && e.status === 'published' && new Date(e.endsAt).getTime() > now() - 86400e3).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      return { org, events };
    });
  },
  async orgFollowers(orgId) {
    await latency();
    return view((db) => {
      requireRole(db, orgId, ['owner', 'admin', 'host']);
      return db.users.filter((u) => u.following.includes(orgId));
    });
  },
  async teamMembers(orgId) {
    return view((db) => {
      requireRole(db, orgId, ['owner', 'admin', 'host', 'doorperson']);
      return findOrg(db, orgId).team.flatMap((member) => {
        const user = userById(db, member.userId);
        return user ? [{ member, user }] : [];
      });
    });
  },
  async askAi(orgId, question) {
    await sleep(500);
    return view((db) => {
      requireRole(db, orgId, ['owner', 'admin', 'host']);
      return answer(db, orgId, question);
    });
  },

  async resetDemo() {
    resetDb();
    writeSession({ userId: null, scannerOrgId: null });
  },
};

function audienceFor(db: DB, orgId: ID, audience: 'all_attendees' | 'event_attendees' | 'followers', eventId?: ID): User[] {
  const evIds = new Set(db.events.filter((e) => e.orgId === orgId && (!eventId || audience !== 'event_attendees' || e.id === eventId)).map((e) => e.id));
  let ids: Set<string>;
  if (audience === 'followers') ids = new Set(db.users.filter((u) => u.following.includes(orgId)).map((u) => u.id));
  else ids = new Set(db.tickets.filter((t) => evIds.has(t.eventId) && !t.isComp && t.status !== 'refunded' && t.status !== 'cancelled').map((t) => t.ownerId)); // comps don't enter SMS consent
  return db.users.filter((u) => ids.has(u.id) && u.smsOptIn && u.phone);
}

/** "Ask Dekha Hobe AI" — answers from the organization's own data, no external API. */
function answer(db: DB, orgId: ID, question: string): string {
  const q = question.toLowerCase();
  const evs = db.events.filter((e) => e.orgId === orgId);
  const stats = evs.map((e) => ({ e, s: computeEventStats(db, e) }));
  const total = stats.reduce((a, x) => a + x.s.revenue, 0);
  const tickets = stats.reduce((a, x) => a + x.s.ticketsSold, 0);
  const upcoming = stats.filter((x) => !ended(x.e) && x.e.status === 'published').sort((a, b) => a.e.startsAt.localeCompare(b.e.startsAt));
  const best = [...stats].sort((a, b) => b.s.revenue - a.s.revenue)[0];
  if (!evs.length) return 'You haven’t created any events yet. Create one and I’ll start tracking performance.';
  if (/(best|top|most).*(event)|which event/.test(q) && best)
    return `Your top event by revenue is **${best.e.title}** with ${tk(best.s.revenue)} from ${best.s.ticketsSold} tickets (${(best.s.conversion * 100).toFixed(1)}% page-view conversion).`;
  if (/kickback|promoter|affiliate|ambassador/.test(q)) {
    const links = db.kickbackLinks.filter((l) => evs.some((e) => e.id === l.eventId));
    const rows = links.map((l) => ({ l, o: db.orders.filter((o) => o.kickbackCode === l.code && o.status === 'paid') })).sort((a, b) => b.o.length - a.o.length);
    if (!rows.length) return 'No Kickback links yet. Turn on a public Kickback offer in Marketing so buyers can promote your events.';
    const top = rows[0]!;
    const u = userById(db, top.l.userId);
    const sales = rows.reduce((a, r) => a + r.o.reduce((b, o) => b + o.total, 0), 0);
    return `Kickback affiliates drove ${tk(sales)} in sales across ${rows.reduce((a, r) => a + r.o.length, 0)} orders. Your top promoter is **${u?.name ?? 'unknown'}** (${top.l.code}) with ${top.o.length} orders.`;
  }
  if (/conversion|views|traffic/.test(q)) {
    const views = stats.reduce((a, x) => a + x.s.pageViews, 0);
    const orders = stats.reduce((a, x) => a + x.s.orders, 0);
    return `Your event pages got ${views.toLocaleString()} views and ${orders} orders — a ${views ? ((orders / views) * 100).toFixed(1) : 0}% conversion rate. Instagram and Facebook-ads tracking links show where the traffic came from.`;
  }
  if (/waitlist|sold out|sell out/.test(q)) {
    const w = stats.filter((x) => x.s.waitlist > 0);
    if (!w.length) return 'Nobody is on a waitlist right now.';
    return `${w.map((x) => `**${x.e.title}**: ${x.s.waitlist} waiting`).join(', ')}. Use "Release tickets" on the ticket type to offer seats to them first.`;
  }
  if (/next|upcoming|coming up/.test(q)) {
    const n = upcoming[0];
    if (!n) return 'You have no upcoming published events.';
    const cap = n.s.capacity ? ` of ${n.s.capacity}` : '';
    return `Next up: **${n.e.title}** on ${new Date(n.e.startsAt).toDateString()} — ${n.s.ticketsSold}${cap} tickets sold, ${tk(n.s.revenue)} earned.`;
  }
  if (/refund/.test(q)) {
    const refunded = db.orders.filter((o) => evs.some((e) => e.id === o.eventId) && o.status === 'refunded');
    const requested = db.orders.filter((o) => evs.some((e) => e.id === o.eventId) && o.refundRequested && o.status === 'paid');
    return `${refunded.length} orders have been refunded and ${requested.length} refund request(s) are waiting for you in Orders.`;
  }
  return `Across ${evs.length} events you’ve earned ${tk(total)} from ${tickets} tickets. ${upcoming.length} upcoming event(s). Try asking “which event performed best?”, “how are my kickbacks doing?” or “what’s my conversion rate?”.`;
}
