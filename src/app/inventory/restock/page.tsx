import { InventoryPageClient } from "@/components/stockhome/inventory-page";

export default function RestockPage() {
  return (
    <InventoryPageClient
      title="Grocery list"
      description="Plan your next shop, save your list, and pick up a little extra."
      showGroceryList
    />
  );
}
