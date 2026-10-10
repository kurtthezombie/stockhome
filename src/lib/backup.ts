import type { InventoryItem, Task } from "@/types";
import type { GroceryItem } from "@/components/stockhome/inventory/grocery-utils";

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
type InventoryRecord = Omit<InventoryItem, "user_id" | "created_at" | "updated_at">;
type TaskRecord = Omit<Task, "user_id" | "created_at" | "updated_at">;
type GroceryRecord = Omit<GroceryItem, "user_id" | "created_at">;
export type Backup = {
  format: "stockhome";
  version: 1;
  exported_at: string;
  inventory: InventoryRecord[];
  tasks: TaskRecord[];
  groceries: GroceryRecord[];
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid backup record.");
  return value as Record<string, unknown>;
}
function string(value: unknown, max = 10000): string {
  if (typeof value !== "string" || value.length > max) throw new Error("Invalid text in backup.");
  return value;
}
function name(value: unknown, max = 10000) {
  const result = string(value, max).trim();
  if (!result) throw new Error("Backup contains an empty name or title.");
  return result;
}
function optional(value: unknown) { return value === null ? null : string(value); }
function id(value: unknown) {
  const result = string(value);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result)) throw new Error("Invalid record ID.");
  return result.toLowerCase();
}
function date(value: unknown) {
  if (value === null) return null;
  const result = string(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0, 10) !== result) throw new Error("Invalid date in backup.");
  return result;
}
function boolean(value: unknown) {
  if (typeof value !== "boolean") throw new Error("Invalid completion state.");
  return value;
}
function quantity(value: unknown, minimum: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value >= 1000000000) throw new Error("Invalid quantity in backup.");
  return value;
}
function rows(value: unknown) {
  if (!Array.isArray(value) || value.length > 10000) throw new Error("Backup must contain lists of at most 10,000 records each.");
  return value.map(object);
}
function unique(values: string[]) {
  if (new Set(values).size !== values.length) throw new Error("Backup contains duplicate records.");
}

// Reconstruct every record explicitly: uploaded ownership and audit fields are never trusted.
export function validateBackup(value: unknown): Backup {
  const data = object(value);
  if (data.format !== "stockhome" || data.version !== 1) throw new Error("Choose a StockHome version 1 backup.");
  const exported_at = string(data.exported_at);
  if (!Number.isFinite(Date.parse(exported_at))) throw new Error("Invalid backup timestamp.");
  const inventory = rows(data.inventory).map((row): InventoryRecord => {
    if (!["available", "low_stock", "unavailable"].includes(String(row.status))) throw new Error("Invalid inventory status.");
    return { id: id(row.id), name: name(row.name, 80), status: row.status as InventoryRecord["status"], quantity: quantity(row.quantity, 0), unit: optional(row.unit), expiry_date: date(row.expiry_date), category: optional(row.category), notes: optional(row.notes) };
  });
  const tasks = rows(data.tasks).map((row): TaskRecord => ({ id: id(row.id), title: name(row.title), is_done: boolean(row.is_done), due_date: date(row.due_date), notes: optional(row.notes) }));
  const inventoryIds = new Set(inventory.map((row) => row.id));
  const groceries = rows(data.groceries).map((row): GroceryRecord => {
    const amount = quantity(row.quantity, 0);
    if (amount === 0) throw new Error("Shopping quantities must be positive.");
    const link = row.inventory_item_id === null ? null : id(row.inventory_item_id);
    if (link && !inventoryIds.has(link)) throw new Error("A grocery item references missing inventory.");
    return { id: id(row.id), inventory_item_id: link, name: name(row.name, 80), quantity: amount, unit: string(row.unit, 30), is_purchased: boolean(row.is_purchased) };
  });
  for (const list of [inventory, tasks, groceries]) unique(list.map((row) => row.id));
  unique(groceries.map((row) => row.name.toLowerCase()));
  unique(groceries.flatMap((row) => row.inventory_item_id ? [row.inventory_item_id] : []));
  return { format: "stockhome", version: 1, exported_at, inventory, tasks, groceries };
}

export function parseBackup(text: string): Backup {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) throw new Error("Backup files must be 10 MB or smaller.");
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("This file is not valid JSON."); }
  return validateBackup(value);
}
