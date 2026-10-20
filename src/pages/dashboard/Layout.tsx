import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BarChart3, CalendarDays, ChevronDown, Home, LayoutDashboard, MessageSquare, Plus, ScanLine, Settings, Wallet } from 'lucide-react';
import { api, CITIES, type City, type Organization, type TeamRole } from '@/api';
import { useApi } from '@/hooks/useApi';
import { useActiveOrg } from '@/store/org';
import { toast } from '@/store/toast';
import { Avatar, Field, Logo, PageSpinner, Verified } from '@/components/ui';
import { RequireLogin } from '../Login';
import { useSession } from '@/store/session';

export interface DashCtx {
  org: Organization;
  role: TeamRole;
}

export function useDash() {
  const { orgId } = useActiveOrg();
  const user = useSession((s) => s.user);
  const { data, loading } = useApi(() => api.myOrgs(), [user?.id]);
  const current = data?.find((o) => o.org.id === orgId) ?? data?.[0];
  return { orgs: data, current, loading };
}

export function CreateOrgForm({ onDone }: { onDone: (o: Organization) => void }) {
  const [f, setF] = useState({ name: '', bio: '', city: 'Dhaka' as City, instagram: '' });
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const o = await api.createOrg(f);
          toast.success(`${o.name} is ready`);
          onDone(o);
        } catch (err) {
          toast.error(err);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Organization name" hint="This is who your events are hosted by."><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Dhanmondi Disco Club" data-testid="org-name-input" autoFocus /></Field>
      <Field label="Short bio"><textarea className="textarea" rows={2} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="What kind of experiences do you host?" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City"><select className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value as City })}>{CITIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Instagram"><input className="input" value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} placeholder="@handle" /></Field>
      </div>
      <button className="btn btn-primary btn-lg w-full" disabled={busy || !f.name.trim()} data-testid="create-org">Create organization</button>
    </form>
  );
}

function Onboarding() {
  const setOrg = useActiveOrg((s) => s.set);
  return (
    <div className="flex min-h-screen items-center justify-center bg-mist px-4">
      <div className="card w-full max-w-md p-6">
        <Logo />
        <h1 className="mt-6 text-3xl font-black tracking-tight">Start hosting on Bpop</h1>
        <p className="mb-6 mt-2 text-ink-3">Create your organization to publish events, sell tickets and get paid.</p>
        <CreateOrgForm onDone={(o) => setOrg(o.id)} />
        <Link to="/" className="mt-4 block text-center text-sm font-semibold text-ink-3 underline">Back to Bpop</Link>
      </div>
    </div>
  );
}

export default function DashboardLayout() {
  return <RequireLogin><Inner /></RequireLogin>;
}

