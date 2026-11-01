"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { DropdownMenu } from "radix-ui";
import { Logout01Icon, Settings01Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

const itemClassName = "flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50";

export function AccountMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logoutLock = useRef(false);

  async function logout() {
    if (logoutLock.current) return;
    logoutLock.current = true;
    setPending(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setOpen(false);
      router.replace("/login");
    } catch {
      setError("Couldn't log out. Please try again.");
    } finally {
      logoutLock.current = false;
      setPending(false);
    }
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" size="icon-lg" className="cursor-pointer" aria-label="Account menu" title="Account menu">
          <HugeiconsIcon icon={UserCircleIcon} strokeWidth={2} aria-hidden="true" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} collisionPadding={12} className="z-50 w-48 max-w-[calc(100vw-1.5rem)] rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg">
          <DropdownMenu.Item asChild className={itemClassName}>
            <Link href="/settings" aria-current={pathname === "/settings" ? "page" : undefined}>
              <HugeiconsIcon icon={Settings01Icon} size={18} strokeWidth={2} aria-hidden="true" />
              Settings
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item disabled={pending} className={itemClassName} onSelect={(event) => { event.preventDefault(); void logout(); }}>
            <HugeiconsIcon icon={Logout01Icon} size={18} strokeWidth={2} aria-hidden="true" />
            {pending ? "Logging out…" : "Log out"}
          </DropdownMenu.Item>
          {error ? <p role="alert" className="px-3 py-2 text-xs text-destructive">{error}</p> : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
