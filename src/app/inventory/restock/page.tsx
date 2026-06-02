import { InventoryPageClient } from "@/components/stockhome/inventory-page";

export default function RestockPage() {
  return (
    <InventoryPageClient
      title="Restock"
      description="Build a grocery list from low stock and unavailable items."
      initialStatusFilters={["low_stock", "unavailable"]}
      showGroceryList
    />
  );
}
