import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { InventoryFilter } from "./inventory-types";
import { statusFilterClassName } from "./inventory-utils";

type InventoryFiltersProps = {
  categoryFilters: string[];
  categoryFilter: string;
  expiringSoonOnly: boolean;
  searchQuery: string;
  statusFilters: InventoryFilter[];
  onCategoryFilterChange: (category: string) => void;
  onClearExpiringSoon: () => void;
  onSearchQueryChange: (query: string) => void;
  onStatusFilterToggle: (status: InventoryFilter) => void;
};

const statusFilterOptions: Array<{
  label: string;
  value: InventoryFilter;
}> = [
  { label: "Available", value: "available" },
  { label: "Low stock", value: "low_stock" },
  { label: "Unavailable", value: "unavailable" },
];

export function InventoryFilters({
  categoryFilters,
  categoryFilter,
  expiringSoonOnly,
  searchQuery,
  statusFilters,
  onCategoryFilterChange,
  onClearExpiringSoon,
  onSearchQueryChange,
  onStatusFilterToggle,
}: InventoryFiltersProps) {
  return (
    <>
      {expiringSoonOnly ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <span>Showing items expiring soon.</span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="ml-auto text-destructive hover:bg-destructive/10"
            onClick={onClearExpiringSoon}
          >
            Clear
          </Button>
        </div>
      ) : null}

      <Input
        value={searchQuery}
        placeholder="Search items"
        onChange={(event) => onSearchQueryChange(event.target.value)}
        className="h-10 max-w-md"
      />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0">
        {statusFilterOptions.map((filterOption) => {
          const isSelected = statusFilters.includes(filterOption.value);

          return (
            <Button
              key={filterOption.value}
              variant="outline"
              className={cn(
                "h-8 shrink-0 px-2.5 text-xs",
                statusFilterClassName(filterOption.value, isSelected),
              )}
              onClick={() => onStatusFilterToggle(filterOption.value)}
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
            onClick={() => onCategoryFilterChange(category)}
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
    </>
  );
}
