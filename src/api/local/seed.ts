// Demo data for Bangladesh. All organizers, artists and people are fictional.
import type { BpopEvent, Category, City, KickbackOffer, Order, Organization, Poster, Ticket, TicketType, User } from '../types';
import { DB_VERSION, type DB } from './db';
import { serviceFee, slugify } from '../../lib/util';

// deterministic PRNG so every fresh install looks the same
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEMO_ORGANIZER_PHONE = '+8801711000001';
export const DEMO_ATTENDEE_PHONE = '+8801811000002';
export const DEMO_SCANNER_PIN = '482913';

const FIRST = ['Nusrat', 'Rafi', 'Tanvir', 'Sadia', 'Arif', 'Mim', 'Fahim', 'Tasnim', 'Rakib', 'Anika', 'Shuvo', 'Lamia', 'Imran', 'Faria', 'Sajid', 'Tahmina', 'Nabil', 'Jarin', 'Rifat', 'Sumaiya', 'Zayan', 'Orpa', 'Mahir', 'Prova', 'Asif', 'Nishat', 'Rony', 'Tisha', 'Ayaan', 'Sharmin', 'Ehsan', 'Rumana', 'Tamim', 'Maliha', 'Sakib', 'Raisa', 'Fardin', 'Ishrat', 'Junaid', 'Tanzila'];
const LAST = ['Ahmed', 'Jahan', 'Hossain', 'Rahman', 'Islam', 'Chowdhury', 'Karim', 'Akter', 'Haque', 'Sultana', 'Khan', 'Mahmud', 'Sarkar', 'Uddin', 'Nahar', 'Talukder', 'Bhuiyan', 'Siddiqui'];

const iso = (d: Date) => d.toISOString();

function dhakaDate(base: number, dayOffset: number, hour: number, minute = 0): Date {
  // Build a timestamp at hour:minute Bangladesh time (UTC+6), dayOffset days from base
  const d = new Date(base + dayOffset * 86400e3);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  return new Date(Date.UTC(y, m, day, hour - 6, minute));
}

interface TierSpec {
  name: string;
  price: number;
  qty: number | null;
  desc?: string;
  soldPct?: number;
  extra?: Partial<TicketType>;
}

interface EventSpec {
  org: number;
  title: string;
  tagline?: string;
  cat: Category;
  city: City;
  venue: [string, string, number, number];
  day: number;
  hour: number;
  minute?: number;
  hours: number;
  tiers: TierSpec[];
  lineup?: string[];
  desc: string;
  featured?: boolean;
  sponsored?: boolean;
  series?: string;
  rsvpOnly?: boolean;
  age?: string;
  kickback?: Partial<KickbackOffer>;
  promo?: { code: string; kind: 'percent' | 'flat'; value: number; limit?: number | null };
  reveal?: boolean;
  status?: BpopEvent['status'];
}

const CAT_HUES: Record<Category, [number, number]> = {
  Nightlife: [290, 330],
  Concerts: [330, 20],
  Festivals: [25, 50],
  'Arts & Fashion': [260, 200],
  'Food & Drink': [15, 45],
  Activities: [150, 190],
  Fitness: [95, 160],
  Networking: [210, 240],
  Comedy: [45, 0],
};
const STYLES: Poster['style'][] = ['gradient', 'sun', 'grid', 'wave', 'type'];

const ORGS: Omit<Organization, 'id' | 'team' | 'scannerPins' | 'payoutMethods' | 'createdAt' | 'slug'>[] = [
  { name: 'Dhaka Sound Collective', bio: 'Warehouse nights, rooftop sunsets and the best of Dhaka electronic & indie. Building the city’s dance-floor family since 2019.', avatarHue: 300, bannerSeed: 11, verified: true, city: 'Dhaka', instagram: 'dhakasoundcollective', contactEmail: 'hello@dsc.example' },
  { name: 'Gulshan Run Club', bio: 'Free community runs every Friday & Saturday morning. All paces welcome — we run, we chat, we grab cha.', avatarHue: 120, bannerSeed: 22, verified: true, city: 'Dhaka', instagram: 'gulshanrunclub' },
  { name: 'Laugh Lab BD', bio: 'Bangla & English stand-up comedy. Open mics, headliner nights and the occasional roast.', avatarHue: 45, bannerSeed: 33, verified: true, city: 'Dhaka', instagram: 'laughlabbd' },
  { name: 'Chattogram Food Karnival', bio: 'Street food, mezban nights and the port city’s biggest food festivals.', avatarHue: 20, bannerSeed: 44, verified: false, city: 'Chattogram', instagram: 'ctgfoodkarnival' },
  { name: 'Banani Art House', bio: 'Independent gallery & design studio. Exhibitions, pop-up markets and fashion showcases.', avatarHue: 250, bannerSeed: 55, verified: true, city: 'Dhaka', instagram: 'bananiarthouse' },
  { name: 'Startup Adda', bio: 'Founders, builders and operators of Bangladesh. Monthly mixers, demo days and fireside chats.', avatarHue: 215, bannerSeed: 66, verified: true, city: 'Dhaka', instagram: 'startupadda' },
  { name: "Cox's Wave Fest", bio: 'Music, surf and sunsets on the longest beach in the world.', avatarHue: 35, bannerSeed: 77, verified: true, city: "Cox's Bazar", instagram: 'coxswavefest' },
  { name: 'Sylhet Tea Trails', bio: 'Guided tea-garden hikes, waterfall day trips and campfire nights in the hills of Sylhet.', avatarHue: 140, bannerSeed: 88, verified: false, city: 'Sylhet', instagram: 'sylhetteatrails' },
  { name: 'Old Dhaka Heritage Walks', bio: 'Walking tours through Puran Dhaka — architecture, history and the best kachchi stops.', avatarHue: 10, bannerSeed: 99, verified: false, city: 'Dhaka', instagram: 'olddhakawalks' },
  { name: 'Rooftop Sessions', bio: 'Intimate acoustic sets on Dhaka rooftops. Limited capacity, unlimited vibes.', avatarHue: 275, bannerSeed: 111, verified: true, city: 'Dhaka', instagram: 'rooftopsessionsdhaka' },
  { name: 'Khulna Indie Nights', bio: 'Supporting independent bands from the south-west. Gigs, jams and band battles.', avatarHue: 350, bannerSeed: 122, verified: false, city: 'Khulna', instagram: 'khulnaindienights' },
  { name: 'Rajshahi Mango Mela', bio: 'The sweetest summer festival — mangoes, music and the silk city’s culture.', avatarHue: 55, bannerSeed: 133, verified: false, city: 'Rajshahi', instagram: 'rajshahimangomela' },
];

