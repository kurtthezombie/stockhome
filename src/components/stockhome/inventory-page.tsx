"use client";

import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Delete02Icon,
  Edit02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { User } from "@supabase/supabase-js";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/stockhome/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import type { InventoryItem, InventoryStatus } from "@/types";

type InventoryForm = {
  name: string;
  status: InventoryStatus;
  quantity: string;
  unit: string;
  has_expiry_date: boolean;
  expiry_date: string;
  category: string;
  notes: string;
};

type InventoryFormErrors = Partial<Record<keyof InventoryForm, string>>;

type InventoryFilter = InventoryStatus;

type InventoryPageClientProps = {
  title?: string;
  description?: string;
  initialStatusFilters?: InventoryFilter[];
  initialExpiringSoonOnly?: boolean;
};

const emptyForm: InventoryForm = {
  name: "",
  status: "available",
  quantity: "",
  unit: "",
  has_expiry_date: false,
  expiry_date: "",
  category: "",
  notes: "",
};

const statusLabels: Record<InventoryStatus, string> = {
  available: "Available",
  low_stock: "Low stock",
  unavailable: "Unavailable",
};

const categoryOptions = [
  "Food & cooking",
  "Drinks",
  "Cleaning & laundry",
  "Bathroom & personal care",
  "Paper & disposables",
  "Medicine",
  "Tools & maintenance",
  "Other",
];

function statusVariant(status: InventoryStatus) {
  if (status === "unavailable") {
    return "destructive";
  }

  if (status === "low_stock") {
    return "outline";
  }

  return "secondary";
}

