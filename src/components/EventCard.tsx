import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import type { EventCard as Card } from '@/api';
import { api } from '@/api';
import { PosterArt } from './PosterArt';
import { Avatar, AvatarStack, Verified } from './ui';
import { cardRange, tk } from '@/lib/util';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { useNavigate } from 'react-router-dom';

export function priceLabel(c: Card) {
  const at = c.event.venue.revealLater ? '' : ` at ${c.event.venue.name.split(',')[0]}`;
  if (c.fromPrice === null) return `Tickets unavailable${at}`;
  return `${c.fromPrice === 0 ? 'Free' : tk(c.fromPrice)}${at}`;
}

export function SaveButton({ eventId, className = '' }: { eventId: string; className?: string }) {
  const user = useSession((s) => s.user);
  const nav = useNavigate();
  const saved = !!user?.saved.includes(eventId);
  return (
    <button
      aria-label={saved ? 'Unsave event' : 'Save event'}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm transition hover:scale-105 ${className}`}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) return nav('/login');
        try {
          const now = await api.toggleSave(eventId);
          toast.success(now ? 'Saved to your events' : 'Removed from saved');
        } catch (err) {
          toast.error(err);
        }
      }}
    >
      <Heart className={`h-[18px] w-[18px] ${saved ? 'fill-brand text-brand' : 'text-ink'}`} />
    </button>
  );
}

export function EventCard({ card, compact = false }: { card: Card; compact?: boolean }) {
  const { event, org } = card;
  return (
    <Link to={`/e/${event.slug}`} className="group block" data-testid="event-card">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-mist">
        <PosterArt poster={event.poster} title={event.title} className="transition duration-500 group-hover:scale-[1.03]" />
        <div className="absolute left-2.5 top-2.5 flex gap-1.5">
          {card.moreDates && <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold">More dates</span>}
          {event.sponsored && <span className="rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-bold text-white">Sponsored</span>}
        </div>
        <SaveButton eventId={event.id} className="absolute right-2.5 top-2.5" />
      </div>
      <div className="mt-2.5 space-y-0.5">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-3">
          <Avatar name={org.name} hue={org.avatarHue} url={org.avatarUrl} size={18} />
          <span className="truncate">{org.name}</span>
          {org.verified && <Verified className="h-3.5 w-3.5" />}
        </p>
        <h3 className={`line-clamp-2 font-display font-bold leading-snug ${compact ? 'text-[15px]' : 'text-base'}`}>{event.title}</h3>
        <p className="truncate text-[13px] text-ink-2">{priceLabel(card)}</p>
        <p className="text-[13px] text-ink-3">{cardRange(event.startsAt, event.endsAt)}</p>
      </div>
    </Link>
  );
}

export function FeaturedCard({ card }: { card: Card }) {
  const { event, org } = card;
  const extra = event.lineup.length - 4;
  return (
    <Link to={`/e/${event.slug}`} className="group flex w-[86vw] max-w-[720px] shrink-0 snap-start flex-col overflow-hidden rounded-3xl border border-line bg-white sm:w-[680px] sm:flex-row" data-testid="featured-card">
      <div className="relative aspect-[4/5] w-full shrink-0 overflow-hidden sm:w-[260px]">
        <PosterArt poster={event.poster} title={event.title} className="transition duration-500 group-hover:scale-[1.03]" />
        <SaveButton eventId={event.id} className="absolute right-3 top-3" />
      </div>
      <div className="flex flex-1 flex-col justify-between gap-4 p-5 sm:p-6">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium text-ink-3">
            <Avatar name={org.name} hue={org.avatarHue} url={org.avatarUrl} size={22} />
            {org.name}
            {org.verified && <Verified />}
          </p>
          <h3 className="line-clamp-3 text-2xl font-extrabold leading-tight">{event.title}</h3>
          <p className="text-[15px] text-ink-2">{priceLabel(card)}</p>
          <p className="text-[15px] text-ink-3">{cardRange(event.startsAt, event.endsAt)}</p>
        </div>
        {event.lineup.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {event.lineup.slice(0, 4).map((l) => (
              <span key={l.id} className="rounded-full bg-mist px-3 py-1 text-xs font-semibold">
                {l.name}
              </span>
            ))}
            {extra > 0 && <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold">+{extra}</span>}
          </div>
        )}
        {card.goingCount > 0 && (
          <div className="flex items-center gap-2 text-[13px] text-ink-3">
            <AvatarStack people={card.goingPreview} size={26} />
            {card.goingCount > card.goingPreview.length && <span className="font-semibold text-ink-2">+{card.goingCount - card.goingPreview.length}</span>}
          </div>
        )}
      </div>
    </Link>
  );
}
