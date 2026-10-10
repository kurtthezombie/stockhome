import type { InventoryItem, Task } from "@/types";
import type { GroceryItem } from "@/components/stockhome/inventory/grocery-utils";

export type CategoryStock = { name: string; available: number; low_stock: number; unavailable: number; total: number };

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function dashboardMetrics(items: InventoryItem[], tasks: Task[], groceries: GroceryItem[], now = new Date()) {
  const today = localDateKey(now);
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const weekEnd = localDateKey(nextWeek);
  const pending = tasks.filter((task) => !task.is_done);
  const completed = tasks.length - pending.length;
  const categories = new Map<string, CategoryStock>();
  const stock = { available: 0, low_stock: 0, unavailable: 0 };
  for (const item of items) {
    stock[item.status] += 1;
    const name = item.category?.trim() || "Uncategorized";
    const category = categories.get(name) ?? { name, available: 0, low_stock: 0, unavailable: 0, total: 0 };
    category[item.status] += 1;
    category.total += 1;
    categories.set(name, category);
  }
  const expiring = items.filter((item) => item.expiry_date && item.expiry_date >= today && item.expiry_date <= weekEnd);
  const expired = items.filter((item) => item.expiry_date && item.expiry_date < today);
  const expiryAttention = [...expired, ...expiring].sort((a, b) => a.expiry_date!.localeCompare(b.expiry_date!) || a.name.localeCompare(b.name));
  const taskAttention = pending.filter((task) => task.due_date && task.due_date <= weekEnd)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!) || a.title.localeCompare(b.title));
  return {
    today, stock, pending: pending.length, completed,
    completionRate: tasks.length ? Math.round(completed / tasks.length * 100) : 0,
    overdue: pending.filter((task) => task.due_date && task.due_date < today).length,
    dueToday: pending.filter((task) => task.due_date === today).length,
    expiring, expired, expiryAttention, taskAttention,
    remainingGroceries: groceries.filter((item) => !item.is_purchased),
    purchased: groceries.filter((item) => item.is_purchased).length,
    categories: [...categories.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
  };
}

export function chartCategories(categories: CategoryStock[], restockOnly: boolean): CategoryStock[] {
  const visible = categories.filter((category) => !restockOnly || category.low_stock + category.unavailable > 0)
    .sort((a, b) => (restockOnly ? b.low_stock + b.unavailable - a.low_stock - a.unavailable : b.total - a.total) || a.name.localeCompare(b.name));
  if (visible.length <= 6) return visible;
  const other = visible.slice(5).reduce((result, category) => ({
    name: "Other categories", available: result.available + category.available,
    low_stock: result.low_stock + category.low_stock, unavailable: result.unavailable + category.unavailable,
    total: result.total + category.total,
  }), { name: "Other categories", available: 0, low_stock: 0, unavailable: 0, total: 0 });
  return [...visible.slice(0, 5), other];
}
