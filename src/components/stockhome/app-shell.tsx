"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logout01Icon, Menu01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/tasks", label: "Tasks" },
  { href: "/inventory", label: "Inventory" },
  { href: "/inventory/restock", label: "Restock" },
  { href: "/settings", label: "Settings" },
];

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      setSession(data.session);
      setIsLoading(false);

      if (!data.session) {
        router.replace("/login");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (!nextSession) {
        router.replace("/login");
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    setIsMenuOpen(false);
    router.replace("/login");
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <p className="text-sm text-muted-foreground">Loading StockHome...</p>
      </main>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <div>
            <Link href="/" className="text-lg font-semibold tracking-tight">
              StockHome
            </Link>
            <p className="text-xs text-muted-foreground">
              Household tasks and inventory
            </p>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Button
                key={item.href}
                asChild
                  variant={pathname === item.href ? "secondary" : "ghost"}
                size="sm"
              >
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
              Logout
            </Button>
          </nav>

          <Dialog open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="icon-lg"
                className="md:hidden"
                aria-label="Open navigation menu"
              >
                <HugeiconsIcon icon={Menu01Icon} strokeWidth={2} />
              </Button>
            </DialogTrigger>
            <DialogContent
              className="top-0 left-0 h-dvh max-w-72 translate-x-0 translate-y-0 content-start rounded-none p-0 sm:max-w-80"
              showCloseButton={false}
            >
              <DialogHeader className="border-b px-4 py-4">
                <DialogTitle className="text-base">StockHome</DialogTitle>
                <p className="truncate text-xs text-muted-foreground">
                  {session.user.email}
                </p>
              </DialogHeader>
              <nav className="grid gap-2 p-4">
                {navItems.map((item) => (
                  <DialogClose key={item.href} asChild>
                    <Button
                      asChild
                      variant={pathname === item.href ? "secondary" : "ghost"}
                      className={cn(
                        "h-11 justify-start px-3 text-sm",
                        pathname === item.href && "font-semibold",
                      )}
                    >
                      <Link href={item.href}>{item.label}</Link>
                    </Button>
                  </DialogClose>
                ))}
                <Button
                  variant="outline"
                  className="mt-2 h-11 justify-start px-3 text-sm"
                  onClick={handleLogout}
                >
                  <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
                  Logout
                </Button>
              </nav>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      <main className={cn("mx-auto w-full max-w-6xl px-4 py-6")}>
        {children}
      </main>
    </div>
  );
}
