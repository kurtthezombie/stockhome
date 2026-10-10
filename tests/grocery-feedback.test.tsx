import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { GroceryList } from "@/components/stockhome/inventory/grocery-list";
import type { GroceryItem } from "@/components/stockhome/inventory/grocery-utils";
import type { InventoryItem } from "@/types";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
type Request = { operation: string; payload: Record<string, unknown> | null };
vi.mock("@/lib/supabase", () => ({ supabase: {
  from: () => {
    const args: Request = { operation: "select", payload: null };
    const builder = {
      select: () => builder,
      order: () => builder,
      eq: () => builder,
      insert: (payload: Record<string, unknown>) => { args.operation = "insert"; args.payload = payload; return builder; },
      update: (payload: Record<string, unknown>) => { args.operation = "update"; args.payload = payload; return builder; },
      delete: () => { args.operation = "delete"; return builder; },
      single: () => request(args),
      then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => request(args).then(resolve, reject),
    };
    return builder;
  },
} }));

const milk: GroceryItem = { id: "milk", user_id: "account", name: "Milk", inventory_item_id: null, quantity: 1, unit: "L", is_purchased: false, created_at: "2026-10-09" };
const rice: InventoryItem = { id: "rice", user_id: "account", name: "Rice", quantity: 1, unit: "kg", status: "low_stock", category: "Food & cooking", expiry_date: null, notes: null, created_at: "2026-10-09", updated_at: "2026-10-09" };

beforeEach(() => {
  request.mockImplementation((args: Request) => Promise.resolve({ data: args.operation === "select" ? [milk] : { ...milk, ...args.payload }, error: null }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { vi.unstubAllGlobals(); });

test("an empty grocery list offers an add action and returns focus after its first item is saved", async () => {
  const user = userEvent.setup();
  request.mockResolvedValueOnce({ data: [], error: null });
  render(<GroceryList items={[]} userId="account" />);
  await user.click(await screen.findByRole("button", { name: "Add a shopping item" }));
  await user.type(screen.getByRole("textbox", { name: "Item name" }), "Milk");
  await user.click(screen.getByRole("button", { name: "Save item" }));
  expect(await screen.findByRole("checkbox", { name: /Milk/ })).toBeVisible();
  await waitFor(() => expect(screen.getByRole("button", { name: "Add item" })).toHaveFocus());
  expect(screen.queryByRole("button", { name: "Add a shopping item" })).not.toBeInTheDocument();
});

test("refresh keeps keyboard controls available without allowing overlapping requests or mutations", async () => {
  const user = userEvent.setup();
  render(<GroceryList items={[]} userId="account" />);
  const checkbox = await screen.findByRole("checkbox", { name: /Milk/ });
  let finish!: (value: unknown) => void;
  request.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const refresh = screen.getByRole("button", { name: "Refresh" });
  await user.click(refresh);
  expect(refresh).toHaveFocus();
  expect(refresh).toHaveAttribute("aria-disabled", "true");
  await user.click(refresh);
  expect(request).toHaveBeenCalledTimes(2);
  await user.click(checkbox);
  expect(checkbox).toHaveFocus();
  expect(checkbox).not.toBeChecked();
  expect(request).toHaveBeenCalledTimes(2);
  await act(async () => { finish({ data: [{ ...milk, is_purchased: true }], error: null }); });
  const purchasedCheckbox = screen.getByRole("checkbox", { name: /Milk/ });
  expect(purchasedCheckbox).toBeChecked();
  expect(purchasedCheckbox).toHaveFocus();
  expect(refresh).toHaveAttribute("aria-disabled", "false");
});

test("refresh falls back to Add item if a focused row was removed on another device", async () => {
  const user = userEvent.setup();
  render(<GroceryList items={[]} userId="account" />);
  const checkbox = await screen.findByRole("checkbox", { name: /Milk/ });
  let finish!: (value: unknown) => void;
  request.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await user.click(screen.getByRole("button", { name: "Refresh" }));
  checkbox.focus();
  await act(async () => { finish({ data: [], error: null }); });
  expect(screen.getByRole("button", { name: "Add item" })).toHaveFocus();
});

test("retry returns keyboard focus to Refresh while the initial request recovers", async () => {
  const user = userEvent.setup();
  request.mockResolvedValueOnce({ data: null, error: { message: "Offline" } });
  render(<GroceryList items={[]} userId="account" />);
  const retry = await screen.findByRole("button", { name: "Retry" });
  let finish!: (value: unknown) => void;
  request.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await user.click(retry);
  expect(screen.getByRole("button", { name: "Refresh" })).toHaveFocus();
  expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  await act(async () => { finish({ data: [milk], error: null }); });
  expect(screen.getByRole("button", { name: "Refresh" })).toHaveFocus();
  expect(screen.getByRole("checkbox", { name: /Milk/ })).toBeVisible();
});

test("restock suggestions distinguish unavailable inventory from a successfully loaded empty inventory", async () => {
  const { container, rerender } = render(<GroceryList items={[]} userId="account" inventoryHasLoaded={false} inventoryLoading />);
  await screen.findByRole("checkbox", { name: /Milk/ });
  expect(container.querySelector('[data-slot="list-skeleton"]')).toBeInTheDocument();
  expect(screen.queryByText(/No additional restock suggestions/)).not.toBeInTheDocument();
  rerender(<GroceryList items={[]} userId="account" inventoryHasLoaded={false} inventoryError="Offline" />);
  expect(screen.getByText(/Restock suggestions are unavailable/)).toBeVisible();
  expect(screen.queryByText(/No additional restock suggestions/)).not.toBeInTheDocument();
  rerender(<GroceryList items={[rice]} userId="account" inventoryHasLoaded inventoryLoading />);
  const suggestion = screen.getByRole("button", { name: "Add Rice to grocery list" });
  rerender(<GroceryList items={[rice]} userId="account" inventoryHasLoaded inventoryError="Offline" />);
  expect(screen.getByRole("button", { name: "Add Rice to grocery list" })).toBe(suggestion);
});

test("removing a grocery item returns focus to the primary add action", async () => {
  const user = userEvent.setup();
  render(<GroceryList items={[]} userId="account" />);
  await user.click(await screen.findByRole("button", { name: "Remove Milk" }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove item" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Add item" })).toHaveFocus());
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
});
