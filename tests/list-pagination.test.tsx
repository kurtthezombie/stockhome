import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { InventoryPageClient } from "@/components/stockhome/inventory-page";
import { TasksPageClient } from "@/components/stockhome/tasks-page";
import { GroceryList } from "@/components/stockhome/inventory/grocery-list";

type Request = { table: string; owner: string; from: number; to: number; count?: string; order: string[] };
const { request, getUser } = vi.hoisted(() => ({ request: vi.fn(), getUser: vi.fn() }));
vi.mock("@/components/stockhome/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/lib/supabase", () => ({ supabase: {
  auth: { getUser },
  from: (table: string) => {
    const args: Request = { table, owner: "", from: 0, to: 0, order: [] };
    const builder = {
      select: (_columns: string, options?: { count?: string }) => { args.count = options?.count; return builder; },
      eq: (column: string, value: string) => { expect(column).toBe("user_id"); args.owner = value; return builder; },
      order: (column: string) => { args.order.push(column); return builder; },
      range: (from: number, to: number) => request({ ...args, from, to }),
    };
    return builder;
  },
} }));

function row(id: string, name: string) {
  return {
    id, user_id: "account", name, title: name, status: "low_stock", quantity: 1, unit: "kg",
    category: "Food & cooking", expiry_date: null, notes: null, is_done: false, due_date: null,
    inventory_item_id: null, is_purchased: false, created_at: "2026-10-09", updated_at: "2026-10-09",
  };
}
const cases = [
  ["inventory_items", () => <InventoryPageClient />, "Refresh inventory", ["status", "expiry_date", "created_at", "id"]],
  ["tasks", () => <TasksPageClient />, "Refresh tasks", ["is_done", "due_date", "created_at", "id"]],
  ["grocery_items", () => <GroceryList items={[]} userId="account" />, "Refresh", ["created_at", "id"]],
] as const;

beforeEach(() => {
  request.mockReset();
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "account" } }, error: null });
});

test.each(cases)("%s loads every page with account scope and deterministic ordering", async (table, page, _refresh, order) => {
  const rows = [row("a", "First item"), row("b", "Middle item"), row("c", "Last item")];
  request.mockImplementation(async ({ from }: Request) => ({ data: rows.slice(from, from + 2), error: null, count: from === 0 ? rows.length : null }));
  render(page());
  expect(await screen.findByText("Last item")).toBeVisible();
  expect(screen.getByText("First item")).toBeVisible();
  expect(screen.getByText("Middle item")).toBeVisible();
  expect(request.mock.calls.map(([args]) => args)).toEqual([
    { table, owner: "account", from: 0, to: 499, count: "exact", order },
    { table, owner: "account", from: 2, to: 501, count: undefined, order },
  ]);
});

test.each(cases)("%s retains the complete previous list while a later page fails, then retries", async (_table, page, refresh) => {
  const user = userEvent.setup();
  request.mockResolvedValueOnce({ data: [row("old", "Saved item")], error: null, count: 1 });
  render(page());
  await screen.findByText("Saved item");
  let finish!: (value: unknown) => void;
  request.mockResolvedValueOnce({ data: [row("new", "Partial item")], error: null, count: 2 })
    .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await user.click(screen.getByRole("button", { name: refresh }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
  expect(screen.getByText("Saved item")).toBeVisible();
  expect(screen.queryByText("Partial item")).not.toBeInTheDocument();
  await act(async () => finish({ data: null, error: { message: "private database detail" } }));
  expect(screen.getByRole("alert")).toHaveTextContent("Your previous list is still shown");
  expect(document.body).not.toHaveTextContent("private database detail");
  expect(screen.getByText("Saved item")).toBeVisible();
  const rows = [row("new", "Partial item"), row("last", "Final item")];
  request.mockImplementation(async ({ from }: Request) => ({ data: rows.slice(from, from + 1), error: null, count: from === 0 ? 2 : null }));
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Final item")).toBeVisible();
  expect(screen.getByText("Partial item")).toBeVisible();
  expect(screen.queryByText("Saved item")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test.each(cases)("%s ignores a late page after navigation to another account", async (table, page) => {
  let finish!: (value: unknown) => void;
  request.mockResolvedValueOnce({ data: [row("old", "Previous account first page")], error: null, count: 2 })
    .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const previous = render(page());
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  previous.unmount();
  getUser.mockResolvedValue({ data: { user: { id: "other-account" } }, error: null });
  request.mockResolvedValueOnce({ data: [{ ...row("current", "Current account item"), user_id: "other-account" }], error: null, count: 1 });
  render(table === "grocery_items" ? <GroceryList items={[]} userId="other-account" /> : page());
  expect(await screen.findByText("Current account item")).toBeVisible();
  await act(async () => finish({ data: [row("late", "Previous account last page")], error: null }));
  expect(screen.getByText("Current account item")).toBeVisible();
  expect(document.body).not.toHaveTextContent("Previous account");
  expect(request.mock.calls.map(([args]) => args.owner)).toEqual(["account", "account", "other-account"]);
});
