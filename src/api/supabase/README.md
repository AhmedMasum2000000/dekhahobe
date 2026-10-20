# Plugging in the real backend

The whole UI talks to one interface, `ApiClient` in `src/api/types.ts`. Today `src/api/local/adapter.ts`
implements it in the browser. To go live:

1. Create a Supabase project and run `supabase/migrations/0001_init.sql`
   (`scripts/test-sql.sh` shows it applying cleanly and exercises the core functions).
2. Implement `supabaseAdapter` in `src/api/supabase/adapter.ts` with `@supabase/supabase-js`.
   Map each method to a table query or RPC:

   | ApiClient method | Supabase |
   |---|---|
   | `sendOtp` / `verifyOtp` | `auth.signInWithOtp({ phone })` / `auth.verifyOtp({ phone, token, type: 'sms' })` — use the *Send SMS* auth hook with a Bangladeshi SMS gateway |
   | `explore`, `getEventBySlug`, `getOrg` | `events` / `organizations` selects; `nearby_events` RPC for geo |
   | `startCheckout` | Edge Function: `reserve_seats` per line, insert `orders` + `order_items`, start an SSLCommerz / bKash session |
   | `payOrder` | Not called by the client in production — the payment webhook validates with the gateway, then calls `fulfill_order` |
   | `scanTicket` | `check_in` RPC |
   | `acceptTransfer` | `accept_transfer` RPC |
   | `joinWaitlist`, `releaseToWaitlist` | `waitlist` insert / `release_seats` + `process_waitlist` |
   | `listMessages`, `sendMessage` | `messages` + Realtime channel `postgres_changes` |
   | `requestPayout` | Edge Function calling bKash / Nagad disbursement or your bank's API |

3. Build with `VITE_API_MODE=supabase` (plus `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`).

Rules that move money or inventory (`reserve_seats`, `fulfill_order`, `check_in`, `accept_transfer`,
`housekeeping`) are `SECURITY DEFINER` functions, so a modified client can't bypass them.
