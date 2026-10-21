import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRightLeft, Clock, MapPin, RotateCcw, Send, Ticket as TicketIcon, Undo2 } from 'lucide-react';
import { api, type TicketView } from '@/api';
import { useApi } from '@/hooks/useApi';
import { PosterArt } from '@/components/PosterArt';
import { QR } from '@/components/QR';
import { Badge, Countdown, Empty, Field, Modal, PageSpinner, Tabs } from '@/components/ui';
import { cardRange, dayLabel, longRange, maskPhone, prettyPhone, tk } from '@/lib/util';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { RequireLogin } from './Login';

type Tab = 'upcoming' | 'past' | 'transfers' | 'waitlist' | 'orders';

function groupByEvent(list: TicketView[]) {
  const map = new Map<string, TicketView[]>();
  for (const t of list) map.set(t.event.id, [...(map.get(t.event.id) ?? []), t]);
  return [...map.values()];
}

function TicketGroupCard({ group }: { group: TicketView[] }) {
  const { event, org } = group[0]!;
  const valid = group.filter((g) => g.ticket.status === 'valid').length;
  return (
    <Link to={`/tickets/${group[0]!.ticket.id}`} className="card flex gap-4 p-3 transition hover:shadow-card" data-testid="ticket-group">
      <div className="aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-2xl"><PosterArt poster={event.poster} title={event.title} showText={false} /></div>
      <div className="min-w-0 flex-1 py-1">
        <p className="text-[13px] text-ink-3">{org.name}</p>
        <p className="line-clamp-2 font-bold leading-tight">{event.title}</p>
        <p className="mt-1 text-[13px] text-ink-3">{cardRange(event.startsAt, event.endsAt)}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone="dark"><TicketIcon className="h-3 w-3" />{group.length} ticket{group.length > 1 ? 's' : ''}</Badge>
          {group.some((g) => g.ticket.transfer) && <Badge tone="warn">Transfer pending</Badge>}
          {group.every((g) => g.ticket.status === 'checked_in') && <Badge tone="ok">Checked in</Badge>}
          {valid > 0 && valid < group.length && <Badge>{valid} unused</Badge>}
        </div>
      </div>
    </Link>
  );
}

export default function Tickets() {
  return <RequireLogin><TicketsInner /></RequireLogin>;
}

