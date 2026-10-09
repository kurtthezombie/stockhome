"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { chartCategories, type CategoryStock } from "@/components/stockhome/dashboard-utils";

const statuses = [
  { key: "available", label: "Available", color: "bg-primary", href: "/inventory?status=available" },
  { key: "low_stock", label: "Low stock", color: "bg-amber-500", href: "/inventory?status=low_stock" },
  { key: "unavailable", label: "Unavailable", color: "bg-destructive", href: "/inventory?status=unavailable" },
] as const;

export function DashboardStockChart({ categories }: { categories: CategoryStock[] }) {
  const [restockOnly, setRestockOnly] = useState(false);
  const rows = chartCategories(categories, restockOnly);
  const categoryCount = categories.filter((category) => !restockOnly || category.low_stock + category.unavailable > 0).length;
  const count = (row: CategoryStock) => restockOnly ? row.low_stock + row.unavailable : row.total;
  const max = Math.max(1, ...rows.map(count));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock by category</CardTitle>
        <CardDescription>How your shelves stack up. Counts represent distinct inventory items.</CardDescription>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Stock chart view">
          <Button size="sm" variant={restockOnly ? "outline" : "secondary"} aria-pressed={!restockOnly} onClick={() => setRestockOnly(false)}>All stock</Button>
          <Button size="sm" variant={restockOnly ? "secondary" : "outline"} aria-pressed={restockOnly} onClick={() => setRestockOnly(true)}>Needs restock</Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <figure aria-label={restockOnly ? "Low-stock and unavailable items by category" : "Inventory status by category"}>
          {rows.length ? <ul className="grid gap-4">
            {rows.map((row, index) => (
              <li key={`${row.name}-${index}`} className="grid gap-1.5">
                <div className="flex justify-between gap-3 text-sm"><span className="min-w-0 break-words font-medium">{row.name}</span><span className="shrink-0 text-muted-foreground">{count(row)} {count(row) === 1 ? "item" : "items"}</span></div>
                <div aria-hidden="true" title={`${row.available} available, ${row.low_stock} low stock, ${row.unavailable} unavailable`} className="flex h-5 overflow-hidden rounded-md bg-muted">
                  <div className="chart-bar-reveal flex h-full w-full">
                    {statuses.filter((status) => !restockOnly || status.key !== "available").map((status) => (
                      <span key={status.key} className={`chart-bar-segment ${status.color}`} style={{ width: `${row[status.key] / max * 100}%` }} />
                    ))}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{restockOnly ? "" : `${row.available} available · `}{row.low_stock} low stock · {row.unavailable} unavailable</span>
              </li>
            ))}
          </ul> : <p className="py-8 text-center text-sm text-muted-foreground">{restockOnly ? "Nothing needs restocking. Your shelves are having a good day." : "Add inventory items to see your stock breakdown."}</p>}
          <figcaption className="mt-4 text-xs text-muted-foreground">Current inventory snapshot{categoryCount > 6 ? "; smaller categories are grouped together" : ""}.</figcaption>
        </figure>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {statuses.filter((status) => !restockOnly || status.key !== "available").map((status) => (
            <Link key={status.key} href={status.href} className="inline-flex items-center gap-2 text-xs underline-offset-4 hover:underline">
              <span aria-hidden="true" className={`size-2.5 rounded-full ${status.color}`} />{status.label}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
