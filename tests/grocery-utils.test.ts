// @vitest-environment node
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { validateGroceryForm, groceryListText, emptyGroceryForm, type GroceryItem } from '@/components/stockhome/inventory/grocery-utils';

test('accepts custom purchases and fractional amounts without an inventory link', () => {
  assert.equal(validateGroceryForm({ ...emptyGroceryForm, name: 'Rice', quantity: '0.5', unit: 'kg' }), null);
});

test('rejects empty, non-finite, non-positive and excessive shopping quantities', () => {
  for (const quantity of ['', ' ', '0', '-2', 'NaN', 'Infinity', '1000000000']) {
    assert.ok(validateGroceryForm({ ...emptyGroceryForm, name: 'Rice', quantity }), quantity);
  }
});

test('validates names and units at their length boundaries', () => {
  assert.ok(validateGroceryForm({ ...emptyGroceryForm, name: ' ' }));
  assert.ok(validateGroceryForm({ ...emptyGroceryForm, name: 'a'.repeat(81) }));
  assert.ok(validateGroceryForm({ ...emptyGroceryForm, name: 'Rice', unit: 'a'.repeat(31) }));
  assert.equal(validateGroceryForm({ ...emptyGroceryForm, name: 'a'.repeat(80), unit: 'a'.repeat(30) }), null);
});

test('copy formats unchecked brackets with purchase amounts and excludes purchased items', () => {
  const items: GroceryItem[] = [
    { name: 'Rice', quantity: 2, unit: 'kg', is_purchased: false },
    { name: 'Coffee', quantity: 1, unit: 'bag', is_purchased: true },
    { name: 'Apples', quantity: 3, unit: '', is_purchased: false },
  ].map((item, index) => ({ ...item, id: String(index), user_id: 'test-user', inventory_item_id: null, created_at: '2026-10-09T00:00:00Z' }));
  assert.equal(groceryListText(items), '[ ] Rice: 2 kg\n[ ] Apples: 3');
  assert.equal(items[1].is_purchased, true);
  assert.equal(groceryListText([]), '');
  assert.equal(groceryListText([items[1]]), '');
});
