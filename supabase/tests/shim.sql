create schema auth; create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create domain geography as text; create function st_makepoint(float, float) returns text language sql as $$ select '' $$;
create function st_dwithin(text, text, float) returns boolean language sql as $$ select true $$;
create schema cron; create function cron.schedule(text, text, text) returns int language sql as $$ select 1 $$;
create publication supabase_realtime;
