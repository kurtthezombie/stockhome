import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BackupControls } from "@/components/stockhome/backup-controls";

const { getUser, rpc } = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getUser }, rpc } }));
const backup = { format: "stockhome", version: 1, exported_at: "2026-10-09T00:00:00Z", inventory: [], tasks: [], groceries: [] };

beforeEach(() => {
  getUser.mockResolvedValue({ data: { user: { id: "account-1" } }, error: null });
  rpc.mockResolvedValue({ data: null, error: null });
});
function selectFile(content: string) {
  const file = new File([content], "backup.json", { type: "application/json" });
  Object.defineProperty(file, "text", { value: async () => content });
  fireEvent.change(screen.getByLabelText("Choose StockHome backup"), { target: { files: [file] } });
}

test("previews a backup without writing and requires confirmation for replacement", async () => {
  const user = userEvent.setup();
  render(<BackupControls />);
  selectFile(JSON.stringify(backup));
  expect(await screen.findByRole("dialog")).toHaveTextContent("0 inventory items");
  expect(rpc).not.toHaveBeenCalled();
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Replace my data" }));
  expect(rpc).toHaveBeenCalledWith("import_stockhome_backup", { backup, replace_existing: true });
  expect(await screen.findByRole("status")).toHaveTextContent("Import complete");
});

test("rejects invalid files before any write and blocks an account change", async () => {
  const user = userEvent.setup();
  render(<BackupControls />);
  selectFile("not json");
  expect(await screen.findByRole("alert")).toHaveTextContent("not valid JSON");
  expect(rpc).not.toHaveBeenCalled();
  selectFile(JSON.stringify(backup));
  await screen.findByRole("dialog");
  getUser.mockResolvedValue({ data: { user: { id: "account-2" } }, error: null });
  await user.click(screen.getByRole("button", { name: "Add records" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("account changed");
  expect(rpc).not.toHaveBeenCalled();
});

test("shows a failed additive import without claiming success", async () => {
  const user = userEvent.setup();
  rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate" } });
  render(<BackupControls />);
  selectFile(JSON.stringify(backup));
  await screen.findByRole("dialog");
  await user.click(screen.getByRole("button", { name: "Add records" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No data was changed");
  expect(screen.queryByText(/Import complete/)).not.toBeInTheDocument();
});
