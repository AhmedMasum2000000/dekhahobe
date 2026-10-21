import { useEffect } from 'react';
import { CheckCircle2, Info, MessageSquareText, XCircle } from 'lucide-react';
import { useToast } from '@/store/toast';
import { useSession } from '@/store/session';
import { prettyPhone } from '@/lib/util';

/** Renders toasts plus the simulated phone SMS inbox (OTP codes, ticket texts). */
export function Toaster() {
  const { toasts, dismiss, push } = useToast();
  useEffect(() => {
    const onSms = (e: Event) => {
      const d = (e as CustomEvent<{ to: string; body: string; otp: boolean }>).detail;
      const me = useSession.getState().user;
      if (d.otp || (me && me.phone === d.to)) push({ kind: 'sms', title: d.body, from: prettyPhone(d.to) }, d.otp ? 15000 : 6000);
    };
    window.addEventListener('bpop:sms', onSms);
    return () => window.removeEventListener('bpop:sms', onSms);
  }, [push]);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[80] flex flex-col items-center gap-2 px-3">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto flex w-full max-w-md animate-rise items-start gap-3 rounded-2xl px-4 py-3 text-left shadow-card ${t.kind === 'sms' ? 'border border-line bg-surface' : t.kind === 'error' ? 'bg-bad text-white' : 'bg-action text-white'}`}
          data-testid={t.kind === 'sms' ? 'sms-toast' : 'toast'}
        >
          {t.kind === 'sms' ? <MessageSquareText className="mt-0.5 h-5 w-5 shrink-0 text-ok" /> : t.kind === 'error' ? <XCircle className="mt-0.5 h-5 w-5 shrink-0" /> : t.kind === 'success' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <Info className="mt-0.5 h-5 w-5 shrink-0" />}
          <span className="min-w-0">
            {t.kind === 'sms' && <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-3">Messages · now · to {t.from}</span>}
            <span className="block text-sm font-semibold">{t.title}</span>
            {t.body && <span className="block text-[13px] opacity-80">{t.body}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
