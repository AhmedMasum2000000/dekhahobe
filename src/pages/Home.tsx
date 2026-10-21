import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Check, Footprints, Headphones, Instagram, Laugh, MapPin, Megaphone, Music2, Palette, Rocket, Sparkles, Users, Wallet } from 'lucide-react';
import { api, type BpopEvent } from '@/api';
import { useApi } from '@/hooks/useApi';
import { PosterArt } from '@/components/PosterArt';
import { EventCard } from '@/components/EventCard';
import { Avatar, AvatarStack, PopStar, Sparkle, Verified } from '@/components/ui';
import { cardRange, dayLabel, tk } from '@/lib/util';
import heroArt from '@/assets/dekha-hobe-hero.webp';
import { MotionToggle } from '@/components/ExperienceEffects';
import { RecentlyViewed } from '@/components/RecentlyViewed';
import { useMotion } from '@/store/motion';

export const INSTAGRAM_URL = 'https://www.instagram.com/bpop.tags/';

function PosterRow({ events, reverse, paused }: { events: BpopEvent[]; reverse?: boolean; paused: boolean }) {
  const list = [...events, ...events];
  return (
    <div className="overflow-hidden">
      <div className={`flex w-max gap-3 ${reverse ? 'animate-marqueeRev' : 'animate-marquee'} ${paused ? '[animation-play-state:paused]' : 'hover:[animation-play-state:paused]'}`}>
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
    <div className="flex flex-wrap justify-center gap-2">
      <Link to="/explore" className="btn btn-brand btn-lg">Explore events <ArrowUpRight size={18} aria-hidden /></Link>
      <Link to="/saved" className="btn btn-outline btn-lg">Save your favorites</Link>
    </div>
  );
}

function PhoneMock({ children, tilt = 0 }: { children: React.ReactNode; tilt?: number }) {
  return (
    <div className="relative h-[420px] w-[210px] shrink-0 rounded-[2.4rem] border-[7px] border-ink bg-surface shadow-2xl" style={{ transform: `rotate(${tilt}deg)` }}>
      <div className="absolute left-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full bg-action" />
      <div className="h-full overflow-hidden rounded-[1.9rem] pt-8">{children}</div>
    </div>
  );
}

/** Small stamp used on Dekha Hobe posts: "OFF THE GRID / ON OUR RADAR". */
function RadarStamp({ className = 'text-ink' }: { className?: string }) {
  return (
    <span className={`stamp ${className}`}>
      Off the grid <Sparkle className="h-2.5 w-2.5" /> On our radar
    </span>
  );
}

function SectionHead({ children, sub, action }: { children: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="min-w-0">
        {sub}
        <h2 className="headline mt-3 max-w-3xl text-[40px] sm:text-6xl">{children}</h2>
      </div>
      {action}
    </div>
  );
}

/** True while the element is on screen, so off-screen animation can stop. */
function useOnScreen<T extends Element>() {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setOn(!!e?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, on] as const;
}

