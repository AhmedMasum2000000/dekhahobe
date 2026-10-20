-- Bpop Tags — production schema for the Supabase adapter.
-- Mirrors src/api/types.ts. The browser demo (LocalAdapter) implements the same rules in TypeScript;
-- here the money- and inventory-critical rules live in SECURITY DEFINER functions so clients can't bypass them.

create extension if not exists postgis;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------- people & organizations
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '',
  username text unique not null check (username ~ '^[a-z0-9_.]{3,20}$'),
  phone text unique,
  email text,
  bio text,
  avatar_url text,
  city text not null default 'Dhaka',
  sms_opt_in boolean not null default true,
  private_profile boolean not null default false,
  created_at timestamptz not null default now()
);

create table organizations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  bio text not null default '',
  avatar_url text,
  city text not null default 'Dhaka',
  instagram text,
  website text,
  contact_email text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create type team_role as enum ('owner', 'admin', 'host', 'doorperson');
create table team_members (
  org_id uuid references organizations on delete cascade,
  user_id uuid references profiles on delete cascade,
  role team_role not null,
  added_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table scanner_pins (
  pin char(6) primary key,
  org_id uuid not null references organizations on delete cascade,
  secret text not null,
  label text not null default 'Door',
  created_at timestamptz not null default now()
);

create table payout_methods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  kind text not null check (kind in ('bkash', 'nagad', 'bank')),
  label text not null,
  is_primary boolean not null default false
);

create table follows_org (follower_id uuid references profiles on delete cascade, org_id uuid references organizations on delete cascade, primary key (follower_id, org_id));
create table follows_user (follower_id uuid references profiles on delete cascade, following_id uuid references profiles on delete cascade, primary key (follower_id, following_id));
create table blocks (blocker_id uuid references profiles on delete cascade, blocked_id uuid references profiles on delete cascade, primary key (blocker_id, blocked_id));
create table saved_events (user_id uuid references profiles on delete cascade, event_id uuid, primary key (user_id, event_id));

-- ---------------------------------------------------------------- events & tickets
create table events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  org_id uuid not null references organizations on delete cascade,
  series_id uuid,
  title text not null,
  tagline text,
  description text not null default '',
  category text not null,
  venue_name text not null,
  venue_address text not null,
  city text not null,
  location geography(point),
  reveal_location_later boolean not null default false,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  poster jsonb not null,
  lineup jsonb not null default '[]',
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  visibility text not null default 'public' check (visibility in ('public', 'unlisted')),
  rsvp_only boolean not null default false,
  age_limit text,
  featured boolean not null default false,
  sponsored boolean not null default false,
  show_guestlist boolean not null default true,
  chat_enabled boolean not null default true,
  page_views int not null default 0,
  created_at timestamptz not null default now()
);
create index on events using gist (location);
create index on events (status, starts_at);

create table ticket_groups (id uuid primary key default gen_random_uuid(), event_id uuid not null references events on delete cascade, name text not null, sort int not null default 0, hidden boolean not null default false);

create table ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  group_id uuid references ticket_groups on delete set null,
  name text not null,
  description text,
  price numeric(10, 2) not null default 0 check (price >= 0),        -- what the organizer earns
  quantity int check (quantity is null or quantity >= 1),            -- null = unlimited
  sold int not null default 0,                                       -- includes held seats
  held_for_waitlist int not null default 0,
  min_per_order int not null default 1,
  max_per_order int,
  sales_start timestamptz,
  sales_end timestamptz,
  hidden boolean not null default false,
  password text,
  in_person_only boolean not null default false,
  allow_transfers boolean not null default true,
  marked_sold_out boolean not null default false,
  require_approval boolean not null default false,
  waitlist_enabled boolean not null default false,
  waitlist_response_mins int not null default 30,
  waitlist_max_per_user int,
  sort int not null default 0,
  check (quantity is null or sold + held_for_waitlist <= quantity)
);

create table promo_codes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  code text not null,
  kind text not null check (kind in ('percent', 'flat')),
  value numeric(10, 2) not null,
  usage_limit int,
  uses int not null default 0,
  ticket_type_ids uuid[],
  active boolean not null default true,
  unique (event_id, code)
);

create table kickback_offers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  kind text not null check (kind in ('percent', 'flat')),
  value numeric(10, 2) not null,
  per text not null check (per in ('order', 'ticket')),
  ticket_type_ids uuid[],
  is_public boolean not null,
  show_banner boolean not null default true,
  enabled boolean not null default true
);
-- one active public offer per event
create unique index one_public_offer on kickback_offers (event_id) where is_public and enabled;
create table kickback_affiliates (offer_id uuid references kickback_offers on delete cascade, user_id uuid references profiles on delete cascade, primary key (offer_id, user_id));
create table kickback_links (code text primary key, event_id uuid not null references events on delete cascade, offer_id uuid not null references kickback_offers, user_id uuid not null references profiles, visits int not null default 0, unique (event_id, user_id));

