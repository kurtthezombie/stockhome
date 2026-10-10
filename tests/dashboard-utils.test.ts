// @vitest-environment node
import { expect, test } from "vitest";
import { chartCategories, dashboardMetrics, localDateKey } from "@/components/stockhome/dashboard-utils";
import type { InventoryItem, Task } from "@/types";
import type { GroceryItem } from "@/components/stockhome/inventory/grocery-utils";

const now = new Date(2026, 9, 9, 23, 30);
const item = (id: string, overrides: Partial<InventoryItem> = {}): InventoryItem => ({ id, user_id: "user", name: id, status: "available", quantity: 1, unit: null, category: "Food", expiry_date: null, notes: null, created_at: "", updated_at: "", ...overrides });
const task = (id: string, due_date: string | null, is_done = false): Task => ({ id, user_id: "user", title: id, due_date, is_done, notes: null, created_at: "", updated_at: "" });

test("uses local calendar dates and includes the seven-day boundary without counting expired items as upcoming", () => {
  expect(localDateKey(now)).toBe("2026-10-09");
  const metrics = dashboardMetrics([
    item("expired", { expiry_date: "2026-10-08" }),
    item("today", { expiry_date: "2026-10-09" }),
    item("boundary", { expiry_date: "2026-10-16" }),
    item("later", { expiry_date: "2026-10-17" }),
  ], [task("overdue", "2026-10-08"), task("today", "2026-10-09"), task("boundary", "2026-10-16"), task("later", "2026-10-17"), task("undated", null), task("done", "2026-10-08", true)], [], now);
  expect(metrics.expiring.map((row) => row.id)).toEqual(["today", "boundary"]);
  expect(metrics.expired.map((row) => row.id)).toEqual(["expired"]);
  expect(metrics.taskAttention.map((row) => row.id)).toEqual(["overdue", "today", "boundary"]);
  expect(metrics.pending).toBe(5);
  expect(metrics.overdue).toBe(1);
  expect(metrics.dueToday).toBe(1);
  expect(metrics.completionRate).toBe(17);
});

test("counts inventory records rather than mixing quantities or units and excludes purchased groceries", () => {
  const groceries = [false, true].map((is_purchased, index): GroceryItem => ({ id: String(index), user_id: "user", inventory_item_id: null, name: "Milk", quantity: 3, unit: "L", is_purchased, created_at: "" }));
  const metrics = dashboardMetrics([item("Rice", { quantity: 200, unit: "g" }), item("Milk", { status: "low_stock", quantity: 0.5, unit: "L" }), item("Soap", { status: "unavailable", category: null })], [], groceries, now);
  expect(metrics.stock).toEqual({ available: 1, low_stock: 1, unavailable: 1 });
  expect(metrics.categories.find((row) => row.name === "Food")?.total).toBe(2);
  expect(metrics.categories.find((row) => row.name === "Uncategorized")?.unavailable).toBe(1);
  expect(metrics.remainingGroceries).toHaveLength(1);
  expect(metrics.purchased).toBe(1);
  expect(metrics.completionRate).toBe(0);
});

test("groups smaller categories without losing counts and filters restock-only categories", () => {
  const categories = Array.from({ length: 8 }, (_, index) => ({ name: `Category ${index}`, available: index, low_stock: index % 2, unavailable: 0, total: index + index % 2 }));
  const grouped = chartCategories(categories, false);
  expect(grouped).toHaveLength(6);
  expect(grouped.at(-1)?.name).toBe("Other categories");
  expect(grouped.reduce((sum, row) => sum + row.total, 0)).toBe(categories.reduce((sum, row) => sum + row.total, 0));
  expect(chartCategories(categories, true)).toHaveLength(4);
  expect(categories[0].name).toBe("Category 0");
});