export default function Home() {
  const { data } = useApi(() => api.homeFeed(), []);
  const { paused, reduced } = useMotion();
  const [marqueeRef, marqueeOn] = useOnScreen<HTMLDivElement>();
  const [artRef, artOn] = useOnScreen<HTMLDivElement>();
  const posters = data?.posters ?? [];
  const third = Math.ceil(posters.length / 3);
  const rows = [posters.slice(0, third), posters.slice(third, third * 2), posters.slice(third * 2)].map((r) => (r.length ? r : posters));
  const f = data?.featured;

  return (
    <div>
      {/* The original artwork stays intact; the surrounding layout becomes an editorial cover. */}
      <section className="culture-hero" aria-labelledby="hero-heading">
        <div className="container-x hero-edition">
          <span><span className="edition-dot" />INDEPENDENT CULTURE. REAL CONNECTIONS.</span>
          <span className="hidden sm:inline">DHAKA / CHATTOGRAM / BEYOND</span>
        </div>
        <div className="container-x hero-cover">
          <div className="hero-copy">
            <div className="hero-kicker"><RadarStamp className="text-brand-dark" /><span>THE CITY IS YOURS.</span></div>
            <h1 id="hero-heading" className="hero-headline" data-testid="hero-title">
              Find your<br /><span className="hero-word">kind of</span><br /><span className="hero-alive">alive.<ArrowUpRight aria-hidden /></span>
            </h1>
            <p className="hero-description">Small gigs. Big feelings. Art that stays with you. Discover music, nightlife and unexpected plans across Bangladesh — and the people who make them worth going to.</p>
            <div className="hero-actions">
              <Link to="/explore" className="btn btn-brand btn-lg hero-primary" data-testid="hero-explore">Find your next plan <ArrowUpRight size={20} aria-hidden /></Link>
              <Link to="/create" className="hero-host-link">Make something happen <ArrowRight size={16} aria-hidden /></Link>
            </div>
            <p className="hero-footnote"><Check size={14} aria-hidden />Browse first. Find your people. See you there.</p>
          </div>
          <div className="hero-art-stage" ref={artRef} data-in-view={artOn} onPointerMove={(event) => {
            if (paused || reduced || event.pointerType !== 'mouse') return;
            const rect = event.currentTarget.getBoundingClientRect();
            event.currentTarget.style.setProperty('--art-x', `${((event.clientX - rect.left) / rect.width - .5) * 12}px`);
            event.currentTarget.style.setProperty('--art-y', `${((event.clientY - rect.top) / rect.height - .5) * 10}px`);
          }} onPointerLeave={(event) => {
            event.currentTarget.style.setProperty('--art-x', '0px');
            event.currentTarget.style.setProperty('--art-y', '0px');
          }}>
            <span className="hero-orbit" aria-hidden />
            <span className="hero-art-label">GOOD ART. / BETTER COMPANY.</span>
            <figure className="hero-art-figure" data-testid="hero-art">
              <img src={heroArt} width={960} height={1091} alt="Original Bpop Tags artwork: a Mughal-style woman in sunglasses with a parrot and a lotus" className="hero-artwork" draggable={false} fetchPriority="high" decoding="async" />
            </figure>
            <div className="hero-sticker"><Sparkles size={21} aria-hidden /><span>OFFLINE<br />LOOKS GOOD<br />ON YOU.</span></div>
            <Sparkle className="hero-sparkle hero-sparkle-one" />
            <Sparkle className="hero-sparkle hero-sparkle-two" />
            {f && <Link className="hero-radar-card" to={`/e/${f.event.slug}`}>
              <span className="hero-radar-art"><PosterArt poster={f.event.poster} title={f.event.title} showText={false} /></span>
              <span className="min-w-0"><span className="hero-radar-eyebrow">A LITTLE SOMETHING FOR YOUR RADAR</span><span className="mt-1 block line-clamp-2 text-sm font-bold">{f.event.title}</span><span className="mt-1 flex items-center gap-1 text-xs text-ink-3"><MapPin size={12} />{f.event.venue.city}</span></span>
              <ArrowUpRight className="shrink-0" size={20} aria-hidden />
            </Link>}
          </div>
        </div>
        <div className="container-x hero-bottom-note"><span>SCROLL FOR SOMETHING WORTH GOING OUT FOR <ArrowRight size={13} aria-hidden /></span><MotionToggle /></div>
        {posters.length > 0 && (
          <div ref={marqueeRef} className="relative space-y-3">
            <PosterRow events={rows[0]!} paused={!marqueeOn || paused || reduced} />
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[10%] bg-gradient-to-r from-surface to-transparent" aria-hidden />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[10%] bg-gradient-to-l from-surface to-transparent" aria-hidden />
          </div>
        )}
      </section>

      {/* live featured event */}
      <section className="scene-picker container-x" aria-labelledby="scene-heading" data-reveal>
        <div className="scene-heading"><span className="editorial-index">01 / FOLLOW THE FEELING</span><h2 id="scene-heading">What’s your scene?</h2><p>Follow a feeling. Find a plan.</p></div>
        <div className="scene-links">
          {[
            { title: 'After dark', note: 'Find your frequency', category: 'Nightlife', icon: Headphones, color: 'pink' },
            { title: 'Live & loud', note: 'Be there for the encore', category: 'Concerts', icon: Music2, color: 'violet' },
            { title: 'Art & oddities', note: 'A different point of view', category: 'Arts & Fashion', icon: Palette, color: 'orange' },
            { title: 'A good laugh', note: 'Best shared with friends', category: 'Comedy', icon: Laugh, color: 'green' },
            { title: 'Out of office', note: 'Move. Meet. Repeat.', category: 'Fitness', icon: Footprints, color: 'blue' },
          ].map(({title,note,category,icon:Icon,color}) => <Link key={category} className={`scene-link scene-${color}`} to={`/explore?category=${encodeURIComponent(category)}`} data-testid="scene-link"><span className="scene-icon"><Icon size={23} strokeWidth={1.6} aria-hidden /></span><span><strong>{title}</strong><small>{note}</small></span><ArrowUpRight className="scene-arrow" size={19} aria-hidden /></Link>)}
        </div>
      </section>
      <RecentlyViewed />

      {f && (
        <section data-reveal className="container-x mt-12">
          <div className="card flex flex-col items-start gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
            <Link to={`/e/${f.event.slug}`} className="block aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-2xl">
              <PosterArt poster={f.event.poster} title={f.event.title} showText={false} />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-dark">Happening soon</p>
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

      {/* off the grid · on our radar */}
      {data && data.radar.length > 0 && (
        <section data-reveal className="container-x mt-20" data-testid="radar">
          <SectionHead
            sub={<RadarStamp />}
            action={<Link to="/explore" className="btn btn-outline btn-md shrink-0">View all <ArrowRight className="h-4 w-4" /></Link>}
          >
            Upcoming sub-culture events media <span className="text-pop-red">won’t</span> tell you about
          </SectionHead>
          <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
            {data.radar.map((c) => (
              <div key={c.event.id} className="w-[220px] shrink-0 snap-start sm:w-[250px]"><EventCard card={c} /></div>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.2em] text-ink-4 sm:hidden">Swipe to see <ArrowRight className="h-3 w-3" /></p>
        </section>
      )}

      {/* here's what you missed last week */}
      {data && data.recap.length > 0 && (
        <section data-reveal className="relative mt-24 overflow-hidden border-y border-line bg-brand-light py-16" data-testid="recap">
          <div className="halftone halftone-fade pointer-events-none absolute -right-16 -top-10 h-72 w-72 text-brand/25" aria-hidden />
          <div className="container-x relative">
            <SectionHead sub={<span className="tag-pop">Recap</span>}>
              Here’s what you <span className="text-brand">missed</span> last week
            </SectionHead>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
              {data.recap.map((c) => (
                <Link key={c.event.id} to={`/e/${c.event.slug}`} className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-action">
                  <PosterArt poster={c.event.poster} title={c.event.title} className="transition duration-500 group-hover:scale-[1.03]" />
                  <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
                    <span className="rounded-full bg-surface/95 px-2.5 py-1 text-[11px] font-bold">{dayLabel(c.event.startsAt)}</span>
                    {c.goingCount > 0 && <span className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-white">{c.goingCount.toLocaleString()} went</span>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* we found art */}
      {data && data.art.length > 0 && (
        <section data-reveal className="container-x mt-24" data-testid="found-art">
          <div className="grid items-start gap-8 lg:grid-cols-[1fr_2fr]">
            <div className="relative">
              <h2 className="headline text-[84px] leading-[0.85] sm:text-[120px]">
                <PopStar className="mr-1 inline-block h-[0.6em] w-[0.6em] -translate-y-[0.3em] -rotate-12" />We found <span className="outline-pop">art</span>
              </h2>
              <p className="mt-5 max-w-sm text-ink-2">Exhibitions, design markets, zines and the artists shaping Bangladesh’s visual culture — spotted by the Dekha Hobe team.</p>
              <Link to={`/explore?category=${encodeURIComponent('Arts & Fashion')}`} className="btn btn-primary btn-lg mt-6">Explore arts &amp; fashion</Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {data.art.map((c, i) => (
                <div key={c.event.id} className={i === 2 ? 'hidden sm:block' : ''}><EventCard card={c} /></div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* app section */}
      <section data-reveal className="container-x mt-24">
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
                    <div className="mt-3 rounded-full bg-action py-2 text-center text-[11px] font-bold text-white">Get tickets</div>
                  </div>
                )}
              </PhoneMock>
            </div>
          </div>
          <div>
            <h2 className="headline text-5xl sm:text-6xl">Plans, sorted.</h2>
            <div className="mt-8 space-y-6">
              {[
                ['Find social plans in seconds', 'A feed tuned to your city, your friends and what you love.'],
                ['See the vibe and who’s going', 'Lineups, guest lists and the friends who already have tickets.'],
                ['Put the phone down and go out', 'Tickets live in the app — tap, scan, you’re in.'],
              ].map(([t, b], i) => (
                <div key={t} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft font-display font-extrabold text-brand-dark">{i + 1}</span>
                  <div><p className="text-lg font-bold">{t}</p><p className="text-ink-3">{b}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* testimonial */}
      <section data-reveal className="container-x mt-24 text-center">
        <p className="mx-auto max-w-3xl font-display text-2xl font-bold leading-snug sm:text-4xl">From “what’s the plan?” to “see you there.”</p>
        <p className="mx-auto mt-4 max-w-xl text-ink-3">Save the events you love, bring your friends and keep your tickets close. Your next good memory starts with a plan.</p>
        <div className="mt-6 flex justify-center"><StoreButtons /></div>
      </section>

      {/* culture & community */}
      {data?.spotlight && (
        <section data-reveal className="relative mt-24 overflow-hidden bg-mist py-16">
          <div className="container-x grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h2 className="headline text-5xl sm:text-6xl">Driving culture &amp; community</h2>
              <p className="mt-4 max-w-md text-ink-2">We partner with the collectives, venues and brands that keep Bangladesh’s culture alive.</p>
              <Link to="/platform" className="btn btn-primary btn-lg mt-6">Dekha Hobe for Organizers <ArrowRight className="h-4 w-4" /></Link>
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
                <span key={i} className="flex items-center gap-12 font-poster text-3xl uppercase text-ink-4">{o.name}<Sparkle className="h-4 w-4 text-brand" /></span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* organizer pitch */}
      <section data-reveal className="container-x mt-24">
        <div className="text-center">
          <h2 className="headline mx-auto max-w-3xl text-5xl sm:text-7xl">Throw a party. Build a community. Find your people.</h2>
          <p className="mx-auto mt-4 max-w-xl text-ink-2">Everything you need to create, sell out and scale your events — in one Organizer Dashboard.</p>
          <Link to="/create" className="btn btn-primary btn-lg mt-6">Create your first event <ArrowUpRight size={18} /></Link>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {posters.slice(5, 8).map((e, i) => (
            <div key={e.id} className="relative aspect-[4/5] overflow-hidden rounded-3xl">
              <PosterArt poster={e.poster} title={e.title} />
              <span className="absolute bottom-4 right-4 rounded-full bg-surface px-4 py-2 font-display text-lg font-extrabold shadow">{tk([64000, 298300, 839500][i]!)}</span>
            </div>
          ))}
        </div>
        <div className="mt-14 grid gap-10 md:grid-cols-3">
          {[
            { n: '01', k: 'Create', t: 'Bring your idea to life', b: 'Design an event page as unique as your event — tiers, lineups, guest lists and door sales.', icon: <Sparkles className="h-5 w-5" /> },
            { n: '02', k: 'Earn', t: 'We’ll help you find your crowd', b: 'Get discovered in the Explore feed, turn buyers into promoters with Kickbacks and text your audience for free.', icon: <Megaphone className="h-5 w-5" /> },
            { n: '03', k: 'Scale', t: 'Turn your community into culture', b: 'Make data-backed decisions with real-time insights, and ask Dekha Hobe AI anything about your events.', icon: <Rocket className="h-5 w-5" /> },
          ].map((s) => (
            <div key={s.n}>
              <p className="flex items-center gap-2 text-sm font-bold text-brand-dark">{s.icon}{s.n}. {s.k}</p>
              <h3 className="mt-2 text-2xl font-extrabold">{s.t}</h3>
              <p className="mt-2 text-ink-3">{s.b}</p>
              <Link to="/platform" className="mt-3 inline-flex text-sm font-semibold underline underline-offset-4">Learn more</Link>
            </div>
          ))}
        </div>
      </section>

      {/* organizer quote */}
      <section data-reveal className="container-x mt-24">
        <div className="grid overflow-hidden rounded-4xl bg-action text-white md:grid-cols-2">
          <div className="p-8 sm:p-12">
            <p className="font-display text-3xl font-bold leading-snug">“Dekha Hobe let us take one Friday run around the lake and turn it into a city-wide community.”</p>
            <p className="mt-6 font-semibold">Gulshan Run Club</p>
            <p className="text-sm text-white/60">Free community runs every Friday & Saturday</p>
            <Link to="/g/gulshan-run-club" className="btn btn-lg mt-6 bg-surface text-ink hover:bg-surface/90">View organizer</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 p-6">
            {posters.slice(8, 12).map((e) => (
              <div key={e.id} className="aspect-[4/5] overflow-hidden rounded-2xl"><PosterArt poster={e.poster} title={e.title} showText={false} /></div>
            ))}
          </div>
        </div>
      </section>

      {/* magazine */}
      <section data-reveal className="container-x mt-24">
        <SectionHead
          sub={<span className="tag-pop">Dekha Hobe Magazine</span>}
          action={<a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="btn btn-outline btn-md shrink-0"><Instagram className="h-4 w-4" />Instagram</a>}
        >
          Stories from the scene
        </SectionHead>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { k: 'Off the grid', t: 'Rebirth of Dhaka’s music culture', b: 'Bedroom producers, basement shows and the collectives building a new sound for the city.', seed: 7001, style: 'zine' as const, hues: [330, 0] as [number, number] },
            { k: 'We found art', t: 'Looking for physical media shops in Dhaka?', b: 'Vinyl, cassettes, comics and zines — a field guide to the city’s last record shops.', seed: 7002, style: 'grid' as const, hues: [290, 330] as [number, number] },
            { k: 'On our radar', t: 'Run clubs are the new night out', b: 'Pace groups, cha stalls and the friendships made at 5:45am.', seed: 7003, style: 'sun' as const, hues: [95, 160] as [number, number] },
          ].map((s) => (
            <article key={s.t} className="group">
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
                <PosterArt poster={{ seed: s.seed, style: s.style, hues: s.hues }} title={s.t} showText={false} className="transition duration-500 group-hover:scale-105" />
                <span className="absolute bottom-3 left-3 rounded-full bg-surface px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em]">{s.k}</span>
              </div>
              <h3 className="mt-3 text-xl font-extrabold">{s.t}</h3>
              <p className="mt-1 text-sm text-ink-3">{s.b}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container-x mt-24" data-reveal>
        <div className="faq-editorial">
          <div><span className="editorial-index">A FEW THINGS BEFORE YOU GO</span><h2 className="headline mt-4 text-4xl sm:text-5xl">Good questions.<br /><span className="text-brand">Easy plans.</span></h2></div>
          <div>
            <details><summary>Where can I find events in Dhaka and beyond?</summary><p>Start with <Link to="/explore">Explore events</Link>. Filter by city, date and the kind of experience you love, from live music and nightlife to art, comedy and community meetups across Bangladesh.</p></details>
            <details><summary>Are there free events and community meetups?</summary><p>Absolutely. Use the <Link to="/explore?price=free">Free events filter</Link> to discover no-cost plans. Check each event page for its location, schedule and RSVP options.</p></details>
            <details><summary>How do I bring my own community together?</summary><p><Link to="/create">Create an event</Link> to start with your idea, then add the details, artwork and ticket options. Explore our <Link to="/platform">organizer tools</Link> for guest lists, check-in and more.</p></details>
            <details><summary>Can I book real tickets here?</summary><p>This is the Dekha Hobe demo experience. You can try the ticketing flows, but payments and SMS are simulated and no money is charged. Your demo data stays in your browser.</p></details>
          </div>
        </div>
      </section>

      {/* CTA tiles */}
      <section data-reveal className="container-x mt-24 grid gap-4 sm:grid-cols-2">
        <Link to="/create" className="group relative flex aspect-[16/10] flex-col justify-end overflow-hidden rounded-4xl p-7 text-white">
          <div className="absolute inset-0"><PosterArt poster={{ seed: 991, style: 'zine', hues: [320, 0] }} title="" showText={false} className="transition duration-500 group-hover:scale-105" /></div>
          <div className="relative"><p className="text-sm font-semibold opacity-80"><Users className="mb-1 inline h-4 w-4" /> Host an event</p><p className="headline text-4xl">Create your world</p></div>
        </Link>
        <Link to="/explore" className="group relative flex aspect-[16/10] flex-col justify-end overflow-hidden rounded-4xl p-7 text-white">
          <div className="absolute inset-0"><PosterArt poster={{ seed: 992, style: 'grid', hues: [210, 260] }} title="" showText={false} className="transition duration-500 group-hover:scale-105" /></div>
          <div className="relative"><p className="text-sm font-semibold opacity-80"><Wallet className="mb-1 inline h-4 w-4" /> Explore events</p><p className="headline text-4xl">Find your world</p></div>
        </Link>
      </section>
    </div>
  );
}