create table tracking_links (id uuid primary key default gen_random_uuid(), event_id uuid not null references events on delete cascade, slug text not null, kind text not null default 'tracking' check (kind in ('tracking', 'host')), host_user_id uuid references profiles, visits int not null default 0, unique (event_id, slug));

create table guest_list (id uuid primary key default gen_random_uuid(), event_id uuid not null references events on delete cascade, name text not null, plus int not null default 0, checked_in_at timestamptz);

create sequence order_number_seq start 50000;
create table orders (
  id uuid primary key default gen_random_uuid(),
  number text unique not null default ('BP-' || nextval('order_number_seq')),
  event_id uuid not null references events,
  user_id uuid not null references profiles,
  buyer_name text not null,
  buyer_phone text not null,
  buyer_email text,
  subtotal numeric(10, 2) not null,
  fees numeric(10, 2) not null,
  discount numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  promo_code text,
  kickback_code text references kickback_links,
  kickback_commission numeric(10, 2) not null default 0,
  tracking_slug text,
  host_user_id uuid references profiles,
  status text not null check (status in ('pending_payment', 'pending_approval', 'paid', 'refunded', 'cancelled', 'expired', 'declined')),
  payment_method text,
  payment_ref text,          -- SSLCommerz val_id / bKash trxID
  source text not null default 'online' check (source in ('online', 'door', 'comp', 'waitlist', 'transfer')),
  hold_expires_at timestamptz,
  refund_requested boolean not null default false,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create table order_items (order_id uuid references orders on delete cascade, ticket_type_id uuid references ticket_types, name text not null, qty int not null check (qty > 0), unit_price numeric(10, 2) not null, unit_fee numeric(10, 2) not null, primary key (order_id, ticket_type_id));

create table tickets (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  order_id uuid not null references orders,
  event_id uuid not null references events,
  ticket_type_id uuid not null references ticket_types,
  owner_id uuid not null references profiles,
  qr_nonce uuid not null default gen_random_uuid(),
  revoked_nonces uuid[] not null default '{}',   -- old QRs after a transfer scan as "Canceled"
  status text not null default 'valid' check (status in ('valid', 'checked_in', 'cancelled', 'refunded')),
  is_comp boolean not null default false,
  transfer_to_phone text,
  transfer_created_at timestamptz,
  checked_in_at timestamptz,
  checked_in_by text,
  created_at timestamptz not null default now()
);
create index on tickets (event_id, status);

create table waitlist (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  ticket_type_id uuid not null references ticket_types on delete cascade,
  user_id uuid not null references profiles,
  qty int not null check (qty > 0),
  status text not null default 'waiting' check (status in ('waiting', 'offered', 'claimed', 'expired', 'left')),
  offer_expires_at timestamptz,
  order_id uuid references orders,
  created_at timestamptz not null default now()
);

create table messages (id bigint generated always as identity primary key, event_id uuid not null references events on delete cascade, user_id uuid not null references profiles, body text not null check (length(body) between 1 and 1000), created_at timestamptz not null default now());
create table sms_blasts (id uuid primary key default gen_random_uuid(), org_id uuid not null references organizations, event_id uuid references events, audience text not null, body text not null check (length(body) <= 320), recipients int not null, created_at timestamptz not null default now());
create table payouts (id uuid primary key default gen_random_uuid(), org_id uuid not null references organizations, amount numeric(12, 2) not null, fee numeric(10, 2) not null default 0, instant boolean not null, method_label text not null, status text not null default 'processing', created_at timestamptz not null default now());
create table notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles on delete cascade, kind text not null, title text not null, body text not null, link text, read boolean not null default false, created_at timestamptz not null default now());

-- ---------------------------------------------------------------- helpers
create or replace function team_role_for(p_org uuid) returns team_role language sql stable security definer as $$
  select role from team_members where org_id = p_org and user_id = auth.uid();
$$;

create or replace function service_fee(p_price numeric) returns numeric language sql immutable as $$
  select case when p_price <= 0 then 0 else round(p_price * 0.07 + 15) end;
$$;

-- ---------------------------------------------------------------- RLS
alter table profiles enable row level security;
create policy "profiles readable" on profiles for select using (true);
create policy "own profile" on profiles for update using (id = auth.uid());

alter table organizations enable row level security;
create policy "orgs readable" on organizations for select using (true);
create policy "managers update org" on organizations for update using (team_role_for(id) in ('owner', 'admin'));

alter table events enable row level security;
create policy "published events readable" on events for select using (status <> 'draft' or team_role_for(org_id) is not null);
create policy "managers write events" on events for all using (team_role_for(org_id) in ('owner', 'admin'));

