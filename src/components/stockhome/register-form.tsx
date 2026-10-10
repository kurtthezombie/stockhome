"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { LoadingStatus } from "@/components/ui/loading-status";
import { AuthLayout } from "@/components/stockhome/auth-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted && data.session) {
        router.replace("/");
      }
    }).catch(() => {
      // The form remains available if the initial session check fails.
    });

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      setPassword("");
      setConfirmPassword("");

      if (data.session) {
        router.replace("/");
      } else {
        setNeedsConfirmation(true);
      }
    } catch {
      setError("Unable to register right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout title={needsConfirmation ? "Check your inbox." : "Make yourself at home."} description={needsConfirmation ? "You’re one step away from a more organized everyday." : "Create your account and bring a little calm to your household."}>
          {needsConfirmation ? (
            <p role="status" className="rounded-2xl border border-[#cbe4dd] bg-[#edf7f3] p-5 text-sm leading-7 text-[#35645a]">
              Check your email for a confirmation link before logging in. If you
              already have an account, you can log in below.
            </p>
          ) : (
            <form className="grid gap-5" onSubmit={handleSubmit} aria-busy={isSubmitting}>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  placeholder="you@example.com"
                  name="email"
                  autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  placeholder="Create a password"
                  name="password"
                  autoComplete="new-password"
                  type="password"
                  minLength={8}
                  aria-describedby="password-hint"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
                <p id="password-hint" className="text-xs text-muted-foreground">
                  Use at least 8 characters.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  placeholder="Re-enter your password"
                  name="confirm-password"
                  autoComplete="new-password"
                  type="password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
              {error ? <p role="alert" className="auth-error">{error}</p> : null}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <LoadingStatus>Creating your pantry HQ…</LoadingStatus> : "Create account"}
              </Button>
            </form>
          )}
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="auth-link">
              Log in
            </Link>
          </p>
    </AuthLayout>
  );
}
