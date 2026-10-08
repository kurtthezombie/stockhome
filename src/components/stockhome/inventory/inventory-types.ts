import type { InventoryStatus } from "@/types";

export type InventoryForm = {
  name: string;
  status: InventoryStatus;
  quantity: string;
  unit: string;
  has_expiry_date: boolean;
  expiry_date: string;
  category: string;
  notes: string;
};

export type InventoryFormErrors = Partial<Record<keyof InventoryForm, string>>;

export type InventoryFilter = InventoryStatus;

export type InventoryPageClientProps = {
  title?: string;
  description?: string;
  initialStatusFilters?: InventoryFilter[];
  initialExpiringSoonOnly?: boolean;
  showGroceryList?: boolean;
};
