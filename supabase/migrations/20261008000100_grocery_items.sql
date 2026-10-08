-- One persistent shopping list per account, separate from inventory quantities.
create table public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  quantity numeric not null default 1 check (quantity > 0 and quantity < 1000000000),
  unit text not null default '' check (char_length(unit) <= 30),
  is_purchased boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index grocery_items_user_name on public.grocery_items (user_id, lower(btrim(name)));
create unique index grocery_items_user_inventory on public.grocery_items (user_id, inventory_item_id)
  where inventory_item_id is not null;

alter table public.grocery_items enable row level security;
revoke all on public.grocery_items from anon;
grant select, insert, update, delete on public.grocery_items to authenticated;

create policy "Read own grocery items" on public.grocery_items for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Add own grocery items" on public.grocery_items for insert to authenticated
  with check (
    (select auth.uid()) = user_id and
    (inventory_item_id is null or exists (
      select 1 from public.inventory_items i
      where i.id = inventory_item_id and i.user_id = (select auth.uid())
    ))
  );
create policy "Update own grocery items" on public.grocery_items for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id and
    (inventory_item_id is null or exists (
      select 1 from public.inventory_items i
      where i.id = inventory_item_id and i.user_id = (select auth.uid())
    ))
  );
create policy "Delete own grocery items" on public.grocery_items for delete to authenticated
  using ((select auth.uid()) = user_id);