const V = {
  warehouse: ['The Warehouse, Tejgaon', 'Plot 14, Tejgaon I/A, Dhaka 1208', 23.7639, 90.3996] as [string, string, number, number],
  skyline: ['Skyline Rooftop, Gulshan 2', 'Road 103, Gulshan 2, Dhaka 1212', 23.7946, 90.4143] as [string, string, number, number],
  loft: ['The Loft, Banani 11', 'House 40, Road 11, Banani, Dhaka 1213', 23.7937, 90.4066] as [string, string, number, number],
  hatirjheel: ['Hatirjheel Amphitheatre', 'Hatirjheel, Dhaka 1219', 23.7535, 90.4046] as [string, string, number, number],
  gulshanLake: ['Gulshan Lake Park', 'Gulshan Avenue, Dhaka 1212', 23.7928, 90.4157] as [string, string, number, number],
  comedyBar: ['Punchline Café, Dhanmondi', 'Road 27 (old), Dhanmondi, Dhaka 1209', 23.7525, 90.3747] as [string, string, number, number],
  artHouse: ['Banani Art House Gallery', 'House 7, Road 17, Banani, Dhaka 1213', 23.7905, 90.4033] as [string, string, number, number],
  iccb: ['Bashundhara Expo Hall', 'Kuril, Bashundhara R/A, Dhaka 1229', 23.8164, 90.4263] as [string, string, number, number],
  coworking: ['Hive Coworking, Mohakhali', '12 Mohakhali C/A, Dhaka 1212', 23.7781, 90.4007] as [string, string, number, number],
  ctgFood: ['Patenga Beach Grounds', 'Patenga, Chattogram 4204', 22.2357, 91.7915] as [string, string, number, number],
  ctgHall: ['GEC Convention Hall', 'GEC Circle, Chattogram 4000', 22.3592, 91.8216] as [string, string, number, number],
  coxs: ['Laboni Beach Point', 'Laboni Point, Cox’s Bazar 4700', 21.4272, 91.9702] as [string, string, number, number],
  sylhet: ['Malnicherra Tea Estate Gate', 'Airport Road, Sylhet 3100', 24.9235, 91.8687] as [string, string, number, number],
  sylhetCamp: ['Ratargul Base Camp', 'Gowainghat, Sylhet', 25.0001, 91.9333] as [string, string, number, number],
  oldDhaka: ['Ahsan Manzil Gate', 'Islampur Rd, Old Dhaka 1100', 23.7086, 90.4061] as [string, string, number, number],
  rooftopDhanmondi: ['Garden Terrace, Dhanmondi 4A', 'House 22, Road 4A, Dhanmondi, Dhaka 1209', 23.7413, 90.3787] as [string, string, number, number],
  khulna: ['Rupsha Riverside Stage', 'Rupsha Ghat, Khulna 9100', 22.8106, 89.5665] as [string, string, number, number],
  rajshahi: ['Padma Garden Grounds', 'Padma Riverbank, Rajshahi 6100', 24.3636, 88.6241] as [string, string, number, number],
  purbachal: ['Lakeside Fields, Purbachal', 'Sector 4, Purbachal, Dhaka', 23.8467, 90.4934] as [string, string, number, number],
};

const P = (paras: string[]) => paras.join('\n\n');

