import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Dices, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { api, CATEGORIES, CITIES, type BpopEvent, type Category, type City, type Poster, type TicketType } from '@/api';
import { useApi } from '@/hooks/useApi';
import { PosterArt } from '@/components/PosterArt';
import { Badge, Field, Logo, PageSpinner, Toggle } from '@/components/ui';
import { displayPrice, longRange, serviceFee, tk, uid } from '@/lib/util';
import { useActiveOrg } from '@/store/org';
import { toast } from '@/store/toast';
import { CreateOrgForm } from './Layout';
import { RequireLogin } from '../Login';

const CITY_COORDS: Record<City, [number, number]> = {
  Dhaka: [23.7808, 90.4093],
  Chattogram: [22.3569, 91.7832],
  Sylhet: [24.8949, 91.8687],
  "Cox's Bazar": [21.4272, 91.9702],
  Rajshahi: [24.3745, 88.6042],
  Khulna: [22.8456, 89.5403],
};
const STYLES: Poster['style'][] = ['gradient', 'sun', 'grid', 'wave', 'type'];

// <input type="datetime-local"> values are Bangladesh time (UTC+6)
export const toDhakaInput = (iso: string) => new Date(new Date(iso).getTime() + 6 * 3600e3).toISOString().slice(0, 16);
export const fromDhakaInput = (v: string) => {
  const [d, t] = v.split('T') as [string, string];
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  const [h, min] = (t ?? '00:00').split(':').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, day, h - 6, min)).toISOString();
};

export interface FormState {
  title: string;
  tagline: string;
  category: Category;
  description: string;
  start: string;
  end: string;
  venueName: string;
  address: string;
  city: City;
  revealLater: boolean;
  poster: Poster;
  lineup: { id: string; name: string; hue: number }[];
  tiers: Pick<TicketType, 'id' | 'name' | 'price' | 'quantity' | 'description'>[];
  rsvpOnly: boolean;
  visibility: 'public' | 'unlisted';
  ageLimit: string;
  showGuestlist: boolean;
  chatEnabled: boolean;
}

export function fromEvent(e: BpopEvent): FormState {
  return {
    title: e.title,
    tagline: e.tagline ?? '',
    category: e.category,
    description: e.description,
    start: toDhakaInput(e.startsAt),
    end: toDhakaInput(e.endsAt),
    venueName: e.venue.name,
    address: e.venue.address,
    city: e.venue.city,
    revealLater: !!e.venue.revealLater,
    poster: e.poster,
    lineup: e.lineup,
    tiers: e.ticketTypes.map((t) => ({ id: t.id, name: t.name, price: t.price, quantity: t.quantity, description: t.description })),
    rsvpOnly: e.rsvpOnly,
    visibility: e.visibility,
    ageLimit: e.ageLimit ?? '',
    showGuestlist: e.showGuestlist,
    chatEnabled: e.chatEnabled,
  };
}

function blank(): FormState {
  const start = new Date(Date.now() + 7 * 86400e3);
  start.setUTCHours(15, 0, 0, 0); // 9pm Dhaka
  return {
    title: '',
    tagline: '',
    category: 'Nightlife',
    description: '',
    start: toDhakaInput(start.toISOString()),
    end: toDhakaInput(new Date(start.getTime() + 4 * 3600e3).toISOString()),
    venueName: '',
    address: '',
    city: 'Dhaka',
    revealLater: false,
    poster: { seed: Math.floor(Math.random() * 1e5), style: 'gradient', hues: [300, 20] },
    lineup: [],
    tiers: [{ id: uid('tt'), name: 'General Admission', price: 800, quantity: 200 }],
    rsvpOnly: false,
    visibility: 'public',
    ageLimit: '',
    showGuestlist: true,
    chatEnabled: true,
  };
}

export function toPatch(f: FormState): Partial<BpopEvent> {
  const [lat, lng] = CITY_COORDS[f.city];
  return {
    title: f.title.trim(),
    tagline: f.tagline.trim() || undefined,
    category: f.category,
    description: f.description,
    startsAt: fromDhakaInput(f.start),
    endsAt: fromDhakaInput(f.end),
    venue: { name: f.venueName.trim() || 'Venue TBA', address: f.address.trim() || f.city, city: f.city, lat, lng, revealLater: f.revealLater },
    poster: f.poster,
    lineup: f.lineup.filter((l) => l.name.trim()),
    rsvpOnly: f.rsvpOnly,
    visibility: f.visibility,
    ageLimit: f.ageLimit.trim() || undefined,
    showGuestlist: f.showGuestlist,
    chatEnabled: f.chatEnabled,
  };
}

