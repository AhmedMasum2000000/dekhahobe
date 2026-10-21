import { useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react';
import { api, CATEGORIES, CITIES, type ExploreFilters } from '@/api';
import { useApi } from '@/hooks/useApi';
import { EventCard, FeaturedCard } from '@/components/EventCard';
import { Empty, Spinner } from '@/components/ui';

const DATE_OPTS: [NonNullable<ExploreFilters['date']>, string][] = [
  ['any', 'Any date'],
  ['today', 'Today'],
  ['tomorrow', 'Tomorrow'],
  ['weekend', 'This weekend'],
  ['week', 'This week'],
  ['month', 'This month'],
];
const PRICE_OPTS: [NonNullable<ExploreFilters['price']>, string][] = [
  ['any', 'Any price'],
  ['free', 'Free'],
  ['under500', 'Under ৳500'],
  ['under1500', 'Under ৳1,500'],
  ['over1500', '৳1,500+'],
];

function Select<T extends string>({ label, value, options, onChange, testId }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void; testId: string }) {
  const active = value !== options[0]![0];
  return (
    <label className={`relative inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold ${active ? 'border-ink bg-action text-white' : 'border-line bg-surface text-ink-2'}`}>
      <span className="pointer-events-none">{active ? options.find((o) => o[0] === value)?.[1] : label}</span>
      <select aria-label={label} data-testid={testId} className="absolute inset-0 cursor-pointer opacity-0" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const filters: ExploreFilters = {
    q: params.get('q') ?? '',
    city: (params.get('city') as ExploreFilters['city']) ?? 'All',
    category: (params.get('category') as ExploreFilters['category']) ?? 'All',
    date: (params.get('date') as ExploreFilters['date']) ?? 'any',
    price: (params.get('price') as ExploreFilters['price']) ?? 'any',
  };
  const key = params.toString();
  const { data, loading } = useApi(() => api.explore(filters), [key]);
  const rail = useRef<HTMLDivElement>(null);
  const set = (k: string, v: string, def: string) => {
    const next = new URLSearchParams(params);
    if (!v || v === def) next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };
  const anyFilter = useMemo(() => [...params.keys()].length > 0, [params]);
  const scroll = (d: number) => rail.current?.scrollBy({ left: d * 700, behavior: 'smooth' });

  return (
    <div className="container-x pt-8">
      <div className="explore-intro flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="editorial-index mb-3">THE GOOD KIND OF GOING OUT</p><h1 className="headline text-5xl sm:text-7xl">Discover <span className="text-brand">events</span></h1><p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-3">Find a sound, a scene, a reason to get out. Independent culture, all across Bangladesh.</p></div>
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-4" />
          <input
            className="input rounded-full pl-10"
            placeholder="Search events, artists, venues"
            defaultValue={filters.q}
            onChange={(e) => set('q', e.target.value, '')}
            data-testid="search"
            aria-label="Search events"
          />
        </div>
      </div>

      <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1">
        {(['All', ...CATEGORIES] as const).map((c) => (
          <button key={c} className={`chip ${filters.category === c ? 'chip-on' : ''}`} onClick={() => set('category', c, 'All')}>
            {c === 'All' ? 'All events' : c}
          </button>
        ))}
      </div>

      {/* featured */}
      {!anyFilter && data && data.featured.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-baseline gap-2 text-2xl font-extrabold">
              Featured events <span className="text-base font-semibold text-ink-4">{data.featured.length}</span>
            </h2>
            <div className="hidden gap-2 sm:flex">
              <button className="btn btn-outline h-10 w-10 p-0" onClick={() => scroll(-1)} aria-label="Previous"><ChevronLeft className="h-5 w-5" /></button>
              <button className="btn btn-outline h-10 w-10 p-0" onClick={() => scroll(1)} aria-label="Next"><ChevronRight className="h-5 w-5" /></button>
            </div>
          </div>
          <div ref={rail} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2">
            {data.featured.map((c) => (
              <FeaturedCard key={c.event.id} card={c} />
            ))}
          </div>
        </section>
      )}

      {/* trending */}
      <section className="mt-12">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-baseline gap-2 text-2xl font-extrabold">
            {anyFilter ? 'Results' : 'Trending events'}
            <span className="text-base font-semibold text-ink-4">{data ? (data.trending.length >= 100 ? '100+' : data.trending.length) : ''}</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-ink-4" />
            <Select label="Location" testId="filter-location" value={filters.city as string} options={[['All', 'All of Bangladesh'], ...CITIES.map((c) => [c, c] as [string, string])]} onChange={(v) => set('city', v, 'All')} />
            <Select label="Date" testId="filter-date" value={filters.date!} options={DATE_OPTS} onChange={(v) => set('date', v, 'any')} />
            <Select label="Price" testId="filter-price" value={filters.price!} options={PRICE_OPTS} onChange={(v) => set('price', v, 'any')} />
            {anyFilter && (
              <button className="text-sm font-semibold underline underline-offset-4" onClick={() => setParams({}, { replace: true })}>
                Clear
              </button>
            )}
          </div>
        </div>
        {loading && !data ? (
          <div className="flex justify-center py-20"><Spinner className="h-7 w-7" /></div>
        ) : data && data.trending.length === 0 ? (
          <Empty title="No events match those filters" body="Try another date, a different city or clear the filters." action={<button className="btn btn-primary btn-md" onClick={() => setParams({})}>Clear filters</button>} />
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4" data-testid="trending-grid">
            {data?.trending.map((c) => <EventCard key={c.event.id} card={c} />)}
          </div>
        )}
      </section>
    </div>
  );
}