alter table ticket_types enable row level security;
create policy "visible tiers" on ticket_types for select using (
  (not hidden and password is null) or team_role_for((select org_id from events e where e.id = event_id)) is not null);
create policy "managers write tiers" on ticket_types for all using (team_role_for((select org_id from events e where e.id = event_id)) in ('owner', 'admin'));

alter table orders enable row level security;
create policy "buyer or team reads orders" on orders for select using (user_id = auth.uid() or team_role_for((select org_id from events e where e.id = event_id)) in ('owner', 'admin', 'host'));

alter table tickets enable row level security;
create policy "owner or team reads tickets" on tickets for select using (owner_id = auth.uid() or transfer_to_phone = (select phone from profiles where id = auth.uid()) or team_role_for((select org_id from events e where e.id = event_id)) is not null);

alter table messages enable row level security;
create policy "holders read chat" on messages for select using (exists (select 1 from tickets t where t.event_id = messages.event_id and t.owner_id = auth.uid() and t.status in ('valid', 'checked_in')));
create policy "holders post chat" on messages for insert with check (user_id = auth.uid() and exists (select 1 from tickets t where t.event_id = messages.event_id and t.owner_id = auth.uid() and t.status in ('valid', 'checked_in')));
alter publication supabase_realtime add table messages;

alter table notifications enable row level security;
create policy "own notifications" on notifications for all using (user_id = auth.uid());
-- orders, tickets, waitlist and payouts are only written through the functions below.

-- ---------------------------------------------------------------- inventory & checkout
create or replace function reserve_seats(p_tier uuid, p_qty int) returns boolean language plpgsql security definer as $$
begin
  update ticket_types set sold = sold + p_qty
  where id = p_tier and not marked_sold_out and not in_person_only
    and (quantity is null or sold + held_for_waitlist + p_qty <= quantity)
    and p_qty >= min_per_order and (max_per_order is null or p_qty <= max_per_order)
    and (sales_start is null or now() >= sales_start)
    and (sales_end is null or now() < sales_end);
  return found;
end $$;

-- release seats: waitlist gets first dibs (see LocalAdapter.releaseSeats)
create or replace function release_seats(p_tier uuid, p_qty int) returns void language plpgsql security definer as $$
declare waiting int;
begin
  select count(*) into waiting from waitlist where ticket_type_id = p_tier and status = 'waiting';
  update ticket_types set sold = greatest(0, sold - p_qty),
    held_for_waitlist = held_for_waitlist + case when waitlist_enabled and waiting > 0 then p_qty else 0 end
  where id = p_tier;
  perform process_waitlist(p_tier);
end $$;

create or replace function process_waitlist(p_tier uuid) returns void language plpgsql security definer as $$
declare tt ticket_types; offered int; free int; w waitlist;
begin
  select * into tt from ticket_types where id = p_tier for update;
  if tt.held_for_waitlist <= 0 then return; end if;
  select coalesce(sum(qty), 0) into offered from waitlist where ticket_type_id = p_tier and status = 'offered';
  free := tt.held_for_waitlist - offered;
  for w in select * from waitlist where ticket_type_id = p_tier and status = 'waiting' order by created_at loop
    exit when free <= 0;
    update waitlist set status = 'offered', qty = least(w.qty, free), offer_expires_at = now() + make_interval(mins => tt.waitlist_response_mins) where id = w.id;
    insert into notifications (user_id, kind, title, body, link) values (w.user_id, 'waitlist', 'A ticket opened up for you', 'Claim it before the offer expires.', '/tickets?tab=waitlist');
    free := free - least(w.qty, free);
  end loop;
  if free > 0 and not exists (select 1 from waitlist where ticket_type_id = p_tier and status = 'waiting') then
    update ticket_types set held_for_waitlist = held_for_waitlist - free where id = p_tier;
  end if;
end $$;

