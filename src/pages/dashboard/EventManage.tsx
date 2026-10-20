import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Download, ExternalLink, Gift, Link2, ListChecks, Lock, Plus, ScanLine, Sparkles, Trash2, Users, X } from 'lucide-react';
import { api, type BpopEvent, type KickbackOffer, type Order, type PromoCode, type TicketType } from '@/api';
import { useApi } from '@/hooks/useApi';
import { PosterArt } from '@/components/PosterArt';
import { Badge, Empty, Field, Modal, PageSpinner, Stat, Stepper, Tabs, Toggle } from '@/components/ui';
import { dayLabel, dayYearLabel, displayPrice, downloadFile, longRange, prettyPhone, serviceFee, timeLabel, tk, toCsv, uid } from '@/lib/util';
import { toast } from '@/store/toast';
import { SalesChart, useCtx } from './Org';
import { BasicsFields, FlyerFields, fromEvent, LineupFields, SettingsFields, toPatch, validate, WhenWhereFields, type FormState } from './EventEditor';

type Tab = 'overview' | 'details' | 'tickets' | 'orders' | 'attendees' | 'marketing' | 'team' | 'door';

const save = async (ev: BpopEvent, patch: Partial<BpopEvent>, msg = 'Saved') => {
  try {
    await api.updateEvent(ev.id, patch);
    toast.success(msg);
    return true;
  } catch (e) {
    toast.error(e);
    return false;
  }
};

