"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/stockhome/app-shell";
import { BackupControls } from "@/components/stockhome/backup-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

export function SettingsPageClient() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <AppShell>
      <div className="grid gap-6">
        <div className="page-heading">
          <p className="page-eyebrow">Make yourself at home</p>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Your account and a few things to look forward to.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Your account</CardTitle>
              <CardDescription>Your home, all in one place.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Signed in</Badge>
                <span className="min-w-0 break-all text-sm text-muted-foreground">
                  {email ?? "Authenticated user"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Backup & restore</CardTitle>
              <CardDescription>
                Keep a copy of your household data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BackupControls />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Home preferences</CardTitle>
              <CardDescription>
                The little details that make it yours.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                More ways to personalize your home are coming soon.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session</CardTitle>
              <CardDescription>Log out of StockHome on this device.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

