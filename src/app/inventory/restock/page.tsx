import { InventoryPageClient } from "@/components/stockhome/inventory-page";

export default function RestockPage() {
  return (
    <InventoryPageClient
      title="Restock"
      description="Items that are low stock or unavailable."
      initialStatusFilters={["low_stock", "unavailable"]}
    />
  );
}
