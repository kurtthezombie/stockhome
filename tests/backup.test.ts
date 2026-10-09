// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseBackup, validateBackup } from "@/lib/backup";

const inventoryId = "10000000-0000-0000-0000-000000000001";
const fixture = () => ({
  format: "stockhome", version: 1, exported_at: "2026-10-09T00:00:00Z",
  inventory: [{ id: inventoryId, name: "Rice", status: "available", quantity: 2, unit: "kg", expiry_date: null, category: null, notes: null, user_id: "untrusted" }],
  tasks: [{ id: "20000000-0000-0000-0000-000000000001", title: "Clean", is_done: false, due_date: "2026-10-10", notes: null }],
  groceries: [{ id: "30000000-0000-0000-0000-000000000001", inventory_item_id: inventoryId, name: "Rice", quantity: 1, unit: "kg", is_purchased: true }],
});
describe("backup validation", () => {
  it("preserves links and states while excluding uploaded ownership", () => {
    const backup = parseBackup(JSON.stringify(fixture()));
    expect(backup.inventory[0]).not.toHaveProperty("user_id");
    expect(backup.groceries[0].inventory_item_id).toBe(backup.inventory[0].id);
    expect(backup.groceries[0].is_purchased).toBe(true);
  });
  it("rejects broken links, duplicate IDs and grocery names", () => {
    const data = fixture(); data.inventory = [];
    expect(() => validateBackup(data)).toThrow("missing inventory");
    const duplicate = fixture(); duplicate.inventory.push(duplicate.inventory[0]);
    expect(() => validateBackup(duplicate)).toThrow("duplicate");
    const names = fixture(); names.groceries.push({ ...names.groceries[0], id: "30000000-0000-0000-0000-000000000002", name: " RICE ", inventory_item_id: inventoryId });
    expect(() => validateBackup(names)).toThrow("duplicate");
  });
  it("rejects invalid dates, amounts, states, format and JSON", () => {
    const data = fixture(); data.tasks[0].due_date = "2026-02-30";
    expect(() => validateBackup(data)).toThrow("date");
    for (const amount of [NaN, Infinity, -1, 1000000000]) {
      const invalid = fixture(); invalid.inventory[0].quantity = amount;
      expect(() => validateBackup(invalid)).toThrow("quantity");
    }
    const zero = fixture(); zero.groceries[0].quantity = 0;
    expect(() => validateBackup(zero)).toThrow("positive");
    expect(() => validateBackup({ ...fixture(), version: 2 })).toThrow("version 1");
    expect(() => validateBackup({ ...fixture(), tasks: [{ ...fixture().tasks[0], is_done: "false" }] })).toThrow("state");
    expect(() => parseBackup("not json")).toThrow("JSON");
  });
  it("accepts empty backups and rejects oversized lists", () => {
    expect(validateBackup({ ...fixture(), inventory: [], groceries: [], tasks: [] }).inventory).toEqual([]);
    expect(() => validateBackup({ ...fixture(), tasks: Array(10001).fill(fixture().tasks[0]) })).toThrow("10,000");
  });
});
