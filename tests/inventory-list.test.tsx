import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InventoryList } from "@/components/stockhome/inventory/inventory-list";
import type { InventoryItem } from "@/types";

const rice: InventoryItem = {
  id: "rice", user_id: "test-user", name: "Rice", quantity: 2, unit: "kg",
  status: "available", category: "Food & cooking", expiry_date: null,
  notes: "Keep in the pantry", created_at: "2026-10-09T00:00:00Z", updated_at: "2026-10-09T00:00:00Z",
};

beforeEach(() => { window.localStorage.clear(); });

test("shows inventory details without expansion and sends actions to the correct item", async () => {
  const user = userEvent.setup();
  const onEditItem = vi.fn();
  const onDeleteItem = vi.fn();
  render(<InventoryList items={[rice]} isLoading={false} onEditItem={onEditItem} onDeleteItem={onDeleteItem} />);
  expect(screen.getByRole("heading", { name: "Rice" })).toBeVisible();
  expect(screen.getByText("Food & cooking")).toBeVisible();
  expect(screen.getByText("Keep in the pantry")).toBeVisible();
  expect(screen.getByText("No expiry set")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Edit Rice and view full notes" }));
  expect(onEditItem).toHaveBeenCalledWith(rice);
  await user.click(screen.getByRole("button", { name: "Delete Rice" }));
  expect(onDeleteItem).toHaveBeenCalledWith(rice);
});

test("remembers the selected inventory layout after remounting", async () => {
  const user = userEvent.setup();
  const props = { items: [rice], isLoading: false, onEditItem: vi.fn(), onDeleteItem: vi.fn() };
  const { unmount } = render(<InventoryList {...props} />);
  await user.click(screen.getByRole("button", { name: "Compact: Three columns on wide screens" }));
  expect(window.localStorage.getItem("stockhome:inventory-layout")).toBe("compact");
  unmount();
  render(<InventoryList {...props} />);
  expect(screen.getByRole("button", { name: "Compact: Three columns on wide screens" })).toHaveAttribute("aria-pressed", "true");
});

test("shows a loading message instead of an empty result during loading", () => {
  window.localStorage.setItem("stockhome:inventory-layout", "compact");
  const { container } = render(<InventoryList items={[]} isLoading onEditItem={vi.fn()} onDeleteItem={vi.fn()} />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading your stock");
  expect(container.querySelector('[data-slot="list-skeleton"]')).toHaveClass("lg:grid-cols-3");
  expect(container.querySelector('[data-slot="list-skeleton"]')).toHaveAttribute("aria-hidden", "true");
  expect(screen.queryByText("No inventory items in this view.")).not.toBeInTheDocument();
});
