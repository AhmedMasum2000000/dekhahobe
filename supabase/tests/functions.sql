\set ON_ERROR_STOP 1
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'), ('00000000-0000-0000-0000-00000000000c'), ('00000000-0000-0000-0000-00000000000d');
insert into profiles (id, name, username, phone) values
 ('00000000-0000-0000-0000-00000000000a', 'Rafi', 'rafi', '+8801711000001'),
 ('00000000-0000-0000-0000-00000000000b', 'Nusrat', 'nusrat', '+8801811000002'),
 ('00000000-0000-0000-0000-00000000000c', 'Tanvir', 'tanvir', '+8801911222333'),
 ('00000000-0000-0000-0000-00000000000d', 'Mim', 'mim', '+8801611222333');
insert into organizations (id, slug, name) values ('10000000-0000-0000-0000-000000000001', 'dsc', 'Dhaka Sound Collective');
insert into team_members values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'owner');
insert into events (id, slug, org_id, title, category, venue_name, venue_address, city, starts_at, ends_at, poster, status)
 values ('20000000-0000-0000-0000-000000000001', 'neon', '10000000-0000-0000-0000-000000000001', 'NEON', 'Nightlife', 'Warehouse', 'Tejgaon', 'Dhaka', now() + interval '3 days', now() + interval '3 days 7 hours', '{}', 'published');
insert into ticket_types (id, event_id, name, price, quantity, waitlist_enabled) values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'GA', 1800, 3, true);
insert into kickback_offers (id, event_id, kind, value, per, is_public) values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'percent', 5, 'order', true);
insert into kickback_links values ('NUSRAT26', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 0);
insert into promo_codes (event_id, code, kind, value) values ('20000000-0000-0000-0000-000000000001', 'MONSOON10', 'percent', 10);

-- reserve 2 then try 2 more (only 1 left)
select reserve_seats('30000000-0000-0000-0000-000000000001', 2) as r1, reserve_seats('30000000-0000-0000-0000-000000000001', 2) as r2_should_fail;
-- Mim's order through Nusrat's kickback link with a promo
insert into orders (id, event_id, user_id, buyer_name, buyer_phone, subtotal, fees, discount, total, promo_code, kickback_code, status, hold_expires_at)
 values ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'Mim', '+8801611222333', 3600, service_fee(1800) * 2, 360, 3600 + service_fee(1800) * 2 - 360, 'MONSOON10', 'NUSRAT26', 'pending_payment', now() + interval '15 min');
insert into order_items values ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'GA', 2, 1800, service_fee(1800));
select fulfill_order('50000000-0000-0000-0000-000000000001', 'bkash', 'TX1');
select status, kickback_commission, (select uses from promo_codes where code = 'MONSOON10') as promo_uses, (select count(*) from tickets where order_id = o.id) as tickets from orders o where id = '50000000-0000-0000-0000-000000000001';
do $$ begin assert (select kickback_commission from orders where id = '50000000-0000-0000-0000-000000000001') = 162, 'kickback is 5% of the discounted 3240'; end $$;
select fulfill_order('50000000-0000-0000-0000-000000000001', 'bkash', 'TX1') as idempotent_second_call;
select count(*) as still_two_tickets from tickets;

-- door scan as owner
set test.uid = '00000000-0000-0000-0000-00000000000a';
select check_in('20000000-0000-0000-0000-000000000001', 'BPOP:' || id || ':' || qr_nonce, 'door') as first_scan from tickets order by created_at, id limit 1;
select check_in('20000000-0000-0000-0000-000000000001', 'BPOP:' || id || ':' || qr_nonce, 'door') as second_scan from tickets order by created_at, id limit 1;
select check_in('20000000-0000-0000-0000-000000000001', 'ZZZZ-ZZZZ', 'door') as unknown_code;

