import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Compass, Heart, Instagram, LayoutDashboard, LogOut, Menu, Plus, ScanLine, Settings, Ticket, User as UserIcon, Wallet, X } from 'lucide-react';
import { api } from '@/api';
import { useSession } from '@/store/session';
import { useApi } from '@/hooks/useApi';
import { Avatar, Logo } from './ui';
import { RouteErrorBoundary } from './ErrorBoundary';
import { ThemeToggle } from './ThemeToggle';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/explore', label: 'Events' },
  { to: '/platform', label: 'Platform' },
  { to: '/help', label: 'Help' },
];

function UserMenu() {
  const user = useSession((s) => s.user)!;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const { data: notes } = useApi(() => api.notifications(), [user.id]);
  const unread = notes?.filter((n) => !n.read).length ?? 0;
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const item = 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-mist';
  return (
    <div className="relative" ref={ref}>
      <button className="relative flex items-center rounded-full" onClick={() => setOpen(!open)} aria-label="Account menu" data-testid="user-menu">
        <Avatar name={user.name || user.username} hue={user.avatarHue} url={user.avatarUrl} size={36} />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-brand" />}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-64 animate-rise rounded-2xl border border-line bg-surface p-2 shadow-card" onClick={() => setOpen(false)}>
          <div className="px-3 pb-2 pt-1">
            <p className="font-semibold">{user.name || 'New user'}</p>
            <p className="text-[13px] text-ink-3">@{user.username}</p>
          </div>
          <Link className={item} to="/tickets"><Ticket className="h-4 w-4" />My tickets</Link>
          <Link className={item} to="/saved"><Heart className="h-4 w-4" />Saved events</Link>
          <Link className={item} to="/notifications"><Bell className="h-4 w-4" />Notifications{unread > 0 && <span className="ml-auto rounded-full bg-brand px-2 text-xs font-bold text-white">{unread}</span>}</Link>
          <Link className={item} to="/kickbacks"><Wallet className="h-4 w-4" />Kickbacks</Link>
          <Link className={item} to={`/u/${user.username}`}><UserIcon className="h-4 w-4" />Profile</Link>
          <Link className={item} to="/settings"><Settings className="h-4 w-4" />Settings</Link>
          <div className="my-1 border-t border-line" />
          <Link className={item} to="/dashboard"><LayoutDashboard className="h-4 w-4" />Organizer dashboard</Link>
          <Link className={item} to="/scanner"><ScanLine className="h-4 w-4" />Scan tickets</Link>
          <button className={`${item} w-full`} onClick={async () => { await api.logout(); nav('/'); }}>
            <LogOut className="h-4 w-4" />Log out
          </button>
        </div>
      )}
    </div>
  );
}

export function TopNav() {
  const user = useSession((s) => s.user);
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);
  const link = ({ isActive }: { isActive: boolean }) => `rounded-full px-3.5 py-2 text-sm font-semibold transition ${isActive ? 'text-ink' : 'text-ink-3 hover:text-ink'}`;
  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-40 border-b border-line/70 bg-surface">
      <div className="h-1 bg-[linear-gradient(90deg,#FA02A3,#FED7EF_45%,#FA02A3_70%,#E3001B)]" aria-hidden />
      <div className="container-x flex h-16 items-center justify-between gap-3">
        <Link to="/" aria-label="B-POP TAGS home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={link}>
              {n.label}
            </NavLink>
          ))}
          {!user && (
            <NavLink to="/login" className={link}>
              Login
            </NavLink>
          )}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/create" className="btn btn-primary btn-md hidden sm:inline-flex" data-testid="nav-create">
            Create event
          </Link>
          {user ? <UserMenu /> : <Link to="/login" className="btn btn-outline btn-md md:hidden">Login</Link>}
          <button className="btn btn-ghost h-10 w-10 p-0 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="container-x flex flex-col gap-1 pb-4 md:hidden">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `rounded-xl px-3 py-3 text-base font-semibold ${isActive ? 'bg-mist' : ''}`}>
              {n.label}
            </NavLink>
          ))}
          <Link to="/create" className="btn btn-primary btn-lg mt-2">Create event</Link>
        </nav>
      )}
    </header>
  );
}

export function TabBar() {
  const user = useSession((s) => s.user);
  const tab = ({ isActive }: { isActive: boolean }) => `flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold ${isActive ? 'text-ink' : 'text-ink-4'}`;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="App tabs">
      <div className="flex">
        <NavLink to="/explore" className={tab}><Compass className="h-6 w-6" />Explore</NavLink>
        <NavLink to="/tickets" className={tab}><Ticket className="h-6 w-6" />Tickets</NavLink>
        <NavLink to="/create" className={tab}>
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand text-white"><Plus className="h-4 w-4" /></span>Create
        </NavLink>
        <NavLink to="/notifications" className={tab}><Bell className="h-6 w-6" />Activity</NavLink>
        <NavLink to={user ? `/u/${user.username}` : '/login'} className={tab}><UserIcon className="h-6 w-6" />Profile</NavLink>
      </div>
    </nav>
  );
}

export function Footer() {
  const col = 'flex flex-col gap-2.5 text-sm text-ink-3';
  return (
    <footer className="mt-24 border-t border-line bg-surface pb-24 md:pb-10">
      <div className="container-x py-14">
        <div className="mb-12 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="stamp text-brand-dark">You are on our radar</p>
            <h2 className="headline mt-3 text-6xl sm:text-7xl">Dekha <span className="text-brand">hobe.</span></h2>
            <p className="mt-2 text-ink-3">See you out there.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/app" className="btn btn-primary btn-lg">Get the app</Link>
            <Link to="/explore" className="btn btn-outline btn-lg">Explore events</Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className={col}>
            <Logo />
            <p className="mt-2 max-w-[16rem]">Bangla Pop Tags — curating pop-culture &amp; the underground scene across Bangladesh.</p>
          </div>
          <div className={col}>
            <p className="font-semibold text-ink">Company</p>
            <Link to="/platform">For organizers</Link>
            <Link to="/vision">Vision</Link>
            <Link to="/careers">Careers</Link>
            <a href="mailto:press@bpoptags.example">Press</a>
          </div>
          <div className={col}>
            <p className="font-semibold text-ink">Legal</p>
            <Link to="/terms/privacy-policy">Privacy Policy</Link>
            <Link to="/terms/terms-of-service">Terms of Service</Link>
            <Link to="/terms/refund-policy">Refund Policy</Link>
            <Link to="/terms/kickback-terms">Kickback Terms</Link>
          </div>
          <div className={col}>
            <p className="font-semibold text-ink">Social</p>
            <a href="https://www.instagram.com/bpop.tags/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5"><Instagram className="h-4 w-4" />@bpop.tags</a>
            <a href="https://linktr.ee/bpoptags" target="_blank" rel="noreferrer">linktr.ee/bpoptags</a>
            <Link to="/help">Contact</Link>
          </div>
        </div>
        <p className="mt-12 text-xs text-ink-4">© {new Date().getFullYear()} B-POP TAGS (Bangla Pop Tags). Demo build — payments are simulated and data is stored in your browser.</p>
      </div>
    </footer>
  );
}

export function AppLayout() {
  const loc = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  return (
    <div className="min-h-screen bg-surface">
      <TopNav />
      <main className="pb-16 md:pb-0">
        <RouteErrorBoundary>
          <Outlet />
        </RouteErrorBoundary>
      </main>
      <Footer />
      <TabBar />
    </div>
  );
}
