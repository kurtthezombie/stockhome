"use client";

import { Add01Icon, Delete02Icon, Edit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { User } from "@supabase/supabase-js";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/stockhome/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  return "bg-background";
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
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskFilter>("todo");

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

  async function loadTasks() {
    setIsLoading(true);
    setError(null);

    const { data, error: loadError } = await supabase
      .from("tasks")
      .select("*")
      .order("is_done", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
    } else {
      setTasks((data ?? []) as Task[]);
    }

    setIsLoading(false);
  }

  useEffect(() => {
    async function loadUserAndTasks() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);

      if (data.user) {
        await loadTasks();
      } else {
        setIsLoading(false);
      }
    }

    loadUserAndTasks();
  }, []);

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

    setIsSaving(true);
    setError(null);

    const payload = {
      title: form.title.trim(),
      due_date: form.due_date || null,
      notes: form.notes.trim() || null,
    };

    const result = editingTask
      ? await supabase.from("tasks").update(payload).eq("id", editingTask.id)
      : await supabase.from("tasks").insert({
          ...payload,
          is_done: false,
          user_id: user.id,
        });

    setIsSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setIsDialogOpen(false);
    setForm(emptyForm);
    setEditingTask(null);
    await loadTasks();
  }

  async function toggleTask(task: Task) {
    const { error: updateError } = await supabase
      .from("tasks")
      .update({ is_done: !task.is_done })
      .eq("id", task.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setTasks((currentTasks) =>
      currentTasks.map((currentTask) =>
        currentTask.id === task.id
          ? { ...currentTask, is_done: !currentTask.is_done }
          : currentTask,
      ),
    );
  }

  function openDeleteDialog(task: Task) {
    setTaskToDelete(task);
    setError(null);
    setIsDeleteDialogOpen(true);
  }

  async function deleteTask() {
    if (!taskToDelete) {
      return;
    }

    setIsDeleting(true);

    const { error: deleteError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskToDelete.id);

    setIsDeleting(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setTasks((currentTasks) =>
      currentTasks.filter((currentTask) => currentTask.id !== taskToDelete.id),
    );
    setTaskToDelete(null);
    setIsDeleteDialogOpen(false);
  }

  async function clearCompletedTasks() {
    setIsClearing(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from("tasks")
      .delete()
      .eq("is_done", true);

    setIsClearing(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setTasks((currentTasks) =>
      currentTasks.filter((currentTask) => !currentTask.is_done),
    );
    setIsClearDialogOpen(false);
  }

  return (
    <AppShell>
      <div className="grid gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
            <p className="text-sm text-muted-foreground">
              Track household chores and small errands.
            </p>
          </div>
          <Button className="h-10 px-4 text-sm" onClick={openAddDialog}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
            Add task
          </Button>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={filter}
            onValueChange={(value) => setFilter(value as TaskFilter)}
          >
            <TabsList className="grid w-full grid-cols-3 sm:w-fit">
              <TabsTrigger value="all">All {taskCounts.all}</TabsTrigger>
              <TabsTrigger value="todo">Todo {taskCounts.todo}</TabsTrigger>
              <TabsTrigger value="completed">
                Completed {taskCounts.completed}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {filter === "completed" && taskCounts.completed > 0 ? (
            <Button
              variant="destructive"
              className="h-10 px-4 text-sm sm:h-8 sm:text-xs"
              onClick={() => setIsClearDialogOpen(true)}
            >
              Clear completed
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3">
          {filteredTasks.map((task) => (
            <Card
              key={task.id}
              size="sm"
              className={taskCardClassName(task)}
            >
              <CardContent className="grid gap-3">
                <div className="flex items-start gap-3">
                  <div className="pt-1">
                    <Checkbox
                      checked={task.is_done}
                      onCheckedChange={() => toggleTask(task)}
                      aria-label={`Mark ${task.title} done`}
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
                    aria-label={`Edit ${task.title}`}
                    title="Edit"
                  >
                    <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon-lg"
                    onClick={() => openDeleteDialog(task)}
                    aria-label={`Delete ${task.title}`}
                    title="Delete"
                  >
                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!isLoading && filteredTasks.length === 0 ? (
            <Card className="bg-background">
              <CardContent className="py-8 text-center text-muted-foreground">
                No tasks in this view.
              </CardContent>
            </Card>
          ) : null}
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading tasks...</p>
        ) : null}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit task" : "Add task"}</DialogTitle>
            <DialogDescription>
              Keep the title short enough to scan on mobile.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleSubmit}>
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

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete task?</DialogTitle>
            <DialogDescription>
              This will permanently remove {taskToDelete?.title ?? "this task"}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
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

      <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear completed tasks?</DialogTitle>
            <DialogDescription>
              This will permanently delete {taskCounts.completed} completed
              task{taskCounts.completed === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsClearDialogOpen(false)}
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
