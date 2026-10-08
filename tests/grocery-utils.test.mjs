import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/components/stockhome/inventory/grocery-utils.ts', import.meta.url), 'utf8');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const { validateGroceryForm, groceryListText, emptyGroceryForm } = context.exports;

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

test('copy includes purchase amounts and excludes purchased items', () => {
  const items = [
    { name: 'Rice', quantity: 2, unit: 'kg', is_purchased: false },
    { name: 'Coffee', quantity: 1, unit: 'bag', is_purchased: true },
    { name: 'Apples', quantity: 3, unit: '', is_purchased: false },
  ];
  assert.equal(groceryListText(items), '- Rice: 2 kg\n- Apples: 3');
  assert.equal(items[1].is_purchased, true);
  assert.equal(groceryListText([]), '');
  assert.equal(groceryListText([items[1]]), '');
});