export function validate(f: FormState, withTickets: boolean): string | null {
  if (!f.title.trim()) return 'Give your event a title.';
  if (!f.start || !f.end) return 'Set a start and end time.';
  if (new Date(fromDhakaInput(f.end)) <= new Date(fromDhakaInput(f.start))) return 'The event must end after it starts.';
  if (!f.venueName.trim()) return 'Add a venue name.';
  if (withTickets) {
    if (!f.tiers.length) return 'Add at least one ticket type.';
    for (const t of f.tiers) {
      if (!t.name.trim()) return 'Every ticket type needs a name.';
      if (t.price < 0) return 'Prices can’t be negative.';
      if (t.quantity !== null && t.quantity < 1) return `${t.name}: quantity must be at least 1 (leave blank for unlimited).`;
    }
  }
  return null;
}

export function BasicsFields({ f, set }: { f: FormState; set: (p: Partial<FormState>) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Event title"><input className="input" value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Rooftop Sundowner" data-testid="ev-title" /></Field>
      <Field label="Tagline" hint="One line under the title."><input className="input" value={f.tagline} onChange={(e) => set({ tagline: e.target.value })} placeholder="Sunset to late · house & disco" /></Field>
      <Field label="Category">
        <div className="flex flex-wrap gap-2">{CATEGORIES.map((c) => <button key={c} type="button" className={`chip ${f.category === c ? 'chip-on' : ''}`} onClick={() => set({ category: c })}>{c}</button>)}</div>
      </Field>
      <Field label="Description" hint="Supports **bold** and line breaks."><textarea className="textarea" rows={7} value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="What should guests know? Lineup, dress code, entry rules…" data-testid="ev-desc" /></Field>
    </div>
  );
}

export function WhenWhereFields({ f, set }: { f: FormState; set: (p: Partial<FormState>) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts (BST)"><input type="datetime-local" className="input" value={f.start} onChange={(e) => set({ start: e.target.value })} data-testid="ev-start" /></Field>
        <Field label="Ends (BST)"><input type="datetime-local" className="input" value={f.end} onChange={(e) => set({ end: e.target.value })} data-testid="ev-end" /></Field>
      </div>
      <Field label="Venue name"><input className="input" value={f.venueName} onChange={(e) => set({ venueName: e.target.value })} placeholder="e.g. Skyline Rooftop, Gulshan 2" data-testid="ev-venue" /></Field>
      <Field label="Address"><input className="input" value={f.address} onChange={(e) => set({ address: e.target.value })} placeholder="Road, area, city" /></Field>
      <Field label="City"><select className="input" value={f.city} onChange={(e) => set({ city: e.target.value as City })}>{CITIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
      <Toggle checked={f.revealLater} onChange={(v) => set({ revealLater: v })} label="Reveal location to ticket holders only" hint="The public page shows just the city until someone has a ticket." />
    </div>
  );
}

export function FlyerFields({ f, set }: { f: FormState; set: (p: Partial<FormState>) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-2">
        {STYLES.map((s) => (
          <button key={s} type="button" className={`aspect-[4/5] overflow-hidden rounded-xl border-2 ${f.poster.style === s && !f.poster.imageUrl ? 'border-ink' : 'border-transparent'}`} onClick={() => set({ poster: { ...f.poster, style: s, imageUrl: undefined } })} aria-label={`${s} style`}>
            <PosterArt poster={{ ...f.poster, style: s, imageUrl: undefined }} title={f.title || 'Your event'} showText={false} />
          </button>
        ))}
      </div>
      <Field label="Colours">
        <div className="flex items-center gap-3">
          <input type="range" min={0} max={359} value={f.poster.hues[0]} onChange={(e) => set({ poster: { ...f.poster, hues: [Number(e.target.value), f.poster.hues[1]] } })} className="w-full accent-black" aria-label="Primary hue" />
          <input type="range" min={0} max={359} value={f.poster.hues[1]} onChange={(e) => set({ poster: { ...f.poster, hues: [f.poster.hues[0], Number(e.target.value)] } })} className="w-full accent-black" aria-label="Secondary hue" />
        </div>
      </Field>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-outline btn-md" onClick={() => set({ poster: { ...f.poster, seed: Math.floor(Math.random() * 1e5), imageUrl: undefined } })}><Dices className="h-4 w-4" />Shuffle</button>
        <label className="btn btn-outline btn-md cursor-pointer"><ImagePlus className="h-4 w-4" />Upload flyer
          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 900_000) return toast.error('Choose an image under 900 KB (browser storage is limited in the demo).');
            const r = new FileReader();
            r.onload = () => set({ poster: { ...f.poster, imageUrl: String(r.result) } });
            r.readAsDataURL(file);
          }} />
        </label>
        {f.poster.imageUrl && <button type="button" className="btn btn-ghost btn-md" onClick={() => set({ poster: { ...f.poster, imageUrl: undefined } })}>Remove upload</button>}
      </div>
    </div>
  );
}

