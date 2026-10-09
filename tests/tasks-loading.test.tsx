import { StrictMode } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";

import { TasksPageClient } from "@/components/stockhome/tasks-page";
import type { Task } from "@/types";

const { request, getUser } = vi.hoisted(() => ({ request: vi.fn(), getUser: vi.fn() }));
type Request = { operation: string; payload: Record<string, unknown> | null; single: boolean; filters: Record<string, unknown> };
vi.mock("@/components/stockhome/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/lib/supabase", () => ({ supabase: {
  auth: { getUser },
  from: () => {
    const args: Request = { operation: "select", payload: null, single: false, filters: {} };
    const builder = {
      select: () => builder,
      order: () => builder,
      eq: (key: string, value: unknown) => { args.filters[key] = value; return builder; },
      insert: (payload: Record<string, unknown>) => { args.operation = "insert"; args.payload = payload; return builder; },
      update: (payload: Record<string, unknown>) => { args.operation = "update"; args.payload = payload; return builder; },
      delete: () => { args.operation = "delete"; return builder; },
      single: () => request({ ...args, single: true }),
      then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => request(args).then(resolve, reject),
    };
    return builder;
  },
} }));

const task: Task = { id: "task-1", user_id: "account", title: "Wash dishes", is_done: false, due_date: null, notes: null, created_at: "2026-10-09", updated_at: "2026-10-09" };
const signedIn = { data: { user: { id: "account" } }, error: null };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  request.mockReset();
  getUser.mockReset();
  getUser.mockResolvedValue(signedIn);
  request.mockImplementation((args: Request) => Promise.resolve({ data: args.operation === "select" || !args.single ? [task] : { ...task, ...args.payload }, error: null }));
});

