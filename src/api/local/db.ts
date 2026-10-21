// Browser "database" for the local adapter: one JSON document in localStorage,
// change notifications across tabs via BroadcastChannel + the storage event.
import type {
  BpopEvent,
  KickbackLink,
  Message,
  Notification,
  Order,
  Organization,
  Payout,
  Session,
  SmsBlast,
  SmsOutboxItem,
  Ticket,
  User,
  WaitlistEntry,
} from '../types';

export interface DB {
  version: number;
  seededAt: string;
  users: User[];
  orgs: Organization[];
  events: BpopEvent[];
  orders: Order[];
  tickets: Ticket[];
  waitlist: WaitlistEntry[];
  kickbackLinks: KickbackLink[];
  messages: Message[];
  smsBlasts: SmsBlast[];
  payouts: Payout[];
  notifications: Notification[];
  outbox: SmsOutboxItem[];
  otps: Record<string, { code: string; expiresAt: string }>;
}

export const DB_VERSION = 5;
const DB_KEY = 'bpop:db';
const SESSION_KEY = 'bpop:session';

type Listener = (scope: 'db' | 'session') => void;
const listeners = new Set<Listener>();
const channel: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('bpop') : null;

let cache: DB | null = null;
let seedFn: (() => DB) | null = null;

export function registerSeed(fn: () => DB) {
  seedFn = fn;
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // storage full or blocked: keep working in memory for this tab
    console.error('Dekha Hobe: could not persist data', key, value.length, e);
  }
}

export function readDb(): DB {
  if (cache) return cache;
  const raw = safeGet(DB_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DB;
      if (parsed.version === DB_VERSION) {
        cache = parsed;
        return cache;
      }
    } catch {
      /* corrupted → reseed */
    }
  }
  if (!seedFn) throw new Error('seed not registered');
  cache = seedFn();
  safeSet(DB_KEY, JSON.stringify(cache));
  return cache;
}

export function writeDb(db: DB) {
  cache = db;
  safeSet(DB_KEY, JSON.stringify(db));
  emit('db');
  channel?.postMessage('db');
}

export function resetDb() {
  cache = null;
  try {
    localStorage.removeItem(DB_KEY);
  } catch {
    /* ignore */
  }
  readDb();
  emit('db');
  channel?.postMessage('db');
}

export function readSession(): Session {
  const raw = safeGet(SESSION_KEY);
  if (!raw) return { userId: null };
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return { userId: null };
  }
}

export function writeSession(s: Session) {
  safeSet(SESSION_KEY, JSON.stringify(s));
  emit('session');
  channel?.postMessage('session');
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(scope: 'db' | 'session') {
  listeners.forEach((l) => l(scope));
}

function external(scope: 'db' | 'session') {
  if (scope === 'db') cache = null; // re-read the other tab's write
  emit(scope);
}

channel?.addEventListener('message', (e) => external(e.data === 'session' ? 'session' : 'db'));
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === DB_KEY) external('db');
    if (e.key === SESSION_KEY) external('session');
  });
}
