"use client";

import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { User } from "@supabase/supabase-js";
import { FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/stockhome/app-shell";
import { GroceryPageSkeleton } from "@/components/stockhome/list-skeleton";
import { ListLoadFeedback } from "@/components/stockhome/list-load-feedback";
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
import { ActionNotice } from "@/components/ui/action-notice";
import { LoadingStatus } from "@/components/ui/loading-status";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mutationLock = useRef(false);
  const loadLock = useRef(false);
  const requestId = useRef(0);
  const ownerId = useRef<string | null>(null);
  const focusAfterLoad = useRef<HTMLElement | null>(null);
  const isBusy = isSaving || isDeleting;
  const hasFilters = statusFilters.length > 0 || expiringSoonOnly || categoryFilter !== "All" || searchQuery.trim() !== "";

  useLayoutEffect(() => {
    const previous = focusAfterLoad.current;
    focusAfterLoad.current = null;
    if (previous && (document.activeElement === document.body || document.activeElement === previous)) {
      const target = previous.isConnected ? previous : document.getElementById(hasLoaded ? "add-inventory-item" : "refresh-inventory");
      target?.focus({ preventScroll: true });
    }
  }, [items, hasLoaded]);

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

  const loadItems = useCallback(async () => {
    if (loadLock.current || mutationLock.current) return;
    loadLock.current = true;
    const request = ++requestId.current;
    const clearAccount = () => {
      const active = document.activeElement;
      focusAfterLoad.current = active instanceof HTMLElement && active.closest("[data-inventory-list]") ? active : null;
      ownerId.current = null;
      setUser(null); setItems([]); setHasLoaded(false);
      setIsDialogOpen(false); setIsDeleteDialogOpen(false);
      setEditingItem(null); setItemToDelete(null); setForm(emptyInventoryForm);
      setError(null); setNotice(null);
    };
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (request !== requestId.current) return;
      if (authError) {
        const rejected = authError.name === "AuthSessionMissingError" || (authError.status && authError.status >= 400 && authError.status < 500 && authError.status !== 429);
        if (!rejected) throw new Error("We couldn't check your session. Please try again.");
      }
      if (authError || !auth.user) {
        clearAccount();
        throw new Error("Sign in to view your inventory.");
      }
      if (ownerId.current !== auth.user.id) {
        clearAccount();
      }
      ownerId.current = auth.user.id;
      setUser(auth.user);
      const { data, error } = await supabase.from("inventory_items").select("*").eq("user_id", auth.user.id)
        .order("status", { ascending: true })
        .order("expiry_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (request !== requestId.current) return;
      if (error) throw new Error("We couldn't load your inventory. Please try again.");
      const active = document.activeElement;
      focusAfterLoad.current = active instanceof HTMLElement && active.closest("[data-inventory-list]") ? active : null;
      setItems((data ?? []) as InventoryItem[]);
      setHasLoaded(true);
    } catch (error) {
      if (request === requestId.current) setLoadError(error instanceof Error ? error.message : "We couldn't load your inventory. Please try again.");
    } finally {
      if (request === requestId.current) {
        loadLock.current = false;
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    // Skip the discarded Strict Mode setup before starting an account request.
    queueMicrotask(() => { if (active) void loadItems(); });
    return () => { active = false; requestId.current += 1; loadLock.current = false; };
  }, [loadItems]);

  function refreshItems() {
    if (loadLock.current || mutationLock.current) return;
    setIsLoading(true);
    setLoadError(null);
    void loadItems();
  }

  function clearFilters() {
    setStatusFilters([]); setExpiringSoonOnly(false); setCategoryFilter("All"); setSearchQuery("");
    document.getElementById("inventory-search")?.focus();
  }

  function openAddDialog() {
    if (loadLock.current || mutationLock.current || !hasLoaded) return;
    setEditingItem(null);
    setForm(emptyInventoryForm);
    setFormErrors({});
    setError(null);
    setIsDialogOpen(true);
  }

  function openEditDialog(item: InventoryItem) {
    if (loadLock.current || mutationLock.current) return;
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

    if (mutationLock.current || loadLock.current) return;
    mutationLock.current = true;
    setNotice(null);
    setIsSaving(true);
    setError(null);
    setFormErrors({});

    const payload = {
      name: form.name.trim(),
      status: form.status,
      quantity: Number(form.quantity.trim()),
      unit: form.unit.trim() || null,
      expiry_date: form.has_expiry_date ? form.expiry_date || null : null,
      category: form.category.trim() || null,
      notes: form.notes.trim() || null,
    };

    try {
      const result = editingItem
        ? await supabase.from("inventory_items").update(payload).eq("id", editingItem.id).eq("user_id", user.id).select().single()
        : await supabase.from("inventory_items").insert({ ...payload, user_id: user.id }).select().single();
      if (result.error) throw result.error;
      const saved = result.data as InventoryItem;
      setItems((current) => editingItem ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setNotice(`${saved.name} ${editingItem ? "updated" : "added to your inventory"}.`);
      setIsDialogOpen(false);
      setForm(emptyInventoryForm);
      setEditingItem(null);
    } catch {
      setError("We couldn't save this item. Please try again.");
    } finally {
      setIsSaving(false);
      mutationLock.current = false;
    }
  }

  function openDeleteDialog(item: InventoryItem) {
    if (loadLock.current || mutationLock.current) return;
    setItemToDelete(item);
    setError(null);
    setIsDeleteDialogOpen(true);
  }

  async function deleteItem() {
    if (!itemToDelete || !user || mutationLock.current || loadLock.current) {
      return;
    }

    mutationLock.current = true;
    setIsDeleting(true);
    setError(null);
    setNotice(null);
    try {
      const { error: deleteError } = await supabase.from("inventory_items").delete()
        .eq("id", itemToDelete.id).eq("user_id", user.id).select("id").single();
      if (deleteError) throw deleteError;
      setItems((current) => current.filter((item) => item.id !== itemToDelete.id));
      setNotice(`${itemToDelete.name} removed from your inventory.`);
      setItemToDelete(null);
      setIsDeleteDialogOpen(false);
    } catch {
      setError("We couldn't delete this item. Please try again.");
    } finally {
      setIsDeleting(false);
      mutationLock.current = false;
    }
  }

  return (
    <AppShell>
      <div className="grid gap-6">
        <div className="page-heading flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="page-eyebrow">Every essential, accounted for</p>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button id="refresh-inventory" variant="outline" aria-disabled={isLoading || isBusy} onClick={refreshItems}>Refresh inventory</Button>
          {!showGroceryList ? (
            <Button id="add-inventory-item" className="h-10 px-4 text-sm" aria-disabled={isLoading || isBusy || !hasLoaded} onClick={openAddDialog}>
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
              Add item
            </Button>
          ) : null}
          </div>
        </div>

        {error && !isDialogOpen && !isDeleteDialogOpen ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <ActionNotice message={notice} onDismiss={() => setNotice(null)} />
        <ListLoadFeedback loading={isLoading} hasLoaded={hasLoaded} error={loadError} label="inventory" onRetry={refreshItems} retryDisabled={isBusy} retryFocusTarget="#refresh-inventory" />

        {showGroceryList ? (
          user ? <GroceryList key={user.id} items={items} userId={user.id} inventoryLoading={isLoading} inventoryHasLoaded={hasLoaded} inventoryError={loadError} /> : isLoading ? <><GroceryPageSkeleton /><LoadingStatus messageGroup="groceries" className="justify-start text-sm text-primary">Loading your list… making room for snacks.</LoadingStatus></> : null
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
              isLoading={isLoading && !hasLoaded}
              hasLoaded={hasLoaded}
              actionsDisabled={isLoading || isBusy || !hasLoaded}
              hasFilters={hasFilters}
              onAddItem={openAddDialog}
              onClearFilters={clearFilters}
              items={filteredItems}
              onDeleteItem={openDeleteDialog}
              onEditItem={openEditDialog}
            />
          </>
        )}
      </div>

      <InventoryFormDialog
        editingItem={editingItem}
        error={error}
        errors={formErrors}
        form={form}
        isOpen={isDialogOpen}
        isSaving={isSaving}
        onFormChange={handleFormChange}
        onOpenChange={(open) => { if (!isSaving) setIsDialogOpen(open); }}
        onSubmit={handleSubmit}
      />

      <InventoryDeleteDialog
        isDeleting={isDeleting}
        error={error}
        isOpen={isDeleteDialogOpen}
        item={itemToDelete}
        onDelete={deleteItem}
        onOpenChange={(open) => { if (!isDeleting) setIsDeleteDialogOpen(open); }}
      />
    </AppShell>
  );
}
