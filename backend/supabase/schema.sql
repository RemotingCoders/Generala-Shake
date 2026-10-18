-- Generala: Supabase schema. Run once in the SQL editor (safe to re-run).
-- Only the backend (service role key) writes; browsers / the TV read `rooms` with the anon key and Realtime.

create table if not exists public.rooms (
  code        text primary key,
  state       jsonb not null,
  seq         int not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create table if not exists public.room_secrets (
  code           text primary key references public.rooms (code) on delete cascade,
  host_token     text not null,
  player_tokens  jsonb not null default '{}'::jsonb   -- { playerToken: playerId }
);

create index if not exists rooms_expires_at_idx on public.rooms (expires_at);

alter table public.rooms enable row level security;
alter table public.room_secrets enable row level security;   -- no policies: service role only

drop policy if exists "rooms are readable" on public.rooms;
create policy "rooms are readable" on public.rooms for select to anon, authenticated using (true);

-- Atomic token registration (two phones joining at the same instant must not overwrite each other).
create or replace function public.add_player_token(p_code text, p_token text, p_player_id text)
returns void language sql security definer set search_path = public as $$
  update public.room_secrets set player_tokens = player_tokens || jsonb_build_object(p_token, p_player_id) where code = p_code;
$$;
revoke all on function public.add_player_token(text, text, text) from public, anon, authenticated;
grant execute on function public.add_player_token(text, text, text) to service_role;

-- Realtime: clients subscribe to UPDATEs on rooms filtered by code.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms') then
    alter publication supabase_realtime add table public.rooms;
  end if;
end $$;

-- Optional cleanup: deletes rooms that expired more than a day ago (room_secrets cascade).
-- Run it by hand (`select public.cleanup_expired_rooms();`) or schedule it with pg_cron
-- (Database → Extensions → enable pg_cron), e.g.:
--   select cron.schedule('generala-cleanup', '0 * * * *', $$select public.cleanup_expired_rooms()$$);
create or replace function public.cleanup_expired_rooms()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.rooms where expires_at < now() - interval '1 day';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.cleanup_expired_rooms() from public, anon, authenticated;
grant execute on function public.cleanup_expired_rooms() to service_role;