const EVENTS: EventSpec[] = [
  { org: 0, title: 'NEON MONSOON: Warehouse Rave', tagline: 'Two rooms. Ten hours. One city.', cat: 'Nightlife', city: 'Dhaka', venue: V.warehouse, day: 3, hour: 21, hours: 7, featured: true, age: '18+ with valid ID',
    tiers: [{ name: 'Early Bird', price: 1200, qty: 150, soldPct: 1, desc: 'First release — limited.' }, { name: 'General Admission', price: 1800, qty: 400, soldPct: 0.62 }, { name: 'VIP Deck', price: 4500, qty: 80, soldPct: 0.4, desc: 'Express entry, raised VIP deck in front of the main stage, complimentary welcome drink (non-alcoholic).' }],
    lineup: ['DJ Kalbaishakhi', 'Moheen b2b Tara', 'Ghost of Gulshan', 'Nitu Noir', 'Shorshe', 'Lalbagh Lovers', 'Kite Theory', 'Rumi Rays', 'Bassline Bibi', 'Ostad K'],
    kickback: { kind: 'percent', value: 5, per: 'order', isPublic: true, showBanner: true },
    promo: { code: 'MONSOON10', kind: 'percent', value: 10, limit: 100 },
    desc: P(['On **this Thursday**, Dhaka Sound Collective takes over **The Warehouse in Tejgaon** for our **biggest night yet** — two rooms of house, techno and desi club edits until sunrise.', '☆ TWO STAGES\n☆ IMMERSIVE LIGHT INSTALLATION\n☆ FOOD COURT BY LOCAL VENDORS\n☆ SURPRISE B2B SETS ALL NIGHT', '**EARLY BIRD:** entry for the full night.\n**GENERAL ADMISSION:** entry for the full night + access to both rooms.\n**VIP DECK:** express entry, raised deck in front of the main stage, welcome drink.', 'Doors 9PM. Last entry 1AM. 18+ with valid ID. Strictly no outside drinks.']) },
  { org: 1, title: 'Friday Lake Loop 5K', tagline: 'Free community run · all paces', cat: 'Fitness', city: 'Dhaka', venue: V.gulshanLake, day: 1, hour: 6, minute: 30, hours: 2, series: 'gulshan-lake-loop', rsvpOnly: true,
    tiers: [{ name: 'RSVP', price: 0, qty: 120, soldPct: 0.5 }], lineup: ['Pacer: Tasnim (6:00/km)', 'Pacer: Arif (5:00/km)'],
    desc: P(['Our weekly 5K around Gulshan Lake. Meet at the north gate — warm-up at 6:30, we roll at 6:45.', 'Walkers, joggers and speedsters all welcome. Pace groups for 5:00, 6:00 and 7:00 min/km.', 'Stay after for cha and singara on us.']) },
  { org: 1, title: 'Friday Lake Loop 5K', tagline: 'Free community run · all paces', cat: 'Fitness', city: 'Dhaka', venue: V.gulshanLake, day: 8, hour: 6, minute: 30, hours: 2, series: 'gulshan-lake-loop', rsvpOnly: true,
    tiers: [{ name: 'RSVP', price: 0, qty: 120, soldPct: 0.2 }], lineup: ['Pacer: Tasnim (6:00/km)', 'Pacer: Arif (5:00/km)'],
    desc: P(['Our weekly 5K around Gulshan Lake. Meet at the north gate — warm-up at 6:30, we roll at 6:45.', 'Walkers, joggers and speedsters all welcome.']) },
  { org: 1, title: 'Friday Lake Loop 5K', tagline: 'Free community run · all paces', cat: 'Fitness', city: 'Dhaka', venue: V.gulshanLake, day: 15, hour: 6, minute: 30, hours: 2, series: 'gulshan-lake-loop', rsvpOnly: true,
    tiers: [{ name: 'RSVP', price: 0, qty: 120, soldPct: 0.05 }], lineup: ['Pacer: Tasnim (6:00/km)'],
    desc: P(['Our weekly 5K around Gulshan Lake.']) },
  { org: 1, title: 'Hatirjheel Night Run 10K', tagline: 'Glow sticks, city lights, 10K', cat: 'Fitness', city: 'Dhaka', venue: V.hatirjheel, day: 9, hour: 20, hours: 3, kickback: { kind: 'flat', value: 50, per: 'ticket', isPublic: true, showBanner: true },
    tiers: [{ name: 'Runner Kit', price: 900, qty: 250, soldPct: 0.55, desc: 'Race bib, glow tee, medal, hydration.' }, { name: 'Runner Kit + Photo Pack', price: 1300, qty: 60, soldPct: 0.3 }],
    lineup: ['Warm-up by FitBD Crew', 'Finish-line DJ: Rumi Rays'],
    desc: P(['A 10K loop around Hatirjheel under the city lights. Timed race with chip timing, medals for every finisher and prizes for top 3 in each category.', 'Bag drop, water stations every 2.5K and a finish-line party.']) },
  { org: 2, title: 'Laugh Lab Live: Open Mic Night', tagline: 'Ten comics. Five minutes each. Zero mercy.', cat: 'Comedy', city: 'Dhaka', venue: V.comedyBar, day: 2, hour: 20, hours: 2, series: 'laugh-lab-open-mic',
    tiers: [{ name: 'General Seating', price: 350, qty: 90, soldPct: 0.7 }, { name: 'Front Row (you will be roasted)', price: 600, qty: 12, soldPct: 1, extra: { waitlistEnabled: true } }],
    lineup: ['Host: Sajid Bhai', 'Orpa Unfiltered', 'Mahir the Menace', 'Tanzila Talks'],
    desc: P(['Our weekly open mic — the best new comics in Dhaka trying out fresh material. Bangla & English sets.', 'Front row seats WILL be part of the show. You have been warned.']) },
  { org: 2, title: 'Laugh Lab Live: Open Mic Night', tagline: 'Ten comics. Five minutes each.', cat: 'Comedy', city: 'Dhaka', venue: V.comedyBar, day: 9, hour: 20, hours: 2, series: 'laugh-lab-open-mic',
    tiers: [{ name: 'General Seating', price: 350, qty: 90, soldPct: 0.25 }, { name: 'Front Row (you will be roasted)', price: 600, qty: 12, soldPct: 0.5, extra: { waitlistEnabled: true } }],
    lineup: ['Host: Sajid Bhai'], desc: P(['Our weekly open mic — the best new comics in Dhaka.']) },
  { org: 2, title: 'ROAST OF THE TRAFFIC JAM — Headliner Special', tagline: 'A full-length special about the city we love to hate', cat: 'Comedy', city: 'Dhaka', venue: V.iccb, day: 12, hour: 19, minute: 30, hours: 3, featured: true,
    tiers: [{ name: 'Silver', price: 800, qty: 300, soldPct: 0.6 }, { name: 'Gold', price: 1500, qty: 120, soldPct: 0.75 }, { name: 'Platinum (meet & greet)', price: 3500, qty: 40, soldPct: 1, extra: { waitlistEnabled: true, waitlistResponseMins: 30 } }],
    lineup: ['Naveed Nawab', 'Raisa Roasts', 'Junaid J', 'Opening: Mahir the Menace'],
    kickback: { kind: 'percent', value: 8, per: 'order', isPublic: true, showBanner: true },
    desc: P(['Laugh Lab presents its biggest headliner night of the year at Bashundhara Expo Hall. Two hours of comedy about rickshaws, CNG drivers, Gulshan 1 at 6PM and everything in between.', '**PLATINUM:** front-section seating + meet & greet + signed poster.']) },
  { org: 3, title: 'Mezban Mela 2026', tagline: 'The biggest mezbani feast in the port city', cat: 'Food & Drink', city: 'Chattogram', venue: V.ctgFood, day: 6, hour: 12, hours: 10, featured: true,
    tiers: [{ name: 'Entry Pass', price: 200, qty: 500, soldPct: 0.45 }, { name: 'Feast Pass (entry + mezbani plate)', price: 650, qty: 250, soldPct: 0.5 }, { name: 'Family Pass (4 people)', price: 2200, qty: 40, soldPct: 0.35, extra: { minPerOrder: 1, maxPerOrder: 2 } }],
    lineup: ['Live: Chatgaiya Band', 'Kalurghat Brass', 'Food trucks from 40+ vendors'],
    promo: { code: 'CTGFOOD', kind: 'flat', value: 100, limit: null },
    desc: P(['Chattogram’s favourite food festival is back on Patenga beach. Mezbani beef, kala bhuna, dried fish specials, sweets from every corner of the division.', 'Live music from 4PM, sunset at 5:30, fireworks at 9PM.']) },
  { org: 3, title: 'Port City Street Food Crawl', tagline: 'Six stops, one evening', cat: 'Food & Drink', city: 'Chattogram', venue: V.ctgHall, day: 13, hour: 17, hours: 4,
    tiers: [{ name: 'Crawl Ticket', price: 1100, qty: 60, soldPct: 0.85, desc: 'Tastings at all six stops + guide.' }],
    desc: P(['A guided walk through GEC, Jamal Khan and Chawkbazar with tastings at six legendary stalls. Come hungry.']) },
  { org: 4, title: 'Threads of Jamdani — Exhibition Opening', tagline: 'Contemporary textile art', cat: 'Arts & Fashion', city: 'Dhaka', venue: V.artHouse, day: 4, hour: 18, hours: 4, rsvpOnly: true,
    tiers: [{ name: 'RSVP', price: 0, qty: 200, soldPct: 0.6 }], lineup: ['Curator talk: Faria Siddiqui', 'Live weaving demo'],
    desc: P(['Opening night of our autumn exhibition exploring jamdani through contemporary textile and installation art. Ten artists, forty works.', 'Light refreshments. Curator talk at 7PM.']) },
  { org: 4, title: 'Banani Design Market', tagline: '60 local makers under one roof', cat: 'Arts & Fashion', city: 'Dhaka', venue: V.artHouse, day: 10, hour: 11, hours: 9, sponsored: true,
    tiers: [{ name: 'Day Entry', price: 100, qty: 300, soldPct: 0.3 }, { name: 'Early Access (11am–1pm)', price: 400, qty: 150, soldPct: 0.6 }],
    desc: P(['Handmade fashion, ceramics, prints, jewellery and zines from 60 independent Bangladeshi makers. Food stalls and a DJ in the courtyard.']) },
  { org: 4, title: 'RUNWAY: New Voices of Bangladeshi Fashion', tagline: 'A showcase of eight emerging designers', cat: 'Arts & Fashion', city: 'Dhaka', venue: V.loft, day: 18, hour: 19, hours: 3, featured: true,
    tiers: [{ name: 'Standing', price: 1000, qty: 180, soldPct: 0.4 }, { name: 'Front Row', price: 3000, qty: 40, soldPct: 0.55, extra: { requireApproval: true, description: 'Front-row seating is curated — requests are approved by the organizer.' } }, { name: 'Press & Buyers', price: 0, qty: 30, soldPct: 0.2, extra: { password: 'PRESS2026', description: 'Password protected. Contact the organizer for access.' } }],
    lineup: ['Studio Prova', 'House of Ehsan', 'Nishat Atelier', 'Kaarukaj', 'Rumana R.', 'Tisha & Co.', 'Ayaan Label', 'Sharmin Studio'],
    desc: P(['Eight emerging designers present their first collections in an intimate runway show at The Loft.', 'After-party with DJ Nitu Noir.']) },
  { org: 5, title: 'Founders & Chai: Monthly Mixer', tagline: 'Meet 200 builders over chai', cat: 'Networking', city: 'Dhaka', venue: V.coworking, day: 5, hour: 18, minute: 30, hours: 3,
    tiers: [{ name: 'Community', price: 300, qty: 200, soldPct: 0.7 }, { name: 'Founder Pass (incl. 1:1 investor office hours)', price: 1500, qty: 30, soldPct: 0.8, extra: { requireApproval: true } }],
    lineup: ['Fireside: Asif Mahmud (fintech)', 'Moderator: Maliha Khan'],
    desc: P(['Our monthly mixer for founders, operators, designers and engineers. Fireside chat at 7PM, then open networking.', 'Founder Pass holders get a 15-minute office-hours slot with one of our visiting investors (approval required).']) },
  { org: 5, title: 'Demo Day: Batch 07', tagline: '12 startups pitch live', cat: 'Networking', city: 'Dhaka', venue: V.iccb, day: 20, hour: 15, hours: 4, rsvpOnly: true,
    tiers: [{ name: 'RSVP', price: 0, qty: 200, soldPct: 0.4 }], desc: P(['Twelve startups from Batch 07 pitch to investors and the community. Free entry, RSVP required.']) },
  { org: 6, title: "Cox's Wave Fest 2026", tagline: 'Three days of music, surf & sunsets', cat: 'Festivals', city: "Cox's Bazar", venue: V.coxs, day: 24, hour: 14, hours: 58, featured: true,
    tiers: [{ name: '3-Day Pass', price: 3500, qty: 600, soldPct: 0.5 }, { name: '3-Day VIP', price: 9000, qty: 80, soldPct: 0.45, desc: 'VIP beach lounge, express entry, dedicated washrooms, merch pack.' }, { name: 'Day Pass — Saturday', price: 1800, qty: 250, soldPct: 0.6 }, { name: 'Gate Ticket (pay at the door)', price: 2000, qty: 100, soldPct: 0, extra: { inPersonOnly: true, description: 'Available at the gate only — cash or bKash.' } }],
    lineup: ['Shonar Bangla Express', 'Meghdol Revival', 'Tara Tidewater', 'Kite Theory', 'Bassline Bibi', 'Salt & Shore', 'Rumi Rays', 'Laboni Lights', 'DJ Kalbaishakhi', 'Dorjar Opare'],
    kickback: { kind: 'percent', value: 6, per: 'order', isPublic: true, showBanner: true },
    promo: { code: 'WAVE500', kind: 'flat', value: 500, limit: 300 },
    desc: P(['Bangladesh’s beach festival returns to Laboni Point for three days of live music, surf lessons, yoga at sunrise and bonfires every night.', '☆ 3 STAGES\n☆ SURF SCHOOL\n☆ ARTISAN MARKET\n☆ CAMPING ZONE (add-on)', 'Kids under 10 free with a paying adult.']) },
  { org: 7, title: 'Malnicherra Sunrise Tea Walk', tagline: 'Sunrise, mist and the first flush', cat: 'Activities', city: 'Sylhet', venue: V.sylhet, day: 7, hour: 5, minute: 30, hours: 4,
    tiers: [{ name: 'Walk + Breakfast', price: 750, qty: 40, soldPct: 1, extra: { waitlistEnabled: true, waitlistResponseMins: 20, waitlistMaxPerUser: 2 } }],
    lineup: ['Guide: Ehsan Talukder'], desc: P(['A gentle 6km guided walk through Bangladesh’s oldest tea estate at sunrise, ending with a garden breakfast and tea tasting.']) },
  { org: 7, title: 'Ratargul Swamp Forest Day Trip', tagline: 'Boats, birds and the only freshwater swamp forest in BD', cat: 'Activities', city: 'Sylhet', venue: V.sylhetCamp, day: 14, hour: 7, hours: 10, reveal: true,
    tiers: [{ name: 'Day Trip (transport + lunch)', price: 2400, qty: 30, soldPct: 0.6 }], desc: P(['Full day trip from Sylhet city — boat ride through Ratargul, lunch by the river and a stop at Bisnakandi on the way back. Pickup point shared after booking.']) },
  { org: 8, title: 'Puran Dhaka Food & Heritage Walk', tagline: 'Ahsan Manzil to Nazira Bazar', cat: 'Activities', city: 'Dhaka', venue: V.oldDhaka, day: 2, hour: 16, hours: 4, series: 'puran-dhaka-walk',
    tiers: [{ name: 'Walk + Tastings', price: 950, qty: 25, soldPct: 0.8 }], lineup: ['Guide: Rifat Bhuiyan'],
    desc: P(['A slow walk through 400 years of Old Dhaka — Ahsan Manzil, Armenian Church, Shankhari Bazar — with tastings of bakarkhani, lassi and the city’s most famous kachchi.']) },
  { org: 8, title: 'Puran Dhaka Food & Heritage Walk', tagline: 'Ahsan Manzil to Nazira Bazar', cat: 'Activities', city: 'Dhaka', venue: V.oldDhaka, day: 9, hour: 16, hours: 4, series: 'puran-dhaka-walk',
    tiers: [{ name: 'Walk + Tastings', price: 950, qty: 25, soldPct: 0.3 }], desc: P(['A slow walk through 400 years of Old Dhaka.']) },
  { org: 9, title: 'Rooftop Sessions Vol. 18 — Acoustic Under the Stars', tagline: '60 seats. Candles. Unplugged.', cat: 'Concerts', city: 'Dhaka', venue: V.rooftopDhanmondi, day: 5, hour: 19, minute: 30, hours: 3, featured: true, reveal: true,
    tiers: [{ name: 'Floor Cushion', price: 1200, qty: 45, soldPct: 1, extra: { waitlistEnabled: true } }, { name: 'Table for 2', price: 3200, qty: 8, soldPct: 1, extra: { waitlistEnabled: true } }],
    lineup: ['Meghdol Revival (acoustic)', 'Tara Tidewater', 'Opening: Prova'],
    desc: P(['Our 18th rooftop session — three acoustic sets under the stars in a secret Dhanmondi garden terrace.', 'Exact address released to ticket holders the day before. Strictly limited capacity.']) },
  { org: 9, title: 'Rooftop Sessions Vol. 19 — Ghazal Night', tagline: 'Old songs, new voices', cat: 'Concerts', city: 'Dhaka', venue: V.skyline, day: 19, hour: 20, hours: 3,
    tiers: [{ name: 'Seat', price: 1500, qty: 80, soldPct: 0.35 }], lineup: ['Nishat Nahar', 'Ostad K (harmonium)'], desc: P(['An evening of ghazal and nazrul geeti reimagined by young voices.']) },
  { org: 10, title: 'Battle of the Bands: South-West Finals', tagline: '8 bands. 1 trophy.', cat: 'Concerts', city: 'Khulna', venue: V.khulna, day: 11, hour: 16, hours: 6,
    tiers: [{ name: 'General', price: 300, qty: 300, soldPct: 0.4 }, { name: 'Fan Pit', price: 700, qty: 80, soldPct: 0.5 }],
    lineup: ['Rupsha Riot', 'Sundarban Static', 'Mongla Mood', 'The Gollamari Gang', 'Bhairab Blues', 'Daulatpur Drive', 'Khalishpur Kids', 'Satkhira Sound'],
    desc: P(['The finals of our six-month band competition. Eight bands from Khulna, Jessore, Satkhira and Bagerhat compete for the trophy and a studio recording deal.']) },
  { org: 11, title: 'Rajshahi Mango Mela', tagline: 'Taste 40 varieties of mango', cat: 'Festivals', city: 'Rajshahi', venue: V.rajshahi, day: 27, hour: 10, hours: 10,
    tiers: [{ name: 'Entry', price: 0, qty: 600, soldPct: 0.3 }, { name: 'Tasting Pass', price: 400, qty: 150, soldPct: 0.25 }],
    lineup: ['Folk: Padma Baul Dol', 'Gombhira performance'], desc: P(['From Fazli to Langra to Himsagar — taste forty varieties, meet the growers and enjoy gombhira and baul performances on the riverbank.']) },
  { org: 0, title: 'SUNDOWNER: Rooftop House Session', tagline: 'Sunset to late · house & disco', cat: 'Nightlife', city: 'Dhaka', venue: V.skyline, day: 4, hour: 17, hours: 6, series: 'sundowner',
    tiers: [{ name: 'Free RSVP (before 7pm)', price: 0, qty: 200, soldPct: 0.9 }, { name: 'General Admission', price: 800, qty: 250, soldPct: 0.4 }],
    lineup: ['Nitu Noir', 'Kite Theory', 'Shorshe'], kickback: { kind: 'percent', value: 10, per: 'order', isPublic: true, showBanner: false },
    desc: P(['Every week we watch the sun go down over Gulshan with house and disco until late.', 'Free RSVP before 7PM, GA after.']) },
  { org: 0, title: 'SUNDOWNER: Rooftop House Session', tagline: 'Sunset to late · house & disco', cat: 'Nightlife', city: 'Dhaka', venue: V.skyline, day: 11, hour: 17, hours: 6, series: 'sundowner',
    tiers: [{ name: 'Free RSVP (before 7pm)', price: 0, qty: 200, soldPct: 0.3 }, { name: 'General Admission', price: 800, qty: 250, soldPct: 0.1 }],
    lineup: ['Rumi Rays', 'Bassline Bibi'], desc: P(['Every week we watch the sun go down over Gulshan.']) },
  { org: 0, title: 'SUNDOWNER: Rooftop House Session', tagline: 'Sunset to late · house & disco', cat: 'Nightlife', city: 'Dhaka', venue: V.skyline, day: 18, hour: 17, hours: 6, series: 'sundowner',
    tiers: [{ name: 'Free RSVP (before 7pm)', price: 0, qty: 200, soldPct: 0.05 }, { name: 'General Admission', price: 800, qty: 250, soldPct: 0 }],
    lineup: ['Ghost of Gulshan'], desc: P(['Every week we watch the sun go down over Gulshan.']) },
  { org: 0, title: 'Purbachal Open Air: Lakeside Day Festival', tagline: 'A day-to-night open-air festival by the lake', cat: 'Festivals', city: 'Dhaka', venue: V.purbachal, day: 30, hour: 13, hours: 11,
    tiers: [{ name: 'Tier 1', price: 1500, qty: 250, soldPct: 1 }, { name: 'Tier 2', price: 2000, qty: 300, soldPct: 0.3 }, { name: 'Tier 3', price: 2500, qty: 300, soldPct: 0 }, { name: 'Backstage Pass', price: 7500, qty: 60, soldPct: 0.5, extra: { hidden: true, description: 'Hidden tier — shared privately with friends of the collective.' } }],
    lineup: ['DJ Kalbaishakhi', 'Moheen', 'Tara', 'Ghost of Gulshan', 'Ostad K', 'Lalbagh Lovers'],
    desc: P(['Our first-ever open-air day festival — two stages by the lake in Purbachal, food village, art installations and a sunset set you will remember.']) },
  { org: 5, title: 'Women in Tech Dhaka: Breakfast Panel', tagline: 'Leadership, hiring and building in BD', cat: 'Networking', city: 'Dhaka', venue: V.coworking, day: 16, hour: 9, hours: 3,
    tiers: [{ name: 'Breakfast Ticket', price: 500, qty: 120, soldPct: 0.5 }], lineup: ['Jarin Haque', 'Tahmina Sultana', 'Raisa Karim'],
    desc: P(['A breakfast panel with three engineering and product leaders on building careers and companies in Bangladesh.']) },
  { org: 10, title: 'Indie Unplugged: Riverside Jam', tagline: 'Open jam by the Rupsha', cat: 'Concerts', city: 'Khulna', venue: V.khulna, day: 22, hour: 17, hours: 4, rsvpOnly: true,
    tiers: [{ name: 'RSVP', price: 0, qty: 300, soldPct: 0.2 }], desc: P(['Bring your guitar. Open jam on the riverside stage — sign up on arrival.']) },
  { org: 3, title: 'Chattogram Coffee Week: Latte Art Throwdown', tagline: '16 baristas. One milk jug.', cat: 'Food & Drink', city: 'Chattogram', venue: V.ctgHall, day: 17, hour: 15, hours: 4,
    tiers: [{ name: 'Spectator', price: 250, qty: 300, soldPct: 0.3 }, { name: 'Competitor Entry', price: 1000, qty: 16, soldPct: 0.75, extra: { requireApproval: true } }],
    desc: P(['A knock-out latte art competition with Chattogram’s best baristas, plus tastings from six local roasters.']) },
  // past events (for organizer history & "Past events")
  { org: 0, title: 'NEON MONSOON: Opening Night', cat: 'Nightlife', city: 'Dhaka', venue: V.warehouse, day: -18, hour: 21, hours: 7, tiers: [{ name: 'General Admission', price: 1500, qty: 300, soldPct: 0.95 }], lineup: ['DJ Kalbaishakhi', 'Nitu Noir'], desc: P(['The night that started it all.']) },
  { org: 0, title: 'SUNDOWNER: Rooftop House Session', tagline: 'Sunset to late', cat: 'Nightlife', city: 'Dhaka', venue: V.skyline, day: -3, hour: 17, hours: 6, series: 'sundowner', tiers: [{ name: 'Free RSVP (before 7pm)', price: 0, qty: 200, soldPct: 1 }, { name: 'General Admission', price: 800, qty: 250, soldPct: 0.8 }], lineup: ['Shorshe'], desc: P(['Every week we watch the sun go down over Gulshan.']) },
  { org: 2, title: 'Laugh Lab Live: Open Mic Night', tagline: 'Ten comics. Five minutes each.', cat: 'Comedy', city: 'Dhaka', venue: V.comedyBar, day: -5, hour: 20, hours: 2, series: 'laugh-lab-open-mic', tiers: [{ name: 'General Seating', price: 350, qty: 90, soldPct: 1 }], desc: P(['Our weekly open mic.']) },
  { org: 1, title: 'Friday Lake Loop 5K', tagline: 'Free community run · all paces', cat: 'Fitness', city: 'Dhaka', venue: V.gulshanLake, day: -6, hour: 6, minute: 30, hours: 2, series: 'gulshan-lake-loop', rsvpOnly: true, tiers: [{ name: 'RSVP', price: 0, qty: 120, soldPct: 0.9 }], desc: P(['Our weekly 5K around Gulshan Lake.']) },
  { org: 6, title: "Cox's Wave Fest: Sunset Warm-up", cat: 'Festivals', city: "Cox's Bazar", venue: V.coxs, day: -25, hour: 16, hours: 6, tiers: [{ name: 'Entry', price: 600, qty: 250, soldPct: 0.9 }], lineup: ['Salt & Shore', 'Laboni Lights'], desc: P(['A one-day warm-up for the main festival.']) },
  { org: 9, title: 'Rooftop Sessions Vol. 17', cat: 'Concerts', city: 'Dhaka', venue: V.rooftopDhanmondi, day: -12, hour: 19, minute: 30, hours: 3, tiers: [{ name: 'Floor Cushion', price: 1200, qty: 45, soldPct: 1 }], lineup: ['Prova'], desc: P(['Vol. 17 of our rooftop series.']) },
  { org: 0, title: 'Untitled Winter Party (draft)', cat: 'Nightlife', city: 'Dhaka', venue: V.loft, day: 45, hour: 21, hours: 5, status: 'draft', tiers: [{ name: 'General Admission', price: 1000, qty: 300, soldPct: 0 }], desc: P(['Draft — details coming soon.']) },
];

