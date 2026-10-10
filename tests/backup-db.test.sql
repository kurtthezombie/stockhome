-- Run ONLY against an empty disposable database with psql -v ON_ERROR_STOP=1.
begin;
create role anon;
create role authenticated;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select current_setting('request.jwt.claim.sub', true)::uuid $$;
grant usage on schema auth, public to authenticated;
create type public.inventory_status as enum ('available', 'low_stock', 'unavailable');
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  name text not null, status public.inventory_status not null, quantity numeric not null,
  unit text, expiry_date date, category text, notes text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  title text not null, is_done boolean not null, due_date date, notes text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.inventory_items enable row level security;
alter table public.tasks enable row level security;
grant select, insert, update, delete on public.inventory_items, public.tasks to authenticated;
create policy own_inventory on public.inventory_items to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_tasks on public.tasks to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
insert into public.tasks (user_id, title, is_done) values ('00000000-0000-0000-0000-000000000002', 'Other account', false);
\ir ../supabase/migrations/20261008000100_grocery_items.sql
\ir ../supabase/migrations/20261009000100_backup_restore.sql
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

do $$
declare
  backup jsonb := '{"format":"stockhome","version":1,"inventory":[{"id":"10000000-0000-0000-0000-000000000001","user_id":"00000000-0000-0000-0000-000000000002","name":"Rice","status":"available","quantity":2,"unit":"kg"}],"tasks":[{"title":"Clean","is_done":true}],"groceries":[{"inventory_item_id":"10000000-0000-0000-0000-000000000001","name":"Rice","quantity":1,"unit":"kg","is_purchased":true}]}';
  exported jsonb;
  broken jsonb;
begin
  perform public.import_stockhome_backup(backup);
  if (select count(*) from public.inventory_items) <> 1 or (select count(*) from public.tasks) <> 1 then raise exception 'Import counts incorrect'; end if;
  if not exists (select 1 from public.grocery_items g join public.inventory_items i on i.id = g.inventory_item_id where g.is_purchased and i.user_id = auth.uid()) then raise exception 'Link or state lost'; end if;
  if exists (select 1 from public.inventory_items where id = '10000000-0000-0000-0000-000000000001') then raise exception 'ID was not remapped'; end if;
  exported := public.export_stockhome_backup();
  if jsonb_array_length(exported->'tasks') <> 1 or exported->'inventory'->0 ? 'user_id' then raise exception 'Export leaked ownership or foreign rows'; end if;
  begin
    perform public.import_stockhome_backup(backup);
    raise exception 'Duplicate grocery accepted';
  exception when unique_violation then null; end;
  if (select count(*) from public.inventory_items) <> 1 or (select count(*) from public.tasks) <> 1 then raise exception 'Failed additive import did not roll back'; end if;
  broken := jsonb_set(backup, '{groceries,0,inventory_item_id}', '"10000000-0000-0000-0000-000000000099"');
  begin
    perform public.import_stockhome_backup(broken, true);
    raise exception 'Broken reference accepted';
  exception when raise_exception then
    if sqlerrm <> 'Grocery item references missing inventory' then raise; end if;
  end;
  if public.export_stockhome_backup()->'inventory' <> exported->'inventory' then raise exception 'Failed replace deleted inventory'; end if;
  perform public.import_stockhome_backup(exported, true);
  if (select count(*) from public.inventory_items) <> 1 or (select count(*) from public.grocery_items) <> 1 then raise exception 'Replace counts incorrect'; end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
do $$ begin
  if (select count(*) from public.tasks) <> 1 or (select title from public.tasks) <> 'Other account' then raise exception 'Other account data changed'; end if;
  if jsonb_array_length(public.export_stockhome_backup()->'inventory') <> 0 then raise exception 'Foreign inventory exported'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform public.export_stockhome_backup();
    raise exception 'Anonymous export allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.import_stockhome_backup('{}');
    raise exception 'Anonymous import allowed';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