function TicketsInner() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'upcoming';
  const { data: tickets, loading } = useApi(() => api.myTickets(), []);
  const { data: incoming } = useApi(() => api.incomingTransfers(), []);
  const { data: waits } = useApi(() => api.myWaitlist(), []);
  const { data: orders } = useApi(() => api.myOrders(), []);
  const now = Date.now();
  const upcoming = useMemo(() => groupByEvent((tickets ?? []).filter((t) => new Date(t.event.endsAt).getTime() >= now && t.ticket.status !== 'cancelled')), [tickets, now]);
  const past = useMemo(() => groupByEvent((tickets ?? []).filter((t) => new Date(t.event.endsAt).getTime() < now)).reverse(), [tickets, now]);
  const outgoing = (tickets ?? []).filter((t) => t.ticket.transfer);

  return (
    <div className="container-x max-w-3xl pb-16 pt-8">
      <h1 className="text-4xl font-black tracking-tight">My tickets</h1>
      <Tabs
        className="mt-4"
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        tabs={[
          { id: 'upcoming', label: `Upcoming${upcoming.length ? ` · ${upcoming.length}` : ''}` },
          { id: 'past', label: 'Past' },
          { id: 'transfers', label: <span>Transfers{incoming?.length ? <span className="ml-1 rounded-full bg-brand px-1.5 text-xs text-white">{incoming.length}</span> : null}</span> },
          { id: 'waitlist', label: `Waitlists${waits?.length ? ` · ${waits.length}` : ''}` },
          { id: 'orders', label: 'Orders' },
        ]}
      />
      <div className="mt-6 space-y-3">
        {loading && !tickets ? <PageSpinner /> : null}
        {tab === 'upcoming' && tickets && (upcoming.length ? upcoming.map((g) => <TicketGroupCard key={g[0]!.event.id} group={g} />) : <Empty icon={<TicketIcon className="h-8 w-8" />} title="No upcoming tickets" body="When you get tickets, they’ll show up here." action={<Link to="/explore" className="btn btn-primary btn-md">Find events</Link>} />)}
        {tab === 'past' && tickets && (past.length ? past.map((g) => <TicketGroupCard key={g[0]!.event.id} group={g} />) : <Empty title="No past events yet" />)}
        {tab === 'transfers' && (
          <>
            <h2 className="text-lg font-bold">Incoming</h2>
            {incoming?.length ? incoming.map((t) => <IncomingTransfer key={t.ticket.id} t={t} />) : <p className="text-sm text-ink-3">No tickets waiting for you.</p>}
            <h2 className="pt-4 text-lg font-bold">Sent (pending)</h2>
            {outgoing.length ? outgoing.map((t) => (
              <div key={t.ticket.id} className="card flex items-center justify-between gap-3 p-4">
                <div className="min-w-0"><p className="truncate font-semibold">{t.event.title}</p><p className="text-[13px] text-ink-3">{t.ticketType.name} → {maskPhone(t.ticket.transfer!.toPhone)}</p></div>
                <button className="btn btn-outline btn-sm" onClick={async () => { await api.cancelTransfer(t.ticket.id); toast.info('Transfer cancelled'); }}>Cancel</button>
              </div>
            )) : <p className="text-sm text-ink-3">No pending transfers.</p>}
          </>
        )}
        {tab === 'waitlist' && (waits?.length ? waits.map((w) => (
          <div key={w.id} className="card flex items-center justify-between gap-3 p-4" data-testid="waitlist-entry">
            <div className="min-w-0">
              <p className="truncate font-semibold">{w.event.title}</p>
              <p className="text-[13px] text-ink-3">{w.qty} × {w.ticketType.name} · {w.status === 'offered' ? <span className="font-semibold text-brand-dark">Offer expires in <Countdown until={w.offerExpiresAt!} /></span> : 'Waiting in line'}</p>
            </div>
            {w.status === 'offered' ? <Link to={`/e/${w.event.slug}?offer=${w.id}`} className="btn btn-brand btn-sm">Claim</Link> : <button className="btn btn-outline btn-sm" onClick={() => api.leaveWaitlist(w.id)}>Leave</button>}
          </div>
        )) : <Empty title="You’re not on any waitlists" body="Join a waitlist when a ticket type sells out and we’ll text you if one opens up." />)}
        {tab === 'orders' && (orders?.length ? orders.map(({ order, event }) => (
          <Link key={order.id} to={`/orders/${order.id}`} className="card flex items-center justify-between gap-3 p-4 hover:shadow-card">
            <div className="min-w-0"><p className="truncate font-semibold">{event.title}</p><p className="text-[13px] text-ink-3">{order.number} · {dayLabel(order.createdAt)} · {order.items.reduce((a, i) => a + i.qty, 0)} ticket(s)</p></div>
            <div className="text-right"><p className="font-semibold">{tk(order.total)}</p><p className="text-xs capitalize text-ink-3">{order.status.replace('_', ' ')}{order.refundRequested ? ' · refund requested' : ''}</p></div>
          </Link>
        )) : <Empty title="No orders yet" />)}
      </div>
    </div>
  );
}

function IncomingTransfer({ t }: { t: TicketView }) {
  return (
    <div className="card flex items-center gap-4 p-4" data-testid="incoming-transfer">
      <div className="aspect-[4/5] w-14 shrink-0 overflow-hidden rounded-xl"><PosterArt poster={t.event.poster} title={t.event.title} showText={false} /></div>
      <div className="min-w-0 flex-1"><p className="truncate font-semibold">{t.event.title}</p><p className="text-[13px] text-ink-3">{t.ticketType.name} · {dayLabel(t.event.startsAt)}</p></div>
      <div className="flex gap-2">
        <button className="btn btn-outline btn-sm" onClick={async () => { await api.declineTransfer(t.ticket.id); toast.info('Transfer declined'); }}>Decline</button>
        <button className="btn btn-primary btn-sm" data-testid="accept-transfer" onClick={async () => { try { await api.acceptTransfer(t.ticket.id); toast.success('Ticket accepted 🎉'); } catch (e) { toast.error(e); } }}>Accept</button>
      </div>
    </div>
  );
}

