"use client";

import { type FormEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ActionNotice } from "@/components/ui/action-notice";
import { AnimatedList } from "@/components/ui/animated-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingStatus } from "@/components/ui/loading-status";
import { ListSkeleton } from "@/components/stockhome/list-skeleton";
import { ListLoadFeedback } from "@/components/stockhome/list-load-feedback";
import { supabase } from "@/lib/supabase";
import type { InventoryItem } from "@/types";
import { emptyGroceryForm, groceryListText, validateGroceryForm, type GroceryForm, type GroceryItem } from "./grocery-utils";
import { statusLabels } from "./inventory-utils";

async function fetchGroceries(userId: string) {
  const result = await supabase.from("grocery_items").select("*").eq("user_id", userId).order("created_at", { ascending: true });
  if (result.error) throw result.error;
  return result.data as GroceryItem[];
}

export function GroceryList({ items, userId, inventoryLoading = false, inventoryError = null, inventoryHasLoaded = true }: {
  items: InventoryItem[];
  userId: string;
  inventoryLoading?: boolean;
  inventoryError?: string | null;
  inventoryHasLoaded?: boolean;
}) {
  const [groceries, setGroceries] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const mutationLock = useRef(false);
  const loadingLock = useRef(true);
  const requestId = useRef(0);
  const focusAfterUpdate = useRef<string | null>(null);
  const [form, setForm] = useState<GroceryForm>(emptyGroceryForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<GroceryItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toRemove, setToRemove] = useState<GroceryItem | null>(null);

  useLayoutEffect(() => {
    if (focusAfterUpdate.current) {
      (document.getElementById(focusAfterUpdate.current) ?? document.getElementById("add-grocery-item"))?.focus();
      focusAfterUpdate.current = null;
    }
  }, [groceries]);

  const load = useCallback(() => {
    loadingLock.current = true;
    const request = ++requestId.current;
    return fetchGroceries(userId).then((data) => {
      if (request === requestId.current) {
        const focused = document.activeElement;
        if (focused instanceof HTMLElement && focused.dataset.groceryControl) focusAfterUpdate.current = focused.id;
        setGroceries(data);
        setHasLoaded(true);
        setLoadError(null);
      }
    }).catch(() => {
      if (request === requestId.current) setLoadError("We couldn't load your grocery list. Please try again.");
    }).finally(() => {
      if (request === requestId.current) {
        loadingLock.current = false;
        setLoading(false);
      }
    });
  }, [userId]);

  useEffect(() => {
    void load();
    return () => { requestId.current += 1; };
  }, [load]);

  function refresh() {
    if (mutationLock.current || loadingLock.current) return;
    setLoading(true);
    setLoadError(null);
    setNotice("");
    void load();
  }

  const pending = groceries.filter((item) => !item.is_purchased);
  const purchased = groceries.filter((item) => item.is_purchased);
  const ready = hasLoaded && !loading && !busy;
  const suggestions = items.filter((item) => item.status !== "available" && !groceries.some((grocery) =>
    grocery.inventory_item_id === item.id || grocery.name.trim().toLowerCase() === item.name.trim().toLowerCase(),
  ));

  function openAdd(item?: InventoryItem) {
    if (!ready || loadingLock.current || mutationLock.current) return;
    setEditing(null);
    setForm(item ? { inventory_item_id: item.id, name: item.name, quantity: "1", unit: item.unit ?? "" } : emptyGroceryForm);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(item: GroceryItem) {
    if (!ready || loadingLock.current || mutationLock.current) return;
    setEditing(item);
    setForm({ inventory_item_id: item.inventory_item_id ?? "", name: item.name, quantity: String(item.quantity), unit: item.unit });
    setFormError(null);
    setDialogOpen(true);
  }

  function startMutation() {
    if (mutationLock.current || loadingLock.current || !ready) return false;
    mutationLock.current = true;
    setBusy(true);
    setError(null);
    setNotice("");
    return true;
  }

  function finishMutation() {
    mutationLock.current = false;
    setBusy(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateGroceryForm(form);
    if (validation) { setFormError(validation); return; }
    if (!startMutation()) return;
    setFormError(null);
    try {
      const payload = { name: form.name.trim(), quantity: Number(form.quantity), unit: form.unit.trim(), inventory_item_id: form.inventory_item_id || null };
      const result = editing
        ? await supabase.from("grocery_items").update(payload).eq("id", editing.id).eq("user_id", userId).select().single()
        : await supabase.from("grocery_items").insert({ ...payload, user_id: userId }).select().single();
      if (result.error) {
        setFormError(result.error.code === "23505" ? "This item is already on your list. Edit it or uncheck it in Purchased to buy it again." : "We couldn't save this item. Please try again.");
        return;
      }
      const saved = result.data as GroceryItem;
      setGroceries((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]);
      setDialogOpen(false);
      setNotice(`${saved.name} saved to your grocery list.`);
    } catch { setFormError("We couldn't save this item. Please try again."); }
    finally { finishMutation(); }
  }

  async function toggle(item: GroceryItem, checked: boolean) {
    if (!startMutation()) return;
    const hadFocus = document.activeElement?.id === `grocery-${item.id}`;
    try {
      const result = await supabase.from("grocery_items").update({ is_purchased: checked }).eq("id", item.id).eq("user_id", userId).select().single();
      if (result.error) throw result.error;
      if (hadFocus && (document.activeElement?.id === `grocery-${item.id}` || document.activeElement === document.body)) {
        focusAfterUpdate.current = `grocery-${item.id}`;
      }
      setGroceries((current) => current.map((row) => row.id === item.id ? result.data as GroceryItem : row));
      setNotice(checked ? `${item.name} marked purchased.` : `${item.name} is back on your shopping list.`);
    } catch { setError("We couldn't update this item. Your previous selection is unchanged. Please try again."); }
    finally { finishMutation(); }
  }

  async function remove() {
    if (!toRemove || !startMutation()) return;
    try {
      const result = await supabase.from("grocery_items").delete().eq("id", toRemove.id).eq("user_id", userId).select("id").single();
      if (result.error) throw result.error;
      setGroceries((current) => current.filter((item) => item.id !== toRemove.id));
      setNotice(`${toRemove.name} removed from your grocery list.`);
      setToRemove(null);
    } catch { setError("We couldn't remove this item. Please try again."); }
    finally { finishMutation(); }
  }

  async function copyList() {
    if (!ready || loadingLock.current || mutationLock.current) return;
    setError(null);
    setNotice("");
    try {
      await navigator.clipboard.writeText(groceryListText(groceries));
      setNotice("Copied your remaining shopping items.");
    } catch { setError("Copy wasn't available. Allow clipboard access in your browser and try again."); }
  }

  function renderItem(item: GroceryItem) {
    return (
      <li key={item.id} data-motion-id={item.id} className={`motion-list-item flex flex-wrap items-center gap-3 rounded-xl border p-4 ${item.is_purchased ? "bg-muted/70" : "bg-card"}`}>
        <Checkbox className="motion-check" id={`grocery-${item.id}`} data-grocery-control="true" checked={item.is_purchased} disabled={busy} aria-disabled={!ready} onCheckedChange={(checked) => void toggle(item, checked === true)} />
        <label htmlFor={`grocery-${item.id}`} className="min-w-0 flex-1 cursor-pointer">
          <span className={`block break-words text-sm font-medium ${item.is_purchased ? "text-muted-foreground line-through" : ""}`}>{item.name}</span>
          <span className="text-xs text-muted-foreground">{item.is_purchased ? "Purchased" : "Buy"}: {item.quantity} {item.unit}</span>
        </label>
        <div className="flex gap-2">
          <Button id={`edit-grocery-${item.id}`} data-grocery-control="true" variant="ghost" size="sm" disabled={busy} aria-disabled={!ready} onClick={() => openEdit(item)} aria-label={`Edit ${item.name}`}>Edit</Button>
          <Button id={`remove-grocery-${item.id}`} data-grocery-control="true" variant="ghost" size="sm" disabled={busy} aria-disabled={!ready} onClick={() => { if (!ready || loadingLock.current || mutationLock.current) return; setError(null); setToRemove(item); }} aria-label={`Remove ${item.name}`}>Remove</Button>
        </div>
      </li>
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardContent className="grid gap-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><h2 className="text-lg font-semibold">Your grocery list</h2><p className="mt-1 text-sm text-muted-foreground">Plan what to buy, even when your shelves are full.</p></div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={!hasLoaded || busy || pending.length === 0} aria-disabled={!ready} onClick={() => void copyList()}>Copy remaining</Button>
              <Button id="refresh-groceries" variant="outline" disabled={busy} aria-disabled={loading} onClick={refresh}>Refresh</Button>
              <Button id="add-grocery-item" disabled={!hasLoaded || busy} aria-disabled={!ready} onClick={() => openAdd()}>Add item</Button>
            </div>
          </div>
          {loading && !hasLoaded ? <LoadingStatus messageGroup="groceries" className="justify-start text-sm text-primary">Loading your list… making room for snacks.</LoadingStatus> : null}
          {loading && !hasLoaded ? <ListSkeleton variant="groceries" /> : null}
          <ListLoadFeedback loading={loading} hasLoaded={hasLoaded} error={loadError} label="grocery list" onRetry={refresh} retryDisabled={busy} retryFocusTarget="#refresh-groceries" />
          {error && !toRemove ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          {hasLoaded ? <>
            <h3 className="text-sm font-semibold">To buy ({pending.length})</h3>
            {pending.length ? <AnimatedList as="ul" className="grid gap-3">{pending.map(renderItem)}</AnimatedList> : <div className="grid justify-items-start gap-3 rounded-xl bg-muted p-5"><p className="text-sm text-muted-foreground">{purchased.length ? "Everything on your list is purchased. Add another item or uncheck a purchased item to buy it again." : "Nothing to buy yet. Add an item or choose a restock suggestion below."}</p><Button variant="outline" disabled={busy} aria-disabled={!ready} onClick={() => openAdd()}>Add a shopping item</Button></div>}
            {purchased.length > 0 ? <div className="grid gap-3"><h3 className="text-sm font-semibold">Purchased ({purchased.length})</h3><AnimatedList as="ul" className="grid gap-3">{purchased.map(renderItem)}</AnimatedList></div> : null}
            <p className="text-xs leading-5 text-muted-foreground">Your list is saved to your account. Checking an item marks it purchased; update its stock separately in Inventory.</p>
          </> : null}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="grid gap-4">
          <div><h2 className="text-lg font-semibold">Restock suggestions</h2><p className="mt-1 text-sm text-muted-foreground">Low-stock and unavailable items. You decide what goes on your list.</p></div>
          {!inventoryHasLoaded ? (
            inventoryLoading ? <ListSkeleton variant="groceries" className="sm:grid-cols-2" /> : <p className="text-sm text-muted-foreground">{inventoryError ? "Restock suggestions are unavailable until your inventory loads. You can still add a shopping item above." : "Restock suggestions will appear when your inventory loads."}</p>
          ) : !hasLoaded ? (
            loading ? <ListSkeleton variant="groceries" className="sm:grid-cols-2" /> : <p className="text-sm text-muted-foreground">Restock suggestions will appear when your grocery list loads.</p>
          ) : suggestions.length ? <AnimatedList as="ul" className="grid gap-3 sm:grid-cols-2">{suggestions.map((item) => <li key={item.id} data-motion-id={item.id} className="flex items-center justify-between gap-3 rounded-xl border p-4"><div className="min-w-0"><p className="break-words text-sm font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{statusLabels[item.status]} · At home: {item.quantity} {item.unit}</p></div><Button variant="secondary" size="sm" disabled={busy} aria-disabled={!ready} onClick={() => openAdd(item)} aria-label={`Add ${item.name} to grocery list`}>Add to list</Button></li>)}</AnimatedList> : <p className="text-sm text-muted-foreground">No additional restock suggestions. You can still add anything you need.</p>}
        </CardContent>
      </Card>
      <ActionNotice message={notice} onDismiss={() => setNotice("")} />
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!busy) setDialogOpen(open); }}>
        <DialogContent returnFocusFallback="#add-grocery-item">
          <DialogHeader><DialogTitle>{editing ? "Edit shopping item" : "Add to your grocery list"}</DialogTitle><DialogDescription>Choose any item at home or add something new. Set the amount you want to buy.</DialogDescription></DialogHeader>
          <form onSubmit={save} className="grid gap-4" aria-busy={busy}>
            <fieldset disabled={busy} className="grid min-w-0 gap-4">
              <div className="grid gap-2"><Label htmlFor="grocery-source">Choose from inventory (optional)</Label><select id="grocery-source" className="h-11 w-full min-w-0 rounded-md border bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" value={form.inventory_item_id} onChange={(event) => { const item = items.find((row) => row.id === event.target.value); setForm((current) => ({ ...current, inventory_item_id: item?.id ?? "", name: item?.name ?? current.name, unit: item?.unit ?? "" })); }}><option value="">New / custom item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name} — {statusLabels[item.status]}</option>)}</select></div>
              <div className="grid gap-2"><Label htmlFor="grocery-name">Item name</Label><Input id="grocery-name" required maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Rice, coffee, a little treat…" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label htmlFor="grocery-quantity">Amount to buy</Label><Input id="grocery-quantity" type="number" step="any" required value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></div>
                <div className="grid gap-2"><Label htmlFor="grocery-unit">Unit (optional)</Label><Input id="grocery-unit" maxLength={30} value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="kg, bottles, packs" /></div>
              </div>
            </fieldset>
            {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}
            <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? <LoadingStatus>Saving… snacks secured.</LoadingStatus> : "Save item"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(toRemove)} onOpenChange={(open) => { if (!open && !busy) { setToRemove(null); setError(null); } }}>
        <DialogContent returnFocusFallback="#add-grocery-item"><DialogHeader><DialogTitle>Remove {toRemove?.name}?</DialogTitle><DialogDescription>This removes it from your grocery list. Your inventory stays the same.</DialogDescription></DialogHeader>{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => { setToRemove(null); setError(null); }}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={() => void remove()}>{busy ? <LoadingStatus>Removing…</LoadingStatus> : "Remove item"}</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
