import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ThemeControl, ThemeController } from "@/components/ui/theme-control";
import { themeBootstrap, themeStorageKey } from "@/lib/theme";

let dark = false;
let changes: Set<() => void>;
let removeListener: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  dark = false;
  changes = new Set();
  removeListener = vi.fn((_type, callback) => changes.delete(callback));
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    get matches() { return dark; },
    addEventListener: (_type: string, callback: () => void) => changes.add(callback),
    removeEventListener: removeListener,
  })));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function systemDark(value: boolean) {
  act(() => { dark = value; changes.forEach((callback) => callback()); });
}

test("shows one toggle reflecting the current system appearance", () => {
  dark = true;
  render(<><ThemeController /><ThemeControl /></>);
  expect(screen.getByRole("button", { name: dark ? "Switch to light mode" : "Switch to dark mode" })).toBeVisible();
  expect(document.documentElement).toHaveClass("dark");
  systemDark(false);
  expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();
  expect(screen.getAllByRole("button")).toHaveLength(1);
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(document.documentElement).not.toHaveClass("dark");
  expect(localStorage.getItem(themeStorageKey)).toBeNull();
});

test("manual overrides persist and synchronize controls independently of the system", async () => {
  const user = userEvent.setup();
  const view = render(<><ThemeControl /><ThemeControl compact /></>);
  await user.click(screen.getAllByRole("button", { name: "Switch to dark mode" })[0]);
  expect(screen.getAllByRole("button", { name: "Switch to light mode" })[1]).toBeVisible();
  expect(localStorage.getItem(themeStorageKey)).toBe("dark");
  systemDark(false);
  expect(document.documentElement).toHaveClass("dark");
  view.unmount();
  render(<ThemeControl />);
  expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Switch to light mode" }));
  systemDark(true);
  expect(document.documentElement).not.toHaveClass("dark");
  expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();
});

test("other-tab changes and clearing storage update the active theme", () => {
  render(<ThemeControl />);
  act(() => {
    localStorage.setItem(themeStorageKey, "dark");
    window.dispatchEvent(new StorageEvent("storage", { key: themeStorageKey, storageArea: localStorage }));
  });
  expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeVisible();
  expect(document.documentElement).toHaveClass("dark");
  act(() => {
    localStorage.clear();
    window.dispatchEvent(new StorageEvent("storage", { key: null }));
  });
  expect(screen.getByRole("button", { name: dark ? "Switch to light mode" : "Switch to dark mode" })).toBeVisible();
  expect(document.documentElement).not.toHaveClass("dark");
});

test("invalid preferences follow System and unrelated storage events are ignored", () => {
  localStorage.setItem(themeStorageKey, "invalid");
  dark = true;
  render(<ThemeControl />);
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: "unrelated", newValue: "light" })));
  expect(screen.getByRole("button", { name: dark ? "Switch to light mode" : "Switch to dark mode" })).toBeVisible();
  expect(document.documentElement).toHaveClass("dark");
});

test("blocked storage still follows System and allows a manual choice", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  dark = true;
  render(<ThemeControl />);
  expect(document.documentElement).toHaveClass("dark");
  await userEvent.setup().click(screen.getByRole("button", { name: "Switch to light mode" }));
  expect(document.documentElement).not.toHaveClass("dark");
  expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();
});

test("the final subscriber removes browser listeners", () => {
  const view = render(<ThemeController />);
  expect(changes.size).toBe(1);
  view.unmount();
  expect(removeListener).toHaveBeenCalled();
  expect(changes.size).toBe(0);
});

test.each([null, "system", "invalid", "light", "dark"])("bootstrap resolves %s before mounting React", (saved) => {
  if (saved) localStorage.setItem(themeStorageKey, saved);
  dark = true;
  window.eval(themeBootstrap);
  expect(document.documentElement.classList.contains("dark")).toBe(saved !== "light");
});

test("bootstrap follows the system even when storage is blocked", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  dark = true;
  window.eval(themeBootstrap);
  expect(document.documentElement).toHaveClass("dark");
});

test("Enter and Space toggle both directions without moving focus", async () => {
  const user = userEvent.setup();
  render(<ThemeControl compact />);
  const toggle = screen.getByRole("button", { name: "Switch to dark mode" });
  await user.tab();
  expect(toggle).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(localStorage.getItem(themeStorageKey)).toBe("dark");
  expect(toggle).toHaveAccessibleName("Switch to light mode");
  systemDark(false);
  expect(document.documentElement).toHaveClass("dark");
  await user.keyboard(" ");
  expect(toggle).toHaveAccessibleName("Switch to dark mode");
  expect(toggle).toHaveFocus();
  expect(localStorage.getItem(themeStorageKey)).toBe("light");
  expect(document.documentElement).not.toHaveClass("dark");
});
