"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/stockhome/app-shell";
import { LoadingStatus } from "@/components/ui/loading-status";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import type { InventoryItem, Task } from "@/types";

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

export function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      setIsLoading(true);
      setError(null);

      const [tasksResult, inventoryResult] = await Promise.all([
        supabase.from("tasks").select("*").order("created_at", {
          ascending: false,
        }),
        supabase.from("inventory_items").select("*").order("created_at", {
          ascending: false,
        }),
      ]);

      if (tasksResult.error || inventoryResult.error) {
        setError(
          tasksResult.error?.message ??
            inventoryResult.error?.message ??
            "Unable to load dashboard.",
        );
      } else {
        setTasks((tasksResult.data ?? []) as Task[]);
        setItems((inventoryResult.data ?? []) as InventoryItem[]);
      }

      setIsLoading(false);
    }

    loadDashboard();
  }, []);

  const summaries = useMemo(
    () => [
      {
        label: "Pending tasks",
        value: tasks.filter((task) => !task.is_done).length,
        detail: "Tasks still open",
        href: "/tasks",
      },
      {
        label: "Low stock",
        value: items.filter((item) => item.status === "low_stock").length,
        detail: "Items to restock soon",
        href: "/inventory?status=low_stock",
      },
      {
        label: "Unavailable",
        value: items.filter((item) => item.status === "unavailable").length,
        detail: "Items currently missing",
        href: "/inventory?status=unavailable",
      },
      {
        label: "Expiring soon",
        value: items.filter((item) => isExpiringSoon(item.expiry_date)).length,
        detail: "Within the next 7 days",
        href: "/inventory?expiring=soon",
      },
    ],
    [items, tasks],
  );

  return (
    <AppShell>
      <div className="grid gap-6">
        <div className="page-heading">
          <p className="page-eyebrow">Your home at a glance</p>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Quick view of household tasks and stock status.
          </p>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {isLoading ? <LoadingStatus className="justify-start text-sm text-primary">Loading your overview… taking stock of things.</LoadingStatus> : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {summaries.map((summary) => (
            <Link key={summary.label} href={summary.href}>
              <Card className="h-full border-t-4 border-t-primary/60 transition-colors hover:bg-secondary/50">
                <CardHeader>
                  <CardDescription>{summary.label}</CardDescription>
                  <CardTitle className="text-4xl font-semibold text-primary">{isLoading ? "—" : summary.value}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {summary.detail}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
