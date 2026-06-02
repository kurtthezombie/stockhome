import type { InventoryItem, InventoryStatus } from "@/types";

import type {
  InventoryFilter,
  InventoryForm,
  InventoryFormErrors,
} from "./inventory-types";

export const emptyInventoryForm: InventoryForm = {
  name: "",
  status: "available",
  quantity: "",
  unit: "",
  has_expiry_date: false,
  expiry_date: "",
  category: "",
  notes: "",
};

export const statusLabels: Record<InventoryStatus, string> = {
  available: "Available",
  low_stock: "Low stock",
  unavailable: "Unavailable",
};

export const categoryOptions = [
  "Food & cooking",
  "Drinks",
  "Cleaning & laundry",
  "Bathroom & personal care",
  "Paper & disposables",
  "Medicine",
  "Tools & maintenance",
  "Other",
];

export function statusVariant(status: InventoryStatus) {
  if (status === "unavailable") {
    return "destructive";
  }

  if (status === "low_stock") {
    return "outline";
  }

  return "secondary";
}

export function isExpiringSoon(date: string | null) {
  if (!date) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(`${date}T00:00:00`);
  const diffDays = Math.ceil(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  return diffDays >= 0 && diffDays <= 7;
}

export function itemCardClassName(
  item: InventoryItem,
  expiringSoon: boolean,
) {
  if (expiringSoon) {
    return "bg-destructive/5 ring-destructive/20";
  }

  if (item.status === "unavailable") {
    return "bg-destructive/5 ring-destructive/20";
  }

  if (item.status === "low_stock") {
    return "bg-amber-50 ring-amber-200";
  }

  return "bg-background";
}

export function statusFilterClassName(
  status: InventoryFilter,
  isSelected: boolean,
) {
  if (!isSelected) {
    return "";
  }

  if (status === "available") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100";
  }

  if (status === "low_stock") {
    return "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100";
  }

  return "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15";
}

export function validateInventoryForm(form: InventoryForm) {
  const errors: InventoryFormErrors = {};
  const quantity = form.quantity.trim();

  if (!form.name.trim()) {
    errors.name = "Enter an item name.";
  }

  if (!quantity) {
    errors.quantity = "Enter a quantity.";
  } else {
    const quantityValue = Number(quantity);

    if (!Number.isFinite(quantityValue)) {
      errors.quantity = "Enter a valid quantity.";
    } else if (quantityValue < 0) {
      errors.quantity = "Quantity cannot be negative.";
    }
  }

  if (form.has_expiry_date && !form.expiry_date) {
    errors.expiry_date = "Choose an expiry date or turn this off.";
  }

  return errors;
}

export function hasInventoryFormErrors(errors: InventoryFormErrors) {
  return Object.keys(errors).length > 0;
}
