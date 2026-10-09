import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { Dashboard } from "@/components/stockhome/dashboard";

const { getUser, from, range } = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), range: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getUser }, from } }));
vi.mock("@/components/stockhome/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));

beforeEach(() => {
  getUser.mockResolvedValue({ data: { user: { id: "account-1" } }, error: null });
  range.mockResolvedValue({ data: [], error: null });
  from.mockImplementation((table: string) => {
    let owner = "";
    const query = {
      select: () => query,
      eq: (column: string, value: string) => { expect(column).toBe("user_id"); owner = value; return query; },
      order: () => query,
      range: (start: number, end: number) => range(table, owner, start, end),
    };
    return query;
  });
});

test("loads all inventory pages for the signed-in account and refreshes the snapshot", async () => {
  const user = userEvent.setup();
  const rows = Array.from({ length: 501 }, (_, index) => ({ id: String(index), user_id: "account-1", name: `Item ${index}`, status: "available", quantity: 1, category: "Food", expiry_date: null }));
  range.mockImplementation(async (table: string, owner: string, start: number, end: number) => {
    expect(owner).toBe("account-1");
    return { data: table === "inventory_items" ? rows.slice(start, end + 1) : [], error: null };
  });
  render(<Dashboard />);
  await screen.findByText("Task progress");
  expect(within(screen.getByRole("link", { name: /Inventory items/ })).getByText("501")).toBeVisible();
  expect(range).toHaveBeenCalledWith("inventory_items", "account-1", 500, 999);
  await user.click(screen.getByRole("button", { name: "Refresh dashboard" }));
  await screen.findByText("Task progress");
  expect(getUser).toHaveBeenCalledTimes(2);
});

test("keeps working sections when groceries fail and does not report missing data as zero", async () => {
  range.mockImplementation(async (table: string) => table === "grocery_items"
    ? { data: null, error: { message: "Grocery service unavailable" } }
    : { data: [], error: null });
  render(<Dashboard />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Groceries could not load");
  expect(screen.getByText("Task progress")).toBeVisible();
  expect(screen.getByText("Stock by category")).toBeVisible();
  const groceries = screen.getByRole("link", { name: /On your grocery list/ });
  expect(within(groceries).getByText("Data unavailable")).toBeVisible();
  expect(within(groceries).queryByText("0")).not.toBeInTheDocument();
});

test("does not read tables without a signed-in account", async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  render(<Dashboard />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Sign in");
  expect(from).not.toHaveBeenCalled();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const stockRows = [
  { id: "rice", user_id: "account-1", name: "Rice", status: "low_stock", quantity: 2, category: "Food", expiry_date: null },
];

test("shows skeletons on first load, then keeps cards and the graph filter visible during refresh", async () => {
  const user = userEvent.setup();
  const firstLoad = deferred<{ data: typeof stockRows; error: null }>();
  range.mockImplementation((table: string) => table === "inventory_items" ? firstLoad.promise : Promise.resolve({ data: [], error: null }));
  const { container } = render(<Dashboard />);
  expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Loading your overview");
  expect(screen.queryByText("No tasks yet. Add your first household to-do.")).not.toBeInTheDocument();
  await act(async () => { firstLoad.resolve({ data: stockRows, error: null }); });
  await screen.findByText("Task progress");
  expect(container.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Needs restock" }));
  const chart = screen.getByRole("figure", { name: "Low-stock and unavailable items by category" });

  const refreshLoad = deferred<{ data: typeof stockRows; error: null }>();
  range.mockImplementation((table: string) => table === "inventory_items" ? refreshLoad.promise : Promise.resolve({ data: [], error: null }));
  await user.click(screen.getByRole("button", { name: "Refresh dashboard" }));
  expect(screen.getByRole("button", { name: /Refreshing dashboard/ })).toBeDisabled();
  expect(chart).toBeInTheDocument();
  expect(screen.getByText("Task progress")).toBeVisible();
  expect(within(screen.getByRole("link", { name: /Inventory items/ })).getByText("1")).toBeVisible();
  expect(container.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument();
  await act(async () => { refreshLoad.resolve({ data: [...stockRows, { ...stockRows[0], id: "milk", name: "Milk" }], error: null }); });
  await waitFor(() => expect(screen.getByRole("button", { name: "Refresh dashboard" })).toBeEnabled());
  expect(chart).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Needs restock" })).toHaveAttribute("aria-pressed", "true");
  expect(within(screen.getByRole("link", { name: /Inventory items/ })).getByText("2")).toBeVisible();
});

test("retains data after a failed refresh and recovers on retry", async () => {
  const user = userEvent.setup();
  range.mockImplementation(async (table: string) => ({ data: table === "inventory_items" ? stockRows : [], error: null }));
  render(<Dashboard />);
  await screen.findByText("Task progress");
  const timestamp = screen.getByText(/Last full update/).textContent;
  range.mockResolvedValue({ data: null, error: { message: "Connection lost" } });
  await user.click(screen.getByRole("button", { name: "Refresh dashboard" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Some data may be out of date");
  expect(within(screen.getByRole("link", { name: /Inventory items/ })).getByText("1")).toBeVisible();
  expect(screen.getByText(/Last full update/).textContent).toBe(timestamp);
  range.mockResolvedValue({ data: [], error: null });
  await user.click(screen.getByRole("button", { name: "Refresh dashboard" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Refresh dashboard" })).toBeEnabled());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(within(screen.getByRole("link", { name: /Inventory items/ })).getByText("0")).toBeVisible();
});

test("keeps cached cards on a temporary session-check failure but clears them after an account change", async () => {
  const user = userEvent.setup();
  range.mockImplementation(async (table: string) => ({ data: table === "inventory_items" ? stockRows : [], error: null }));
  render(<Dashboard />);
  await screen.findByText("Task progress");
  getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthRetryableFetchError", status: 0 } });
  await user.click(screen.getByRole("button", { name: "Refresh dashboard" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to check your session");
  expect(within(screen.getByRole("link", { name: /Inventory items/ })).getByText("1")).toBeVisible();
  getUser.mockResolvedValue({ data: { user: { id: "account-2" } }, error: null });
  range.mockResolvedValue({ data: null, error: { message: "Unavailable" } });
  await user.click(screen.getByRole("button", { name: "Refresh dashboard" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Refresh dashboard" })).toBeEnabled());
  expect(within(screen.getByRole("link", { name: /Inventory items/ })).getByText("Data unavailable")).toBeVisible();
  expect(screen.queryByText(/Last full update/)).not.toBeInTheDocument();
});
