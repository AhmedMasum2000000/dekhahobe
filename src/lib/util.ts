// Small shared helpers: ids, money, dates (Asia/Dhaka), phone numbers.

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function uid(prefix = ''): string {
  const rand = crypto.getRandomValues(new Uint32Array(3));
  return prefix + Array.from(rand, (n) => n.toString(36)).join('').slice(0, 14);
}

export function shortCode(len = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  const raw = Array.from(bytes, (b) => ALPHA[b % ALPHA.length]).join('');
  return len === 8 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
}

export function nonce(): string {
  return crypto.randomUUID();
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

/** Platform service fee added on top of the organizer's base price ("upfront pricing"). */
export function serviceFee(base: number): number {
  if (base <= 0) return 0;
  return Math.round(base * 0.07 + 15);
}

export function displayPrice(base: number): number {
  return base + serviceFee(base);
}

const taka = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
export function tk(n: number): string {
  return `৳${taka.format(Math.round(n))}`;
}

/** Normalise a Bangladeshi mobile number to +8801XXXXXXXXX. Returns null when invalid. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  let local = digits;
  if (local.startsWith('880')) local = local.slice(3);
  if (local.startsWith('0')) local = local.slice(1);
  if (!/^1[3-9]\d{8}$/.test(local)) return null;
  return `+880${local}`;
}

export function prettyPhone(p: string): string {
  const m = p.match(/^\+880(1\d{3})(\d{6})$/);
  return m ? `+880 ${m[1]}-${m[2]}` : p;
}

export function maskPhone(p: string): string {
  return p.replace(/^(\+880\d{2})\d+(\d{3})$/, '$1•••••$2');
}

// ---- dates, always rendered in Bangladesh time ----
const TZ = 'Asia/Dhaka';
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...o });
const fDay = fmt({ weekday: 'short', month: 'short', day: 'numeric' });
const fDayYear = fmt({ weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const fTime = fmt({ hour: 'numeric', minute: '2-digit' });
const fMonthDay = fmt({ month: 'short', day: 'numeric' });
const fWeekday = fmt({ weekday: 'short' });
const fKey = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' });
const fMonthYear = fmt({ month: 'short', year: '2-digit' });

export const dayKey = (d: Date | string) => fKey.format(new Date(d)); // MM/DD/YYYY in Dhaka
const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b);

function compactTime(d: Date): string {
  return fTime.format(d).replace(':00', '').replace(' ', '').toLowerCase();
}

/** "Fri, Oct 23, 5pm - 10pm" — the explore-card format. */
export function cardRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const left = `${fDay.format(s)}, ${compactTime(s)}`;
  if (sameDay(s, e) || e.getTime() - s.getTime() < 12 * 3600e3) return `${left} - ${compactTime(e)}`;
  return `${left} - ${fDay.format(e)}, ${compactTime(e)}`;
}

/** "Fri, Oct 23 at 5:00 PM - 10:00 PM (BST)" — the event-page format. */
export function longRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const end = sameDay(s, e) || e.getTime() - s.getTime() < 12 * 3600e3 ? fTime.format(e) : `${fDay.format(e)} ${fTime.format(e)}`;
  return `${fDay.format(s)} at ${fTime.format(s)} - ${end} (BST)`;
}

export const dayLabel = (iso: string) => fDay.format(new Date(iso));
export const dayYearLabel = (iso: string) => fDayYear.format(new Date(iso));
export const timeLabel = (iso: string) => fTime.format(new Date(iso));
export const monthDay = (iso: string) => fMonthDay.format(new Date(iso));
export const weekday = (iso: string) => fWeekday.format(new Date(iso));
export const monthYear = (iso: string) => fMonthYear.format(new Date(iso));

export function ago(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)}d`;
  return monthDay(iso);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export function hashNum(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function downloadFile(name: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(rows: (string | number | boolean | undefined | null)[][]): string {
  return rows
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export function icsFor(e: { title: string; startsAt: string; endsAt: string; venue: { name: string; address: string }; slug: string }): string {
  const z = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bpop Tags//EN',
    'BEGIN:VEVENT',
    `UID:${e.slug}@bpoptags`,
    `DTSTAMP:${z(new Date().toISOString())}`,
    `DTSTART:${z(e.startsAt)}`,
    `DTEND:${z(e.endsAt)}`,
    `SUMMARY:${e.title}`,
    `LOCATION:${e.venue.name}, ${e.venue.address}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
