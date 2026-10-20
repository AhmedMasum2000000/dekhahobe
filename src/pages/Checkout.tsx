import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CreditCard, Lock, ShieldCheck, Timer } from 'lucide-react';
import { api, type Order, type PaymentMethod } from '@/api';
import { useApi } from '@/hooks/useApi';
import { useCheckout } from '@/store/checkout';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { PosterArt } from '@/components/PosterArt';
import { Countdown, Empty, Field, PageSpinner, Spinner } from '@/components/ui';
import { longRange, maskPhone, normalizePhone, tk } from '@/lib/util';

const METHODS: { id: Exclude<PaymentMethod, 'cash' | 'free' | 'comp'>; name: string; color: string; note: string }[] = [
  { id: 'bkash', name: 'bKash', color: '#E2136E', note: 'Pay with your bKash account' },
  { id: 'nagad', name: 'Nagad', color: '#EC1C24', note: 'Pay with your Nagad account' },
  { id: 'card', name: 'Card', color: '#0A0A0A', note: 'Visa, Mastercard, Amex' },
];

function luhn(num: string) {
  const d = num.replace(/\D/g, '');
  if (d.length < 13) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/** Simulated wallet / card gateway. No money moves — see README. */
function Gateway({ order, method, onPaid, onBack }: { order: Order; method: (typeof METHODS)[number]; onPaid: (ref: string) => Promise<void>; onBack: () => void }) {
  const [step, setStep] = useState<'account' | 'otp' | 'pin' | 'processing'>('account');
  const [acct, setAcct] = useState(order.buyer.phone.replace('+88', ''));
  const [card, setCard] = useState({ number: '', exp: '', cvc: '', name: order.buyer.name });
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState('');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const wallet = method.id !== 'card';

  const sendOtp = () => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setSent(code);
    window.dispatchEvent(new CustomEvent('bpop:sms', { detail: { to: normalizePhone(acct) ?? acct, body: `${method.name}: your verification code is ${code}. Payment ${tk(order.total)} to B-POP TAGS.`, otp: true } }));
  };

  const submitAccount = () => {
    setErr('');
    if (wallet) {
      if (!normalizePhone(acct)) return setErr(`Enter your 11-digit ${method.name} number.`);
    } else {
      if (!luhn(card.number)) return setErr('That card number isn’t valid. Try 4242 4242 4242 4242.');
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(card.exp)) return setErr('Expiry must be MM/YY.');
      const [mm, yy] = card.exp.split('/').map(Number) as [number, number];
      if (new Date(2000 + yy, mm, 1) < new Date()) return setErr('This card has expired.');
      if (!/^\d{3,4}$/.test(card.cvc)) return setErr('Enter the 3-digit CVC.');
    }
    sendOtp();
    setStep('otp');
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-line">
      <div className="flex items-center justify-between px-5 py-4 text-white" style={{ background: method.color }}>
        <p className="font-display text-xl font-extrabold">{method.name}</p>
        <p className="text-sm opacity-90">Merchant: B-POP TAGS · {tk(order.total)}</p>
      </div>
      <div className="space-y-4 p-5">
        {step === 'account' && (
          <>
            {wallet ? (
              <Field label={`Your ${method.name} account number`}>
                <input className="input" inputMode="tel" value={acct} onChange={(e) => setAcct(e.target.value)} placeholder="01XXXXXXXXX" data-testid="wallet-number" />
              </Field>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Field label="Card number"><input className="input" inputMode="numeric" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value.replace(/[^\d ]/g, '').slice(0, 19) })} placeholder="4242 4242 4242 4242" data-testid="card-number" /></Field></div>
                <Field label="Expiry"><input className="input" value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value.slice(0, 5) })} placeholder="MM/YY" data-testid="card-exp" /></Field>
                <Field label="CVC"><input className="input" inputMode="numeric" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value.slice(0, 4) })} placeholder="123" data-testid="card-cvc" /></Field>
                <div className="col-span-2"><Field label="Name on card"><input className="input" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} /></Field></div>
              </div>
            )}
            <p className="flex items-center gap-1.5 text-xs text-ink-3"><ShieldCheck className="h-4 w-4" />By continuing you agree to the {method.name} terms. Demo mode — no money is charged.</p>
            <button className="btn btn-lg w-full text-white" style={{ background: method.color }} onClick={submitAccount} data-testid="gw-continue">Confirm</button>
          </>
        )}
        {step === 'otp' && (
          <>
            <p className="text-sm text-ink-2">We sent a 6-digit code to {wallet ? maskPhone(normalizePhone(acct) ?? acct) : 'your card’s registered phone'}.</p>
            <input className="input text-center text-xl tracking-[0.5em]" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="••••••" data-testid="gw-otp" autoFocus />
            <button className="text-sm font-semibold underline" onClick={sendOtp}>Resend code</button>
            <button
              className="btn btn-lg w-full text-white"
              style={{ background: method.color }}
              data-testid="gw-otp-submit"
              onClick={() => {
                setErr('');
                if (otp !== sent) return setErr('Incorrect verification code.');
                if (wallet) setStep('pin');
                else {
                  setStep('processing');
                  onPaid(`CARD-${card.number.replace(/\D/g, '').slice(-4)}-${Date.now()}`).catch((e) => { setErr(e.message); setStep('otp'); });
                }
              }}
            >
              Verify
            </button>
          </>
        )}
        {step === 'pin' && (
          <>
            <Field label={`Enter your ${method.name} PIN`}>
              <input className="input text-center text-xl tracking-[0.5em]" type="password" inputMode="numeric" maxLength={5} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="•••••" data-testid="gw-pin" autoFocus />
            </Field>
            <button
              className="btn btn-lg w-full text-white"
              style={{ background: method.color }}
              data-testid="gw-pay"
              onClick={() => {
                setErr('');
                if (!/^\d{4,5}$/.test(pin)) return setErr('Your PIN is 4–5 digits.');
                setStep('processing');
                onPaid(`${method.id.toUpperCase()}${Date.now().toString(36).toUpperCase()}`).catch((e) => { setErr(e.message); setStep('pin'); });
              }}
            >
              Pay {tk(order.total)}
            </button>
          </>
        )}
        {step === 'processing' && <div className="flex flex-col items-center gap-3 py-8"><Spinner className="h-8 w-8" /><p className="text-sm font-semibold">Processing payment…</p></div>}
        {err && <p className="text-sm font-medium text-bad" role="alert">{err}</p>}
        {step !== 'processing' && <button className="text-sm font-semibold text-ink-3 underline" onClick={onBack}>Choose another payment method</button>}
      </div>
    </div>
  );
}

