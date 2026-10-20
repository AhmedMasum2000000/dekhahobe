import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api, CITIES, type City } from '@/api';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { Field, Logo, PageSpinner, Spinner } from '@/components/ui';
import { maskPhone, normalizePhone } from '@/lib/util';
import { DEMO_ATTENDEE_PHONE, DEMO_ORGANIZER_PHONE } from '@/api/local/seed';

export function RequireLogin({ children }: { children: ReactNode }) {
  const { user, ready } = useSession();
  const loc = useLocation();
  if (!ready) return <PageSpinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <>{children}</>;
}

function OtpBoxes({ value, onChange, onComplete }: { value: string; onChange: (v: string) => void; onComplete: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => {
    refs.current[0]?.focus();
  }, []);
  return (
    <div className="flex justify-between gap-2" onPaste={(e) => { const d = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6); if (d) { e.preventDefault(); onChange(d); if (d.length === 6) onComplete(d); } }}>
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className="h-14 w-12 rounded-xl border border-line text-center text-2xl font-bold focus:border-ink focus:outline-none"
          inputMode="numeric"
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          data-testid={`otp-${i}`}
          value={value[i] ?? ''}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, '').slice(-1);
            const next = (value.slice(0, i) + d + value.slice(i + 1)).slice(0, 6);
            onChange(next);
            if (d && i < 5) refs.current[i + 1]?.focus();
            if (next.length === 6 && !next.includes(' ')) onComplete(next);
          }}
          onKeyDown={(e) => { if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus(); }}
        />
      ))}
    </div>
  );
}

