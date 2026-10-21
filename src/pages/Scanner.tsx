import { ThemeToggle } from '@/components/ThemeToggle';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Camera, CameraOff, CheckCircle2, KeyRound, ListChecks, ScanLine, XCircle } from 'lucide-react';
import { api, type BpopEvent, type ScanResult } from '@/api';
import { useApi } from '@/hooks/useApi';
import { useSession } from '@/store/session';
import { Logo, PageSpinner, Tabs } from '@/components/ui';
import { dayLabel, timeLabel } from '@/lib/util';
import { toast } from '@/store/toast';
import { GuestListRows } from './dashboard/EventManage';

function useScannerEvents() {
  const user = useSession((s) => s.user);
  const scannerOrgId = useSession((s) => s.scannerOrgId);
  return useApi(async () => {
    const out: { ev: BpopEvent; orgName: string }[] = [];
    const seen = new Set<string>();
    const orgs = user ? await api.myOrgs() : [];
    const ids = orgs.map((o) => o.org.id);
    if (scannerOrgId && !ids.includes(scannerOrgId)) ids.push(scannerOrgId);
    for (const id of ids) {
      const evs = await api.orgEvents(id).catch(() => []);
      const name = orgs.find((o) => o.org.id === id)?.org.name ?? '';
      for (const { event } of evs) {
        if (event.status !== 'published' || seen.has(event.id)) continue;
        if (new Date(event.endsAt).getTime() < Date.now() - 86400e3) continue;
        seen.add(event.id);
        out.push({ ev: event, orgName: name });
      }
    }
    return out.sort((a, b) => a.ev.startsAt.localeCompare(b.ev.startsAt));
  }, [user?.id, scannerOrgId]);
}

function Camera1({ onScan }: { onScan: (text: string) => void }) {
  const [on, setOn] = useState(false);
  const [err, setErr] = useState('');
  const ref = useRef<{ stop: () => Promise<void> } | null>(null);
  const cb = useRef(onScan);
  cb.current = onScan;
  useEffect(() => {
    if (!on) return;
    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;
        const q = new Html5Qrcode('qr-reader', { verbose: false } as never);
        await q.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, (t) => cb.current(t), () => undefined);
        ref.current = { stop: () => q.stop().then(() => q.clear()) };
      } catch (e) {
        setErr((e as Error)?.message || 'Camera unavailable. Use manual entry below.');
        setOn(false);
      }
    })();
    return () => {
      cancelled = true;
      ref.current?.stop().catch(() => undefined);
      ref.current = null;
    };
  }, [on]);
  return (
    <div className="overflow-hidden rounded-3xl bg-action">
      <div id="qr-reader" className={`${on ? 'min-h-[300px]' : 'hidden'} w-full`} />
      {!on && (
        <button className="flex h-64 w-full flex-col items-center justify-center gap-3 text-white" onClick={() => { setErr(''); setOn(true); }} data-testid="start-camera">
          <Camera className="h-10 w-10" /><span className="font-semibold">Start camera</span>
          {err && <span className="max-w-xs px-4 text-center text-xs text-white/70">{err}</span>}
        </button>
      )}
      {on && <button className="flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold text-white" onClick={() => setOn(false)}><CameraOff className="h-4 w-4" />Stop camera</button>}
    </div>
  );
}

function ResultBanner({ r }: { r: ScanResult }) {
  const map = {
    ok: { bg: 'bg-ok', icon: <CheckCircle2 className="h-10 w-10" />, title: 'Valid — let them in' },
    already: { bg: 'bg-warn', icon: <XCircle className="h-10 w-10" />, title: 'Already scanned' },
    cancelled: { bg: 'bg-bad', icon: <XCircle className="h-10 w-10" />, title: 'Canceled ticket' },
    wrong_event: { bg: 'bg-bad', icon: <XCircle className="h-10 w-10" />, title: 'Ticket is for another event' },
    invalid: { bg: 'bg-bad', icon: <XCircle className="h-10 w-10" />, title: 'Invalid ticket' },
  }[r.status];
  return (
    <div className={`flex animate-rise items-center gap-4 rounded-3xl p-5 text-white ${map.bg}`} data-testid="scan-result" data-status={r.status}>
      {map.icon}
      <div>
        <p className="font-display text-2xl font-extrabold">{map.title}</p>
        {'holder' in r && r.holder && <p className="text-sm opacity-90">{r.holder.name} · {r.ticketType.name}</p>}
        {r.status === 'already' && r.ticket.checkedInAt && <p className="text-sm opacity-90">Checked in at {timeLabel(r.ticket.checkedInAt)}{r.ticket.checkedInBy ? ` by ${r.ticket.checkedInBy}` : ''}</p>}
        {r.status === 'cancelled' && <p className="text-sm opacity-90">This QR was transferred, refunded or canceled.</p>}
      </div>
    </div>
  );
}

