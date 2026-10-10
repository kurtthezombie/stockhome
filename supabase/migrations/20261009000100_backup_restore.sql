-- Invoker functions retain the caller's table grants and row-level security.
create or replace function public.export_stockhome_backup() returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Sign in to export data'; end if;
  return jsonb_build_object(
    'format', 'stockhome', 'version', 1, 'exported_at', now(),
    'inventory', (select coalesce(jsonb_agg(to_jsonb(i) - 'user_id' - 'created_at' - 'updated_at'), '[]'::jsonb) from public.inventory_items i where user_id = auth.uid()),
    'tasks', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id' - 'created_at' - 'updated_at'), '[]'::jsonb) from public.tasks t where user_id = auth.uid()),
    'groceries', (select coalesce(jsonb_agg(to_jsonb(g) - 'user_id' - 'created_at'), '[]'::jsonb) from public.grocery_items g where user_id = auth.uid())
  );
end $$;

create or replace function public.import_stockhome_backup(backup jsonb, replace_existing boolean default false) returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  owner_id uuid := auth.uid();
  item jsonb;
  new_id uuid;
  inventory_map jsonb := '{}'::jsonb;
  linked_id uuid;
begin
  if owner_id is null then raise exception 'Sign in to import data'; end if;
  if backup->>'format' is distinct from 'stockhome' or backup->>'version' is distinct from '1'
     or jsonb_typeof(backup->'inventory') is distinct from 'array'
     or jsonb_typeof(backup->'tasks') is distinct from 'array'
     or jsonb_typeof(backup->'groceries') is distinct from 'array' then
    raise exception 'Invalid StockHome backup';
  end if;
  if octet_length(backup::text) > 10485760 or jsonb_array_length(backup->'inventory') > 10000
    or jsonb_array_length(backup->'tasks') > 10000 or jsonb_array_length(backup->'groceries') > 10000 then
    raise exception 'Backup exceeds size limits';
  end if;
  -- Serialize imports for this account. Any failure rolls back deletes and inserts together.
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 0));
  if replace_existing then
    delete from public.grocery_items where user_id = owner_id;
    delete from public.tasks where user_id = owner_id;
    delete from public.inventory_items where user_id = owner_id;
  end if;
  for item in select value from jsonb_array_elements(backup->'inventory') loop
    if item->>'id' is null or inventory_map ? (item->>'id')
       or coalesce(btrim(item->>'name'), '') = ''
       or coalesce(item->>'status', '') not in ('available', 'low_stock', 'unavailable')
       or (item->>'quantity')::numeric is null or not ((item->>'quantity')::numeric >= 0 and (item->>'quantity')::numeric < 1000000000) then
      raise exception 'Invalid inventory record';
    end if;
    perform (item->>'id')::uuid;
    new_id := gen_random_uuid();
    inventory_map := inventory_map || jsonb_build_object(item->>'id', new_id);
    insert into public.inventory_items (id, user_id, name, status, quantity, unit, expiry_date, category, notes)
      select new_id, owner_id, r.name, r.status, r.quantity, r.unit, r.expiry_date, r.category, r.notes
      from jsonb_populate_record(null::public.inventory_items, item - 'id' - 'user_id' - 'created_at' - 'updated_at') r;
  end loop;
  for item in select value from jsonb_array_elements(backup->'tasks') loop
    if coalesce(btrim(item->>'title'), '') = '' or jsonb_typeof(item->'is_done') is distinct from 'boolean' then
      raise exception 'Invalid task record';
    end if;
    insert into public.tasks (id, user_id, title, is_done, due_date, notes)
      select gen_random_uuid(), owner_id, r.title, r.is_done, r.due_date, r.notes
      from jsonb_populate_record(null::public.tasks, item - 'id' - 'user_id' - 'created_at' - 'updated_at') r;
  end loop;
  for item in select value from jsonb_array_elements(backup->'groceries') loop
    linked_id := null;
    if item->>'inventory_item_id' is not null then
      linked_id := (inventory_map->>(item->>'inventory_item_id'))::uuid;
      if linked_id is null then raise exception 'Grocery item references missing inventory'; end if;
    end if;
    if jsonb_typeof(item->'is_purchased') is distinct from 'boolean' then raise exception 'Invalid grocery state'; end if;
    insert into public.grocery_items (id, user_id, inventory_item_id, name, quantity, unit, is_purchased)
      select gen_random_uuid(), owner_id, linked_id, r.name, r.quantity, r.unit, r.is_purchased
      from jsonb_populate_record(null::public.grocery_items, item - 'id' - 'user_id' - 'inventory_item_id' - 'created_at') r;
  end loop;
end $$;

revoke all on function public.export_stockhome_backup() from public, anon;
revoke all on function public.import_stockhome_backup(jsonb, boolean) from public, anon;
grant execute on function public.export_stockhome_backup() to authenticated;
grant execute on function public.import_stockhome_backup(jsonb, boolean) to authenticated;
