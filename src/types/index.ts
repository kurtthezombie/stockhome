export type Task = {
  id: string;
  user_id: string;
  title: string;
  is_done: boolean;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InventoryStatus = "available" | "low_stock" | "unavailable";

export type InventoryItem = {
  id: string;
  user_id: string;
  name: string;
  status: InventoryStatus;
  quantity: number | null;
  unit: string | null;
  expiry_date: string | null;
  category: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

