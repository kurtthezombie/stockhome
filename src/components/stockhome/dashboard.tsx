"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/stockhome/app-shell";
import { DashboardStockChart } from "@/components/stockhome/dashboard-stock-chart";
import { DashboardDetailsSkeleton } from "@/components/stockhome/dashboard-skeleton";
import { dashboardMetrics } from "@/components/stockhome/dashboard-utils";
import type { GroceryItem } from "@/components/stockhome/inventory/grocery-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingStatus } from "@/components/ui/loading-status";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import type { InventoryItem, Task } from "@/types";

// Read all pages so dashboard counts do not stop at the API's row limit.
async function loadRows<T>(table: "tasks" | "inventory_items" | "grocery_items", userId: string): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from(table).select("*").eq("user_id", userId)
      .order("id", { ascending: true }).range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []) as T[]);
    if (!data || data.length < pageSize) return rows;
  }
}

function dueLabel(date: string, today: string) {
  if (date < today) return "Overdue";
  if (date === today) return "Today";
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function Dashboard() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [groceries, setGroceries] = useState<GroceryItem[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [checkedAt, setCheckedAt] = useState(new Date(0));
  const ownerId = useRef<string | null>(null);
  const isInitialLoading = isLoading && !hasLoaded;

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      setIsLoading(true);
      setErrors([]);
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!active) return;
        if (error) {
          const sessionRejected = error.name === "AuthSessionMissingError"
            || (error.status !== undefined && error.status >= 400 && error.status < 500 && error.status !== 429);
          if (!sessionRejected) throw new Error("Unable to check your session. Please try refreshing again.");
        }
        if (error || !data.user) {
          setTasks(null); setItems(null); setGroceries(null);
          setUpdatedAt(null);
          ownerId.current = null;
          throw new Error("Sign in to view your dashboard.");
        }
        // Retained data belongs only to the account that loaded it.
        if (ownerId.current !== null && ownerId.current !== data.user.id) {
          setTasks(null); setItems(null); setGroceries(null);
          setUpdatedAt(null);
          setHasLoaded(false);
        }
        ownerId.current = data.user.id;
        const results = await Promise.allSettled([
          loadRows<Task>("tasks", data.user.id),
          loadRows<InventoryItem>("inventory_items", data.user.id),
          loadRows<GroceryItem>("grocery_items", data.user.id),
        ]);
        if (!active) return;
        const [taskResult, stockResult, groceryResult] = results;
        if (taskResult.status === "fulfilled") setTasks(taskResult.value);
        if (stockResult.status === "fulfilled") setItems(stockResult.value);
        if (groceryResult.status === "fulfilled") setGroceries(groceryResult.value);
        const labels = ["Tasks", "Inventory", "Groceries"];
        setErrors(results.flatMap((result, index) => result.status === "rejected" ? [`${labels[index]} could not load: ${result.reason instanceof Error ? result.reason.message : "Please try again."}`] : []));
        const completedAt = new Date();
        setCheckedAt(completedAt);
        // A partial refresh must not label retained data as newly updated.
        if (results.every((result) => result.status === "fulfilled")) setUpdatedAt(completedAt);
      } catch (error) {
        if (!active) return;
        setErrors([error instanceof Error ? error.message : "Unable to load dashboard."]);
      } finally {
        if (active) {
          setIsLoading(false);
          setHasLoaded(true);
        }
      }
    }
    void loadDashboard();
    return () => { active = false; };
  }, [refresh]);

  const metrics = useMemo(() => dashboardMetrics(items ?? [], tasks ?? [], groceries ?? [], checkedAt), [items, tasks, groceries, checkedAt]);
  const summaries = [
    { label: "Inventory items", value: items?.length, detail: `${metrics.stock.available} available`, href: "/inventory" },
    { label: "Pending tasks", value: tasks ? metrics.pending : undefined, detail: `${metrics.overdue} overdue · ${metrics.dueToday} due today`, href: "/tasks" },
    { label: "Low stock", value: items ? metrics.stock.low_stock : undefined, detail: "Time for a top-up", href: "/inventory?status=low_stock" },
    { label: "Unavailable", value: items ? metrics.stock.unavailable : undefined, detail: "Missing from your shelves", href: "/inventory?status=unavailable" },
    { label: "Expiring soon", value: items ? metrics.expiring.length : undefined, detail: "Today through the next 7 days", href: "/inventory?expiring=soon" },
    { label: "On your grocery list", value: groceries ? metrics.remainingGroceries.length : undefined, detail: `${metrics.purchased} marked purchased`, href: "/inventory/restock" },
  ];

  return (
    <AppShell>
      <div className="grid gap-6">
        <div className="page-heading motion-enter flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="page-eyebrow">Your home at a glance</p>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">A little less guesswork. A little more household harmony.</p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <Button variant="outline" className="w-56 max-w-full" disabled={isLoading} onClick={() => setRefresh((value) => value + 1)}>
              {isLoading && hasLoaded ? <LoadingStatus>Refreshing dashboard…</LoadingStatus> : "Refresh dashboard"}
            </Button>
            <p className="min-h-4 text-xs text-muted-foreground">{updatedAt ? `Last full update ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</p>
          </div>
        </div>

        {errors.length > 0 && <div role="alert" className="grid gap-1 rounded-xl bg-destructive/5 p-4 text-sm text-destructive">
          {errors.map((error) => <p key={error}>{error}</p>)}
          {(tasks !== null || items !== null || groceries !== null) && <p>Last available values are shown. Some data may be out of date; refresh to try again.</p>}
        </div>}
        {isInitialLoading && <LoadingStatus messageGroup="overview" className="justify-start text-sm text-primary">Loading your overview… taking stock of things.</LoadingStatus>}

        <div data-loading={isInitialLoading} aria-busy={isInitialLoading} className="motion-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {summaries.map((summary) => (
            <Link key={summary.label} href={summary.href} className="dashboard-summary-link rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              <Card className="dashboard-summary-card h-full border-t-4 border-t-primary/60 hover:bg-secondary/50">
                <CardHeader>
                  <CardDescription>{summary.label}</CardDescription>
                  <CardTitle className="text-4xl font-semibold text-primary">{isInitialLoading ? <Skeleton className="h-10 w-16" /> : summary.value ?? "—"}</CardTitle>
                </CardHeader>
                <CardContent>{isInitialLoading ? <Skeleton className="h-4 w-4/5" /> : <p className="text-xs text-muted-foreground">{summary.value === undefined ? "Data unavailable" : summary.detail}</p>}</CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {isInitialLoading ? <DashboardDetailsSkeleton /> : <>
          <div className="motion-stagger grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            {items ? <DashboardStockChart categories={metrics.categories} /> : <UnavailableCard title="Stock by category" />}
            <Card>
              <CardHeader><CardTitle>Task progress</CardTitle><CardDescription>Small wins count. Even taking out the bins.</CardDescription></CardHeader>
              <CardContent className="grid gap-5">
                {tasks ? <>
                  <div><p className="text-4xl font-semibold text-primary">{metrics.completionRate}%</p><p className="mt-1 text-sm text-muted-foreground">{metrics.completed} of {tasks.length} tasks completed</p></div>
                  <progress aria-label="Task completion" value={metrics.completed} max={Math.max(1, tasks.length)} className="h-3 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary" />
                  <dl className="grid gap-3 text-sm">
                    <div className="flex justify-between"><dt>Still to do</dt><dd className="font-semibold">{metrics.pending}</dd></div>
                    <div className="flex justify-between"><dt>Due today</dt><dd className="font-semibold">{metrics.dueToday}</dd></div>
                    <div className="flex justify-between"><dt>Overdue</dt><dd className={metrics.overdue ? "font-semibold text-destructive" : "font-semibold"}>{metrics.overdue}</dd></div>
                  </dl>
                  {tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet. Add your first household to-do.</p>}
                  <Link href="/tasks" className="text-sm font-medium text-primary hover:underline">Manage tasks →</Link>
                </> : <p className="text-sm text-muted-foreground">Task data is unavailable. Try refreshing.</p>}
              </CardContent>
            </Card>
          </div>

          <div className="motion-stagger grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Coming up & overdue</CardTitle><CardDescription>Open tasks due through the next 7 days.</CardDescription></CardHeader>
              <CardContent className="grid gap-4">
                {!tasks ? <p className="text-sm text-muted-foreground">Task data is unavailable.</p> : metrics.taskAttention.length ? <ul className="grid gap-3">{metrics.taskAttention.slice(0, 4).map((task) => (
                  <li key={task.id} className="flex items-start justify-between gap-3 border-b border-border/70 pb-3 last:border-0 last:pb-0">
                    <Link href="/tasks" className="min-w-0 break-words text-sm font-medium hover:text-primary">{task.title}</Link>
                    <Badge className="shrink-0" variant={task.due_date! < metrics.today ? "destructive" : "secondary"}>{dueLabel(task.due_date!, metrics.today)}</Badge>
                  </li>
                ))}</ul> : <p className="text-sm text-muted-foreground">Nothing due this week. The to-do list is behaving.</p>}
                <Link href="/tasks" className="text-sm font-medium text-primary hover:underline">View all tasks →</Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Use it soon</CardTitle><CardDescription>{items ? `${metrics.expired.length} past expiry · ${metrics.expiring.length} expiring within 7 days` : "Items with dates worth checking."}</CardDescription></CardHeader>
              <CardContent className="grid gap-4">
                {!items ? <p className="text-sm text-muted-foreground">Inventory data is unavailable.</p> : metrics.expiryAttention.length ? <ul className="grid gap-3">{metrics.expiryAttention.slice(0, 4).map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 border-b border-border/70 pb-3 last:border-0 last:pb-0">
                    <div className="min-w-0"><Link href="/inventory" className="break-words text-sm font-medium hover:text-primary">{item.name}</Link><p className="mt-1 text-xs text-muted-foreground">{item.quantity}{item.unit ? ` ${item.unit}` : ""}</p></div>
                    <Badge className="shrink-0" variant={item.expiry_date! < metrics.today ? "destructive" : "secondary"}>{item.expiry_date! < metrics.today ? "Past expiry" : dueLabel(item.expiry_date!, metrics.today)}</Badge>
                  </li>
                ))}</ul> : <p className="text-sm text-muted-foreground">No upcoming expiry dates. Your pantry can exhale.</p>}
                <Link href="/inventory" className="text-sm font-medium text-primary hover:underline">Check inventory →</Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Next shopping trip</CardTitle><CardDescription>{groceries ? `${metrics.remainingGroceries.length} items left to pick up` : "Your remaining grocery items."}</CardDescription></CardHeader>
              <CardContent className="grid gap-4">
                {!groceries ? <p className="text-sm text-muted-foreground">Grocery data is unavailable.</p> : metrics.remainingGroceries.length ? <ul className="grid gap-3">{metrics.remainingGroceries.slice(0, 4).map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 border-b border-border/70 pb-3 last:border-0 last:pb-0">
                    <Link href="/inventory/restock" className="min-w-0 break-words text-sm font-medium hover:text-primary">{item.name}</Link><span className="shrink-0 text-sm text-muted-foreground">{item.quantity}{item.unit ? ` ${item.unit}` : ""}</span>
                  </li>
                ))}</ul> : <p className="text-sm text-muted-foreground">Your shopping list is clear. Resist the snack aisle. Or don&apos;t.</p>}
                <Link href="/inventory/restock" className="text-sm font-medium text-primary hover:underline">Open grocery list →</Link>
              </CardContent>
            </Card>
          </div>
        </>}
      </div>
    </AppShell>
  );
}

function UnavailableCard({ title }: { title: string }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Inventory data is unavailable. Try refreshing.</p></CardContent></Card>;
}