export function buildSeed(): DB {
  const r = rng(20261020);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]!;
  const now = Date.now();
  const base = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());
  let idc = 0;
  const id = (p: string) => `${p}_${(++idc).toString(36)}${Math.floor(r() * 1e6).toString(36)}`;
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = () => {
    let s = '';
    for (let i = 0; i < 8; i++) s += ALPHA[Math.floor(r() * ALPHA.length)];
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  };
  const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const v = Math.floor(r() * 16);
    return (c === 'x' ? v : (v & 0x3) | 0x8).toString(16);
  });

  // ---- users ----
  const users: User[] = [];
  const mkUser = (name: string, phone: string, city: City = 'Dhaka', extra: Partial<User> = {}): User => {
    const uname = slugify(name).replace(/-/g, '') + (users.length > 1 ? Math.floor(r() * 90 + 10) : '');
    const u: User = {
      id: id('u'),
      name,
      username: uname,
      phone,
      avatarHue: Math.floor(r() * 360),
      city,
      following: [],
      friends: [],
      saved: [],
      blocked: [],
      smsOptIn: true,
      privateProfile: false,
      createdAt: iso(new Date(now - Math.floor(r() * 300) * 86400e3)),
      ...extra,
    };
    users.push(u);
    return u;
  };
  const organizer = mkUser('Rafi Ahmed', DEMO_ORGANIZER_PHONE, 'Dhaka', { username: 'rafi', email: 'rafi@example.com', bio: 'Founder, Dhaka Sound Collective. Also runs Laugh Lab BD.' });
  const attendee = mkUser('Nusrat Jahan', DEMO_ATTENDEE_PHONE, 'Dhaka', { username: 'nusrat', bio: 'Rooftops, run clubs and comedy nights.' });
  for (let i = 0; i < 70; i++) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const phone = `+8801${pick(['3', '5', '6', '7', '8', '9'])}${String(10000000 + Math.floor(r() * 89999999))}`;
    mkUser(name, phone, r() < 0.8 ? 'Dhaka' : pick(['Chattogram', 'Sylhet', 'Khulna', 'Rajshahi'] as City[]));
  }
  const crowd = users.slice(2);

  // ---- orgs ----
  const orgs: Organization[] = ORGS.map((o, i) => ({
    ...o,
    id: id('org'),
    slug: slugify(o.name),
    team: [{ userId: i === 0 || i === 2 ? organizer.id : crowd[i]!.id, role: 'owner', addedAt: iso(new Date(now - 400 * 86400e3)) }],
    scannerPins: i === 0 ? [{ pin: DEMO_SCANNER_PIN, secret: 'door-team', label: 'Main door', createdAt: iso(new Date(now - 10 * 86400e3)) }] : [],
    payoutMethods: [{ id: id('pm'), kind: 'bkash', label: `bKash •••• ${String(1000 + i * 731).slice(-4)}`, primary: true }],
    createdAt: iso(new Date(now - (500 - i * 20) * 86400e3)),
  }));
  orgs[0]!.team.push({ userId: crowd[3]!.id, role: 'host', addedAt: iso(new Date(now - 60 * 86400e3)) }, { userId: crowd[4]!.id, role: 'doorperson', addedAt: iso(new Date(now - 60 * 86400e3)) });

  // followers & friends
  for (const u of crowd) {
    for (const o of orgs) if (r() < 0.35) u.following.push(o.id);
    for (let k = 0; k < 6; k++) {
      const f = pick(crowd);
      if (f.id !== u.id && !u.friends.includes(f.id)) u.friends.push(f.id);
    }
  }
  attendee.following.push(orgs[0]!.id, orgs[1]!.id, orgs[9]!.id);
  attendee.friends.push(...crowd.slice(0, 12).map((u) => u.id));
  organizer.friends.push(...crowd.slice(5, 15).map((u) => u.id));

  // ---- events ----
  const events: BpopEvent[] = [];
  const seriesIds: Record<string, string> = {};
  EVENTS.forEach((s, idx) => {
    const org = orgs[s.org]!;
    const starts = dhakaDate(base, s.day, s.hour, s.minute ?? 0);
    const ends = new Date(starts.getTime() + s.hours * 3600e3);
    const ticketTypes: TicketType[] = s.tiers.map((t, ti) => ({
      id: id('tt'),
      name: t.name,
      description: t.desc,
      price: t.price,
      quantity: t.qty !== null && t.qty > 100 ? Math.round(t.qty * 0.55) : t.qty,
      sold: 0,
      minPerOrder: 1,
      maxPerOrder: s.rsvpOnly ? 1 : 10,
      hidden: false,
      inPersonOnly: false,
      allowTransfers: t.price > 0,
      markedSoldOut: false,
      requireApproval: false,
      waitlistEnabled: false,
      waitlistResponseMins: 30,
      waitlistMaxPerUser: null,
      heldForWaitlist: 0,
      order: ti,
      ...t.extra,
    }));
    if (s.series && !seriesIds[s.series]) seriesIds[s.series] = id('series');
    const slugBase = slugify(s.title);
    const slug = events.some((e) => e.slug === slugBase) || s.series ? `${slugBase}-${starts.toISOString().slice(0, 10)}` : slugBase;
    const kick: KickbackOffer[] = s.kickback
      ? [{ id: id('kb'), kind: 'percent', value: 5, per: 'order', ticketTypeIds: null, isPublic: true, showBanner: true, enabled: true, affiliateIds: [], createdAt: iso(new Date(now - 20 * 86400e3)), ...s.kickback }]
      : [];
    events.push({
      id: id('ev'),
      slug,
      orgId: org.id,
      title: s.title,
      tagline: s.tagline,
      description: s.desc,
      category: s.cat,
      venue: { name: s.venue[0], address: s.venue[1], city: s.city, lat: s.venue[2], lng: s.venue[3], revealLater: s.reveal },
      startsAt: iso(starts),
      endsAt: iso(ends),
      poster: { seed: 1000 + idx * 37, style: STYLES[idx % STYLES.length]!, hues: CAT_HUES[s.cat] },
      lineup: (s.lineup ?? []).map((n) => ({ id: id('ln'), name: n, hue: Math.floor(r() * 360) })),
      status: s.status ?? 'published',
      visibility: 'public',
      rsvpOnly: !!s.rsvpOnly,
      ageLimit: s.age,
      seriesId: s.series ? seriesIds[s.series] : undefined,
      featured: !!s.featured,
      sponsored: s.sponsored,
      pageViews: 0,
      ticketTypes,
      ticketGroups: [],
      promoCodes: s.promo ? [{ id: id('pc'), code: s.promo.code, kind: s.promo.kind, value: s.promo.value, limit: s.promo.limit ?? null, uses: Math.floor(r() * 20), ticketTypeIds: null, active: true, createdAt: iso(new Date(now - 15 * 86400e3)) }] : [],
      kickbackOffers: kick,
      trackingLinks: [
        { id: id('tl'), slug: 'instagram', kind: 'tracking', visits: Math.floor(r() * 900), createdAt: iso(new Date(now - 20 * 86400e3)) },
        { id: id('tl'), slug: 'facebook-ads', kind: 'tracking', visits: Math.floor(r() * 1400), createdAt: iso(new Date(now - 20 * 86400e3)) },
      ],
      guestList: s.org === 0 && idx === 0 ? [{ id: id('gl'), name: 'Ostad K', plus: 2, checkedIn: false }, { id: id('gl'), name: 'Press — Daily Beat', plus: 1, checkedIn: false }] : [],
      showGuestlist: true,
      chatEnabled: true,
      createdAt: iso(new Date(starts.getTime() - 40 * 86400e3)),
    });
  });

  // the host on Dhaka Sound Collective's team gets a personal sales link on upcoming events
  const host = crowd[3]!;
  for (const ev of events) {
    if (ev.orgId === orgs[0]!.id && ev.status === 'published' && new Date(ev.endsAt).getTime() > now) {
      ev.trackingLinks.push({ id: id('tl'), slug: `host-${host.username}`, kind: 'host', hostUserId: host.id, visits: 40 + Math.floor(r() * 200), createdAt: iso(new Date(now - 30 * 86400e3)) });
    }
  }

  // ---- orders & tickets ----
  const orders: Order[] = [];
  const tickets: Ticket[] = [];
  let orderNo = 41000;
  const kickbackLinks: DB['kickbackLinks'] = [];

  for (const ev of events) {
    if (ev.status !== 'published') continue;
    const spec = EVENTS[events.indexOf(ev)]!;
    const started = new Date(ev.startsAt).getTime();
    const past = started < now;
    let views = 0;
    ev.ticketTypes.forEach((tt, ti) => {
      if (tt.inPersonOnly || tt.password || tt.hidden) {
        if (tt.hidden || tt.password) tt.sold = Math.floor((tt.quantity ?? 0) * (spec.tiers[ti]!.soldPct ?? 0));
        return;
      }
      const target = tt.quantity === null ? 50 : Math.floor(tt.quantity * (spec.tiers[ti]!.soldPct ?? 0));
      // Simulate a manageable number of orders; scale ticket counts so totals stay exact.
      let remaining = target;
      for (let k = 0; remaining > 0; k++) {
        const buyer = crowd[(k * 7 + ti * 3 + events.indexOf(ev)) % crowd.length]!;
        const qty = Math.min(remaining, ev.rsvpOnly ? 1 : 1 + Math.floor(r() * 3));
        remaining -= qty;
        const createdAt = new Date(Math.min(now - 3600e3, started - 1 * 86400e3) - Math.floor(r() * 26) * 86400e3 - Math.floor(r() * 86400e3));
        const unitFee = serviceFee(tt.price);
        const o: Order = {
          id: id('ord'),
          number: `BP-${orderNo++}`,
          eventId: ev.id,
          userId: buyer.id,
          buyer: { name: buyer.name, phone: buyer.phone },
          items: [{ ticketTypeId: tt.id, name: tt.name, qty, unitPrice: tt.price, unitFee }],
          subtotal: tt.price * qty,
          fees: unitFee * qty,
          discount: 0,
          total: (tt.price + unitFee) * qty,
          kickbackCommission: 0,
          status: tt.requireApproval && k % 5 === 0 && !past ? 'pending_approval' : 'paid',
          paymentMethod: tt.price === 0 ? 'free' : pick(['bkash', 'bkash', 'nagad', 'card'] as const),
          paymentRef: `TX${Math.floor(r() * 1e9)}`,
          source: 'online',
          trackingSlug: (() => {
            const x = r();
            const hostLink = ev.trackingLinks.find((t) => t.kind === 'host');
            if (hostLink && x < 0.12) return hostLink.slug;
            return x < 0.4 ? pick(['instagram', 'facebook-ads']) : undefined;
          })(),
          createdAt: iso(createdAt),
          paidAt: iso(createdAt),
        };
        orders.push(o);
        tt.sold += qty;
        views += qty * (3 + Math.floor(r() * 6));
        if (o.status !== 'paid') continue;
        for (let q = 0; q < qty; q++) {
          tickets.push({
            id: id('tk'),
            code: code(),
            orderId: o.id,
            eventId: ev.id,
            ticketTypeId: tt.id,
            ownerId: buyer.id,
            qrNonce: uuid(),
            status: past && r() < 0.85 ? 'checked_in' : 'valid',
            isComp: false,
            checkedInAt: past ? iso(new Date(started + Math.floor(r() * 3) * 3600e3)) : undefined,
            revokedNonces: [],
            createdAt: o.createdAt,
          });
        }
      }
    });
    ev.pageViews = views + Math.floor(r() * 400);
    // promoter links for events with public kickbacks
    const offer = ev.kickbackOffers[0];
    if (offer) {
      for (let k = 0; k < 4; k++) {
        const u = crowd[(k * 11 + events.indexOf(ev)) % crowd.length]!;
        const c = `${u.username.slice(0, 6).toUpperCase()}${Math.floor(r() * 90 + 10)}`;
        kickbackLinks.push({ code: c, eventId: ev.id, offerId: offer.id, userId: u.id, visits: 20 + Math.floor(r() * 300), createdAt: iso(new Date(now - 12 * 86400e3)) });
        // attribute a few existing orders to the link
        orders
          .filter((o) => o.eventId === ev.id && o.status === 'paid' && !o.kickbackCode && o.userId !== u.id && o.total > 0)
          .slice(k * 2, k * 2 + 2 + Math.floor(r() * 3))
          .forEach((o) => {
            o.kickbackCode = c;
            o.kickbackCommission = offer.kind === 'percent' ? Math.round((o.subtotal * offer.value) / 100) : offer.per === 'ticket' ? offer.value * o.items.reduce((a, i) => a + i.qty, 0) : offer.value;
          });
      }
    }
  }

  // demo attendee: tickets to a few upcoming events (so "My tickets" isn't empty)
  const giveDemo = (ev: BpopEvent, tierIdx: number, qty: number, method: Order['paymentMethod']) => {
    const tt = ev.ticketTypes[tierIdx]!;
    const unitFee = serviceFee(tt.price);
    const createdAt = iso(new Date(now - 2 * 86400e3));
    const o: Order = {
      id: id('ord'), number: `BP-${orderNo++}`, eventId: ev.id, userId: attendee.id, buyer: { name: attendee.name, phone: attendee.phone },
      items: [{ ticketTypeId: tt.id, name: tt.name, qty, unitPrice: tt.price, unitFee }], subtotal: tt.price * qty, fees: unitFee * qty, discount: 0,
      total: (tt.price + unitFee) * qty, kickbackCommission: 0, status: 'paid', paymentMethod: method, paymentRef: 'TXDEMO', source: 'online', createdAt, paidAt: createdAt,
    };
    orders.push(o);
    tt.sold += qty;
    for (let q = 0; q < qty; q++) tickets.push({ id: id('tk'), code: code(), orderId: o.id, eventId: ev.id, ticketTypeId: tt.id, ownerId: attendee.id, qrNonce: uuid(), status: 'valid', isComp: false, revokedNonces: [], createdAt });
  };
  giveDemo(events[0]!, 1, 2, 'bkash');
  giveDemo(events[1]!, 0, 1, 'free');
  giveDemo(events[21]!, 0, 1, 'nagad');

  // a few people waiting on sold-out tiers
  const waitlist: DB['waitlist'] = [];
  for (const ev of events) {
    for (const tt of ev.ticketTypes) {
      if (!tt.waitlistEnabled || new Date(ev.endsAt).getTime() < now) continue;
      if (tt.quantity !== null && tt.sold >= tt.quantity) {
        for (let k = 0; k < 3 + Math.floor(r() * 5); k++) {
          waitlist.push({ id: id('wl'), eventId: ev.id, ticketTypeId: tt.id, userId: crowd[(k * 5 + 9) % crowd.length]!.id, qty: 1 + Math.floor(r() * 2), status: 'waiting', createdAt: iso(new Date(now - (10 - k) * 3600e3)) });
        }
      }
    }
  }

  // event chat
  const chatLines = ['Who else is going? 🙌', 'Is there parking nearby?', 'Doors open at 9 right?', 'Last one was insane, can’t wait', 'Anyone coming from Uttara? Let’s share an Uber', 'Dress code?', 'See you all there!', 'Bringing 3 friends 🔥'];
  const messages: DB['messages'] = [];
  for (const ev of events.slice(0, 12)) {
    const holders = tickets.filter((t) => t.eventId === ev.id).map((t) => t.ownerId);
    for (let k = 0; k < Math.min(5, holders.length); k++) {
      messages.push({ id: id('msg'), eventId: ev.id, userId: holders[(k * 3) % holders.length]!, body: chatLines[(k + events.indexOf(ev)) % chatLines.length]!, createdAt: iso(new Date(now - (6 - k) * 3600e3)) });
    }
  }

  const payouts: DB['payouts'] = [
    { id: id('po'), orgId: orgs[0]!.id, amount: 185000, fee: 0, instant: false, methodLabel: orgs[0]!.payoutMethods[0]!.label, status: 'paid', createdAt: iso(new Date(now - 14 * 86400e3)) },
    { id: id('po'), orgId: orgs[0]!.id, amount: 42000, fee: 630, instant: true, methodLabel: orgs[0]!.payoutMethods[0]!.label, status: 'paid', createdAt: iso(new Date(now - 4 * 86400e3)) },
  ];

  const notifications: DB['notifications'] = [
    { id: id('nt'), userId: attendee.id, kind: 'order', title: 'You’re going to NEON MONSOON 🎉', body: 'Your 2 tickets are in My tickets.', link: '/tickets', read: false, createdAt: iso(new Date(now - 2 * 86400e3)) },
    { id: id('nt'), userId: attendee.id, kind: 'follow', title: 'Rooftop Sessions posted a new event', body: 'Rooftop Sessions Vol. 19 — Ghazal Night', link: `/e/${events[21]!.slug}`, read: false, createdAt: iso(new Date(now - 26 * 3600e3)) },
  ];

  return {
    version: DB_VERSION,
    seededAt: iso(new Date(now)),
    users,
    orgs,
    events,
    orders,
    tickets,
    waitlist,
    kickbackLinks,
    messages,
    smsBlasts: [{ id: id('sms'), orgId: orgs[0]!.id, audience: 'followers', body: 'NEON MONSOON is 70% sold — last GA tickets at bpop.tags/e/neon-monsoon-warehouse-rave', recipients: 312, createdAt: iso(new Date(now - 3 * 86400e3)) }],
    payouts,
    notifications,
    outbox: [],
    otps: {},
  };
}
