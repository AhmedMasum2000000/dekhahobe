// Domain model for Bpop Tags. Shared by the local (browser) adapter and the
// future Supabase adapter — see docs/REA-teardown.md §3.

export type ID = string;
export type ISO = string;

export type Category =
  | 'Nightlife'
  | 'Concerts'
  | 'Festivals'
  | 'Arts & Fashion'
  | 'Food & Drink'
  | 'Activities'
  | 'Fitness'
  | 'Networking'
  | 'Comedy';

export const CATEGORIES: Category[] = [
  'Nightlife',
  'Concerts',
  'Festivals',
  'Arts & Fashion',
  'Food & Drink',
  'Activities',
  'Fitness',
  'Networking',
  'Comedy',
];

export const CITIES = ['Dhaka', 'Chattogram', 'Sylhet', "Cox's Bazar", 'Rajshahi', 'Khulna'] as const;
export type City = (typeof CITIES)[number];

export type TeamRole = 'owner' | 'admin' | 'host' | 'doorperson';
export type PaymentMethod = 'bkash' | 'nagad' | 'card' | 'cash' | 'free' | 'comp';

export interface User {
  id: ID;
  name: string;
  username: string;
  phone: string; // +8801XXXXXXXXX
  email?: string;
  bio?: string;
  avatarHue: number;
  avatarUrl?: string;
  city: City;
  following: ID[]; // organization ids
  friends: ID[]; // user ids the user follows
  saved: ID[]; // event ids
  blocked: ID[];
  smsOptIn: boolean;
  privateProfile: boolean;
  createdAt: ISO;
}

export interface ScannerPin {
  pin: string;
  secret: string;
  label: string;
  createdAt: ISO;
}

export interface TeamMember {
  userId: ID;
  role: TeamRole;
  addedAt: ISO;
}

export interface PayoutMethod {
  id: ID;
  kind: 'bkash' | 'nagad' | 'bank';
  label: string; // e.g. "bKash •••• 4821"
  primary: boolean;
}

export interface Organization {
  id: ID;
  slug: string;
  name: string;
  bio: string;
  avatarHue: number;
  avatarUrl?: string;
  bannerSeed: number;
  verified: boolean;
  city: City;
  instagram?: string;
  website?: string;
  contactEmail?: string;
  team: TeamMember[];
  scannerPins: ScannerPin[];
  payoutMethods: PayoutMethod[];
  createdAt: ISO;
}

export interface Venue {
  name: string;
  address: string;
  city: City;
  lat: number;
  lng: number;
  revealLater?: boolean; // "Location revealed week of"
}

export interface LineupItem {
  id: ID;
  name: string;
  role?: string;
  hue: number;
}

export interface Poster {
  seed: number;
  style: 'gradient' | 'grid' | 'sun' | 'wave' | 'type';
  hues: [number, number];
  imageUrl?: string; // data URL when the organizer uploads an image
}

export interface TicketType {
  id: ID;
  name: string;
  description?: string;
  price: number; // base price the organizer earns (BDT)
  quantity: number | null; // null = unlimited
  sold: number; // includes held (pending) seats
  minPerOrder: number;
  maxPerOrder: number | null;
  salesStart?: ISO;
  salesEnd?: ISO;
  groupId?: ID;
  hidden: boolean;
  password?: string;
  inPersonOnly: boolean;
  allowTransfers: boolean;
  markedSoldOut: boolean;
  requireApproval: boolean;
  waitlistEnabled: boolean;
  waitlistResponseMins: number;
  waitlistMaxPerUser: number | null;
  heldForWaitlist: number; // seats reserved for the waitlist queue (pool + live offers)
  order: number;
}

export interface TicketGroup {
  id: ID;
  name: string;
  order: number;
  hidden: boolean;
}

