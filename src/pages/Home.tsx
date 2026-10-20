import { Link } from 'react-router-dom';
import { ArrowRight, Megaphone, Rocket, Sparkles, Star, Users, Wallet } from 'lucide-react';
import { api, type BpopEvent } from '@/api';
import { useApi } from '@/hooks/useApi';
import { PosterArt } from '@/components/PosterArt';
import { Avatar, AvatarStack, Verified } from '@/components/ui';
import { cardRange, tk } from '@/lib/util';

function PosterRow({ events, reverse }: { events: BpopEvent[]; reverse?: boolean }) {
  const list = [...events, ...events];
  return (
    <div className="overflow-hidden">
      <div className={`flex w-max gap-3 ${reverse ? 'animate-marqueeRev' : 'animate-marquee'} hover:[animation-play-state:paused]`}>
        {list.map((e, i) => (
          <Link key={`${e.id}-${i}`} to={`/e/${e.slug}`} className="block aspect-[4/5] w-32 shrink-0 overflow-hidden rounded-2xl sm:w-40" tabIndex={i >= events.length ? -1 : 0}>
            <PosterArt poster={e.poster} title={e.title} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function StoreButtons() {
  return (
    <div className="flex flex-wrap gap-2">
      <Link to="/app" className="flex h-12 items-center gap-2 rounded-xl bg-ink px-4 text-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden><path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9s-2-.9-3.3-.9C6.1 7 4.6 8 3.7 9.5c-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.9-1.1-2.9-4.3zM14 5.3c.7-.8 1.2-2 1-3.2-1 .1-2.2.7-3 1.5-.6.7-1.2 1.9-1 3.1 1.1.1 2.3-.6 3-1.4z" /></svg>
        <span className="text-left leading-none"><span className="block text-[10px] opacity-75">Download on the</span><span className="text-[15px] font-semibold">App Store</span></span>
      </Link>
      <Link to="/app" className="flex h-12 items-center gap-2 rounded-xl bg-ink px-4 text-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path fill="#fff" d="M4 2.8v18.4c0 .4.4.6.7.4l10.6-9.2c.2-.2.2-.6 0-.8L4.7 2.4c-.3-.2-.7 0-.7.4z" /><path fill="#E6007E" d="M15.3 12.4 18 15l2.8-1.6c.6-.4.6-1.2 0-1.6L18 10.2z" /></svg>
        <span className="text-left leading-none"><span className="block text-[10px] opacity-75">Get it on</span><span className="text-[15px] font-semibold">Google Play</span></span>
      </Link>
    </div>
  );
}

function PhoneMock({ children, tilt = 0 }: { children: React.ReactNode; tilt?: number }) {
  return (
    <div className="relative h-[420px] w-[210px] shrink-0 rounded-[2.4rem] border-[7px] border-ink bg-white shadow-2xl" style={{ transform: `rotate(${tilt}deg)` }}>
      <div className="absolute left-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full bg-ink" />
      <div className="h-full overflow-hidden rounded-[1.9rem] pt-8">{children}</div>
    </div>
  );
}

export default function Home() {
  const { data } = useApi(() => api.homeFeed(), []);
  const posters = data?.posters ?? [];
  const third = Math.ceil(posters.length / 3);
  const rows = [posters.slice(0, third), posters.slice(third, third * 2), posters.slice(third * 2)].map((r) => (r.length ? r : posters));
  const f = data?.featured;

  return (
    <div>
      {/* hero */}
      <section className="overflow-hidden pb-10 pt-10 sm:pt-16">
        <div className="container-x mb-10 text-center">
          <h1 className="mx-auto max-w-3xl text-[44px] font-black leading-[0.95] tracking-tighter sm:text-7xl">Find your scene.</h1>
          <p className="mx-auto mt-5 max-w-xl text-[17px] text-ink-2">
            Bpop Tags is the social home for real-life experiences in Bangladesh. Rooftop raves to run clubs, food fests to comedy nights — if it’s happening, it’s on Bpop.
          </p>
          <div className="mt-7 flex justify-center gap-2">
            <Link to="/explore" className="btn btn-primary btn-lg">Explore events</Link>
            <Link to="/create" className="btn btn-outline btn-lg">Host an event</Link>
          </div>
        </div>
        {posters.length > 0 && (
          <div className="space-y-3 [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
            <PosterRow events={rows[0]!} />
            <PosterRow events={rows[1]!} reverse />
            <PosterRow events={rows[2]!} />
          </div>
        )}
      </section>

      {/* live featured event */}
      {f && (
        <section className="container-x">
          <div className="card flex flex-col items-start gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
            <Link to={`/e/${f.event.slug}`} className="block aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-2xl">
              <PosterArt poster={f.event.poster} title={f.event.title} showText={false} />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-brand">Happening soon</p>
              <h2 className="mt-1 line-clamp-2 text-2xl font-extrabold">{f.event.title}</h2>
              <p className="mt-1 text-sm text-ink-3">{cardRange(f.event.startsAt, f.event.endsAt)} · {f.event.venue.name}</p>
              <p className="mt-2 flex items-center gap-2 text-sm text-ink-2">
                <AvatarStack people={f.goingPreview} size={24} />
                <span>{f.goingCount.toLocaleString()} people going</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Link to={`/e/${f.event.slug}`} className="btn btn-primary btn-md">View event</Link>
              <Link to="/explore" className="btn btn-outline btn-md">View all</Link>
            </div>
          </div>
        </section>
      )}

      {/* app section */}
      <section className="container-x mt-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="flex justify-center gap-4 lg:justify-start">
            <PhoneMock tilt={-4}>
              <div className="space-y-2 px-3">
                <p className="font-display text-lg font-extrabold">For you</p>
                {posters.slice(0, 3).map((e) => (
                  <div key={e.id} className="flex gap-2">
                    <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg"><PosterArt poster={e.poster} title={e.title} showText={false} /></div>
                    <div className="min-w-0"><p className="line-clamp-2 text-[11px] font-bold leading-tight">{e.title}</p><p className="text-[10px] text-ink-3">{cardRange(e.startsAt, e.endsAt)}</p></div>
                  </div>
                ))}
              </div>
            </PhoneMock>
            <div className="hidden sm:block">
              <PhoneMock tilt={4}>
                {posters[4] && (
                  <div className="px-3">
                    <div className="aspect-[4/5] overflow-hidden rounded-xl"><PosterArt poster={posters[4].poster} title={posters[4].title} /></div>
                    <p className="mt-2 text-[12px] font-bold leading-tight">{posters[4].title}</p>
                    <div className="mt-3 rounded-full bg-ink py-2 text-center text-[11px] font-bold text-white">Get tickets</div>
                  </div>
                )}
              </PhoneMock>
            </div>
          </div>
          <div>
            <h2 className="text-4xl font-black tracking-tight sm:text-5xl">Plans, sorted.</h2>
            <div className="mt-8 space-y-6">
              {[
                ['Find social plans in seconds', 'A feed tuned to your city, your friends and what you love.'],
                ['See the vibe and who’s going', 'Lineups, guest lists and the friends who already have tickets.'],
                ['Put the phone down and go out', 'Tickets live in the app — tap, scan, you’re in.'],
              ].map(([t, b], i) => (
                <div key={t} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mist font-display font-extrabold">{i + 1}</span>
                  <div><p className="text-lg font-bold">{t}</p><p className="text-ink-3">{b}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* testimonial */}
      <section className="container-x mt-24 text-center">
        <p className="mx-auto max-w-3xl font-display text-2xl font-bold leading-snug sm:text-4xl">“Whenever I’m bored on a Thursday I open Bpop, find something new and send it straight to the group chat.”</p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <span className="font-display text-xl font-extrabold">4.9</span>
          <span className="flex">{Array.from({ length: 5 }, (_, i) => <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />)}</span>
        </div>
        <div className="mt-6 flex justify-center"><StoreButtons /></div>
      </section>

      {/* culture & community */}
      {data?.spotlight && (
        <section className="mt-24 bg-mist py-16">
          <div className="container-x grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-4xl font-black tracking-tight sm:text-5xl">Driving culture & community</h2>
              <p className="mt-4 max-w-md text-ink-2">We partner with the collectives, venues and brands that keep Bangladesh’s culture alive.</p>
              <Link to="/platform" className="btn btn-primary btn-lg mt-6">Bpop for Organizers <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <Link to={`/g/${data.spotlight.org.slug}`} className="card flex items-center gap-4 p-4">
              <div className="aspect-[4/5] w-28 shrink-0 overflow-hidden rounded-2xl"><PosterArt poster={data.spotlight.event.poster} title={data.spotlight.event.title} showText={false} /></div>
              <div>
                <p className="flex items-center gap-1.5 font-bold"><Avatar name={data.spotlight.org.name} hue={data.spotlight.org.avatarHue} size={24} />{data.spotlight.org.name}{data.spotlight.org.verified && <Verified />}</p>
                <p className="mt-1 text-sm text-ink-3">{data.spotlight.event.title}</p>
                <p className="text-sm text-ink-3">{data.spotlight.org.city}</p>
                <span className="mt-3 inline-flex text-sm font-semibold underline underline-offset-4">View organizer</span>
              </div>
            </Link>
          </div>
          <div className="mt-12 overflow-hidden">
            <div className="flex w-max animate-marquee gap-12">
              {[...(data.orgs ?? []), ...(data.orgs ?? [])].map((o, i) => (
                <span key={i} className="font-display text-2xl font-extrabold text-ink-4">{o.name}</span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* organizer pitch */}
      <section className="container-x mt-24">
        <div className="text-center">
          <h2 className="mx-auto max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">Throw a party. Build a community. Find your people.</h2>
          <p className="mx-auto mt-4 max-w-xl text-ink-2">Everything you need to create, sell out and scale your events — in one Organizer Dashboard.</p>
          <Link to="/platform" className="btn btn-primary btn-lg mt-6">Bpop for Organizers</Link>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {posters.slice(5, 8).map((e, i) => (
            <div key={e.id} className="relative aspect-[4/5] overflow-hidden rounded-3xl">
              <PosterArt poster={e.poster} title={e.title} />
              <span className="absolute bottom-4 right-4 rounded-full bg-white px-4 py-2 font-display text-lg font-extrabold shadow">{tk([64000, 298300, 839500][i]!)}</span>
            </div>
          ))}
        </div>
        <div className="mt-14 grid gap-10 md:grid-cols-3">
          {[
            { n: '01', k: 'Create', t: 'Bring your idea to life', b: 'Design an event page as unique as your event — tiers, lineups, guest lists and door sales.', icon: <Sparkles className="h-5 w-5" /> },
            { n: '02', k: 'Earn', t: 'We’ll help you find your crowd', b: 'Get discovered in the Explore feed, turn buyers into promoters with Kickbacks and text your audience for free.', icon: <Megaphone className="h-5 w-5" /> },
            { n: '03', k: 'Scale', t: 'Turn your community into culture', b: 'Make data-backed decisions with real-time insights, and ask Bpop AI anything about your events.', icon: <Rocket className="h-5 w-5" /> },
          ].map((s) => (
            <div key={s.n}>
              <p className="flex items-center gap-2 text-sm font-bold text-brand">{s.icon}{s.n}. {s.k}</p>
              <h3 className="mt-2 text-2xl font-extrabold">{s.t}</h3>
              <p className="mt-2 text-ink-3">{s.b}</p>
              <Link to="/platform" className="mt-3 inline-flex text-sm font-semibold underline underline-offset-4">Learn more</Link>
            </div>
          ))}
        </div>
      </section>

      {/* organizer quote */}
      <section className="container-x mt-24">
        <div className="grid overflow-hidden rounded-4xl bg-ink text-white md:grid-cols-2">
          <div className="p-8 sm:p-12">
            <p className="font-display text-3xl font-bold leading-snug">“Bpop let us take one Friday run around the lake and turn it into a city-wide community.”</p>
            <p className="mt-6 font-semibold">Gulshan Run Club</p>
            <p className="text-sm text-white/60">Free community runs every Friday & Saturday</p>
            <Link to="/g/gulshan-run-club" className="btn btn-lg mt-6 bg-white text-ink hover:bg-white/90">View organizer</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 p-6">
            {posters.slice(8, 12).map((e) => (
              <div key={e.id} className="aspect-[4/5] overflow-hidden rounded-2xl"><PosterArt poster={e.poster} title={e.title} showText={false} /></div>
            ))}
          </div>
        </div>
      </section>

      {/* editorial */}
      <section className="container-x mt-24">
        <h2 className="text-3xl font-black tracking-tight">Editorial</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { t: 'The return of the adda', b: 'Why Dhaka’s twenty-somethings are swapping clubs for long tables and longer conversations.', seed: 7001, style: 'wave' as const, hues: [200, 260] as [number, number] },
            { t: 'Rooftops after dark', b: 'A night with the collectives turning the city skyline into a dance floor.', seed: 7002, style: 'grid' as const, hues: [290, 330] as [number, number] },
            { t: 'Run clubs are the new night out', b: 'Pace groups, cha stalls and the friendships made at 6:30am.', seed: 7003, style: 'sun' as const, hues: [95, 160] as [number, number] },
          ].map((s) => (
            <article key={s.t} className="group">
              <div className="aspect-[4/3] overflow-hidden rounded-3xl"><PosterArt poster={{ seed: s.seed, style: s.style, hues: s.hues }} title={s.t} showText={false} className="transition duration-500 group-hover:scale-105" /></div>
              <h3 className="mt-3 text-xl font-extrabold">{s.t}</h3>
              <p className="mt-1 text-sm text-ink-3">{s.b}</p>
            </article>
          ))}
        </div>
      </section>

      {/* CTA tiles */}
      <section className="container-x mt-24 grid gap-4 sm:grid-cols-2">
        <Link to="/create" className="group relative flex aspect-[16/10] flex-col justify-end overflow-hidden rounded-4xl p-7 text-white">
          <div className="absolute inset-0"><PosterArt poster={{ seed: 991, style: 'gradient', hues: [300, 20] }} title="" showText={false} className="transition duration-500 group-hover:scale-105" /></div>
          <div className="relative"><p className="text-sm font-semibold opacity-80"><Users className="mb-1 inline h-4 w-4" /> Host an event</p><p className="font-display text-3xl font-extrabold">Create your world</p></div>
        </Link>
        <Link to="/explore" className="group relative flex aspect-[16/10] flex-col justify-end overflow-hidden rounded-4xl p-7 text-white">
          <div className="absolute inset-0"><PosterArt poster={{ seed: 992, style: 'grid', hues: [210, 260] }} title="" showText={false} className="transition duration-500 group-hover:scale-105" /></div>
          <div className="relative"><p className="text-sm font-semibold opacity-80"><Wallet className="mb-1 inline h-4 w-4" /> Explore events</p><p className="font-display text-3xl font-extrabold">Find your world</p></div>
        </Link>
      </section>
    </div>
  );
}
