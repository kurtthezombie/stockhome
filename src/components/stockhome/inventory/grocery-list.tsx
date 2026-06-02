"use client";

import {
  ClipboardCheckIcon,
  Copy02Icon,
  ShoppingBasket03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { InventoryItem } from "@/types";

import { statusLabels, statusVariant } from "./inventory-utils";

type GroceryListProps = {
  items: InventoryItem[];
};

function groceryLine(item: InventoryItem) {
  const quantity = item.quantity ? `${item.quantity} ${item.unit ?? ""}` : "";
  const detail = quantity.trim() ? ` (${quantity.trim()})` : "";

  return `- ${item.name}${detail}`;
}

export function GroceryList({ items }: GroceryListProps) {
  const [checkedItemIds, setCheckedItemIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const groupedItems = useMemo(() => {
    return items.reduce<Record<string, InventoryItem[]>>((groups, item) => {
      const category = item.category ?? "Uncategorized";

      groups[category] = [...(groups[category] ?? []), item];
      return groups;
    }, {});
  }, [items]);

  const listText = useMemo(() => {
    return Object.entries(groupedItems)
      .map(([category, categoryItems]) =>
        [category, ...categoryItems.map(groceryLine)].join("\n"),
      )
      .join("\n\n");
  }, [groupedItems]);

  async function copyList() {
    if (!listText) {
      return;
    }

    await navigator.clipboard.writeText(listText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function toggleItem(itemId: string) {
    setCheckedItemIds((currentItemIds) =>
      currentItemIds.includes(itemId)
        ? currentItemIds.filter((currentItemId) => currentItemId !== itemId)
        : [...currentItemIds, itemId],
    );
  }

  return (
    <Card className="bg-background">
      <CardContent className="grid gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
              <HugeiconsIcon icon={ShoppingBasket03Icon} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Grocery list
              </h2>
              <p className="text-xs text-muted-foreground">
                Built from low stock and unavailable inventory.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={copyList}
            disabled={items.length === 0}
          >
            <HugeiconsIcon
              icon={copied ? ClipboardCheckIcon : Copy02Icon}
              strokeWidth={2}
            />
            {copied ? "Copied" : "Copy list"}
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No restock items match the current filters.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(groupedItems).map(([category, categoryItems]) => (
              <div key={category} className="grid gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {category}
                </p>
                <div className="grid gap-2">
                  {categoryItems.map((item) => {
                    const isChecked = checkedItemIds.includes(item.id);

                    return (
                      <label
                        key={item.id}
                        className="flex items-start gap-3 rounded-md border bg-muted/20 px-3 py-2"
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleItem(item.id)}
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className={
                              isChecked
                                ? "block truncate text-sm font-medium text-muted-foreground line-through"
                                : "block truncate text-sm font-medium"
                            }
                          >
                            {item.name}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant={statusVariant(item.status)}>
                              {statusLabels[item.status]}
                            </Badge>
                            {item.quantity ? (
                              <span>
                                Current: {item.quantity} {item.unit ?? ""}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