export function TicketDetail() {
  return <RequireLogin><TicketDetailInner /></RequireLogin>;
}

function TicketDetailInner() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const user = useSession((s) => s.user);
  const { data: all, loading } = useApi(() => api.myTickets(), []);
  const [transfer, setTransfer] = useState(false);
  const [refund, setRefund] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [phone, setPhone] = useState('');
  const current = all?.find((t) => t.ticket.id === id);
  const siblings = useMemo(() => (current ? (all ?? []).filter((t) => t.event.id === current.event.id) : []), [all, current]);
  const [picked, setPicked] = useState<number | null>(null);
  if (loading && !all) return <PageSpinner />;
  if (!current) return <div className="container-x py-20"><Empty title="Ticket not found" body="It may have been transferred or refunded." action={<Link to="/tickets" className="btn btn-primary btn-md">My tickets</Link>} /></div>;
  const idx = Math.min(picked ?? Math.max(0, siblings.findIndex((s) => s.ticket.id === current.ticket.id)), siblings.length - 1);
  const t = siblings[idx] ?? current;
  const { event: ev, ticket, ticketType, order } = t;
  const transferable = siblings.filter((s) => s.ticket.status === 'valid' && !s.ticket.transfer && !s.ticket.isComp && s.ticketType.allowTransfers);
  const ended = new Date(ev.endsAt).getTime() < Date.now();
  const status = ticket.status === 'checked_in' ? { l: 'Checked in', tone: 'ok' as const } : ticket.status === 'cancelled' ? { l: 'Canceled', tone: 'bad' as const } : ticket.transfer ? { l: 'Transfer pending', tone: 'warn' as const } : { l: 'Valid', tone: 'ok' as const };

  return (
    <div className="container-x max-w-md pb-16 pt-6">
      <button className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-3" onClick={() => nav('/tickets')}><ArrowLeft className="h-4 w-4" />My tickets</button>
      <div className="overflow-hidden rounded-4xl border border-line shadow-card">
        <div className="relative h-44"><PosterArt poster={ev.poster} title={ev.title} showText={false} /><div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" /><div className="absolute bottom-4 left-5 right-5 text-white"><p className="text-xs font-semibold opacity-80">{t.org.name}</p><p className="line-clamp-2 font-display text-xl font-extrabold leading-tight">{ev.title}</p></div></div>
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between"><Badge tone={status.tone}>{status.l}</Badge>{siblings.length > 1 && <span className="text-sm font-semibold text-ink-3">Ticket {idx + 1} of {siblings.length}</span>}</div>
          <div className="flex justify-center">
            {ticket.status === 'cancelled' ? <div className="flex h-60 w-60 items-center justify-center rounded-2xl bg-mist text-center text-sm font-semibold text-ink-3">This ticket was canceled</div> : <QR value={`BPOP:${ticket.id}:${ticket.qrNonce}`} size={240} className={ticket.status === 'checked_in' ? 'opacity-40' : ''} />}
          </div>
          <p className="text-center font-mono text-lg font-bold tracking-widest" data-testid="ticket-code">{ticket.code}</p>
          {siblings.length > 1 && (
            <div className="flex justify-center gap-1.5">
              {siblings.map((s, i) => <button key={s.ticket.id} className={`h-2 rounded-full transition-all ${i === idx ? 'w-6 bg-action' : 'w-2 bg-zinc-300'}`} onClick={() => setPicked(i)} aria-label={`Ticket ${i + 1}`} />)}
            </div>
          )}
          <div className="space-y-2 border-t border-dashed border-line pt-4 text-sm">
            <p className="flex justify-between"><span className="text-ink-3">Ticket</span><span className="font-semibold">{ticketType.name}{ticket.isComp ? ' (comp)' : ''}</span></p>
            <p className="flex justify-between"><span className="text-ink-3">Holder</span><span className="font-semibold">{user?.name}</span></p>
            <p className="flex justify-between"><span className="text-ink-3">Order</span><Link to={`/orders/${order.id}`} className="font-semibold underline">{order.number}</Link></p>
            <p className="flex items-start gap-2 pt-1 text-ink-2"><Clock className="mt-0.5 h-4 w-4 shrink-0" />{longRange(ev.startsAt, ev.endsAt)}</p>
            <p className="flex items-start gap-2 text-ink-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{ev.venue.name}, {ev.venue.address}</p>
          </div>
        </div>
      </div>

      {!ended && ticket.status === 'valid' && (
        <div className="mt-5 grid gap-2">
          {ticket.transfer ? (
            <button className="btn btn-outline btn-lg" onClick={async () => { await api.cancelTransfer(ticket.id); toast.info('Transfer cancelled'); }}><Undo2 className="h-4 w-4" />Cancel transfer to {maskPhone(ticket.transfer.toPhone)}</button>
          ) : (
            <button className="btn btn-primary btn-lg" disabled={!transferable.length} onClick={() => { setSel([ticket.id]); setTransfer(true); }} data-testid="transfer-btn" title={!transferable.length ? 'Transfers are disabled for this ticket' : ''}>
              <ArrowRightLeft className="h-4 w-4" />Transfer tickets
            </button>
          )}
          {ticketType.waitlistEnabled && !ticket.isComp && !ticket.transfer && (
            <button className="btn btn-outline btn-lg" onClick={async () => { try { await api.returnToWaitlist(ticket.id); toast.success('Returned to the waitlist'); nav('/tickets'); } catch (e) { toast.error(e); } }}><RotateCcw className="h-4 w-4" />Return to waitlist</button>
          )}
          {order.total > 0 && order.source !== 'transfer' && (
            <button className="btn btn-ghost btn-lg" disabled={order.refundRequested} onClick={() => setRefund(true)}>{order.refundRequested ? 'Refund requested' : 'Request a refund'}</button>
          )}
          <Link to={`/e/${ev.slug}`} className="btn btn-ghost btn-lg">View event</Link>
        </div>
      )}

      <Modal open={transfer} onClose={() => setTransfer(false)} title="Transfer tickets"
        footer={<button className="btn btn-primary btn-lg w-full" disabled={!sel.length || !phone} data-testid="confirm-transfer" onClick={async () => { try { await api.startTransfer(sel, phone); toast.success('Transfer sent', 'It completes when they accept. You can cancel until then.'); setTransfer(false); } catch (e) { toast.error(e); } }}><Send className="h-4 w-4" />Send {sel.length} ticket{sel.length === 1 ? '' : 's'}</button>}>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="label">Select tickets</p>
            {transferable.map((s) => (
              <label key={s.ticket.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                <input type="checkbox" className="h-4 w-4 accent-black" checked={sel.includes(s.ticket.id)} onChange={(e) => setSel(e.target.checked ? [...sel, s.ticket.id] : sel.filter((x) => x !== s.ticket.id))} />
                <span className="text-sm font-semibold">{s.ticketType.name}</span><span className="ml-auto font-mono text-xs text-ink-3">{s.ticket.code}</span>
              </label>
            ))}
          </div>
          <Field label="Recipient’s mobile number" hint="If they’re new to Dekha Hobe, they’ll get a text to sign up and accept.">
            <input className="input" inputMode="tel" placeholder="01XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="transfer-phone" />
          </Field>
          <p className="rounded-xl bg-mist p-3 text-[13px] text-ink-2">Heads up: transferred tickets are non-refundable, and your QR code for them will stop working once accepted.</p>
        </div>
      </Modal>

      <Modal open={refund} onClose={() => setRefund(false)} title="Request a refund"
        footer={<button className="btn btn-primary btn-lg w-full" onClick={async () => { try { await api.requestRefund(order.id); toast.success('Refund requested', 'The organizer will review it.'); setRefund(false); } catch (e) { toast.error(e); } }}>Send request</button>}>
        <p className="text-sm text-ink-2">Refunds are at the organizer’s discretion. We’ll send your request for order <strong>{order.number}</strong> ({tk(order.total)}) to {t.org.name}. If approved, the money goes back to your {order.paymentMethod} within 5–7 working days.</p>
        <p className="mt-3 text-[13px] text-ink-3">Number on file: {prettyPhone(order.buyer.phone)}</p>
      </Modal>
    </div>
  );
}
