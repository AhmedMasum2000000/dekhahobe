import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertCircle, Bot, Copy, Plus, Send, Trash2, Zap } from 'lucide-react';
import { api, CITIES, type City, type SmsBlast, type TeamRole } from '@/api';
import { useApi } from '@/hooks/useApi';
import { PosterArt } from '@/components/PosterArt';
import { Avatar, Badge, Empty, Field, Modal, PageSpinner, Stat, Tabs } from '@/components/ui';
import { ago, dayLabel, dayYearLabel, monthDay, prettyPhone, tk } from '@/lib/util';
import { toast } from '@/store/toast';
import type { DashCtx } from './Layout';

export const useCtx = () => useOutletContext<DashCtx>();

export function SalesChart({ data, height = 220 }: { data: { date: string; revenue: number; tickets: number }[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E6007E" stopOpacity={0.25} /><stop offset="1" stopColor="#E6007E" stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#EEE" />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#A1A1AA' }} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#A1A1AA' }} tickFormatter={(v: number) => (v >= 1000 ? `৳${Math.round(v / 1000)}k` : `৳${v}`)} />
          <Tooltip formatter={(v: number, n: string) => (n === 'revenue' ? tk(v) : v)} contentStyle={{ borderRadius: 12, border: '1px solid #E9E9EC', fontSize: 12 }} />
          <Area type="monotone" dataKey="revenue" stroke="#E6007E" strokeWidth={2} fill="url(#rev)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Overview() {
  const { org } = useCtx();
  const { data: s } = useApi(() => api.orgStats(org.id), [org.id]);
  const { data: evs } = useApi(() => api.orgEvents(org.id), [org.id]);
  if (!s || !evs) return <PageSpinner />;
  const upcoming = evs.filter((e) => new Date(e.event.endsAt).getTime() > Date.now() && e.event.status === 'published').reverse().slice(0, 4);
  const approvals = evs.reduce((a, e) => a + e.stats.pendingApprovals, 0);
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-sm text-ink-3">Welcome back</p><h1 className="text-3xl font-black tracking-tight">{org.name}</h1></div>
        <Link to="/create" className="btn btn-primary btn-md"><Plus className="h-4 w-4" />Create event</Link>
      </div>
      {approvals > 0 && (
        <Link to="/dashboard/events" className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm"><AlertCircle className="h-5 w-5 text-warn" /><span><strong>{approvals}</strong> order{approvals > 1 ? 's are' : ' is'} waiting for your approval.</span></Link>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Revenue (net)" value={tk(s.revenue)} sub="after fees & kickbacks" />
        <Stat label="Tickets sold" value={s.ticketsSold.toLocaleString()} sub={`${s.orders.toLocaleString()} orders`} />
        <Stat label="Page views" value={s.pageViews.toLocaleString()} sub={`${(s.conversion * 100).toFixed(1)}% conversion`} />
        <Stat label="Followers" value={s.followers.toLocaleString()} sub={`${s.attendees.toLocaleString()} unique attendees`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Sales · last 30 days</h2><Link to="/dashboard/insights" className="text-sm font-semibold underline">Insights</Link></div>
          <SalesChart data={s.series} />
        </div>
        <div className="card p-5">
          <h2 className="font-bold">Balance</h2>
          <p className="mt-2 font-display text-3xl font-extrabold">{tk(s.balance)}</p>
          {s.pendingBalance > 0 && <p className="text-sm text-ink-3">{tk(s.pendingBalance)} pending approval</p>}
          <Link to="/dashboard/finance" className="btn btn-primary btn-md mt-4 w-full"><Zap className="h-4 w-4" />Instant payout</Link>
          <div className="mt-6 rounded-2xl bg-mist p-4">
            <p className="flex items-center gap-2 text-sm font-bold"><Bot className="h-4 w-4" />Ask B-POP AI <Badge tone="brand">beta</Badge></p>
            <p className="mt-1 text-[13px] text-ink-3">“Which event performed best?”</p>
            <Link to="/dashboard/insights" className="mt-2 inline-block text-sm font-semibold underline">Ask a question</Link>
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 font-bold">Upcoming events</h2>
          {upcoming.length ? upcoming.map(({ event, stats }) => (
            <Link key={event.id} to={`/dashboard/events/${event.id}`} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              <div className="aspect-[4/5] w-11 shrink-0 overflow-hidden rounded-lg"><PosterArt poster={event.poster} title={event.title} showText={false} /></div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{event.title}</p><p className="text-xs text-ink-3">{dayLabel(event.startsAt)}</p></div>
              <div className="text-right text-sm"><p className="font-semibold">{stats.ticketsSold}{stats.capacity ? `/${stats.capacity}` : ''}</p><p className="text-xs text-ink-3">{tk(stats.revenue)}</p></div>
            </Link>
          )) : <p className="text-sm text-ink-3">No upcoming events. <Link to="/create" className="underline">Create one</Link>.</p>}
        </div>
        <div className="card p-5">
          <h2 className="mb-3 font-bold">Top events</h2>
          {s.topEvents.map(({ event, revenue, tickets }, i) => (
            <Link key={event.id} to={`/dashboard/events/${event.id}`} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              <span className="w-5 font-display font-extrabold text-ink-4">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{event.title}</span>
              <span className="text-sm">{tickets} · <strong>{tk(revenue)}</strong></span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function EventsList() {
  const { org, role } = useCtx();
  const [tab, setTab] = useState<'upcoming' | 'past' | 'drafts'>('upcoming');
  const { data } = useApi(() => api.orgEvents(org.id), [org.id]);
  if (!data) return <PageSpinner />;
  const now = Date.now();
  const list = data.filter(({ event: e }) => (tab === 'drafts' ? e.status === 'draft' : e.status !== 'draft' && (tab === 'upcoming' ? new Date(e.endsAt).getTime() >= now : new Date(e.endsAt).getTime() < now)));
  if (tab === 'upcoming') list.reverse();
  return (
    <div>
      <div className="flex items-center justify-between"><h1 className="text-3xl font-black tracking-tight">Events</h1>{(role === 'owner' || role === 'admin') && <Link to="/create" className="btn btn-primary btn-md"><Plus className="h-4 w-4" />Create event</Link>}</div>
      <Tabs className="mt-4" value={tab} onChange={setTab} tabs={[{ id: 'upcoming', label: 'Upcoming' }, { id: 'past', label: 'Past' }, { id: 'drafts', label: 'Drafts' }]} />
      <div className="mt-4 space-y-3">
        {list.length === 0 && <Empty title={tab === 'drafts' ? 'No drafts' : `No ${tab} events`} action={<Link to="/create" className="btn btn-primary btn-md">Create event</Link>} />}
        {list.map(({ event, stats }) => {
          const pct = stats.capacity ? Math.min(100, (stats.ticketsSold / stats.capacity) * 100) : 0;
          return (
            <div key={event.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center" data-testid="dash-event-row">
              <Link to={`/dashboard/events/${event.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                <div className="aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-xl"><PosterArt poster={event.poster} title={event.title} showText={false} /></div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><p className="truncate font-bold">{event.title}</p>{event.status !== 'published' && <Badge tone={event.status === 'draft' ? 'warn' : 'bad'}>{event.status}</Badge>}</div>
                  <p className="text-sm text-ink-3">{dayYearLabel(event.startsAt)} · {event.venue.name}</p>
                  {stats.capacity !== null && <div className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-mist"><div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} /></div>}
                </div>
              </Link>
              <div className="flex items-center gap-6 text-sm">
                <div><p className="text-xs text-ink-3">Sold</p><p className="font-semibold">{stats.ticketsSold}{stats.capacity ? ` / ${stats.capacity}` : ''}</p></div>
                <div><p className="text-xs text-ink-3">Revenue</p><p className="font-semibold">{tk(stats.revenue)}</p></div>
                {stats.pendingApprovals > 0 && <Badge tone="warn">{stats.pendingApprovals} pending</Badge>}
                <Link to={`/dashboard/events/${event.id}`} className="btn btn-outline btn-sm">Manage</Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Insights() {
  const { org } = useCtx();
  const { data: evs } = useApi(() => api.orgEvents(org.id), [org.id]);
  const { data: s } = useApi(() => api.orgStats(org.id), [org.id]);
  const [q, setQ] = useState('');
  const [chat, setChat] = useState<{ q: string; a: string }[]>([]);
  const [busy, setBusy] = useState(false);
  if (!evs || !s) return <PageSpinner />;
  const byEvent = evs.filter((e) => e.event.status !== 'draft').map((e) => ({ name: `${e.event.title.length > 16 ? `${e.event.title.slice(0, 16)}…` : e.event.title} · ${monthDay(e.event.startsAt)}`, revenue: e.stats.revenue, tickets: e.stats.ticketsSold })).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  const ask = async (question: string) => {
    if (!question.trim()) return;
    setBusy(true);
    const a = await api.askAi(org.id, question);
    setChat((c) => [...c, { q: question, a }]);
    setQ('');
    setBusy(false);
  };
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black tracking-tight">Insights</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Revenue" value={tk(s.revenue)} />
        <Stat label="Avg. order" value={tk(s.orders ? s.revenue / s.orders : 0)} />
        <Stat label="Conversion" value={`${(s.conversion * 100).toFixed(1)}%`} />
        <Stat label="Attendees" value={s.attendees.toLocaleString()} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5"><h2 className="mb-3 font-bold">Revenue · last 30 days</h2><SalesChart data={s.series} /></div>
        <div className="card p-5">
          <h2 className="mb-3 font-bold">Revenue by event</h2>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byEvent} layout="vertical" margin={{ left: 20, right: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: '#3F3F46' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => tk(v)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#0A0A0A" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="card p-5">
        <h2 className="flex items-center gap-2 font-bold"><Bot className="h-5 w-5" />Ask B-POP AI <Badge tone="brand">beta</Badge></h2>
        <p className="text-sm text-ink-3">Answers come from your own event data.</p>
        <div className="mt-4 space-y-3" data-testid="ai-chat">
          {chat.map((c, i) => (
            <div key={i} className="space-y-2">
              <p className="ml-auto w-fit max-w-[80%] rounded-2xl bg-ink px-4 py-2 text-sm text-white">{c.q}</p>
              <p className="w-fit max-w-[90%] rounded-2xl bg-mist px-4 py-2 text-sm">{c.a.split(/(\*\*[^*]+\*\*)/g).map((seg, k) => (seg.startsWith('**') ? <strong key={k}>{seg.slice(2, -2)}</strong> : <span key={k}>{seg}</span>))}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {['Which event performed best?', 'How are my kickbacks doing?', 'What’s my conversion rate?', 'Who’s on the waitlist?', 'What’s next?'].map((p) => <button key={p} className="chip h-8 text-[13px]" onClick={() => ask(p)} disabled={busy}>{p}</button>)}
        </div>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void ask(q); }}>
          <input className="input" placeholder="Ask anything about your events…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="ai-input" />
          <button className="btn btn-primary btn-md h-11" disabled={busy || !q.trim()}>Ask</button>
        </form>
      </div>
    </div>
  );
}

export function Sms() {
  const { org } = useCtx();
  const [audience, setAudience] = useState<SmsBlast['audience']>('followers');
  const [eventId, setEventId] = useState('');
  const [body, setBody] = useState('');
  const { data: evs } = useApi(() => api.orgEvents(org.id), [org.id]);
  const { data: size } = useApi(() => api.smsAudienceSize(org.id, audience, eventId || undefined), [org.id, audience, eventId]);
  const { data: history } = useApi(() => api.smsBlasts(org.id), [org.id]);
  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-black tracking-tight">SMS campaigns</h1><p className="text-ink-3">Unlimited free SMS blasts to people who opted in.</p></div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card space-y-4 p-5">
          <Field label="Audience">
            <div className="grid gap-2 sm:grid-cols-3">
              {([['followers', 'Followers'], ['all_attendees', 'All past attendees'], ['event_attendees', 'One event’s attendees']] as const).map(([v, l]) => (
                <button key={v} className={`chip justify-center ${audience === v ? 'chip-on' : ''}`} onClick={() => setAudience(v)}>{l}</button>
              ))}
            </div>
          </Field>
          {audience === 'event_attendees' && (
            <Field label="Event"><select className="input" value={eventId} onChange={(e) => setEventId(e.target.value)}><option value="">Choose an event</option>{evs?.map((e) => <option key={e.event.id} value={e.event.id}>{e.event.title} · {dayLabel(e.event.startsAt)}</option>)}</select></Field>
          )}
          <Field label="Message" hint={`${body.length}/320 · "Reply STOP to opt out" is added automatically.`}>
            <textarea className="textarea" rows={4} maxLength={320} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Last 50 GA tickets for Friday! Grab yours 👉 bpop.tags/e/…" data-testid="sms-body" />
          </Field>
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-3">Sends to <strong className="text-ink">{size ?? '…'}</strong> opted-in people</p>
            <button className="btn btn-primary btn-md" disabled={!body.trim() || !size} data-testid="sms-send" onClick={async () => { try { const b = await api.sendSmsBlast(org.id, { audience, eventId: eventId || undefined, body }); toast.success(`Sent to ${b.recipients} people`); setBody(''); } catch (e) { toast.error(e); } }}>
              <Send className="h-4 w-4" />Send blast
            </button>
          </div>
          <p className="text-xs text-ink-3">Complimentary-ticket recipients don’t enter SMS consent and are never included.</p>
        </div>
        <div className="rounded-4xl border-[6px] border-ink bg-mist p-4">
          <p className="text-center text-xs font-semibold text-ink-3">Preview</p>
          <div className="mt-3 max-w-[90%] rounded-2xl rounded-bl-sm bg-white p-3 text-sm shadow-sm">{org.name}: {body || 'Your message…'} Reply STOP to opt out.</div>
        </div>
      </div>
      <div className="card p-5">
        <h2 className="mb-2 font-bold">History</h2>
        {history?.length ? history.map((h) => (
          <div key={h.id} className="flex items-start justify-between gap-3 border-b border-line py-3 last:border-0">
            <p className="text-sm">{h.body}</p>
            <p className="shrink-0 text-right text-xs text-ink-3">{h.recipients} recipients<br />{ago(h.createdAt)}</p>
          </div>
        )) : <p className="text-sm text-ink-3">No blasts yet.</p>}
      </div>
    </div>
  );
}

export function Finance() {
  const { org, role } = useCtx();
  const { data: s } = useApi(() => api.orgStats(org.id), [org.id]);
  const { data: payouts } = useApi(() => api.payouts(org.id), [org.id]);
  const [amount, setAmount] = useState('');
  const [instant, setInstant] = useState(true);
  const [addMethod, setAddMethod] = useState(false);
  const [m, setM] = useState({ kind: 'bkash' as 'bkash' | 'nagad' | 'bank', number: '' });
  if (!s) return <PageSpinner />;
  const amt = Number(amount) || 0;
  const fee = instant && amt ? Math.max(10, Math.round(amt * 0.015)) : 0;
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black tracking-tight">Finance</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <p className="text-sm text-ink-3">Available balance</p>
          <p className="font-display text-4xl font-extrabold" data-testid="balance">{tk(s.balance)}</p>
          {s.pendingBalance > 0 && <p className="text-sm text-ink-3">+ {tk(s.pendingBalance)} pending approval</p>}
          {s.doorCollected > 0 && <p className="text-sm text-ink-3" data-testid="door-collected">{tk(s.doorCollected)} collected at the door — already in your hands, so it isn’t part of this balance.</p>}
          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Amount (৳)"><input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 25000" data-testid="payout-amount" /></Field>
            <div className="flex items-end gap-2">
              <button className={`chip h-11 ${!instant ? 'chip-on' : ''}`} onClick={() => setInstant(false)}>Standard · free</button>
              <button className={`chip h-11 ${instant ? 'chip-on' : ''}`} onClick={() => setInstant(true)}><Zap className="h-4 w-4" />Instant · 1.5%</button>
            </div>
          </div>
          <p className="mt-2 text-sm text-ink-3">{instant ? `Arrives in seconds. Fee ${tk(fee)}.` : 'Arrives in 1–2 working days.'} To {org.payoutMethods.find((p) => p.primary)?.label ?? 'no account yet'}.</p>
          <button className="btn btn-primary btn-lg mt-4" disabled={role !== 'owner' || !amt} data-testid="payout-btn" onClick={async () => { try { const p = await api.requestPayout(org.id, amt, instant); toast.success(p.instant ? `${tk(p.amount)} sent instantly` : `${tk(p.amount)} payout requested`); setAmount(''); } catch (e) { toast.error(e); } }}>
            {instant ? 'Instant payout' : 'Request payout'}
          </button>
          {role !== 'owner' && <p className="mt-2 text-xs text-ink-3">Only owners can withdraw.</p>}
        </div>
        <div className="card p-5">
          <h2 className="font-bold">Payout accounts</h2>
          {org.payoutMethods.map((p) => <p key={p.id} className="mt-3 flex items-center justify-between text-sm"><span>{p.label}</span>{p.primary && <Badge>Primary</Badge>}</p>)}
          {!org.payoutMethods.length && <p className="mt-2 text-sm text-ink-3">Add an account to get paid.</p>}
          <button className="btn btn-outline btn-sm mt-4" disabled={role !== 'owner'} onClick={() => setAddMethod(true)}><Plus className="h-4 w-4" />Add account</button>
          {role !== 'owner' && <p className="mt-2 text-xs text-ink-3">Only owners can change payout accounts.</p>}
        </div>
      </div>
      <div className="card p-5">
        <h2 className="mb-2 font-bold">Payout history</h2>
        {payouts?.length ? payouts.map((p) => (
          <div key={p.id} className="flex items-center justify-between border-b border-line py-3 text-sm last:border-0">
            <span>{dayYearLabel(p.createdAt)} · {p.methodLabel} {p.instant && <Badge tone="brand"><Zap className="h-3 w-3" />Instant</Badge>}</span>
            <span className="text-right"><strong>{tk(p.amount)}</strong>{p.fee > 0 && <span className="block text-xs text-ink-3">fee {tk(p.fee)}</span>}<Badge tone={p.status === 'paid' ? 'ok' : 'warn'} className="ml-2">{p.status}</Badge></span>
          </div>
        )) : <p className="text-sm text-ink-3">No payouts yet.</p>}
      </div>
      <Modal open={addMethod} onClose={() => setAddMethod(false)} title="Add payout account" footer={<button className="btn btn-primary btn-lg w-full" disabled={m.number.replace(/\D/g, '').length < 8} onClick={async () => { const label = `${m.kind === 'bank' ? 'Bank' : m.kind === 'bkash' ? 'bKash' : 'Nagad'} •••• ${m.number.replace(/\D/g, '').slice(-4)}`; await api.updateOrg(org.id, { payoutMethods: [...org.payoutMethods.map((p) => ({ ...p, primary: false })), { id: crypto.randomUUID(), kind: m.kind, label, primary: true }] }); toast.success('Account added'); setAddMethod(false); }}>Save</button>}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">{(['bkash', 'nagad', 'bank'] as const).map((k) => <button key={k} className={`chip justify-center ${m.kind === k ? 'chip-on' : ''}`} onClick={() => setM({ ...m, kind: k })}>{k === 'bkash' ? 'bKash' : k === 'nagad' ? 'Nagad' : 'Bank'}</button>)}</div>
          <Field label={m.kind === 'bank' ? 'Account number' : 'Merchant / personal number'}><input className="input" value={m.number} onChange={(e) => setM({ ...m, number: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}

export function OrgSettings() {
  const { org } = useCtx();
  const [f, setF] = useState({ name: org.name, slug: org.slug, bio: org.bio, city: org.city, instagram: org.instagram ?? '', website: org.website ?? '', contactEmail: org.contactEmail ?? '' });
  const [member, setMember] = useState({ phone: '', role: 'host' as TeamRole });
  const [pinLabel, setPinLabel] = useState('');
  const { data: team } = useApi(async () => {
    const followers = await api.orgFollowers(org.id).catch(() => []);
    return { followers: followers.length };
  }, [org.id]);
  const { data: members } = useApi(() => api.teamMembers(org.id), [org.id, org.team.length]);
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-black tracking-tight">Settings</h1>
      <section className="card space-y-4 p-5">
        <h2 className="font-bold">Organization profile</h2>
        <div className="flex items-center gap-4">
          <Avatar name={org.name} hue={org.avatarHue} url={org.avatarUrl} size={64} />
          <label className="btn btn-outline btn-sm cursor-pointer">Upload logo<input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 600_000) return toast.error('Choose an image under 600 KB.'); const r = new FileReader(); r.onload = () => api.updateOrg(org.id, { avatarUrl: String(r.result) }).then(() => toast.success('Logo updated')); r.readAsDataURL(file); }} /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Profile URL" hint={`bpop.tags/g/${f.slug}`}><input className="input" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} /></Field>
        </div>
        <Field label="Bio"><textarea className="textarea" rows={3} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City"><select className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value as City })}>{CITIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Instagram"><input className="input" value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value.replace(/^@/, '') })} /></Field>
          <Field label="Website"><input className="input" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="https://" /></Field>
          <Field label="Contact email"><input className="input" type="email" value={f.contactEmail} onChange={(e) => setF({ ...f, contactEmail: e.target.value })} /></Field>
        </div>
        <button className="btn btn-primary btn-md" onClick={async () => { try { await api.updateOrg(org.id, { ...f, website: f.website || undefined, contactEmail: f.contactEmail || undefined, instagram: f.instagram || undefined }); toast.success('Saved'); } catch (e) { toast.error(e); } }}>Save</button>
        <p className="text-xs text-ink-3">{team?.followers ?? 0} followers · {org.verified ? 'Verified organizer' : 'Verification is granted after your first successful events.'}</p>
      </section>

      <section className="card p-5">
        <h2 className="font-bold">Team</h2>
        <p className="text-sm text-ink-3">Admins manage everything. Hosts get a personal sales link. Doorpersons can only scan tickets.</p>
        <div className="mt-3 divide-y divide-line">
          {org.team.map((t) => {
            const u = members?.find((x) => x.user.id === t.userId)?.user;
            return (
              <div key={t.userId} className="flex items-center gap-3 py-3">
                <Avatar name={u?.name ?? '?'} hue={u?.avatarHue ?? 0} size={34} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{u?.name ?? 'Invited user'}</p><p className="text-xs text-ink-3">{u ? prettyPhone(u.phone) : ''}</p></div>
                <Badge>{t.role}</Badge>
                {t.role !== 'owner' && <button className="btn btn-ghost h-8 w-8 p-0" aria-label="Remove" onClick={async () => { try { await api.removeTeamMember(org.id, t.userId); } catch (e) { toast.error(e); } }}><Trash2 className="h-4 w-4" /></button>}
              </div>
            );
          })}
        </div>
        <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={async (e) => { e.preventDefault(); try { await api.addTeamMember(org.id, member.phone, member.role); toast.success('Team member added'); setMember({ ...member, phone: '' }); } catch (err) { toast.error(err); } }}>
          <input className="input" placeholder="Mobile number" value={member.phone} onChange={(e) => setMember({ ...member, phone: e.target.value })} />
          <select className="input sm:w-40" value={member.role} onChange={(e) => setMember({ ...member, role: e.target.value as TeamRole })}><option value="admin">Admin</option><option value="host">Host</option><option value="doorperson">Doorperson</option></select>
          <button className="btn btn-primary btn-md h-11" disabled={!member.phone}>Add</button>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="font-bold">Scanner PINs</h2>
        <p className="text-sm text-ink-3">Give door staff a PIN — they open <strong>/scanner</strong> on any phone and scan without logging in. Delete a PIN to revoke access instantly.</p>
        <div className="mt-3 divide-y divide-line">
          {org.scannerPins.map((p) => (
            <div key={p.pin} className="flex items-center gap-3 py-3">
              <span className="font-mono text-lg font-bold tracking-widest" data-testid="scanner-pin">{p.pin}</span>
              <span className="text-sm text-ink-3">{p.label} · secret <code>{p.secret}</code></span>
              <button className="btn btn-ghost ml-auto h-8 w-8 p-0" aria-label="Copy" onClick={() => { navigator.clipboard?.writeText(p.pin).catch(() => undefined); toast.success('PIN copied'); }}><Copy className="h-4 w-4" /></button>
              <button className="btn btn-ghost h-8 w-8 p-0" aria-label="Delete PIN" onClick={() => api.deleteScannerPin(org.id, p.pin)}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          {!org.scannerPins.length && <p className="py-3 text-sm text-ink-3">No PINs yet.</p>}
        </div>
        <form className="mt-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); const p = await api.createScannerPin(org.id, pinLabel); toast.success(`PIN ${p.pin} created`); setPinLabel(''); }}>
          <input className="input" placeholder="Label (e.g. Main door)" value={pinLabel} onChange={(e) => setPinLabel(e.target.value)} />
          <button className="btn btn-primary btn-md h-11"><Plus className="h-4 w-4" />Add PIN</button>
        </form>
      </section>
    </div>
  );
}

