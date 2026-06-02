import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Delete02Icon,
  Edit02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { InventoryItem } from "@/types";

import {
  isExpiringSoon,
  itemCardClassName,
  statusLabels,
  statusVariant,
} from "./inventory-utils";

type InventoryListProps = {
  expandedItemId: string | null;
  isLoading: boolean;
  items: InventoryItem[];
  onDeleteItem: (item: InventoryItem) => void;
  onEditItem: (item: InventoryItem) => void;
  onExpandedItemChange: (itemId: string | null) => void;
};

export function InventoryList({
  expandedItemId,
  isLoading,
  items,
  onDeleteItem,
  onEditItem,
  onExpandedItemChange,
}: InventoryListProps) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => {
          const expiringSoon = isExpiringSoon(item.expiry_date);
          const isExpanded = expandedItemId === item.id;
          const nextExpandedItemId = isExpanded ? null : item.id;

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
                    onClick={() => onExpandedItemChange(nextExpandedItemId)}
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
                      onClick={() => onExpandedItemChange(nextExpandedItemId)}
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
                        <p className="text-xs text-muted-foreground">Expiry</p>
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
                        <p className="text-xs text-muted-foreground">Status</p>
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
                        onClick={() => onEditItem(item)}
                        aria-label={`Edit ${item.name}`}
                        title="Edit"
                      >
                        <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon-lg"
                        onClick={() => onDeleteItem(item)}
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
        {!isLoading && items.length === 0 ? (
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
    </>
  );
}