export default function Login() {
  const [params] = useSearchParams();
  const next = params.get('next') || '/explore';
  const nav = useNavigate();
  const { user, ready } = useSession();
  const [step, setStep] = useState<'phone' | 'otp' | 'profile'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [profile, setProfile] = useState({ name: '', username: '', city: 'Dhaka' as City });

  useEffect(() => {
    if (ready && user && step === 'phone') nav(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const send = async (p = phone) => {
    setErr('');
    if (!normalizePhone(p)) return setErr('Enter a valid Bangladeshi mobile number, like 01711-000000.');
    setBusy(true);
    try {
      await api.sendOtp(p);
      setStep('otp');
      setCode('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (c = code) => {
    setErr('');
    setBusy(true);
    try {
      const { user: u, isNew } = await api.verifyOtp(phone, c);
      if (isNew) {
        setProfile({ name: u.name === 'Guest' ? '' : u.name, username: u.username.startsWith('guest') ? '' : u.username, city: u.city });
        setStep('profile');
      } else {
        toast.success(`Welcome back, ${u.name.split(' ')[0]}`);
        nav(next, { replace: true });
      }
    } catch (e) {
      setErr((e as Error).message);
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const social = async (p: 'google' | 'facebook') => {
    setBusy(true);
    try {
      const { isNew, user: u } = await api.socialLogin(p);
      if (isNew) {
        setProfile({ name: '', username: '', city: u.city });
        setStep('profile');
      } else nav(next, { replace: true });
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async () => {
    setErr('');
    setBusy(true);
    try {
      await api.updateProfile({ name: profile.name, username: profile.username || profile.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14) + Math.floor(Math.random() * 90 + 10), city: profile.city });
      toast.success('You’re all set 🎉');
      nav(next, { replace: true });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-start justify-center px-4 py-10 sm:items-center">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center"><Logo mark className="justify-center" /></div>
        {step === 'phone' && (
          <div className="space-y-5">
            <div className="text-center">
              <h1 className="text-3xl font-black tracking-tight">Log in or sign up</h1>
              <p className="mt-2 text-ink-3">We’ll text you a code to verify your number.</p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="space-y-3">
              <div className="flex">
                <span className="flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-l-xl border border-r-0 border-line bg-mist px-3 text-[15px] font-semibold"><span aria-hidden>🇧🇩</span>+880</span>
                <input className="input rounded-l-none" inputMode="tel" autoComplete="tel" placeholder="1711-000000" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="phone-input" aria-label="Mobile number" />
              </div>
              {err && <p className="text-sm text-bad" role="alert">{err}</p>}
              <button className="btn btn-primary btn-lg w-full" disabled={busy || !phone} data-testid="send-code">{busy ? <Spinner className="h-5 w-5 text-white" /> : 'Continue'}</button>
            </form>
            <div className="flex items-center gap-3 text-xs text-ink-4"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
            <div className="grid gap-2">
              <button className="btn btn-outline btn-lg" onClick={() => social('google')} disabled={busy}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" /></svg>
                Continue with Google
              </button>
              <button className="btn btn-outline btn-lg" onClick={() => social('facebook')} disabled={busy}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.6-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z" /></svg>
                Continue with Facebook
              </button>
            </div>
            <div className="rounded-2xl bg-mist p-4 text-[13px] text-ink-2">
              <p className="font-semibold text-ink">Demo accounts</p>
              <p className="mt-1">The verification code arrives as an on-screen SMS.</p>
              <div className="mt-2 grid gap-1.5">
                <button className="text-left underline" onClick={() => { setPhone(DEMO_ATTENDEE_PHONE.replace('+880', '')); void send(DEMO_ATTENDEE_PHONE); }}>Attendee — Nusrat ({DEMO_ATTENDEE_PHONE.replace('+880', '0')})</button>
                <button className="text-left underline" onClick={() => { setPhone(DEMO_ORGANIZER_PHONE.replace('+880', '')); void send(DEMO_ORGANIZER_PHONE); }}>Organizer — Rafi ({DEMO_ORGANIZER_PHONE.replace('+880', '0')})</button>
              </div>
            </div>
            <p className="text-center text-xs text-ink-4">By continuing you agree to our <Link to="/terms/terms-of-service" className="underline">Terms</Link> and <Link to="/terms/privacy-policy" className="underline">Privacy Policy</Link>.</p>
          </div>
        )}
        {step === 'otp' && (
          <div className="space-y-5">
            <button className="inline-flex items-center gap-1 text-sm font-semibold text-ink-3" onClick={() => setStep('phone')}><ArrowLeft className="h-4 w-4" />Change number</button>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Enter the code</h1>
              <p className="mt-2 text-ink-3">Sent to {maskPhone(normalizePhone(phone) ?? phone)}</p>
            </div>
            <OtpBoxes value={code} onChange={setCode} onComplete={(c) => void verify(c)} />
            {err && <p className="text-sm text-bad" role="alert">{err}</p>}
            <button className="btn btn-primary btn-lg w-full" disabled={busy || code.length < 6} onClick={() => verify()} data-testid="verify-code">{busy ? <Spinner className="h-5 w-5 text-white" /> : 'Verify'}</button>
            <button className="w-full text-sm font-semibold underline" onClick={() => send()} disabled={busy}>Resend code</button>
          </div>
        )}
        {step === 'profile' && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void saveProfile(); }}>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Welcome to B-POP</h1>
              <p className="mt-2 text-ink-3">Tell us a bit about you.</p>
            </div>
            <Field label="Full name"><input className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} autoFocus data-testid="profile-name" /></Field>
            <Field label="Username" hint="3–20 characters. You can change it later."><input className="input" value={profile.username} onChange={(e) => setProfile({ ...profile, username: e.target.value.toLowerCase() })} placeholder="e.g. nusrat.j" data-testid="profile-username" /></Field>
            <Field label="City">
              <select className="input" value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value as City })}>{CITIES.map((c) => <option key={c}>{c}</option>)}</select>
            </Field>
            {err && <p className="text-sm text-bad" role="alert">{err}</p>}
            <button className="btn btn-primary btn-lg w-full" disabled={busy || !profile.name.trim()} data-testid="profile-save">{busy ? <Spinner className="h-5 w-5 text-white" /> : 'Continue'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