export default function Checkout() {
  const { slug = '' } = useParams();
  const nav = useNavigate();
  const user = useSession((s) => s.user);
  const { draft, setDraft } = useCheckout();
  const { data: evData, loading } = useApi(() => api.getEventBySlug(slug), [slug], { live: false });
  const { data: quote } = useApi(() => (draft ? api.quote(draft.eventId, draft.cart, draft.promo, draft.password, draft.waitlistEntryId) : Promise.resolve(null)), [JSON.stringify(draft)], { live: false });
  const [buyer, setBuyer] = useState({ name: '', phone: '', email: '' });
  const [order, setOrder] = useState<Order | null>(null);
  const [method, setMethod] = useState<(typeof METHODS)[number] | null>(null);
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (user) setBuyer((b) => ({ name: b.name || user.name, phone: b.phone || user.phone.replace('+88', ''), email: b.email || user.email || '' }));
  }, [user]);
  const ready = useSession((s) => s.ready);
  useEffect(() => {
    if (ready && !user) nav(`/login?next=${encodeURIComponent(`/e/${slug}/checkout`)}`);
  }, [ready, user, nav, slug]);

  if (loading) return <PageSpinner />;
  const ev = evData?.card.event;
  if (!draft || !ev || draft.slug !== slug) return <div className="container-x py-20"><Empty title="Your cart is empty" body="Pick your tickets on the event page first." action={<Link to={`/e/${slug}`} className="btn btn-primary btn-md">Back to event</Link>} /></div>;

  const start = async () => {
    setBusy(true);
    try {
      const o = await api.startCheckout({ ...draft, buyer });
      if (o.status === 'paid' || o.status === 'pending_approval') {
        setDraft(null);
        nav(`/orders/${o.id}`, { replace: true });
      } else setOrder(o);
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  const pay = async (ref: string) => {
    const paid = await api.payOrder(order!.id, method!.id, ref);
    setDraft(null);
    nav(`/orders/${paid.id}`, { replace: true });
  };

  const summary = order ?? quote;
  const kick = ev.kickbackOffers.find((o) => o.enabled && o.isPublic && o.showBanner);

  return (
    <div className="container-x max-w-4xl pb-20 pt-6">
      <button className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-3" onClick={async () => { if (order) await api.cancelPendingOrder(order.id); nav(`/e/${slug}`); }}>
        <ArrowLeft className="h-4 w-4" />Back to event
      </button>
      <h1 className="text-3xl font-black tracking-tight">Checkout</h1>
      {order?.holdExpiresAt && (
        <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-warn" data-testid="hold-timer">
          <Timer className="h-4 w-4" />Tickets held for <Countdown until={order.holdExpiresAt} onDone={() => setExpired(true)} />
        </p>
      )}
      <div className="mt-6 grid gap-8 md:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {expired ? (
            <Empty title="Your hold expired" body="We released the tickets so others could buy them. You can start again — if they’re still available." action={<Link to={`/e/${slug}?tickets=1`} className="btn btn-primary btn-md">Start again</Link>} />
          ) : !order ? (
            <div className="card space-y-4 p-5">
              <h2 className="text-lg font-bold">Your details</h2>
              <Field label="Full name"><input className="input" value={buyer.name} onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} data-testid="buyer-name" /></Field>
              <Field label="Mobile number" hint="Your tickets and updates are sent here."><input className="input" inputMode="tel" value={buyer.phone} onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })} data-testid="buyer-phone" /></Field>
              <Field label="Email (optional)"><input className="input" type="email" value={buyer.email} onChange={(e) => setBuyer({ ...buyer, email: e.target.value })} /></Field>
              {quote?.error && <p className="text-sm font-medium text-bad">{quote.error}</p>}
              <button className="btn btn-primary btn-lg w-full" disabled={busy || !!quote?.error || !buyer.name || !buyer.phone} onClick={start} data-testid="continue-payment">
                {busy ? <Spinner className="h-5 w-5 text-white" /> : quote && quote.total === 0 ? (ev.rsvpOnly ? 'Confirm RSVP' : 'Get tickets') : 'Continue to payment'}
              </button>
              <p className="text-center text-xs text-ink-3">By continuing you agree to the <Link to="/terms/terms-of-service" className="underline">Terms</Link> and <Link to="/terms/refund-policy" className="underline">Refund Policy</Link>.</p>
            </div>
          ) : !method ? (
            <div className="card space-y-3 p-5">
              <h2 className="text-lg font-bold">Payment method</h2>
              {METHODS.map((m) => (
                <button key={m.id} className="flex w-full items-center gap-4 rounded-2xl border border-line p-4 text-left hover:border-ink" onClick={() => setMethod(m)} data-testid={`pay-${m.id}`}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl font-display text-sm font-extrabold text-white" style={{ background: m.color }}>{m.id === 'card' ? <CreditCard className="h-5 w-5" /> : m.name[0]}</span>
                  <span><span className="block font-semibold">{m.name}</span><span className="text-[13px] text-ink-3">{m.note}</span></span>
                </button>
              ))}
              <p className="flex items-center gap-1.5 pt-1 text-xs text-ink-3"><Lock className="h-3.5 w-3.5" />Payments are processed securely. In this demo nothing is charged.</p>
            </div>
          ) : (
            <Gateway order={order} method={method} onPaid={pay} onBack={() => setMethod(null)} />
          )}
          {kick && !expired && <p className="rounded-2xl bg-brand-soft p-4 text-sm"><strong>Earn it back:</strong> after checkout, share your link and get {kick.kind === 'percent' ? `${kick.value}%` : tk(kick.value)} on every order your friends place.</p>}
        </div>

        <aside className="md:sticky md:top-24 md:self-start">
          <div className="card overflow-hidden">
            <div className="flex gap-3 p-4">
              <div className="aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-xl"><PosterArt poster={ev.poster} title={ev.title} showText={false} /></div>
              <div className="min-w-0"><p className="line-clamp-2 font-bold leading-tight">{ev.title}</p><p className="mt-1 text-xs text-ink-3">{longRange(ev.startsAt, ev.endsAt)}</p><p className="text-xs text-ink-3">{ev.venue.name}</p></div>
            </div>
            {summary && (
              <div className="space-y-1.5 border-t border-line p-4 text-sm" data-testid="order-summary">
                {summary.items.map((i) => <div key={i.ticketTypeId} className="flex justify-between"><span>{i.qty} × {i.name}</span><span>{tk(i.unitPrice * i.qty)}</span></div>)}
                {summary.fees > 0 && <div className="flex justify-between text-ink-3"><span>Service fees</span><span>{tk(summary.fees)}</span></div>}
                {summary.discount > 0 && <div className="flex justify-between text-ok"><span>Discount</span><span>−{tk(summary.discount)}</span></div>}
                <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><span>Total</span><span data-testid="checkout-total">{tk(summary.total)}</span></div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
