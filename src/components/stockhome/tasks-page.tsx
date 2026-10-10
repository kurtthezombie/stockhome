"use client";

import { Add01Icon, Delete02Icon, Edit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { User } from "@supabase/supabase-js";
import { FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/stockhome/app-shell";
import { ListSkeleton } from "@/components/stockhome/list-skeleton";
import { ListLoadFeedback } from "@/components/stockhome/list-load-feedback";
import { ActionNotice } from "@/components/ui/action-notice";
import { AnimatedList } from "@/components/ui/animated-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingStatus } from "@/components/ui/loading-status";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import type { Task } from "@/types";

type TaskForm = {
  title: string;
  due_date: string;
  notes: string;
};

type TaskFilter = "all" | "todo" | "completed";

const emptyForm: TaskForm = {
  title: "",
  due_date: "",
  notes: "",
};

function isRejectedSession(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const { name, status } = error as { name?: string; status?: number };
  return name === "AuthSessionMissingError" || (typeof status === "number" && status >= 400 && status < 500 && status !== 429);
}

function getTaskDueState(task: Task) {
  if (task.is_done || !task.due_date) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(`${task.due_date}T00:00:00`);
  const diffDays = Math.ceil(
    (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays < 0) {
    return "overdue";
  }

  if (diffDays === 0) {
    return "today";
  }

  if (diffDays <= 3) {
    return "soon";
  }

  return null;
}

function taskCardClassName(task: Task) {
  const dueState = getTaskDueState(task);

  if (task.is_done) {
    return "bg-muted/70 text-muted-foreground";
  }

  if (dueState === "overdue") {
    return "bg-destructive/5 ring-destructive/20";
  }

  if (dueState === "today" || dueState === "soon") {
    return "bg-amber-50 ring-amber-200";
  }

  return "bg-card";
}

function taskDueBadge(task: Task) {
  const dueState = getTaskDueState(task);

  if (dueState === "overdue") {
    return <Badge variant="destructive">Overdue</Badge>;
  }

  if (dueState === "today") {
    return <Badge variant="outline">Due today</Badge>;
  }

  if (dueState === "soon") {
    return <Badge variant="outline">Due soon</Badge>;
  }

  return null;
}

export function TasksPageClient() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskFilter>("todo");
  const [notice, setNotice] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const mutationLock = useRef(false);
  const loadLock = useRef(false);
  const mounted = useRef(false);
  const loadRequest = useRef(0);
  const ownerId = useRef<string | null>(null);
  const focusAfterLoad = useRef<HTMLElement | null>(null);
  const focusAfterUpdate = useRef<string | null>(null);
  const isBusy = isSaving || isDeleting || isClearing || updatingTaskId !== null;

  useLayoutEffect(() => {
    if (focusAfterUpdate.current) {
      document.getElementById(focusAfterUpdate.current)?.focus();
      focusAfterUpdate.current = null;
    }
  }, [tasks]);

  useLayoutEffect(() => {
    const previous = focusAfterLoad.current;
    focusAfterLoad.current = null;
    if (previous && (document.activeElement === previous || document.activeElement === document.body)) {
      const fallback = document.getElementById(hasLoaded && user ? "add-task" : "refresh-tasks");
      (previous.isConnected ? previous : fallback)?.focus({ preventScroll: true });
    }
  }, [tasks, hasLoaded, user]);

  function startMutation() {
    if (mutationLock.current) return false;
    mutationLock.current = true;
    // A list requested before this write must not replace the saved result.
    loadRequest.current += 1;
    loadLock.current = false;
    setIsLoading(false);
    setNotice(null);
    setError(null);
    return true;
  }

  const taskCounts = useMemo(
    () => ({
      all: tasks.length,
      todo: tasks.filter((task) => !task.is_done).length,
      completed: tasks.filter((task) => task.is_done).length,
    }),
    [tasks],
  );

  const filteredTasks = useMemo(() => {
    if (filter === "completed") {
      return tasks.filter((task) => task.is_done);
    }

    if (filter === "todo") {
      return tasks.filter((task) => !task.is_done);
    }

    return tasks;
  }, [filter, tasks]);

  const loadTasks = useCallback(async () => {
    if (mutationLock.current || loadLock.current) return;
    loadLock.current = true;
    const request = ++loadRequest.current;
    const isCurrent = () => mounted.current && request === loadRequest.current;
    const rememberListFocus = () => {
      const active = document.activeElement;
      focusAfterLoad.current = active instanceof HTMLElement && active.closest("[data-task-list]") ? active : null;
    };
    const clearAccount = () => {
      rememberListFocus();
      ownerId.current = null;
      setUser(null);
      setTasks([]);
      setHasLoaded(false);
      setIsDialogOpen(false);
      setIsDeleteDialogOpen(false);
      setIsClearDialogOpen(false);
      setForm(emptyForm);
      setEditingTask(null);
      setTaskToDelete(null);
      setNotice(null);
      setError(null);
    };
    let failureMessage = "We couldn't verify your account. Please try again.";
    let checkingSession = true;
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!isCurrent()) return;
      if (authError) throw authError;
      if (!authData.user) {
        clearAccount();
        failureMessage = "Please sign in again to load your tasks.";
        throw new Error(failureMessage);
      }
      if (ownerId.current !== authData.user.id) clearAccount();
      ownerId.current = authData.user.id;
      setUser(authData.user);
      checkingSession = false;
      failureMessage = "We couldn't load your tasks. Please try again.";
      const { data, error: requestError } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", authData.user.id)
        .order("is_done", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (!isCurrent()) return;
      if (requestError) throw requestError;
      rememberListFocus();
      setTasks((data ?? []) as Task[]);
      setHasLoaded(true);
    } catch (error) {
      if (!isCurrent()) return;
      if (checkingSession && isRejectedSession(error)) {
        clearAccount();
        failureMessage = "Please sign in again to load your tasks.";
      }
      setLoadError(failureMessage);
    } finally {
      if (isCurrent()) {
        loadLock.current = false;
        setIsLoading(false);
      }
    }
  }, []);

  function refreshTasks() {
    if (loadLock.current || mutationLock.current) return;
    setIsLoading(true);
    setLoadError(null);
    void loadTasks();
  }

  useEffect(() => {
    mounted.current = true;
    let active = true;
    // Skip the discarded Strict Mode setup before starting an account request.
    queueMicrotask(() => { if (active) void loadTasks(); });
    return () => {
      active = false;
      mounted.current = false;
      loadRequest.current += 1;
      loadLock.current = false;
    };
  }, [loadTasks]);

  function openAddDialog() {
    setEditingTask(null);
    setForm(emptyForm);
    setError(null);
    setIsDialogOpen(true);
  }

  function openEditDialog(task: Task) {
    setEditingTask(task);
    setForm({
      title: task.title,
      due_date: task.due_date ?? "",
      notes: task.notes ?? "",
    });
    setError(null);
    setIsDialogOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      setError("You must be logged in to save tasks.");
      return;
    }
    if (!form.title.trim()) { setError("Enter a task title."); return; }
    if (!startMutation()) return;
    setIsSaving(true);

    const payload = {
      title: form.title.trim(),
      due_date: form.due_date || null,
      notes: form.notes.trim() || null,
    };

    try {
      const result = editingTask
        ? await supabase.from("tasks").update(payload).eq("id", editingTask.id).eq("user_id", user.id).select().single()
        : await supabase.from("tasks").insert({ ...payload, is_done: false, user_id: user.id }).select().single();
      if (!mounted.current) return;
      if (result.error) throw result.error;
      const saved = result.data as Task;
      setTasks((current) => editingTask ? current.map((task) => task.id === saved.id ? saved : task) : [saved, ...current]);
      setNotice(`${saved.title} ${editingTask ? "updated" : "added to your tasks"}.`);
      setIsDialogOpen(false);
      setForm(emptyForm);
      setEditingTask(null);
    } catch {
      if (mounted.current) setError("We couldn't save this task. Please try again.");
    } finally {
      if (mounted.current) setIsSaving(false);
      mutationLock.current = false;
    }
  }

  async function toggleTask(task: Task) {
    if (!user || !startMutation()) return;
    const hadFocus = document.activeElement?.id === `task-${task.id}`;
    setUpdatingTaskId(task.id);
    try {
      const result = await supabase.from("tasks").update({ is_done: !task.is_done })
        .eq("id", task.id).eq("user_id", user.id).select().single();
      if (!mounted.current) return;
      if (result.error) throw result.error;
      const saved = result.data as Task;
      if (hadFocus && (document.activeElement?.id === `task-${task.id}` || document.activeElement === document.body)) {
        const remaining = filteredTasks.filter((row) => row.id !== task.id);
        const next = remaining[Math.min(filteredTasks.findIndex((row) => row.id === task.id), remaining.length - 1)];
        focusAfterUpdate.current = filter === "all" ? `task-${task.id}` : next ? `task-${next.id}` : "add-task";
      }
      setTasks((current) => current.map((row) => row.id === task.id ? saved : row));
      setNotice(saved.is_done ? `${saved.title} completed. One less thing to do.` : `${saved.title} is back on your to-do list.`);
    } catch {
      if (mounted.current) setError("We couldn't update this task. Your previous selection is unchanged. Please try again.");
    } finally {
      if (mounted.current) setUpdatingTaskId(null);
      mutationLock.current = false;
    }
  }

  function openDeleteDialog(task: Task) {
    setTaskToDelete(task);
    setError(null);
    setIsDeleteDialogOpen(true);
  }

  async function deleteTask() {
    if (!taskToDelete || !user || !startMutation()) {
      return;
    }

    setIsDeleting(true);

    try {
      const { error: deleteError } = await supabase.from("tasks").delete()
        .eq("id", taskToDelete.id).eq("user_id", user.id).select("id").single();
      if (!mounted.current) return;
      if (deleteError) throw deleteError;
      setTasks((current) => current.filter((task) => task.id !== taskToDelete.id));
      setNotice(`${taskToDelete.title} deleted.`);
      setTaskToDelete(null);
      setIsDeleteDialogOpen(false);
    } catch {
      if (mounted.current) setError("We couldn't delete this task. Please try again.");
    } finally {
      if (mounted.current) setIsDeleting(false);
      mutationLock.current = false;
    }
  }

  async function clearCompletedTasks() {
    if (!user || !startMutation()) return;
    setIsClearing(true);
    try {
      const { data, error: deleteError } = await supabase.from("tasks").delete()
        .eq("is_done", true).eq("user_id", user.id).select("id");
      if (!mounted.current) return;
      if (deleteError) throw deleteError;
      const removed = new Set((data ?? []).map((task: { id: string }) => task.id));
      setTasks((current) => current.filter((task) => !removed.has(task.id)));
      setNotice(`${removed.size} completed ${removed.size === 1 ? "task" : "tasks"} cleared.`);
      setIsClearDialogOpen(false);
    } catch {
      if (mounted.current) setError("We couldn't clear completed tasks. Please try again.");
    } finally {
      if (mounted.current) setIsClearing(false);
      mutationLock.current = false;
    }
  }

  return (
    <AppShell>
      <div className="grid gap-6">
        <div className="page-heading flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="page-eyebrow">A little progress, every day</p>
            <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
            <p className="text-sm text-muted-foreground">
              Track household chores and small errands.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button id="refresh-tasks" variant="outline" aria-disabled={isLoading || isBusy} className="h-10 px-4 text-sm" onClick={refreshTasks}>
              Refresh tasks
            </Button>
            <Button id="add-task" disabled={isBusy || !hasLoaded || !user} className="h-10 px-4 text-sm" onClick={openAddDialog}>
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
              Add task
            </Button>
          </div>
        </div>

        {error && !isDialogOpen && !isDeleteDialogOpen && !isClearDialogOpen ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <ListLoadFeedback loading={isLoading} hasLoaded={hasLoaded} error={loadError} label="tasks" onRetry={refreshTasks} retryDisabled={isBusy} retryFocusTarget="#refresh-tasks" />
        <ActionNotice message={notice} onDismiss={() => setNotice(null)} />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={filter}
            onValueChange={(value) => setFilter(value as TaskFilter)}
          >
            <TabsList className="grid w-full grid-cols-3 sm:w-fit">
              <TabsTrigger value="all">All {hasLoaded ? taskCounts.all : ""}</TabsTrigger>
              <TabsTrigger value="todo">Todo {hasLoaded ? taskCounts.todo : ""}</TabsTrigger>
              <TabsTrigger value="completed">
                Completed {hasLoaded ? taskCounts.completed : ""}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {filter === "completed" && taskCounts.completed > 0 ? (
            <Button
              variant="destructive"
              className="h-10 px-4 text-sm sm:h-8 sm:text-xs"
              disabled={isBusy}
              onClick={() => { setError(null); setIsClearDialogOpen(true); }}
            >
              Clear completed
            </Button>
          ) : null}
        </div>

        {isLoading && !hasLoaded ? <ListSkeleton variant="tasks" /> : null}
        <AnimatedList data-task-list className="grid gap-3">
          {filteredTasks.map((task) => (
            <Card
              key={task.id}
              data-motion-id={task.id}
              size="sm"
              className={`motion-list-item ${taskCardClassName(task)}`}
            >
              <CardContent className="grid gap-3">
                <div className="flex items-start gap-3">
                  <div className="pt-1">
                    <Checkbox
                      id={`task-${task.id}`}
                      className="motion-check"
                      disabled={isBusy}
                      checked={task.is_done}
                      onCheckedChange={() => toggleTask(task)}
                      aria-label={`Mark ${task.title} ${task.is_done ? "not done" : "done"}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2
                        className={
                          task.is_done
                            ? "break-words text-sm font-medium text-muted-foreground line-through"
                            : "break-words text-sm font-medium"
                        }
                      >
                        {task.title}
                      </h2>
                      {task.is_done ? (
                        <Badge variant="secondary">Done</Badge>
                      ) : null}
                      {taskDueBadge(task)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Due: {task.due_date ?? "No date"}</span>
                      {task.notes ? <span>{task.notes}</span> : null}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t pt-3">
                  <Button
                    variant="outline"
                    size="icon-lg"
                    onClick={() => openEditDialog(task)}
                    disabled={isBusy}
                    aria-label={`Edit ${task.title}`}
                    title="Edit"
                  >
                    <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon-lg"
                    onClick={() => openDeleteDialog(task)}
                    disabled={isBusy}
                    aria-label={`Delete ${task.title}`}
                    title="Delete"
                  >
                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {hasLoaded && filteredTasks.length === 0 ? (
            <Card className="bg-background">
              <CardContent className="grid justify-items-center gap-3 py-8 text-center">
                <div className="grid gap-1">
                  <p className="font-medium">{tasks.length === 0 ? "No tasks yet." : filter === "todo" ? "Your to-do list is clear." : "No completed tasks yet."}</p>
                  <p className="text-muted-foreground">{tasks.length === 0 ? "Add a household chore or errand to get started." : filter === "todo" ? "Add a new task or review the ones you've finished." : "Completed chores and errands will appear here."}</p>
                </div>
                {tasks.length > 0 && filter !== "all" ? (
                  <Button variant="outline" onClick={() => setFilter("all")}>View all tasks</Button>
                ) : (
                  <Button disabled={isBusy || !user} onClick={openAddDialog}>Add your first task</Button>
                )}
              </CardContent>
            </Card>
          ) : null}
        </AnimatedList>
        {isLoading && !hasLoaded ? (
          <LoadingStatus messageGroup="tasks" className="justify-start text-sm text-primary">Loading tasks… the pantry won’t organize itself.</LoadingStatus>
        ) : null}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!isSaving) setIsDialogOpen(open); }}>
        <DialogContent returnFocusFallback="#add-task">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit task" : "Add task"}</DialogTitle>
            <DialogDescription>
              Keep the title short enough to scan on mobile.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <fieldset disabled={isSaving} className="grid min-w-0 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-due-date">Due date</Label>
              <Input
                id="task-due-date"
                type="date"
                value={form.due_date}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    due_date: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-notes">Notes</Label>
              <Textarea
                id="task-notes"
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
            </div>
            </fieldset>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <LoadingStatus>Saving… noted, not jarred.</LoadingStatus> : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => { if (!isDeleting) setIsDeleteDialogOpen(open); }}>
        <DialogContent returnFocusFallback="#add-task">
          <DialogHeader>
            <DialogTitle>Delete task?</DialogTitle>
            <DialogDescription>
              This will permanently remove {taskToDelete?.title ?? "this task"}.
            </DialogDescription>
          </DialogHeader>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={deleteTask}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isClearDialogOpen} onOpenChange={(open) => { if (!isClearing) setIsClearDialogOpen(open); }}>
        <DialogContent returnFocusFallback="#add-task">
          <DialogHeader>
            <DialogTitle>Clear completed tasks?</DialogTitle>
            <DialogDescription>
              This will permanently delete {taskCounts.completed} completed
              task{taskCounts.completed === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsClearDialogOpen(false)}
              disabled={isClearing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={clearCompletedTasks}
              disabled={isClearing}
            >
              {isClearing ? "Clearing..." : "Clear completed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
