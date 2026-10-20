import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarPlus, CheckCircle2, Clock, Copy, Sparkles, Ticket as TicketIcon } from 'lucide-react';
import { api } from '@/api';
import { useApi } from '@/hooks/useApi';
import { PosterArt } from '@/components/PosterArt';
import { Badge, Empty, PageSpinner } from '@/components/ui';
import { QR } from '@/components/QR';
import { dayYearLabel, downloadFile, icsFor, longRange, tk } from '@/lib/util';
import { toast } from '@/store/toast';

const STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' }> = {
  paid: { label: 'Confirmed', tone: 'ok' },
  pending_approval: { label: 'Awaiting approval', tone: 'warn' },
  pending_payment: { label: 'Awaiting payment', tone: 'warn' },
  refunded: { label: 'Refunded', tone: 'neutral' },
  declined: { label: 'Not approved', tone: 'bad' },
  expired: { label: 'Expired', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

export default function OrderPage() {
  const { id = '' } = useParams();
  const { data, loading } = useApi(() => api.getOrder(id), [id]);
  const [link, setLink] = useState<string | null>(null);
  if (loading && !data) return <PageSpinner />;
  if (!data) return <div className="container-x py-20"><Empty title="Order not found" /></div>;
  const { order, event: ev, org, tickets } = data;
  const st = STATUS[order.status]!;
  const kick = ev.kickbackOffers.find((o) => o.enabled && o.isPublic);
  const live = tickets.filter((t) => t.status === 'valid' || t.status === 'checked_in');

  return (
    <div className="container-x max-w-3xl pb-20 pt-8">
      <div className="text-center">
        {order.status === 'paid' ? <CheckCircle2 className="mx-auto h-14 w-14 text-ok" /> : <Clock className="mx-auto h-14 w-14 text-warn" />}
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl" data-testid="order-headline">
          {order.status === 'paid' ? (ev.rsvpOnly ? 'You’re on the list!' : 'You’re going!') : order.status === 'pending_approval' ? 'Request sent' : st.label}
        </h1>
        <p className="mt-2 text-ink-3">
          {order.status === 'pending_approval' ? `${org.name} will review your request. You’ll get your tickets as soon as it’s approved.` : `Order ${order.number} · ${dayYearLabel(order.createdAt)}`}
        </p>
      </div>

      <div className="card mt-8 overflow-hidden">
        <div className="flex gap-4 p-5">
          <Link to={`/e/${ev.slug}`} className="aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-xl"><PosterArt poster={ev.poster} title={ev.title} showText={false} /></Link>
          <div className="min-w-0">
            <Badge tone={st.tone}>{st.label}</Badge>
            <p className="mt-1 font-bold leading-tight">{ev.title}</p>
            <p className="text-sm text-ink-3">{longRange(ev.startsAt, ev.endsAt)}</p>
            <p className="text-sm text-ink-3">{ev.venue.revealLater ? ev.venue.city : ev.venue.name}</p>
          </div>
        </div>
        <div className="space-y-1.5 border-t border-line p-5 text-sm">
          {order.items.map((i) => <div key={i.ticketTypeId} className="flex justify-between"><span>{i.qty} × {i.name}</span><span>{tk(i.unitPrice * i.qty)}</span></div>)}
          {order.fees > 0 && <div className="flex justify-between text-ink-3"><span>Service fees</span><span>{tk(order.fees)}</span></div>}
          {order.discount > 0 && <div className="flex justify-between text-ok"><span>Promo {order.promoCode}</span><span>−{tk(order.discount)}</span></div>}
          <div className="flex justify-between border-t border-line pt-2 font-bold"><span>Total</span><span>{tk(order.total)}</span></div>
          {order.paymentMethod && <p className="pt-1 text-xs text-ink-3">Paid with {order.paymentMethod === 'bkash' ? 'bKash' : order.paymentMethod === 'nagad' ? 'Nagad' : order.paymentMethod}{order.paymentRef ? ` · Ref ${order.paymentRef}` : ''}</p>}
        </div>
      </div>

      {live.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {live.slice(0, 4).map((t) => (
            <Link key={t.id} to={`/tickets/${t.id}`} className="card flex items-center gap-4 p-4 hover:shadow-card">
              <QR value={`BPOP:${t.id}:${t.qrNonce}`} size={84} />
              <div><p className="text-xs font-semibold text-ink-3">Ticket</p><p className="font-mono text-sm font-bold">{t.code}</p><p className="mt-1 text-xs text-ink-3">Tap to open full screen</p></div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link to="/tickets" className="btn btn-primary btn-lg"><TicketIcon className="h-4 w-4" />View my tickets</Link>
        <button className="btn btn-outline btn-lg" onClick={() => downloadFile(`${ev.slug}.ics`, icsFor(ev), 'text/calendar')}><CalendarPlus className="h-4 w-4" />Add to calendar</button>
      </div>

      {kick && order.status === 'paid' && (
        <div className="mt-8 rounded-3xl bg-brand-soft p-6 text-center">
          <Sparkles className="mx-auto h-7 w-7 text-brand" />
          <p className="mt-2 text-xl font-extrabold">Get paid to invite friends</p>
          <p className="mt-1 text-sm text-ink-2">Earn {kick.kind === 'percent' ? `${kick.value}%` : tk(kick.value)} per {kick.per} when friends buy with your Kickback link.</p>
          {link ? (
            <div className="mx-auto mt-4 flex max-w-md gap-2"><input className="input" readOnly value={link} aria-label="Kickback link" /><button className="btn btn-primary btn-md h-11" onClick={() => { navigator.clipboard?.writeText(link).catch(() => undefined); toast.success('Copied'); }}><Copy className="h-4 w-4" /></button></div>
          ) : (
            <button className="btn btn-brand btn-lg mt-4" onClick={async () => { const l = await api.getOrCreateKickbackLink(ev.id); if (l) setLink(`${location.origin}${location.pathname}#/e/${ev.slug}?ref=${l.code}`); }}>Get my link</button>
          )}
        </div>
      )}
    </div>
  );
}
