import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TasksPageClient } from "@/components/stockhome/tasks-page";
import { InventoryPageClient } from "@/components/stockhome/inventory-page";
import { GroceryList } from "@/components/stockhome/inventory/grocery-list";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
type Request = { table: string; operation: string; payload: Record<string, unknown> | null; filters: Record<string, unknown>; single: boolean };
vi.mock("@/components/stockhome/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/lib/supabase", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "account" } } }) },
  from: (table: string) => {
    const args: Request = { table, operation: "select", payload: null, filters: {}, single: false };
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

const task = { id: "task-1", user_id: "account", title: "Wash dishes", is_done: false, due_date: null, notes: null, created_at: "2026-10-09", updated_at: "2026-10-09" };
const inventory = { id: "rice", user_id: "account", name: "Rice", status: "available", quantity: 2, unit: "kg", category: "Food & cooking", expiry_date: null, notes: null, created_at: "2026-10-09", updated_at: "2026-10-09" };
const grocery = { id: "grocery-1", user_id: "account", name: "Milk", inventory_item_id: null, quantity: 1, unit: "L", is_purchased: false, created_at: "2026-10-09" };

function respond(args: Request) {
  const row = args.table === "tasks" ? task : args.table === "inventory_items" ? inventory : grocery;
  return Promise.resolve({ data: args.operation === "select" ? [row] : { ...row, ...args.payload, ...(args.operation === "insert" ? { id: "new" } : {}) }, error: null });
}

beforeEach(() => {
  request.mockImplementation(respond);
  // Radix measures its select trigger; jsdom does not implement ResizeObserver.
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { vi.unstubAllGlobals(); });

test("announces task completion only after persistence and restores focus when its row disappears", async () => {
  const user = userEvent.setup();
  let finish!: (value: unknown) => void;
  request.mockImplementation((args: Request) => args.operation === "update" ? new Promise((resolve) => { finish = resolve; }) : respond(args));
  render(<TasksPageClient />);
  const checkbox = await screen.findByRole("checkbox", { name: "Mark Wash dishes done" });
  await user.click(checkbox);
  expect(checkbox).toBeDisabled();
  expect(checkbox).not.toBeChecked();
  expect(screen.queryByText(/Wash dishes completed/)).not.toBeInTheDocument();
  await act(async () => { finish({ data: { ...task, is_done: true }, error: null }); });
  expect(await screen.findByText("Wash dishes completed. One less thing to do.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Add task" })).toHaveFocus();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Dismiss notification" }));
  expect(screen.queryByText(/Wash dishes completed/)).not.toBeInTheDocument();
});

test("failed task completion preserves the previous selection and shows an error", async () => {
  const user = userEvent.setup();
  request.mockImplementation((args: Request) => args.operation === "update" ? Promise.resolve({ data: null, error: { message: "Denied" } }) : respond(args));
  render(<TasksPageClient />);
  await user.click(await screen.findByRole("checkbox", { name: "Mark Wash dishes done" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("previous selection is unchanged");
  expect(screen.getByRole("checkbox", { name: "Mark Wash dishes done" })).not.toBeChecked();
  expect(screen.queryByText(/Wash dishes completed/)).not.toBeInTheDocument();
});

test("adding a task announces its saved name and updates the list without fetching it again", async () => {
  const user = userEvent.setup();
  render(<TasksPageClient />);
  await screen.findByRole("checkbox");
  await user.click(screen.getByRole("button", { name: "Add task" }));
  await user.type(screen.getByRole("textbox", { name: "Title" }), "Take out bins");
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText("Take out bins added to your tasks.")).toBeVisible();
  expect(screen.getByRole("heading", { name: "Take out bins" })).toBeVisible();
  expect(request.mock.calls.filter(([args]) => args.operation === "select")).toHaveLength(1);
});

test("inventory save errors stay inside the dialog and a successful retry updates the card", async () => {
  const user = userEvent.setup();
  let fail = true;
  request.mockImplementation((args: Request) => args.operation === "update" && fail ? Promise.resolve({ data: null, error: { message: "Failed" } }) : respond(args));
  render(<InventoryPageClient />);
  await user.click(await screen.findByRole("button", { name: "Edit Rice and view full notes" }));
  const name = screen.getByRole("textbox", { name: "Name" });
  await user.clear(name);
  await user.type(name, "Brown rice");
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent("couldn't save");
  expect(screen.queryByText("Brown rice updated.")).not.toBeInTheDocument();
  fail = false;
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText("Brown rice updated.")).toBeVisible();
  expect(screen.getByRole("heading", { name: "Brown rice" })).toBeVisible();
  expect(request.mock.calls.filter(([args]) => args.operation === "select")).toHaveLength(1);
});

test("a grocery purchase moves sections, announces success, and keeps keyboard focus", async () => {
  const user = userEvent.setup();
  render(<GroceryList items={[]} userId="account" />);
  const checkbox = await screen.findByRole("checkbox", { name: /Milk/ });
  await user.click(checkbox);
  expect(await screen.findByText("Milk marked purchased.")).toBeVisible();
  expect(screen.getByRole("heading", { name: "Purchased (1)" })).toBeVisible();
  const purchased = screen.getByRole("checkbox", { name: /Milk/ });
  expect(purchased).toBeChecked();
  expect(purchased).toHaveFocus();
  await user.click(purchased);
  expect(await screen.findByText("Milk is back on your shopping list.")).toBeVisible();
  expect(screen.getByRole("checkbox", { name: /Milk/ })).not.toBeChecked();
});

test("grocery failures preserve the item and copying the list announces success", async () => {
  const user = userEvent.setup();
  const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  request.mockImplementation((args: Request) => args.operation === "update" ? Promise.resolve({ data: null, error: { message: "Failed" } }) : respond(args));
  render(<GroceryList items={[]} userId="account" />);
  await user.click(await screen.findByRole("checkbox", { name: /Milk/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("previous selection is unchanged");
  expect(screen.getByRole("checkbox", { name: /Milk/ })).not.toBeChecked();
  expect(screen.queryByText("Milk marked purchased.")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Copy remaining" }));
  await waitFor(() => expect(copy).toHaveBeenCalledWith(expect.stringContaining("Milk")));
  expect(screen.getByText("Copied your remaining shopping items.")).toBeVisible();
});

test.each(["tasks", "inventory"])("%s deletion announces success only after confirmation", async (page) => {
  const user = userEvent.setup();
  render(page === "tasks" ? <TasksPageClient /> : <InventoryPageClient />);
  const name = page === "tasks" ? "Wash dishes" : "Rice";
  await user.click(await screen.findByRole("button", { name: `Delete ${name}` }));
  expect(request.mock.calls.some(([args]) => args.operation === "delete")).toBe(false);
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
  expect(await screen.findByText(page === "tasks" ? "Wash dishes deleted." : "Rice removed from your inventory.")).toBeVisible();
  expect(screen.queryByRole("heading", { name })).not.toBeInTheDocument();
  expect(request.mock.calls.find(([args]) => args.operation === "delete")?.[0].filters.user_id).toBe("account");
});