test("refresh retains task rows, filter counts, and keyboard focus after a thrown failure", async () => {
  const user = userEvent.setup();
  const { container } = render(<TasksPageClient />);
  const checkbox = await screen.findByRole("checkbox", { name: "Mark Wash dishes done" });
  await user.click(screen.getByRole("tab", { name: "All 1" }));
  const refresh = deferred<unknown>();
  request.mockImplementationOnce(() => refresh.promise);
  await user.click(screen.getByRole("button", { name: "Refresh tasks" }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  checkbox.focus();
  expect(screen.getByRole("tab", { name: "All 1" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("checkbox")).toBe(checkbox);
  expect(checkbox).toBeEnabled();
  expect(container.querySelector('[data-slot="list-skeleton"]')).not.toBeInTheDocument();
  expect(screen.getByText(/Refreshing your tasks/).closest('[role="status"]')).toBeInTheDocument();
  await act(async () => refresh.reject(new Error("Network disconnected")));
  expect(screen.getByRole("alert")).toHaveTextContent("Your previous list is still shown");
  expect(checkbox).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  expect(screen.getByRole("checkbox")).toBe(checkbox);
  expect(screen.getByRole("tab", { name: "All 1" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("button", { name: "Refresh tasks" })).toHaveFocus();
});

test("Refresh tasks retains focus and ignores repeated activation while a request is pending", async () => {
  const user = userEvent.setup();
  render(<TasksPageClient />);
  await screen.findByRole("checkbox");
  const refresh = deferred<unknown>();
  request.mockImplementationOnce(() => refresh.promise);
  const refreshButton = screen.getByRole("button", { name: "Refresh tasks" });
  await user.click(refreshButton);
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  expect(refreshButton).toHaveFocus();
  expect(refreshButton).toHaveAttribute("aria-disabled", "true");
  await user.keyboard("{Enter}");
  expect(request).toHaveBeenCalledTimes(2);
  await act(async () => refresh.resolve({ data: [task], error: null }));
  expect(refreshButton).toHaveFocus();
});

test.each(["removed", "completed"])("refresh returns focus to Add task when the focused row is %s", async (change) => {
  const user = userEvent.setup();
  render(<TasksPageClient />);
  const checkbox = await screen.findByRole("checkbox");
  const refresh = deferred<unknown>();
  request.mockImplementationOnce(() => refresh.promise);
  await user.click(screen.getByRole("button", { name: "Refresh tasks" }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  checkbox.focus();
  await act(async () => refresh.resolve({ data: change === "removed" ? [] : [{ ...task, is_done: true }], error: null }));
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add task" })).toHaveFocus();
  expect(screen.getByRole("tab", { name: "Todo 0" })).toHaveAttribute("aria-selected", "true");
});

test("an empty successful list remains available while refreshing and after failure", async () => {
  const user = userEvent.setup();
  request.mockResolvedValueOnce({ data: [], error: null });
  const { container } = render(<TasksPageClient />);
  const addFirst = await screen.findByRole("button", { name: "Add your first task" });
  const refresh = deferred<unknown>();
  request.mockImplementationOnce(() => refresh.promise);
  await user.click(screen.getByRole("button", { name: "Refresh tasks" }));
  expect(addFirst).toBeVisible();
  expect(screen.getByRole("tab", { name: "Todo 0" })).toHaveAttribute("aria-selected", "true");
  expect(container.querySelector('[data-slot="list-skeleton"]')).not.toBeInTheDocument();
  await act(async () => refresh.resolve({ data: null, error: { message: "Offline" } }));
  expect(screen.getByRole("alert")).toHaveTextContent("Your previous list is still shown");
  expect(addFirst).toBeEnabled();
  await user.click(addFirst);
  expect(screen.getByRole("dialog", { name: "Add task" })).toBeVisible();
});

test.each(["missing user", "auth error", "auth rejection"])("%s offers a working retry without showing a fake empty list", async (failure) => {
  const user = userEvent.setup();
  if (failure === "auth rejection") getUser.mockRejectedValueOnce(new Error("Offline"));
  else getUser.mockResolvedValueOnce({ data: { user: null }, error: failure === "auth error" ? { message: "Offline" } : null });
  render(<TasksPageClient />);
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.queryByText("No tasks yet.")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add task" })).toBeDisabled();
  expect(request).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByRole("checkbox", { name: "Mark Wash dishes done" })).toBeVisible();
  expect(getUser).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("an initial query failure offers retry without empty-state actions", async () => {
  const user = userEvent.setup();
  request.mockResolvedValueOnce({ data: null, error: { message: "Offline" } });
  render(<TasksPageClient />);
  expect(await screen.findByRole("alert")).toHaveTextContent("couldn't load your tasks");
  expect(screen.queryByText("No tasks yet.")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add your first task" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByRole("checkbox")).toBeVisible();
});

test.each(["missing user", "rejected session", "thrown session rejection"])("refresh clears cached tasks after %s", async (failure) => {
  const user = userEvent.setup();
  render(<TasksPageClient />);
  await screen.findByRole("checkbox");
  if (failure === "thrown session rejection") getUser.mockRejectedValueOnce({ name: "AuthSessionMissingError" });
  else getUser.mockResolvedValueOnce({ data: { user: null }, error: failure === "rejected session" ? { status: 401 } : null });
  await user.click(screen.getByRole("button", { name: "Refresh tasks" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("sign in again");
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.queryByText("No tasks yet.")).not.toBeInTheDocument();
  expect(screen.queryByText(/previous list is still shown/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add task" })).toBeDisabled();
});

test("a temporary session check failure retains the account's list", async () => {
  const user = userEvent.setup();
  render(<TasksPageClient />);
  const checkbox = await screen.findByRole("checkbox");
  getUser.mockRejectedValueOnce(new Error("Network disconnected"));
  await user.click(screen.getByRole("button", { name: "Refresh tasks" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("previous list is still shown");
  expect(screen.getByRole("checkbox")).toBe(checkbox);
  expect(screen.getByRole("button", { name: "Add task" })).toBeEnabled();
});

test("an account change clears cached tasks and open forms even if its query fails", async () => {
  const user = userEvent.setup();
  render(<TasksPageClient />);
  const edit = await screen.findByRole("button", { name: "Edit Wash dishes" });
  const auth = deferred<unknown>();
  getUser.mockImplementationOnce(() => auth.promise);
  request.mockResolvedValueOnce({ data: null, error: { message: "Offline" } });
  await user.click(screen.getByRole("button", { name: "Refresh tasks" }));
  await user.click(edit);
  expect(screen.getByRole("dialog", { name: "Edit task" })).toBeVisible();
  await act(async () => auth.resolve({ data: { user: { id: "other-account" } }, error: null }));
  expect(await screen.findByRole("alert")).toHaveTextContent("couldn't load your tasks");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.queryByText(/previous list is still shown/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add task" })).toBeDisabled();
  expect(request.mock.calls.map(([args]) => (args as Request).filters.user_id)).toEqual(["account", "other-account"]);
});

test("a refresh started before a mutation cannot undo the saved task completion", async () => {
  const user = userEvent.setup();
  render(<TasksPageClient />);
  await screen.findByRole("checkbox");
  await user.click(screen.getByRole("tab", { name: "All 1" }));
  const refresh = deferred<unknown>();
  request.mockImplementationOnce(() => refresh.promise);
  await user.click(screen.getByRole("button", { name: "Refresh tasks" }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  await user.click(screen.getByRole("checkbox", { name: "Mark Wash dishes done" }));
  expect(await screen.findByRole("checkbox", { name: "Mark Wash dishes not done" })).toBeChecked();
  await act(async () => refresh.resolve({ data: [task], error: null }));
  expect(screen.getByRole("checkbox", { name: "Mark Wash dishes not done" })).toBeChecked();
  expect(screen.getByRole("tab", { name: "Completed 1" })).toBeVisible();
});

test("obsolete authentication responses cannot replace a newer successful load", async () => {
  const oldAuth = deferred<unknown>();
  getUser.mockImplementationOnce(() => oldAuth.promise);
  const previousPage = render(<TasksPageClient />);
  await waitFor(() => expect(getUser).toHaveBeenCalledTimes(1));
  previousPage.unmount();
  render(<StrictMode><TasksPageClient /></StrictMode>);
  expect(await screen.findByRole("checkbox")).toBeVisible();
  await act(async () => oldAuth.resolve({ data: { user: null }, error: null }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add task" })).toBeEnabled();
  expect(request).toHaveBeenCalledTimes(1);
});

test("empty filtered views can show all tasks", async () => {
  const user = userEvent.setup();
  render(<TasksPageClient />);
  await screen.findByRole("checkbox");
  await user.click(screen.getByRole("tab", { name: "Completed 0" }));
  await user.click(screen.getByRole("button", { name: "View all tasks" }));
  expect(screen.getByRole("tab", { name: "All 1" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("checkbox", { name: "Mark Wash dishes done" })).toBeVisible();
});

test("task dialogs restore their opener and use Add task after deleting the opener", async () => {
  const user = userEvent.setup();
  render(<TasksPageClient />);
  const edit = await screen.findByRole("button", { name: "Edit Wash dishes" });
  await user.click(edit);
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(edit).toHaveFocus());
  const remove = screen.getByRole("button", { name: "Delete Wash dishes" });
  await user.click(remove);
  await user.keyboard("{Escape}");
  await waitFor(() => expect(remove).toHaveFocus());
  await user.click(remove);
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Add task" })).toHaveFocus());
  expect(screen.queryByRole("heading", { name: "Wash dishes" })).not.toBeInTheDocument();
});

test("clearing the final completed task returns focus to Add task", async () => {
  const user = userEvent.setup();
  request.mockResolvedValueOnce({ data: [{ ...task, is_done: true }], error: null });
  render(<TasksPageClient />);
  await screen.findByRole("tab", { name: "Completed 1" });
  await user.click(screen.getByRole("tab", { name: "Completed 1" }));
  await user.click(screen.getByRole("button", { name: "Clear completed" }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Clear completed" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Add task" })).toHaveFocus());
  expect(screen.getByText("No tasks yet.")).toBeVisible();
});
