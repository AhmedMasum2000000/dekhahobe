import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BarChart3, Bot, CreditCard, LayoutTemplate, MessageSquare, Rss, Sparkles, Users, Zap } from 'lucide-react';
import { api, CATEGORIES } from '@/api';
import { useApi } from '@/hooks/useApi';
import { PosterArt } from '@/components/PosterArt';
import { Avatar, Empty, Verified } from '@/components/ui';
import { tk } from '@/lib/util';

export function Platform() {
  const { data } = useApi(() => api.platformStats(), []);
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>('Nightlife');
  const catMap: Record<string, string[]> = {
    Nightlife: ['dhaka-sound-collective', 'rooftop-sessions'],
    Festivals: ['coxs-wave-fest', 'rajshahi-mango-mela'],
    'Arts & Fashion': ['banani-art-house'],
    'Food & Drink': ['chattogram-food-karnival'],
    Activities: ['sylhet-tea-trails', 'old-dhaka-heritage-walks'],
    Fitness: ['gulshan-run-club'],
    Networking: ['startup-adda'],
    Concerts: ['khulna-indie-nights', 'rooftop-sessions'],
    Comedy: ['laugh-lab-bd'],
  };
  const quotes: Record<string, string> = {
    'dhaka-sound-collective': 'Bpop took us from one warehouse night a month to a weekly series with a waitlist every time.',
    'rooftop-sessions': 'Sixty seats, sold out in minutes — and the waitlist means nobody gets scalped.',
    'coxs-wave-fest': 'Kickbacks turned our first-year festival-goers into our best marketing team.',
    'rajshahi-mango-mela': 'Free RSVPs, a guest list and the door scanner — that’s all we needed to run our riverside mela.',
    'banani-art-house': 'Exhibition openings, design markets and approvals for front-row seats, all in one place.',
    'chattogram-food-karnival': 'Families buy on bKash in seconds. That alone doubled our presales.',
    'sylhet-tea-trails': 'Our sunrise walks are tiny. The waitlist fills every seat that frees up.',
    'old-dhaka-heritage-walks': 'We text our followers when a new walk drops. It sells out before lunch.',
    'gulshan-run-club': 'RSVPs, pace groups and one-tap check-in — our Friday run runs itself.',
    'startup-adda': 'Approval-only founder passes keep our office hours focused.',
    'khulna-indie-nights': 'Door sales on bKash and instant payouts mean we can pay bands the same night.',
    'laugh-lab-bd': 'The front-row waitlist is now part of the show.',
  };
  const rows = (catMap[cat] ?? []).map((s) => data?.orgs.find((o) => o.org.slug === s)).filter(Boolean) as NonNullable<typeof data>['orgs'];

  const block = (n: string, k: string, title: string, sub: string, items: { icon: React.ReactNode; t: string }[]) => (
    <section className="container-x mt-24">
      <p className="text-sm font-bold text-brand">{n}</p>
      <p className="text-sm font-semibold text-ink-3">{k}</p>
      <h2 className="mt-1 text-4xl font-black tracking-tight sm:text-5xl">{title}</h2>
      <p className="mt-3 max-w-xl text-ink-2">{sub}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {items.map((i) => (
          <div key={i.t} className="card p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mist">{i.icon}</span>
            <p className="mt-4 font-semibold">{i.t}</p>
          </div>
        ))}
      </div>
      <Link to="/create" className="btn btn-primary btn-lg mt-8">Get started</Link>
    </section>
  );

  return (
    <div className="pb-10">
      <section className="container-x pt-14 text-center">
        <h1 className="mx-auto max-w-3xl text-5xl font-black leading-[0.95] tracking-tighter sm:text-7xl">Build your scene on Bpop</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-ink-2">The tools you need to create, sell out and grow any experience in Bangladesh.</p>
        <div className="mt-7 flex justify-center gap-2">
          <Link to="/create" className="btn btn-primary btn-lg">Get started</Link>
          <a href="mailto:partners@bpoptags.example?subject=Bpop%20demo" className="btn btn-outline btn-lg">Book a demo</a>
        </div>
        {data && (
          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-3 gap-4">
            <div><p className="font-display text-3xl font-extrabold sm:text-4xl">{data.tickets.toLocaleString()}</p><p className="text-sm text-ink-3">tickets issued</p></div>
            <div><p className="font-display text-3xl font-extrabold sm:text-4xl">{tk(data.revenue)}</p><p className="text-sm text-ink-3">earned by organizers</p></div>
            <div><p className="font-display text-3xl font-extrabold sm:text-4xl">{data.organizers}</p><p className="text-sm text-ink-3">organizers</p></div>
          </div>
        )}
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {data?.orgs.slice(0, 8).map((o) => <Link key={o.org.id} to={`/g/${o.org.slug}`} title={o.org.name}><Avatar name={o.org.name} hue={o.org.avatarHue} size={48} /></Link>)}
        </div>
        <p className="mt-4 text-sm text-ink-3">Bpop is built for every kind of community.</p>
      </section>

      <section className="container-x mt-20">
        <div className="rounded-4xl bg-mist p-4 sm:p-8">
          <div className="grid gap-4 rounded-3xl bg-white p-5 shadow-card sm:grid-cols-4">
            {[['Revenue', data ? tk(data.revenue) : '—'], ['Tickets', data?.tickets.toLocaleString() ?? '—'], ['Events', String(data?.events ?? '—')], ['Organizers', String(data?.organizers ?? '—')]].map(([l, v]) => (
              <div key={l} className="rounded-2xl border border-line p-4 text-left"><p className="text-xs text-ink-3">{l}</p><p className="font-display text-xl font-extrabold">{v}</p></div>
            ))}
            <div className="col-span-full flex h-32 items-end gap-1.5">
              {Array.from({ length: 30 }, (_, i) => <span key={i} className="flex-1 rounded-t bg-ink" style={{ height: `${25 + ((i * 37) % 70)}%`, opacity: 0.25 + (i / 30) * 0.75 }} />)}
            </div>
          </div>
          <div className="mt-6 text-center">
            <h2 className="text-3xl font-black tracking-tight">Grow your events with the Bpop Organizer Dashboard</h2>
            <Link to="/dashboard" className="btn btn-primary btn-lg mt-5">Open the dashboard</Link>
          </div>
        </div>
      </section>

      {block('01', 'Create', 'Bring your idea to life', 'Make a page as unique as your event — and get paid the moment you sell.', [
        { icon: <LayoutTemplate className="h-5 w-5" />, t: 'Personalize your event page with flyers, lineups, ticket tiers and groups.' },
        { icon: <CreditCard className="h-5 w-5" />, t: 'Turn on In-Person Payments to sell at the door with cash or bKash.' },
        { icon: <Zap className="h-5 w-5" />, t: 'Initiate Instant Payouts to your bKash, Nagad or bank in seconds.' },
      ])}
      {block('02', 'Earn', 'We’ll help you find your crowd', 'Create paid events and start earning for every experience you host.', [
        { icon: <Rss className="h-5 w-5" />, t: 'The Explore feed gets your event seen by city, category and what’s trending.' },
        { icon: <Sparkles className="h-5 w-5" />, t: 'Activate Kickbacks to turn your customers into promoters.' },
        { icon: <MessageSquare className="h-5 w-5" />, t: 'Send unlimited free SMS blasts to re-engage your audience.' },
      ])}
      {block('03', 'Scale', 'Turn your community into culture', 'Make data-backed decisions with real-time insights.', [
        { icon: <Bot className="h-5 w-5" />, t: 'Ask Bpop AI any question about your event’s performance (beta).' },
        { icon: <BarChart3 className="h-5 w-5" />, t: 'Access rich organization insights to stay on top of your data.' },
        { icon: <Users className="h-5 w-5" />, t: 'Team roles, door scanner PINs and host links for your whole crew.' },
      ])}

      <section className="container-x mt-24">
        <h2 className="text-4xl font-black tracking-tight">Don’t just take our word for it.</h2>
        <div className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4">
          {CATEGORIES.map((c) => <button key={c} className={`chip ${cat === c ? 'chip-on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {rows.map((o) => (
            <div key={o.org.id} className="card overflow-hidden">
              {o.cover && <div className="h-40"><PosterArt poster={o.cover.poster} title={o.cover.title} showText={false} /></div>}
              <div className="p-5">
                <p className="flex items-center gap-1.5 font-bold">{o.org.name}{o.org.verified && <Verified />}</p>
                <p className="text-sm text-ink-3">{cat} · {o.org.city}</p>
                <p className="mt-1 text-sm font-semibold">{o.events} events · {o.attendees.toLocaleString()} attendees</p>
                <p className="mt-3 text-ink-2">“{quotes[o.org.slug]}”</p>
                <Link to={`/g/${o.org.slug}`} className="mt-3 inline-block text-sm font-semibold underline underline-offset-4">View organizer</Link>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-ink-4">Organizers and quotes on this page are fictional demo content.</p>
      </section>
    </div>
  );
}

const LEGAL: Record<string, { title: string; body: string[] }> = {
  'terms-of-service': {
    title: 'Terms of Service',
    body: [
      'Bpop Tags (“Bpop”) provides a platform for organizers to list events and for attendees to discover them and buy tickets. Organizers are responsible for their events, including permits, venue safety, age restrictions and the accuracy of event information.',
      'Tickets are licences to attend an event and may be scanned once. Tickets may be transferred only where the organizer allows it. Resale above face value is not supported.',
      'Prices are shown upfront and include Bpop’s service fee. Payments are processed by licensed payment partners (bKash, Nagad, card acquirers).',
      'This is a demo build: no payments are processed and all data is stored locally in your browser.',
    ],
  },
  'privacy-policy': {
    title: 'Privacy Policy',
    body: [
      'We collect your mobile number to create your account and send your tickets, your name to display on tickets and guest lists, and your purchase history to show your orders.',
      'Organizers see the name and number of people who buy tickets to their events. You can make your profile private to hide yourself from public guest lists.',
      'You can opt out of organizer SMS at any time in Settings or by replying STOP.',
      'In this demo, all data stays in your browser’s local storage and is never sent to a server.',
    ],
  },
  'refund-policy': {
    title: 'Refund Policy',
    body: [
      'Refunds are at the discretion of each organizer. You can request a refund from your ticket in My tickets; the organizer will approve or decline.',
      'If an event is cancelled, all orders are refunded in full to the original payment method.',
      'Transferred tickets and complimentary tickets are non-refundable. Tickets returned to a waitlist are refunded once resold.',
    ],
  },
  'kickback-terms': {
    title: 'Kickback Terms',
    body: [
      'Kickbacks let you earn a commission when people buy tickets through your personal link. Rates are set by each organizer, either as a percentage or a flat amount per order or per ticket.',
      'You can’t earn a Kickback on your own purchases. Refunded orders don’t earn commission. Tracking links shared by organizers don’t earn Kickbacks — only your personal link does.',
      'Earnings are paid to your bKash after the event ends.',
    ],
  },
};

export function Legal() {
  const { doc = '' } = useParams();
  const d = LEGAL[doc];
  if (!d) return <div className="container-x py-20"><Empty title="Page not found" /></div>;
  return (
    <div className="container-x max-w-2xl py-12">
      <h1 className="text-4xl font-black tracking-tight">{d.title}</h1>
      <p className="mt-1 text-sm text-ink-3">Last updated {new Date().getFullYear()}</p>
      <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-ink-2">{d.body.map((p) => <p key={p}>{p}</p>)}</div>
      <div className="mt-8 flex flex-wrap gap-3 text-sm">{Object.entries(LEGAL).map(([k, v]) => <Link key={k} to={`/terms/${k}`} className="underline">{v.title}</Link>)}</div>
    </div>
  );
}

const FAQ: [string, string][] = [
  ['How do I get my tickets?', 'After checkout your QR tickets appear in My tickets. You’ll also get an SMS. Show the QR at the door.'],
  ['Can I transfer a ticket to a friend?', 'Open the ticket and tap Transfer tickets, then enter their mobile number. They accept it in the app. Some tickets can’t be transferred if the organizer turned that off.'],
  ['What is the waitlist?', 'When a ticket type sells out, you can join its waitlist. If a ticket opens up, you get a text and a limited time to claim it.'],
  ['How do Kickbacks work?', 'On events with Kickbacks, get your personal link and share it. You earn a commission when friends buy through it.'],
  ['How do I request a refund?', 'Open your ticket and tap Request a refund. The organizer reviews it. Cancelled events are refunded automatically.'],
  ['I’m an organizer — how do I scan tickets?', 'Use the door scanner in your dashboard, or give your door staff a Scanner PIN — they open /scanner and enter it, no account needed.'],
  ['How do payouts work?', 'Your balance grows with every sale. Withdraw to bKash, Nagad or bank from Finance — standard payouts are free, Instant Payouts cost 1.5%.'],
];

export function Help() {
  return (
    <div className="container-x max-w-2xl py-12">
      <h1 className="text-4xl font-black tracking-tight">Help center</h1>
      <p className="mt-2 text-ink-3">Answers for attendees and organizers.</p>
      <div className="mt-8 divide-y divide-line">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group py-4">
            <summary className="cursor-pointer list-none font-semibold">{q}<span className="float-right text-ink-4 group-open:rotate-45">+</span></summary>
            <p className="mt-2 text-ink-2">{a}</p>
          </details>
        ))}
      </div>
      <a className="btn btn-primary btn-md mt-8" href="mailto:support@bpoptags.example">Contact support</a>
    </div>
  );
}

export function Simple({ kind }: { kind: 'app' | 'vision' | 'careers' }) {
  const content = {
    app: { t: 'Get the Bpop Tags app', b: 'Instant ticket access, easy transfers and a feed curated for you. This web app works on any phone — add it to your home screen from your browser’s share menu.' },
    vision: { t: 'Our vision', b: 'Bangladesh has one of the youngest, most social populations on earth. We’re building the place where that energy turns into real-life plans — and where the people who create those moments can make a living from them.' },
    careers: { t: 'Careers', b: 'We’re a small team in Dhaka building for the culture. No open roles in this demo — but we’d love to hear from you.' },
  }[kind];
  return (
    <div className="container-x max-w-2xl py-16 text-center">
      <h1 className="text-5xl font-black tracking-tight">{content.t}</h1>
      <p className="mx-auto mt-4 max-w-lg text-lg text-ink-2">{content.b}</p>
      <Link to="/explore" className="btn btn-primary btn-lg mt-8">Explore events</Link>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="container-x py-24 text-center">
      <p className="font-display text-8xl font-black">404</p>
      <p className="mt-2 text-lg text-ink-3">This page left the party early.</p>
      <Link to="/" className="btn btn-primary btn-lg mt-6">Go home</Link>
    </div>
  );
}
