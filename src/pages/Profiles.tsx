import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bell, Copy, Globe, Heart, Instagram, Link2, Lock, Wallet } from 'lucide-react';
import { api, CITIES, type City, type EventCard as Card } from '@/api';
import { useApi } from '@/hooks/useApi';
import { PosterArt } from '@/components/PosterArt';
import { EventCard, priceLabel } from '@/components/EventCard';
import { Avatar, Badge, Empty, Field, Modal, PageSpinner, Toggle, Verified } from '@/components/ui';
import { ago, cardRange, dayLabel, timeLabel, tk } from '@/lib/util';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { FollowButton } from './Event';
import { RequireLogin } from './Login';

function EventRow({ c }: { c: Card }) {
  return (
    <Link to={`/e/${c.event.slug}`} className="flex items-center gap-4 border-b border-line py-4 last:border-0" data-testid="org-event-row">
      <div className="aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-xl"><PosterArt poster={c.event.poster} title={c.event.title} showText={false} /></div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-ink-3">{dayLabel(c.event.startsAt)} · {timeLabel(c.event.startsAt)}</p>
        <p className="line-clamp-2 font-bold leading-snug">{c.event.title}</p>
        <p className="text-[13px] text-ink-3">{c.event.venue.revealLater ? c.event.venue.city : c.event.venue.name}</p>
      </div>
    </Link>
  );
}

