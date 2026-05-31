"use client";

import type { User } from "@supabase/supabase-js";
import { FormEvent, useEffect, useState } from "react";

import { AppShell } from "@/components/stockhome/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import type { InventoryItem, InventoryStatus } from "@/types";

type InventoryForm = {
  name: string;
  status: InventoryStatus;
  quantity: string;
  unit: string;
  expiry_date: string;
  category: string;
  notes: string;
};

const emptyForm: InventoryForm = {
  name: "",
  status: "available",
  quantity: "",
  unit: "",
  expiry_date: "",
  category: "",
  notes: "",
};

const statusLabels: Record<InventoryStatus, string> = {
  available: "Available",
  low_stock: "Low stock",
  unavailable: "Unavailable",
};

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

export function InventoryPageClient() {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [form, setForm] = useState<InventoryForm>(emptyForm);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      expiry_date: item.expiry_date ?? "",
      category: item.category ?? "",
      notes: item.notes ?? "",
    });
    setError(null);
    setIsDialogOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
      expiry_date: form.expiry_date || null,
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

  async function deleteItem(item: InventoryItem) {
    const { error: deleteError } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", item.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setItems((currentItems) =>
      currentItems.filter((currentItem) => currentItem.id !== item.id),
    );
  }

  return (
    <AppShell>
      <div className="grid gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Inventory
            </h1>
            <p className="text-sm text-muted-foreground">
              Track household stock, availability, and expiry dates.
            </p>
          </div>
          <Button onClick={openAddDialog}>Add item</Button>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="rounded-lg bg-background ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const expiringSoon = isExpiringSoon(item.expiry_date);

                return (
                  <TableRow
                    key={item.id}
                    className={expiringSoon ? "bg-destructive/5" : undefined}
                  >
                    <TableCell className="min-w-40 font-medium">
                      {item.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(item.status)}>
                        {statusLabels[item.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.quantity ?? "-"} {item.unit ?? ""}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{item.expiry_date ?? "-"}</span>
                        {expiringSoon ? (
                          <Badge variant="destructive">Soon</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{item.category ?? "-"}</TableCell>
                    <TableCell className="max-w-72 truncate">
                      {item.notes ?? "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(item)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteItem(item)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!isLoading && items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No inventory items yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
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
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="item-name">Name</Label>
              <Input
                id="item-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                required
              />
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
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      quantity: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="item-unit">Unit</Label>
                <Input
                  id="item-unit"
                  value={form.unit}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      unit: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="item-expiry-date">Expiry date</Label>
                <Input
                  id="item-expiry-date"
                  type="date"
                  value={form.expiry_date}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      expiry_date: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="item-category">Category</Label>
                <Input
                  id="item-category"
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="item-notes">Notes</Label>
              <Textarea
                id="item-notes"
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
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
    </AppShell>
  );
}