-- transfer the unscanned ticket to Tanvir
update tickets set transfer_to_phone = '+8801911222333' where status = 'valid';
create temp table before as select id, qr_nonce, code from tickets where status = 'valid';
set test.uid = '00000000-0000-0000-0000-00000000000c';
select accept_transfer((select id from before));
select owner_id = '00000000-0000-0000-0000-00000000000c' as tanvir_owns, qr_nonce <> (select qr_nonce from before) as new_qr from tickets where id = (select id from before);
set test.uid = '00000000-0000-0000-0000-00000000000a';
select check_in('20000000-0000-0000-0000-000000000001', 'BPOP:' || id || ':' || qr_nonce, 'door') as old_qr from before;
do $$ begin
  assert (select code from tickets where id = (select id from before)) <> (select code from before), 'transfer rotates the printed code';
  assert check_in('20000000-0000-0000-0000-000000000001', (select code from before), 'door') = 'cancelled', 'old printed code scans as cancelled';
  assert (select origin_order_id from tickets where id = (select id from before)) = '50000000-0000-0000-0000-000000000001', 'origin order kept';
end $$;

-- hold expiry: Rafi holds the last seat, then it expires while Nusrat waits
insert into waitlist (event_id, ticket_type_id, user_id, qty) values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 1);
select reserve_seats('30000000-0000-0000-0000-000000000001', 1) as last_seat;
insert into orders (id, event_id, user_id, buyer_name, buyer_phone, subtotal, fees, total, status, hold_expires_at)
 values ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Rafi', '+8801711000001', 1800, service_fee(1800), 1800 + service_fee(1800), 'pending_payment', now() - interval '1 min');
insert into order_items values ('50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'GA', 1, 1800, service_fee(1800));
select housekeeping();
select status from orders where id = '50000000-0000-0000-0000-000000000002';
select sold, held_for_waitlist from ticket_types;
select status, offer_expires_at > now() as offer_live from waitlist;

-- ---------------------------------------------------------------- RLS & privileges (as the API role)
insert into team_members values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'admin');
grant usage on schema public to anon, authenticated;
set role authenticated;
set test.uid = '00000000-0000-0000-0000-00000000000b';   -- Nusrat, attendee
do $$ begin
  assert (select count(*) from promo_codes) = 0, 'attendees cannot read promo codes';
  assert (select count(*) from payout_methods) = 0, 'attendees cannot read payout accounts';
  begin perform housekeeping(); raise exception 'housekeeping should not be callable'; exception when insufficient_privilege then null; end;
  begin perform fulfill_order('50000000-0000-0000-0000-000000000002', 'bkash', 'free'); raise exception 'fulfill_order should not be callable'; exception when insufficient_privilege then null; end;
end $$;
set test.uid = '00000000-0000-0000-0000-00000000000c';   -- Tanvir, admin
do $$ begin
  assert (select count(*) from promo_codes) = 1, 'admins manage promo codes';
  begin insert into team_members values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'owner'); raise exception 'admin added an owner';
  exception when insufficient_privilege then null; end;
  begin insert into payout_methods (org_id, kind, label) values ('10000000-0000-0000-0000-000000000001', 'bkash', 'bKash 9999'); raise exception 'admin added a payout account';
  exception when insufficient_privilege then null; end;
  update organizations set verified = true, name = 'DSC' where id = '10000000-0000-0000-0000-000000000001';
  assert (select not verified and name = 'DSC' from organizations where id = '10000000-0000-0000-0000-000000000001'), 'profile edits allowed, self-verify ignored';
  begin update organizations set website = 'javascript:alert(1)' where id = '10000000-0000-0000-0000-000000000001'; raise exception 'unsafe website saved';
  exception when check_violation then null; end;
end $$;
set test.uid = '00000000-0000-0000-0000-00000000000a';   -- Rafi, the only owner
do $$ begin
  set constraints team_keeps_owner immediate;
  begin delete from team_members where user_id = '00000000-0000-0000-0000-00000000000a'; raise exception 'last owner removed';
  exception when raise_exception then if sqlerrm not like '%at least one owner%' then raise; end if; end;
end $$;
reset role;
select 'sql tests passed' as result;
