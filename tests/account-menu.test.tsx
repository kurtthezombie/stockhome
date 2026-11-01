import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { AccountMenu } from "@/components/stockhome/account-menu";

const { replace, signOut } = vi.hoisted(() => ({ replace: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/settings", useRouter: () => ({ replace }) }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { signOut } } }));

beforeEach(() => {
  replace.mockReset();
  signOut.mockReset().mockResolvedValue({ error: null });
});

test("keeps account actions hidden until opened and restores focus on Escape", async () => {
  const user = userEvent.setup();
  render(<AccountMenu />);
  expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  const trigger = screen.getByRole("button", { name: "Account menu" });
  trigger.focus();
  await user.keyboard("{Enter}");
  const settings = await screen.findByRole("menuitem", { name: "Settings" });
  expect(settings).toHaveAttribute("href", "/settings");
  expect(settings).toHaveAttribute("aria-current", "page");
  expect(settings).toHaveFocus();
  await user.keyboard("{ArrowDown}");
  expect(screen.getByRole("menuitem", { name: "Log out" })).toHaveFocus();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  expect(trigger).toHaveFocus();
  expect(signOut).not.toHaveBeenCalled();
});

test("waits for logout to succeed and prevents duplicate submissions", async () => {
  const user = userEvent.setup();
  let finish!: (value: { error: null }) => void;
  signOut.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  render(<AccountMenu />);
  const trigger = screen.getByRole("button", { name: "Account menu" });
  trigger.focus();
  await user.keyboard("{Enter}{ArrowDown}{Enter}");
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("menuitem", { name: "Logging out…" })).toHaveAttribute("aria-disabled", "true");
  await user.keyboard("{Enter}");
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(replace).not.toHaveBeenCalled();
  await act(async () => finish({ error: null }));
  expect(replace).toHaveBeenCalledWith("/login");
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});

test.each(["returned", "thrown"])("keeps a %s logout error inside the menu and allows retry", async (mode) => {
  const user = userEvent.setup();
  if (mode === "returned") signOut.mockResolvedValueOnce({ error: { message: "private auth detail" } });
  else signOut.mockRejectedValueOnce(new Error("private auth detail"));
  render(<AccountMenu />);
  screen.getByRole("button", { name: "Account menu" }).focus();
  await user.keyboard("{Enter}{ArrowDown}{Enter}");
  expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't log out. Please try again.");
  expect(document.body).not.toHaveTextContent("private auth detail");
  expect(replace).not.toHaveBeenCalled();
  await user.click(screen.getByRole("menuitem", { name: "Log out" }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  expect(signOut).toHaveBeenCalledTimes(2);
});