function Inner() {
  const { orgs, current, loading } = useDash();
  const setOrg = useActiveOrg((s) => s.set);
  const [switcher, setSwitcher] = useState(false);
  const nav = useNavigate();
  useEffect(() => {
    if (current) setOrg(current.org.id);
  }, [current, setOrg]);
  if (loading && !orgs) return <PageSpinner />;
  if (!current) return <Onboarding />;
  const { org, role } = current;
  const manager = role === 'owner' || role === 'admin';
  const links = [
    { to: '/dashboard', label: 'Overview', icon: <LayoutDashboard className="h-[18px] w-[18px]" />, end: true, show: role !== 'doorperson' },
    { to: '/dashboard/events', label: 'Events', icon: <CalendarDays className="h-[18px] w-[18px]" />, show: true },
    { to: '/dashboard/insights', label: 'Insights', icon: <BarChart3 className="h-[18px] w-[18px]" />, show: role !== 'doorperson' },
    { to: '/dashboard/sms', label: 'SMS campaigns', icon: <MessageSquare className="h-[18px] w-[18px]" />, show: manager },
    { to: '/dashboard/finance', label: 'Finance', icon: <Wallet className="h-[18px] w-[18px]" />, show: manager },
    { to: '/dashboard/settings', label: 'Settings', icon: <Settings className="h-[18px] w-[18px]" />, show: manager },
    { to: '/scanner', label: 'Scan tickets', icon: <ScanLine className="h-[18px] w-[18px]" />, show: true },
  ].filter((l) => l.show);
  const linkCls = ({ isActive }: { isActive: boolean }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-ink text-white' : 'text-ink-2 hover:bg-mist'}`;

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white p-4 lg:flex">
        <Link to="/" className="mb-6 px-2"><Logo /></Link>
        <div className="relative mb-4">
          <button className="flex w-full items-center gap-3 rounded-2xl border border-line p-2.5 text-left hover:bg-mist" onClick={() => setSwitcher(!switcher)} data-testid="org-switcher">
            <Avatar name={org.name} hue={org.avatarHue} url={org.avatarUrl} size={34} />
            <span className="min-w-0 flex-1"><span className="flex items-center gap-1 truncate text-sm font-bold">{org.name}{org.verified && <Verified className="h-3.5 w-3.5" />}</span><span className="text-xs capitalize text-ink-3">{role}</span></span>
            <ChevronDown className="h-4 w-4 text-ink-3" />
          </button>
          {switcher && (
            <div className="absolute inset-x-0 top-full z-40 mt-1 rounded-2xl border border-line bg-white p-1.5 shadow-card">
              {orgs!.map((o) => (
                <button key={o.org.id} className="flex w-full items-center gap-2 rounded-xl p-2 text-left text-sm hover:bg-mist" onClick={() => { setOrg(o.org.id); setSwitcher(false); nav('/dashboard'); }}>
                  <Avatar name={o.org.name} hue={o.org.avatarHue} size={24} />{o.org.name}
                </button>
              ))}
              <Link to="/dashboard/new-org" className="flex items-center gap-2 rounded-xl p-2 text-sm font-semibold hover:bg-mist" onClick={() => setSwitcher(false)}><Plus className="h-4 w-4" />New organization</Link>
            </div>
          )}
        </div>
        {manager && <Link to="/create" className="btn btn-primary btn-md mb-4" data-testid="dash-create"><Plus className="h-4 w-4" />Create event</Link>}
        <nav className="flex flex-col gap-1">{links.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={linkCls}>{l.icon}{l.label}</NavLink>)}</nav>
        <div className="mt-auto">
          <Link to={`/g/${org.slug}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-3 hover:bg-mist"><Home className="h-[18px] w-[18px]" />Public profile</Link>
          <Link to="/explore" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-3 hover:bg-mist">← Attendee view</Link>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-line bg-white lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/"><Logo mark /></Link>
          <select className="h-9 max-w-[55%] truncate rounded-full border border-line bg-white px-3 text-sm font-semibold" value={org.id} onChange={(e) => { setOrg(e.target.value); nav('/dashboard'); }} aria-label="Organization">
            {orgs!.map((o) => <option key={o.org.id} value={o.org.id}>{o.org.name}</option>)}
          </select>
          {manager ? <Link to="/create" className="btn btn-primary btn-sm"><Plus className="h-4 w-4" />Event</Link> : <span />}
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2">{links.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${isActive ? 'bg-ink text-white' : 'bg-mist text-ink-2'}`}>{l.label}</NavLink>)}</nav>
      </header>

      <main className="px-4 py-6 sm:px-6 lg:ml-64 lg:px-10 lg:py-10">
        <Outlet context={{ org, role } satisfies DashCtx} />
      </main>
    </div>
  );
}

export function NewOrg() {
  const setOrg = useActiveOrg((s) => s.set);
  const nav = useNavigate();
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-3xl font-black tracking-tight">New organization</h1>
      <div className="card p-6"><CreateOrgForm onDone={(o) => { setOrg(o.id); nav('/dashboard'); }} /></div>
    </div>
  );
}