export function OrgProfile() {
  const { slug = '' } = useParams();
  const { data, loading } = useApi(() => api.getOrg(slug), [slug]);
  const [bio, setBio] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);
  if (loading && !data) return <PageSpinner />;
  if (!data) return <div className="container-x py-20"><Empty title="Organizer not found" /></div>;
  const { org, upcoming, past, stats } = data;
  return (
    <div className="pb-16">
      <div className="h-44 overflow-hidden sm:h-64"><PosterArt poster={{ seed: org.bannerSeed, style: 'gradient', hues: [org.avatarHue, (org.avatarHue + 50) % 360] }} title="" showText={false} /></div>
      <div className="container-x max-w-3xl">
        <div className="-mt-14 flex items-end justify-between gap-3">
          <div className="rounded-full border-4 border-white bg-white"><Avatar name={org.name} hue={org.avatarHue} url={org.avatarUrl} size={104} /></div>
          <FollowButton orgId={org.id} size="md" />
        </div>
        <h1 className="headline mt-3 flex items-center gap-2 text-5xl" data-testid="org-name">{org.name}{org.verified && <Verified className="h-6 w-6" />}</h1>
        <p className="text-ink-3">@{org.slug}</p>
        <p className="mt-2 text-sm font-semibold">{stats.events} events • {stats.attendees.toLocaleString()} attendees • {stats.followers.toLocaleString()} followers</p>
        {org.instagram && <a href={`https://instagram.com/${org.instagram}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-ink-2"><Instagram className="h-4 w-4" />@{org.instagram}</a>}
        {org.bio && (
          <p className="mt-3 text-[15px] text-ink-2">
            {bio || org.bio.length < 110 ? org.bio : `${org.bio.slice(0, 110)}… `}
            {org.bio.length >= 110 && !bio && <button className="font-semibold" onClick={() => setBio(true)}>more</button>}
          </p>
        )}
        {org.website && /^https?:\/\//i.test(org.website) && <a href={org.website} target="_blank" rel="noreferrer noopener" className="mt-1 inline-flex items-center gap-1 text-sm underline"><Globe className="h-4 w-4" />{org.website.replace(/^https?:\/\//, '')}</a>}
        <div className="mt-8 border-t border-line pt-6">
          <h2 className="text-xl font-extrabold">Upcoming Events</h2>
          {upcoming.length ? upcoming.map((c) => <EventRow key={c.event.id} c={c} />) : <p className="py-4 text-sm text-ink-3">No upcoming events right now — follow to hear about the next one.</p>}
        </div>
        {past.length > 0 && (
          <div className="mt-8 border-t border-line pt-6">
            <h2 className="text-xl font-extrabold">Past Events</h2>
            {(showAllPast ? past : past.slice(0, 6)).map((c) => <EventRow key={c.event.id} c={c} />)}
            {past.length > 6 && !showAllPast && <button className="mt-3 text-sm font-semibold underline" onClick={() => setShowAllPast(true)}>Show all {past.length}</button>}
          </div>
        )}
      </div>
    </div>
  );
}

export function UserProfile() {
  const { username = '' } = useParams();
  const me = useSession((s) => s.user);
  const nav = useNavigate();
  const { data, loading } = useApi(() => api.getUserProfile(username), [username]);
  if (loading && !data) return <PageSpinner />;
  if (!data) return <div className="container-x py-20"><Empty title="User not found" /></div>;
  const { user, going } = data;
  const isMe = me?.id === user.id;
  const following = !!me?.friends.includes(user.id);
  const blocked = !!me?.blocked.includes(user.id);
  return (
    <div className="container-x max-w-3xl pb-16 pt-10">
      <div className="flex items-center gap-5">
        <Avatar name={user.name} hue={user.avatarHue} url={user.avatarUrl} size={88} />
        <div className="min-w-0">
          <h1 className="text-3xl font-black tracking-tight">{user.name}</h1>
          <p className="text-ink-3">@{user.username} · {user.city}</p>
          {user.bio && <p className="mt-1 text-sm text-ink-2">{user.bio}</p>}
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        {isMe ? (
          <Link to="/settings" className="btn btn-outline btn-md">Edit profile</Link>
        ) : (
          <>
            <button className={`btn btn-md ${following ? 'btn-outline' : 'btn-primary'}`} onClick={async () => { if (!me) return nav('/login'); await api.toggleFollowUser(user.id); }}>{following ? 'Following' : 'Follow'}</button>
            {me && <button className="btn btn-ghost btn-md" onClick={async () => { await api.blockUser(user.id, !blocked); toast.info(blocked ? 'Unblocked' : 'Blocked — they won’t see you in guest lists or chats'); }}>{blocked ? 'Unblock' : 'Block'}</button>}
          </>
        )}
      </div>
      <h2 className="mt-10 text-xl font-extrabold">{isMe ? 'You’re going to' : 'Going to'}</h2>
      {user.privateProfile && !isMe ? (
        <Empty icon={<Lock className="h-7 w-7" />} title="This profile is private" />
      ) : going.length ? (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">{going.map((c) => <EventCard key={c.event.id} card={c} compact />)}</div>
      ) : (
        <p className="mt-3 text-sm text-ink-3">No upcoming plans yet.</p>
      )}
    </div>
  );
}

export function SeriesPage() {
  const { id = '' } = useParams();
  const { data, loading } = useApi(() => api.getSeries(id), [id]);
  if (loading && !data) return <PageSpinner />;
  if (!data?.length) return <div className="container-x py-20"><Empty title="Series not found" /></div>;
  const upcoming = data.filter((c) => new Date(c.event.endsAt).getTime() > Date.now());
  return (
    <div className="container-x max-w-3xl pb-16 pt-10">
      <p className="text-sm font-semibold text-ink-3">{data[0]!.org.name}</p>
      <h1 className="text-3xl font-black tracking-tight">{data[0]!.event.title}</h1>
      <p className="mt-1 text-ink-3">All dates</p>
      <div className="mt-6 space-y-3">
        {upcoming.map((c) => (
          <Link key={c.event.id} to={`/e/${c.event.slug}`} className="card flex items-center justify-between gap-3 p-4 hover:shadow-card">
            <div><p className="font-bold">{cardRange(c.event.startsAt, c.event.endsAt)}</p><p className="text-sm text-ink-3">{priceLabel(c)}</p></div>
            <span className="btn btn-primary btn-sm">Tickets</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Saved() {
  return <RequireLogin><SavedInner /></RequireLogin>;
}
function SavedInner() {
  const { data, loading } = useApi(() => api.savedEvents(), []);
  return (
    <div className="container-x pb-16 pt-8">
      <h1 className="headline text-5xl">Saved events</h1>
      {loading && !data ? <PageSpinner /> : data?.length ? (
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">{data.map((c) => <EventCard key={c.event.id} card={c} />)}</div>
      ) : (
        <div className="mt-6"><Empty icon={<Heart className="h-8 w-8" />} title="Nothing saved yet" body="Tap the heart on any event to save it for later." action={<Link to="/explore" className="btn btn-primary btn-md">Explore</Link>} /></div>
      )}
    </div>
  );
}

export function Notifications() {
  return <RequireLogin><NotificationsInner /></RequireLogin>;
}
function NotificationsInner() {
  const { data } = useApi(() => api.notifications(), []);
  const unread = data?.some((n) => !n.read);
  return (
    <div className="container-x max-w-2xl pb-16 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="headline text-5xl">Activity</h1>
        {unread && <button className="text-sm font-semibold underline" onClick={() => api.markNotificationsRead()}>Mark all read</button>}
      </div>
      <div className="mt-6 divide-y divide-line">
        {data?.length === 0 && <Empty icon={<Bell className="h-8 w-8" />} title="No activity yet" />}
        {data?.map((n) => (
          <Link key={n.id} to={n.link ?? '#'} onClick={() => api.markNotificationsRead()} className="flex gap-3 py-4">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-brand'}`} />
            <div className="min-w-0 flex-1"><p className="font-semibold">{n.title}</p><p className="text-sm text-ink-3">{n.body}</p></div>
            <span className="shrink-0 text-xs text-ink-4">{ago(n.createdAt)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Kickbacks() {
  return <RequireLogin><KickbacksInner /></RequireLogin>;
}
function KickbacksInner() {
  const { data } = useApi(() => api.myKickbacks(), []);
  return (
    <div className="container-x max-w-3xl pb-16 pt-8">
      <h1 className="headline text-5xl">Kickbacks</h1>
      <p className="mt-2 text-ink-3">Share events with your personal link and earn when friends buy tickets.</p>
      <div className="mt-6 rounded-3xl bg-ink p-6 text-white">
        <p className="text-sm opacity-70">Total earned</p>
        <p className="font-display text-4xl font-extrabold" data-testid="kickback-total">{data ? tk(data.total) : '—'}</p>
        <p className="mt-2 text-xs opacity-60">Earnings are paid to your bKash after each event ends. See <Link to="/terms/kickback-terms" className="underline">Kickback Terms</Link>.</p>
      </div>
      <div className="mt-6 space-y-3">
        {data?.links.length === 0 && <Empty icon={<Wallet className="h-8 w-8" />} title="No Kickback links yet" body="Look for “Turn invites into income” on event pages." action={<Link to="/explore" className="btn btn-primary btn-md">Find events</Link>} />}
        {data?.links.map((l) => {
          const url = `${location.origin}${location.pathname}#/e/${l.event.slug}?ref=${l.code}`;
          return (
            <div key={l.code} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="truncate font-bold">{l.event.title}</p><p className="text-[13px] text-ink-3">{l.offer.kind === 'percent' ? `${l.offer.value}%` : tk(l.offer.value)} per {l.offer.per} · {l.visits} visits · {l.orders} orders</p></div>
                <p className="font-display text-xl font-extrabold">{tk(l.earned)}</p>
              </div>
              <div className="mt-3 flex gap-2"><input className="input h-10 text-sm" readOnly value={url} aria-label="Kickback link" /><button className="btn btn-outline btn-md" onClick={() => { navigator.clipboard?.writeText(url).catch(() => undefined); toast.success('Copied'); }}><Copy className="h-4 w-4" /></button></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Settings() {
  return <RequireLogin><SettingsInner /></RequireLogin>;
}
function SettingsInner() {
  const user = useSession((s) => s.user)!;
  const nav = useNavigate();
  const [f, setF] = useState({ name: user.name, username: user.username, bio: user.bio ?? '', city: user.city, email: user.email ?? '' });
  const [del, setDel] = useState(false);
  const { data: blocked } = useApi(() => api.blockedUsers(), [user.blocked.join()]);
  const save = async () => {
    try {
      await api.updateProfile({ ...f, email: f.email || undefined });
      toast.success('Profile saved');
    } catch (e) {
      toast.error(e);
    }
  };
  const onAvatar = (file?: File) => {
    if (!file) return;
    if (file.size > 600_000) return toast.error('Choose an image under 600 KB.');
    const r = new FileReader();
    r.onload = () => api.updateProfile({ avatarUrl: String(r.result) }).then(() => toast.success('Photo updated'));
    r.readAsDataURL(file);
  };
  return (
    <div className="container-x max-w-xl pb-16 pt-8">
      <h1 className="headline text-5xl">Settings</h1>
      <section className="card mt-6 space-y-4 p-5">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} hue={user.avatarHue} url={user.avatarUrl} size={64} />
          <label className="btn btn-outline btn-sm cursor-pointer">Change photo<input type="file" accept="image/*" className="hidden" onChange={(e) => onAvatar(e.target.files?.[0])} /></label>
        </div>
        <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Username"><input className="input" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })} /></Field>
        <Field label="Bio"><textarea className="textarea" rows={2} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>
        <Field label="City"><select className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value as City })}>{CITIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Email"><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Mobile number" hint="Your number is your login. Contact support to change it."><input className="input bg-mist" value={user.phone} readOnly /></Field>
        <button className="btn btn-primary btn-md" onClick={save}>Save changes</button>
      </section>
      <section className="card mt-4 divide-y divide-line px-5 py-2">
        <Toggle checked={user.privateProfile} onChange={(v) => api.updateProfile({ privateProfile: v })} label="Private profile" hint="Hide your name from guest lists and your plans from your profile." />
        <Toggle checked={user.smsOptIn} onChange={(v) => api.updateProfile({ smsOptIn: v })} label="SMS from organizers" hint="Get texts from organizers you’ve bought from or follow." />
      </section>
      <section className="card mt-4 p-5">
        <h2 className="font-bold">Blocked users</h2>
        {blocked?.length ? blocked.map((b) => (
          <div key={b.id} className="mt-3 flex items-center justify-between"><span className="text-sm font-semibold">{b.name}</span><button className="btn btn-outline btn-sm" onClick={() => api.blockUser(b.id, false)}>Unblock</button></div>
        )) : <p className="mt-1 text-sm text-ink-3">You haven’t blocked anyone.</p>}
      </section>
      <section className="card mt-4 space-y-3 p-5">
        <h2 className="font-bold">Demo data</h2>
        <p className="text-sm text-ink-3">Everything in this demo is stored in your browser. Reset to start over with the sample events.</p>
        <button className="btn btn-outline btn-md" onClick={async () => { await api.resetDemo(); toast.success('Demo data reset'); nav('/'); }}><Link2 className="h-4 w-4" />Reset demo data</button>
      </section>
      <button className="mt-6 text-sm font-semibold text-bad underline" onClick={() => setDel(true)}>Delete account</button>
      <Modal open={del} onClose={() => setDel(false)} title="Delete your account?" footer={<button className="btn btn-danger btn-lg w-full" onClick={async () => { await api.deleteAccount(); nav('/'); }}>Delete permanently</button>}>
        <p className="text-sm text-ink-2">Your profile will be removed and you’ll be logged out. Tickets you’ve already bought stay valid for the organizer’s records. <Badge tone="bad">This can’t be undone</Badge></p>
      </Modal>
    </div>
  );
}
