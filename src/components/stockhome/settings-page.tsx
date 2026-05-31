"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/stockhome/app-shell";
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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Basic account and future app options.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Supabase connection</CardTitle>
              <CardDescription>Frontend uses the public anon key.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Configured</Badge>
                <span className="text-xs text-muted-foreground">
                  {email ?? "Authenticated user"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>JSON export/import later</CardTitle>
              <CardDescription>
                Placeholder for backup and restore tools.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Export/import is not implemented yet.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Future app preferences</CardTitle>
              <CardDescription>
                Placeholder for household display preferences.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Preferences are not implemented yet.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session</CardTitle>
              <CardDescription>End the current Supabase session.</CardDescription>
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

