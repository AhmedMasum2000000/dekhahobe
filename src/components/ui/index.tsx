import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BadgeCheck, Loader2, Minus, Plus, X } from 'lucide-react';
import { initials } from '@/lib/util';

export function Logo({ className = '', mark = false }: { className?: string; mark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label="Bpop Tags">
      <svg viewBox="0 0 64 64" className="h-7 w-7 shrink-0" aria-hidden>
        <rect width="64" height="64" rx="16" fill="#0A0A0A" />
        <path d="M20 14h14c7 0 11 4 11 9.5 0 3.4-1.8 6-4.6 7.2 3.6 1.1 6 4 6 8 0 6.3-4.6 11.3-12 11.3H20z" fill="#fff" />
        <circle cx="46" cy="18" r="6" fill="#E6007E" />
      </svg>
      {!mark && (
        <span className="font-display text-[19px] font-extrabold tracking-tight">
          bpop<span className="text-brand">.</span>tags
        </span>
      )}
    </span>
  );
}

export function Avatar({ name, hue, url, size = 40, ring = false }: { name: string; hue: number; url?: string; size?: number; ring?: boolean }) {
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.38) };
  const cls = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${ring ? 'ring-2 ring-white' : ''}`;
  if (url) return <img src={url} alt={name} className={`${cls} object-cover`} style={style} />;
  return (
    <span className={cls} style={{ ...style, background: `hsl(${hue} 75% 90%)`, color: `hsl(${hue} 55% 28%)` }} aria-label={name}>
      {initials(name || '?')}
    </span>
  );
}

export function AvatarStack({ people, size = 28, max = 5 }: { people: { id: string; name: string; avatarHue: number; avatarUrl?: string }[]; size?: number; max?: number }) {
  return (
    <span className="flex -space-x-2">
      {people.slice(0, max).map((p) => (
        <Avatar key={p.id} name={p.name} hue={p.avatarHue} url={p.avatarUrl} size={size} ring />
      ))}
    </span>
  );
}

export const Verified = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <BadgeCheck className={`${className} shrink-0 fill-brand text-white`} aria-label="Verified" />
);

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin text-ink-3`} />;
}

export function PageSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line px-6 py-14 text-center">
      {icon && <div className="mb-3 text-ink-4">{icon}</div>}
      <p className="font-display text-lg font-bold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-3">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'neutral', className = '' }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'ok' | 'warn' | 'bad' | 'dark'; className?: string }) {
  const tones = {
    neutral: 'bg-mist text-ink-2',
    brand: 'bg-brand-soft text-brand-dark',
    ok: 'bg-green-50 text-ok',
    warn: 'bg-amber-50 text-warn',
    bad: 'bg-red-50 text-bad',
    dark: 'bg-ink text-white',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]} ${className}`}>{children}</span>;
}

export function Modal({ open, onClose, title, children, wide = false, footer }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative flex max-h-[92vh] w-full animate-rise flex-col rounded-t-4xl bg-white shadow-2xl sm:rounded-4xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <h3 className="text-lg font-bold">{title}</h3>
          <button className="btn btn-ghost h-9 w-9 p-0" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Stepper({ value, min = 0, max, onChange, disabled }: { value: number; min?: number; max?: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <div className="inline-flex items-center gap-1">
      <button type="button" className="btn btn-outline h-9 w-9 p-0" aria-label="Decrease" disabled={disabled || value <= min} onClick={() => onChange(value - 1)}>
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-7 text-center text-[15px] font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" className="btn btn-outline h-9 w-9 p-0" aria-label="Increase" disabled={disabled || (max !== undefined && value >= max)} onClick={() => onChange(value + 1)}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  return (
    <label className={`flex cursor-pointer items-start justify-between gap-4 py-2.5 ${disabled ? 'opacity-50' : ''}`}>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] text-ink-3">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-ink' : 'bg-zinc-200'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, className = '' }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={`no-scrollbar flex gap-1 overflow-x-auto border-b border-line ${className}`} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`relative shrink-0 px-3 py-3 text-sm font-semibold transition ${value === t.id ? 'text-ink' : 'text-ink-3 hover:text-ink'}`}
        >
          {t.label}
          {value === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ink" />}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, hint, error }: { label: ReactNode; children: ReactNode; hint?: ReactNode; error?: string | null }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error ? <p className="mt-1 text-[13px] text-bad">{error}</p> : hint ? <p className="mt-1 text-[13px] text-ink-3">{hint}</p> : null}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="card p-4 sm:p-5">
      <p className="text-[13px] font-medium text-ink-3">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold tabular-nums sm:text-[28px]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-3">{sub}</p>}
    </div>
  );
}

/** Collapsed text with "View more" like the event About section. */
export function ViewMore({ children, lines = 6 }: { children: ReactNode; lines?: number }) {
  const [open, setOpen] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) setOverflow(el.scrollHeight > el.clientHeight + 4);
  }, [children]);
  return (
    <div>
      <div ref={ref} className="overflow-hidden" style={open ? undefined : { maxHeight: `${lines * 1.7}rem` }}>
        {children}
      </div>
      {(overflow || open) && (
        <button className="mt-2 text-sm font-semibold underline underline-offset-4" onClick={() => setOpen(!open)}>
          {open ? 'View less' : 'View more'}
        </button>
      )}
    </div>
  );
}

/** Tiny markdown: **bold**, paragraphs, line breaks. */
export function RichText({ text }: { text: string }) {
  return (
    <div className="prose-bp">
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i}>
          {p.split('\n').map((line, j, arr) => (
            <span key={j}>
              {line.split(/(\*\*[^*]+\*\*)/g).map((seg, k) => (seg.startsWith('**') ? <strong key={k}>{seg.slice(2, -2)}</strong> : <span key={k}>{seg}</span>))}
              {j < arr.length - 1 && <br />}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

export function Countdown({ until, onDone }: { until: string; onDone?: () => void }) {
  const [left, setLeft] = useState(() => new Date(until).getTime() - Date.now());
  useEffect(() => {
    const t = setInterval(() => {
      const l = new Date(until).getTime() - Date.now();
      setLeft(l);
      if (l <= 0) {
        clearInterval(t);
        onDone?.();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [until, onDone]);
  const s = Math.max(0, Math.floor(left / 1000));
  return (
    <span className="tabular-nums">
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
    </span>
  );
}