function ScanEvent({ ev, onBack }: { ev: BpopEvent; onBack: () => void }) {
  const user = useSession((s) => s.user);
  const [tab, setTab] = useState<'scan' | 'guests'>('scan');
  const [manual, setManual] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const last = useRef<{ t: string; at: number }>({ t: '', at: 0 });
  const { data: stats } = useApi(() => api.eventStats(ev.id), [ev.id]);
  const { data: live } = useApi(() => api.eventById(ev.id), [ev.id]);
  const by = user?.name ?? 'Door PIN';

  const scan = useCallback(async (payload: string) => {
    const now = Date.now();
    if (payload === last.current.t && now - last.current.at < 2500) return;
    last.current = { t: payload, at: now };
    try {
      const r = await api.scanTicket(ev.id, payload, by);
      setResult(r);
      if (navigator.vibrate) navigator.vibrate(r.status === 'ok' ? 80 : [60, 40, 60]);
    } catch (e) {
      toast.error(e);
    }
  }, [ev.id, by]);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <button className="inline-flex items-center gap-1 text-sm font-semibold text-ink-3" onClick={onBack}><ArrowLeft className="h-4 w-4" />Events</button>
      <div><h1 className="line-clamp-2 text-2xl font-black tracking-tight">{ev.title}</h1><p className="text-sm text-ink-3">{dayLabel(ev.startsAt)} · {ev.venue.name}</p></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4"><p className="text-xs text-ink-3">Checked in</p><p className="font-display text-3xl font-extrabold" data-testid="checked-in-count">{stats?.checkedIn ?? '–'}</p></div>
        <div className="card p-4"><p className="text-xs text-ink-3">Tickets</p><p className="font-display text-3xl font-extrabold">{stats?.ticketsSold ?? '–'}</p></div>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'scan', label: 'Scan tickets' }, { id: 'guests', label: `Private guest list${live?.guestList.length ? ` · ${live.guestList.length}` : ''}` }]} />
      {tab === 'scan' ? (
        <>
          <Camera1 onScan={scan} />
          {result && <ResultBanner r={result} />}
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) { last.current = { t: '', at: 0 }; void scan(manual.trim()); setManual(''); } }}>
            <input className="input font-mono uppercase" placeholder="Ticket code (e.g. 7KQ2-M9XD)" value={manual} onChange={(e) => setManual(e.target.value)} data-testid="manual-code" aria-label="Ticket code" />
            <button className="btn btn-primary btn-md h-11" data-testid="manual-check">Check</button>
          </form>
        </>
      ) : live ? (
        <div className="card p-4"><GuestListRows ev={live} /></div>
      ) : null}
    </div>
  );
}

export default function Scanner() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const { user, ready, scannerOrgId } = useSession();
  const { data: events, loading } = useScannerEvents();
  const [pin, setPin] = useState('');
  const eventId = params.get('event');
  const current = events?.find((e) => e.ev.id === eventId)?.ev;

  if (!ready || (loading && !events)) return <PageSpinner />;
  const hasAccess = !!scannerOrgId || (events?.length ?? 0) > 0 || !!user;

  return (
    <div className="min-h-screen bg-mist px-4 py-6">
      <div className="mx-auto mb-6 flex max-w-md items-center justify-between">
        <Link to="/"><Logo /></Link>
        <ThemeToggle />
        <span className="flex items-center gap-1 text-sm font-semibold text-ink-3"><ScanLine className="h-4 w-4" />Door scanner</span>
      </div>
      {current ? (
        <ScanEvent ev={current} onBack={() => setParams({})} />
      ) : (
        <div className="mx-auto max-w-md space-y-5">
          {(!hasAccess || !scannerOrgId) && (
            <form className="card space-y-3 p-5" onSubmit={async (e) => { e.preventDefault(); try { const r = await api.scannerLogin(pin); toast.success(`Scanning for ${r.org.name}`); setPin(''); } catch (err) { toast.error(err); } }}>
              <p className="flex items-center gap-2 font-bold"><KeyRound className="h-5 w-5" />Enter a Scanner PIN</p>
              <p className="text-sm text-ink-3">Organizers create PINs in Settings → Scanner PINs. No account needed.</p>
              <input className="input text-center font-mono text-2xl tracking-[0.4em]" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••••" data-testid="scanner-pin-input" />
              <button className="btn btn-primary btn-lg w-full" disabled={pin.length < 6} data-testid="scanner-pin-submit">Start scanning</button>
              {!user && <p className="text-center text-xs text-ink-3">Team member? <button type="button" className="underline" onClick={() => nav('/login?next=/scanner')}>Log in instead</button></p>}
            </form>
          )}
          {events && events.length > 0 && (
            <div>
              <h2 className="mb-2 font-bold">Choose an event</h2>
              <div className="space-y-2">
                {events.map(({ ev, orgName }) => (
                  <button key={ev.id} className="card flex w-full items-center justify-between p-4 text-left hover:shadow-card" onClick={() => setParams({ event: ev.id })} data-testid="scanner-event">
                    <span className="min-w-0"><span className="block truncate font-semibold">{ev.title}</span><span className="text-[13px] text-ink-3">{orgName && `${orgName} · `}{dayLabel(ev.startsAt)} · {timeLabel(ev.startsAt)}</span></span>
                    <ListChecks className="h-5 w-5 shrink-0 text-ink-4" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {events && events.length === 0 && scannerOrgId && <p className="text-center text-sm text-ink-3">No events to scan right now.</p>}
        </div>
      )}
    </div>
  );
}
