"use client";

import { useSyncExternalStore } from "react";
import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { parseTheme, themeStorageKey, type ThemePreference } from "@/lib/theme";
import { Button } from "@/components/ui/button";

let preference: ThemePreference = "system";
const listeners = new Set<() => void>();
let media: MediaQueryList | undefined;

function applyTheme() {
  document.documentElement.classList.toggle(
    "dark",
    preference === "dark" || (preference === "system" && !!media?.matches),
  );
}

function publish() {
  applyTheme();
  listeners.forEach((listener) => listener());
}

function readPreference() {
  try {
    return parseTheme(window.localStorage.getItem(themeStorageKey));
  } catch {
    return "system" as const;
  }
}

function onStorage(event: StorageEvent) {
  if (event.key !== themeStorageKey && event.key !== null) return;
  // Ignore sessionStorage events without touching potentially blocked storage.
  try {
    if (event.storageArea && event.storageArea !== window.localStorage) return;
  } catch { return; }
  preference = readPreference();
  publish();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    preference = readPreference();
    media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", publish);
    window.addEventListener("storage", onStorage);
    publish();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      media?.removeEventListener?.("change", publish);
      window.removeEventListener("storage", onStorage);
      media = undefined;
    }
  };
}

function setTheme(value: ThemePreference) {
  preference = value;
  try { window.localStorage.setItem(themeStorageKey, value); } catch {
    // The selected mode remains usable for this visit when storage is blocked.
  }
  publish();
}

function getSnapshot(): "light" | "dark" {
  return preference === "dark" || (preference === "system" && !!media?.matches) ? "dark" : "light";
}
function getServerSnapshot() { return null; }

export function ThemeController() {
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return null;
}

export function ThemeControl({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <div className={compact ? "flex shrink-0 items-center gap-2" : "grid gap-2"}>
      {!compact && <p className="text-sm font-medium">Appearance</p>}
      <Button
        type="button"
        size="icon-lg"
        variant="outline"
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        onClick={() => setTheme(getSnapshot() === "dark" ? "light" : "dark")}
      >
        <HugeiconsIcon icon={Sun03Icon} strokeWidth={2} aria-hidden="true" className="dark:hidden" />
        <HugeiconsIcon icon={Moon02Icon} strokeWidth={2} aria-hidden="true" className="hidden dark:block" />
      </Button>
      {!compact && <p className="text-xs text-muted-foreground">Starts with your device’s appearance. Your choice is saved in this browser.</p>}
    </div>
  );
}
