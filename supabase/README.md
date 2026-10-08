# Grocery list database setup

Run `migrations/20261008000100_grocery_items.sql` once in the Supabase SQL editor for the project used by `.env.local`, or apply it through your existing Supabase migration workflow. It requires the existing `public.inventory_items` table and Supabase Auth.

The migration adds a separate `grocery_items` table. It does not change existing inventory data. Row-level security restricts each account to its own grocery list, including ownership checks for linked inventory items. Do not disable RLS or put database/admin credentials in `NEXT_PUBLIC_*` variables.

The app needs this migration before grocery lists can load or save. No browser-only fallback is used: a failed save is shown as an error rather than reported as persisted.

## Behavior

- Add any inventory item, including available items, or a custom item.
- Shopping amounts are independent of current inventory quantities.
- Low-stock and unavailable items appear as suggestions, not automatic purchases.
- Edit quantities, mark purchased/unpurchased, and remove items with confirmation.
- One saved row per item name (case-insensitive) and per linked inventory item. Uncheck a purchased item to buy it again.
- Reload the page or use Refresh to retrieve changes made on another device. This version does not subscribe to live updates.
- Copy remaining excludes purchased rows. Purchases never automatically change inventory.

## Verification

Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.

`tests/grocery-db.test.sql` exercises the migration, database constraints and account isolation against an empty disposable PostgreSQL database. It simulates Supabase Auth and rolls back all test data. Never run this test script against your Supabase project.

After applying the migration, verify with a signed-in account:

1. Add an available inventory item with a shopping quantity different from its stock quantity.
2. Add a custom item and a low-stock suggestion; edit an amount.
3. Refresh and confirm all rows and amounts persist.
4. Mark purchased, reload or sign in on another device, and verify its state persists.
5. Copy remaining and confirm purchased items are excluded.
6. Remove a row; confirm the inventory item and stock quantity are unchanged.
7. Sign in as a different account and confirm the first account's grocery rows are inaccessible.
