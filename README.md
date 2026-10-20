# Bpop Tags

A social event-discovery and ticketing platform for Bangladesh — discover events, buy tickets with
bKash / Nagad / card, transfer tickets, join waitlists, earn Kickbacks, and run events end to end from an
organizer dashboard with a door scanner.

Bpop Tags follows the page structure, user flows and feature set of Posh (see
[`docs/REA-teardown.md`](docs/REA-teardown.md) for the reverse-engineering notes). It uses **original**
branding, generated poster art and fictional Bangladeshi sample data — no Posh logos, photos or copy.

> **Demo build.** Everything runs in your browser: data is stored in `localStorage`, payments and SMS are
> simulated, nothing is charged. The code is structured so a real backend drops in later
> ([`src/api/supabase/README.md`](src/api/supabase/README.md)).

## Try it

| Account | Phone | What to try |
|---|---|---|
| Attendee — Nusrat | `01811000002` | Buy tickets, transfer, join a waitlist, get a Kickback link |
| Organizer — Rafi | `01711000001` | Dashboard for *Dhaka Sound Collective* and *Laugh Lab BD* |
| Door staff | PIN `482913` at `/scanner` | Scan tickets for Dhaka Sound Collective without logging in |

The login code (and every bKash / Nagad / card verification code) appears as an on-screen SMS.
Any 4–5 digit wallet PIN works; test card `4242 4242 4242 4242`, any future expiry, any CVC.
Settings → *Reset demo data* restores the sample events.

## Features

**Attendees** — Explore feed (featured carousel, trending, Location / Date / Price filters, categories,
search) · event pages with lineup, who's going + guest list, series dates, map, share, add to calendar ·
ticket sheet with tiers, groups, promo codes, password-protected tiers, waitlists · checkout with a 15-minute
seat hold and simulated bKash / Nagad / card · QR tickets · transfers (old QR becomes "Canceled") ·
refund requests · return-to-waitlist · Kickback links and earnings · event chat (live across tabs) ·
follow organizers and friends · saved events · notifications · privacy & blocking · phone OTP login.

**Organizers** — create-event wizard (flyer generator or upload, lineup, tiers, RSVP-only) · tier settings
(all-in price calculator, sales window, min/max, in-person only, transfers, mark sold out, password, hidden,
require approval, waitlist with release) · ticket groups · promo codes with share links · comps · private
guest list · orders (approve / decline / refund, CSV) · attendees (search, check-in, CSV) · Kickback offers
(one public offer per event, private affiliates) · tracking links and host sales · door scanner with PINs,
door sales (cash / bKash) · SMS blasts · insights + "Ask Bpop AI" over your own data · balance and instant
payouts · team roles (owner / admin / host / doorperson) · duplicate / cancel events.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run lint
npm run build
```

### Tests

```bash
npx esbuild scripts/smoke.ts --bundle --platform=node --format=esm --outfile=/tmp/smoke.mjs && node /tmp/smoke.mjs   # 47 business-rule checks
npm run build && npm run preview &   # then:
npm run e2e                          # 32 browser checks across every flow (Playwright + Chromium)
scripts/test-sql.sh                  # applies the Supabase migration to a local Postgres 16 and tests its functions
```

## Deploy

`.github/workflows/pages.yml` builds and deploys to GitHub Pages on every push. Enable it once in the
repository: **Settings → Pages → Source: GitHub Actions**. The app uses hash routing, so deep links work on
Pages without server config.

## Structure

```
src/api/types.ts            domain model + ApiClient contract
src/api/local/              browser adapter: db.ts (storage + cross-tab sync), seed.ts, adapter.ts (all rules)
src/api/supabase/           production adapter stub + guide
src/pages/                  attendee pages
src/pages/dashboard/        organizer dashboard
src/components/             UI kit, poster generator, cards, shell
supabase/migrations/        Postgres schema, RLS and RPCs for production
docs/REA-teardown.md        reverse-engineering notes
```
