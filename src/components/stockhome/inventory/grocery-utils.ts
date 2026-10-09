export type GroceryItem = {
  id: string;
  user_id: string;
  inventory_item_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  is_purchased: boolean;
  created_at: string;
};

export type GroceryForm = {
  inventory_item_id: string;
  name: string;
  quantity: string;
  unit: string;
};

export const emptyGroceryForm: GroceryForm = {
  inventory_item_id: "",
  name: "",
  quantity: "1",
  unit: "",
};

export function validateGroceryForm(form: GroceryForm): string | null {
  if (!form.name.trim() || form.name.trim().length > 80) return "Enter an item name between 1 and 80 characters.";
  const quantity = Number(form.quantity);
  if (!form.quantity.trim() || !Number.isFinite(quantity) || quantity <= 0 || quantity >= 1_000_000_000) {
    return "Enter an amount greater than zero and less than one billion.";
  }
  if (form.unit.trim().length > 30) return "Keep the unit under 30 characters.";
  return null;
}

export function groceryListText(items: GroceryItem[]) {
  return items.filter((item) => !item.is_purchased)
    .map((item) => `[ ] ${item.name}: ${item.quantity}${item.unit ? ` ${item.unit}` : ""}`)
    .join("\n");
}
