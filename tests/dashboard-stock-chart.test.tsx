import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { DashboardStockChart } from "@/components/stockhome/dashboard-stock-chart";

test("filters the graph to categories needing restock and exposes counts without relying on color", async () => {
  const user = userEvent.setup();
  render(<DashboardStockChart categories={[
    { name: "Food", available: 3, low_stock: 1, unavailable: 1, total: 5 },
    { name: "Cleaning", available: 2, low_stock: 0, unavailable: 0, total: 2 },
  ]} />);
  expect(screen.getByText("3 available · 1 low stock · 1 unavailable")).toBeVisible();
  expect(screen.getByText("5 items")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Needs restock" }));
  expect(screen.getByRole("button", { name: "Needs restock" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByText("Cleaning")).not.toBeInTheDocument();
  expect(screen.getByText("1 low stock · 1 unavailable")).toBeVisible();
  expect(screen.getByText("2 items")).toBeVisible();
  expect(screen.getByRole("link", { name: "Low stock" })).toHaveAttribute("href", "/inventory?status=low_stock");
  await user.click(screen.getByRole("button", { name: "All stock" }));
  expect(screen.getByText("Cleaning")).toBeVisible();
});

test("shows an honest empty state instead of empty graph axes", async () => {
  const user = userEvent.setup();
  render(<DashboardStockChart categories={[]} />);
  expect(screen.getByText("Add inventory items to see your stock breakdown.")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Needs restock" }));
  expect(screen.getByText(/Nothing needs restocking/)).toBeVisible();
});