export interface PromoCode {
  id: ID;
  code: string;
  kind: 'percent' | 'flat';
  value: number;
  limit: number | null; // per order uses
  uses: number;
  ticketTypeIds: ID[] | null; // null = unrestricted
  active: boolean;
  createdAt: ISO;
}

export interface KickbackOffer {
  id: ID;
  kind: 'percent' | 'flat';
  value: number;
  per: 'order' | 'ticket';
  ticketTypeIds: ID[] | null;
  isPublic: boolean;
  showBanner: boolean;
  enabled: boolean;
  affiliateIds: ID[]; // private offers: invited users
  createdAt: ISO;
}

export interface KickbackLink {
  code: string;
  eventId: ID;
  offerId: ID;
  userId: ID;
  visits: number;
  createdAt: ISO;
}

export interface TrackingLink {
  id: ID;
  slug: string;
  kind: 'tracking' | 'host';
  hostUserId?: ID;
  visits: number;
  createdAt: ISO;
}

export interface GuestListEntry {
  id: ID;
  name: string;
  plus: number;
  checkedIn: boolean;
  checkedInAt?: ISO;
  note?: string;
}

export type EventStatus = 'draft' | 'published' | 'cancelled';

export interface BpopEvent {
  id: ID;
  slug: string;
  orgId: ID;
  title: string;
  tagline?: string;
  description: string;
  category: Category;
  venue: Venue;
  startsAt: ISO;
  endsAt: ISO;
  poster: Poster;
  lineup: LineupItem[];
  status: EventStatus;
  visibility: 'public' | 'unlisted';
  rsvpOnly: boolean;
  ageLimit?: string;
  seriesId?: ID;
  featured: boolean;
  sponsored?: boolean;
  pageViews: number;
  ticketTypes: TicketType[];
  ticketGroups: TicketGroup[];
  promoCodes: PromoCode[];
  kickbackOffers: KickbackOffer[];
  trackingLinks: TrackingLink[];
  guestList: GuestListEntry[];
  showGuestlist: boolean;
  chatEnabled: boolean;
  createdAt: ISO;
}

export type OrderStatus = 'pending_payment' | 'pending_approval' | 'paid' | 'refunded' | 'cancelled' | 'expired' | 'declined';

export interface OrderItem {
  ticketTypeId: ID;
  name: string;
  qty: number;
  unitPrice: number;
  unitFee: number;
}

export interface Order {
  id: ID;
  number: string; // human readable e.g. BP-48213
  eventId: ID;
  userId: ID;
  buyer: { name: string; phone: string; email?: string };
  items: OrderItem[];
  subtotal: number;
  fees: number;
  discount: number;
  total: number;
  promoCode?: string;
  kickbackCode?: string;
  kickbackCommission: number;
  trackingSlug?: string;
  hostUserId?: ID;
  status: OrderStatus;
  paymentMethod?: PaymentMethod;
  paymentRef?: string;
  source: 'online' | 'door' | 'comp' | 'waitlist' | 'transfer';
  holdExpiresAt?: ISO;
  refundRequested?: boolean;
  createdAt: ISO;
  paidAt?: ISO;
}

export type TicketStatus = 'valid' | 'checked_in' | 'cancelled' | 'refunded';

export interface TicketTransfer {
  toPhone: string;
  toUserId?: ID;
  createdAt: ISO;
}

export interface Ticket {
  id: ID;
  code: string; // short human code e.g. 7KQ2-M9XD
  orderId: ID;
  eventId: ID;
  ticketTypeId: ID;
  ownerId: ID;
  qrNonce: string;
  status: TicketStatus;
  isComp: boolean;
  checkedInAt?: ISO;
  checkedInBy?: string;
  transfer?: TicketTransfer; // pending transfer
  returnedToWaitlist?: boolean;
  revokedNonces: string[]; // QR codes that were valid before a transfer
  createdAt: ISO;
}

export type WaitlistStatus = 'waiting' | 'offered' | 'claimed' | 'expired' | 'left';

