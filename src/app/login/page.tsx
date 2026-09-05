"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { TrishulIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("Couldn't sign in — check the email and password and try again.");
      setLoading(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ground px-5">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-surface p-7 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-strong shadow-sm">
            <TrishulIcon className="h-6 w-6" />
          </span>
          <h1 className="mt-3 font-display text-xl font-extrabold text-ink">GV Durga Puja</h1>
          <p className="mt-1 text-[0.82rem] text-ink-faint">
            Committee sign-in for collections, sponsors &amp; vendors
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-[0.8rem] font-semibold text-ink">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-sunken px-3.5 py-2.5 text-[0.9rem] text-ink outline-none focus-visible:border-brand"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-[0.8rem] font-semibold text-ink">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-sunken px-3.5 py-2.5 text-[0.9rem] text-ink outline-none focus-visible:border-brand"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-[0.8rem] text-critical">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand py-2.5 text-[0.9rem] font-semibold text-white transition disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
