"use client";

import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { User } from "@supabase/supabase-js";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/stockhome/app-shell";
import { GroceryList } from "@/components/stockhome/inventory/grocery-list";
import { InventoryDeleteDialog } from "@/components/stockhome/inventory/inventory-delete-dialog";
import { InventoryFilters } from "@/components/stockhome/inventory/inventory-filters";
import { InventoryFormDialog } from "@/components/stockhome/inventory/inventory-form-dialog";
import { InventoryList } from "@/components/stockhome/inventory/inventory-list";
import type {
  InventoryFilter,
  InventoryForm,
  InventoryFormErrors,
  InventoryPageClientProps,
} from "@/components/stockhome/inventory/inventory-types";
import {
  categoryOptions,
  emptyInventoryForm,
  hasInventoryFormErrors,
  isExpiringSoon,
  validateInventoryForm,
} from "@/components/stockhome/inventory/inventory-utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import type { InventoryItem } from "@/types";

export function InventoryPageClient({
  title = "Inventory",
  description = "Track household stock, availability, and expiry dates.",
  initialStatusFilters = [],
  initialExpiringSoonOnly = false,
  showGroceryList = false,
}: InventoryPageClientProps) {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [form, setForm] = useState<InventoryForm>(emptyInventoryForm);
  const [formErrors, setFormErrors] = useState<InventoryFormErrors>({});
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [statusFilters, setStatusFilters] = useState<InventoryFilter[]>(
    initialStatusFilters,
  );
  const [expiringSoonOnly, setExpiringSoonOnly] = useState(
    initialExpiringSoonOnly,
  );
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryFilters = useMemo(() => ["All", ...categoryOptions], []);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return items.filter((item) => {
      const matchesStatus =
        statusFilters.length === 0 || statusFilters.includes(item.status);
      const matchesExpiry = !expiringSoonOnly || isExpiringSoon(item.expiry_date);
      const matchesCategory =
        categoryFilter === "All" || item.category === categoryFilter;
      const matchesName =
        !normalizedQuery || item.name.toLowerCase().includes(normalizedQuery);

      return matchesStatus && matchesExpiry && matchesCategory && matchesName;
    });
  }, [categoryFilter, expiringSoonOnly, items, searchQuery, statusFilters]);

  function toggleStatusFilter(status: InventoryFilter) {
    setStatusFilters((currentFilters) =>
      currentFilters.includes(status)
        ? currentFilters.filter((currentStatus) => currentStatus !== status)
        : [...currentFilters, status],
    );
  }

  async function loadItems() {
    setIsLoading(true);
    setError(null);

    const { data, error: loadError } = await supabase
      .from("inventory_items")
      .select("*")
      .order("status", { ascending: true })
      .order("expiry_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
    } else {
      setItems((data ?? []) as InventoryItem[]);
    }

    setIsLoading(false);
  }

  useEffect(() => {
    async function loadUserAndItems() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);

      if (data.user) {
        await loadItems();
      } else {
        setIsLoading(false);
      }
    }

    loadUserAndItems();
  }, []);

  function openAddDialog() {
    setEditingItem(null);
    setForm(emptyInventoryForm);
    setFormErrors({});
    setError(null);
    setIsDialogOpen(true);
  }

  function openEditDialog(item: InventoryItem) {
    setEditingItem(item);
    setForm({
      name: item.name,
      status: item.status,
      quantity: item.quantity?.toString() ?? "",
      unit: item.unit ?? "",
      has_expiry_date: Boolean(item.expiry_date),
      expiry_date: item.expiry_date ?? "",
      category: item.category ?? "",
      notes: item.notes ?? "",
    });
    setFormErrors({});
    setError(null);
    setIsDialogOpen(true);
  }

  function handleFormChange(nextForm: InventoryForm) {
    setForm(nextForm);
    setFormErrors({});
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateInventoryForm(form);

    if (hasInventoryFormErrors(validationErrors)) {
      setFormErrors(validationErrors);
      return;
    }

    if (!user) {
      setError("You must be logged in to save inventory items.");
      return;
    }

    setIsSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      status: form.status,
      quantity: form.quantity ? Number(form.quantity) : null,
      unit: form.unit.trim() || null,
      expiry_date: form.has_expiry_date ? form.expiry_date || null : null,
      category: form.category.trim() || null,
      notes: form.notes.trim() || null,
    };

    const result = editingItem
      ? await supabase
          .from("inventory_items")
          .update(payload)
          .eq("id", editingItem.id)
      : await supabase.from("inventory_items").insert({
          ...payload,
          user_id: user.id,
        });

    setIsSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setIsDialogOpen(false);
    setForm(emptyInventoryForm);
    setEditingItem(null);
    await loadItems();
  }

  function openDeleteDialog(item: InventoryItem) {
    setItemToDelete(item);
    setError(null);
    setIsDeleteDialogOpen(true);
  }

  async function deleteItem() {
    if (!itemToDelete) {
      return;
    }

    setIsDeleting(true);

    const { error: deleteError } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", itemToDelete.id);

    setIsDeleting(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setItems((currentItems) =>
      currentItems.filter((currentItem) => currentItem.id !== itemToDelete.id),
    );
    setExpandedItemId((currentId) =>
      currentId === itemToDelete.id ? null : currentId,
    );
    setItemToDelete(null);
    setIsDeleteDialogOpen(false);
  }

  return (
    <AppShell>
      <div className="grid gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {!showGroceryList ? (
            <Button className="h-10 px-4 text-sm" onClick={openAddDialog}>
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
              Add item
            </Button>
          ) : null}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {showGroceryList ? (
          <GroceryList items={filteredItems} />
        ) : (
          <>
            <InventoryFilters
              categoryFilters={categoryFilters}
              categoryFilter={categoryFilter}
              expiringSoonOnly={expiringSoonOnly}
              searchQuery={searchQuery}
              statusFilters={statusFilters}
              onCategoryFilterChange={setCategoryFilter}
              onClearExpiringSoon={() => setExpiringSoonOnly(false)}
              onSearchQueryChange={setSearchQuery}
              onStatusFilterToggle={toggleStatusFilter}
            />

            <InventoryList
              expandedItemId={expandedItemId}
              isLoading={isLoading}
              items={filteredItems}
              onDeleteItem={openDeleteDialog}
              onEditItem={openEditDialog}
              onExpandedItemChange={setExpandedItemId}
            />
          </>
        )}
      </div>

      <InventoryFormDialog
        editingItem={editingItem}
        errors={formErrors}
        form={form}
        isOpen={isDialogOpen}
        isSaving={isSaving}
        onFormChange={handleFormChange}
        onOpenChange={setIsDialogOpen}
        onSubmit={handleSubmit}
      />

      <InventoryDeleteDialog
        isDeleting={isDeleting}
        isOpen={isDeleteDialogOpen}
        item={itemToDelete}
        onDelete={deleteItem}
        onOpenChange={setIsDeleteDialogOpen}
      />
    </AppShell>
  );
}