function isExpiringSoon(date: string | null) {
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

function itemCardClassName(item: InventoryItem, expiringSoon: boolean) {
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

function statusFilterClassName(status: InventoryFilter, isSelected: boolean) {
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

function validateInventoryForm(form: InventoryForm) {
  const errors: InventoryFormErrors = {};
  const trimmedName = form.name.trim();
  const trimmedQuantity = form.quantity.trim();
  const trimmedUnit = form.unit.trim();

  if (!trimmedName) {
    errors.name = "Enter an item name.";
  } else if (trimmedName.length > 80) {
    errors.name = "Keep the item name under 80 characters.";
  }

  if (!trimmedQuantity) {
    errors.quantity = "Enter a quantity.";
  } else {
    const quantity = Number(trimmedQuantity);

    if (Number.isNaN(quantity)) {
      errors.quantity = "Quantity must be a number.";
    } else if (quantity < 0) {
      errors.quantity = "Quantity cannot be negative.";
    }
  }

  if (trimmedUnit && !trimmedQuantity) {
    errors.quantity = "Add a quantity when using a unit.";
  }

  if (trimmedQuantity && !trimmedUnit) {
    errors.unit = "Add a unit, like bottle, kg, or roll.";
  } else if (trimmedUnit.length > 30) {
    errors.unit = "Keep the unit under 30 characters.";
  }

  if (form.has_expiry_date && !form.expiry_date) {
    errors.expiry_date = "Choose an expiry date or turn this off.";
  }

  if (!form.category) {
    errors.category = "Choose a category.";
  }

  if (form.notes.length > 300) {
    errors.notes = "Keep notes under 300 characters.";
  }

  return errors;
}

export function InventoryPageClient({
  title = "Inventory",
  description = "Track household stock, availability, and expiry dates.",
  initialStatusFilters = [],
  initialExpiringSoonOnly = false,
}: InventoryPageClientProps) {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [form, setForm] = useState<InventoryForm>(emptyForm);
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
  const [formErrors, setFormErrors] = useState<InventoryFormErrors>({});

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
    setForm(emptyForm);
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateInventoryForm(form);

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    if (!user) {
      setError("You must be logged in to save inventory items.");
      return;
    }

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
    setForm(emptyForm);
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
          <Button className="h-10 px-4 text-sm" onClick={openAddDialog}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
            Add item
          </Button>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {expiringSoonOnly ? (
          <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <span>Showing items expiring soon.</span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="ml-auto text-destructive hover:bg-destructive/10"
              onClick={() => setExpiringSoonOnly(false)}
            >
              Clear
            </Button>
          </div>
        ) : null}

        <Input
          value={searchQuery}
          placeholder="Search items"
          onChange={(event) => setSearchQuery(event.target.value)}
          className="h-10 max-w-md"
        />

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0">
          {[
            { label: "Available", value: "available" },
            { label: "Low stock", value: "low_stock" },
            { label: "Unavailable", value: "unavailable" },
          ].map((filterOption) => {
            const status = filterOption.value as InventoryFilter;
            const isSelected = statusFilters.includes(status);

            return (
              <Button
                key={filterOption.value}
                variant="outline"
                className={cn(
                  "h-8 shrink-0 px-2.5 text-xs",
                  statusFilterClassName(status, isSelected),
                )}
                onClick={() => toggleStatusFilter(status)}
              >
                {filterOption.label}
              </Button>
            );
          })}
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {categoryFilters.map((category) => (
            <Button
              key={category}
              variant={categoryFilter === category ? "secondary" : "outline"}
              size="sm"
              className="h-9 shrink-0 px-3"
              onClick={() => setCategoryFilter(category)}
            >
              {category}
            </Button>
          ))}
        </div>

        <div className="-mt-3 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[0.625rem] leading-4 text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full border bg-background" />
            Available
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-amber-200 ring-1 ring-amber-300" />
            Low stock
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-destructive/30 ring-1 ring-destructive/30" />
            Needs attention
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {filteredItems.map((item) => {
            const expiringSoon = isExpiringSoon(item.expiry_date);
            const isExpanded = expandedItemId === item.id;

            return (
              <Card
                key={item.id}
                size="sm"
                className={cn(itemCardClassName(item, expiringSoon))}
              >
                <CardContent className="grid gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() =>
                        setExpandedItemId(isExpanded ? null : item.id)
                      }
                      aria-expanded={isExpanded}
                    >
                      <span className="block truncate text-sm font-semibold">
                        {item.name}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-2">
                        <Badge variant={statusVariant(item.status)}>
                          {statusLabels[item.status]}
                        </Badge>
                        {expiringSoon ? (
                          <Badge variant="destructive">Expiring soon</Badge>
                        ) : null}
                      </span>
                    </button>
                    <div className="flex shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        onClick={() =>
                          setExpandedItemId(isExpanded ? null : item.id)
                        }
                        aria-label={
                          isExpanded
                            ? `Collapse ${item.name}`
                            : `Expand ${item.name}`
                        }
                        title={isExpanded ? "Collapse" : "Expand"}
                      >
                        <HugeiconsIcon
                          icon={isExpanded ? ArrowUp01Icon : ArrowDown01Icon}
                          strokeWidth={2}
                        />
                      </Button>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="grid gap-3 border-t pt-3 text-sm">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Quantity
                          </p>
                          <p className="font-medium">
                            {item.quantity ?? "-"} {item.unit ?? ""}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Expiry
                          </p>
                          <p className="font-medium">
                            {item.expiry_date ?? "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Category
                          </p>
                          <p className="font-medium">{item.category ?? "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Status
                          </p>
                          <p className="font-medium">
                            {statusLabels[item.status]}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Notes</p>
                        <p className="mt-1 whitespace-pre-wrap">
                          {item.notes ?? "-"}
                        </p>
                      </div>
                      <div className="flex justify-end gap-2 border-t pt-3">
                        <Button
                          variant="outline"
                          size="icon-lg"
                          onClick={() => openEditDialog(item)}
                          aria-label={`Edit ${item.name}`}
                          title="Edit"
                        >
                          <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon-lg"
                          onClick={() => openDeleteDialog(item)}
                          aria-label={`Delete ${item.name}`}
                          title="Delete"
                        >
                          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
          {!isLoading && filteredItems.length === 0 ? (
            <Card className="bg-background md:col-span-2">
              <CardContent className="py-8 text-center text-muted-foreground">
                No inventory items in this view.
              </CardContent>
            </Card>
          ) : null}
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading inventory...</p>
        ) : null}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit inventory item" : "Add inventory item"}
            </DialogTitle>
            <DialogDescription>
              Use status to keep restock decisions obvious.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-2">
              <Label htmlFor="item-name">Name</Label>
              <Input
                id="item-name"
                value={form.name}
                placeholder="Soy sauce"
                aria-invalid={Boolean(formErrors.name)}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
              {formErrors.name ? (
                <p className="text-xs text-destructive">{formErrors.name}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    status: value as InventoryStatus,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="low_stock">Low stock</SelectItem>
                  <SelectItem value="unavailable">Unavailable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="item-quantity">Quantity</Label>
                <Input
                  id="item-quantity"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.quantity}
                  aria-invalid={Boolean(formErrors.quantity)}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      quantity: event.target.value,
                    }))
                  }
                />
                {formErrors.quantity ? (
                  <p className="text-xs text-destructive">
                    {formErrors.quantity}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="item-unit">Unit</Label>
                <Input
                  id="item-unit"
                  value={form.unit}
                  placeholder="bottle, kg, roll"
                  aria-invalid={Boolean(formErrors.unit)}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      unit: event.target.value,
                    }))
                  }
                />
                {formErrors.unit ? (
                  <p className="text-xs text-destructive">{formErrors.unit}</p>
                ) : null}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="item-has-expiry-date"
                    checked={form.has_expiry_date}
                    onCheckedChange={(checked) =>
                      setForm((current) => ({
                        ...current,
                        has_expiry_date: checked === true,
                        expiry_date: checked === true ? current.expiry_date : "",
                      }))
                    }
                  />
                  <Label htmlFor="item-has-expiry-date">Has expiry date</Label>
                </div>
                {form.has_expiry_date ? (
                  <div className="grid gap-2">
                    <Label htmlFor="item-expiry-date">Expiry date</Label>
                    <Input
                      id="item-expiry-date"
                      type="date"
                      value={form.expiry_date}
                      aria-invalid={Boolean(formErrors.expiry_date)}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          expiry_date: event.target.value,
                        }))
                      }
                    />
                    {formErrors.expiry_date ? (
                      <p className="text-xs text-destructive">
                        {formErrors.expiry_date}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      category: value,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.category ? (
                  <p className="text-xs text-destructive">
                    {formErrors.category}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="item-notes">Notes</Label>
              <Textarea
                id="item-notes"
                value={form.notes}
                placeholder="Brand, storage location, or reminder"
                aria-invalid={Boolean(formErrors.notes)}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
              {formErrors.notes ? (
                <p className="text-xs text-destructive">{formErrors.notes}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete item?</DialogTitle>
            <DialogDescription>
              This will permanently remove {itemToDelete?.name ?? "this item"}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={deleteItem}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
