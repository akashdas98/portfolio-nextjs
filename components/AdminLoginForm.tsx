"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { missingSupabaseConfig } from "@/lib/supabase/config";

type AdminLoginFormProps = {
  configured: boolean;
};

export function AdminLoginForm({ configured }: AdminLoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialError =
    searchParams.get("error") === "unauthorized"
      ? "This account is not allowed to access the admin panel."
      : "";
  const [error, setError] = useState(initialError);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      setError("Supabase is not configured yet.");
      setPending(false);
      return;
    }

    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) {
      setError(loginError.message);
      setPending(false);
      return;
    }

    router.push(searchParams.get("next") || "/admin");
    router.refresh();
  }

  if (!configured) {
    return (
      <div className="admin-panel admin-setup">
        <p className="admin-kicker">Setup required</p>
        <h1>Supabase is not connected yet.</h1>
        <p>Add these variables before using admin authentication:</p>
        <ul>
          {missingSupabaseConfig.map((key) => (
            <li key={key}>{key}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <form className="admin-panel admin-login-form" onSubmit={handleSubmit}>
      <p className="admin-kicker">Private admin</p>
      <h1>Sign in</h1>
      <label>
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        <span>Password</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <button className="button button-primary" type="submit" disabled={pending}>
        {pending ? "Signing in" : "Sign in"}
      </button>
      {error ? <p className="admin-form-error">{error}</p> : null}
    </form>
  );
}
