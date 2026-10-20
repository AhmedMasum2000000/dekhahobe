# REA: Reverse-Engineering Teardown of Posh → Bpop Tags

Method: **Observe → Decompose → Model → Rules → Rebuild → Verify**. Sources: Posh's public web pages
(`/`, `/explore`, `/platform`, `/e/:slug`, `/g/:slug`) and the public knowledge base (support.posh.vip),
read on 2026-10-20. Only **structure, flows and behaviour** are reproduced. Posh's logo, photography,
illustrations and marketing copy are **not** copied. Bpop Tags uses original branding, generated poster
art and Bangladeshi sample data.

## 1. Surfaces (observed)
| Surface | Observed structure | Bpop Tags route |
|---|---|---|
| Marketing home | Nav (Home · Events · Platform · Help · Login · Create event) → hero headline + 3-row poster marquee → live "featured event" card (title, time/location, N going, View event / View all) → app screenshots + 3 value props → testimonial + 4.9★ + store badges → "Driving culture & community" organizer spotlight + partner-name marquee → organizer pitch with earnings posters (Create / Earn / Scale) → organizer quote with stats → editorial cards → 2 CTA tiles (Host an event / Explore events) → "See you soon" footer with legal links | `/` |
| Explore | "Discover Events" → **Featured events** carousel (count, org, title, "From price at venue", date range, lineup chips, +N avatars) → **Trending events** grid with **Location / Date / Price** filters; cards show org + verified check, "More dates" badge, title, "Free / ৳X at Venue", date range | `/explore` |
| Event page | Flyer hero → title, venue, date/time (tz) → organizer chip (+verified) → tagline → **Kickback banner** ("invite friends, earn X% on the total order") → "**Name and N others going** · View Guestlist" avatars → **series date chips** + More Dates → About (View more) → **Event features** (lineup with images) → map + Location → Hosted by card (N events, socials, Contact, Follow) → get-the-app box → sticky footer "**Buy tickets from ৳X**" / "This event has ended" / "This is a draft event" | `/e/:slug` |
| Organizer profile | Banner, avatar, name + verified, @handle, "N events • N attendees", socials, Follow, bio "...more", links, **Upcoming events**, **Past events** | `/g/:slug` |
| Series | List of all dates for a recurring event | `/series/:id` |
| Platform | Hero (Get started / Book a demo), stats, logo wall, dashboard screenshot, 01 Create (personalize page, in-person payments, instant payouts) · 02 Earn (marketplace feeds, kickbacks, free SMS blasts) · 03 Scale (AI, insights, community), testimonials by category tabs | `/platform` |

## 2. Organizer dashboard (from the knowledge base)
Per-event tabs: **Overview · Tickets · Orders · Attendees · Marketing · Team & Tracking · Door**.
Org level: **Overview, Events, Insights (+Ask AI), SMS campaigns, Finance (balance/payouts), Settings (profile, team, scanner PINs)**.

## 3. Domain model (derived)
`User, Organization(team roles: owner/admin/host/doorperson, scannerPins), Event(series, status, visibility),
TicketType, TicketGroup, PromoCode, KickbackOffer, KickbackLink, TrackingLink, Order, Ticket, WaitlistEntry,
GuestListEntry, Message, SmsBlast, Payout, Notification` (see `src/api/types.ts`).

## 4. Business rules reproduced
**Ticket tiers:** name, description, quantity (blank = unlimited), group; *advanced*: sales period, min/max per
order, **In-person only** (visible, no online checkout), **Allow transfers**, **Mark as sold out**, **Password
protected** (page shows "This event has hidden tickets" when all locked; password ⇒ hide disabled), **Hide**,
**Require approval** (whole cart goes to Pending orders), **Waitlist** (response minutes, max per user).
**Pricing:** base price + service fee = display price ("upfront pricing"), shown live in the tier editor.
**RSVP-only:** one RSVP per account; free ৳0 tier for multiple.
**Promo codes:** % or ৳, usage limit per order, ticket-type restriction, active toggle, auto-apply link `?promo=`.
**Comps:** issue N tickets of a tier to a phone/email; cancel ⇒ QR invalid; comps are not transferable.
**Private guest list:** name + plus-ones, check in/out at the door, not exported as attendees.
**Kickbacks:** % or flat, per ticket or per order, tier restriction; **one active public offer per event**;
public = any buyer gets a personal link (+ optional checkout banner); private = invited affiliates only;
tracking links ≠ kickback links (no commission); host links tracked under Host sales.
**Waitlist:** "Join waitlist" only when a waitlist-enabled tier is sold out through purchases (not "mark sold
out"); queue in signup order; offer with timed window; expiry passes to next; organizer "Release N tickets"
offers only to the current waitlist; attendees can **return** tickets to the waitlist pool; works until the event ends.
**Transfers:** to a phone number; pending until the recipient accepts; sender can cancel while pending; the original QR
shows **Canceled** after transfer; transferred tickets are non-refundable; disabled per tier; comps not transferable.
**Door:** Scanner PIN (no login, shared, revocable) or Doorperson role; scan result OK / already scanned / canceled / invalid; guest list tab at the door; **in-person payments** (cash, bKash).
**Refunds:** organizer refunds orders; attendee requests refunds; event cancel ⇒ refund all.
**Finance:** balance from paid orders minus fees and kickbacks; standard payout or **Instant payout** (fee).

## 5. Bangladesh localisation
৳ BDT, Asia/Dhaka time, +880 phone OTP login, bKash / Nagad / card checkout (simulated), cities: Dhaka,
Chattogram, Sylhet, Cox's Bazar, Rajshahi, Khulna.

## 6. Verification
Each rule above is covered by the Playwright flow script in `scripts/e2e.mjs`.