export function LineupFields({ f, set }: { f: FormState; set: (p: Partial<FormState>) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-3">Artists, speakers, hosts or features shown under “Event Features”.</p>
      {f.lineup.map((l, i) => (
        <div key={l.id} className="flex gap-2">
          <input className="input" value={l.name} onChange={(e) => set({ lineup: f.lineup.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} placeholder="Name" />
          <button type="button" className="btn btn-ghost h-11 w-11 p-0" onClick={() => set({ lineup: f.lineup.filter((_, j) => j !== i) })} aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <button type="button" className="btn btn-outline btn-md" onClick={() => set({ lineup: [...f.lineup, { id: uid('ln'), name: '', hue: Math.floor(Math.random() * 360) }] })}><Plus className="h-4 w-4" />Add to lineup</button>
    </div>
  );
}

function TicketsFields({ f, set }: { f: FormState; set: (p: Partial<FormState>) => void }) {
  return (
    <div className="space-y-4">
      <Toggle checked={f.rsvpOnly} onChange={(v) => set({ rsvpOnly: v, tiers: v ? [{ id: f.tiers[0]?.id ?? uid('tt'), name: 'RSVP', price: 0, quantity: f.tiers[0]?.quantity ?? 200 }] : f.tiers })} label="RSVP-only event" hint="Free registration, one RSVP per account. For more free tickets per person, add a ৳0 ticket type instead." />
      {f.tiers.map((t, i) => (
        <div key={t.id} className="card space-y-3 p-4" data-testid="ev-tier">
          <div className="flex items-center justify-between"><p className="text-sm font-bold">Ticket type {i + 1}</p>{f.tiers.length > 1 && <button type="button" className="text-sm text-bad" onClick={() => set({ tiers: f.tiers.filter((_, j) => j !== i) })}>Remove</button>}</div>
          <Field label="Name"><input className="input" value={t.name} onChange={(e) => set({ tiers: f.tiers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Your price (৳)" hint={t.price > 0 ? `Buyers see ${tk(displayPrice(t.price))} (incl. ${tk(serviceFee(t.price))} fee)` : 'Free'}>
              <input className="input" inputMode="numeric" disabled={f.rsvpOnly} value={t.price} onChange={(e) => set({ tiers: f.tiers.map((x, j) => (j === i ? { ...x, price: Number(e.target.value.replace(/\D/g, '')) || 0 } : x)) })} data-testid="ev-tier-price" />
            </Field>
            <Field label="Quantity" hint="Blank = unlimited"><input className="input" inputMode="numeric" value={t.quantity ?? ''} onChange={(e) => set({ tiers: f.tiers.map((x, j) => (j === i ? { ...x, quantity: e.target.value === '' ? null : Number(e.target.value.replace(/\D/g, '')) } : x)) })} /></Field>
          </div>
          <Field label="Description (optional)"><input className="input" value={t.description ?? ''} onChange={(e) => set({ tiers: f.tiers.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })} placeholder="Perks, arrival time…" /></Field>
        </div>
      ))}
      {!f.rsvpOnly && <button type="button" className="btn btn-outline btn-md" onClick={() => set({ tiers: [...f.tiers, { id: uid('tt'), name: '', price: 0, quantity: 100 }] })}><Plus className="h-4 w-4" />Add ticket type</button>}
      <p className="text-xs text-ink-3">Waitlists, passwords, approvals, groups and promo codes are in the Tickets tab after you create the event.</p>
    </div>
  );
}

export function SettingsFields({ f, set }: { f: FormState; set: (p: Partial<FormState>) => void }) {
  return (
    <div className="divide-y divide-line">
      <Toggle checked={f.visibility === 'public'} onChange={(v) => set({ visibility: v ? 'public' : 'unlisted' })} label="List on Explore" hint="Off = unlisted: only people with the link can find it." />
      <Toggle checked={f.showGuestlist} onChange={(v) => set({ showGuestlist: v })} label="Show who’s going" hint="Display the guest list and “N others going” on your page." />
      <Toggle checked={f.chatEnabled} onChange={(v) => set({ chatEnabled: v })} label="Event chat" hint="Let ticket holders chat with each other." />
      <div className="py-3"><Field label="Age restriction (optional)"><input className="input" value={f.ageLimit} onChange={(e) => set({ ageLimit: e.target.value })} placeholder="e.g. 18+ with valid ID" /></Field></div>
    </div>
  );
}

const STEPS = ['Basics', 'When & where', 'Flyer', 'Lineup', 'Tickets', 'Settings'] as const;

export default function CreateEvent() {
  return <RequireLogin><CreateInner /></RequireLogin>;
}

function CreateInner() {
  const nav = useNavigate();
  const { orgId, set: setOrg } = useActiveOrg();
  const { data: orgs, loading } = useApi(() => api.myOrgs(), []);
  const managed = (orgs ?? []).filter((o) => o.role === 'owner' || o.role === 'admin');
  const org = managed.find((o) => o.org.id === orgId) ?? managed[0];
  const [f, setF] = useState<FormState>(blank);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<FormState>) => setF((x) => ({ ...x, ...p }));
  useEffect(() => {
    if (org && org.org.id !== orgId) setOrg(org.org.id);
  }, [org, orgId, setOrg]);

  if (loading && !orgs) return <PageSpinner />;
  if (!org)
    return (
      <div className="container-x max-w-md py-12">
        <h1 className="text-3xl font-black tracking-tight">First, create your organization</h1>
        <p className="mb-6 mt-2 text-ink-3">Events are hosted by an organization — it can be just you.</p>
        <div className="card p-6"><CreateOrgForm onDone={(o) => setOrg(o.id)} /></div>
      </div>
    );

  const save = async (status: 'draft' | 'published') => {
    const err = validate(f, true);
    if (err) return toast.error(err);
    setBusy(true);
    try {
      const ev = await api.createEvent(org.org.id, {
        ...toPatch(f),
        status,
        ticketTypes: f.tiers.map((t, i) => ({ ...t, name: t.name.trim(), maxPerOrder: f.rsvpOnly ? 1 : 10, allowTransfers: t.price > 0, order: i }) as TicketType),
      });
      toast.success(status === 'published' ? 'Your event is live 🎉' : 'Draft saved');
      nav(`/dashboard/events/${ev.id}`);
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  const stepEl = [<BasicsFields key="b" f={f} set={set} />, <WhenWhereFields key="w" f={f} set={set} />, <FlyerFields key="f" f={f} set={set} />, <LineupFields key="l" f={f} set={set} />, <TicketsFields key="t" f={f} set={set} />, <SettingsFields key="s" f={f} set={set} />][step];
  const last = step === STEPS.length - 1;

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="sticky top-0 z-30 border-b border-line bg-white">
        <div className="container-x flex h-16 items-center justify-between">
          <button className="flex items-center gap-2" onClick={() => nav(-1)}><ArrowLeft className="h-4 w-4" /><Logo mark /></button>
          <div className="flex items-center gap-2 text-sm"><span className="hidden text-ink-3 sm:inline">Hosting as</span>
            {managed.length > 1 ? <select className="h-9 rounded-full border border-line px-3 font-semibold" value={org.org.id} onChange={(e) => setOrg(e.target.value)}>{managed.map((o) => <option key={o.org.id} value={o.org.id}>{o.org.name}</option>)}</select> : <strong>{org.org.name}</strong>}
          </div>
          <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => save('draft')}>Save draft</button>
        </div>
      </header>
      <div className="container-x grid gap-8 py-8 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="no-scrollbar mb-6 flex gap-1 overflow-x-auto">
            {STEPS.map((s, i) => <button key={s} className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${i === step ? 'bg-ink text-white' : i < step ? 'bg-mist text-ink' : 'text-ink-4'}`} onClick={() => setStep(i)}>{i + 1}. {s}</button>)}
          </div>
          <div className="card p-5 sm:p-6">
            <h1 className="mb-5 text-2xl font-black tracking-tight">{STEPS[step]}</h1>
            {stepEl}
          </div>
          <div className="mt-5 flex justify-between">
            <button className="btn btn-outline btn-lg" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4" />Back</button>
            {last ? (
              <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => save('published')} data-testid="publish">Publish event</button>
            ) : (
              <button className="btn btn-primary btn-lg" onClick={() => setStep(step + 1)} data-testid="next-step">Next<ArrowRight className="h-4 w-4" /></button>
            )}
          </div>
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-2 text-sm font-semibold text-ink-3">Preview</p>
          <div className="card overflow-hidden">
            <div className="aspect-[4/5]"><PosterArt poster={f.poster} title={f.title || 'Your event'} kicker={org.org.name} /></div>
            <div className="space-y-1 p-4">
              <p className="font-display text-lg font-extrabold leading-tight">{f.title || 'Your event title'}</p>
              <p className="text-sm text-ink-3">{f.start && f.end ? longRange(fromDhakaInput(f.start), fromDhakaInput(f.end)) : ''}</p>
              <p className="text-sm text-ink-3">{f.revealLater ? f.city : f.venueName || 'Venue'}</p>
              <div className="flex flex-wrap gap-1 pt-1">{f.tiers.map((t) => <Badge key={t.id}>{t.name || 'Ticket'} · {t.price ? tk(displayPrice(t.price)) : 'Free'}</Badge>)}</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