export interface WaitlistEntry {
  id: ID;
  eventId: ID;
  ticketTypeId: ID;
  userId: ID;
  qty: number;
  status: WaitlistStatus;
  offerExpiresAt?: ISO;
  orderId?: ID;
  createdAt: ISO;
}

export interface Message {
  id: ID;
  eventId: ID;
  userId: ID;
  body: string;
  createdAt: ISO;
}

export interface SmsBlast {
  id: ID;
  orgId: ID;
  eventId?: ID;
  audience: 'all_attendees' | 'event_attendees' | 'followers';
  body: string;
  recipients: number;
  createdAt: ISO;
}

export interface Payout {
  id: ID;
  orgId: ID;
  amount: number;
  fee: number;
  instant: boolean;
  methodLabel: string;
  status: 'processing' | 'paid';
  createdAt: ISO;
}

export interface Notification {
  id: ID;
  userId: ID;
  kind: 'transfer' | 'waitlist' | 'order' | 'sms' | 'follow' | 'system' | 'kickback';
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: ISO;
}

export interface SmsOutboxItem {
  id: ID;
  to: string;
  body: string;
  createdAt: ISO;
}

// ---------- read models ----------

export interface EventCard {
  event: BpopEvent;
  org: Organization;
  fromPrice: number | null; // display price incl. fees; 0 = free; null = no public tickets
  goingCount: number;
  goingPreview: Pick<User, 'id' | 'name' | 'avatarHue' | 'avatarUrl'>[];
  moreDates: boolean;
}

export interface TicketView {
  ticket: Ticket;
  event: BpopEvent;
  org: Organization;
  ticketType: TicketType;
  order: Order;
}

export interface ExploreFilters {
  q?: string;
  city?: City | 'All';
  category?: Category | 'All';
  date?: 'any' | 'today' | 'tomorrow' | 'weekend' | 'week' | 'month';
  price?: 'any' | 'free' | 'under500' | 'under1500' | 'over1500';
}

export interface CartLine {
  ticketTypeId: ID;
  qty: number;
}

export interface CheckoutQuote {
  items: OrderItem[];
  subtotal: number;
  fees: number;
  discount: number;
  total: number;
  promo?: PromoCode;
  error?: string;
}

export interface OrgStats {
  revenue: number;
  ticketsSold: number;
  orders: number;
  pageViews: number;
  conversion: number;
  attendees: number;
  followers: number;
  balance: number;
  pendingBalance: number;
  series: { date: string; revenue: number; tickets: number }[];
  topEvents: { event: BpopEvent; revenue: number; tickets: number }[];
}

export interface EventStats {
  revenue: number;
  gross: number;
  fees: number;
  ticketsSold: number;
  capacity: number | null;
  checkedIn: number;
  pageViews: number;
  conversion: number;
  orders: number;
  pendingApprovals: number;
  waitlist: number;
  byType: { ticketType: TicketType; sold: number; revenue: number }[];
  series: { date: string; revenue: number; tickets: number }[];
}

export type ScanResult =
  | { status: 'ok'; ticket: Ticket; holder: User; ticketType: TicketType }
  | { status: 'already'; ticket: Ticket; holder: User; ticketType: TicketType }
  | { status: 'cancelled'; ticket: Ticket }
  | { status: 'wrong_event' }
  | { status: 'invalid' };

export interface Session {
  userId: ID | null;
  scannerOrgId?: ID | null;
}

// ---------- the contract every backend must satisfy ----------

export interface ApiClient {
  // auth
  sendOtp(phone: string): Promise<{ sent: true }>;
  verifyOtp(phone: string, code: string): Promise<{ user: User; isNew: boolean }>;
  socialLogin(provider: 'google' | 'facebook'): Promise<{ user: User; isNew: boolean }>;
  currentUser(): Promise<User | null>;
  updateProfile(patch: Partial<Pick<User, 'name' | 'username' | 'bio' | 'city' | 'email' | 'avatarUrl' | 'smsOptIn' | 'privateProfile'>>): Promise<User>;
  logout(): Promise<void>;
  deleteAccount(): Promise<void>;