export default function EventManage() {
  const { id = '', tab = 'overview' } = useParams();
  const nav = useNavigate();
  const { role } = useCtx();
  const { data: ev, loading } = useApi(() => api.eventById(id), [id]);
  const [cancel, setCancel] = useState(false);
  if (loading && !ev) return <PageSpinner />;
  if (!ev) return <Empty title="Event not found" action={<Link to="/dashboard/events" className="btn btn-primary btn-md">All events</Link>} />;
  const manager = role === 'owner' || role === 'admin';
  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    ...(manager ? [{ id: 'details' as Tab, label: 'Details' }, { id: 'tickets' as Tab, label: 'Tickets' }] : []),
    ...(role !== 'doorperson' ? [{ id: 'orders' as Tab, label: 'Orders' }] : []),
    { id: 'attendees', label: 'Attendees' },
    ...(role !== 'doorperson' ? [{ id: 'marketing' as Tab, label: 'Marketing' }] : []),
    ...(manager ? [{ id: 'team' as Tab, label: 'Team & Tracking' }] : []),
    { id: 'door', label: 'Door' },
  ];
  const ended = new Date(ev.endsAt).getTime() < Date.now();

  return (
    <div>
      <Link to="/dashboard/events" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-3"><ArrowLeft className="h-4 w-4" />Events</Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-xl"><PosterArt poster={ev.poster} title={ev.title} showText={false} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-black tracking-tight" data-testid="manage-title">{ev.title}</h1><Badge tone={ev.status === 'published' ? (ended ? 'neutral' : 'ok') : ev.status === 'draft' ? 'warn' : 'bad'}>{ev.status === 'published' ? (ended ? 'Ended' : 'Live') : ev.status}</Badge>{ev.visibility === 'unlisted' && <Badge>Unlisted</Badge>}</div>
          <p className="text-sm text-ink-3">{longRange(ev.startsAt, ev.endsAt)} · {ev.venue.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/e/${ev.slug}`} className="btn btn-outline btn-sm"><ExternalLink className="h-4 w-4" />View page</Link>
          {manager && ev.status === 'draft' && <button className="btn btn-primary btn-sm" data-testid="publish-draft" onClick={async () => { const err = validate(fromEvent(ev), true); if (err) return toast.error(err); await save(ev, { status: 'published' }, 'Published 🎉'); }}>Publish</button>}
          {manager && <button className="btn btn-outline btn-sm" onClick={async () => { const d = await api.duplicateEvent(ev.id); toast.success('Duplicated as a draft'); nav(`/dashboard/events/${d.id}/details`); }}>Duplicate</button>}
          {manager && ev.status === 'published' && !ended && <button className="btn btn-ghost btn-sm text-bad" onClick={() => setCancel(true)}>Cancel event</button>}
          {manager && ev.status === 'draft' && <button className="btn btn-ghost btn-sm text-bad" onClick={async () => { try { await api.deleteDraft(ev.id); nav('/dashboard/events'); } catch (e) { toast.error(e); } }}>Delete draft</button>}
        </div>
      </div>
      <Tabs className="mt-6" value={tab as Tab} onChange={(t) => nav(`/dashboard/events/${ev.id}/${t === 'overview' ? '' : t}`)} tabs={tabs} />
      <div className="mt-6">
        {tab === 'overview' && <OverviewTab ev={ev} />}
        {tab === 'details' && manager && <DetailsTab ev={ev} />}
        {tab === 'tickets' && manager && <TicketsTab ev={ev} />}
        {tab === 'orders' && <OrdersTab ev={ev} manager={manager} />}
        {tab === 'attendees' && <AttendeesTab ev={ev} />}
        {tab === 'marketing' && <MarketingTab ev={ev} manager={manager} />}
        {tab === 'team' && manager && <TeamTab ev={ev} />}
        {tab === 'door' && <DoorTab ev={ev} />}
      </div>
      <Modal open={cancel} onClose={() => setCancel(false)} title="Cancel this event?" footer={<button className="btn btn-danger btn-lg w-full" onClick={async () => { await api.cancelEvent(ev.id); toast.success('Event cancelled — all orders refunded'); setCancel(false); }}>Cancel event & refund everyone</button>}>
        <p className="text-sm text-ink-2">Every paid order will be refunded in full, all tickets will be invalidated and attendees will be notified. This can’t be undone.</p>
      </Modal>
    </div>
  );
}

function OverviewTab({ ev }: { ev: BpopEvent }) {
  const { data: s } = useApi(() => api.eventStats(ev.id), [ev.id]);
  if (!s) return <PageSpinner />;
  const pct = s.ticketsSold ? (s.checkedIn / s.ticketsSold) * 100 : 0;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Net revenue" value={tk(s.revenue)} sub={`${tk(s.gross)} gross · ${tk(s.fees)} fees`} />
        <Stat label="Tickets sold" value={`${s.ticketsSold}${s.capacity ? ` / ${s.capacity}` : ''}`} sub={`${s.orders} orders`} />
        <Stat label="Page views" value={s.pageViews.toLocaleString()} sub={`${(s.conversion * 100).toFixed(1)}% conversion`} />
        <Stat label="Checked in" value={s.checkedIn} sub={`${pct.toFixed(0)}% of sold`} />
      </div>
      {(s.pendingApprovals > 0 || s.waitlist > 0) && (
        <div className="flex flex-wrap gap-2">
          {s.pendingApprovals > 0 && <Link to={`/dashboard/events/${ev.id}/orders`} className="btn btn-outline btn-sm">{s.pendingApprovals} pending approval →</Link>}
          {s.waitlist > 0 && <Link to={`/dashboard/events/${ev.id}/tickets`} className="btn btn-outline btn-sm">{s.waitlist} on waitlist →</Link>}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="card p-5"><h2 className="mb-3 font-bold">Sales · last 30 days</h2><SalesChart data={s.series} /></div>
        <div className="card p-5">
          <h2 className="mb-3 font-bold">By ticket type</h2>
          {s.byType.map((b) => (
            <div key={b.ticketType.id} className="border-b border-line py-3 last:border-0">
              <div className="flex justify-between text-sm"><span className="font-semibold">{b.ticketType.name}</span><span>{tk(b.revenue)}</span></div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-mist"><div className="h-full rounded-full bg-ink" style={{ width: `${b.ticketType.quantity ? Math.min(100, (b.sold / b.ticketType.quantity) * 100) : 0}%` }} /></div>
                <span className="text-xs text-ink-3">{b.sold}{b.ticketType.quantity ? `/${b.ticketType.quantity}` : ''}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailsTab({ ev }: { ev: BpopEvent }) {
  const [f, setF] = useState<FormState>(() => fromEvent(ev));
  const set = (p: Partial<FormState>) => setF((x) => ({ ...x, ...p }));
  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
      <div className="card p-5"><h2 className="mb-4 font-bold">Basics</h2><BasicsFields f={f} set={set} /></div>
      <div className="space-y-6">
        <div className="card p-5"><h2 className="mb-4 font-bold">When & where</h2><WhenWhereFields f={f} set={set} /></div>
        <div className="card p-5"><h2 className="mb-4 font-bold">Flyer</h2><FlyerFields f={f} set={set} /></div>
        <div className="card p-5"><h2 className="mb-4 font-bold">Lineup</h2><LineupFields f={f} set={set} /></div>
        <div className="card p-5"><h2 className="mb-2 font-bold">Settings</h2><SettingsFields f={f} set={set} /></div>
      </div>
      <div className="sticky bottom-4 lg:col-span-2">
        <button className="btn btn-primary btn-lg w-full shadow-card sm:w-auto" data-testid="save-details" onClick={async () => { const err = validate(f, false); if (err) return toast.error(err); await save(ev, toPatch(f), 'Event updated'); }}>Save changes</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- tickets

function TierModal({ ev, tier, onClose }: { ev: BpopEvent; tier: TicketType | null; onClose: () => void }) {
  const isNew = !tier?.id || !ev.ticketTypes.some((t) => t.id === tier.id);
  const [t, setT] = useState<TicketType>(() => tier ?? ({ id: uid('tt'), name: '', price: 0, quantity: 100, sold: 0, minPerOrder: 1, maxPerOrder: 10, hidden: false, inPersonOnly: false, allowTransfers: true, markedSoldOut: false, requireApproval: false, waitlistEnabled: false, waitlistResponseMins: 30, waitlistMaxPerUser: null, heldForWaitlist: 0, order: ev.ticketTypes.length } as TicketType));
  const [view, setView] = useState<'settings' | 'waitlist'>('settings');
  const [release, setRelease] = useState(1);
  const { data: wl } = useApi(() => api.waitlistFor(ev.id), [ev.id]);
  const mine = (wl ?? []).filter((w) => w.ticketTypeId === t.id);
  const waiting = mine.filter((w) => w.status === 'waiting').reduce((a, w) => a + w.qty, 0);
  const offered = mine.filter((w) => w.status === 'offered').reduce((a, w) => a + w.qty, 0);
  const u = (p: Partial<TicketType>) => setT((x) => ({ ...x, ...p }));
  const toIso = (v: string) => (v ? new Date(new Date(`${v}:00Z`).getTime() - 6 * 3600e3).toISOString() : undefined);
  const fromIso = (v?: string) => (v ? new Date(new Date(v).getTime() + 6 * 3600e3).toISOString().slice(0, 16) : '');

  return (
    <Modal open onClose={onClose} wide title={isNew ? 'New ticket type' : 'Edit ticket type'}
      footer={<div className="flex justify-between gap-2">
        {!isNew && t.sold === 0 ? <button className="btn btn-ghost btn-md text-bad" onClick={async () => { if (await save(ev, { ticketTypes: ev.ticketTypes.filter((x) => x.id !== t.id) }, 'Ticket type deleted')) onClose(); }}>Delete</button> : <span />}
        <button className="btn btn-primary btn-md" data-testid="save-tier" onClick={async () => { if (!t.name.trim()) return toast.error('Name your ticket type.'); const list = isNew ? [...ev.ticketTypes, t] : ev.ticketTypes.map((x) => (x.id === t.id ? t : x)); if (await save(ev, { ticketTypes: list }, 'Ticket type saved')) onClose(); }}>Save</button>
      </div>}>
      {!isNew && <Tabs className="mb-4" value={view} onChange={setView} tabs={[{ id: 'settings', label: 'Settings' }, { id: 'waitlist', label: 'Waitlist' }]} />}
      {view === 'settings' ? (
        <div className="space-y-4">
          <Field label="Ticket name"><input className="input" value={t.name} onChange={(e) => u({ name: e.target.value })} placeholder="General Admission" data-testid="tier-name" /></Field>
          <Field label="Description"><input className="input" value={t.description ?? ''} onChange={(e) => u({ description: e.target.value })} placeholder="Perks, arrival time…" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ticket price (what you earn, ৳)"><input className="input" inputMode="numeric" value={t.price} onChange={(e) => u({ price: Number(e.target.value.replace(/\D/g, '')) || 0 })} data-testid="tier-price" /></Field>
            <Field label="Quantity" hint={`Blank = unlimited · ${t.sold} sold`}><input className="input" inputMode="numeric" value={t.quantity ?? ''} onChange={(e) => u({ quantity: e.target.value === '' ? null : Number(e.target.value.replace(/\D/g, '')) })} data-testid="tier-qty" /></Field>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-mist p-3 text-center text-sm" data-testid="fee-calculator">
            <div><p className="text-xs text-ink-3">Ticket price</p><p className="font-bold">{tk(t.price)}</p></div>
            <div><p className="text-xs text-ink-3">+ Service fee</p><p className="font-bold">{tk(serviceFee(t.price))}</p></div>
            <div><p className="text-xs text-ink-3">= Display price</p><p className="font-bold">{tk(displayPrice(t.price))}</p></div>
          </div>
          {ev.ticketGroups.length > 0 && (
            <Field label="Ticket group"><select className="input" value={t.groupId ?? ''} onChange={(e) => u({ groupId: e.target.value || undefined })}><option value="">No group</option>{ev.ticketGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
          )}
          <details className="rounded-2xl border border-line p-4" open={!isNew}>
            <summary className="cursor-pointer text-sm font-bold">Advanced settings</summary>
            <div className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Sales start (BST)"><input type="datetime-local" className="input" value={fromIso(t.salesStart)} onChange={(e) => u({ salesStart: toIso(e.target.value) })} /></Field>
                <Field label="Sales end (BST)"><input type="datetime-local" className="input" value={fromIso(t.salesEnd)} onChange={(e) => u({ salesEnd: toIso(e.target.value) })} /></Field>
                <Field label="Min per order"><input className="input" inputMode="numeric" value={t.minPerOrder} onChange={(e) => u({ minPerOrder: Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1) })} /></Field>
                <Field label="Max per order" hint="Blank = no limit"><input className="input" inputMode="numeric" value={t.maxPerOrder ?? ''} onChange={(e) => u({ maxPerOrder: e.target.value === '' ? null : Math.max(1, Number(e.target.value.replace(/\D/g, ''))) })} /></Field>
              </div>
              {t.quantity !== null && t.minPerOrder > (t.quantity - t.sold) && <p className="text-[13px] text-warn">Minimum per order is higher than the tickets left — buyers will hit an error.</p>}
              <div className="divide-y divide-line">
                <Toggle checked={t.inPersonOnly} onChange={(v) => u({ inPersonOnly: v })} label="In-person only" hint="Visible on your page, sold only at the door." />
                <Toggle checked={t.allowTransfers} onChange={(v) => u({ allowTransfers: v })} label="Allow transfers" hint="Attendees can send these tickets to a friend." />
                <Toggle checked={t.markedSoldOut} onChange={(v) => u({ markedSoldOut: v, waitlistEnabled: v ? false : t.waitlistEnabled })} label="Mark as sold out" hint="Freezes sales now. This turns off the waitlist." />
                <Toggle checked={t.requireApproval} onChange={(v) => u({ requireApproval: v })} label="Require approval" hint="You review each order before tickets are issued." />
                <Toggle checked={!!t.password} onChange={(v) => u({ password: v ? 'CHANGE-ME' : undefined, hidden: v ? false : t.hidden })} label="Password protected" hint="Hidden until the buyer enters the password." />
                {t.password !== undefined && <div className="py-2"><input className="input" value={t.password} onChange={(e) => u({ password: e.target.value })} aria-label="Password" /></div>}
                <Toggle checked={t.hidden} disabled={!!t.password} onChange={(v) => u({ hidden: v })} label="Hide ticket" hint="Not shown publicly — use for comps and holds." />
              </div>
            </div>
          </details>
        </div>
      ) : (
        <div className="space-y-4">
          <Toggle checked={t.waitlistEnabled} disabled={t.markedSoldOut} onChange={(v) => u({ waitlistEnabled: v })} label="Waitlist" hint="When this ticket sells out, people can join a queue. Turning it off stops new sign-ups but keeps the current queue." />
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Current waitlist" value={waiting} />
            <Stat label="Tickets on offer" value={offered} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Offer response time (min)"><input className="input" inputMode="numeric" value={t.waitlistResponseMins} onChange={(e) => u({ waitlistResponseMins: Math.max(5, Number(e.target.value.replace(/\D/g, '')) || 30) })} /></Field>
            <Field label="Max tickets per user" hint="Blank = unlimited"><input className="input" inputMode="numeric" value={t.waitlistMaxPerUser ?? ''} onChange={(e) => u({ waitlistMaxPerUser: e.target.value === '' ? null : Math.max(1, Number(e.target.value.replace(/\D/g, ''))) })} /></Field>
          </div>
          <div className="rounded-2xl border border-line p-4">
            <p className="text-sm font-bold">Release more tickets</p>
            <p className="text-[13px] text-ink-3">Offered only to people on the current waitlist. Unmatched tickets are not released publicly.</p>
            <div className="mt-3 flex items-center gap-3">
              <Stepper value={release} min={1} max={Math.max(1, waiting)} onChange={setRelease} />
              <button className="btn btn-primary btn-md" disabled={!waiting || !t.waitlistEnabled} data-testid="release-now" onClick={async () => { try { await api.updateEvent(ev.id, { ticketTypes: ev.ticketTypes.map((x) => (x.id === t.id ? t : x)) }); const n = await api.releaseToWaitlist(ev.id, t.id, release); toast.success(`Offered ${n} ticket${n > 1 ? 's' : ''} to the waitlist`); } catch (e) { toast.error(e); } }}>Release now</button>
            </div>
          </div>
          {mine.length > 0 && (
            <div className="divide-y divide-line text-sm">
              {mine.slice(0, 20).map((w, i) => <div key={w.id} className="flex justify-between py-2"><span>{i + 1}. {w.user.name} · {w.qty}</span><Badge tone={w.status === 'offered' ? 'brand' : w.status === 'claimed' ? 'ok' : 'neutral'}>{w.status}</Badge></div>)}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function PromoModal({ ev, onClose }: { ev: BpopEvent; onClose: () => void }) {
  const [p, setP] = useState<PromoCode>({ id: uid('pc'), code: '', kind: 'percent', value: 10, limit: null, uses: 0, ticketTypeIds: null, active: true, createdAt: new Date().toISOString() });
  return (
    <Modal open onClose={onClose} title="New promo code" footer={<button className="btn btn-primary btn-lg w-full" data-testid="create-promo" onClick={async () => { const code = p.code.trim().toUpperCase(); if (!/^[A-Z0-9_-]{3,20}$/.test(code)) return toast.error('Codes are 3–20 letters/numbers.'); if (ev.promoCodes.some((x) => x.code === code)) return toast.error('That code already exists.'); if (p.kind === 'percent' && (p.value <= 0 || p.value > 100)) return toast.error('Percent must be 1–100.'); if (await save(ev, { promoCodes: [...ev.promoCodes, { ...p, code }] }, 'Promo code created')) onClose(); }}>Create promo code</button>}>
      <div className="space-y-4">
        <Field label="Promo code name"><input className="input uppercase" value={p.code} onChange={(e) => setP({ ...p, code: e.target.value.toUpperCase() })} placeholder="EARLYBIRD20" data-testid="promo-code" /></Field>
        <div className="flex gap-2">
          <button className={`chip ${p.kind === 'percent' ? 'chip-on' : ''}`} onClick={() => setP({ ...p, kind: 'percent' })}>%</button>
          <button className={`chip ${p.kind === 'flat' ? 'chip-on' : ''}`} onClick={() => setP({ ...p, kind: 'flat' })}>৳</button>
          <input className="input" inputMode="numeric" value={p.value} onChange={(e) => setP({ ...p, value: Number(e.target.value.replace(/\D/g, '')) || 0 })} aria-label="Discount value" />
        </div>
        <Field label="Usage limit (per order)">
          <div className="flex gap-2"><button className={`chip ${p.limit === null ? 'chip-on' : ''}`} onClick={() => setP({ ...p, limit: null })}>Unlimited</button><button className={`chip ${p.limit !== null ? 'chip-on' : ''}`} onClick={() => setP({ ...p, limit: 50 })}>Limited</button>{p.limit !== null && <input className="input" inputMode="numeric" value={p.limit} onChange={(e) => setP({ ...p, limit: Number(e.target.value.replace(/\D/g, '')) || 1 })} />}</div>
        </Field>
        <Field label="Ticket type restriction">
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-black" checked={p.ticketTypeIds === null} onChange={(e) => setP({ ...p, ticketTypeIds: e.target.checked ? null : [] })} />Unrestricted</label>
            {p.ticketTypeIds !== null && ev.ticketTypes.map((t) => <label key={t.id} className="flex items-center gap-2 pl-5 text-sm"><input type="checkbox" className="accent-black" checked={p.ticketTypeIds!.includes(t.id)} onChange={(e) => setP({ ...p, ticketTypeIds: e.target.checked ? [...p.ticketTypeIds!, t.id] : p.ticketTypeIds!.filter((x) => x !== t.id) })} />{t.name}</label>)}
          </div>
        </Field>
        <Toggle checked={p.active} onChange={(v) => setP({ ...p, active: v })} label="Activate promo code" />
      </div>
    </Modal>
  );
}

function TicketsTab({ ev }: { ev: BpopEvent }) {
  const [edit, setEdit] = useState<TicketType | null | 'new'>(null);
  const [promo, setPromo] = useState(false);
  const [group, setGroup] = useState('');
  const [comp, setComp] = useState({ phone: '', name: '', ticketTypeId: ev.ticketTypes[0]?.id ?? '', qty: 1 });
  const [guest, setGuest] = useState({ name: '', plus: 0 });
  const { data: attendees } = useApi(() => api.eventAttendees(ev.id), [ev.id]);
  const comps = (attendees ?? []).filter((a) => a.ticket.isComp);
  const base = `${location.origin}${location.pathname}#/e/${ev.slug}`;

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Ticket types</h2><button className="btn btn-primary btn-sm" onClick={() => setEdit('new')} data-testid="new-tier"><Plus className="h-4 w-4" />New ticket type</button></div>
        <div className="card divide-y divide-line">
          {[...ev.ticketTypes].sort((a, b) => a.order - b.order).map((t) => (
            <button key={t.id} className="flex w-full items-center gap-4 p-4 text-left hover:bg-mist/50" onClick={() => setEdit(t)} data-testid="tier-row">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t.name}</p>
                <p className="text-sm text-ink-3">{t.price ? `${tk(t.price)} → buyers pay ${tk(displayPrice(t.price))}` : 'Free'}{t.groupId && ` · ${ev.ticketGroups.find((g) => g.id === t.groupId)?.name ?? ''}`}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {t.hidden && <Badge>Hidden</Badge>}{t.password && <Badge tone="brand"><Lock className="h-3 w-3" />Password</Badge>}{t.inPersonOnly && <Badge>In-person only</Badge>}{t.requireApproval && <Badge tone="warn">Approval</Badge>}{t.waitlistEnabled && <Badge tone="brand">Waitlist</Badge>}{t.markedSoldOut && <Badge tone="bad">Marked sold out</Badge>}{!t.allowTransfers && <Badge>No transfers</Badge>}
                </div>
              </div>
              <div className="text-right text-sm"><p className="font-semibold">{t.sold}{t.quantity !== null ? ` / ${t.quantity}` : ' sold'}</p>{t.heldForWaitlist > 0 && <p className="text-xs text-brand-dark">{t.heldForWaitlist} held for waitlist</p>}</div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Ticket groups</h2>
        <div className="card p-4">
          {ev.ticketGroups.map((g) => (
            <div key={g.id} className="flex items-center justify-between border-b border-line py-2 last:border-0">
              <span className="text-sm font-semibold">{g.name} <span className="font-normal text-ink-3">· {ev.ticketTypes.filter((t) => t.groupId === g.id).length} ticket types</span></span>
              <div className="flex gap-2"><button className="text-sm underline" onClick={() => save(ev, { ticketGroups: ev.ticketGroups.map((x) => (x.id === g.id ? { ...x, hidden: !x.hidden } : x)) })}>{g.hidden ? 'Show' : 'Hide'}</button><button className="text-sm text-bad underline" onClick={() => save(ev, { ticketGroups: ev.ticketGroups.filter((x) => x.id !== g.id), ticketTypes: ev.ticketTypes.map((t) => (t.groupId === g.id ? { ...t, groupId: undefined } : t)) })}>Delete</button></div>
            </div>
          ))}
          <form className="mt-2 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!group.trim()) return; if (await save(ev, { ticketGroups: [...ev.ticketGroups, { id: uid('tg'), name: group.trim(), order: ev.ticketGroups.length, hidden: false }] }, 'Group created')) setGroup(''); }}>
            <input className="input" placeholder="Group name, e.g. VIP Packages" value={group} onChange={(e) => setGroup(e.target.value)} />
            <button className="btn btn-outline btn-md h-11"><Plus className="h-4 w-4" />Create</button>
          </form>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Promo codes</h2><button className="btn btn-primary btn-sm" onClick={() => setPromo(true)} data-testid="new-promo"><Plus className="h-4 w-4" />New promo code</button></div>
        <div className="card divide-y divide-line">
          {ev.promoCodes.length === 0 && <p className="p-4 text-sm text-ink-3">No promo codes yet.</p>}
          {ev.promoCodes.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 p-4" data-testid="promo-row">
              <span className="font-mono font-bold">{p.code}</span>
              <span className="text-sm text-ink-3">{p.kind === 'percent' ? `${p.value}% off` : `${tk(p.value)} off`} · {p.uses}{p.limit !== null ? `/${p.limit}` : ''} uses · {p.ticketTypeIds ? `${p.ticketTypeIds.length} ticket type(s)` : 'all tickets'}</span>
              <div className="ml-auto flex items-center gap-2">
                <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(`${base}?promo=${p.code}`).catch(() => undefined); toast.success('Shareable link copied — the code applies automatically'); }}><Link2 className="h-4 w-4" />Link</button>
                <Toggle checked={p.active} onChange={(v) => save(ev, { promoCodes: ev.promoCodes.map((x) => (x.id === p.id ? { ...x, active: v } : x)) })} label="" />
                <button className="btn btn-ghost h-8 w-8 p-0" aria-label="Delete code" onClick={() => save(ev, { promoCodes: ev.promoCodes.filter((x) => x.id !== p.id) }, 'Deleted')}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Gift className="h-5 w-5" />Complimentary tickets</h2>
        <div className="card p-4">
          <form className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto_auto]" onSubmit={async (e) => { e.preventDefault(); try { const t = await api.sendComps(ev.id, comp); toast.success(`Sent ${t.length} comp ticket${t.length > 1 ? 's' : ''}`); setComp({ ...comp, phone: '', name: '', qty: 1 }); } catch (err) { toast.error(err); } }}>
            <input className="input" placeholder="Mobile number" value={comp.phone} onChange={(e) => setComp({ ...comp, phone: e.target.value })} data-testid="comp-phone" />
            <input className="input" placeholder="Name (optional)" value={comp.name} onChange={(e) => setComp({ ...comp, name: e.target.value })} />
            <select className="input" value={comp.ticketTypeId} onChange={(e) => setComp({ ...comp, ticketTypeId: e.target.value })}>{ev.ticketTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <Stepper value={comp.qty} min={1} max={50} onChange={(n) => setComp({ ...comp, qty: n })} />
            <button className="btn btn-primary btn-md h-11" disabled={!comp.phone} data-testid="send-comp">Send</button>
          </form>
          <p className="mt-2 text-xs text-ink-3">Recipients get an SMS and the tickets appear in their account automatically. Comps can’t be transferred and don’t opt into SMS marketing.</p>
          {comps.length > 0 && (
            <div className="mt-3 divide-y divide-line">
              {comps.map((c) => (
                <div key={c.ticket.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{c.user.name} · {c.ticketType.name} · <span className="font-mono">{c.ticket.code}</span></span>
                  {c.ticket.status === 'cancelled' ? <Badge tone="bad">Cancelled</Badge> : <button className="text-bad underline" onClick={() => api.cancelComp(c.ticket.id).then(() => toast.info('Comp cancelled — QR no longer valid'))}>Cancel ticket</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><ListChecks className="h-5 w-5" />Private guest list</h2>
        <div className="card p-4">
          <form className="flex flex-wrap gap-2" onSubmit={async (e) => { e.preventDefault(); if (!guest.name.trim()) return; if (await save(ev, { guestList: [...ev.guestList, { id: uid('gl'), name: guest.name.trim(), plus: guest.plus, checkedIn: false }] }, 'Added to guest list')) setGuest({ name: '', plus: 0 }); }}>
            <input className="input flex-1" placeholder="Guest name" value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} data-testid="guest-name" />
            <div className="flex items-center gap-2 text-sm">+<Stepper value={guest.plus} min={0} max={5} onChange={(n) => setGuest({ ...guest, plus: n })} /></div>
            <button className="btn btn-primary btn-md h-11">Add</button>
          </form>
          <GuestListRows ev={ev} />
          <p className="mt-2 text-xs text-ink-3">Guest-list entries don’t get a QR code and aren’t included in attendee exports. Issue a comp if you need them in your reports.</p>
        </div>
      </section>

      {edit && <TierModal ev={ev} tier={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
      {promo && <PromoModal ev={ev} onClose={() => setPromo(false)} />}
    </div>
  );
}

export function GuestListRows({ ev }: { ev: BpopEvent }) {
  if (!ev.guestList.length) return <p className="mt-3 text-sm text-ink-3">No guests yet.</p>;
  return (
    <div className="mt-3 divide-y divide-line">
      {ev.guestList.map((g) => (
        <div key={g.id} className="flex items-center gap-3 py-2.5 text-sm" data-testid="guest-row">
          <span className="font-semibold">{g.name}</span>{g.plus > 0 && <Badge>+{g.plus}</Badge>}
          <span className="ml-auto flex items-center gap-2">
            {g.checkedIn && <span className="text-xs text-ok">Checked in {g.checkedInAt ? timeLabel(g.checkedInAt) : ''}</span>}
            <button className={`btn btn-sm ${g.checkedIn ? 'btn-outline' : 'btn-primary'}`} onClick={() => api.updateEvent(ev.id, { guestList: ev.guestList.map((x) => (x.id === g.id ? { ...x, checkedIn: !x.checkedIn, checkedInAt: !x.checkedIn ? new Date().toISOString() : undefined } : x)) }).catch(toast.error)}>{g.checkedIn ? 'Check out' : 'Check in'}</button>
            <button className="btn btn-ghost h-8 w-8 p-0" aria-label="Remove guest" onClick={() => api.updateEvent(ev.id, { guestList: ev.guestList.filter((x) => x.id !== g.id) }).catch(toast.error)}><X className="h-4 w-4" /></button>
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- orders & attendees

const ORDER_FILTERS = [['all', 'All'], ['pending_approval', 'Pending approval'], ['refund', 'Refund requested'], ['refunded', 'Refunded']] as const;

function OrdersTab({ ev, manager }: { ev: BpopEvent; manager: boolean }) {
  const { data } = useApi(() => api.eventOrders(ev.id), [ev.id]);
  const [f, setF] = useState<(typeof ORDER_FILTERS)[number][0]>('all');
  const [q, setQ] = useState('');
  const [refunding, setRefunding] = useState<Order | null>(null);
  if (!data) return <PageSpinner />;
  const list = data.filter((o) => (f === 'all' ? true : f === 'refund' ? o.refundRequested && o.status === 'paid' : o.status === f)).filter((o) => !q || `${o.buyer.name} ${o.number} ${o.buyer.phone}`.toLowerCase().includes(q.toLowerCase()));
  const pending = data.filter((o) => o.status === 'pending_approval').length;
  const exp = () => downloadFile(`${ev.slug}-orders.csv`, toCsv([['Order', 'Date', 'Name', 'Phone', 'Items', 'Subtotal', 'Fees', 'Discount', 'Total', 'Method', 'Status', 'Promo', 'Kickback', 'Tracking'], ...data.map((o: Order) => [o.number, o.createdAt, o.buyer.name, o.buyer.phone, o.items.map((i) => `${i.qty}x ${i.name}`).join('; '), o.subtotal, o.fees, o.discount, o.total, o.paymentMethod, o.status, o.promoCode, o.kickbackCode, o.trackingSlug])]), 'text/csv');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {ORDER_FILTERS.map(([v, l]) => <button key={v} className={`chip ${f === v ? 'chip-on' : ''}`} onClick={() => setF(v)}>{l}{v === 'pending_approval' && pending > 0 && <span className="ml-1 h-2 w-2 rounded-full bg-blue-500" />}</button>)}
        <input className="input ml-auto h-10 w-full sm:w-56" placeholder="Search orders" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-outline btn-md" onClick={exp}><Download className="h-4 w-4" />Export CSV</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line text-left text-xs text-ink-3"><tr><th className="p-3">Order</th><th className="p-3">Buyer</th><th className="p-3">Tickets</th><th className="p-3">Total</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
          <tbody className="divide-y divide-line">
            {list.slice(0, 200).map((o) => (
              <tr key={o.id} data-testid="order-row">
                <td className="p-3"><p className="font-semibold">{o.number}</p><p className="text-xs text-ink-3">{dayLabel(o.createdAt)} · {o.source}</p></td>
                <td className="p-3"><p className="font-semibold">{o.buyer.name}</p><p className="text-xs text-ink-3">{prettyPhone(o.buyer.phone)}</p></td>
                <td className="p-3">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}{o.promoCode && <Badge className="ml-1">{o.promoCode}</Badge>}{o.kickbackCode && <Badge tone="brand" className="ml-1">via {o.kickbackCode}</Badge>}</td>
                <td className="p-3 font-semibold">{tk(o.total)}<p className="text-xs font-normal text-ink-3">{o.paymentMethod}</p></td>
                <td className="p-3"><Badge tone={o.status === 'paid' ? 'ok' : o.status === 'pending_approval' ? 'warn' : 'neutral'}>{o.status.replace('_', ' ')}</Badge>{o.refundRequested && o.status === 'paid' && <Badge tone="bad" className="ml-1">refund requested</Badge>}{o.status === 'paid' && (o.refundedAmount ?? 0) > 0 && <Badge className="ml-1">{tk(o.refundedAmount!)} refunded</Badge>}</td>
                <td className="p-3 text-right">
                  {manager && o.status === 'pending_approval' && <span className="flex justify-end gap-1"><button className="btn btn-primary btn-sm" data-testid="approve" onClick={() => api.approveOrder(o.id, true).then(() => toast.success('Approved — tickets issued'), toast.error)}><Check className="h-4 w-4" /></button><button className="btn btn-outline btn-sm" onClick={() => api.approveOrder(o.id, false).then(() => toast.info('Declined'), toast.error)}><X className="h-4 w-4" /></button></span>}
                  {manager && o.status === 'paid' && o.total - (o.refundedAmount ?? 0) > 0 && <button className="btn btn-outline btn-sm" data-testid="refund" onClick={() => setRefunding(o)}>Refund</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="p-6 text-center text-sm text-ink-3">No orders here.</p>}
      </div>
      <Modal
        open={!!refunding}
        onClose={() => setRefunding(null)}
        title={refunding ? `Refund ${refunding.buyer.name}?` : ''}
        footer={
          <button
            className="btn btn-danger btn-lg w-full"
            data-testid="confirm-refund"
            onClick={() => {
              const o = refunding!;
              setRefunding(null);
              api.refundOrder(o.id).then(() => toast.success(`Order ${o.number} refunded`), toast.error);
            }}
          >
            Refund up to {refunding ? tk(refunding.total - (refunding.refundedAmount ?? 0)) : ''}
          </button>
        }
      >
        <p className="text-sm text-ink-2">Order {refunding?.number}. Only tickets the buyer still holds are refunded and cancelled. Tickets they transferred to someone else stay valid.</p>
      </Modal>
    </div>
  );
}

function AttendeesTab({ ev }: { ev: BpopEvent }) {
  const { data } = useApi(() => api.eventAttendees(ev.id), [ev.id]);
  const [q, setQ] = useState('');
  if (!data) return <PageSpinner />;
  const list = data.filter((a) => !q || `${a.user.name} ${a.user.phone} ${a.ticket.code}`.toLowerCase().includes(q.toLowerCase()));
  const checked = data.filter((a) => a.ticket.status === 'checked_in').length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm"><strong>{data.length}</strong> tickets · <strong>{checked}</strong> checked in</p>
        <input className="input ml-auto h-10 w-full sm:w-64" placeholder="Search name, phone or code" value={q} onChange={(e) => setQ(e.target.value)} data-testid="attendee-search" />
        <button className="btn btn-outline btn-md" onClick={() => downloadFile(`${ev.slug}-attendees.csv`, toCsv([['Name', 'Phone', 'Ticket', 'Code', 'Status', 'Checked in at', 'Order', 'Comp', 'Via waitlist'], ...data.map((a) => [a.user.name, a.user.phone, a.ticketType.name, a.ticket.code, a.ticket.status, a.ticket.checkedInAt, a.order.number, a.ticket.isComp, a.viaWaitlist])]), 'text/csv')}><Download className="h-4 w-4" />Export</button>
      </div>
      <div className="card divide-y divide-line">
        {list.slice(0, 300).map((a) => (
          <div key={a.ticket.id} className="flex items-center gap-3 p-3 text-sm" data-testid="attendee-row">
            <div className="min-w-0 flex-1"><p className="font-semibold">{a.user.name} {a.viaWaitlist && <span title="Joined via waitlist">⏳</span>}</p><p className="text-xs text-ink-3">{a.ticketType.name} · <span className="font-mono">{a.ticket.code}</span> · {prettyPhone(a.user.phone)}</p></div>
            {a.ticket.isComp && <Badge>Comp</Badge>}
            {a.ticket.status === 'checked_in' ? (
              <button className="btn btn-outline btn-sm" onClick={() => api.undoCheckIn(a.ticket.id)}>Undo check-in</button>
            ) : a.ticket.status === 'valid' ? (
              <button className="btn btn-primary btn-sm" onClick={() => api.scanTicket(ev.id, a.ticket.code, 'Dashboard').then((r) => toast.success(r.status === 'ok' ? `${a.user.name} checked in` : r.status))}>Check in</button>
            ) : <Badge tone="bad">{a.ticket.status}</Badge>}
          </div>
        ))}
        {list.length === 0 && <p className="p-6 text-center text-sm text-ink-3">No attendees yet.</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- marketing

function OfferModal({ ev, offer, onClose }: { ev: BpopEvent; offer: KickbackOffer | null; onClose: () => void }) {
  const publicTaken = ev.kickbackOffers.some((o) => o.isPublic && o.enabled && o.id !== offer?.id);
  const [o, setO] = useState<KickbackOffer>(() => offer ?? { id: uid('kb'), kind: 'percent', value: 10, per: 'order', ticketTypeIds: null, isPublic: !publicTaken, showBanner: true, enabled: true, affiliateIds: [], createdAt: new Date().toISOString() });
  return (
    <Modal open onClose={onClose} title={offer ? 'Edit offer' : 'New Kickback offer'} footer={<button className="btn btn-primary btn-lg w-full" data-testid="save-offer" onClick={async () => { if (o.value <= 0) return toast.error('Enter a commission.'); const list = offer ? ev.kickbackOffers.map((x) => (x.id === o.id ? o : x)) : [...ev.kickbackOffers, o]; if (await save(ev, { kickbackOffers: list }, 'Offer saved')) onClose(); }}>Save offer</button>}>
      <div className="space-y-4">
        <Field label="Commission earned">
          <div className="flex gap-2">
            <button className={`chip ${o.kind === 'percent' ? 'chip-on' : ''}`} onClick={() => setO({ ...o, kind: 'percent' })}>%</button>
            <button className={`chip ${o.kind === 'flat' ? 'chip-on' : ''}`} onClick={() => setO({ ...o, kind: 'flat' })}>৳</button>
            <input className="input" inputMode="numeric" value={o.value} onChange={(e) => setO({ ...o, value: Number(e.target.value.replace(/\D/g, '')) || 0 })} aria-label="Commission" data-testid="offer-value" />
          </div>
        </Field>
        <Field label="Payout trigger"><div className="flex gap-2"><button className={`chip ${o.per === 'ticket' ? 'chip-on' : ''}`} onClick={() => setO({ ...o, per: 'ticket' })}>Per ticket</button><button className={`chip ${o.per === 'order' ? 'chip-on' : ''}`} onClick={() => setO({ ...o, per: 'order' })}>Per order</button></div></Field>
        <Field label="Limit to ticket type(s)">
          <select className="input" value={o.ticketTypeIds?.[0] ?? ''} onChange={(e) => setO({ ...o, ticketTypeIds: e.target.value ? [e.target.value] : null })}><option value="">All ticket types</option>{ev.ticketTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        </Field>
        <Toggle checked={o.isPublic} disabled={publicTaken && !o.isPublic} onChange={(v) => setO({ ...o, isPublic: v })} label="Open to anyone" hint={publicTaken && !o.isPublic ? 'You already have an active public offer. Disable it first to create another.' : 'Any buyer or visitor can get a link. Off = private, invite-only affiliates.'} />
        {o.isPublic && <Toggle checked={o.showBanner} onChange={(v) => setO({ ...o, showBanner: v })} label="Display Kickback banner" hint="Shows “Turn invites into income” on your event and checkout pages." />}
      </div>
    </Modal>
  );
}

function MarketingTab({ ev, manager }: { ev: BpopEvent; manager: boolean }) {
  const { data: ledger } = useApi(() => api.kickbackLedger(ev.id), [ev.id]);
  const { data: tracking } = useApi(() => api.trackingStats(ev.id), [ev.id]);
  const [offer, setOffer] = useState<KickbackOffer | null | 'new'>(null);
  const [aff, setAff] = useState({ offerId: '', phone: '' });
  const [slug, setSlug] = useState('');
  const base = `${location.origin}${location.pathname}#/e/${ev.slug}`;
  const priv = ev.kickbackOffers.filter((o) => !o.isPublic);
  const offerStats = (id: string) => (ledger?.links ?? []).filter((l) => l.offerId === id).reduce((a, l) => ({ tickets: a.tickets + l.tickets, gmv: a.gmv + l.gmv }), { tickets: 0, gmv: 0 });
  const hosts = (tracking ?? []).filter((t) => t.link.kind === 'host');
  const links = (tracking ?? []).filter((t) => t.link.kind === 'tracking');

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-bold"><Sparkles className="h-5 w-5" />Kickback offers</h2>{manager && <button className="btn btn-primary btn-sm" onClick={() => setOffer('new')} data-testid="new-offer"><Plus className="h-4 w-4" />New offer</button>}</div>
        <div className="card divide-y divide-line">
          {ev.kickbackOffers.length === 0 && <p className="p-4 text-sm text-ink-3">Turn buyers into promoters: create an offer and they earn a commission on every sale they drive.</p>}
          {ev.kickbackOffers.map((o) => {
            const st = offerStats(o.id);
            return (
              <div key={o.id} className="flex flex-wrap items-center gap-3 p-4" data-testid="offer-row">
                <div className="min-w-0 flex-1"><p className="font-semibold">{o.kind === 'percent' ? `${o.value}%` : tk(o.value)} per {o.per} <Badge tone={o.isPublic ? 'brand' : 'neutral'}>{o.isPublic ? 'Public' : 'Private'}</Badge> {!o.enabled && <Badge tone="bad">Disabled</Badge>}</p><p className="text-sm text-ink-3">{o.ticketTypeIds ? ev.ticketTypes.find((t) => t.id === o.ticketTypeIds![0])?.name : 'All ticket types'} · {st.tickets} tickets · {tk(st.gmv)} revenue</p></div>
                {manager && <div className="flex gap-2"><button className="btn btn-outline btn-sm" onClick={() => setOffer(o)}>Edit</button><button className="btn btn-outline btn-sm" onClick={() => save(ev, { kickbackOffers: ev.kickbackOffers.map((x) => (x.id === o.id ? { ...x, enabled: !x.enabled } : x)) }, o.enabled ? 'Offer disabled' : 'Offer enabled')}>{o.enabled ? 'Disable' : 'Enable'}</button></div>}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Users className="h-5 w-5" />Kickback affiliates</h2>
        {manager && priv.length > 0 && (
          <form className="mb-3 flex flex-col gap-2 sm:flex-row" onSubmit={async (e) => { e.preventDefault(); try { await api.addAffiliate(ev.id, aff.offerId || priv[0]!.id, aff.phone); toast.success('Invite sent'); setAff({ ...aff, phone: '' }); } catch (err) { toast.error(err); } }}>
            <select className="input sm:w-56" value={aff.offerId || priv[0]!.id} onChange={(e) => setAff({ ...aff, offerId: e.target.value })}>{priv.map((o) => <option key={o.id} value={o.id}>Private · {o.kind === 'percent' ? `${o.value}%` : tk(o.value)} per {o.per}</option>)}</select>
            <input className="input" placeholder="Affiliate’s mobile number" value={aff.phone} onChange={(e) => setAff({ ...aff, phone: e.target.value })} />
            <button className="btn btn-primary btn-md h-11" disabled={!aff.phone}>Invite now</button>
          </form>
        )}
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-line text-left text-xs text-ink-3"><tr><th className="p-3">Affiliate</th><th className="p-3">Code</th><th className="p-3">Visits</th><th className="p-3">Tickets</th><th className="p-3">GMV</th><th className="p-3">Commission</th></tr></thead>
            <tbody className="divide-y divide-line">
              {(ledger?.links ?? []).map((l) => <tr key={l.code} data-testid="affiliate-row"><td className="p-3 font-semibold">{l.user.name}</td><td className="p-3 font-mono">{l.code}</td><td className="p-3">{l.visits}</td><td className="p-3">{l.tickets}</td><td className="p-3">{tk(l.gmv)}</td><td className="p-3 font-semibold">{tk(l.commission)}</td></tr>)}
            </tbody>
          </table>
          {!ledger?.links.length && <p className="p-4 text-sm text-ink-3">No affiliates yet.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold"><Link2 className="h-5 w-5" />Tracking links</h2>
        <p className="mb-3 text-sm text-ink-3">Measure where sales come from. Tracking links don’t earn Kickback commissions.</p>
        {manager && (
          <form className="mb-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); const s = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'); if (!s) return; if (ev.trackingLinks.some((t) => t.slug === s)) return toast.error('That link exists already.'); if (await save(ev, { trackingLinks: [...ev.trackingLinks, { id: uid('tl'), slug: s, kind: 'tracking', visits: 0, createdAt: new Date().toISOString() }] }, 'Tracking link created')) setSlug(''); }}>
            <input className="input" placeholder="Name, e.g. instagram-bio" value={slug} onChange={(e) => setSlug(e.target.value)} data-testid="tracking-slug" />
            <button className="btn btn-primary btn-md h-11"><Plus className="h-4 w-4" />Create</button>
          </form>
        )}
        <div className="card divide-y divide-line">
          {links.map((t) => (
            <div key={t.link.id} className="flex flex-wrap items-center gap-3 p-4 text-sm" data-testid="tracking-row">
              <span className="font-semibold">{t.link.slug}</span>
              <span className="text-ink-3">{t.link.visits} visits · {t.tickets} tickets · {tk(t.revenue)} · {t.link.visits ? ((t.orders / t.link.visits) * 100).toFixed(1) : '0.0'}% conv.</span>
              <button className="btn btn-ghost btn-sm ml-auto" onClick={() => { navigator.clipboard?.writeText(`${base}?t=${t.link.slug}`).catch(() => undefined); toast.success('Link copied'); }}><Copy className="h-4 w-4" />Copy</button>
              {manager && <button className="btn btn-ghost h-8 w-8 p-0" aria-label="Delete link" onClick={() => save(ev, { trackingLinks: ev.trackingLinks.filter((x) => x.id !== t.link.id) }, 'Deleted')}><Trash2 className="h-4 w-4" /></button>}
            </div>
          ))}
          {!links.length && <p className="p-4 text-sm text-ink-3">No tracking links yet.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-bold">Host sales</h2>
        <p className="mb-3 text-sm text-ink-3">Hosts on your team get a personal link automatically.</p>
        <div className="card divide-y divide-line">
          {hosts.map((t) => <div key={t.link.id} className="flex items-center justify-between p-4 text-sm"><span className="font-semibold">{t.link.slug.replace('host-', '@')}</span><span className="text-ink-3">{t.link.visits} visits · {t.tickets} tickets · {tk(t.revenue)}</span></div>)}
          {!hosts.length && <p className="p-4 text-sm text-ink-3">Add a team member with the Host role in Settings.</p>}
        </div>
      </section>
      {offer && <OfferModal ev={ev} offer={offer === 'new' ? null : offer} onClose={() => setOffer(null)} />}
    </div>
  );
}

function TeamTab({ ev }: { ev: BpopEvent }) {
  const { org } = useCtx();
  return (
    <div className="max-w-2xl space-y-6">
      <div className="card divide-y divide-line px-5 py-2">
        <Toggle checked={ev.showGuestlist} onChange={(v) => save(ev, { showGuestlist: v })} label="Show who’s going" />
        <Toggle checked={ev.chatEnabled} onChange={(v) => save(ev, { chatEnabled: v })} label="Event chat for ticket holders" />
        <Toggle checked={ev.visibility === 'public'} onChange={(v) => save(ev, { visibility: v ? 'public' : 'unlisted' })} label="Listed on Explore" />
      </div>
      <div className="card p-5">
        <h2 className="font-bold">Scanner PINs</h2>
        <p className="text-sm text-ink-3">Door staff open <strong>/scanner</strong> on any phone and enter a PIN — no login needed.</p>
        <div className="mt-3 flex flex-wrap gap-2">{org.scannerPins.map((p) => <span key={p.pin} className="rounded-xl bg-mist px-3 py-2 font-mono font-bold tracking-widest">{p.pin}<span className="ml-2 font-sans text-xs font-normal text-ink-3">{p.label}</span></span>)}</div>
        <Link to="/dashboard/settings" className="btn btn-outline btn-sm mt-3">Manage PINs & team</Link>
      </div>
    </div>
  );
}

function DoorTab({ ev }: { ev: BpopEvent }) {
  const { data: s } = useApi(() => api.eventStats(ev.id), [ev.id]);
  const sellable = ev.ticketTypes.filter((t) => !t.hidden);
  const [sale, setSale] = useState({ ticketTypeId: sellable.find((t) => t.inPersonOnly)?.id ?? sellable[0]?.id ?? '', qty: 1, method: 'cash' as 'cash' | 'bkash', name: '', phone: '' });
  const tier = ev.ticketTypes.find((t) => t.id === sale.ticketTypeId);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="card p-5">
          <p className="text-sm text-ink-3">Checked in</p>
          <p className="font-display text-4xl font-extrabold">{s?.checkedIn ?? 0}<span className="text-xl text-ink-4"> / {s?.ticketsSold ?? 0}</span></p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-mist"><div className="h-full rounded-full bg-ok" style={{ width: `${s?.ticketsSold ? (s.checkedIn / s.ticketsSold) * 100 : 0}%` }} /></div>
          <Link to={`/scanner?event=${ev.id}`} className="btn btn-primary btn-lg mt-5 w-full" data-testid="open-scanner"><ScanLine className="h-5 w-5" />Open ticket scanner</Link>
        </div>
        <div className="card p-5"><h2 className="font-bold">Private guest list</h2><GuestListRows ev={ev} /></div>
      </div>
      <div className="card space-y-4 p-5">
        <h2 className="font-bold">Sell at the door (In-Person Payments)</h2>
        <Field label="Ticket type"><select className="input" value={sale.ticketTypeId} onChange={(e) => setSale({ ...sale, ticketTypeId: e.target.value })}>{sellable.map((t) => <option key={t.id} value={t.id}>{t.name} · {tk(t.price)}{t.inPersonOnly ? ' (door only)' : ''}</option>)}</select></Field>
        <div className="flex items-center justify-between"><span className="text-sm font-semibold">Quantity</span><Stepper value={sale.qty} min={1} max={20} onChange={(n) => setSale({ ...sale, qty: n })} /></div>
        <Field label="Guest name"><input className="input" value={sale.name} onChange={(e) => setSale({ ...sale, name: e.target.value })} data-testid="door-name" /></Field>
        <Field label="Mobile (optional)" hint="We’ll text them their ticket."><input className="input" value={sale.phone} onChange={(e) => setSale({ ...sale, phone: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2"><button className={`chip justify-center ${sale.method === 'cash' ? 'chip-on' : ''}`} onClick={() => setSale({ ...sale, method: 'cash' })}>Cash</button><button className={`chip justify-center ${sale.method === 'bkash' ? 'chip-on' : ''}`} onClick={() => setSale({ ...sale, method: 'bkash' })}>bKash</button></div>
        <button className="btn btn-primary btn-lg w-full" disabled={!sale.name || !tier} data-testid="door-sell" onClick={async () => { try { const t = await api.doorSale(ev.id, sale); toast.success(`Sold ${t.length} — checked in`); setSale({ ...sale, name: '', phone: '', qty: 1 }); } catch (e) { toast.error(e); } }}>Charge {tier ? tk(tier.price * sale.qty) : ''}</button>
        <p className="text-xs text-ink-3">Door sales are checked in immediately. No service fee is added.</p>
        <p className="text-xs text-ink-3">{dayYearLabel(ev.startsAt)}</p>
      </div>
    </div>
  );
}
