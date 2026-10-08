-- Run only against an EMPTY disposable PostgreSQL database with psql -v ON_ERROR_STOP=1.
-- Supabase's auth roles/schema are simulated; all changes are rolled back.
begin;
create role anon;
create role authenticated;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select current_setting('request.jwt.claim.sub', true)::uuid $$;
grant usage on schema auth, public to authenticated;
create table public.inventory_items (
  id uuid primary key, user_id uuid not null references auth.users(id), quantity numeric not null
);
alter table public.inventory_items enable row level security;
grant select, delete on public.inventory_items to authenticated;
create policy own_inventory on public.inventory_items to authenticated
  using (auth.uid() = user_id);
insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
insert into public.inventory_items values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 10),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 20);

\ir ../supabase/migrations/20261008000100_grocery_items.sql

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
insert into public.grocery_items (user_id, inventory_item_id, name, quantity, unit)
values (auth.uid(), '10000000-0000-0000-0000-000000000001', 'Rice', 2, 'kg');
insert into public.grocery_items (user_id, name, quantity) values (auth.uid(), 'New item', 1);

do $$ begin
  if (select quantity from public.inventory_items where user_id = auth.uid()) <> 10 then
    raise exception 'Shopping amount changed inventory';
  end if;
  begin
    insert into public.grocery_items (user_id, name) values (auth.uid(), ' rice ');
    raise exception 'Duplicate name accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.grocery_items (user_id, inventory_item_id, name)
    values (auth.uid(), '10000000-0000-0000-0000-000000000002', 'Foreign item');
    raise exception 'Foreign inventory reference accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.grocery_items (user_id, name, quantity) values (auth.uid(), 'Invalid amount', 0);
    raise exception 'Zero quantity accepted';
  exception when check_violation then null; end;
  begin
    insert into public.grocery_items (user_id, name, quantity) values (auth.uid(), 'Invalid amount', 'NaN');
    raise exception 'NaN quantity accepted';
  exception when check_violation then null; end;
end $$;

update public.grocery_items set is_purchased = true where name = 'Rice';
do $$ begin
  if not (select is_purchased from public.grocery_items where name = 'Rice') then
    raise exception 'Purchased state did not persist';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
do $$ declare changed integer; begin
  if (select count(*) from public.grocery_items) <> 0 then raise exception 'Other account can read list'; end if;
  update public.grocery_items set quantity = 999;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Other account can update list'; end if;
  delete from public.grocery_items;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Other account can delete list'; end if;
  begin
    insert into public.grocery_items (user_id, name) values ('00000000-0000-0000-0000-000000000001', 'Intruder');
    raise exception 'Other account can insert into list';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
delete from public.inventory_items where user_id = auth.uid();
do $$ begin
  if (select count(*) from public.grocery_items) <> 2 then raise exception 'Deleting inventory lost shopping rows'; end if;
  if exists (select 1 from public.grocery_items where inventory_item_id is not null) then raise exception 'Deleted inventory reference retained'; end if;
end $$;
delete from public.grocery_items where user_id = auth.uid();
reset role;
do $$ begin
  if exists (select 1 from public.grocery_items) then raise exception 'Owner delete failed'; end if;
  if has_table_privilege('anon', 'public.grocery_items', 'SELECT') then raise exception 'Anonymous access granted'; end if;
end $$;
rollback;
\echo 'Passed: migration, CRUD, quantity constraints, duplicates, ownership, RLS and inventory independence.'