-- called by the payment webhook (SSLCommerz IPN / bKash callback) after server-side validation
create or replace function fulfill_order(p_order uuid, p_method text, p_ref text) returns void language plpgsql security definer as $$
declare o orders; link kickback_links; off kickback_offers; elig numeric; elig_qty int; i order_items;
begin
  update orders set status = case when exists (select 1 from order_items oi join ticket_types t on t.id = oi.ticket_type_id where oi.order_id = p_order and t.require_approval) then 'pending_approval' else 'paid' end,
    payment_method = p_method, payment_ref = p_ref, paid_at = now(), hold_expires_at = null
  where id = p_order and status = 'pending_payment' returning * into o;
  if not found or o.status <> 'paid' then return; end if;
  update promo_codes set uses = uses + 1 where event_id = o.event_id and code = o.promo_code;
  if o.kickback_code is not null then
    select * into link from kickback_links where code = o.kickback_code;
    select * into off from kickback_offers where id = link.offer_id and enabled;
    if found and link.user_id <> o.user_id then
      select coalesce(sum(unit_price * qty), 0), coalesce(sum(qty), 0) into elig, elig_qty from order_items where order_id = o.id and (off.ticket_type_ids is null or ticket_type_id = any (off.ticket_type_ids));
      update orders set kickback_commission = case when elig_qty = 0 then 0 when off.kind = 'percent' then round(elig * off.value / 100) when off.per = 'ticket' then off.value * elig_qty else off.value end where id = o.id;
    end if;
  end if;
  update waitlist set status = 'claimed' where order_id = o.id;
  for i in select * from order_items where order_id = o.id loop
    insert into tickets (code, order_id, event_id, ticket_type_id, owner_id)
    select upper(substr(md5(random()::text), 1, 4) || '-' || substr(md5(random()::text), 1, 4)), o.id, o.event_id, i.ticket_type_id, o.user_id from generate_series(1, i.qty);
  end loop;
end $$;

-- expire 15-minute holds and waitlist offers every minute
create or replace function housekeeping() returns void language plpgsql security definer as $$
declare o orders; i order_items; w waitlist;
begin
  for o in update orders set status = 'expired' where status = 'pending_payment' and hold_expires_at < now() returning * loop
    for i in select * from order_items where order_id = o.id loop
      if o.source = 'waitlist' then
        update ticket_types set sold = sold - i.qty, held_for_waitlist = held_for_waitlist + i.qty where id = i.ticket_type_id;
        update waitlist set status = 'expired' where order_id = o.id;
        perform process_waitlist(i.ticket_type_id);
      else
        perform release_seats(i.ticket_type_id, i.qty);
      end if;
    end loop;
  end loop;
  for w in update waitlist set status = 'expired' where status = 'offered' and offer_expires_at < now() returning * loop
    perform process_waitlist(w.ticket_type_id);
  end loop;
end $$;
select cron.schedule('bpop-housekeeping', '* * * * *', 'select housekeeping()');

-- ---------------------------------------------------------------- door
create or replace function check_in(p_event uuid, p_payload text, p_by text) returns text language plpgsql security definer as $$
declare t tickets; tid uuid; n uuid;
begin
  if team_role_for((select org_id from events where id = p_event)) is null then return 'not_allowed'; end if;
  if p_payload ~* '^BPOP:[0-9a-f-]{36}:[0-9a-f-]{36}$' then
    tid := split_part(p_payload, ':', 2)::uuid; n := split_part(p_payload, ':', 3)::uuid;
    select * into t from tickets where id = tid;
  else
    select * into t from tickets where replace(code, '-', '') = upper(regexp_replace(p_payload, '[^A-Za-z0-9]', '', 'g'));
  end if;
  if not found then return 'invalid'; end if;
  if t.event_id <> p_event then return 'wrong_event'; end if;
  if n is not null and n = any (t.revoked_nonces) then return 'cancelled'; end if;
  if n is not null and n <> t.qr_nonce then return 'invalid'; end if;
  if t.status in ('cancelled', 'refunded') then return 'cancelled'; end if;
  if t.status = 'checked_in' then return 'already'; end if;
  update tickets set status = 'checked_in', checked_in_at = now(), checked_in_by = p_by, transfer_to_phone = null where id = t.id;
  return 'ok';
end $$;

-- ---------------------------------------------------------------- transfers
create or replace function accept_transfer(p_ticket uuid) returns void language plpgsql security definer as $$
declare me profiles; t tickets; o uuid;
begin
  select * into me from profiles where id = auth.uid();
  select * into t from tickets where id = p_ticket and transfer_to_phone = me.phone and status = 'valid' for update;
  if not found then raise exception 'This transfer isn''t for you.'; end if;
  insert into orders (event_id, user_id, buyer_name, buyer_phone, subtotal, fees, total, status, payment_method, source, paid_at)
  values (t.event_id, me.id, me.name, me.phone, 0, 0, 0, 'paid', 'free', 'transfer', now()) returning id into o;
  insert into order_items select o, t.ticket_type_id, name, 1, 0, 0 from ticket_types where id = t.ticket_type_id;
  update tickets set owner_id = me.id, order_id = o, revoked_nonces = revoked_nonces || qr_nonce, qr_nonce = gen_random_uuid(), transfer_to_phone = null, transfer_created_at = null where id = t.id;
end $$;

-- ---------------------------------------------------------------- discovery
create or replace function nearby_events(lat float, lng float, radius_km int default 25) returns setof events language sql stable as $$
  select * from events
  where status = 'published' and visibility = 'public' and ends_at > now()
    and st_dwithin(location, st_makepoint(lng, lat)::geography, radius_km * 1000)
  order by starts_at limit 100;
$$;
