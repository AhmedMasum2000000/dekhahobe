import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CalendarPlus, Clock, Copy, Instagram, Lock, Mail, MapPin, MessageCircle, Share2, Sparkles, Ticket as TicketIcon } from 'lucide-react';
import { api, type BpopEvent, type TicketType } from '@/api';
import { useApi } from '@/hooks/useApi';
import { PosterArt } from '@/components/PosterArt';
import { SaveButton } from '@/components/EventCard';
import { Avatar, AvatarStack, Badge, Countdown, Empty, Modal, PageSpinner, RichText, Stepper, Verified, ViewMore } from '@/components/ui';
import { displayPrice, downloadFile, icsFor, longRange, monthDay, timeLabel, tk, weekday } from '@/lib/util';
import { useSession } from '@/store/session';
import { useCheckout } from '@/store/checkout';
import { toast } from '@/store/toast';

export function MapPreview({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  // a stylised (offline) map: deterministic streets around the pin
  const seed = Math.abs(Math.round(lat * 1000 + lng * 1000));
  const lines = Array.from({ length: 9 }, (_, i) => ((seed * (i + 3)) % 97) / 97);
  return (
    <a href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-3xl border border-line" aria-label={`Open ${label} in Google Maps`}>
      <svg viewBox="0 0 600 260" className="h-48 w-full bg-[#F3F4F1] sm:h-56">
        <rect x="380" y="0" width="220" height="90" fill="#E3EEDC" />
        <path d={`M0 ${200 + lines[0]! * 40} C 200 ${170 + lines[1]! * 40}, 400 ${230 - lines[2]! * 40}, 600 ${190 + lines[3]! * 30}`} stroke="#CFE3F1" strokeWidth="26" fill="none" />
        {lines.map((l, i) => (
          <line key={i} x1={i % 2 ? 0 : l * 600} y1={i % 2 ? l * 260 : 0} x2={i % 2 ? 600 : l * 600 + 60} y2={i % 2 ? l * 260 + 30 : 260} stroke="#fff" strokeWidth={i % 3 ? 6 : 12} />
        ))}
        <g transform="translate(300 118)">
          <circle r="34" fill="#E6007E" opacity=".15" />
          <path d="M0 -26c-10 0-18 8-18 18 0 13 18 30 18 30s18-17 18-30c0-10-8-18-18-18z" fill="#E6007E" />
          <circle cy="-8" r="6" fill="#fff" />
        </g>
      </svg>
    </a>
  );
}

function tierState(tt: TicketType, ev: BpopEvent) {
  const now = Date.now();
  const left = tt.quantity === null ? Infinity : tt.quantity - tt.sold - tt.heldForWaitlist;
  if (tt.inPersonOnly) return { kind: 'door' as const, label: 'At the door only' };
  if (tt.salesStart && new Date(tt.salesStart).getTime() > now) return { kind: 'soon' as const, label: `On sale ${monthDay(tt.salesStart)}` };
  if (tt.salesEnd && new Date(tt.salesEnd).getTime() < now) return { kind: 'ended' as const, label: 'Sales ended' };
  if (tt.markedSoldOut || left <= 0) return { kind: tt.waitlistEnabled && !tt.markedSoldOut ? ('waitlist' as const) : ('soldout' as const), label: 'Sold out' };
  if (new Date(ev.endsAt).getTime() < now) return { kind: 'ended' as const, label: 'Ended' };
  return { kind: 'open' as const, label: left < 20 ? `${left} left` : '', left };
}

function TicketSheet({ ev, open, onClose, preferredTier }: { ev: BpopEvent; open: boolean; onClose: () => void; preferredTier?: string }) {
  const nav = useNavigate();
  const user = useSession((s) => s.user);
  const { refs, unlocked, unlock, setDraft } = useCheckout();
  const ref = refs[ev.id] ?? {};
  const unlockedIds = unlocked[ev.id]?.ids ?? [];
  const [qty, setQty] = useState<Record<string, number>>({});
  const [promo, setPromo] = useState(ref.promo ?? '');
  const [promoOpen, setPromoOpen] = useState(!!ref.promo);
  const [pw, setPw] = useState('');
  const [waitFor, setWaitFor] = useState<TicketType | null>(null);
  const [waitQty, setWaitQty] = useState(1);
  const cart = Object.entries(qty).filter(([, q]) => q > 0).map(([ticketTypeId, q]) => ({ ticketTypeId, qty: q }));
  const cartKey = JSON.stringify(cart) + promo;
  const { data: quote } = useApi(() => (cart.length ? api.quote(ev.id, cart, promo || undefined, unlocked[ev.id]?.password) : Promise.resolve(null)), [cartKey, open], { live: false });

  useEffect(() => {
    if (open && preferredTier && !qty[preferredTier]) setQty({ [preferredTier]: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preferredTier]);

  const tiers = ev.ticketTypes
    .filter((t) => !t.hidden && (!t.password || unlockedIds.includes(t.id)))
    .sort((a, b) => a.order - b.order);
  const locked = ev.ticketTypes.some((t) => t.password && !unlockedIds.includes(t.id));
  const groups = [...ev.ticketGroups].sort((a, b) => a.order - b.order).filter((g) => !g.hidden);
  const ungrouped = tiers.filter((t) => !t.groupId || !groups.some((g) => g.id === t.groupId));

  const go = () => {
    if (!user) return nav(`/login?next=${encodeURIComponent(`/e/${ev.slug}`)}`);
    setDraft({ eventId: ev.id, slug: ev.slug, cart, promo: quote?.promo ? promo : undefined, password: unlocked[ev.id]?.password, kickback: ref.kickback, tracking: ref.tracking });
    nav(`/e/${ev.slug}/checkout`);
  };

  const row = (tt: TicketType) => {
    const st = tierState(tt, ev);
    const q = qty[tt.id] ?? 0;
    const maxSel = Math.min(tt.maxPerOrder ?? 20, st.kind === 'open' ? st.left ?? 20 : 0, ev.rsvpOnly ? 1 : 99);
    return (
      <div key={tt.id} className="flex items-start justify-between gap-3 border-b border-line py-4 last:border-0" data-testid="tier">
        <div className="min-w-0">
          <p className="font-semibold">{tt.name} {tt.password && <Badge tone="brand"><Lock className="h-3 w-3" />Unlocked</Badge>}</p>
          <p className="text-[15px] font-semibold text-ink-2">{tt.price === 0 ? 'Free' : tk(displayPrice(tt.price))}{tt.price > 0 && <span className="ml-1 text-xs font-normal text-ink-4">incl. fees</span>}</p>
          {tt.description && <p className="mt-1 text-[13px] text-ink-3">{tt.description}</p>}
          {tt.requireApproval && <p className="mt-1 text-[12px] font-semibold text-warn">Requires organizer approval</p>}
          {st.label && st.kind === 'open' && <p className="mt-1 text-[12px] font-semibold text-brand-dark">{st.label}</p>}
        </div>
        <div className="shrink-0">
          {st.kind === 'open' ? (
            <Stepper value={q} min={0} max={maxSel} onChange={(n) => setQty((x) => ({ ...(ev.rsvpOnly ? {} : x), [tt.id]: n < tt.minPerOrder && n > 0 && n > q ? tt.minPerOrder : n < tt.minPerOrder ? 0 : n }))} />
          ) : st.kind === 'waitlist' ? (
            <button className="btn btn-outline btn-sm" onClick={() => (user ? setWaitFor(tt) : nav('/login'))} data-testid="join-waitlist">Join waitlist</button>
          ) : (
            <Badge tone={st.kind === 'door' ? 'neutral' : 'bad'}>{st.label}</Badge>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Modal
        open={open && !waitFor}
        onClose={onClose}
        title={ev.rsvpOnly ? 'RSVP' : 'Tickets'}
        footer={
          <div className="space-y-3">
            {quote && quote.items.length > 0 && (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-ink-3"><span>Subtotal</span><span>{tk(quote.subtotal)}</span></div>
                {quote.fees > 0 && <div className="flex justify-between text-ink-3"><span>Service fees</span><span>{tk(quote.fees)}</span></div>}
                {quote.discount > 0 && <div className="flex justify-between text-ok"><span>Promo {quote.promo?.code}</span><span>−{tk(quote.discount)}</span></div>}
                <div className="flex justify-between text-base font-bold"><span>Total</span><span data-testid="sheet-total">{tk(quote.total)}</span></div>
              </div>
            )}
            {quote?.error && <p className="text-sm font-medium text-bad">{quote.error}</p>}
            <button className="btn btn-primary btn-lg w-full" disabled={!cart.length || !!(quote?.error && !/promo/i.test(quote.error))} onClick={go} data-testid="checkout-btn">
              {ev.rsvpOnly || quote?.total === 0 ? 'Continue' : 'Checkout'}
            </button>
          </div>
        }
      >
        {groups.map((g) => {
          const ts = tiers.filter((t) => t.groupId === g.id);
          if (!ts.length) return null;
          return (
            <div key={g.id} className="mb-2">
              <p className="mt-2 text-xs font-bold uppercase tracking-wider text-ink-3">{g.name}</p>
              {ts.map(row)}
            </div>
          );
        })}
        {ungrouped.map(row)}
        {tiers.length === 0 && <p className="py-6 text-center text-sm text-ink-3">This event has hidden tickets.</p>}
        {locked && (
          <form
            className="mt-3 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const ids = await api.unlockTickets(ev.id, pw);
                unlock(ev.id, ids, pw.trim());
                toast.success('Hidden tickets unlocked');
                setPw('');
              } catch (err) {
                toast.error(err);
              }
            }}
          >
            <input className="input" placeholder="Have a password?" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Ticket password" />
            <button className="btn btn-outline btn-md h-11" disabled={!pw}>Unlock</button>
          </form>
        )}
        {!ev.rsvpOnly && ev.promoCodes.length > 0 && (
          <div className="mt-3">
            {promoOpen ? (
              <input className="input" placeholder="Promo code" value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} aria-label="Promo code" data-testid="promo-input" />
            ) : (
              <button className="text-sm font-semibold underline underline-offset-4" onClick={() => setPromoOpen(true)}>Have a promo code?</button>
            )}
          </div>
        )}
      </Modal>
      <Modal
        open={!!waitFor}
        onClose={() => setWaitFor(null)}
        title="Join the waitlist"
        footer={
          <button
            className="btn btn-primary btn-lg w-full"
            data-testid="confirm-waitlist"
            onClick={async () => {
              try {
                await api.joinWaitlist(ev.id, waitFor!.id, waitQty);
                toast.success('You’re on the waitlist', 'We’ll text you if a ticket opens up.');
                setWaitFor(null);
                onClose();
              } catch (err) {
                toast.error(err);
              }
            }}
          >
            Join waitlist
          </button>
        }
      >
        {waitFor && (
          <div className="space-y-4">
            <p className="text-sm text-ink-2">
              <strong>{waitFor.name}</strong> is sold out. Join the queue — if a ticket opens up, you’ll get a text and have <strong>{waitFor.waitlistResponseMins} minutes</strong> to claim it. Joining doesn’t guarantee a ticket.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">How many tickets?</span>
              <Stepper value={waitQty} min={1} max={waitFor.waitlistMaxPerUser ?? 10} onChange={setWaitQty} />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function KickbackBanner({ ev }: { ev: BpopEvent }) {
  const user = useSession((s) => s.user);
  const nav = useNavigate();
  const offer = ev.kickbackOffers.find((o) => o.enabled && o.isPublic && o.showBanner);
  const [link, setLink] = useState<string | null>(null);
  if (!offer) return null;
  const rate = offer.kind === 'percent' ? `${offer.value}%` : tk(offer.value);
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-brand-soft p-4" data-testid="kickback-banner">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white"><Sparkles className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">Turn invites into income</p>
        <p className="text-[13px] text-ink-2">Invite friends, earn {rate} on {offer.per === 'order' ? 'the total order' : 'every ticket'}.</p>
        {link && <p className="mt-1 truncate text-[13px] font-semibold text-brand-dark" data-testid="kickback-link">{link}</p>}
      </div>
      <button
        className="btn btn-brand btn-sm"
        onClick={async () => {
          if (!user) return nav('/login');
          try {
            const l = await api.getOrCreateKickbackLink(ev.id);
            if (!l) return toast.error('Kickbacks aren’t available for this event.');
            const url = `${location.origin}${location.pathname}#/e/${ev.slug}?ref=${l.code}`;
            setLink(url);
            await navigator.clipboard?.writeText(url).catch(() => undefined);
            toast.success('Your Kickback link is copied', 'Share it — you earn when friends buy.');
          } catch (e) {
            toast.error(e);
          }
        }}
      >
        {link ? 'Copy again' : 'Get my link'}
      </button>
    </div>
  );
}

function Chat({ ev }: { ev: BpopEvent }) {
  const user = useSession((s) => s.user);
  const { data: can } = useApi(() => api.canChat(ev.id), [ev.id, user?.id]);
  const { data: msgs } = useApi(() => (can ? api.listMessages(ev.id) : Promise.resolve([])), [ev.id, can]);
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [msgs?.length]);
  if (!ev.chatEnabled) return null;
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-xl font-extrabold"><MessageCircle className="h-5 w-5" />Event chat</h2>
      {!can ? (
        <p className="rounded-2xl bg-mist p-4 text-sm text-ink-3">Get a ticket to join the conversation with other guests.</p>
      ) : (
        <div className="card overflow-hidden">
          <div className="max-h-80 space-y-3 overflow-y-auto p-4" data-testid="chat-list">
            {msgs?.length === 0 && <p className="text-sm text-ink-3">No messages yet — say hi 👋</p>}
            {msgs?.map((m) => (
              <div key={m.id} className={`flex gap-2 ${m.userId === user?.id ? 'flex-row-reverse' : ''}`}>
                <Avatar name={m.user.name} hue={m.user.avatarHue} url={m.user.avatarUrl} size={28} />
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.userId === user?.id ? 'bg-action text-white' : 'bg-mist'}`}>
                  {m.userId !== user?.id && <p className="text-[11px] font-semibold text-ink-3">{m.user.name}</p>}
                  {m.body}
                </div>
              </div>
            ))}
            <div ref={end} />
          </div>
          <form
            className="flex gap-2 border-t border-line p-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.sendMessage(ev.id, text);
                setText('');
              } catch (err) {
                toast.error(err);
              }
            }}
          >
            <input className="input" placeholder="Message guests…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Chat message" data-testid="chat-input" />
            <button className="btn btn-primary btn-md h-11" disabled={!text.trim()}>Send</button>
          </form>
        </div>
      )}
    </section>
  );
}

export default function EventPage() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const user = useSession((s) => s.user);
  const { data, loading } = useApi(() => api.getEventBySlug(slug), [slug, user?.id]);
  const { data: mine } = useApi(() => (user ? api.myTickets() : Promise.resolve([])), [user?.id]);
  const { data: waits } = useApi(() => (user ? api.myWaitlist() : Promise.resolve([])), [user?.id]);
  const [sheet, setSheet] = useState(false);
  const [guests, setGuests] = useState(false);
  const [share, setShare] = useState(false);
  const [contact, setContact] = useState(false);
  const setRef = useCheckout((s) => s.setRef);
  const setDraft = useCheckout((s) => s.setDraft);
  const tracked = useRef('');

  const ev = data?.card.event;
  useEffect(() => {
    if (!ev || tracked.current === ev.id) return;
    tracked.current = ev.id;
    const kickback = params.get('ref') ?? undefined;
    const tracking = params.get('t') ?? undefined;
    const promo = params.get('promo') ?? undefined;
    if (kickback || tracking || promo) setRef(ev.id, { kickback, tracking, promo });
    void api.trackVisit(ev.id, { kickback, tracking });
    if (params.get('tickets') === '1') setSheet(true);
  }, [ev, params, setRef]);

  const myTix = useMemo(() => (mine ?? []).filter((t) => t.event.id === ev?.id && (t.ticket.status === 'valid' || t.ticket.status === 'checked_in')), [mine, ev?.id]);
  const offerId = params.get('offer');
  const offer = (waits ?? []).find((w) => w.eventId === ev?.id && w.status === 'offered' && (!offerId || w.id === offerId));
  const waiting = (waits ?? []).filter((w) => w.eventId === ev?.id && w.status === 'waiting');

  if (loading && !data) return <PageSpinner />;
  if (!data || !ev) return <div className="container-x py-20"><Empty title="Event not found" body="It may have been removed or the link is wrong." action={<Link className="btn btn-primary btn-md" to="/explore">Explore events</Link>} /></div>;
  const { card, series, friendsGoing } = data;
  const org = card.org;
  const ended = new Date(ev.endsAt).getTime() < Date.now();
  const holder = myTix.length > 0;
  const url = `${location.origin}${location.pathname}#/e/${ev.slug}`;
  const firstGuest = data.guests[0];

  const cta = (() => {
    if (ev.status === 'draft') return { label: 'This is a draft event', disabled: true };
    if (ev.status === 'cancelled') return { label: 'This event was cancelled', disabled: true };
    if (ended) return { label: 'This event has ended', disabled: true };
    if (card.fromPrice === null) return { label: 'This event has hidden tickets', action: () => setSheet(true) };
    if (ev.rsvpOnly) return { label: holder ? 'You’re going ✓ — view ticket' : 'RSVP', action: holder ? () => nav('/tickets') : () => setSheet(true) };
    return { label: card.fromPrice === 0 ? 'Get free tickets' : `Buy tickets from ${tk(card.fromPrice)}`, action: () => setSheet(true) };
  })();

  return (
    <div className="pb-28">
      <div className="container-x pt-4 sm:pt-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,440px)_1fr] lg:gap-12">
          {/* flyer */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="relative mx-auto aspect-[4/5] w-full max-w-[440px] overflow-hidden rounded-3xl bg-mist shadow-card">
              <PosterArt poster={ev.poster} title={ev.title} kicker={org.name} />
              <SaveButton eventId={ev.id} className="absolute right-3 top-3" />
            </div>
          </div>

          {/* details */}
          <div className="min-w-0 space-y-8">
            <div className="space-y-3">
              {ev.status !== 'published' && <Badge tone={ev.status === 'draft' ? 'warn' : 'bad'}>{ev.status === 'draft' ? 'Draft — only your team can see this' : 'Cancelled'}</Badge>}
              <h1 className="headline text-[44px] sm:text-6xl" data-testid="event-title">{ev.title}</h1>
              <p className="text-lg font-semibold">{ev.venue.revealLater && !holder ? 'Location revealed to ticket holders' : ev.venue.name}</p>
              <p className="flex items-center gap-2 text-ink-2"><Clock className="h-4 w-4" />{longRange(ev.startsAt, ev.endsAt)}</p>
              <Link to={`/g/${org.slug}`} className="inline-flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-sm font-semibold hover:bg-mist">
                <Avatar name={org.name} hue={org.avatarHue} url={org.avatarUrl} size={28} />
                {org.name}
                {org.verified && <Verified />}
              </Link>
              {ev.tagline && <p className="text-[15px] font-medium text-ink-2">{ev.tagline}</p>}
              {ev.ageLimit && <Badge>{ev.ageLimit}</Badge>}
            </div>

            {offer && (
              <div className="rounded-2xl border-2 border-brand p-4" data-testid="waitlist-offer">
                <p className="font-bold">🎟️ A ticket opened up for you</p>
                <p className="text-sm text-ink-2">{offer.qty} × {offer.ticketType.name}. Claim before the timer runs out: <strong><Countdown until={offer.offerExpiresAt!} /></strong></p>
                <button
                  className="btn btn-brand btn-md mt-3"
                  data-testid="claim-offer"
                  onClick={() => {
                    setDraft({ eventId: ev.id, slug: ev.slug, cart: [{ ticketTypeId: offer.ticketTypeId, qty: offer.qty }], waitlistEntryId: offer.id });
                    nav(`/e/${ev.slug}/checkout`);
                  }}
                >
                  Claim tickets
                </button>
              </div>
            )}
            {waiting.length > 0 && (
              <div className="flex items-center justify-between rounded-2xl bg-mist p-4 text-sm">
                <span>You’re on the waitlist for <strong>{waiting.map((w) => w.ticketType.name).join(', ')}</strong>.</span>
                <button className="font-semibold underline" onClick={async () => { for (const w of waiting) await api.leaveWaitlist(w.id); toast.info('Left the waitlist'); }}>Leave</button>
              </div>
            )}
            {holder && (
              <Link to="/tickets" className="flex items-center justify-between rounded-2xl bg-action p-4 text-white">
                <span className="flex items-center gap-2 font-semibold"><TicketIcon className="h-5 w-5" />You have {myTix.length} ticket{myTix.length > 1 ? 's' : ''}</span>
                <span className="text-sm underline">View</span>
              </Link>
            )}

            {!ended && ev.status === 'published' && <KickbackBanner ev={ev} />}

            {/* who's going */}
            {ev.showGuestlist && card.goingCount > 0 && (
              <div className="space-y-2">
                <button className="flex items-center gap-3 text-left" onClick={() => setGuests(true)} data-testid="going">
                  <AvatarStack people={card.goingPreview} size={34} />
                  <span className="text-sm">
                    {firstGuest ? <><strong>{firstGuest.name.split(' ')[0]}</strong> and {Math.max(0, card.goingCount - 1).toLocaleString()} others going</> : <><strong>{card.goingCount.toLocaleString()}</strong> going</>}
                    <span className="block font-semibold underline underline-offset-4">View Guestlist</span>
                  </span>
                </button>
                {friendsGoing.length > 0 && <p className="text-sm text-ink-3">{friendsGoing.slice(0, 2).map((f) => f.name.split(' ')[0]).join(', ')}{friendsGoing.length > 2 ? ` +${friendsGoing.length - 2}` : ''} you follow {friendsGoing.length > 1 ? 'are' : 'is'} going</p>}
              </div>
            )}

            {/* series */}
            {series.length > 1 && (
              <div>
                <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                  {series.slice(0, 8).map((s) => (
                    <Link key={s.id} to={`/e/${s.slug}`} className={`shrink-0 rounded-2xl border px-4 py-2.5 text-center ${s.id === ev.id ? 'border-ink bg-action text-white' : 'border-line hover:border-ink-4'}`}>
                      <p className="text-sm font-bold">{monthDay(s.startsAt)}</p>
                      <p className="text-xs opacity-75">{weekday(s.startsAt)} · {timeLabel(s.startsAt)}</p>
                    </Link>
                  ))}
                </div>
                <Link to={`/series/${ev.seriesId}`} className="mt-2 inline-block text-sm font-semibold underline underline-offset-4">More Dates</Link>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button className="btn btn-outline btn-md" onClick={() => setShare(true)}><Share2 className="h-4 w-4" />Share</button>
              <button className="btn btn-outline btn-md" onClick={() => downloadFile(`${ev.slug}.ics`, icsFor(ev), 'text/calendar')}><CalendarPlus className="h-4 w-4" />Add to calendar</button>
            </div>

            <section>
              <h2 className="mb-3 text-xl font-extrabold">About this event</h2>
              <ViewMore lines={9}><RichText text={ev.description || 'More details coming soon.'} /></ViewMore>
            </section>

            {ev.lineup.length > 0 && (
              <section>
                <h2 className="mb-3 text-xl font-extrabold">Event Features</h2>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {ev.lineup.map((l) => (
                    <div key={l.id} className="text-center">
                      <div className="mx-auto aspect-square w-full max-w-[110px] overflow-hidden rounded-full">
                        <PosterArt poster={{ seed: l.hue * 7 + 3, style: 'gradient', hues: [l.hue, (l.hue + 60) % 360] }} title="" showText={false} />
                      </div>
                      <p className="mt-2 line-clamp-2 text-[13px] font-semibold">{l.name}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              {ev.venue.revealLater && !holder ? (
                <div className="flex h-40 items-center justify-center rounded-3xl bg-mist text-center text-sm text-ink-3"><span><Lock className="mx-auto mb-2 h-5 w-5" />The exact location is shared with ticket holders.</span></div>
              ) : (
                <MapPreview lat={ev.venue.lat} lng={ev.venue.lng} label={ev.venue.name} />
              )}
              <h2 className="mb-1 mt-4 text-xl font-extrabold">Location</h2>
              <p className="flex items-start gap-2 text-ink-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{ev.venue.revealLater && !holder ? `${ev.venue.city} — address released before the event` : `${ev.venue.address}`}</p>
            </section>

            <Chat ev={ev} />

            {/* hosted by */}
            <section>
              <p className="mb-3 text-sm font-semibold text-ink-3">Hosted by</p>
              <div className="card flex items-center gap-4 p-4">
                <Link to={`/g/${org.slug}`}><Avatar name={org.name} hue={org.avatarHue} url={org.avatarUrl} size={60} /></Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/g/${org.slug}`} className="flex items-center gap-1.5 font-bold">{org.name}{org.verified && <Verified />}</Link>
                  <Link to={`/g/${org.slug}`} className="text-sm text-ink-3 underline-offset-4 hover:underline">More events</Link>
                  {org.instagram && <p className="mt-0.5 flex items-center gap-1 text-[13px] text-ink-3"><Instagram className="h-3.5 w-3.5" />@{org.instagram}</p>}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button className="btn btn-outline btn-sm" onClick={() => setContact(true)}>Contact</button>
                  <FollowButton orgId={org.id} />
                </div>
              </div>
            </section>

            <section className="flex items-center gap-5 rounded-3xl bg-mist p-5">
              <div className="hidden h-24 w-24 shrink-0 grid-cols-5 gap-0.5 rounded-xl bg-surface p-2 sm:grid" aria-hidden>
                {Array.from({ length: 25 }, (_, i) => <span key={i} className={`${(i * 7) % 3 ? 'bg-action' : ''} rounded-[1px]`} />)}
              </div>
              <div>
                <p className="font-bold">Get the app for more features</p>
                <p className="text-sm text-ink-3">Instant ticket access · Easy ticket transfers · Curated for you</p>
                <Link to="/app" className="mt-2 inline-block text-sm font-semibold underline underline-offset-4">Download Dekha Hobe</Link>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* sticky CTA */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-surface md:bottom-0">
        <div className="container-x flex items-center justify-between gap-3 py-3">
          <div className="hidden min-w-0 sm:block">
            <p className="truncate font-bold">{ev.title}</p>
            <p className="text-sm text-ink-3">{longRange(ev.startsAt, ev.endsAt)}</p>
          </div>
          <button className="btn btn-primary btn-lg w-full sm:w-auto" disabled={cta.disabled} onClick={cta.action} data-testid="buy-cta">{cta.label}</button>
        </div>
      </div>

      <TicketSheet ev={ev} open={sheet} onClose={() => setSheet(false)} />

      <Modal open={guests} onClose={() => setGuests(false)} title={`Guestlist · ${card.goingCount.toLocaleString()} going`}>
        <ul className="divide-y divide-line">
          {data.guests.map((g) => (
            <li key={g.id}>
              <Link to={`/u/${g.username}`} className="flex items-center gap-3 py-2.5">
                <Avatar name={g.name} hue={g.avatarHue} url={g.avatarUrl} size={36} />
                <span className="text-sm font-semibold">{g.name}</span>
                <span className="text-[13px] text-ink-4">@{g.username}</span>
              </Link>
            </li>
          ))}
        </ul>
        {card.goingCount > data.guests.length && <p className="pt-3 text-center text-[13px] text-ink-3">+{(card.goingCount - data.guests.length).toLocaleString()} more (some profiles are private)</p>}
      </Modal>

      <Modal open={share} onClose={() => setShare(false)} title="Share event">
        <div className="space-y-3">
          <div className="flex gap-2"><input className="input" readOnly value={url} aria-label="Event link" /><button className="btn btn-primary btn-md h-11" onClick={() => { navigator.clipboard?.writeText(url).catch(() => undefined); toast.success('Link copied'); }}><Copy className="h-4 w-4" /></button></div>
          <div className="grid grid-cols-2 gap-2">
            <a className="btn btn-outline btn-md" href={`https://wa.me/?text=${encodeURIComponent(`${ev.title} — ${url}`)}`} target="_blank" rel="noreferrer">WhatsApp</a>
            <a className="btn btn-outline btn-md" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer">Facebook</a>
          </div>
        </div>
      </Modal>

      <Modal open={contact} onClose={() => setContact(false)} title={`Contact ${org.name}`}>
        <div className="space-y-3 text-sm">
          <p className="text-ink-2">Questions about tickets, access or refunds? Reach the organizer directly.</p>
          {org.contactEmail && <a className="btn btn-outline btn-md w-full" href={`mailto:${org.contactEmail}?subject=${encodeURIComponent(ev.title)}`}><Mail className="h-4 w-4" />{org.contactEmail}</a>}
          {org.instagram && <a className="btn btn-outline btn-md w-full" href={`https://instagram.com/${org.instagram}`} target="_blank" rel="noreferrer"><Instagram className="h-4 w-4" />@{org.instagram}</a>}
          {!org.contactEmail && !org.instagram && <p className="text-ink-3">This organizer hasn’t added contact details yet.</p>}
        </div>
      </Modal>
    </div>
  );
}

export function FollowButton({ orgId, size = 'sm' }: { orgId: string; size?: 'sm' | 'md' }) {
  const user = useSession((s) => s.user);
  const nav = useNavigate();
  const following = !!user?.following.includes(orgId);
  return (
    <button
      className={`btn btn-${size} ${following ? 'btn-outline' : 'btn-primary'}`}
      data-testid="follow-btn"
      onClick={async () => {
        if (!user) return nav('/login');
        try {
          await api.toggleFollowOrg(orgId);
        } catch (e) {
          toast.error(e);
        }
      }}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  );
}