  // discovery
  explore(filters: ExploreFilters): Promise<{ featured: EventCard[]; trending: EventCard[] }>;
  homeFeed(): Promise<{ featured: EventCard | null; posters: BpopEvent[]; spotlight: { org: Organization; event: BpopEvent } | null; orgs: Organization[] }>;
  getEventBySlug(slug: string): Promise<{ card: EventCard; series: BpopEvent[]; friendsGoing: User[]; guests: User[] } | null>;
  getSeries(seriesId: ID): Promise<EventCard[]>;
  getOrg(slug: string): Promise<{ org: Organization; upcoming: EventCard[]; past: EventCard[]; stats: { events: number; attendees: number; followers: number } } | null>;
  getUserProfile(username: string): Promise<{ user: User; going: EventCard[] } | null>;
  trackVisit(eventId: ID, ref?: { kickback?: string; tracking?: string }): Promise<void>;
  platformStats(): Promise<{ tickets: number; revenue: number; organizers: number; events: number; orgs: { org: Organization; events: number; attendees: number; cover?: BpopEvent }[] }>;

  // social
  toggleFollowOrg(orgId: ID): Promise<boolean>;
  toggleFollowUser(userId: ID): Promise<boolean>;
  toggleSave(eventId: ID): Promise<boolean>;
  blockUser(userId: ID, block: boolean): Promise<void>;
  blockedUsers(): Promise<User[]>;
  savedEvents(): Promise<EventCard[]>;
  listMessages(eventId: ID): Promise<(Message & { user: User })[]>;
  sendMessage(eventId: ID, body: string): Promise<Message>;
  canChat(eventId: ID): Promise<boolean>;

  // checkout
  unlockTickets(eventId: ID, password: string): Promise<ID[]>;
  quote(eventId: ID, cart: CartLine[], promo?: string, password?: string, waitlistEntryId?: ID): Promise<CheckoutQuote>;
  startCheckout(input: { eventId: ID; cart: CartLine[]; promo?: string; password?: string; kickback?: string; tracking?: string; buyer: Order['buyer']; waitlistEntryId?: ID }): Promise<Order>;
  payOrder(orderId: ID, method: PaymentMethod, ref: string): Promise<Order>;
  cancelPendingOrder(orderId: ID): Promise<void>;
  getOrder(orderId: ID): Promise<{ order: Order; event: BpopEvent; org: Organization; tickets: Ticket[] } | null>;

  // attendee tickets
  myTickets(): Promise<TicketView[]>;
  myOrders(): Promise<{ order: Order; event: BpopEvent }[]>;
  getTicket(ticketId: ID): Promise<TicketView | null>;
  startTransfer(ticketIds: ID[], toPhone: string): Promise<void>;
  cancelTransfer(ticketId: ID): Promise<void>;
  incomingTransfers(): Promise<TicketView[]>;
  acceptTransfer(ticketId: ID): Promise<void>;
  declineTransfer(ticketId: ID): Promise<void>;
  requestRefund(orderId: ID): Promise<void>;
  returnToWaitlist(ticketId: ID): Promise<void>;
  joinWaitlist(eventId: ID, ticketTypeId: ID, qty: number): Promise<WaitlistEntry>;
  leaveWaitlist(entryId: ID): Promise<void>;
  myWaitlist(): Promise<(WaitlistEntry & { event: BpopEvent; ticketType: TicketType })[]>;
  myKickbacks(): Promise<{ links: (KickbackLink & { event: BpopEvent; offer: KickbackOffer; orders: number; earned: number })[]; total: number }>;
  getOrCreateKickbackLink(eventId: ID): Promise<KickbackLink | null>;
  notifications(): Promise<Notification[]>;
  markNotificationsRead(): Promise<void>;
  smsOutbox(): Promise<SmsOutboxItem[]>;

