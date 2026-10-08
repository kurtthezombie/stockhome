"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { LoadingStatus } from "@/components/ui/loading-status";
import { AuthLayout } from "@/components/stockhome/auth-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/");
      }
    });
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.replace("/");
  }

  return (
    <AuthLayout title="Welcome home." description="Log in to pick up where you left off. Everything you need, right where you left it.">
          <form className="grid gap-5" onSubmit={handleSubmit} aria-busy={isSubmitting}>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                placeholder="you@example.com"
                disabled={isSubmitting}
                autoComplete="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                placeholder="Enter your password"
                disabled={isSubmitting}
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error ? <p role="alert" className="auth-error">{error}</p> : null}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <LoadingStatus>Logging in… pantry awaits.</LoadingStatus> : "Log in"}
            </Button>
          </form>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            New to StockHome?{" "}
            <Link href="/register" className="auth-link">
              Create an account
            </Link>
          </p>
    </AuthLayout>
  );
}

