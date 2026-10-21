import { ArrowUpRight, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/api';
import { useApi } from '@/hooks/useApi';
import { useDiscovery } from '@/store/discovery';
import { PosterArt } from './PosterArt';
import { cardRange } from '@/lib/util';

export function RecentlyViewed() {
  const recent = useDiscovery((state) => state.recent);
  const { data } = useApi(() => Promise.all(recent.slice(0, 3).map((slug) => api.getEventBySlug(slug))), [recent.join('|')], { live: false });
  const cards = data?.filter((entry) => entry !== null) ?? [];
  if (!cards.length) return null;
  return (
    <section className="container-x mt-16" data-reveal data-testid="recently-viewed">
      <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-ink-3"><History size={15} />Back on your radar</div>
      <div className="grid gap-3 md:grid-cols-3">
        {cards.map(({ card }) => (
          <Link key={card.event.id} to={`/e/${card.event.slug}`} className="recent-card">
            <span className="aspect-[4/5] w-14 shrink-0 overflow-hidden rounded-lg"><PosterArt poster={card.event.poster} title={card.event.title} showText={false} /></span>
            <span className="min-w-0 flex-1"><span className="line-clamp-2 text-sm font-bold">{card.event.title}</span><span className="mt-1 block text-xs text-ink-3">{cardRange(card.event.startsAt, card.event.endsAt)}</span></span>
            <ArrowUpRight size={18} aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  );
}