  // organizer
  myOrgs(): Promise<{ org: Organization; role: TeamRole }[]>;
  createOrg(input: Pick<Organization, 'name' | 'bio' | 'city'> & { instagram?: string }): Promise<Organization>;
  updateOrg(orgId: ID, patch: Partial<Organization>): Promise<Organization>;
  orgEvents(orgId: ID): Promise<{ event: BpopEvent; stats: EventStats }[]>;
  orgStats(orgId: ID): Promise<OrgStats>;
  createEvent(orgId: ID, input: Partial<BpopEvent>): Promise<BpopEvent>;
  updateEvent(eventId: ID, patch: Partial<BpopEvent>): Promise<BpopEvent>;
  duplicateEvent(eventId: ID): Promise<BpopEvent>;
  cancelEvent(eventId: ID): Promise<void>;
  deleteDraft(eventId: ID): Promise<void>;
  eventById(eventId: ID): Promise<BpopEvent | null>;
  eventStats(eventId: ID): Promise<EventStats>;
  eventOrders(eventId: ID): Promise<Order[]>;
  eventAttendees(eventId: ID): Promise<{ ticket: Ticket; user: User; ticketType: TicketType; order: Order; viaWaitlist: boolean }[]>;
  approveOrder(orderId: ID, approve: boolean): Promise<void>;
  refundOrder(orderId: ID): Promise<void>;
  sendComps(eventId: ID, input: { phone: string; name?: string; ticketTypeId: ID; qty: number }): Promise<Ticket[]>;
  cancelComp(ticketId: ID): Promise<void>;
  doorSale(eventId: ID, input: { ticketTypeId: ID; qty: number; method: 'cash' | 'bkash'; name: string; phone?: string }): Promise<Ticket[]>;
  scanTicket(eventId: ID, payload: string, scannedBy: string): Promise<ScanResult>;
  undoCheckIn(ticketId: ID): Promise<void>;
  waitlistFor(eventId: ID): Promise<(WaitlistEntry & { user: User })[]>;
  releaseToWaitlist(eventId: ID, ticketTypeId: ID, qty: number): Promise<number>;
  kickbackLedger(eventId: ID): Promise<{ links: (KickbackLink & { user: User; orders: number; tickets: number; gmv: number; commission: number })[] }>;
  trackingStats(eventId: ID): Promise<{ link: TrackingLink; orders: number; tickets: number; revenue: number }[]>;
  addAffiliate(eventId: ID, offerId: ID, phone: string): Promise<void>;
  sendSmsBlast(orgId: ID, input: { audience: SmsBlast['audience']; eventId?: ID; body: string }): Promise<SmsBlast>;
  smsBlasts(orgId: ID): Promise<SmsBlast[]>;
  smsAudienceSize(orgId: ID, audience: SmsBlast['audience'], eventId?: ID): Promise<number>;
  payouts(orgId: ID): Promise<Payout[]>;
  requestPayout(orgId: ID, amount: number, instant: boolean): Promise<Payout>;
  addTeamMember(orgId: ID, phone: string, role: TeamRole): Promise<void>;
  removeTeamMember(orgId: ID, userId: ID): Promise<void>;
  createScannerPin(orgId: ID, label: string): Promise<ScannerPin>;
  deleteScannerPin(orgId: ID, pin: string): Promise<void>;
  scannerLogin(pin: string): Promise<{ org: Organization; events: BpopEvent[] }>;
  orgFollowers(orgId: ID): Promise<User[]>;
  teamMembers(orgId: ID): Promise<{ member: TeamMember; user: User }[]>;
  askAi(orgId: ID, question: string): Promise<string>;

  // dev / demo
  resetDemo(): Promise<void>;
}
