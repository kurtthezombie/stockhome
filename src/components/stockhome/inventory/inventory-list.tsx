"use client";

import { useSyncExternalStore } from "react";
import { Delete02Icon, Edit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingStatus } from "@/components/ui/loading-status";
import { Card, CardContent } from "@/components/ui/card";
import type { InventoryItem } from "@/types";
import { cn } from "@/lib/utils";

import {
  isExpiringSoon,
  itemCardClassName,
  statusLabels,
  statusVariant,
} from "./inventory-utils";

const layoutOptions = [
  { value: "list", label: "List", description: "One column", columns: "grid-cols-1" },
  { value: "grid", label: "Grid", description: "Two columns", columns: "grid-cols-1 md:grid-cols-2" },
  { value: "compact", label: "Compact", description: "Three columns on wide screens", columns: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" },
] as const;

type InventoryLayout = (typeof layoutOptions)[number]["value"];
const layoutStorageKey = "stockhome:inventory-layout";
const layoutChangeEvent = "stockhome:inventory-layout-change";
let fallbackLayout: InventoryLayout = "grid";
let storageUnavailable = false;

function readLayout(): InventoryLayout {
  if (storageUnavailable) return fallbackLayout;
  try {
    const saved = window.localStorage.getItem(layoutStorageKey);
    return layoutOptions.find((option) => option.value === saved)?.value ?? "grid";
  } catch {
    return fallbackLayout;
  }
}

function subscribeToLayout(onChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === layoutStorageKey || event.key === null) onChange();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(layoutChangeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(layoutChangeEvent, onChange);
  };
}

function saveLayout(layout: InventoryLayout) {
  fallbackLayout = layout;
  try {
    window.localStorage.setItem(layoutStorageKey, layout);
    storageUnavailable = false;
  } catch {
    // Keep the switch usable when browser storage is unavailable.
    storageUnavailable = true;
  }
  window.dispatchEvent(new Event(layoutChangeEvent));
}

function serverLayout(): InventoryLayout {
  return "grid";
}

type InventoryListProps = {
  isLoading: boolean;
  items: InventoryItem[];
  onDeleteItem: (item: InventoryItem) => void;
  onEditItem: (item: InventoryItem) => void;
};

export function InventoryList({
  isLoading,
  items,
  onDeleteItem,
  onEditItem,
}: InventoryListProps) {
  const layout = useSyncExternalStore(subscribeToLayout, readLayout, serverLayout);
  const columns = layoutOptions.find((option) => option.value === layout)!.columns;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{isLoading ? "Your inventory" : `${items.length} ${items.length === 1 ? "item" : "items"}`}</p>
        <div role="group" aria-label="Inventory layout" className="hidden items-center gap-1 rounded-xl border bg-card p-1 md:flex">
          {layoutOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="icon-lg"
              variant={layout === option.value ? "secondary" : "ghost"}
              aria-pressed={layout === option.value}
              aria-label={`${option.label}: ${option.description}`}
              title={`${option.label}: ${option.description}`}
              onClick={() => saveLayout(option.value)}
            >
              <span
                aria-hidden="true"
                className={cn("grid size-4 gap-0.5", option.value === "list" ? "grid-cols-1" : option.value === "grid" ? "grid-cols-2" : "grid-cols-3")}
              >
                {Array.from({ length: option.value === "list" ? 2 : option.value === "grid" ? 4 : 6 }, (_, index) => (
                  <span key={index} className="rounded-[1px] border border-current" />
                ))}
              </span>
            </Button>
          ))}
        </div>
      </div>
      <div className={cn("grid items-start gap-4", columns)}>
        {items.map((item) => {
          const expiringSoon = isExpiringSoon(item.expiry_date);
          const notes = item.notes?.trim();

          return (
            <Card key={item.id} className={itemCardClassName(item, expiringSoon)}>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <h2 className="min-w-0 break-words text-base font-semibold leading-6">
                    {item.name}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={statusVariant(item.status)}>
                      {statusLabels[item.status]}
                    </Badge>
                    {expiringSoon ? (
                      <Badge variant="destructive">Expiring soon</Badge>
                    ) : null}
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 text-sm">
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">In stock</dt>
                    <dd className="mt-1 break-words text-lg font-semibold">
                      {item.quantity ?? "Not set"}
                      {item.unit ? <span className="ml-1 text-sm font-normal text-muted-foreground">{item.unit}</span> : null}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Expiry</dt>
                    <dd className="mt-1 font-medium">
                      {item.expiry_date ? <time dateTime={item.expiry_date}>{item.expiry_date}</time> : "No expiry set"}
                    </dd>
                  </div>
                  {item.category ? (
                    <div className="col-span-2 min-w-0">
                      <dt className="text-xs text-muted-foreground">Category</dt>
                      <dd className="mt-1 break-words font-medium">{item.category}</dd>
                    </div>
                  ) : null}
                </dl>

                {notes ? (
                  <div className="rounded-lg bg-background/60 px-3 py-2.5">
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="mt-1 line-clamp-2 break-words whitespace-pre-wrap text-sm leading-6">{notes}</p>
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-2 border-t pt-3">
                  <Button
                    variant="outline"
                    size="icon-lg"
                    onClick={() => onEditItem(item)}
                    aria-label={`Edit ${item.name} and view full notes`}
                    title={`Edit ${item.name}`}
                  >
                    <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => onDeleteItem(item)}
                    aria-label={`Delete ${item.name}`}
                    title={`Delete ${item.name}`}
                  >
                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!isLoading && items.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              No inventory items in this view.
            </CardContent>
          </Card>
        ) : null}
      </div>
      {isLoading ? (
        <LoadingStatus className="justify-start text-sm text-primary">Loading your stock… checking behind the pasta.</LoadingStatus>
      ) : null}
    </>
  );
}
